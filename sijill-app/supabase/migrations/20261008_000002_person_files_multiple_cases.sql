create table if not exists public.sijill_case_person_files (
  case_id uuid not null references public.sijill_cases(id) on delete restrict,
  person_file_id uuid not null references public.sijill_person_files(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (case_id, person_file_id)
);

insert into public.sijill_case_person_files (case_id, person_file_id)
select case_id, id from public.sijill_person_files where case_id is not null
on conflict do nothing;

alter table public.sijill_case_person_files enable row level security;
grant select on public.sijill_case_person_files to anon, authenticated;
grant insert, update, delete on public.sijill_case_person_files to authenticated;

drop policy if exists person_file_links_public_read on public.sijill_case_person_files;
create policy person_file_links_public_read on public.sijill_case_person_files
for select to anon, authenticated using (
  exists (
    select 1 from public.sijill_cases c
    join public.sijill_person_files f on f.id = person_file_id
    where c.id = case_id and c.status = 'published' and f.status = 'published'
  )
);

drop policy if exists person_file_links_staff_read on public.sijill_case_person_files;
create policy person_file_links_staff_read on public.sijill_case_person_files
for select to authenticated using (
  public.is_sijill_staff()
  or exists (
    select 1 from public.sijill_person_files f
    where f.id = person_file_id and f.created_by = auth.uid()
  )
);

drop policy if exists person_file_links_author_insert on public.sijill_case_person_files;
create policy person_file_links_author_insert on public.sijill_case_person_files
for insert to authenticated with check (
  exists (
    select 1 from public.sijill_person_files f
    where f.id = person_file_id and f.created_by = auth.uid() and f.status = 'draft'
  )
  and exists (
    select 1 from public.sijill_cases c
    where c.id = case_id and c.status = 'published'
  )
);

drop policy if exists person_file_links_owner_manage on public.sijill_case_person_files;
create policy person_file_links_owner_manage on public.sijill_case_person_files
for all to authenticated using (public.is_sijill_owner())
with check (public.is_sijill_owner());

create index if not exists sijill_case_person_files_file_idx
  on public.sijill_case_person_files(person_file_id);

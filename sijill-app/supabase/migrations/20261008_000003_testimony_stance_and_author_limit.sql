-- Classify each testimony in relation to its parent record and enforce one
-- testimony per signed-in author for each case or person file.

alter table public.sijill_testimonies
  add column if not exists position text not null default 'supporting';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sijill_testimonies_position_check'
      and conrelid = 'public.sijill_testimonies'::regclass
  ) then
    alter table public.sijill_testimonies
      add constraint sijill_testimonies_position_check
      check (position in ('supporting', 'opposing'));
  end if;
end $$;

-- Existing duplicate rows are preserved. If any are present, resolve them
-- manually before this migration so no testimony is deleted or merged silently.
do $$
begin
  if exists (
    select 1 from public.sijill_testimonies
    where created_by is not null and case_id is not null
    group by created_by, case_id having count(*) > 1
  ) or exists (
    select 1 from public.sijill_testimonies
    where created_by is not null and person_file_id is not null
    group by created_by, person_file_id having count(*) > 1
  ) then
    raise exception 'Duplicate author testimonies exist; review them before applying the one-testimony-per-parent migration.';
  end if;
end $$;

create unique index if not exists sijill_testimonies_one_per_author_case_idx
  on public.sijill_testimonies (created_by, case_id)
  where created_by is not null and case_id is not null;

create unique index if not exists sijill_testimonies_one_per_author_file_idx
  on public.sijill_testimonies (created_by, person_file_id)
  where created_by is not null and person_file_id is not null;

-- One changeable support/oppose vote per account and published archive record.
create table if not exists public.sijill_case_votes (
  case_id uuid not null references public.sijill_cases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position text not null check (position in ('supporting', 'opposing')),
  created_at timestamptz not null default now(),
  primary key (case_id, user_id)
);

create table if not exists public.sijill_person_file_votes (
  person_file_id uuid not null references public.sijill_person_files(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position text not null check (position in ('supporting', 'opposing')),
  created_at timestamptz not null default now(),
  primary key (person_file_id, user_id)
);

alter table public.sijill_case_votes enable row level security;
alter table public.sijill_person_file_votes enable row level security;

grant select on public.sijill_case_votes, public.sijill_person_file_votes to authenticated;
grant insert, update on public.sijill_case_votes, public.sijill_person_file_votes to authenticated;

drop policy if exists case_votes_public_read on public.sijill_case_votes;
drop policy if exists case_votes_author_read on public.sijill_case_votes;
create policy case_votes_author_read on public.sijill_case_votes
for select to authenticated using (user_id = auth.uid());

drop policy if exists case_votes_author_insert on public.sijill_case_votes;
create policy case_votes_author_insert on public.sijill_case_votes
for insert to authenticated with check (
  user_id = auth.uid()
  and exists (select 1 from public.sijill_cases c where c.id = case_id and c.status = 'published')
);

drop policy if exists case_votes_author_update on public.sijill_case_votes;
create policy case_votes_author_update on public.sijill_case_votes
for update to authenticated using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (select 1 from public.sijill_cases c where c.id = case_id and c.status = 'published')
);

drop policy if exists person_file_votes_public_read on public.sijill_person_file_votes;
drop policy if exists person_file_votes_author_read on public.sijill_person_file_votes;
create policy person_file_votes_author_read on public.sijill_person_file_votes
for select to authenticated using (user_id = auth.uid());

drop policy if exists person_file_votes_author_insert on public.sijill_person_file_votes;
create policy person_file_votes_author_insert on public.sijill_person_file_votes
for insert to authenticated with check (
  user_id = auth.uid()
  and exists (select 1 from public.sijill_person_files f where f.id = person_file_id and f.status = 'published')
);

drop policy if exists person_file_votes_author_update on public.sijill_person_file_votes;
create policy person_file_votes_author_update on public.sijill_person_file_votes
for update to authenticated using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (select 1 from public.sijill_person_files f where f.id = person_file_id and f.status = 'published')
);

-- Return aggregate totals without exposing voter identifiers or their choices.
create or replace function public.sijill_vote_totals(p_case_id uuid default null, p_person_file_id uuid default null)
returns table(supporting bigint, opposing bigint)
language sql stable security definer set search_path = public, pg_temp
as $$
  select
    case
      when p_case_id is not null and p_person_file_id is null and exists (
        select 1 from public.sijill_cases c where c.id = p_case_id and c.status = 'published'
      ) then (select count(*) from public.sijill_case_votes v where v.case_id = p_case_id and v.position = 'supporting')
      when p_person_file_id is not null and p_case_id is null and exists (
        select 1 from public.sijill_person_files f where f.id = p_person_file_id and f.status = 'published'
      ) then (select count(*) from public.sijill_person_file_votes v where v.person_file_id = p_person_file_id and v.position = 'supporting')
      else 0
    end,
    case
      when p_case_id is not null and p_person_file_id is null and exists (
        select 1 from public.sijill_cases c where c.id = p_case_id and c.status = 'published'
      ) then (select count(*) from public.sijill_case_votes v where v.case_id = p_case_id and v.position = 'opposing')
      when p_person_file_id is not null and p_case_id is null and exists (
        select 1 from public.sijill_person_files f where f.id = p_person_file_id and f.status = 'published'
      ) then (select count(*) from public.sijill_person_file_votes v where v.person_file_id = p_person_file_id and v.position = 'opposing')
      else 0
    end;
$$;

revoke all on function public.sijill_vote_totals(uuid, uuid) from public;
grant execute on function public.sijill_vote_totals(uuid, uuid) to anon, authenticated;

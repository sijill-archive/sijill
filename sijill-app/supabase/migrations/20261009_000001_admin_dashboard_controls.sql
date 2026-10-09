-- Owner-only file maintenance and settings used by the administration screens.
alter table public.sijill_person_files
  add column if not exists admin_updated_at timestamptz;

drop policy if exists files_author_update on public.sijill_person_files;
drop policy if exists files_author_delete_draft on public.sijill_person_files;
-- Keep owner manage as the only update/delete policy for person files.

alter table public.sijill_verification_requests
  add column if not exists review_note text not null default '';

create table if not exists public.sijill_site_settings (
  singleton boolean primary key default true check (singleton),
  background_color text not null default '#151916' check (background_color ~ '^#[0-9A-Fa-f]{6}$'),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.sijill_site_settings(singleton) values (true) on conflict (singleton) do nothing;
alter table public.sijill_site_settings enable row level security;
grant select on public.sijill_site_settings to anon, authenticated;
grant insert, update on public.sijill_site_settings to authenticated;
drop policy if exists site_settings_read on public.sijill_site_settings;
create policy site_settings_read on public.sijill_site_settings for select to anon, authenticated using (true);
drop policy if exists site_settings_owner_manage on public.sijill_site_settings;
create policy site_settings_owner_manage on public.sijill_site_settings for all to authenticated
  using (public.is_sijill_owner()) with check (public.is_sijill_owner());

drop policy if exists verification_owner_manage on public.sijill_verification_requests;
create policy verification_owner_manage on public.sijill_verification_requests for all to authenticated
  using (public.is_sijill_owner()) with check (public.is_sijill_owner());

create or replace function public.sijill_admin_yearly_archive_stats()
returns table (year integer, cases bigint, files bigint)
language sql stable security invoker set search_path = public, pg_temp
as $$
  with yearly_rows as (
    select extract(year from c.event_date)::integer as year, count(distinct c.id)::bigint as cases, 0::bigint as files
    from public.sijill_cases c
    where c.status = 'published' and c.event_date is not null
    group by extract(year from c.event_date)::integer
    union all
    select extract(year from c.event_date)::integer as year, 0::bigint as cases, count(distinct f.id)::bigint as files
    from public.sijill_cases c
    join public.sijill_person_files f on f.status = 'published'
      and (f.case_id = c.id or exists (
        select 1 from public.sijill_case_person_files link
        where link.case_id = c.id and link.person_file_id = f.id
      ))
    where c.status = 'published' and c.event_date is not null
    group by extract(year from c.event_date)::integer
  )
  select yearly_rows.year, sum(yearly_rows.cases)::bigint, sum(yearly_rows.files)::bigint
  from yearly_rows group by yearly_rows.year order by yearly_rows.year
$$;

revoke all on function public.sijill_admin_yearly_archive_stats() from public, anon;
grant execute on function public.sijill_admin_yearly_archive_stats() to authenticated;

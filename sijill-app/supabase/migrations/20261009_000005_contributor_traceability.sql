begin;

-- Bootstrap the author-profile dependency if the earlier workspace migration
-- was not applied to this deployment. No email addresses are copied.
create table if not exists public.sijill_public_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 120),
  preferred_language text not null default 'ar' check (preferred_language in ('ar', 'en')),
  updated_at timestamptz not null default now()
);
alter table public.sijill_public_profiles enable row level security;
grant select on public.sijill_public_profiles to anon, authenticated;
grant insert (user_id, display_name, preferred_language) on public.sijill_public_profiles to authenticated;
grant update (display_name, preferred_language, updated_at) on public.sijill_public_profiles to authenticated;
drop policy if exists sijill_profiles_public_read on public.sijill_public_profiles;
create policy sijill_profiles_public_read on public.sijill_public_profiles for select to anon, authenticated using (true);
drop policy if exists sijill_profiles_self_insert on public.sijill_public_profiles;
create policy sijill_profiles_self_insert on public.sijill_public_profiles for insert to authenticated with check (user_id = auth.uid());
drop policy if exists sijill_profiles_self_update on public.sijill_public_profiles;
create policy sijill_profiles_self_update on public.sijill_public_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
insert into public.sijill_public_profiles(user_id, display_name, preferred_language)
select id, left(coalesce(nullif(trim(raw_user_meta_data ->> 'display_name'), ''),
 nullif(trim(concat_ws(' ', raw_user_meta_data ->> 'first_name', raw_user_meta_data ->> 'last_name')), ''),
 nullif(trim(raw_user_meta_data ->> 'full_name'), ''), nullif(trim(raw_user_meta_data ->> 'name'), ''), 'مستخدم سِجِلّ'), 120),
 case when raw_user_meta_data ->> 'preferred_language' = 'en' then 'en' else 'ar' end
from auth.users on conflict(user_id) do nothing;


-- Audit snapshots contain identities, titles, changed field names and states,
-- never testimony bodies or evidence. Existing owner-only RLS remains in place.
alter table public.sijill_activity_log
  add column if not exists record_author_id uuid,
  add column if not exists actor_name text,
  add column if not exists author_name text,
  add column if not exists record_title text,
  add column if not exists previous_status text,
  add column if not exists new_status text,
  add column if not exists related_record_id uuid;
create index if not exists sijill_activity_actor_idx on public.sijill_activity_log(actor_id, happened_at desc);
create index if not exists sijill_activity_author_idx on public.sijill_activity_log(record_author_id, happened_at desc);
create index if not exists sijill_cases_author_idx on public.sijill_cases(created_by, created_at desc);
create index if not exists sijill_files_author_idx on public.sijill_person_files(created_by, created_at desc);
create index if not exists sijill_testimonies_author_idx on public.sijill_testimonies(created_by, created_at desc);

-- Fill only recoverable metadata for previous activity. Old deleted records and
-- previous publication states cannot be reconstructed and stay unknown.
with records as (
  select 'sijill_cases' as record_type, id, created_by, title from public.sijill_cases
  union all select 'sijill_person_files', id, created_by, title from public.sijill_person_files
  union all select 'sijill_testimonies', id, created_by, title from public.sijill_testimonies
)
update public.sijill_activity_log log set
  record_author_id = records.created_by,
  record_title = coalesce(log.record_title, records.title)
from records where log.record_type = records.record_type and log.record_id = records.id
  and log.record_author_id is null;
update public.sijill_activity_log log set actor_name = p.display_name
from public.sijill_public_profiles p where log.actor_id = p.user_id and log.actor_name is null;
update public.sijill_activity_log log set author_name = p.display_name
from public.sijill_public_profiles p where log.record_author_id = p.user_id and log.author_name is null;

create or replace function public.log_archive_change()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  before_row jsonb; after_row jsonb; snapshot jsonb; changed text[] := '{}';
  record_uuid uuid; author_uuid uuid; actor_label text; author_label text;
begin
  if tg_op = 'INSERT' then
    after_row := to_jsonb(new);
    select coalesce(array_agg(keys.key order by keys.key), '{}') into changed from jsonb_object_keys(after_row) as keys(key);
  elsif tg_op = 'DELETE' then
    before_row := to_jsonb(old);
    select coalesce(array_agg(keys.key order by keys.key), '{}') into changed from jsonb_object_keys(before_row) as keys(key);
  else
    before_row := to_jsonb(old); after_row := to_jsonb(new);
    select coalesce(array_agg(n.key order by n.key), '{}') into changed
    from jsonb_each(after_row) n left join jsonb_each(before_row) o using (key)
    where n.value is distinct from o.value and n.key <> 'updated_at';
    if cardinality(changed) = 0 then return null; end if;
  end if;
  snapshot := coalesce(after_row, before_row);
  record_uuid := coalesce(snapshot ->> 'id', snapshot ->> 'user_id', snapshot ->> 'recipient_id')::uuid;
  author_uuid := coalesce(snapshot ->> 'created_by', snapshot ->> 'requested_by', snapshot ->> 'user_id')::uuid;
  select display_name into actor_label from public.sijill_public_profiles where user_id = auth.uid();
  select display_name into author_label from public.sijill_public_profiles where user_id = author_uuid;
  insert into public.sijill_activity_log(actor_id, actor_name, record_author_id, author_name, record_type, record_id, record_title, action, changed_fields, previous_status, new_status)
  values (auth.uid(), actor_label, author_uuid, author_label, tg_argv[0], record_uuid,
    coalesce(snapshot ->> 'title', snapshot ->> 'display_name', snapshot ->> 'subject'),
    case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end,
    changed, before_row ->> 'status', after_row ->> 'status');
  return null;
end;
$$;
revoke all on function public.log_archive_change() from public, anon, authenticated;

drop trigger if exists audit_archive_change on public.sijill_public_profiles;
create trigger audit_archive_change after insert or update or delete on public.sijill_public_profiles
  for each row execute function public.log_archive_change('sijill_public_profiles');

create or replace function public.log_sijill_case_file_link()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare link_row jsonb; link_rows jsonb[]; file_record public.sijill_person_files; actor_label text; author_label text;
begin
  if tg_op = 'UPDATE' and new is not distinct from old then return null; end if;
  link_rows := case when tg_op = 'UPDATE' then array[to_jsonb(old), to_jsonb(new)]
    when tg_op = 'DELETE' then array[to_jsonb(old)] else array[to_jsonb(new)] end;
  foreach link_row in array link_rows loop
  select * into file_record from public.sijill_person_files where id = (link_row ->> 'person_file_id')::uuid;
  select display_name into actor_label from public.sijill_public_profiles where user_id = auth.uid();
  select display_name into author_label from public.sijill_public_profiles where user_id = file_record.created_by;
  insert into public.sijill_activity_log(actor_id, actor_name, record_author_id, author_name, record_type, record_id, record_title, action, changed_fields, related_record_id)
  values (auth.uid(), actor_label, file_record.created_by, author_label, 'sijill_person_files',
    (link_row ->> 'person_file_id')::uuid, file_record.title, 'updated',
    array[case when tg_op = 'DELETE' or (tg_op = 'UPDATE' and link_row = to_jsonb(old)) then 'linked_case_removed' else 'linked_case_added' end],
    (link_row ->> 'case_id')::uuid);
  end loop;
  return null;
end;
$$;
revoke all on function public.log_sijill_case_file_link() from public, anon, authenticated;
drop trigger if exists audit_case_file_link on public.sijill_case_person_files;
create trigger audit_case_file_link after insert or update or delete on public.sijill_case_person_files
  for each row execute function public.log_sijill_case_file_link();

-- Google accounts may provide full_name/name rather than first_name/last_name.
create or replace function public.sync_sijill_public_profile()
returns trigger language plpgsql security definer set search_path = public, auth, pg_temp
as $$
declare profile_name text; profile_language text;
begin
  profile_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(concat_ws(' ', new.raw_user_meta_data ->> 'first_name', new.raw_user_meta_data ->> 'last_name')), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), nullif(trim(new.raw_user_meta_data ->> 'name'), ''), 'مستخدم سِجِلّ');
  profile_name := left(profile_name, 120);
  profile_language := case when new.raw_user_meta_data ->> 'preferred_language' = 'en' then 'en' else 'ar' end;
  insert into public.sijill_public_profiles(user_id, display_name, preferred_language)
  values(new.id, profile_name, profile_language)
  on conflict(user_id) do update set display_name = excluded.display_name,
    preferred_language = excluded.preferred_language, updated_at = now();
  return new;
end;
$$;
revoke all on function public.sync_sijill_public_profile() from public, anon, authenticated;
drop trigger if exists sijill_sync_public_profile on auth.users;
create trigger sijill_sync_public_profile after insert or update of raw_user_meta_data, email on auth.users
  for each row execute function public.sync_sijill_public_profile();
update public.sijill_public_profiles p set display_name = left(coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), nullif(trim(u.raw_user_meta_data ->> 'name'), '')), 120)
from auth.users u where p.user_id = u.id and p.display_name = 'مستخدم سِجِلّ'
  and coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), nullif(trim(u.raw_user_meta_data ->> 'name'), '')) is not null;

commit;

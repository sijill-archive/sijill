-- Sijill administration foundation. Apply through Supabase SQL Editor.
-- Assign the first owner separately; instructions are in supabase/README.md.

create extension if not exists pgcrypto;

create table if not exists public.sijill_user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor')),
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create or replace function public.current_sijill_role()
returns text language sql stable security definer set search_path = public, pg_temp
as $$ select coalesce((select r.role from public.sijill_user_roles r where r.user_id = auth.uid()), 'member') $$;

create or replace function public.is_sijill_owner()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select public.current_sijill_role() = 'owner' $$;

create or replace function public.is_sijill_staff()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select public.current_sijill_role() in ('owner', 'editor') $$;

revoke all on function public.current_sijill_role() from public, anon;
revoke all on function public.is_sijill_owner() from public, anon;
revoke all on function public.is_sijill_staff() from public, anon;
grant execute on function public.current_sijill_role() to authenticated;
grant execute on function public.is_sijill_owner() to authenticated;
grant execute on function public.is_sijill_staff() to authenticated;

create table if not exists public.sijill_cases (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null check (length(trim(title)) between 3 and 180),
  event_type text not null default 'other',
  description text not null default '',
  country text not null default 'سوريا',
  governorate text not null,
  district_id text not null,
  district_name text not null,
  city text not null,
  location_description text,
  event_date date,
  approximate_date text,
  status text not null default 'submitted' check (status in ('draft', 'submitted', 'published', 'rejected', 'archived')),
  ai_review_status text not null default 'not_started' check (ai_review_status in ('not_started', 'in_progress', 'passed', 'flagged', 'failed')),
  ai_reviewed_at timestamptz,
  ai_review_summary text,
  published_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sijill_person_files (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null check (length(trim(title)) between 2 and 180),
  description text not null default '',
  aliases text[] not null default '{}',
  case_id uuid references public.sijill_cases(id) on delete restrict,
  country text,
  governorate text,
  district_id text,
  district_name text,
  city text,
  location_description text,
  status text not null default 'submitted' check (status in ('draft', 'submitted', 'published', 'rejected', 'archived')),
  ai_review_status text not null default 'not_started' check (ai_review_status in ('not_started', 'in_progress', 'passed', 'flagged', 'failed')),
  ai_reviewed_at timestamptz,
  ai_review_summary text,
  published_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sijill_testimonies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  event_date date,
  country text not null default 'سوريا',
  city text not null,
  location_description text not null default '',
  evidence_level smallint not null default 1 check (evidence_level between 1 and 5),
  source_type text not null default 'other',
  case_id uuid references public.sijill_cases(id) on delete restrict,
  person_file_id uuid references public.sijill_person_files(id) on delete restrict,
  created_by uuid references auth.users(id) on delete restrict,
  public_consent boolean not null default false,
  status text not null default 'submitted' check (status in ('draft', 'submitted', 'published', 'rejected', 'archived')),
  ai_review_status text not null default 'not_started' check (ai_review_status in ('not_started', 'in_progress', 'passed', 'flagged', 'failed')),
  ai_reviewed_at timestamptz,
  ai_review_summary text,
  published_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint testimonies_one_parent check (num_nonnulls(case_id, person_file_id) = 1)
);

create table if not exists public.sijill_articles (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null check (length(trim(title)) between 3 and 220),
  summary text not null default '',
  body text not null default '',
  category text not null default 'human_rights',
  status text not null default 'draft' check (status in ('draft', 'submitted', 'published', 'rejected', 'archived')),
  ai_review_status text not null default 'not_started' check (ai_review_status in ('not_started', 'in_progress', 'passed', 'flagged', 'failed')),
  ai_reviewed_at timestamptz,
  ai_review_summary text,
  published_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sijill_verification_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references auth.users(id) on delete restrict,
  subject_type text not null check (subject_type in ('case', 'person_file', 'testimony', 'article')),
  subject_id uuid not null,
  request_type text not null default 'verify',
  details text not null default '',
  status text not null default 'pending' check (status in ('pending', 'in_review', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.sijill_activity_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  record_type text not null,
  record_id uuid not null,
  action text not null check (action in ('created', 'updated', 'deleted')),
  changed_fields text[] not null default '{}',
  happened_at timestamptz not null default now()
);

create table if not exists public.sijill_support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  subject text not null,
  category text not null default 'general',
  status text not null default 'open' check (status in ('open', 'waiting_user', 'resolved', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sijill_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.sijill_support_tickets(id) on delete restrict,
  sender_id uuid not null references auth.users(id) on delete restrict,
  body text not null check (length(trim(body)) between 1 and 10000),
  created_at timestamptz not null default now()
);

create table if not exists public.sijill_admin_messages (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete restrict,
  subject text not null,
  body text not null,
  sent_by uuid not null references auth.users(id) on delete restrict,
  sent_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.sijill_notification_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null,
  body text not null,
  audience text not null default 'all' check (audience in ('all', 'members', 'editors')),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sent', 'cancelled')),
  scheduled_for timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sijill_broadcast_notifications (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null,
  body text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists sijill_cases_status_created_idx on public.sijill_cases(status, created_at desc);
create index if not exists sijill_files_status_created_idx on public.sijill_person_files(status, created_at desc);
create index if not exists sijill_testimonies_status_created_idx on public.sijill_testimonies(status, created_at desc);
create index if not exists sijill_articles_status_created_idx on public.sijill_articles(status, created_at desc);
create index if not exists sijill_verification_pending_idx on public.sijill_verification_requests(status, created_at desc);
create index if not exists sijill_activity_recent_idx on public.sijill_activity_log(happened_at desc);
create index if not exists sijill_support_user_idx on public.sijill_support_tickets(user_id, updated_at desc);
create index if not exists sijill_tickets_messages_idx on public.sijill_ticket_messages(ticket_id, created_at);

create or replace function public.guard_content_workflow()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare actor_role text := public.current_sijill_role();
begin
  if actor_role = 'owner' then return new; end if;
  if tg_op = 'INSERT' then
    if auth.uid() is null or new.created_by is distinct from auth.uid() then raise exception 'Content must belong to the signed-in author'; end if;
    if new.ai_review_status <> 'not_started' or new.ai_reviewed_at is not null then raise exception 'Only the owner may set AI review metadata'; end if;
    if new.status = 'published' then raise exception 'New content must pass review before publication'; end if;
    if new.published_at is not null or new.published_by is not null then raise exception 'Only the owner may set publication metadata'; end if;
    return new;
  end if;
  if old.created_by is distinct from auth.uid() or new.created_by is distinct from old.created_by then raise exception 'Authors may only edit their own content'; end if;
  if new.ai_review_status is distinct from old.ai_review_status or new.ai_reviewed_at is distinct from old.ai_reviewed_at or new.ai_review_summary is distinct from old.ai_review_summary then raise exception 'Only the owner may set AI review metadata'; end if;
  if actor_role = 'member' and new.status is distinct from old.status and new.status not in ('draft', 'submitted') then raise exception 'Members cannot approve, reject, archive, or publish content'; end if;
  if actor_role = 'editor' and new.status not in ('draft', 'submitted', 'published', 'archived') then raise exception 'Editors cannot reject content'; end if;
  if new.status = 'published' and old.status is distinct from 'published' and (actor_role <> 'editor' or new.ai_review_status <> 'passed' or new.ai_reviewed_at is null) then
    raise exception 'An editor may publish their own content only after a passed AI review';
  end if;
  if new.status = 'published' and old.status is distinct from 'published' then
    new.published_at := now();
    new.published_by := auth.uid();
  elsif new.published_at is distinct from old.published_at or new.published_by is distinct from old.published_by then
    raise exception 'Only the owner may modify publication metadata';
  end if;
  return new;
end;
$$;

create or replace function public.log_archive_change()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare before_row jsonb; after_row jsonb; changed text[] := '{}'; record_uuid uuid; row_type text := tg_argv[0];
begin
  if tg_op = 'INSERT' then
    after_row := to_jsonb(new); record_uuid := coalesce(after_row ->> 'id', after_row ->> 'user_id', after_row ->> 'recipient_id')::uuid;
    select coalesce(array_agg(keys.key order by keys.key), '{}') into changed from jsonb_object_keys(after_row) as keys(key);
  elsif tg_op = 'DELETE' then
    before_row := to_jsonb(old); record_uuid := coalesce(before_row ->> 'id', before_row ->> 'user_id', before_row ->> 'recipient_id')::uuid;
    select coalesce(array_agg(keys.key order by keys.key), '{}') into changed from jsonb_object_keys(before_row) as keys(key);
  else
    before_row := to_jsonb(old); after_row := to_jsonb(new); record_uuid := coalesce(after_row ->> 'id', after_row ->> 'user_id', after_row ->> 'recipient_id')::uuid;
    select coalesce(array_agg(n.key order by n.key), '{}') into changed from jsonb_each(after_row) n left join jsonb_each(before_row) o using (key) where n.value is distinct from o.value and n.key <> 'updated_at';
  end if;
  insert into public.sijill_activity_log(actor_id, record_type, record_id, action, changed_fields)
  values (auth.uid(), row_type, record_uuid, case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end, changed);
  return null;
end;
$$;

revoke all on function public.guard_content_workflow() from public, anon, authenticated;
revoke all on function public.log_archive_change() from public, anon, authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['sijill_cases', 'sijill_person_files', 'sijill_testimonies', 'sijill_articles'] loop
    execute format('drop trigger if exists guard_workflow on public.%I', table_name);
    execute format('create trigger guard_workflow before insert or update on public.%I for each row execute function public.guard_content_workflow()', table_name);
  end loop;
  foreach table_name in array array['sijill_cases', 'sijill_person_files', 'sijill_testimonies', 'sijill_articles', 'sijill_user_roles', 'sijill_verification_requests', 'sijill_support_tickets', 'sijill_ticket_messages', 'sijill_admin_messages', 'sijill_notification_campaigns', 'sijill_broadcast_notifications'] loop
    execute format('drop trigger if exists audit_archive_change on public.%I', table_name);
    execute format('create trigger audit_archive_change after insert or update or delete on public.%I for each row execute function public.log_archive_change(%L)', table_name, table_name);
  end loop;
end $$;

alter table public.sijill_user_roles enable row level security;
alter table public.sijill_cases enable row level security;
alter table public.sijill_person_files enable row level security;
alter table public.sijill_testimonies enable row level security;
alter table public.sijill_articles enable row level security;
alter table public.sijill_verification_requests enable row level security;
alter table public.sijill_activity_log enable row level security;
alter table public.sijill_support_tickets enable row level security;
alter table public.sijill_ticket_messages enable row level security;
alter table public.sijill_admin_messages enable row level security;
alter table public.sijill_notification_campaigns enable row level security;
alter table public.sijill_broadcast_notifications enable row level security;

grant select, insert, update, delete on public.sijill_user_roles, public.sijill_cases, public.sijill_person_files, public.sijill_testimonies, public.sijill_articles, public.sijill_verification_requests, public.sijill_support_tickets, public.sijill_ticket_messages, public.sijill_admin_messages, public.sijill_notification_campaigns, public.sijill_broadcast_notifications to authenticated;
grant select on public.sijill_cases, public.sijill_person_files, public.sijill_testimonies, public.sijill_articles, public.sijill_broadcast_notifications to anon;
grant select on public.sijill_activity_log to authenticated;

drop policy if exists roles_read_self_or_owner on public.sijill_user_roles;
create policy roles_read_self_or_owner on public.sijill_user_roles for select to authenticated using (user_id = auth.uid() or public.is_sijill_owner());
drop policy if exists roles_owner_manage on public.sijill_user_roles;
create policy roles_owner_manage on public.sijill_user_roles for all to authenticated using (public.is_sijill_owner()) with check (public.is_sijill_owner());

drop policy if exists cases_public_read on public.sijill_cases;
create policy cases_public_read on public.sijill_cases for select to anon, authenticated using (status = 'published');
drop policy if exists cases_staff_read on public.sijill_cases;
create policy cases_staff_read on public.sijill_cases for select to authenticated using (public.is_sijill_staff());
drop policy if exists cases_author_read on public.sijill_cases;
create policy cases_author_read on public.sijill_cases for select to authenticated using (created_by = auth.uid());
drop policy if exists cases_owner_manage on public.sijill_cases;
create policy cases_owner_manage on public.sijill_cases for all to authenticated using (public.is_sijill_owner()) with check (public.is_sijill_owner());
drop policy if exists cases_author_insert on public.sijill_cases;
create policy cases_author_insert on public.sijill_cases for insert to authenticated with check (created_by = auth.uid() and status in ('draft', 'submitted'));
drop policy if exists cases_author_update on public.sijill_cases;
create policy cases_author_update on public.sijill_cases for update to authenticated using (created_by = auth.uid() and public.current_sijill_role() in ('member', 'editor')) with check (created_by = auth.uid());

drop policy if exists files_public_read on public.sijill_person_files;
create policy files_public_read on public.sijill_person_files for select to anon, authenticated using (status = 'published');
drop policy if exists files_staff_read on public.sijill_person_files;
create policy files_staff_read on public.sijill_person_files for select to authenticated using (public.is_sijill_staff());
drop policy if exists files_author_read on public.sijill_person_files;
create policy files_author_read on public.sijill_person_files for select to authenticated using (created_by = auth.uid());
drop policy if exists files_owner_manage on public.sijill_person_files;
create policy files_owner_manage on public.sijill_person_files for all to authenticated using (public.is_sijill_owner()) with check (public.is_sijill_owner());
drop policy if exists files_author_insert on public.sijill_person_files;
create policy files_author_insert on public.sijill_person_files for insert to authenticated with check (created_by = auth.uid() and status in ('draft', 'submitted'));
drop policy if exists files_author_update on public.sijill_person_files;
create policy files_author_update on public.sijill_person_files for update to authenticated using (created_by = auth.uid() and public.current_sijill_role() in ('member', 'editor')) with check (created_by = auth.uid());

drop policy if exists testimonies_public_read on public.sijill_testimonies;
create policy testimonies_public_read on public.sijill_testimonies for select to anon, authenticated using (status = 'published' and public_consent = true);
drop policy if exists testimonies_staff_read on public.sijill_testimonies;
create policy testimonies_staff_read on public.sijill_testimonies for select to authenticated using (public.is_sijill_staff());
drop policy if exists testimonies_author_read on public.sijill_testimonies;
create policy testimonies_author_read on public.sijill_testimonies for select to authenticated using (created_by = auth.uid());
drop policy if exists testimonies_owner_manage on public.sijill_testimonies;
create policy testimonies_owner_manage on public.sijill_testimonies for all to authenticated using (public.is_sijill_owner()) with check (public.is_sijill_owner());
drop policy if exists testimonies_author_insert on public.sijill_testimonies;
create policy testimonies_author_insert on public.sijill_testimonies for insert to authenticated with check (created_by = auth.uid() and status in ('draft', 'submitted'));
drop policy if exists testimonies_author_update on public.sijill_testimonies;
create policy testimonies_author_update on public.sijill_testimonies for update to authenticated using (created_by = auth.uid() and public.current_sijill_role() in ('member', 'editor')) with check (created_by = auth.uid());

drop policy if exists articles_public_read on public.sijill_articles;
create policy articles_public_read on public.sijill_articles for select to anon, authenticated using (status = 'published');
drop policy if exists articles_staff_read on public.sijill_articles;
create policy articles_staff_read on public.sijill_articles for select to authenticated using (public.is_sijill_staff());
drop policy if exists articles_author_read on public.sijill_articles;
create policy articles_author_read on public.sijill_articles for select to authenticated using (created_by = auth.uid());
drop policy if exists articles_owner_manage on public.sijill_articles;
create policy articles_owner_manage on public.sijill_articles for all to authenticated using (public.is_sijill_owner()) with check (public.is_sijill_owner());
drop policy if exists articles_editor_insert on public.sijill_articles;
create policy articles_editor_insert on public.sijill_articles for insert to authenticated with check (created_by = auth.uid() and public.current_sijill_role() = 'editor' and status in ('draft', 'submitted'));
drop policy if exists articles_editor_update on public.sijill_articles;
create policy articles_editor_update on public.sijill_articles for update to authenticated using (created_by = auth.uid() and public.current_sijill_role() = 'editor') with check (created_by = auth.uid());

drop policy if exists verification_staff_read on public.sijill_verification_requests;
create policy verification_staff_read on public.sijill_verification_requests for select to authenticated using (public.is_sijill_staff());
drop policy if exists verification_author_read on public.sijill_verification_requests;
create policy verification_author_read on public.sijill_verification_requests for select to authenticated using (requested_by = auth.uid());
drop policy if exists verification_owner_manage on public.sijill_verification_requests;
create policy verification_owner_manage on public.sijill_verification_requests for all to authenticated using (public.is_sijill_owner()) with check (public.is_sijill_owner());
drop policy if exists verification_member_insert on public.sijill_verification_requests;
create policy verification_member_insert on public.sijill_verification_requests for insert to authenticated with check (requested_by = auth.uid());

drop policy if exists activity_owner_read on public.sijill_activity_log;
create policy activity_owner_read on public.sijill_activity_log for select to authenticated using (public.is_sijill_owner());
drop policy if exists ticket_staff_read on public.sijill_support_tickets;
create policy ticket_staff_read on public.sijill_support_tickets for select to authenticated using (public.is_sijill_staff());
drop policy if exists ticket_owner_read on public.sijill_support_tickets;
create policy ticket_owner_read on public.sijill_support_tickets for select to authenticated using (user_id = auth.uid());
drop policy if exists ticket_staff_update on public.sijill_support_tickets;
create policy ticket_staff_update on public.sijill_support_tickets for update to authenticated using (public.is_sijill_staff()) with check (public.is_sijill_staff());
drop policy if exists ticket_owner_insert on public.sijill_support_tickets;
create policy ticket_owner_insert on public.sijill_support_tickets for insert to authenticated with check (user_id = auth.uid());
drop policy if exists ticket_message_read on public.sijill_ticket_messages;
create policy ticket_message_read on public.sijill_ticket_messages for select to authenticated using (public.is_sijill_staff() or exists (select 1 from public.sijill_support_tickets t where t.id = ticket_id and t.user_id = auth.uid()));
drop policy if exists ticket_message_insert on public.sijill_ticket_messages;
create policy ticket_message_insert on public.sijill_ticket_messages for insert to authenticated with check (sender_id = auth.uid() and (public.is_sijill_staff() or exists (select 1 from public.sijill_support_tickets t where t.id = ticket_id and t.user_id = auth.uid())));

drop policy if exists admin_message_read on public.sijill_admin_messages;
create policy admin_message_read on public.sijill_admin_messages for select to authenticated using (recipient_id = auth.uid() or public.is_sijill_owner());
drop policy if exists admin_message_owner_manage on public.sijill_admin_messages;
create policy admin_message_owner_manage on public.sijill_admin_messages for all to authenticated using (public.is_sijill_owner()) with check (public.is_sijill_owner());
drop policy if exists campaign_owner_manage on public.sijill_notification_campaigns;
create policy campaign_owner_manage on public.sijill_notification_campaigns for all to authenticated using (public.is_sijill_owner()) with check (public.is_sijill_owner());
drop policy if exists broadcast_public_read on public.sijill_broadcast_notifications;
create policy broadcast_public_read on public.sijill_broadcast_notifications for select to anon, authenticated using (status = 'published');
drop policy if exists broadcast_owner_manage on public.sijill_broadcast_notifications;
create policy broadcast_owner_manage on public.sijill_broadcast_notifications for all to authenticated using (public.is_sijill_owner()) with check (public.is_sijill_owner());

-- There are intentionally no delete policies for editors or members.

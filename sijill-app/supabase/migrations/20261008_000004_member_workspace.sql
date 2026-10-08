-- Public author names and language preference. Email addresses remain private in auth.users.
create table if not exists public.sijill_public_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 120),
  preferred_language text not null default 'ar' check (preferred_language in ('ar', 'en')),
  updated_at timestamptz not null default now()
);

create or replace function public.sync_sijill_public_profile()
returns trigger language plpgsql security definer set search_path = public, auth, pg_temp
as $$
declare
  profile_name text;
  profile_language text;
begin
  profile_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(concat_ws(' ', new.raw_user_meta_data ->> 'first_name', new.raw_user_meta_data ->> 'last_name')), ''),
    'مستخدم سِجِلّ'
  );
  profile_language := case when new.raw_user_meta_data ->> 'preferred_language' = 'en' then 'en' else 'ar' end;
  insert into public.sijill_public_profiles(user_id, display_name, preferred_language)
  values (new.id, profile_name, profile_language)
  on conflict (user_id) do update set
    display_name = excluded.display_name,
    preferred_language = excluded.preferred_language,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists sijill_sync_public_profile on auth.users;
create trigger sijill_sync_public_profile
after insert or update of raw_user_meta_data, email on auth.users
for each row execute function public.sync_sijill_public_profile();

insert into public.sijill_public_profiles(user_id, display_name, preferred_language)
select
  id,
  coalesce(
    nullif(trim(raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(concat_ws(' ', raw_user_meta_data ->> 'first_name', raw_user_meta_data ->> 'last_name')), ''),
    'مستخدم سِجِلّ'
  ),
  case when raw_user_meta_data ->> 'preferred_language' = 'en' then 'en' else 'ar' end
from auth.users
on conflict (user_id) do nothing;

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

-- Content owners may edit for one month after their record is created/submitted.
-- The platform owner remains able to correct archival records.
create or replace function public.enforce_sijill_author_edit_window()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if old.created_by is distinct from auth.uid() or public.is_sijill_owner() then
    return new;
  end if;
  if now() > old.created_at + interval '1 month' then
    raise exception 'The one-month editing period for this record has ended';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_sijill_author_edit_window() from public, anon, authenticated;
drop trigger if exists a_author_edit_window on public.sijill_cases;
create trigger a_author_edit_window before update on public.sijill_cases for each row execute function public.enforce_sijill_author_edit_window();
drop trigger if exists a_author_edit_window on public.sijill_person_files;
create trigger a_author_edit_window before update on public.sijill_person_files for each row execute function public.enforce_sijill_author_edit_window();
drop trigger if exists a_author_edit_window on public.sijill_testimonies;
create trigger a_author_edit_window before update on public.sijill_testimonies for each row execute function public.enforce_sijill_author_edit_window();

create or replace function public.enforce_sijill_testimony_minimum_words()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if public.is_sijill_owner() then return new; end if;
  if tg_op = 'INSERT' or new.description is distinct from old.description then
    if cardinality(regexp_split_to_array(trim(coalesce(new.description, '')), '\s+')) < 20 then
      raise exception 'A testimony must contain at least 20 words';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_sijill_testimony_minimum_words() from public, anon, authenticated;
drop trigger if exists b_testimony_minimum_words on public.sijill_testimonies;
create trigger b_testimony_minimum_words before insert or update on public.sijill_testimonies for each row execute function public.enforce_sijill_testimony_minimum_words();

create table if not exists public.sijill_conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('direct', 'support')),
  subject text not null check (length(trim(subject)) between 1 and 180),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sijill_conversation_members (
  conversation_id uuid not null references public.sijill_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);

create table if not exists public.sijill_direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.sijill_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete restrict,
  body text not null check (length(trim(body)) between 1 and 10000),
  created_at timestamptz not null default now()
);

create index if not exists sijill_conversations_recent_idx on public.sijill_conversations(updated_at desc);
create index if not exists sijill_conversation_members_user_idx on public.sijill_conversation_members(user_id, conversation_id);
create index if not exists sijill_direct_messages_conversation_idx on public.sijill_direct_messages(conversation_id, created_at);

create or replace function public.start_sijill_conversation(p_recipient_id uuid, p_subject text, p_kind text default 'direct')
returns uuid language plpgsql security definer set search_path = public, auth, pg_temp
as $$
declare
  actor uuid := auth.uid();
  destination uuid := p_recipient_id;
  conversation uuid;
begin
  if actor is null then raise exception 'Sign in to start a conversation'; end if;
  if length(trim(coalesce(p_subject, ''))) not between 1 and 180 then raise exception 'Enter a subject'; end if;
  if p_kind = 'support' then
    select user_id into destination from public.sijill_user_roles where role = 'owner' limit 1;
    if destination is null then raise exception 'The administration inbox is not configured'; end if;
  elsif p_kind <> 'direct' then
    raise exception 'Invalid conversation type';
  end if;
  if destination is null or destination = actor then raise exception 'Choose another recipient'; end if;
  if not exists (select 1 from auth.users where id = destination) then raise exception 'The recipient was not found'; end if;
  insert into public.sijill_conversations(kind, subject, created_by)
  values (p_kind, trim(p_subject), actor) returning id into conversation;
  insert into public.sijill_conversation_members(conversation_id, user_id)
  values (conversation, actor), (conversation, destination);
  return conversation;
end;
$$;

create or replace function public.touch_sijill_conversation()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  update public.sijill_conversations set updated_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;
revoke all on function public.touch_sijill_conversation() from public, anon, authenticated;
drop trigger if exists sijill_message_touches_conversation on public.sijill_direct_messages;
create trigger sijill_message_touches_conversation after insert on public.sijill_direct_messages for each row execute function public.touch_sijill_conversation();

-- Security-definer membership check avoids recursive RLS policies on the membership table.
create or replace function public.is_sijill_conversation_member(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.sijill_conversation_members m
    where m.conversation_id = p_conversation_id and m.user_id = auth.uid()
  )
$$;
revoke all on function public.is_sijill_conversation_member(uuid) from public, anon;
grant execute on function public.is_sijill_conversation_member(uuid) to authenticated;

revoke all on function public.start_sijill_conversation(uuid, text, text) from public, anon;
grant execute on function public.start_sijill_conversation(uuid, text, text) to authenticated;

alter table public.sijill_conversations enable row level security;
alter table public.sijill_conversation_members enable row level security;
alter table public.sijill_direct_messages enable row level security;
grant select on public.sijill_conversations, public.sijill_conversation_members, public.sijill_direct_messages to authenticated;
grant insert (conversation_id, sender_id, body) on public.sijill_direct_messages to authenticated;
grant update (last_read_at) on public.sijill_conversation_members to authenticated;

drop policy if exists sijill_conversations_participant_read on public.sijill_conversations;
create policy sijill_conversations_participant_read on public.sijill_conversations for select to authenticated using (
  public.is_sijill_conversation_member(id)
  or (kind = 'support' and public.is_sijill_owner())
);
drop policy if exists sijill_members_participant_read on public.sijill_conversation_members;
create policy sijill_members_participant_read on public.sijill_conversation_members for select to authenticated using (
  user_id = auth.uid() or public.is_sijill_conversation_member(conversation_id)
  or (exists (select 1 from public.sijill_conversations c where c.id = conversation_id and c.kind = 'support') and public.is_sijill_owner())
);
drop policy if exists sijill_members_self_update on public.sijill_conversation_members;
create policy sijill_members_self_update on public.sijill_conversation_members for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists sijill_messages_participant_read on public.sijill_direct_messages;
create policy sijill_messages_participant_read on public.sijill_direct_messages for select to authenticated using (
  public.is_sijill_conversation_member(conversation_id)
  or (exists (select 1 from public.sijill_conversations c where c.id = conversation_id and c.kind = 'support') and public.is_sijill_owner())
);
drop policy if exists sijill_messages_participant_insert on public.sijill_direct_messages;
create policy sijill_messages_participant_insert on public.sijill_direct_messages for insert to authenticated with check (
  sender_id = auth.uid() and public.is_sijill_conversation_member(conversation_id)
);

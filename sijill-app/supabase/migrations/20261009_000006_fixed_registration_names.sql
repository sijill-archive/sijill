begin;

-- Names are set by the registration trigger and cannot be changed afterward.
revoke insert, update on public.sijill_public_profiles from anon, authenticated;
revoke insert (user_id, display_name, preferred_language) on public.sijill_public_profiles from authenticated;
revoke update (display_name, preferred_language, updated_at) on public.sijill_public_profiles from authenticated;
grant update (preferred_language) on public.sijill_public_profiles to authenticated;
-- Only the display name and link identifier are public, including at API level.
revoke select on public.sijill_public_profiles from anon, authenticated;
grant select (user_id, display_name) on public.sijill_public_profiles to anon, authenticated;

create or replace function public.enforce_sijill_fixed_profile_name()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.user_id is distinct from old.user_id or new.display_name is distinct from old.display_name then
    raise exception 'The name recorded at registration cannot be changed';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_sijill_fixed_profile_name() from public, anon, authenticated;
drop trigger if exists a_fixed_profile_name on public.sijill_public_profiles;
create trigger a_fixed_profile_name before update on public.sijill_public_profiles
  for each row execute function public.enforce_sijill_fixed_profile_name();

create or replace function public.sync_sijill_public_profile()
returns trigger language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare profile_name text; profile_language text;
begin
  profile_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(concat_ws(' ', new.raw_user_meta_data ->> 'first_name', new.raw_user_meta_data ->> 'last_name')), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), nullif(trim(new.raw_user_meta_data ->> 'name'), ''));
  if tg_op = 'INSERT' and (profile_name is null or length(profile_name) > 120) then
    raise exception 'A name of 1 to 120 characters is required at registration';
  end if;
  profile_language := case when new.raw_user_meta_data ->> 'preferred_language' = 'en' then 'en' else 'ar' end;
  insert into public.sijill_public_profiles(user_id, display_name, preferred_language)
  values(new.id, coalesce(left(profile_name, 120), 'مستخدم سِجِلّ'), profile_language)
  on conflict(user_id) do update set preferred_language = excluded.preferred_language, updated_at = now();
  return new;
end;
$$;
revoke all on function public.sync_sijill_public_profile() from public, anon, authenticated;
commit;

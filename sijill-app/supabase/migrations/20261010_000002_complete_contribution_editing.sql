begin;

create or replace function public.sijill_edit_window_open(record_status text, published timestamptz, created timestamptz)
returns boolean language sql stable set search_path = public, pg_temp as $$
  select coalesce(published, case when record_status in ('published','archived') then created end) is null
    or now() <= coalesce(published, created) + interval '15 days';
$$;

-- Upload permission follows the same author and publication deadline as content edits.
create or replace function public.sijill_can_upload_evidence(object_name text)
returns boolean language sql stable security invoker set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.sijill_cases c where split_part(object_name,'/',1) = 'cases' and c.id::text = split_part(object_name,'/',2)
      and c.created_by = auth.uid() and public.sijill_edit_window_open(c.status,c.published_at,c.created_at)
    union all
    select 1 from public.sijill_person_files f where split_part(object_name,'/',1) = 'files' and f.id::text = split_part(object_name,'/',2)
      and f.created_by = auth.uid() and public.sijill_edit_window_open(f.status,f.published_at,f.created_at)
    union all
    select 1 from public.sijill_testimonies t where split_part(object_name,'/',1) = 'testimonies' and t.id::text = split_part(object_name,'/',2)
      and t.created_by = auth.uid() and public.sijill_edit_window_open(t.status,t.published_at,t.created_at)
  );
$$;
revoke all on function public.sijill_can_upload_evidence(text) from public;
grant execute on function public.sijill_can_upload_evidence(text) to authenticated;

drop policy if exists sijill_media_author_insert on storage.objects;
create policy sijill_media_author_insert on storage.objects for insert to authenticated
with check (bucket_id = 'sijill-media' and public.sijill_can_upload_evidence(name));

-- A new upload under a published record stays private until saved into its media list.
create or replace function public.sijill_evidence_visible(object_name text)
returns boolean language sql stable security invoker set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.sijill_cases c where split_part(object_name,'/',1) = 'cases' and c.id::text = split_part(object_name,'/',2)
      and c.status = 'published' and (coalesce(c.media->'images','[]') ? object_name or coalesce(c.media->'videos','[]') ? object_name)
    union all
    select 1 from public.sijill_person_files f where split_part(object_name,'/',1) = 'files' and f.id::text = split_part(object_name,'/',2)
      and f.status = 'published' and (coalesce(f.media->'images','[]') ? object_name or coalesce(f.media->'videos','[]') ? object_name)
    union all
    select 1 from public.sijill_testimonies t where split_part(object_name,'/',1) = 'testimonies' and t.id::text = split_part(object_name,'/',2)
      and t.status = 'published' and t.public_consent and (coalesce(t.media->'images','[]') ? object_name or coalesce(t.media->'videos','[]') ? object_name)
  );
$$;
revoke all on function public.sijill_evidence_visible(text) from public;
grant execute on function public.sijill_evidence_visible(text) to anon,authenticated;
drop policy if exists sijill_media_published_read on storage.objects;
create policy sijill_media_published_read on storage.objects for select to anon
using (bucket_id = 'sijill-media' and public.sijill_evidence_visible(name));
drop policy if exists sijill_media_authenticated_read on storage.objects;
create policy sijill_media_authenticated_read on storage.objects for select to authenticated
using (bucket_id = 'sijill-media' and (
  public.is_sijill_staff() or public.sijill_evidence_visible(name)
  or exists (select 1 from public.sijill_cases c where split_part(name,'/',1) = 'cases' and c.id::text = split_part(name,'/',2) and c.created_by = auth.uid())
  or exists (select 1 from public.sijill_person_files f where split_part(name,'/',1) = 'files' and f.id::text = split_part(name,'/',2) and f.created_by = auth.uid())
  or exists (select 1 from public.sijill_testimonies t where split_part(name,'/',1) = 'testimonies' and t.id::text = split_part(name,'/',2) and t.created_by = auth.uid())
));

drop policy if exists person_file_links_author_insert on public.sijill_case_person_files;
create policy person_file_links_author_insert on public.sijill_case_person_files for insert to authenticated with check (
  exists (select 1 from public.sijill_person_files f where f.id = person_file_id and f.created_by = auth.uid() and public.sijill_edit_window_open(f.status,f.published_at,f.created_at))
  and exists (select 1 from public.sijill_cases c where c.id = case_id and c.status = 'published')
);
drop policy if exists person_file_links_author_delete on public.sijill_case_person_files;
create policy person_file_links_author_delete on public.sijill_case_person_files for delete to authenticated using (
  exists (select 1 from public.sijill_person_files f where f.id = person_file_id and f.created_by = auth.uid() and public.sijill_edit_window_open(f.status,f.published_at,f.created_at))
);

-- Whitelisted file fields and links are committed in one transaction, under RLS.
create or replace function public.edit_sijill_person_file(p_id uuid, p_changes jsonb, p_case_ids uuid[])
returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare existing public.sijill_person_files; edited public.sijill_person_files; case_ids uuid[];
begin
  select * into existing from public.sijill_person_files where id = p_id and created_by = auth.uid() for update;
  if not found then raise exception 'Authors may only edit their own content'; end if;
  if not public.sijill_edit_window_open(existing.status,existing.published_at,existing.created_at) then raise exception 'The 15-day edit period for this record has ended'; end if;
  if array_position(p_case_ids,null) is not null then raise exception 'Invalid related case'; end if;
  select coalesce(array_agg(distinct x),'{}'::uuid[]) into case_ids from unnest(coalesce(p_case_ids,'{}'::uuid[])) x;
  if exists (select 1 from unnest(case_ids) x where not exists (select 1 from public.sijill_case_person_files l where l.person_file_id = p_id and l.case_id = x) and not exists (select 1 from public.sijill_cases c where c.id = x and c.status = 'published')) then raise exception 'Related case is unavailable'; end if;
  edited := jsonb_populate_record(null::public.sijill_person_files,p_changes);
  update public.sijill_person_files set title=edited.title, description=edited.description, country=edited.country,
    governorate=edited.governorate,district_id=edited.district_id,district_name=edited.district_name,city=edited.city,
    location_description=edited.location_description,media=edited.media,case_id=case_ids[1]
  where id=p_id and created_by=auth.uid();
  if not found then raise exception 'File update failed'; end if;
  delete from public.sijill_case_person_files where person_file_id=p_id and not(case_id=any(case_ids));
  insert into public.sijill_case_person_files(case_id,person_file_id)
    select x,p_id from unnest(case_ids) x where not exists (select 1 from public.sijill_case_person_files l where l.person_file_id=p_id and l.case_id=x);
  return p_id;
end;
$$;
revoke all on function public.edit_sijill_person_file(uuid,jsonb,uuid[]) from public;
grant execute on function public.edit_sijill_person_file(uuid,jsonb,uuid[]) to authenticated;

commit;

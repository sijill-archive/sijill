-- Keep archive mutations available to the platform owner across all record types.
-- Authors retain their existing one-month edit window for their own submissions.
drop policy if exists cases_owner_manage on public.sijill_cases;
create policy cases_owner_manage on public.sijill_cases
  for all to authenticated
  using (public.is_sijill_owner())
  with check (public.is_sijill_owner());

drop policy if exists files_owner_manage on public.sijill_person_files;
create policy files_owner_manage on public.sijill_person_files
  for all to authenticated
  using (public.is_sijill_owner())
  with check (public.is_sijill_owner());

drop policy if exists testimonies_owner_manage on public.sijill_testimonies;
create policy testimonies_owner_manage on public.sijill_testimonies
  for all to authenticated
  using (public.is_sijill_owner())
  with check (public.is_sijill_owner());

-- Let the owner clean up uploaded case/file media when removing archive records.
drop policy if exists sijill_media_owner_delete on storage.objects;
create policy sijill_media_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'sijill-media' and public.is_sijill_owner());

-- Keep deletion of cases owner-only, matching the existing file owner controls.
drop policy if exists cases_author_delete_draft on public.sijill_cases;

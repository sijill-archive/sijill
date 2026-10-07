-- Private evidence storage: visitors can read objects only after their parent record is published.
alter table public.sijill_cases
  add column if not exists media jsonb not null default '{"images":[],"videos":[],"youtube":[]}'::jsonb;
alter table public.sijill_person_files
  add column if not exists media jsonb not null default '{"images":[],"videos":[],"youtube":[]}'::jsonb;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sijill-media',
  'sijill-media',
  false,
  52428800,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists sijill_media_published_read on storage.objects;
create policy sijill_media_published_read on storage.objects
for select to anon
using (
  bucket_id = 'sijill-media' and (
    ((storage.foldername(name))[1] = 'cases' and exists (
      select 1 from public.sijill_cases c
      where c.id::text = (storage.foldername(name))[2] and c.status = 'published'
    ))
    or
    ((storage.foldername(name))[1] = 'files' and exists (
      select 1 from public.sijill_person_files f
      where f.id::text = (storage.foldername(name))[2] and f.status = 'published'
    ))
  )
);

drop policy if exists sijill_media_authenticated_read on storage.objects;
create policy sijill_media_authenticated_read on storage.objects
for select to authenticated
using (
  bucket_id = 'sijill-media' and (
    public.is_sijill_staff()
    or ((storage.foldername(name))[1] = 'cases' and exists (
      select 1 from public.sijill_cases c
      where c.id::text = (storage.foldername(name))[2]
        and (c.status = 'published' or c.created_by = auth.uid())
    ))
    or ((storage.foldername(name))[1] = 'files' and exists (
      select 1 from public.sijill_person_files f
      where f.id::text = (storage.foldername(name))[2]
        and (f.status = 'published' or f.created_by = auth.uid())
    ))
  )
);

drop policy if exists sijill_media_author_insert on storage.objects;
create policy sijill_media_author_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'sijill-media' and (
    ((storage.foldername(name))[1] = 'cases' and exists (
      select 1 from public.sijill_cases c
      where c.id::text = (storage.foldername(name))[2]
        and c.created_by = auth.uid() and c.status = 'draft'
    ))
    or ((storage.foldername(name))[1] = 'files' and exists (
      select 1 from public.sijill_person_files f
      where f.id::text = (storage.foldername(name))[2]
        and f.created_by = auth.uid() and f.status = 'draft'
    ))
  )
);

drop policy if exists sijill_media_author_delete_draft on storage.objects;
create policy sijill_media_author_delete_draft on storage.objects
for delete to authenticated
using (
  bucket_id = 'sijill-media' and (
    ((storage.foldername(name))[1] = 'cases' and exists (
      select 1 from public.sijill_cases c
      where c.id::text = (storage.foldername(name))[2]
        and c.created_by = auth.uid() and c.status = 'draft'
    ))
    or ((storage.foldername(name))[1] = 'files' and exists (
      select 1 from public.sijill_person_files f
      where f.id::text = (storage.foldername(name))[2]
        and f.created_by = auth.uid() and f.status = 'draft'
    ))
  )
);

drop policy if exists cases_author_delete_draft on public.sijill_cases;
create policy cases_author_delete_draft on public.sijill_cases
for delete to authenticated using (created_by = auth.uid() and status = 'draft');

drop policy if exists files_author_delete_draft on public.sijill_person_files;
create policy files_author_delete_draft on public.sijill_person_files
for delete to authenticated using (created_by = auth.uid() and status = 'draft');

-- Content can be edited only by its original author. After publication the edit window is 15 days.
-- The owner can moderate/archive/delete another author's record, but cannot rewrite its content.

create or replace function public.enforce_sijill_author_edit_window()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  is_owner boolean := public.is_sijill_owner();
  edit_base timestamptz;
  content_changed boolean;
begin
  content_changed :=
    (to_jsonb(new) - array['status','published_at','published_by','ai_review_status','ai_reviewed_at','ai_review_summary','updated_at','admin_updated_at'])
    is distinct from
    (to_jsonb(old) - array['status','published_at','published_by','ai_review_status','ai_reviewed_at','ai_review_summary','updated_at','admin_updated_at']);

  if is_owner and old.created_by is distinct from auth.uid() then
    if content_changed then
      raise exception 'Only the original author may edit content';
    end if;

    if old.published_at is not null and new.published_at is distinct from old.published_at then
      raise exception 'Publication date cannot be reset';
    end if;
    if old.published_by is not null and new.published_by is distinct from old.published_by then
      raise exception 'Publication author cannot be changed';
    end if;
    if new.status = 'published' and old.status is distinct from 'published' and old.published_at is null then
      new.published_at := now();
      new.published_by := auth.uid();
    end if;
    return new;
  end if;

  if old.created_by is distinct from auth.uid() or new.created_by is distinct from old.created_by then
    raise exception 'Authors may only edit their own content';
  end if;

  edit_base := old.published_at;
  if edit_base is null and old.status in ('published', 'archived') then
    edit_base := old.created_at;
  end if;

  if edit_base is not null and now() > edit_base + interval '15 days' then
    raise exception 'The 15-day edit period for this record has ended';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_sijill_author_edit_window() from public, anon, authenticated;

drop trigger if exists a_author_edit_window on public.sijill_cases;
create trigger a_author_edit_window
  before update on public.sijill_cases
  for each row execute function public.enforce_sijill_author_edit_window();

drop trigger if exists a_author_edit_window on public.sijill_person_files;
create trigger a_author_edit_window
  before update on public.sijill_person_files
  for each row execute function public.enforce_sijill_author_edit_window();

drop trigger if exists a_author_edit_window on public.sijill_testimonies;
create trigger a_author_edit_window
  before update on public.sijill_testimonies
  for each row execute function public.enforce_sijill_author_edit_window();

-- Restore the author's own update policy for person files; a prior owner-controls
-- migration removed it while limiting non-owner file deletion.
drop policy if exists files_author_update on public.sijill_person_files;
create policy files_author_update on public.sijill_person_files
  for update to authenticated
  using (created_by = auth.uid() and public.current_sijill_role() in ('member', 'editor'))
  with check (created_by = auth.uid());

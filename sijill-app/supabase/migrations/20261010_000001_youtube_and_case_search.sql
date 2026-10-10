begin;

-- YouTube titles remain in the existing media JSON; testimony links need the same column.
alter table public.sijill_testimonies add column if not exists media jsonb not null default '{"images":[],"videos":[],"youtube":[]}'::jsonb;
alter table public.sijill_cases add column if not exists aliases text[] not null default '{}';

create or replace function public.sijill_case_aliases_valid(names text[])
returns boolean language sql immutable set search_path = public, pg_temp as $$
  select cardinality(names) <= 10 and not exists (
    select 1 from unnest(names) n where n is null or length(btrim(n)) = 0 or length(n) > 180
  );
$$;
alter table public.sijill_cases drop constraint if exists sijill_case_aliases_limit;
alter table public.sijill_cases add constraint sijill_case_aliases_limit check (public.sijill_case_aliases_valid(aliases));

create or replace function public.normalize_sijill_case_search(value text)
returns text language sql immutable parallel safe set search_path = public, pg_temp as $$
  select btrim(regexp_replace(
    translate(regexp_replace(lower(coalesce(value, '')), '[ًٌٍَُِّْـٰ]', '', 'g'), 'أإآٱىة', 'اااايه'),
    '[^[:alnum:]ء-ي]+', ' ', 'g'));
$$;
create or replace function public.sijill_case_search_document(title text, aliases text[], governorate text, district text, city text, location text, approximate_date text)
returns text language sql immutable parallel safe set search_path = public, pg_temp as $$
  select public.normalize_sijill_case_search(coalesce(title,'') || ' ' || coalesce(array_to_string(aliases,' '),'') || ' ' || coalesce(governorate,'') || ' ' || coalesce(district,'') || ' ' || coalesce(city,'') || ' ' || coalesce(location,'') || ' ' || coalesce(approximate_date,''));
$$;
alter table public.sijill_cases add column if not exists search_document text generated always as (
  public.sijill_case_search_document(title, aliases, governorate, district_name, city, location_description, approximate_date)
) stored;
create extension if not exists pg_trgm with schema extensions;
create index if not exists sijill_cases_search_document_idx on public.sijill_cases using gin (search_document extensions.gin_trgm_ops);
create index if not exists sijill_cases_published_title_idx on public.sijill_cases(title, id) where status = 'published';

-- Invoker security retains the existing row-level policies. Only published cases are searchable.
create or replace function public.search_sijill_cases(p_query text default '', p_governorate text default null, p_offset integer default 0)
returns table (id uuid, title text, aliases text[], governorate text, district_name text, city text, event_date date, approximate_date text)
language sql stable security invoker set search_path = public, pg_temp as $$
  with words as (
    select regexp_split_to_array(public.normalize_sijill_case_search(left(coalesce(p_query,''),200)), '\s+') as tokens
  )
  select c.id,c.title,c.aliases,c.governorate,c.district_name,c.city,c.event_date,c.approximate_date
  from public.sijill_cases c cross join words w
  where c.status = 'published'
    and (p_governorate is null or p_governorate = '' or c.governorate = p_governorate)
    and c.search_document like '%' || coalesce(w.tokens[1],'') || '%'
    and not exists (select 1 from unnest(w.tokens) word where c.search_document not like '%' || word || '%')
  order by c.title,c.id limit 21 offset greatest(0, coalesce(p_offset,0));
$$;
revoke all on function public.search_sijill_cases(text,text,integer) from public;
grant execute on function public.search_sijill_cases(text,text,integer) to authenticated;

-- Derived search text must not be mistaken for an author content edit during moderation.
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
    (to_jsonb(new) - array['status','published_at','published_by','ai_review_status','ai_reviewed_at','ai_review_summary','updated_at','admin_updated_at','search_document'])
    is distinct from
    (to_jsonb(old) - array['status','published_at','published_by','ai_review_status','ai_reviewed_at','ai_review_summary','updated_at','admin_updated_at','search_document']);

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


commit;

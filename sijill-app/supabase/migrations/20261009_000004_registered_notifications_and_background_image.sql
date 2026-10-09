-- Broadcasts are visible only to authenticated accounts. Device push subscriptions
-- are private to their owner; the site owner can fan out and prune expired endpoints.
drop policy if exists broadcast_public_read on public.sijill_broadcast_notifications;
drop policy if exists broadcast_authenticated_read on public.sijill_broadcast_notifications;
create policy broadcast_authenticated_read on public.sijill_broadcast_notifications
  for select to authenticated using (status = 'published');

create table if not exists public.sijill_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);
alter table public.sijill_push_subscriptions enable row level security;
grant select, insert, update, delete on public.sijill_push_subscriptions to authenticated;
drop policy if exists push_subscription_self_manage on public.sijill_push_subscriptions;
create policy push_subscription_self_manage on public.sijill_push_subscriptions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists push_subscription_owner_read on public.sijill_push_subscriptions;
create policy push_subscription_owner_read on public.sijill_push_subscriptions
  for select to authenticated using (public.is_sijill_owner());
drop policy if exists push_subscription_owner_delete on public.sijill_push_subscriptions;
create policy push_subscription_owner_delete on public.sijill_push_subscriptions
  for delete to authenticated using (public.is_sijill_owner());

alter table public.sijill_site_settings
  add column if not exists background_image_url text,
  add column if not exists background_image_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sijill-site-backgrounds', 'sijill-site-backgrounds', true, 10485760,
  array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists sijill_background_public_read on storage.objects;
create policy sijill_background_public_read on storage.objects
  for select to anon, authenticated using (bucket_id = 'sijill-site-backgrounds');
drop policy if exists sijill_background_owner_insert on storage.objects;
create policy sijill_background_owner_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'sijill-site-backgrounds' and public.is_sijill_owner());
drop policy if exists sijill_background_owner_update on storage.objects;
create policy sijill_background_owner_update on storage.objects
  for update to authenticated using (bucket_id = 'sijill-site-backgrounds' and public.is_sijill_owner())
  with check (bucket_id = 'sijill-site-backgrounds' and public.is_sijill_owner());
drop policy if exists sijill_background_owner_delete on storage.objects;
create policy sijill_background_owner_delete on storage.objects
  for delete to authenticated using (bucket_id = 'sijill-site-backgrounds' and public.is_sijill_owner());

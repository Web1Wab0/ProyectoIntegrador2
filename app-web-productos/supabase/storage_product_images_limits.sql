-- =========================================================
-- STORAGE: product-images limits and policies
-- =========================================================
-- Run this file in Supabase SQL Editor.
-- Product images are public assets, but uploads are limited to authenticated
-- users inside their own folder and to safe image formats.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read"
on storage.objects
for select
using (bucket_id = 'product-images');

drop policy if exists "product_images_auth_upload" on storage.objects;
create policy "product_images_auth_upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "product_images_auth_update" on storage.objects;
create policy "product_images_auth_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'product-images'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'product-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "product_images_auth_delete" on storage.objects;
create policy "product_images_auth_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

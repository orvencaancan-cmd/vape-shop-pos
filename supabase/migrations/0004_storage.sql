-- Storage bucket for shop logos. Files are stored as `<shop_id>/<filename>`;
-- policies use that path prefix to scope writes to the owning shop.
-- Public read since logos need to render in <img> tags/PWA icons without
-- a signed-URL round trip; nothing sensitive lives in this bucket.

insert into storage.buckets (id, name, public)
values ('shop-logos', 'shop-logos', true)
on conflict (id) do nothing;

create policy "shop_logos_public_read" on storage.objects for select
  using (bucket_id = 'shop-logos');

create policy "shop_logos_owner_write" on storage.objects for insert
  with check (
    bucket_id = 'shop-logos'
    and (storage.foldername(name))[1] = current_shop_id()::text
    and is_owner()
  );

create policy "shop_logos_owner_update" on storage.objects for update
  using (
    bucket_id = 'shop-logos'
    and (storage.foldername(name))[1] = current_shop_id()::text
    and is_owner()
  );

create policy "shop_logos_owner_delete" on storage.objects for delete
  using (
    bucket_id = 'shop-logos'
    and (storage.foldername(name))[1] = current_shop_id()::text
    and is_owner()
  );

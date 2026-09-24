-- Bucket privado de fotos. Nada es público: se sirven con URLs firmadas y caducas.
-- Se aplica solo donde existe Supabase Storage (en las pruebas con Postgres puro no hay esquema storage).

do $do$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'Sin Supabase Storage: se omite la configuración del bucket.';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('fotos', 'fotos', false, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
  on conflict (id) do update set public = false;

  -- Subir: solo a la ruta de una foto que tú registraste y que aún no está subida.
  execute $p$
    create policy "fotos: subir la propia" on storage.objects for insert to authenticated
    with check (
      bucket_id = 'fotos' and exists (
        select 1 from public.photos p
        where p.storage_path = name and p.uploaded_by = auth.uid() and p.status in ('pendiente', 'fallida')
      )
    )
  $p$;

  -- Ver: el cliente las suyas; el negocio las de clientes a los que puede atender; cualquiera las del portfolio autorizado.
  execute $p$
    create policy "fotos: ver" on storage.objects for select to authenticated, anon
    using (
      bucket_id = 'fotos' and exists (
        select 1 from public.photos p
        where p.storage_path = name and (
          p.customer_id = private.current_customer_id()
          or p.uploaded_by = auth.uid()
          or (p.status = 'subida' and private.can_view_customer(p.customer_id, p.business_id))
          or (p.status = 'subida' and private.has_photo_permission(p.id, 'portfolio'))
        )
      )
    )
  $p$;

  -- Borrar: quien la subió, mientras no forme parte de una visita cerrada.
  execute $p$
    create policy "fotos: borrar pendiente" on storage.objects for delete to authenticated
    using (
      bucket_id = 'fotos' and exists (
        select 1 from public.photos p where p.storage_path = name and p.uploaded_by = auth.uid() and p.session_id is null
      )
    )
  $p$;
end
$do$;

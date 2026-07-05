
create policy "own knowledge files read" on storage.objects for select to authenticated
  using (bucket_id = 'knowledge' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own knowledge files insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'knowledge' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own knowledge files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'knowledge' and (storage.foldername(name))[1] = auth.uid()::text);

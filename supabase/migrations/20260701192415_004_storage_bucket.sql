-- Create storage bucket for files
INSERT INTO storage.buckets (id, name, public)
VALUES ('files', 'files', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for file uploads
CREATE POLICY "Allow authenticated users to upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'files');

CREATE POLICY "Allow authenticated users to read their own files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Allow authenticated users to delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'files' AND auth.uid()::text = (storage.foldername(name))[1]);
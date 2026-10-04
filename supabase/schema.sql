-- Audio Summarizer Supabase Schema Setup

-- 1. Create the audio_files table if not already created
CREATE TABLE IF NOT EXISTS public.audio_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_path text NOT NULL,
  status text NOT NULL DEFAULT 'uploaded',
  transcript text,
  summary text,
  created_at timestamptz DEFAULT now()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.audio_files ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies:
-- Allow anyone with the anon key to insert newly uploaded records
CREATE POLICY "Allow public insert on audio_files"
ON public.audio_files
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allow anyone with the anon key to read records (needed for result / status page)
CREATE POLICY "Allow public select on audio_files"
ON public.audio_files
FOR SELECT
TO anon, authenticated
USING (true);

-- Allow updates (e.g. retry or status updates)
CREATE POLICY "Allow public update on audio_files"
ON public.audio_files
FOR UPDATE
TO anon, authenticated
USING (true);

-- 4. Supabase Storage Bucket setup
-- Create 'audio-files' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-files', 'audio-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies:
-- Allow upload to audio-files bucket
CREATE POLICY "Allow public upload to audio-files"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'audio-files');

-- Allow download / read
CREATE POLICY "Allow read on audio-files"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'audio-files');

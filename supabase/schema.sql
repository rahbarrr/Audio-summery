-- Audio Summarizer Supabase Schema Setup (With Auth & User Isolation)

-- 1. Create the audio_files table if not already created
CREATE TABLE IF NOT EXISTS public.audio_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  status text NOT NULL DEFAULT 'uploaded',
  transcript text,
  summary text,
  created_at timestamptz DEFAULT now()
);

-- Ensure user_id column exists if table was already created
ALTER TABLE public.audio_files 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.audio_files ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow public insert on audio_files" ON public.audio_files;
DROP POLICY IF EXISTS "Allow public select on audio_files" ON public.audio_files;
DROP POLICY IF EXISTS "Allow public update on audio_files" ON public.audio_files;
DROP POLICY IF EXISTS "Users can insert own audio_files" ON public.audio_files;
DROP POLICY IF EXISTS "Users can view own audio_files" ON public.audio_files;
DROP POLICY IF EXISTS "Users can update own audio_files" ON public.audio_files;
DROP POLICY IF EXISTS "Users can delete own audio_files" ON public.audio_files;

-- 4. RLS Policies: User-specific access
-- Allow authenticated users to insert their own records
CREATE POLICY "Users can insert own audio_files"
ON public.audio_files
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to read only their own records
CREATE POLICY "Users can view own audio_files"
ON public.audio_files
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow authenticated users to update their own records
CREATE POLICY "Users can update own audio_files"
ON public.audio_files
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Allow authenticated users to delete their own records
CREATE POLICY "Users can delete own audio_files"
ON public.audio_files
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 5. Storage Bucket setup
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-files', 'audio-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for authenticated users
DROP POLICY IF EXISTS "Allow public upload to audio-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow read on audio-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload audio-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view audio-files" ON storage.objects;

CREATE POLICY "Authenticated users can upload audio-files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'audio-files');

CREATE POLICY "Authenticated users can view audio-files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'audio-files');

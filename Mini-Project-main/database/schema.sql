-- 1. TABLES SETUP

-- Profiles Table
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  avatar_url TEXT,
  username TEXT UNIQUE,
  member_id TEXT UNIQUE,
  login_password TEXT
);

-- Documents Table
CREATE TABLE public.documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  file_url TEXT NOT NULL,
  file_path TEXT,
  title TEXT NOT NULL,
  note TEXT,
  text_content TEXT,
  history JSONB DEFAULT '[]'::jsonb,
  group_id TEXT,
  file_size BIGINT,
  upload_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Appointments Table
CREATE TABLE public.appointments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  hospital TEXT NOT NULL,
  patient_name TEXT,
  phone TEXT,
  doctor TEXT,
  specialty TEXT,
  status TEXT DEFAULT 'Upcoming',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Hospital Favorites Table
CREATE TABLE public.hospital_favorites (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  hospital_key TEXT NOT NULL,
  hospital_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT hospital_favorites_user_hospital_unique UNIQUE (user_id, hospital_key)
);

-- 2. ROW LEVEL SECURITY (RLS)

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_favorites ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Documents Policies
CREATE POLICY "Users can view their own documents" ON public.documents
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own documents" ON public.documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own documents" ON public.documents
  FOR DELETE USING (auth.uid() = user_id);

-- Appointments Policies
CREATE POLICY "Users can view their own appointments" ON public.appointments
  FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can insert their own appointments" ON public.appointments
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can delete their own appointments" ON public.appointments
  FOR DELETE USING (auth.uid()::text = user_id);

-- Hospital Favorites Policies
CREATE POLICY "Users can view their own hospital favorites" ON public.hospital_favorites
  FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can insert their own hospital favorites" ON public.hospital_favorites
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can delete their own hospital favorites" ON public.hospital_favorites
  FOR DELETE USING (auth.uid()::text = user_id);

-- 3. AUTOMATED PROFILE CREATION TRIGGER

CREATE OR REPLACE FUNCTION public.member_id_base(raw_name TEXT, raw_email TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    NULLIF(
      REGEXP_REPLACE(
        LOWER(SPLIT_PART(COALESCE(NULLIF(BTRIM(raw_name), ''), SPLIT_PART(raw_email, '@', 1), ''), ' ', 1)),
        '[^a-z0-9]+',
        '',
        'g'
      ),
      ''
    ),
    'user'
  )
$$;

CREATE SEQUENCE IF NOT EXISTS public.profile_member_id_seq START WITH 1231;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, username, member_id)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    lower(split_part(new.email, '@', 1)) || '_' || right(replace(new.id::text, '-', ''), 6),
    format(
      '%s@%s',
      public.member_id_base(COALESCE(new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'full_name'), new.email),
      nextval('public.profile_member_id_seq')
    )
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.assign_member_id_for_current_user()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_name TEXT;
  v_first_name TEXT;
  v_email TEXT;
  v_existing_member_id TEXT;
  v_new_member_id TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT
    p.member_id,
    COALESCE(p.name, u.raw_user_meta_data->>'full_name'),
    COALESCE(u.raw_user_meta_data->>'first_name', u.raw_user_meta_data->>'full_name'),
    u.email
  INTO v_existing_member_id, v_name, v_first_name, v_email
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = v_uid;

  IF v_existing_member_id IS NOT NULL AND v_existing_member_id ~ '^[a-z0-9]+@[0-9]+$' THEN
    RETURN v_existing_member_id;
  END IF;

  INSERT INTO public.profiles (id, name, username)
  VALUES (
    v_uid,
    COALESCE(v_name, v_first_name),
    LOWER(SPLIT_PART(v_email, '@', 1)) || '_' || RIGHT(REPLACE(v_uid::text, '-', ''), 6)
  )
  ON CONFLICT (id) DO NOTHING;

  LOOP
    v_new_member_id := FORMAT(
      '%s@%s',
      public.member_id_base(v_first_name, v_email),
      nextval('public.profile_member_id_seq')
    );

    BEGIN
      UPDATE public.profiles
      SET member_id = v_new_member_id
      WHERE id = v_uid
        AND (member_id IS NULL OR member_id !~ '^[a-z0-9]+@[0-9]+$');

      IF FOUND THEN
        RETURN v_new_member_id;
      END IF;

      SELECT member_id INTO v_existing_member_id
      FROM public.profiles
      WHERE id = v_uid;

      IF v_existing_member_id IS NOT NULL THEN
        RETURN v_existing_member_id;
      END IF;

    EXCEPTION WHEN unique_violation THEN
      -- Retry with next sequence value if collision ever happens.
    END;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_member_id_for_current_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_member_id_for_current_user() TO authenticated;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. STORAGE BUCKET FOR AVATARS
-- Run this in Supabase SQL Editor:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
--
-- Then add storage policy:
-- CREATE POLICY "Users can upload their own avatar" ON storage.objects
--   FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
-- CREATE POLICY "Anyone can view avatars" ON storage.objects
--   FOR SELECT USING (bucket_id = 'avatars');
-- CREATE POLICY "Users can update their own avatar" ON storage.objects
--   FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

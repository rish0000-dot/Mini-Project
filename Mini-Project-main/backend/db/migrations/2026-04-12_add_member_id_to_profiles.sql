-- Migration: add member_id for profiles, backfill old users, and update signup trigger

-- 1) Add member_id column if it does not exist
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS member_id TEXT;

-- 2) Ensure each existing profile has a stable member_id
UPDATE public.profiles
SET member_id = 'HUB-' || UPPER(RIGHT(REPLACE(id::text, '-', ''), 8))
WHERE member_id IS NULL OR member_id = '';

-- 3) Remove old partial index if it exists (it cannot be used for UNIQUE constraint)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'profiles_member_id_unique_idx'
      AND indexdef ILIKE '%WHERE%'
  ) THEN
    DROP INDEX public.profiles_member_id_unique_idx;
  END IF;
END $$;

-- 4) Ensure unique constraint on member_id (safe re-run)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_member_id_key'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_member_id_key UNIQUE (member_id);
  END IF;
END $$;

-- 5) Ensure every auth user has a profile row (for older users)
INSERT INTO public.profiles (id, name, username, member_id)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', ''),
  LOWER(SPLIT_PART(u.email, '@', 1)) || '_' || RIGHT(REPLACE(u.id::text, '-', ''), 6),
  'HUB-' || UPPER(RIGHT(REPLACE(u.id::text, '-', ''), 8))
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- 6) Update trigger function so all future signups get unique username + member_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, username, member_id)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    LOWER(SPLIT_PART(new.email, '@', 1)) || '_' || RIGHT(REPLACE(new.id::text, '-', ''), 6),
    'HUB-' || UPPER(RIGHT(REPLACE(new.id::text, '-', ''), 8))
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

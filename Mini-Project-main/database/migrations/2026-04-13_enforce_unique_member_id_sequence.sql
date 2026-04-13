-- Migration: enforce globally unique sequential member_id in format firstName@NNN

-- 1) First-name based sanitizer (fallback to email prefix, then user)
CREATE OR REPLACE FUNCTION public.member_id_base(raw_name TEXT, raw_email TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    NULLIF(
      REGEXP_REPLACE(
        LOWER(
          SPLIT_PART(
            COALESCE(NULLIF(BTRIM(raw_name), ''), SPLIT_PART(raw_email, '@', 1), ''),
            ' ',
            1
          )
        ),
        '[^a-z0-9]+',
        '',
        'g'
      ),
      ''
    ),
    'user'
  )
$$;

-- 2) Sequence used for globally increasing suffix
CREATE SEQUENCE IF NOT EXISTS public.profile_member_id_seq;

-- 3) Seed sequence from latest numeric suffix (start from 1 when none)
SELECT setval(
  'public.profile_member_id_seq',
  COALESCE(
    (
      SELECT MAX(SUBSTRING(member_id FROM '@([0-9]+)$')::BIGINT)
      FROM public.profiles
      WHERE member_id ~ '^[a-z0-9]+@[0-9]+$'
    ),
    0
  ),
  true
);

-- 4) Backfill invalid/missing member_id with unique sequential values
UPDATE public.profiles p
SET member_id = FORMAT(
  '%s@%s',
  public.member_id_base(
    COALESCE(u.raw_user_meta_data->>'first_name', p.name, u.raw_user_meta_data->>'full_name'),
    u.email
  ),
  LPAD(nextval('public.profile_member_id_seq')::TEXT, 3, '0')
)
FROM auth.users u
WHERE u.id = p.id
  AND (p.member_id IS NULL OR p.member_id !~ '^[a-z0-9]+@[0-9]+$');

-- 5) Ensure uniqueness at DB level
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

-- 6) Ensure profile INSERT policy exists for upsert/create flows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users can insert their own profile'
  ) THEN
    CREATE POLICY "Users can insert their own profile" ON public.profiles
      FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- 7) Signup trigger now always generates firstName@NNN
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, username, member_id)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    LOWER(SPLIT_PART(new.email, '@', 1)) || '_' || RIGHT(REPLACE(new.id::text, '-', ''), 6),
    FORMAT(
      '%s@%s',
      public.member_id_base(
        COALESCE(new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'full_name'),
        new.email
      ),
      LPAD(nextval('public.profile_member_id_seq')::TEXT, 3, '0')
    )
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8) Recreate trigger safely
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 9) RPC for existing users: assign/fetch valid member_id
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
      LPAD(nextval('public.profile_member_id_seq')::TEXT, 3, '0')
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
      -- Retry with next sequence number.
    END;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_member_id_for_current_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_member_id_for_current_user() TO authenticated;

-- Migration: move profile member_id to name@number format with global sequence

-- 1) Helper to build safe username-like base from name/email
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

-- 2) Sequence for global incremental numeric suffix
CREATE SEQUENCE IF NOT EXISTS public.profile_member_id_seq;

-- 3) Seed sequence based on existing numeric suffixes; start from 1231 when empty
SELECT setval(
  'public.profile_member_id_seq',
  COALESCE(
    (
      SELECT MAX(SUBSTRING(member_id FROM '@([0-9]+)$')::BIGINT)
      FROM public.profiles
      WHERE member_id ~ '@[0-9]+$'
    ),
    1230
  ),
  true
);

-- 4) Backfill only rows that do not already match name@digits format
UPDATE public.profiles p
SET member_id = FORMAT(
  '%s@%s',
  public.member_id_base(p.name, u.email),
  nextval('public.profile_member_id_seq')
)
FROM auth.users u
WHERE u.id = p.id
  AND (p.member_id IS NULL OR p.member_id !~ '^[a-z0-9]+@[0-9]+$');

-- 5) Ensure future signups always receive sequential member_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, username, member_id)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    LOWER(SPLIT_PART(new.email, '@', 1)) || '_' || RIGHT(REPLACE(new.id::text, '-', ''), 6),
    FORMAT(
      '%s@%s',
      public.member_id_base(COALESCE(new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'full_name'), new.email),
      nextval('public.profile_member_id_seq')
    )
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6) RPC helper: assign member_id for existing users who still have NULL/old format
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

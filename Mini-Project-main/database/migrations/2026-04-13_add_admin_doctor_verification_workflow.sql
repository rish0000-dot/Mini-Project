-- Add doctor verification workflow and secure admin approval RPC.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT,
  ADD COLUMN IF NOT EXISTS hospital_name TEXT,
  ADD COLUMN IF NOT EXISTS specialization TEXT,
  ADD COLUMN IF NOT EXISTS license_number TEXT,
  ADD COLUMN IF NOT EXISTS qualification TEXT,
  ADD COLUMN IF NOT EXISTS experience_years INTEGER,
  ADD COLUMN IF NOT EXISTS doctor_profile_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'profile_incomplete',
  ADD COLUMN IF NOT EXISTS verification_note TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.profiles p
SET
  role = COALESCE(u.raw_user_meta_data->>'role', u.raw_user_meta_data->>'account_type', p.role, 'user'),
  hospital_name = COALESCE(u.raw_user_meta_data->>'hospital_name', p.hospital_name),
  specialization = COALESCE(u.raw_user_meta_data->>'specialization', p.specialization),
  license_number = COALESCE(u.raw_user_meta_data->>'license_number', p.license_number),
  qualification = COALESCE(u.raw_user_meta_data->>'qualification', p.qualification),
  experience_years = COALESCE(
    CASE
      WHEN COALESCE(u.raw_user_meta_data->>'experience_years', '') ~ '^[0-9]+$'
        THEN (u.raw_user_meta_data->>'experience_years')::INTEGER
      ELSE NULL
    END,
    p.experience_years
  ),
  doctor_profile_completed = COALESCE((u.raw_user_meta_data->>'doctor_profile_completed')::BOOLEAN, p.doctor_profile_completed),
  verification_status = COALESCE(u.raw_user_meta_data->>'verification_status', p.verification_status),
  updated_at = NOW()
FROM auth.users u
WHERE u.id = p.id;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT COALESCE(raw_user_meta_data->>'role', raw_user_meta_data->>'account_type', 'user')
  INTO v_role
  FROM auth.users
  WHERE id = auth.uid();

  RETURN v_role = 'admin';
END;
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Admins can view all profiles'
  ) THEN
    CREATE POLICY "Admins can view all profiles" ON public.profiles
      FOR SELECT USING (public.is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Admins can update all profiles'
  ) THEN
    CREATE POLICY "Admins can update all profiles" ON public.profiles
      FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_update_doctor_verification(
  p_doctor_id UUID,
  p_status TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT := LOWER(COALESCE(p_status, ''));
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can update doctor verification status';
  END IF;

  IF v_status NOT IN ('pending', 'verified', 'rejected') THEN
    RAISE EXCEPTION 'Invalid verification status: %', p_status;
  END IF;

  UPDATE public.profiles
  SET
    verification_status = v_status,
    verification_note = NULLIF(BTRIM(p_note), ''),
    verified_at = CASE WHEN v_status = 'verified' THEN v_now ELSE NULL END,
    doctor_profile_completed = TRUE,
    updated_at = v_now
  WHERE id = p_doctor_id
    AND COALESCE(role, 'user') = 'doctor';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Doctor profile not found for id: %', p_doctor_id;
  END IF;

  UPDATE auth.users
  SET raw_user_meta_data =
    jsonb_set(
      jsonb_set(
        COALESCE(raw_user_meta_data, '{}'::jsonb),
        '{verification_status}',
        to_jsonb(v_status),
        TRUE
      ),
      '{doctor_profile_completed}',
      'true'::jsonb,
      TRUE
    )
  WHERE id = p_doctor_id;

  RETURN jsonb_build_object(
    'doctor_id', p_doctor_id,
    'verification_status', v_status,
    'updated_at', v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_doctor_verification(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_doctor_verification(UUID, TEXT, TEXT) TO authenticated;
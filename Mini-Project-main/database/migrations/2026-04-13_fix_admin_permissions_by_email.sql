-- Ensure admin checks work for admin@gmail.com account and update role metadata.

UPDATE auth.users
SET raw_user_meta_data =
  jsonb_set(
    jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb),
      '{role}',
      '"admin"'::jsonb,
      TRUE
    ),
    '{account_type}',
    '"admin"'::jsonb,
    TRUE
  )
WHERE lower(email) = 'admin@gmail.com';

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_email TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT
    COALESCE(raw_user_meta_data->>'role', raw_user_meta_data->>'account_type', 'user'),
    lower(email)
  INTO v_role, v_email
  FROM auth.users
  WHERE id = auth.uid();

  RETURN v_role = 'admin' OR v_email = 'admin@gmail.com';
END;
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

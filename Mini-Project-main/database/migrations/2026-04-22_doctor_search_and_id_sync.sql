-- 1. Sync existing member_ids to name@numeric format
UPDATE public.profiles
SET member_id = LOWER(split_part(name, ' ', 1)) || '@' || 
                LPAD((ABS(('x' || RIGHT(id::text, 8))::bit(32)::integer) % 10000)::text, 4, '0')
WHERE name IS NOT NULL;

-- 2. Update handle_new_user trigger for consistency
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
DECLARE
    v_base_id text;
    v_numeric integer;
BEGIN
    v_base_id := LOWER(split_part(new.raw_user_meta_data->>'name', ' ', 1));
    IF v_base_id IS NULL OR v_base_id = '' THEN 
        v_base_id := 'user'; 
    END IF;

    v_numeric := ABS(('x' || RIGHT(new.id::text, 8))::bit(32)::integer) % 10000;

    INSERT INTO public.profiles (id, name, email, role, member_id)
    VALUES (
        new.id, 
        new.raw_user_meta_data->>'name', 
        new.email, 
        COALESCE(new.raw_user_meta_data->>'role', 'patient'),
        v_base_id || '@' || LPAD(v_numeric::text, 4, '0')
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RLS Policy for Doctor Access to Documents
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'documents' AND policyname = 'Doctors can view patient documents'
    ) THEN
        CREATE POLICY "Doctors can view patient documents" 
        ON public.documents FOR SELECT 
        USING (true);
    END IF;
END $$;

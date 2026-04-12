-- Migration: add editable login_password field to profiles

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS login_password TEXT;

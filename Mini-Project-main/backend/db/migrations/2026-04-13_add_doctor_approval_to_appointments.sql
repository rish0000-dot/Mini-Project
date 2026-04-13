-- Add doctor_id and approval_status to appointments table
-- This enables appointment approval workflow where doctors can approve/reject bookings

ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS doctor_id TEXT,
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS approved_by TEXT;

-- Create approval_notifications table to track notifications sent to doctors
CREATE TABLE IF NOT EXISTS public.approval_notifications (
  id TEXT PRIMARY KEY,
  doctor_id TEXT NOT NULL,
  appointment_id TEXT NOT NULL,
  status TEXT DEFAULT 'unread',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT approval_notifications_appointment_unique UNIQUE (doctor_id, appointment_id)
);

-- Add RLS policy for approval_notifications
ALTER TABLE public.approval_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctors can view their own notifications" ON public.approval_notifications
  FOR SELECT USING (auth.uid()::text = doctor_id);

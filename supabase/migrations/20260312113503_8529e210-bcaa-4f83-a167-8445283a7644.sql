
-- Add new role values to the enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'administrator';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'employee';

-- Blog engine could not write anything: its RLS policies require role 'admin',
-- but the signup trigger only ever grants 'administrator'. has_role(uid,'admin')
-- was therefore false for the admin account, so every insert/update on
-- blog_posts / blog_topics / blog_settings was silently rejected by RLS.
-- Fix: make the two roles consistent.

-- 1) Backfill — every existing 'administrator' also becomes 'admin'.
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'admin'::public.app_role
FROM public.user_roles
WHERE role = 'administrator'
ON CONFLICT (user_id, role) DO NOTHING;

-- 2) Safety net for the known admin logins (in case a role row is missing).
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(email) IN ('savingscholar7@gmail.com', 's.saurav2006@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;

-- 3) Keep them aligned going forward — grant BOTH roles on signup for admin emails.
CREATE OR REPLACE FUNCTION public.auto_assign_admin_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.email IN ('savingscholar7@gmail.com', 's.saurav2006@gmail.com') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'administrator')
      ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

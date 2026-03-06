
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _referrer_id uuid;
  _ref_code text;
BEGIN
  _ref_code := NEW.raw_user_meta_data->>'referred_by_code';

  IF _ref_code IS NOT NULL AND _ref_code != '' THEN
    SELECT user_id INTO _referrer_id
    FROM public.profiles
    WHERE referral_code = _ref_code
    LIMIT 1;
  END IF;

  INSERT INTO public.profiles (user_id, email, display_name, referral_code, referred_by, utm_source, utm_medium, utm_campaign, utm_term, utm_content)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    LOWER(SUBSTRING(MD5(NEW.id::text) FROM 1 FOR 8)),
    _referrer_id,
    NEW.raw_user_meta_data->>'utm_source',
    NEW.raw_user_meta_data->>'utm_medium',
    NEW.raw_user_meta_data->>'utm_campaign',
    NEW.raw_user_meta_data->>'utm_term',
    NEW.raw_user_meta_data->>'utm_content'
  );

  IF _referrer_id IS NOT NULL THEN
    INSERT INTO public.affiliate_referrals (referrer_id, referred_id)
    VALUES (_referrer_id, NEW.id);
  END IF;

  RETURN NEW;
END;
$function$;

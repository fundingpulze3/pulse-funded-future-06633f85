-- Guarantee at the DB level that no MT5 login is ever assigned to more than one
-- distinct trader. We track the FULL history in trading_credentials.assigned_to:
-- once a row is claimed, assigned_to is permanent. The unique index below makes
-- it impossible for two different rows with the same mt5_login to both have
-- assigned_to set, AND prevents a single row from being re-assigned to a
-- different user (because we keep the original assigned_to in place forever).

CREATE OR REPLACE FUNCTION public.prevent_credential_reassignment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Once assigned_to is set on a credential row, it must NEVER change to a
  -- different user. Admin can clear assignment (back to NULL) only via an
  -- explicit unassign — but they cannot silently re-point it to another trader.
  IF OLD.assigned_to IS NOT NULL
     AND NEW.assigned_to IS NOT NULL
     AND OLD.assigned_to <> NEW.assigned_to THEN
    RAISE EXCEPTION 'Cannot reassign MT5 credential % from user % to user %. Credentials must never be reused across traders.',
      OLD.mt5_login, OLD.assigned_to, NEW.assigned_to;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_credential_reassignment ON public.trading_credentials;
CREATE TRIGGER trg_prevent_credential_reassignment
BEFORE UPDATE ON public.trading_credentials
FOR EACH ROW
EXECUTE FUNCTION public.prevent_credential_reassignment();
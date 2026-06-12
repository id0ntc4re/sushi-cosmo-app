ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS bonus_credited_at timestamptz;

CREATE OR REPLACE FUNCTION public.credit_bonus_on_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'done'
     AND (OLD.status IS DISTINCT FROM 'done')
     AND NEW.bonus_credited_at IS NULL
     AND NEW.user_id IS NOT NULL
     AND COALESCE(NEW.bonus_earned, 0) > 0 THEN
    UPDATE public.profiles
       SET bonus_balance = COALESCE(bonus_balance, 0) + NEW.bonus_earned
     WHERE id = NEW.user_id;
    INSERT INTO public.bonus_transactions(user_id, order_id, amount, reason)
      VALUES (NEW.user_id, NEW.id, NEW.bonus_earned, 'Кэшбэк · заказ №' || NEW.number);
    NEW.bonus_credited_at := now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_credit_bonus_on_delivery ON public.orders;
CREATE TRIGGER trg_credit_bonus_on_delivery
BEFORE UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.credit_bonus_on_delivery();
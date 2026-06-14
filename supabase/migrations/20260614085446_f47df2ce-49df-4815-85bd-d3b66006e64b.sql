
-- 1) Снимаем возможность редактирования уже пробитых фискальных чеков
DROP POLICY IF EXISTS "Branch staff can update fiscal receipts" ON public.fiscal_receipts;
REVOKE UPDATE, DELETE ON public.fiscal_receipts FROM authenticated;

-- 2) Триггер-валидация перед вставкой фискальных чеков
CREATE OR REPLACE FUNCTION public.validate_fiscal_receipt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ord RECORD;
  parent RECORD;
  has_open_shift boolean;
  refunded_total numeric;
  sold_qty numeric;
  refunded_qty numeric;
  new_qty numeric;
  it jsonb;
BEGIN
  -- Заказ должен существовать, не быть удалён и не быть отменён
  IF NEW.order_id IS NOT NULL THEN
    SELECT id, deleted_at, status INTO ord FROM public.orders WHERE id = NEW.order_id;
    IF ord IS NULL THEN
      RAISE EXCEPTION 'Заказ не найден';
    END IF;
    IF ord.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Нельзя пробить чек по удалённому заказу';
    END IF;
    IF ord.status = 'cancelled' THEN
      RAISE EXCEPTION 'Нельзя пробить чек по отменённому заказу';
    END IF;
  END IF;

  -- Требуем открытую кассовую смену по филиалу
  IF NEW.branch_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.cash_shifts
      WHERE branch_id = NEW.branch_id AND closed_at IS NULL
    ) INTO has_open_shift;
    IF NOT has_open_shift THEN
      RAISE EXCEPTION 'Нет открытой кассовой смены — откройте смену перед пробитием чека';
    END IF;
  END IF;

  -- Дополнительные проверки только для чеков возврата
  IF NEW.receipt_type = 'sell_refund' THEN
    IF NEW.parent_receipt_id IS NULL THEN
      RAISE EXCEPTION 'Возврат должен ссылаться на исходный чек продажи';
    END IF;

    SELECT id, order_id, receipt_type, payment_method, total, items
      INTO parent FROM public.fiscal_receipts WHERE id = NEW.parent_receipt_id;

    IF parent IS NULL THEN
      RAISE EXCEPTION 'Исходный чек продажи не найден';
    END IF;
    IF parent.receipt_type <> 'sell' THEN
      RAISE EXCEPTION 'parent_receipt_id должен указывать на чек продажи';
    END IF;
    IF parent.order_id IS DISTINCT FROM NEW.order_id THEN
      RAISE EXCEPTION 'Возврат и исходный чек относятся к разным заказам';
    END IF;

    -- Способ оплаты при возврате должен совпадать с исходным
    IF NEW.payment_method IS DISTINCT FROM parent.payment_method THEN
      RAISE EXCEPTION 'Способ возврата (%) должен совпадать со способом оплаты исходного чека (%)',
        NEW.payment_method, parent.payment_method;
    END IF;

    -- Проверка по сумме: сумма всех возвратов по этому чеку + новый ≤ суммы продажи
    SELECT COALESCE(SUM(total), 0) INTO refunded_total
      FROM public.fiscal_receipts
     WHERE parent_receipt_id = NEW.parent_receipt_id
       AND receipt_type = 'sell_refund';

    IF (refunded_total + COALESCE(NEW.total, 0)) > COALESCE(parent.total, 0) + 0.01 THEN
      RAISE EXCEPTION 'Сумма возвратов (% + % = %) превышает сумму исходного чека (%)',
        refunded_total, NEW.total, refunded_total + NEW.total, parent.total;
    END IF;

    -- Проверка поштучно: по каждой позиции (ключ name+price) нельзя вернуть больше, чем продано
    IF NEW.items IS NOT NULL THEN
      FOR it IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
        new_qty := COALESCE((it->>'quantity')::numeric, 0);
        IF new_qty <= 0 THEN CONTINUE; END IF;

        -- продано по этой позиции в исходном чеке
        SELECT COALESCE(SUM((p->>'quantity')::numeric), 0) INTO sold_qty
          FROM jsonb_array_elements(COALESCE(parent.items, '[]'::jsonb)) p
         WHERE p->>'name' = it->>'name'
           AND (p->>'price')::numeric = (it->>'price')::numeric;

        IF sold_qty <= 0 THEN
          RAISE EXCEPTION 'Позиция "% (% ₽)" отсутствует в исходном чеке',
            it->>'name', it->>'price';
        END IF;

        -- уже возвращено по этой позиции в предыдущих возвратах
        SELECT COALESCE(SUM((rp->>'quantity')::numeric), 0) INTO refunded_qty
          FROM public.fiscal_receipts fr,
               jsonb_array_elements(COALESCE(fr.items, '[]'::jsonb)) rp
         WHERE fr.parent_receipt_id = NEW.parent_receipt_id
           AND fr.receipt_type = 'sell_refund'
           AND rp->>'name' = it->>'name'
           AND (rp->>'price')::numeric = (it->>'price')::numeric;

        IF (refunded_qty + new_qty) > sold_qty THEN
          RAISE EXCEPTION 'Позиция "%": возвращается % при доступных % (продано %, уже возвращено %)',
            it->>'name', new_qty, sold_qty - refunded_qty, sold_qty, refunded_qty;
        END IF;
      END LOOP;
    END IF;
  ELSIF NEW.receipt_type = 'sell' THEN
    -- Чек продажи не должен ссылаться на parent
    IF NEW.parent_receipt_id IS NOT NULL THEN
      RAISE EXCEPTION 'У чека продажи не должно быть parent_receipt_id';
    END IF;
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_validate_fiscal_receipt ON public.fiscal_receipts;
CREATE TRIGGER trg_validate_fiscal_receipt
BEFORE INSERT ON public.fiscal_receipts
FOR EACH ROW EXECUTE FUNCTION public.validate_fiscal_receipt();

-- 3) Сериализация конкурентных возвратов по одному чеку продажи —
-- блокируем строку родительского чека, чтобы два параллельных возврата не
-- одновременно "видели" один и тот же остаток
CREATE OR REPLACE FUNCTION public.lock_parent_receipt_for_refund()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.receipt_type = 'sell_refund' AND NEW.parent_receipt_id IS NOT NULL THEN
    PERFORM 1 FROM public.fiscal_receipts WHERE id = NEW.parent_receipt_id FOR UPDATE;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_lock_parent_receipt_for_refund ON public.fiscal_receipts;
CREATE TRIGGER trg_lock_parent_receipt_for_refund
BEFORE INSERT ON public.fiscal_receipts
FOR EACH ROW EXECUTE FUNCTION public.lock_parent_receipt_for_refund();

-- Порядок срабатывания (по алфавиту имени): lock_... сработает первым, validate_... — вторым. OK.

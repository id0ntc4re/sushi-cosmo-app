
-- Reverse stock on order_items DELETE
CREATE OR REPLACE FUNCTION public.return_stock_on_order_item_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  IF OLD.product_id IS NULL THEN RETURN OLD; END IF;
  FOR r IN SELECT ingredient_id, qty FROM public.recipes WHERE product_id = OLD.product_id LOOP
    UPDATE public.ingredients SET stock = stock + (r.qty * OLD.quantity) WHERE id = r.ingredient_id;
    INSERT INTO public.stock_movements(ingredient_id, delta, reason, order_id)
      VALUES (r.ingredient_id, (r.qty * OLD.quantity), 'order_edit_return', OLD.order_id);
  END LOOP;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS return_stock_after_order_item_delete ON public.order_items;
CREATE TRIGGER return_stock_after_order_item_delete
  AFTER DELETE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.return_stock_on_order_item_delete();

-- Adjust stock on order_items UPDATE (quantity diff)
CREATE OR REPLACE FUNCTION public.adjust_stock_on_order_item_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; diff integer;
BEGIN
  IF NEW.product_id IS NULL OR NEW.product_id IS DISTINCT FROM OLD.product_id THEN RETURN NEW; END IF;
  diff := NEW.quantity - OLD.quantity;
  IF diff = 0 THEN RETURN NEW; END IF;
  FOR r IN SELECT ingredient_id, qty FROM public.recipes WHERE product_id = NEW.product_id LOOP
    UPDATE public.ingredients SET stock = stock - (r.qty * diff) WHERE id = r.ingredient_id;
    INSERT INTO public.stock_movements(ingredient_id, delta, reason, order_id)
      VALUES (r.ingredient_id, -(r.qty * diff), CASE WHEN diff>0 THEN 'order_edit_add' ELSE 'order_edit_return' END, NEW.order_id);
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS adjust_stock_after_order_item_update ON public.order_items;
CREATE TRIGGER adjust_stock_after_order_item_update
  AFTER UPDATE OF quantity ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.adjust_stock_on_order_item_update();

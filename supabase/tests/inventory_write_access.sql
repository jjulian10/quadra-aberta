-- Transactional regression test: all test data is rolled back.
BEGIN;
SELECT set_config('request.jwt.claim.sub', aa.user_id::text, true),
       set_config('qa.test_arena', aa.arena_id::text, true)
FROM public.arena_admins aa JOIN public.arenas a ON a.id=aa.arena_id
WHERE a.active LIMIT 1;
SET LOCAL ROLE authenticated;
DO $test$
DECLARE
  arena uuid := current_setting('qa.test_arena')::uuid;
  actor uuid := auth.uid();
  product uuid;
  result jsonb;
  n integer;
  denied boolean;
BEGIN
  product := public.save_inventory_product(arena, 'Security regression ' || gen_random_uuid(), 'Test', 10, 4, 10, 2);
  result := public.register_inventory_sale(product, 2);
  IF (result->>'sale_total')::numeric <> 20 OR (result->>'stock_quantity')::integer <> 8 THEN
    RAISE EXCEPTION 'Sale totals/stock regression';
  END IF;
  SELECT count(*) INTO n FROM public.inventory_movements
   WHERE product_id=product AND movement_type='sale' AND quantity=2 AND unit_price=10
     AND total_amount=20 AND stock_before=10 AND stock_after=8 AND created_by=actor;
  IF n<>1 THEN RAISE EXCEPTION 'Sale ledger/author regression'; END IF;
  denied:=false;
  BEGIN
    INSERT INTO public.inventory_movements(arena_id,product_id,movement_type,quantity,unit_price,total_amount,stock_before,stock_after)
    VALUES(arena,product,'sale',1,999,999,8,8);
  EXCEPTION WHEN insufficient_privilege THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Direct movement insertion still allowed'; END IF;
  denied:=false;
  BEGIN
    UPDATE public.inventory_products SET stock_quantity=99 WHERE id=product;
  EXCEPTION WHEN insufficient_privilege THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Direct stock update still allowed'; END IF;
  denied:=false;
  BEGIN
    PERFORM public.register_inventory_sale(product,99);
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'Estoque insuficiente.%' THEN denied:=true; ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Overselling allowed'; END IF;
  PERFORM public.save_inventory_product(arena,'Security regression ' || product,'Test',10,4,12,2,product);
  SELECT count(*) INTO n FROM public.inventory_movements WHERE product_id=product
    AND movement_type='restock' AND stock_before=8 AND stock_after=12 AND quantity=4 AND created_by=actor;
  IF n<>1 THEN RAISE EXCEPTION 'Restock regression'; END IF;
  PERFORM public.save_inventory_product(arena,'Security regression ' || product,'Test',10,4,11,2,product);
  SELECT count(*) INTO n FROM public.inventory_movements WHERE product_id=product
    AND movement_type='adjustment' AND stock_before=12 AND stock_after=11 AND quantity=1 AND created_by=actor;
  IF n<>1 THEN RAISE EXCEPTION 'Adjustment regression'; END IF;
  UPDATE public.inventory_products SET image_url='https://example.com/test.png', active=false WHERE id=product;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n<>1 THEN RAISE EXCEPTION 'Image/soft delete regression'; END IF;
  UPDATE public.inventory_products SET active=true WHERE id=product;
  PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  denied:=false;
  BEGIN
    PERFORM public.register_inventory_sale(product,1);
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Produto não encontrado.' THEN denied:=true; ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Unauthorized sale allowed'; END IF;
  denied:=false;
  BEGIN
    PERFORM public.save_inventory_product(arena,'Unauthorized','Test',10,4,1,2);
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Acesso não autorizado para esta arena.' THEN denied:=true; ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Unauthorized product allowed'; END IF;
  SELECT count(*) INTO n FROM public.inventory_movements WHERE product_id=product;
  IF n<>0 THEN RAISE EXCEPTION 'Unauthorized ledger read allowed'; END IF;
END;
$test$;
ROLLBACK;
-- Restrict inventory writes to checked, atomic RPCs.
-- Public wrappers preserve the existing frontend API; privileged bodies stay private.
CREATE OR REPLACE FUNCTION private.register_inventory_sale(target_product_id uuid, target_quantity integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  selected_product public.inventory_products%rowtype;
  previous_stock integer;
  next_stock integer;
  sale_total numeric(12,2);
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória.' using errcode = '42501';
  end if;
  if target_quantity is null or target_quantity <= 0 then
    raise exception 'Informe uma quantidade válida.';
  end if;

  select *
  into selected_product
  from public.inventory_products
  where id = target_product_id
    and active
    and private.is_arena_admin(arena_id)
  for update;

  if not found then
    raise exception 'Produto não encontrado.';
  end if;

  if not private.is_arena_admin(selected_product.arena_id) then
    raise exception 'Acesso não autorizado para esta arena.';
  end if;

  previous_stock := selected_product.stock_quantity;

  if previous_stock < target_quantity then
    raise exception 'Estoque insuficiente. Disponível: % unidade(s).', previous_stock;
  end if;

  next_stock := previous_stock - target_quantity;
  sale_total := selected_product.sale_price * target_quantity;

  update public.inventory_products
  set stock_quantity = next_stock
  where id = selected_product.id;

  insert into public.inventory_movements (
    arena_id, product_id, movement_type, quantity, unit_price, total_amount,
    stock_before, stock_after
  ) values (
    selected_product.arena_id,
    selected_product.id,
    'sale',
    target_quantity,
    selected_product.sale_price,
    sale_total,
    previous_stock,
    next_stock
  );

  return jsonb_build_object(
    'product_id', selected_product.id,
    'stock_quantity', next_stock,
    'quantity_sold', target_quantity,
    'sale_total', sale_total
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.register_inventory_sale(target_product_id uuid, target_quantity integer)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
  select private.register_inventory_sale(target_product_id, target_quantity);
$function$;
REVOKE ALL ON FUNCTION private.register_inventory_sale(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.register_inventory_sale(uuid, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.register_inventory_sale(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_inventory_sale(uuid, integer) TO authenticated;
CREATE OR REPLACE FUNCTION private.save_inventory_product(target_arena_id uuid, target_name text, target_category text, target_sale_price numeric, target_cost_price numeric, target_stock_quantity integer, target_low_stock_threshold integer, target_product_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  product_id uuid;
  previous_stock integer := 0;
  difference integer := 0;
  movement_kind text;
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória.' using errcode = '42501';
  end if;
  if not private.is_arena_admin(target_arena_id) then
    raise exception 'Acesso não autorizado para esta arena.';
  end if;

  if char_length(btrim(target_name)) not between 2 and 100 then
    raise exception 'Informe um nome de produto válido.';
  end if;

  if char_length(btrim(target_category)) not between 2 and 60 then
    raise exception 'Informe uma categoria válida.';
  end if;

  if target_sale_price is null or target_sale_price < 0 then
    raise exception 'Informe um preço de venda válido.';
  end if;

  if target_cost_price is not null and target_cost_price < 0 then
    raise exception 'Informe um custo válido.';
  end if;

  if target_stock_quantity is null or target_stock_quantity < 0 then
    raise exception 'O estoque não pode ser negativo.';
  end if;

  if target_low_stock_threshold is null or target_low_stock_threshold < 0 then
    raise exception 'O alerta de estoque deve ser zero ou maior.';
  end if;

  if target_product_id is null then
    insert into public.inventory_products (
      arena_id, name, category, sale_price, cost_price, stock_quantity, low_stock_threshold
    ) values (
      target_arena_id,
      btrim(target_name),
      btrim(target_category),
      target_sale_price,
      target_cost_price,
      target_stock_quantity,
      target_low_stock_threshold
    )
    returning id into product_id;

    if target_stock_quantity > 0 then
      insert into public.inventory_movements (
        arena_id, product_id, movement_type, quantity, unit_price, total_amount,
        stock_before, stock_after
      ) values (
        target_arena_id, product_id, 'restock', target_stock_quantity,
        coalesce(target_cost_price, 0), 0, 0, target_stock_quantity
      );
    end if;

    return product_id;
  end if;

  select stock_quantity
  into previous_stock
  from public.inventory_products
  where id = target_product_id
    and arena_id = target_arena_id
    and active
  for update;

  if not found then
    raise exception 'Produto não encontrado.';
  end if;

  update public.inventory_products
  set name = btrim(target_name),
      category = btrim(target_category),
      sale_price = target_sale_price,
      cost_price = target_cost_price,
      stock_quantity = target_stock_quantity,
      low_stock_threshold = target_low_stock_threshold
  where id = target_product_id
    and arena_id = target_arena_id;

  difference := target_stock_quantity - previous_stock;

  if difference <> 0 then
    movement_kind := case when difference > 0 then 'restock' else 'adjustment' end;
    insert into public.inventory_movements (
      arena_id, product_id, movement_type, quantity, unit_price, total_amount,
      stock_before, stock_after
    ) values (
      target_arena_id,
      target_product_id,
      movement_kind,
      abs(difference),
      coalesce(target_cost_price, 0),
      0,
      previous_stock,
      target_stock_quantity
    );
  end if;

  return target_product_id;
exception
  when unique_violation then
    raise exception 'Já existe um produto com esse nome nesta arena.';
end;
$function$;

CREATE OR REPLACE FUNCTION public.save_inventory_product(target_arena_id uuid, target_name text, target_category text, target_sale_price numeric, target_cost_price numeric, target_stock_quantity integer, target_low_stock_threshold integer, target_product_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE sql
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
  select private.save_inventory_product(target_arena_id, target_name, target_category, target_sale_price, target_cost_price, target_stock_quantity, target_low_stock_threshold, target_product_id);
$function$;
REVOKE ALL ON FUNCTION private.save_inventory_product(uuid, text, text, numeric, numeric, integer, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.save_inventory_product(uuid, text, text, numeric, numeric, integer, integer, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.save_inventory_product(uuid, text, text, numeric, numeric, integer, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_inventory_product(uuid, text, text, numeric, numeric, integer, integer, uuid) TO authenticated;

REVOKE ALL ON public.inventory_movements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.inventory_movements TO authenticated;
DROP POLICY IF EXISTS "Admins can create inventory movements" ON public.inventory_movements;

-- Metadata updates used by product images and soft deletion keep arena RLS.
-- Stock, prices and initial inventory can only be changed through the RPC.
REVOKE ALL ON public.inventory_products FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.inventory_products TO authenticated;
GRANT UPDATE (image_path, image_url, active) ON public.inventory_products TO authenticated;
DROP POLICY IF EXISTS "Admins can create inventory products" ON public.inventory_products;

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const slugify = (value: string) =>
  value.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Configuração do servidor indisponível." }, 500);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Sessão administrativa necessária." }, 401);

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await service.auth.getUser(authHeader.slice(7));
  if (authError || !authData.user) return json({ error: "Sessão inválida ou expirada." }, 401);

  const { data: platformAdmin, error: platformError } = await service
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (platformError) return json({ error: "Não foi possível validar a permissão." }, 500);
  if (!platformAdmin) return json({ error: "Acesso restrito ao administrador da plataforma." }, 403);

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Dados inválidos." }, 400);
  }

  const name = String(payload?.name || "").trim();
  const city = String(payload?.city || "Porto Velho, RO").trim();
  const address = String(payload?.address || "").trim();
  const whatsapp = String(payload?.whatsapp || "").replace(/\D/g, "");
  const adminEmail = String(payload?.adminEmail || "").trim().toLowerCase();
  const adminPassword = String(payload?.adminPassword || "");
  const courts = Array.isArray(payload?.courts) ? payload.courts : [];

  if (name.length < 2 || name.length > 80) return json({ error: "Informe um nome válido para a arena." }, 400);
  if (address.length < 5 || address.length > 180) return json({ error: "Informe um endereço válido." }, 400);
  if (!/^\d{10,13}$/.test(whatsapp)) return json({ error: "Informe um WhatsApp válido com DDD." }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) return json({ error: "Informe um e-mail administrativo válido." }, 400);
  if (adminPassword.length < 8) return json({ error: "A senha temporária deve ter pelo menos 8 caracteres." }, 400);
  if (!courts.length || courts.length > 20) return json({ error: "Cadastre entre 1 e 20 quadras." }, 400);

  const normalizedCourts = courts.map((court: any, index: number) => ({
    name: String(court?.name || `Quadra ${String(index + 1).padStart(2, "0")}`).trim(),
    sport: String(court?.sport || "Vôlei").trim(),
    hourly_price: Number(court?.hourlyPrice),
    opening_hour: Number(court?.openingHour),
    closing_hour: Number(court?.closingHour),
    sort_order: index + 1,
    active: true,
  }));

  if (normalizedCourts.some((court: any) =>
    court.name.length < 2 ||
    court.sport.length < 2 ||
    !Number.isFinite(court.hourly_price) ||
    court.hourly_price < 0 ||
    !Number.isInteger(court.opening_hour) ||
    !Number.isInteger(court.closing_hour) ||
    court.opening_hour < 0 ||
    court.closing_hour > 24 ||
    court.closing_hour <= court.opening_hour
  )) return json({ error: "Revise modalidade, preço e horário das quadras." }, 400);

  const slugBase = slugify(name);
  const { data: existingArena } = await service.from("arenas").select("id").eq("slug", slugBase).maybeSingle();
  if (existingArena) return json({ error: "Já existe uma arena com esse nome. Ajuste o nome antes de continuar." }, 409);

  let adminUser: any = null;
  let createdUser = false;

  const { data: createdAuth, error: createAuthError } = await service.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: { created_by_quadra_aberta_master: true },
  });

  if (!createAuthError && createdAuth.user) {
    adminUser = createdAuth.user;
    createdUser = true;
  } else {
    const { data: usersData, error: listError } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) return json({ error: "Não foi possível validar o administrador informado." }, 500);

    adminUser = usersData.users.find((user: any) => user.email?.toLowerCase() === adminEmail) || null;
    if (!adminUser) return json({ error: createAuthError?.message || "Não foi possível criar o administrador." }, 400);

    const { data: memberships, error: membershipLookupError } = await service
      .from("arena_admins")
      .select("arena_id")
      .eq("user_id", adminUser.id);

    if (membershipLookupError) return json({ error: "Não foi possível validar os vínculos do administrador." }, 500);
    if (memberships?.length) return json({ error: "Esse e-mail já está vinculado à administração de outra arena." }, 409);

    const { error: passwordError } = await service.auth.admin.updateUserById(adminUser.id, {
      password: adminPassword,
      email_confirm: true,
    });
    if (passwordError) return json({ error: "O usuário já existe, mas não foi possível atualizar a senha temporária." }, 400);
  }

  let arenaId: string | null = null;

  try {
    const { data: arena, error: arenaError } = await service
      .from("arenas")
      .insert({
        slug: slugBase,
        name,
        city,
        timezone: "America/Porto_Velho",
        active: true,
        address,
        whatsapp,
      })
      .select("id, slug, name, city")
      .single();

    if (arenaError) throw arenaError;
    arenaId = arena.id;

    const { error: courtError } = await service.from("courts").insert(
      normalizedCourts.map((court: any) => ({ ...court, arena_id: arena.id }))
    );
    if (courtError) throw courtError;

    const { error: membershipError } = await service.from("arena_admins").insert({
      arena_id: arena.id,
      user_id: adminUser.id,
      role: "admin",
    });
    if (membershipError) throw membershipError;

    return json({
      ok: true,
      arena: { id: arena.id, slug: arena.slug, name: arena.name, city: arena.city },
      admin: { email: adminEmail },
      courts: normalizedCourts.length,
    });
  } catch (error) {
    if (arenaId) await service.from("arenas").delete().eq("id", arenaId);
    if (createdUser && adminUser?.id) await service.auth.admin.deleteUser(adminUser.id);
    return json({ error: error instanceof Error ? error.message : "Não foi possível cadastrar a arena." }, 500);
  }
});

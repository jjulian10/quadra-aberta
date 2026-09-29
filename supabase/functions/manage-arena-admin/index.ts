import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json" },
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !serviceKey || !anonKey) return json({ error: "Configuração indisponível." }, 500);

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Sessão necessária." }, 401);

  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: identity, error: authError } = await service.auth.getUser(authorization.slice(7));
  if (authError || !identity.user) return json({ error: "Sessão inválida." }, 401);

  const { data: platformAdmin, error: permissionError } = await service.from("platform_admins")
    .select("user_id").eq("user_id", identity.user.id).maybeSingle();
  if (permissionError) return json({ error: "Não foi possível validar o acesso." }, 500);
  if (!platformAdmin) return json({ error: "Acesso restrito ao Painel Mestre." }, 403);

  let input: Record<string, unknown>;
  try { input = await req.json(); } catch { return json({ error: "Dados inválidos." }, 400); }
  const arenaId = String(input?.arenaId || "");
  const email = String(input?.email || "").trim().toLowerCase();
  if (!/^[0-9a-f-]{36}$/i.test(arenaId) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return json({ error: "Informe uma arena e um e-mail válidos." }, 400);
  }

  const { data: arena, error: arenaError } = await service.from("arenas")
    .select("id").eq("id", arenaId).maybeSingle();
  if (arenaError || !arena) return json({ error: "Arena não encontrada." }, 404);

  // Existing users keep their credentials. New users receive Supabase's normal invite email.
  let existing = null;
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return json({ error: "Não foi possível procurar o usuário." }, 500);
    existing = data.users.find((user) => user.email?.toLowerCase() === email) || null;
    if (existing || data.users.length < 1000) break;
  }

  if (existing) {
    const { data: links, error } = await service.from("arena_admins").select("arena_id")
      .eq("user_id", existing.id);
    if (error) return json({ error: "Não foi possível validar os vínculos." }, 500);
    if (links?.length) return json({ error: "Este usuário já administra uma arena." }, 409);
  }

  let target = existing;
  let invited = false;
  if (!target) {
    const redirectTo = (Deno.env.get("PUBLIC_SITE_URL") || "https://quadra-aberta.vercel.app").replace(/\/$/, "") + "/";
    const { data, error } = await service.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (error || !data.user) return json({ error: error?.message || "Não foi possível enviar o convite." }, 400);
    target = data.user;
    invited = true;
  }

  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: linkError } = await caller.rpc("master_add_admin", {
    p_arena_id: arenaId, p_user_id: target.id,
  });
  if (linkError) {
    if (invited) await service.auth.admin.deleteUser(target.id);
    return json({ error: linkError.message || "Não foi possível vincular o administrador." }, 400);
  }
  return json({ ok: true, invited, email });
});

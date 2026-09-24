import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import webpush from "npm:web-push@3.6.7";

const headers = {
  "Access-Control-Allow-Origin": "https://quadra-aberta.vercel.app",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const key = /^[A-Za-z0-9_-]{10,256}$/;
const pushHost = (host: string) => [
  "fcm.googleapis.com", "fcm-xm.googleapis.com",
  "updates.push.services.mozilla.com", "web.push.apple.com",
].includes(host) || host.endsWith(".notify.windows.com");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  try {
    const body = await req.json();
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    if (body.action === "public-key") {
      let { data: config, error } = await db.from("push_configuration")
        .select("vapid_public").eq("id", true).single();
      if (error) throw error;
      if (!config.vapid_public) {
        const keys = webpush.generateVAPIDKeys();
        const result = await db.from("push_configuration")
          .update({ vapid_public: keys.publicKey, vapid_private: keys.privateKey })
          .eq("id", true).is("vapid_public", null).select("vapid_public").maybeSingle();
        if (result.error) throw result.error;
        if (result.data) config = result.data;
        else {
          const latest = await db.from("push_configuration").select("vapid_public").eq("id", true).single();
          if (latest.error) throw latest.error;
          config = latest.data;
        }
      }
      return json({ public_key: config.vapid_public });
    }
    if (!["subscribe", "unsubscribe"].includes(body.action)) return json({ error: "Ação inválida." }, 400);
    const endpoint = String(body.subscription?.endpoint || "");
    let parsed: URL;
    try { parsed = new URL(endpoint); } catch { return json({ error: "Inscrição inválida." }, 400); }
    if (parsed.protocol !== "https:" || !pushHost(parsed.hostname) || endpoint.length > 2048 ||
      !key.test(body.subscription?.keys?.p256dh || "") ||
      !key.test(body.subscription?.keys?.auth || "")) {
      return json({ error: "Inscrição inválida." }, 400);
    }
    const arenaId = String(body.arena_id || "");
    const bookingToken = String(body.reservation_token || "");
    let adminUserId: string | null = null;
    let bookingId: string | null = null;
    if (body.role === "admin" && uuid.test(arenaId)) {
      const bearer = req.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
      if (!bearer) return json({ error: "Entre como administrador." }, 401);
      const { data: userResult, error: userError } = await db.auth.getUser(bearer);
      if (userError || !userResult.user) return json({ error: "Sessão inválida." }, 401);
      const { data: membership } = await db.from("arena_admins")
        .select("user_id").eq("arena_id", arenaId).eq("user_id", userResult.user.id).maybeSingle();
      if (!membership) return json({ error: "Sem acesso a esta arena." }, 403);
      adminUserId = userResult.user.id;
    } else if (body.role === "player" && uuid.test(bookingToken)) {
      const { data: booking } = await db.from("bookings")
        .select("id,arena_id,status").eq("reservation_access_token", bookingToken).maybeSingle();
      if (!booking) return json({ error: "Reserva inválida." }, 403);
      if (body.action === "subscribe" && booking.status !== "confirmed" && booking.status !== "pending") {
        return json({ error: "Reserva indisponível." }, 403);
      }
      bookingId = booking.id;
      if (body.arena_id && body.arena_id !== booking.arena_id) return json({ error: "Arena inválida." }, 403);
      body.arena_id = booking.arena_id;
    } else return json({ error: "Identificação inválida." }, 400);

    const selector = db.from("push_subscriptions").select("id")
      .eq("endpoint", endpoint).eq("arena_id", body.arena_id);
    const { data: existing, error: lookupError } = adminUserId
      ? await selector.eq("admin_user_id", adminUserId).maybeSingle()
      : await selector.eq("booking_id", bookingId!).maybeSingle();
    if (lookupError) throw lookupError;
    if (body.action === "unsubscribe") {
      if (existing) {
        const deleted = await db.from("push_subscriptions").delete().eq("id", existing.id);
        if (deleted.error) throw deleted.error;
      }
      return json({ enabled: false });
    }
    const values = {
      endpoint,
      p256dh: body.subscription.keys.p256dh,
      auth: body.subscription.keys.auth,
      arena_id: body.arena_id,
      admin_user_id: adminUserId,
      booking_id: bookingId,
    };
    const result = existing
      ? await db.from("push_subscriptions").update(values).eq("id", existing.id)
      : await db.from("push_subscriptions").insert(values);
    if (result.error) throw result.error;
    return json({ enabled: true });
  } catch (error) {
    console.error("push subscription:", error);
    return json({ error: "Não foi possível configurar os avisos." }, 500);
  }
});

import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import webpush from "npm:web-push@3.6.7";

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const site = "https://quadra-aberta.vercel.app";

Deno.serve(async (req) => {
  if (req.method !== "POST") return response({ error: "Método não permitido." }, 405);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const { worker_token: token } = await req.json().catch(() => ({}));
    const { data: config, error: configError } = await db.from("push_configuration")
      .select("worker_token,vapid_public,vapid_private").eq("id", true).single();
    if (configError) throw configError;
    if (!token || token !== config.worker_token) return response({ error: "Não autorizado." }, 401);
    if (!config.vapid_private || !config.vapid_public) return response({ processed: 0, configured: false });

    webpush.setVapidDetails(site, config.vapid_public, config.vapid_private);
    const now = new Date();
    const stale = new Date(now.getTime() - 5 * 60000).toISOString();
    const { data: events, error: eventsError } = await db.from("push_events")
      .select("id,arena_id,booking_id,target,kind,status,claimed_at")
      .lte("scheduled_at", now.toISOString()).or(`status.eq.queued,and(status.eq.sending,claimed_at.lt.${stale})`)
      .order("scheduled_at").limit(30);
    if (eventsError) throw eventsError;
    let processed = 0;
    for (const event of events || []) {
      let claimQuery = db.from("push_events")
        .update({ status: "sending", claimed_at: now.toISOString() })
        .eq("id", event.id).eq("status", event.status);
      if (event.status === "sending") claimQuery = claimQuery.eq("claimed_at", event.claimed_at);
      const claimed = await claimQuery.select("id").maybeSingle();
      if (claimed.error) throw claimed.error;
      if (!claimed.data) continue;
      try {
        const { data: booking, error: bookingError } = await db.from("bookings")
          .select("status,booking_date,start_hour,reservation_access_token,court_id").eq("id", event.booking_id).single();
        if (bookingError) throw bookingError;
        if ((event.kind === "reminder" || event.kind === "followup") && booking.status !== "confirmed") {
          await db.from("push_events").update({ status: "done" }).eq("id", event.id);
          continue;
        }
        const [arenaResult, courtResult] = await Promise.all([
          db.from("arenas").select("name,slug").eq("id", event.arena_id).single(),
          db.from("courts").select("name").eq("id", booking.court_id).single(),
        ]);
        if (arenaResult.error || courtResult.error) throw arenaResult.error || courtResult.error;
        const label = `${courtResult.data!.name} · ${booking.booking_date.split("-").reverse().join("/")} às ${String(booking.start_hour).padStart(2, "0")}:00`;
        const titles: Record<string, string> = {
          confirmed: event.target === "admin" ? "Nova reserva confirmada" : "Sua reserva foi confirmada!",
          payment: "Pagamento da reserva confirmado",
          cancelled: "Reserva cancelada",
          reminder: "Seu jogo é hoje!",
          followup: "Como foi seu jogo?",
        };
        const bodies: Record<string, string> = {
          confirmed: `${arenaResult.data!.name} · ${label}`,
          payment: `${arenaResult.data!.name} · ${label}`,
          cancelled: `${arenaResult.data!.name} · ${label}`,
          reminder: `${arenaResult.data!.name} · ${label}. Te esperamos!`,
          followup: `Como foi sua experiência? Quer marcar de novo na ${arenaResult.data!.name}?`,
        };
        const url = event.kind === "followup"
          ? `${site}/?arena=${encodeURIComponent(arenaResult.data!.slug)}`
          : event.target === "player"
          ? `${site}/?reserva=${encodeURIComponent(booking.reservation_access_token)}`
          : site;
        const payload = JSON.stringify({
          title: titles[event.kind], body: bodies[event.kind], url,
          tag: `quadra-${event.id}`,
        });
        const subscriptionQuery = db.from("push_subscriptions")
          .select("id,endpoint,p256dh,auth").eq("arena_id", event.arena_id);
        const { data: subscriptions, error: subsError } = event.target === "admin"
          ? await subscriptionQuery.not("admin_user_id", "is", null)
          : await subscriptionQuery.eq("booking_id", event.booking_id);
        if (subsError) throw subsError;
        let retry = false;
        for (const sub of subscriptions || []) {
          const { data: delivery, error: deliveryError } = await db.from("push_deliveries")
            .select("status,attempts").eq("event_id", event.id).eq("subscription_id", sub.id).maybeSingle();
          if (deliveryError) throw deliveryError;
          if (delivery && delivery.status !== "queued") continue;
          try {
            await webpush.sendNotification({
              endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth },
            }, payload, { TTL: event.kind === "reminder" ? 3600 : 86400 });
            const save = await db.from("push_deliveries").upsert({
              event_id: event.id, subscription_id: sub.id, status: "sent",
              attempts: (delivery?.attempts || 0) + 1, last_error: null,
            });
            if (save.error) throw save.error;
          } catch (error) {
            const code = Number((error as { statusCode?: number }).statusCode || 0);
            if (code === 404 || code === 410) {
              await db.from("push_deliveries").upsert({
                event_id: event.id, subscription_id: sub.id, status: "expired",
                attempts: (delivery?.attempts || 0) + 1,
              });
              await db.from("push_subscriptions").delete().eq("id", sub.id);
            } else {
              const attempts = (delivery?.attempts || 0) + 1;
              const result = await db.from("push_deliveries").upsert({
                event_id: event.id, subscription_id: sub.id,
                status: attempts < 5 ? "queued" : "failed", attempts,
                last_error: String(error).slice(0, 200),
              });
              if (result.error) throw result.error;
              if (attempts < 5) retry = true;
            }
          }
        }
        await db.from("push_events").update({
          status: retry ? "queued" : "done", claimed_at: null,
        }).eq("id", event.id);
        processed++;
      } catch (error) {
        console.error("push event:", event.id, error);
        await db.from("push_events").update({ status: "queued", claimed_at: null })
          .eq("id", event.id);
      }
    }
    return response({ processed });
  } catch (error) {
    console.error("push worker:", error);
    return response({ error: "Falha ao processar avisos." }, 500);
  }
});

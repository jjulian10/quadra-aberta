import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const body = await req.json();
    const arenaSlug = String(body?.arena_slug || "").trim();
    const courtId = String(body?.court_id || "").trim();
    const bookingDate = String(body?.booking_date || "").trim();
    const startHour = Number(body?.start_hour);
    const duration = Number(body?.duration || 1);
    const customerName = String(body?.customer_name || "").trim();
    const customerPhone = String(body?.customer_phone || "").replace(/\D/g, "");

    if (!arenaSlug || !courtId || !/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) {
      return json({ error: "Horário inválido." }, 400);
    }
    if (!Number.isInteger(startHour) || startHour < 0 || startHour > 23) {
      return json({ error: "Horário inválido." }, 400);
    }
    if (!Number.isInteger(duration) || duration < 1 || duration > 3) {
      return json({ error: "Duração inválida." }, 400);
    }
    if (customerName.length < 2 || customerName.length > 70) {
      return json({ error: "Informe seu nome." }, 400);
    }
    if (!/^\d{10,13}$/.test(customerPhone)) {
      return json({ error: "Informe um WhatsApp válido com DDD." }, 400);
    }

    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Porto_Velho",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    if (bookingDate < today) return json({ error: "Este horário já passou." }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: arena, error: arenaError } = await supabase
      .from("arenas")
      .select("id, name")
      .eq("slug", arenaSlug)
      .eq("active", true)
      .single();

    if (arenaError || !arena) return json({ error: "Arena indisponível." }, 404);

    const { data: court, error: courtError } = await supabase
      .from("courts")
      .select("id, name, opening_hour, closing_hour")
      .eq("id", courtId)
      .eq("arena_id", arena.id)
      .eq("active", true)
      .single();

    if (courtError || !court) return json({ error: "Quadra indisponível." }, 404);
    if (startHour < Number(court.opening_hour) || startHour + duration > Number(court.closing_hour)) {
      return json({ error: "Horário fora do funcionamento da quadra." }, 400);
    }

    const [{ data: bookings }, { data: blocks }] = await Promise.all([
      supabase
        .from("bookings")
        .select("start_hour, duration")
        .eq("arena_id", arena.id)
        .eq("court_id", courtId)
        .eq("booking_date", bookingDate)
        .in("status", ["pending", "confirmed"]),
      supabase
        .from("schedule_blocks")
        .select("start_hour, duration")
        .eq("arena_id", arena.id)
        .eq("booking_date", bookingDate)
        .or(`court_id.is.null,court_id.eq.${courtId}`),
    ]);

    const desiredEnd = startHour + duration;
    const occupied = (bookings || []).some((booking: any) =>
      Number(booking.start_hour) < desiredEnd
      && Number(booking.start_hour) + Number(booking.duration) > startHour
    );
    const blocked = (blocks || []).some((block: any) =>
      block.start_hour === null
      || (Number(block.start_hour) < desiredEnd
        && Number(block.start_hour) + Number(block.duration) > startHour)
    );

    if (blocked) return json({ error: "Esse horário está bloqueado pela arena." }, 409);
    if (!occupied) return json({ error: "Esse horário já está disponível. Você pode reservar agora." }, 409);

    const { data: existing } = await supabase
      .from("waitlist_entries")
      .select("id")
      .eq("arena_id", arena.id)
      .eq("court_id", courtId)
      .eq("booking_date", bookingDate)
      .eq("start_hour", startHour)
      .eq("duration", duration)
      .eq("customer_phone", customerPhone)
      .eq("status", "waiting")
      .maybeSingle();

    if (existing) {
      return json({
        ok: true,
        already_waiting: true,
        message: "Você já está na lista de espera deste horário.",
      });
    }

    const { error: insertError } = await supabase
      .from("waitlist_entries")
      .insert({
        arena_id: arena.id,
        court_id: courtId,
        booking_date: bookingDate,
        start_hour: startHour,
        duration,
        customer_name: customerName,
        customer_phone: customerPhone,
        status: "waiting",
      });

    if (insertError) throw insertError;

    return json({
      ok: true,
      already_waiting: false,
      arena: arena.name,
      court: court.name,
      message: "Tudo certo. Vamos avisar pelo WhatsApp se esse horário for liberado.",
    });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Não foi possível entrar na lista de espera." }, 400);
  }
});

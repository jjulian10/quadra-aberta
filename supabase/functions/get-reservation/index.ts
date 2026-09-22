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

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const { token } = await req.json();
    if (!token || !uuidPattern.test(String(token))) {
      return json({ error: "Link de reserva inválido." }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id, arena_id, court_id, booking_date, start_hour, duration, customer_name, status, payment_status, amount, deposit_amount, payment_received_amount, balance_payment_amount, balance_payment_qr_code, balance_payment_qr_code_base64, balance_payment_ticket_url, balance_payment_expires_at")
      .eq("reservation_access_token", token)
      .single();

    if (bookingError || !booking) return json({ error: "Reserva não encontrada." }, 404);

    const [{ data: arena, error: arenaError }, { data: court, error: courtError }] = await Promise.all([
      supabase
        .from("arenas")
        .select("name, city, address, whatsapp")
        .eq("id", booking.arena_id)
        .single(),
      supabase
        .from("courts")
        .select("name, sport")
        .eq("id", booking.court_id)
        .single(),
    ]);

    if (arenaError || courtError || !arena || !court) {
      return json({ error: "Não foi possível carregar os dados da reserva." }, 500);
    }

    const total = Number(booking.amount || 0);
    const received = Number(booking.payment_received_amount || 0);
    const remaining = Math.max(total - received, 0);
    const balanceExpiresAt = booking.balance_payment_expires_at
      ? new Date(booking.balance_payment_expires_at)
      : null;
    const activeBalancePayment = booking.payment_status === "partial"
      && Boolean(booking.balance_payment_qr_code)
      && Boolean(balanceExpiresAt)
      && balanceExpiresAt!.getTime() > Date.now();

    return json({
      reservation: {
        id: booking.id,
        customer_name: booking.customer_name,
        booking_date: booking.booking_date,
        start_hour: Number(booking.start_hour),
        duration: Number(booking.duration),
        status: booking.status,
        payment_status: booking.payment_status,
        total_amount: total,
        received_amount: received,
        remaining_amount: remaining,
        arena: {
          name: arena.name,
          city: arena.city,
          address: arena.address,
          whatsapp: arena.whatsapp,
        },
        court: {
          name: court.name,
          sport: court.sport,
        },
        balance_payment: activeBalancePayment ? {
          amount: Number(booking.balance_payment_amount || remaining),
          expires_at: booking.balance_payment_expires_at,
          qr_code: booking.balance_payment_qr_code,
          qr_code_base64: booking.balance_payment_qr_code_base64,
          ticket_url: booking.balance_payment_ticket_url,
        } : null,
      },
    });
  } catch (error) {
    console.error(error);
    return json({ error: "Não foi possível consultar a reserva." }, 500);
  }
});

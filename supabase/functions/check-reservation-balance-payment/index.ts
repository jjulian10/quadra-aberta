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
const orderIsPaid = (order: any) => {
  const payment = order?.transactions?.payments?.[0] ?? {};
  return [order?.status, payment?.status].some((status) =>
    ["processed", "approved", "paid"].includes(String(status).toLowerCase())
  );
};

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

    const { data: booking, error } = await supabase
      .from("bookings")
      .select("id, status, payment_status, amount, payment_received_amount, balance_payment_order_id, balance_payment_amount, balance_payment_expires_at")
      .eq("reservation_access_token", token)
      .single();

    if (error || !booking) return json({ error: "Reserva não encontrada." }, 404);

    if (booking.payment_status === "paid") {
      return json({
        booking_status: booking.status,
        payment_status: "paid",
        received_amount: Number(booking.payment_received_amount || booking.amount || 0),
        total_amount: Number(booking.amount || 0),
      });
    }

    if (booking.payment_status !== "partial" || !booking.balance_payment_order_id) {
      return json({
        booking_status: booking.status,
        payment_status: booking.payment_status,
        received_amount: Number(booking.payment_received_amount || 0),
        total_amount: Number(booking.amount || 0),
      });
    }

    const mercadoPagoToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!mercadoPagoToken) return json({ error: "O Pix ainda não foi configurado." }, 503);

    const orderResponse = await fetch(
      `https://api.mercadopago.com/v1/orders/${encodeURIComponent(booking.balance_payment_order_id)}`,
      { headers: { Authorization: `Bearer ${mercadoPagoToken}` } },
    );
    if (!orderResponse.ok) throw new Error("Não foi possível consultar o pagamento.");

    const order = await orderResponse.json();
    if (!orderIsPaid(order)) {
      const expired = booking.balance_payment_expires_at
        ? new Date(booking.balance_payment_expires_at).getTime() <= Date.now()
        : false;
      return json({
        booking_status: booking.status,
        payment_status: booking.payment_status,
        received_amount: Number(booking.payment_received_amount || 0),
        total_amount: Number(booking.amount || 0),
        expired,
      });
    }

    const payment = order?.transactions?.payments?.[0] ?? {};
    const paidAmount = Number(order?.total_amount ?? payment?.amount ?? 0);
    const expectedBalance = Number(booking.balance_payment_amount || 0);
    if (paidAmount + Number.EPSILON < expectedBalance) {
      throw new Error("O valor recebido é menor que o saldo da reserva.");
    }

    const total = Number(booking.amount || 0);
    const { data: updated, error: updateError } = await supabase
      .from("bookings")
      .update({
        status: "confirmed",
        payment_status: "paid",
        payment_received_amount: total,
        payment_confirmed_at: new Date().toISOString(),
      })
      .eq("id", booking.id)
      .eq("reservation_access_token", token)
      .eq("payment_status", "partial")
      .select("status, payment_status, payment_received_amount, amount")
      .maybeSingle();

    if (updateError) throw updateError;

    if (!updated) {
      const { data: current } = await supabase
        .from("bookings")
        .select("status, payment_status, payment_received_amount, amount")
        .eq("id", booking.id)
        .single();

      return json({
        booking_status: current?.status,
        payment_status: current?.payment_status,
        received_amount: Number(current?.payment_received_amount || 0),
        total_amount: Number(current?.amount || 0),
      });
    }

    return json({
      booking_status: updated.status,
      payment_status: updated.payment_status,
      received_amount: Number(updated.payment_received_amount || 0),
      total_amount: Number(updated.amount || 0),
    });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Não foi possível verificar o pagamento." }, 500);
  }
});

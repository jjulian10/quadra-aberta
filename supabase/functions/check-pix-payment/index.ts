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

function orderIsPaid(order: any) {
  const payment = order?.transactions?.payments?.[0] ?? {};
  return [order?.status, payment?.status].some((status) =>
    ["processed", "approved", "paid"].includes(String(status).toLowerCase())
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const { booking_id, payment_token } = await req.json();
    if (!booking_id || !payment_token) return json({ error: "Pagamento inválido." }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: booking, error: lookupError } = await supabase
      .from("bookings")
      .select("id, status, payment_status, amount, deposit_amount, payment_received_amount, payment_provider_order_id, payment_expires_at")
      .eq("id", booking_id)
      .eq("payment_access_token", payment_token)
      .eq("payment_provider", "mercado_pago")
      .single();
    if (lookupError || !booking) return json({ error: "Pagamento não encontrado." }, 404);

    if (["partial", "paid"].includes(booking.payment_status)) {
      return json({
        booking_status: booking.status,
        payment_status: booking.payment_status,
        received_amount: Number(booking.payment_received_amount ?? 0),
        total_amount: Number(booking.amount ?? 0),
      });
    }

    if (booking.status === "cancelled" || new Date(booking.payment_expires_at).getTime() <= Date.now()) {
      if (booking.status !== "cancelled") {
        await supabase.from("bookings").update({ status: "cancelled" }).eq("id", booking.id);
      }
      return json({ booking_status: "cancelled", payment_status: booking.payment_status });
    }

    const mercadoPagoToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!mercadoPagoToken || !booking.payment_provider_order_id) {
      return json({ booking_status: booking.status, payment_status: booking.payment_status });
    }

    const orderResponse = await fetch(
      `https://api.mercadopago.com/v1/orders/${encodeURIComponent(booking.payment_provider_order_id)}`,
      { headers: { Authorization: `Bearer ${mercadoPagoToken}` } },
    );
    if (!orderResponse.ok) throw new Error("Não foi possível consultar o pagamento.");

    const order = await orderResponse.json();
    if (!orderIsPaid(order)) {
      return json({ booking_status: booking.status, payment_status: booking.payment_status });
    }

    const payment = order?.transactions?.payments?.[0] ?? {};
    const receivedAmount = Number(order?.total_amount ?? payment?.amount ?? 0);
    if (receivedAmount + Number.EPSILON < Number(booking.deposit_amount)) {
      throw new Error("O valor recebido é menor que o sinal da reserva.");
    }

    const totalAmount = Number(booking.amount ?? 0);
    const nextPaymentStatus = receivedAmount + Number.EPSILON >= totalAmount ? "paid" : "partial";

    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        status: "confirmed",
        payment_status: nextPaymentStatus,
        payment_received_amount: receivedAmount,
        payment_confirmed_at: new Date().toISOString(),
      })
      .eq("id", booking.id)
      .eq("payment_status", "pending");
    if (updateError) throw updateError;

    return json({
      booking_status: "confirmed",
      payment_status: nextPaymentStatus,
      received_amount: receivedAmount,
      total_amount: totalAmount,
    });
  } catch (error) {
    console.error(error);
    return json({ error: "Não foi possível verificar o pagamento." }, 500);
  }
});

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

    const mercadoPagoToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!mercadoPagoToken) return json({ error: "O Pix ainda não foi configurado." }, 503);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: booking, error } = await supabase
      .from("bookings")
      .select("id, customer_name, customer_email, status, payment_status, amount, payment_received_amount, balance_payment_order_id, balance_payment_amount, balance_payment_qr_code, balance_payment_qr_code_base64, balance_payment_ticket_url, balance_payment_expires_at")
      .eq("reservation_access_token", token)
      .single();

    if (error || !booking) return json({ error: "Reserva não encontrada." }, 404);
    if (booking.status !== "confirmed") return json({ error: "A reserva ainda não está confirmada." }, 409);
    if (booking.payment_status === "paid") return json({ error: "Esta reserva já está totalmente paga." }, 409);
    if (booking.payment_status !== "partial") return json({ error: "Confirme primeiro o pagamento do sinal." }, 409);

    const total = Number(booking.amount || 0);
    const received = Number(booking.payment_received_amount || 0);
    const remaining = Math.max(total - received, 0);
    if (remaining <= 0.001) return json({ error: "Não há saldo restante." }, 409);

    const existingExpiry = booking.balance_payment_expires_at
      ? new Date(booking.balance_payment_expires_at).getTime()
      : 0;

    if (
      booking.balance_payment_order_id &&
      booking.balance_payment_qr_code &&
      existingExpiry > Date.now()
    ) {
      return json({
        amount: Number(booking.balance_payment_amount || remaining),
        expires_at: booking.balance_payment_expires_at,
        qr_code: booking.balance_payment_qr_code,
        qr_code_base64: booking.balance_payment_qr_code_base64,
        ticket_url: booking.balance_payment_ticket_url,
        reused: true,
      });
    }

    const idempotencyKey = crypto.randomUUID();
    const paymentResponse = await fetch("https://api.mercadopago.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mercadoPagoToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        type: "online",
        processing_mode: "automatic",
        external_reference: `balance:${booking.id}`,
        total_amount: remaining.toFixed(2),
        payer: {
          email: String(booking.customer_email || "").trim().toLowerCase(),
          first_name: String(booking.customer_name || "Cliente").trim().split(/\s+/)[0],
        },
        transactions: {
          payments: [{
            amount: remaining.toFixed(2),
            payment_method: { id: "pix", type: "bank_transfer" },
            expiration_time: "PT30M",
          }],
        },
      }),
    });

    const order = await paymentResponse.json();
    if (!paymentResponse.ok) {
      const providerMessage = order?.message || order?.error || order?.cause?.[0]?.description || order?.cause?.[0]?.code;
      throw new Error(providerMessage ? `Mercado Pago: ${providerMessage}` : "O Mercado Pago recusou a cobrança.");
    }

    const payment = order?.transactions?.payments?.[0] ?? {};
    const paymentMethod = payment?.payment_method ?? order?.payment_method ?? {};
    const qrCode = paymentMethod?.qr_code ?? payment?.qr_code;
    const qrCodeBase64 = paymentMethod?.qr_code_base64 ?? payment?.qr_code_base64;
    const ticketUrl = paymentMethod?.ticket_url ?? payment?.ticket_url;

    if (!order?.id || !qrCode) throw new Error("O provedor não retornou os dados do Pix.");

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        balance_payment_order_id: String(order.id),
        balance_payment_amount: remaining,
        balance_payment_qr_code: String(qrCode),
        balance_payment_qr_code_base64: qrCodeBase64 ? String(qrCodeBase64) : null,
        balance_payment_ticket_url: ticketUrl ? String(ticketUrl) : null,
        balance_payment_expires_at: expiresAt,
      })
      .eq("id", booking.id)
      .eq("reservation_access_token", token)
      .eq("payment_status", "partial");

    if (updateError) throw updateError;

    return json({
      amount: remaining,
      expires_at: expiresAt,
      qr_code: qrCode,
      qr_code_base64: qrCodeBase64,
      ticket_url: ticketUrl,
      reused: false,
    });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Não foi possível gerar o Pix do saldo." }, 400);
  }
});

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

function clientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("cf-connecting-ip") || "0.0.0.0";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const mercadoPagoToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
  if (!mercadoPagoToken) return json({ error: "O Pix ainda não foi configurado pela arena." }, 503);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let bookingId: string | null = null;

  try {
    const body = await req.json();
    const { data, error } = await supabase.rpc("create_pix_booking", {
      target_arena_slug: body.arena_slug,
      target_court_id: body.court_id,
      target_date: body.booking_date,
      target_start_hour: Number(body.start_hour),
      target_duration: Number(body.duration),
      target_customer_name: body.customer_name,
      target_customer_phone: body.customer_phone,
      target_customer_email: body.customer_email,
      target_client_ip: clientIp(req),
    }).single();

    if (error) throw error;
    bookingId = data.booking_id;

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
        external_reference: bookingId,
        total_amount: Number(data.deposit_amount).toFixed(2),
        payer: {
          email: String(body.customer_email).trim().toLowerCase(),
          first_name: body.test_mode === true
            ? "APRO"
            : String(body.customer_name).trim().split(/\s+/)[0],
        },
        transactions: {
          payments: [{
            amount: Number(data.deposit_amount).toFixed(2),
            payment_method: { id: "pix", type: "bank_transfer" },
            expiration_time: "PT30M",
          }],
        },
      }),
    });

    const order = await paymentResponse.json();
    if (!paymentResponse.ok) {
      console.error("Mercado Pago order error", paymentResponse.status, order);
      const providerMessage = order?.message || order?.error || order?.cause?.[0]?.description || order?.cause?.[0]?.code;
      throw new Error(providerMessage ? `Mercado Pago: ${providerMessage}` : `Mercado Pago recusou a cobrança (${paymentResponse.status}).`);
    }

    const payment = order?.transactions?.payments?.[0] ?? {};
    const paymentMethod = payment?.payment_method ?? order?.payment_method ?? {};
    const qrCode = paymentMethod?.qr_code ?? payment?.qr_code;
    const qrCodeBase64 = paymentMethod?.qr_code_base64 ?? payment?.qr_code_base64;
    const ticketUrl = paymentMethod?.ticket_url ?? payment?.ticket_url;

    if (!order?.id || !qrCode) throw new Error("O provedor não retornou os dados do Pix.");

    const { error: updateError } = await supabase
      .from("bookings")
      .update({ payment_provider_order_id: String(order.id) })
      .eq("id", bookingId);
    if (updateError) throw updateError;

    return json({
      booking_id: bookingId,
      payment_token: data.payment_token,
      deposit_amount: Number(data.deposit_amount),
      expires_in_minutes: 30,
      qr_code: qrCode,
      qr_code_base64: qrCodeBase64,
      ticket_url: ticketUrl,
    });
  } catch (error) {
    console.error(error);
    if (bookingId) {
      await supabase.from("bookings").update({ status: "cancelled" }).eq("id", bookingId);
    }
    const message = error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String(error.message)
        : "Não foi possível iniciar o pagamento.";
    return json({ error: message }, 400);
  }
});

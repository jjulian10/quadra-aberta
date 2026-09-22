import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method !== "POST") return response({ received: true });

  try {
    const mercadoPagoToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!mercadoPagoToken) throw new Error("Mercado Pago não configurado.");

    const payload = await req.json().catch(() => ({}));
    const url = new URL(req.url);
    const orderId = payload?.data?.id || payload?.id || url.searchParams.get("data.id") || url.searchParams.get("id");
    if (!orderId) return response({ received: true });

    const orderResponse = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId)}`, {
      headers: { Authorization: `Bearer ${mercadoPagoToken}` },
    });
    if (!orderResponse.ok) throw new Error("Não foi possível validar a cobrança no Mercado Pago.");

    const order = await orderResponse.json();
    const payment = order?.transactions?.payments?.[0] ?? {};
    const paid = [order?.status, payment?.status].some((status) =>
      ["processed", "approved", "paid"].includes(String(status).toLowerCase())
    );
    if (!paid) return response({ received: true, paid: false });

    const bookingId = order?.external_reference;
    if (!bookingId) return response({ received: true, ignored: true });

    // Cobranças complementares do portal "Minha Reserva" usam um prefixo
    // próprio e são confirmadas pela função específica do saldo restante.
    if (String(bookingId).startsWith("balance:")) {
      return response({ received: true, ignored: true, kind: "balance" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: booking, error: lookupError } = await supabase
      .from("bookings")
      .select("id, amount, deposit_amount, payment_status, payment_received_amount")
      .eq("id", bookingId)
      .eq("payment_provider", "mercado_pago")
      .eq("payment_provider_order_id", String(orderId))
      .single();
    if (lookupError) throw lookupError;

    const receivedAmount = Number(order?.total_amount ?? payment?.amount ?? 0);
    if (receivedAmount + Number.EPSILON < Number(booking.deposit_amount)) {
      throw new Error("Valor recebido menor que o sinal da reserva.");
    }

    const totalAmount = Number(booking.amount ?? 0);
    const nextPaymentStatus = receivedAmount + Number.EPSILON >= totalAmount ? "paid" : "partial";

    if (!["partial", "paid"].includes(booking.payment_status)) {
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
    }

    return response({
      received: true,
      paid: nextPaymentStatus === "paid",
      payment_status: nextPaymentStatus,
      received_amount: receivedAmount,
    });
  } catch (error) {
    console.error(error);
    return response({ error: "Falha ao processar a notificação." }, 500);
  }
});

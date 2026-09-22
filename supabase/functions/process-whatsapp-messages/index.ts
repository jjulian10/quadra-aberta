import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const weekday = (date: string) => {
  const value = new Date(date + "T12:00:00Z");
  const day = new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(value);
  const formatted = new Intl.DateTimeFormat("pt-BR").format(value);
  return `${day.charAt(0).toUpperCase() + day.slice(1)}, ${formatted}`;
};

const period = (start: number, duration: number) =>
  `${String(start).padStart(2, "0")}:00 às ${String(start + duration).padStart(2, "0")}:00`;

const normalizePhone = (phone: string) => {
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.length <= 11) digits = "55" + digits;
  return digits;
};

async function sendTemplate(args: {
  token: string;
  phoneNumberId: string;
  graphVersion: string;
  templateName: string;
  phone: string;
  parameters: string[];
}) {
  const response = await fetch(
    `https://graph.facebook.com/${args.graphVersion}/${args.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizePhone(args.phone),
        type: "template",
        template: {
          name: args.templateName,
          language: { code: "pt_BR" },
          components: [{
            type: "body",
            parameters: args.parameters.map((text) => ({
              type: "text",
              text: String(text),
            })),
          }],
        },
      }),
    },
  );

  const body = await response.json();
  if (!response.ok) {
    const message = body?.error?.message || "Falha ao enviar mensagem pelo WhatsApp.";
    throw new Error(message);
  }

  return body?.messages?.[0]?.id || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  try {
    const { worker_token } = await req.json().catch(() => ({}));
    if (!worker_token) return json({ error: "Worker não autorizado." }, 401);

    const { data: validWorker, error: workerError } = await supabase.rpc(
      "validate_whatsapp_worker_token",
      { candidate: worker_token },
    );

    if (workerError || !validWorker) return json({ error: "Worker não autorizado." }, 401);

    const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    const graphVersion = Deno.env.get("WHATSAPP_GRAPH_VERSION") || "v23.0";
    const siteUrl = (Deno.env.get("PUBLIC_SITE_URL") || "https://quadra-aberta.vercel.app").replace(/\/$/, "");

    const templates = {
      booking_confirmation: Deno.env.get("WHATSAPP_TEMPLATE_CONFIRMATION"),
      booking_reminder: Deno.env.get("WHATSAPP_TEMPLATE_REMINDER"),
      booking_followup: Deno.env.get("WHATSAPP_TEMPLATE_FOLLOWUP"),
      waitlist_available: Deno.env.get("WHATSAPP_TEMPLATE_WAITLIST"),
    };

    if (!accessToken || !phoneNumberId || Object.values(templates).some((value) => !value)) {
      return json({
        configured: false,
        message: "Credenciais ou modelos do WhatsApp ainda não foram configurados.",
      }, 503);
    }

    const { data: messages, error: queueError } = await supabase
      .from("whatsapp_message_queue")
      .select("id, arena_id, booking_id, waitlist_id, phone, template_key, attempts")
      .eq("status", "queued")
      .lte("scheduled_at", new Date().toISOString())
      .lt("attempts", 5)
      .order("scheduled_at", { ascending: true })
      .limit(20);

    if (queueError) throw queueError;
    if (!messages?.length) return json({ configured: true, processed: 0 });

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const message of messages) {
      const { data: locked } = await supabase
        .from("whatsapp_message_queue")
        .update({
          status: "sending",
          attempts: Number(message.attempts || 0) + 1,
          last_error: null,
        })
        .eq("id", message.id)
        .eq("status", "queued")
        .select("id")
        .maybeSingle();

      if (!locked) continue;

      try {
        let templateName = templates[message.template_key as keyof typeof templates]!;
        let parameters: string[] = [];

        if (message.booking_id) {
          const { data: booking, error: bookingError } = await supabase
            .from("bookings")
            .select("id, arena_id, court_id, booking_date, start_hour, duration, customer_name, status, payment_status, amount, payment_received_amount, reservation_access_token")
            .eq("id", message.booking_id)
            .single();

          if (bookingError || !booking) throw new Error("Reserva não encontrada.");

          if (
            ["booking_reminder", "booking_followup"].includes(message.template_key)
            && booking.status !== "confirmed"
          ) {
            await supabase
              .from("whatsapp_message_queue")
              .update({ status: "skipped", last_error: "Reserva não está confirmada." })
              .eq("id", message.id);
            skipped += 1;
            continue;
          }

          const [{ data: arena }, { data: court }] = await Promise.all([
            supabase.from("arenas").select("name").eq("id", booking.arena_id).single(),
            supabase.from("courts").select("name, sport").eq("id", booking.court_id).single(),
          ]);

          if (!arena || !court) throw new Error("Arena ou quadra não encontrada.");

          const total = Number(booking.amount || 0);
          const received = Number(booking.payment_received_amount || 0);
          const remaining = Math.max(total - received, 0);
          const dateLabel = weekday(booking.booking_date);
          const timeLabel = period(Number(booking.start_hour), Number(booking.duration));

          if (message.template_key === "booking_confirmation") {
            parameters = [
              booking.customer_name,
              arena.name,
              court.name,
              dateLabel,
              timeLabel,
              money(received),
              money(remaining),
              booking.payment_status === "paid" ? "Pago integral" : "Pago parcial",
              `${siteUrl}/?reserva=${booking.reservation_access_token}`,
            ];
          } else if (message.template_key === "booking_reminder") {
            parameters = [
              booking.customer_name,
              arena.name,
              court.name,
              dateLabel,
              timeLabel,
              money(remaining),
            ];
          } else if (message.template_key === "booking_followup") {
            parameters = [
              booking.customer_name,
              arena.name,
              siteUrl,
            ];
          }
        } else if (message.waitlist_id) {
          const { data: entry, error: waitError } = await supabase
            .from("waitlist_entries")
            .select("id, arena_id, court_id, booking_date, start_hour, duration, customer_name, customer_phone, status")
            .eq("id", message.waitlist_id)
            .single();

          if (waitError || !entry) throw new Error("Entrada da lista de espera não encontrada.");

          if (entry.status !== "waiting") {
            await supabase
              .from("whatsapp_message_queue")
              .update({ status: "skipped", last_error: "Lista de espera não está ativa." })
              .eq("id", message.id);
            skipped += 1;
            continue;
          }

          const [{ data: activeBookings }, { data: blocks }, { data: arena }, { data: court }] = await Promise.all([
            supabase
              .from("bookings")
              .select("start_hour, duration")
              .eq("arena_id", entry.arena_id)
              .eq("court_id", entry.court_id)
              .eq("booking_date", entry.booking_date)
              .in("status", ["pending", "confirmed"]),
            supabase
              .from("schedule_blocks")
              .select("start_hour, duration")
              .eq("arena_id", entry.arena_id)
              .eq("booking_date", entry.booking_date)
              .or(`court_id.is.null,court_id.eq.${entry.court_id}`),
            supabase.from("arenas").select("name").eq("id", entry.arena_id).single(),
            supabase.from("courts").select("name").eq("id", entry.court_id).single(),
          ]);

          const desiredStart = Number(entry.start_hour);
          const desiredEnd = desiredStart + Number(entry.duration);
          const occupied = (activeBookings || []).some((booking: any) =>
            Number(booking.start_hour) < desiredEnd
            && Number(booking.start_hour) + Number(booking.duration) > desiredStart
          );
          const blocked = (blocks || []).some((block: any) =>
            block.start_hour === null
            || (Number(block.start_hour) < desiredEnd
              && Number(block.start_hour) + Number(block.duration) > desiredStart)
          );

          if (occupied || blocked) {
            await supabase
              .from("whatsapp_message_queue")
              .update({ status: "skipped", last_error: "Horário voltou a ficar indisponível." })
              .eq("id", message.id);
            skipped += 1;
            continue;
          }

          parameters = [
            entry.customer_name,
            arena?.name || "Arena",
            court?.name || "Quadra",
            weekday(entry.booking_date),
            period(desiredStart, Number(entry.duration)),
            siteUrl,
          ];
        }

        const providerMessageId = await sendTemplate({
          token: accessToken,
          phoneNumberId,
          graphVersion,
          templateName,
          phone: message.phone,
          parameters,
        });

        await supabase
          .from("whatsapp_message_queue")
          .update({
            status: "sent",
            provider_message_id: providerMessageId,
            sent_at: new Date().toISOString(),
          })
          .eq("id", message.id);

        if (message.waitlist_id) {
          await supabase
            .from("waitlist_entries")
            .update({
              status: "notified",
              notified_at: new Date().toISOString(),
            })
            .eq("id", message.waitlist_id)
            .eq("status", "waiting");
        }

        sent += 1;
      } catch (error) {
        const messageText = error instanceof Error ? error.message : "Falha ao enviar mensagem.";
        const nextAttempt = Number(message.attempts || 0) + 1;
        const terminal = nextAttempt >= 5;

        await supabase
          .from("whatsapp_message_queue")
          .update({
            status: terminal ? "failed" : "queued",
            scheduled_at: terminal
              ? new Date().toISOString()
              : new Date(Date.now() + Math.min(nextAttempt * 5, 30) * 60_000).toISOString(),
            last_error: messageText.slice(0, 500),
          })
          .eq("id", message.id);

        failed += 1;
      }
    }

    return json({ configured: true, processed: messages.length, sent, failed, skipped });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Falha no worker de mensagens." }, 500);
  }
});

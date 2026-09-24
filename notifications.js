// Notificações administrativas derivadas das reservas da arena autenticada.
import { pushSupported, pushEnabled, togglePush } from './push.js';
export function createAdminNotifications({ supabase, openBooking, openFinance }) {
  const anchor = document.querySelector('#notificationAnchor');
  const bell = document.querySelector('#notificationBell');
  const badge = document.querySelector('#notificationBadge');
  const panel = document.querySelector('#notificationPanel');
  const list = document.querySelector('#notificationList');
  const popup = document.querySelector('#notificationToast');
  const readAll = document.querySelector('#notificationReadAll');
  const pushControl = document.querySelector('#adminPushControl');
  const pushButton = document.querySelector('#adminPushButton');
  const pushStatus = document.querySelector('#adminPushStatus');
  let context = null;
  let generation = 0;
  let items = [];
  let read = new Set();
  let seen = new Set();
  let initialized = false;
  let timer;
  let toastTimer;
  let refreshInFlight = false;
  let refreshRequested = false;

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const amount = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const hours = (item) => `${item.hour}:00 às ${item.hour + item.duration}:00`;
  const dateLabel = (date) => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return date === today ? 'Hoje' : new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };
  const relativeTime = (value) => {
    const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 60000));
    if (minutes < 1) return 'agora';
    if (minutes < 60) return `há ${minutes} min`;
    if (minutes < 1440) return `há ${Math.floor(minutes / 60)} h`;
    return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };
  const storageKey = (kind) => `quadra-aberta:notifications:${context.userId}:${context.arena.id}:${kind}`;
  const stored = (kind) => {
    try { return new Set(JSON.parse(localStorage.getItem(storageKey(kind)) || '[]')); }
    catch { return new Set(); }
  };
  const persist = (kind, values) => {
    try { localStorage.setItem(storageKey(kind), JSON.stringify([...values].slice(-350))); }
    catch { /* Navegação privada pode desativar armazenamento local. */ }
  };

  function hideToast() {
    clearTimeout(toastTimer);
    popup.classList.add('hidden');
    popup.innerHTML = '';
  }

  function closePanel() {
    panel.classList.add('hidden');
    bell.setAttribute('aria-expanded', 'false');
  }

  function reset() {
    generation += 1;
    clearInterval(timer);
    refreshRequested = false;
    context = null;
    items = [];
    read = new Set();
    seen = new Set();
    initialized = false;
    anchor.classList.add('hidden');
    pushControl.hidden = true;
    closePanel();
    hideToast();
  }

  function render() {
    const unread = items.filter((item) => !read.has(item.key)).length;
    badge.textContent = unread > 9 ? '9+' : String(unread);
    badge.classList.toggle('hidden', !unread);
    bell.setAttribute('aria-label', unread ? `Notificações, ${unread} não lidas` : 'Notificações, nenhuma não lida');
    readAll.disabled = !unread;
    list.innerHTML = items.length ? items.map((item) => `
      <button class="notification-item ${read.has(item.key) ? '' : 'unread'}" data-notification="${escapeHtml(item.key)}" type="button">
        <span class="notification-dot" aria-hidden="true"></span>
        <span class="notification-symbol ${item.kind}" aria-hidden="true">${item.kind === 'payment' ? '＄' : item.kind === 'cancel' ? '×' : '▣'}</span>
        <span class="notification-copy"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.name)} · ${escapeHtml(item.court)}<br>${escapeHtml(item.detail)}</small></span>
        <time>${escapeHtml(relativeTime(item.time))}</time>
      </button>`).join('') : '<p class="notification-empty">Nenhuma notificação nesta arena.</p>';
  }

  function showToast(item) {
    if (!context || document.visibilityState === 'hidden') return;
    hideToast();
    const total = Number(item.total || 0);
    const received = Number(item.received || 0);
    const paymentLine = received > 0
      ? `Entrada confirmada: <strong>${amount(received)}</strong><br>Saldo restante: <strong>${amount(Math.max(total - received, 0))}</strong>`
      : 'Aguardando confirmação do sinal via Pix';
    popup.innerHTML = `<button type="button" class="notification-toast-close" data-dismiss aria-label="Fechar notificação">×</button>
      <div class="notification-toast-top"><span class="notification-toast-icon" aria-hidden="true">▣</span><div>
      <span class="notification-toast-label">NOVA RESERVA · AGORA</span><strong>Nova reserva recebida</strong>
      <span>${escapeHtml(item.name)} reservou um horário</span></div></div>
      <div class="notification-toast-info">${escapeHtml(context.arena.name)} · ${escapeHtml(item.court)}<br>${escapeHtml(dateLabel(item.date))} · ${hours(item)}<br>${paymentLine}</div>
      <div class="notification-toast-actions"><button type="button" data-open-booking="${escapeHtml(item.bookingId)}">Ver reserva →</button><button type="button" data-open-finance>Ir para financeiro ↗</button></div>`;
    popup.classList.remove('hidden');
    toastTimer = setTimeout(hideToast, 11000);
  }

  function setContext(arena, userId, courts) {
    if (context?.arena.id === arena.id && context.userId === userId) {
      context.courts = courts;
      return;
    }
    reset();
    context = { arena, userId, courts };
    pushControl.hidden = !pushSupported();
    updatePushButton();
    read = stored('read');
    seen = stored('seen');
    anchor.classList.remove('hidden');
    timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, 45000);
    refresh();
  }

  function updatePushButton() {
    if (!context) return;
    pushButton.textContent = pushEnabled('admin', context.userId + ':' + context.arena.id)
      ? 'Desativar avisos no celular' : 'Ativar avisos no celular';
  }

  pushButton.addEventListener('click', async () => {
    if (!context) return;
    const snapshot = context;
    pushButton.disabled = true;
    pushStatus.textContent = '';
    try {
      const enabled = await togglePush(supabase, {
        role: 'admin', id: snapshot.userId + ':' + snapshot.arena.id, arenaId: snapshot.arena.id,
      });
      if (context === snapshot) pushStatus.textContent = enabled
        ? 'Avisos ativados para esta arena.' : 'Avisos desativados para esta arena.';
    } catch (error) {
      if (context === snapshot) pushStatus.textContent = error.message;
    } finally {
      pushButton.disabled = false;
      updatePushButton();
    }
  });

  async function refresh() {
    if (!context) return;
    if (refreshInFlight) { refreshRequested = true; return; }
    refreshInFlight = true;
    const snapshot = context;
    const version = generation;
    try {
      const [bookingsResult, cancellationsResult] = await Promise.all([
        supabase.from('bookings')
          .select('id, booking_date, court_id, start_hour, duration, customer_name, status, payment_status, amount, payment_received_amount, created_at, updated_at')
          .eq('arena_id', snapshot.arena.id).order('created_at', { ascending: false }).limit(80),
        supabase.from('booking_cancellations')
          .select('id, booking_id, booking_date, start_hour, duration, court_name, customer_name, booking_amount, payment_received_amount, cancelled_at')
          .eq('arena_id', snapshot.arena.id).order('cancelled_at', { ascending: false }).limit(30)
      ]);
      if (bookingsResult.error) throw bookingsResult.error;
      if (cancellationsResult.error) throw cancellationsResult.error;
      if (generation !== version || context !== snapshot) return;
      const next = [];
      for (const booking of bookingsResult.data || []) {
        const court = snapshot.courts.find((entry) => entry.id === booking.court_id)?.name || 'Quadra';
        const base = {
          bookingId: booking.id, date: booking.booking_date, hour: Number(booking.start_hour),
          duration: Number(booking.duration), name: booking.customer_name, court, status: booking.status,
          total: Number(booking.amount), received: Number(booking.payment_received_amount || 0)
        };
        if (booking.status !== 'cancelled') next.push({ ...base, key: `${booking.id}:booking`, kind: 'booking', title: 'Nova reserva recebida', detail: `${dateLabel(base.date)} · ${hours(base)}`, time: booking.created_at });
        if (booking.status !== 'cancelled' && base.received > 0) next.push({ ...base, key: `${booking.id}:payment`, kind: 'payment', title: 'Pagamento confirmado', detail: `Entrada: ${amount(base.received)}`, time: booking.updated_at });
      }
      for (const cancel of cancellationsResult.data || []) next.push({
        key: `${cancel.booking_id}:cancel`, kind: 'cancel', bookingId: cancel.booking_id,
        title: 'Cancelamento de reserva', name: cancel.customer_name, court: cancel.court_name,
        detail: 'Reserva cancelada', time: cancel.cancelled_at,
        date: cancel.booking_date, hour: Number(cancel.start_hour), duration: Number(cancel.duration),
        total: Number(cancel.booking_amount), received: Number(cancel.payment_received_amount || 0)
      });
      next.sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
      items = next.slice(0, 80);
      if (!initialized) {
        // Ao ativar pela primeira vez, reservas antigas entram no histórico como lidas.
        if (!seen.size) {
          for (const item of items) read.add(item.key);
          persist('read', read);
        }
        initialized = true;
      } else {
        const incoming = items.filter((item) => !seen.has(item.key));
        const confirmedPayment = incoming.find((item) => item.kind === 'payment');
        const newAdminBooking = incoming.find((item) => item.kind === 'booking' && item.status === 'confirmed');
        if (confirmedPayment || newAdminBooking) showToast(confirmedPayment || newAdminBooking);
      }
      for (const item of items) seen.add(item.key);
      persist('seen', seen);
      render();
    } catch (error) {
      console.error('Não foi possível atualizar notificações', error);
    } finally {
      refreshInFlight = false;
      if (refreshRequested) { refreshRequested = false; refresh(); }
    }
  }

  bell.addEventListener('click', () => {
    const opening = panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !opening);
    bell.setAttribute('aria-expanded', String(opening));
    if (opening) refresh();
  });
  readAll.addEventListener('click', () => {
    for (const item of items) read.add(item.key);
    persist('read', read);
    render();
  });
  list.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-notification]');
    if (!button) return;
    const item = items.find((entry) => entry.key === button.dataset.notification);
    if (!item) return;
    read.add(item.key);
    persist('read', read);
    render();
    closePanel();
    if (item.kind === 'payment') await openFinance();
    else if (item.kind !== 'cancel') await openBooking(item.bookingId, item.date);
    else await openFinance();
  });
  popup.addEventListener('click', async (event) => {
    if (event.target.closest('[data-dismiss]')) hideToast();
    if (event.target.closest('[data-open-finance]')) { hideToast(); await openFinance(); }
    if (event.target.closest('[data-open-booking]')) {
      const id = event.target.closest('[data-open-booking]').dataset.openBooking;
      const item = items.find((entry) => entry.bookingId === id && entry.kind === 'booking');
      hideToast();
      if (item) await openBooking(item.bookingId, item.date);
    }
  });
  document.addEventListener('click', (event) => { if (!anchor.contains(event.target)) closePanel(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closePanel(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && context) refresh(); });

  return { setContext, refresh, reset };
}

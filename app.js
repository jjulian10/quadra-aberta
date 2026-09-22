import { createClient } from '@supabase/supabase-js';
import {
  ARENA_SLUG,
  ARENA_SUPPORT_WHATSAPP,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL
} from './supabase-config.js';

const $ = (selector) => document.querySelector(selector);

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const authFlowType = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('type');
let arena = null;
let arenaCatalog = [];
let activeArenaSlug = '';
let arenaChangeVersion = 0;
let bookingLoadVersion = 0;
let realtimeVersion = 0;
let courts = [];
let hours = [];
const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const today = localDate(new Date());

let day = today;
let view = 'player';
let isAdmin = false;
let filter = 'all';
let selectedId = null;
let profitPeriod = 'day';
let bookingsRealtimeChannel = null;
let realtimeRefreshTimer = null;
let lastPlayerBooking = null;
let paymentPollTimer = null;

let bookings = [];
let scheduleBlocks = [];

const money = (value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const labelDate = (date) => new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
const getBooking = (court, hour, date = day) => bookings.find((booking) => booking.date === date && booking.court === court && hour >= booking.hour && hour < booking.hour + booking.duration);
const getScheduleBlock = (court, hour, date = day) => scheduleBlocks.find((block) =>
  block.date === date &&
  (block.court === null || block.court === court) &&
  (block.fullDay || (hour >= block.hour && hour < block.hour + block.duration))
);

const durationLabel = (duration) => `${duration} hora${duration > 1 ? 's' : ''}`;
const bookingTotal = (booking) => Number(
  booking.amount ?? courts[booking.court].price * booking.duration
);

const mapBooking = (booking, isPublic = false) => ({
  id: booking.id ?? `public-${booking.court_id}-${booking.start_hour}`,
  date: booking.booking_date ?? day,
  court: courts.findIndex((court) => court.id === booking.court_id),
  hour: Number(booking.start_hour),
  duration: Number(booking.duration),
  name: isPublic ? '' : booking.customer_name,
  phone: isPublic ? '' : booking.customer_phone,
  status: booking.status,
  paymentStatus: booking.payment_status ?? 'pending',
  paidAmount: Number(booking.payment_received_amount ?? 0),
  paid: booking.payment_status === 'paid',
  depositAmount: booking.deposit_amount === undefined || booking.deposit_amount === null ? undefined : Number(booking.deposit_amount),
  amount: booking.amount === undefined ? undefined : Number(booking.amount)
});

const mapScheduleBlock = (block, isPublic = false) => ({
  id: block.id ?? `public-block-${block.court_id}-${block.start_hour}`,
  date: block.block_date ?? day,
  court: block.court_id ? courts.findIndex((court) => court.id === block.court_id) : null,
  hour: block.start_hour === null || block.start_hour === undefined ? null : Number(block.start_hour),
  duration: block.duration === null || block.duration === undefined ? null : Number(block.duration),
  fullDay: block.start_hour === null || block.start_hour === undefined,
  reason: isPublic ? '' : (block.reason || '')
});

function arenaInitials(name = 'Arena') {
  const cleaned = name.replace(/^Arena\s+/i, '').trim();
  return (cleaned || name)
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function arenaWhatsappDigits() {
  let digits = String(arena?.whatsapp || ARENA_SUPPORT_WHATSAPP || '').replace(/\D/g, '');
  if (digits && digits.length <= 11) digits = '55' + digits;
  return digits;
}

function formatWhatsapp(phone) {
  const digits = String(phone || '').replace(/\D/g, '').replace(/^55/, '');
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return phone || '';
}

function clearArenaIdentity() {
  arena = null;
  courts = [];
  hours = [];
  bookings = [];
  scheduleBlocks = [];
  selectedId = null;
  filter = 'all';
  lastPlayerBooking = null;
  clearInterval(paymentPollTimer);
  paymentPollTimer = null;

  const select = $('#arenaSelect');
  if (select) select.value = '';

  if ($('#arenaAvatar')) $('#arenaAvatar').textContent = '•';
  if ($('#arenaCity')) $('#arenaCity').textContent = 'Selecione uma arena';
  if ($('#breadcrumbArena')) $('#breadcrumbArena').textContent = 'Selecione uma arena';
  if ($('#loginIntro')) $('#loginIntro').textContent = 'Selecione uma arena para acessar a administração.';
  if ($('#bookingArenaEyebrow')) $('#bookingArenaEyebrow').textContent = 'ARENA';

  const footer = $('#arenaFooterContact');
  if (footer) footer.hidden = true;
}

function renderArenaIdentity() {
  if (!arena) {
    clearArenaIdentity();
    return;
  }

  const arenaName = arena.name || 'Arena';
  const city = arena.city || 'Porto Velho, RO';
  const select = $('#arenaSelect');
  if (select) select.value = arena.slug;

  if ($('#arenaAvatar')) $('#arenaAvatar').textContent = arenaInitials(arenaName);
  if ($('#arenaCity')) $('#arenaCity').textContent = city;

  const address = $('#arenaAddress');
  if (address) {
    address.textContent = arena.address || city;
    address.hidden = false;
  }

  const phoneLink = $('#arenaPhone');
  const whatsappDigits = arenaWhatsappDigits();
  if (phoneLink) {
    phoneLink.hidden = !whatsappDigits;
    if (whatsappDigits) {
      phoneLink.href = `https://wa.me/${whatsappDigits}`;
      phoneLink.textContent = `${formatWhatsapp(arena.whatsapp || whatsappDigits)} · WhatsApp`;
    }
  }

  const footer = $('#arenaFooterContact');
  if (footer) footer.hidden = false;

  if ($('#breadcrumbArena')) $('#breadcrumbArena').textContent = arenaName;
  if ($('#loginIntro')) $('#loginIntro').textContent = `Acesse a agenda, as solicitações e o dashboard financeiro da ${arenaName}.`;
  if ($('#bookingArenaEyebrow')) $('#bookingArenaEyebrow').textContent = arenaName.toUpperCase();
}

async function loadArenaCatalog() {
  const { data, error } = await supabase
    .from('arenas')
    .select('slug, name, city, address, whatsapp')
    .eq('active', true);

  if (error) throw error;

  const priority = ['arena-vila', 'arena-elsinho', 'arena-matrix'];
  arenaCatalog = (data || []).sort((a, b) => {
    const ai = priority.indexOf(a.slug);
    const bi = priority.indexOf(b.slug);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    return a.name.localeCompare(b.name, 'pt-BR');
  });

  const select = $('#arenaSelect');
  if (select) {
    select.innerHTML = '<option value="">Selecione uma arena</option>' + arenaCatalog
      .map((item) => `<option value="${esc(item.slug)}">${esc(item.name)}</option>`)
      .join('');
    select.value = activeArenaSlug || '';
  }
}

function populateCourtSelects() {
  filter = 'all';

  $('#bookingCourt').innerHTML = courts
    .map((court, index) => `<option value="${index}">${esc(court.name)} · ${esc(court.sport)}</option>`)
    .join('');

  $('#courtFilter').innerHTML = '<option value="all">Todas as quadras</option>' + courts
    .map((court, index) => `<option value="${index}">${esc(court.name)} · ${esc(court.sport)}</option>`)
    .join('');

  $('#blockCourt').innerHTML = '<option value="all">Todas as quadras</option>' + courts
    .map((court, index) => `<option value="${index}">${esc(court.name)} · ${esc(court.sport)}</option>`)
    .join('');
}

async function loadArena(targetSlug = activeArenaSlug, changeVersion = arenaChangeVersion) {
  const { data: arenaData, error: arenaError } = await supabase
    .from('arenas')
    .select('id, slug, name, city, timezone, address, whatsapp')
    .eq('slug', targetSlug)
    .eq('active', true)
    .single();

  if (arenaError) throw arenaError;
  if (changeVersion !== arenaChangeVersion || targetSlug !== activeArenaSlug) return false;

  const { data: courtData, error: courtError } = await supabase
    .from('courts')
    .select('id, name, sport, hourly_price, opening_hour, closing_hour, sort_order')
    .eq('arena_id', arenaData.id)
    .eq('active', true)
    .order('sort_order');

  if (courtError) throw courtError;
  if (changeVersion !== arenaChangeVersion || targetSlug !== activeArenaSlug) return false;
  if (!courtData?.length) throw new Error('Esta arena ainda não possui quadras ativas.');

  arena = arenaData;
  courts = courtData.map((court) => ({
    id: court.id,
    name: court.name,
    sport: court.sport,
    price: Number(court.hourly_price),
    openingHour: Number(court.opening_hour),
    closingHour: Number(court.closing_hour)
  }));

  const openingHour = Math.min(...courts.map((court) => court.openingHour));
  const closingHour = Math.max(...courts.map((court) => court.closingHour));
  hours = Array.from(
    { length: closingHour - openingHour },
    (_, index) => openingHour + index
  );

  renderArenaIdentity();
  return true;
}

async function hasAdminAccess(userId) {
  if (!arena || !userId) return false;

  const { data, error } = await supabase
    .from('arena_admins')
    .select('role')
    .eq('arena_id', arena.id)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

async function restoreAdminSession() {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) return;

  isAdmin = await hasAdminAccess(data.user.id);

  if (!isAdmin) {
    await supabase.auth.signOut();
  }
}

async function loadBookings() {
  if (!arena) return false;

  const requestVersion = ++bookingLoadVersion;
  const arenaSnapshot = { id: arena.id, slug: arena.slug };
  const daySnapshot = day;
  const adminSnapshot = isAdmin;
  const stillCurrent = () =>
    requestVersion === bookingLoadVersion &&
    arena?.id === arenaSnapshot.id &&
    arena?.slug === arenaSnapshot.slug &&
    day === daySnapshot &&
    isAdmin === adminSnapshot;

  if (adminSnapshot) {
    const reference = new Date(daySnapshot + 'T12:00:00');
    const firstDate = new Date(reference);
    firstDate.setDate(firstDate.getDate() - 29);

    const [bookingResult, blockResult] = await Promise.all([
      supabase
        .from('bookings')
        .select('id, booking_date, court_id, start_hour, duration, customer_name, customer_phone, status, payment_status, amount, deposit_amount, payment_received_amount')
        .eq('arena_id', arenaSnapshot.id)
        .gte('booking_date', localDate(firstDate))
        .lte('booking_date', daySnapshot)
        .in('status', ['pending', 'confirmed'])
        .order('start_hour'),
      supabase
        .from('schedule_blocks')
        .select('id, block_date, court_id, start_hour, duration, reason')
        .eq('arena_id', arenaSnapshot.id)
        .eq('block_date', daySnapshot)
        .order('start_hour', { nullsFirst: true })
    ]);

    if (bookingResult.error) throw bookingResult.error;
    if (blockResult.error) throw blockResult.error;
    if (!stillCurrent()) return false;

    bookings = bookingResult.data.map((booking) => mapBooking(booking));
    scheduleBlocks = blockResult.data.map((block) => mapScheduleBlock(block));
    return true;
  }

  const { data, error } = await supabase.rpc('get_public_schedule_v2', {
    target_arena_slug: arenaSnapshot.slug,
    target_date: daySnapshot
  });

  if (error) throw error;
  if (!stillCurrent()) return false;

  bookings = data.filter((entry) => entry.entry_type === 'booking').map((booking) => mapBooking(booking, true));
  scheduleBlocks = data.filter((entry) => entry.entry_type === 'block').map((block) => mapScheduleBlock(block, true));
  return true;
}

async function refreshBookings(showError = true) {
  try {
    const updated = await loadBookings();
    if (updated) render();
  } catch (error) {
    console.error(error);
    if (showError) toast('Não foi possível atualizar a agenda. Tente novamente.');
  }
}

async function syncBookingsRealtime() {
  const channelVersion = ++realtimeVersion;

  if (bookingsRealtimeChannel) {
    const previousChannel = bookingsRealtimeChannel;
    bookingsRealtimeChannel = null;
    await supabase.removeChannel(previousChannel);
  }

  if (!arena || channelVersion !== realtimeVersion) return;

  const arenaId = arena.id;
  const scheduleRefresh = () => {
    if (channelVersion !== realtimeVersion || arena?.id !== arenaId) return;
    clearTimeout(realtimeRefreshTimer);
    realtimeRefreshTimer = setTimeout(() => {
      if (channelVersion !== realtimeVersion || arena?.id !== arenaId) return;
      refreshBookings(false);
    }, 120);
  };

  if (!isAdmin) {
    bookingsRealtimeChannel = supabase
      .channel(`public-schedule-${arenaId}-${channelVersion}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'schedule_change_events',
          filter: `arena_id=eq.${arenaId}`
        },
        (payload) => {
          if (channelVersion !== realtimeVersion || arena?.id !== arenaId) return;
          const changedDate = payload.new?.schedule_date || payload.old?.schedule_date;
          if (changedDate && changedDate !== day) return;
          scheduleRefresh();
        }
      )
      .subscribe((status) => {
        if (channelVersion !== realtimeVersion || arena?.id !== arenaId) return;
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`Falha na atualização em tempo real: ${status}`);
        }
      });
    return;
  }

  bookingsRealtimeChannel = supabase
    .channel(`admin-bookings-${arenaId}-${channelVersion}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bookings',
        filter: `arena_id=eq.${arenaId}`
      },
      scheduleRefresh
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'schedule_blocks',
        filter: `arena_id=eq.${arenaId}`
      },
      scheduleRefresh
    )
    .subscribe((status) => {
      if (channelVersion !== realtimeVersion || arena?.id !== arenaId) return;
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error(`Falha na atualização em tempo real: ${status}`);
      }
    });
}

function isAvailable(court, hour, duration) {
  const selectedCourt = courts[court];

  return Boolean(selectedCourt) && [1, 2, 3].includes(duration) &&
    hours.includes(hour) &&
    hour >= selectedCourt.openingHour &&
    hour + duration <= selectedCourt.closingHour &&
    Array.from({ length: duration }, (_, offset) => hour + offset)
      .every((slot) => hours.includes(slot) && !getBooking(court, slot) && !getScheduleBlock(court, slot));
}

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').style.display = 'block';
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { $('#toast').style.display = 'none'; }, 4200);
}

function syncAccessControls() {
  const adminNav = document.querySelector('[data-view="admin"]');
  const playerNav = document.querySelector('[data-view="player"]');
  adminNav.classList.toggle('hidden', !isAdmin);
  document.querySelector('[data-view="finance"]').classList.toggle('hidden', !isAdmin);
  playerNav.classList.toggle('hidden', isAdmin);
  $('#adminLogin').classList.toggle('hidden', isAdmin);
  $('#adminLogout').classList.toggle('hidden', !isAdmin);
  $('#blockSchedule').classList.toggle('hidden', !isAdmin || view !== 'admin');
}

function ensureEnhancements() {
  const customer = $('#customer');
  if (customer && !$('#customerPhone')) {
    const phoneLabel = document.createElement('label');
    phoneLabel.innerHTML = 'Celular do responsável<input name="phone" id="customerPhone" required maxlength="20" autocomplete="tel" inputmode="tel">';
    customer.closest('label').after(phoneLabel);
  }
  if (customer && !$('#customerEmail')) {
    const emailLabel = document.createElement('label');
    emailLabel.id = 'customerEmailLabel';
    emailLabel.innerHTML = 'E-mail para o pagamento<input name="email" id="customerEmail" type="email" required maxlength="120" autocomplete="email">';
    $('#customerPhone').closest('label').after(emailLabel);
  }
  if (!$('#profitPanel')) {
    const panel = document.createElement('section');
    panel.id = 'profitPanel';
    panel.style.cssText = 'margin:0 0 27px;background:#fff;border:1px solid #e1e7e3;border-radius:13px;padding:22px 25px;';
    $('#stats').after(panel);
  }
}

function periodBookings(period) {
  const reference = new Date(day + 'T12:00:00');
  return bookings.filter((booking) => {
    const bookingDate = new Date(booking.date + 'T12:00:00');
    const difference = Math.round((reference - bookingDate) / 86400000);
    if (period === 'day') return difference === 0;
    if (period === 'week') return difference >= 0 && difference < 7;
    return difference >= 0 && difference < 30;
  });
}

function renderProfitPanel(list) {
  const panel = $('#profitPanel');
  if (!panel) return;
  if (view !== 'finance' || !isAdmin) { panel.style.display = 'none'; panel.innerHTML = ''; return; }

  panel.style.display = 'block';

  const fullyPaid = list.filter((booking) => booking.paid);
  const partial = list.filter((booking) => booking.paymentStatus === 'partial' || (booking.paidAmount > 0 && !booking.paid));
  const unpaid = list.filter((booking) => booking.paidAmount <= 0);
  const received = list.reduce((sum, booking) => sum + Number(booking.paidAmount || 0), 0);
  const expected = list.reduce((sum, booking) => sum + bookingTotal(booking), 0);
  const periodLabel = { day: 'Data selecionada', week: 'Últimos 7 dias', month: 'Últimos 30 dias' }[profitPeriod];

  const byCourt = courts.map((court, index) => ({
    name: court.name,
    value: list
      .filter((booking) => booking.court === index)
      .reduce((sum, booking) => sum + Number(booking.paidAmount || 0), 0)
  }));

  const maxCourt = Math.max(...byCourt.map((item) => item.value), 1);
  const receivedPercent = expected ? Math.min(100, Math.round(received / expected * 100)) : 0;

  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:15px;flex-wrap:wrap">
      <div><p class="eyebrow" style="margin-bottom:7px">DESEMPENHO FINANCEIRO</p><h2 style="margin:0">Dashboard financeiro</h2><p style="font-size:13px;margin:5px 0 0">Mostra somente valores realmente recebidos; o restante permanece como saldo a receber.</p><label>Data de referência<input type="date" id="financeDate" value="${day}"></label></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">${['day','week','month'].map((period) => `<button type="button" data-profit-period="${period}" style="border:1px solid #dfe7df;border-radius:7px;background:${period === profitPeriod ? '#194d3e' : '#fff'};color:${period === profitPeriod ? '#fff' : '#17362f'};padding:8px 12px;font-size:12px">${{ day: 'Dia', week: 'Semana', month: 'Mês' }[period]}</button>`).join('')}</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:22px;margin-top:20px;align-items:center">
      <div style="display:flex;align-items:center;gap:18px">
        <div style="width:132px;height:132px;border-radius:50%;background:conic-gradient(#194d3e ${receivedPercent}%,#e8eee8 0);display:grid;place-items:center;flex-shrink:0">
          <div style="width:92px;height:92px;border-radius:50%;background:#fff;display:grid;place-items:center;text-align:center"><strong style="font-size:22px">${receivedPercent}%</strong><small style="font-size:10px;color:#6d7c77">recebido</small></div>
        </div>
        <div><small>Recebido · ${periodLabel}</small><strong style="display:block;font-size:26px;margin:6px 0">${money(received)}</strong><span style="font-size:12px;color:#6d7c77">de ${money(expected)} previstos</span></div>
      </div>
      <div><strong style="font-size:13px">Recebido por quadra</strong><div style="display:grid;gap:11px;margin-top:13px">${byCourt.map((item) => `<div><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px"><span>${esc(item.name)}</span><strong>${money(item.value)}</strong></div><div style="height:8px;background:#edf2ed;border-radius:10px;overflow:hidden"><div style="height:100%;width:${Math.round(item.value / maxCourt * 100)}%;background:#6a987b;border-radius:10px"></div></div></div>`).join('')}</div></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-top:20px">
      <div style="background:#f5f7f5;border-radius:9px;padding:14px"><small>Previsto total</small><strong style="display:block;font-size:22px;margin-top:7px">${money(expected)}</strong></div>
      <div style="background:#eaf3df;border-radius:9px;padding:14px"><small>Recebido</small><strong style="display:block;font-size:22px;margin-top:7px">${money(received)}</strong></div>
      <div style="background:#f5f7f5;border-radius:9px;padding:14px"><small>Quitadas</small><strong style="display:block;font-size:22px;margin-top:7px">${fullyPaid.length}</strong></div>
      <div style="background:#fff4d8;border-radius:9px;padding:14px"><small>Pagamento parcial</small><strong style="display:block;font-size:22px;margin-top:7px">${partial.length}</strong></div>
      <div style="background:#fcf2de;border-radius:9px;padding:14px"><small>Sem pagamento</small><strong style="display:block;font-size:22px;margin-top:7px">${unpaid.length}</strong></div>
    </div>`;

  panel.querySelectorAll('[data-profit-period]').forEach((button) => {
    button.onclick = () => { profitPeriod = button.dataset.profitPeriod; render(); };
  });

  $('#financeDate').onchange = async (event) => {
    if (event.target.value) {
      day = event.target.value;
      await refreshBookings();
    }
  };
}

function setView(nextView) {
  if (!['admin', 'finance', 'player'].includes(nextView)) return;
  if (nextView !== 'player' && !isAdmin) return;
  if (nextView === 'player' && isAdmin) return;
  view = nextView;
  render();
}

function blockedHoursForDay() {
  return scheduleBlocks.reduce((total, block) => {
    const affectedCourts = block.court === null
      ? courts
      : [courts[block.court]].filter(Boolean);

    return total + affectedCourts.reduce((sum, court) => {
      if (block.fullDay) return sum + court.closingHour - court.openingHour;
      const start = Math.max(block.hour, court.openingHour);
      const end = Math.min(block.hour + block.duration, court.closingHour);
      return sum + Math.max(end - start, 0);
    }, 0);
  }, 0);
}

function renderScheduleBlocks() {
  const panel = $('#blockPanel');
  const adminAgenda = isAdmin && view === 'admin';
  panel.classList.toggle('hidden', !adminAgenda);
  if (!adminAgenda) return;

  $('#blockCount').textContent = scheduleBlocks.length;
  $('#blockList').innerHTML = scheduleBlocks.length
    ? scheduleBlocks.map((block) => {
      const courtLabel = block.court === null ? 'Todas as quadras' : courts[block.court]?.name || 'Quadra';
      const periodLabel = block.fullDay ? 'Dia inteiro' : `${block.hour}:00–${block.hour + block.duration}:00`;
      const reason = block.reason ? `<small class="block-reason">“${esc(block.reason)}”</small>` : '<small>Sem observação</small>';
      return `<div class="block-row"><span class="block-icon">⊘</span><div class="block-info"><strong>${esc(courtLabel)} · ${periodLabel}</strong>${reason}</div><button type="button" data-remove-block="${block.id}">Desbloquear</button></div>`;
    }).join('')
    : '<div class="empty">Nenhum bloqueio cadastrado nesta data.</div>';
}

function render() {
  ensureEnhancements();
  syncAccessControls();
  $('#date').value = day;

  if (!arena) {
    view = 'player';
    document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === 'player'));
    $('#crumb').textContent = 'Visão do jogador';
    $('#eyebrow').textContent = 'AGENDA DE QUADRAS';
    $('#title').textContent = 'Selecione uma arena para começar.';
    $('#subtitle').textContent = 'A agenda será carregada somente depois que você escolher uma arena no menu lateral.';
    $('#workspaceTitle').textContent = 'Agenda de quadras';
    $('#workspaceSubtitle').textContent = 'Escolha uma arena para visualizar os horários disponíveis.';
    $('#stats').innerHTML = '';
    $('#stats').classList.remove('hidden');
    document.querySelector('.workspace').classList.remove('hidden');
    $('#schedule').style.removeProperty('--cols');
    $('#schedule').innerHTML = '<div class="empty arena-empty-state">Nenhuma arena carregada. Selecione uma arena para visualizar a agenda.</div>';
    $('#dateCaption').textContent = '';
    $('#newBooking').classList.add('hidden');
    $('#blockSchedule').classList.add('hidden');
    $('#bottom').hidden = true;
    $('#bottom').style.display = 'none';
    $('#blockPanel').classList.add('hidden');

    const profitPanel = $('#profitPanel');
    if (profitPanel) {
      profitPanel.style.display = 'none';
      profitPanel.innerHTML = '';
    }

    $('#courtFilter').innerHTML = '<option value="all">Todas as quadras</option>';
    $('#courtFilter').disabled = true;
    $('#date').disabled = true;
    $('#prevDay').disabled = true;
    $('#nextDay').disabled = true;
    $('#today').disabled = true;
    return;
  }

  $('#courtFilter').disabled = false;
  $('#date').disabled = false;
  $('#prevDay').disabled = false;
  $('#nextDay').disabled = false;
  $('#today').disabled = false;
  document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  const admin = view === 'admin';
  $('#crumb').textContent = admin ? 'Agenda e reservas' : 'Visão do jogador';
  $('#eyebrow').textContent = admin ? 'CONTROLE DA ARENA' : `${arena?.name?.toUpperCase() || 'ARENA'} · ${(arena?.city || 'Porto Velho, RO').toUpperCase()}`;
  $('#title').textContent = admin ? 'Bom jogo começa com uma boa agenda.' : 'Seu próximo jogo começa aqui.';
  $('#subtitle').textContent = admin ? 'Todos os horários. Cada reserva. Tudo no seu lugar.' : 'Escolha a quadra, encontre seu horário e solicite uma reserva.';
  $('#newBooking').textContent = admin ? '＋ Nova reserva' : '＋ Solicitar reserva';
  $('#workspaceTitle').textContent = admin ? 'Agenda de quadras' : 'Encontre seu horário';
  $('#workspaceSubtitle').textContent = admin ? 'Selecione um horário para reservar ou ver os detalhes.' : 'Informe seus dados para confirmar o horário.';
  const list = bookings.filter((booking) => booking.date === day);
  const confirmed = list.filter((booking) => booking.status === 'confirmed');
  const pending = list.filter((booking) => booking.status === 'pending');
  const occupiedHours = list.reduce((sum, booking) => sum + booking.duration, 0);
  const blockedHours = blockedHoursForDay();
  const totalHours = courts.reduce(
    (sum, court) => sum + court.closingHour - court.openingHour,
    0
  );
  const startingPrice = Math.min(...courts.map((court) => court.price));
  $('#stats').innerHTML = (admin
    ? [['Reservas do dia', list.length, 'Confirmadas e aguardando', '▦'], ['Ocupação', Math.round((occupiedHours + blockedHours) / totalHours * 100) + '%', `${blockedHours}h bloqueadas nesta data`, '◷'], ['Recebido', money(list.reduce((sum, booking) => sum + Number(booking.paidAmount || 0), 0)), 'Valor efetivamente recebido', '↗'], ['A confirmar', pending.length, 'Solicitações aguardando você', '◌']]
    : [['Quadras', courts.length, `${courts.length} espaços para jogar`, '▦'], ['Reserva', 'Até 3 horas', 'Escolha a duração', '◷'], ['A partir de', money(startingPrice), 'Por quadra / hora', '↗'], ['Horários livres', Math.max(totalHours - occupiedHours - blockedHours, 0), 'Na data selecionada', '◌']])
    .map((stat, index) => `<div class="stat ${index === 2 ? 'featured' : ''}"><div class="stat-label">${stat[0]}<span class="stat-symbol" aria-hidden="true">${stat[3]}</span></div><strong>${stat[1]}</strong><small>${stat[2]}</small></div>`).join('');
  renderProfitPanel(periodBookings(profitPeriod));

  const columns = courts.map((court, index) => ({ ...court, index })).filter((court) => filter === 'all' || String(court.index) === filter);
  $('#schedule').style.setProperty('--cols', columns.length);
  $('#schedule').innerHTML = `<div class="grid-head"><span></span>${columns.map((court) => `<div class="court-head"><strong>${esc(court.name)}</strong><small>${esc(court.sport)} · ${money(court.price)}/h</small></div>`).join('')}</div>` +
    hours.map((hour) => `<div class="time-row"><div class="hour">${hour}:00</div>${columns.map((court) => {
      const booking = getBooking(court.index, hour);
      const block = getScheduleBlock(court.index, hour);
      if (block) {
        const adminLabel = block.reason || (block.fullDay ? 'Dia bloqueado' : 'Horário bloqueado');
        return `<button class="slot schedule-blocked ${!admin ? 'blocked' : ''}" data-court="${court.index}" data-hour="${hour}" data-block="${block.id}" ${!admin ? 'disabled' : ''}><strong>${admin ? esc(adminLabel) : 'Indisponível'}</strong><small>${admin ? 'Bloqueado pelo administrador' : 'Horário ocupado'}</small></button>`;
      }
      const label = booking ? (admin ? esc(booking.name) : 'Indisponível') : '+ Reservar';
      const detail = booking ? (admin ? (booking.status === 'pending' ? 'A confirmar' : booking.paid ? 'Confirmada · Pago' : booking.paidAmount > 0 ? 'Confirmada · Parcial' : 'Confirmada · A pagar') : 'Horário ocupado') : 'Disponível';
      return `<button class="slot ${booking ? (booking.status === 'pending' ? 'waiting' : 'booked') : ''} ${booking && !admin ? 'blocked' : ''}" data-court="${court.index}" data-hour="${hour}" ${booking && !admin ? 'disabled' : ''}><strong>${label}</strong><small>${detail}</small></button>`;
    }).join('')}</div>`).join('');
  $('#dateCaption').textContent = labelDate(day);
  $('#bottom').hidden = !admin;
  $('#bottom').style.display = admin ? 'grid' : 'none';
  $('#pendingCount').textContent = pending.length;
  $('#requests').innerHTML = pending.length
    ? pending.map((booking) => `<div class="request-row"><span class="avatar">${esc(booking.name.split(' ').map((part) => part[0]).slice(0, 2).join(''))}</span><div><strong>${esc(booking.name)}</strong><small>${esc(courts[booking.court].name)} · ${booking.hour}:00–${booking.hour + booking.duration}:00 · ${money(bookingTotal(booking))}</small></div><button data-detail="${booking.id}">Ver solicitação</button></div>`).join('')
    : '<div class="empty">Tudo em dia. Nenhuma solicitação pendente nesta data.</div>';
  if (!admin) $('#requests').innerHTML = '';
  renderScheduleBlocks();
  const finance = view === 'finance' && isAdmin;
  document.querySelector('.workspace').classList.toggle('hidden', finance);
  $('#stats').classList.toggle('hidden', finance);
  $('#newBooking').classList.toggle('hidden', finance);
  if (finance) {
    $('#crumb').textContent = 'Financeiro';
    $('#eyebrow').textContent = 'CONTROLE DA ARENA';
    $('#title').textContent = 'Seu financeiro, em um só lugar.';
    $('#subtitle').textContent = 'Acompanhe receitas e pagamentos por dia, semana ou mês.';
  }
}

function updateHours(preferred) {
  const court = Number($('#bookingCourt').value);
  const duration = Number($('#bookingDuration').value);
  const free = hours.filter((hour) => isAvailable(court, hour, duration));
  $('#bookingHour').innerHTML = free.length ? free.map((hour) => `<option value="${hour}">${hour}:00 – ${hour + duration}:00</option>`).join('') : '<option value="">Sem horários livres</option>';
  if (free.includes(preferred)) $('#bookingHour').value = String(preferred);
  $('#price').textContent = money(courts[court].price * duration);
  const label = document.querySelector('.price-line span');
  if (label) label.textContent = `Total · ${duration} hora${duration > 1 ? 's' : ''}`;
  $('#submitBooking').disabled = !free.length;
}

function openBooking(court = 0, hour, duration = 1) {
  clearInterval(paymentPollTimer);
  selectedId = null;
  $('#bookingForm').reset();
  $('#formError').textContent = '';
  $('#formFields').hidden = false;
  $('#customerEmailLabel').classList.toggle('hidden', view === 'admin');
  $('#customerEmail').required = view !== 'admin';
  $('#bookingNote').textContent = view === 'admin'
    ? 'A reserva será adicionada diretamente à agenda.'
    : 'O horário será confirmado automaticamente após o pagamento do sinal via Pix.';
  $('#detailContent').innerHTML = '';
  $('#dialogTitle').textContent = view === 'admin' ? 'Nova reserva' : 'Reservar horário';
  $('#dialogInfo').textContent = `${labelDate(day)} · ${arena.name}`;
  $('#bookingCourt').value = String(court);
  $('#bookingDuration').value = String(duration);
  $('#dialogActions').innerHTML = `<button class="primary" type="submit" id="submitBooking">${view === 'admin' ? 'Confirmar reserva' : 'Gerar Pix de R$ 0,01'}</button>`;
  updateHours(hour);
  $('#bookingDialog').showModal();
}

function updateBlockForm() {
  const fullDay = $('#blockType').value === 'day';
  const duration = Number($('#blockDuration').value);
  const selectedCourt = $('#blockCourt').value;
  const closingHour = selectedCourt === 'all'
    ? Math.max(...courts.map((court) => court.closingHour))
    : courts[Number(selectedCourt)]?.closingHour;
  const validHours = hours.filter((hour) => hour + duration <= closingHour);

  $('#blockTimeFields').classList.toggle('hidden', fullDay);
  $('#blockHour').required = !fullDay;
  $('#blockDuration').required = !fullDay;
  $('#blockHour').innerHTML = validHours.map((hour) => `<option value="${hour}">${hour}:00</option>`).join('');
}

function openBlockDialog(court = filter === 'all' ? 'all' : filter, hour) {
  $('#blockForm').reset();
  $('#blockError').textContent = '';
  $('#blockDialogInfo').textContent = `${labelDate(day)} · ${arena.name}`;
  $('#blockCourt').value = String(court);
  $('#blockType').value = 'time';
  updateBlockForm();
  if (hours.includes(Number(hour))) $('#blockHour').value = String(hour);
  $('#blockDialog').showModal();
}

function openDetail(id) {
  const booking = bookings.find((item) => item.id === id);
  if (!booking || view !== 'admin') return;

  selectedId = id;
  $('#formError').textContent = '';
  $('#formFields').hidden = true;
  $('#dialogTitle').textContent = booking.status === 'pending' ? 'Solicitação de reserva' : 'Detalhes da reserva';
  $('#dialogInfo').textContent = `${labelDate(booking.date)} · ${booking.hour}:00–${booking.hour + booking.duration}:00`;

  const totalAmount = bookingTotal(booking);
  const receivedAmount = Number(booking.paidAmount || 0);
  const remainingAmount = Math.max(totalAmount - receivedAmount, 0);
  const paymentLabel = booking.paid
    ? `Pago integral · ${money(receivedAmount)}`
    : receivedAmount > 0
      ? `Parcial · ${money(receivedAmount)} de ${money(totalAmount)} · Saldo ${money(remainingAmount)}`
      : 'Pendente · nenhum valor recebido';

  $('#detailContent').innerHTML = `<p><strong>${esc(booking.name)}</strong></p><p>Celular: ${esc(booking.phone || 'Não informado')}</p><p>${esc(courts[booking.court].name)} · ${esc(courts[booking.court].sport)} · ${durationLabel(booking.duration)}</p><p>Status: ${booking.status === 'pending' ? 'Aguardando confirmação' : 'Confirmada'}<br>Pagamento: ${paymentLabel}</p>`;
  $('#price').textContent = money(totalAmount);
  document.querySelector('.price-line span').textContent = `Total · ${durationLabel(booking.duration)}`;

  const paymentAction = !booking.paid && booking.status !== 'pending'
    ? `<button type="button" class="primary" data-action="pay">${receivedAmount > 0 ? 'Registrar saldo como pago' : 'Registrar pagamento integral'}</button>`
    : '';

  $('#dialogActions').innerHTML = (booking.status === 'pending'
    ? '<button type="button" class="primary" data-action="confirm">Confirmar reserva</button>'
    : paymentAction) + '<button type="button" class="secondary danger" data-action="cancel">Cancelar reserva</button>';

  if (!$('#bookingDialog').open) $('#bookingDialog').showModal();
}

function dispararMensagem(booking) {
  const digits = (booking.phone || '').replace(/\D/g, '');
  if (digits.length < 10) return;
  const text = `Olá, ${booking.name}! Sua reserva foi confirmada na ${arena.name}.\n\nQuadra: ${courts[booking.court].name} - ${courts[booking.court].sport}\nData: ${labelDate(booking.date)}\nHorário: ${booking.hour}:00 às ${booking.hour + booking.duration}:00\nDuração: ${durationLabel(booking.duration)}\n\nAguardamos você. Em caso de alteração, entre em contato com a arena.`;
  const whatsappUrl = 'https://wa.me/55' + digits + '?text=' + encodeURIComponent(text);
  window.open(whatsappUrl, '_blank', 'noopener');
}

function openArenaSupport(booking = lastPlayerBooking) {
  const bookingContext = booking
    ? `\n\nReserva: ${labelDate(booking.date)}, das ${booking.hour}:00 às ${booking.hour + booking.duration}:00, ${courts[booking.court]?.name || 'quadra selecionada'}.`
    : '';
  const message = `Olá! Preciso de suporte com uma reserva no Quadra Aberta.${bookingContext}`;
  const whatsapp = arenaWhatsappDigits();
  if (!whatsapp) return;
  window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
}

function showConfirmation(booking) {
  if (booking.arenaSlug && booking.arenaSlug !== arena?.slug) return;
  clearInterval(paymentPollTimer);
  lastPlayerBooking = booking;
  $('#formFields').hidden = true;
  $('#dialogTitle').textContent = 'Sinal confirmado!';
  $('#dialogInfo').textContent = `${labelDate(booking.date)} · ${booking.hour}:00–${booking.hour + booking.duration}:00`;

  const totalAmount = bookingTotal(booking);
  const receivedAmount = Number(booking.paidAmount ?? booking.depositAmount ?? 0);
  const remainingAmount = Math.max(totalAmount - receivedAmount, 0);

  $('#detailContent').innerHTML = `<div style="background:#eaf3df;border-radius:10px;padding:16px;margin:12px 0 18px"><strong>Reserva confirmada para ${esc(booking.name)}.</strong><p style="margin:8px 0 0;font-size:13px;color:#537047">Recebemos o sinal via Pix e o horário já está garantido na agenda da arena.</p></div><p><strong>Informações do pagamento</strong></p><p>• Valor total da reserva: ${money(totalAmount)}.<br>• Valor recebido: ${money(receivedAmount)}.<br>• Saldo restante: ${money(remainingAmount)}.<br>• Situação: ${remainingAmount > 0 ? 'Pagamento parcial' : 'Pagamento integral'}.</p>`;
  $('#price').textContent = money(totalAmount);
  document.querySelector('.price-line span').textContent = `Total · ${durationLabel(booking.duration)}`;
  $('#dialogActions').innerHTML = '<button type="button" class="primary" data-action="close-confirmation">Concluir</button><button type="button" class="secondary" data-action="support">Suporte da arena</button>';

  if (!$('#bookingDialog').open) $('#bookingDialog').showModal();
}

async function checkPaymentStatus(booking) {
  const bookingArenaSlug = booking.arenaSlug || arena?.slug;
  const { data, error } = await supabase.functions.invoke('check-pix-payment', {
    body: {
      booking_id: booking.id,
      payment_token: booking.paymentToken
    }
  });

  if (error || !data || bookingArenaSlug !== arena?.slug) return;

  const state = data;
  if (['partial', 'paid'].includes(state.payment_status) && state.booking_status === 'confirmed') {
    booking.status = 'confirmed';
    booking.paymentStatus = state.payment_status;
    booking.paid = state.payment_status === 'paid';
    booking.paidAmount = Number(state.received_amount ?? booking.depositAmount ?? 0);
    await refreshBookings(false);
    showConfirmation(booking);
  } else if (state.booking_status === 'cancelled') {
    clearInterval(paymentPollTimer);
    $('#formError').textContent = 'O Pix expirou e o horário foi liberado. Feche esta janela e tente novamente.';
  }
}

function showPixPayment(booking) {
  if (booking.arenaSlug && booking.arenaSlug !== arena?.slug) return;
  lastPlayerBooking = booking;
  $('#formFields').hidden = true;
  $('#dialogTitle').textContent = 'Pague o sinal via Pix';
  $('#dialogInfo').textContent = `${labelDate(booking.date)} · ${booking.hour}:00–${booking.hour + booking.duration}:00`;
  const qrImage = booking.qrCodeBase64
    ? `<img class="pix-qr" src="data:image/png;base64,${booking.qrCodeBase64}" alt="QR Code Pix para pagar o sinal">`
    : '';
  const ticketLink = booking.ticketUrl
    ? `<a class="secondary" href="${esc(booking.ticketUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;justify-content:center;text-decoration:none;margin-top:10px">Abrir pagamento no Mercado Pago ↗</a>`
    : '';
  $('#detailContent').innerHTML = `<div class="pix-panel"><h3>Sinal de ${money(booking.depositAmount)}</h3><p>Escaneie o QR Code ou copie o código Pix. A confirmação acontece automaticamente após o pagamento.</p>${qrImage}<div class="pix-code"><input id="pixCopyCode" value="${esc(booking.qrCode)}" readonly aria-label="Código Pix copia e cola"><button type="button" class="secondary" data-action="copy-pix">Copiar Pix</button></div>${ticketLink}<div class="payment-waiting"><span class="payment-dot"></span><span>Aguardando confirmação do pagamento…</span></div></div>`;
  $('#price').textContent = money(booking.depositAmount);
  document.querySelector('.price-line span').textContent = 'Sinal para confirmar o horário';
  $('#bookingNote').textContent = 'O código expira em 30 minutos. O restante do valor é tratado diretamente com a arena.';
  $('#dialogActions').innerHTML = '<button type="button" class="secondary" data-action="support">Suporte da arena</button>';
  if (!$('#bookingDialog').open) $('#bookingDialog').showModal();
  clearInterval(paymentPollTimer);
  paymentPollTimer = setInterval(() => checkPaymentStatus(booking), 3000);
  checkPaymentStatus(booking);
}

$('#bookingForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (selectedId !== null) return;
  const court = Number($('#bookingCourt').value);
  const rawHour = $('#bookingHour').value;
  const hour = Number(rawHour);
  const duration = Number($('#bookingDuration').value);
  const name = $('#customer').value.trim();
  const phone = $('#customerPhone').value.trim();
  const email = $('#customerEmail').value.trim().toLowerCase();
  const available = isAvailable(court, hour, duration);
  if (!name) { $('#formError').textContent = 'Informe o nome do responsável.'; return; }
  if (!phone || phone.replace(/\D/g, '').length < 10) { $('#formError').textContent = 'Informe um celular válido com DDD.'; return; }
  if (!isAdmin && !$('#customerEmail').checkValidity()) { $('#formError').textContent = 'Informe um e-mail válido para gerar o Pix.'; return; }
  if (rawHour === '' || !hours.includes(hour) || !courts[court] || !available) { $('#formError').textContent = 'Este horário não está disponível. Escolha outro.'; return; }

  const submitButton = $('#submitBooking');
  submitButton.disabled = true;
  submitButton.textContent = 'Salvando...';

  try {
    let savedBooking;

    if (isAdmin) {
      const { data, error } = await supabase
        .from('bookings')
        .insert({
          arena_id: arena.id,
          court_id: courts[court].id,
          booking_date: day,
          start_hour: hour,
          duration,
          customer_name: name,
          customer_phone: phone.replace(/\D/g, ''),
          status: 'confirmed',
          payment_status: 'pending',
          amount: courts[court].price * duration
        })
        .select('id, booking_date, court_id, start_hour, duration, customer_name, customer_phone, status, payment_status, amount, deposit_amount, payment_received_amount')
        .single();

      if (error) throw error;
      savedBooking = mapBooking(data);
    } else {
      submitButton.textContent = 'Gerando Pix...';
      const { data, error } = await supabase.functions.invoke('create-pix-payment', {
        body: {
          arena_slug: arena.slug,
          court_id: courts[court].id,
          booking_date: day,
          start_hour: hour,
          duration,
          customer_name: name,
          customer_phone: phone,
          customer_email: email
        }
      });

      if (error) {
        let message = error.message;
        try { message = (await error.context.json()).error || message; } catch {}
        throw new Error(message);
      }
      savedBooking = {
        id: data.booking_id,
        arenaSlug: arena.slug,
        date: day,
        court,
        hour,
        duration,
        name,
        phone,
        status: 'pending',
        paymentStatus: 'pending',
        paidAmount: 0,
        paid: false,
        amount: courts[court].price * duration,
        depositAmount: Number(data.deposit_amount),
        paymentToken: data.payment_token,
        qrCode: data.qr_code,
        qrCodeBase64: data.qr_code_base64,
        ticketUrl: data.ticket_url
      };
    }

    await loadBookings();
    render();

    if (isAdmin) {
      $('#bookingDialog').close();
      toast('Reserva confirmada e salva na agenda.');
    } else {
      showPixPayment(savedBooking);
    }
  } catch (error) {
    console.error(error);
    $('#formError').textContent = error.message || 'Não foi possível salvar a reserva.';
    submitButton.disabled = false;
    submitButton.textContent = isAdmin ? 'Confirmar reserva' : 'Gerar Pix de R$ 0,01';
  }
});

$('#bookingDialog').addEventListener('click', async (event) => {
  const actionButton = event.target.closest('button[data-action]');
  const action = actionButton?.dataset.action;
  const booking = bookings.find((item) => item.id === selectedId);
  if (action === 'close-confirmation') { $('#bookingDialog').close(); return; }
  if (action === 'support') { openArenaSupport(); return; }
  if (action === 'copy-pix') {
    const code = $('#pixCopyCode')?.value;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      actionButton.textContent = 'Copiado!';
      toast('Código Pix copiado.');
    } catch {
      const input = $('#pixCopyCode');
      input.focus();
      input.select();
      input.setSelectionRange(0, code.length);
      let copied = false;
      try { copied = document.execCommand('copy'); } catch {}
      if (copied) {
        actionButton.textContent = 'Copiado!';
        toast('Código Pix copiado.');
      } else {
        toast('Selecione o código e use Copiar no menu do celular ou Ctrl+C no computador.');
      }
    }
    return;
  }
  if (!action || !booking || !isAdmin || view !== 'admin') return;

  let changes;
  let successMessage;

  if (action === 'confirm') {
    changes = { status: 'confirmed' };
    successMessage = 'Reserva confirmada.';
  }

  if (action === 'pay') {
    changes = {
      payment_status: 'paid',
      payment_received_amount: bookingTotal(booking)
    };
    successMessage = 'Pagamento integral registrado.';
  }

  if (action === 'cancel') {
    if (!confirm('Cancelar esta reserva e liberar o horário?')) return;
    changes = { status: 'cancelled' };
    successMessage = 'Reserva cancelada. Horário disponível novamente.';
  }

  if (!changes) return;

  try {
    const { error } = await supabase
      .from('bookings')
      .update(changes)
      .eq('id', booking.id)
      .eq('arena_id', arena.id);

    if (error) throw error;

    if (action === 'confirm') dispararMensagem(booking);
    $('#bookingDialog').close();
    await refreshBookings(false);
    toast(successMessage);
  } catch (error) {
    console.error(error);
    toast('Não foi possível atualizar a reserva.');
  }
});

$('#bookingCourt').addEventListener('change', () => updateHours(Number($('#bookingHour').value)));
$('#bookingDuration').addEventListener('change', () => updateHours(Number($('#bookingHour').value)));
$('#closeDialog').onclick = () => { clearInterval(paymentPollTimer); $('#bookingDialog').close(); };
$('#newBooking').onclick = () => {
  if (!arena) {
    toast('Selecione uma arena antes de solicitar uma reserva.');
    return;
  }
  openBooking(filter === 'all' ? 0 : Number(filter));
};
$('#blockSchedule').onclick = () => openBlockDialog();
$('#closeBlockDialog').onclick = () => $('#blockDialog').close();
$('#blockType').onchange = updateBlockForm;
$('#blockCourt').onchange = updateBlockForm;
$('#blockDuration').onchange = updateBlockForm;

$('#blockForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!isAdmin || view !== 'admin') return;

  const fullDay = $('#blockType').value === 'day';
  const courtValue = $('#blockCourt').value;
  const reason = $('#blockReason').value.trim();
  const submitButton = $('#submitBlock');
  $('#blockError').textContent = '';
  submitButton.disabled = true;
  submitButton.textContent = 'Bloqueando...';

  try {
    const { error } = await supabase.from('schedule_blocks').insert({
      arena_id: arena.id,
      court_id: courtValue === 'all' ? null : courts[Number(courtValue)].id,
      block_date: day,
      start_hour: fullDay ? null : Number($('#blockHour').value),
      duration: fullDay ? null : Number($('#blockDuration').value),
      reason: reason || null
    });

    if (error) throw error;
    $('#blockDialog').close();
    await refreshBookings(false);
    toast(fullDay ? 'Dia bloqueado com sucesso.' : 'Horário bloqueado com sucesso.');
  } catch (error) {
    console.error(error);
    $('#blockError').textContent = error.message?.includes('Existem reservas ativas')
      ? 'Já existe uma reserva ativa nesse período. Cancele a reserva antes de bloquear.'
      : 'Não foi possível criar o bloqueio. Verifique o período e tente novamente.';
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Bloquear agenda';
  }
});

$('#blockList').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-remove-block]');
  if (!button || !isAdmin) return;
  if (!confirm('Desbloquear este período e permitir novas reservas?')) return;

  try {
    const { error } = await supabase
      .from('schedule_blocks')
      .delete()
      .eq('id', button.dataset.removeBlock)
      .eq('arena_id', arena.id);
    if (error) throw error;
    await refreshBookings(false);
    toast('Período desbloqueado.');
  } catch (error) {
    console.error(error);
    toast('Não foi possível remover o bloqueio.');
  }
});
$('#seePlayer').onclick = async () => {
  await supabase.auth.signOut();
  isAdmin = false;
  view = 'player';
  await syncBookingsRealtime();
  await refreshBookings(false);
  window.scrollTo({ top: 0, behavior: 'smooth' });
};
document.querySelectorAll('[data-view]').forEach((button) => {
  button.onclick = () => {
    if (button.dataset.view === 'admin' && !isAdmin) {
      $('#loginDialog').showModal();
      return;
    }
    if (button.dataset.view === 'player' && isAdmin) return;
    setView(button.dataset.view);
  };
});
$('#schedule').addEventListener('click', (event) => {
  const button = event.target.closest('[data-court]');
  if (!button) return;
  const court = Number(button.dataset.court);
  const hour = Number(button.dataset.hour);
  const block = getScheduleBlock(court, hour);
  if (block) {
    toast(block.reason ? `Bloqueado: ${block.reason}` : 'Este período está bloqueado.');
    return;
  }
  const booking = getBooking(court, hour);
  booking ? openDetail(booking.id) : openBooking(court, hour);
});
$('#requests').addEventListener('click', (event) => {
  const button = event.target.closest('[data-detail]');
  if (button) openDetail(button.dataset.detail);
});
$('#courtFilter').onchange = (event) => { filter = event.target.value; render(); };
$('#date').onchange = async (event) => {
  if (event.target.value) {
    day = event.target.value;
    await refreshBookings();
  }
};
async function moveDay(amount) {
  const date = new Date(day + 'T12:00:00');
  date.setDate(date.getDate() + amount);
  day = localDate(date);
  await refreshBookings();
}
$('#prevDay').onclick = () => moveDay(-1);
$('#nextDay').onclick = () => moveDay(1);
$('#today').onclick = async () => {
  day = today;
  await refreshBookings();
};

$('#adminLogin').onclick = () => {
  if (!arena) {
    toast('Selecione uma arena antes de entrar como administrador.');
    return;
  }

  $('#loginError').textContent = '';
  $('#loginForm').reset();
  $('#loginDialog').showModal();
};

$('#closeLogin').onclick = () => $('#loginDialog').close();

$('#forgotPassword').onclick = async () => {
  const email = $('#adminEmail').value.trim().toLowerCase();
  $('#loginError').textContent = '';

  if (!email) {
    $('#loginError').textContent = 'Informe seu e-mail para recuperar a senha.';
    return;
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname
    });

    if (error) throw error;
    toast('Enviamos um link para você criar uma nova senha.');
  } catch (error) {
    console.error(error);
    $('#loginError').textContent = error.message || 'Não foi possível enviar o link de recuperação.';
  }
};

$('#loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = $('#adminEmail').value.trim().toLowerCase();
  const password = $('#adminPassword').value;

  $('#loginError').textContent = '';

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    const allowed = await hasAdminAccess(data.user.id);

    if (!allowed) {
      await supabase.auth.signOut();
      throw new Error('Este usuário não possui acesso à administração da arena.');
    }

    isAdmin = true;
    view = 'admin';
    await loadBookings();
    await syncBookingsRealtime();
    $('#loginDialog').close();
    render();
    toast('Acesso administrativo iniciado.');
  } catch (error) {
    console.error(error);
    $('#loginError').textContent = error.message || 'E-mail ou senha inválidos.';
  }
});

$('#adminLogout').onclick = async () => {
  await supabase.auth.signOut();
  isAdmin = false;
  view = 'player';
  await syncBookingsRealtime();
  await refreshBookings(false);
  toast('Sessão administrativa encerrada.');
};

$('#passwordForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const password = $('#newAdminPassword').value;
  const confirmation = $('#confirmAdminPassword').value;
  $('#passwordError').textContent = '';

  if (password !== confirmation) {
    $('#passwordError').textContent = 'As senhas informadas não são iguais.';
    return;
  }

  try {
    const { data, error } = await supabase.auth.updateUser({ password });
    if (error) throw error;

    const allowed = await hasAdminAccess(data.user.id);
    if (!allowed) throw new Error('Este usuário não possui acesso à administração da arena.');

    isAdmin = true;
    view = 'admin';
    await loadBookings();
    await syncBookingsRealtime();
    $('#passwordDialog').close();
    history.replaceState(null, '', window.location.pathname + window.location.search);
    render();
    toast('Senha criada. Acesso administrativo iniciado.');
  } catch (error) {
    console.error(error);
    $('#passwordError').textContent = error.message || 'Não foi possível salvar a senha.';
  }
});

async function switchArena(nextSlug) {
  const previousSlug = arena?.slug || activeArenaSlug || '';

  if (!nextSlug) {
    activeArenaSlug = '';
    const changeVersion = ++arenaChangeVersion;
    bookingLoadVersion += 1;
    realtimeVersion += 1;
    clearTimeout(realtimeRefreshTimer);
    clearInterval(paymentPollTimer);
    lastPlayerBooking = null;
    selectedId = null;

    if (bookingsRealtimeChannel) {
      const previousChannel = bookingsRealtimeChannel;
      bookingsRealtimeChannel = null;
      await supabase.removeChannel(previousChannel);
    }

    if (changeVersion !== arenaChangeVersion) return;

    if (isAdmin) await supabase.auth.signOut();
    if (changeVersion !== arenaChangeVersion) return;

    isAdmin = false;
    view = 'player';
    clearArenaIdentity();
    render();
    return;
  }

  if (nextSlug === activeArenaSlug && arena?.slug === nextSlug) return;

  activeArenaSlug = nextSlug;
  const changeVersion = ++arenaChangeVersion;
  bookingLoadVersion += 1;
  realtimeVersion += 1;
  clearTimeout(realtimeRefreshTimer);
  clearInterval(paymentPollTimer);
  lastPlayerBooking = null;
  selectedId = null;

  if (bookingsRealtimeChannel) {
    const previousChannel = bookingsRealtimeChannel;
    bookingsRealtimeChannel = null;
    await supabase.removeChannel(previousChannel);
  }

  if (changeVersion !== arenaChangeVersion) return;

  try {
    if (isAdmin) await supabase.auth.signOut();
    if (changeVersion !== arenaChangeVersion) return;

    isAdmin = false;
    view = 'player';
    bookings = [];
    scheduleBlocks = [];

    const loaded = await loadArena(nextSlug, changeVersion);
    if (!loaded || changeVersion !== arenaChangeVersion) return;

    populateCourtSelects();
    const bookingsLoaded = await loadBookings();
    if (!bookingsLoaded || changeVersion !== arenaChangeVersion) return;

    await syncBookingsRealtime();
    if (changeVersion !== arenaChangeVersion) return;

    render();
    toast(`Agenda da ${arena.name} carregada.`);
  } catch (error) {
    console.error(error);
    if (changeVersion !== arenaChangeVersion) return;

    activeArenaSlug = previousSlug;
    const select = $('#arenaSelect');
    if (select) select.value = previousSlug;

    if (previousSlug && arena?.slug === previousSlug) {
      populateCourtSelects();
      await syncBookingsRealtime();
      render();
    } else {
      clearArenaIdentity();
      render();
    }

    toast('Não foi possível trocar de arena. Tente novamente.');
  }
}

$('#arenaSelect').addEventListener('change', (event) => {
  switchArena(event.target.value);
});

async function initialize() {
  try {
    await loadArenaCatalog();
    activeArenaSlug = '';
    clearArenaIdentity();
    render();
  } catch (error) {
    console.error(error);
    $('#title').textContent = 'Agenda temporariamente indisponível.';
    $('#subtitle').textContent = 'Não foi possível conectar ao serviço de reservas. Tente novamente em alguns instantes.';
    $('#newBooking').classList.add('hidden');
    toast('Falha ao carregar o catálogo de arenas.');
  }
}

initialize();

if (document.modelContext?.registerTool) {
  try {
    Promise.resolve(document.modelContext.registerTool({
      name: 'change_booking_view',
      title: 'Alterar visão da agenda',
      description: 'Abre a visão do administrador ou do jogador no protótipo.',
      inputSchema: { type: 'object', properties: { view: { type: 'string', enum: ['admin', 'player'] } }, required: ['view'], additionalProperties: false },
      annotations: { readOnlyHint: false },
      execute(input) { if (!input || !['admin', 'player'].includes(input.view)) throw new Error('Visão inválida'); setView(input.view); return { view, title: $('#title').textContent }; }
    })).catch(() => {});
  } catch {}
}

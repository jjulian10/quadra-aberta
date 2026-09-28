import { createClient } from '@supabase/supabase-js';
import { createAdminNotifications } from './notifications.js';
import { togglePush, promptInstall, rememberReservationForInstall, consumeInstalledReservation, showBookingConfirmationNotification } from './push.js';
import { pushInvite, refreshPushInvites } from './push-onboarding.js';
import {
  ARENA_SLUG,
  ARENA_SUPPORT_WHATSAPP,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL
} from './supabase-config.js';

const $ = (selector) => document.querySelector(selector);

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const adminNotifications = createAdminNotifications({
  supabase,
  async openBooking(id, bookingDate) {
    if (!isAdmin || !arena) return;
    day = bookingDate;
    view = 'admin';
    await refreshBookings(false);
    openDetail(id);
  },
  async openFinance() {
    if (isAdmin && arena) await setView('finance');
  }
});
const authFlowType = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('type');
const reservationTokenFromUrl = new URLSearchParams(window.location.search).get('reserva');
const installedReservationToken = !reservationTokenFromUrl && !new URLSearchParams(window.location.search).has('arena')
  ? consumeInstalledReservation() : null;
if (installedReservationToken) {
  window.location.replace(`/?reserva=${encodeURIComponent(installedReservationToken)}`);
}
window.addEventListener('quadra:install-changed', refreshPushInvites);
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
let isPlatformAdmin = false;
let masterArenas = [];
let masterLoading = false;
let filter = 'all';
let selectedId = null;
let profitPeriod = 'day';
let financeActivityTab = 'payments';
let financeActivityExpanded = false;
let inventoryProducts = [];
let inventoryMovements = [];
let inventoryPeriod = 'day';
let inventorySearch = '';
let inventoryEditingId = null;
let inventorySaleProductId = '';
let inventorySaleQuantity = 1;
let inventoryLoading = false;
let inventoryImagePreviewObjectUrl = '';
let inventoryCatalogSelectionId = '';
const INVENTORY_PRODUCT_CATALOG = [
  {
    id: 'agua-crystal-500',
    name: 'Água Crystal sem gás 500ml',
    category: 'Bebidas',
    keywords: 'agua água crystal mineral sem gas gás 500 500ml',
    imageUrl: 'https://hiperideal.vtexassets.com/arquivos/ids/225921-150-auto?aspect=true&height=auto&v=638648775941630000&width=150'
  },
  {
    id: 'coca-cola-350',
    name: 'Coca-Cola Original 350ml',
    category: 'Bebidas',
    keywords: 'coca coke coca-cola refrigerante lata 350 350ml original',
    imageUrl: 'https://cdn.dooca.store/418/products/coca.jpg?v=1589835707000'
  },
  {
    id: 'coca-cola-2l',
    name: 'Coca-Cola Original 2L',
    category: 'Bebidas',
    keywords: 'coca coke coca-cola refrigerante pet 2l 2 litros original',
    imageUrl: 'https://andinacocacola.vtexassets.com/arquivos/ids/158758-800-auto?aspect=true&height=auto&v=639156020671730000&width=800'
  },
  {
    id: 'coca-cola-zero-350',
    name: 'Coca-Cola Zero Açúcar 350ml',
    category: 'Bebidas',
    keywords: 'coca coke coca-cola zero sem açúcar acucar refrigerante lata 350 350ml',
    imageUrl: 'https://img.kalunga.com.br/FotosdeProdutos/348211d.jpg'
  },
  {
    id: 'coca-cola-zero-2l',
    name: 'Coca-Cola Zero Açúcar 2L',
    category: 'Bebidas',
    keywords: 'coca coke coca-cola zero sem açúcar acucar refrigerante pet 2l 2 litros',
    imageUrl: 'https://andinacocacola.vtexassets.com/arquivos/ids/158892-800-auto?aspect=true&height=auto&v=639156020354770000&width=800'
  },
  {
    id: 'guarana-antarctica-350',
    name: 'Guaraná Antarctica 350ml',
    category: 'Bebidas',
    keywords: 'guarana guaraná antarctica refrigerante lata 350 350ml',
    imageUrl: 'https://cdn.shopify.com/s/files/1/0670/1111/7281/files/5601045300022-guaran-antarctica-350ml.webp?v=1705495956'
  },
  {
    id: 'guarana-antarctica-2l',
    name: 'Guaraná Antarctica 2L',
    category: 'Bebidas',
    keywords: 'guarana guaraná antarctica refrigerante pet 2l 2 litros',
    imageUrl: 'https://seabrafoods.com/cdn/shop/products/antarctica-guarana-2l-seabra-foods-online_200x.jpg?v=1706323584'
  },
  {
    id: 'fanta-laranja-2l',
    name: 'Fanta Laranja 2L',
    category: 'Bebidas',
    keywords: 'fanta laranja refrigerante pet 2l 2 litros',
    imageUrl: 'https://www.agendadascidades.com.br/uploads/images/2020/04/refrigerante-fanta-laranja-pet-2l.png'
  },
  {
    id: 'sprite-2l',
    name: 'Sprite Original 2L',
    category: 'Bebidas',
    keywords: 'sprite limao limão refrigerante pet 2l 2 litros',
    imageUrl: 'https://andinacocacola.vtexassets.com/arquivos/ids/158750-800-auto?aspect=true&height=auto&v=639240531304730000&width=800'
  },
  {
    id: 'monster-473',
    name: 'Monster Energy 473ml',
    category: 'Energéticos',
    keywords: 'monster energy energetico energético 473 473ml lata',
    imageUrl: 'https://io.convertiez.com.br/m/superpaguemenos/shop/products/images/23138/large/energetico-monster-energy-473ml_125932.jpg'
  },
  {
    id: 'red-bull-250',
    name: 'Red Bull Energy Drink 250ml',
    category: 'Energéticos',
    keywords: 'red bull redbull energy energetico energético 250 250ml lata',
    imageUrl: 'https://down-br.img.susercontent.com/file/de3905e6d774d25363e21ac6a2ff7297'
  },
  {
    id: 'heineken-350',
    name: 'Heineken 350ml',
    category: 'Cervejas',
    keywords: 'heineken cerveja beer lata 350 350ml',
    imageUrl: 'https://estreladistribuicao.agilecdn.com.br/139902.jpg'
  },
  {
    id: 'skol-350',
    name: 'Skol Pilsen 350ml',
    category: 'Cervejas',
    keywords: 'skol cerveja pilsen lata 350 350ml',
    imageUrl: 'https://cdnx.jumpseller.com/imperio-do-brasil/image/13711474/cerveja_skol_350ml.jpg?1650452486='
  },
  {
    id: 'doritos-84',
    name: 'Doritos Queijo Nacho 84g',
    category: 'Salgados',
    keywords: 'doritos queijo nacho salgadinho snack 84 84g',
    imageUrl: 'https://paulistaoatacadista.vtexassets.com/arquivos/ids/361722/SalgadinhoElmaChipsDoritos84gQue1.jpg?v=638379141202030000'
  },
  {
    id: 'ruffles-68',
    name: 'Ruffles Original 68g',
    category: 'Salgados',
    keywords: 'ruffles batata chips salgadinho original 68 68g',
    imageUrl: 'https://www.extrabom.com.br/uploads/produtos/original/193619_extrabom_salgadinhos-snacks_batata-ruffles-original-68g.jpg'
  }
];

let bookingsRealtimeChannel = null;
let realtimeRefreshTimer = null;
let lastPlayerBooking = null;
let paymentPollTimer = null;
let paymentCheckInFlight = false;
let reservationPortalTimer = null;
let reservationPortalData = null;
let waitlistSelection = null;
let cancellationHistory = [];
let pendingCancellationBookingId = null;
let rescheduleBooking = null;
let rescheduleTarget = null;
let rescheduleLoadVersion = 0;

let bookings = [];
let scheduleBlocks = [];

const pendingPaymentKey = 'quadra-aberta:pending-pix';
const pendingPaymentLifetime = 30 * 60 * 1000;

function clearPendingPayment() {
  try { localStorage.removeItem(pendingPaymentKey); } catch {}
}

function savePendingPayment(booking) {
  try {
    localStorage.setItem(pendingPaymentKey, JSON.stringify({
      id: booking.id,
      arenaSlug: booking.arenaSlug,
      courtId: courts[booking.court]?.id,
      date: booking.date,
      hour: booking.hour,
      duration: booking.duration,
      name: booking.name,
      amount: booking.amount,
      depositAmount: booking.depositAmount,
      paymentToken: booking.paymentToken,
      reservationToken: booking.reservationToken,
      qrCode: booking.qrCode,
      qrCodeBase64: booking.qrCodeBase64,
      expiresAt: Date.now() + pendingPaymentLifetime
    }));
  } catch { /* O Pix ainda pode ser acompanhado enquanto a página estiver aberta. */ }
}

function readPendingPayment() {
  try {
    const saved = JSON.parse(localStorage.getItem(pendingPaymentKey) || 'null');
    const valid = saved &&
      /^[0-9a-f-]{36}$/i.test(saved.id || '') &&
      /^[0-9a-f-]{36}$/i.test(saved.paymentToken || '') &&
      typeof saved.arenaSlug === 'string' &&
      typeof saved.courtId === 'string' &&
      typeof saved.qrCode === 'string' &&
      Number.isFinite(saved.expiresAt) &&
      saved.expiresAt > Date.now() &&
      saved.expiresAt <= Date.now() + pendingPaymentLifetime;
    if (valid) return saved;
    if (saved) clearPendingPayment();
  } catch { clearPendingPayment(); }
  return null;
}

const money = (value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const labelDate = (date) => new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
const weekdayLabel = (date) => {
  const label = new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' });
  return label.charAt(0).toUpperCase() + label.slice(1);
};
const fullDateLabel = (date) => new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  year: 'numeric'
});
const reservationUrl = (token) => {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('reserva', token);
  return url.toString();
};
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
  paymentProvider: booking.payment_provider || null,
  paymentConfirmedAt: booking.payment_confirmed_at || null,
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

const mapCancellation = (entry) => ({
  id: entry.id,
  bookingId: entry.booking_id,
  bookingDate: entry.booking_date,
  hour: Number(entry.start_hour),
  duration: Number(entry.duration),
  courtName: entry.court_name,
  customerName: entry.customer_name,
  bookingAmount: Number(entry.booking_amount || 0),
  receivedAmount: Number(entry.payment_received_amount || 0),
  paymentStatus: entry.payment_status,
  reason: entry.cancellation_reason,
  cancelledAt: entry.cancelled_at
});

const dateTimeLabel = (value) => new Date(value).toLocaleString('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
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
  cancellationHistory = [];
  pendingCancellationBookingId = null;
  inventoryProducts = [];
  inventoryMovements = [];
  inventorySearch = '';
  inventoryEditingId = null;
  inventorySaleProductId = '';
  inventorySaleQuantity = 1;
  selectedId = null;
  filter = 'all';
  lastPlayerBooking = null;
  clearInterval(paymentPollTimer);
  paymentPollTimer = null;

  const select = $('#arenaSelect');
  if (select) select.value = '';
  if ($('#arenaSelectValue')) $('#arenaSelectValue').textContent = 'Selecione uma arena';
  renderArenaPickerOptions();

  if ($('#arenaAvatar')) $('#arenaAvatar').textContent = '';
  if ($('#arenaCity')) $('#arenaCity').textContent = 'Escolha a arena para começar';
  if ($('#breadcrumbArena')) $('#breadcrumbArena').textContent = 'Selecione uma arena';
  if ($('#loginIntro')) $('#loginIntro').textContent = 'Entre com seu e-mail e senha. Sua arena será identificada automaticamente.';
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
  if ($('#arenaSelectValue')) $('#arenaSelectValue').textContent = arenaName;
  renderArenaPickerOptions();

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
  if (footer) {
    footer.hidden = isAdmin;
    footer.classList.toggle('hidden', isAdmin);
  }

  if ($('#breadcrumbArena')) $('#breadcrumbArena').textContent = arenaName;
  if ($('#loginIntro')) $('#loginIntro').textContent = `Acesse a agenda, as solicitações e o dashboard financeiro da ${arenaName}.`;
  if ($('#bookingArenaEyebrow')) $('#bookingArenaEyebrow').textContent = arenaName.toUpperCase();
}

function renderArenaPickerOptions() {
  const menu = $('#arenaSelectMenu');
  if (!menu) return;

  const homeSelected = !activeArenaSlug;
  const homeOption = `
    <button
      class="arena-picker-option arena-picker-home${homeSelected ? ' selected' : ''}"
      type="button"
      role="option"
      aria-selected="${homeSelected}"
      data-arena-slug=""
    >
      <span class="arena-option-avatar" aria-hidden="true">⌂</span>
      <span class="arena-option-copy">
        <strong>Início</strong>
        <small>Todas as arenas</small>
      </span>
      <span class="arena-option-check" aria-hidden="true">${homeSelected ? '✓' : ''}</span>
    </button>
  `;

  const arenaOptions = arenaCatalog.map((item) => {
    const selected = item.slug === activeArenaSlug;
    return `
      <button
        class="arena-picker-option${selected ? ' selected' : ''}"
        type="button"
        role="option"
        aria-selected="${selected}"
        data-arena-slug="${esc(item.slug)}"
      >
        <span class="arena-option-avatar">${esc(arenaInitials(item.name))}</span>
        <span class="arena-option-copy">
          <strong>${esc(item.name)}</strong>
          <small>${esc(item.city || 'Porto Velho, RO')}</small>
        </span>
        <span class="arena-option-check" aria-hidden="true">${selected ? '✓' : ''}</span>
      </button>
    `;
  }).join('');

  menu.innerHTML = homeOption + arenaOptions;
}

function closeArenaPicker() {
  const picker = $('#arenaPicker');
  const trigger = $('#arenaSelectTrigger');
  if (!picker || !trigger) return;
  picker.classList.remove('open');
  trigger.setAttribute('aria-expanded', 'false');
}

function toggleArenaPicker() {
  const picker = $('#arenaPicker');
  const trigger = $('#arenaSelectTrigger');
  if (!picker || !trigger) return;
  const opening = !picker.classList.contains('open');
  picker.classList.toggle('open', opening);
  trigger.setAttribute('aria-expanded', String(opening));
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

  renderArenaPickerOptions();
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

async function checkPlatformAdmin(userId) {
  if (!userId) return false;

  const { data, error } = await supabase
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

async function loadMasterDashboard() {
  if (!isPlatformAdmin) return false;

  masterLoading = true;
  try {
    const { data, error } = await supabase.rpc('get_master_arenas');
    if (error) throw error;
    masterArenas = data || [];
    return true;
  } finally {
    masterLoading = false;
  }
}

function renderMasterPanel() {
  const summary = $('#masterSummary');
  const list = $('#masterArenaList');
  if (!summary || !list) return;

  const totalArenas = masterArenas.length;
  const activeArenas = masterArenas.filter((item) => item.active).length;
  const totalCourts = masterArenas.reduce((sum, item) => sum + Number(item.court_count || 0), 0);
  const totalBookings = masterArenas.reduce((sum, item) => sum + Number(item.bookings_count || 0), 0);
  const totalReceived = masterArenas.reduce((sum, item) => sum + Number(item.received || 0), 0);

  summary.innerHTML = [
    ['Arenas', totalArenas, `${activeArenas} ativas`, '◆'],
    ['Quadras', totalCourts, 'Em toda a plataforma', '▦'],
    ['Reservas', totalBookings, 'Ativas e pendentes', '◷'],
    ['Recebido', money(totalReceived), 'Somatório das arenas', '↗']
  ].map((item, index) => `
    <div class="master-stat ${index === 3 ? 'featured' : ''}">
      <div class="master-stat-label">${item[0]}<span>${item[3]}</span></div>
      <strong>${item[1]}</strong>
      <small>${item[2]}</small>
    </div>
  `).join('');

  if (masterLoading) {
    list.innerHTML = '<div class="master-empty">Atualizando arenas...</div>';
    return;
  }

  if (!masterArenas.length) {
    list.innerHTML = '<div class="master-empty">Nenhuma arena cadastrada.</div>';
    return;
  }

  list.innerHTML = masterArenas.map((item) => `
    <article class="master-arena-row">
      <div class="master-arena-avatar">${esc(arenaInitials(item.name))}</div>
      <div class="master-arena-main">
        <div class="master-arena-title">
          <strong>${esc(item.name)}</strong>
          <span class="master-status ${item.active ? 'active' : 'inactive'}">${item.active ? 'Ativa' : 'Inativa'}</span>
        </div>
        <small>${esc(item.city || 'Porto Velho, RO')}</small>
        <span>${Number(item.court_count || 0)} quadra${Number(item.court_count || 0) === 1 ? '' : 's'} · ${Number(item.bookings_count || 0)} reserva${Number(item.bookings_count || 0) === 1 ? '' : 's'}</span>
      </div>
      <div class="master-arena-admin">
        <small>Administrador</small>
        <strong>${esc(item.admin_email || 'Não cadastrado')}</strong>
      </div>
      <div class="master-arena-finance">
        <small>Recebido</small>
        <strong>${money(Number(item.received || 0))}</strong>
      </div>
    </article>
  `).join('');
}

async function getAdminArenaForUser(userId) {
  if (!userId) return null;

  const { data: memberships, error: membershipError } = await supabase
    .from('arena_admins')
    .select('arena_id, role')
    .eq('user_id', userId);

  if (membershipError) throw membershipError;
  if (!memberships?.length) return null;

  if (memberships.length > 1) {
    throw new Error('Este usuário está vinculado a mais de uma arena. Revise o cadastro administrativo.');
  }

  const membership = memberships[0];
  const { data: linkedArena, error: arenaError } = await supabase
    .from('arenas')
    .select('id, slug, name')
    .eq('id', membership.arena_id)
    .eq('active', true)
    .single();

  if (arenaError) throw arenaError;
  return { ...linkedArena, role: membership.role };
}

async function enterAdminPanelForUser(userId) {
  isPlatformAdmin = await checkPlatformAdmin(userId);
  const linkedArena = await getAdminArenaForUser(userId);

  if (!linkedArena) {
    if (!isPlatformAdmin) return false;

    adminNotifications.reset();
    activeArenaSlug = '';
    clearArenaIdentity();
    isAdmin = true;
    view = 'master';
    await loadMasterDashboard();
    render();
    return true;
  }

  activeArenaSlug = linkedArena.slug;
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

  if (changeVersion !== arenaChangeVersion) return false;

  isAdmin = false;
  view = 'player';
  bookings = [];
  scheduleBlocks = [];
  cancellationHistory = [];
  pendingCancellationBookingId = null;

  const loaded = await loadArena(linkedArena.slug, changeVersion);
  if (!loaded || changeVersion !== arenaChangeVersion) return false;

  populateCourtSelects();

  isAdmin = true;
  view = 'admin';

  const bookingsLoaded = await loadBookings();
  if (!bookingsLoaded || changeVersion !== arenaChangeVersion) return false;

  await syncBookingsRealtime();
  if (changeVersion !== arenaChangeVersion) return false;

  adminNotifications.setContext(arena, userId, courts);
  render();
  return true;
}

async function restoreAdminSession() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return false;

  const restored = await enterAdminPanelForUser(data.user.id);
  if (!restored) {
    await supabase.auth.signOut();
    return false;
  }

  return true;
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

    const [bookingResult, blockResult, cancellationResult] = await Promise.all([
      supabase
        .from('bookings')
        .select('id, booking_date, court_id, start_hour, duration, customer_name, customer_phone, status, payment_status, amount, deposit_amount, payment_received_amount, payment_provider, payment_confirmed_at')
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
        .order('start_hour', { nullsFirst: true }),
      supabase
        .from('booking_cancellations')
        .select('id, booking_id, booking_date, start_hour, duration, court_name, customer_name, booking_amount, payment_received_amount, payment_status, cancellation_reason, cancelled_at')
        .eq('arena_id', arenaSnapshot.id)
        .order('cancelled_at', { ascending: false })
        .limit(200)
    ]);

    if (bookingResult.error) throw bookingResult.error;
    if (blockResult.error) throw blockResult.error;
    if (cancellationResult.error) throw cancellationResult.error;
    if (!stillCurrent()) return false;

    bookings = bookingResult.data.map((booking) => mapBooking(booking));
    scheduleBlocks = blockResult.data.map((block) => mapScheduleBlock(block));
    cancellationHistory = cancellationResult.data.map((entry) => mapCancellation(entry));
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
    if (updated) {
      render();
      if (isAdmin) adminNotifications.refresh();
    }
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
  if (!isAdmin || !arena) adminNotifications.reset();
  const adminNav = document.querySelector('[data-view="admin"]');
  const financeNav = document.querySelector('[data-view="finance"]');
  const inventoryNav = document.querySelector('[data-view="inventory"]');
  const masterNav = document.querySelector('[data-view="master"]');
  const playerNav = document.querySelector('[data-view="player"]');

  adminNav.classList.toggle('hidden', !isAdmin || !arena);
  financeNav.classList.toggle('hidden', !isAdmin || !arena);
  inventoryNav.classList.toggle('hidden', !isAdmin || !arena);
  masterNav.classList.toggle('hidden', !isPlatformAdmin);
  playerNav.classList.toggle('hidden', isAdmin);
  $('#adminLogin').classList.toggle('hidden', isAdmin);
  $('#adminLogout').classList.toggle('hidden', !isAdmin);
  $('#blockSchedule').classList.toggle('hidden', !isAdmin || view !== 'admin' || view === 'master');

  document.body.classList.toggle('admin-session', isAdmin);

  const arenaContact = $('#arenaFooterContact');
  if (arenaContact) {
    arenaContact.hidden = isAdmin || !arena;
    arenaContact.classList.toggle('hidden', isAdmin || !arena);
  }

  const arenaTrigger = $('#arenaSelectTrigger');
  if (arenaTrigger) {
    arenaTrigger.disabled = isAdmin;
    arenaTrigger.setAttribute('aria-disabled', String(isAdmin));
    if (isAdmin) closeArenaPicker();
  }
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

function periodCancellationHistory(period) {
  const reference = new Date(day + 'T12:00:00');
  return cancellationHistory.filter((entry) => {
    const cancelled = new Date(entry.cancelledAt);
    const cancellationDate = new Date(
      cancelled.getFullYear(),
      cancelled.getMonth(),
      cancelled.getDate(),
      12
    );
    const difference = Math.round((reference - cancellationDate) / 86400000);
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
  const cancellations = periodCancellationHistory(profitPeriod);

  const payments = list
    .filter((booking) => Number(booking.paidAmount || 0) > 0)
    .slice()
    .sort((a, b) => {
      const aTime = a.paymentConfirmedAt
        ? new Date(a.paymentConfirmedAt).getTime()
        : new Date(`${a.date}T${String(a.hour).padStart(2, '0')}:00:00`).getTime();
      const bTime = b.paymentConfirmedAt
        ? new Date(b.paymentConfirmedAt).getTime()
        : new Date(`${b.date}T${String(b.hour).padStart(2, '0')}:00:00`).getTime();
      return bTime - aTime;
    });

  const byCourt = courts.map((court, index) => ({
    name: court.name,
    value: list
      .filter((booking) => booking.court === index)
      .reduce((sum, booking) => sum + Number(booking.paidAmount || 0), 0)
  }));

  const maxCourt = Math.max(...byCourt.map((item) => item.value), 1);
  const receivedPercent = expected ? Math.min(100, Math.round(received / expected * 100)) : 0;

  const activityItems = financeActivityTab === 'payments' ? payments : cancellations;
  const visibleActivityItems = financeActivityExpanded ? activityItems : activityItems.slice(0, 3);

  let activityRows;
  if (financeActivityTab === 'payments') {
    activityRows = visibleActivityItems.length
      ? visibleActivityItems.map((booking) => {
        const total = bookingTotal(booking);
        const receivedAmount = Number(booking.paidAmount || 0);
        const balance = Math.max(total - receivedAmount, 0);
        const statusLabel = booking.paid ? 'Quitado' : 'Pagamento parcial';
        const sourceLabel = booking.paymentProvider === 'manual' ? 'Registrado pelo ADM' : 'Pix';
        const paymentDate = booking.paymentConfirmedAt
          ? dateTimeLabel(booking.paymentConfirmedAt)
          : `${labelDate(booking.date)} · ${booking.hour}:00`;

        return `
          <div class="finance-activity-row payment-activity-row">
            <div class="finance-activity-date">
              <span>Recebido em</span>
              <strong>${esc(paymentDate)}</strong>
            </div>
            <div class="finance-activity-person">
              <strong>${esc(booking.name || 'Cliente')}</strong>
              <small>${esc(courts[booking.court]?.name || 'Quadra')} · ${booking.hour}:00–${booking.hour + booking.duration}:00</small>
            </div>
            <div class="finance-activity-value">
              <strong>${money(receivedAmount)}</strong>
              <small>de ${money(total)}</small>
            </div>
            <div class="finance-activity-status">
              <span class="finance-status-pill ${booking.paid ? 'paid' : 'partial'}">${statusLabel}</span>
              <small>${balance > 0 ? `Saldo ${money(balance)}` : 'Sem saldo pendente'}</small>
            </div>
            <div class="finance-activity-source">
              <span>Origem</span>
              <strong>${sourceLabel}</strong>
            </div>
          </div>`;
      }).join('')
      : '<div class="finance-activity-empty">Nenhum pagamento recebido neste período.</div>';
  } else {
    activityRows = visibleActivityItems.length
      ? visibleActivityItems.map((entry) => `
        <div class="finance-activity-row cancellation-activity-row">
          <div class="finance-activity-date">
            <span>Reserva</span>
            <strong>${esc(labelDate(entry.bookingDate))}</strong>
            <small>${entry.hour}:00–${entry.hour + entry.duration}:00</small>
          </div>
          <div class="finance-activity-person">
            <strong>${esc(entry.customerName)}</strong>
            <small>${esc(entry.courtName)}</small>
          </div>
          <div class="finance-activity-value">
            <strong>${money(Number(entry.receivedAmount || 0))}</strong>
            <small>Recebido antes do cancelamento</small>
          </div>
          <div class="finance-activity-reason">
            <span>Motivo</span>
            <strong>${esc(entry.reason)}</strong>
          </div>
          <div class="finance-activity-date">
            <span>Cancelada em</span>
            <strong>${esc(dateTimeLabel(entry.cancelledAt))}</strong>
          </div>
        </div>`
      ).join('')
      : '<div class="finance-activity-empty">Nenhum cancelamento registrado neste período.</div>';
  }

  const activityCount = activityItems.length;
  const visibleCount = visibleActivityItems.length;

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
    </div>

    <section class="finance-activity">
      <div class="finance-activity-heading">
        <div>
          <p class="eyebrow">MOVIMENTAÇÕES FINANCEIRAS</p>
          <h3>Atividade recente</h3>
          <p>Pagamentos recebidos e cancelamentos ficam organizados em um único histórico.</p>
        </div>
        <span class="finance-activity-period">${periodLabel}</span>
      </div>

      <div class="finance-activity-toolbar">
        <div class="finance-activity-tabs" role="tablist" aria-label="Tipo de movimentação">
          <button type="button" role="tab" aria-selected="${financeActivityTab === 'payments'}" class="${financeActivityTab === 'payments' ? 'active' : ''}" data-finance-activity-tab="payments">
            Pagamentos <span>${payments.length}</span>
          </button>
          <button type="button" role="tab" aria-selected="${financeActivityTab === 'cancellations'}" class="${financeActivityTab === 'cancellations' ? 'active' : ''}" data-finance-activity-tab="cancellations">
            Cancelamentos <span>${cancellations.length}</span>
          </button>
        </div>
        <span class="finance-activity-counter">${activityCount ? `${visibleCount} de ${activityCount} registros` : 'Nenhum registro'}</span>
      </div>

      <div class="finance-activity-list">${activityRows}</div>

      ${activityCount > 3 ? `
        <div class="finance-activity-footer">
          <button type="button" class="finance-history-toggle" data-finance-activity-expand>
            ${financeActivityExpanded ? 'Mostrar apenas recentes' : 'Ver histórico completo'} <span aria-hidden="true">→</span>
          </button>
        </div>` : ''}
    </section>`;

  panel.querySelectorAll('[data-profit-period]').forEach((button) => {
    button.onclick = () => {
      profitPeriod = button.dataset.profitPeriod;
      financeActivityExpanded = false;
      render();
    };
  });

  panel.querySelectorAll('[data-finance-activity-tab]').forEach((button) => {
    button.onclick = () => {
      financeActivityTab = button.dataset.financeActivityTab;
      financeActivityExpanded = false;
      render();
    };
  });

  const activityExpand = panel.querySelector('[data-finance-activity-expand]');
  if (activityExpand) {
    activityExpand.onclick = () => {
      financeActivityExpanded = !financeActivityExpanded;
      render();
    };
  }

  $('#financeDate').onchange = async (event) => {
    if (event.target.value) {
      day = event.target.value;
      financeActivityExpanded = false;
      await refreshBookings();
    }
  };
}


function mapInventoryProduct(product) {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    salePrice: Number(product.sale_price || 0),
    costPrice: product.cost_price === null || product.cost_price === undefined ? null : Number(product.cost_price),
    stock: Number(product.stock_quantity || 0),
    lowStockThreshold: Number(product.low_stock_threshold || 0),
    imagePath: product.image_path || null,
    imageUrl: product.image_url || null,
    active: product.active !== false,
    createdAt: product.created_at,
    updatedAt: product.updated_at
  };
}

function inventoryImageUrl(product) {
  if (product?.imagePath) return supabase.storage.from('product-images').getPublicUrl(product.imagePath).data.publicUrl || '';
  return product?.imageUrl || '';
}

function clearInventoryImagePreviewObjectUrl() {
  if (!inventoryImagePreviewObjectUrl) return;
  URL.revokeObjectURL(inventoryImagePreviewObjectUrl);
  inventoryImagePreviewObjectUrl = '';
}

function renderInventoryImagePreview(product = null, file = null, catalogProduct = null) {
  const preview = $('#inventoryImagePreview');
  if (!preview) return;

  clearInventoryImagePreviewObjectUrl();

  let src = '';
  let alt = '';
  if (file) {
    inventoryImagePreviewObjectUrl = URL.createObjectURL(file);
    src = inventoryImagePreviewObjectUrl;
    alt = 'Prévia da nova foto do produto';
  } else if (inventoryImageUrl(product)) {
    src = inventoryImageUrl(product);
    alt = `Foto de ${product.name}`;
  } else if (catalogProduct?.imageUrl) {
    src = catalogProduct.imageUrl;
    alt = `Foto de ${catalogProduct.name}`;
  }

  preview.classList.toggle('has-image', Boolean(src));
  preview.innerHTML = src
    ? `<img data-inventory-product-image referrerpolicy="no-referrer" src="${esc(src)}" alt="${esc(alt)}">`
    : '<span aria-hidden="true">◇</span><small>Sem foto</small>';
}

function replaceBrokenInventoryImage(img) {
  if (!img?.matches?.('img[data-inventory-product-image]')) return;
  const holder = img.parentElement;
  if (!holder) return;

  if (holder.id === 'inventoryImagePreview') {
    holder.classList.remove('has-image');
    holder.innerHTML = '<span aria-hidden="true">◇</span><small>Imagem indisponível</small>';
    return;
  }

  holder.innerHTML = '<span class="inventory-image-fallback" aria-hidden="true">◇</span>';
}

document.addEventListener('error', (event) => {
  replaceBrokenInventoryImage(event.target);
}, true);

function inventoryCatalogNormalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

function selectedInventoryCatalogProduct() {
  return INVENTORY_PRODUCT_CATALOG.find((item) => item.id === inventoryCatalogSelectionId) || null;
}

function inventoryCatalogMatches(value) {
  const term = inventoryCatalogNormalize(value);
  if (!term) return INVENTORY_PRODUCT_CATALOG;
  return INVENTORY_PRODUCT_CATALOG.filter((item) =>
    inventoryCatalogNormalize(`${item.name} ${item.category} ${item.keywords}`).includes(term)
  );
}

function closeInventoryCatalogSuggestions() {
  const list = $('#inventoryCatalogSuggestions');
  const input = $('#inventoryProductName');
  if (list) list.classList.add('hidden');
  if (input) input.setAttribute('aria-expanded', 'false');
}

function renderInventoryCatalogSuggestions(value = '') {
  const list = $('#inventoryCatalogSuggestions');
  const input = $('#inventoryProductName');
  if (!list || !input) return;

  const matches = inventoryCatalogMatches(value);
  input.setAttribute('aria-expanded', 'true');
  list.classList.remove('hidden');

  if (!matches.length) {
    list.innerHTML = '<div class="inventory-catalog-empty">Produto não encontrado. Você pode continuar digitando e cadastrar como produto personalizado.</div>';
    return;
  }

  list.innerHTML = matches.map((item) => `
    <button type="button" class="inventory-catalog-option" data-inventory-catalog-id="${item.id}" role="option">
      <span class="inventory-catalog-thumb">
        <img data-inventory-product-image referrerpolicy="no-referrer" src="${esc(item.imageUrl)}" alt="" loading="lazy">
      </span>
      <span class="inventory-catalog-option-copy">
        <strong>${esc(item.name)}</strong>
        <small>${esc(item.category)} · imagem pronta</small>
      </span>
      <span class="inventory-catalog-check">Selecionar</span>
    </button>
  `).join('');
}

function syncInventoryCatalogSelectionStatus() {
  const selected = selectedInventoryCatalogProduct();
  const status = $('#inventoryCatalogSelectionStatus');
  const source = $('#inventoryImageSourceLabel');
  if (status) {
    status.textContent = selected ? selected.name : 'Produto personalizado';
    status.classList.toggle('catalog', Boolean(selected));
  }
  if (source) source.textContent = selected ? 'Imagem pronta do catálogo' : 'Foto personalizada';
}

function selectInventoryCatalogProduct(catalogId) {
  const item = INVENTORY_PRODUCT_CATALOG.find((product) => product.id === catalogId);
  if (!item) return;

  inventoryCatalogSelectionId = item.id;
  $('#inventoryProductName').value = item.name;
  $('#inventoryProductCategory').value = item.category;
  $('#inventoryProductImage').value = '';
  $('#inventoryProductError').textContent = '';
  syncInventoryCatalogSelectionStatus();
  renderInventoryImagePreview(null, null, item);
  closeInventoryCatalogSuggestions();
}

async function uploadInventoryProductImage(productId, file) {
  if (!arena || !productId || !file) return null;

  const allowedTypes = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
  };
  const extension = allowedTypes[file.type];

  if (!extension) throw new Error('Use uma imagem JPG, PNG ou WebP.');
  if (file.size > 5 * 1024 * 1024) throw new Error('A foto deve ter no máximo 5 MB.');

  const currentProduct = inventoryProducts.find((product) => product.id === productId);
  const previousPath = currentProduct?.imagePath || null;
  const uniquePart = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `${arena.id}/${productId}/${uniquePart}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from('product-images')
    .upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false
    });

  if (uploadError) throw uploadError;

  const { error: updateError } = await supabase
    .from('inventory_products')
    .update({ image_path: path })
    .eq('id', productId)
    .eq('arena_id', arena.id);

  if (updateError) {
    await supabase.storage.from('product-images').remove([path]);
    throw updateError;
  }

  if (previousPath && previousPath !== path) {
    const { error: removeError } = await supabase.storage.from('product-images').remove([previousPath]);
    if (removeError) console.warn('Não foi possível remover a foto anterior do produto.', removeError);
  }

  return path;
}

function mapInventoryMovement(movement) {
  return {
    id: movement.id,
    productId: movement.product_id,
    type: movement.movement_type,
    quantity: Number(movement.quantity || 0),
    unitPrice: Number(movement.unit_price || 0),
    totalAmount: Number(movement.total_amount || 0),
    stockBefore: Number(movement.stock_before || 0),
    stockAfter: Number(movement.stock_after || 0),
    createdAt: movement.created_at
  };
}

async function loadInventoryData() {
  if (!isAdmin || !arena) return false;

  const arenaId = arena.id;
  inventoryLoading = true;

  try {
    const since = new Date();
    since.setDate(since.getDate() - 45);

    const [productsResult, movementsResult] = await Promise.all([
      supabase
        .from('inventory_products')
        .select('id, name, category, sale_price, cost_price, stock_quantity, low_stock_threshold, image_path, image_url, active, created_at, updated_at')
        .eq('arena_id', arenaId)
        .eq('active', true)
        .order('name'),
      supabase
        .from('inventory_movements')
        .select('id, product_id, movement_type, quantity, unit_price, total_amount, stock_before, stock_after, created_at')
        .eq('arena_id', arenaId)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(1500)
    ]);

    if (productsResult.error) throw productsResult.error;
    if (movementsResult.error) throw movementsResult.error;
    if (arena?.id !== arenaId || !isAdmin) return false;

    inventoryProducts = productsResult.data.map(mapInventoryProduct);
    inventoryMovements = movementsResult.data.map(mapInventoryMovement);

    if (!inventoryProducts.some((product) => product.id === inventorySaleProductId)) {
      inventorySaleProductId = inventoryProducts.find((product) => product.stock > 0)?.id || inventoryProducts[0]?.id || '';
      inventorySaleQuantity = 1;
    }

    return true;
  } finally {
    inventoryLoading = false;
  }
}

function inventoryPeriodStart(period) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (period === 'week') start.setDate(start.getDate() - 6);
  if (period === 'month') start.setDate(start.getDate() - 29);
  return start;
}

function inventorySales(period = inventoryPeriod) {
  const start = inventoryPeriodStart(period);
  return inventoryMovements.filter((movement) =>
    movement.type === 'sale' && new Date(movement.createdAt) >= start
  );
}

function inventoryIsToday(value) {
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
}

function inventoryRanking(period = inventoryPeriod) {
  const quantities = new Map(inventoryProducts.map((product) => [product.id, 0]));
  inventorySales(period).forEach((sale) => {
    quantities.set(sale.productId, (quantities.get(sale.productId) || 0) + sale.quantity);
  });

  const rows = inventoryProducts.map((product) => ({
    product,
    quantity: quantities.get(product.id) || 0
  }));

  return {
    top: rows.filter((row) => row.quantity > 0).sort((a, b) => b.quantity - a.quantity || a.product.name.localeCompare(b.product.name)).slice(0, 5),
    low: rows.sort((a, b) => a.quantity - b.quantity || a.product.name.localeCompare(b.product.name)).slice(0, 5)
  };
}

function inventoryChartSeries(period = inventoryPeriod) {
  const sales = inventorySales(period);
  const now = new Date();

  if (period === 'day') {
    return Array.from({ length: 12 }, (_, index) => {
      const startHour = index * 2;
      const value = sales.reduce((sum, sale) => {
        const date = new Date(sale.createdAt);
        return date.getHours() >= startHour && date.getHours() < startHour + 2
          ? sum + sale.totalAmount : sum;
      }, 0);
      return { label: String(startHour).padStart(2, '0') + 'h', value };
    });
  }

  if (period === 'week') {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now);
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      const next = new Date(date);
      next.setDate(next.getDate() + 1);
      const value = sales.reduce((sum, sale) => {
        const when = new Date(sale.createdAt);
        return when >= date && when < next ? sum + sale.totalAmount : sum;
      }, 0);
      const label = date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
      return { label, value };
    });
  }

  return Array.from({ length: 10 }, (_, index) => {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 29 + index * 3);
    const end = new Date(start);
    end.setDate(end.getDate() + 3);
    const value = sales.reduce((sum, sale) => {
      const when = new Date(sale.createdAt);
      return when >= start && when < end ? sum + sale.totalAmount : sum;
    }, 0);
    return {
      label: start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      value
    };
  });
}

function inventoryProductName(productId) {
  return inventoryProducts.find((product) => product.id === productId)?.name || 'Produto';
}

function inventoryRowsHtml() {
  const term = inventorySearch.trim().toLocaleLowerCase('pt-BR');
  const products = inventoryProducts.filter((product) =>
    !term ||
    product.name.toLocaleLowerCase('pt-BR').includes(term) ||
    product.category.toLocaleLowerCase('pt-BR').includes(term)
  );

  if (!products.length) {
    return '<tr><td colspan="6"><div class="inventory-empty">' +
      (inventoryProducts.length ? 'Nenhum produto corresponde à busca.' : 'Nenhum produto cadastrado. Clique em “Novo produto” para começar.') +
      '</div></td></tr>';
  }

  return products.map((product) => {
    const out = product.stock <= 0;
    const low = !out && product.stock <= product.lowStockThreshold;
    const statusClass = out ? 'out' : low ? 'low' : '';
    const statusLabel = out ? 'Sem estoque' : low ? 'Estoque baixo' : 'Em estoque';

    return `
      <tr>
        <td>
          <div class="inventory-product-name">
            ${inventoryImageUrl(product)
              ? `<span class="inventory-product-photo"><img data-inventory-product-image referrerpolicy="no-referrer" src="${esc(inventoryImageUrl(product))}" alt="Foto de ${esc(product.name)}" loading="lazy"></span>`
              : '<span class="inventory-product-icon" aria-hidden="true">◇</span>'}
            <strong>${esc(product.name)}</strong>
          </div>
        </td>
        <td>${esc(product.category)}</td>
        <td><span class="inventory-stock-value">${product.stock}</span></td>
        <td>${money(product.salePrice)}</td>
        <td><span class="inventory-status ${statusClass}">${statusLabel}</span></td>
        <td>
          <div class="inventory-row-actions">
            <button type="button" data-inventory-sale-product="${product.id}" ${out ? 'disabled' : ''}>▣ Registrar venda</button>
            <button type="button" class="inventory-edit" data-inventory-edit="${product.id}" aria-label="Editar ${esc(product.name)}">✎</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

function inventoryRankingHtml(rows, emptyText) {
  if (!rows.length) return `<div class="inventory-alert-empty">${emptyText}</div>`;
  const max = Math.max(...rows.map((row) => row.quantity), 1);

  return `<div class="inventory-ranking">${rows.map((row, index) => `
    <div class="inventory-ranking-row">
      <span>${index + 1}</span>
      <strong title="${esc(row.product.name)}">${esc(row.product.name)}</strong>
      <div class="inventory-ranking-track"><i style="width:${Math.max(row.quantity ? 8 : 0, row.quantity / max * 100)}%"></i></div>
      <small>${row.quantity}</small>
    </div>`).join('')}</div>`;
}

function renderMerchandisePanel() {
  const panel = $('#merchandisePanel');
  if (!panel) return;

  if (inventoryLoading) {
    panel.innerHTML = '<div class="inventory-card"><div class="inventory-empty">Carregando estoque e vendas...</div></div>';
    return;
  }

  const productsCount = inventoryProducts.length;
  const stockTotal = inventoryProducts.reduce((sum, product) => sum + product.stock, 0);
  const lowStock = inventoryProducts.filter((product) => product.stock <= product.lowStockThreshold);
  const todaySales = inventoryMovements.filter((movement) => movement.type === 'sale' && inventoryIsToday(movement.createdAt));
  const todayRevenue = todaySales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const todayUnits = todaySales.reduce((sum, sale) => sum + sale.quantity, 0);

  const periodSales = inventorySales();
  const periodRevenue = periodSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const periodUnits = periodSales.reduce((sum, sale) => sum + sale.quantity, 0);
  const periodLabel = { day: 'Hoje', week: '7 dias', month: '30 dias' }[inventoryPeriod];

  const ranking = inventoryRanking();
  const chart = inventoryChartSeries();
  const chartMax = Math.max(...chart.map((item) => item.value), 1);

  if (!inventoryProducts.some((product) => product.id === inventorySaleProductId)) {
    inventorySaleProductId = inventoryProducts.find((product) => product.stock > 0)?.id || inventoryProducts[0]?.id || '';
    inventorySaleQuantity = 1;
  }

  const saleProduct = inventoryProducts.find((product) => product.id === inventorySaleProductId) || null;
  const safeQuantity = saleProduct ? Math.max(1, Math.min(inventorySaleQuantity, Math.max(saleProduct.stock, 1))) : 1;
  inventorySaleQuantity = safeQuantity;
  const saleTotal = saleProduct ? saleProduct.salePrice * safeQuantity : 0;

  const recentMovements = inventoryMovements.slice(0, 6);
  const movementRows = recentMovements.length
    ? recentMovements.map((movement) => {
      const isIncrease = movement.stockAfter > movement.stockBefore;
      const label = movement.type === 'sale' ? 'Venda' : movement.type === 'restock' ? 'Reposição' : 'Ajuste';
      const sign = isIncrease ? '+' : '−';
      const date = new Date(movement.createdAt);
      return `
        <div class="inventory-movement-row">
          <span class="inventory-movement-icon ${isIncrease ? '' : 'down'}">${isIncrease ? '↑' : '↓'}</span>
          <div class="inventory-movement-copy">
            <strong>${label} · ${esc(inventoryProductName(movement.productId))}</strong>
            <small>${sign}${movement.quantity} un · estoque ${movement.stockAfter}</small>
          </div>
          <span class="inventory-movement-time">${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>`;
    }).join('')
    : '<div class="inventory-empty">Nenhuma movimentação registrada.</div>';

  panel.innerHTML = `
    <section class="inventory-summary" aria-label="Resumo do estoque">
      <article class="inventory-summary-card">
        <span class="inventory-summary-icon" aria-hidden="true">◇</span>
        <div class="inventory-summary-copy"><span>Produtos cadastrados</span><strong>${productsCount}</strong><small>itens no catálogo</small></div>
      </article>
      <article class="inventory-summary-card">
        <span class="inventory-summary-icon" aria-hidden="true">▣</span>
        <div class="inventory-summary-copy"><span>Estoque total</span><strong>${stockTotal}</strong><small>unidades disponíveis</small></div>
      </article>
      <article class="inventory-summary-card">
        <span class="inventory-summary-icon" aria-hidden="true">R$</span>
        <div class="inventory-summary-copy"><span>Vendas hoje</span><strong>${money(todayRevenue)}</strong><small>${todayUnits} unidade${todayUnits === 1 ? '' : 's'} vendida${todayUnits === 1 ? '' : 's'}</small></div>
      </article>
      <article class="inventory-summary-card ${lowStock.length ? 'warning' : ''}">
        <span class="inventory-summary-icon" aria-hidden="true">!</span>
        <div class="inventory-summary-copy"><span>Estoque baixo</span><strong>${lowStock.length}</strong><small>produto${lowStock.length === 1 ? '' : 's'} para repor</small></div>
      </article>
    </section>

    <section class="inventory-main-grid">
      <article class="inventory-card">
        <div class="inventory-card-head">
          <div class="inventory-card-title">
            <span aria-hidden="true">◇</span>
            <div><h2>Produtos em estoque</h2><p>Cadastre produtos, acompanhe quantidades e registre saídas.</p></div>
          </div>
          <div class="inventory-toolbar">
            <div class="inventory-search"><span aria-hidden="true">⌕</span><input id="inventorySearch" type="search" value="${esc(inventorySearch)}" placeholder="Buscar produto..." aria-label="Buscar produto"></div>
            <button type="button" class="inventory-new-button" data-inventory-new>＋ Novo produto</button>
          </div>
        </div>
        <div class="inventory-table-wrap">
          <table class="inventory-table">
            <thead><tr><th>Produto</th><th>Categoria</th><th>Estoque</th><th>Preço unitário</th><th>Status</th><th style="text-align:right">Ações</th></tr></thead>
            <tbody id="inventoryTableBody">${inventoryRowsHtml()}</tbody>
          </table>
        </div>
      </article>

      <div class="inventory-side">
        <article class="inventory-card inventory-sale-card">
          <div class="inventory-card-title">
            <span aria-hidden="true">▣</span>
            <div><h2>Registrar venda</h2><p>Selecione o produto e dê baixa automaticamente no estoque.</p></div>
          </div>
          <form id="inventorySaleForm">
            <label>Produto
              <select id="inventorySaleProduct" ${inventoryProducts.length ? '' : 'disabled'}>
                ${inventoryProducts.length
                  ? inventoryProducts.map((product) => `<option value="${product.id}" ${product.id === inventorySaleProductId ? 'selected' : ''}>${esc(product.name)} · ${product.stock} un</option>`).join('')
                  : '<option value="">Nenhum produto cadastrado</option>'}
              </select>
            </label>
            <div class="inventory-sale-grid">
              <label>Quantidade
                <div class="inventory-quantity-control">
                  <button type="button" data-inventory-qty="-1" aria-label="Diminuir quantidade">−</button>
                  <input id="inventorySaleQuantity" type="number" min="1" max="${saleProduct?.stock || 1}" value="${safeQuantity}" ${saleProduct ? '' : 'disabled'}>
                  <button type="button" data-inventory-qty="1" aria-label="Aumentar quantidade">＋</button>
                </div>
              </label>
              <label>Preço unitário
                <span class="inventory-price-readonly" id="inventorySaleUnitPrice">${saleProduct ? money(saleProduct.salePrice) : money(0)}</span>
              </label>
            </div>
            <div class="inventory-sale-total"><span>Total da venda</span><strong id="inventorySaleTotal">${money(saleTotal)}</strong></div>
            <button class="inventory-sale-submit" id="inventorySaleSubmit" type="submit" ${!saleProduct || saleProduct.stock <= 0 ? 'disabled' : ''}>▣ Dar baixa no estoque</button>
            <p class="inventory-sale-hint" id="inventorySaleHint">${saleProduct ? `Estoque disponível: ${saleProduct.stock} unidade${saleProduct.stock === 1 ? '' : 's'}.` : 'Cadastre um produto para registrar vendas.'}</p>
          </form>
        </article>

        <article class="inventory-card inventory-movements">
          <div class="inventory-card-head">
            <div class="inventory-card-title">
              <span aria-hidden="true">◷</span>
              <div><h2>Últimas movimentações</h2><p>Vendas, reposições e ajustes recentes.</p></div>
            </div>
          </div>
          <div class="inventory-movement-list">${movementRows}</div>
        </article>
      </div>
    </section>

    <section class="inventory-dashboard" aria-label="Desempenho do mercadinho">
      <article class="inventory-dashboard-card">
        <div class="inventory-dashboard-head">
          <div><h3>Faturamento do mercadinho</h3><p>Acompanhe o desempenho das vendas.</p></div>
          <div class="inventory-period-tabs" role="tablist" aria-label="Período do dashboard">
            ${['day','week','month'].map((period) => `<button type="button" role="tab" aria-selected="${inventoryPeriod === period}" class="${inventoryPeriod === period ? 'active' : ''}" data-inventory-period="${period}">${{day:'Hoje',week:'Semana',month:'Mês'}[period]}</button>`).join('')}
          </div>
        </div>
        <div class="inventory-revenue"><strong>${money(periodRevenue)}</strong><small>${periodUnits} unidade${periodUnits === 1 ? '' : 's'} · ${periodLabel}</small></div>
        <div class="inventory-chart">
          ${chart.map((item) => `<div class="inventory-chart-bar-wrap" title="${esc(item.label)} · ${money(item.value)}"><i class="inventory-chart-bar" style="height:${Math.max(item.value ? 5 : 0, item.value / chartMax * 100)}%"></i><span>${esc(item.label)}</span></div>`).join('')}
        </div>
        <div class="inventory-chart-labels-space" aria-hidden="true"></div>
      </article>

      <article class="inventory-dashboard-card">
        <div class="inventory-dashboard-head"><div><h3>Produtos mais vendidos</h3><p>Ranking por quantidade · ${periodLabel.toLowerCase()}</p></div></div>
        ${inventoryRankingHtml(ranking.top, 'Nenhuma venda registrada neste período.')}
      </article>

      <article class="inventory-dashboard-card">
        <div class="inventory-dashboard-head"><div><h3>Produtos com menor saída</h3><p>Itens com menor giro · ${periodLabel.toLowerCase()}</p></div></div>
        ${inventoryRankingHtml(ranking.low, 'Cadastre produtos para acompanhar o giro.')}
      </article>

      <article class="inventory-dashboard-card">
        <div class="inventory-dashboard-head"><div><h3>Alertas de estoque baixo</h3><p>Produtos que precisam de reposição.</p></div></div>
        ${lowStock.length ? `<div class="inventory-alert-list">${lowStock.slice().sort((a,b)=>a.stock-b.stock).slice(0,6).map((product) => `
          <div class="inventory-alert-row"><span>⚠ ${esc(product.name)}</span><strong>${product.stock} un</strong></div>`).join('')}</div>` : '<div class="inventory-alert-empty">Estoque em dia. Nenhum alerta agora.</div>'}
      </article>
    </section>`;

  updateInventorySalePreview();
}

function updateInventorySalePreview() {
  const product = inventoryProducts.find((item) => item.id === inventorySaleProductId);
  const quantityInput = $('#inventorySaleQuantity');
  const unitPrice = $('#inventorySaleUnitPrice');
  const total = $('#inventorySaleTotal');
  const submit = $('#inventorySaleSubmit');
  const hint = $('#inventorySaleHint');
  if (!quantityInput || !unitPrice || !total || !submit || !hint) return;

  if (!product) {
    submit.disabled = true;
    total.textContent = money(0);
    unitPrice.textContent = money(0);
    hint.textContent = 'Cadastre um produto para registrar vendas.';
    return;
  }

  inventorySaleQuantity = Math.max(1, Math.min(Number(inventorySaleQuantity || 1), Math.max(product.stock, 1)));
  quantityInput.value = String(inventorySaleQuantity);
  quantityInput.max = String(Math.max(product.stock, 1));
  unitPrice.textContent = money(product.salePrice);
  total.textContent = money(product.salePrice * inventorySaleQuantity);
  submit.disabled = product.stock <= 0 || inventorySaleQuantity > product.stock;
  hint.textContent = product.stock > 0
    ? `Estoque disponível: ${product.stock} unidade${product.stock === 1 ? '' : 's'}.`
    : 'Este produto está sem estoque. Atualize a quantidade antes de registrar uma venda.';
}

function openInventoryProductDialog(productId = null) {
  if (!isAdmin || !arena) return;
  const product = productId ? inventoryProducts.find((item) => item.id === productId) : null;
  inventoryEditingId = product?.id || null;

  $('#inventoryProductForm').reset();
  $('#inventoryProductError').textContent = '';
  $('#inventoryProductDialogTitle').textContent = product ? 'Editar produto' : 'Novo produto';
  $('#inventoryProductDialogIntro').textContent = product
    ? 'Atualize os dados ou escolha um item do catálogo para aproveitar a imagem e a categoria prontas.'
    : 'Pesquise um item do catálogo ou cadastre um produto personalizado para a sua arena.';
  const matchingCatalog = product
    ? INVENTORY_PRODUCT_CATALOG.find((item) =>
        inventoryCatalogNormalize(item.name) === inventoryCatalogNormalize(product.name))
    : null;
  inventoryCatalogSelectionId = matchingCatalog?.id || '';
  $('#inventoryProductName').value = product?.name || '';
  $('#inventoryProductCategory').value = product?.category || '';
  $('#inventoryProductPrice').value = product ? product.salePrice.toFixed(2) : '';
  $('#inventoryProductCost').value = product?.costPrice === null || product?.costPrice === undefined ? '' : product.costPrice.toFixed(2);
  $('#inventoryProductStock').value = String(product?.stock ?? 0);
  $('#inventoryProductThreshold').value = String(product?.lowStockThreshold ?? 5);
  $('#inventoryProductImage').value = '';
  closeInventoryCatalogSuggestions();
  syncInventoryCatalogSelectionStatus();
  renderInventoryImagePreview(product, null, matchingCatalog);
  $('#submitInventoryProduct').textContent = product ? 'Salvar alterações' : 'Salvar produto';
  $('#deleteInventoryProduct').classList.toggle('hidden', !product);
  $('#inventoryProductDialog').showModal();
}


async function setView(nextView) {
  if (!['admin', 'finance', 'inventory', 'master', 'player'].includes(nextView)) return;

  if (nextView === 'master') {
    if (!isPlatformAdmin) return;
    view = 'master';
    try {
      await loadMasterDashboard();
      render();
    } catch (error) {
      console.error(error);
      toast('Não foi possível atualizar o Painel Mestre.');
    }
    return;
  }

  if (nextView !== 'player' && !isAdmin) return;
  if (nextView === 'player' && isAdmin) return;
  if ((nextView === 'admin' || nextView === 'finance' || nextView === 'inventory') && !arena) return;

  if (nextView === 'inventory') {
    view = 'inventory';
    inventoryLoading = true;
    render();
    try {
      await loadInventoryData();
    } catch (error) {
      console.error(error);
      toast('Não foi possível carregar as mercadorias. Tente novamente.');
    } finally {
      inventoryLoading = false;
      render();
    }
    return;
  }

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
  if ($('#weekdayLabel')) $('#weekdayLabel').textContent = weekdayLabel(day);

  const masterMode = view === 'master' && isPlatformAdmin;
  const inventoryMode = view === 'inventory' && isAdmin && Boolean(arena);
  const masterPanel = $('#masterPanel');
  const merchandisePanel = $('#merchandisePanel');
  const partnerSpotlight = $('#partnerSpotlight');
  if (masterPanel) masterPanel.classList.toggle('hidden', !masterMode);
  if (merchandisePanel) merchandisePanel.classList.toggle('hidden', !inventoryMode);
  if (partnerSpotlight) partnerSpotlight.classList.add('hidden');

  if (masterMode) {
    document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === 'master'));
    $('#crumb').textContent = 'Painel Mestre';
    $('#eyebrow').textContent = 'GESTÃO DA PLATAFORMA';
    $('#title').textContent = 'Todas as arenas, em um só lugar.';
    $('#subtitle').textContent = 'Cadastre novas arenas e acompanhe a operação geral do Quadra Aberta.';
    $('#newBooking').classList.add('hidden');
    $('#blockSchedule').classList.add('hidden');
    $('#stats').classList.add('hidden');
    document.querySelector('.workspace').classList.add('hidden');
    $('#blockPanel').classList.add('hidden');
    $('#bottom').hidden = true;
    $('#bottom').style.display = 'none';

    const profitPanel = $('#profitPanel');
    if (profitPanel) {
      profitPanel.style.display = 'none';
      profitPanel.innerHTML = '';
    }

    renderMasterPanel();
    return;
  }

  if (masterPanel) masterPanel.classList.add('hidden');

  if (inventoryMode) {
    document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === 'inventory'));
    $('#crumb').textContent = 'Mercadorias';
    $('#eyebrow').textContent = 'CONTROLE DA ARENA';
    $('#title').textContent = 'Mercadorias da arena';
    $('#subtitle').textContent = 'Controle o estoque, registre vendas e acompanhe o desempenho do mercadinho.';
    $('#newBooking').classList.add('hidden');
    $('#blockSchedule').classList.add('hidden');
    $('#stats').classList.add('hidden');
    document.querySelector('.workspace').classList.add('hidden');
    $('#blockPanel').classList.add('hidden');
    $('#bottom').hidden = true;
    $('#bottom').style.display = 'none';

    const profitPanel = $('#profitPanel');
    if (profitPanel) {
      profitPanel.style.display = 'none';
      profitPanel.innerHTML = '';
    }

    renderMerchandisePanel();
    return;
  }

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
    if (partnerSpotlight) partnerSpotlight.classList.remove('hidden');
    const merchandisePanel = $('#merchandisePanel');
    if (merchandisePanel) merchandisePanel.classList.add('hidden');

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
    return;
  }

  if (partnerSpotlight) partnerSpotlight.classList.add('hidden');
  $('#stats').classList.remove('hidden');
  $('#courtFilter').disabled = false;
  $('#date').disabled = false;
  $('#prevDay').disabled = false;
  $('#nextDay').disabled = false;
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
      const detail = booking
        ? (admin
          ? (booking.status === 'pending' ? 'A confirmar' : booking.paid ? 'Confirmada · Pago' : booking.paidAmount > 0 ? 'Confirmada · Parcial' : 'Confirmada · A pagar')
          : 'Avise-me se liberar')
        : 'Disponível';
      const playerWaitlistClass = booking && !admin ? 'waitlist-slot' : '';
      return `<button class="slot ${booking ? (booking.status === 'pending' ? 'waiting' : 'booked') : ''} ${playerWaitlistClass}" data-court="${court.index}" data-hour="${hour}"><strong>${label}</strong><small>${detail}</small></button>`;
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

function openWaitlistDialog(courtIndex, hour) {
  if (!arena || isAdmin) return;

  const court = courts[courtIndex];
  if (!court) return;

  waitlistSelection = {
    arenaSlug: arena.slug,
    courtIndex,
    courtId: court.id,
    courtName: court.name,
    sport: court.sport,
    date: day,
    hour,
    duration: 1
  };

  $('#waitlistForm').reset();
  $('#waitlistError').textContent = '';
  $('#waitlistInfo').textContent = `${arena.name} · ${court.name} · ${labelDate(day)} · ${hour}:00–${hour + 1}:00`;
  $('#waitlistDialog').showModal();
}

$('#closeWaitlist').onclick = () => {
  waitlistSelection = null;
  $('#waitlistDialog').close();
};

$('#waitlistForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!waitlistSelection) return;

  const name = $('#waitlistName').value.trim();
  const phone = $('#waitlistPhone').value.trim();
  const submitButton = $('#submitWaitlist');

  $('#waitlistError').textContent = '';
  submitButton.disabled = true;
  submitButton.textContent = 'Entrando na lista...';

  try {
    if (name.length < 2) throw new Error('Informe seu nome.');
    if (phone.replace(/\D/g, '').length < 10) throw new Error('Informe um WhatsApp válido com DDD.');

    const { data, error } = await supabase.functions.invoke('join-waitlist', {
      body: {
        arena_slug: waitlistSelection.arenaSlug,
        court_id: waitlistSelection.courtId,
        booking_date: waitlistSelection.date,
        start_hour: waitlistSelection.hour,
        duration: waitlistSelection.duration,
        customer_name: name,
        customer_phone: phone
      }
    });

    if (error || data?.error) {
      let message = data?.error || error?.message || 'Não foi possível entrar na lista de espera.';
      try {
        const body = await error?.context?.json();
        if (body?.error) message = body.error;
      } catch {}
      throw new Error(message);
    }

    const info = waitlistSelection;
    $('#waitlistDialog').close();
    waitlistSelection = null;
    toast(data?.already_waiting
      ? 'Você já está na lista de espera deste horário.'
      : `Tudo certo. Avisaremos no WhatsApp se ${info.hour}:00 liberar.`);
  } catch (error) {
    console.error(error);
    $('#waitlistError').textContent = error.message || 'Não foi possível entrar na lista de espera.';
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Avisar se liberar';
  }
});

function updateHours(preferred) {
  const court = Number($('#bookingCourt').value);
  const duration = Number($('#bookingDuration').value);
  const free = hours.filter((hour) => isAvailable(court, hour, duration));
  const totalAmount = courts[court].price * duration;
  $('#bookingHour').innerHTML = free.length ? free.map((hour) => `<option value="${hour}">${hour}:00 – ${hour + duration}:00</option>`).join('') : '<option value="">Sem horários livres</option>';
  if (free.includes(preferred)) $('#bookingHour').value = String(preferred);
  $('#price').textContent = money(totalAmount);
  const label = document.querySelector('.price-line span');
  if (label) label.textContent = `Total · ${duration} hora${duration > 1 ? 's' : ''}`;
  const paidInput = $('#adminPaidAmount');
  if (paidInput) {
    paidInput.max = totalAmount.toFixed(2);
    const currentPaid = Number(paidInput.value || 0);
    if (currentPaid > totalAmount) paidInput.value = totalAmount.toFixed(2);
  }
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
  $('#adminPaymentField').classList.toggle('hidden', view !== 'admin');
  $('#adminPaidAmount').required = view === 'admin';
  $('#adminPaidAmount').value = '0';
  $('#bookingNote').textContent = view === 'admin'
    ? 'A reserva será adicionada diretamente à agenda. Informe quanto o cliente já pagou.'
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
  $('#bookingNote').textContent = 'Ao alterar o horário, o valor e os pagamentos da reserva permanecem iguais.';

  const paymentAction = !booking.paid && booking.status !== 'pending'
    ? `<button type="button" class="primary" data-action="pay">${receivedAmount > 0 ? 'Registrar saldo como pago' : 'Registrar pagamento integral'}</button>`
    : '';

  $('#dialogActions').innerHTML = (booking.status === 'pending'
    ? '<button type="button" class="primary" data-action="confirm">Confirmar reserva</button>'
    : paymentAction + '<button type="button" class="primary" data-action="reschedule">Alterar horário</button>')
    + '<button type="button" class="secondary danger" data-action="cancel">Cancelar reserva</button>';

  if (!$('#bookingDialog').open) $('#bookingDialog').showModal();
}

const rescheduleLabel = (date, court, hour, duration) =>
  `${labelDate(date)} · ${court.name} · ${hour}:00–${hour + duration}:00`;

async function availableRescheduleHours(date, courtIndex, duration, currentBooking) {
  const court = courts[courtIndex];
  if (!court || !date || ![1, 2, 3].includes(duration)) return [];
  const [bookingResult, blockResult] = await Promise.all([
    supabase.from('bookings')
      .select('id, start_hour, duration')
      .eq('arena_id', arena.id).eq('court_id', court.id).eq('booking_date', date)
      .in('status', ['pending', 'confirmed']),
    supabase.from('schedule_blocks')
      .select('court_id, start_hour, duration')
      .eq('arena_id', arena.id).eq('block_date', date)
      .or(`court_id.is.null,court_id.eq.${court.id}`)
  ]);
  if (bookingResult.error) throw bookingResult.error;
  if (blockResult.error) throw blockResult.error;
  return hours.filter((hour) => {
    if (hour < court.openingHour || hour + duration > court.closingHour) return false;
    const overlaps = (item) => item.start_hour === null ||
      (hour < Number(item.start_hour) + Number(item.duration) && Number(item.start_hour) < hour + duration);
    return !bookingResult.data.some((item) => item.id !== currentBooking.id && overlaps(item)) &&
      !blockResult.data.some(overlaps);
  });
}

async function updateRescheduleHours(preferredHour) {
  const booking = rescheduleBooking;
  if (!booking) return;
  const requestVersion = ++rescheduleLoadVersion;
  const arenaId = arena.id;
  const court = Number($('#rescheduleCourt').value);
  const duration = Number($('#rescheduleDuration').value);
  const date = $('#rescheduleDate').value;
  $('#rescheduleHour').innerHTML = '<option value="">Carregando horários...</option>';
  $('#rescheduleSubmit').disabled = true;
  $('#rescheduleError').textContent = '';
  try {
    const free = await availableRescheduleHours(date, court, duration, booking);
    if (requestVersion !== rescheduleLoadVersion || arena?.id !== arenaId || !$('#rescheduleDialog').open) return;
    $('#rescheduleHour').innerHTML = free.length
      ? free.map((hour) => `<option value="${hour}">${hour}:00 – ${hour + duration}:00</option>`).join('')
      : '<option value="">Sem horários livres</option>';
    if (free.includes(preferredHour)) $('#rescheduleHour').value = String(preferredHour);
    $('#rescheduleSubmit').disabled = !free.length;
  } catch (error) {
    if (requestVersion !== rescheduleLoadVersion) return;
    console.error(error);
    $('#rescheduleHour').innerHTML = '<option value="">Horários indisponíveis</option>';
    $('#rescheduleError').textContent = 'Não foi possível consultar os horários. Tente novamente.';
  }
}

function closeReschedule(reopen = false) {
  const bookingId = rescheduleBooking?.id;
  ++rescheduleLoadVersion;
  $('#rescheduleDialog').close();
  rescheduleBooking = null;
  rescheduleTarget = null;
  if (reopen && bookingId && bookings.some((item) => item.id === bookingId)) openDetail(bookingId);
}

function openReschedule(booking) {
  if (!isAdmin || view !== 'admin' || booking.status !== 'confirmed') return;
  rescheduleBooking = { ...booking, courtId: courts[booking.court].id, arenaId: arena.id };
  rescheduleTarget = null;
  $('#rescheduleTitle').textContent = booking.name;
  $('#rescheduleCurrent').textContent = `Atual: ${rescheduleLabel(booking.date, courts[booking.court], booking.hour, booking.duration)}`;
  // O administrador também pode registrar ou remanejar marcações históricas.
  // O fluxo público continua protegido pelas validações do Pix e do banco.
  $('#rescheduleDate').removeAttribute('min');
  $('#rescheduleDate').value = booking.date;
  $('#rescheduleCourt').innerHTML = courts.map((court, index) =>
    `<option value="${index}">${esc(court.name)} · ${esc(court.sport)}</option>`).join('');
  $('#rescheduleCourt').value = String(booking.court);
  $('#rescheduleDuration').value = String(booking.duration);
  $('#rescheduleFields').classList.remove('hidden');
  $('#rescheduleReview').classList.add('hidden');
  $('#rescheduleNote').textContent = 'Horários livres podem ser escolhidos, inclusive datas anteriores. O valor e os pagamentos registrados permanecem iguais.';
  $('#rescheduleError').textContent = '';
  $('#rescheduleSubmit').textContent = 'Revisar alteração';
  $('#bookingDialog').close();
  $('#rescheduleDialog').showModal();
  updateRescheduleHours(booking.hour);
}

function openCancellationDialog(booking) {
  if (!booking || !isAdmin || view !== 'admin') return;

  pendingCancellationBookingId = booking.id;
  const court = courts[booking.court];
  const totalAmount = bookingTotal(booking);
  const receivedAmount = Number(booking.paidAmount || 0);

  $('#cancelBookingInfo').textContent = `${labelDate(booking.date)} · ${booking.hour}:00–${booking.hour + booking.duration}:00 · ${arena.name}`;
  $('#cancelBookingSummary').innerHTML = `
    <div><span>Responsável</span><strong>${esc(booking.name)}</strong></div>
    <div><span>Quadra</span><strong>${esc(court?.name || 'Quadra')}</strong></div>
    <div><span>Valor da reserva</span><strong>${money(totalAmount)}</strong></div>
    <div><span>Já recebido</span><strong>${money(receivedAmount)}</strong></div>
  `;
  $('#cancelReason').value = '';
  $('#cancelBookingError').textContent = '';
  $('#submitCancelBooking').disabled = false;
  $('#submitCancelBooking').textContent = 'Confirmar cancelamento';

  if ($('#bookingDialog').open) $('#bookingDialog').close();
  if (!$('#cancelBookingDialog').open) $('#cancelBookingDialog').showModal();
  setTimeout(() => $('#cancelReason').focus(), 0);
}

function closeCancellationDialog(reopenBooking = false) {
  const bookingId = pendingCancellationBookingId;
  if ($('#cancelBookingDialog').open) $('#cancelBookingDialog').close();
  pendingCancellationBookingId = null;

  if (reopenBooking && bookingId) {
    const booking = bookings.find((item) => item.id === bookingId);
    if (booking) openDetail(booking.id);
  }
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
  if (readPendingPayment()?.id === booking.id) clearPendingPayment();
  lastPlayerBooking = booking;
  if (booking.reservationToken) rememberReservationForInstall(booking.reservationToken);
  $('#formFields').hidden = true;
  $('#dialogTitle').textContent = 'Sinal confirmado!';
  $('#dialogInfo').textContent = `${labelDate(booking.date)} · ${booking.hour}:00–${booking.hour + booking.duration}:00`;

  const totalAmount = bookingTotal(booking);
  const receivedAmount = Number(booking.paidAmount ?? booking.depositAmount ?? 0);
  const remainingAmount = Math.max(totalAmount - receivedAmount, 0);

  const reservationAccess = booking.reservationToken
    ? `<div class="reservation-link-box"><span>MINHA RESERVA</span><strong>Acompanhe pagamento, horário e dados da sua reserva.</strong><small>Guarde este link. Ele é exclusivo desta reserva.</small></div>`
    : '';

  $('#detailContent').innerHTML = `<div style="background:#eaf3df;border-radius:10px;padding:16px;margin:12px 0 18px"><strong>Reserva confirmada para ${esc(booking.name)}.</strong><p style="margin:8px 0 0;font-size:13px;color:#537047">Recebemos o sinal via Pix e o horário já está garantido na agenda da arena.</p></div>${booking.reservationToken ? pushInvite(booking.id) : ''}<p><strong>Informações do pagamento</strong></p><p>• Valor total da reserva: ${money(totalAmount)}.<br>• Valor recebido: ${money(receivedAmount)}.<br>• Saldo restante: ${money(remainingAmount)}.<br>• Situação: ${remainingAmount > 0 ? 'Pagamento parcial' : 'Pagamento integral'}.</p>${reservationAccess}`;
  $('#price').textContent = money(totalAmount);
  document.querySelector('.price-line span').textContent = `Total · ${durationLabel(booking.duration)}`;
  $('#bookingNote').textContent = booking.reservationToken
    ? 'Use “Minha reserva” para consultar este agendamento novamente e pagar o saldo restante.'
    : 'Reserva confirmada.';
  $('#dialogActions').innerHTML = booking.reservationToken
    ? '<button type="button" class="primary" data-action="my-reservation">Minha reserva</button><button type="button" class="secondary" data-action="copy-reservation-link">Copiar link</button><button type="button" class="secondary" data-action="support">Suporte da arena</button>'
    : '<button type="button" class="primary" data-action="close-confirmation">Concluir</button><button type="button" class="secondary" data-action="support">Suporte da arena</button>';

  if (!$('#bookingDialog').open) $('#bookingDialog').showModal();
  $('#bookingDialog').scrollTop = 0;
}

async function checkPaymentStatus(booking) {
  if (paymentCheckInFlight) return;
  const bookingArenaSlug = booking.arenaSlug || arena?.slug;
  paymentCheckInFlight = true;
  try {
    const { data, error } = await supabase.functions.invoke('check-pix-payment', {
      body: {
        booking_id: booking.id,
        payment_token: booking.paymentToken
      }
    });

    if (bookingArenaSlug !== arena?.slug || lastPlayerBooking?.id !== booking.id) return;
    if (error || !data) {
      const status = $('#detailContent .payment-waiting span:last-child');
      if (status) status.textContent = 'Não foi possível verificar agora. Tentaremos novamente.';
      return;
    }

    if (['partial', 'paid'].includes(data.payment_status) && data.booking_status === 'confirmed') {
      booking.status = 'confirmed';
      booking.paymentStatus = data.payment_status;
      booking.paid = data.payment_status === 'paid';
      booking.paidAmount = Number(data.received_amount ?? booking.depositAmount ?? 0);
      booking.amount = Number(data.total_amount ?? booking.amount);
      try { await refreshBookings(false); } catch (error) { console.error(error); }
      if (bookingArenaSlug === arena?.slug && lastPlayerBooking?.id === booking.id) showConfirmation(booking);
    } else if (data.booking_status === 'cancelled') {
      clearInterval(paymentPollTimer);
      booking.paymentStatus = 'cancelled';
      if (readPendingPayment()?.id === booking.id) clearPendingPayment();
      $('#formError').textContent = 'O Pix expirou e o horário foi liberado. Feche esta janela e tente novamente.';
    } else {
      const status = $('#detailContent .payment-waiting span:last-child');
      if (status) status.textContent = 'Aguardando confirmação do pagamento…';
    }
  } catch (error) {
    console.error(error);
    const status = $('#detailContent .payment-waiting span:last-child');
    if (status) status.textContent = 'Não foi possível verificar agora. Tentaremos novamente.';
  } finally {
    paymentCheckInFlight = false;
  }
}

function resumePendingPayment() {
  if (isAdmin || !arena) return false;
  const saved = readPendingPayment();
  if (!saved || saved.arenaSlug !== arena.slug) return false;
  const court = courts.findIndex((item) => item.id === saved.courtId);
  if (court < 0) return false;

  showPixPayment({
    id: saved.id,
    arenaSlug: saved.arenaSlug,
    court,
    date: saved.date,
    hour: saved.hour,
    duration: saved.duration,
    name: saved.name,
    amount: saved.amount,
    depositAmount: saved.depositAmount,
    paymentToken: saved.paymentToken,
    reservationToken: saved.reservationToken,
    qrCode: saved.qrCode,
    qrCodeBase64: /^[A-Za-z0-9+/=]+$/.test(saved.qrCodeBase64 || '') ? saved.qrCodeBase64 : ''
  });
  return true;
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
  const totalAmount = courts[court]?.price * duration;
  const paidAmount = isAdmin ? Number($('#adminPaidAmount').value) : 0;
  const available = isAvailable(court, hour, duration);
  if (!name) { $('#formError').textContent = 'Informe o nome do responsável.'; return; }
  if (!phone || phone.replace(/\D/g, '').length < 10) { $('#formError').textContent = 'Informe um celular válido com DDD.'; return; }
  if (!isAdmin && !$('#customerEmail').checkValidity()) { $('#formError').textContent = 'Informe um e-mail válido para gerar o Pix.'; return; }
  if (rawHour === '' || !hours.includes(hour) || !courts[court] || !available) { $('#formError').textContent = 'Este horário não está disponível. Escolha outro.'; return; }
  if (isAdmin && (!Number.isFinite(paidAmount) || paidAmount < 0)) { $('#formError').textContent = 'Informe um valor pago válido.'; return; }
  if (isAdmin && paidAmount > totalAmount + Number.EPSILON) { $('#formError').textContent = `O valor pago não pode ser maior que ${money(totalAmount)}.`; return; }

  const submitButton = $('#submitBooking');
  submitButton.disabled = true;
  submitButton.textContent = 'Salvando...';

  try {
    let savedBooking;

    if (isAdmin) {
      const paymentStatus = paidAmount <= 0
        ? 'pending'
        : paidAmount + Number.EPSILON >= totalAmount
          ? 'paid'
          : 'partial';
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
          payment_status: paymentStatus,
          amount: totalAmount,
          deposit_amount: 0,
          payment_received_amount: paidAmount,
          payment_provider: paidAmount > 0 ? 'manual' : null,
          payment_confirmed_at: paidAmount > 0 ? new Date().toISOString() : null
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
        reservationToken: data.reservation_token,
        qrCode: data.qr_code,
        qrCodeBase64: data.qr_code_base64,
        ticketUrl: data.ticket_url
      };
      savePendingPayment(savedBooking);
    }

    await loadBookings();
    render();

    if (isAdmin) {
      $('#bookingDialog').close();
      const paymentMessage = paidAmount <= 0
        ? 'sem pagamento registrado'
        : paidAmount + Number.EPSILON >= totalAmount
          ? 'pagamento integral registrado'
          : `pagamento parcial de ${money(paidAmount)} registrado`;
      toast(`Reserva confirmada e salva na agenda · ${paymentMessage}.`);
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
  if (action === 'dismiss-push') {
    actionButton.closest('.push-invite')?.remove();
    return;
  }
  if (action === 'install-app') {
    actionButton.disabled = true;
    try {
      const accepted = await promptInstall();
      refreshPushInvites();
      const feedback = $('#bookingDialog .push-invite-feedback');
      if (feedback) feedback.textContent = accepted
        ? 'Instalação aceita. Abra o app pela tela inicial e ative as notificações.'
        : 'Você pode instalar mais tarde pelo menu do navegador.';
    } catch {
      const feedback = $('#bookingDialog .push-invite-feedback');
      if (feedback) feedback.textContent = 'Não foi possível abrir a instalação. Tente pelo menu do navegador.';
    } finally { actionButton.disabled = false; }
    return;
  }
  if (action === 'player-push' && lastPlayerBooking?.reservationToken) {
    actionButton.disabled = true;
    try {
      const enabled = await togglePush(supabase, {
        role: 'player', id: lastPlayerBooking.id,
        reservationToken: lastPlayerBooking.reservationToken,
      });
      let confirmationShown = false;
      if (enabled) {
        try {
          confirmationShown = await showBookingConfirmationNotification({
            id: lastPlayerBooking.id, arenaName: arena.name,
            courtName: courts[lastPlayerBooking.court]?.name,
            date: lastPlayerBooking.date, hour: lastPlayerBooking.hour,
            url: reservationUrl(lastPlayerBooking.reservationToken),
          });
        } catch (error) { console.error('Falha ao exibir confirmação:', error); }
      }
      refreshPushInvites();
      const feedback = $('#bookingDialog .push-invite-feedback');
      if (feedback) feedback.textContent = enabled
        ? `${confirmationShown ? 'Confirmação enviada!' : 'Avisos ativados.'} Você receberá o lembrete 2 horas antes do jogo, se houver tempo.`
        : 'Avisos desativados neste aparelho.';
    } catch (error) {
      const feedback = $('#bookingDialog .push-invite-feedback');
      if (feedback) feedback.textContent = error.message;
    }
    finally { actionButton.disabled = false; }
    return;
  }
  if (action === 'close-confirmation') { $('#bookingDialog').close(); return; }
  if (action === 'support') { openArenaSupport(); return; }
  if (action === 'my-reservation') {
    if (!lastPlayerBooking?.reservationToken) return;
    window.location.href = reservationUrl(lastPlayerBooking.reservationToken);
    return;
  }
  if (action === 'copy-reservation-link') {
    if (!lastPlayerBooking?.reservationToken) return;
    const link = reservationUrl(lastPlayerBooking.reservationToken);
    try {
      await navigator.clipboard.writeText(link);
      actionButton.textContent = 'Link copiado!';
      toast('Link da reserva copiado.');
    } catch {
      window.prompt('Copie o link da sua reserva:', link);
    }
    return;
  }
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
    openCancellationDialog(booking);
    return;
  }

  if (action === 'reschedule') {
    openReschedule(booking);
    return;
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

['rescheduleDate', 'rescheduleCourt', 'rescheduleDuration'].forEach((id) => {
  $(`#${id}`).addEventListener('change', () => updateRescheduleHours(Number($('#rescheduleHour').value)));
});

$('#closeReschedule').onclick = () => closeReschedule();
$('#rescheduleDialog').addEventListener('close', () => {
  ++rescheduleLoadVersion;
  rescheduleBooking = null;
  rescheduleTarget = null;
});
$('#rescheduleBack').onclick = () => {
  if (rescheduleTarget) {
    rescheduleTarget = null;
    $('#rescheduleFields').classList.remove('hidden');
    $('#rescheduleReview').classList.add('hidden');
    $('#rescheduleSubmit').textContent = 'Revisar alteração';
    $('#rescheduleNote').textContent = 'Horários livres podem ser escolhidos, inclusive datas anteriores. O valor e os pagamentos registrados permanecem iguais.';
    $('#rescheduleError').textContent = '';
  } else {
    closeReschedule(true);
  }
};

$('#rescheduleForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const booking = rescheduleBooking;
  if (!booking || !isAdmin || view !== 'admin' || arena?.id !== booking.arenaId) return;

  const submit = $('#rescheduleSubmit');
  submit.disabled = true;
  $('#rescheduleError').textContent = '';

  try {
    const target = rescheduleTarget || {
      date: $('#rescheduleDate').value,
      court: Number($('#rescheduleCourt').value),
      hour: Number($('#rescheduleHour').value),
      duration: Number($('#rescheduleDuration').value)
    };
    if (!target.date || !$('#rescheduleHour').value || !courts[target.court] ||
        ![1, 2, 3].includes(target.duration) || !hours.includes(target.hour)) {
      throw new Error('Selecione um horário válido para a nova reserva.');
    }
    if (target.date === booking.date && courts[target.court].id === booking.courtId &&
        target.hour === booking.hour && target.duration === booking.duration) {
      throw new Error('Escolha uma data, quadra, horário ou duração diferente.');
    }

    const free = await availableRescheduleHours(target.date, target.court, target.duration, booking);
    if (arena?.id !== booking.arenaId || rescheduleBooking?.id !== booking.id) return;
    if (!free.includes(target.hour)) {
      rescheduleTarget = null;
      $('#rescheduleFields').classList.remove('hidden');
      $('#rescheduleReview').classList.add('hidden');
      await updateRescheduleHours(target.hour);
      throw new Error('Esse horário não está mais disponível. Escolha outro.');
    }

    if (!rescheduleTarget) {
      rescheduleTarget = target;
      $('#rescheduleReview').innerHTML = `
        <span>ANTES</span><strong>${esc(rescheduleLabel(booking.date, courts[booking.court], booking.hour, booking.duration))}</strong>
        <span>DEPOIS</span><strong>${esc(rescheduleLabel(target.date, courts[target.court], target.hour, target.duration))}</strong>`;
      $('#rescheduleFields').classList.add('hidden');
      $('#rescheduleReview').classList.remove('hidden');
      $('#rescheduleNote').textContent = 'Confirma a mudança? O valor total e os pagamentos da reserva permanecem iguais.';
      $('#rescheduleSubmit').textContent = 'Confirmar alteração';
      return;
    }

    const { data, error } = await supabase.from('bookings')
      .update({ booking_date: target.date, court_id: courts[target.court].id,
        start_hour: target.hour, duration: target.duration })
      .eq('id', booking.id).eq('arena_id', booking.arenaId)
      .eq('booking_date', booking.date).eq('court_id', booking.courtId)
      .eq('start_hour', booking.hour).eq('duration', booking.duration)
      .eq('status', 'confirmed').select('id');
    if (error) throw error;
    if (!data?.length) throw new Error('A reserva mudou enquanto você editava. Atualize a agenda e tente novamente.');

    closeReschedule();
    day = target.date;
    await refreshBookings(false);
    toast('Horário da reserva alterado com sucesso.');
  } catch (error) {
    console.error(error);
    $('#rescheduleError').textContent = error.code === '23P01'
      ? 'Esse horário acabou de ser reservado. Escolha outro.'
      : error.message || 'Não foi possível alterar o horário.';
  } finally {
    submit.disabled = false;
  }
});

$('#cancelBookingForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!isAdmin || view !== 'admin' || !pendingCancellationBookingId) return;

  const booking = bookings.find((item) => item.id === pendingCancellationBookingId);
  const reason = $('#cancelReason').value.trim();
  const submitButton = $('#submitCancelBooking');
  $('#cancelBookingError').textContent = '';

  if (!booking) {
    $('#cancelBookingError').textContent = 'A reserva não está mais disponível para cancelamento.';
    return;
  }

  if (reason.length < 5) {
    $('#cancelBookingError').textContent = 'Informe o motivo do cancelamento com pelo menos 5 caracteres.';
    $('#cancelReason').focus();
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = 'Cancelando...';

  try {
    const { error } = await supabase.rpc('cancel_booking_with_reason', {
      p_booking_id: booking.id,
      p_reason: reason
    });

    if (error) throw error;

    closeCancellationDialog(false);
    selectedId = null;
    await refreshBookings(false);
    toast('Reserva cancelada. Motivo registrado no histórico financeiro.');
  } catch (error) {
    console.error(error);
    $('#cancelBookingError').textContent = error.message || 'Não foi possível cancelar a reserva.';
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Confirmar cancelamento';
  }
});

$('#closeCancelBookingDialog').onclick = () => closeCancellationDialog(true);
$('#backCancelBooking').onclick = () => closeCancellationDialog(true);

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
  adminNotifications.reset();
  await supabase.auth.signOut();
  isAdmin = false;
  isPlatformAdmin = false;
  masterArenas = [];
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

const merchandisePanel = $('#merchandisePanel');
if (merchandisePanel) {
  merchandisePanel.addEventListener('input', (event) => {
    if (event.target.id === 'inventorySearch') {
      inventorySearch = event.target.value;
      const body = $('#inventoryTableBody');
      if (body) body.innerHTML = inventoryRowsHtml();
      return;
    }

    if (event.target.id === 'inventorySaleQuantity') {
      inventorySaleQuantity = Number(event.target.value || 1);
      updateInventorySalePreview();
    }
  });

  merchandisePanel.addEventListener('change', (event) => {
    if (event.target.id === 'inventorySaleProduct') {
      inventorySaleProductId = event.target.value;
      inventorySaleQuantity = 1;
      updateInventorySalePreview();
    }
  });

  merchandisePanel.addEventListener('click', (event) => {
    const newButton = event.target.closest('[data-inventory-new]');
    if (newButton) {
      openInventoryProductDialog();
      return;
    }

    const editButton = event.target.closest('[data-inventory-edit]');
    if (editButton) {
      openInventoryProductDialog(editButton.dataset.inventoryEdit);
      return;
    }

    const saleButton = event.target.closest('[data-inventory-sale-product]');
    if (saleButton && !saleButton.disabled) {
      inventorySaleProductId = saleButton.dataset.inventorySaleProduct;
      inventorySaleQuantity = 1;
      renderMerchandisePanel();
      $('#inventorySaleProduct')?.focus();
      return;
    }

    const periodButton = event.target.closest('[data-inventory-period]');
    if (periodButton) {
      inventoryPeriod = periodButton.dataset.inventoryPeriod;
      renderMerchandisePanel();
      return;
    }

    const quantityButton = event.target.closest('[data-inventory-qty]');
    if (quantityButton) {
      const product = inventoryProducts.find((item) => item.id === inventorySaleProductId);
      if (!product) return;
      inventorySaleQuantity = Math.max(1, Math.min(
        inventorySaleQuantity + Number(quantityButton.dataset.inventoryQty),
        Math.max(product.stock, 1)
      ));
      updateInventorySalePreview();
    }
  });

  merchandisePanel.addEventListener('submit', async (event) => {
    if (event.target.id !== 'inventorySaleForm') return;
    event.preventDefault();
    if (!isAdmin || view !== 'inventory' || !arena) return;

    const product = inventoryProducts.find((item) => item.id === inventorySaleProductId);
    if (!product) {
      toast('Selecione um produto.');
      return;
    }

    const quantity = Math.max(1, Math.floor(Number(inventorySaleQuantity || 1)));
    const submit = $('#inventorySaleSubmit');
    submit.disabled = true;
    submit.textContent = 'Registrando venda...';

    try {
      const { error } = await supabase.rpc('register_inventory_sale', {
        target_product_id: product.id,
        target_quantity: quantity
      });
      if (error) throw error;

      await loadInventoryData();
      render();
      toast(`Venda registrada · ${quantity} ${quantity === 1 ? 'unidade' : 'unidades'} de ${product.name}.`);
    } catch (error) {
      console.error(error);
      toast(error.message || 'Não foi possível registrar a venda.');
      submit.disabled = false;
      submit.textContent = '▣ Dar baixa no estoque';
    }
  });
}

$('#closeInventoryProduct').onclick = () => $('#inventoryProductDialog').close();

$('#deleteInventoryProduct').onclick = () => {
  if (!inventoryEditingId || !isAdmin || !arena) return;
  const product = inventoryProducts.find((item) => item.id === inventoryEditingId);
  if (!product) return;

  $('#deleteInventoryProductError').textContent = '';
  $('#deleteInventoryProductMessage').textContent =
    `Tem certeza que deseja excluir “${product.name}” do estoque?`;
  $('#deleteInventoryProductDialog').showModal();
};

$('#cancelDeleteInventoryProduct').onclick = () => {
  $('#deleteInventoryProductDialog').close();
};

$('#confirmDeleteInventoryProduct').onclick = async () => {
  if (!inventoryEditingId || !isAdmin || !arena) return;

  const product = inventoryProducts.find((item) => item.id === inventoryEditingId);
  if (!product) {
    $('#deleteInventoryProductDialog').close();
    return;
  }

  const productId = product.id;
  const productName = product.name;
  const confirmButton = $('#confirmDeleteInventoryProduct');
  const cancelButton = $('#cancelDeleteInventoryProduct');

  $('#deleteInventoryProductError').textContent = '';
  confirmButton.disabled = true;
  cancelButton.disabled = true;
  confirmButton.textContent = 'Excluindo...';

  try {
    const { error } = await supabase
      .from('inventory_products')
      .update({ active: false })
      .eq('id', productId)
      .eq('arena_id', arena.id)
      .eq('active', true);

    if (error) throw error;

    if (inventorySaleProductId === productId) {
      inventorySaleProductId = '';
      inventorySaleQuantity = 1;
    }

    $('#deleteInventoryProductDialog').close();
    $('#inventoryProductDialog').close();
    await loadInventoryData();
    render();
    toast(`${productName} foi excluído do estoque.`);
  } catch (error) {
    console.error(error);
    $('#deleteInventoryProductError').textContent =
      error.message || 'Não foi possível excluir o produto. Tente novamente.';
  } finally {
    confirmButton.disabled = false;
    cancelButton.disabled = false;
    confirmButton.textContent = 'Sim, excluir produto';
  }
};

$('#inventoryProductName').addEventListener('focus', (event) => {
  renderInventoryCatalogSuggestions(event.target.value);
});

$('#inventoryProductName').addEventListener('input', (event) => {
  const selected = selectedInventoryCatalogProduct();
  if (!selected || inventoryCatalogNormalize(event.target.value) !== inventoryCatalogNormalize(selected.name)) {
    inventoryCatalogSelectionId = '';
    syncInventoryCatalogSelectionStatus();
    const editingProduct = inventoryEditingId
      ? inventoryProducts.find((item) => item.id === inventoryEditingId)
      : null;
    if (!$('#inventoryProductImage').files?.[0]) renderInventoryImagePreview(editingProduct);
  }
  renderInventoryCatalogSuggestions(event.target.value);
});

$('#inventoryCatalogSuggestions').addEventListener('mousedown', (event) => {
  if (event.target.closest('[data-inventory-catalog-id]')) event.preventDefault();
});

$('#inventoryCatalogSuggestions').addEventListener('click', (event) => {
  const option = event.target.closest('[data-inventory-catalog-id]');
  if (!option) return;
  selectInventoryCatalogProduct(option.dataset.inventoryCatalogId);
  $('#inventoryProductPrice').focus();
});

document.addEventListener('click', (event) => {
  const field = event.target.closest('.inventory-product-catalog-field');
  if (!field) closeInventoryCatalogSuggestions();
});

$('#inventoryProductImage').addEventListener('change', (event) => {
  const file = event.target.files?.[0] || null;
  const product = inventoryEditingId
    ? inventoryProducts.find((item) => item.id === inventoryEditingId)
    : null;

  if (!file) {
    renderInventoryImagePreview(product, null, selectedInventoryCatalogProduct());
    return;
  }

  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    event.target.value = '';
    $('#inventoryProductError').textContent = 'Use uma imagem JPG, PNG ou WebP.';
    renderInventoryImagePreview(product, null, selectedInventoryCatalogProduct());
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    event.target.value = '';
    $('#inventoryProductError').textContent = 'A foto deve ter no máximo 5 MB.';
    renderInventoryImagePreview(product, null, selectedInventoryCatalogProduct());
    return;
  }

  $('#inventoryProductError').textContent = '';
  renderInventoryImagePreview(product, file);
});

$('#inventoryProductDialog').addEventListener('close', () => {
  clearInventoryImagePreviewObjectUrl();
  closeInventoryCatalogSuggestions();
  inventoryCatalogSelectionId = '';
  inventoryEditingId = null;
  $('#inventoryProductError').textContent = '';
  $('#inventoryProductImage').value = '';
  $('#deleteInventoryProduct').classList.add('hidden');
});

$('#inventoryProductForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!isAdmin || !arena) return;

  const submit = $('#submitInventoryProduct');
  const salePrice = Number($('#inventoryProductPrice').value);
  const costRaw = $('#inventoryProductCost').value.trim();
  const costPrice = costRaw === '' ? null : Number(costRaw);
  const stock = Math.floor(Number($('#inventoryProductStock').value));
  const threshold = Math.floor(Number($('#inventoryProductThreshold').value));

  $('#inventoryProductError').textContent = '';
  submit.disabled = true;
  submit.textContent = 'Salvando...';

  try {
    if (!Number.isFinite(salePrice) || salePrice < 0) throw new Error('Informe um preço de venda válido.');
    if (costPrice !== null && (!Number.isFinite(costPrice) || costPrice < 0)) throw new Error('Informe um custo válido.');
    if (!Number.isInteger(stock) || stock < 0) throw new Error('Informe uma quantidade de estoque válida.');
    if (!Number.isInteger(threshold) || threshold < 0) throw new Error('Informe um limite de estoque baixo válido.');

    const edited = Boolean(inventoryEditingId);
    const imageFile = $('#inventoryProductImage').files?.[0] || null;

    const { data: savedProductId, error } = await supabase.rpc('save_inventory_product', {
      target_arena_id: arena.id,
      target_name: $('#inventoryProductName').value.trim(),
      target_category: $('#inventoryProductCategory').value.trim(),
      target_sale_price: salePrice,
      target_cost_price: costPrice,
      target_stock_quantity: stock,
      target_low_stock_threshold: threshold,
      target_product_id: inventoryEditingId
    });

    if (error) throw error;

    const productId = savedProductId || inventoryEditingId;
    if (!inventoryEditingId && productId) inventoryEditingId = productId;

    const catalogProduct = selectedInventoryCatalogProduct();
    if (catalogProduct && productId) {
      const { error: catalogImageError } = await supabase
        .from('inventory_products')
        .update({ image_url: catalogProduct.imageUrl })
        .eq('id', productId)
        .eq('arena_id', arena.id);
      if (catalogImageError) throw catalogImageError;
    }

    if (imageFile && productId) {
      submit.textContent = 'Enviando foto...';
      try {
        await uploadInventoryProductImage(productId, imageFile);
      } catch (imageError) {
        console.error(imageError);
        await loadInventoryData();
        render();
        $('#inventoryProductError').textContent =
          'O produto foi salvo, mas não foi possível enviar a foto. Selecione a imagem novamente e tente salvar.';
        return;
      }
    }

    $('#inventoryProductDialog').close();
    await loadInventoryData();
    render();
    toast(edited ? 'Produto atualizado com sucesso.' : 'Produto cadastrado com sucesso.');
  } catch (error) {
    console.error(error);
    $('#inventoryProductError').textContent = error.message || 'Não foi possível salvar o produto.';
  } finally {
    submit.disabled = false;
    submit.textContent = inventoryEditingId ? 'Salvar alterações' : 'Salvar produto';
  }
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

  if (booking && !isAdmin) {
    openWaitlistDialog(court, hour);
    return;
  }

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
$('#adminLogin').onclick = () => {
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

    const entered = await enterAdminPanelForUser(data.user.id);

    if (!entered) {
      await supabase.auth.signOut();
      throw new Error('Este usuário não possui uma arena administrativa vinculada.');
    }

    $('#loginDialog').close();
    toast(`Acesso administrativo da ${arena.name} iniciado.`);
  } catch (error) {
    console.error(error);
    $('#loginError').textContent = error.message || 'E-mail ou senha inválidos.';
  }
});

$('#adminLogout').onclick = async () => {
  adminNotifications.reset();
  await supabase.auth.signOut();
  isAdmin = false;
  isPlatformAdmin = false;
  masterArenas = [];
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

    const entered = await enterAdminPanelForUser(data.user.id);
    if (!entered) throw new Error('Este usuário não possui uma arena administrativa vinculada.');

    $('#passwordDialog').close();
    history.replaceState(null, '', window.location.pathname + window.location.search);
    toast(`Senha criada. Acesso administrativo da ${arena.name} iniciado.`);
  } catch (error) {
    console.error(error);
    $('#passwordError').textContent = error.message || 'Não foi possível salvar a senha.';
  }
});

async function switchArena(nextSlug, { silent = false } = {}) {
  const previousSlug = arena?.slug || activeArenaSlug || '';

  if (!nextSlug) {
    adminNotifications.reset();
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

  adminNotifications.reset();
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
    const resumed = resumePendingPayment();
    if (!silent && !resumed) toast(`Agenda da ${arena.name} carregada.`);
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

$('#openNewArena').onclick = () => {
  if (!isPlatformAdmin) return;
  $('#newArenaForm').reset();
  $('#newArenaCity').value = 'Porto Velho, RO';
  $('#newArenaCourtCount').value = '3';
  $('#newArenaSport').value = 'Vôlei';
  $('#newArenaPrice').value = '100';
  $('#newArenaOpening').value = '14';
  $('#newArenaClosing').value = '23';
  $('#newArenaError').textContent = '';
  $('#newArenaDialog').showModal();
};

$('#closeNewArena').onclick = () => $('#newArenaDialog').close();

$('#refreshMaster').onclick = async () => {
  if (!isPlatformAdmin) return;
  try {
    await loadMasterDashboard();
    render();
    toast('Painel Mestre atualizado.');
  } catch (error) {
    console.error(error);
    toast('Não foi possível atualizar o Painel Mestre.');
  }
};

$('#newArenaForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!isPlatformAdmin) return;

  const submitButton = $('#submitNewArena');
  const courtCount = Number($('#newArenaCourtCount').value);
  const sport = $('#newArenaSport').value.trim();
  const hourlyPrice = Number($('#newArenaPrice').value);
  const openingHour = Number($('#newArenaOpening').value);
  const closingHour = Number($('#newArenaClosing').value);

  $('#newArenaError').textContent = '';
  submitButton.disabled = true;
  submitButton.textContent = 'Criando arena...';

  try {
    if (!Number.isInteger(courtCount) || courtCount < 1 || courtCount > 20) {
      throw new Error('Informe uma quantidade de quadras entre 1 e 20.');
    }

    const courtsPayload = Array.from({ length: courtCount }, (_, index) => ({
      name: `Quadra ${String(index + 1).padStart(2, '0')}`,
      sport,
      hourlyPrice,
      openingHour,
      closingHour
    }));

    const { data, error } = await supabase.functions.invoke('create-arena', {
      body: {
        name: $('#newArenaName').value.trim(),
        city: $('#newArenaCity').value.trim(),
        address: $('#newArenaAddress').value.trim(),
        whatsapp: $('#newArenaWhatsapp').value.trim(),
        adminEmail: $('#newArenaAdminEmail').value.trim().toLowerCase(),
        adminPassword: $('#newArenaAdminPassword').value,
        courts: courtsPayload
      }
    });

    if (error) {
      let message = error.message || 'Não foi possível cadastrar a arena.';
      try {
        const body = await error.context?.json();
        if (body?.error) message = body.error;
      } catch {}
      throw new Error(message);
    }

    if (data?.error) throw new Error(data.error);

    $('#newArenaDialog').close();
    await loadArenaCatalog();
    await loadMasterDashboard();
    render();
    toast(`${data?.arena?.name || 'Arena'} cadastrada com sucesso.`);
  } catch (error) {
    console.error(error);
    $('#newArenaError').textContent = error.message || 'Não foi possível cadastrar a arena.';
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Criar arena';
  }
});

$('#arenaSelect').addEventListener('change', (event) => {
  switchArena(event.target.value);
});

$('#arenaSelectTrigger').addEventListener('click', (event) => {
  event.stopPropagation();
  toggleArenaPicker();
});

const brandHome = document.querySelector('aside .brand');
if (brandHome) {
  brandHome.addEventListener('click', (event) => {
    event.preventDefault();
    if (isAdmin) return;
    closeArenaPicker();
    switchArena('');
  });
}

$('#arenaSelectMenu').addEventListener('click', (event) => {
  const option = event.target.closest('[data-arena-slug]');
  if (!option) return;

  const slug = option.dataset.arenaSlug;
  const select = $('#arenaSelect');
  if (select) {
    select.value = slug;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }
  closeArenaPicker();
});

document.addEventListener('click', (event) => {
  const picker = $('#arenaPicker');
  if (picker && !picker.contains(event.target)) closeArenaPicker();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeArenaPicker();
});

function reservationWhatsappDigits(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits && digits.length <= 11) digits = '55' + digits;
  return digits;
}

function reservationStatusLabel(status) {
  return {
    pending: 'Aguardando confirmação',
    confirmed: 'Confirmada',
    cancelled: 'Cancelada'
  }[status] || status;
}

function reservationPaymentLabel(status) {
  return {
    pending: 'Aguardando sinal',
    partial: 'Pagamento parcial',
    paid: 'Pagamento integral'
  }[status] || status;
}

function reservationPaymentClass(status) {
  if (status === 'paid') return 'paid';
  if (status === 'partial') return 'partial';
  return 'pending';
}

function renderReservationPortal(reservation) {
  reservationPortalData = reservation;
  const content = $('#reservationPortalContent');
  if (!content) return;

  const total = Number(reservation.total_amount || 0);
  const received = Number(reservation.received_amount || 0);
  const remaining = Number(reservation.remaining_amount || 0);
  const cancelled = reservation.status === 'cancelled';
  const fullyPaid = reservation.payment_status === 'paid';
  const canPayBalance = !cancelled && reservation.status === 'confirmed' && reservation.payment_status === 'partial' && remaining > 0.001;
  const balancePayment = reservation.balance_payment;
  const progress = total > 0 ? Math.max(0, Math.min(100, Math.round(received / total * 100))) : 0;

  const balancePanel = balancePayment && canPayBalance ? `
    <section class="reservation-balance-box">
      <div class="reservation-section-title">
        <div>
          <span>PAGAMENTO DO SALDO</span>
          <h2>Finalize sua reserva via Pix</h2>
        </div>
        <strong>${money(Number(balancePayment.amount || remaining))}</strong>
      </div>
      ${balancePayment.qr_code_base64 ? `<img class="reservation-qr" src="data:image/png;base64,${balancePayment.qr_code_base64}" alt="QR Code Pix do saldo restante">` : ''}
      <div class="reservation-pix-copy">
        <input id="reservationPixCode" readonly value="${esc(balancePayment.qr_code || '')}" aria-label="Pix copia e cola do saldo restante">
        <button type="button" class="secondary" data-reservation-action="copy-balance-pix">Copiar Pix</button>
      </div>
      ${balancePayment.ticket_url ? `<a class="reservation-mp-link" href="${esc(balancePayment.ticket_url)}" target="_blank" rel="noopener noreferrer">Abrir pagamento no Mercado Pago ↗</a>` : ''}
      <div class="payment-waiting"><span class="payment-dot"></span><span>Aguardando confirmação do saldo restante…</span></div>
    </section>
  ` : '';

  content.innerHTML = `
    <div class="reservation-hero">
      <div>
        <span class="reservation-kicker">MINHA RESERVA</span>
        <h1>${cancelled ? 'Esta reserva foi cancelada.' : 'Seu horário está aqui.'}</h1>
        <p>${esc(reservation.arena.name)} · ${esc(reservation.court.name)} · ${esc(reservation.court.sport)}</p>
      </div>
      <span class="reservation-status-badge ${cancelled ? 'cancelled' : 'confirmed'}">${esc(reservationStatusLabel(reservation.status))}</span>
    </div>

    <div class="reservation-layout">
      <section class="reservation-main-card">
        <div class="reservation-date-block">
          <span>DATA E HORÁRIO</span>
          <strong>${esc(fullDateLabel(reservation.booking_date))}</strong>
          <small>${reservation.start_hour}:00 às ${reservation.start_hour + reservation.duration}:00 · ${durationLabel(reservation.duration)}</small>
        </div>

        <div class="reservation-detail-grid">
          <div><span>Arena</span><strong>${esc(reservation.arena.name)}</strong><small>${esc(reservation.arena.city || '')}</small></div>
          <div><span>Quadra</span><strong>${esc(reservation.court.name)}</strong><small>${esc(reservation.court.sport)}</small></div>
          <div><span>Responsável</span><strong>${esc(reservation.customer_name)}</strong><small>Reserva identificada pelo link exclusivo</small></div>
          <div><span>Status</span><strong>${esc(reservationStatusLabel(reservation.status))}</strong><small>${cancelled ? 'Horário liberado na agenda' : 'Horário vinculado à sua reserva'}</small></div>
        </div>

        <div class="reservation-location">
          <span>LOCALIZAÇÃO</span>
          <strong>${esc(reservation.arena.address || reservation.arena.city || '')}</strong>
        </div>
      </section>

      <aside class="reservation-payment-card">
        <span class="reservation-kicker">PAGAMENTO</span>
        <div class="reservation-payment-status ${reservationPaymentClass(reservation.payment_status)}">${esc(reservationPaymentLabel(reservation.payment_status))}</div>
        <div class="reservation-money-row"><span>Valor total</span><strong>${money(total)}</strong></div>
        <div class="reservation-money-row"><span>Valor pago</span><strong>${money(received)}</strong></div>
        <div class="reservation-money-row remaining"><span>Saldo restante</span><strong>${money(remaining)}</strong></div>
        <div class="reservation-progress"><span style="width:${progress}%"></span></div>
        <small>${fullyPaid ? 'Pagamento concluído.' : cancelled ? 'Consulte a arena sobre valores já pagos.' : 'O saldo pode ser quitado diretamente por aqui.'}</small>

        <div class="reservation-actions">
          ${canPayBalance && !balancePayment ? '<button class="primary" type="button" data-reservation-action="pay-balance">Pagar saldo restante via Pix</button>' : ''}
          ${!cancelled ? pushInvite(reservation.id, true) : ''}
          <button class="secondary" type="button" data-reservation-action="support">Falar com a arena</button>
          ${!cancelled ? '<button class="text-action reservation-cancel-link" type="button" data-reservation-action="cancel-request">Solicitar cancelamento</button>' : ''}
        </div>
      </aside>
    </div>

    ${balancePanel}

    <div class="reservation-note">
      <strong>Sobre cancelamentos</strong>
      <p>Nesta versão, o cancelamento é solicitado diretamente à arena pelo WhatsApp. Quando definirmos a política de prazo, poderemos automatizar essa etapa.</p>
    </div>
  `;

  clearInterval(reservationPortalTimer);
  if (balancePayment && canPayBalance) {
    reservationPortalTimer = setInterval(() => checkReservationBalancePayment(false), 3500);
    checkReservationBalancePayment(false);
  }
}

async function loadReservationPortal(showLoading = true) {
  const content = $('#reservationPortalContent');
  if (showLoading && content) {
    content.innerHTML = '<div class="reservation-loading"><span class="payment-dot"></span><strong>Carregando sua reserva…</strong></div>';
  }

  const { data, error } = await supabase.functions.invoke('get-reservation', {
    body: { token: reservationTokenFromUrl }
  });

  if (error || data?.error || !data?.reservation) {
    let message = data?.error || error?.message || 'Não foi possível localizar esta reserva.';
    try {
      const body = await error?.context?.json();
      if (body?.error) message = body.error;
    } catch {}
    throw new Error(message);
  }

  renderReservationPortal(data.reservation);
  return data.reservation;
}

async function checkReservationBalancePayment(showError = true) {
  if (!reservationTokenFromUrl) return;

  try {
    const { data, error } = await supabase.functions.invoke('check-reservation-balance-payment', {
      body: { token: reservationTokenFromUrl }
    });

    if (error || data?.error) throw new Error(data?.error || error?.message || 'Falha ao verificar pagamento.');

    if (data?.payment_status === 'paid') {
      clearInterval(reservationPortalTimer);
      reservationPortalTimer = null;
      await loadReservationPortal(false);
      const portalToast = $('#reservationPortalToast');
      if (portalToast) {
        portalToast.textContent = 'Pagamento integral confirmado!';
        portalToast.classList.add('show');
        setTimeout(() => portalToast.classList.remove('show'), 4200);
      }
    } else if (data?.expired) {
      clearInterval(reservationPortalTimer);
      reservationPortalTimer = null;
      await loadReservationPortal(false);
    }
  } catch (error) {
    console.error(error);
    if (showError) {
      const portalError = $('#reservationPortalError');
      if (portalError) portalError.textContent = error.message || 'Não foi possível verificar o pagamento.';
    }
  }
}

async function createReservationBalancePayment() {
  const button = document.querySelector('[data-reservation-action="pay-balance"]');
  if (button) {
    button.disabled = true;
    button.textContent = 'Gerando Pix...';
  }

  try {
    const { data, error } = await supabase.functions.invoke('create-reservation-balance-pix', {
      body: { token: reservationTokenFromUrl }
    });

    if (error || data?.error) {
      let message = data?.error || error?.message || 'Não foi possível gerar o Pix.';
      try {
        const body = await error?.context?.json();
        if (body?.error) message = body.error;
      } catch {}
      throw new Error(message);
    }

    await loadReservationPortal(false);
  } catch (error) {
    console.error(error);
    const portalError = $('#reservationPortalError');
    if (portalError) portalError.textContent = error.message || 'Não foi possível gerar o Pix do saldo.';
    if (button) {
      button.disabled = false;
      button.textContent = 'Pagar saldo restante via Pix';
    }
  }
}

function openReservationWhatsapp(kind = 'support') {
  const reservation = reservationPortalData;
  if (!reservation) return;

  const whatsapp = reservationWhatsappDigits(reservation.arena.whatsapp);
  if (!whatsapp) return;

  const context = `${reservation.arena.name} · ${reservation.court.name} · ${labelDate(reservation.booking_date)} · ${reservation.start_hour}:00–${reservation.start_hour + reservation.duration}:00`;
  const text = kind === 'cancel'
    ? `Olá! Gostaria de solicitar o cancelamento da minha reserva no Quadra Aberta.\n\n${context}\nResponsável: ${reservation.customer_name}`
    : `Olá! Preciso de suporte com minha reserva no Quadra Aberta.\n\n${context}\nResponsável: ${reservation.customer_name}`;

  window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}

async function openReservationPortal() {
  document.body.classList.add('reservation-mode');
  $('#reservationPortal').classList.remove('hidden');

  try {
    await loadReservationPortal(true);
  } catch (error) {
    console.error(error);
    $('#reservationPortalContent').innerHTML = `
      <div class="reservation-error-card">
        <span class="reservation-kicker">MINHA RESERVA</span>
        <h1>Não conseguimos abrir este link.</h1>
        <p>${esc(error.message || 'A reserva não foi encontrada.')}</p>
        <button class="primary" type="button" data-reservation-action="back">Voltar para a agenda</button>
      </div>
    `;
  }
}

$('#reservationPortal').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-reservation-action]');
  const action = button?.dataset.reservationAction;
  if (!action) return;
  if (action === 'player-push' && reservationPortalData && reservationTokenFromUrl) {
    button.disabled = true;
    try {
      const enabled = await togglePush(supabase, {
        role: 'player', id: reservationPortalData.id,
        reservationToken: reservationTokenFromUrl,
      });
      let confirmationShown = false;
      if (enabled) {
        try {
          confirmationShown = await showBookingConfirmationNotification({
            id: reservationPortalData.id, arenaName: reservationPortalData.arena.name,
            courtName: reservationPortalData.court.name,
            date: reservationPortalData.booking_date, hour: reservationPortalData.start_hour,
            url: reservationUrl(reservationTokenFromUrl),
          });
        } catch (error) { console.error('Falha ao exibir confirmação:', error); }
      }
      refreshPushInvites();
      const feedback = $('#reservationPortal .push-invite-feedback');
      if (feedback) feedback.textContent = enabled
        ? `${confirmationShown ? 'Confirmação enviada!' : 'Avisos ativados.'} Você receberá o lembrete 2 horas antes do jogo, se houver tempo.`
        : 'Avisos desativados neste aparelho.';
    } catch (error) {
      const feedback = $('#reservationPortal .push-invite-feedback');
      if (feedback) feedback.textContent = error.message;
    }
    finally { button.disabled = false; }
    return;
  }
  if (action === 'install-app') {
    button.disabled = true;
    try {
      const accepted = await promptInstall();
      refreshPushInvites();
      const feedback = $('#reservationPortal .push-invite-feedback');
      if (feedback) feedback.textContent = accepted
        ? 'Instalação aceita. Abra o app pela tela inicial e ative as notificações.'
        : 'Você pode instalar mais tarde pelo menu do navegador.';
    } catch {
      const feedback = $('#reservationPortal .push-invite-feedback');
      if (feedback) feedback.textContent = 'Não foi possível abrir a instalação. Tente pelo menu do navegador.';
    } finally { button.disabled = false; }
    return;
  }

  if (action === 'back') {
    const url = new URL(window.location.href);
    url.searchParams.delete('reserva');
    window.location.href = url.pathname + (url.search || '');
    return;
  }

  if (action === 'support') {
    openReservationWhatsapp('support');
    return;
  }

  if (action === 'cancel-request') {
    openReservationWhatsapp('cancel');
    return;
  }

  if (action === 'pay-balance') {
    await createReservationBalancePayment();
    return;
  }

  if (action === 'copy-balance-pix') {
    const input = $('#reservationPixCode');
    if (!input?.value) return;
    try {
      await navigator.clipboard.writeText(input.value);
      button.textContent = 'Copiado!';
      setTimeout(() => { button.textContent = 'Copiar Pix'; }, 1600);
    } catch {
      input.focus();
      input.select();
      input.setSelectionRange(0, input.value.length);
      window.prompt('Copie o código Pix:', input.value);
    }
  }
});

async function initialize() {
  try {
    // Remove a seleção salva pelas versões anteriores, sem afetar pagamentos pendentes.
    try { localStorage.removeItem('quadra-aberta:player-arena'); } catch {}

    if (reservationTokenFromUrl) {
      await openReservationPortal();
      return;
    }

    await loadArenaCatalog();

    const restored = await restoreAdminSession();
    if (!restored) {
      const pending = readPendingPayment();
      const linkedArena = new URLSearchParams(window.location.search).get('arena');
      const preferredSlug = linkedArena || pending?.arenaSlug;
      if (preferredSlug && arenaCatalog.some((item) => item.slug === preferredSlug)) {
        await switchArena(preferredSlug, { silent: true });
      } else {
        activeArenaSlug = '';
        clearArenaIdentity();
        render();
      }
    }

    if (restored && ['invite', 'recovery'].includes(authFlowType)) {
      $('#passwordForm').reset();
      $('#passwordError').textContent = '';
      $('#passwordDialog').showModal();
    }
  } catch (error) {
    console.error(error);
    $('#title').textContent = 'Agenda temporariamente indisponível.';
    $('#subtitle').textContent = 'Não foi possível conectar ao serviço de reservas. Tente novamente em alguns instantes.';
    $('#newBooking').classList.add('hidden');
    toast('Falha ao carregar o catálogo de arenas.');
  }
}

initialize();

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (reservationTokenFromUrl) {
    if (reservationPortalData?.balance_payment) checkReservationBalancePayment(false);
    return;
  }
  if (!isAdmin && $('#bookingDialog').open && lastPlayerBooking?.paymentStatus === 'pending') {
    checkPaymentStatus(lastPlayerBooking);
  }
});

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

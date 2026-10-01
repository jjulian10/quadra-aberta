import { createClient } from '@supabase/supabase-js';
import { createAdminNotifications } from './notifications.js';
import { togglePush, promptInstall, rememberReservationForInstall, consumeInstalledReservation, showBookingConfirmationNotification } from './push.js';
import { pushInvite, refreshPushInvites } from './push-onboarding.js';
import { settingsIcon, settingsField, settingsHeading, settingsFooter, updateSettingsVisibility } from './arena-settings-ui.js';
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
let datePickerCursor = new Date(today + 'T12:00:00');
let view = 'player';
let isAdmin = false;
let isPlatformAdmin = false;
let currentAdminUserId = '';
let currentAdminName = '';
let currentAdminEmail = '';
let currentAdminPhone = '';
let masterArenas = [];
let masterLoading = false;
let masterDetail = null;
let masterTab = 'data';
let masterCourtEditId = null;
let masterStatusArenaId = '';
let arenaSettingsDetail = null;
let settingsTab = 'data';
let settingsCourtId = null;
let unavailableArenaStatus = '';
let filter = 'all';
let selectedId = null;
let profitPeriod = 'day';
let financeActivityTab = 'payments';
let financeActivityExpanded = false;
let cashClosingLoading = false;
let cashClosingBusy = false;
let cashClosingConfirmationResolver = null;
let cashClosingData = {
  bookings: [],
  sales: [],
  expenses: [],
  closing: null,
  schemaReady: true,
  schemaError: ''
};
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
let arenaAnnouncements = [];
let publicAnnouncements = [];
let announcementsLoading = false;
let announcementFilter = 'all';
let announcementEditingId = null;
let announcementPublicIndex = 0;
let announcementImagePreviewObjectUrl = '';
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

const compactDateLabel = (date) => new Date(date + 'T12:00:00').toLocaleDateString('pt-BR');

function premiumCalendarMonthLabel(date) {
  const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function isSameCalendarDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function renderPremiumDatePicker() {
  const grid = $('#datePickerGrid');
  const monthLabel = $('#datePickerMonthLabel');
  const triggerValue = $('#datePickerValue');
  if (!grid || !monthLabel || !triggerValue) return;

  const selected = new Date(day + 'T12:00:00');
  const now = new Date(today + 'T12:00:00');
  const year = datePickerCursor.getFullYear();
  const month = datePickerCursor.getMonth();

  triggerValue.textContent = compactDateLabel(day);
  monthLabel.textContent = premiumCalendarMonthLabel(datePickerCursor);

  const first = new Date(year, month, 1, 12);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  const cells = [];
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const value = localDate(date);
    const outside = date.getMonth() !== month;
    const selectedDay = isSameCalendarDay(date, selected);
    const todayDay = isSameCalendarDay(date, now);
    const label = date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    cells.push(`<button type="button"
      class="premium-date-day${outside ? ' outside' : ''}${selectedDay ? ' selected' : ''}${todayDay ? ' today' : ''}"
      data-premium-date="${value}"
      role="gridcell"
      aria-selected="${selectedDay ? 'true' : 'false'}"
      aria-label="${esc(label)}">
      <span>${date.getDate()}</span>
    </button>`);
  }

  grid.innerHTML = cells.join('');
}

function setPremiumCalendarOpen(open) {
  const popover = $('#datePickerPopover');
  const trigger = $('#datePickerTrigger');
  if (!popover || !trigger) return;

  if (open) {
    datePickerCursor = new Date(day + 'T12:00:00');
    renderPremiumDatePicker();
  }

  popover.classList.toggle('hidden', !open);
  trigger.setAttribute('aria-expanded', String(open));
  trigger.closest('.premium-date-picker')?.classList.toggle('open', open);
  document.querySelector('.workspace')?.classList.toggle('calendar-open', open);
}

function syncPremiumDatePicker() {
  const dateInput = $('#date');
  const trigger = $('#datePickerTrigger');
  const triggerValue = $('#datePickerValue');
  if (!dateInput || !trigger || !triggerValue) return;
  dateInput.value = day;
  triggerValue.textContent = compactDateLabel(day);
  trigger.disabled = dateInput.disabled;
  if (trigger.disabled) setPremiumCalendarOpen(false);
}

async function selectPremiumAgendaDate(value) {
  if (!value || value === day) {
    setPremiumCalendarOpen(false);
    return;
  }
  day = value;
  $('#date').value = value;
  setPremiumCalendarOpen(false);
  await refreshBookings();
}
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

function syncMobileArenaSupport() {
  const support = $('#mobileArenaSupport');
  const link = $('#mobileArenaSupportLink');
  const name = $('#mobileArenaSupportName');
  if (!support || !link || !name) return;

  const arenaWhatsapp = String(arena?.whatsapp || '').replace(/\D/g, '');
  let digits = arenaWhatsapp;
  if (digits && digits.length <= 11) digits = '55' + digits;

  const visible = Boolean(arena && !isAdmin && digits);
  support.hidden = !visible;
  support.classList.toggle('hidden', !visible);

  if (!visible) return;

  const arenaName = arena.name || 'a arena';
  const message = `Olá! Não consegui concluir meu agendamento pelo Quadra Aberta na ${arenaName}. Poderia me ajudar?`;
  link.href = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  link.setAttribute('aria-label', `Falar com ${arenaName} pelo WhatsApp`);
  name.textContent = arenaName;
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
  arenaAnnouncements = [];
  publicAnnouncements = [];
  announcementsLoading = false;
  announcementFilter = 'all';
  announcementEditingId = null;
  announcementPublicIndex = 0;
  clearAnnouncementImagePreviewObjectUrl();
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
  syncMobileArenaSupport();
}

function renderArenaIdentity() {
  if (!arena) {
    clearArenaIdentity();
    return;
  }

  const arenaName = arena.name || 'Arena';
  const city = arena.city || 'Porto Velho, RO';
  const select = $('#arenaSelect');
  if (select) {
    if (![...select.options].some((option) => option.value === arena.slug)) {
      select.add(new Option(arenaName, arena.slug));
    }
    select.value = arena.slug;
  }
  if ($('#arenaSelectValue')) $('#arenaSelectValue').textContent = arenaName;
  renderArenaPickerOptions();

  if ($('#arenaAvatar')) $('#arenaAvatar').textContent = arenaInitials(arenaName);
  if ($('#arenaCity')) $('#arenaCity').textContent = city;

  const addressText = arena.address || city;
  const address = $('#arenaAddress');
  const addressLink = $('#arenaAddressLink');
  if (address) {
    address.textContent = addressText;
    address.hidden = false;
  }
  if (addressLink) {
    const mapQuery = arena.address ? `${arena.address}, ${city}` : `${arenaName}, ${city}`;
    addressLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;
    addressLink.setAttribute('aria-label', `Abrir ${addressText} no mapa`);
  }

  const phoneLink = $('#arenaPhone');
  const phoneLabel = $('#arenaPhoneLabel');
  const whatsappDigits = arenaWhatsappDigits();
  if (phoneLink) {
    phoneLink.hidden = !whatsappDigits;
    if (whatsappDigits) {
      phoneLink.href = `https://wa.me/${whatsappDigits}`;
      phoneLink.setAttribute('aria-label', `Falar com ${arenaName} pelo WhatsApp`);
      if (phoneLabel) phoneLabel.textContent = `${formatWhatsapp(arena.whatsapp || whatsappDigits)} · WhatsApp`;
    }
  }

  const footer = $('#arenaFooterContact');
  if (footer) {
    footer.hidden = isAdmin;
    footer.classList.toggle('hidden', isAdmin);
  }
  syncMobileArenaSupport();

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

  const pickerArenas = arena && !arenaCatalog.some((item) => item.slug === arena.slug)
    ? [...arenaCatalog, arena] : arenaCatalog;
  const arenaOptions = pickerArenas.map((item) => {
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
    .eq('active', true)
    .eq('public_access', true)
    .eq('public_listed', true);

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
    const selectArenas = arena && !arenaCatalog.some((item) => item.slug === arena.slug) ? [...arenaCatalog, arena] : arenaCatalog;
    select.innerHTML = '<option value="">Selecione uma arena</option>' + selectArenas
      .map((item) => `<option value="${esc(item.slug)}">${esc(item.name)}</option>`)
      .join('');
    select.value = activeArenaSlug || '';
  }

  renderArenaPickerOptions();
}

async function loadArenaCatalogWithRetry() {
  try {
    await loadArenaCatalog();
  } catch (error) {
    // A short gateway interruption should not leave the opening screen unusable.
    if (![502, 522].includes(Number(error?.status))) throw error;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await loadArenaCatalog();
  }
}

async function verifyCurrentPublicArena() {
  if (isAdmin || !arena) return;
  const slug = arena.slug;
  const { data, error } = await supabase.from('arenas').select('id').eq('slug', slug).eq('active', true).maybeSingle();
  if (error || data || isAdmin || arena?.slug !== slug) return;
  const { data: status } = await supabase.rpc('get_public_arena_status', { target_slug: slug });
  unavailableArenaStatus = ['private', 'suspended'].includes(status) ? status : '';
  activeArenaSlug = '';
  ++arenaChangeVersion;
  clearArenaIdentity();
  await syncBookingsRealtime();
  await loadArenaCatalog();
  render();
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
    .select('id, slug, name, city, timezone, address, whatsapp, public_access, public_listed')
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
    <article class="master-arena-row" data-master-arena="${esc(item.arena_id)}" tabindex="0" role="button" aria-label="Gerenciar ${esc(item.name)}">
      <div class="master-arena-avatar">${esc(arenaInitials(item.name))}</div>
      <div class="master-arena-main">
        <div class="master-arena-title">
          <strong>${esc(item.name)}</strong>
          <span class="master-status ${item.active ? 'active' : 'inactive'}">${item.active ? 'Ativa' : 'Suspensa'}</span>
        </div>
        <small>${esc(item.city || 'Porto Velho, RO')}</small>
        <span>${Number(item.court_count || 0)} quadra${Number(item.court_count || 0) === 1 ? '' : 's'} · ${Number(item.bookings_count || 0)} reserva${Number(item.bookings_count || 0) === 1 ? '' : 's'}</span>
        <span class="master-arena-open">Gerenciar arena →</span>
      </div>
      <div class="master-arena-admin">
        <small>Administrador</small>
        <strong>${esc(item.admin_email || 'Não cadastrado')}</strong>
      </div>
      <div class="master-arena-finance">
        <small>Recebido</small>
        <strong>${money(Number(item.received || 0))}</strong>
      </div>
      <div class="master-arena-access">
        <div>
          <small>Acesso</small>
          <strong>${item.active ? 'Liberado' : 'Suspenso'}</strong>
          <span>${item.active ? 'Admin + agenda pública' : 'Admin e agenda bloqueados'}</span>
        </div>
        <button type="button" class="master-access-switch ${item.active ? 'is-active' : 'is-suspended'}" data-master-toggle-arena="${esc(item.arena_id)}" aria-pressed="${item.active}" aria-label="${item.active ? 'Suspender' : 'Reativar'} ${esc(item.name)}">
          <span aria-hidden="true"></span>
        </button>
      </div>
    </article>
  `).join('');
}

const masterLink = (slug) => `${window.location.origin}/?arena=${encodeURIComponent(slug)}`;

function openMasterArenaStatusDialog(id) {
  if (!isPlatformAdmin) return;
  const item = masterArenas.find((candidate) => candidate.arena_id === id);
  if (!item) return;

  masterStatusArenaId = id;
  const activating = !item.active;
  $('#arenaStatusForm').reset();
  $('#arenaStatusReason').value = 'Pagamento pendente';
  $('#arenaStatusDetails').value = '';
  $('#arenaStatusError').textContent = '';
  $('#arenaStatusEyebrow').textContent = activating ? 'REATIVAR ARENA' : 'SUSPENDER ARENA';
  $('#arenaStatusTitle').textContent = (activating ? 'Reativar ' : 'Suspender ') + item.name + '?';
  $('#arenaStatusIntro').textContent = activating
    ? 'O acesso administrativo e a agenda pública voltarão a funcionar imediatamente.'
    : 'A arena ficará indisponível para administradores e para novos agendamentos públicos.';
  $('#arenaStatusReasonFields').classList.toggle('hidden', activating);
  $('#arenaStatusImpact').classList.toggle('is-reactivate', activating);
  $('#arenaStatusSubmit').textContent = activating ? 'Reativar arena' : 'Confirmar suspensão';
  $('#arenaStatusSubmit').classList.toggle('danger-primary', !activating);
  $('#arenaStatusDialog').showModal();
}
async function refreshMasterDetail() {
  if (!masterDetail) return;
  const id = masterDetail.arena.id;
  const { data, error } = await supabase.rpc('get_master_arena_detail', { p_arena_id: id });
  if (error) throw error;
  masterDetail = data;
  renderMasterManage();
  await loadMasterDashboard();
  if (view === 'master') renderMasterPanel();
  await loadArenaCatalog();
}

async function openMasterManage(id) {
  if (!isPlatformAdmin) return;
  const dialog = $('#masterManageDialog');
  dialog.showModal();
  $('#masterManageContent').innerHTML = '<div class="master-empty">Carregando gestão da arena...</div>';
  masterDetail = null;
  masterTab = 'data';
  try {
    const { data, error } = await supabase.rpc('get_master_arena_detail', { p_arena_id: id });
    if (error) throw error;
    if (!dialog.open) return;
    masterDetail = data;
    renderMasterManage();
  } catch (error) {
    console.error(error);
    $('#masterManageContent').innerHTML = '<div class="master-empty">Não foi possível carregar esta arena. Feche e tente novamente.</div>';
  }
}

function masterSectionHeading(title, description, action = '') {
  return `<div class="master-manage-section-title"><div><h3>${title}</h3><p>${description}</p></div>${action}</div>`;
}

function describeMasterChange(change) {
  const details = change.details || {};
  if (details.email) return details.email;
  if (change.action === 'court.created') return details.name || '';
  if (change.action === 'arena.suspended') return details.reason ? 'Motivo: ' + details.reason : 'Arena suspensa pelo Painel Mestre.';
  if (change.action === 'arena.reactivated') return details.reason ? 'Suspensão anterior: ' + details.reason : 'Acesso administrativo e agenda pública reativados.';
  const before = details.before || {};
  const after = details.after || {};
  const labels = change.action === 'arena.updated'
    ? { name: 'Nome', city: 'Cidade', address: 'Endereço', whatsapp: 'WhatsApp', public_listed: 'Catálogo', public_access: 'Agenda' }
    : { name: 'Nome', sport: 'Modalidade', hourly_price: 'Preço/hora', opening_hour: 'Abertura', closing_hour: 'Fechamento', active: 'Situação' };
  const display = (key, value) => {
    if (key === 'public_listed') return value ? 'Pública' : 'Oculta';
    if (key === 'public_access') return value ? 'Aberta' : 'Privada';
    if (key === 'active') return value ? 'Ativa' : 'Inativa';
    if (key === 'hourly_price') return money(Number(value));
    if (key === 'opening_hour' || key === 'closing_hour') return `${value}h`;
    return String(value ?? '—');
  };
  return Object.entries(labels).filter(([key]) => before[key] !== after[key])
    .map(([key, label]) => `${label}: ${display(key, before[key])} → ${display(key, after[key])}`)
    .join(' · ');
}

function renderMasterManage() {
  if (!masterDetail) return;
  const { arena: item, courts: allCourts, admins, history: changes } = masterDetail;
  $('#masterManageTitle').textContent = item.name;
  $('#masterManageCity').textContent = item.city || '';
  $('#masterManageAvatar').textContent = arenaInitials(item.name);
  document.querySelectorAll('[data-master-tab]').forEach((button) => button.classList.toggle('active', button.dataset.masterTab === masterTab));
  const content = $('#masterManageContent');

  if (masterTab === 'data') {
    content.innerHTML = `
      ${masterSectionHeading('Dados da arena', 'Atualize as informações que aparecem na página da arena.')}
      <form id="masterArenaForm">
        <div class="master-manage-card">
          <div class="master-manage-grid"><label>Nome da arena<input name="name" required minlength="2" maxlength="80" value="${esc(item.name)}"></label><label>Cidade<input name="city" required minlength="2" maxlength="80" value="${esc(item.city || '')}"></label></div>
          <label>Endereço<input name="address" required minlength="5" maxlength="180" value="${esc(item.address || '')}"></label>
          <label>WhatsApp<input name="whatsapp" required inputmode="tel" value="${esc(formatWhatsapp(item.whatsapp || ''))}"></label>
        </div>
        <div class="master-manage-card"><div class="master-manage-inline"><div><strong>Visibilidade pública</strong><small>${item.public_listed ? 'Esta arena aparece na lista pública.' : 'Oculta da lista pública. O link direto continua funcionando.'}</small></div><label class="master-switch" aria-label="Mostrar arena no catálogo"><input name="public_listed" type="checkbox" ${item.public_listed ? 'checked' : ''}><span></span></label></div></div>
        <div class="master-manage-card"><h3>Link direto</h3><div class="master-manage-link"><span>${esc(masterLink(item.slug))}</span><button type="button" data-master-copy>Copiar</button></div></div>
        <p class="master-manage-error" role="alert"></p><div class="master-manage-footer"><button class="primary" type="submit">Salvar alterações</button></div>
      </form>`;
  } else if (masterTab === 'courts') {
    const current = allCourts.find((court) => court.id === masterCourtEditId);
    content.innerHTML = `
      ${masterSectionHeading('Quadras da arena', 'Edite preços, horários e disponibilidade de cada quadra.', '<button class="secondary" type="button" data-master-new-court>＋ Nova quadra</button>')}
      <div class="master-manage-list">${allCourts.map((court) => `<div class="master-manage-item"><span class="master-manage-item-icon">▦</span><div class="master-manage-item-copy"><strong>${esc(court.name)} <span class="master-status ${court.active ? 'active' : 'inactive'}">${court.active ? 'Ativa' : 'Inativa'}</span></strong><small>${esc(court.sport)} · ${money(Number(court.hourly_price))}/h · ${court.opening_hour}h–${court.closing_hour}h</small></div><button class="master-manage-quiet" type="button" data-master-edit-court="${esc(court.id)}">Editar</button></div>`).join('')}</div>
      ${masterCourtEditId !== null ? `<form id="masterCourtForm" class="master-manage-card" style="margin-top:17px"><h3>${current ? 'Editar quadra' : 'Nova quadra'}</h3><div class="master-manage-grid"><label>Nome<input name="name" required minlength="2" maxlength="60" value="${esc(current?.name || '')}"></label><label>Modalidade<input name="sport" required minlength="2" maxlength="60" value="${esc(current?.sport || 'Vôlei')}"></label><label>Preço por hora (R$)<input name="hourly_price" type="number" min="0" step="0.01" required value="${current ? Number(current.hourly_price) : ''}"></label><label>Abre às<input name="opening_hour" type="number" min="0" max="23" required value="${current?.opening_hour ?? 14}"></label><label>Fecha às<input name="closing_hour" type="number" min="1" max="24" required value="${current?.closing_hour ?? 23}"></label></div>${current ? `<div class="master-manage-inline" style="margin-top:16px"><div><strong>Quadra ativa</strong><small>Reservas futuras impedem a desativação ou redução incompatível do horário.</small></div><label class="master-switch" aria-label="Quadra ativa"><input name="active" type="checkbox" ${current.active ? 'checked' : ''}><span></span></label></div>` : '<input name="active" type="hidden" value="true">'}<p class="master-manage-error" role="alert"></p><div class="master-manage-footer"><button class="secondary" type="button" data-master-cancel-court>Cancelar</button><button class="primary" type="submit">Salvar quadra</button></div></form>` : ''}`;
  } else if (masterTab === 'admins') {
    content.innerHTML = `
      ${masterSectionHeading('Acessos administrativos', 'Gerencie quem pode acessar a administração desta arena.')}
      <div class="master-manage-list">${admins.map((admin) => `<div class="master-manage-item"><span class="master-manage-item-icon">${esc(arenaInitials(admin.email))}</span><div class="master-manage-item-copy"><strong>${esc(admin.email)}</strong><small>${admin.role === 'owner' ? 'Proprietário' : 'Administrador'} · desde ${new Date(admin.created_at).toLocaleDateString('pt-BR')}</small></div>${admin.role === 'owner' ? '<span class="master-status active">Principal</span>' : `<button class="master-manage-quiet" type="button" data-master-remove-admin="${esc(admin.user_id)}">Remover</button>`}</div>`).join('')}</div>
      <form id="masterInviteForm" class="master-manage-card" style="margin-top:18px"><h3>Convidar administrador</h3><p class="master-manage-muted">Uma pessoa nova recebe convite por e-mail. Uma conta existente é vinculada com seu acesso atual.</p><label>E-mail do administrador<input name="email" type="email" autocomplete="off" required placeholder="admin@arena.com"></label><p class="master-manage-error" role="alert"></p><div class="master-manage-footer"><button class="primary" type="submit">Enviar convite</button></div></form>`;
  } else {
    const labels = { 'arena.updated': 'Dados da arena atualizados', 'arena.suspended': 'Arena suspensa', 'arena.reactivated': 'Arena reativada', 'court.created': 'Quadra criada', 'court.updated': 'Quadra atualizada', 'admin.added': 'Administrador adicionado', 'admin.removed': 'Administrador removido' };
    content.innerHTML = `${masterSectionHeading('Histórico de alterações', 'Últimas 50 ações realizadas no Painel Mestre.')}
      ${changes.length ? `<div class="master-manage-history">${changes.map((change) => `<article><strong>${esc(labels[change.action] || change.action)}</strong><small>${new Date(change.created_at).toLocaleString('pt-BR')} · ${esc(change.actor_email || 'Administrador da plataforma')}</small><p>${esc(describeMasterChange(change))}</p></article>`).join('')}</div>` : '<div class="master-empty">Nenhuma alteração registrada até agora.</div>'}`;
  }
}

async function runMasterMutation(form, action) {
  const button = form.querySelector('[type="submit"]');
  const errorElement = form.querySelector('.master-manage-error');
  button.disabled = true;
  errorElement.textContent = '';
  try {
    await action();
    await refreshMasterDetail();
  } catch (error) {
    console.error(error);
    errorElement.textContent = error.message || 'Não foi possível salvar. Tente novamente.';
  } finally {
    button.disabled = false;
  }
}

async function loadArenaSettings() {
  if (!isAdmin || !arena) return;
  const arenaId = arena.id;
  const { data, error } = await supabase.rpc('get_master_arena_detail', { p_arena_id: arenaId });
  if (error) throw error;
  if (!isAdmin || arena?.id !== arenaId) return;
  arenaSettingsDetail = data;
  renderArenaSettings();
}

function renderArenaSettings() {
  if (!isAdmin || !arena || view !== 'settings') return;
  const target = $('#arenaSettingsContent');
  document.querySelectorAll('[data-settings-tab]').forEach((button) => {
    const selected = button.dataset.settingsTab === settingsTab;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-current', selected ? 'true' : 'false');
    button.querySelector('span').innerHTML = settingsIcon({ data: 'arena', courts: 'court', admins: 'people', history: 'history' }[button.dataset.settingsTab]);
  });
  if (!arenaSettingsDetail) {
    target.innerHTML = '<div class="master-empty">Carregando configurações da arena...</div>';
    return;
  }
  const { arena: item, courts: allCourts, admins, history: changes } = arenaSettingsDetail;
  if (settingsTab === 'data') {
    target.innerHTML = `<form id="arenaSettingsForm" class="arena-settings-grid">
      <div class="arena-settings-card arena-settings-details">
        ${settingsHeading('Informações da arena', 'Mantenha os dados principais sempre atualizados.', 'arena', 'Dados da arena')}
        <div class="arena-settings-fields">
          <div class="arena-settings-field-grid">
            ${settingsField('Nome da arena', 'name', item.name, 'arena', 'required minlength="2" maxlength="80" autocomplete="organization"')}
            ${settingsField('Cidade', 'city', item.city || '', 'pin', 'required minlength="2" maxlength="80" autocomplete="address-level2"')}
          </div>
          ${settingsField('Endereço', 'address', item.address || '', 'pin', 'required minlength="5" maxlength="180" autocomplete="street-address"')}
          ${settingsField('WhatsApp da arena', 'whatsapp', formatWhatsapp(item.whatsapp || ''), 'phone', 'type="tel" required inputmode="tel" autocomplete="tel-national"')}
        </div>
      </div>
      <div class="arena-settings-stack">
        <div class="arena-settings-card"><h3>Visibilidade da agenda</h3><p>Escolha como os jogadores encontram e acessam sua arena.</p>
          <div class="arena-settings-toggle"><span class="arena-settings-toggle-icon">${settingsIcon('globe')}</span><div class="arena-settings-toggle-copy"><strong>Agenda pública<span class="arena-settings-state-dot" aria-hidden="true"></span></strong><small data-settings-access-copy></small></div><label class="master-switch" aria-label="Permitir acesso público à agenda"><input name="public_access" type="checkbox" ${item.public_access ? 'checked' : ''}><span></span></label></div>
          <div class="arena-settings-toggle"><span class="arena-settings-toggle-icon">${settingsIcon('catalog')}</span><div class="arena-settings-toggle-copy"><strong>Exibir no catálogo<span class="arena-settings-state-dot" aria-hidden="true"></span></strong><small data-settings-catalog-copy></small></div><label class="master-switch" aria-label="Mostrar arena no catálogo"><input name="public_listed" type="checkbox" ${item.public_listed ? 'checked' : ''} ${!item.public_access ? 'disabled' : ''}><span></span></label></div>
          <div class="arena-settings-help" data-settings-visibility-help aria-live="polite">${settingsIcon('info')}<span></span></div>
        </div>
        <div class="arena-settings-card arena-settings-share"><h3>Link da agenda</h3><p>Compartilhe com os jogadores quando a agenda estiver aberta.</p><div class="arena-settings-link"><span class="arena-settings-link-icon">${settingsIcon('link')}</span><span class="arena-settings-link-text" title="${esc(masterLink(item.slug))}">${esc(masterLink(item.slug))}</span><button type="button" data-settings-copy>${settingsIcon('copy')}<span>Copiar</span></button></div></div>
      </div>
      ${settingsFooter('As alterações ficam registradas no histórico.', `<button class="secondary" type="button" data-settings-reset>Cancelar</button><button class="primary" type="submit">${settingsIcon('check')}<span>Salvar alterações</span></button>`)}
    </form>`;
    updateSettingsVisibility($('#arenaSettingsForm'));
  } else if (settingsTab === 'courts') {
    const current = allCourts.find((court) => court.id === settingsCourtId);
    target.innerHTML = `<div class="arena-settings-section-head"><div><h3>Quadras da sua arena</h3><p>Defina valores, modalidade e horário de funcionamento.</p></div><button class="secondary" type="button" data-settings-new-court>${settingsIcon('plus')}Nova quadra</button></div>
      <div class="arena-settings-list">${allCourts.map((court) => `<div class="master-manage-item"><span class="master-manage-item-icon">${settingsIcon('court')}</span><div class="master-manage-item-copy"><strong>${esc(court.name)} <span class="master-status ${court.active ? 'active' : 'inactive'}">${court.active ? 'Ativa' : 'Inativa'}</span></strong><small>${esc(court.sport)} · ${money(Number(court.hourly_price))}/h · ${court.opening_hour}h–${court.closing_hour}h</small></div><button class="master-manage-quiet" type="button" data-settings-edit-court="${esc(court.id)}">${settingsIcon('edit')}Editar</button></div>`).join('')}</div>
      ${settingsCourtId !== null ? `<form id="arenaSettingsCourtForm" class="arena-settings-card arena-settings-edit">
        ${settingsHeading(current ? `Editar ${current.name}` : 'Cadastrar quadra', 'As alterações de horário respeitam as reservas futuras.', 'court', 'Estrutura da arena')}
        <div class="arena-settings-fields"><div class="arena-settings-field-grid">
          ${settingsField('Nome', 'name', current?.name || '', 'court', 'required minlength="2" maxlength="60"')}
          ${settingsField('Modalidade', 'sport', current?.sport || 'Vôlei', 'court', 'required minlength="2" maxlength="60"')}
        </div><div class="arena-settings-field-grid arena-settings-field-grid-three">
          ${settingsField('Preço por hora (R$)', 'hourly_price', current ? Number(current.hourly_price) : '', 'money', 'type="number" min="0" step="0.01" required inputmode="decimal"')}
          ${settingsField('Abre às', 'opening_hour', current?.opening_hour ?? 14, 'history', 'type="number" min="0" max="23" required inputmode="numeric"')}
          ${settingsField('Fecha às', 'closing_hour', current?.closing_hour ?? 23, 'history', 'type="number" min="1" max="24" required inputmode="numeric"')}
        </div></div>
        ${current ? `<div class="arena-settings-toggle"><span class="arena-settings-toggle-icon">${settingsIcon('court')}</span><div class="arena-settings-toggle-copy"><strong>Quadra ativa<span class="arena-settings-state-dot" aria-hidden="true"></span></strong><small>Não é possível desativar uma quadra que tenha reservas futuras.</small></div><label class="master-switch" aria-label="Quadra ativa"><input name="active" type="checkbox" ${current.active ? 'checked' : ''}><span></span></label></div>` : ''}
        ${settingsFooter('Valores e horários serão atualizados na agenda.', `<button class="secondary" type="button" data-settings-cancel-court>Cancelar</button><button class="primary" type="submit">${settingsIcon('check')}<span>Salvar quadra</span></button>`)}
      </form>` : ''}`;
  } else if (settingsTab === 'admins') {
    target.innerHTML = `<div class="arena-settings-section-head"><div><h3>Administradores da arena</h3><p>Controle os acessos sem compartilhar sua senha.</p></div><span class="arena-settings-badge">${admins.length} acesso${admins.length === 1 ? '' : 's'}</span></div>
      <div class="arena-settings-list">${admins.map((admin) => {
        const adminName = admin.name || admin.email;
        const adminPhone = admin.phone ? formatWhatsapp(admin.phone) : '';
        const adminContact = [admin.email, adminPhone].filter(Boolean).join(' · ');
        return `<div class="master-manage-item"><span class="master-manage-item-icon">${esc(arenaInitials(adminName))}</span><div class="master-manage-item-copy"><strong>${esc(adminName)}</strong><small>${esc(adminContact)} · ${admin.role === 'owner' ? 'Proprietário' : 'Administrador'} · desde ${new Date(admin.created_at).toLocaleDateString('pt-BR')}</small></div>${admin.role === 'owner' ? '<span class="master-status active">Principal</span>' : admin.user_id === currentAdminUserId ? '<span class="master-status active">Você</span>' : `<button class="master-manage-quiet" type="button" data-settings-remove-admin="${esc(admin.user_id)}">Remover</button>`}</div>`;
      }).join('')}</div>
      <form id="arenaSettingsInviteForm" class="arena-settings-card arena-settings-edit">
        ${settingsHeading('Adicionar administrador', 'Cadastre os dados do responsável. Se for uma conta nova, o convite será enviado por e-mail.', 'people', 'Acessos da arena')}
        <div class="arena-settings-fields">
          <div class="arena-settings-field-grid">
            ${settingsField('Nome completo', 'name', '', 'people', 'required minlength="2" maxlength="80" autocomplete="name" placeholder="Ex.: João da Silva"')}
            ${settingsField('Telefone', 'phone', '', 'phone', 'type="tel" required inputmode="tel" autocomplete="tel" maxlength="20" placeholder="(69) 99999-9999"')}
          </div>
          ${settingsField('E-mail do administrador', 'email', '', 'mail', 'type="email" autocomplete="off" required placeholder="admin@arena.com"')}
        </div>
        ${settingsFooter('O nome será usado para identificar o administrador no painel.', `<button class="primary" type="submit">${settingsIcon('send')}<span>Enviar convite</span></button>`)}
      </form>`;
  } else {
    const labels = { 'arena.updated': 'Informações da arena alteradas', 'arena.suspended': 'Arena suspensa', 'arena.reactivated': 'Arena reativada', 'court.created': 'Nova quadra cadastrada', 'court.updated': 'Quadra atualizada', 'admin.added': 'Administrador adicionado', 'admin.removed': 'Acesso removido' };
    target.innerHTML = `<div class="arena-settings-card">${settingsHeading('Histórico de alterações', 'Últimas 50 ações realizadas nesta arena.', 'history', 'Atividades da arena')}${changes.length ? `<div class="master-manage-history">${changes.map((change) => `<article><strong>${esc(labels[change.action] || change.action)}</strong><small>${new Date(change.created_at).toLocaleString('pt-BR')} · ${esc(change.actor_email || 'Administrador')}</small><p>${esc(describeMasterChange(change))}</p></article>`).join('')}</div>` : '<div class="master-empty">Nenhuma alteração registrada até agora.</div>'}</div>`;
  }
}

async function runSettingsMutation(form, action, successMessage) {
  if (form.getAttribute('aria-busy') === 'true') return;
  const button = form.querySelector('[type="submit"]');
  const errorElement = form.querySelector('.arena-settings-error');
  const buttonContent = button.innerHTML;
  const cancel = form.querySelector('[data-settings-reset], [data-settings-cancel-court]');
  form.setAttribute('aria-busy', 'true');
  button.disabled = true;
  if (cancel) cancel.disabled = true;
  button.innerHTML = '<span class="arena-settings-spinner" aria-hidden="true"></span><span>Salvando...</span>';
  errorElement.textContent = '';
  try {
    await action();
    await loadArenaSettings();
    toast(successMessage);
  } catch (error) {
    console.error(error);
    errorElement.textContent = error.message || 'Não foi possível salvar. Tente novamente.';
  } finally {
    form.removeAttribute('aria-busy');
    button.disabled = false;
    if (cancel) cancel.disabled = false;
    button.innerHTML = buttonContent;
  }
}

async function refreshCurrentAdminArena() {
  if (!isAdmin || !arena) return;
  const loaded = await loadArena(arena.slug);
  if (!loaded) return;
  populateCourtSelects();
  await refreshBookings(false);
  await loadArenaCatalog();
  adminNotifications.setContext(arena, currentAdminUserId, courts);
}

async function getAdminArenaForUser(userId) {
  if (!userId) return null;

  const { data, error } = await supabase.rpc('get_my_arena_access');
  if (error) throw error;
  return data || null;
}

function arenaSuspensionMessage(access) {
  const reason = String(access?.suspension_reason || '').trim();
  return reason
    ? 'Acesso temporariamente suspenso. Motivo: ' + reason + '. Entre em contato com o suporte do Quadra Aberta para regularizar sua arena.'
    : 'Acesso temporariamente suspenso. Entre em contato com o suporte do Quadra Aberta para regularizar sua arena.';
}

function quadraSupportWhatsappUrl(arenaName = '') {
  let digits = String(ARENA_SUPPORT_WHATSAPP || '').replace(/\D/g, '');
  if (digits && digits.length <= 11) digits = '55' + digits;
  const context = String(arenaName || '').trim();
  const message = context
    ? `Olá! Sou administrador da ${context} e meu acesso ao Quadra Aberta está suspenso. Gostaria de regularizar a situação.`
    : 'Olá! Meu acesso administrativo ao Quadra Aberta está suspenso. Gostaria de regularizar a situação.';
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : '#';
}

function renderLoginError(message = '', options = {}) {
  const element = $('#loginError');
  if (!element) return;

  const text = String(message || '').trim();
  const isSuspension = options.type === 'suspended';

  element.classList.toggle('has-suspension', isSuspension);
  if (!text) {
    element.innerHTML = '';
    return;
  }

  if (!isSuspension) {
    element.innerHTML = `<span class="login-error-text">${esc(text)}</span>`;
    return;
  }

  const reason = String(options.reason || '').trim() || 'Regularização pendente';
  const arenaName = String(options.arenaName || '').trim();
  const supportUrl = quadraSupportWhatsappUrl(arenaName);

  element.innerHTML = `
    <section class="login-suspension-card" aria-label="Acesso temporariamente suspenso">
      <div class="login-suspension-icon" aria-hidden="true">
        <span class="login-suspension-icon-ring"></span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
          <rect x="5" y="10.5" width="14" height="10" rx="2.4"></rect>
          <path d="M8.25 10.5V7.8a3.75 3.75 0 0 1 7.5 0v2.7"></path>
          <path d="M12 14.1v2.8"></path>
        </svg>
      </div>
      <div class="login-suspension-body">
        <span class="login-suspension-kicker">ACESSO RESTRITO</span>
        <strong class="login-suspension-title">Acesso temporariamente suspenso</strong>
        <p><b>Motivo:</b> ${esc(reason)}. Entre em contato com o suporte do Quadra Aberta para regularizar sua arena.</p>
        <a class="login-support-button" href="${esc(supportUrl)}" target="_blank" rel="noopener noreferrer">
          <span class="login-support-whatsapp" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20.5 11.5a8.5 8.5 0 0 1-12.7 7.4L3 20l1.2-4.7A8.5 8.5 0 1 1 20.5 11.5Z"></path>
              <path d="M8.8 8.7c.3-.5.6-.5.9-.5h.5c.2 0 .4.1.5.4l.7 1.7c.1.3.1.5-.1.7l-.5.6c-.2.2-.2.4-.1.6.5.9 1.2 1.7 2 2.3.2.1.4.1.6 0l.7-.5c.2-.2.5-.2.7-.1l1.7.8c.3.1.4.3.4.6 0 .4-.1.9-.4 1.3-.4.6-1.2.9-2 .8-1.2-.1-2.8-.8-4.4-2.3-1.8-1.7-2.7-3.5-2.8-4.7-.1-.6.1-1.2.4-1.7Z"></path>
            </svg>
          </span>
          <span>Falar com suporte</span>
          <span class="login-support-arrow" aria-hidden="true">›</span>
        </a>
      </div>
    </section>`;
}
async function enterAdminPanelForUser(userId) {
  currentAdminUserId = userId;
  isPlatformAdmin = await checkPlatformAdmin(userId);
  const linkedArena = await getAdminArenaForUser(userId);
  const { data: identityData } = await supabase.auth.getUser();
  const authUser = identityData?.user || null;
  currentAdminName = linkedArena?.admin_name || authUser?.user_metadata?.full_name || '';
  currentAdminEmail = linkedArena?.admin_email || authUser?.email || '';
  currentAdminPhone = linkedArena?.admin_phone || authUser?.user_metadata?.phone || '';

  if (linkedArena && !linkedArena.active) {
    const message = arenaSuspensionMessage(linkedArena);
    if (isPlatformAdmin) {
      adminNotifications.reset();
      activeArenaSlug = '';
      unavailableArenaStatus = 'suspended';
      clearArenaIdentity();
      isAdmin = true;
      view = 'master';
      await loadMasterDashboard();
      render();
      toast(message);
      return true;
    }
    await supabase.auth.signOut();
    const suspensionError = new Error(message);
    suspensionError.code = 'ARENA_SUSPENDED';
    suspensionError.suspensionReason = linkedArena.suspension_reason || '';
    suspensionError.arenaName = linkedArena.name || '';
    throw suspensionError;
  }

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

async function verifyCurrentAdminArenaAccess() {
  if (!isAdmin || !arena || view === 'master') return true;

  const access = await getAdminArenaForUser(currentAdminUserId);
  if (access?.active && access.slug === arena.slug) return true;

  const message = access && !access.active
    ? arenaSuspensionMessage(access)
    : 'Seu acesso administrativo a esta arena não está mais disponível.';

  adminNotifications.reset();
  activeArenaSlug = '';
  unavailableArenaStatus = access && !access.active ? 'suspended' : '';
  ++arenaChangeVersion;
  bookingLoadVersion += 1;
  realtimeVersion += 1;
  clearArenaIdentity();
  bookings = [];
  scheduleBlocks = [];
  cancellationHistory = [];
  await syncBookingsRealtime();

  if (isPlatformAdmin) {
    view = 'master';
    await loadMasterDashboard();
    render();
    toast(message);
    return false;
  }

  await supabase.auth.signOut();
  isAdmin = false;
  isPlatformAdmin = false;
  currentAdminUserId = '';
  currentAdminName = '';
  currentAdminEmail = '';
  currentAdminPhone = '';
  masterArenas = [];
  arenaSettingsDetail = null;
  view = 'player';
  await loadArenaCatalog();
  render();
  toast(message);
  return false;
}
async function restoreAdminSession() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return false;

  try {
    const restored = await enterAdminPanelForUser(data.user.id);
    if (!restored) {
      await supabase.auth.signOut();
      return false;
    }
    return true;
  } catch (accessError) {
    await supabase.auth.signOut();
    if (/temporariamente suspenso/i.test(accessError?.message || '')) {
      unavailableArenaStatus = 'suspended';
      toast(accessError.message);
      return false;
    }
    throw accessError;
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
  const announcementsNav = document.querySelector('[data-view="announcements"]');
  const settingsNav = document.querySelector('[data-view="settings"]');
  const masterNav = document.querySelector('[data-view="master"]');
  const playerNav = document.querySelector('[data-view="player"]');

  adminNav.classList.toggle('hidden', !isAdmin || !arena);
  financeNav.classList.toggle('hidden', !isAdmin || !arena);
  inventoryNav.classList.toggle('hidden', !isAdmin || !arena);
  announcementsNav.classList.toggle('hidden', !isAdmin || !arena);
  settingsNav.classList.toggle('hidden', !isAdmin || !arena);
  masterNav.classList.toggle('hidden', !isPlatformAdmin);
  playerNav.classList.toggle('hidden', isAdmin);
  $('#adminLogin').classList.toggle('hidden', isAdmin);
  $('#adminLogout').classList.toggle('hidden', !isAdmin);
  $('#blockSchedule').classList.toggle('hidden', !isAdmin || view !== 'admin' || view === 'master');

  document.body.classList.toggle('admin-session', isAdmin);

  const adminHeaderName = $('#adminHeaderName');
  const adminHeaderAvatar = $('#adminHeaderAvatar');
  const identityLabel = currentAdminName || currentAdminEmail || 'Administrador';
  if (adminHeaderName) {
    adminHeaderName.textContent = currentAdminName || '';
    adminHeaderName.title = currentAdminEmail || identityLabel;
    adminHeaderName.classList.toggle('hidden', !isAdmin || !currentAdminName);
  }
  if (adminHeaderAvatar) {
    adminHeaderAvatar.textContent = arenaInitials(identityLabel);
    adminHeaderAvatar.title = currentAdminEmail || identityLabel;
    adminHeaderAvatar.setAttribute('aria-label', currentAdminName ? `Administrador: ${currentAdminName}` : 'Administrador');
  }

  const arenaContact = $('#arenaFooterContact');
  if (arenaContact) {
    arenaContact.hidden = isAdmin || !arena;
    arenaContact.classList.toggle('hidden', isAdmin || !arena);
  }

  syncMobileArenaSupport();

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
  if (!$('#cashClosingPanel')) {
    const panel = document.createElement('section');
    panel.id = 'cashClosingPanel';
    const profitPanel = $('#profitPanel');
    panel.className = 'cash-closing-panel';
    if (profitPanel) profitPanel.before(panel);
    else $('#stats').after(panel);
  } else if ($('#profitPanel')) {
    $('#profitPanel').before($('#cashClosingPanel'));
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

function cashClosingDateLabel(value) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });
}

function cashClosingMissingSchema(error) {
  return Boolean(error) && (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /cash_(expenses|closings)/i.test(error.message || '')
  );
}

function cashClosingNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

async function loadCashClosingData() {
  if (!isAdmin || !arena || view !== 'finance') return false;

  const arenaId = arena.id;
  const closingDate = day;
  cashClosingLoading = true;
  cashClosingData = { ...cashClosingData, schemaError: '' };

  try {
    const nextDate = new Date(`${closingDate}T12:00:00`);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextDateValue = localDate(nextDate);
    const movementStart = new Date(`${closingDate}T00:00:00`).toISOString();
    const movementEnd = new Date(`${nextDateValue}T00:00:00`).toISOString();
    const [bookingsResult, salesResult, expensesResult, closingResult] = await Promise.all([
      supabase
        .from('bookings')
        .select('id, booking_date, court_id, start_hour, duration, customer_name, status, payment_status, amount, payment_received_amount, payment_provider, payment_confirmed_at')
        .eq('arena_id', arenaId)
        .eq('booking_date', closingDate)
        .in('status', ['pending', 'confirmed'])
        .order('start_hour'),
      supabase
        .from('inventory_movements')
        .select('id, product_id, movement_type, quantity, total_amount, created_at')
        .eq('arena_id', arenaId)
        .eq('movement_type', 'sale')
        .gte('created_at', movementStart)
        .lt('created_at', movementEnd)
        .order('created_at', { ascending: false }),
      supabase
        .from('cash_expenses')
        .select('id, expense_date, description, category, payment_method, amount, created_at')
        .eq('arena_id', arenaId)
        .eq('expense_date', closingDate)
        .order('created_at', { ascending: false }),
      supabase
        .from('cash_closings')
        .select('id, closing_date, booking_received_total, inventory_sales_total, expenses_total, expected_total, counted_total, difference_total, payment_breakdown, notes, status, closed_at')
        .eq('arena_id', arenaId)
        .eq('closing_date', closingDate)
        .maybeSingle()
    ]);

    if (bookingsResult.error) throw bookingsResult.error;
    if (salesResult.error) throw salesResult.error;
    if (expensesResult.error) {
      if (cashClosingMissingSchema(expensesResult.error)) {
        cashClosingData = { bookings: [], sales: [], expenses: [], closing: null, schemaReady: false, schemaError: 'A estrutura do fechamento ainda precisa ser aplicada ao Supabase.' };
        return false;
      }
      throw expensesResult.error;
    }
    if (closingResult.error) {
      if (cashClosingMissingSchema(closingResult.error)) {
        cashClosingData = { bookings: [], sales: [], expenses: [], closing: null, schemaReady: false, schemaError: 'A estrutura do fechamento ainda precisa ser aplicada ao Supabase.' };
        return false;
      }
      throw closingResult.error;
    }

    if (arena?.id !== arenaId || day !== closingDate || view !== 'finance') return false;

    cashClosingData = {
      bookings: bookingsResult.data || [],
      sales: salesResult.data || [],
      expenses: expensesResult.data || [],
      closing: closingResult.data || null,
      schemaReady: true,
      schemaError: ''
    };
    return true;
  } catch (error) {
    console.error('Falha ao carregar fechamento diário.', error);
    cashClosingData = {
      ...cashClosingData,
      schemaReady: !cashClosingMissingSchema(error),
      schemaError: cashClosingMissingSchema(error)
        ? 'A estrutura do fechamento ainda precisa ser aplicada ao Supabase.'
        : 'Não foi possível carregar os dados do fechamento.'
    };
    return false;
  } finally {
    cashClosingLoading = false;
  }
}

function cashClosingTotals() {
  const bookingReceived = cashClosingData.bookings.reduce((sum, booking) => sum + cashClosingNumber(booking.payment_received_amount), 0);
  const inventorySales = cashClosingData.sales.reduce((sum, movement) => sum + cashClosingNumber(movement.total_amount), 0);
  const expenses = cashClosingData.expenses.reduce((sum, expense) => sum + cashClosingNumber(expense.amount), 0);
  return {
    bookingReceived,
    inventorySales,
    expenses,
    expected: bookingReceived + inventorySales - expenses,
    received: bookingReceived + inventorySales
  };
}

function cashClosingProductName(productId) {
  return inventoryProducts.find((product) => product.id === productId)?.name || 'Venda de mercadoria';
}

function cashClosingMovementRows() {
  const bookingRows = cashClosingData.bookings
    .filter((booking) => cashClosingNumber(booking.payment_received_amount) > 0)
    .map((booking) => ({
      at: booking.payment_confirmed_at || `${booking.booking_date}T${String(booking.start_hour).padStart(2, '0')}:00:00`,
      type: 'Reserva',
      description: `${courts.find((court) => court.id === booking.court_id)?.name || 'Quadra'} · ${booking.start_hour}:00`,
      method: booking.payment_provider === 'manual' ? 'Manual' : 'Pix',
      amount: cashClosingNumber(booking.payment_received_amount),
      tone: 'booking'
    }));
  const salesRows = cashClosingData.sales.map((movement) => ({
    at: movement.created_at,
    type: 'Mercadoria',
    description: `${cashClosingProductName(movement.product_id)} · ${movement.quantity} un.`,
    method: 'Venda',
    amount: cashClosingNumber(movement.total_amount),
    tone: 'sale'
  }));
  const expenseRows = cashClosingData.expenses.map((expense) => ({
    at: expense.created_at,
    type: 'Despesa',
    description: expense.description,
    method: ({ cash: 'Dinheiro', pix: 'Pix', card: 'Cartão', other: 'Outro' }[expense.payment_method] || 'Outro'),
    amount: -cashClosingNumber(expense.amount),
    tone: 'expense'
  }));
  return [...bookingRows, ...salesRows, ...expenseRows]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 8);
}

function renderCashClosingPanel() {
  const panel = $('#cashClosingPanel');
  if (!panel) return;
  const active = view === 'finance' && isAdmin && Boolean(arena);
  panel.classList.toggle('hidden', !active);
  if (!active) { panel.innerHTML = ''; return; }

  if (cashClosingLoading) {
    panel.innerHTML = '<div class="cash-closing-loading"><span class="payment-dot"></span><strong>Preparando o fechamento diário…</strong><small>Conferindo reservas, vendas e despesas.</small></div>';
    return;
  }

  if (!cashClosingData.schemaReady) {
    panel.innerHTML = `<div class="cash-closing-schema-warning"><span class="cash-closing-warning-icon">!</span><div><strong>Fechamento diário aguardando ativação</strong><p>${esc(cashClosingData.schemaError || 'A estrutura do caixa ainda não está disponível.')}</p><small>A migração de segurança precisa ser aplicada uma única vez no projeto Supabase.</small></div></div>`;
    return;
  }

  const totals = cashClosingTotals();
  const closing = cashClosingData.closing;
  const closed = Boolean(closing);
  const progress = closed
    ? 100
    : totals.expected > 0
      ? Math.min(100, Math.round((totals.received / totals.expected) * 100))
      : 0;
  const difference = closed ? cashClosingNumber(closing.difference_total) : null;
  const breakdown = closed ? (closing.payment_breakdown || {}) : {};
  const differenceLabel = difference === null ? 'Ainda não conferido' : money(difference);
  const differenceClass = difference === null ? '' : difference < -0.009 ? 'negative' : difference > 0.009 ? 'positive' : 'balanced';
  const rows = cashClosingMovementRows();
  const rowMarkup = rows.length
    ? rows.map((row) => `<tr><td><span class="cash-movement-type ${row.tone}">${esc(row.type)}</span></td><td>${esc(row.description)}</td><td>${esc(row.method)}</td><td class="cash-movement-value ${row.amount < 0 ? 'negative' : ''}">${row.amount < 0 ? '− ' : ''}${money(Math.abs(row.amount))}</td></tr>`).join('')
    : '<tr><td colspan="4" class="cash-empty-row">Nenhuma movimentação financeira registrada nesta data.</td></tr>';

  panel.innerHTML = `
    <div class="cash-closing-head">
      <div><p class="eyebrow">OPERAÇÃO DIÁRIA</p><h2>Fechamento diário de caixa</h2><p>Conferência de reservas, mercadorias e despesas da ${esc(arena.name)}.</p></div>
      <div class="cash-closing-status ${closed ? 'closed' : 'open'}"><span></span>${closed ? 'Caixa fechado' : 'Caixa em aberto'}</div>
    </div>
    <div class="cash-closing-kpis">
      <article class="cash-closing-kpi"><span>Reservas recebidas</span><strong>${money(closed ? closing.booking_received_total : totals.bookingReceived)}</strong><small>${cashClosingData.bookings.length} reserva(s) na data</small></article>
      <article class="cash-closing-kpi featured"><span>Mercadorias</span><strong>${money(closed ? closing.inventory_sales_total : totals.inventorySales)}</strong><small>${cashClosingData.sales.length} venda(s) registrada(s)</small></article>
      <article class="cash-closing-kpi"><span>Despesas</span><strong class="negative">− ${money(closed ? closing.expenses_total : totals.expenses)}</strong><small>${cashClosingData.expenses.length} lançamento(s)</small></article>
      <article class="cash-closing-kpi"><span>Saldo esperado</span><strong>${money(closed ? closing.expected_total : totals.expected)}</strong><small>${closed ? 'Valor conferido no fechamento' : 'Receitas menos despesas'}</small></article>
    </div>
    <div class="cash-closing-main-grid">
      <section class="cash-closing-summary">
        <div class="cash-card-heading"><div><h3>Resumo do movimento</h3><p>Entradas e saídas consolidadas do dia.</p></div><span class="cash-closing-date">${esc(cashClosingDateLabel(day))}</span></div>
        <div class="cash-summary-body"><div class="cash-progress-ring" style="--cash-progress:${progress}%"><div><strong>${progress}%</strong><small>${closed ? 'conferido' : 'recebido'}</small></div></div><div class="cash-summary-legend"><div><span><i class="booking"></i>Reservas de quadra</span><strong>${money(closed ? closing.booking_received_total : totals.bookingReceived)}</strong></div><div><span><i class="sale"></i>Venda de mercadorias</span><strong>${money(closed ? closing.inventory_sales_total : totals.inventorySales)}</strong></div><div><span><i class="expense"></i>Despesas lançadas</span><strong>− ${money(closed ? closing.expenses_total : totals.expenses)}</strong></div><p><b>i</b> O saldo esperado considera apenas valores efetivamente recebidos.</p></div></div>
      </section>
      <section class="cash-closing-check">
        <div class="cash-card-heading"><div><h3>Conferência do caixa</h3><p>${closed ? 'Fechamento concluído e protegido.' : 'Informe o valor encontrado no caixa.'}</p></div><span class="cash-lock-icon">${closed ? '✓' : '◷'}</span></div>
        ${closed ? `<div class="cash-closed-result"><span class="cash-closed-check">✓</span><div><strong>Caixa fechado com sucesso</strong><small>Realizado em ${esc(dateTimeLabel(closing.closed_at))}</small></div></div><div class="cash-closed-values"><span>Valor contado</span><strong>${money(closing.counted_total)}</strong><span>Diferença</span><strong class="${differenceClass}">${differenceLabel}</strong></div><div class="cash-breakdown-readonly"><span>Pix ${money(breakdown.pix || 0)}</span><span>Cartão ${money(breakdown.card || 0)}</span><span>Dinheiro ${money(breakdown.cash || 0)}</span></div>` : `<form id="cashClosingForm" class="cash-closing-form"><label>Valor contado no caixa<input id="cashCountedTotal" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0,00" required></label><div class="cash-payment-grid"><label>Pix<input id="cashBreakdownPix" type="number" min="0" step="0.01" placeholder="0,00"></label><label>Cartão<input id="cashBreakdownCard" type="number" min="0" step="0.01" placeholder="0,00"></label><label>Dinheiro<input id="cashBreakdownCash" type="number" min="0" step="0.01" placeholder="0,00"></label></div><label>Observação <textarea id="cashClosingNotes" rows="2" maxlength="500" placeholder="Ex.: diferença conferida com o responsável…"></textarea><button class="primary cash-close-submit" type="submit">Conferir e fechar caixa <span>→</span></button><small class="cash-form-note">Depois de fechado, o dia ficará protegido contra alterações.</small></form>`}
      </section>
    </div>
    <section class="cash-expenses-card"><div class="cash-card-heading"><div><h3>Despesas do dia</h3><p>Registre saídas antes de concluir o fechamento.</p></div>${closed ? '<span class="cash-locked-label">Bloqueado após fechamento</span>' : '<button type="button" class="cash-outline-button" data-cash-expense-open>＋ Lançar despesa</button>'}</div><div id="cashExpenseFormWrap" class="cash-expense-form-wrap hidden"><form id="cashExpenseForm" class="cash-expense-form"><label>Descrição<input id="cashExpenseDescription" maxlength="160" required placeholder="Ex.: compra de gelo e copos"></label><label>Categoria<select id="cashExpenseCategory"><option value="Outros">Outros</option><option value="Operação">Operação</option><option value="Manutenção">Manutenção</option><option value="Limpeza">Limpeza</option><option value="Equipe">Equipe</option></select></label><label>Forma de pagamento<select id="cashExpenseMethod"><option value="cash">Dinheiro</option><option value="pix">Pix</option><option value="card">Cartão</option><option value="other">Outro</option></select></label><label>Valor<input id="cashExpenseAmount" type="number" min="0.01" step="0.01" required placeholder="0,00"></label><div class="cash-expense-actions"><button type="button" class="secondary" data-cash-expense-cancel>Cancelar</button><button type="submit" class="primary">Salvar despesa</button></div></form></div><div class="cash-expense-list">${cashClosingData.expenses.length ? cashClosingData.expenses.map((expense) => `<div class="cash-expense-row"><span class="cash-expense-icon">−</span><div><strong>${esc(expense.description)}</strong><small>${esc(expense.category)} · ${esc(({ cash: 'Dinheiro', pix: 'Pix', card: 'Cartão', other: 'Outro' }[expense.payment_method] || 'Outro'))}</small></div><b>− ${money(expense.amount)}</b></div>`).join('') : '<div class="cash-empty-state">Nenhuma despesa lançada neste dia.</div>'}</div></section>
    <section class="cash-movements-card"><div class="cash-card-heading"><div><p class="eyebrow">HISTÓRICO DO DIA</p><h3>Movimentações financeiras</h3><p>Reservas recebidas, vendas e despesas em uma única visão.</p></div><span class="cash-history-count">${rows.length} registro(s)</span></div><div class="cash-table-scroll"><table class="cash-movements-table"><thead><tr><th>Tipo</th><th>Descrição</th><th>Origem</th><th>Valor</th></tr></thead><tbody>${rowMarkup}</tbody></table></div></section>`;
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
      cashClosingLoading = true;
      render();
      await Promise.all([refreshBookings(), loadCashClosingData()]);
      cashClosingLoading = false;
      render();
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


function announcementTypeLabel(type) {
  return {
    promotion: 'Promoção',
    notice: 'Aviso',
    event: 'Evento'
  }[type] || 'Novidade';
}

function announcementTypeIcon(type) {
  return {
    promotion: '◆',
    notice: '!',
    event: '★'
  }[type] || '●';
}

function mapArenaAnnouncement(item) {
  return {
    id: item.id,
    arenaId: item.arena_id,
    templateKey: item.template_key || null,
    type: item.announcement_type,
    title: item.title,
    description: item.description,
    imagePath: item.image_path || null,
    linkUrl: item.link_url || '',
    ctaLabel: item.cta_label || 'Ver detalhes',
    startsOn: item.starts_on,
    endsOn: item.ends_on,
    isFeatured: Boolean(item.is_featured),
    active: Boolean(item.active),
    sortOrder: Number(item.sort_order || 0),
    createdAt: item.created_at,
    updatedAt: item.updated_at
  };
}

function announcementImageUrl(item) {
  if (!item?.imagePath) return '';
  return supabase.storage.from('announcement-images').getPublicUrl(item.imagePath).data.publicUrl || '';
}

function clearAnnouncementImagePreviewObjectUrl() {
  if (!announcementImagePreviewObjectUrl) return;
  URL.revokeObjectURL(announcementImagePreviewObjectUrl);
  announcementImagePreviewObjectUrl = '';
}

function announcementStatus(item) {
  if (!item.active) return { key: 'disabled', label: 'Desativada' };
  const current = localDate(new Date());
  if (item.startsOn > current) return { key: 'scheduled', label: 'Programada' };
  if (item.endsOn < current) return { key: 'expired', label: 'Expirada' };
  return { key: 'active', label: 'Ativa' };
}

function announcementDateLabel(value) {
  if (!value) return '—';
  return new Date(value + 'T12:00:00').toLocaleDateString('pt-BR');
}

function announcementShortTitle(title) {
  const words = String(title || 'Novidade').trim().split(/\s+/).slice(0, 4);
  return words.join(' ');
}

async function loadAnnouncementsData() {
  if (!isAdmin || !arena) return false;
  const arenaId = arena.id;
  announcementsLoading = true;
  try {
    const { data, error } = await supabase
      .from('arena_announcements')
      .select('id, arena_id, template_key, announcement_type, title, description, image_path, link_url, cta_label, starts_on, ends_on, is_featured, active, sort_order, created_at, updated_at')
      .eq('arena_id', arenaId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) throw error;
    if (!isAdmin || arena?.id !== arenaId) return false;
    arenaAnnouncements = (data || []).map(mapArenaAnnouncement);
    return true;
  } finally {
    announcementsLoading = false;
  }
}

async function loadPublicAnnouncements() {
  if (!arena || isAdmin) {
    publicAnnouncements = [];
    announcementPublicIndex = 0;
    return false;
  }
  const arenaId = arena.id;
  const current = localDate(new Date());
  const { data, error } = await supabase
    .from('arena_announcements')
    .select('id, arena_id, announcement_type, title, description, image_path, link_url, cta_label, starts_on, ends_on, is_featured, active, sort_order, created_at, updated_at')
    .eq('arena_id', arenaId)
    .eq('active', true)
    .lte('starts_on', current)
    .gte('ends_on', current)
    .order('is_featured', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!arena || arena.id !== arenaId || isAdmin) return false;
  publicAnnouncements = (data || []).map(mapArenaAnnouncement);
  announcementPublicIndex = 0;
  return true;
}

function filteredArenaAnnouncements() {
  if (announcementFilter === 'all') return arenaAnnouncements;
  return arenaAnnouncements.filter((item) => announcementStatus(item).key === announcementFilter);
}

function announcementFilterCount(filterKey) {
  if (filterKey === 'all') return arenaAnnouncements.length;
  return arenaAnnouncements.filter((item) => announcementStatus(item).key === filterKey).length;
}

function announcementThumbHtml(item) {
  const src = announcementImageUrl(item);
  const classes = `announcement-admin-thumb type-${esc(item.type)} ${src ? '' : 'no-image'}`;
  const image = src ? `<img src="${esc(src)}" alt="" data-announcement-image>` : '';
  return `<div class="${classes}" data-short="${esc(announcementShortTitle(item.title))}">${image}</div>`;
}

function renderAnnouncementsPanel() {
  const panel = $('#announcementsPanel');
  if (!panel || view !== 'announcements' || !isAdmin || !arena) return;

  if (announcementsLoading) {
    panel.innerHTML = '<div class="announcement-admin-shell"><div class="announcement-admin-empty">Carregando novidades da arena...</div></div>';
    return;
  }

  const rows = filteredArenaAnnouncements();
  const filters = [
    ['all', 'Todos'],
    ['active', 'Ativas'],
    ['scheduled', 'Programadas'],
    ['expired', 'Expiradas']
  ];

  panel.innerHTML = `
    <div class="announcement-admin-shell">
      <div class="announcement-admin-head">
        <div class="announcement-admin-title">
          <span class="announcement-admin-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 13V9l11-4v12L4 13Z"></path><path d="M15 9.5c2.7.4 4.5 1.8 4.5 3.5S17.7 16.1 15 16.5"></path><path d="m5 13 1.5 6h3L8 14"></path>
            </svg>
          </span>
          <div><h2>Novidades e Avisos</h2><p>Divulgue promoções, eventos, comunicados e novidades para os clientes da ${esc(arena.name)}.</p></div>
        </div>
        <button class="announcement-new-button" type="button" data-announcement-new>＋ Nova novidade</button>
      </div>
      <div class="announcement-tabs" role="tablist" aria-label="Filtrar novidades">
        ${filters.map(([key, label]) => `<button type="button" class="announcement-tab ${announcementFilter === key ? 'active' : ''}" data-announcement-filter="${key}">${label}<span>${announcementFilterCount(key)}</span></button>`).join('')}
      </div>
      <div class="announcement-admin-list">
        ${rows.length ? rows.map((item) => {
          const status = announcementStatus(item);
          return `<article class="announcement-admin-row">
            ${announcementThumbHtml(item)}
            <div class="announcement-admin-copy">
              <div class="announcement-admin-meta">
                <span class="announcement-status-badge ${status.key}">${esc(status.label)}</span>
                <span class="announcement-type-badge ${esc(item.type)}">${esc(announcementTypeLabel(item.type))}</span>
                ${item.isFeatured ? '<span class="announcement-feature-badge">★ Destaque</span>' : ''}
              </div>
              <strong>${esc(item.title)}</strong>
              <p>${esc(item.description)}</p>
              <span class="announcement-admin-date">▣ ${announcementDateLabel(item.startsOn)} – ${announcementDateLabel(item.endsOn)}</span>
            </div>
            <div class="announcement-admin-actions">
              <button class="announcement-toggle ${item.active ? 'active' : ''}" type="button" data-announcement-toggle="${esc(item.id)}" aria-pressed="${item.active}" aria-label="${item.active ? 'Desativar' : 'Ativar'} ${esc(item.title)}"></button>
              <button class="announcement-action-button edit" type="button" data-announcement-edit="${esc(item.id)}">✎ <span>Editar</span></button>
              <button class="announcement-action-button delete" type="button" data-announcement-delete="${esc(item.id)}" aria-label="Excluir ${esc(item.title)}">⌫</button>
            </div>
          </article>`;
        }).join('') : '<div class="announcement-admin-empty">Nenhuma novidade encontrada neste filtro.</div>'}
      </div>
    </div>`;
}

function announcementPublicCardStyle(item, src) {
  return src ? ` style="background-image:url('${esc(src)}')"` : '';
}

function announcementPeriodText(item) {
  if (item.startsOn === item.endsOn) return announcementDateLabel(item.startsOn);
  return `${announcementDateLabel(item.startsOn)} – ${announcementDateLabel(item.endsOn)}`;
}

function announcementMainCta(item) {
  if (item.linkUrl) {
    return `<a class="announcement-public-cta" href="${esc(item.linkUrl)}" target="_blank" rel="noopener noreferrer">${esc(item.ctaLabel)} <span aria-hidden="true">→</span></a>`;
  }
  if (item.type === 'promotion' || /reserv/i.test(item.ctaLabel)) {
    return `<button class="announcement-public-cta" type="button" data-announcement-schedule>${esc(item.ctaLabel)} <span aria-hidden="true">→</span></button>`;
  }
  return `<button class="announcement-public-cta" type="button" data-announcement-detail="${esc(item.id)}">${esc(item.ctaLabel)} <span aria-hidden="true">→</span></button>`;
}

function renderPublicAnnouncements() {
  const section = $('#arenaAnnouncementsPublic');
  if (!section) return;

  const visible = !isAdmin && view === 'player' && Boolean(arena) && publicAnnouncements.length > 0;
  section.classList.toggle('hidden', !visible);
  if (!visible) {
    section.innerHTML = '';
    return;
  }

  const total = publicAnnouncements.length;
  announcementPublicIndex = ((announcementPublicIndex % total) + total) % total;
  const ordered = Array.from({ length: total }, (_, offset) =>
    publicAnnouncements[(announcementPublicIndex + offset) % total]
  );
  const main = ordered[0];
  const secondary = ordered.slice(1, 3);
  const mainSrc = announcementImageUrl(main);

  section.innerHTML = `
    <div class="announcement-public-head">
      <div class="announcement-public-title">
        <span aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 13V9l11-4v12L4 13Z"></path><path d="M15 9.5c2.7.4 4.5 1.8 4.5 3.5S17.7 16.1 15 16.5"></path><path d="m5 13 1.5 6h3L8 14"></path>
          </svg>
        </span>
        <div><h2>Novidades da Arena</h2><p>Promoções, avisos e novidades da ${esc(arena.name)}.</p></div>
      </div>
      ${total > 1 ? `<div class="announcement-public-nav"><button type="button" data-announcement-prev aria-label="Novidade anterior">‹</button><button type="button" data-announcement-next aria-label="Próxima novidade">›</button></div>` : ''}
    </div>
    <div class="announcement-public-grid">
      <article class="announcement-public-card main type-${esc(main.type)} ${mainSrc ? 'has-image' : ''}"${announcementPublicCardStyle(main, mainSrc)}>
        <div class="announcement-public-content">
          <span class="announcement-public-type ${esc(main.type)}">${announcementTypeIcon(main.type)} ${esc(announcementTypeLabel(main.type))}${main.isFeatured ? ' · Destaque' : ''}</span>
          <h3>${esc(main.title)}</h3>
          <p>${esc(main.description)}</p>
          <div class="announcement-public-period">▣ ${esc(announcementPeriodText(main))}</div>
          ${announcementMainCta(main)}
        </div>
        ${total > 1 ? `<div class="announcement-public-dots">${publicAnnouncements.map((_, index) => `<i class="${index === announcementPublicIndex ? 'active' : ''}"></i>`).join('')}</div>` : ''}
      </article>
      ${secondary.map((item) => {
        const src = announcementImageUrl(item);
        return `<article class="announcement-public-card secondary type-${esc(item.type)} ${src ? 'has-image' : ''}"${announcementPublicCardStyle(item, src)}>
          <div>
            <span class="announcement-public-type ${esc(item.type)}">${announcementTypeIcon(item.type)} ${esc(announcementTypeLabel(item.type))}</span>
            <h3>${esc(item.title)}</h3>
            <div class="announcement-public-period">▣ ${esc(announcementPeriodText(item))}</div>
            <p>${esc(item.description)}</p>
            ${item.linkUrl
              ? `<a class="announcement-public-detail" href="${esc(item.linkUrl)}" target="_blank" rel="noopener noreferrer">${esc(item.ctaLabel)} →</a>`
              : `<button class="announcement-public-detail" type="button" data-announcement-detail="${esc(item.id)}">${esc(item.ctaLabel)} →</button>`}
          </div>
        </article>`;
      }).join('')}
    </div>`;
}

function renderAnnouncementDetail(id) {
  const item = publicAnnouncements.find((candidate) => candidate.id === id);
  if (!item) return;
  const src = announcementImageUrl(item);
  const content = $('#announcementDetailContent');
  content.innerHTML = `
    <div class="announcement-detail-visual type-${esc(item.type)} ${src ? 'has-image' : ''}"${announcementPublicCardStyle(item, src)}>
      <button type="button" class="announcement-detail-close" data-announcement-detail-close aria-label="Fechar">×</button>
      <span class="announcement-public-type ${esc(item.type)}">${announcementTypeIcon(item.type)} ${esc(announcementTypeLabel(item.type))}</span>
      <h2 id="announcementDetailTitle">${esc(item.title)}</h2>
      <p>${esc(item.description)}</p>
    </div>
    <div class="announcement-detail-body">
      <strong>Período de exibição</strong>
      <p>${esc(announcementPeriodText(item))}</p>
      <div class="announcement-detail-footer">
        <small>Publicado pela ${esc(arena?.name || 'arena')}.</small>
        ${item.linkUrl ? `<a href="${esc(item.linkUrl)}" target="_blank" rel="noopener noreferrer">${esc(item.ctaLabel)} →</a>` : ''}
      </div>
    </div>`;
  $('#announcementDetailDialog').showModal();
}

function clearAnnouncementImagePreview() {
  clearAnnouncementImagePreviewObjectUrl();
  const preview = $('#announcementImagePreview');
  if (preview) preview.innerHTML = '<span aria-hidden="true">◇</span><small>Prévia do banner</small>';
}

function currentAnnouncementFormImage() {
  const file = $('#announcementImage')?.files?.[0];
  if (file) {
    clearAnnouncementImagePreviewObjectUrl();
    announcementImagePreviewObjectUrl = URL.createObjectURL(file);
    return announcementImagePreviewObjectUrl;
  }
  const item = arenaAnnouncements.find((candidate) => candidate.id === announcementEditingId);
  return announcementImageUrl(item);
}

function renderAnnouncementFormPreview() {
  const target = $('#announcementLivePreview');
  if (!target) return;
  const title = $('#announcementTitle')?.value.trim() || 'Sua novidade aparece aqui';
  const description = $('#announcementDescription')?.value.trim() || 'Use uma mensagem curta para chamar a atenção dos jogadores.';
  const type = $('#announcementType')?.value || 'promotion';
  const src = currentAnnouncementFormImage();
  target.innerHTML = `<div class="announcement-preview-card ${src ? 'has-image' : ''}"${src ? ` style="background-image:url('${esc(src)}')"` : ''}>
    <span class="announcement-public-type ${esc(type)}">${announcementTypeIcon(type)} ${esc(announcementTypeLabel(type))}</span>
    <strong>${esc(title)}</strong>
    <p>${esc(description)}</p>
  </div>`;
  const imagePreview = $('#announcementImagePreview');
  if (imagePreview) {
    imagePreview.innerHTML = src
      ? `<img src="${esc(src)}" alt="Prévia da imagem da novidade" data-announcement-image>`
      : '<span aria-hidden="true">◇</span><small>Prévia do banner</small>';
  }
  const descriptionCount = $('#announcementDescriptionCount');
  if (descriptionCount) descriptionCount.textContent = String($('#announcementDescription')?.value.length || 0);
}

function openAnnouncementDialog(id = null) {
  if (!isAdmin || !arena) return;
  announcementEditingId = id;
  const item = arenaAnnouncements.find((candidate) => candidate.id === id) || null;
  const form = $('#announcementForm');
  form.reset();
  clearAnnouncementImagePreview();

  const now = new Date();
  const weekLater = new Date(now);
  weekLater.setDate(weekLater.getDate() + 7);

  $('#announcementDialogTitle').textContent = item ? 'Editar novidade / aviso' : 'Nova novidade / aviso';
  $('#announcementDialogIntro').textContent = item
    ? 'Atualize as informações que aparecem para os clientes da sua arena.'
    : 'Crie um destaque para aparecer no início da página pública da sua arena.';
  $('#announcementTitle').value = item?.title || '';
  $('#announcementDescription').value = item?.description || '';
  $('#announcementType').value = item?.type || 'promotion';
  $('#announcementCtaLabel').value = item?.ctaLabel || 'Ver detalhes';
  $('#announcementStartsOn').value = item?.startsOn || localDate(now);
  $('#announcementEndsOn').value = item?.endsOn || localDate(weekLater);
  $('#announcementLinkUrl').value = item?.linkUrl || '';
  $('#announcementFeatured').checked = Boolean(item?.isFeatured);
  $('#announcementImage').value = '';
  $('#announcementError').textContent = '';
  $('#submitAnnouncement').textContent = item ? 'Salvar alterações' : 'Publicar novidade';
  renderAnnouncementFormPreview();
  $('#announcementDialog').showModal();
}

async function uploadAnnouncementImage(item, file) {
  if (!arena || !item || !file) return item?.imagePath || null;
  const allowedTypes = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
  };
  const extension = allowedTypes[file.type];
  if (!extension) throw new Error('Use uma imagem JPG, PNG ou WebP.');
  if (file.size > 5 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 5 MB.');

  const previousPath = item.imagePath || null;
  const uniquePart = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `${arena.id}/${item.id}/${uniquePart}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from('announcement-images')
    .upload(path, file, { cacheControl: '3600', contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;

  const { error: updateError } = await supabase
    .from('arena_announcements')
    .update({ image_path: path })
    .eq('id', item.id)
    .eq('arena_id', arena.id);
  if (updateError) {
    await supabase.storage.from('announcement-images').remove([path]);
    throw updateError;
  }

  if (previousPath && previousPath !== path) {
    const { error: removeError } = await supabase.storage.from('announcement-images').remove([previousPath]);
    if (removeError) console.warn('Não foi possível remover a imagem anterior da novidade.', removeError);
  }
  return path;
}

async function deactivateOtherFeaturedAnnouncements(exceptId = '') {
  if (!arena) return;
  let query = supabase
    .from('arena_announcements')
    .update({ is_featured: false })
    .eq('arena_id', arena.id)
    .eq('active', true)
    .eq('is_featured', true);
  if (exceptId) query = query.neq('id', exceptId);
  const { error } = await query;
  if (error) throw error;
}

async function setView(nextView) {
  if (!['admin', 'finance', 'inventory', 'announcements', 'settings', 'master', 'player'].includes(nextView)) return;

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
  if ((nextView === 'admin' || nextView === 'finance' || nextView === 'inventory' || nextView === 'announcements' || nextView === 'settings') && !arena) return;

  if (nextView === 'finance') {
    view = 'finance';
    cashClosingLoading = true;
    render();
    try {
      await loadCashClosingData();
    } catch (error) {
      console.error(error);
      toast('Não foi possível carregar o fechamento diário.');
    } finally {
      cashClosingLoading = false;
      render();
    }
    return;
  }

  if (nextView === 'settings') {
    view = 'settings';
    arenaSettingsDetail = null;
    settingsTab = 'data';
    settingsCourtId = null;
    render();
    try { await loadArenaSettings(); }
    catch (error) {
      console.error(error);
      $('#arenaSettingsContent').innerHTML = '<div class="master-empty">Não foi possível carregar as configurações. Tente novamente.</div>';
    }
    return;
  }

  if (nextView === 'announcements') {
    view = 'announcements';
    announcementsLoading = true;
    render();
    try {
      await loadAnnouncementsData();
    } catch (error) {
      console.error(error);
      toast('Não foi possível carregar as novidades. Tente novamente.');
    } finally {
      announcementsLoading = false;
      render();
    }
    return;
  }
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
  syncPremiumDatePicker();
  if ($('#weekdayLabel')) $('#weekdayLabel').textContent = weekdayLabel(day);

  const masterMode = view === 'master' && isPlatformAdmin;
  const inventoryMode = view === 'inventory' && isAdmin && Boolean(arena);
  const announcementsMode = view === 'announcements' && isAdmin && Boolean(arena);
  const settingsMode = view === 'settings' && isAdmin && Boolean(arena);
  const masterPanel = $('#masterPanel');
  const merchandisePanel = $('#merchandisePanel');
  const announcementsPanel = $('#announcementsPanel');
  const cashClosingPanel = $('#cashClosingPanel');
  const publicAnnouncementsPanel = $('#arenaAnnouncementsPublic');
  const settingsPanel = $('#arenaSettingsPanel');
  const partnerSpotlight = $('#partnerSpotlight');
  if (masterPanel) masterPanel.classList.toggle('hidden', !masterMode);
  if (merchandisePanel) merchandisePanel.classList.toggle('hidden', !inventoryMode);
  if (announcementsPanel) announcementsPanel.classList.toggle('hidden', !announcementsMode);
  if (cashClosingPanel) cashClosingPanel.classList.toggle('hidden', !(view === 'finance' && isAdmin && Boolean(arena)));
  if (publicAnnouncementsPanel) publicAnnouncementsPanel.classList.add('hidden');
  if (settingsPanel) settingsPanel.classList.toggle('hidden', !settingsMode);
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
    if (cashClosingPanel) { cashClosingPanel.classList.add('hidden'); cashClosingPanel.innerHTML = ''; }

    renderMasterPanel();
    return;
  }

  if (masterPanel) masterPanel.classList.add('hidden');

  if (settingsMode) {
    document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === 'settings'));
    $('#crumb').textContent = 'Configurações da arena';
    $('#eyebrow').textContent = 'CONFIGURAÇÕES DA ARENA';
    $('#title').textContent = 'Configurações da arena';
    $('#subtitle').textContent = 'Mantenha os dados, as quadras e os acessos da sua arena em dia.';
    $('#newBooking').classList.add('hidden');
    $('#blockSchedule').classList.add('hidden');
    $('#stats').classList.add('hidden');
    document.querySelector('.workspace').classList.add('hidden');
    $('#blockPanel').classList.add('hidden');
    $('#bottom').hidden = true;
    $('#bottom').style.display = 'none';
    const profitPanel = $('#profitPanel');
    if (profitPanel) { profitPanel.style.display = 'none'; profitPanel.innerHTML = ''; }
    if (cashClosingPanel) { cashClosingPanel.classList.add('hidden'); cashClosingPanel.innerHTML = ''; }
    renderArenaSettings();
    return;
  }

  if (announcementsMode) {
    document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === 'announcements'));
    $('#crumb').textContent = 'Novidades e avisos';
    $('#eyebrow').textContent = 'COMUNICAÇÃO DA ARENA';
    $('#title').textContent = 'Novidades e avisos';
    $('#subtitle').textContent = 'Divulgue promoções, eventos e comunicados diretamente para os jogadores.';
    $('#newBooking').classList.add('hidden');
    $('#blockSchedule').classList.add('hidden');
    $('#stats').classList.add('hidden');
    document.querySelector('.workspace').classList.add('hidden');
    $('#blockPanel').classList.add('hidden');
    $('#bottom').hidden = true;
    $('#bottom').style.display = 'none';
    const profitPanel = $('#profitPanel');
    if (profitPanel) { profitPanel.style.display = 'none'; profitPanel.innerHTML = ''; }
    if (cashClosingPanel) { cashClosingPanel.classList.add('hidden'); cashClosingPanel.innerHTML = ''; }
    renderAnnouncementsPanel();
    return;
  }
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
    if (cashClosingPanel) { cashClosingPanel.classList.add('hidden'); cashClosingPanel.innerHTML = ''; }

    renderMerchandisePanel();
    return;
  }

  if (!arena) {
    view = 'player';
    document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === 'player'));
    $('#crumb').textContent = 'Visão do jogador';
    $('#eyebrow').textContent = 'AGENDA DE QUADRAS';
    const isPrivateArena = unavailableArenaStatus === 'private';
    const isSuspendedArena = unavailableArenaStatus === 'suspended';
    $('#title').textContent = isSuspendedArena
      ? 'Esta arena está temporariamente indisponível.'
      : isPrivateArena ? 'Esta agenda está privada no momento.' : 'Selecione uma arena para começar.';
    $('#subtitle').textContent = isSuspendedArena
      ? 'O acesso administrativo e os novos agendamentos desta arena estão temporariamente suspensos.'
      : isPrivateArena
        ? 'A arena pausou o acesso público. Entre em contato com ela para saber quando as reservas serão reabertas.'
        : 'A agenda será carregada somente depois que você escolher uma arena no menu lateral.';
    $('#workspaceTitle').textContent = 'Agenda de quadras';
    $('#workspaceSubtitle').textContent = 'Escolha uma arena para visualizar os horários disponíveis.';
    $('#stats').innerHTML = '';
    $('#stats').classList.remove('hidden');
    document.querySelector('.workspace').classList.remove('hidden');
    $('#schedule').style.removeProperty('--cols');
    $('#schedule').innerHTML = isSuspendedArena
      ? '<div class="empty arena-empty-state">Esta arena está temporariamente indisponível para novos agendamentos.</div>'
      : isPrivateArena
        ? '<div class="empty arena-empty-state">A agenda desta arena não está disponível para jogadores agora.</div>'
        : '<div class="empty arena-empty-state">Nenhuma arena carregada. Selecione uma arena para visualizar a agenda.</div>';
    $('#dateCaption').textContent = '';
    $('#newBooking').classList.add('hidden');
    $('#blockSchedule').classList.add('hidden');
    $('#bottom').hidden = true;
    $('#bottom').style.display = 'none';
    $('#blockPanel').classList.add('hidden');
    if (partnerSpotlight) partnerSpotlight.classList.toggle('hidden', Boolean(unavailableArenaStatus));
    const merchandisePanel = $('#merchandisePanel');
    if (merchandisePanel) merchandisePanel.classList.add('hidden');
    if (publicAnnouncementsPanel) { publicAnnouncementsPanel.classList.add('hidden'); publicAnnouncementsPanel.innerHTML = ''; }

    const profitPanel = $('#profitPanel');
    if (profitPanel) {
      profitPanel.style.display = 'none';
      profitPanel.innerHTML = '';
    }
    if (cashClosingPanel) { cashClosingPanel.classList.add('hidden'); cashClosingPanel.innerHTML = ''; }

    $('#courtFilter').innerHTML = '<option value="all">Todas as quadras</option>';
    $('#courtFilter').disabled = true;
    $('#date').disabled = true;
    $('#datePickerTrigger').disabled = true;
    $('#prevDay').disabled = true;
    $('#nextDay').disabled = true;
    return;
  }

  if (partnerSpotlight) partnerSpotlight.classList.add('hidden');
  renderPublicAnnouncements();
  $('#stats').classList.remove('hidden');
  $('#courtFilter').disabled = false;
  $('#date').disabled = false;
  $('#datePickerTrigger').disabled = false;
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
  renderCashClosingPanel();

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

function bookingFullDateLabel(value) {
  return new Date(value + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function setBookingCreateMode(enabled) {
  const form = $('#bookingForm');
  if (!form) return;
  form.classList.toggle('booking-create-mode', enabled);
}

function syncBookingCreateSummary() {
  const summary = $('#bookingCreateSummary');
  if (!summary || !arena) return;

  const courtIndex = Number($('#bookingCourt')?.value || 0);
  const duration = Math.max(1, Number($('#bookingDuration')?.value || 1));
  const rawHour = $('#bookingHour')?.value ?? '';
  const hour = rawHour === '' ? null : Number(rawHour);
  const court = courts[courtIndex] || null;
  const totalAmount = court ? Number(court.price || 0) * duration : 0;

  if ($('#bookingSummaryArena')) $('#bookingSummaryArena').textContent = arena.name || 'Arena';
  if ($('#bookingSummaryDate')) $('#bookingSummaryDate').textContent = bookingFullDateLabel(day);
  if ($('#bookingSummaryWeekday')) $('#bookingSummaryWeekday').textContent = weekdayLabel(day);
  if ($('#bookingSummaryHour')) {
    $('#bookingSummaryHour').textContent = Number.isFinite(hour)
      ? `${String(hour).padStart(2, '0')}:00 – ${String(hour + duration).padStart(2, '0')}:00`
      : 'Sem horário disponível';
  }
  if ($('#bookingSummaryDuration')) {
    $('#bookingSummaryDuration').textContent = `${duration} hora${duration > 1 ? 's' : ''}`;
  }
  if ($('#bookingSummaryCourt')) {
    $('#bookingSummaryCourt').textContent = court
      ? `${court.name}${court.sport ? ' · ' + court.sport : ''}`
      : '—';
  }
  if ($('#bookingSummaryTotal')) $('#bookingSummaryTotal').textContent = money(totalAmount);
  if ($('#bookingSummaryTotalCaption')) {
    $('#bookingSummaryTotalCaption').textContent = `${duration} hora${duration > 1 ? 's' : ''} de quadra`;
  }

  const securityText = summary.querySelector('.booking-summary-security p');
  if (securityText) {
    securityText.textContent = view === 'admin'
      ? 'A reserva será adicionada diretamente à agenda da arena.'
      : 'O horário será confirmado automaticamente após o pagamento do sinal via Pix.';
  }
}

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
  syncBookingCreateSummary();
  $('#submitBooking').disabled = !free.length;
}

function openBooking(court = 0, hour, duration = 1) {
  clearInterval(paymentPollTimer);
  selectedId = null;
  $('#bookingForm').reset();
  setBookingCreateMode(true);
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
  $('#dialogInfo').textContent = `${bookingFullDateLabel(day)} · ${weekdayLabel(day)}`;
  $('#bookingCourt').value = String(court);
  $('#bookingDuration').value = String(duration);
  $('#dialogActions').innerHTML = `<button class="primary" type="submit" id="submitBooking">${view === 'admin' ? 'Confirmar reserva' : 'Gerar Pix de R$ 0,01'}</button>`;
  updateHours(hour);
  syncBookingCreateSummary();
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
  setBookingCreateMode(false);
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
  setBookingCreateMode(false);
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
    ? remainingAmount > 0.001
      ? 'Use “Minha reserva” para consultar este agendamento. Pague o saldo restante diretamente na arena no dia do jogo.'
      : 'Use “Minha reserva” para consultar este agendamento novamente.'
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
  setBookingCreateMode(false);
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
$('#bookingHour').addEventListener('change', syncBookingCreateSummary);
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
async function leaveAdminSession() {
  adminNotifications.reset();
  await supabase.auth.signOut();
  isAdmin = false;
  isPlatformAdmin = false;
  currentAdminUserId = '';
  currentAdminName = '';
  currentAdminEmail = '';
  currentAdminPhone = '';
  masterArenas = [];
  arenaSettingsDetail = null;
  view = 'player';
  if (arena && !arena.public_access) {
    activeArenaSlug = '';
    ++arenaChangeVersion;
    clearArenaIdentity();
  }
  await syncBookingsRealtime();
  await refreshBookings(false);
  if (arena) await loadPublicAnnouncements();
  await loadArenaCatalog();
  render();
}
$('#seePlayer').onclick = async () => {
  await leaveAdminSession();
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

const cashClosingConfirmDialog = $('#cashClosingConfirmDialog');
const cashClosingConfirmForm = $('#cashClosingConfirmForm');

function settleCashClosingConfirmation(confirmed) {
  const resolve = cashClosingConfirmationResolver;
  cashClosingConfirmationResolver = null;
  if (cashClosingConfirmDialog?.open) cashClosingConfirmDialog.close();
  resolve?.(confirmed);
}

function requestCashClosingConfirmation({ dateLabel, expected, countedTotal, difference }) {
  const balanced = Math.abs(difference) <= 0.009;
  const differenceTone = balanced ? 'balanced' : difference < 0 ? 'negative' : 'positive';
  const differenceLabel = balanced
    ? 'R$ 0,00'
    : `${difference < 0 ? '− ' : '+ '}${money(Math.abs(difference))}`;
  const statusTitle = balanced ? 'Conferência equilibrada' : difference < 0 ? 'Atenção à falta no caixa' : 'Atenção à sobra no caixa';
  const statusText = balanced
    ? 'O valor contado está exatamente igual ao esperado.'
    : difference < 0
      ? `Faltará ${money(Math.abs(difference))} no fechamento.`
      : `Haverá uma sobra de ${money(difference)} no fechamento.`;

  if (!cashClosingConfirmDialog || !cashClosingConfirmForm) {
    return Promise.resolve(window.confirm(`Confirmar o fechamento de ${dateLabel}?\n\nValor esperado: ${money(expected)}\nValor contado: ${money(countedTotal)}\n${statusText}\n\nDepois de concluído, o dia ficará protegido contra alterações.`));
  }

  $('#cashClosingConfirmDescription').textContent = `Confira os valores antes de proteger o caixa de ${dateLabel}.`;
  $('#cashClosingConfirmExpected').textContent = money(expected);
  $('#cashClosingConfirmCounted').textContent = money(countedTotal);
  const differenceElement = $('#cashClosingConfirmDifference');
  const differenceCard = differenceElement?.closest('.cash-confirm-difference');
  if (differenceElement) differenceElement.textContent = differenceLabel;
  if (differenceCard) differenceCard.dataset.tone = differenceTone;
  const statusElement = $('#cashClosingConfirmStatus');
  if (statusElement) statusElement.dataset.tone = balanced ? 'balanced' : 'attention';
  $('#cashClosingConfirmStatusTitle').textContent = statusTitle;
  $('#cashClosingConfirmStatusText').textContent = statusText;

  if (cashClosingConfirmationResolver) settleCashClosingConfirmation(false);
  cashClosingConfirmDialog.showModal();
  return new Promise((resolve) => {
    cashClosingConfirmationResolver = resolve;
  });
}

if (cashClosingConfirmDialog && cashClosingConfirmForm) {
  cashClosingConfirmForm.addEventListener('submit', (event) => {
    event.preventDefault();
    settleCashClosingConfirmation(true);
  });
  $('#cancelCashClosingConfirm')?.addEventListener('click', () => settleCashClosingConfirmation(false));
  $('#closeCashClosingConfirm')?.addEventListener('click', () => settleCashClosingConfirmation(false));
  cashClosingConfirmDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    settleCashClosingConfirmation(false);
  });
  cashClosingConfirmDialog.addEventListener('click', (event) => {
    if (event.target === cashClosingConfirmDialog) settleCashClosingConfirmation(false);
  });
}

const cashClosingPanel = $('#cashClosingPanel');
if (cashClosingPanel) {
  cashClosingPanel.addEventListener('click', (event) => {
    const openExpense = event.target.closest('[data-cash-expense-open]');
    const cancelExpense = event.target.closest('[data-cash-expense-cancel]');
    if (openExpense) {
      $('#cashExpenseFormWrap')?.classList.remove('hidden');
      $('#cashExpenseDescription')?.focus();
    }
    if (cancelExpense) {
      $('#cashExpenseForm')?.reset();
      $('#cashExpenseFormWrap')?.classList.add('hidden');
    }
  });

  cashClosingPanel.addEventListener('submit', async (event) => {
    if (event.target.id === 'cashExpenseForm') {
      event.preventDefault();
      if (!arena || cashClosingData.closing) return;
      const description = $('#cashExpenseDescription').value.trim();
      const category = $('#cashExpenseCategory').value;
      const paymentMethod = $('#cashExpenseMethod').value;
      const amount = Number($('#cashExpenseAmount').value || 0);
      if (description.length < 2 || amount <= 0) {
        toast('Informe a descrição e um valor válido para a despesa.');
        return;
      }
      const button = event.target.querySelector('button[type="submit"]');
      button.disabled = true;
      button.textContent = 'Salvando…';
      try {
        const { error } = await supabase.from('cash_expenses').insert({
          arena_id: arena.id,
          expense_date: day,
          description,
          category,
          payment_method: paymentMethod,
          amount
        });
        if (error) throw error;
        toast('Despesa lançada no fechamento do dia.');
        await loadCashClosingData();
        render();
      } catch (error) {
        console.error(error);
        toast('Não foi possível lançar a despesa.');
      } finally {
        button.disabled = false;
        button.textContent = 'Salvar despesa';
      }
      return;
    }

    if (event.target.id === 'cashClosingForm') {
      event.preventDefault();
      if (!arena || cashClosingData.closing || cashClosingBusy) return;
      const countedTotal = Number($('#cashCountedTotal').value || 0);
      const breakdown = {
        pix: Number($('#cashBreakdownPix').value || 0),
        card: Number($('#cashBreakdownCard').value || 0),
        cash: Number($('#cashBreakdownCash').value || 0)
      };
      const breakdownTotal = breakdown.pix + breakdown.card + breakdown.cash;
      if (!Number.isFinite(countedTotal) || countedTotal < 0) {
        toast('Informe o valor contado no caixa.');
        return;
      }
      if (breakdownTotal > 0 && Math.abs(breakdownTotal - countedTotal) > 0.01) {
        toast('A divisão por forma de pagamento precisa fechar com o valor contado.');
        return;
      }
      const expected = cashClosingTotals().expected;
      const difference = countedTotal - expected;
      if (!await requestCashClosingConfirmation({
        dateLabel: cashClosingDateLabel(day),
        expected,
        countedTotal,
        difference
      })) return;

      cashClosingBusy = true;
      const button = event.target.querySelector('button[type="submit"]');
      button.disabled = true;
      button.textContent = 'Concluindo fechamento…';
      try {
        const { error } = await supabase.rpc('close_cash_day', {
          target_arena_id: arena.id,
          target_date: day,
          target_counted_total: countedTotal,
          target_payment_breakdown: breakdown,
          target_notes: $('#cashClosingNotes').value.trim() || null
        });
        if (error) throw error;
        toast('Caixa fechado e registrado com sucesso.');
        await loadCashClosingData();
        render();
      } catch (error) {
        console.error(error);
        toast(error?.message || 'Não foi possível concluir o fechamento.');
      } finally {
        cashClosingBusy = false;
        button.disabled = false;
        button.textContent = 'Conferir e fechar caixa →';
      }
    }
  });
}

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
  if (event.target.value) await selectPremiumAgendaDate(event.target.value);
};

$('#datePickerTrigger').onclick = () => {
  if ($('#datePickerTrigger').disabled) return;
  const open = !$('#datePickerPopover').classList.contains('hidden');
  setPremiumCalendarOpen(!open);
};

$('#datePickerPrevMonth').onclick = () => {
  datePickerCursor = new Date(datePickerCursor.getFullYear(), datePickerCursor.getMonth() - 1, 1, 12);
  renderPremiumDatePicker();
};

$('#datePickerNextMonth').onclick = () => {
  datePickerCursor = new Date(datePickerCursor.getFullYear(), datePickerCursor.getMonth() + 1, 1, 12);
  renderPremiumDatePicker();
};

$('#datePickerGrid').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-premium-date]');
  if (!button) return;
  await selectPremiumAgendaDate(button.dataset.premiumDate);
});

$('#datePickerToday').onclick = async () => {
  datePickerCursor = new Date(today + 'T12:00:00');
  await selectPremiumAgendaDate(today);
  renderPremiumDatePicker();
};

$('#datePickerClear').onclick = () => {
  datePickerCursor = new Date(day + 'T12:00:00');
  renderPremiumDatePicker();
  setPremiumCalendarOpen(false);
};

document.addEventListener('pointerdown', (event) => {
  const picker = event.target.closest('.premium-date-picker');
  if (!picker && !$('#datePickerPopover').classList.contains('hidden')) setPremiumCalendarOpen(false);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !$('#datePickerPopover').classList.contains('hidden')) {
    setPremiumCalendarOpen(false);
    $('#datePickerTrigger').focus();
  }
});

async function moveDay(amount) {
  const date = new Date(day + 'T12:00:00');
  date.setDate(date.getDate() + amount);
  day = localDate(date);
  datePickerCursor = new Date(day + 'T12:00:00');
  setPremiumCalendarOpen(false);
  await refreshBookings();
}
$('#prevDay').onclick = () => moveDay(-1);
$('#nextDay').onclick = () => moveDay(1);
$('#adminLogin').onclick = () => {
  renderLoginError('');
  $('#loginForm').reset();
  $('#loginDialog').showModal();
};

$('#closeLogin').onclick = () => $('#loginDialog').close();

$('#forgotPassword').onclick = async () => {
  const email = $('#adminEmail').value.trim().toLowerCase();
  renderLoginError('');

  if (!email) {
    renderLoginError('Informe seu e-mail para recuperar a senha.');
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
    renderLoginError(error.message || 'Não foi possível enviar o link de recuperação.');
  }
};

$('#loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = $('#adminEmail').value.trim().toLowerCase();
  const password = $('#adminPassword').value;

  renderLoginError('');

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
    toast(view === 'master' ? 'Painel Mestre iniciado.' : `Acesso administrativo da ${arena.name} iniciado.`);
  } catch (error) {
    console.error(error);
    if (error?.code === 'ARENA_SUSPENDED') {
      renderLoginError(error.message, {
        type: 'suspended',
        reason: error.suspensionReason,
        arenaName: error.arenaName
      });
    } else {
      renderLoginError(error.message || 'E-mail ou senha inválidos.');
    }
  }
});

$('#adminLogout').onclick = async () => {
  await leaveAdminSession();
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
    unavailableArenaStatus = '';
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
  unavailableArenaStatus = '';
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

    await loadPublicAnnouncements();
    if (changeVersion !== arenaChangeVersion) return;

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
      try {
        const { data } = await supabase.rpc('get_public_arena_status', { target_slug: nextSlug });
        unavailableArenaStatus = ['private', 'suspended'].includes(data) ? data : '';
      } catch { unavailableArenaStatus = ''; }
      clearArenaIdentity();
      render();
    }

    if (!silent && !['private', 'suspended'].includes(unavailableArenaStatus)) toast('Não foi possível trocar de arena. Tente novamente.');
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

$('#masterArenaList').addEventListener('click', (event) => {
  const toggle = event.target.closest('[data-master-toggle-arena]');
  if (toggle) {
    event.stopPropagation();
    openMasterArenaStatusDialog(toggle.dataset.masterToggleArena);
    return;
  }
  const row = event.target.closest('[data-master-arena]');
  if (row) openMasterManage(row.dataset.masterArena);
});
$('#masterArenaList').addEventListener('keydown', (event) => {
  if (event.target.closest('[data-master-toggle-arena]')) return;
  const row = event.target.closest('[data-master-arena]');
  if (row && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    openMasterManage(row.dataset.masterArena);
  }
});

$('#closeArenaStatus').onclick = () => $('#arenaStatusDialog').close();
$('#cancelArenaStatus').onclick = () => $('#arenaStatusDialog').close();
$('#arenaStatusDialog').addEventListener('click', (event) => {
  if (event.target === $('#arenaStatusDialog')) $('#arenaStatusDialog').close();
});
$('#arenaStatusForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!isPlatformAdmin || !masterStatusArenaId) return;

  const item = masterArenas.find((candidate) => candidate.arena_id === masterStatusArenaId);
  if (!item) return;

  const targetActive = !item.active;
  const preset = $('#arenaStatusReason').value;
  const details = $('#arenaStatusDetails').value.trim();
  const errorElement = $('#arenaStatusError');
  const submitButton = $('#arenaStatusSubmit');
  let reason = null;

  if (!targetActive) {
    if (preset === 'Outro' && details.length < 3) {
      errorElement.textContent = 'Descreva o motivo da suspensão.';
      return;
    }
    reason = preset === 'Outro' ? details : (details ? preset + ' — ' + details : preset);
  }

  errorElement.textContent = '';
  submitButton.disabled = true;
  try {
    const { error } = await supabase.rpc('master_set_arena_active', {
      p_arena_id: item.arena_id,
      p_active: targetActive,
      p_reason: reason
    });
    if (error) throw error;

    if (!targetActive && arena?.id === item.arena_id) {
      activeArenaSlug = '';
      unavailableArenaStatus = 'suspended';
      ++arenaChangeVersion;
      clearArenaIdentity();
      bookings = [];
      scheduleBlocks = [];
    }

    $('#arenaStatusDialog').close();
    masterStatusArenaId = '';
    await loadMasterDashboard();
    renderMasterPanel();
    await loadArenaCatalog();
    toast(targetActive ? item.name + ' reativada com sucesso.' : item.name + ' suspensa com sucesso.');
  } catch (error) {
    console.error(error);
    errorElement.textContent = error.message || 'Não foi possível alterar o acesso da arena.';
  } finally {
    submitButton.disabled = false;
  }
});
$('#closeMasterManage').onclick = () => $('#masterManageDialog').close();
$('#masterManageDialog').addEventListener('close', () => { masterDetail = null; masterCourtEditId = null; });
$('#masterManageDialog').addEventListener('click', (event) => {
  if (event.target === $('#masterManageDialog')) $('#masterManageDialog').close();
});
document.querySelectorAll('[data-master-tab]').forEach((button) => button.addEventListener('click', () => {
  masterTab = button.dataset.masterTab;
  masterCourtEditId = null;
  renderMasterManage();
}));

$('#masterManageContent').addEventListener('click', async (event) => {
  if (event.target.closest('[data-master-copy]')) {
    try { await navigator.clipboard.writeText(masterLink(masterDetail.arena.slug)); toast('Link da arena copiado.'); }
    catch { toast('Não foi possível copiar o link.'); }
  }
  if (event.target.closest('[data-master-new-court]')) {
    masterCourtEditId = 'new'; renderMasterManage();
  }
  const edit = event.target.closest('[data-master-edit-court]');
  if (edit) { masterCourtEditId = edit.dataset.masterEditCourt; renderMasterManage(); }
  if (event.target.closest('[data-master-cancel-court]')) { masterCourtEditId = null; renderMasterManage(); }
  const remove = event.target.closest('[data-master-remove-admin]');
  if (remove && masterDetail) {
    const target = masterDetail.admins.find((admin) => admin.user_id === remove.dataset.masterRemoveAdmin);
    if (!target || !window.confirm(`Remover o acesso de ${target.email} à ${masterDetail.arena.name}?`)) return;
    remove.disabled = true;
    try {
      const { error } = await supabase.rpc('master_remove_admin', {
        p_arena_id: masterDetail.arena.id, p_user_id: target.user_id
      });
      if (error) throw error;
      await refreshMasterDetail();
      toast('Acesso administrativo removido.');
    } catch (error) { console.error(error); toast(error.message || 'Não foi possível remover o acesso.'); }
    finally { remove.disabled = false; }
  }
});

$('#masterManageContent').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!masterDetail) return;
  const form = event.target;
  const arenaId = masterDetail.arena.id;
  if (form.id === 'masterArenaForm') {
    const values = new FormData(form);
    const listed = form.elements.public_listed.checked;
    if (masterDetail.arena.public_listed && !listed &&
        !window.confirm('Ocultar esta arena do catálogo público? O link direto continuará funcionando.')) return;
    runMasterMutation(form, async () => {
      const { error } = await supabase.rpc('master_update_arena', { p_arena_id: arenaId, p_data: {
        name: String(values.get('name')).trim(), city: String(values.get('city')).trim(),
        address: String(values.get('address')).trim(), whatsapp: String(values.get('whatsapp')).replace(/\D/g, ''),
        public_listed: listed
      } });
      if (error) throw error;
      toast('Dados da arena salvos.');
    });
  } else if (form.id === 'masterCourtForm') {
    const current = masterDetail.courts.find((court) => court.id === masterCourtEditId);
    const values = new FormData(form);
    const active = current ? form.elements.active.checked : true;
    if (current?.active && !active && !window.confirm(`Desativar ${current.name}? Reservas futuras impedem essa alteração.`)) return;
    runMasterMutation(form, async () => {
      const { error } = await supabase.rpc('master_save_court', { p_arena_id: arenaId,
        p_court_id: current?.id || null, p_data: {
          name: String(values.get('name')).trim(), sport: String(values.get('sport')).trim(),
          hourly_price: Number(values.get('hourly_price')), opening_hour: Number(values.get('opening_hour')),
          closing_hour: Number(values.get('closing_hour')), active
        }
      });
      if (error) throw error;
      masterCourtEditId = null;
      toast('Quadra salva.');
    });
  } else if (form.id === 'masterInviteForm') {
    const email = String(new FormData(form).get('email')).trim().toLowerCase();
    runMasterMutation(form, async () => {
      const { data, error } = await supabase.functions.invoke('manage-arena-admin', { body: { arenaId, email } });
      if (error) {
        let message = error.message;
        try { message = (await error.context?.json())?.error || message; } catch {}
        throw new Error(message);
      }
      if (data?.error) throw new Error(data.error);
      toast(data?.invited ? 'Convite enviado por e-mail.' : 'Administrador vinculado à arena.');
    });
  }
});

document.querySelectorAll('[data-settings-tab]').forEach((button) => button.addEventListener('click', () => {
  settingsTab = button.dataset.settingsTab;
  settingsCourtId = null;
  renderArenaSettings();
}));

$('#arenaSettingsContent').addEventListener('input', (event) => {
  if (event.target.name === 'public_access' || event.target.name === 'public_listed') {
    updateSettingsVisibility($('#arenaSettingsForm'), true);
  }
});

$('#arenaSettingsContent').addEventListener('click', async (event) => {
  if (event.target.closest('[data-settings-reset]')) {
    renderArenaSettings();
    $('#arenaSettingsForm')?.elements.name.focus();
  }
  if (event.target.closest('[data-settings-copy]')) {
    try { await navigator.clipboard.writeText(masterLink(arena.slug)); toast('Link da agenda copiado.'); }
    catch { toast('Não foi possível copiar o link.'); }
  }
  if (event.target.closest('[data-settings-new-court]')) { settingsCourtId = 'new'; renderArenaSettings(); }
  const edit = event.target.closest('[data-settings-edit-court]');
  if (edit) { settingsCourtId = edit.dataset.settingsEditCourt; renderArenaSettings(); }
  if (event.target.closest('[data-settings-cancel-court]')) { settingsCourtId = null; renderArenaSettings(); }
  const remove = event.target.closest('[data-settings-remove-admin]');
  if (remove && arenaSettingsDetail) {
    const target = arenaSettingsDetail.admins.find((admin) => admin.user_id === remove.dataset.settingsRemoveAdmin);
    if (!target || !window.confirm(`Remover o acesso de ${target.email} à ${arena.name}? Essa pessoa deixará de administrar a arena.`)) return;
    remove.disabled = true;
    try {
      const { error } = await supabase.rpc('master_remove_admin', { p_arena_id: arena.id, p_user_id: target.user_id });
      if (error) throw error;
      await loadArenaSettings();
      toast('Acesso administrativo removido.');
    } catch (error) { console.error(error); toast(error.message || 'Não foi possível remover o acesso.'); }
    finally { remove.disabled = false; }
  }
});

$('#arenaSettingsContent').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!isAdmin || !arena || !arenaSettingsDetail || view !== 'settings') return;
  const form = event.target;
  const arenaId = arena.id;
  if (form.id === 'arenaSettingsForm') {
    const values = new FormData(form);
    const publicAccess = form.elements.public_access.checked;
    const publicListed = form.elements.public_listed.checked;
    if (arenaSettingsDetail.arena.public_access && !publicAccess &&
      !window.confirm('Deixar a agenda privada? Jogadores não poderão abrir horários ou fazer novas reservas, mesmo com o link. As reservas existentes serão mantidas.')) return;
    runSettingsMutation(form, async () => {
      const { error } = await supabase.rpc('master_update_arena', { p_arena_id: arenaId, p_data: {
        name: String(values.get('name')).trim(), city: String(values.get('city')).trim(),
        address: String(values.get('address')).trim(), whatsapp: String(values.get('whatsapp')).replace(/\D/g, ''),
        public_access: publicAccess, public_listed: publicListed
      } });
      if (error) throw error;
      await refreshCurrentAdminArena();
    }, 'Configurações da arena salvas.');
  } else if (form.id === 'arenaSettingsCourtForm') {
    const current = arenaSettingsDetail.courts.find((court) => court.id === settingsCourtId);
    const values = new FormData(form);
    const active = current ? form.elements.active.checked : true;
    if (current?.active && !active && !window.confirm(`Desativar ${current.name}? A quadra sairá da agenda, desde que não tenha reservas futuras.`)) return;
    runSettingsMutation(form, async () => {
      const { error } = await supabase.rpc('master_save_court', { p_arena_id: arenaId,
        p_court_id: current?.id || null, p_data: {
          name: String(values.get('name')).trim(), sport: String(values.get('sport')).trim(),
          hourly_price: Number(values.get('hourly_price')), opening_hour: Number(values.get('opening_hour')),
          closing_hour: Number(values.get('closing_hour')), active
        }
      });
      if (error) throw error;
      settingsCourtId = null;
      await refreshCurrentAdminArena();
    }, 'Quadra salva com sucesso.');
  } else if (form.id === 'arenaSettingsInviteForm') {
    const values = new FormData(form);
    const name = String(values.get('name') || '').trim().replace(/\s+/g, ' ');
    const phone = String(values.get('phone') || '').trim();
    const email = String(values.get('email') || '').trim().toLowerCase();
    runSettingsMutation(form, async () => {
      const { data, error } = await supabase.functions.invoke('manage-arena-admin', { body: { arenaId, name, phone, email } });
      if (error) {
        let message = error.message;
        try { message = (await error.context?.json())?.error || message; } catch {}
        throw new Error(message);
      }
      if (data?.error) throw new Error(data.error);
      form.dataset.invited = data?.invited ? 'true' : 'false';
    }, 'Administrador adicionado. Convites para novos usuários são enviados por e-mail.');
  }
});

$('#announcementsPanel').addEventListener('click', async (event) => {
  const filterButton = event.target.closest('[data-announcement-filter]');
  if (filterButton) {
    announcementFilter = filterButton.dataset.announcementFilter;
    renderAnnouncementsPanel();
    return;
  }

  if (event.target.closest('[data-announcement-new]')) {
    openAnnouncementDialog();
    return;
  }

  const editButton = event.target.closest('[data-announcement-edit]');
  if (editButton) {
    openAnnouncementDialog(editButton.dataset.announcementEdit);
    return;
  }

  const toggleButton = event.target.closest('[data-announcement-toggle]');
  if (toggleButton) {
    const item = arenaAnnouncements.find((candidate) => candidate.id === toggleButton.dataset.announcementToggle);
    if (!item || !arena) return;
    toggleButton.disabled = true;
    try {
      const targetActive = !item.active;
      if (targetActive && item.isFeatured) await deactivateOtherFeaturedAnnouncements(item.id);
      const { error } = await supabase
        .from('arena_announcements')
        .update({ active: targetActive })
        .eq('id', item.id)
        .eq('arena_id', arena.id);
      if (error) throw error;
      await loadAnnouncementsData();
      renderAnnouncementsPanel();
      toast(targetActive ? 'Novidade publicada para o público.' : 'Novidade desativada.');
    } catch (error) {
      console.error(error);
      toast(error.message || 'Não foi possível alterar a publicação.');
    } finally {
      toggleButton.disabled = false;
    }
    return;
  }

  const deleteButton = event.target.closest('[data-announcement-delete]');
  if (deleteButton) {
    const item = arenaAnnouncements.find((candidate) => candidate.id === deleteButton.dataset.announcementDelete);
    if (!item || !arena) return;
    if (!window.confirm(`Excluir “${item.title}”? Essa novidade deixará de existir e não poderá ser recuperada.`)) return;
    deleteButton.disabled = true;
    try {
      if (item.imagePath) {
        const { error: imageError } = await supabase.storage.from('announcement-images').remove([item.imagePath]);
        if (imageError) console.warn('Não foi possível remover a imagem da novidade.', imageError);
      }
      const { error } = await supabase
        .from('arena_announcements')
        .delete()
        .eq('id', item.id)
        .eq('arena_id', arena.id);
      if (error) throw error;
      await loadAnnouncementsData();
      renderAnnouncementsPanel();
      toast('Novidade excluída.');
    } catch (error) {
      console.error(error);
      toast(error.message || 'Não foi possível excluir a novidade.');
    } finally {
      deleteButton.disabled = false;
    }
  }
});

$('#closeAnnouncementDialog').onclick = () => $('#announcementDialog').close();
$('#cancelAnnouncementDialog').onclick = () => $('#announcementDialog').close();
$('#announcementDialog').addEventListener('close', () => {
  announcementEditingId = null;
  clearAnnouncementImagePreviewObjectUrl();
});
$('#announcementDialog').addEventListener('click', (event) => {
  if (event.target === $('#announcementDialog')) $('#announcementDialog').close();
});

['announcementTitle', 'announcementDescription', 'announcementType', 'announcementCtaLabel'].forEach((id) => {
  $('#'+id).addEventListener('input', renderAnnouncementFormPreview);
  $('#'+id).addEventListener('change', renderAnnouncementFormPreview);
});
$('#announcementImage').addEventListener('change', renderAnnouncementFormPreview);

$('#announcementForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!isAdmin || !arena) return;

  const existing = arenaAnnouncements.find((candidate) => candidate.id === announcementEditingId) || null;
  const title = $('#announcementTitle').value.trim();
  const description = $('#announcementDescription').value.trim();
  const type = $('#announcementType').value;
  const ctaLabel = $('#announcementCtaLabel').value.trim() || 'Ver detalhes';
  const startsOn = $('#announcementStartsOn').value;
  const endsOn = $('#announcementEndsOn').value;
  const linkUrl = $('#announcementLinkUrl').value.trim();
  const isFeatured = $('#announcementFeatured').checked;
  const file = $('#announcementImage').files?.[0] || null;
  const errorElement = $('#announcementError');
  const submitButton = $('#submitAnnouncement');

  if (endsOn < startsOn) {
    errorElement.textContent = 'A data de fim não pode ser anterior à data de início.';
    return;
  }
  if (linkUrl && !/^https:\/\//i.test(linkUrl)) {
    errorElement.textContent = 'O link deve começar com https://.';
    return;
  }

  errorElement.textContent = '';
  submitButton.disabled = true;
  submitButton.textContent = existing ? 'Salvando...' : 'Publicando...';

  try {
    const active = existing ? existing.active : true;
    if (active && isFeatured) await deactivateOtherFeaturedAnnouncements(existing?.id || '');

    const payload = {
      arena_id: arena.id,
      announcement_type: type,
      title,
      description,
      link_url: linkUrl || null,
      cta_label: ctaLabel,
      starts_on: startsOn,
      ends_on: endsOn,
      is_featured: isFeatured,
      active
    };

    let saved;
    if (existing) {
      const { data, error } = await supabase
        .from('arena_announcements')
        .update(payload)
        .eq('id', existing.id)
        .eq('arena_id', arena.id)
        .select('id, arena_id, template_key, announcement_type, title, description, image_path, link_url, cta_label, starts_on, ends_on, is_featured, active, sort_order, created_at, updated_at')
        .single();
      if (error) throw error;
      saved = mapArenaAnnouncement(data);
    } else {
      const { data, error } = await supabase
        .from('arena_announcements')
        .insert(payload)
        .select('id, arena_id, template_key, announcement_type, title, description, image_path, link_url, cta_label, starts_on, ends_on, is_featured, active, sort_order, created_at, updated_at')
        .single();
      if (error) throw error;
      saved = mapArenaAnnouncement(data);
    }

    if (file) await uploadAnnouncementImage(saved, file);

    $('#announcementDialog').close();
    await loadAnnouncementsData();
    renderAnnouncementsPanel();
    toast(existing ? 'Novidade atualizada.' : 'Novidade publicada para o público.');
  } catch (error) {
    console.error(error);
    errorElement.textContent = error.message || 'Não foi possível salvar a novidade.';
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = existing ? 'Salvar alterações' : 'Publicar novidade';
  }
});

$('#arenaAnnouncementsPublic').addEventListener('click', (event) => {
  if (event.target.closest('[data-announcement-prev]')) {
    announcementPublicIndex -= 1;
    renderPublicAnnouncements();
    return;
  }
  if (event.target.closest('[data-announcement-next]')) {
    announcementPublicIndex += 1;
    renderPublicAnnouncements();
    return;
  }
  const detail = event.target.closest('[data-announcement-detail]');
  if (detail) {
    renderAnnouncementDetail(detail.dataset.announcementDetail);
    return;
  }
  if (event.target.closest('[data-announcement-schedule]')) {
    document.querySelector('.workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

$('#announcementDetailDialog').addEventListener('click', (event) => {
  if (event.target === $('#announcementDetailDialog') || event.target.closest('[data-announcement-detail-close]')) {
    $('#announcementDetailDialog').close();
  }
});

document.addEventListener('error', (event) => {
  const image = event.target;
  if (!image?.matches?.('img[data-announcement-image]')) return;
  const holder = image.parentElement;
  if (!holder) return;
  holder.classList.add('no-image');
  holder.innerHTML = '<span aria-hidden="true">◇</span><small>Imagem indisponível</small>';
}, true);
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
  const progress = total > 0 ? Math.max(0, Math.min(100, Math.round(received / total * 100))) : 0;

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
        ${!fullyPaid && !cancelled && reservation.status === 'confirmed' && reservation.payment_status === 'partial' && remaining > 0.001 ? `
          <div class="reservation-pay-at-venue" role="note">
            <span class="reservation-pay-at-venue-icon" aria-hidden="true">✓</span>
            <span><strong>Pague o saldo restante no local</strong><small>O valor de ${money(remaining)} deverá ser pago diretamente na arena no dia do jogo.</small></span>
          </div>
        ` : `<small>${fullyPaid ? 'Pagamento concluído.' : cancelled ? 'Consulte a arena sobre valores já pagos.' : 'Aguardando confirmação do sinal da reserva.'}</small>`}

        <div class="reservation-actions">
          ${!cancelled ? pushInvite(reservation.id, true) : ''}
          <button class="secondary" type="button" data-reservation-action="support">Falar com a arena</button>
          ${!cancelled ? '<button class="text-action reservation-cancel-link" type="button" data-reservation-action="cancel-request">Solicitar cancelamento</button>' : ''}
        </div>
      </aside>
    </div>

    <div class="reservation-note">
      <strong>Sobre cancelamentos</strong>
      <p>Nesta versão, o cancelamento é solicitado diretamente à arena pelo WhatsApp. Quando definirmos a política de prazo, poderemos automatizar essa etapa.</p>
    </div>
  `;
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
});

let initializing = false;

async function initialize() {
  if (initializing) return;
  initializing = true;
  const retryButton = $('#retryConnection');
  retryButton.disabled = true;
  retryButton.classList.add('hidden');
  try {
    // Remove a seleção salva pelas versões anteriores, sem afetar pagamentos pendentes.
    try { localStorage.removeItem('quadra-aberta:player-arena'); } catch {}

    if (reservationTokenFromUrl) {
      await openReservationPortal();
      return;
    }

    await loadArenaCatalogWithRetry();

    const restored = await restoreAdminSession();
    if (!restored) {
      const pending = readPendingPayment();
      const linkedArena = new URLSearchParams(window.location.search).get('arena');
      const preferredSlug = linkedArena || pending?.arenaSlug;
      if (preferredSlug) {
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
    toast('Falha na conexão. Tente novamente.');
    retryButton.classList.remove('hidden');
  } finally {
    initializing = false;
    retryButton.disabled = false;
  }
}

$('#retryConnection').addEventListener('click', initialize);
initialize();

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (reservationTokenFromUrl) {
    return;
  }
  if (!isAdmin && $('#bookingDialog').open && lastPlayerBooking?.paymentStatus === 'pending') {
    checkPaymentStatus(lastPlayerBooking);
  }
  if (isAdmin && arena && view !== 'master') verifyCurrentAdminArenaAccess().catch(console.error);
  else if (!isAdmin && arena) verifyCurrentPublicArena().catch(console.error);
});

setInterval(() => {
  if (document.visibilityState !== 'visible' || reservationTokenFromUrl) return;
  if (isAdmin && arena && view !== 'master') verifyCurrentAdminArenaAccess().catch(console.error);
  else if (!isAdmin && arena) verifyCurrentPublicArena().catch(console.error);
}, 30000);

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

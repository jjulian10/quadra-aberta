const $ = (selector) => document.querySelector(selector);

const courts = [
  { name: 'Quadra 01', sport: 'Vôlei', price: 100 },
  { name: 'Quadra 02', sport: 'Beach tennis', price: 120 },
  { name: 'Quadra 03', sport: 'Futsal', price: 150 }
];
const hours = Array.from({ length: 9 }, (_, index) => index + 14);
const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const today = localDate(new Date());

let day = today;
let view = 'admin';
let filter = 'all';
let selectedId = null;
let counter = 20;
let profitPeriod = 'day';

const bookings = [
  { id: 1, court: 0, hour: 14, duration: 1, name: 'Marina Costa', phone: '(69) 99999-1001', status: 'confirmed', paid: true },
  { id: 2, court: 1, hour: 15, duration: 2, name: 'Bruno Almeida', phone: '(69) 99999-1002', status: 'confirmed', paid: true },
  { id: 3, court: 2, hour: 16, duration: 1, name: 'Equipe Resenha', phone: '(69) 99999-1003', status: 'confirmed', paid: false },
  { id: 4, court: 0, hour: 17, duration: 1, name: 'Turma do vôlei', phone: '(69) 99999-1004', status: 'confirmed', paid: true },
  { id: 5, court: 1, hour: 18, duration: 1, name: 'Camila Santos', phone: '(69) 99999-1005', status: 'pending', paid: false },
  { id: 6, court: 0, hour: 19, duration: 1, name: 'Julian Matheus', phone: '(69) 99999-1006', status: 'pending', paid: false },
  { id: 7, court: 2, hour: 20, duration: 1, name: 'Amigos da bola', phone: '(69) 99999-1007', status: 'confirmed', paid: true }
].map((booking) => ({ ...booking, date: today }));

const money = (value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const esc = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const labelDate = (date) => new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
const getBooking = (court, hour, date = day) => bookings.find((booking) => booking.date === date && booking.court === court && hour >= booking.hour && hour < booking.hour + booking.duration);

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').style.display = 'block';
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { $('#toast').style.display = 'none'; }, 4200);
}

function ensureEnhancements() {
  const customer = $('#customer');
  if (customer && !$('#customerPhone')) {
    const phoneLabel = document.createElement('label');
    phoneLabel.innerHTML = 'Celular do responsável<input name="phone" id="customerPhone" required maxlength="20" placeholder="Ex.: (69) 99999-9999" autocomplete="tel" inputmode="tel">';
    customer.closest('label').after(phoneLabel);
  }
  if ($('#bookingHour') && !$('#bookingDuration')) {
    const durationLabel = document.createElement('label');
    durationLabel.innerHTML = 'Duração<select id="bookingDuration" name="duration"><option value="1">1 hora</option><option value="2">2 horas</option><option value="3">3 horas</option></select>';
    $('#bookingHour').closest('label').after(durationLabel);
    $('#bookingDuration').addEventListener('change', () => updateHours());
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
  if (view !== 'admin') { panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  const paid = list.filter((booking) => booking.paid);
  const pending = list.filter((booking) => !booking.paid);
  const total = paid.reduce((sum, booking) => sum + courts[booking.court].price * booking.duration, 0);
  const expected = list.reduce((sum, booking) => sum + courts[booking.court].price * booking.duration, 0);
  const periodLabel = { day: 'Hoje', week: 'Esta semana', month: 'Este mês' }[profitPeriod];
  const byCourt = courts.map((court, index) => ({
    name: court.name,
    value: paid.filter((booking) => booking.court === index).reduce((sum, booking) => sum + court.price * booking.duration, 0)
  }));
  const maxCourt = Math.max(...byCourt.map((item) => item.value), 1);
  const paidPercent = expected ? Math.round(total / expected * 100) : 0;
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:15px;flex-wrap:wrap">
      <div><p class="eyebrow" style="margin-bottom:7px">DESEMPENHO FINANCEIRO</p><h2 style="margin:0">Dashboard de lucros</h2><p style="font-size:13px;margin:5px 0 0">Indicadores atualizados conforme as reservas e pagamentos.</p></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">${['day','week','month'].map((period) => `<button type="button" data-profit-period="${period}" style="border:1px solid #dfe7df;border-radius:7px;background:${period === profitPeriod ? '#194d3e' : '#fff'};color:${period === profitPeriod ? '#fff' : '#17362f'};padding:8px 12px;font-size:12px">${{ day: 'Dia', week: 'Semana', month: 'Mês' }[period]}</button>`).join('')}</div>
    </div>
    <div style="display:grid;grid-template-columns:minmax(210px,1.1fr) minmax(240px,1.4fr);gap:22px;margin-top:20px;align-items:center">
      <div style="display:flex;align-items:center;gap:18px">
        <div style="width:132px;height:132px;border-radius:50%;background:conic-gradient(#194d3e ${paidPercent}%,#e8eee8 0);display:grid;place-items:center;flex-shrink:0">
          <div style="width:92px;height:92px;border-radius:50%;background:#fff;display:grid;place-items:center;text-align:center"><strong style="font-size:22px">${paidPercent}%</strong><small style="font-size:10px;color:#6d7c77">recebido</small></div>
        </div>
        <div><small>Receita · ${periodLabel}</small><strong style="display:block;font-size:26px;margin:6px 0">${money(total)}</strong><span style="font-size:12px;color:#6d7c77">${pending.length} pagamento${pending.length === 1 ? '' : 's'} pendente${pending.length === 1 ? '' : 's'}</span></div>
      </div>
      <div><strong style="font-size:13px">Receita por quadra</strong><div style="display:grid;gap:11px;margin-top:13px">${byCourt.map((item) => `<div><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px"><span>${item.name}</span><strong>${money(item.value)}</strong></div><div style="height:8px;background:#edf2ed;border-radius:10px;overflow:hidden"><div style="height:100%;width:${Math.round(item.value / maxCourt * 100)}%;background:#6a987b;border-radius:10px"></div></div></div>`).join('')}</div></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-top:20px">
      <div style="background:#f5f7f5;border-radius:9px;padding:14px"><small>Previsto total</small><strong style="display:block;font-size:22px;margin-top:7px">${money(expected)}</strong></div>
      <div style="background:#f5f7f5;border-radius:9px;padding:14px"><small>Reservas pagas</small><strong style="display:block;font-size:22px;margin-top:7px">${paid.length}</strong></div>
      <div style="background:#fcf2de;border-radius:9px;padding:14px"><small>Aguardando pagamento</small><strong style="display:block;font-size:22px;margin-top:7px">${pending.length}</strong></div>
    </div>`;
  panel.querySelectorAll('[data-profit-period]').forEach((button) => {
    button.onclick = () => { profitPeriod = button.dataset.profitPeriod; render(); };
  });
}

function setView(nextView) { view = nextView; render(); }

function render() {
  ensureEnhancements();
  $('#date').value = day;
  document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  const admin = view === 'admin';
  $('#crumb').textContent = admin ? 'Agenda e reservas' : 'Visão do jogador';
  $('#eyebrow').textContent = admin ? 'CONTROLE DA ARENA' : 'ARENA VILA · PORTO VELHO';
  $('#title').textContent = admin ? 'Bom jogo começa com uma boa agenda.' : 'Seu próximo jogo começa aqui.';
  $('#subtitle').textContent = admin ? 'Todos os horários. Cada reserva. Tudo no seu lugar.' : 'Escolha a quadra, encontre seu horário e solicite uma reserva.';
  $('#newBooking').textContent = admin ? '＋ Nova reserva' : '＋ Solicitar reserva';
  $('#workspaceTitle').textContent = admin ? 'Agenda de quadras' : 'Encontre seu horário';
  $('#workspaceSubtitle').textContent = admin ? 'Selecione um horário para reservar ou ver os detalhes.' : 'Escolha a duração e informe seus dados para reservar.';
  const list = bookings.filter((booking) => booking.date === day);
  const confirmed = list.filter((booking) => booking.status === 'confirmed');
  const pending = list.filter((booking) => booking.status === 'pending');
  const occupiedHours = list.reduce((sum, booking) => sum + booking.duration, 0);
  $('#stats').innerHTML = (admin
    ? [['Reservas do dia', list.length, 'Confirmadas e aguardando', '▦'], ['Ocupação', Math.round(occupiedHours / 27 * 100) + '%', 'Dos 27 horários disponíveis', '◷'], ['Recebido', money(list.filter((booking) => booking.paid).reduce((sum, booking) => sum + courts[booking.court].price * booking.duration, 0)), 'Pagamentos registrados', '↗'], ['A confirmar', pending.length, 'Solicitações aguardando você', '◌']]
    : [['Quadras', 3, 'Três espaços para jogar', '▦'], ['Duração', '1 a 3 horas', 'Você escolhe no pedido', '◷'], ['A partir de', money(100), 'Por quadra / hora', '↗'], ['Horários livres', 27 - occupiedHours, 'Na data selecionada', '◌']])
    .map((stat, index) => `<div class="stat ${index === 2 ? 'featured' : ''}"><div class="stat-label">${stat[0]}<span class="stat-symbol" aria-hidden="true">${stat[3]}</span></div><strong>${stat[1]}</strong><small>${stat[2]}</small></div>`).join('');
  renderProfitPanel(periodBookings(profitPeriod));

  const columns = courts.map((court, index) => ({ ...court, index })).filter((court) => filter === 'all' || String(court.index) === filter);
  $('#schedule').style.setProperty('--cols', columns.length);
  $('#schedule').innerHTML = `<div class="grid-head"><span></span>${columns.map((court) => `<div class="court-head"><strong>${court.name}</strong><small>${court.sport} · ${money(court.price)}/h</small></div>`).join('')}</div>` +
    hours.map((hour) => `<div class="time-row"><div class="hour">${hour}:00</div>${columns.map((court) => {
      const booking = getBooking(court.index, hour);
      const label = booking ? (admin ? esc(booking.name) : 'Indisponível') : '+ Reservar';
      const detail = booking ? (admin ? (booking.status === 'pending' ? 'A confirmar' : booking.paid ? 'Confirmada · Pago' : 'Confirmada · A pagar') : 'Horário ocupado') : 'Disponível';
      return `<button class="slot ${booking ? (booking.status === 'pending' ? 'waiting' : 'booked') : ''} ${booking && !admin ? 'blocked' : ''}" data-court="${court.index}" data-hour="${hour}" ${booking && !admin ? 'disabled' : ''}><strong>${label}</strong><small>${detail}</small></button>`;
    }).join('')}</div>`).join('');
  $('#dateCaption').textContent = labelDate(day);
  $('#bottom').hidden = !admin;
  $('#bottom').style.display = admin ? 'grid' : 'none';
  $('#pendingCount').textContent = pending.length;
  $('#requests').innerHTML = pending.length
    ? pending.map((booking) => `<div class="request-row"><span class="avatar">${esc(booking.name.split(' ').map((part) => part[0]).slice(0, 2).join(''))}</span><div><strong>${esc(booking.name)}</strong><small>${courts[booking.court].name} · ${booking.hour}:00–${booking.hour + booking.duration}:00 · ${money(courts[booking.court].price * booking.duration)}</small></div><button data-detail="${booking.id}">Ver solicitação</button></div>`).join('')
    : '<div class="empty">Tudo em dia. Nenhuma solicitação pendente nesta data.</div>';
}

function updateHours(preferred) {
  const court = Number($('#bookingCourt').value);
  const duration = Number($('#bookingDuration')?.value || 1);
  const free = hours.filter((hour) => Array.from({ length: duration }, (_, offset) => getBooking(court, hour + offset)).every((booking) => !booking) && hour + duration <= 23);
  $('#bookingHour').innerHTML = free.length ? free.map((hour) => `<option value="${hour}">${hour}:00 – ${hour + duration}:00</option>`).join('') : '<option value="">Sem horários livres</option>';
  if (free.includes(preferred)) $('#bookingHour').value = String(preferred);
  $('#price').textContent = money(courts[court].price * duration);
  const label = document.querySelector('.price-line span');
  if (label) label.textContent = `Total · ${duration} hora${duration > 1 ? 's' : ''}`;
  $('#submitBooking').disabled = !free.length;
}

function openBooking(court = 0, hour, duration = 1) {
  selectedId = null;
  $('#bookingForm').reset();
  $('#formError').textContent = '';
  $('#formFields').hidden = false;
  $('#detailContent').innerHTML = '';
  $('#dialogTitle').textContent = view === 'admin' ? 'Nova reserva' : 'Reservar horário';
  $('#dialogInfo').textContent = labelDate(day) + ' · Arena Vila';
  $('#bookingCourt').value = String(court);
  $('#bookingDuration').value = String(duration);
  $('#dialogActions').innerHTML = `<button class="primary" type="submit" id="submitBooking">${view === 'admin' ? 'Confirmar reserva' : 'Confirmar horário'}</button>`;
  updateHours(hour);
  $('#bookingDialog').showModal();
}

function openDetail(id) {
  const booking = bookings.find((item) => item.id === id);
  if (!booking || view !== 'admin') return;
  selectedId = id;
  $('#formError').textContent = '';
  $('#formFields').hidden = true;
  $('#dialogTitle').textContent = booking.status === 'pending' ? 'Solicitação de reserva' : 'Detalhes da reserva';
  $('#dialogInfo').textContent = `${labelDate(booking.date)} · ${booking.hour}:00–${booking.hour + booking.duration}:00`;
  $('#detailContent').innerHTML = `<p><strong>${esc(booking.name)}</strong></p><p>Celular: ${esc(booking.phone || 'Não informado')}</p><p>${courts[booking.court].name} · ${courts[booking.court].sport} · ${booking.duration} hora${booking.duration > 1 ? 's' : ''}</p><p>Status: ${booking.status === 'pending' ? 'Aguardando confirmação' : 'Confirmada'}<br>Pagamento: ${booking.paid ? 'Recebido' : 'Pendente'}</p>`;
  $('#price').textContent = money(courts[booking.court].price * booking.duration);
  $('#dialogActions').innerHTML = (booking.status === 'pending' ? '<button type="button" class="primary" data-action="confirm">Confirmar reserva</button>' : !booking.paid ? '<button type="button" class="primary" data-action="pay">Registrar pagamento</button>' : '') + '<button type="button" class="secondary danger" data-action="cancel">Cancelar reserva</button>';
  if (!$('#bookingDialog').open) $('#bookingDialog').showModal();
}

function dispararMensagem(booking) {
  const digits = (booking.phone || '').replace(/\D/g, '');
  if (digits.length < 10) return;
  const text = `Olá, ${booking.name}! Sua reserva foi confirmada na Arena Vila.\n\nQuadra: ${courts[booking.court].name} - ${courts[booking.court].sport}\nData: ${labelDate(booking.date)}\nHorário: ${booking.hour}:00 às ${booking.hour + booking.duration}:00\nDuração: ${booking.duration} hora${booking.duration > 1 ? 's' : ''}\n\nAguardamos você. Em caso de alteração, entre em contato com a arena.`;
  const whatsappUrl = 'https://wa.me/55' + digits + '?text=' + encodeURIComponent(text);
  window.open(whatsappUrl, '_blank', 'noopener');
}

function showConfirmation(booking) {
  $('#formFields').hidden = true;
  $('#dialogTitle').textContent = 'Horário reservado!';
  $('#dialogInfo').textContent = `${labelDate(booking.date)} · ${booking.hour}:00–${booking.hour + booking.duration}:00`;
  $('#detailContent').innerHTML = `<div style="background:#eaf3df;border-radius:10px;padding:16px;margin:12px 0 18px"><strong>Reserva confirmada para ${esc(booking.name)}.</strong><p style="margin:8px 0 0;font-size:13px;color:#537047">Guarde estas informações e chegue com alguns minutos de antecedência.</p></div><p><strong>Observações</strong></p><p>• A reserva dura ${booking.duration} hora${booking.duration > 1 ? 's' : ''}.<br>• Em uma versão real, o pagamento PIX será validado automaticamente.<br>• Para cancelar ou alterar, entre em contato com a arena pelo celular informado.</p>`;
  $('#price').textContent = money(courts[booking.court].price * booking.duration);
  $('#dialogActions').innerHTML = '<button type="button" class="primary" data-action="close-confirmation">Concluir</button>';
  if (!$('#bookingDialog').open) $('#bookingDialog').showModal();
}

$('#bookingForm').addEventListener('submit', (event) => {
  event.preventDefault();
  if (selectedId !== null) return;
  const court = Number($('#bookingCourt').value);
  const rawHour = $('#bookingHour').value;
  const hour = Number(rawHour);
  const duration = Number($('#bookingDuration').value);
  const name = $('#customer').value.trim();
  const phone = $('#customerPhone').value.trim();
  const occupied = Array.from({ length: duration }, (_, offset) => getBooking(court, hour + offset)).some(Boolean);
  if (!name) { $('#formError').textContent = 'Informe o nome do responsável.'; return; }
  if (!phone || phone.replace(/\D/g, '').length < 10) { $('#formError').textContent = 'Informe um celular válido com DDD.'; return; }
  if (rawHour === '' || !hours.includes(hour) || hour + duration > 23 || !courts[court] || occupied) { $('#formError').textContent = 'A duração escolhida não cabe neste horário ou está ocupada.'; return; }
  const booking = { id: ++counter, date: day, court, hour, duration, name, phone, status: 'confirmed', paid: false };
  bookings.push(booking);
  render();
  if (view === 'player') { showConfirmation(booking); dispararMensagem(booking); }
  else { $('#bookingDialog').close(); toast('Reserva confirmada na demonstração.'); }
});

$('#dialogActions').addEventListener('click', (event) => {
  const action = event.target.dataset.action;
  const booking = bookings.find((item) => item.id === selectedId);
  if (action === 'close-confirmation') { $('#bookingDialog').close(); return; }
  if (!action || !booking) return;
  if (action === 'confirm') { booking.status = 'confirmed'; toast('Reserva confirmada.'); }
  if (action === 'pay') { booking.paid = true; toast('Pagamento registrado na demonstração.'); }
  if (action === 'cancel') {
    if (!confirm('Cancelar esta reserva de demonstração e liberar o horário?')) return;
    bookings.splice(bookings.indexOf(booking), 1);
    toast('Reserva cancelada. Horário disponível novamente.');
  }
  $('#bookingDialog').close();
  render();
});

$('#bookingCourt').addEventListener('change', () => updateHours());
$('#bookingDuration')?.addEventListener('change', () => updateHours());
$('#closeDialog').onclick = () => $('#bookingDialog').close();
$('#newBooking').onclick = () => openBooking(filter === 'all' ? 0 : Number(filter));
$('#seePlayer').onclick = () => { setView('player'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
document.querySelectorAll('[data-view]').forEach((button) => { button.onclick = () => setView(button.dataset.view); });
$('#schedule').addEventListener('click', (event) => {
  const button = event.target.closest('[data-court]');
  if (!button) return;
  const court = Number(button.dataset.court);
  const hour = Number(button.dataset.hour);
  const booking = getBooking(court, hour);
  booking ? openDetail(booking.id) : openBooking(court, hour);
});
$('#requests').addEventListener('click', (event) => {
  const button = event.target.closest('[data-detail]');
  if (button) openDetail(Number(button.dataset.detail));
});
$('#courtFilter').onchange = (event) => { filter = event.target.value; render(); };
$('#date').onchange = (event) => { if (event.target.value) { day = event.target.value; render(); } };
function moveDay(amount) {
  const date = new Date(day + 'T12:00:00');
  date.setDate(date.getDate() + amount);
  day = localDate(date);
  render();
}
$('#prevDay').onclick = () => moveDay(-1);
$('#nextDay').onclick = () => moveDay(1);
$('#today').onclick = () => { day = today; render(); };
render();

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

// Visual helpers scoped to the arena's settings. Values always come from the current arena.
const icons = {
  arena: '<path d="m3 10 9-7 9 7v11H3Z"/><path d="M9 21v-7h6v7M7 10h.01M17 10h.01"/>',
  pin: '<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  phone: '<path d="M8 3H5a2 2 0 0 0-2 2c0 9 7 16 16 16a2 2 0 0 0 2-2v-3l-5-2-2 2a13 13 0 0 1-6-6l2-2Z"/>',
  court: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16M3 12h18M7 4v16M17 4v16"/>',
  people: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3ZM17 4a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-4-5"/>',
  history: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  catalog: '<path d="M13 3h8v8M21 3l-9 9M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/>',
  link: '<path d="m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M16 8l1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" transform="translate(0 1) scale(.95)"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  money: '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
  send: '<path d="m22 2-7 20-4-9-9-4ZM22 2 11 13"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="m16 3 5 5-12 12-6 1 1-6ZM14 5l5 5"/>',
};

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export function settingsIcon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${icons[name] || icons.arena}</svg>`;
}

export function settingsField(label, name, value, icon, attributes = '') {
  return `<label class="arena-settings-field"><span class="arena-settings-field-label">${escapeHtml(label)}</span><input name="${escapeHtml(name)}" value="${escapeHtml(value)}" ${attributes}><span class="arena-settings-field-icon" aria-hidden="true">${settingsIcon(icon)}</span></label>`;
}

export function settingsHeading(title, description, icon, eyebrow = '') {
  return `<div class="arena-settings-card-head"><span class="arena-settings-head-icon">${settingsIcon(icon)}</span><div>${eyebrow ? `<span class="arena-settings-eyebrow">${escapeHtml(eyebrow)}</span>` : ''}<h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p></div></div>`;
}

export function settingsFooter(note, actions) {
  return `<div class="arena-settings-form-footer"><p class="arena-settings-error" role="alert"></p><div class="arena-settings-footer-row"><p class="arena-settings-footnote">${settingsIcon('info')}<span>${escapeHtml(note)}</span></p><div class="arena-settings-actions">${actions}</div></div></div>`;
}

export function updateSettingsVisibility(form, pending = false) {
  if (!form) return;
  const access = form.elements.public_access.checked;
  const catalog = form.elements.public_listed;
  catalog.disabled = !access;
  const listed = access && catalog.checked;
  form.querySelector('[data-settings-access-copy]').textContent = access
    ? 'Jogadores podem acessar a agenda e reservar.'
    : 'Jogadores não podem acessar a agenda, mesmo pelo link.';
  form.querySelector('[data-settings-catalog-copy]').textContent = !access
    ? 'Disponível quando a agenda estiver pública.'
    : listed ? 'Sua arena aparece na lista pública.' : 'Sua arena fica disponível apenas pelo link direto.';
  const help = form.querySelector('[data-settings-visibility-help]');
  help.classList.toggle('private', !access);
  help.querySelector('span').textContent = (pending ? 'Ao salvar: ' : '') + (access
    ? listed ? 'Sua arena aparece na lista pública e também pode ser aberta pelo link.' : 'Sua arena está fora da lista, mas o link direto continua funcionando.'
    : 'Agenda privada: apenas administradores podem acessá-la. As reservas existentes permanecem registradas.');
}

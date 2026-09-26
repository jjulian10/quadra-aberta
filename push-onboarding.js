import { canPromptInstall, isInstalled, isIos, pushEnabled, pushSupported } from './push.js';

const bell = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/><path d="M10 21h4"/></svg>';

export function pushInvite(id, portal = false) {
  const action = portal ? 'data-reservation-action' : 'data-action';
  const installed = isInstalled();
  const ios = isIos();
  const supported = pushSupported();
  const enabled = pushEnabled('player', id);
  const denied = supported && Notification.permission === 'denied';
  let body;

  if (enabled) {
    body = `<div class="push-invite-ok"><span class="push-invite-check" aria-hidden="true">✓</span><span>Avisos ativados para esta reserva neste aparelho.</span></div>
      <button type="button" class="push-invite-link" ${action}="player-push">Desativar avisos</button>`;
  } else if (denied) {
    body = '<p class="push-invite-hint">As notificações estão bloqueadas neste aparelho. Autorize o Quadra Aberta nas configurações do navegador ou do celular.</p>';
  } else if (ios && !installed) {
    body = `<ol class="push-invite-steps">
      <li>Abra esta página no Safari e toque em <strong>Compartilhar</strong>.</li>
      <li>Escolha <strong>Adicionar à Tela de Início</strong>.</li>
      <li>Abra o ícone do Quadra Aberta para ativar os lembretes.</li>
    </ol><p class="push-invite-hint">Guarde também o link “Minha reserva” para voltar a este agendamento.</p>`;
  } else if (supported) {
    const install = !installed && canPromptInstall()
      ? `<button type="button" class="push-invite-install" ${action}="install-app"><span class="push-invite-step">1</span> Adicionar à tela inicial</button>`
      : !installed
        ? '<p class="push-invite-hint">Para instalar, abra o menu do navegador e escolha “Adicionar à tela inicial”.</p>'
        : '';
    body = `${install}<button type="button" class="push-invite-enable" ${action}="player-push">${installed ? '' : '<span class="push-invite-step">2</span> '}Ativar notificações</button>`;
  } else {
    body = '<p class="push-invite-hint">Este navegador não oferece notificações para o Quadra Aberta. No iPhone, abra o site pela tela inicial; no Android, tente pelo Chrome.</p>';
  }

  return `<section class="push-invite" data-push-invite="${id}" data-push-portal="${portal}" aria-label="Lembrete do jogo">
    <div class="push-invite-heading"><span class="push-invite-icon">${bell}</span><div><span class="push-invite-kicker">SEU JOGO, NO TEMPO CERTO</span><h3>Lembrete do seu jogo</h3></div></div>
    <p class="push-invite-copy">Receba a confirmação no celular ao ativar os avisos e um lembrete 2 horas antes do jogo, se houver tempo.</p>
    <div class="push-invite-body">${body}</div>
    <small class="push-invite-feedback" role="status" aria-live="polite"></small>
    ${!portal && !enabled ? `<button type="button" class="push-invite-dismiss" ${action}="dismiss-push">Agora não</button>` : ''}
  </section>`;
}

export function refreshPushInvites() {
  document.querySelectorAll('[data-push-invite]').forEach((element) => {
    element.outerHTML = pushInvite(element.dataset.pushInvite, element.dataset.pushPortal === 'true');
  });
}

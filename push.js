export const pushSupported = () =>
  window.isSecureContext && 'serviceWorker' in navigator &&
  'PushManager' in window && 'Notification' in window;

let installPrompt = null;
const installChanged = () => window.dispatchEvent(new Event('quadra:install-changed'));

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
  installChanged();
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  installChanged();
});

export const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const isInstalled = () => window.matchMedia('(display-mode: standalone)').matches ||
  navigator.standalone === true;

export const canPromptInstall = () => !!installPrompt;

export async function promptInstall() {
  if (!installPrompt) return false;
  const pending = installPrompt;
  installPrompt = null;
  // The browser requires prompt() to run directly from the player's tap.
  await pending.prompt();
  const result = await pending.userChoice;
  installChanged();
  return result?.outcome === 'accepted';
}

const resumeCookie = 'quadra_aberta_install_reservation';
export function rememberReservationForInstall(token) {
  if (!/^[0-9a-f-]{36}$/i.test(token || '')) return;
  try {
    // iOS copies cookies into a newly installed Home Screen app on recent versions.
    if (isIos()) document.cookie = `${resumeCookie}=${token}; Max-Age=86400; Path=/; SameSite=Lax; Secure`;
    localStorage.setItem(resumeCookie, token);
  } catch { /* The exclusive link in Minha reserva remains available. */ }
}

export function consumeInstalledReservation() {
  if (!isInstalled()) return null;
  const cookie = document.cookie.split('; ').find((item) => item.startsWith(`${resumeCookie}=`));
  let token = cookie?.slice(resumeCookie.length + 1);
  try { token ||= localStorage.getItem(resumeCookie); } catch {}
  if (!/^[0-9a-f-]{36}$/i.test(token || '')) return null;
  if (cookie) document.cookie = `${resumeCookie}=; Max-Age=0; Path=/; SameSite=Lax; Secure`;
  try { localStorage.removeItem(resumeCookie); } catch {}
  return token;
}

const localKey = (role, id) => `quadra-aberta:push:${role}:${id}`;

export function pushEnabled(role, id) {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  try { return localStorage.getItem(localKey(role, id)) === 'on'; } catch { return false; }
}

const remember = (role, id, enabled) => {
  try {
    if (enabled) localStorage.setItem(localKey(role, id), 'on');
    else localStorage.removeItem(localKey(role, id));
  } catch {}
};

function decodeKey(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function invoke(supabase, body) {
  const { data, error } = await supabase.functions.invoke('push-subscription', { body });
  if (error || data?.error) {
    let message = data?.error || error?.message || 'Não foi possível configurar os avisos.';
    try { message = (await error.context.json()).error || message; } catch {}
    throw new Error(message);
  }
  return data;
}

export async function togglePush(supabase, context) {
  if (!pushSupported()) throw new Error('Neste aparelho, instale o Quadra Aberta na tela inicial para receber avisos.');
  const { role, id, arenaId, reservationToken } = context;
  const wasEnabled = pushEnabled(role, id);
  // Permission must be requested directly in response to the button tap.
  if (!wasEnabled && Notification.permission === 'denied') {
    throw new Error('Ative as notificações do Quadra Aberta nas configurações do aparelho.');
  }
  const permission = !wasEnabled && Notification.permission !== 'granted'
    ? await Notification.requestPermission()
    : Notification.permission;
  if (permission !== 'granted') throw new Error('Permita as notificações para receber os avisos.');

  const registration = await navigator.serviceWorker.register('/sw.js');
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription && !wasEnabled) {
    const { public_key: publicKey } = await invoke(supabase, { action: 'public-key' });
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true, applicationServerKey: decodeKey(publicKey),
    });
  }
  if (!subscription) { remember(role, id, false); return false; }
  try {
    await invoke(supabase, {
      action: wasEnabled ? 'unsubscribe' : 'subscribe',
      role, arena_id: arenaId, reservation_token: reservationToken,
      subscription: subscription.toJSON(),
    });
    remember(role, id, !wasEnabled);
    return !wasEnabled;
  } catch (error) { throw error; }
}

if (pushSupported()) navigator.serviceWorker.register('/sw.js').catch(console.error);

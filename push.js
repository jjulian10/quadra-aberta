export const pushSupported = () =>
  window.isSecureContext && 'serviceWorker' in navigator &&
  'PushManager' in window && 'Notification' in window;

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

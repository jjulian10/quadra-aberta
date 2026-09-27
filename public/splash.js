(() => {
  const standalone = window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  if (!standalone) return;

  const splash = document.getElementById("appSplash");
  if (!splash) return;

  splash.hidden = false;
  document.body.classList.add("splash-active");

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    splash.classList.add("app-splash--leaving");
    document.body.classList.remove("splash-active");
    window.setTimeout(() => splash.remove(), 350);
  };

  const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 250 : 1550;
  window.setTimeout(close, duration);
  window.addEventListener("pagehide", close, { once: true });
})();

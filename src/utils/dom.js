export function applyDeviceBodyClasses(body = document.body, nav = navigator) {
  const ua = nav.userAgent || '';
  body.classList.toggle(
    'ios-view',
    /iPad|iPhone|iPod/.test(ua) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1),
  );
  body.classList.toggle('android-view', /Android/.test(ua));
}

export function safeText(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[ch],
  );
}

export function setText(selector, value, root = document) {
  root.querySelectorAll(selector).forEach(el => {
    el.textContent = value;
  });
}

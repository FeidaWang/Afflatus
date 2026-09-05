// Financial values are content, not an animation state. Keep the server's
// exact values (including signs, precision and missing-value labels) from the
// first paint. Decorative tracks share that stable final state; no timer or
// observer may leave a reader looking at a fabricated zero.
export function initHomeScrollTelemetry() {
  for (const selector of ['#stardrive', '#fy2026Performance']) {
    document.querySelector(selector)?.classList.add('telemetry-static');
  }
}

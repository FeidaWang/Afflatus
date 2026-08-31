const portalSecurityHeaders = {
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'Content-Type': 'text/plain; charset=utf-8',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

function reject(status: number, allow?: string): Response {
  const headers = new Headers(portalSecurityHeaders);
  if (allow) headers.set('Allow', allow);
  return new Response(null, { status, headers });
}

export default function portalRequestBoundary(request: Request): Response | undefined {
  const url = new URL(request.url);
  if (url.search.length > 0) return reject(400);
  if (request.method !== 'GET' && request.method !== 'HEAD') return reject(405, 'GET, HEAD');
  return undefined;
}

export const config = {
  matcher: ['/portal', '/portal/:path*'],
  runtime: 'nodejs',
};

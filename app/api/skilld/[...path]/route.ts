const ALLOWED_PATHS = new Set([
  'auth/check',
  'auth/otp/verify',
  'auth/customers/register',
  'auth/providers/register',
]);

const MAX_REQUEST_BYTES = 32 * 1024;
const REQUEST_TIMEOUT_MS = 15_000;

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

type BodyResult =
  | { ok: true; body: string }
  | { ok: false; status: number; message: string };

function jsonError(message: string, status: number) {
  return Response.json(
    { success: false, message },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

function configuredApiBase(): string | null {
  const configured = process.env.SKILLD_API_URL?.trim();

  if (!configured) {
    return null;
  }

  try {
    const url = new URL(configured);
    const isLocal = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);

    if (url.protocol !== 'https:' && !(isLocal && url.protocol === 'http:')) {
      return null;
    }

    return configured.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

async function readLimitedJson(request: Request): Promise<BodyResult> {
  if (!request.body) {
    return { ok: false, status: 400, message: 'A JSON request body is required.' };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > MAX_REQUEST_BYTES) {
        await reader.cancel();
        return { ok: false, status: 413, message: 'Request is too large.' };
      }

      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 400, message: 'The request body could not be read.' };
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { ok: false, status: 400, message: 'A JSON object is required.' };
    }

    return { ok: true, body: JSON.stringify(parsed) };
  } catch {
    return { ok: false, status: 400, message: 'The request body is not valid JSON.' };
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { path: segments } = await context.params;
  const path = segments.join('/');

  if (!ALLOWED_PATHS.has(path)) {
    return jsonError('Not found.', 404);
  }

  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'application/json') {
    return jsonError('Content-Type must be application/json.', 415);
  }

  // Next's request URL may contain the internal container hostname behind TLS.
  // Use the configured public origin instead of trusting forwarded host headers.
  let requestOrigin = new URL(request.url).origin;
  const configuredOrigin = process.env.SKILLD_WEB_ORIGIN?.trim();

  if (configuredOrigin) {
    try {
      const publicUrl = new URL(configuredOrigin);
      if (!['http:', 'https:'].includes(publicUrl.protocol)) {
        return jsonError('Registration is not configured yet.', 503);
      }
      requestOrigin = publicUrl.origin;
    } catch {
      return jsonError('Registration is not configured yet.', 503);
    }
  }
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');

  if (origin && origin !== requestOrigin) {
    return jsonError('Cross-origin requests are not allowed.', 403);
  }

  if (fetchSite && fetchSite !== 'same-origin') {
    return jsonError('Cross-origin requests are not allowed.', 403);
  }

  const apiBase = configuredApiBase();
  if (!apiBase) {
    return jsonError('Registration is not configured yet.', 503);
  }

  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_REQUEST_BYTES) {
    return jsonError('Request is too large.', 413);
  }

  const bodyResult = await readLimitedJson(request);
  if (!bodyResult.ok) {
    return jsonError(bodyResult.message, bodyResult.status);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const upstreamHeaders = new Headers({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    });
    const connectingIp = process.env.SKILLD_TRUST_PROXY === 'true'
      ? request.headers.get('x-skilld-client-ip')
      : request.headers.get('cf-connecting-ip');

    if (connectingIp) {
      upstreamHeaders.set('X-Forwarded-For', connectingIp);
    }

    const upstream = await fetch(`${apiBase}/${path}`, {
      method: 'POST',
      headers: upstreamHeaders,
      body: bodyResult.body,
      cache: 'no-store',
      redirect: 'manual',
      signal: controller.signal,
    });
    const responseHeaders = new Headers({
      'Cache-Control': 'no-store',
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
    });
    const retryAfter = upstream.headers.get('retry-after');

    if (retryAfter) {
      responseHeaders.set('Retry-After', retryAfter);
    }

    return new Response(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return jsonError('Skilld is temporarily unavailable. Please try again.', 503);
  } finally {
    clearTimeout(timeout);
  }
}

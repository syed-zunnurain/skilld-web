import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const SESSION_COOKIE = 'skilld_agent_session';
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
    return {
      ok: false,
      status: 400,
      message: 'A JSON request body is required.',
    };
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
        return {
          ok: false,
          status: 413,
          message: 'Request is too large.',
        };
      }

      chunks.push(value);
    }
  } catch {
    return {
      ok: false,
      status: 400,
      message: 'The request body could not be read.',
    };
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return {
        ok: false,
        status: 400,
        message: 'A JSON object is required.',
      };
    }

    return { ok: true, body: JSON.stringify(parsed) };
  } catch {
    return {
      ok: false,
      status: 400,
      message: 'The request body is not valid JSON.',
    };
  }
}

async function proxy(request: Request, context: RouteContext) {
  const { path: segments } = await context.params;
  const path = segments.join('/');
  const allowed =
    request.method === 'GET'
      ? [
          'agent/profile',
          'agent/referrals',
          'agent/withdrawals',
          'agent/wallet/transactions',
        ].includes(path) || /^agent\/withdrawals\/[0-9]+\/proof$/.test(path)
      : request.method === 'POST'
        ? ['auth/login', 'auth/logout', 'agent/withdrawals'].includes(path)
        : request.method === 'PUT' && path === 'agent/password';
  if (!allowed) {
    return jsonError('Not found.', 404);
  }

  if (request.method !== 'GET') {
    let expectedOrigin = new URL(request.url).origin;

    try {
      if (process.env.SKILLD_WEB_ORIGIN) {
        expectedOrigin = new URL(process.env.SKILLD_WEB_ORIGIN).origin;
      }
    } catch {
      return jsonError('The agent portal is not configured yet.', 503);
    }

    const origin = request.headers.get('origin');
    const site = request.headers.get('sec-fetch-site');

    if (
      (origin && origin !== expectedOrigin) ||
      (site && site !== 'same-origin')
    ) {
      return jsonError('Cross-origin requests are not allowed.', 403);
    }

    if (
      request.headers.get('content-type')?.split(';')[0] !== 'application/json'
    ) {
      return jsonError('A JSON request is required.', 415);
    }
  }

  const apiBase = configuredApiBase();

  if (!apiBase) {
    return jsonError('The agent portal is not configured yet.', 503);
  }

  const token = (await cookies()).get(SESSION_COOKIE)?.value;

  if (path !== 'auth/login' && !token) {
    return jsonError('Please sign in.', 401);
  }

  let body: string | undefined;

  if (request.method !== 'GET') {
    const result = await readLimitedJson(request);
    if (!result.ok) {
      return jsonError(result.message, result.status);
    }

    body = result.body;

    if (path === 'auth/login') {
      const credentials = JSON.parse(body);
      body = JSON.stringify({
        phone: credentials.phone,
        password: credentials.password,
        force: credentials.force === true,
        user_type: 'agent',
      });
    }
  }

  const headers = new Headers({
    Accept: 'application/json',
    'Content-Type': 'application/json',
  });

  if (token && path !== 'auth/login') {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const upstream = await fetch(
      `${apiBase}/${path}${new URL(request.url).search}`,
      {
        method: request.method,
        body,
        headers,
        cache: 'no-store',
        redirect: 'manual',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );

    const responseHeaders = new Headers({
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });

    for (const name of ['content-type', 'content-disposition', 'retry-after']) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }

    if (path === 'auth/login') {
      const payload = (await upstream.json()) as {
        success?: boolean;
        message?: string;
        errors?: Record<string, string[]>;
        data?: { token?: string; role?: string; profile?: unknown };
      };
      if (
        !upstream.ok ||
        !payload.success ||
        !payload.data?.token ||
        payload.data.role !== 'agent'
      ) {
        return NextResponse.json(
          {
            success: false,
            message: payload.message ?? 'Unable to sign in.',
            errors: payload.errors,
          },
          {
            status: upstream.ok ? 502 : upstream.status,
            headers: responseHeaders,
          },
        );
      }

      const response = NextResponse.json(
        { success: true, data: payload.data.profile },
        { headers: responseHeaders },
      );
      response.cookies.set(SESSION_COOKIE, payload.data.token, {
        httpOnly: true,
        secure:
          new URL(request.url).protocol === 'https:' ||
          process.env.SKILLD_WEB_ORIGIN?.startsWith('https:') === true,
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60 * 24 * 3,
      });

      return response;
    }

    const response = new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });

    if (path === 'auth/logout' || upstream.status === 401) {
      response.cookies.set(SESSION_COOKIE, '', {
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
        maxAge: 0,
      });
    }

    return response;
  } catch {
    return jsonError(
      'Skilld is temporarily unavailable. Please try again.',
      503,
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;

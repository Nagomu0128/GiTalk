import { NextRequest, NextResponse } from 'next/server';

const getBackendUrl = (): string =>
  process.env.BACKEND_URL || 'http://localhost:8080';

const handler = async (req: NextRequest) => {
  try {
    const backendUrl = getBackendUrl();
    const path = req.nextUrl.pathname.replace(/^\/api/, '');
    const url = `${backendUrl}${path}${req.nextUrl.search}`;

    const headers = new Headers();
    req.headers.forEach((value, key) => {
      if (key !== 'host' && key !== 'connection' && key !== 'transfer-encoding') {
        headers.set(key, value);
      }
    });

    const body =
      req.method !== 'GET' && req.method !== 'HEAD' ? await req.text() : undefined;

    const response = await fetch(url, {
      method: req.method,
      headers,
      body,
    });

    const responseBody = await response.text();

    return new NextResponse(responseBody, {
      status: response.status,
      headers: {
        'content-type': response.headers.get('content-type') || 'application/json',
      },
    });
  } catch (error) {
    console.error('[API Proxy Error]', {
      method: req.method,
      path: req.nextUrl.pathname,
      backendUrl: getBackendUrl(),
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: { code: 'PROXY_ERROR', message: 'Failed to reach backend' } },
      { status: 502 },
    );
  }
};

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
export const PUT = handler;

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

const handler = async (req: NextRequest) => {
  const path = req.nextUrl.pathname.replace(/^\/api/, '');
  const url = `${BACKEND_URL}${path}${req.nextUrl.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (key !== 'host' && key !== 'connection') {
      headers.set(key, value);
    }
  });

  const body = req.method !== 'GET' && req.method !== 'HEAD'
    ? await req.text()
    : undefined;

  const response = await fetch(url, {
    method: req.method,
    headers,
    body,
  });

  const responseHeaders = new Headers();
  response.headers.forEach((value, key) => {
    responseHeaders.set(key, value);
  });

  return new NextResponse(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
};

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
export const PUT = handler;

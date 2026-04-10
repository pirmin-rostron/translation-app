import { NextRequest, NextResponse } from "next/server";

/**
 * Catch-all API proxy — forwards /api/* to the backend.
 *
 * Uses BACKEND_URL (server-side env var, NOT NEXT_PUBLIC_*) so the
 * backend address is never baked into the client bundle. One frontend
 * build works in dev, Docker, and production.
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

async function proxyRequest(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const target = `${BACKEND_URL}/${path.join("/")}`;
  const url = new URL(target);

  // Preserve query string
  req.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });

  // Forward headers, stripping hop-by-hop
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  // Ensure host header points to the backend
  headers.set("host", new URL(BACKEND_URL).host);

  const init: RequestInit & { duplex?: string } = {
    method: req.method,
    headers,
  };

  // Forward body for methods that have one
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
    init.duplex = "half";
  }

  try {
    const upstream = await fetch(url.toString(), init);

    // Forward response headers, stripping hop-by-hop
    const responseHeaders = new Headers();
    upstream.headers.forEach((value, key) => {
      if (!HOP_BY_HOP.has(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    return new NextResponse(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Backend unreachable";
    return NextResponse.json(
      { detail: `Proxy error: ${message}` },
      { status: 502 },
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;

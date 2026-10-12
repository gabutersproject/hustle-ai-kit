const ENGINE = process.env.ENGINE_URL ?? "http://127.0.0.1:43124";

async function proxy(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const incoming = new URL(request.url);
  const target = `${ENGINE}/${path.join("/")}${incoming.search}`;
  const init: RequestInit = {
    method: request.method,
    headers: { "content-type": request.headers.get("content-type") ?? "application/json" },
    signal: AbortSignal.timeout(180_000),
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }

  try {
    const response = await fetch(target, init);
    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json",
      },
    });
  } catch {
    return Response.json(
      {
        detail:
          "The quoting engine isn't running on this machine yet. If you just opened Sawhorse, give it a few seconds and try again.",
      },
      { status: 503 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const dynamic = "force-dynamic";

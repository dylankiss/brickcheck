// ALLOWED_ORIGINS: comma-separated origins, `*` wildcards allowed for preview
// deploys, e.g. "https://brickcheck.app,https://*.brickcheck.pages.dev".
// Unset means any origin (local development); calls are JWT-checked either way.
const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean)
  .map(
    (o) =>
      new RegExp(
        `^${o.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[a-z0-9-]+")}$`,
        "i",
      ),
  );

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed =
    allowedOrigins.length === 0
      ? "*"
      : origin && allowedOrigins.some((re) => re.test(origin))
        ? origin
        : "null";
  return {
    "Access-Control-Allow-Origin": allowed,
    Vary: "Origin",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Wraps a handler with CORS (preflight and headers) and uniform error responses. */
export function serve(handler: (req: Request) => Promise<Response>) {
  Deno.serve(async (req) => {
    const cors = corsHeaders(req.headers.get("Origin"));
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: cors });
    }
    let res: Response;
    try {
      res = await handler(req);
    } catch (error) {
      if (error instanceof HttpError) {
        res = json({ error: error.message }, error.status);
      } else {
        console.error(error);
        res = json({ error: "Internal error" }, 500);
      }
    }
    for (const [name, value] of Object.entries(cors))
      res.headers.set(name, value);
    return res;
  });
}

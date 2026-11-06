import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { HttpError } from "./http.ts";

/** Service-role client: bypasses RLS, only for writes the architecture assigns to functions. */
export function adminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  // Prefer a new-style secret key (function secret; the SUPABASE_ prefix is reserved); fall back to the legacy service role JWT.
  const key =
    Deno.env.get("BRICKCHECK_SECRET_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("Supabase environment is not configured");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Returns the calling user's id, or throws 401 unless the caller is a logged-in,
 * non-anonymous user. With asymmetric JWTs getClaims verifies locally, so a
 * signed-out token stays valid until it expires (at most jwt_expiry).
 */
export async function requireUser(
  req: Request,
  admin: SupabaseClient,
): Promise<string> {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    throw new HttpError(401, "Not logged in");
  }

  const { data, error } = await admin.auth.getClaims(token);
  const claims = data?.claims;
  if (
    error ||
    !claims ||
    claims.role !== "authenticated" ||
    !claims.sub ||
    claims.is_anonymous
  ) {
    throw new HttpError(401, "Not logged in");
  }
  return claims.sub;
}

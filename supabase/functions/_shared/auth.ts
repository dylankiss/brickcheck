import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { HttpError } from "./http.ts";

/** Service-role client: bypasses RLS, only for writes the architecture assigns to functions. */
export function adminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase environment is not configured");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Returns the calling user's id, or throws 401 unless the caller is a logged-in user. */
export async function requireUser(
  req: Request,
  admin: SupabaseClient,
): Promise<string> {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "Not logged in");

  const { data, error } = await admin.auth.getClaims(token);
  const claims = data?.claims;
  if (error || !claims || claims.role !== "authenticated" || !claims.sub) {
    throw new HttpError(401, "Not logged in");
  }
  return claims.sub;
}

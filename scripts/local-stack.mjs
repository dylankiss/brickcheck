// The local Supabase stack's URL and keys, for scripts that only ever run
// against it (smoke test, e2e, demo seed). Environment variables win; anything
// missing is read from `npx supabase status`, so `npm run smoke` works as is.
import { execFileSync } from "node:child_process";

let status;
function fromStatus(...names) {
  status ??= readStatus();
  for (const name of names) if (status[name]) return status[name];
  return undefined;
}

function readStatus() {
  let out;
  try {
    out = execFileSync("npx", ["supabase", "status", "-o", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    throw new Error(
      "Could not read the local stack's keys from `npx supabase status`. Is it running (`npx supabase start`)?",
    );
  }
  // Lines look like NAME="value".
  return Object.fromEntries(
    [...out.matchAll(/^([A-Z_]+)="?(.*?)"?$/gm)].map(([, name, value]) => [
      name,
      value,
    ]),
  );
}

/** URL, publishable key and secret key of the local stack; refuses any other stack. */
export function localStack() {
  // Empty variables count as unset.
  const env = (name) => process.env[name] || undefined;
  const fromEnv = {
    url: env("SUPABASE_URL"),
    publishableKey: env("SUPABASE_PUBLISHABLE_KEY"),
    secretKey: env("SUPABASE_SECRET_KEY"),
  };
  // Ask the CLI only for what the environment leaves out (it also knows the API port from config.toml).
  const needStatus = !fromEnv.publishableKey || !fromEnv.secretKey;
  const url =
    fromEnv.url ??
    (needStatus ? fromStatus("API_URL") : undefined) ??
    "http://127.0.0.1:54321";
  const { protocol, hostname } = new URL(url);
  if (protocol !== "http:" || !["127.0.0.1", "localhost"].includes(hostname))
    throw new Error(`Refusing to run against a non-local stack: ${url}`);
  // Newer CLIs print PUBLISHABLE_KEY / SECRET_KEY, older ones ANON_KEY / SERVICE_ROLE_KEY.
  const publishableKey =
    fromEnv.publishableKey ?? fromStatus("PUBLISHABLE_KEY", "ANON_KEY");
  const secretKey =
    fromEnv.secretKey ?? fromStatus("SECRET_KEY", "SERVICE_ROLE_KEY");
  if (!publishableKey || !secretKey)
    throw new Error(
      "`npx supabase status` printed no keys; set SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY",
    );
  return { url, publishableKey, secretKey };
}

// Starts everything for working on the app locally, in one terminal:
//   1. checks that Docker runs, and starts the local Supabase stack if it does not
//   2. makes sure .env.local points at that stack (refuses any other address)
//   3. serves the Edge Functions and the web app, with their output labelled
// Usage: npm run dev:all [-- --reset] [-- --seed you@example.com]
//   --reset  rebuild the local database from the migrations first (wipes local data)
//   --seed   add the demo Sets for that email (see scripts/seed-demo.mjs)
// Ctrl-C stops the functions and the web app. The Supabase containers keep running
// (starting them is slow); stop them with `npx supabase stop`.
// Needs Docker, so run it outside Claude Code's sandbox.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { localStack } from "./local-stack.mjs";

const args = process.argv.slice(2);
const reset = args.includes("--reset");
const seedAt = args.indexOf("--seed");
const seedEmail = seedAt >= 0 ? args[seedAt + 1] : undefined;
if (seedAt >= 0 && !seedEmail?.includes("@")) {
  fail("Usage: npm run dev:all -- --seed you@example.com");
}

function fail(message) {
  console.error(`\n${message}`);
  process.exit(1);
}
const step = (message) => console.log(`\n▶ ${message}`);
const run = (cmd, cmdArgs) => execFileSync(cmd, cmdArgs, { stdio: "inherit" });
const succeeds = (cmd, cmdArgs) => {
  try {
    execFileSync(cmd, cmdArgs, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

// 1. Docker and the Supabase stack
step("Checking Docker");
if (!succeeds("docker", ["info"])) {
  fail("Docker is not running. Start Docker Desktop and try again.");
}

step("Checking the local Supabase stack");
if (succeeds("npx", ["supabase", "status"])) {
  console.log("Already running.");
} else {
  run("npx", ["supabase", "start"]);
}
if (reset) {
  step("Resetting the local database (wipes local data)");
  run("npx", ["supabase", "db", "reset"]);
}

// 2. .env.local points at the local stack (and only ever at it)
step("Checking .env.local");
const { url, publishableKey } = localStack(); // throws for any non-local address
const envPath = ".env.local";
let env = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const existing = env.match(/^VITE_SUPABASE_URL=(.*)$/m)?.[1]?.trim();
if (existing) {
  const { hostname } = new URL(existing);
  if (!["127.0.0.1", "localhost"].includes(hostname)) {
    fail(
      `.env.local points at ${existing}, which is not the local stack. Fix it by hand first: this script never touches a hosted project.`,
    );
  }
}
const setVar = (name, value) => {
  const line = `${name}=${value}`;
  env = new RegExp(`^${name}=.*$`, "m").test(env)
    ? env.replace(new RegExp(`^${name}=.*$`, "m"), line)
    : `${env}${env && !env.endsWith("\n") ? "\n" : ""}${line}\n`;
};
const before = env;
setVar("VITE_SUPABASE_URL", url);
setVar("VITE_SUPABASE_PUBLISHABLE_KEY", publishableKey);
if (env !== before) {
  writeFileSync(envPath, env);
  console.log(
    `Updated ${envPath} (URL and publishable key of the local stack).`,
  );
} else {
  console.log("Up to date.");
}
if (!existsSync("supabase/.env")) {
  console.log(
    "Note: supabase/.env is missing, so functions that need the Rebrickable key will fail.\n" +
      "      Copy supabase/.env.example to supabase/.env, or use --seed for demo data.",
  );
}

// 3. Optional demo data
if (seedEmail) {
  step(`Adding demo Sets for ${seedEmail}`);
  run("node", ["scripts/seed-demo.mjs", seedEmail]);
}

// 4. The functions and the web app, until Ctrl-C
step("Starting the functions and the web app (Ctrl-C stops both)");
const children = [];
function start(label, cmd, cmdArgs) {
  const child = spawn(cmd, cmdArgs, { stdio: ["ignore", "pipe", "pipe"] });
  for (const stream of [child.stdout, child.stderr]) {
    createInterface({ input: stream }).on("line", (line) =>
      console.log(`[${label}] ${line}`),
    );
  }
  child.on("exit", (code) => {
    if (!stopping) {
      console.error(`\n[${label}] stopped (exit ${code}). Stopping the rest.`);
      stop(code || 1);
    }
  });
  children.push(child);
}
let stopping = false;
function stop(code = 0) {
  stopping = true;
  for (const child of children) {
    child.kill("SIGINT");
  }
  console.log(
    "\nStopped. The Supabase containers are still running: `npx supabase stop` shuts them down.",
  );
  setTimeout(() => process.exit(code), 500);
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());

start("functions", "npx", ["supabase", "functions", "serve"]);
start("web", "npx", ["vite"]);
console.log(`
  App:      http://localhost:5173
  Mailpit:  http://127.0.0.1:54324   (login emails arrive here)
  Studio:   http://127.0.0.1:54323
`);

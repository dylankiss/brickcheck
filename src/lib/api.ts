// All data access lives here (ARCHITECTURE.md, "Frontend conventions").
import { FunctionsHttpError, type Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type {
  CheckLine,
  CheckSummary,
  LegoSet,
  LineProgress,
  NewCheck,
} from "./types";

// Rows requested per page; the server may return fewer (its max_rows).
const PAGE_SIZE = 1000;

export class ApiError extends Error {}

function fail(error: { message: string } | null): never {
  throw new ApiError(error?.message ?? "Something went wrong");
}

/** Fetches every row, page by page, until a page comes back empty. */
async function fetchAll<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const { data, error } = await page(
      rows.length,
      rows.length + PAGE_SIZE - 1,
    );
    if (error || !data) fail(error);
    if (data.length === 0) return rows;
    rows.push(...data);
  }
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthChange(
  callback: (session: Session | null) => void,
): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) =>
    callback(session),
  );
  return () => data.subscription.unsubscribe();
}

export async function signInWithEmail(
  email: string,
  redirectTo: string,
): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) fail(error);
}

export async function signInWithGoogle(redirectTo: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) fail(error);
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) fail(error);
}

// ---------------------------------------------------------------------------
// Sets
// ---------------------------------------------------------------------------

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Searches the catalog by set number prefix ("75192") or name ("falcon"). */
export async function searchSets(query: string): Promise<LegoSet[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  let request = supabase.from("lego_sets").select("*").gt("num_parts", 0);
  request = /^\d[\d-]*$/.test(q)
    ? request.like("set_num", `${escapeLike(q)}%`)
    : request.ilike("name", `%${escapeLike(q)}%`);
  const { data, error } = await request
    .order("year", { ascending: false })
    .limit(30);
  if (error) fail(error);
  return data;
}

/** Makes sure the set's inventory is cached, importing it from Rebrickable if needed. */
export async function fetchSet(setNum: string): Promise<LegoSet> {
  const { data, error } = await supabase.functions.invoke<LegoSet>(
    "fetch-set",
    { body: { set_num: setNum } },
  );
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      throw new ApiError(body?.error ?? "Could not load the set");
    }
    fail(error);
  }
  if (!data) throw new ApiError("Could not load the set");
  return data;
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

export async function listChecks(): Promise<CheckSummary[]> {
  const { data, error } = await supabase
    .from("check_summaries")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) fail(error);
  return data;
}

export async function getCheck(checkId: string): Promise<CheckSummary | null> {
  const { data, error } = await supabase
    .from("check_summaries")
    .select("*")
    .eq("id", checkId)
    .maybeSingle();
  if (error) fail(error);
  return data;
}

export async function createCheck(check: NewCheck): Promise<string> {
  const { data, error } = await supabase
    .from("checks")
    .insert(check)
    .select("id")
    .single();
  if (error) fail(error);
  return data.id;
}

export async function updateCheck(
  checkId: string,
  changes: { title?: string },
): Promise<void> {
  const { error } = await supabase
    .from("checks")
    .update(changes)
    .eq("id", checkId);
  if (error) fail(error);
}

export async function deleteCheck(checkId: string): Promise<void> {
  const { error } = await supabase.from("checks").delete().eq("id", checkId);
  if (error) fail(error);
}

/** The check's full inventory with progress; loaded once per visit. */
export function getCheckLines(checkId: string): Promise<CheckLine[]> {
  return fetchAll((from, to) =>
    supabase
      .from("check_lines")
      .select("*")
      .eq("check_id", checkId)
      .order("set_part_id")
      .range(from, to),
  );
}

/** Only the progress numbers, for cheap refreshes after reconnecting. */
export function getCheckProgress(checkId: string): Promise<LineProgress[]> {
  return fetchAll((from, to) =>
    supabase
      .from("check_progress")
      .select("set_part_id, found_qty, updated_at")
      .eq("check_id", checkId)
      .order("set_part_id")
      .range(from, to),
  );
}

/** Adds `delta` found pieces of one part + color; returns that tile's lines. */
export async function adjustPart(
  checkId: string,
  partNum: string,
  colorId: number,
  delta: number,
): Promise<LineProgress[]> {
  const { data, error } = await supabase.rpc("adjust_part", {
    p_check_id: checkId,
    p_part_num: partNum,
    p_color_id: colorId,
    p_delta: delta,
  });
  if (error) fail(error);
  return data;
}

// ---------------------------------------------------------------------------
// Realtime
// ---------------------------------------------------------------------------

export interface CheckChannelHandlers {
  onProgress: (progress: LineProgress) => void;
  /** Called on every (re)subscribe, so callers can refetch what they missed. */
  onSubscribed: () => void;
}

/** Subscribes to the check's private channel; returns an unsubscribe function. */
export function subscribeToCheck(
  checkId: string,
  handlers: CheckChannelHandlers,
): () => void {
  const channel = supabase.channel(`check:${checkId}`, {
    config: { private: true },
  });
  channel.on("broadcast", { event: "progress" }, ({ payload }) =>
    handlers.onProgress(payload as LineProgress),
  );

  let cancelled = false;
  supabase.realtime.setAuth().then(() => {
    if (cancelled) return;
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") handlers.onSubscribed();
    });
  });

  return () => {
    cancelled = true;
    supabase.removeChannel(channel);
  };
}

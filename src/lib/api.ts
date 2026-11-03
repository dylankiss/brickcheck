// All data access lives here (ARCHITECTURE.md, "Frontend conventions").
import { FunctionsHttpError, type Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type {
  CheckLine,
  CheckRole,
  CheckSummary,
  Invite,
  InvitePreview,
  LegoSet,
  LineProgress,
  Member,
  NewCheck,
  Profile,
} from "./types";

// Rows requested per page; the server may return fewer (its max_rows).
const PAGE_SIZE = 1000;
// Mobile connections stall; a tap that hangs longer fails and is refetched.
const TAP_TIMEOUT_MS = 10_000;

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

/** Logs in with the 6-digit code from the login email (needed in the installed iOS app). */
export async function verifyEmailCode(
  email: string,
  code: string,
): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: "email",
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
// Profile
// ---------------------------------------------------------------------------

export async function getMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .eq("id", userId)
    .maybeSingle();
  if (error) fail(error);
  return data;
}

export async function updateMyName(
  userId: string,
  displayName: string,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", userId);
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

export function listChecks(): Promise<CheckSummary[]> {
  return fetchAll((from, to) =>
    supabase
      .from("check_summaries")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to),
  );
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
  const { data, error } = await supabase
    .rpc("adjust_part", {
      p_check_id: checkId,
      p_part_num: partNum,
      p_color_id: colorId,
      p_delta: delta,
    })
    .abortSignal(AbortSignal.timeout(TAP_TIMEOUT_MS));
  if (error)
    fail(
      error.name === "AbortError"
        ? { message: "The connection is slow; that tap was not saved" }
        : error,
    );
  return data;
}

// ---------------------------------------------------------------------------
// Members and invites
// ---------------------------------------------------------------------------

export async function listMembers(checkId: string): Promise<Member[]> {
  const data = await fetchAll((from, to) =>
    supabase
      .from("check_members")
      .select("user_id, role, joined_at, profiles(display_name, avatar_url)")
      .eq("check_id", checkId)
      .order("joined_at")
      .order("user_id")
      .range(from, to),
  );
  return data.map(({ profiles, ...member }) => {
    const profile = (Array.isArray(profiles) ? profiles[0] : profiles) as Pick<
      Profile,
      "display_name" | "avatar_url"
    > | null;
    return {
      ...member,
      role: member.role as CheckRole,
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
    };
  });
}

export async function setMemberRole(
  checkId: string,
  userId: string,
  role: Exclude<CheckRole, "owner">,
): Promise<void> {
  const { error } = await supabase
    .from("check_members")
    .update({ role })
    .eq("check_id", checkId)
    .eq("user_id", userId);
  if (error) fail(error);
}

/** Removes a member; with your own id this is "leave the check". */
export async function removeMember(
  checkId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("check_members")
    .delete()
    .eq("check_id", checkId)
    .eq("user_id", userId);
  if (error) fail(error);
}

export function listInvites(checkId: string): Promise<Invite[]> {
  return fetchAll((from, to) =>
    supabase
      .from("check_invites")
      .select("token, role, expires_at")
      .eq("check_id", checkId)
      .gt("expires_at", new Date().toISOString())
      .order("created_at")
      .order("token")
      .range(from, to),
  );
}

export async function createInvite(
  checkId: string,
  role: Invite["role"],
): Promise<Invite> {
  const { data, error } = await supabase
    .from("check_invites")
    .insert({ check_id: checkId, role })
    .select("token, role, expires_at")
    .single();
  if (error) fail(error);
  return data;
}

export async function deleteInvite(token: string): Promise<void> {
  const { error } = await supabase
    .from("check_invites")
    .delete()
    .eq("token", token);
  if (error) fail(error);
}

// The public address, so links made on a preview deploy still point at production.
const PUBLIC_URL = import.meta.env.VITE_PUBLIC_URL || window.location.origin;

export const inviteUrl = (token: string) => `${PUBLIC_URL}/join/${token}`;

export async function getInvitePreview(
  token: string,
): Promise<InvitePreview | null> {
  const { data, error } = await supabase.rpc("invite_preview", {
    p_token: token,
  });
  if (error) fail(error);
  return (data as InvitePreview[])[0] ?? null;
}

/** Joins the invite's check; returns its id. */
export async function acceptInvite(token: string): Promise<string> {
  const { data, error } = await supabase.rpc("accept_invite", {
    p_token: token,
  });
  if (error) fail(error);
  return data;
}

// ---------------------------------------------------------------------------
// Realtime
// ---------------------------------------------------------------------------

export interface CheckChannelHandlers {
  onProgress: (progress: LineProgress) => void;
  /** The check or its members changed (rename, join, leave, role change). */
  onChanged: () => void;
  /** Called on every (re)subscribe, so callers can refetch what they missed. */
  onSubscribed: () => void;
  /** User ids with the check open; names come from the member list, not from presence. */
  onPresence: (userIds: string[]) => void;
}

// Channels still leaving, by topic. supabase.channel() would hand back a
// leaving channel with the same topic, which then never subscribes.
const leaving = new Map<string, Promise<unknown>>();

/**
 * Subscribes to the check's private channel and announces `me` there;
 * returns an unsubscribe function. One channel per check (ARCHITECTURE.md).
 */
export function subscribeToCheck(
  checkId: string,
  userId: string,
  handlers: CheckChannelHandlers,
): () => void {
  const topic = `check:${checkId}`;
  let channel: ReturnType<typeof supabase.channel> | null = null;
  let cancelled = false;

  Promise.all([leaving.get(topic), supabase.realtime.setAuth()]).then(() => {
    if (cancelled) return;
    channel = openCheckChannel(topic, userId, handlers);
  });

  return () => {
    cancelled = true;
    if (!channel) return;
    const removal = supabase.removeChannel(channel).finally(() => {
      if (leaving.get(topic) === removal) leaving.delete(topic);
    });
    leaving.set(topic, removal);
  };
}

function openCheckChannel(
  topic: string,
  userId: string,
  handlers: CheckChannelHandlers,
) {
  const channel = supabase.channel(topic, {
    config: { private: true, presence: { key: userId } },
  });
  channel
    .on("broadcast", { event: "progress" }, ({ payload }) =>
      handlers.onProgress(payload as LineProgress),
    )
    .on("broadcast", { event: "changed" }, () => handlers.onChanged())
    .on("presence", { event: "sync" }, () =>
      handlers.onPresence(Object.keys(channel.presenceState())),
    );

  channel.subscribe((status) => {
    if (status !== "SUBSCRIBED") return;
    channel.track({});
    handlers.onSubscribed();
  });
  return channel;
}

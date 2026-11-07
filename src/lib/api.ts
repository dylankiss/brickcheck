// All data access goes through here (ARCHITECTURE.md, "Frontend conventions").
// Sign-in and the user's own profile live in ./auth and are re-exported below.
import { FunctionsHttpError } from "@supabase/supabase-js";
import { ApiError, fail } from "./errors";
import { supabase } from "./supabase";
import type {
  InventoryLine,
  SetRole,
  SetSummary,
  Invite,
  InvitePreview,
  CatalogSet,
  LineProgress,
  Member,
  NewSet,
  Profile,
} from "./types";

export * from "./auth";
export { ApiError };

// Rows requested per page; the server may return fewer (its max_rows).
const PAGE_SIZE = 1000;
// Mobile connections stall; a tap that hangs longer fails and is refetched.
const TAP_TIMEOUT_MS = 10_000;

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
    if (error || !data) {
      fail(error);
    }
    if (data.length === 0) {
      return rows;
    }
    rows.push(...data);
  }
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Searches the catalog by set number prefix ("75192") or name ("falcon"). */
export async function searchCatalog(query: string): Promise<CatalogSet[]> {
  const q = query.trim();
  if (q.length < 2) {
    return [];
  }
  let request = supabase.from("lego_sets").select("*").gt("num_parts", 0);
  request = /^\d[\d-]*$/.test(q)
    ? request.like("set_num", `${escapeLike(q)}%`)
    : request.ilike("name", `%${escapeLike(q)}%`);
  const { data, error } = await request
    .order("year", { ascending: false })
    .limit(30);
  if (error) {
    fail(error);
  }
  return data;
}

/** Makes sure the catalog set's inventory is cached, importing it from Rebrickable if needed. */
export async function fetchCatalogSet(setNum: string): Promise<CatalogSet> {
  const { data, error } = await supabase.functions.invoke<CatalogSet>(
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
  if (!data) {
    throw new ApiError("Could not load the set");
  }
  return data;
}

// ---------------------------------------------------------------------------
// Sets
// ---------------------------------------------------------------------------

export function listMySets(): Promise<SetSummary[]> {
  return fetchAll((from, to) =>
    supabase
      .from("set_summaries")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to),
  );
}

export async function getSet(setId: string): Promise<SetSummary | null> {
  const { data, error } = await supabase
    .from("set_summaries")
    .select("*")
    .eq("id", setId)
    .maybeSingle();
  if (error) {
    fail(error);
  }
  return data;
}

export async function createSet(set: NewSet): Promise<string> {
  const { data, error } = await supabase
    .from("sets")
    .insert(set)
    .select("id")
    .single();
  if (error) {
    fail(error);
  }
  return data.id;
}

export async function updateSet(
  setId: string,
  changes: { title?: string },
): Promise<void> {
  const { error } = await supabase.from("sets").update(changes).eq("id", setId);
  if (error) {
    fail(error);
  }
}

/** Owner only: sets every part's found count in the set back to zero. */
export async function resetSetProgress(setId: string): Promise<void> {
  const { error } = await supabase.rpc("reset_set_progress", {
    p_set_id: setId,
  });
  if (error) {
    fail(error);
  }
}

export async function deleteSet(setId: string): Promise<void> {
  const { error } = await supabase.from("sets").delete().eq("id", setId);
  if (error) {
    fail(error);
  }
}

/** The set's full inventory with progress; loaded once per visit. */
export function getSetLines(setId: string): Promise<InventoryLine[]> {
  return fetchAll((from, to) =>
    supabase
      .from("set_lines")
      .select("*")
      .eq("set_id", setId)
      .order("line_id")
      .range(from, to),
  );
}

/** The inventory with progress of several sets at once (missing across sets). */
export function getLinesOfSets(setIds: string[]): Promise<InventoryLine[]> {
  if (setIds.length === 0) {
    return Promise.resolve([]);
  }
  return fetchAll((from, to) =>
    supabase
      .from("set_lines")
      .select("*")
      .in("set_id", setIds)
      .order("set_id")
      .order("line_id")
      .range(from, to),
  );
}

/** Only the progress numbers, for cheap refreshes after reconnecting. */
export function getSetProgress(setId: string): Promise<LineProgress[]> {
  return fetchAll((from, to) =>
    supabase
      .from("set_progress")
      .select("line_id, found_qty, updated_at")
      .eq("set_id", setId)
      .order("line_id")
      .range(from, to),
  );
}

/** Adds `delta` found pieces of one part + color; returns that part's lines. */
export async function adjustPart(
  setId: string,
  partNum: string,
  colorId: number,
  delta: number,
): Promise<LineProgress[]> {
  const { data, error } = await supabase
    .rpc("adjust_part", {
      p_set_id: setId,
      p_part_num: partNum,
      p_color_id: colorId,
      p_delta: delta,
    })
    .abortSignal(AbortSignal.timeout(TAP_TIMEOUT_MS));
  if (error) {
    // postgrest-js returns a plain object for a fetch failure, with the error
    // name only at the start of its message (AbortSignal.timeout rejects with
    // a TimeoutError).
    fail(
      /^(TimeoutError|AbortError)\b/.test(error.message)
        ? { message: "The connection is slow; that tap was not saved" }
        : error,
    );
  }
  return data;
}

// ---------------------------------------------------------------------------
// Members and invites
// ---------------------------------------------------------------------------

export async function listMembers(setId: string): Promise<Member[]> {
  const data = await fetchAll((from, to) =>
    supabase
      .from("set_members")
      .select("user_id, role, joined_at, profiles(display_name, avatar_url)")
      .eq("set_id", setId)
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
      role: member.role as SetRole,
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
    };
  });
}

export async function setMemberRole(
  setId: string,
  userId: string,
  role: Exclude<SetRole, "owner">,
): Promise<void> {
  const { error } = await supabase
    .from("set_members")
    .update({ role })
    .eq("set_id", setId)
    .eq("user_id", userId);
  if (error) {
    fail(error);
  }
}

/** Removes a member; with your own id this is "leave the set". */
export async function removeMember(
  setId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("set_members")
    .delete()
    .eq("set_id", setId)
    .eq("user_id", userId);
  if (error) {
    fail(error);
  }
}

export function listInvites(setId: string): Promise<Invite[]> {
  return fetchAll((from, to) =>
    supabase
      .from("set_invites")
      .select("token, role, expires_at")
      .eq("set_id", setId)
      .gt("expires_at", new Date().toISOString())
      .order("created_at")
      .order("token")
      .range(from, to),
  );
}

export async function createInvite(
  setId: string,
  role: Invite["role"],
): Promise<Invite> {
  const { data, error } = await supabase
    .from("set_invites")
    .insert({ set_id: setId, role })
    .select("token, role, expires_at")
    .single();
  if (error) {
    fail(error);
  }
  return data;
}

export async function deleteInvite(token: string): Promise<void> {
  const { error } = await supabase
    .from("set_invites")
    .delete()
    .eq("token", token);
  if (error) {
    fail(error);
  }
}

// The public address, so links made on a preview deploy still point at production.
const PUBLIC_URL = (
  import.meta.env.VITE_PUBLIC_URL || window.location.origin
).replace(/\/+$/, "");

export const inviteUrl = (token: string) => `${PUBLIC_URL}/join/${token}`;

export async function getInvitePreview(
  token: string,
): Promise<InvitePreview | null> {
  const { data, error } = await supabase.rpc("invite_preview", {
    p_token: token,
  });
  if (error) {
    fail(error);
  }
  return (data as InvitePreview[])[0] ?? null;
}

/** Joins the invite's set; returns its id. */
export async function acceptInvite(token: string): Promise<string> {
  const { data, error } = await supabase.rpc("accept_invite", {
    p_token: token,
  });
  if (error) {
    fail(error);
  }
  return data;
}

// ---------------------------------------------------------------------------
// Realtime
// ---------------------------------------------------------------------------

export interface SetChannelHandlers {
  onProgress: (progress: LineProgress) => void;
  /** The set or its members changed (rename, join, leave, role change). */
  onChanged: () => void;
  /** Called on every (re)subscribe, so callers can refetch what they missed. */
  onSubscribed: () => void;
  /** User ids with the set open; names come from the member list, not from presence. */
  onPresence: (userIds: string[]) => void;
}

// Channels still leaving, by topic. supabase.channel() would hand back a
// leaving channel with the same topic, which then never subscribes.
const leaving = new Map<string, Promise<unknown>>();

/**
 * Subscribes to the set's private channel and announces `me` there;
 * returns an unsubscribe function. One channel per set (ARCHITECTURE.md).
 */
export function subscribeToSet(
  setId: string,
  userId: string,
  handlers: SetChannelHandlers,
): () => void {
  const topic = `set:${setId}`;
  let channel: ReturnType<typeof supabase.channel> | null = null;
  let cancelled = false;

  Promise.all([leaving.get(topic), supabase.realtime.setAuth()]).then(() => {
    if (cancelled) {
      return;
    }
    channel = openSetChannel(topic, userId, handlers);
  });

  return () => {
    cancelled = true;
    if (!channel) {
      return;
    }
    const removal = supabase.removeChannel(channel).finally(() => {
      if (leaving.get(topic) === removal) {
        leaving.delete(topic);
      }
    });
    leaving.set(topic, removal);
  };
}

function openSetChannel(
  topic: string,
  userId: string,
  handlers: SetChannelHandlers,
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
    if (status !== "SUBSCRIBED") {
      return;
    }
    channel.track({});
    handlers.onSubscribed();
  });
  return channel;
}

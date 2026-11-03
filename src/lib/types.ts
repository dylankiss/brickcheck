// Row shapes as returned by PostgREST. Hand-written until a linked project
// exists for `supabase gen types` (see ARCHITECTURE.md).

export type SetRole = "owner" | "helper" | "viewer";

export interface CatalogSet {
  set_num: string;
  name: string;
  year: number | null;
  theme_id: number | null;
  num_parts: number;
  img_url: string | null;
  parts_fetched_at: string | null;
}

/** Row of the `set_summaries` view. */
export interface SetSummary {
  id: string;
  owner_id: string;
  set_num: string;
  title: string;
  include_spares: boolean;
  include_minifigs: boolean;
  created_at: string;
  catalog_name: string;
  catalog_year: number | null;
  catalog_img_url: string | null;
  my_role: SetRole | null;
  needed: number;
  found: number;
}

/** Row of the `set_lines` view: one inventory line that counts for a set. */
export interface InventoryLine {
  set_id: string;
  line_id: number;
  part_num: string;
  part_name: string;
  part_cat_id: number | null;
  color_id: number;
  color_name: string;
  color_rgb: string | null;
  is_trans: boolean;
  img_url: string | null;
  element_id: string | null;
  bricklink_part_id: string | null;
  bricklink_color_id: number | null;
  quantity: number;
  is_spare: boolean;
  fig_num: string | null;
  found_qty: number;
  updated_at: string | null;
}

/** Server progress for one line: returned by adjust_part, refetched, and sent as broadcasts. */
export interface LineProgress {
  line_id: number;
  found_qty: number;
  updated_at: string;
  /** Only present on broadcasts. */
  updated_by?: string | null;
}

export interface NewSet {
  set_num: string;
  title: string;
  include_spares: boolean;
  include_minifigs: boolean;
}

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface Member {
  user_id: string;
  role: SetRole;
  joined_at: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface Invite {
  token: string;
  role: Exclude<SetRole, "owner">;
  expires_at: string;
}

/** What an invite link leads to (invite_preview RPC). */
export interface InvitePreview {
  set_id: string;
  set_title: string;
  set_num: string;
  catalog_name: string;
  catalog_img_url: string | null;
  role: Exclude<SetRole, "owner">;
  invited_by: string | null;
  already_member: boolean;
}

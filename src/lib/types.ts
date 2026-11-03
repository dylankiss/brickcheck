// Row shapes as returned by PostgREST. Hand-written until a linked project
// exists for `supabase gen types` (see ARCHITECTURE.md).

export type CheckRole = "owner" | "helper" | "viewer";

export interface LegoSet {
  set_num: string;
  name: string;
  year: number | null;
  theme_id: number | null;
  num_parts: number;
  img_url: string | null;
  parts_fetched_at: string | null;
}

/** Row of the `check_summaries` view. */
export interface CheckSummary {
  id: string;
  owner_id: string;
  set_num: string;
  title: string;
  include_spares: boolean;
  include_minifigs: boolean;
  created_at: string;
  set_name: string;
  set_year: number | null;
  set_img_url: string | null;
  my_role: CheckRole | null;
  needed: number;
  found: number;
}

/** Row of the `check_lines` view: one inventory line that counts for a check. */
export interface CheckLine {
  check_id: string;
  set_part_id: number;
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

/** Server progress for one line: returned by adjust_part and sent as broadcasts. */
export interface LineProgress {
  set_part_id: number;
  found_qty: number;
  updated_at: string;
}

export interface NewCheck {
  set_num: string;
  title: string;
  include_spares: boolean;
  include_minifigs: boolean;
}

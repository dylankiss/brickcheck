import { HttpError } from "./http.ts";

const BASE_URL = "https://rebrickable.com/api/v3/lego";
// Rebrickable allows roughly one request per second.
const MIN_INTERVAL_MS = 1000;
const MAX_RETRIES = 3;
const MAX_RETRY_WAIT_MS = 5000;
const REQUEST_TIMEOUT_MS = 10_000;
// Free-tier Edge Functions are stopped after 150 s; stop well before that.
const TIME_BUDGET_MS = 110_000;

export interface RbSet {
  set_num: string;
  name: string;
  year: number | null;
  theme_id: number | null;
  num_parts: number | null;
  set_img_url: string | null;
}

export interface RbInventoryPart {
  part: {
    part_num: string;
    name: string;
    part_cat_id: number | null;
    part_img_url: string | null;
    external_ids?: { BrickLink?: string[] };
  };
  color: {
    id: number;
    name: string;
    rgb: string | null;
    is_trans: boolean;
    external_ids?: { BrickLink?: { ext_ids?: number[] } };
  };
  quantity: number;
  is_spare: boolean;
  element_id: string | null;
}

export interface RbInventoryMinifig {
  set_num: string; // fig-XXXXXX
  quantity: number;
}

interface Page<T> {
  next: string | null;
  results: T[];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class Rebrickable {
  private lastRequestAt = 0;
  private readonly deadline = Date.now() + TIME_BUDGET_MS;

  constructor(private readonly apiKey: string) {}

  static fromEnv(): Rebrickable {
    const key = Deno.env.get("REBRICKABLE_API_KEY");
    if (!key) throw new Error("REBRICKABLE_API_KEY is not set");
    return new Rebrickable(key);
  }

  getSet(setNum: string): Promise<RbSet> {
    return this.get(
      `${BASE_URL}/sets/${encodeURIComponent(setNum)}/`,
      "Set not found on Rebrickable",
    );
  }

  // inc_part_details=1 is needed for part.external_ids (BrickLink ids).
  getSetParts(setNum: string): Promise<RbInventoryPart[]> {
    return this.getAll(
      `${BASE_URL}/sets/${encodeURIComponent(setNum)}/parts/?page_size=1000&inc_part_details=1`,
    );
  }

  getSetMinifigs(setNum: string): Promise<RbInventoryMinifig[]> {
    return this.getAll(
      `${BASE_URL}/sets/${encodeURIComponent(setNum)}/minifigs/?page_size=1000`,
    );
  }

  getMinifigParts(figNum: string): Promise<RbInventoryPart[]> {
    return this.getAll(
      `${BASE_URL}/minifigs/${encodeURIComponent(figNum)}/parts/?page_size=1000&inc_part_details=1`,
    );
  }

  private async getAll<T>(url: string): Promise<T[]> {
    const results: T[] = [];
    let next: string | null = url;
    while (next) {
      const page: Page<T> = await this.get(next);
      results.push(...page.results);
      next = page.next;
    }
    return results;
  }

  /** `notFoundMessage` turns a 404 into a 404 for the caller; otherwise it is a 502. */
  private async get<T>(url: string, notFoundMessage?: string): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const wait = this.lastRequestAt + MIN_INTERVAL_MS - Date.now();
      if (wait > 0) await sleep(wait);
      if (Date.now() + REQUEST_TIMEOUT_MS > this.deadline) {
        throw new HttpError(
          503,
          "Importing this set is taking too long, try again in a few minutes",
        );
      }
      this.lastRequestAt = Date.now();

      let res: Response;
      try {
        res = await fetch(url, {
          headers: {
            Authorization: `key ${this.apiKey}`,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (error) {
        console.error(`Rebrickable request failed for ${url}:`, error);
        throw new HttpError(502, "Rebrickable is unavailable, try again later");
      }
      if (res.ok) return (await res.json()) as T;
      if (res.status === 404 && notFoundMessage)
        throw new HttpError(404, notFoundMessage);
      if (res.status === 429 && attempt < MAX_RETRIES) {
        const retryAfter = Number(res.headers.get("Retry-After")) * 1000;
        const backoff =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter
            : 2 ** attempt * 1000;
        await sleep(Math.min(backoff, MAX_RETRY_WAIT_MS));
        continue;
      }
      console.error(
        `Rebrickable ${res.status} for ${url}: ${await res.text()}`,
      );
      throw new HttpError(502, "Rebrickable is unavailable, try again later");
    }
  }
}

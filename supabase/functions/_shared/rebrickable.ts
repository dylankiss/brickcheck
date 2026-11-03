import { HttpError } from "./http.ts";

const BASE_URL = "https://rebrickable.com/api/v3/lego";
// Rebrickable allows roughly one request per second.
const MIN_INTERVAL_MS = 1000;
const MAX_RETRIES = 4;

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

  constructor(private readonly apiKey: string) {}

  static fromEnv(): Rebrickable {
    const key = Deno.env.get("REBRICKABLE_API_KEY");
    if (!key) throw new Error("REBRICKABLE_API_KEY is not set");
    return new Rebrickable(key);
  }

  getSet(setNum: string): Promise<RbSet> {
    return this.get(`${BASE_URL}/sets/${encodeURIComponent(setNum)}/`);
  }

  getSetParts(setNum: string): Promise<RbInventoryPart[]> {
    return this.getAll(
      `${BASE_URL}/sets/${encodeURIComponent(setNum)}/parts/?page_size=1000`,
    );
  }

  getSetMinifigs(setNum: string): Promise<RbInventoryMinifig[]> {
    return this.getAll(
      `${BASE_URL}/sets/${encodeURIComponent(setNum)}/minifigs/?page_size=1000`,
    );
  }

  getMinifigParts(figNum: string): Promise<RbInventoryPart[]> {
    return this.getAll(
      `${BASE_URL}/minifigs/${encodeURIComponent(figNum)}/parts/?page_size=1000`,
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

  private async get<T>(url: string): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const wait = this.lastRequestAt + MIN_INTERVAL_MS - Date.now();
      if (wait > 0) await sleep(wait);
      this.lastRequestAt = Date.now();

      const res = await fetch(url, {
        headers: {
          Authorization: `key ${this.apiKey}`,
          Accept: "application/json",
        },
      });
      if (res.ok) return (await res.json()) as T;
      if (res.status === 404)
        throw new HttpError(404, "Set not found on Rebrickable");
      if (res.status === 429 && attempt < MAX_RETRIES) {
        const retryAfter = Number(res.headers.get("Retry-After"));
        await sleep(
          Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : 2 ** attempt * 1000,
        );
        continue;
      }
      console.error(
        `Rebrickable ${res.status} for ${url}: ${await res.text()}`,
      );
      throw new HttpError(502, "Rebrickable is unavailable, try again later");
    }
  }
}

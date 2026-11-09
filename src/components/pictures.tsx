import type { ReactNode } from "react";
import { partLabel, partNumber, type Part } from "../lib/parts";
import type { Translate } from "../lib/i18n";
import type { CatalogSet, SetSummary } from "../lib/types";
import { ColorSwatch } from "./ui";

/** What an enlarged picture shows: the picture, its accessible name, and a heading. */
export interface Picture {
  /** Identifies the picture, so switching to another starts fitted. */
  key: string;
  src: string | null;
  label: string;
  title: string;
  detail?: ReactNode;
}

export const partPicture = (part: Part, t: Translate): Picture => ({
  key: `part:${part.key}`,
  src: part.img_url,
  label: partLabel(part),
  title: part.part_name,
  detail: (
    <>
      <ColorSwatch
        rgb={part.color_rgb}
        trans={part.is_trans}
        className="size-3"
      />
      <span className="truncate">
        {t("set.picture.partDetail", {
          color: part.color_name,
          number: partNumber(part),
          found: part.found,
          needed: part.needed,
        })}
      </span>
    </>
  ),
});

export const catalogSetPicture = (
  catalogSet: Pick<CatalogSet, "set_num" | "name" | "year" | "img_url">,
): Picture => ({
  key: `catalog:${catalogSet.set_num}`,
  src: catalogSet.img_url,
  label: catalogSet.name,
  title: catalogSet.name,
  detail: (
    <span className="truncate">
      {[catalogSet.set_num, catalogSet.year].filter(Boolean).join(" · ")}
    </span>
  ),
});

export const setPicture = (
  set: Pick<
    SetSummary,
    "id" | "title" | "set_num" | "catalog_name" | "catalog_img_url"
  >,
): Picture => ({
  key: `set:${set.id}`,
  src: set.catalog_img_url,
  label: set.title,
  title: set.title,
  detail: (
    <span className="truncate">
      {set.title === set.catalog_name
        ? set.set_num
        : `${set.set_num} · ${set.catalog_name}`}
    </span>
  ),
});

import { useMemo, useState } from "react";
import {
  EnlargeableThumbnail,
  EnlargedPart,
} from "../components/EnlargedPicture";
import { Button, ColorSwatch, Header } from "../components/ui";
import { useLanguage } from "../hooks/useLanguage";
import { useSetContext } from "../hooks/useSetContext";
import {
  missingParts,
  partLabel,
  toBrickLinkXml,
  toRebrickableCsv,
  type Part,
} from "../lib/parts";

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Missing() {
  const { t } = useLanguage();
  const { setId, summary: set, parts } = useSetContext();
  const summary = set!;
  const missing = useMemo(() => missingParts(parts), [parts]);
  const bricklink = useMemo(() => toBrickLinkXml(missing), [missing]);
  const total = missing.reduce((sum, m) => sum + m.missing, 0);
  const [enlarged, setEnlarged] = useState<string | null>(null);

  const base = `${summary.set_num}-missing`;
  return (
    <>
      <Header
        title={t("set.missing.title", { title: summary.title })}
        back={`/sets/${setId}`}
      />
      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
        {missing.length === 0 ? (
          <p className="py-12 text-center text-lg">
            {t("set.missing.complete")}
          </p>
        ) : (
          <>
            <p className="text-neutral-500 dark:text-neutral-400">
              {t("set.missing.summary", {
                pieces: t("set.count.pieces", { count: total }),
                parts: t("set.count.parts", { count: missing.length }),
              })}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() =>
                  download(`${base}.csv`, toRebrickableCsv(missing), "text/csv")
                }
              >
                {t("set.missing.csv")}
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  download(`${base}.xml`, bricklink.xml, "application/xml")
                }
              >
                {t("set.missing.bricklink")}
              </Button>
            </div>
            {bricklink.skipped.length > 0 && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {t("set.missing.skipped", { count: bricklink.skipped.length })}
              </p>
            )}
            <ul className="flex flex-col gap-2">
              {missing.map(({ part, missing: qty }) => (
                <MissingItem
                  key={part.key}
                  part={part}
                  missing={qty}
                  onEnlarge={setEnlarged}
                />
              ))}
            </ul>
          </>
        )}
      </main>
      <EnlargedPart
        part={parts.find((p) => p.key === enlarged) ?? null}
        onClose={() => setEnlarged(null)}
      />
    </>
  );
}

/** One missing Part; its picture enlarges on tap. */
function MissingItem({
  part,
  missing,
  onEnlarge,
}: {
  part: Part;
  missing: number;
  onEnlarge: (key: string) => void;
}) {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-white p-2 ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
      <EnlargeableThumbnail
        src={part.img_url}
        label={partLabel(part)}
        onEnlarge={() => onEnlarge(part.key)}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{part.part_name}</p>
        <p className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          <ColorSwatch
            rgb={part.color_rgb}
            trans={part.is_trans}
            className="size-3"
          />
          {part.color_name} · {part.part_num}
        </p>
      </div>
      <span className="text-lg font-bold tabular-nums">×{missing}</span>
    </li>
  );
}

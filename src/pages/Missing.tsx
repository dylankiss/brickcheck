import { useMemo, useState } from "react";
import { EnlargedPart, MagnifierBadge } from "../components/EnlargedPart";
import { Button, ColorSwatch, Header, PartImage } from "../components/ui";
import { useCheckContext } from "../hooks/useCheckContext";
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
  const { checkId, summary: check, parts } = useCheckContext();
  const summary = check!;
  const missing = useMemo(() => missingParts(parts), [parts]);
  const bricklink = useMemo(() => toBrickLinkXml(missing), [missing]);
  const total = missing.reduce((sum, m) => sum + m.missing, 0);
  const [enlarged, setEnlarged] = useState<string | null>(null);

  const base = `${summary.set_num}-missing`;
  return (
    <>
      <Header
        title={`Missing · ${summary.title}`}
        back={`/checks/${checkId}`}
      />
      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
        {missing.length === 0 ? (
          <p className="py-12 text-center text-lg">
            Nothing is missing. This check is complete! 🎉
          </p>
        ) : (
          <>
            <p className="text-neutral-500">
              {total} {total === 1 ? "piece" : "pieces"} in {missing.length}{" "}
              {missing.length === 1 ? "part" : "parts"} still to find.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() =>
                  download(`${base}.csv`, toRebrickableCsv(missing), "text/csv")
                }
              >
                Rebrickable CSV
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  download(`${base}.xml`, bricklink.xml, "application/xml")
                }
              >
                BrickLink wanted list
              </Button>
            </div>
            {bricklink.skipped.length > 0 && (
              <p className="text-xs text-neutral-500">
                {bricklink.skipped.length} part(s) have no BrickLink id and are
                left out of the BrickLink file.
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
  const [noPicture, setNoPicture] = useState(!part.img_url);
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-white p-2 ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
      <button
        type="button"
        onClick={() => onEnlarge(part.key)}
        disabled={noPicture}
        className="relative shrink-0 rounded-lg"
        aria-label={`Enlarge picture of ${partLabel(part)}`}
      >
        <PartImage
          src={part.img_url}
          alt=""
          onError={() => setNoPicture(true)}
          className="size-14"
        />
        {!noPicture && (
          <span className="absolute -right-1 -bottom-1 scale-75">
            <MagnifierBadge />
          </span>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{part.part_name}</p>
        <p className="flex items-center gap-1.5 text-xs text-neutral-500">
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

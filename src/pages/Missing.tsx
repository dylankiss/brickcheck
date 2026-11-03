import { useMemo } from "react";
import { Button, ColorSwatch, Header, PartImage } from "../components/ui";
import { useCheckContext } from "../hooks/useCheckContext";
import { missingParts, toBrickLinkXml, toRebrickableCsv } from "../lib/tiles";

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Missing() {
  const { checkId, summary: check, tiles } = useCheckContext();
  const summary = check!;
  const missing = useMemo(() => missingParts(tiles), [tiles]);
  const bricklink = useMemo(() => toBrickLinkXml(missing), [missing]);
  const total = missing.reduce((sum, m) => sum + m.missing, 0);

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
              {missing.map(({ tile, missing: qty }) => (
                <li
                  key={tile.key}
                  className="flex items-center gap-3 rounded-2xl bg-white p-2 ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800"
                >
                  <PartImage
                    src={tile.img_url}
                    alt=""
                    className="size-14 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {tile.part_name}
                    </p>
                    <p className="flex items-center gap-1.5 text-xs text-neutral-500">
                      <ColorSwatch
                        rgb={tile.color_rgb}
                        trans={tile.is_trans}
                        className="size-3"
                      />
                      {tile.color_name} · {tile.part_num}
                    </p>
                  </div>
                  <span className="text-lg font-bold tabular-nums">×{qty}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </>
  );
}

import { Link } from "react-router";
import { Avatar } from "../components/Avatar";
import { ThemeButton } from "../components/ThemeButton";
import { Header } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { useGroups } from "../hooks/useGroups";
import { useLanguage } from "../hooks/useLanguage";
import { useMySets } from "../hooks/useMySets";
import { isComplete } from "../lib/parts";

/** The start screen: three ways in, each with a one-line status. */
export default function Home() {
  const { t } = useLanguage();
  const { session, profile } = useAuth();
  const { sets } = useMySets();
  const { groups } = useGroups(session?.user.id ?? "");

  const incomplete = sets?.filter((s) => !isComplete(s)) ?? [];
  const missing = incomplete.reduce((n, s) => n + (s.needed - s.found), 0);

  const setsStatus = !sets
    ? ""
    : sets.length === 0
      ? t("sets.home.noSets")
      : incomplete.length === 0
        ? t("sets.home.allComplete", {
            sets: t("sets.count", { count: sets.length }),
          })
        : t("sets.home.someIncomplete", {
            sets: t("sets.count", { count: sets.length }),
            count: incomplete.length,
          });
  const groupsStatus = !groups
    ? ""
    : groups.length === 0
      ? t("sets.home.noGroups")
      : t("sets.groupCount", { count: groups.length });
  const piecesStatus = !sets
    ? ""
    : missing === 0
      ? t("sets.home.nothingMissing")
      : t("sets.home.missing", {
          count: missing,
          sets: t("sets.count", { count: incomplete.length }),
        });

  return (
    <>
      <Header title="BrickCheck">
        <div className="absolute top-[calc(env(safe-area-inset-top)+0.375rem)] right-2 flex items-center">
          <ThemeButton />
          <Link
            to="/account"
            className="flex min-h-11 min-w-11 items-center justify-center"
            aria-label={t("account.title")}
          >
            <Avatar
              name={profile?.display_name ?? null}
              url={profile?.avatar_url}
              size="size-8"
            />
          </Link>
        </div>
      </Header>
      <main className="mx-auto flex max-w-2xl flex-col gap-3 p-4">
        <HomeCard
          to="/sets"
          title={t("sets.home.mySets")}
          status={setsStatus}
        />
        <HomeCard
          to="/groups"
          title={t("sets.home.groups")}
          status={groupsStatus}
        />
        <HomeCard
          to="/missing"
          title={t("sets.home.missingCard")}
          status={piecesStatus}
        />
      </main>
    </>
  );
}

function HomeCard({
  to,
  title,
  status,
}: {
  to: string;
  title: string;
  status: string;
}) {
  return (
    <Link
      to={to}
      className="flex min-h-20 items-center justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-neutral-200 active:bg-neutral-100 dark:bg-neutral-900 dark:ring-neutral-800 dark:active:bg-neutral-800"
    >
      <div className="min-w-0">
        <p className="text-lg font-semibold">{title}</p>
        <p
          role="status"
          className="min-h-5 text-sm text-neutral-500 dark:text-neutral-400"
        >
          {status}
        </p>
      </div>
      <span aria-hidden className="text-2xl text-neutral-400">
        ›
      </span>
    </Link>
  );
}

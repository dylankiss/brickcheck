import { Outlet, useParams } from "react-router";
import { ErrorBanner, Header, Spinner } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { useLanguage } from "../hooks/useLanguage";
import { useSet } from "../hooks/useSet";
import { SetContext } from "../hooks/useSetContext";

/** Owns the one live connection per set; child routes read it via useSetContext. */
export default function SetLayoutRoute() {
  const { setId = "" } = useParams();
  return <SetLayout key={setId} setId={setId} />;
}

function SetLayout({ setId }: { setId: string }) {
  const { session } = useAuth();
  const { t } = useLanguage();
  const set = useSet(setId, session!.user.id);

  if (set.status === "loading") {
    return <Spinner label={t("set.loading")} />;
  }
  if (set.status === "not-found") {
    return (
      <>
        <Header title={t("set.notFound.title")} back="/sets" />
        <p className="p-8 text-center text-neutral-500 dark:text-neutral-400">
          {t("set.notFound.text")}
        </p>
      </>
    );
  }
  if (set.status === "error" || !set.summary) {
    return (
      <>
        <Header title="BrickCheck" back="/sets" />
        <ErrorBanner message={set.error ?? t("set.loadError")} />
      </>
    );
  }
  return (
    <SetContext.Provider value={set}>
      <Outlet />
    </SetContext.Provider>
  );
}

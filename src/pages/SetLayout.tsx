import { Outlet, useParams } from "react-router";
import { ErrorBanner, Header, Spinner } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { useSet } from "../hooks/useSet";
import { SetContext } from "../hooks/useSetContext";

/** Owns the one live connection per set; child routes read it via useSetContext. */
export default function SetLayoutRoute() {
  const { setId = "" } = useParams();
  return <SetLayout key={setId} setId={setId} />;
}

function SetLayout({ setId }: { setId: string }) {
  const { session } = useAuth();
  const set = useSet(setId, session!.user.id);

  if (set.status === "loading") {
    return <Spinner label="Loading parts…" />;
  }
  if (set.status === "not-found") {
    return (
      <>
        <Header title="Set not found" back="/" />
        <p className="p-8 text-center text-neutral-500 dark:text-neutral-400">
          This set doesn't exist or isn't shared with you.
        </p>
      </>
    );
  }
  if (set.status === "error" || !set.summary) {
    return (
      <>
        <Header title="BrickCheck" back="/" />
        <ErrorBanner message={set.error ?? "Could not load this set"} />
      </>
    );
  }
  return (
    <SetContext.Provider value={set}>
      <Outlet />
    </SetContext.Provider>
  );
}

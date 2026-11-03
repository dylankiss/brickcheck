import { useMemo } from "react";
import { Outlet, useParams } from "react-router";
import { ErrorBanner, Header, Spinner } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { useCheck } from "../hooks/useCheck";
import { CheckContext } from "../hooks/useCheckContext";

/** Owns the one live connection per check; child routes read it via useCheckContext. */
export default function CheckLayoutRoute() {
  const { checkId = "" } = useParams();
  return <CheckLayout key={checkId} checkId={checkId} />;
}

function CheckLayout({ checkId }: { checkId: string }) {
  const { session, profile } = useAuth();
  const userId = session!.user.id;
  const name = profile?.display_name ?? null;
  const me = useMemo(() => ({ user_id: userId, name }), [userId, name]);
  const check = useCheck(checkId, me);

  if (check.status === "loading") return <Spinner label="Loading parts…" />;
  if (check.status === "not-found") {
    return (
      <>
        <Header title="Check not found" back="/" />
        <p className="p-8 text-center text-neutral-500">
          This check doesn't exist or isn't shared with you.
        </p>
      </>
    );
  }
  if (check.status === "error" || !check.summary) {
    return (
      <>
        <Header title="BrickCheck" back="/" />
        <ErrorBanner message={check.error ?? "Could not load this check"} />
      </>
    );
  }
  return (
    <CheckContext.Provider value={check}>
      <Outlet />
    </CheckContext.Provider>
  );
}

import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { Button, ErrorBanner, Header, Spinner } from "../components/ui";
import { useGroupInvite } from "../hooks/useGroupInvite";

const roleText = { helper: "tick off parts", viewer: "follow along" } as const;

export default function JoinGroup() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const { preview, error, retry, accept } = useGroupInvite(token);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  if (preview === undefined) {
    return <Spinner />;
  }
  if (preview?.already_member) {
    return <Navigate to="/groups" replace />;
  }

  async function join() {
    setJoining(true);
    try {
      await accept();
      navigate("/groups", { replace: true });
    } catch (e) {
      setJoinError((e as Error).message);
      setJoining(false);
    }
  }

  return (
    <>
      <Header title="Join a group" back="/" />
      {joinError && <ErrorBanner message={joinError} />}
      <main className="mx-auto flex max-w-sm flex-col gap-4 p-4">
        {error ? (
          <div role="alert" className="flex flex-col items-center gap-3 py-12">
            <p className="text-center text-neutral-500 dark:text-neutral-400">
              Could not check this invite link: {error}
            </p>
            <Button onClick={retry}>Try again</Button>
          </div>
        ) : preview ? (
          <>
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-4 text-center ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
              <p className="text-lg font-semibold">{preview.group_name}</p>
              <p>
                {preview.invited_by || "Someone"} invited you to join this group
                and {roleText[preview.role]} on all its sets.
              </p>
            </div>
            <Button onClick={join} disabled={joining}>
              {joining ? "Joining…" : "Join"}
            </Button>
          </>
        ) : (
          <p className="py-12 text-center text-neutral-500 dark:text-neutral-400">
            This invite link is invalid or has expired. Ask for a new one.
          </p>
        )}
      </main>
    </>
  );
}

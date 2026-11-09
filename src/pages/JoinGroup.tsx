import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { Button, ErrorBanner, Header, Spinner } from "../components/ui";
import { useGroupInvite } from "../hooks/useGroupInvite";
import { useLanguage } from "../hooks/useLanguage";

export default function JoinGroup() {
  const { t } = useLanguage();
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
      <Header title={t("sets.joinGroup.title")} back="/" />
      {joinError && <ErrorBanner message={joinError} />}
      <main className="mx-auto flex max-w-sm flex-col gap-4 p-4">
        {error ? (
          <div role="alert" className="flex flex-col items-center gap-3 py-12">
            <p className="text-center text-neutral-500 dark:text-neutral-400">
              {t("sets.joinGroup.checkFailed", { error })}
            </p>
            <Button onClick={retry}>{t("common.tryAgain")}</Button>
          </div>
        ) : preview ? (
          <>
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-4 text-center ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
              <p className="text-lg font-semibold">{preview.group_name}</p>
              <p>
                {t("sets.joinGroup.invited", {
                  name: preview.invited_by || t("sets.join.someone"),
                  role: t(`sets.join.role.${preview.role}`),
                })}
              </p>
            </div>
            <Button onClick={join} disabled={joining}>
              {joining ? t("sets.join.joining") : t("sets.join.button")}
            </Button>
          </>
        ) : (
          <p className="py-12 text-center text-neutral-500 dark:text-neutral-400">
            {t("sets.join.invalid")}
          </p>
        )}
      </main>
    </>
  );
}

import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import {
  EnlargeableThumbnail,
  EnlargedPicture,
} from "../components/EnlargedPicture";
import { setPicture } from "../components/pictures";
import { Button, ErrorBanner, Header, Spinner } from "../components/ui";
import { useInvite } from "../hooks/useInvite";

const roleText = { helper: "tick off parts", viewer: "follow along" } as const;

export default function Join() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const { preview, error, accept } = useInvite(token);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [enlarged, setEnlarged] = useState(false);

  if (preview === undefined) {
    return <Spinner />;
  }
  if (preview?.already_member) {
    return <Navigate to={`/sets/${preview.set_id}`} replace />;
  }

  async function join() {
    setJoining(true);
    try {
      navigate(`/sets/${await accept()}`, { replace: true });
    } catch (e) {
      setJoinError((e as Error).message);
      setJoining(false);
    }
  }

  return (
    <>
      <Header title="Join a set" back="/" />
      {(error || joinError) && <ErrorBanner message={(error || joinError)!} />}
      <main className="mx-auto flex max-w-sm flex-col gap-4 p-4">
        {preview ? (
          <>
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-4 text-center ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
              <EnlargeableThumbnail
                src={preview.catalog_img_url}
                label={preview.set_title}
                onEnlarge={() => setEnlarged(true)}
                className="h-32 w-48 rounded-lg bg-white"
              />
              <p className="text-lg font-semibold">{preview.set_title}</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {preview.set_num} · {preview.catalog_name}
              </p>
              <p>
                {preview.invited_by || "Someone"} invited you to{" "}
                {roleText[preview.role]}.
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
      <EnlargedPicture
        picture={
          enlarged && preview
            ? setPicture({
                id: preview.set_id,
                title: preview.set_title,
                set_num: preview.set_num,
                catalog_name: preview.catalog_name,
                catalog_img_url: preview.catalog_img_url,
              })
            : null
        }
        onClose={() => setEnlarged(false)}
      />
    </>
  );
}

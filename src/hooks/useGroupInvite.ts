import { useEffect, useState } from "react";
import { acceptGroupInvite, getGroupInvitePreview } from "../lib/api";
import type { GroupInvitePreview } from "../lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Preview of a Group invite link, and accepting it. A malformed token is simply "invalid". */
export function useGroupInvite(token: string) {
  const valid = UUID.test(token);
  const [preview, setPreview] = useState<GroupInvitePreview | null | undefined>(
    valid ? undefined : null,
  );
  // Set when the preview could not be fetched (not the same as "not found").
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!valid) {
      return;
    }
    let current = true;
    getGroupInvitePreview(token).then(
      (p) => current && setPreview(p),
      (e: Error) => current && (setPreview(null), setError(e.message)),
    );
    return () => {
      current = false;
    };
  }, [token, valid, attempt]);

  function retry() {
    setError(null);
    setPreview(undefined);
    setAttempt((n) => n + 1);
  }

  return { preview, error, retry, accept: () => acceptGroupInvite(token) };
}

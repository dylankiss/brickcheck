import { useEffect, useState } from "react";
import { acceptInvite, getInvitePreview } from "../lib/api";
import type { InvitePreview } from "../lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Preview of an invite link, and accepting it. A malformed token is simply "invalid". */
export function useInvite(token: string) {
  const valid = UUID.test(token);
  const [preview, setPreview] = useState<InvitePreview | null | undefined>(
    valid ? undefined : null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!valid) return;
    let current = true;
    getInvitePreview(token).then(
      (p) => current && setPreview(p),
      (e: Error) => current && (setPreview(null), setError(e.message)),
    );
    return () => {
      current = false;
    };
  }, [token, valid]);

  return { preview, error, accept: () => acceptInvite(token) };
}

import { useEffect, useState } from "react";
import { acceptInvite, getInvitePreview } from "../lib/api";
import type { InvitePreview } from "../lib/types";

/** Preview of an invite link, and accepting it. */
export function useInvite(token: string) {
  const [preview, setPreview] = useState<InvitePreview | null | undefined>(
    undefined,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    getInvitePreview(token).then(
      (p) => current && setPreview(p),
      (e: Error) => current && (setPreview(null), setError(e.message)),
    );
    return () => {
      current = false;
    };
  }, [token]);

  return { preview, error, accept: () => acceptInvite(token) };
}

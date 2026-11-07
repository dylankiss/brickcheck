import { useCallback, useEffect, useState } from "react";
import { deletePasskey, listPasskeys, registerPasskey } from "../lib/api";
import type { Passkey } from "../lib/types";

/** The signed-in user's passkeys, with adding and removing them. */
export function usePasskeys() {
  const [passkeys, setPasskeys] = useState<Passkey[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(
    () =>
      listPasskeys().then(
        (list) => {
          setPasskeys(list);
          setError(null);
        },
        (e: Error) => setError(e.message),
      ),
    [],
  );

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- refresh only sets state after awaiting the fetch
    refresh();
  }, [refresh]);

  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      setBusy(true);
      setError(null);
      try {
        await action();
        await refresh();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const add = useCallback(() => run(registerPasskey), [run]);
  const remove = useCallback(
    (id: string) => run(() => deletePasskey(id)),
    [run],
  );

  return { passkeys, error, busy, add, remove };
}

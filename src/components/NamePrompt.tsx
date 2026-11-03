import { useState, type FormEvent } from "react";
import { useAuth } from "../hooks/useAuth";
import { Button } from "./ui";

/** Asks users without a name (email logins) what others should see; shown once, app-wide. */
export function NamePrompt() {
  const { updateName } = useAuth();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await updateName(name.trim());
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form
      onSubmit={save}
      className="mx-auto mt-[20vh] flex max-w-sm flex-col gap-3 p-4"
    >
      <label htmlFor="display-name" className="text-lg font-semibold">
        What name should people you check with see?
      </label>
      <div className="flex gap-2">
        <input
          id="display-name"
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="min-h-11 min-w-0 flex-1 rounded-xl bg-white px-3 ring-1 ring-neutral-300 dark:bg-neutral-900 dark:ring-neutral-700"
        />
        <Button type="submit" disabled={!name.trim()}>
          Save
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}

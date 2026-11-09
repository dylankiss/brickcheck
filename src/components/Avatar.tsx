import { useLanguage } from "../hooks/useLanguage";

const PALETTE = [
  // Dark enough for white initials (WCAG 2.2 AA, 4.5:1).
  "bg-red-600",
  "bg-blue-600",
  "bg-yellow-700",
  "bg-green-700",
  "bg-orange-700",
  "bg-purple-600",
];

function initials(name: string | null): string {
  if (!name) {
    return "?";
  }
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

function colorFor(name: string | null): string {
  let hash = 0;
  for (const char of name ?? "") {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length]!;
}

export function Avatar({
  name,
  url,
  online,
  size = "size-9",
}: {
  name: string | null;
  url?: string | null;
  online?: boolean;
  size?: string;
}) {
  const { t } = useLanguage();
  return (
    <span
      className={`relative inline-flex shrink-0 ${size}`}
      title={name ?? undefined}
    >
      {url ? (
        <img
          src={url}
          alt=""
          referrerPolicy="no-referrer"
          className="size-full rounded-full object-cover"
        />
      ) : (
        <span
          className={`flex size-full items-center justify-center rounded-full text-xs font-bold text-white ${colorFor(name)}`}
        >
          {initials(name)}
        </span>
      )}
      {online && (
        <span
          className="absolute right-0 bottom-0 size-2.5 rounded-full bg-green-500 ring-2 ring-white dark:ring-neutral-900"
          aria-label={t("common.online")}
        />
      )}
    </span>
  );
}

/** Overlapping avatars of the people who have the set open. */
export function OnlineAvatars({
  people,
}: {
  people: {
    user_id: string;
    display_name: string | null;
    avatar_url: string | null;
  }[];
}) {
  const { t } = useLanguage();
  if (people.length === 0) {
    return null;
  }
  return (
    <div
      className="flex -space-x-2"
      aria-label={t("common.onlineCount", { count: people.length })}
    >
      {people.slice(0, 4).map((p) => (
        <span
          key={p.user_id}
          className="rounded-full ring-2 ring-neutral-50 dark:ring-neutral-950"
        >
          <Avatar name={p.display_name} url={p.avatar_url} size="size-8" />
        </span>
      ))}
      {people.length > 4 && (
        <span className="flex size-8 items-center justify-center rounded-full bg-neutral-300 text-xs font-bold ring-2 ring-neutral-50 dark:bg-neutral-700 dark:ring-neutral-950">
          +{people.length - 4}
        </span>
      )}
    </div>
  );
}

import { useLanguage } from "../hooks/useLanguage";
import {
  AVATAR_COLORS,
  AVATAR_ICONS,
  DEFAULT_AVATAR,
  avatarChoice,
  composeAvatar,
  type AvatarParts,
} from "../lib/avatars";
import { Avatar } from "./Avatar";

const RING_ON =
  "ring-2 ring-neutral-900 ring-offset-2 dark:ring-white dark:ring-offset-neutral-950";

/**
 * Pick an icon and a background colour. Every tap saves. Each button shows the
 * avatar as it would look with that choice; a ring marks the current one. The
 * 44px buttons are the touch targets.
 */
export function AvatarPicker({
  value,
  onChange,
  busy,
}: {
  value: string | null;
  onChange: (avatar: string | null) => void;
  busy: boolean;
}) {
  const { t } = useLanguage();
  const current = avatarChoice(value);
  const parts: AvatarParts = current ?? DEFAULT_AVATAR;

  function row<K extends keyof AvatarParts>(
    key: K,
    heading: string,
    options: readonly { id: AvatarParts[K]; label: string }[],
  ) {
    return (
      <div className="flex flex-col gap-1.5">
        <h3 className="text-sm font-medium">{heading}</h3>
        <div role="group" aria-label={heading} className="flex flex-wrap gap-2">
          {options.map((option) => {
            const selected = current !== null && parts[key] === option.id;
            return (
              <button
                key={option.id}
                type="button"
                disabled={busy}
                onClick={() =>
                  onChange(composeAvatar({ ...parts, [key]: option.id }))
                }
                aria-pressed={selected}
                aria-label={option.label}
                className={`flex size-11 items-center justify-center rounded-full disabled:opacity-50 ${
                  selected ? RING_ON : ""
                }`}
              >
                <Avatar
                  name={null}
                  avatar={composeAvatar({ ...parts, [key]: option.id })}
                  size="size-9"
                />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold">{t("account.avatar.label")}</h2>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        {t("account.avatar.hint")}
      </p>
      {row(
        "icon",
        t("account.avatar.iconLabel"),
        AVATAR_ICONS.map(({ id }) => ({
          id,
          label: t(`account.avatar.icon.${id}`),
        })),
      )}
      {row(
        "color",
        t("account.avatar.colorLabel"),
        AVATAR_COLORS.map(({ id }) => ({
          id,
          label: t(`account.avatar.color.${id}`),
        })),
      )}
      {current && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onChange(null)}
          className="min-h-11 self-start rounded-xl px-1 text-sm font-semibold underline disabled:opacity-50"
        >
          {t("account.avatar.default")}
        </button>
      )}
    </section>
  );
}

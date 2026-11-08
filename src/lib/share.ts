/** Shares a link with the system share sheet, or copies it when that is unavailable. */
export async function shareLink(
  url: string,
  title: string,
  text: string,
): Promise<"shared" | "copied"> {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return "shared";
    } catch {
      // Cancelled or unavailable: fall back to copying.
    }
  }
  await navigator.clipboard.writeText(url);
  return "copied";
}

// Applies the saved theme before the first paint; src/lib/theme.ts takes over after.
// Loaded by a blocking script in index.html (a file, so the Content-Security-Policy
// needs no exception for inline scripts). public/ is not formatted by Prettier.
(function () {
  var theme;
  try {
    theme = localStorage.getItem("theme");
  } catch {
    // Storage can be blocked (private mode); fall back to the system setting.
  }
  if (
    theme === "dark" ||
    (theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches)
  ) {
    document.documentElement.classList.add("dark");
  }
})();

# Steam License Remover

A browser console script (also installable as a Tampermonkey/Greasemonkey userscript) that helps you clean up your Steam account's license list — reviewing and removing free games, complimentary DLC, and other licenses you no longer want, safely and interactively.

> ⚠️ **Disclaimer:** This script only automates the "Remove" buttons already present on Steam's own [Account Licenses](https://store.steampowered.com/account/licenses/) page. It does not bypass any Steam restriction, remove paid games, or touch any private/internal API. It is not affiliated with or endorsed by Valve Corporation. Use at your own risk.

## Features

- 🔍 **Scans** your licenses page and finds every license with a Remove button.
- 🧹 **Auto-filters** license types Steam won't actually let you remove (e.g. "Free Weekend" promos, Demos) so you're not shown things that will just error out.
- 📋 **Prints a clear table** of every removable candidate — package ID, app ID, and title — before anything happens.
- ⌨️ **Single interactive prompt** — paste the package ID(s) or app ID(s) of anything you want to *keep*, comma-separated, or leave it blank to remove everything listed. Cancel aborts entirely.
- ✅ **Explicit confirmation** — after you submit, it prints exactly what got excluded, plus a warning if any ID you typed didn't match anything (typo protection), so you're never just inferring from a shrinking counter.
- 🐢 **Rate-limit friendly** — removes one license every 6 minutes with a live countdown, since Steam appears to temporarily throttle rapid removals.
- 📊 **Summary report** at the end: total found, auto-skipped, excluded, removed, failed.

## How to use

1. Go to [https://store.steampowered.com/account/licenses/](https://store.steampowered.com/account/licenses/) and make sure you're logged in.
2. Open your browser's DevTools console (`Ctrl+Shift+I` / `Cmd+Option+I` → **Console** tab).
3. Paste the contents of [`steam-license-remover.user.js`](./steam-license-remover.user.js) and press Enter.
4. Review the table of removal candidates that gets printed.
5. When the prompt appears, either:
   - Leave it blank and click **OK** to remove everything listed, or
   - Paste the package ID(s)/app ID(s) of anything you want to keep, comma-separated (e.g. `2448340, 17801`), or
   - Click **Cancel** to abort without removing anything.
6. The script confirms exactly what's excluded, then removes one license every 6 minutes, logging progress as it goes.

### Installing as a userscript (Tampermonkey / Greasemonkey)

The file includes a `==UserScript==` metadata block, so it can be installed directly instead of pasted each time:

1. Install [Tampermonkey](https://www.tampermonkey.net/) (or Greasemonkey).
2. Create a new script and paste the contents of `steam-license-remover.user.js`.
3. Save. Visiting your licenses page will now offer to run it — you still get the interactive prompt before anything is removed.

## Why the 6-minute delay?

Removing licenses in quick succession appears to trigger a temporary rate limit from Steam. A 6-minute gap between removals has proven reliable in testing.

## Credits

Made by **Yeshith_Goud** (Steam) / **[Yeshith](https://github.com/Yeshith)** (GitHub)

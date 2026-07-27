// ==UserScript==
// @name         Steam License Remover
// @namespace    https://github.com/Yeshith
// @version      5.0
// @description  Interactively review and remove free Steam licenses. Auto-filters
//               license types Steam won't actually let you remove (Free Weekend,
//               Demo), gives explicit confirmation of what's excluded, and removes
//               the rest one at a time with a live countdown between each.
// @author       Yeshith_Goud (Steam) / Yeshith (GitHub)
// @match        https://store.steampowered.com/account/licenses/
// ==/UserScript==

(async function () {
    'use strict';

    // ============================================================
    // CONFIGURATION
    // ============================================================

    // Delay between removals. Steam appears to rate-limit bursts of
    // removals, so this defaults to 6 minutes.
    const DELAY_MS = 6 * 60 * 1000;

    // Licenses whose title matches any of these patterns are skipped
    // automatically and never shown as candidates — Steam returns an
    // error if you try to remove these regardless of permission.
    // Found another unremovable type? Add a regex here.
    const AUTO_SKIP_PATTERNS = [
        /free weekend/i,
        /\bdemo\b/i
    ];

    // ============================================================
    // LOGGING / DISPLAY HELPERS
    // ============================================================

    const STYLE = {
        info:    'color:#3498db;font-weight:bold;',
        success: 'color:#2ecc71;font-weight:bold;',
        error:   'color:#e74c3c;font-weight:bold;',
        warn:    'color:#f1c40f;font-weight:bold;',
        header:  'color:#9b59b6;font-weight:bold;font-size:13px;'
    };

    const ts = () => new Date().toLocaleTimeString();
    const log = (type, msg) => console.log(`%c[${ts()}] ${msg}`, STYLE[type] || '');
    const section = (title) => console.log(`%c\n── ${title} ──`, STYLE.header);

    function banner() {
        console.log(
            '%c' +
            '╔══════════════════════════════════════════╗\n' +
            '║          STEAM LICENSE REMOVER            ║\n' +
            '║ ────────────────────────────────────────  ║\n' +
            '║  by Yeshith_Goud (Steam) · Yeshith (GH)   ║\n' +
            '╚══════════════════════════════════════════╝',
            'color:#66c0f4;font-weight:bold;font-size:13px;line-height:1.4;'
        );
    }

    function progressBar(current, total, width = 20) {
        const filled = Math.round((current / total) * width);
        return '█'.repeat(filled) + '░'.repeat(width - filled);
    }

    // ============================================================
    // DOM EXTRACTION (no row-index reliance)
    // ============================================================

    function extractPackageId(href) {
        const match = href.match(/RemoveFreeLicense\(\s*(\d+)\s*,/);
        return match ? match[1] : null;
    }

    // Steam app-store links inside the row (store.steampowered.com/app/<id>/...).
    // A single row can contain more than one (bundles).
    function extractAppIds(row) {
        const ids = new Set();
        row.querySelectorAll('a[href*="/app/"]').forEach(a => {
            const match = a.getAttribute('href').match(/\/app\/(\d+)/);
            if (match) ids.add(match[1]);
        });
        return Array.from(ids);
    }

    // Only the Remove link itself is stripped before reading text —
    // other links (e.g. the game title linking to its store page)
    // are kept so their text isn't lost.
    function extractTitle(row) {
        const clone = row.cloneNode(true);
        clone.querySelectorAll('a[href^="javascript:RemoveFreeLicense"], button, input')
            .forEach(el => el.remove());
        return clone.textContent.replace(/\s+/g, ' ').trim();
    }

    function getRemovableLicenses() {
        const removeLinks = Array.from(
            document.querySelectorAll('a[href^="javascript:RemoveFreeLicense"]')
        );

        return removeLinks
            .map(link => {
                const row = link.closest('tr') || link.parentElement;
                if (!row) return null;

                const packageId = extractPackageId(link.getAttribute('href'));
                if (!packageId) return null;

                return {
                    packageId,
                    title: extractTitle(row),
                    appIds: extractAppIds(row)
                };
            })
            .filter(Boolean);
    }

    function isAutoSkipped(license) {
        return AUTO_SKIP_PATTERNS.some(pattern => pattern.test(license.title));
    }

    function toTableRow({ packageId, title, appIds }) {
        return { packageId, title, appIds: appIds.join(', ') || '-' };
    }

    // ============================================================
    // NETWORK
    // ============================================================

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Waits `ms`, printing a live countdown every 60s so the tool
    // doesn't look frozen during the long gap between removals.
    async function waitWithCountdown(ms) {
        let remaining = Math.round(ms / 1000);
        const tick = 60;
        while (remaining > 0) {
            const step = Math.min(tick, remaining);
            await sleep(step * 1000);
            remaining -= step;
            if (remaining > 0) {
                const m = Math.floor(remaining / 60);
                const s = remaining % 60;
                log('info', `⏳ Next removal in ${m}m ${s}s...`);
            }
        }
    }

    async function removeLicense(packageId) {
        const response = await fetch('https://store.steampowered.com/account/removelicense', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `sessionid=${encodeURIComponent(g_sessionID)}&packageid=${encodeURIComponent(packageId)}`
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(`Steam reported failure (eresult: ${data.eresult ?? 'unknown'})`);
        }
        return data;
    }

    // ============================================================
    // MAIN
    // ============================================================

    async function main() {
        banner();

        if (typeof g_sessionID === 'undefined') {
            log('error', 'g_sessionID not found. Make sure you are logged in on the licenses page.');
            return;
        }

        section('🔍 Scanning licenses');
        const all = getRemovableLicenses();
        log('info', `Found ${all.length} license(s) with a Remove button.`);

        const autoSkipped = all.filter(isAutoSkipped);
        const candidates = all.filter(l => !isAutoSkipped(l));

        if (autoSkipped.length > 0) {
            section('🧹 Auto-filtered (not actually removable)');
            log('warn', `Skipping ${autoSkipped.length} license(s) Steam won't let you remove (Free Weekend, Demo, etc.):`);
            console.table(autoSkipped.map(toTableRow));
        }

        if (candidates.length === 0) {
            log('warn', 'No removable licenses left after filtering. Nothing to do.');
            return;
        }

        section('📋 Removal candidates');
        log('info', `${candidates.length} license(s) are candidates for removal:`);
        console.table(candidates.map(toTableRow));

        section('⌨️  Your input needed');
        const input = prompt(
            `${candidates.length} license(s) listed above are ready to remove.\n\n` +
            `To KEEP one or more, paste their package ID or app ID here, comma-separated\n` +
            `(e.g. 2448340, 17801).\n\n` +
            `Leave blank and click OK to remove ALL of them.\n` +
            `Click Cancel to abort without removing anything.`
        );

        if (input === null) {
            log('warn', '🛑 Cancelled. No licenses were removed.');
            return;
        }

        const excludeIds = input.split(',').map(s => s.trim()).filter(Boolean);

        const toRemove = candidates.filter(license => {
            const ids = [license.packageId, ...license.appIds];
            return !ids.some(id => excludeIds.includes(id));
        });

        const excludedLicenses = candidates.filter(l => !toRemove.includes(l));

        // Figure out which typed IDs actually matched something, so we
        // can flag typos instead of silently ignoring them.
        const matchedIds = new Set();
        excludedLicenses.forEach(l => {
            [l.packageId, ...l.appIds].forEach(id => {
                if (excludeIds.includes(id)) matchedIds.add(id);
            });
        });
        const unmatchedIds = excludeIds.filter(id => !matchedIds.has(id));

        section('🚫 Exclusions confirmed');
        if (excludedLicenses.length > 0) {
            log('warn', `Excluding ${excludedLicenses.length} license(s) per your input:`);
            console.table(excludedLicenses.map(toTableRow));
        } else {
            log('info', 'No exclusions entered — everything above will be removed.');
        }
        if (unmatchedIds.length > 0) {
            log('warn', `⚠️ These ID(s) you entered didn't match any candidate — check for typos: ${unmatchedIds.join(', ')}`);
        }

        if (toRemove.length === 0) {
            log('warn', 'Nothing left to remove after exclusions.');
            return;
        }

        section('🚀 Starting removal');
        log('info', `Removing ${toRemove.length} license(s), one every ${DELAY_MS / 60000} minute(s).`);

        const results = { success: 0, failed: 0 };

        for (let i = 0; i < toRemove.length; i++) {
            const license = toRemove[i];
            log('info', `[${progressBar(i + 1, toRemove.length)}] ${i + 1}/${toRemove.length} — "${license.title}" (package ${license.packageId})`);

            try {
                await removeLicense(license.packageId);
                log('success', `✅ Removed: "${license.title}"`);
                results.success++;
            } catch (err) {
                log('error', `❌ Failed: "${license.title}" — ${err.message}`);
                results.failed++;
            }

            if (i < toRemove.length - 1) {
                await waitWithCountdown(DELAY_MS);
            }
        }

        section('📊 Summary');
        console.table({
            'Total with Remove button': all.length,
            'Auto-skipped (Free Weekend/Demo)': autoSkipped.length,
            'Excluded by you': excludedLicenses.length,
            'Attempted': toRemove.length,
            'Successfully removed': results.success,
            'Failed': results.failed
        });

        log('success', '🎉 Done!');
    }

    await main();
})();

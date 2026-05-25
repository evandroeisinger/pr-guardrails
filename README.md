# PR Merge Guardrails

A small Chrome extension that hides the GitHub PR merge button when:

1. Today is one of your configured blocked days (default: Friday), or
2. The PR was opened by someone other than you.

A red block icon is shown where the button used to be. Both checks run
client-side. No GitHub token, no network calls, no telemetry.

## Install (developer mode)

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick this folder (`~/Workspace/blocker`).
4. Open the extension's **Details → Extension options** to configure.

## How it works

Manifest V3 content script, injected on `github.com/*/*/pull/*`. On load and
on every DOM mutation (debounced via `requestAnimationFrame`) the script
scans the page for a visible `<button>` whose text or aria-label starts with
one of: `merge pull request`, `squash and merge`, `rebase and merge`,
`create a merge commit`, `confirm (merge|squash|rebase)`, `enable auto-merge`.
If found and a check applies, the button is hidden and a red block icon is
inserted next to it.

PR author and viewer come from the DOM:

- Viewer: `<meta name="user-login">`
- Author: tries `[data-testid="author-link"]`, `[data-testid="issue-author"]`,
  `#partial-discussion-header a.author`, `.gh-header-meta a.author`, and
  `a.author[href^="/"]` (first match wins)

Bot authors (`*[bot]`, `dependabot`, `renovate`) are exempt from the
others-PR check.

## Files

```text
manifest.json    Manifest V3 declaration
content.js       Merge-button detector + hide logic
options.html     Settings UI (days + others-PR toggle)
options.js       Settings load/save against chrome.storage.sync
icons/           16/48/128 PNGs
```

## Settings

Stored in `chrome.storage.sync` under `pmgSettings`:

- `blockedDays` — array of 0–6 (Sun–Sat); default `[5]`
- `warnOnOthersPR` — block on PRs you didn't open; default `true`

To temporarily disable: uncheck all days and the others-PR toggle, or
disable the extension in `chrome://extensions`.

## Known limitations

- **Enterprise GitHub** (`*.ghe.com`, self-hosted) isn't matched. Add the host
  to `host_permissions` and `content_scripts.matches` in `manifest.json`.
- **Time-of-day windows** aren't supported — whole days only.
- **Co-authored PRs** aren't recognized as "yours" — the others-PR check
  will fire if the PR's `author` isn't you.
- **GitHub markup changes regularly.** If the button-text scan stops
  matching, update `MERGE_PHRASES` in `content.js`.

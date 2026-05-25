/* PR Merge Guardrails — content script
 *
 * Finds the GitHub PR merge button and hides it when a check applies:
 *   - blocked day
 *   - PR opened by someone other than the viewer
 */

(() => {
  'use strict';

  const DEFAULTS = {
    blockedDays: [5],
    warnOnOthersPR: true,
  };

  const STORAGE_KEY = 'pmgSettings';
  const HIDDEN_ATTR = 'data-pmg-hidden';
  const ICON_ATTR = 'data-pmg-icon';
  const MESSAGE_ATTR = 'data-pmg-message';
  const HELPER_SELECTOR = '.f6.fgColor-muted, .status-meta';

  const BLOCK_ICON_SVG = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="26" height="26"
         role="img" aria-label="Merging blocked"
         style="background:#cf222e;border-radius:50%;padding:4px;box-sizing:content-box;display:block;">
      <circle cx="12" cy="12" r="9" fill="none" stroke="white" stroke-width="2"/>
      <line x1="6" y1="12" x2="18" y2="12" stroke="white" stroke-width="2" stroke-linecap="round"
            transform="rotate(45 12 12)"/>
    </svg>
  `;

  // ---------- settings ----------

  function getSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get([STORAGE_KEY], (res) => {
        resolve({ ...DEFAULTS, ...(res[STORAGE_KEY] || {}) });
      });
    });
  }

  // ---------- DOM reads ----------

  function getViewerLogin() {
    return document.querySelector('meta[name="user-login"]')?.content?.trim() || null;
  }

  function getPRAuthor() {
    const selectors = [
      '[data-testid="author-link"]',
      '[data-testid="issue-author"]',
      '#partial-discussion-header a.author',
      '.gh-header-meta a.author',
      'a.author[href^="/"]',
    ];
    for (const sel of selectors) {
      const text = document.querySelector(sel)?.textContent?.trim();
      if (text) return text.replace(/^@/, '');
    }
    return null;
  }

  // ---------- merge button detection ----------

  const MERGE_PHRASES = [
    'merge pull request',
    'squash and merge',
    'rebase and merge',
    'create a merge commit',
    'confirm merge',
    'confirm squash and merge',
    'confirm rebase and merge',
    'enable auto-merge',
  ];

  function matchesMergePhrase(s) {
    if (!s) return false;
    const t = s.replace(/\s+/g, ' ').trim().toLowerCase();
    return MERGE_PHRASES.some((p) => t === p || t.startsWith(p + ' '));
  }

  function isVisible(el) {
    if (!el.isConnected) return false;
    const rects = el.getClientRects();
    return rects.length > 0 && rects[0].width > 0 && rects[0].height > 0;
  }

  function findMergeButton() {
    for (const btn of document.querySelectorAll('button')) {
      if (btn.hasAttribute(HIDDEN_ATTR)) continue;
      if (!isVisible(btn)) continue;
      if (matchesMergePhrase(btn.textContent) || matchesMergePhrase(btn.getAttribute('aria-label'))) {
        return btn;
      }
    }
    return null;
  }

  function isBotAuthor(author) {
    return !!author && (/\[bot\]$/i.test(author) || author === 'dependabot' || author === 'renovate');
  }

  // ---------- checks ----------

  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function blockReason(settings) {
    const today = new Date().getDay();
    if (settings.blockedDays.includes(today)) {
      return `Today is ${DAY_NAMES[today]}, a blocked merge day. To allow, open the extension options and uncheck ${DAY_NAMES[today]}.`;
    }
    if (settings.warnOnOthersPR) {
      const viewer = getViewerLogin();
      const author = getPRAuthor();
      if (viewer && author && viewer !== author && !isBotAuthor(author)) {
        return `@${author} opened this PR — only the author can merge it from here. To allow, open the extension options and turn off "block PRs I didn't open".`;
      }
    }
    return null;
  }

  function replaceHelperText(anchor, reason) {
    let node = anchor.parentElement;
    for (let i = 0; i < 5 && node; i++) {
      const text = node.querySelector(HELPER_SELECTOR);
      if (text) {
        if (text.hasAttribute(MESSAGE_ATTR)) return;
        text.setAttribute(MESSAGE_ATTR, '1');
        text.textContent = '';
        const strong = document.createElement('strong');
        strong.textContent = 'Merging blocked by PR Merge Guardrails. ';
        text.appendChild(strong);
        text.appendChild(document.createTextNode(reason));
        return;
      }
      node = node.parentElement;
    }
  }

  // ---------- lifecycle ----------

  async function attach() {
    const settings = await getSettings();
    const reason = blockReason(settings);
    if (!reason) return;

    const button = findMergeButton();
    let anchor = button;

    if (button) {
      button.setAttribute(HIDDEN_ATTR, '1');
      button.style.setProperty('display', 'none', 'important');

      const next = button.nextElementSibling;
      if (!next || !next.hasAttribute(ICON_ATTR)) {
        const icon = document.createElement('span');
        icon.setAttribute(ICON_ATTR, '1');
        icon.style.display = 'inline-flex';
        icon.style.alignItems = 'center';
        icon.style.verticalAlign = 'middle';
        icon.style.marginRight = '0.5rem';
        icon.innerHTML = BLOCK_ICON_SVG;
        button.parentNode.insertBefore(icon, button.nextSibling);
      }
    } else {
      // Button already hidden — anchor on our icon so we can still replace
      // the helper text if GitHub re-renders it.
      anchor = document.querySelector(`[${ICON_ATTR}]`);
    }

    if (anchor) replaceHelperText(anchor, reason);
  }

  let scheduled = false;
  function scheduleAttach() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      attach();
    });
  }

  new MutationObserver(scheduleAttach).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('turbo:load', scheduleAttach);
  document.addEventListener('pjax:end', scheduleAttach);
  window.addEventListener('popstate', scheduleAttach);

  attach();
})();

/**
 * Caveat Content Script
 * Runs on every page at document_idle.
 *
 * Responsibilities:
 *  1. Detect if this page looks like a legal/contract document
 *  2. Extract visible text (capped for prescan speed)
 *  3. Send to /api/consumer/prescan via background service worker
 *  4. Store result in chrome.storage.session keyed by tabId
 *  5. Expose extractFullText() for the popup to call via chrome.scripting
 */

(function () {
  'use strict';

  const LEGAL_KEYWORDS = [
    'terms of service', 'privacy policy', 'terms and conditions',
    'end user license', 'user agreement', 'service agreement',
    'arbitration', 'indemnification', 'limitation of liability',
    'non-disclosure', 'intellectual property', 'governing law',
    'employment agreement', 'rental agreement', 'loan agreement',
    'whereas', 'hereinafter', 'notwithstanding', 'pursuant to',
  ];

  const PRESCAN_TEXT_LIMIT = 8000;    // chars sent to prescan
  const MIN_TEXT_LENGTH    = 200;     // below this → skip

  /**
   * Extract the most relevant text from the page.
   * Prefers <article>, <main>, <section> over full body.
   */
  function extractPageText(charLimit) {
    const candidates = [
      document.querySelector('article'),
      document.querySelector('main'),
      document.querySelector('[role="main"]'),
      document.body,
    ];

    for (const el of candidates) {
      if (!el) continue;
      const text = el.innerText || el.textContent || '';
      if (text.trim().length > MIN_TEXT_LENGTH) {
        return text.trim().slice(0, charLimit);
      }
    }
    return '';
  }

  /**
   * Returns true if the page text contains legal indicators.
   */
  function isLegalPage(text) {
    const lower = text.toLowerCase();
    return LEGAL_KEYWORDS.some(kw => lower.includes(kw));
  }

  /**
   * Called by popup (via chrome.scripting.executeScript) to get full page text
   * for the deep analysis endpoint.
   */
  window.__caveatExtractText = function (charLimit = 40000) {
    return extractPageText(charLimit);
  };

  // ── Main: prescan on page load ──────────────────────────────────────
  async function runPrescan() {
    const text = extractPageText(PRESCAN_TEXT_LIMIT);
    if (!text || text.length < MIN_TEXT_LENGTH) return;
    if (!isLegalPage(text)) return;

    // Notify background to start prescan
    try {
      chrome.runtime.sendMessage({
        type: 'PRESCAN_REQUEST',
        text,
        url: window.location.href,
        title: document.title,
      });
    } catch (_) {
      // Extension context may be invalidated on SPA navigations — silently ignore
    }
  }

  // Run immediately and also on SPA navigation changes
  runPrescan();

  let lastUrl = window.location.href;
  const navObserver = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      setTimeout(runPrescan, 1500); // wait for new page content to load
    }
  });
  navObserver.observe(document.body, { childList: true, subtree: true });

})();

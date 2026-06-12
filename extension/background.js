/**
 * Caveat Background Service Worker (Manifest V3)
 *
 * Handles:
 *  - Prescan API calls (called by content.js via message passing)
 *  - Badge updates (🔴 high risk / 🟢 safe / ⏳ scanning)
 *  - Storage of per-tab prescan results for the popup
 */

'use strict';

const API_BASE = 'http://localhost:8000';
const BADGE_COLORS = {
  scanning: ['?',  '#6366F1'],  // purple, checking
  high:     ['!',  '#EF4444'],  // red, dangerous
  medium:   ['~',  '#F97316'],  // orange, caution
  safe:     ['✓',  '#10B981'],  // green, ok
  neutral:  ['',   '#6B7280'],  // grey, not a legal page
};

// ── Message router ──────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'PRESCAN_REQUEST' && sender.tab?.id) {
    handlePrescan(sender.tab.id, msg.text, msg.url, msg.title);
    // Don't return true — async, no response expected
  }

  if (msg.type === 'GET_PRESCAN_RESULT') {
    // Popup asking for cached result
    chrome.storage.session.get(['prescan_' + msg.tabId], (data) => {
      sendResponse(data['prescan_' + msg.tabId] || null);
    });
    return true; // keep channel open for async sendResponse
  }

  if (msg.type === 'ANALYSE_REQUEST') {
    // Popup requesting full analysis — forward to API and respond
    runFullAnalysis(msg.text, msg.language || 'en')
      .then(result => sendResponse({ ok: true, data: result }))
      .catch(err  => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});

// ── Prescan handler ──────────────────────────────────────────────────────
async function handlePrescan(tabId, text, url, title) {
  setBadge(tabId, 'scanning');

  try {
    const resp = await fetch(`${API_BASE}/api/consumer/prescan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!resp.ok) {
      setBadge(tabId, 'neutral');
      return;
    }

    const data = await resp.json();
    const level = data.risk_level || (data.high_risk ? 'high' : 'safe');
    setBadge(tabId, level);

    // Cache result for the popup
    await chrome.storage.session.set({
      ['prescan_' + tabId]: {
        level,
        high_risk:       data.high_risk,
        risk_indicators: data.risk_indicators || [],
        url,
        title,
        scanned_at: Date.now(),
      },
    });

  } catch (_) {
    // Server not reachable — show neutral badge
    setBadge(tabId, 'neutral');
  }
}

// ── Full analysis ────────────────────────────────────────────────────────
async function runFullAnalysis(text, language) {
  const resp = await fetch(`${API_BASE}/api/consumer/analyse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, preferred_language: language, source: 'extension' }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `API error ${resp.status}`);
  }

  return resp.json();
}

// ── Badge helper ─────────────────────────────────────────────────────────
function setBadge(tabId, level) {
  const [text, color] = BADGE_COLORS[level] || BADGE_COLORS.neutral;
  chrome.action.setBadgeText({ text, tabId }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ color, tabId }).catch(() => {});
}

// ── Clean up storage when tab closes ────────────────────────────────────
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove('prescan_' + tabId).catch(() => {});
});

// ── Reset badge when navigating to a new URL ────────────────────────────
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    setBadge(tabId, 'neutral');
    chrome.storage.session.remove('prescan_' + tabId).catch(() => {});
  }
});

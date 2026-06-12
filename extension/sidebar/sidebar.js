'use strict';

const API = 'http://localhost:8000';
const RC  = { violation:'#ff5555', high:'#ff8c42', medium:'#ffc542', low:'#42b4ff', compliant:'#42ffa1' };

let tabId = null;

// ── Helpers ────────────────────────────────────────────────────────────────
function esc(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function $(id) { return document.getElementById(id); }
function setRoot(html) { $('root').innerHTML = html; }

// ── Navigation ─────────────────────────────────────────────────────────────
function openConsumer()   { chrome.tabs.create({ url: 'http://localhost:3000/consumer' }); }
function openEnterprise() { chrome.tabs.create({ url: 'http://localhost:3000/enterprise' }); }
function openSettings()   { chrome.tabs.create({ url: 'http://localhost:3000' }); }

// ── Boot ───────────────────────────────────────────────────────────────────
async function boot() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) { showNotLegal('Could not read tab info.'); return; }
    tabId = tab.id;
    try { $('page-url').textContent = new URL(tab.url).hostname; } catch { $('page-url').textContent = '—'; }

    chrome.runtime.sendMessage({ type: 'GET_PRESCAN_RESULT', tabId: tab.id }, result => {
      if (chrome.runtime.lastError) { showNotLegal('No scan result yet. Try reloading the page.'); return; }
      if (result) {
        renderPrescan(result);
      } else {
        showNotLegal('No legal content detected.\nNavigate to a contract or Terms of Service page.');
      }
    });
  } catch (err) {
    showError('Failed to initialize: ' + err.message);
  }
}

// ── Prescan View ───────────────────────────────────────────────────────────
function renderPrescan(r) {
  const lv = r.level || 'neutral';
  const ico    = { high: '🔴', medium: '🟠', safe: '🟢', neutral: '📄' };
  const titles = { high: 'High Risk Detected', medium: 'Caution Advised', safe: 'Looks Safe', neutral: 'Page Scanned' };
  const subs   = {
    high:    `${r.risk_indicators?.length || 0} risk pattern(s) found.`,
    medium:  'Some concerning patterns detected.',
    safe:    'No major red flags in quick scan.',
    neutral: 'Legal content found on this page.',
  };

  let h = `<div class="risk-banner ${lv}">
    <div class="risk-icon">${ico[lv] || '📄'}</div>
    <div>
      <div class="risk-title">${titles[lv] || 'Scanned'}</div>
      <div class="risk-sub">${subs[lv] || ''}</div>
    </div>
  </div>`;

  if (r.risk_indicators?.length) {
    h += `<div class="pills">${r.risk_indicators.map(i => `<span class="pill">${esc(i)}</span>`).join('')}</div>`;
  }

  h += `<hr class="sep">
  <div class="lang-row">
    <span class="lang-lbl">Language</span>
    <select class="lang-sel" id="lang-sel">
      <option value="en">English</option>
      <option value="hi">हिन्दी</option>
      <option value="kn">ಕನ್ನಡ</option>
      <option value="ta">தமிழ்</option>
      <option value="te">తెలుగు</option>
      <option value="ml">മലയാളം</option>
      <option value="bn">বাংলা</option>
      <option value="mr">मराठी</option>
    </select>
  </div>
  <div class="actions">
    <button class="btn btn-p" id="analyse-btn">🔍 Deep Analysis — Clause by Clause</button>
    <button class="btn btn-g" id="dashboard-btn">🌐 Open Full Dashboard</button>
  </div>`;

  setRoot(h);
  $('analyse-btn').addEventListener('click', runAnalysis);
  $('dashboard-btn').addEventListener('click', openConsumer);
}

// ── Full Analysis ──────────────────────────────────────────────────────────
async function runAnalysis() {
  const lang = $('lang-sel')?.value || 'en';
  const btn  = $('analyse-btn');
  if (btn) btn.disabled = true;

  showLoading('Extracting page text…');

  let text = '';
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => window.__caveatExtractText ? window.__caveatExtractText(40000) : document.body.innerText.slice(0, 40000),
    });
    text = res?.result || '';
  } catch (e) {
    showError('Could not read page: ' + e.message);
    return;
  }

  if (!text || text.length < 100) {
    showError('Not enough text on this page to analyse.');
    return;
  }

  showLoading('Running 3-stage adversarial pipeline…');

  chrome.runtime.sendMessage({ type: 'ANALYSE_REQUEST', text, language: lang }, response => {
    if (chrome.runtime.lastError || !response || !response.ok) {
      showError((response?.error) || 'Analysis failed. Is the backend server running on port 8000?');
      return;
    }
    renderResults(response.data?.analysis || response.data);
  });
}

// ── Results View ───────────────────────────────────────────────────────────
function renderResults(a) {
  const score   = a.overall_risk_score || 0;
  const scoreColor = RC[score >= 70 ? 'violation' : score >= 40 ? 'high' : 'compliant'];
  const clauses = (a.flagged_clauses || []).sort((x, y) => {
    const o = { violation: 0, high: 1, medium: 2, low: 3, compliant: 4 };
    return (o[x.risk_level] ?? 5) - (o[y.risk_level] ?? 5);
  });

  const sign = a.safe_to_sign
    ? `<span class="sign-badge s-ok">✅ Safe to Sign</span>`
    : `<span class="sign-badge s-bad">🚫 Do Not Sign</span>`;

  const redFlags = a.red_flags_count ?? clauses.filter(c => (c.risk_level || '').toLowerCase() === 'violation').length;
  const darkPats = a.dark_patterns_count ?? clauses.filter(c => c.dark_pattern).length;

  const rows = clauses.slice(0, 12).map((c, i) => {
    const lv  = (c.risk_level || 'low').toLowerCase();
    const col = RC[lv] || '#fff';
    const bc  = { violation: 'bv', high: 'bh', medium: 'bm', low: 'bl', compliant: 'bc' }[lv] || 'bl';
    const dp  = c.dark_pattern   ? `<div class="dpill">🎭 ${esc((c.dark_pattern_type || 'dark pattern').replace(/_/g, ' '))}</div>` : '';
    const fair = c.fair_version  ? `<div class="fair-box">✍️ <b>Fair:</b> ${esc(c.fair_version.slice(0, 180))}</div>` : '';
    const neg  = c.negotiation_tip ? `<div class="neg-box">🤝 ${esc(c.negotiation_tip.slice(0, 180))}</div>` : '';
    const why  = c.why_flagged   ? `<div class="why">${esc(c.why_flagged.slice(0, 220))}</div>` : '';
    return `<div class="clause" id="ci${i}">
      <div class="clause-top">
        <div class="rdot" style="background:${col}"></div>
        <span class="rbadge ${bc}">${lv}</span>
        <span class="ctype">${esc((c.clause_type || 'other').replace(/_/g, ' '))}</span>
      </div>
      <div class="clause-body">${why}${dp}${fair}${neg}</div>
    </div>`;
  }).join('');

  const more = clauses.length > 12 ? clauses.length - 12 : 0;

  setRoot(`
  <div class="score-row">
    <div class="score-circle" style="color:${scoreColor}">
      <span class="score-num">${score}</span>
      <span class="score-lbl">Risk</span>
    </div>
    <div class="sign-col">
      ${sign}
      <span class="power-txt">⚖️ ${esc(a.power_imbalance || '—')}</span>
    </div>
  </div>
  <div class="stats-row">
    <div class="stat-cell"><div class="stat-num" style="color:#ff5555">${redFlags}</div><div class="stat-lbl">Red Flags</div></div>
    <div class="stat-cell"><div class="stat-num" style="color:#EC4899">${darkPats}</div><div class="stat-lbl">Dark Patterns</div></div>
    <div class="stat-cell"><div class="stat-num" style="color:#e894ff">${clauses.length}</div><div class="stat-lbl">Clauses</div></div>
  </div>
  ${a.summary ? `<div class="summary">${esc(a.summary)}</div>` : ''}
  <div class="clauses-hdr">Flagged Clauses ${more ? `(showing 12 of ${clauses.length})` : `(${clauses.length})`}</div>
  ${rows}
  ${more ? `<div class="more-note">+${more} more — open dashboard for full report</div>` : ''}
  <div class="foot">
    <button class="btn btn-g" style="flex:1" id="back-btn">← Back</button>
    <button class="btn btn-g" style="flex:2" id="full-report-btn">Consumer Dashboard ↗</button>
  </div>`);

  document.querySelectorAll('.clause').forEach((el, i) => {
    el.addEventListener('click', () => el.classList.toggle('open'));
  });
  $('back-btn').addEventListener('click', boot);
  $('full-report-btn').addEventListener('click', openConsumer);
}

// ── Loading / Error ────────────────────────────────────────────────────────
function showLoading(stage) {
  setRoot(`<div class="loading">
    <div class="spinner"></div>
    <div class="load-title">Analysing…</div>
    <div class="load-stage">${esc(stage)}</div>
    <div class="load-steps">
      <div class="load-step">🔎 Stage 1 — Parsing &amp; classifying clauses</div>
      <div class="load-step">⚔️ Stage 2 — Adversarial risk scan</div>
      <div class="load-step">⚡ Stage 3 — Consequence simulation &amp; scoring</div>
    </div>
  </div>`);
}

function showNotLegal(msg) {
  setRoot(`<div class="no-legal">
    <span class="no-legal-icon">📄</span>
    <div class="no-legal-title">No Contract Detected</div>
    <div class="no-legal-sub">${esc(msg)}</div>
    <div class="actions" style="margin-top:4px">
      <button class="btn btn-p" id="go-consumer">👤 Consumer — Upload File ↗</button>
      <button class="btn btn-g" id="go-enterprise">🏢 Enterprise Pipeline ↗</button>
    </div>
  </div>`);
  $('go-consumer').addEventListener('click', openConsumer);
  $('go-enterprise').addEventListener('click', openEnterprise);
}

function showError(msg) {
  setRoot(`<div class="err-box">⚠️ ${esc(msg)}</div>
  <div class="actions"><button class="btn btn-g" id="retry-btn">← Try Again</button></div>`);
  $('retry-btn').addEventListener('click', boot);
}

// ── Static event listeners ─────────────────────────────────────────────────
$('settings-btn').addEventListener('click', openSettings);

// ── Run ───────────────────────────────────────────────────────────────────
boot();

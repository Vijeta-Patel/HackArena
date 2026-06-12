  const API = 'http://localhost:8000';

  let currentTabId  = null;
  let prescanResult = null;
  let analysisData  = null;

  // ── Boot ──────────────────────────────────────────────────────────────
  async function boot() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) { showNotLegal('Could not read active tab.'); return; }

      currentTabId = tab.id;
      try {
        document.getElementById('page-url').textContent = tab.url ? new URL(tab.url).hostname : 'Unknown page';
      } catch(e) {
        document.getElementById('page-url').textContent = 'Unknown page';
      }

    // Ask background for cached prescan
    chrome.runtime.sendMessage({ type: 'GET_PRESCAN_RESULT', tabId: tab.id }, result => {
      prescanResult = result;
      if (result) {
        renderPrescan(result);
      } else {
        showNotLegal('No legal content detected on this page.\nNavigate to a contract, ToS, or agreement page.');
      }
    });
    } catch (err) {
      showError('Failed to initialize: ' + err.message);
    }
  }

  // ── Prescan view ──────────────────────────────────────────────────────
  function renderPrescan(r) {
    const level  = r.level;
    const icons  = { high:'🔴', medium:'🟠', safe:'🟢', scanning:'⏳', neutral:'⚪' };
    const titles = {
      high:   'High Risk Detected',
      medium: 'Caution Advised',
      safe:   'Looks Relatively Safe',
      neutral:'Page Scanned',
    };
    const subs = {
      high:   `${r.risk_indicators?.length || 0} risk pattern(s) found. Deep analysis recommended.`,
      medium: 'Some concerning patterns detected. Review before signing.',
      safe:   'No major red flags detected in quick scan.',
      neutral:'',
    };

    let html = `
      <div class="risk-banner ${level}">
        <div class="risk-icon">${icons[level] || '⚪'}</div>
        <div>
          <div class="risk-title">${titles[level] || 'Scanned'}</div>
          <div class="risk-sub">${subs[level] || ''}</div>
        </div>
      </div>`;

    if (r.risk_indicators?.length) {
      html += `<div class="indicators">
        ${r.risk_indicators.map(i => `<span class="indicator-pill">${esc(i)}</span>`).join('')}
      </div>`;
    }

    html += `
      <div class="lang-row">
        <span class="lang-label">Output Language</span>
        <select class="lang-select" id="lang-sel">
          <option value="en">English</option>
          <option value="hi">हिन्दी</option>
          <option value="kn">ಕನ್ನಡ</option>
          <option value="ta">தமிழ்</option>
          <option value="te">తెలుగు</option>
          <option value="ml">മലയാളം</option>
          <option value="bn">বাংলা</option>
        </select>
      </div>
      <div class="actions">
        <button class="btn btn-primary" id="analyse-btn">
          🔍 Deep Analysis — Clause by Clause
        </button>
        <button class="btn btn-ghost" id="open-dashboard-btn">
          🌐 Open Full Dashboard
        </button>
      </div>`;

    document.getElementById('root').innerHTML = html;

    // Attach event listeners dynamically to avoid CSP issues with onclick attributes
    document.getElementById('analyse-btn').addEventListener('click', runFullAnalysis);
    document.getElementById('open-dashboard-btn').addEventListener('click', openInApp);
  }

  // ── Full analysis ─────────────────────────────────────────────────────
  async function runFullAnalysis() {
    const lang = document.getElementById('lang-sel')?.value || 'en';
    const btn  = document.getElementById('analyse-btn');
    if (btn) btn.disabled = true;

    showLoading('Extracting page text…');

    // Get full text from content script
    let text = '';
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: currentTabId },
        func: () => window.__lexguardExtractText ? window.__lexguardExtractText(40000) : document.body.innerText.slice(0, 40000),
      });
      text = result?.result || '';
    } catch (err) {
      showError('Could not read page: ' + err.message);
      return;
    }

    if (!text || text.length < 100) {
      showError('Not enough text on this page to analyse.');
      return;
    }

    showLoading('Running 3-stage adversarial pipeline…');

    chrome.runtime.sendMessage({ type: 'ANALYSE_REQUEST', text, language: lang }, response => {
      if (!response || !response.ok) {
        showError((response?.error) || 'Analysis failed. Is the server running?');
        return;
      }
      const data = response.data?.analysis || response.data;
      analysisData = data;
      renderResults(data, lang);
    });
  }

  // ── Results view ──────────────────────────────────────────────────────
  function renderResults(a, lang) {
    const score      = a.overall_risk_score || 0;
    const scoreColor = score >= 70 ? '#EF4444' : score >= 40 ? '#F97316' : '#22C55E';
    const clauses    = (a.flagged_clauses || [])
      .sort((x,y) => {
        const o = {violation:0,high:1,medium:2,low:3,compliant:4};
        return (o[x.risk_level]??5) - (o[y.risk_level]??5);
      });

    const signBadge = a.safe_to_sign
      ? `<span class="sign-badge sign-ok">✅ Safe to Sign</span>`
      : `<span class="sign-badge sign-bad">🚫 Do Not Sign</span>`;

    const redFlags    = a.red_flags_count ?? 0;
    const darkPats    = a.dark_patterns_count ?? 0;
    const totalClause = clauses.length;

    const clauseHtml = clauses.slice(0, 10).map((c, i) => {
      const lvl  = c.risk_level || 'low';
      const emoj = {violation:'🔴',high:'🟠',medium:'🟡',low:'🟢',compliant:'✅'}[lvl] || '⚪';
      const dp   = c.dark_pattern
        ? `<span class="dark-pill">🎭 ${esc((c.dark_pattern_type||'dark pattern').replace(/_/g,' '))}</span>` : '';
      const fair = c.fair_version
        ? `<div class="fair-box">✍️ <strong>Fair version:</strong> ${esc(c.fair_version.slice(0,200))}</div>` : '';
      const neg  = c.negotiation_tip
        ? `<div class="neg-box">🤝 ${esc(c.negotiation_tip.slice(0,200))}</div>` : '';
      const why  = c.why_flagged ? `<div>${esc(c.why_flagged.slice(0,250))}</div>` : '';
      return `
        <div class="clause-item" id="ci-${i}" data-index="${i}">
          <div class="clause-top">
            <span>${emoj}</span>
            <span class="risk-badge badge-${lvl}">${lvl}</span>
            <span class="clause-type">${esc((c.clause_type||'other').replace(/_/g,' '))}</span>
          </div>
          <div class="clause-detail">
            ${why}${dp}${fair}${neg}
          </div>
        </div>`;
    }).join('');

    const moreCount = clauses.length > 10 ? clauses.length - 10 : 0;

    document.getElementById('root').innerHTML = `
      <div class="results">
        <div class="score-row">
          <div class="score-circle" style="color:${scoreColor};border-color:${scoreColor};">
            <span>${score}</span>
            <span class="score-circle-lbl">Risk</span>
          </div>
          <div class="sign-row">
            ${signBadge}
            <span class="power-line">⚖️ ${esc(a.power_imbalance || '—')}</span>
          </div>
        </div>

        <div class="stats-mini">
          <div class="stat-mini">
            <div class="stat-mini-num" style="color:#EF4444;">${redFlags}</div>
            <div class="stat-mini-lbl">Red Flags</div>
          </div>
          <div class="stat-mini">
            <div class="stat-mini-num" style="color:#EC4899;">${darkPats}</div>
            <div class="stat-mini-lbl">Dark Patterns</div>
          </div>
          <div class="stat-mini">
            <div class="stat-mini-num" style="color:#94A3B8;">${totalClause}</div>
            <div class="stat-mini-lbl">Clauses</div>
          </div>
        </div>

        ${a.summary ? `<div class="summary-text">${esc(a.summary)}</div>` : ''}

        <div class="clauses-title">Flagged Clauses ${moreCount ? `(showing 10 of ${clauses.length})` : `(${clauses.length})`}</div>
        ${clauseHtml}
        ${moreCount ? `<div style="text-align:center;padding:8px 0;font-size:10px;color:var(--text-3);">+${moreCount} more — open full dashboard to see all</div>` : ''}

        <div style="padding:8px 0;display:flex;gap:8px;">
          <button class="btn btn-ghost" style="font-size:11px;" id="back-btn">← Back</button>
          <button class="btn btn-ghost" style="font-size:11px;" id="open-app-results-btn">Open Full Dashboard ↗</button>
        </div>
      </div>`;

      // Attach event listeners
      document.querySelectorAll('.clause-item').forEach(el => {
        el.addEventListener('click', () => el.classList.toggle('open'));
      });
      document.getElementById('back-btn').addEventListener('click', boot);
      document.getElementById('open-app-results-btn').addEventListener('click', openInApp);
  }

  // ── Loading / error states ─────────────────────────────────────────────
  function showLoading(stage) {
    document.getElementById('root').innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <div style="font-size:12px;font-weight:600;">Analysing…</div>
        <div class="loading-stage">${esc(stage)}</div>
        <div class="loading-stage" style="margin-top:8px;font-size:10px;">
          ⚔️ 3-stage adversarial AI pipeline running
        </div>
      </div>`;
  }

  function showNotLegal(msg) {
    document.getElementById('root').innerHTML = `
      <div class="not-legal">
        <div class="icon">📄</div>
        <p>${esc(msg)}</p>
        <button class="btn btn-ghost" style="margin-top:16px;font-size:11px;" id="not-legal-upload-btn">
          📂 Upload a file instead
        </button>
      </div>`;
    document.getElementById('not-legal-upload-btn').addEventListener('click', openInApp);
  }

  function showError(msg) {
    document.getElementById('root').innerHTML = `
      <div class="error-box">
        <div class="error-msg">⚠️ ${esc(msg)}</div>
        <div style="padding:12px 0;">
          <button class="btn btn-ghost" style="font-size:11px;" id="error-retry-btn">← Try again</button>
        </div>
      </div>`;
    document.getElementById('error-retry-btn').addEventListener('click', boot);
  }

  // ── Helpers ────────────────────────────────────────────────────────────
  function esc(s) {
    return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function openInApp() {
    chrome.tabs.create({ url: 'http://localhost:8000/consumer.html' });
  }
  function openSettings() {
    chrome.tabs.create({ url: 'http://localhost:8000' });
  }

  // Attach static event listeners
  document.getElementById('settings-btn').addEventListener('click', openSettings);

  // ── Run ────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', boot);


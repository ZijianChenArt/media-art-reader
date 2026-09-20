(() => {
  const DATA_URL = 'latest.json';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const two = n => String(n).padStart(2, '0');
  const labels = { exhibition: '展览征集', residency: '驻留', prize: '奖项', conference: '学术会议' };
  const catColor = { exhibition: '#1479e8', residency: '#ffb314', prize: '#ff5b22', conference: '#0bb64a' };
  const imgs = ['assets/diatomic-garden.jpg', 'assets/conspiratorial-design.jpg'];
  const SOON_DAYS = 14;
  let data = null;

  // ---------- 数据整理 ----------
  const dateOf = item => item.deadline_date || (item.deadline_at || '').slice(0, 10);
  const fmtDate = item => {
    const d = dateOf(item);
    if (!d) return '—';
    const [, m, day] = d.split('-');
    return m + '.' + day;
  };
  const daysLeft = item => {
    const t = Date.parse(item.deadline_at || item.deadline_date);
    if (!Number.isFinite(t)) return null;
    return Math.ceil((t - Date.now()) / 86400000);
  };
  const isClosed = item => { const d = daysLeft(item); return d !== null && d < 0; };
  const isSoon = item => { const d = daysLeft(item); return d !== null && d >= 0 && d <= SOON_DAYS; };
  const daysText = item => {
    const d = daysLeft(item);
    if (d === null) return 'DATE TBA';
    if (d < 0) return 'CLOSED';
    if (d === 0) return 'TODAY';
    return 'T−' + d + ' DAYS';
  };
  const titleParts = t => String(t || '').split('/').map(x => x.trim()).filter(Boolean);
  const place = item => String(item.location || '').split(/[；;·，,。]/)[0].trim().slice(0, 22);
  const firstSentence = s => String(s || '').split(/[；。]/)[0].trim();
  const sorted = () => (data.open_calls || []).slice().sort((a, b) => {
    const ca = isClosed(a), cb = isClosed(b);
    if (ca !== cb) return ca ? 1 : -1;
    return Date.parse(a.deadline_at) - Date.parse(b.deadline_at);
  });
  const keyOf = item => item.highlight ? `${item.highlight} ${item.highlight_label || ''}`.trim() : '';

  // ---------- 左栏 ----------
  function syncRail(route, filter) {
    const calls = data.open_calls || [];
    const counts = { all: calls.length };
    Object.keys(labels).forEach(k => { counts[k] = calls.filter(c => c.category === k).length; });
    $$('[data-count]').forEach(el => {
      const k = el.dataset.count;
      el.textContent = two(counts[k] || 0);
      el.closest('.tile').classList.toggle('is-empty', k !== 'all' && !counts[k]);
    });
    $$('.tile').forEach(t => {
      const on = route === 'opportunities'
        ? t.dataset.route === 'opportunities' && (t.dataset.filter || 'all') === filter
        : t.dataset.route === route;
      t.classList.toggle('is-active', on);
      if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    });
    $('#status-issue').textContent = (data.issue_id || '—');
    const ver = (calls.map(c => c.verified_at).filter(Boolean).sort().pop() || '').slice(5, 10).replace('-', '.');
    $('#status-verified').textContent = ver ? '核验 ' + ver : '';
    // 手机上横向胶囊导航：把当前项滚到可见处
    const cur = $('.tile.is-active');
    if (cur && matchMedia('(max-width:860px)').matches) cur.scrollIntoView({ inline: 'center', block: 'nearest' });
  }

  // ---------- 字标：让 MAR 的墨迹宽度等于下方方块的宽度 ----------
  // 用 canvas 量真实墨迹（含负字距），再反推字号，并把左侧字形留白削掉。
  function fitWordmark() {
    const mar = $('#mar'), rail = $('.rail');
    if (!mar || !rail || matchMedia('(max-width:860px)').matches) { document.documentElement.style.removeProperty('--mar-size'); mar && mar.style.removeProperty('margin-left'); return; }
    const ctx = document.createElement('canvas').getContext('2d');
    if (!('letterSpacing' in ctx)) return;
    ctx.font = '700 100px Grotesk';
    ctx.letterSpacing = '-9px';
    const m = ctx.measureText('MAR');
    const ink = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
    if (!ink) return;
    const k = rail.getBoundingClientRect().width / ink;       // 目标宽度 / 100px 时的墨迹宽度
    mar.style.fontSize = (100 * k) + 'px';
    mar.style.marginLeft = (m.actualBoundingBoxLeft * k) + 'px';  // 左侧负 bearing 补回来，墨迹左缘贴齐
  }
  document.fonts.ready.then(fitWordmark);
  addEventListener('resize', fitWordmark);

  // ---------- 跑马灯：按截止日期排列 ----------
  function tickerHtml(calls) {
    const one = calls.filter(c => !isClosed(c)).map(c => {
      const d = daysLeft(c);
      return `<span class="ticker-item"><i class="dot" style="--c:${catColor[c.category] || '#fff'}"></i><b>${esc(fmtDate(c))}</b><span>${esc(titleParts(c.title)[0] || c.title)}</span>${isSoon(c) ? `<span class="soon">T−${d}</span>` : `<span style="opacity:.6">T−${d}</span>`}</span>`;
    }).join('');
    if (!one) return '';
    // 内容写两遍，动画平移 -50% 时首尾无缝
    return `<div class="ticker" aria-hidden="true"><div class="ticker-track">${one}${one}</div></div>`;
  }

  // ---------- 机会卡 ----------
  // 详情分四组（借 v13 的分法），但不截断原文：资助 / 时间 / 交通住宿 / 申请费 / 资格适合
  function factsHtml(item) {
    const travel = [item.travel, item.accommodation].filter(Boolean).join('；');
    const fit = [item.eligibility, item.fit].filter(Boolean).join(' ');
    const groups = [
      ['资助', 'FUNDING', item.funding, 'wide'],
      ['时间', 'WHEN', item.program_dates || item.project_when, ''],
      ['交通 · 住宿', 'TRAVEL / STAY', travel, ''],
      ['申请费', 'FEE', item.application_fee, ''],
      ['资格 · 适合', 'ELIGIBILITY / FIT', fit, 'wide']
    ].filter(g => g[2]);
    const ver = (item.verified_at || '').slice(0, 10);
    return `<div class="facts" hidden>
      ${groups.map(g => `<div class="fgrp ${g[3]}"><small>${g[0]}<i>${g[1]}</i></small><p>${esc(g[2])}</p></div>`).join('')}
      <p class="verified">${esc(item.deadline_display || '')}${ver ? ' · 核验于 ' + esc(ver) : ''}</p>
    </div>`;
  }

  function renderCard(item, i) {
    const parts = titleParts(item.title);
    const key = keyOf(item);
    const brief = firstSentence(item.why);
    return `<article class="call-card ${isSoon(item) ? 'is-soon' : ''} ${isClosed(item) ? 'is-closed' : ''}" data-cat="${esc(item.category)}" id="call-${esc(item.id)}">
      <div class="date-panel">
        <div class="panel-top"><span class="type">${esc(labels[item.category] || 'OPEN CALL')}</span><span class="place">${esc(place(item))}</span><span class="card-index">${two(i + 1)}</span></div>
        <div class="panel-date">
          <div class="deadline-date">${esc(fmtDate(item))}</div>
          <div class="deadline-copy"><span class="days">${esc(daysText(item))}</span><span>申请截止</span></div>
        </div>
      </div>
      <div class="card-body">
        <h2 class="card-title">${esc(parts[0] || item.title)}</h2>
        ${parts.length > 1 ? `<p class="card-subtitle">${esc(parts.slice(1).join(' / '))}</p>` : ''}
        ${item.highlight ? `<div class="keyline"><small>SUPPORT</small>${/\d/.test(item.highlight) ? `<b class="kv">${esc(item.highlight)}</b>` : `<b>${esc(item.highlight)}</b>`}<span class="kl">${esc(item.highlight_label || '')}</span></div>` : ''}
        ${brief ? `<p class="brief">${esc(brief)}。</p>` : ''}
        <div class="actions">
          <a class="btn btn-primary" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer"><span>官方页面</span><span>↗</span></a>
          <button class="btn btn-ghost" type="button" aria-expanded="false">更多信息 +</button>
        </div>
        ${factsHtml(item)}
      </div>
    </article>`;
  }

  function opportunitiesView(filter) {
    const calls = sorted();
    const shown = filter === 'all' ? calls : calls.filter(x => x.category === filter);
    const label = filter === 'all' ? '全部机会' : (labels[filter] || filter);
    const cards = shown.length ? shown.map(renderCard).join('') : `<div class="empty">本期暂无${esc(label)}。</div>`;
    return `<section class="view">
      <header class="page-head">
        <h1><span>国际机会精选</span><em>Open calls.</em><sup>${two((data.open_calls || []).length)}</sup></h1>
        <div class="page-meta"><span>01 / Opportunities</span><span>${esc(data.issue_id || '')}</span></div>
      </header>
      ${tickerHtml(calls)}
      <div class="toolbar">
        <div class="filter-status">${esc(label)}<span>${two(shown.length)}</span></div>
        <button class="reset-filter ${filter !== 'all' ? 'show' : ''}" type="button">全部机会</button>
      </div>
      <div class="cards ${filter !== 'all' ? 'filtered' : ''}">${cards}</div>
    </section>`;
  }

  // ---------- 本周关注 ----------
  function focusView() {
    const items = (data.radar || []).slice(0, 2);
    return `<section class="view">
      <header class="page-head">
        <h1><span>本周关注</span><em>In focus.</em></h1>
        <div class="page-meta"><span>02 / Weekly radar</span><span>${esc(data.issue_id || '')}</span></div>
      </header>
      <div class="focus-layout">
        ${items.map((item, i) => `<article class="focus-card">
          <img src="${imgs[i] || imgs[0]}" alt="" loading="lazy">
          <div class="focus-copy">
            <span class="type">${esc(item.type || 'IN FOCUS')}</span>
            <h2>${esc(item.title)}</h2>
            <p class="author">${esc(item.author || '')}</p>
            <p class="sum">${esc(item.short_title || '')}</p>
            <a class="pill" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">阅读原文 ↗</a>
          </div>
        </article>`).join('')}
      </div>
    </section>`;
  }

  // ---------- 小组件：与 Media-Art-Radar.js 同一套规则（每个机会两行，一视同仁） ----------
  function hlHtml(item, base) {
    const v = item.highlight;
    if (!v) return '';
    if (!/\d/.test(v)) return `<span style="font-size:${Math.max(base * .5, 9)}px;color:#b9b9bf;font-weight:500">${esc(v)}</span>`;
    const size = v.length >= 5 ? Math.max(base * .68, 9) : base;
    return `<span class="it" style="font-size:${size}px">${esc(v)}</span>`;
  }
  function wgRow(item, s) {
    const soon = isSoon(item), d = daysLeft(item);
    return `<div class="wg-row">
      <div class="r1"><span class="it ${soon ? 'soon' : ''}" style="font-size:${s.date}px;width:${s.dateW}px;flex:0 0 ${s.dateW}px">${esc(fmtDate(item))}</span><b class="clip" style="font-size:${s.title}px">${esc(titleParts(item.title)[0] || item.title)}</b><span class="grow"></span>${hlHtml(item, s.hl)}</div>
      <div class="r2 mono" style="font-size:${s.meta}px;margin-top:1px"><span style="width:${s.dateW}px;flex:0 0 ${s.dateW}px"></span><b style="color:${catColor[item.category] || '#050505'}">${esc(labels[item.category] || '')}</b><span class="dim clip" style="margin-left:5px">${esc(place(item))}</span><span class="grow"></span><b class="${soon ? 'soon' : ''}">${d === null ? '—' : 'T-' + d}</b><span class="dim" style="margin-left:5px">${esc(item.highlight_label || '')}</span></div>
    </div>`;
  }
  const restLine = (calls, n) => calls.length > n
    ? `另有 ${calls.length - n} 项 · ` + calls.slice(n, n + 2).map(c => `${fmtDate(c)} ${titleParts(c.title)[0]}`).join(' · ') : '';

  function widgetView() {
    const calls = sorted().filter(c => !isClosed(c));
    const first = calls[0];
    const issue = esc((data.issue_id || '').replace(/^\d{4}-/, ''));
    const fig = (cls, name, size, note, inner) => `<figure class="wg-item" style="margin:0">
      <figcaption class="wg-cap"><b>${name}</b><span>${size}</span></figcaption>
      <div class="wg-scroll"><div class="wg ${cls}" role="img" aria-label="${name}小组件预览：${esc(note)}">${inner}</div></div></figure>`;

    const small = first ? `<div class="row mono" style="font-size:9px"><b>MAR ↗</b><span class="grow"></span><span class="dim">${issue}</span></div>
      <div class="grow"></div>
      <div class="it ${isSoon(first) ? 'soon' : ''}" style="font-size:58px;line-height:.8;letter-spacing:-.05em">${esc(fmtDate(first))}</div>
      <b style="font-size:11px;margin-top:8px" class="clip">${esc(titleParts(first.title)[0])}</b>
      <div class="mono dim" style="font-size:8px;margin-top:3px">${esc(daysText(first))}</div>` : '';

    const med = calls.slice(0, 4).map(c => wgRow(c, { dateW: 36, date: 13.5, title: 10, hl: 12, meta: 7 })).join('<div style="height:3px;flex:0 0 auto"></div>')
      + `<div class="grow"></div><div class="row mono" style="font-size:7px"><span class="dim clip">${esc(restLine(calls, 4))}</span><span class="grow"></span><span class="dim">${issue} · 已同步</span></div>`;

    const lg = `<div class="row" style="align-items:flex-end"><b style="font-size:10px">MEDIA ART</b><span class="it" style="margin-left:6px;font-size:18px">Radar ↗</span><span class="grow"></span><span class="mono dim" style="font-size:8.5px">${issue} · ${two(calls.length)} 项机会</span></div><div style="height:8px"></div>`
      + calls.slice(0, 5).map(c => `<div class="wg-card" style="width:100%;height:54px;border-radius:16px 4px 16px 4px;padding:8px 14px;margin-bottom:5px">${wgRow(c, { dateW: 50, date: 19, title: 12, hl: 16, meta: 7.5 })}</div>`).join('')
      + `<div class="grow"></div>`;

    const cell = c => `<div class="wg-cell">
      <div class="row mono" style="font-size:8px"><b style="color:${catColor[c.category] || '#050505'}">${esc(labels[c.category] || '')}</b><span class="grow"></span><b class="${isSoon(c) ? 'soon' : ''}">T-${daysLeft(c)}</b></div>
      <div class="grow"></div>
      <div class="it ${isSoon(c) ? 'soon' : ''}" style="font-size:38px;line-height:.85;letter-spacing:-.05em">${esc(fmtDate(c))}</div>
      <b class="clip" style="font-size:11px;margin-top:8px">${esc(titleParts(c.title)[0])}</b>
      <div class="row" style="margin-top:3px">${hlHtml(c, 13)}<span class="grow"></span><span class="mono dim clip" style="font-size:7.5px">${esc(place(c))}</span></div></div>`;
    const xl = `<div class="wg-grid">${calls.slice(0, 5).map(cell).join('')}<div class="wg-cell" style="border-color:transparent;justify-content:flex-end;padding:12px 6px"><b style="font-size:10px">MEDIA ART</b><span class="it" style="font-size:26px;line-height:1">Radar ↗</span><span class="mono dim" style="font-size:8.5px;margin-top:6px">${issue} · ${two(calls.length)} 项机会</span></div></div>`;

    return `<section class="view">
      <header class="page-head">
        <h1><span>小组件</span><em>Widgets.</em></h1>
        <div class="page-meta"><span>03 / Widgets · iPhone 17 Pro Max · Mac</span><span>${esc(data.issue_id || '')}</span></div>
      <div class="pill-row"><a class="pill solid" href="Media-Art-Radar.js?v=7" download>下载脚本 ↓</a><a class="pill" href="install.html">安装说明 ↗</a></div>
      </header>
      <div class="wg-list">
        ${fig('wg-s', '小号', '170 × 170', '下一个截止', small)}
        ${fig('wg-m', '中号', '364 × 170', '四个机会', med)}
        ${fig('wg-l', '大号', '364 × 382', '五个机会', lg)}
        ${fig('wg-xl', '超大号', 'Mac / iPad · 3 × 2', '五个机会加刊头', xl)}
      </div>
    </section>`;
  }

  // ---------- 路由 ----------
  function parseHash() {
    const raw = location.hash.replace(/^#/, '');
    const [route, filter] = raw.split('/');
    if (route === 'focus') return { route: 'focus', filter: 'all' };
    if (route === 'widget') return { route: 'widget', filter: 'all' };
    if (route === 'opportunities') return { route: 'opportunities', filter: labels[filter] ? filter : 'all' };
    return { route: 'opportunities', filter: 'all' };
  }

  function render(route, filter = 'all', push = false) {
    if (!data) return;
    syncRail(route, filter);
    $('#view').innerHTML = route === 'focus' ? focusView() : route === 'widget' ? widgetView() : opportunitiesView(filter);
    $('#stage').scrollTop = 0;
    window.scrollTo(0, 0);
    if (push) {
      const hash = route === 'opportunities' && filter !== 'all' ? '#opportunities/' + filter : '#' + route;
      if (location.hash !== hash) history.pushState(null, '', hash);
    }
  }

  // 卡片里的「项目详情」：只展开这一张卡，按钮文字与 aria 同步
  $('#view').addEventListener('click', e => {
    const reset = e.target.closest('.reset-filter');
    if (reset) { render('opportunities', 'all', true); return; }
    const btn = e.target.closest('.btn-ghost');
    if (!btn) return;
    const card = btn.closest('.call-card');
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? '收起 −' : '更多信息 +';
    $('.facts', card).hidden = !open;
  });

  $$('.tile').forEach(btn => btn.addEventListener('click', () => {
    render(btn.dataset.route || 'opportunities', btn.dataset.filter || 'all', true);
  }));
  $('.wordmark').addEventListener('click', e => { e.preventDefault(); render('opportunities', 'all', true); });
  addEventListener('popstate', () => { const s = parseHash(); render(s.route, s.filter, false); });

  fetch(DATA_URL, { cache: 'no-store' })
    .then(r => r.json())
    .then(json => { data = json; const s = parseHash(); render(s.route, s.filter, false); })
    .catch(() => { $('#view').innerHTML = '<div class="view"><div class="empty">数据暂时无法读取，请稍后刷新。</div></div>'; });
})();
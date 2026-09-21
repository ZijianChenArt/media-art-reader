(() => {
  const DATA_URL = '../../latest.json';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const two = n => String(n).padStart(2, '0');
  const labels = { exhibition: '展览征集', residency: '驻留', prize: '奖项', conference: '学术会议' };
  const enLabels = { exhibition: 'Exhibitions', residency: 'Residencies', prize: 'Prizes', conference: 'Conferences' };
  const imgs = ['../../assets/diatomic-garden.jpg', '../../assets/conspiratorial-design.jpg'];
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const SOON_DAYS = 14;
  let data = null;

  // ---------- 分类符号：● 展览  ○ 驻留  ◆ 奖项  ▲ 会议（不靠颜色区分） ----------
  const SHAPES = {
    exhibition: '<circle cx="6" cy="6" r="5" fill="currentColor"/>',
    residency: '<circle cx="6" cy="6" r="4.2" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    prize: '<path d="M6 .6 11.4 6 6 11.4.6 6z" fill="currentColor"/>',
    conference: '<path d="M6 .9 11.3 10.6H.7z" fill="currentColor"/>'
  };
  const svgOf = c => `<svg viewBox="0 0 12 12" aria-hidden="true">${SHAPES[c] || SHAPES.exhibition}</svg>`;
  const glyph = c => `<i class="g">${svgOf(c)}</i>`;
  $$('[data-g]').forEach(el => { el.innerHTML = svgOf(el.dataset.g); });

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
  const tnOf = item => { const d = daysLeft(item); return d === null ? 'TBA' : 'T-' + d; };
  const titleParts = t => String(t || '').split('/').map(x => x.trim()).filter(Boolean);
  const place = item => String(item.location || '').split(/[；;·，,。]/)[0].trim().slice(0, 22);
  const firstSentence = s => String(s || '').split(/[；。]/)[0].trim();
  const sorted = () => (data.open_calls || []).slice().sort((a, b) => {
    const ca = isClosed(a), cb = isClosed(b);
    if (ca !== cb) return ca ? 1 : -1;
    return Date.parse(a.deadline_at) - Date.parse(b.deadline_at);
  });

  // ---------- 左栏 ----------
  function syncRail(route, filter) {
    const calls = data.open_calls || [];
    const counts = { all: calls.length };
    Object.keys(labels).forEach(k => { counts[k] = calls.filter(c => c.category === k).length; });
    $$('[data-count]').forEach(el => {
      const k = el.dataset.count;
      el.textContent = two(counts[k] || 0);
      el.closest('.nav').classList.toggle('is-empty', k !== 'all' && !counts[k]);
    });
    document.body.dataset.route = route;
    $$('.nav').forEach(t => {
      const on = route === 'opportunities'
        ? t.dataset.route === 'opportunities' && (t.dataset.filter || 'all') === filter
        : t.dataset.route === route;
      t.classList.toggle('is-active', on);
      t.classList.toggle('in-section', route === 'opportunities' && t.dataset.filter === 'all');
      if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    });
    $('#status-issue').textContent = String(data.issue_id || '—').replace(/^\d{4}-/, '');
    const ver = (calls.map(c => c.verified_at).filter(Boolean).sort().pop() || '').slice(5, 10).replace('-', '.');
    $('#status-verified').textContent = ver ? '核验 ' + ver : '';
  }

  // ---------- 雷达：截止日时间轴 ----------
  // 左端是今天，每个截止日是轴上一个信号点；14 天内的画一圈「回波」并把轴的前 14 天加粗。
  function radarHtml(calls, filter) {
    const open = calls.filter(c => !isClosed(c) && daysLeft(c) !== null);
    if (!open.length) return '';
    const dom = Math.max(60, Math.max(...open.map(daysLeft)) + 8);
    const at = d => Math.min(98, Math.max(0, d / dom * 100));
    const now = new Date(); now.setHours(0, 0, 0, 0);

    let ticks = '';
    for (let k = 1; k < 8; k++) {
      const first = new Date(now.getFullYear(), now.getMonth() + k, 1);
      const d = Math.round((first - now) / 86400000);
      if (d >= dom - 3) break;
      ticks += `<span class="tick" style="left:${at(d)}%"><span>${MONTHS[first.getMonth()]}</span></span>`;
    }

    const blips = open.map((c, i) => {
      const p = at(daysLeft(c));
      const dim = filter !== 'all' && c.category !== filter;
      const name = titleParts(c.title)[0] || c.title;
      return `<button class="blip ${i % 2 ? 'dn' : 'up'} ${p > 68 ? 'flip' : ''} ${isSoon(c) ? 'soon' : ''} ${dim ? 'is-dim' : ''}" type="button" style="left:${p}%" data-id="${esc(c.id)}" data-jump="${esc(c.id)}" aria-label="${esc(fmtDate(c) + ' ' + name + '，' + daysText(c))}">
        ${glyph(c.category)}<span class="lab"><i>${esc(fmtDate(c))}<u>${esc(tnOf(c))}</u></i><b>${esc(name)}</b></span></button>`;
    }).join('');

    const legend = Object.keys(labels).map(k => `<span>${glyph(k)}${enLabels[k]}</span>`).join('');
    return `<figure class="radar" style="margin-inline:0">
      <div class="radar-head"><b>Deadlines · next ${Math.max(...open.map(daysLeft))} days</b><div class="legend" aria-hidden="true">${legend}</div></div>
      <div class="plot">
        ${ticks}
        <div class="axis"></div><div class="win" style="width:${at(SOON_DAYS)}%"></div>
        <div class="today"><span>今天 ${two(now.getMonth() + 1)}.${two(now.getDate())}</span></div>
        ${blips}
      </div>
    </figure>`;
  }

  // ---------- 台账里的一行 ----------
  // 详情分四组，但不截断原文：资助 / 时间 / 交通住宿 / 申请费 / 资格适合
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

  function keyHtml(item) {
    const v = item.highlight;
    if (!v) return '';
    const big = /\d/.test(v)
      ? `<b class="kv ${v.length >= 5 ? 'long' : ''}">${esc(v)}</b>`
      : `<b class="kt">${esc(v)}</b>`;
    return `<small>SUPPORT</small>${big}<span class="kl">${esc(item.highlight_label || '')}</span>`;
  }

  function renderRow(item, i) {
    const parts = titleParts(item.title);
    const brief = firstSentence(item.why);
    return `<article class="call ${isSoon(item) ? 'is-soon' : ''} ${isClosed(item) ? 'is-closed' : ''}" data-cat="${esc(item.category)}" data-id="${esc(item.id)}" id="call-${esc(item.id)}">
      <div class="c-date">
        <span class="c-lab">申请截止 · DEADLINE</span>
        <span class="c-d">${esc(fmtDate(item))}</span>
        <span class="c-t">${esc(daysText(item))}</span>
      </div>
      <div class="c-main">
        <div class="c-meta"><span class="c-cat">${glyph(item.category)}${esc(labels[item.category] || 'OPEN CALL')}</span><span class="c-place">${esc(place(item))}</span><span class="c-idx">${two(i + 1)}</span></div>
        <h2 class="c-title">${esc(parts[0] || item.title)}</h2>
        ${parts.length > 1 ? `<p class="c-sub">${esc(parts.slice(1).join(' / '))}</p>` : ''}
        ${brief ? `<p class="c-brief">${esc(brief)}。</p>` : ''}
        <div class="actions">
          <a class="btn btn-primary" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer"><span>官方页面</span><span>↗</span></a>
          <button class="btn btn-ghost" type="button" aria-expanded="false">更多信息 +</button>
        </div>
      </div>
      <div class="c-key">${keyHtml(item)}</div>
      ${factsHtml(item)}
    </article>`;
  }

  // 手机：机会细项（全部 / 展览 / 驻留 / 奖项 / 会议）放在标题下面，一眼看得全，不用横向滑动
  function mobileFilters(active) {
    const calls = data.open_calls || [];
    const items = [['all', '全部'], ...Object.keys(labels).map(k => [k, labels[k]])];
    return `<div class="mobile-filters" role="group" aria-label="机会分类">${items.map(([k, t]) => {
      const n = k === 'all' ? calls.length : calls.filter(c => c.category === k).length;
      return `<button class="mobile-filter ${active === k ? 'is-active' : ''} ${k !== 'all' && !n ? 'is-empty' : ''}" type="button" data-filter="${k}" aria-pressed="${active === k}">${k === 'all' ? '' : glyph(k)}${t}<span>${two(n)}</span></button>`;
    }).join('')}</div>`;
  }

  function opportunitiesView(filter) {
    const calls = sorted();
    const shown = filter === 'all' ? calls : calls.filter(x => x.category === filter);
    const label = filter === 'all' ? '全部机会' : (labels[filter] || filter);
    const rows = shown.length ? shown.map(renderRow).join('') : `<div class="empty">本期暂无${esc(label)}。</div>`;
    return `<section class="view">
      <header class="page-head">
        <h1><span>国际机会精选</span><em>Open calls.</em><sup>${two((data.open_calls || []).length)}</sup></h1>
        <div class="page-meta"><span>01 / Opportunities</span><span>${esc(data.issue_id || '')}</span></div>
      </header>
      ${mobileFilters(filter)}
      ${radarHtml(calls, filter)}
      <div class="toolbar">
        <div class="filter-status">${esc(label)}<span>${two(shown.length)}</span></div>
        <button class="reset-filter ${filter !== 'all' ? 'show' : ''}" type="button">全部机会</button>
      </div>
      <div class="ledger">${rows}</div>
      <p class="foot-note">按截止日期排列，摘要与推荐理由为编辑判断，不是官方排名。信息核验自各机构官方页面，投稿前请再次确认截止时区与条件。</p>
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
        ${items.map((item, i) => `<article class="fi">
          <div class="fi-img"><img src="${imgs[i] || imgs[0]}" alt="" loading="lazy"></div>
          <span class="fi-type">${esc(item.type || 'IN FOCUS')}</span>
          <h2>${esc(item.title)}</h2>
          <p class="author">${esc(item.author || '')}</p>
          <p class="sum">${esc(item.short_title || '')}</p>
          <a class="pill" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">阅读原文 ↗</a>
        </article>`).join('')}
      </div>
    </section>`;
  }

  // ---------- 小组件页：预览按同一套黑白语言绘制 ----------
  // 日期块：14 天内整块反黑，其余黑描边；分类靠符号。预览里的日期用 Bodoni Moda 斜体，真机上是 iOS 自带的 Didot 斜体。
  function hlHtml(item, base) {
    const v = item.highlight;
    if (!v) return '';
    if (!/\d/.test(v)) return `<span style="font-size:${Math.max(base * .5, 9)}px;color:#8a8a8a;font-weight:500">${esc(v)}</span>`;
    const size = v.length >= 5 ? Math.max(base * .68, 9) : base;
    return `<span class="it" style="font-size:${size}px">${esc(v)}</span>`;
  }
  const blockStyle = item => isSoon(item) ? 'background:#0a0a0a;color:#fff;border-color:#0a0a0a' : 'background:#fff;color:#0a0a0a';
  // 倒计时胶囊：块内反白；块外 14 天内黑底反白，其余描边
  const daysPill = (item, label, fs, h, inBlock) => {
    const cls = inBlock ? (isSoon(item) ? 'pl-inv' : '') : (isSoon(item) ? 'pl-ink' : '');
    return `<span class="pl ${cls}" style="font-size:${fs}px;height:${h}px;border-radius:${h / 2}px">${esc(label)}</span>`;
  };
  const catPill = (item, fs, h) =>
    `<span class="pl ${isSoon(item) ? 'pl-line' : ''}" style="font-size:${fs}px;height:${h}px;border-radius:${h / 2}px;background:transparent">${glyph(item.category)}${esc(labels[item.category] || '')}</span>`;

  function wgRow(item, s) {
    const soon = isSoon(item);
    return `<div class="wg-row">
      <div class="chipb" style="width:${s.chipW}px;height:${s.chipH}px;border-radius:${s.r};${blockStyle(item)}"><span class="it" style="font-size:${s.date}px">${esc(fmtDate(item))}</span></div>
      <div class="col" style="width:${s.colW}px;margin-left:${s.gap}px">
        <div class="r1"><b class="clip" style="font-size:${s.title}px">${esc(titleParts(item.title)[0] || item.title)}</b><span class="grow"></span>${hlHtml(item, s.hl)}</div>
        <div class="r2 mono" style="font-size:${s.meta}px">${glyph(item.category)}<b>${esc(labels[item.category] || '')}</b><span class="dim clip" style="margin-left:5px">${esc(place(item))}</span><span class="grow"></span>${soon ? daysPill(item, tnOf(item), s.meta, s.meta + 4) : `<b class="dim">${tnOf(item)}</b>`}<span class="faint" style="margin-left:5px">${esc(item.highlight_label || '')}</span></div>
      </div></div>`;
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
    const sub = item => isSoon(item) ? '#bdbdbd' : '#666';

    const small = first ? `<div class="pnl" style="width:150px;height:100px;${blockStyle(first)};border-radius:20px 20px 20px 5px;padding:9px 10px">
        <div class="row">${catPill(first, 7.5, 15)}<span class="grow"></span><span class="mono" style="font-size:7.5px;color:${sub(first)}">${issue}</span></div>
        <div class="grow"></div>
        <div class="row" style="align-items:flex-end"><span class="it" style="font-size:44px;line-height:.9">${esc(fmtDate(first))}</span><span class="grow"></span>${daysPill(first, tnOf(first), 8, 14, true)}</div>
      </div>
      <div style="height:7px"></div>
      <div style="padding:0 4px"><b class="clip" style="font-size:12px;display:block">${esc(titleParts(first.title)[0])}</b>
        <div class="row" style="margin-top:3px"><span class="mono dim" style="font-size:8px">申请截止</span><span class="grow"></span>${hlHtml(first, 13)}</div></div>` : '';

    const mS = { chipW: 46, chipH: 26, r: '9px 9px 9px 3px', gap: 8, colW: 340 - 46 - 8, date: 14, title: 10.5, hl: 12, meta: 7 };
    const med = calls.slice(0, 4).map(c => wgRow(c, mS)).join('<div style="height:3px;flex:0 0 auto"></div>')
      + `<div class="grow"></div><div class="row mono" style="font-size:7px"><span class="faint clip">${esc(restLine(calls, 4))}</span><span class="grow"></span><span class="faint">${issue} · 已同步</span></div>`;

    const lS = { chipW: 78, chipH: 42, r: '14px 14px 14px 4px', gap: 10, colW: 336 - 18 - 78 - 10 - 2, date: 22, title: 12.5, hl: 16, meta: 7.5 };
    const lg = `<div class="row" style="align-items:flex-end"><b style="font-size:10px">MEDIA ART</b><span class="it" style="margin-left:6px;font-size:18px">Radar ↗</span><span class="grow"></span><span class="mono dim" style="font-size:8.5px">${issue} · ${two(calls.length)} 项机会</span></div><div style="height:8px"></div>`
      + calls.slice(0, 5).map(c => `<div class="wg-card" style="width:336px;height:54px;border-radius:18px 5px 18px 5px;padding:0 12px 0 6px;margin-bottom:5px">${wgRow(c, lS)}</div>`).join('')
      + `<div class="grow"></div><div class="hair"></div><div class="row mono faint" style="font-size:8px;margin-top:6px"><span>核验 ${esc(String(first && first.verified_at || '').slice(5, 10).replace('-', '.'))}</span><span class="grow"></span><span>已同步</span></div>`;

    const cell = c => `<div class="wg-card" style="width:217px;height:151px;border-radius:26px 6px 26px 6px;padding:8px">
      <div class="pnl" style="width:201px;height:84px;${blockStyle(c)};border-radius:19px 19px 19px 5px;padding:8px 10px">
        <div class="row">${catPill(c, 7, 14)}<span class="mono clip" style="font-size:7px;margin-left:5px;color:${sub(c)}">${esc(place(c))}</span></div>
        <div class="grow"></div>
        <div class="row" style="align-items:flex-end"><span class="it" style="font-size:38px;line-height:.9">${esc(fmtDate(c))}</span><span class="grow"></span>${daysPill(c, tnOf(c) + ' DAYS', 7, 13, true)}</div>
      </div>
      <div style="height:6px"></div>
      <div style="padding:0 4px"><b class="clip" style="font-size:12px;display:block">${esc(titleParts(c.title)[0])}</b>
        <div class="row" style="margin-top:2px">${hlHtml(c, 14)}<span class="mono dim clip" style="font-size:7px;margin-left:5px">${esc(c.highlight_label || '')}</span><span class="grow"></span><span class="mono faint" style="font-size:7px">申请截止</span></div></div></div>`;
    const xl = `<div class="wg-grid">
      <div class="wg-card" style="width:217px;height:151px;border-radius:26px 6px 26px 6px;background:#0a0a0a;border-color:#0a0a0a;color:#fff;padding:14px 16px 12px 14px">
        <b style="font-size:10px">MEDIA ART</b><span class="it" style="font-size:28px;line-height:1.1">Radar ↗</span><div class="grow"></div>
        <b class="mono" style="font-size:10px">${issue}</b><span class="mono" style="font-size:8.5px;color:#bdbdbd;margin-top:2px">${two(calls.length)} 项机会</span></div>
      ${calls.slice(0, 5).map(cell).join('')}</div>`;

    return `<section class="view">
      <header class="page-head">
        <h1><span>小组件</span><em>Widgets.</em></h1>
        <div class="page-meta"><span>03 / Widgets · iPhone · Mac</span><span>${esc(data.issue_id || '')}</span></div>
      </header>

      <div class="sec-h"><h2>安装</h2><em>Install.</em></div>
      <div class="pill-row">
        <a class="pill solid" href="../../Media-Art-Radar.js" download>下载组件脚本 ↓</a>
        <a class="pill" href="#steps" data-scroll="steps">安装步骤 ↓</a>
      </div>
      <p class="note">Scriptable 脚本 · 已装过旧版？整份替换原脚本，保存并运行一次即可。</p>

      <div class="sec-h"><h2>四个尺寸</h2><em>Four sizes.</em></div>
      <div class="wg-list">
        ${fig('wg-s', '小号', '170 × 170', '下一个截止', small)}
        ${fig('wg-m', '中号', '364 × 170', '四个机会', med)}
        ${fig('wg-l', '大号', '364 × 382', '五个机会', lg)}
        ${fig('wg-xl', '超大号', 'Mac / iPad · 3 × 2 · 约 715 × 342', '五个机会加刊头', xl)}
      </div>

      <div class="panel">
        <p><b>与网站同一套语言。</b>只有黑与白：分类用符号区分（● 展览 ○ 驻留 ◆ 奖项 ▲ 会议），14 天内截止的日期块整块反黑，其余是黑描边。</p>
        <p><b>不主推任何一个机会。</b>中号与大号里每个机会都是同样的一块：左边日期块，右边标题、关键数字、分类、地点和倒计时。尽量多放；放不下的压成最底下的一行小字，写明还有几项。</p>
        <p><b>关于尺寸。</b>预览按 iPhone 17 Pro Max 的组件点数绘制，其他机型点数略有差异，脚本会取最接近的一档。超大号只有 Mac 与 iPad 才有。</p>
        <p><b>关于字体。</b>日期与英文在 iPhone 上用系统自带的 Didot 斜体，网页用 Bodoni Moda 斜体，形态接近但不完全相同。</p>
      </div>

      <div class="sec-h" id="steps"><h2>步骤</h2><em>Steps.</em></div>
      <ol class="steps">
        <li>在 Scriptable 中新建脚本，把下载文件里的代码完整粘贴进去，运行一次确认能取到数据。</li>
        <li>长按 iPhone 主屏幕 → 加号 → 选择 Scriptable → 挑尺寸（小 / 中 / 大）添加。在 Mac 或 iPad 上添加 Scriptable 小组件时可以选「超大」，脚本相同。</li>
        <li>长按刚添加的组件 → 编辑小组件 → Script 选择刚保存的那个脚本。</li>
        <li>中号、大号和超大号点击每个机会会打开对应的官方页面；小号点击打开本站。</li>
      </ol>
      <div class="panel">
        <p><b>已经装过旧版？</b>把新代码完整替换进原来的 Scriptable 脚本，保留脚本名称，保存并运行一次即可。四个尺寸共用同一份脚本。</p>
        <p><b>更新节奏。</b>内容每周更新，脚本不需要每周重新下载，只有样式改版时才需要替换。刷新时机由 iOS 决定，脚本声明的是 60 分钟。</p>
        <p><b>数据来源。</b>脚本直接读取本站公开的 <a href="../../latest.json">latest.json</a>，仅在本机保存一份缓存。截止时区与提前关闭条件以官方页面为准。</p>
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

  // 时间轴上的点与台账里的行互相呼应：悬停同亮，点击跳到那一行
  const hot = (id, on) => $$('[data-id]').forEach(el => { if (el.dataset.id === id) el.classList.toggle('is-hot', on); });
  $('#view').addEventListener('mouseover', e => { const el = e.target.closest('[data-id]'); if (el) hot(el.dataset.id, true); });
  $('#view').addEventListener('mouseout', e => { const el = e.target.closest('[data-id]'); if (el) hot(el.dataset.id, false); });

  $('#view').addEventListener('click', e => {
    const reset = e.target.closest('.reset-filter');
    if (reset) { render('opportunities', 'all', true); return; }
    const mf = e.target.closest('.mobile-filter');
    if (mf) { render('opportunities', mf.dataset.filter, true); return; }
    const blip = e.target.closest('[data-jump]');
    if (blip) {
      const row = document.getElementById('call-' + blip.dataset.jump);
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'start' });
        hot(blip.dataset.jump, true);
        setTimeout(() => hot(blip.dataset.jump, false), 1800);
      }
      return;
    }
    const jump = e.target.closest('[data-scroll]');
    if (jump) {
      e.preventDefault();
      const el = document.getElementById(jump.dataset.scroll);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const btn = e.target.closest('.btn-ghost');
    if (!btn) return;
    const row = btn.closest('.call');
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? '收起 −' : '更多信息 +';
    $('.facts', row).hidden = !open;
  });

  $$('.nav').forEach(btn => btn.addEventListener('click', () => {
    render(btn.dataset.route || 'opportunities', btn.dataset.filter || 'all', true);
  }));
  $('.brand').addEventListener('click', e => { e.preventDefault(); render('opportunities', 'all', true); });
  addEventListener('popstate', () => { const s = parseHash(); render(s.route, s.filter, false); });

  fetch(DATA_URL, { cache: 'no-store' })
    .then(r => r.json())
    .then(json => { data = json; const s = parseHash(); render(s.route, s.filter, false); })
    .catch(() => { $('#view').innerHTML = '<div class="view"><div class="empty">数据暂时无法读取，请稍后刷新。</div></div>'; });
})();

window.MediaArtPages ||= {};
window.MediaArtPages["home"] = function(){

/* site-v15.js */
(() => {
  const pageScope = window.MediaArtPage?.current;
  const listen = (target,...args) => {target?.addEventListener?.(...args);pageScope?.onCleanup(()=>target?.removeEventListener?.(...args));};
  const DATA_URL = new URL('latest.json', window.MediaArtNavigation?.root || location.href).href;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const two = n => String(n).padStart(2, '0');
  const labels = { exhibition: '展览征集', residency: '驻留', prize: '奖项', conference: '学术会议' };
  const enLabels = { exhibition: 'Exhibitions', residency: 'Residencies', prize: 'Prizes', conference: 'Conferences' };
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
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
  const dateHtml = item => esc(fmtDate(item)).replace('.', '<span class="date-dot">.</span>');
  const isClosed = item => { const d = daysLeft(item); return d !== null && d < 0; };
  const daysText = item => {
    const d = daysLeft(item);
    if (d === null) return 'DATE TBA';
    if (d < 0) return 'CLOSED';
    if (d === 0) return 'TODAY';
    return 'T−' + d + ' DAYS';
  };
  const tnOf = item => { const d = daysLeft(item); return d === null ? 'TBA' : d < 0 ? 'CLOSED' : d === 0 ? 'TODAY' : 'T−' + d; };
  const titleParts = t => String(t || '').split('/').map(x => x.trim()).filter(Boolean);
  const place = item => String(item.location || '').split(/[；;·，,。]/)[0].trim().slice(0, 22);
  const firstSentence = s => String(s || '').split(/[；。]/)[0].trim();
  const sorted = () => (data.open_calls || []).slice().sort((a, b) => {
    const ca = isClosed(a), cb = isClosed(b);
    if (ca !== cb) return ca ? 1 : -1;
    return Date.parse(a.deadline_at) - Date.parse(b.deadline_at);
  });

  function syncRail(route) {document.body.dataset.route=route;}
  function fitBrand() {}
  // ---------- 标题的光学左对齐 ----------
  // 每个字形的左侧留白不同（英文斜体的 I 往左出头 3px，W 往右缩 5px），行首的字要按真实墨迹补回，
  // 否则各页标题的左缘参差不齐。手机上中文与英文各占一行，都要补；桌面上英文紧跟中文，只补第一个。
  const titleCtx = document.createElement('canvas').getContext('2d');
  function alignTitle() {
    const h1 = $('.page-head h1');
    if (!h1) return;
    const mobile = matchMedia('(max-width:860px)').matches;
    [...h1.children].forEach((k, i) => {
      k.style.removeProperty('margin-left');
      if (!('letterSpacing' in titleCtx) || !(i === 0 || mobile)) return;
      const cs = getComputedStyle(k);
      titleCtx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      titleCtx.letterSpacing = cs.letterSpacing;
      k.style.marginLeft = titleCtx.measureText(k.textContent).actualBoundingBoxLeft + 'px';
    });
  }
  document.fonts?.ready.then(() => {
    if(pageScope && !pageScope.active)return;
    fitBrand(); alignTitle(); layoutTimeline();
    if (data && document.body.dataset.route === 'widget') { const y = $('#radar-stage').scrollTop; render('widget', 'all', false); $('#radar-stage').scrollTop = y; }
  });
  listen(window, 'resize', () => { fitBrand(); alignTitle(); layoutTimeline(); });

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
      return `<button class="blip ${i % 2 ? 'dn' : 'up'} ${p > 68 ? 'flip' : ''} ${dim ? 'is-dim' : ''}" type="button" style="left:${p}%" data-id="${esc(c.id)}" data-jump="${esc(c.id)}" title="${esc(name)}" aria-label="${esc(fmtDate(c) + ' ' + name + '，' + daysText(c))}">
        ${glyph(c.category)}<span class="lab"><i>${dateHtml(c)}<u>${esc(tnOf(c))}</u></i><b>${esc(name)}</b></span></button>`;
    }).join('');

    const legend = Object.keys(labels).map(k => `<span>${glyph(k)}${enLabels[k]}</span>`).join('');
    return `<section class="sec sec-radar">
      <div class="sec-h"><h2>截止时间轴</h2><em>Timeline</em><span class="sec-n">NEXT ${Math.max(...open.map(daysLeft))} DAYS</span><div class="sec-x legend" aria-hidden="true">${legend}</div></div>
      <div class="card pad radar">
      <div class="plot">
        ${ticks}
        <div class="axis"></div>
        <div class="today"><span>今天 ${two(now.getMonth() + 1)}<span class="date-dot">.</span>${two(now.getDate())}</span></div>
        ${blips}
      </div>
      </div>
    </section>`;
  }

  // 按实际文字宽度分配上下层级；新增机会时，标签不会挤在同一行。
  function layoutTimeline() {
    const plot = $('.plot');
    if (!plot || !plot.clientWidth) return;
    const width = plot.clientWidth;
    const occupied = { up: [], dn: [] };
    const counts = { up: 0, dn: 0 };
    const blips = $$('.blip', plot).sort((a, b) => parseFloat(a.style.left) - parseFloat(b.style.left));
    blips.forEach((blip, index) => {
      const x = parseFloat(blip.style.left) * width / 100;
      const flip = x > width * .55;
      blip.classList.toggle('flip', flip);
      const lab = $('.lab', blip);
      lab.style.maxWidth = `${Math.max(70, Math.min(210, flip ? x - 12 : width - x - 12))}px`;
      const labelWidth = lab.getBoundingClientRect().width;
      const start = flip ? x - labelWidth : x;
      const end = flip ? x : x + labelWidth;
      const preferred = index % 2 ? 'dn' : 'up';
      let placement;
      for (let lane = 0; !placement; lane++) {
        for (const side of [preferred, preferred === 'up' ? 'dn' : 'up']) {
          const spans = occupied[side][lane] || [];
          if (spans.every(span => end + 12 <= span.start || start >= span.end + 12)) {
            placement = { side, lane };
            spans.push({ start, end });
            occupied[side][lane] = spans;
            break;
          }
        }
      }
      blip.classList.toggle('up', placement.side === 'up');
      blip.classList.toggle('dn', placement.side === 'dn');
      blip.style.setProperty('--lane-height', `${70 + placement.lane * 60}px`);
      counts[placement.side] = Math.max(counts[placement.side], placement.lane + 1);
    });
    const upRows = Math.max(1, counts.up);
    const downRows = Math.max(1, counts.dn);
    plot.style.setProperty('--axis-y', `${28 + upRows * 60}px`);
    plot.style.setProperty('--plot-h', `${76 + (upRows + downRows) * 60}px`);
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
    return `<div class="facts" id="facts-${esc(item.id)}" hidden>
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
    return `<article class="call ${isClosed(item) ? 'is-closed' : ''} ${item.highlight ? '' : 'no-key'}" data-cat="${esc(item.category)}" data-id="${esc(item.id)}" id="call-${esc(item.id)}">
      <div class="c-date">
        <span class="c-lab">申请截止 · DEADLINE</span>
        <span class="c-d">${dateHtml(item)}</span>
        <span class="c-t">${esc(daysText(item))}</span>
      </div>
      <div class="c-main">
        <div class="c-meta"><span class="c-cat">${glyph(item.category)}${esc(item.category_label || labels[item.category] || 'OPEN CALL')}</span><span class="c-place">${esc(place(item))}</span><span class="c-idx">${two(i + 1)}</span></div>
        <h2 class="c-title">${esc(parts[0] || item.title)}</h2>
        ${parts.length > 1 ? `<p class="c-sub">${esc(parts.slice(1).join(' / '))}</p>` : ''}
        ${brief ? `<p class="c-brief">${esc(brief)}。</p>` : ''}
        <div class="actions">
          <a class="btn btn-primary" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer"><span>官方页面</span><span>↗</span></a>
          <button class="btn btn-ghost" type="button" aria-expanded="false" aria-controls="facts-${esc(item.id)}">更多信息 +</button>
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
    const en = filter === 'all' ? 'All calls' : (enLabels[filter] || '');
    const rows = shown.length ? shown.map(renderRow).join('') : `<div class="empty">本期暂无${esc(label)}。</div>`;
    return `<section class="view">
      <header class="page-head">
        <h1><span>国际机会精选</span><em>Open calls<span class="dot">.</span></em></h1>
        <div class="page-meta"><span>01 / Opportunities</span><span>${esc(data.issue_id || '')}</span></div>
      </header>
      <div class="sec-h mobile-opp-heading"><h2>${esc(label)}</h2><em>${esc(en)}</em><span class="sec-n">${two(shown.length)}</span></div>
      ${mobileFilters(filter)}
      ${radarHtml(calls, filter)}
      <section class="sec opportunity-list">
        <div class="sec-h"><h2>${esc(label)}</h2><em>${esc(en)}</em><span class="sec-n">${two(shown.length)}</span><div class="sec-x"><button class="reset-filter ${filter !== 'all' ? 'show' : ''}" type="button">全部机会</button></div></div>
        <div class="ledger">${rows}</div>
      </section>
      <p class="foot-note">按截止日期排列，摘要与推荐理由为编辑判断，不是官方排名。信息核验自各机构官方页面，投稿前请再次确认截止时区与条件。</p>
    </section>`;
  }

  // Widget previews mirror Media-Art-Radar.js. Only the browser renderer differs.
  const SIZES = {
    phone: { small: 176, mw: 378, lw: 378, lh: 393 },
    mac: { small: 162, mw: 341, lw: 342, lh: 342, xl: { w: 701, h: 342 } }
  };
  let widgetTheme = 'system';
  const widgetCategoryNames = { exhibition: '展览', residency: '驻留', prize: '奖项', conference: '学术会议' };
  const widgetSymbols = { exhibition: '●', residency: '○', prize: '◆', conference: '▲' };
  function widgetCategory(item) {
    const category = String(item.category || '').toLowerCase();
    if (widgetCategoryNames[category]) return category;
    const text = (String(item.title || '') + ' ' + String(item.type || '')).toLowerCase();
    if (/residen|驻留|驻村/.test(text)) return 'residency';
    if (/conference|symposium|cfp|paper|会议|论文/.test(text)) return 'conference';
    if (/prize|award|奖项|大奖/.test(text)) return 'prize';
    return 'exhibition';
  }
  function widgetDeadline(item) {
    const raw = item.deadline_at || item.deadline_date || item.deadline;
    if (!raw) return null;
    const match = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return new Date(+match[1], +match[2] - 1, +match[3], 23, 59, 59);
    const parsed = new Date(raw);
    return isNaN(parsed) ? null : parsed;
  }
  function widgetDays(item) {
    const deadline = widgetDeadline(item);
    if (!deadline) return null;
    const now = new Date();
    return Math.ceil((new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate()) -
      new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
  }
  function widgetCalls(items) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return items.filter(item => !widgetDeadline(item) || widgetDeadline(item) >= today)
      .slice().sort((a, b) => (widgetDeadline(a)?.getTime() ?? Number.MAX_SAFE_INTEGER) -
        (widgetDeadline(b)?.getTime() ?? Number.MAX_SAFE_INTEGER));
  }
  function widgetTimer(item) {
    const days = widgetDays(item);
    return days == null ? 'TBA' : days < 0 ? 'CLOSED' : days === 0 ? 'TODAY' : `T−${days}`;
  }
  function widgetStatus() {
    const generated = Date.parse(data.generated_at);
    return Number.isFinite(generated) && Date.now() - generated > 8 * 86400000 ? 'STALE' : 'LIVE';
  }
  const widgetTitle = item => {
    const title = String(item.title || item.name || 'Untitled').replace(/\s+/g, ' ').trim();
    return title.split('/')[0].trim() || title;
  };
  const widgetSubtitle = item => String(item.title || '').split('/').map(s => s.trim()).filter(Boolean).slice(1).join(' / ').slice(0, 46);
  const widgetPlace = item => String(item.location || item.country || '').trim().split(/[；;，,。·]/)[0].trim().slice(0, 25);
  const widgetHighlight = item => String(item.highlight || '').replace(/\s+/g, ' ').trim().slice(0, 34);
  const widgetDateParts = item => String(item.deadline_date || item.deadline_at || item.deadline || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  const widgetDate = item => {
    const p = widgetDateParts(item);
    return p ? `${p[2]}<span class="nc-date-dot">.</span>${p[3]}` : 'TBA';
  };
  const widgetCategoryLabel = item => {
    const category = widgetCategory(item);
    const upcoming = item.application_open_at && Date.now() < Date.parse(item.application_open_at);
    return `${widgetSymbols[category]} ${upcoming ? (item.application_open_short || '即将开放') : (item.widget_category_label || widgetCategoryNames[category])}`;
  };

  function widgetView() {
    const calls = widgetCalls(data.open_calls || []);
    const first = calls[0];
    const rawIssue = String(data.issue_id || 'MEDIA ART RADAR');
    const issue = esc(rawIssue.match(/W\d+/i)?.[0].toUpperCase() || rawIssue.replace(/^\d{4}-/, '').slice(0, 18));
    const state = widgetStatus(), total = two(calls.length);
    const timer = item => `<span class="nc-timer ${widgetDays(item) != null && widgetDays(item) <= 14 ? 'nc-urgent' : ''}">${esc(widgetTimer(item))}</span>`;
    const header = `<div class="nc-head"><b>MEDIA ART<span class="nc-brand-dot">.</span></b><span class="nc-kicker">OPPORTUNITIES</span><strong>${total}</strong></div><div class="nc-sub"><span>${issue}</span><span>${state}</span></div><div class="nc-rule nc-strong-rule"></div>`;
    const empty = `<div class="nc nc-empty"><div class="nc-head"><b>MEDIA ART<span class="nc-brand-dot">.</span></b></div><div class="nc-rule nc-strong-rule"></div><div class="nc-empty-body"><b>NO OPEN CALLS</b><span>目前暂无开放机会</span></div><div class="nc-sub">${state}</div></div>`;
    const footer = capacity => `<div class="nc-footer"><span>${issue} · ${state}</span><b>${calls.length > capacity ? '+ ' + (calls.length - capacity) + ' MORE →' : 'VIEW ALL →'}</b></div>`;
    const row = (item, index, h, dw, highlight, number) => `<div class="nc-oppRow" style="height:${h}px;--date-width:${dw}px">
      <div class="nc-dateCol"><span class="nc-dateBig">${widgetDate(item)}</span>${timer(item)}</div>
      <div class="nc-vline"></div>
      <div class="nc-oppBody">
        <div class="nc-oppMeta"><span class="nc-category">${esc(widgetCategoryLabel(item))}</span>${widgetPlace(item) ? `<span class="nc-location">　·　${esc(widgetPlace(item))}</span>` : ''}${number ? `<span class="nc-index">${two(index)}</span>` : ''}</div>
        <b class="nc-oppTitle">${esc(widgetTitle(item))}</b>
        <div class="nc-oppSub"><span>${esc(highlight && widgetHighlight(item) ? widgetHighlight(item) : widgetSubtitle(item))}</span><span class="nc-year">${esc(widgetDateParts(item)?.[1] || '')}</span></div>
      </div>
    </div>`;
    const small = !first ? empty : `<div class="nc nc-small">
      <div class="nc-brand"><b>MEDIA<span class="nc-mid">·</span>ART</b><strong>${total}</strong></div>
      <div class="nc-rule nc-strong-rule"></div>
      <div class="nc-meta-row"><span>${esc(widgetCategoryLabel(first))}</span>${timer(first)}</div>
      <div class="nc-date">${widgetDate(first)}</div>
      <b class="nc-title">${esc(widgetTitle(first))}</b>
      <div class="nc-small-footer"><div class="nc-rule"></div><div class="nc-bottom"><span>${esc(widgetPlace(first)) || issue}</span><span>${state}</span></div></div>
    </div>`;
    const medium = !first ? empty : `<div class="nc nc-medium">${header}<div class="nc-rows">${calls.slice(0, 2).map((item, i) => row(item, i + 1, 54, 54, false, false)).join('')}</div></div>`;
    const large = !first ? empty : `<div class="nc nc-large">${header}<div class="nc-rows">${calls.slice(0, 5).map((item, i) => row(item, i + 1, 57, 55, true, true)).join('')}</div>${footer(5)}</div>`;
    const xlItems = calls.slice(0, 8);
    const extraLarge = !first ? empty : `<div class="nc nc-xl">${header}<div class="nc-xlCols"><div class="nc-xlCol">${xlItems.slice(0, 4).map((item, i) => row(item, i + 1, 62, 54, true, true)).join('')}</div><div class="nc-xlSep"></div><div class="nc-xlCol">${xlItems.slice(4, 8).map((item, i) => row(item, i + 5, 62, 54, true, true)).join('')}</div></div>${footer(8)}</div>`;
    const fig = (cls, name, note, inner, w, h) => `<figure class="wg-item" style="margin:0"><figcaption class="wg-cap"><b>${name}</b><span>${w} × ${h}</span></figcaption><div class="wg-scroll"><div class="wg ${cls}" style="width:${w}px;height:${h}px" role="img" aria-label="${name}小组件预览：${note}">${inner}</div></div></figure>`;
    const P = SIZES.phone, M = SIZES.mac;
    return `<section class="view widget-view" data-widget-theme="${widgetTheme}">
      <header class="page-head"><h1><span>小组件</span><em>Widgets<span class="dot">.</span></em></h1><div class="page-meta"><span>03 / Widgets · iPhone · Mac</span><span>${esc(data.issue_id || '')}</span></div></header>
      <section class="sec">
        <div class="sec-h"><h2>安装</h2><em>Install</em><span class="sec-n">SCRIPTABLE</span></div>
        <article class="call two"><div class="c-date"><span class="c-lab">EDITION</span><span class="c-d">14</span><span class="c-t">${issue}</span></div><div class="c-main"><div class="c-meta"><span class="c-cat">${glyph('exhibition')}Scriptable 脚本</span><span class="c-place">iPhone · iPad · Mac</span></div><h2 class="c-title">下载组件脚本</h2><p class="c-sub">Widgets for iPhone, iPad &amp; Mac</p><p class="c-brief">已安装的脚本无需替换。本页预览已按同一份脚本对齐；首次安装时下载下方文件。</p><div class="actions"><a class="btn btn-primary" href="${esc(new URL('Media-Art-Radar.js?v=34',window.MediaArtNavigation?.root || location.href).href)}" download><span>下载脚本</span><span>↓</span></a><a class="btn btn-ghost" href="#steps" data-scroll="steps">安装步骤 ↓</a></div></div></article>
      </section>
      <section class="sec">
        <div class="sec-h"><h2>四个尺寸</h2><em>Four sizes</em><span class="sec-n">04</span></div>
        <label class="widget-theme-label">预览外观 <select data-widget-theme-control aria-label="小组件预览外观">${[['system','跟随系统'],['light','浅色'],['dark','深色']].map(([value,label]) => `<option value="${value}"${widgetTheme === value ? ' selected' : ''}>${label}</option>`).join('')}</select></label>
        <div class="wg-list">
          ${fig('wg-s', '小号 · iPhone', '下一个截止', small, P.small, P.small)}
          ${fig('wg-m', '中号 · iPhone', '两个机会', medium, P.mw, P.small)}
          ${fig('wg-l', '大号 · iPhone', '一行一个机会，最多五项', large, P.lw, P.lh)}
        </div>
        <div class="sec-h" style="margin-top:var(--sec)"><h2>在 Mac 桌面上</h2><em>On the Mac</em><span class="sec-n">参考尺寸</span></div>
        <div class="wg-list">
          ${fig('wg-s', '小号 · Mac', '下一个截止', small, M.small, M.small)}
          ${fig('wg-m', '中号 · Mac', '两个机会', medium, M.mw, M.small)}
          ${fig('wg-l', '大号 · Mac', '一行一个机会，最多五项', large, M.lw, M.lh)}
          ${fig('wg-xl', '超大号 · Mac / iPad', '两列各四项，最多八项', extraLarge, M.xl.w, M.xl.h)}
        </div>
      </section>
      <section class="sec" id="steps"><div class="sec-h"><h2>步骤</h2><em>Steps</em><span class="sec-n">04</span></div><ol class="card rows steps">
        <li>在 Scriptable 中新建脚本，把下载文件里的代码完整粘贴进去，运行一次确认能取到数据。</li>
        <li>长按 iPhone 主屏幕 → 添加小组件 → Scriptable → 选择小、中或大号。其他设备可用的尺寸以系统提供的选项为准。</li>
        <li>编辑刚添加的小组件，Script 选择刚保存的脚本。Parameter 留空即可，也可填写 exhibition、residency、prize 或 conference 筛选类别。</li>
        <li>小号点击打开首个机会的官方页面；其他尺寸点击每行打开对应官方页面，页脚打开完整机会列表。</li>
      </ol></section>
      <section class="sec"><div class="sec-h"><h2>说明</h2><em>Notes</em></div><div class="card rows">
        <p><b>与实际脚本对齐。</b>刊头和日期使用 Didot 衬线体，标题使用系统粗体。浅色、深色跟随系统，也可在上方切换预览；该选择只影响网页预览。</p>
        <p><b>四个尺寸。</b>小号显示最早截止的一项，中号两项，大号最多五项，超大号两列各四项。剩余数量显示在页脚。</p>
        <p><b>红色是点缀。</b>刊头句点、日期中的点与总数使用红色；14 天内截止的倒计时也用红色，其余倒计时为灰色。</p>
        <p><b>日期与状态。</b>预览按脚本的本地日历日期计算倒计时并排序；LIVE 表示最近八天内更新的数据，超过八天显示 STALE。准确截止时间与提前关闭条件仍以官方信息为准。</p>
        <p><b>关于尺寸。</b>这里保留 iPhone 与 Mac 的参考尺寸。脚本由系统决定组件大小，字体渲染、显示缩放与实际可用空间可能略有不同；浏览器没有 Didot 时使用衬线备用字体。</p>
        <p><b>更新节奏。</b>脚本无需每周重新下载。实际组件的刷新时机由系统决定，脚本请求每 60 分钟刷新，并在本机保留缓存。</p>
        <p><b>数据来源。</b>实际组件读取 <a href="https://media-art-weekly-radar.orangec0831.chatgpt.site/latest.json">Radar 数据源</a>；本站预览与机会列表共用同步后的 <a href="latest.json">latest.json</a>。本期数据更新时间：${esc(data.generated_at || '未标明')}。</p>
      </div></section>
    </section>`;
  }
  // Let the browser wrap naturally; shrink only when the allocated native title
  // area overflows, using the script's family-specific minimum scale factors.
  function fitWidgetText() {
    $$('.widget-view .nc-title, .widget-view .nc-oppTitle').forEach(title => {
      const small = title.classList.contains('nc-title');
      const base = small ? 14 : 13, minimum = base * (small ? .72 : .76);
      title.style.fontSize = base + 'px';
      for (let size = base; size > minimum && (title.scrollHeight > title.clientHeight + 1 || title.scrollWidth > title.clientWidth + 1);) {
        size = Math.max(minimum, size - .25);
        title.style.fontSize = size + 'px';
      }
    });
  }
  listen(document, 'change', event => {
    if (!event.target.matches('[data-widget-theme-control]')) return;
    const value = event.target.value;
    if (!['system', 'light', 'dark'].includes(value)) return;
    widgetTheme = value;
    const view = document.querySelector('.widget-view');
    if (view) view.dataset.widgetTheme = value;
  });

  function parseHash() {
    const raw = location.hash.replace(/^#/, '');
    const [route, filter] = raw.split('/');
    if (route === 'widget') return { route: 'widget', filter: 'all' };
    if (route === 'opportunities') return { route: 'opportunities', filter: labels[filter] ? filter : 'all' };
    return { route: 'opportunities', filter: 'all' };
  }

  function render(route, filter = 'all', push = false) {
    if (!data || (pageScope && !pageScope.active)) return;
    if(push && window.MediaArtNavigation){window.MediaArtNavigation.go(new URL(route==='opportunities'&&filter!=='all'?'#opportunities/'+filter:'#'+route,window.MediaArtNavigation.root));return;}
    syncRail(route, filter);
    $('#view').innerHTML = route === 'widget' ? widgetView() : opportunitiesView(filter);
    if (route === 'widget') fitWidgetText();
    $('#radar-stage').scrollTop = 0;
    window.scrollTo(0, 0);
    fitBrand();
    alignTitle();
    layoutTimeline();
    if (push) {
      const hash = route === 'opportunities' && filter !== 'all' ? '#opportunities/' + filter : '#' + route;
      if (location.hash !== hash) history.pushState(null, '', hash);
    }
  }

  // 时间轴 / 极坐标 / 下一个截止 与台账里的卡片互相呼应：悬停同亮，点击跳到那一张
  const hot = (id, on) => $$('[data-id]').forEach(el => { if (el.dataset.id === id) el.classList.toggle('is-hot', on); });
  listen(window, 'mouseover', e => { const el = e.target.closest && e.target.closest('[data-id]'); if (el) hot(el.dataset.id, true); });
  listen(window, 'mouseout', e => { const el = e.target.closest && e.target.closest('[data-id]'); if (el) hot(el.dataset.id, false); });
  function jumpTo(id) {
    let row = document.getElementById('call-' + id);
    if (!row) { const s = parseHash(); if (s.route !== 'opportunities' || s.filter !== 'all' || !document.querySelector('.ledger')) { render('opportunities', 'all', true); row = document.getElementById('call-' + id); } }
    if (!row) return;
    row.scrollIntoView({ behavior: 'smooth', block: 'start' });
    hot(id, true);
    setTimeout(() => hot(id, false), 1800);
  }
  listen(document, 'click', e => { const j = e.target.closest('[data-jump]'); if (j) jumpTo(j.dataset.jump); });

  const detailAnimations = new WeakMap();
  function revealFacts(panel, open) {
    // Capture the current visual state so rapid clicks reverse without jumping.
    const current = getComputedStyle(panel);
    const start = { height: `${panel.getBoundingClientRect().height}px`, opacity: panel.hidden ? 0 : current.opacity,
      paddingTop: panel.hidden ? '0px' : current.paddingTop, paddingBottom: panel.hidden ? '0px' : current.paddingBottom,
      borderTopWidth: panel.hidden ? '0px' : current.borderTopWidth };
    detailAnimations.get(panel)?.cancel();
    panel.hidden = false;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !panel.animate) {
      panel.hidden = !open; detailAnimations.delete(panel); return;
    }
    const natural = getComputedStyle(panel);
    const end = open ? { height: `${panel.getBoundingClientRect().height}px`, opacity: 1,
      paddingTop: natural.paddingTop, paddingBottom: natural.paddingBottom, borderTopWidth: natural.borderTopWidth }
      : { height: '0px', opacity: 0, paddingTop: '0px', paddingBottom: '0px', borderTopWidth: '0px' };
    const animation = panel.animate([start, end], { duration: 320, easing: 'cubic-bezier(.22,1,.36,1)' });
    detailAnimations.set(panel, animation);
    animation.onfinish = () => {
      if (detailAnimations.get(panel) !== animation) return;
      panel.hidden = !open; detailAnimations.delete(panel);
    };
  }
  $('#view').addEventListener('click', e => {
    const reset = e.target.closest('.reset-filter');
    if (reset) { render('opportunities', 'all', true); return; }
    const mf = e.target.closest('.mobile-filter');
    if (mf) { render('opportunities', mf.dataset.filter, true); return; }
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
    revealFacts($('.facts', row), open);
  });

  listen(window, 'media-route', () => { const s = parseHash(); render(s.route, s.filter, false);window.dispatchEvent(new Event('media-content-ready')); });

  fetch(DATA_URL, { cache: 'no-store' })
    .then(r => r.json())
    .then(json => { if(pageScope && !pageScope.active)return;data = json; const s = parseHash(); render(s.route, s.filter, false);window.dispatchEvent(new Event('media-content-ready')); })
    .catch(() => { if(pageScope && !pageScope.active)return;$('#view').innerHTML = '<div class="view"><div class="empty">数据暂时无法读取，请稍后刷新。</div></div>'; });
})();



};

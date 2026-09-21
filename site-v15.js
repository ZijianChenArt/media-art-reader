(() => {
  const DATA_URL = 'latest.json';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const two = n => String(n).padStart(2, '0');
  const labels = { exhibition: '展览征集', residency: '驻留', prize: '奖项', conference: '学术会议' };
  const enLabels = { exhibition: 'Exhibitions', residency: 'Residencies', prize: 'Prizes', conference: 'Conferences' };
  const imgs = ['assets/diatomic-garden.jpg', 'assets/conspiratorial-design.jpg'];
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
  const isClosed = item => { const d = daysLeft(item); return d !== null && d < 0; };
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



  // ---------- 字标：宽度 = 下方方块的宽度，高度 = 右侧标题的高度，基线与标题对齐 ----------
  // 用 canvas 量真实墨迹（含负字距）反推字号；再用探针量出标题的基线，把字标的基线放到同一条线上。
  const brandCtx = document.createElement('canvas').getContext('2d');
  function fitBrand() {
    const t = $('#brand-t'), g = $('.group'), h1 = $('.page-head h1');
    if (!t) return;
    if (matchMedia('(max-width:860px)').matches || !g || !h1 || !('letterSpacing' in brandCtx)) {
      ['font-size', 'margin-left', 'margin-top'].forEach(k => t.style.removeProperty(k));
      document.documentElement.style.removeProperty('--title-h');
      return;
    }
    brandCtx.font = 'italic 400 100px Instrument';
    brandCtx.letterSpacing = '-2px';                       // = -.02em
    const m = brandCtx.measureText('Media Art');
    const ink = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
    if (!ink) return;
    const k = g.getBoundingClientRect().width / ink;                 // 目标宽度 / 100px 时的墨迹宽度
    const size = 100 * k;
    t.style.fontSize = size + 'px';
    t.style.marginLeft = (m.actualBoundingBoxLeft * k) + 'px';       // 左侧留白补回来，墨迹左缘贴齐
    // 标题高度 → 字标区高度；标题基线 → 字标基线（line-height:1 时基线距顶 = 半行距 + 字体上伸）
    const box = h1.getBoundingClientRect();
    document.documentElement.style.setProperty('--title-h', box.height + 'px');
    const probe = document.createElement('span');
    probe.style.cssText = 'display:inline-block;width:0;height:0';
    h1.appendChild(probe);
    const baseline = probe.getBoundingClientRect().bottom - box.top;
    probe.remove();
    const fA = m.fontBoundingBoxAscent * k, fD = m.fontBoundingBoxDescent * k;
    t.style.marginTop = (baseline - ((size - (fA + fD)) / 2 + fA)) + 'px';
  }
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
  document.fonts.ready.then(() => {
    fitBrand(); alignTitle();
    if (data && document.body.dataset.route === 'widget') { const y = $('#stage').scrollTop; render('widget', 'all', false); $('#stage').scrollTop = y; }
  });
  addEventListener('resize', () => { fitBrand(); alignTitle(); });

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
      return `<button class="blip ${i % 2 ? 'dn' : 'up'} ${p > 68 ? 'flip' : ''} ${dim ? 'is-dim' : ''}" type="button" style="left:${p}%" data-id="${esc(c.id)}" data-jump="${esc(c.id)}" aria-label="${esc(fmtDate(c) + ' ' + name + '，' + daysText(c))}">
        ${glyph(c.category)}<span class="lab"><i>${esc(fmtDate(c))}<u>${esc(tnOf(c))}</u></i><b>${esc(name)}</b></span></button>`;
    }).join('');

    const legend = Object.keys(labels).map(k => `<span>${glyph(k)}${enLabels[k]}</span>`).join('');
    return `<section class="sec sec-radar">
      <div class="sec-h"><h2>截止时间轴</h2><em>Timeline</em><span class="sec-n">NEXT ${Math.max(...open.map(daysLeft))} DAYS</span><div class="sec-x legend" aria-hidden="true">${legend}</div></div>
      <div class="card pad radar">
      <div class="plot">
        ${ticks}
        <div class="axis"></div>
        <div class="today"><span>今天 ${two(now.getMonth() + 1)}.${two(now.getDate())}</span></div>
        ${blips}
      </div>
      </div>
    </section>`;
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
    return `<article class="call ${isClosed(item) ? 'is-closed' : ''} ${item.highlight ? '' : 'no-key'}" data-cat="${esc(item.category)}" data-id="${esc(item.id)}" id="call-${esc(item.id)}">
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
    const en = filter === 'all' ? 'All calls' : (enLabels[filter] || '');
    const rows = shown.length ? shown.map(renderRow).join('') : `<div class="empty">本期暂无${esc(label)}。</div>`;
    return `<section class="view">
      <header class="page-head">
        <h1><span>国际机会精选</span><em>Open calls<span class="dot">.</span></em></h1>
        <div class="page-meta"><span>01 / Opportunities</span><span>${esc(data.issue_id || '')}</span></div>
      </header>
      ${mobileFilters(filter)}
      ${radarHtml(calls, filter)}
      <section class="sec">
        <div class="sec-h"><h2>${esc(label)}</h2><em>${esc(en)}</em><span class="sec-n">${two(shown.length)}</span><div class="sec-x"><button class="reset-filter ${filter !== 'all' ? 'show' : ''}" type="button">全部机会</button></div></div>
        <div class="ledger">${rows}</div>
      </section>
      <p class="foot-note">按截止日期排列，摘要与推荐理由为编辑判断，不是官方排名。信息核验自各机构官方页面，投稿前请再次确认截止时区与条件。</p>
    </section>`;
  }

  // ---------- 本周关注 ----------
  function focusView() {
    const items = (data.radar || []).slice(0, 2);
    return `<section class="view">
      <header class="page-head">
        <h1><span>本周关注</span><em>In focus<span class="dot">.</span></em></h1>
        <div class="page-meta"><span>02 / Weekly radar</span><span>${esc(data.issue_id || '')}</span></div>
      </header>
      <section class="sec">
        <div class="sec-h"><h2>本期关注</h2><em>This week</em><span class="sec-n">${two(items.length)}</span></div>
        <div class="ledger">
          ${items.map((item, i) => `<article class="call two">
            <div class="c-img"><img src="${imgs[i] || imgs[0]}" alt="" loading="lazy"></div>
            <div class="c-main">
              <div class="c-meta"><span class="c-cat">${esc(item.type || 'IN FOCUS')}</span><span class="c-idx">${two(i + 1)}</span></div>
              <h2 class="c-title serif">${esc(item.title)}</h2>
              <p class="c-author">${esc(item.author || '')}</p>
              <p class="c-brief">${esc(item.short_title || '')}</p>
              <div class="actions"><a class="btn btn-primary" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer"><span>阅读原文</span><span>↗</span></a></div>
            </div>
          </article>`).join('')}
        </div>
      </section>
      <p class="foot-note">推荐与摘要为编辑判断，来源见各条目的原文链接。</p>
    </section>`;
  }

  // ---------- 小组件页：预览按 Media-Art-Radar.js（Edition 10）同一套规则绘制，iPhone 与 Mac 两组尺寸 ----------
  // 圆角：全部等角；卡片 14（= 组件外框 26 − 内边距 12）。间距：组件四边内边距 12；相邻块之间 6；块内文字距块边缘 10。
  // 线条：卡片外框与卡里的竖分隔线一样粗（1.2pt）。iOS 画描边会把外侧那半圈裁掉，所以脚本里外框的 borderWidth 写成 2.4，有效线宽才是 1.2。
  // 尺寸（iPhone 17 Pro Max 与 Mac 桌面）都是真机截图实测。预览里的日期用 Bodoni Moda 斜体，真机上是 iOS 自带的 Didot 斜体。
  const WG = { inset: 12, gap: 6, cardR: 14, padIn: 10, bw: 1.2 };
  const SIZES = {
    phone: { small: 176, mw: 378, lh: 393 },
    mac: { small: 162, mw: 341, lh: 342, xl: { w: 701, h: 342 } }
  };
  // 已知宿主里最矮的高度（Mac 桌面）：只用来决定「放几张」；卡片高度不写死，撑满整个组件（与脚本一致）
  const MINH = { small: 162, medium: 162, large: 342 };
  // iOS 的描边覆盖在内边距上、不占位；CSS 的描边占位，预览里给带描边的块扣掉一个描边宽，文字位置才与真机一致
  const bp = v => (v - WG.bw).toFixed(1);
  function hlHtml(item, base) {
    const v = item.highlight;
    if (!v) return '';
    if (!/\d/.test(v)) return `<span style="font-size:${Math.max(base * .5, 9)}px;color:#6d6d6d;font-weight:500">${esc(v)}</span>`;
    const size = v.length >= 5 ? Math.max(base * .68, 9) : base;
    return `<span class="it" style="font-size:${size}px;color:#d71921">${esc(v)}</span>`;
  }
  const catShort = { exhibition: '展览', residency: '驻留', prize: '奖项', conference: '学术会议' };
  const catTag = (item, fs, color) => `<span class="mono" style="font-size:${fs}px;font-weight:700;color:${color};display:inline-flex;align-items:center;gap:.4em">${glyph(item.category)}${esc(catShort[item.category] || '')}</span>`;
  const daysPillOn = (label, fs, h) =>
    `<span class="pl" style="font-size:${fs}px;height:${h}px;border-radius:${h / 2}px">${esc(label)}</span>`;
  // 文字先缩小再截断：与 Scriptable 的 minimumScaleFactor 0.8 一致（真机上长名称是先缩到 80% 才出现省略号）
  const fitCtx = document.createElement('canvas').getContext('2d');
  const fitSize = (text, size, avail) => {
    fitCtx.font = `700 ${size}px Grotesk, sans-serif`;
    const w = fitCtx.measureText(text).width;
    return w <= avail ? size : Math.max(size * .8, size * avail / w);
  };
  const subOf = item => titleParts(item.title).slice(1).join(' / ');
  const nameOf = item => titleParts(item.title)[0] || item.title;
  const clamp = n => `display:-webkit-box;-webkit-line-clamp:${n};-webkit-box-orient:vertical;overflow:hidden`;

  // 能放几张：与脚本里的 rowsThatFit 一致（按最矮的宿主算）
  const rowsThatFit = (avail, minH, total, extra = 0) => {
    const most = a => Math.max(1, Math.floor((a + WG.gap) / (minH + WG.gap)));
    let n = Math.min(total, most(avail));
    if (n < total) n = Math.min(n, most(avail - extra));
    return n;
  };

  // 日期柱：日期 + T-n（右边一条 1.2 的黑条是分隔）；高度跟着整张卡走
  const pillarHtml = (item, w, ds, ts) =>
    `<div class="pil" style="width:${w + 1.2}px;align-self:stretch"><span class="it" style="font-size:${ds}px;line-height:1">${esc(fmtDate(item))}</span><span class="mono" style="font-size:${ts}px;font-weight:700;color:#d71921">${esc(tnOf(item))}</span></div>`;
  // 关键数字列
  const keyHtml2 = (item, w, base, ls) => {
    const label = item.highlight_label ? `<span class="mono clip dim" style="font-size:${ls}px;text-align:right">${esc(item.highlight_label)}</span>` : '';
    return `<div style="width:${w}px;display:flex;flex-direction:column;align-items:flex-end;flex:0 0 auto;gap:2px">${hlHtml(item, base)}${label}</div>`;
  };
  // 一张机会卡（中号 / 大号共用）：[日期柱] | 名称（主角，粗体）+ 分类 | 关键数字。宽高都不写死：撑满父容器，最矮不低于 minH
  const oppCard = (item, s) => `<div class="opp" style="flex:1 1 0;min-height:${s.minH}px;border-radius:${WG.cardR}px">
      ${pillarHtml(item, s.pillarW, s.date, s.tn)}
      <div class="col" style="flex:1 1 auto;min-width:0;margin-left:${WG.padIn}px"><b class="clip" style="font-size:${fitSize(nameOf(item), s.title, s.w - s.pillarW - 1.2 - WG.padIn * 2 - s.keyW - 4).toFixed(2)}px">${esc(nameOf(item))}</b><span class="mono dim clip" style="font-size:${s.meta}px;font-weight:700;margin-top:3px;display:flex;align-items:center;gap:.4em">${glyph(item.category)}${esc(catShort[item.category] || '')}</span></div>
      ${keyHtml2(item, s.keyW, s.hl, s.meta - 1)}
      <div style="width:${WG.padIn}px;flex:0 0 auto"></div>
    </div>`;

  function widgetView() {
    const calls = sorted().filter(c => !isClosed(c));
    const first = calls[0];
    const issue = esc((data.issue_id || '').replace(/^\d{4}-/, ''));
    const total = two(calls.length);
    const fig = (cls, name, size, note, inner, w, h) => `<figure class="wg-item" style="margin:0">
      <figcaption class="wg-cap"><b>${name}</b><span>${size}</span></figcaption>
      <div class="wg-scroll"><div class="wg ${cls}" style="width:${w}px;height:${h}px" role="img" aria-label="${name}小组件预览：${esc(note)}">${inner}</div></div></figure>`;

    // 小号：一张撑满的卡 —— 分类 · 共 N 项 / 名称（主角，最多两行）/ 日期 + T-n / 关键数字
    const smallHtml = sz => {
      if (!first) return '';
      const ch = sz.small - WG.inset * 2 - 1, cw = sz.small - WG.inset * 2;
      const sc = Math.min(1, (Math.min(sz.small, MINH.small) - WG.inset * 2 - 1 - WG.padIn * 2) / 117);      // 字号按最矮的宿主定
      return `<div class="pnl" style="width:${cw}px;height:${ch}px;border-radius:${WG.cardR}px;padding:${bp(WG.padIn)}px">
        <div class="row">${catTag(first, 7.5, '#0a0a0a')}<span class="grow"></span><span class="mono" style="font-size:7.5px;font-weight:700;color:#6d6d6d">共 ${total} 项</span></div>
        <div style="height:4px"></div>
        <b style="font-size:${(16 * sc).toFixed(1)}px;line-height:1.22;${clamp(2)}">${esc(nameOf(first))}</b>
        <div class="grow"></div>
        <div class="row" style="align-items:flex-end"><span class="it" style="font-size:${Math.round(28 * sc)}px;line-height:.9">${esc(fmtDate(first))}</span><span class="grow"></span>${daysPillOn(tnOf(first), 8, 14)}</div>
        <div style="height:4px"></div><div class="hair"></div><div style="height:4px"></div>
        <div class="row"><span class="mono dim" style="font-size:8px">申请截止</span><span class="grow"></span>${hlHtml(first, Math.round(16 * sc))}</div>
      </div>`;
    };

    // 中号：左边「总数」卡，右边三张机会卡；高度都撑满整个组件（左右两块自动等高）
    const mediumHtml = sz => {
      const innerH = sz.small - WG.inset * 2 - 1, panelW = 74, listW = sz.mw - WG.inset * 2 - panelW - WG.gap;
      const rows = Math.min(MINH.medium, sz.small) - WG.inset * 2 - 1 >= 3 * 38 + 2 * WG.gap ? 3 : 2;
      const s = { w: listW, minH: 28, pillarW: 44, date: 14, tn: 7, keyW: 44, title: 12.5, meta: 7.5, hl: 14 };
      const n = Math.min(rows, calls.length), hidden = calls.length - n;
      return `<div class="row" style="align-items:stretch;height:${innerH}px">
        <div class="cnt" style="width:${panelW}px;border-radius:${WG.cardR}px;padding:${bp(WG.padIn)}px">
          <span class="mono" style="font-size:7px;font-weight:700">${issue}</span><div class="grow"></div>
          <span class="it" style="font-size:46px;line-height:.9;color:#d71921">${total}</span>
          <span class="mono" style="font-size:7.5px;color:#6d6d6d;margin-top:3px">项机会</span>
          <div style="height:6px"></div>
          <span class="mono" style="font-size:7px;${hidden > 0 ? 'font-weight:700' : 'color:#6d6d6d'}">${hidden > 0 ? `另有 ${hidden} 项` : '已同步'}</span>
        </div>
        <div style="width:${WG.gap}px;flex:0 0 auto"></div>
        <div style="display:flex;flex-direction:column;gap:${WG.gap}px;flex:1 1 0;min-width:0">${calls.slice(0, n).map(c => oppCard(c, s)).join('')}</div>
      </div>`;
    };

    // 大号：刊头写明总数 + 五张同样的卡 + 页脚；刊头、线、页脚是固定高度，其余全部平分给卡片
    const largeHtml = sz => {
      const cw = sz.mw - WG.inset * 2, MAST = 32, FOOT = 10;
      const availMin = Math.min(MINH.large, sz.lh) - WG.inset * 2 - 1;
      const area = availMin - MAST - WG.gap - WG.gap - 1 - WG.gap - FOOT;
      const n = rowsThatFit(area, 46, calls.length, WG.gap + 10);
      const s = { w: cw, minH: 34, pillarW: 62, date: 18, tn: 8, keyW: 64, title: 14, meta: 8, hl: 15 };
      return `<div class="row" style="align-items:flex-end;height:${MAST}px;flex:0 0 auto"><b style="font-size:10px">MEDIA ART</b><span class="it" style="margin-left:6px;font-size:18px">Radar</span><span class="grow"></span><span class="it" style="font-size:26px;line-height:1;color:#d71921">${total}</span><div style="margin-left:4px;display:flex;flex-direction:column;line-height:1.15"><span class="mono" style="font-size:8.5px;font-weight:700">项机会</span><span class="mono dim" style="font-size:7.5px">${issue}</span></div></div><div style="height:${WG.gap}px;flex:0 0 auto"></div>`
        + `<div style="display:flex;flex-direction:column;gap:${WG.gap}px;flex:${n >= 5 ? '1 1 0' : '0 0 auto'};min-height:0">${calls.slice(0, n).map(c => oppCard(c, s)).join('')}</div>`
        + `${n >= 5 ? '' : '<div class="grow"></div>'}<div style="height:${WG.gap}px;flex:0 0 auto"></div><div class="hair"></div><div style="height:${WG.gap}px;flex:0 0 auto"></div><div class="row mono faint" style="font-size:8px;height:${FOOT}px;flex:0 0 auto"><span>核验 ${esc(String(first && first.verified_at || '').slice(5, 10).replace('-', '.'))}</span><span class="grow"></span><span>已同步</span></div>`;
    };

    // 超大号（只出现在 Mac 桌面）：3×2，五个机会各一格 + 刊头格。名称与日期同等重要：名称 16 粗体 + 副标题，日期 32 斜体
    const xl = SIZES.mac.xl;
    const xCw = Math.floor((xl.w - WG.inset * 2 - WG.gap * 2) / 3), xCh = Math.floor((xl.h - WG.inset * 2 - 1 - WG.gap) / 2);
    const xTop = (left, right) => `<div class="row" style="gap:6px"><span class="mono" style="font-size:7.5px;font-weight:700">${left}</span><span style="flex:1;height:1px;background:#ececec"></span>${right}</div>`;
    const cell = (c, i) => `<div class="wg-card" style="width:${xCw}px;height:${xCh}px;border-radius:${WG.cardR}px;padding:${bp(WG.inset)}px">
      ${xTop(`${two(i + 1)}/${total}`, catTag(c, 7.5, '#0a0a0a'))}
      <div style="height:4px"></div>
      <b class="clip" style="font-size:16px;line-height:1.22">${esc(nameOf(c))}</b>
      ${subOf(c) ? `<span class="clip dim" style="font-size:7.5px;margin-top:1px">${esc(subOf(c))}</span>` : ''}
      <div class="grow"></div>
      <div class="row" style="align-items:flex-end"><span class="it" style="font-size:32px;line-height:.9">${esc(fmtDate(c))}</span><span class="grow"></span>${daysPillOn(tnOf(c) + ' DAYS', 7, 13)}</div>
      <div style="height:4px"></div><div class="hair"></div><div style="height:4px"></div>
      <div class="row" style="height:22px">${hlHtml(c, 18)}${c.highlight_label ? `<span class="mono dim clip" style="font-size:7.5px;margin-left:6px">${esc(c.highlight_label)}</span>` : ''}<span class="grow"></span></div></div>`;
    const xlHidden = Math.max(0, calls.length - 5);
    const xlHtml = `<div class="wg-grid" style="grid-template-columns:repeat(3,${xCw}px);grid-template-rows:repeat(2,${xCh}px)">
      <div class="wg-card" style="width:${xCw}px;height:${xCh}px;border-radius:${WG.cardR}px;padding:${bp(WG.inset)}px">
        ${xTop('MEDIA ART', '<span class="it" style="font-size:11px">Radar</span>')}
        <div class="grow"></div>
        <span class="it" style="font-size:64px;line-height:.95;color:#d71921">${total}</span><span class="mono" style="font-size:8px;color:#6d6d6d">项机会 · OPEN CALLS</span>
        <div style="height:4px"></div><div class="hair"></div><div style="height:5px"></div>
        <div class="row mono" style="font-size:7.5px"><span style="color:#6d6d6d">${issue} · 已同步</span><span class="grow"></span>${xlHidden ? `<b>另有 ${xlHidden} 项</b>` : ''}</div></div>
      ${calls.slice(0, 5).map((c, i) => cell(c, i)).join('')}</div>`;

    const P = SIZES.phone, M = SIZES.mac;
    const small = smallHtml(P), med = mediumHtml(P), lg = largeHtml(P);
    const smallMac = smallHtml(M), medMac = mediumHtml(M), lgMac = largeHtml(M);

    return `<section class="view">
      <header class="page-head">
        <h1><span>小组件</span><em>Widgets<span class="dot">.</span></em></h1>
        <div class="page-meta"><span>03 / Widgets · iPhone · Mac</span><span>${esc(data.issue_id || '')}</span></div>
      </header>

      <section class="sec">
        <div class="sec-h"><h2>安装</h2><em>Install</em><span class="sec-n">SCRIPTABLE</span></div>
        <article class="call two">
          <div class="c-date"><span class="c-lab">EDITION</span><span class="c-d">10</span><span class="c-t">${issue}</span></div>
          <div class="c-main">
            <div class="c-meta"><span class="c-cat">${glyph('exhibition')}Scriptable 脚本</span><span class="c-place">iPhone · iPad · Mac</span></div>
            <h2 class="c-title">下载组件脚本</h2>
            <p class="c-sub">Widgets for iPhone, iPad &amp; Mac</p>
            <p class="c-brief">已装过旧版？整份替换原脚本，保存并运行一次即可；四个尺寸共用同一份脚本。</p>
            <div class="actions">
              <a class="btn btn-primary" href="Media-Art-Radar.js?v=21" download><span>下载脚本</span><span>↓</span></a>
              <a class="btn btn-ghost" href="#steps" data-scroll="steps">安装步骤 ↓</a>
            </div>
          </div>
        </article>
      </section>

      <section class="sec">
        <div class="sec-h"><h2>四个尺寸</h2><em>Four sizes</em><span class="sec-n">04</span></div>
        <div class="wg-list">
          ${fig('wg-s', '小号 · iPhone', '176 × 176', '下一个截止', small, P.small, P.small)}
          ${fig('wg-m', '中号 · iPhone', '378 × 176', '三个机会', med, P.mw, P.small)}
          ${fig('wg-l', '大号 · iPhone', '378 × 393', '五个机会', lg, P.mw, P.lh)}
        </div>
        <div class="sec-h" style="margin-top:var(--sec)"><h2>在 Mac 桌面上</h2><em>On the Mac</em><span class="sec-n">iPhone 组件 · macOS Tahoe</span></div>
        <div class="wg-list">
          ${fig('wg-s', '小号 · Mac', '162 × 162', '下一个截止', smallMac, M.small, M.small)}
          ${fig('wg-m', '中号 · Mac', '341 × 162', '三个机会', medMac, M.mw, M.small)}
          ${fig('wg-l', '大号 · Mac', '342 × 342', '五个机会', lgMac, M.mw, M.lh)}
          ${fig('wg-xl', '超大号 · Mac', '3 × 2 · 701 × 342', '五个机会加刊头', xlHtml, xl.w, xl.h)}
        </div>
      </section>

      <section class="sec" id="steps">
        <div class="sec-h"><h2>步骤</h2><em>Steps</em><span class="sec-n">04</span></div>
        <ol class="card rows steps">
          <li>在 Scriptable 中新建脚本，把下载文件里的代码完整粘贴进去，运行一次确认能取到数据。</li>
          <li>长按 iPhone 主屏幕 → 加号 → 选择 Scriptable → 挑尺寸（小 / 中 / 大）添加。在 Mac 或 iPad 上添加 Scriptable 小组件时可以选「超大」，脚本相同。</li>
          <li>长按刚添加的组件 → 编辑小组件 → Script 选择刚保存的那个脚本。</li>
          <li>中号、大号和超大号点击每个机会会打开对应的官方页面；小号点击打开本站。</li>
        </ol>
      </section>

      <section class="sec">
        <div class="sec-h"><h2>说明</h2><em>Notes</em></div>
        <div class="card rows">
          <p><b>与网站同一套语言。</b>整体黑白、白为主，只有一个红：倒计时 T-n、关键数字（资助金额等）和总数用红字；分类用符号区分（● 展览 ○ 驻留 ◆ 奖项 ▲ 会议）。</p>
          <p><b>每个机会是一张独立的卡。</b>左边日期柱只写日期和 T-n，中间是名称和分类，右边是关键数字。地点、「申请截止」这些次要信息都拿掉了，只留最要紧的三样。</p>
          <p><b>总数写在最显眼的地方。</b>中号左侧的黑块用大号数字写明一共几项开放机会，放不下的写「另有 n 项」；小号右上角写「共 N 项」；大号刊头、超大号刊头格同样写明。</p>
          <p><b>放在 Mac 桌面上。</b>macOS Tahoe 可以把 iPhone 上的小组件放到 Mac 桌面（「来自 iPhone 的小组件」）。脚本仍然在 iPhone 上运行，看不出自己被显示在哪里，而 Mac 桌面上的组件比 iPhone 上矮（上面「在 Mac 桌面上」是实测尺寸）。所以<b>同一份脚本不需要任何设置</b>：卡片的宽和高都不写死，会撑满组件的实际大小；放几张则按较矮的那个尺寸算，保证哪里都放得下。超大号只会出现在 Mac 桌面上，面积用实测值。</p>
          <p><b>名称是主角。</b>日期只是一根窄柱里的两行小字，名称用粗体、比日期大一号；小号名称最多两行，超大号名称下面还有副标题，一眼就能知道这是什么机会。</p>
          <p><b>圆角与间距。</b>所有形状都是等角圆角（四个角同一个半径），并且同心：卡片圆角 14 = 组件外框 26 − 内边距 12（外框圆角实测约 26）。组件四边内边距都是 12，相邻块之间一律 6，块内文字距块边缘 10（超大号格子里是 12）。</p>
          <p><b>线条粗细。</b>卡片外框与卡里的竖分隔线一样粗（1.2pt）。iOS 画描边时会把外侧那半圈裁掉，只剩里面一半，所以脚本里外框的描边宽度写成 2.4，有效才是 1.2；竖线是一块实心窄黑条，直接写 1.2。</p>
          <p><b>关于尺寸。</b>预览按 iPhone 17 Pro Max 与 Mac 桌面的实测尺寸绘制；其他 iPhone 机型比 Mac 桌面还矮时，会少放几张、字号等比缩小。</p>
          <p><b>更新节奏。</b>内容每周更新，脚本不需要每周重新下载，只有样式改版时才需要替换。刷新时机由 iOS 决定，脚本声明的是 60 分钟。</p>
          <p><b>数据来源。</b>脚本直接读取本站公开的 <a href="latest.json">latest.json</a>，仅在本机保存一份缓存。截止时区与提前关闭条件以官方页面为准。</p>
        </div>
      </section>
      <p class="foot-note">小组件内容与本站同源，随周刊更新。</p>
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
    fitBrand();
    alignTitle();
    if (push) {
      const hash = route === 'opportunities' && filter !== 'all' ? '#opportunities/' + filter : '#' + route;
      if (location.hash !== hash) history.pushState(null, '', hash);
    }
  }

  // 时间轴 / 极坐标 / 下一个截止 与台账里的卡片互相呼应：悬停同亮，点击跳到那一张
  const hot = (id, on) => $$('[data-id]').forEach(el => { if (el.dataset.id === id) el.classList.toggle('is-hot', on); });
  addEventListener('mouseover', e => { const el = e.target.closest && e.target.closest('[data-id]'); if (el) hot(el.dataset.id, true); });
  addEventListener('mouseout', e => { const el = e.target.closest && e.target.closest('[data-id]'); if (el) hot(el.dataset.id, false); });
  function jumpTo(id) {
    let row = document.getElementById('call-' + id);
    if (!row) { const s = parseHash(); if (s.route !== 'opportunities' || s.filter !== 'all' || !document.querySelector('.ledger')) { render('opportunities', 'all', true); row = document.getElementById('call-' + id); } }
    if (!row) return;
    row.scrollIntoView({ behavior: 'smooth', block: 'start' });
    hot(id, true);
    setTimeout(() => hot(id, false), 1800);
  }
  document.addEventListener('click', e => { const j = e.target.closest('[data-jump]'); if (j) jumpTo(j.dataset.jump); });

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

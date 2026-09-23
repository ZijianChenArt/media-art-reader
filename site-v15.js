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
    $('#status-verified').innerHTML = ver ? '核验 ' + esc(ver).replace('.', '<span class="date-dot">.</span>') : '';
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
        <div class="c-meta"><span class="c-cat">${glyph(item.category)}${esc(labels[item.category] || 'OPEN CALL')}</span><span class="c-place">${esc(place(item))}</span><span class="c-idx">${two(i + 1)}</span></div>
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

  // ---------- 小组件页：Edition 14，iPhone 与 Mac 两组参考尺寸 ----------
  // 圆角：全部等角；卡片 18（外框是连续圆角，等效圆角 iPhone ≈ 31 / Mac ≈ 27.5；内缩 12 后最贴合的卡片圆角 iPhone 18.6 / Mac 17.2，取 18）。间距：组件四边内边距 12；相邻块之间 6；块内文字距块边缘 10。
  // 脚本按卡片最终尺寸绘制 1.2pt 描边，并向内偏移半个线宽，避免边缘裁切。
  // 尺寸（iPhone 17 Pro Max 与 Mac 桌面）都是真机截图实测。预览里的日期用 Bodoni Moda 斜体，真机上是 iOS 自带的 Didot 斜体。
  const WG = { inset: 12, gap: 6, cardR: 18, padIn: 10, bw: 1.2 };
  const SIZES = {
    phone: { small: 176, mw: 378, lh: 393 },
    mac: { small: 162, mw: 341, lw: 342, lh: 342, xl: { w: 701, h: 342 } }
  };
  // 已知宿主里最矮的高度（Mac 桌面）：只用来决定「放几张」；卡片高度不写死，撑满整个组件（与脚本一致）
  const MINH = { small: 162, medium: 162, large: 342 };
  // iOS 的描边覆盖在内边距上、不占位；CSS 的描边占位，预览里给带描边的块扣掉一个描边宽，文字位置才与真机一致
  const bp = v => (v - WG.bw).toFixed(1);
  function hlHtml(item, base) {
    const v = item.highlight;
    if (!v) return '';
    if (!/\d/.test(v)) return `<span style="font-size:${Math.max(base * .65, 10)}px;color:#505050;font-weight:600">${esc(v)}</span>`;
    const size = v.length >= 5 ? Math.max(base * .88, 12) : base;
    return `<span class="ed-benefit" style="font-size:${size}px;color:#040404">${esc(v)}</span>`;
  }
  const catShort = { exhibition: '展览', residency: '驻留', prize: '奖项', conference: '学术会议' };
  const catTag = (item, fs, color) => `<span class="mono" style="font-size:${fs}px;font-weight:700;color:${color};display:inline-flex;align-items:center;gap:.4em">${glyph(item.category)}${esc(catShort[item.category] || '')}</span>`;
  const catSymbol = { exhibition: '●', residency: '○', prize: '◆', conference: '▲' };
  const catPlain = item => `${catSymbol[item.category] || catSymbol.exhibition} ${esc(catShort[item.category] || '')}`;
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
    `<div class="pil" style="width:${w + 1.2}px;align-self:stretch"><span class="num" style="font-size:${ds}px;line-height:1">${esc(fmtDate(item))}</span><span class="mono" style="font-size:${ts}px;font-weight:700;color:#d71921">${esc(tnOf(item))}</span></div>`;
  // 关键数字列
  const keyHtml2 = (item, w, base, ls) => {
    const label = item.highlight_label ? `<span class="clip dim" style="font-size:${ls}px;font-weight:600;text-align:right">${esc(item.highlight_label)}</span>` : '';
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
function titleLines(value, width, size) {
  const str = String(value || "Untitled").replace(/\s+/g, " ").trim()
  const measure = text => Array.from(text).reduce((sum, ch) => sum +
    (/[^\x00-\x7F]/.test(ch) ? 1 : /[MW@]/.test(ch) ? .85 : /[ilI1.,' ]/.test(ch) ? .28 : /[A-Z]/.test(ch) ? .66 : .54), 0) * size
  if (measure(str) <= width - 4) return [str]
  let choices = []
  for (let i = 1; i < str.length; i++) if (str[i] === " ") choices.push(i)
  if (!choices.length) choices = Array.from({length: Math.max(0, str.length - 1)}, (_, i) => i + 1)
  let best = choices[0] || str.length, score = Infinity
  for (const i of choices) {
    const a = measure(str.slice(0, i).trim()), b = measure(str.slice(i).trim())
    // Keep line one within the column; line two can shrink/truncate if needed.
    const next = Math.max(a, b) + Math.max(0, a - width + 4) * 10
    if (next < score) { score = next; best = i }
  }
  return [str.slice(0, best).trim(), str.slice(best).trim()].filter(Boolean)
}

    const editorialDate = item => Array.from(fmtDate(item), ch => `<span${ch === '.' ? ' class="ed-dot"' : ''}>${esc(ch)}</span>`).join('');
    const editorialTimer = item => `<span class="ed-timer ${daysLeft(item) !== null && daysLeft(item) <= 14 ? 'ed-urgent' : ''}">${esc(tnOf(item))}</span>`;
    const editorialHeader = () => `<div class="ed-head"><em>Media Art Radar</em><i>${total}</i></div>`;
    const editorialEmpty = '<div class="ed-empty">暂无开放机会</div>';
    const nativeDate = item => esc(fmtDate(item)).replace('.', '<span class="date-dot">.</span>');
    const nativeHead = `<div class="nc-head"><b>MEDIA<i class="nc-mid">·</i>ART</b><strong>${total}</strong></div><div class="nc-sub">${issue}<span>LIVE</span></div>`;
    const smallHtml = sz => !first ? editorialEmpty : `<div class="nc nc-small">
      <div class="nc-brand"><b>MEDIA<i class="nc-mid">·</i>ART</b><strong>${total}</strong></div>
      <div class="hair" style="margin:6px 0"></div>
      <div class="nc-meta-row">${catTag(first,8,'#505050')}<span class="mono ${daysLeft(first)<=14?'red':'dim'}" style="font-weight:700">${esc(tnOf(first))}</span></div>
      <div class="nc-date" style="margin-top:6px">${nativeDate(first)}</div>
      <b class="nc-title" style="margin-top:6px">${esc(nameOf(first))}</b>
      <div class="hair" style="margin-top:auto"></div>
      <div class="nc-bottom" style="margin-top:6px"><span>${issue}</span><span>LIVE</span></div>
    </div>`;
    const yearOf = item => (dateOf(item) || '').slice(0, 4);
    // 一行一个机会：日期列（大号日期 + T-n）｜发丝竖线｜分类+地点 / 标题 / 副标题+年份 —— 跟脚本的 addOpportunityRow 对齐
    const oppRow = (item, index, opts) => `<div class="nc-oppRow" style="height:${opts.h}px">
      <div class="nc-dateCol" style="width:${opts.dw}px">
        <span class="nc-dateBig">${nativeDate(item)}</span>
        <span class="mono ${daysLeft(item) <= 14 ? 'red' : 'dim'}" style="font-size:7.5px;font-weight:700;margin-top:2px">${esc(tnOf(item))}</span>
      </div>
      <div class="nc-vline"></div>
      <div class="nc-oppBody">
        <div class="nc-oppMeta"><span>${catPlain(item)}</span>${place(item) ? `<span class="dim">　·　${esc(place(item))}</span>` : ''}${opts.num ? `<span class="grow"></span><span class="mono faint">${two(index)}</span>` : ''}</div>
        <b class="nc-oppTitle">${titleLines(nameOf(item), opts.tw, opts.ts).map(esc).join('<br>')}</b>
        <div class="nc-oppSub"><span class="dim clip">${opts.hl && item.highlight ? esc(item.highlight) : esc(subOf(item))}</span><span class="mono faint">${esc(yearOf(item))}</span></div>
      </div>
    </div>`;
    const mediumHtml = sz => {
      if (!first) return editorialEmpty;
      const rowW = sz.mw - 24, dw = 54, tw = rowW - dw - 24;
      return `<div class="nc nc-medium">${nativeHead}<div class="nc-rows">${calls.slice(0, 2).map((item, i) => oppRow(item, i + 1, { h: 54, dw, tw, ts: 13, hl: false, num: false })).join('')}</div></div>`;
    };
    const largeHtml = sz => {
      if (!first) return editorialEmpty;
      const capacity = 4, hidden = Math.max(0, calls.length - capacity);
      const rowW = sz.mw - 24, dw = 55, tw = rowW - dw - 24;
      const rowH = Math.max(52, Math.floor((sz.lh - 24 - 44 - 20) / capacity));
      return `<div class="nc nc-large">${nativeHead}<div class="nc-rows">${calls.slice(0, capacity).map((item, i) => oppRow(item, i + 1, { h: rowH, dw, tw, ts: 13, hl: true, num: true })).join('')}</div><div class="nc-footer"><span>${issue} · LIVE</span><b>${hidden ? '+ ' + hidden + ' MORE →' : 'VIEW ALL →'}</b></div></div>`;
    };
    // 超大号（只出现在 Mac 桌面）：刊头 + 两列各四行，跟脚本 renderExtraLarge 的左右分栏对齐
    const xl = SIZES.mac.xl;
    const xColW = Math.floor((xl.w - WG.inset * 2 - 28 - 1) / 2), xDw = 54, xTw = xColW - xDw - 24;
    const xlItems = calls.slice(0, 8), xlLeft = xlItems.slice(0, 4), xlRight = xlItems.slice(4, 8);
    const xlRowH = 62;
    const xlHidden = Math.max(0, calls.length - 8);
    const xlHtml = `<div class="nc nc-xl">${nativeHead}<div class="nc-xlCols">
      <div class="nc-xlCol">${xlLeft.map((item, i) => oppRow(item, i + 1, { h: xlRowH, dw: xDw, tw: xTw, ts: 13, hl: true, num: true })).join('')}</div>
      <div class="nc-xlSep"></div>
      <div class="nc-xlCol">${xlRight.map((item, i) => oppRow(item, i + 5, { h: xlRowH, dw: xDw, tw: xTw, ts: 13, hl: true, num: true })).join('')}</div>
    </div><div class="nc-footer"><span>${issue} · LIVE</span><b>${xlHidden ? '+ ' + xlHidden + ' MORE →' : 'VIEW ALL →'}</b></div></div>`;

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
          <div class="c-date"><span class="c-lab">EDITION</span><span class="c-d">14</span><span class="c-t">${issue}</span></div>
          <div class="c-main">
            <div class="c-meta"><span class="c-cat">${glyph('exhibition')}Scriptable 脚本</span><span class="c-place">iPhone · iPad · Mac</span></div>
            <h2 class="c-title">下载组件脚本</h2>
            <p class="c-sub">Widgets for iPhone, iPad &amp; Mac</p>
            <p class="c-brief">已装过旧版？整份替换原脚本，保存并运行一次即可；四个尺寸共用同一份脚本。</p>
            <div class="actions">
              <a class="btn btn-primary" href="Media-Art-Radar.js?v=33" download><span>下载脚本</span><span>↓</span></a>
              <a class="btn btn-ghost" href="#steps" data-scroll="steps">安装步骤 ↓</a>
            </div>
          </div>
        </article>
      </section>

      <section class="sec">
        <div class="sec-h"><h2>四个尺寸</h2><em>Four sizes</em><span class="sec-n">04</span></div>
        <div class="wg-list">
          ${fig('wg-s', '小号 · iPhone', '176 × 176', '下一个截止', small, P.small, P.small)}
          ${fig('wg-m', '中号 · iPhone', '378 × 176', '两个机会', med, P.mw, P.small)}
          ${fig('wg-l', '大号 · iPhone', '378 × 393', '一行一个机会，最多四项', lg, P.mw, P.lh)}
        </div>
        <div class="sec-h" style="margin-top:var(--sec)"><h2>在 Mac 桌面上</h2><em>On the Mac</em><span class="sec-n">iPhone 组件 · macOS Tahoe</span></div>
        <div class="wg-list">
          ${fig('wg-s', '小号 · Mac', '162 × 162', '下一个截止', smallMac, M.small, M.small)}
          ${fig('wg-m', '中号 · Mac', '341 × 162', '两个机会', medMac, M.mw, M.small)}
          ${fig('wg-l', '大号 · Mac', '342 × 342', '一行一个机会，最多四项', lgMac, M.lw, M.lh)}
          ${fig('wg-xl', '超大号 · Mac', '两列 · 701 × 342', '刊头加两列，最多八项', xlHtml, xl.w, xl.h)}
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
          <p><b>与网站同一套语言。</b>白底黑字，系统字体以大小和粗细形成层次，红色只做点缀；分类用符号区分（● 展览 ○ 驻留 ◆ 奖项 ▲ 会议）。</p>
          <p><b>四个尺寸，同一套刊物语言。</b>小号突出下一个截止日期；中号、大号、超大号都是一行一个机会：左边日期列，中间一条发丝竖线，右边分类、地点、标题与资助，机会之间用发丝横线隔开，不再用黑框卡片分隔。</p>
          <p><b>红色是点缀。</b>日期中间的点和机会总数用红色；14 天内截止的倒计时用红色，其余信息以黑灰色呈现。</p>
          <p><b>放在 Mac 桌面上。</b>Mac 使用 iPhone 提供的同一份小组件脚本，无需另装一个版本。默认按 iPhone 尺寸排版；如果 Mac 上的边距与这里的参考预览不一致，可以在该组件的 Parameter 中填写 <code>mac</code>，使用 Mac 参考尺寸。这是可选校准，不是安装必填项。</p>
          <p><b>字体各有分工。</b>日期用衬线体，标题用系统字体粗体，倒计时与元信息用等宽字体，靠字号和粗细建立层次，不靠颜色。</p>
          <p><b>发丝线代替黑框。</b>组件外框保留系统圆角，内部不再画黑色描边卡片；大号一行一项最多四项，超大号左右两列各四项，中间一条竖分割线，同一套发丝线语言贯穿三种尺寸。</p>
          <p><b>清晰的日期。</b>日期使用衬线数字（月.日），中间的点是红色；月份、日期与倒计时各有固定位置，日期上方标明申请截止。中、大、超大号的每一行都可以单独点击。</p>
          <p><b>关于尺寸。</b>预览以 iPhone 17 Pro Max 与 Mac 桌面的参考尺寸绘制；脚本会按机型自动决定能放几行。中号展示两项，大号最多四项，超大号最多八项（两列各四项）。网页只是布局参考，最终效果以 iPhone 为准。iPad、显示缩放或未收录机型可在 Parameter 中填写实际尺寸，例如 <code>{"width":378,"height":176}</code>（单位为点，示例对应中号）。</p>
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

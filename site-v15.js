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
  document.fonts.ready.then(fitBrand);
  addEventListener('resize', fitBrand);

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
    return `<article class="call ${isClosed(item) ? 'is-closed' : ''}" data-cat="${esc(item.category)}" data-id="${esc(item.id)}" id="call-${esc(item.id)}">
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

  // ---------- 小组件页：预览按 Media-Art-Radar.js（Edition 09）同一套黑白语言绘制 ----------
  // 每个机会 = 一张独立的黑描边卡：[日期柱：14 天内整柱反黑] | 名称 + 分类符号 | 关键数字。
  // 总数用大号数字写明。预览里的日期用 Bodoni Moda 斜体，真机上是 iOS 自带的 Didot 斜体。
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

  // 日期柱：日期 + T-n
  const pillarHtml = (item, w, h, r, ds, ts) =>
    `<div class="pil" style="width:${w}px;height:${h}px;border-radius:${r}"><span class="it" style="font-size:${ds}px;line-height:1">${esc(fmtDate(item))}</span><span class="mono" style="font-size:${ts}px;font-weight:700;color:#d71921">${esc(tnOf(item))}</span></div>`;
  // 关键数字列
  const keyHtml2 = (item, w, base, ls) => {
    const label = item.highlight_label ? `<span class="mono clip dim" style="font-size:${ls}px;text-align:right">${esc(item.highlight_label)}</span>` : '';
    return `<div style="width:${w}px;display:flex;flex-direction:column;align-items:flex-end;flex:0 0 auto;gap:2px">${hlHtml(item, base)}${label}</div>`;
  };
  // 一张机会卡（中号 / 大号共用）
  const oppCard = (item, s) => `<div class="opp" style="width:${s.w}px;height:${s.h}px;border-radius:${s.big}px ${s.small}px ${s.big}px ${s.small}px">
      ${pillarHtml(item, s.pillarW, s.h - 2.4, `${s.big - 1}px 0 0 ${s.small}px`, s.date, s.tn)}
      <div class="col" style="width:${s.colW}px;margin-left:${s.pad}px;flex:0 0 auto"><b class="clip" style="font-size:${s.title}px">${esc(titleParts(item.title)[0] || item.title)}</b><span class="mono dim clip" style="font-size:${s.meta}px;font-weight:700;margin-top:3px;display:flex;align-items:center;gap:.4em">${glyph(item.category)}${esc(catShort[item.category] || '')}</span></div>
      <div class="grow"></div>
      ${keyHtml2(item, s.keyW, s.hl, s.meta - 1)}
      <div style="width:${s.pad}px;flex:0 0 auto"></div>
    </div>`;
  const restLine = (calls, n) => calls.length > n
    ? `另有 ${calls.length - n} 项 · ` + calls.slice(n, n + 3).map(c => `${fmtDate(c)} ${titleParts(c.title)[0]}`).join(' · ') : '';

  function widgetView() {
    const calls = sorted().filter(c => !isClosed(c));
    const first = calls[0];
    const issue = esc((data.issue_id || '').replace(/^\d{4}-/, ''));
    const total = two(calls.length);
    const fig = (cls, name, size, note, inner) => `<figure class="wg-item" style="margin:0">
      <figcaption class="wg-cap"><b>${name}</b><span>${size}</span></figcaption>
      <div class="wg-scroll"><div class="wg ${cls}" role="img" aria-label="${name}小组件预览：${esc(note)}">${inner}</div></div></figure>`;

    // 小号：下一个截止。日期块（分类 · 共 N 项 · 巨型日期 · T-n）+ 标题 + 关键数字
    const small = first ? `<div class="pnl" style="width:150px;height:100px;border-radius:20px 20px 20px 5px;padding:10px 10px 9px 11px">
        <div class="row">${catTag(first, 7.5, '#0a0a0a')}<span class="grow"></span><span class="mono" style="font-size:7.5px;font-weight:700;color:#6d6d6d">共 ${total} 项</span></div>
        <div class="grow"></div>
        <div class="row" style="align-items:flex-end"><span class="it" style="font-size:41px;line-height:.9">${esc(fmtDate(first))}</span><span class="grow"></span>${daysPillOn(tnOf(first), 8, 14)}</div>
      </div>
      <div style="height:7px"></div>
      <div style="padding:0 4px"><b class="clip" style="font-size:12px;display:block">${esc(titleParts(first.title)[0])}</b>
        <div class="row" style="margin-top:3px"><span class="mono dim" style="font-size:8px">申请截止</span><span class="grow"></span>${hlHtml(first, 13)}</div></div>` : '';

    // 中号：左边黑色「总数」（红色数字），右边三张卡
    const mS = { w: 256, h: 44, big: 14, small: 5, pillarW: 52, date: 17, tn: 7.5, pad: 9, colW: 256 - 52 - 1.2 - 9 - 58 - 9 - 4, keyW: 58, title: 10.5, meta: 7.5, hl: 16 };
    const mN = Math.min(3, calls.length), mHidden = calls.length - mN;
    const med = `<div class="row" style="align-items:stretch;height:144px">
      <div class="cnt" style="width:74px;height:144px;border-radius:22px 5px 22px 5px;padding:10px 9px 9px 8px">
        <span class="mono" style="font-size:7px;font-weight:700">${issue}</span><div class="grow"></div>
        <span class="it" style="font-size:46px;line-height:.9;color:#d71921">${total}</span>
        <span class="mono" style="font-size:7.5px;color:#b9b9bf;margin-top:3px">项机会</span>
        <div style="height:6px"></div>
        <span class="mono" style="font-size:7px;${mHidden > 0 ? 'font-weight:700' : 'color:#b9b9bf'}">${mHidden > 0 ? `另有 ${mHidden} 项` : '已同步'}</span>
      </div>
      <div style="width:10px;flex:0 0 auto"></div>
      <div style="display:flex;flex-direction:column;gap:4px">${calls.slice(0, mN).map(c => oppCard(c, mS)).join('')}</div>
    </div>`;

    // 大号：刊头写明总数 + 五张同样的卡
    const lS = { w: 336, h: 54, big: 18, small: 5, pillarW: 72, date: 21, tn: 8, pad: 10, colW: 336 - 72 - 1.2 - 10 - 80 - 10 - 4, keyW: 80, title: 12.5, meta: 8, hl: 17 };
    const lg = `<div class="row" style="align-items:flex-end"><b style="font-size:10px">MEDIA ART</b><span class="it" style="margin-left:6px;font-size:18px">Radar ↗</span><span class="grow"></span><span class="it" style="font-size:26px;line-height:1;color:#d71921">${total}</span><div style="margin-left:4px;display:flex;flex-direction:column;line-height:1.15"><span class="mono" style="font-size:8.5px;font-weight:700">项机会</span><span class="mono dim" style="font-size:7.5px">${issue}</span></div></div><div style="height:8px"></div>`
      + `<div style="display:flex;flex-direction:column;gap:5px">${calls.slice(0, 5).map(c => oppCard(c, lS)).join('')}</div>`
      + `<div class="grow"></div><div class="hair"></div><div class="row mono faint" style="font-size:8px;margin-top:6px"><span>核验 ${esc(String(first && first.verified_at || '').slice(5, 10).replace('-', '.'))}</span><span class="grow"></span><span>已同步</span></div>`;

    // 超大号：3×2，刊头格写明总数
    const cell = c => `<div class="wg-card" style="width:217px;height:151px;border-radius:26px 6px 26px 6px;padding:8px">
      <div class="pnl" style="width:201px;height:84px;border-radius:19px 19px 19px 5px;padding:8px 11px 8px 10px">
        <div class="row">${catTag(c, 7.5, '#0a0a0a')}</div>
        <div class="grow"></div>
        <div class="row" style="align-items:flex-end"><span class="it" style="font-size:38px;line-height:.9">${esc(fmtDate(c))}</span><span class="grow"></span>${daysPillOn(tnOf(c) + ' DAYS', 7, 13)}</div>
      </div>
      <div style="height:6px"></div>
      <div style="padding:0 4px"><b class="clip" style="font-size:12px;display:block">${esc(titleParts(c.title)[0])}</b>
        <div class="row" style="margin-top:2px">${hlHtml(c, 14)}<span class="mono dim clip" style="font-size:7px;margin-left:5px">${esc(c.highlight_label || '')}</span></div></div></div>`;
    const xlHidden = Math.max(0, calls.length - 5);
    const xl = `<div class="wg-grid">
      <div class="wg-card" style="width:217px;height:151px;border-radius:26px 6px 26px 6px;background:#0a0a0a;border-color:#0a0a0a;color:#fff;padding:14px 16px 12px 14px">
        <b style="font-size:9px">MEDIA ART</b><span class="it" style="font-size:20px;line-height:1.1">Radar ↗</span><div class="grow"></div>
        <span class="it" style="font-size:40px;line-height:.95;color:#d71921">${total}</span><span class="mono" style="font-size:8px;color:#b9b9bf">项机会 · OPEN CALLS</span>
        <div style="height:4px"></div><span class="mono" style="font-size:8px;color:#b9b9bf">${issue} · 已同步</span>${xlHidden ? `<span class="mono" style="font-size:8px;font-weight:700;margin-top:2px">另有 ${xlHidden} 项 · 点击查看 ↗</span>` : ''}</div>
      ${calls.slice(0, 5).map(cell).join('')}</div>`;

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
              <a class="btn btn-primary" href="Media-Art-Radar.js?v=12" download><span>下载脚本</span><span>↓</span></a>
              <a class="btn btn-ghost" href="#steps" data-scroll="steps">安装步骤 ↓</a>
            </div>
          </div>
        </article>
      </section>

      <section class="sec">
        <div class="sec-h"><h2>四个尺寸</h2><em>Four sizes</em><span class="sec-n">04</span></div>
        <div class="wg-list">
          ${fig('wg-s', '小号', '170 × 170', '下一个截止', small)}
          ${fig('wg-m', '中号', '364 × 170', '三个机会', med)}
          ${fig('wg-l', '大号', '364 × 382', '五个机会', lg)}
          ${fig('wg-xl', '超大号', 'Mac / iPad · 3 × 2 · 约 715 × 342', '五个机会加刊头', xl)}
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
          <p><b>关于尺寸。</b>预览按 iPhone 17 Pro Max 的组件点数绘制，其他机型点数略有差异，脚本会取最接近的一档；小屏机型上日期柱与数字列会收窄，标题过长时截断。超大号只有 Mac 与 iPad 才有。</p>
          <p><b>关于字体。</b>日期与英文在 iPhone 上用系统自带的 Didot 斜体，网页用 Bodoni Moda 斜体，形态接近但不完全相同。</p>
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

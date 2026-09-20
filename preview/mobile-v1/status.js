(() => {
  const now = Date.now();
  const DAY = 86400000;

  // ---------- 本期是否已过期 ----------
  const updated = document.querySelector('#updated');
  const stale = document.querySelector('#stale');
  if (updated && stale && now - Date.parse(updated.dateTime) > 8 * DAY) stale.hidden = false;

  const cards = Array.from(document.querySelectorAll('.call-detail'));

  const deadlineOf = card => Date.parse(card.dataset.sortDeadline);
  const daysLeft = card => {
    const at = deadlineOf(card);
    return Number.isFinite(at) ? Math.max(0, Math.ceil((at - now) / DAY)) : null;
  };

  // ---------- 截止状态 ----------
  // 倒计时在这里重算，页面里的 T-nn 只是没有 JS 时的静态兜底。
  document.querySelectorAll('[data-deadline]').forEach(el => {
    const deadline = Date.parse(el.dataset.deadline);
    const remaining = deadline - now;
    const card = el.closest('.call-detail');
    const tminus = card && card.querySelector('.tminus');
    const days = Math.max(0, Math.ceil(remaining / DAY));

    if (remaining <= 0) {
      el.textContent = el.dataset.precision === 'date' ? '截止日已到 · 查官网' : '已过截止日期';
      el.classList.add('closed');
      if (card) card.classList.add('is-closed');
      if (tminus) tminus.textContent = '已截止';
    } else {
      if (tminus) tminus.textContent = `T-${days} DAYS`;
      if (remaining <= 14 * DAY) {
        el.textContent = '14 天内截止';
        el.classList.add('soon');
        if (card) card.classList.add('is-soon');
      }
    }
  });

  // ---------- 手机卡片信息摘要 ----------
  // 不在 HTML 中重复维护数据：直接从每张卡现有的项目详情抽取。
  function kvValue(card, label) {
    const rows = Array.from(card.querySelectorAll('.kv > div'));
    const row = rows.find(item => item.querySelector('dt')?.textContent.trim() === label);
    return row?.querySelector('dd')?.textContent.trim() || '';
  }

  function appendFact(list, label, value, wide = false) {
    if (!value) return;
    const item = document.createElement('div');
    item.className = 'mobile-fact' + (wide ? ' fact-wide' : '');
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = label;
    dd.textContent = value;
    item.append(dt, dd);
    list.appendChild(item);
  }

  function buildMobileFacts(card) {
    if (card.querySelector('.mobile-facts')) return;
    const support = card.querySelector('.money')?.textContent.trim() || '';
    const transport = kvValue(card, '交通');
    const stay = kvValue(card, '住宿');
    const fee = kvValue(card, '申请费');
    const suitable = kvValue(card, '适合');

    const facts = document.createElement('dl');
    facts.className = 'mobile-facts';
    appendFact(facts, '资助 / 支持', support, true);
    appendFact(
      facts,
      '交通 / 住宿',
      [transport && `交通：${transport}`, stay && `住宿：${stay}`].filter(Boolean).join('；')
    );
    appendFact(facts, '申请费', fee);
    appendFact(facts, '适合', suitable, true);

    const bottom = card.querySelector('.card-bottom');
    if (bottom && facts.children.length) bottom.before(facts);
  }
  cards.forEach(buildMobileFacts);

  // ---------- 最近截止：底部条 + 手机首屏聚焦 ----------
  const open = cards
    .map(card => ({ card, at: deadlineOf(card) }))
    .filter(x => Number.isFinite(x.at) && x.at > now)
    .sort((a, b) => a.at - b.at);
  const next = open[0];

  const barName = document.querySelector('#bar-name');
  const barTime = document.querySelector('#bar-time');
  const bar = document.querySelector('.deadline-bar');
  if (bar && barName && barTime) {
    if (!next) {
      bar.hidden = true;
    } else {
      const title = next.card.querySelector('h3').textContent.split('/')[0].trim();
      barName.textContent = title;
      barTime.textContent = `T-${daysLeft(next.card)}`;
      bar.setAttribute('href', '#' + next.card.id);
    }
  }

  const mobileNext = document.querySelector('#mobile-next');
  if (mobileNext && next) {
    const card = next.card;
    const rawTitle = card.querySelector('h3')?.textContent.trim() || 'Untitled';
    const titleParts = rawTitle.split('/').map(x => x.trim()).filter(Boolean);
    const title = titleParts[0] || rawTitle;
    const tag = titleParts.slice(1).join(' / ') || card.querySelector('.tag')?.textContent.trim() || '';
    const category = card.querySelector('.category-label')?.textContent.trim() || '';
    const place = card.querySelector('.card-meta > span:nth-child(3)')?.textContent.trim() || '';
    const when = card.querySelector('.when')?.textContent.trim() || '';
    const date = card.querySelector('.date-display')?.textContent.trim() || '—';
    const d = daysLeft(card);

    mobileNext.dataset.category = card.dataset.category || '';
    mobileNext.querySelector('.mn-title').textContent = title;
    mobileNext.querySelector('.mn-tag').textContent = tag;
    mobileNext.querySelector('.mn-category').textContent = category;
    mobileNext.querySelector('.mn-date').textContent = date;
    mobileNext.querySelector('.mn-tminus').textContent = d === null ? '日期待定' : `T-${d} DAYS`;
    mobileNext.classList.toggle('is-soon', d !== null && d <= 14);
    const placeEl = mobileNext.querySelector('.mn-place');
    const whenEl = mobileNext.querySelector('.mn-when');
    placeEl.textContent = place;
    whenEl.textContent = when;
    placeEl.hidden = !place;
    whenEl.hidden = !when;
    mobileNext.querySelector('.mn-link').setAttribute('href', '#' + card.id);
    mobileNext.hidden = false;
  }

  // ---------- 排序与筛选 ----------
  const grid = document.querySelector('.opportunity-grid');
  const select = document.querySelector('#sort-calls');
  if (!grid) return;

  const buttons = Array.from(document.querySelectorAll('[data-filter]'));
  let activeCategory = 'all';

  function filterCards(announce) {
    let visible = 0;
    Array.from(grid.children).forEach(card => {
      card.hidden = activeCategory !== 'all' && card.dataset.category !== activeCategory;
      if (!card.hidden) visible++;
    });
    buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === activeCategory)));
    const empty = document.querySelector('#category-empty');
    if (empty) empty.hidden = visible > 0;
    const status = document.querySelector('#sort-status');
    if (announce && status) status.textContent = '显示 ' + visible + ' 个机会';
    return visible;
  }

  buttons.forEach(button => button.addEventListener('click', () => {
    activeCategory = activeCategory === button.dataset.filter ? 'all' : button.dataset.filter;
    filterCards(true);
  }));
  const filterGroup = document.querySelector('.category-filters');
  if (filterGroup) filterGroup.hidden = false;

  if (!select) return;

  const options = ['priority', 'deadline-asc', 'deadline-desc'];
  const storageKey = 'media-art-radar:sort';
  let saved = null;
  try { saved = localStorage.getItem(storageKey); } catch (_) {}

  if (options.includes(saved)) {
    select.value = saved;
  } else if (window.matchMedia('(max-width: 679px)').matches) {
    // 手机上默认按截止日期，桌面仍保留编辑推荐顺序。
    select.value = 'deadline-asc';
  }

  function sortCards(announce) {
    const mode = select.value;
    const sortable = Array.from(grid.children);
    const rank = card => Number(card.dataset.rank);
    const deadline = card => Date.parse(card.dataset.sortDeadline);

    sortable.sort((a, b) => {
      if (mode === 'priority') return rank(a) - rank(b);
      const aDate = deadline(a), bDate = deadline(b);
      if (!Number.isFinite(aDate)) return Number.isFinite(bDate) ? 1 : rank(a) - rank(b);
      if (!Number.isFinite(bDate)) return -1;
      return (mode === 'deadline-desc' ? bDate - aDate : aDate - bDate) || rank(a) - rank(b);
    });
    sortable.forEach(card => grid.appendChild(card));

    const note = document.querySelector('#sort-note');
    if (note) note.textContent = mode === 'priority'
      ? '推荐顺序综合媒介相关性、机构影响力与创作支持，不是官方排名。'
      : '按截止日期排序；未公布具体时刻的项目采用保守日期边界，满额提前关闭条件请看详情。';

    const visible = filterCards(false);
    const status = document.querySelector('#sort-status');
    if (announce && status) {
      status.textContent = '已按' + select.selectedOptions[0].textContent + '排列 ' + visible + ' 个机会';
    }
  }

  select.addEventListener('change', () => {
    try { localStorage.setItem(storageKey, select.value); } catch (_) {}
    sortCards(true);
  });
  const sortControl = document.querySelector('.sort-control');
  if (sortControl) sortControl.hidden = false;
  sortCards(false);
})();

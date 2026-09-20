(() => {
  const now = Date.now();
  const DAY = 86400000;

  // ---------- 本期是否已过期 ----------
  const updated = document.querySelector('#updated');
  const stale = document.querySelector('#stale');
  if (updated && stale && now - Date.parse(updated.dateTime) > 8 * DAY) stale.hidden = false;

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

  // ---------- 底部常驻倒计时：取仍然开放且最近的一项 ----------
  const barName = document.querySelector('#bar-name');
  const barTime = document.querySelector('#bar-time');
  const bar = document.querySelector('.deadline-bar');
  if (bar && barName && barTime) {
    const open = Array.from(document.querySelectorAll('.call-detail'))
      .map(card => ({ card, at: Date.parse(card.dataset.sortDeadline) }))
      .filter(x => Number.isFinite(x.at) && x.at > now)
      .sort((a, b) => a.at - b.at)[0];

    if (!open) {
      bar.hidden = true;
    } else {
      const title = open.card.querySelector('h3').textContent.split('/')[0].trim();
      barName.textContent = title;
      barTime.textContent = `T-${Math.max(0, Math.ceil((open.at - now) / DAY))}`;
      bar.setAttribute('href', '#' + open.card.id);
    }
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
  try {
    const saved = localStorage.getItem(storageKey);
    if (options.includes(saved)) select.value = saved;
  } catch (_) { /* 存储不可用时排序照常工作 */ }

  function sortCards(announce) {
    const mode = select.value;
    const cards = Array.from(grid.children);
    const rank = card => Number(card.dataset.rank);
    const deadline = card => Date.parse(card.dataset.sortDeadline);

    cards.sort((a, b) => {
      if (mode === 'priority') return rank(a) - rank(b);
      const aDate = deadline(a), bDate = deadline(b);
      if (!Number.isFinite(aDate)) return Number.isFinite(bDate) ? 1 : rank(a) - rank(b);
      if (!Number.isFinite(bDate)) return -1;
      return (mode === 'deadline-desc' ? bDate - aDate : aDate - bDate) || rank(a) - rank(b);
    });
    cards.forEach(card => grid.appendChild(card));

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

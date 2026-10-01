(() => {
  const now = Date.now();
  const updated = document.querySelector('#updated');
  const stale = document.querySelector('#stale');
  if (updated && stale && now - Date.parse(updated.dateTime) > 8 * 86400000) stale.hidden = false;
  document.querySelectorAll('[data-deadline]').forEach(el => {
    const remaining = Date.parse(el.dataset.deadline) - now;
    if (remaining <= 0) {
      el.textContent = el.dataset.precision === 'date' ? '截止日已到 · 查官网' : '已过截止日期';
      el.classList.add('closed');
    } else if (remaining <= 14 * 86400000) {
      el.textContent = '14 天内截止';
      el.classList.add('soon');
    }
  });
  const grid = document.querySelector('.opportunity-grid');
  const select = document.querySelector('#sort-calls');
  if (!grid || !select) return;
  const options = ['priority', 'deadline-asc', 'deadline-desc'];
  const storageKey = 'media-art-radar:sort';
  const buttons = Array.from(document.querySelectorAll('[data-filter]'));
  let activeCategory = 'all';
  function filterCards(announce) {
    let visible = 0;
    Array.from(grid.children).forEach(card => {
      card.hidden = activeCategory !== 'all' && card.dataset.category !== activeCategory;
      if (!card.hidden) visible++;
    });
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === activeCategory)));
    document.querySelector('#category-empty').hidden = visible > 0;
    if (announce) document.querySelector('#sort-status').textContent = '显示 ' + visible + ' 个机会';
    return visible;
  }
  buttons.forEach(button => button.addEventListener('click', () => {
    activeCategory = activeCategory === button.dataset.filter ? 'all' : button.dataset.filter;
    filterCards(true);
  }));
  const filterGroup = document.querySelector('.category-filters');
  if (filterGroup) filterGroup.hidden = false;
  try {
    const saved = localStorage.getItem(storageKey);
    if (options.includes(saved)) select.value = saved;
  } catch (_) { /* Sorting still works when storage is unavailable. */ }
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
    document.querySelector('#sort-note').textContent = mode === 'priority'
      ? '推荐顺序综合媒介相关性、机构影响力与创作支持，不是官方排名。'
      : '按截止日期排序；未公布具体时刻的项目采用保守日期边界，满额提前关闭条件请看卡片。';
    const visible = filterCards(false);
    if (announce) document.querySelector('#sort-status').textContent = '已按' + select.selectedOptions[0].textContent + '排列 ' + visible + ' 个机会';
  }
  select.addEventListener('change', () => {
    try { localStorage.setItem(storageKey, select.value); } catch (_) {}
    sortCards(true);
  });
  document.querySelector('.sort-control').hidden = false;
  sortCards(false);
})();

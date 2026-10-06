(() => {
const pageScope = window.MediaArtPage?.current;
const listen = (target, ...args) => { target?.addEventListener?.(...args); pageScope?.onCleanup(() => target?.removeEventListener?.(...args)); };
/* The original artwork expands within its own row. No clone, modal or grid reorder. */
(() => {
  'use strict';
  const archive = document.getElementById('archive-content');
  if (!archive) return;
  const desktop = window.matchMedia('(min-width: 861px)');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let current = null, pending = null, resizeFrame = 0;
  const duration = 540; // Slightly longer than the CSS transition fallback.
  const focus = node => {
    if (!node?.isConnected || node.closest('[hidden]')) return false;
    node.focus({preventScroll: true});
    return true;
  };
  const restoreAttribute = (node, name, value) => value === null ? node.removeAttribute(name) : node.setAttribute(name, value);
  const visibleCards = grid => [...grid.children].filter(node => node.matches('.card') && !node.hidden);

  function uniqueId() {
    let id = 'archive-inline-details', index = 1;
    while (document.getElementById(id)) id = `archive-inline-details-${index++}`;
    return id;
  }

  function candidate(summary) {
    const details = summary?.parentElement;
    const card = details?.closest('.card');
    if (!desktop.matches || details?.tagName !== 'DETAILS' || !details.closest('.card-sources') ||
        !card || !archive.contains(card) || !card.parentElement.matches('.grid,.archive-grid') ||
        card.closest('[hidden],[data-radar-page="random"],#random-stage')) return null;
    const content = details.querySelector('.details-content');
    return content ? {card, details, summary, content, grid: card.parentElement} : null;
  }

  // offset geometry is untransformed: the selected card can be anywhere along
  // its animation without affecting which normal-flow row is being measured.
  function geometry(state) {
    const {card, grid} = state;
    if (!desktop.matches || !card.isConnected || card.parentElement !== grid || card.closest('[hidden]')) return null;
    const cards = visibleCards(grid);
    const row = cards.filter(node => Math.abs(node.offsetTop - card.offsetTop) < 2);
    const style = getComputedStyle(grid);
    const columns = style.gridTemplateColumns.trim().split(/\s+(?![^()]*\))/).length;
    const left = parseFloat(style.paddingLeft) || 0;
    const right = grid.clientWidth - (parseFloat(style.paddingRight) || 0);
    const width = card.getBoundingClientRect().width;
    if (columns < 2 || !width || right - left <= width + 2) return null;
    return {row, shift: left - card.offsetLeft, width: right - left - width + 1};
  }

  function releasePeer(node, record) {
    node.classList.remove('archive-detail-covered', 'is-detail-covered');
    restoreAttribute(node, 'inert', record.inert);
    restoreAttribute(node, 'aria-hidden', record.hidden);
    for (const [control, tabindex] of record.tabs) restoreAttribute(control, 'tabindex', tabindex);
  }

  function measure(state) {
    const box = geometry(state);
    if (!box) return false;
    const peers = new Set(box.row.filter(node => node !== state.card));
    for (const [node, record] of state.peers) {
      if (!peers.has(node)) { releasePeer(node, record); state.peers.delete(node); }
    }
    for (const node of peers) {
      if (!state.peers.has(node)) {
        // inert handles descendants added later. Explicit tabindex restoration
        // also keeps older browsers from tabbing into a visually covered card.
        const tabs = [...node.querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex]')]
          .map(control => [control, control.getAttribute('tabindex')]);
        state.peers.set(node, {inert: node.getAttribute('inert'), hidden: node.getAttribute('aria-hidden'), tabs});
        node.setAttribute('inert', '');
        node.setAttribute('aria-hidden', 'true');
        for (const [control] of tabs) control.setAttribute('tabindex', '-1');
        node.classList.add('archive-detail-covered');
      }
      node.classList.toggle('is-detail-covered', state.open);
    }
    state.card.style.setProperty('--archive-detail-shift', `${box.shift}px`);
    state.panel.style.width = `${box.width}px`;
    return true;
  }

  function dispose(state, restoreFocus = false) {
    if (current !== state) return;
    clearTimeout(state.timer);
    state.observer?.disconnect();
    state.resizeObserver?.disconnect();
    current = null;
    // A lightbox must not retain an invisible/removed trigger after a filter,
    // breakpoint change, or removal of this artwork.
    if (document.querySelector('.artwork-lightbox[open]')) document.dispatchEvent(new Event('artwork-lightbox-close'));
    state.panel.remove();
    if (state.home.parentNode) state.home.replaceWith(state.content);
    else state.details.append(state.content);
    state.card.classList.remove('archive-detail-card', 'is-detail-open');
    if (state.shift) state.card.style.setProperty('--archive-detail-shift', state.shift);
    else state.card.style.removeProperty('--archive-detail-shift');
    for (const [node, record] of state.peers) releasePeer(node, record);
    for (const [name, value] of state.attributes) restoreAttribute(state.summary, name, value);
    // Desktop expansion always leaves the native mobile disclosure closed.
    state.details.open = false;
    if (state.summary.hasAttribute('aria-expanded')) state.summary.setAttribute('aria-expanded', 'false');
    if (restoreFocus && !focus(state.summary)) focus(document.getElementById('archive-search') || archive);
  }

  function finishClose(state, ticket) {
    if (current !== state || state.open || state.ticket !== ticket) return;
    const next = pending;
    pending = null;
    dispose(state);
    if (next) {
      const target = candidate(next.summary);
      if (target) open(target);
    }
  }

  function setOpen(state, value, restoreFocus = true) {
    clearTimeout(state.timer);
    const ticket = ++state.ticket;
    state.open = value;
    if (!value && restoreFocus) focus(state.summary);
    state.panel.toggleAttribute('inert', !value);
    state.panel.setAttribute('aria-hidden', String(!value));
    state.summary.setAttribute('aria-expanded', String(value));
    state.card.classList.toggle('is-detail-open', value);
    for (const node of state.peers.keys()) node.classList.toggle('is-detail-covered', value);
    if (value) focus(state.closeButton);
    else if (reduced.matches) finishClose(state, ticket);
    else state.timer = setTimeout(() => finishClose(state, ticket), duration);
  }

  function close({immediate = false, restoreFocus = true} = {}) {
    pending = null;
    if (!current) return;
    if (immediate) dispose(current, restoreFocus);
    else setOpen(current, false, restoreFocus);
  }

  function revealRow(card) {
    // A bottom-of-card trigger should reveal the newly opened information header.
    // Scroll only the containing archive pane; never shift the page horizontally.
    const rect = card.getBoundingClientRect();
    for (let pane = card.parentElement; pane; pane = pane.parentElement) {
      if (!/auto|scroll/.test(getComputedStyle(pane).overflowY || '')) continue;
      const bounds = pane.getBoundingClientRect();
      const toolbar = document.querySelector('.selection-bar');
      const stickyInset = toolbar && getComputedStyle(toolbar).position === 'sticky' ? toolbar.getBoundingClientRect().height : 0;
      const top = bounds.top + stickyInset + 24;
      if (rect.top < top || rect.top > bounds.bottom - 120) {
        pane.scrollTo?.({top: Math.max(0, pane.scrollTop + rect.top - top), behavior: reduced.matches ? 'auto' : 'smooth'});
      }
      return;
    }
  }

  function open(target) {
    const {card, details, summary, content, grid} = target;
    // Settle a native mobile disclosure if the breakpoint changed mid-animation.
    for (const node of [details, content]) for (const animation of node.getAnimations?.() || []) animation.cancel();
    details.style.removeProperty('height');
    details.style.removeProperty('overflow');
    details.open = false;
    const state = {...target, peers: new Map(), open: false, ticket: 0, timer: 0,
      shift: card.style.getPropertyValue('--archive-detail-shift'),
      attributes: ['aria-expanded', 'aria-controls', 'aria-haspopup'].map(name => [name, summary.getAttribute(name)])};
    if (!geometry(state)) return false;
    const panel = state.panel = document.createElement('section');
    panel.id = uniqueId();
    panel.className = 'archive-inline-details';
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', `${card.querySelector('h3')?.textContent.trim() || '当前作品'} · 更多作品信息`);
    const header = document.createElement('header');
    header.className = 'archive-inline-header';
    const heading = document.createElement('h4');
    heading.textContent = '更多作品信息';
    const closeButton = state.closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'archive-detail-close';
    closeButton.textContent = '收起 ×';
    closeButton.setAttribute('aria-label', '收起作品信息，恢复作品列表');
    closeButton.addEventListener('click', () => close());
    header.append(heading, closeButton);
    const body = document.createElement('div');
    body.className = 'archive-inline-information';
    body.tabIndex = 0;
    body.setAttribute('role', 'group');
    body.setAttribute('aria-label', '作品补充信息，可滚动阅读');
    state.home = document.createComment('Artwork details return here on close.');
    content.replaceWith(state.home);
    body.append(content);
    panel.append(header, body);
    card.append(panel);
    card.classList.add('archive-detail-card');
    summary.setAttribute('aria-controls', panel.id);
    summary.removeAttribute('aria-haspopup');
    current = state;
    measure(state);
    // Keep the reveal front rounded using the panel's actual shape tokens.
    const panelStyle = getComputedStyle(panel);
    panel.style.setProperty('--archive-detail-tip',
      `0 ${panelStyle.borderTopRightRadius} ${panelStyle.borderBottomRightRadius} 0`);
    // Commit the collapsed start before opening. Both the real card and its
    // attached panel reverse naturally if the same summary is toggled rapidly.
    panel.getBoundingClientRect();
    setOpen(state, true);
    revealRow(card);
    const reconcile = () => {
      if (current !== state) return;
      if (!measure(state)) { pending = null; dispose(state, state.panel.contains(document.activeElement)); }
    };
    if (window.MutationObserver) {
      state.observer = new window.MutationObserver(reconcile);
      state.observer.observe(archive, {subtree: true, childList: true, attributes: true, attributeFilter: ['hidden']});
    }
    if (window.ResizeObserver) {
      state.resizeObserver = new window.ResizeObserver(reconcile);
      state.resizeObserver.observe(grid);
      state.resizeObserver.observe(card);
    }
    return true;
  }

  // Capture precedes details-motion.js. Native mobile/random disclosures retain
  // their existing behavior; Enter and Space use the summary's native click.
  listen(document, 'click', event => {
    if (event.defaultPrevented || (event.button && event.button !== 0)) return;
    if (event.target.closest?.('[data-filter],.section-toggle,#clear-search,[data-remove]')) close({immediate: true, restoreFocus: false});
    const summary = event.target.closest?.('summary');
    if (current && summary === current.summary) {
      event.preventDefault(); event.stopImmediatePropagation();
      pending = null;
      setOpen(current, !current.open);
      return;
    }
    const target = candidate(summary);
    if (!target) return;
    if (current) {
      pending = target;
      setOpen(current, false, false);
    } else if (!open(target)) return;
    event.preventDefault(); event.stopImmediatePropagation();
  }, true);
  listen(document, 'input', event => {
    if (event.target.id === 'archive-search') close({immediate: true, restoreFocus: false});
  }, true);
  listen(document, 'change', event => {
    if (event.target.matches?.('[data-review]')) close({immediate: true, restoreFocus: false});
  }, true);
  listen(document, 'keydown', event => {
    if (event.key !== 'Escape' || event.defaultPrevented || !current || document.querySelector('dialog[open]')) return;
    event.preventDefault();
    close();
  });
  function resize() {
    if (!desktop.matches) { close({immediate: true}); return; }
    if (!current || resizeFrame) return;
    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = 0;
      if (current && !measure(current)) close({immediate: true});
    });
  }
  listen(window, 'resize', resize);
  if (desktop.addEventListener) listen(desktop, 'change', resize);
  else desktop.addListener(resize);
  listen(window, 'popstate', () => close({immediate: true, restoreFocus: false}));
  listen(window, 'hashchange', () => close({immediate: true, restoreFocus: false}));
  listen(window, 'pagehide', () => close({immediate: true, restoreFocus: false}));
  pageScope?.onCleanup(()=>{close({immediate:true,restoreFocus:false});window.cancelAnimationFrame?.(resizeFrame);desktop.removeListener?.(resize);});
})();

})();

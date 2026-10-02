/* Desktop archive detail viewer. Mobile disclosures and random review are untouched. */
(() => {
  'use strict';
  const desktop = window.matchMedia('(min-width: 861px)');
  const archive = document.getElementById('archive-content');
  if (!archive || typeof HTMLDialogElement === 'undefined') return;
  const probe = document.createElement('dialog');
  if (typeof probe.showModal !== 'function') return; // Keep native disclosure fallback.
  let dialog, previewPane, detailPane, title, closeButton, current;
  let backdropPointerDown = false;
  const dialogId = uniqueId('archive-detail-dialog');
  const titleId = uniqueId('archive-detail-title');

  function uniqueId(base) {
    let id = base, suffix = 1;
    while (document.getElementById(id)) id = `${base}-${suffix++}`;
    return id;
  }

  // A preview is read-only. Keep only delegated gallery controls, never clone
  // unbound select/remove controls or document-global identity/ARIA references.
  function cleanClone(node) {
    const copy = node.cloneNode(true);
    copy.querySelectorAll('.card-actions,.review-control,[data-review],[data-remove],.remove-work,form,input,select,textarea').forEach(el => el.remove());
    for (const el of [copy, ...copy.querySelectorAll('*')]) {
      for (const attr of [...el.attributes]) {
        if (attr.name === 'id' || attr.name === 'for' || attr.name === 'autofocus' ||
            attr.name === 'aria-labelledby' || attr.name === 'aria-describedby' ||
            attr.name === 'aria-controls' || attr.name === 'aria-owns' ||
            attr.name === 'data-search' || attr.name === 'data-default-status' ||
            attr.name === 'data-group' || /^on/i.test(attr.name)) el.removeAttribute(attr.name);
      }
    }
    return copy;
  }

  function ensureDialog() {
    if (dialog) return;
    dialog = probe;
    dialog.id = dialogId;
    dialog.className = 'archive-detail-dialog';
    dialog.setAttribute('aria-labelledby', titleId);
    dialog.setAttribute('aria-modal', 'true');
    const header = document.createElement('header');
    header.className = 'archive-detail-header';
    const heading = document.createElement('div');
    const eyebrow = document.createElement('p');
    eyebrow.className = 'archive-detail-eyebrow';
    eyebrow.textContent = '作品信息';
    title = document.createElement('h2');
    title.id = titleId;
    heading.append(eyebrow, title);
    closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'archive-detail-close';
    closeButton.textContent = '关闭 ×';
    closeButton.setAttribute('aria-label', '关闭作品信息，返回作品列表');
    closeButton.autofocus = true;
    closeButton.addEventListener('click', close);
    header.append(heading, closeButton);
    const layout = document.createElement('div');
    layout.className = 'archive-detail-layout';
    previewPane = document.createElement('section');
    previewPane.className = 'archive-detail-preview-pane';
    previewPane.setAttribute('aria-label', '当前作品预览');
    previewPane.tabIndex = 0; // Keyboard scrolling also works without a gallery.
    detailPane = document.createElement('section');
    detailPane.className = 'archive-detail-information';
    detailPane.setAttribute('aria-label', '完整作品补充信息');
    detailPane.tabIndex = 0;
    layout.append(previewPane, detailPane);
    dialog.append(header, layout);
    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      close();
    });
    dialog.addEventListener('close', () => {
      // Native close events are queued; an old event must not tear down a new open.
      if (!dialog.open) cleanup();
    });
    function outside(event) {
      if (event.target !== dialog) return false;
      const rect = dialog.getBoundingClientRect();
      return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
    }
    dialog.addEventListener('pointerdown', event => {
      backdropPointerDown = event.button === 0 && outside(event);
    });
    dialog.addEventListener('pointercancel', () => { backdropPointerDown = false; });
    dialog.addEventListener('click', event => {
      const shouldClose = backdropPointerDown && outside(event);
      backdropPointerDown = false;
      if (shouldClose) close();
    });
    document.body.append(dialog);
  }

  // One bounded measurement pass on open. Compensate for disappearing scrollbars
  // rather than changing card width and causing the background grid to reflow.
  function lockBackground(source) {
    const nodes = new Set([document.scrollingElement || document.documentElement]);
    for (let node = source.parentElement; node; node = node.parentElement) nodes.add(node);
    const properties = ['overflow', 'overflow-x', 'overflow-y', 'padding-right', 'scroll-behavior'];
    const records = [...nodes].map(node => {
      const style = getComputedStyle(node);
      const root = node === document.scrollingElement;
      const lock = root || /auto|scroll/.test(style.overflowY + style.overflowX);
      const gutter = root ? Math.max(0, window.innerWidth - document.documentElement.clientWidth) :
        Math.max(0, node.offsetWidth - node.clientWidth - (parseFloat(style.borderLeftWidth) || 0) - (parseFloat(style.borderRightWidth) || 0));
      // A stable gutter remains present with overflow:hidden; do not compensate twice.
      const stable = /stable/.test(style.scrollbarGutter);
      return {node, x: node.scrollLeft, y: node.scrollTop, lock, gutter: stable ? 0 : gutter,
        padding: parseFloat(style.paddingRight) || 0,
        saved: properties.map(name => [name, node.style.getPropertyValue(name), node.style.getPropertyPriority(name)])};
    });
    for (const record of records) {
      if (!record.lock) continue;
      record.node.style.setProperty('overflow', 'hidden', 'important');
      record.node.style.setProperty('scroll-behavior', 'auto', 'important');
      if (record.gutter) record.node.style.setProperty('padding-right', `${record.padding + record.gutter}px`, 'important');
    }
    return () => {
      for (const record of records) {
        if (!record.node.isConnected) continue;
        if (record.lock) {
          for (const [name] of record.saved) record.node.style.removeProperty(name);
          for (const [name, value, priority] of record.saved) if (value) record.node.style.setProperty(name, value, priority);
        }
        // Prevent pre-existing CSS smooth scrolling from animating restoration.
        const value = record.node.style.getPropertyValue('scroll-behavior');
        const priority = record.node.style.getPropertyPriority('scroll-behavior');
        record.node.style.setProperty('scroll-behavior', 'auto', 'important');
        record.node.scrollLeft = record.x;
        record.node.scrollTop = record.y;
        if (value) record.node.style.setProperty('scroll-behavior', value, priority);
        else record.node.style.removeProperty('scroll-behavior');
      }
    };
  }

  function cleanup(closeInner = true) {
    if (!current) return;
    // The optional lightbox closes synchronously before its outer lock is restored.
    if (closeInner) document.dispatchEvent(new Event('artwork-lightbox-close'));
    const state = current;
    current = null;
    state.restoreScroll();
    for (const [name, value] of state.summaryAttributes) {
      if (value === null) state.summary.removeAttribute(name);
      else state.summary.setAttribute(name, value);
    }
    previewPane.replaceChildren();
    detailPane.replaceChildren();
    const target = state.summary.isConnected && !state.summary.closest('[hidden]') ? state.summary : archive;
    target.focus({preventScroll: true});
  }

  function close() {
    if (!dialog || !current) return;
    // Finish the inner dialog while our preview trigger is still in the DOM.
    document.dispatchEvent(new Event('artwork-lightbox-close'));
    if (dialog.open) dialog.close();
    cleanup(false);
  }

  function open(card, summary, content) {
    ensureDialog();
    if (current) close();
    const preview = cleanClone(card);
    preview.classList.add('archive-detail-preview');
    preview.querySelectorAll('.card-sources details').forEach(el => el.remove());
    preview.setAttribute('aria-label', `作品预览：${card.querySelector('h3')?.textContent.trim() || '当前作品'}`);
    const information = cleanClone(content);
    title.textContent = card.querySelector('h3')?.textContent.trim() || '作品信息';
    dialog.classList.toggle('radar-private', Boolean(card.closest('.radar-private')));
    previewPane.replaceChildren(preview);
    detailPane.replaceChildren(information);
    current = {summary, restoreScroll: lockBackground(card),
      summaryAttributes: ['aria-expanded', 'aria-controls', 'aria-haspopup'].map(name => [name, summary.getAttribute(name)])};
    try { dialog.showModal(); }
    catch (_) { cleanup(); return false; }
    summary.setAttribute('aria-expanded', 'true');
    summary.setAttribute('aria-controls', dialogId);
    summary.setAttribute('aria-haspopup', 'dialog');
    previewPane.scrollTop = 0;
    detailPane.scrollTop = 0;
    closeButton.focus({preventScroll: true});
    return true;
  }

  // Capture is required: details-motion.js owns bubbling summary clicks on mobile.
  document.addEventListener('click', event => {
    if (!desktop.matches || event.defaultPrevented || (event.button && event.button !== 0)) return;
    const summary = event.target.closest?.('summary');
    const details = summary?.parentElement;
    const card = details?.closest('.card');
    if (details?.tagName !== 'DETAILS' || !details.closest('.card-sources') || !card ||
        !archive.contains(card) || !card.parentElement.matches('.grid,.archive-grid') ||
        card.closest('[data-radar-page="random"],#random-stage')) return;
    const content = details.querySelector('.details-content');
    if (!content || !open(card, summary, content)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  const resize = () => { if (!desktop.matches) close(); };
  if (desktop.addEventListener) desktop.addEventListener('change', resize);
  else desktop.addListener(resize);
  // Navigating by Back/Forward or an external section link never leaves a stale dialog.
  window.addEventListener('popstate', close);
  window.addEventListener('hashchange', close);
})();

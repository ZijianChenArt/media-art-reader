window.MediaArtPages ||= {};
window.MediaArtPages["archive"] = function(){

/* details-motion.js */
(() => {
const pageScope = window.MediaArtPage?.current;
const listen = (target, ...args) => { target?.addEventListener?.(...args); pageScope?.onCleanup(() => target?.removeEventListener?.(...args)); };
(() => {
 const active=new WeakMap();
 function toggle(details,summary){
  const panel=details.querySelector('.details-content');if(!panel)return;
  let old=active.get(details);
  // An external view may cancel native motion while changing disclosure state.
  if(old?.heightAnimation.playState==='idle'){old.contentAnimation.cancel();active.delete(details);old=null;}
  const expanded=!(old?old.expanded:details.open);
  const height=details.getBoundingClientRect().height;
  const opacity=details.open?getComputedStyle(panel).opacity:'0';
  old?.heightAnimation.cancel();old?.contentAnimation.cancel();active.delete(details);
  details.style.height='';details.style.overflow='';
  summary.setAttribute('aria-expanded',String(expanded));
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||!details.animate||!panel.animate){details.open=expanded;return;}
  // Measure native closed and open boxes synchronously, before the next paint.
  details.open=false;const closedHeight=details.getBoundingClientRect().height;
  details.open=true;const openHeight=details.getBoundingClientRect().height;
  details.style.overflow='hidden';
  const options={duration:320,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'};
  const state={expanded,heightAnimation:details.animate([{height:height+'px'},{height:(expanded?openHeight:closedHeight)+'px'}],options),contentAnimation:panel.animate([{opacity},{opacity:expanded?'1':'0'}],options)};
  active.set(details,state);
  state.heightAnimation.onfinish=()=>{
   if(active.get(details)!==state)return;
   details.open=expanded;state.heightAnimation.cancel();state.contentAnimation.cancel();
   details.style.height='';details.style.overflow='';active.delete(details);
  };
 }
 listen(document, 'click',event=>{
  const summary=event.target.closest?.('summary');if(!summary)return;
  const details=summary.parentElement;if(details?.tagName!=='DETAILS'||!details.closest('.card-sources'))return;
  if(event.button&&event.button!==0)return;
  event.preventDefault();toggle(details,summary);
 });
})();

})();


/* gallery.js */
(() => {
const pageScope = window.MediaArtPage?.current;
const listen = (target, ...args) => { target?.addEventListener?.(...args); pageScope?.onCleanup(() => target?.removeEventListener?.(...args)); };
// Delegation also handles cards freshly drawn on the random page.
function stepGallery(gallery,direction){
 if(gallery?.dataset.randomStacked==='true')return;
 const slides=[...gallery.querySelectorAll('[data-slide]')];if(slides.length<2)return;
 const previous=Math.max(0,slides.findIndex(slide=>!slide.hidden));
 const next=(previous+direction+slides.length)%slides.length;
 slides.forEach((slide,i)=>{slide.hidden=i!==next});
 gallery.querySelector('.gallery-count').textContent=(next+1)+' / '+slides.length;
 const image=slides[next].querySelector('img');if(image)image.loading='eager';
}
listen(document, 'click',event=>{
 const button=event.target.closest?.('[data-gallery-step]');if(!button)return;
 event.preventDefault();stepGallery(button.closest('[data-gallery]'),Number(button.dataset.galleryStep));
});
listen(document, 'keydown',event=>{
 if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
 const gallery=event.target.closest?.('[data-gallery]');if(!gallery||gallery.querySelectorAll('[data-slide]').length<2)return;
 event.preventDefault();stepGallery(gallery,event.key==='ArrowRight'?1:-1);
});

})();


/* artwork-lightbox.js */
(() => {
const pageScope = window.MediaArtPage?.current;
const listen = (target, ...args) => { target?.addEventListener?.(...args); pageScope?.onCleanup(() => target?.removeEventListener?.(...args)); };
// Read-only, delegated image preview for archive cards, random cards and detail clones.
(() => {
  const dialog = document.createElement('dialog');
  dialog.className = 'artwork-lightbox';
  dialog.setAttribute('aria-label', '作品图片预览');
  dialog.setAttribute('aria-modal', 'true');
  dialog.innerHTML = `<div class="artwork-lightbox__toolbar">
    <p class="artwork-lightbox__caption"></p>
    <a class="artwork-lightbox__original" target="_blank" rel="noopener noreferrer" hidden>图片来源</a>
    <button class="artwork-lightbox__close" type="button" aria-label="关闭图片预览" autofocus><span aria-hidden="true">×</span><span>关闭</span></button>
  </div>
  <div class="artwork-lightbox__stage"><img class="artwork-lightbox__image" alt="" decoding="async" draggable="false"><p class="artwork-lightbox__status" role="status" hidden></p></div>`;
  document.body.appendChild(dialog);

  const image = dialog.querySelector('.artwork-lightbox__image');
  const caption = dialog.querySelector('.artwork-lightbox__caption');
  const sourceLink = dialog.querySelector('.artwork-lightbox__original');
  const closeButton = dialog.querySelector('.artwork-lightbox__close');
  const status = dialog.querySelector('.artwork-lightbox__status');
  const lockProperties = ['overflow', 'overflow-x', 'overflow-y', 'scrollbar-gutter'];
  let session = null;
  let backgroundPointerDown = false;

  function lockScroll(trigger) {
    const elements = new Set([document.documentElement, document.body]);
    for (let parent = trigger.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (/auto|scroll|overlay/.test(`${style.overflowX} ${style.overflowY}`) || parent.localName === 'dialog') elements.add(parent);
    }
    // The shell has a separate scrolling viewport; include it even for a body-level clone.
    document.querySelectorAll('#radar-stage, dialog[open]').forEach(element => {
      if (element !== dialog) elements.add(element);
    });
    const locks = [...elements].map(element => ({
      element,
      top: element.scrollTop,
      left: element.scrollLeft,
      styles: lockProperties.map(name => [name, element.style.getPropertyValue(name), element.style.getPropertyPriority(name)])
    }));
    const viewport = {left: window.scrollX, top: window.scrollY};
    locks.forEach(({element}) => {
      // Stable gutters avoid changing the card grid width when its scrollbar disappears.
      const style = getComputedStyle(element);
      const hasScrollbar = element === document.documentElement
        ? window.innerWidth > element.clientWidth
        : element.scrollHeight > element.clientHeight && /auto|scroll|overlay/.test(style.overflowY);
      if (hasScrollbar && !style.scrollbarGutter?.includes('stable')) element.style.setProperty('scrollbar-gutter', 'stable');
      element.style.setProperty('overflow', 'hidden', 'important');
    });
    return {locks, viewport};
  }

  function restoreScroll({locks, viewport}) {
    locks.forEach(({element, styles}) => {
      lockProperties.forEach(name => element.style.removeProperty(name));
      styles.forEach(([name, value, priority]) => {
        if (value) element.style.setProperty(name, value, priority);
      });
    });
    // Prevent pre-existing smooth-scroll rules from animating restoration.
    const scrollingElements = new Set(locks.map(({element}) => element));
    scrollingElements.add(document.documentElement);
    const behavior = [...scrollingElements].map(element => [element, element.style.getPropertyValue('scroll-behavior'), element.style.getPropertyPriority('scroll-behavior')]);
    behavior.forEach(([element]) => element.style.setProperty('scroll-behavior', 'auto', 'important'));
    locks.forEach(({element, top, left}) => { element.scrollTop = top; element.scrollLeft = left; });
    window.scrollTo({left: viewport.left, top: viewport.top, behavior: 'instant'});
    behavior.forEach(([element, value, priority]) => {
      if (value) element.style.setProperty('scroll-behavior', value, priority);
      else element.style.removeProperty('scroll-behavior');
    });
  }

  function cleanUp() {
    if (!session) return;
    const previous = session;
    session = null;
    backgroundPointerDown = false;
    image.removeAttribute('src');
    sourceLink.removeAttribute('href');
    sourceLink.hidden = true;
    image.alt = '';
    caption.textContent = '';
    status.hidden = true;
    // Restore focus before positions in case native dialog focus restoration scrolled.
    if (previous.trigger.isConnected && !previous.trigger.closest('[hidden]')) previous.trigger.focus({preventScroll: true});
    restoreScroll(previous);
  }

  function closePreview() {
    if (dialog.open) dialog.close();
    // Synchronous cleanup also composes with a parent detail dialog closing on resize.
    cleanUp();
  }

  function openPreview(trigger) {
    const original = trigger.querySelector('img');
    if (!original || trigger.closest('[hidden]')) return false;
    // Modern browsers provide focus trapping and inert background through showModal.
    if (typeof dialog.showModal !== 'function') return false;
    if (dialog.open) closePreview();
    const source = trigger.dataset.lightboxSrc || trigger.href || original.currentSrc || original.src;
    if (!source) return false;
    const description = original.alt || '作品图片';
    session = {trigger, ...lockScroll(trigger)};
    image.alt = description;
    caption.textContent = description;
    dialog.setAttribute('aria-label', `${description} · 图片预览`);
    status.hidden = true;
    const sourcePage = trigger.dataset.imageSource;
    if (sourcePage) sourceLink.href = sourcePage;
    else sourceLink.removeAttribute('href');
    sourceLink.hidden = !sourcePage;
    image.src = source;
    try {
      dialog.showModal();
      closeButton.focus({preventScroll: true});
      return true;
    } catch (error) {
      cleanUp();
      return false;
    }
  }

  listen(document, 'click', event => {
    if (event.defaultPrevented || event.target.closest?.('[data-gallery-step]')) return;
    const trigger = event.target.closest?.('a.image-slide');
    if (!trigger || !openPreview(trigger)) return;
    event.preventDefault();
  });

  closeButton.addEventListener('click', closePreview);
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    event.stopPropagation();
    closePreview();
  });
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    closePreview();
  });
  // Require both pointer-down and click on empty space, so dragging off the image
  // or a control does not accidentally dismiss the preview.
  const isBackground = target => target === dialog || target === dialog.querySelector('.artwork-lightbox__stage');
  dialog.addEventListener('pointerdown', event => { backgroundPointerDown = isBackground(event.target); });
  dialog.addEventListener('click', event => {
    if (backgroundPointerDown && isBackground(event.target)) closePreview();
    backgroundPointerDown = false;
  });
  dialog.addEventListener('close', () => {
    // A queued close event from the previous opening must not clean up a new one.
    if (!dialog.open) cleanUp();
  });
  image.addEventListener('error', () => {
    if (!session) return;
    status.textContent = '图片暂时无法显示，请关闭后重试。';
    status.hidden = false;
  });
  image.addEventListener('load', () => { status.hidden = true; });
  // Parent detail views dispatch before restoring their own scroll lock.
  listen(document, 'artwork-lightbox-close', closePreview);
  pageScope?.onCleanup(()=>{closePreview();dialog.remove();});
})();

})();


/* review-dropdown.js */
(() => {
const pageScope = window.MediaArtPage?.current;
const listen = (target, ...args) => { target?.addEventListener?.(...args); pageScope?.onCleanup(() => target?.removeEventListener?.(...args)); };
/* A select-only combobox; the native select remains the existing save adapter. */
(() => {
  'use strict';
  const controls = new WeakMap(), buttons = new WeakMap();
  let active = null, sequence = 0, restoreAfterSave = null, pointerToggle = null;
  const unavailable = control => control.select.disabled || !control.button.isConnected || !!control.button.closest('[hidden],[inert],[aria-hidden="true"]');
  const focus = node => { if (node?.isConnected && !node.closest('[hidden],[inert]')) node.focus({preventScroll: true}); };
  const selected = select => [...select.options].find(option => option.selected) || select.options[0];

  function close({restoreFocus = false} = {}) {
    if (!active) return;
    const {control, list} = active;
    active = null;
    list.remove();
    control.button.setAttribute('aria-expanded', 'false');
    control.button.removeAttribute('aria-activedescendant');
    control.button.removeAttribute('aria-controls');
    if (restoreFocus) focus(control.button);
  }

  function sync(control) {
    const {select, button, label} = control, option = selected(select);
    label.textContent = option?.textContent || '';
    button.dataset.state = option?.value || 'pending';
    // aria-disabled retains keyboard focus during the brief optimistic save.
    button.setAttribute('aria-disabled', String(select.disabled));
    if (active?.control === control && unavailable(control)) close();
  }

  function enhance(select) {
    if (controls.has(select)) return controls.get(select);
    const old = select.parentElement;
    if (!old?.classList.contains('review-control')) return null;
    // Do not put two labelable controls inside the original native label.
    const wrapper = document.createElement('div');
    wrapper.className = 'review-control is-enhanced';
    old.replaceWith(wrapper);
    wrapper.append(...old.childNodes);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'review-trigger';
    button.setAttribute('role', 'combobox');
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');
    const name = wrapper.querySelector('.sr-only');
    const label = document.createElement('span');
    label.className = 'review-value';
    const id = 'review-picker-' + ++sequence;
    label.id = id + '-value';
    if (name) {
      name.id = id + '-name';
      name.textContent = select.getAttribute('aria-label') || '筛选状态';
      button.setAttribute('aria-labelledby', name.id + ' ' + label.id);
    } else button.setAttribute('aria-label', select.getAttribute('aria-label') || '筛选状态');
    button.append(label);
    wrapper.append(button);
    select.hidden = true;
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');
    const control = {select, button, label, id};
    controls.set(select, control);
    buttons.set(button, control);
    select.addEventListener('change', () => sync(control));
    button.addEventListener('click', event => {
      // A touch can move focus or resize the visual viewport before its click.
      // Preserve the intent at pointerdown so a dismissed menu cannot reopen.
      const wasOpen = pointerToggle?.control === control ? pointerToggle.wasOpen : active?.control === control;
      pointerToggle = null;
      if (event.defaultPrevented || event.button > 0 || unavailable(control)) return;
      if (wasOpen) close();
      else open(control);
    });
    button.addEventListener('keydown', event => keydown(event, control));
    sync(control);
    return control;
  }

  function viewport() {
    const view = window.visualViewport;
    return {left: view?.offsetLeft || 0, top: view?.offsetTop || 0,
      width: view?.width || window.innerWidth || document.documentElement.clientWidth,
      height: view?.height || window.innerHeight || document.documentElement.clientHeight};
  }

  function position(reveal = false) {
    if (!active) return;
    const {control, list} = active;
    if (unavailable(control)) { close(); return; }
    const view = viewport(), edge = 8, gap = 7;
    let rect = control.button.getBoundingClientRect();
    // Reveal space below a low trigger, including the archive's own scroll pane.
    if (reveal && view.top + view.height - rect.bottom < Math.min(160, view.height / 2)) {
      control.button.scrollIntoView?.({block: 'center', inline: 'nearest', behavior: 'instant'});
      rect = control.button.getBoundingClientRect();
    }
    if (rect.bottom < view.top || rect.top > view.top + view.height) { close(); return; }
    const width = Math.min(Math.max(rect.width, 156), view.width - edge * 2);
    const left = Math.max(view.left + edge, Math.min(rect.left, view.left + view.width - width - edge));
    // Tiny/zoomed viewports retain at least one scrollable option. In ordinary
    // viewports the panel is always anchored just below the pill.
    const top = Math.max(view.top + edge, Math.min(rect.bottom + gap, view.top + view.height - 54));
    list.style.left = left + 'px';
    list.style.top = top + 'px';
    list.style.width = width + 'px';
    list.style.maxHeight = Math.max(0, view.top + view.height - top - edge) + 'px';
  }

  function highlight(index, scroll = false) {
    if (!active) return;
    const {control, options} = active;
    active.index = Math.max(0, Math.min(index, options.length - 1));
    options.forEach((option, i) => option.classList.toggle('is-active', i === active.index));
    const option = options[active.index];
    control.button.setAttribute('aria-activedescendant', option.id);
    if (scroll) option.scrollIntoView?.({block: 'nearest', inline: 'nearest'});
  }

  function open(control) {
    close();
    sync(control);
    if (unavailable(control)) return;
    const list = document.createElement('div');
    list.id = control.id + '-list';
    list.className = 'review-options';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', control.select.getAttribute('aria-label') || '筛选状态');
    const current = selected(control.select)?.value;
    const options = [...control.select.options].map((source, index) => {
      const option = document.createElement('div');
      option.id = control.id + '-option-' + index;
      option.className = 'review-option';
      option.dataset.value = source.value;
      option.dataset.state = source.value;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(source.value === current));
      const label = document.createElement('span');
      label.textContent = source.textContent;
      option.append(label);
      option.addEventListener('pointermove', () => highlight(index));
      option.addEventListener('click', () => commit(index));
      list.append(option);
      return option;
    });
    // Pointer selection keeps focus in the combobox, not on a transient panel.
    list.addEventListener('pointerdown', event => event.preventDefault());
    document.body.append(list);
    active = {control, list, options, index: 0};
    control.button.setAttribute('aria-controls', list.id);
    control.button.setAttribute('aria-expanded', 'true');
    position(true);
    if (!active) return;
    highlight(Math.max(0, options.findIndex(option => option.dataset.value === current)));
    focus(control.button);
  }

  function commit(index) {
    if (!active) return;
    const {control, options} = active, value = options[index]?.dataset.value;
    if (!value || unavailable(control)) { close(); return; }
    const previous = selected(control.select)?.value;
    close({restoreFocus: true});
    if (value === previous) return;
    restoreAfterSave = control;
    control.select.value = value;
    control.select.dispatchEvent(new window.Event('change', {bubbles: true}));
  }

  function keydown(event, control) {
    pointerToggle = null;
    if (event.defaultPrevented || unavailable(control)) return;
    const isOpen = active?.control === control;
    if (event.key === 'Escape' && isOpen) {
      event.preventDefault(); event.stopPropagation(); close({restoreFocus: true}); return;
    }
    if (event.key === 'Tab') { if (isOpen) close(); return; }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (isOpen) commit(active.index); else open(control);
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (!isOpen) { open(control); if (!active) return; }
    if (event.key === 'Home') highlight(0, true);
    else if (event.key === 'End') highlight(active.options.length - 1, true);
    else if (isOpen) highlight(active.index + (event.key === 'ArrowDown' ? 1 : -1), true);
  }

  function refresh() {
    document.querySelectorAll('select[data-review]').forEach(select => {
      const control = enhance(select);
      if (control) sync(control);
    });
    if (active) position();
    if (!restoreAfterSave) return;
    const {select, button} = restoreAfterSave;
    const elsewhere = document.activeElement && ![document.body, button, select].includes(document.activeElement);
    if (elsewhere) { restoreAfterSave = null; return; }
    if (!button.isConnected || button.closest('[hidden],[inert]')) {
      focus(document.querySelector('[data-filter][aria-pressed="true"]') || document.getElementById('archive-search'));
      restoreAfterSave = null;
    } else if (!select.disabled) { focus(button); restoreAfterSave = null; }
  }

  function outside(event) {
    if (active && !active.control.button.contains(event.target) && !active.list.contains(event.target)) close();
  }
  listen(document, 'pointerdown', event => {
    const control = buttons.get(event.target.closest?.('.review-trigger'));
    pointerToggle = control && event.isPrimary !== false && !(event.button > 0) && !unavailable(control)
      ? {control, pointerId: event.pointerId, wasOpen: active?.control === control} : null;
    outside(event);
  }, true);
  listen(document, 'pointercancel', () => { pointerToggle = null; }, true);
  listen(document, 'pointerup', event => {
    if (pointerToggle && pointerToggle.pointerId === event.pointerId && !pointerToggle.control.button.contains(event.target)) pointerToggle = null;
  }, true);
  listen(document, 'click', event => {
    if (pointerToggle && !pointerToggle.control.button.contains(event.target)) pointerToggle = null;
    outside(event);
  }, true);
  listen(document, 'focusin', outside, true);
  listen(document, 'scroll', event => { if (active && !active.list.contains(event.target)) position(); }, true);
  listen(window, 'resize', () => close());
  listen(window.visualViewport, 'resize', () => close());
  listen(window.visualViewport, 'scroll', () => position());
  for (const event of ['pagehide', 'popstate', 'hashchange']) listen(window, event, () => { pointerToggle = null; close(); });
  window.ArtworkReviewDropdown = {refresh, close};
  pageScope?.onCleanup(()=>{close();delete window.ArtworkReviewDropdown;});
  refresh();
})();

})();


/* archive-detail.js */
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


/* remove-confirm.js */
(() => {
const pageScope = window.MediaArtPage?.current;
const listen = (target, ...args) => { target?.addEventListener?.(...args); pageScope?.onCleanup(() => target?.removeEventListener?.(...args)); };
// Confirmation is read-only. Only an explicit confirm invokes the supplied action.
(() => {
 const dialog=document.createElement('dialog');
 dialog.className='remove-confirm';
 dialog.setAttribute('aria-labelledby','remove-confirm-title');
 dialog.setAttribute('aria-describedby','remove-confirm-description');
 dialog.setAttribute('aria-modal','true');
 dialog.innerHTML='<h2 id="remove-confirm-title">从本站移除作品？</h2><p id="remove-confirm-description"></p><div class="remove-confirm-actions"><button type="button" data-remove-cancel autofocus>取消</button><button type="button" data-remove-confirm>从本站移除</button></div>';
 document.body.appendChild(dialog);
 const description=dialog.querySelector('p'),cancel=dialog.querySelector('[data-remove-cancel]'),confirm=dialog.querySelector('[data-remove-confirm]');
 let pending=null;
 function finish(accepted=false){
  if(!pending)return;
  const action=pending;pending=null;
  if(dialog.open)dialog.close();
  if(action.trigger?.isConnected)action.trigger.focus({preventScroll:true});
  if(accepted)action.onConfirm();
 }
 cancel.addEventListener('click',()=>finish(false));
 confirm.addEventListener('click',()=>finish(true));
 dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});
 dialog.addEventListener('close',()=>{if(!dialog.open)finish(false);});
 listen(window, 'pagehide',()=>finish(false));
 pageScope?.onCleanup(()=>{finish(false);dialog.remove();delete window.confirmArtworkRemoval;});
 window.confirmArtworkRemoval=({title,trigger,onConfirm})=>{
  if(pending)return;
  if(typeof dialog.showModal!=='function'){
   if(typeof window.confirm==='function'&&window.confirm('确认将《'+title+'》从本站下架？所有访客都将看不到这件作品。保留私密可恢复备份及操作记录，七天后复核，不会自动清理。'))onConfirm();
   return;
  }
  pending={trigger,onConfirm};
  description.textContent='将《'+title+'》从本站下架，所有访客都将看不到这件作品。保留私密可恢复备份及操作记录，七天后复核，不会自动清理。';
  try{dialog.showModal();cancel.focus({preventScroll:true});}
  catch{finish(false);}
 };
})();

})();


/* archive-search.js */
/* Shared, dependency-free browser matcher. Conversion happens at build time. */
(() => {
  'use strict';
  const fold = value => String(value ?? '').normalize('NFKD')
    .replace(/\p{M}/gu, '').toLowerCase()
    .replaceAll('鍋', '锅').replaceAll('證', '证').replaceAll('築', '筑');
  const normalize = value => fold(value).replace(/[^\p{L}\p{N}]+/gu, '');
  const terms = value => String(value ?? '').trim().split(/[\s\p{Dash_Punctuation}]+/u).map(normalize).filter(Boolean);
  // Common unaccented input accepts lu/lv/lü; this does not change Latin text.
  const pinyinKey = value => normalize(value).replaceAll('v', 'u');

  function createIndex(text, readings = []) {
    if (typeof readings === 'string') {
      try { readings = JSON.parse(readings); } catch { readings = []; }
    }
    if (!Array.isArray(readings)) readings = [];
    const prefixes = new Set();
    for (const phrase of readings) {
      if (typeof phrase !== 'string') continue;
      const syllables = phrase.split(/\s+/).map(pinyinKey).filter(Boolean);
      // Only start at a syllable boundary: "meilai" can find 李美来,
      // but the interior fragment "ime" cannot. Keep phrases separate.
      for (let start = 0; start < syllables.length; start++) {
        prefixes.add(syllables.slice(start).join(''));
      }
    }
    return { text: normalize(text), words: fold(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean), pinyin: [...prefixes] };
  }

  function matches(index, query) {
    if (typeof query === 'string') query = terms(query);
    // Preserve full multilingual/English AND search. For an unfinished phrase
    // such as "li m", do not AND the letters against arbitrary substrings.
    const partialPhrase = query.length > 1 && query.some(term => /^[a-z]$/.test(term));
    const nativeMatch = partialPhrase
      ? query[0].length >= 2 && index.words.some((_word, start) =>
          query.every((term, offset) => index.words[start + offset]?.startsWith(term)))
      : query.every(term => index.text.includes(term));
    if (nativeMatch) return true;
    if (!query.length || query[0].length < 2) return false;
    const compact = pinyinKey(query.join(''));
    // No pinyin-only single-initial expansion or unanchored substring matching.
    if (compact.length < 2 || !/^[a-z]+$/.test(compact)) return false;
    return index.pinyin.some(phrase => phrase.startsWith(compact));
  }

  globalThis.ArchiveSearch = Object.freeze({ normalize, terms, createIndex, matches });
})();


/* artwork-export.js */
(() => {
 'use strict';
 window.ArtworkExport={create({scope,getState,prepare,validate,setLocked}){
  const root=document.getElementById('artwork-export'),trigger=document.getElementById('export-selected'),panel=document.getElementById('export-options'),status=document.getElementById('export-status'),cancel=document.getElementById('cancel-export');
  if(!root)return null;
  let running=false,controller=null,alive=true;
  const listen=(target,type,fn)=>{target.addEventListener(type,fn);scope?.onCleanup(()=>target.removeEventListener(type,fn));};
  const message=(value,tone='neutral')=>{if(!alive)return;status.textContent=value;status.dataset.tone=tone;};
  function close(focus=false){panel.hidden=true;trigger.setAttribute('aria-expanded','false');if(focus)trigger.focus();}
  function refresh(){const s=getState();trigger.disabled=running||!s.loaded||s.anonymous||s.loading||s.busy||!s.count;trigger.title=s.anonymous?'登录后可导出自己的精选作品':s.loading||!s.loaded?'读取筛选状态后可导出':s.busy?'请等待筛选保存完成':!s.count?'先将作品设为精选，再导出':'导出账号内全部精选作品，不受当前搜索和分类限制';trigger.setAttribute('aria-label',s.count?'导出精选，共 '+s.count+' 件作品':'导出精选');if(trigger.disabled)close();}
  const download=(bytes,type,name)=>{const url=URL.createObjectURL(new Blob([bytes],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);};
  const current=()=>{if(!alive||controller?.signal.aborted)throw new DOMException('已取消导出','AbortError');};
  async function imageBytes(work,signal){
   if(!work.imageURL || work.imageStatus==='unverified')return null;
   const url=new URL(work.imageURL,location.href);if(url.origin!==location.origin||!url.pathname.startsWith('/assets/optimized/'))return null;
   const response=await fetch(url,{signal,credentials:'same-origin'});if(!response.ok)throw new Error('图片读取失败');
   const blob=await response.blob(),object=URL.createObjectURL(blob),image=new Image();
   try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{image.src='';reject(new Error('图片读取超时'))},15000);const abort=()=>{clearTimeout(timer);image.src='';reject(new DOMException('已取消导出','AbortError'))};signal.addEventListener('abort',abort,{once:true});image.onload=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);resolve()};image.onerror=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);reject(new Error('图片读取失败'))};image.src=object;});current();const scale=Math.min(1,1400/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);const result=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.87));if(!result)throw new Error('图片转换失败');return new Uint8Array(await result.arrayBuffer());}finally{URL.revokeObjectURL(object);}
  }
  async function run(format){
   const s=getState();if(running||!alive||!s.loaded||s.anonymous||s.loading||s.busy||!s.count)return;
   close();running=true;controller=new AbortController();cancel.hidden=false;setLocked(true);refresh();message('正在读取最新精选…');
   try{
    const snapshot=await prepare(controller.signal);current();if(!snapshot.records.length){message('还没有精选作品。请先选择作品再导出。');return;}
    const module=await import('/selected-pdf.mjs?v=19e84afa1aa0');current();const date=new Date();let bytes,type,detail='';
    if(format==='csv'){bytes=module.createCSV(snapshot.records);type='text/csv;charset=utf-8';}
    else{message('正在准备 PDF 字体与图片…');const [pdfLib,fontkit,fontResponse]=await Promise.all([import('/export-assets/pdf-lib.mjs?v=ceaad70f8d35'),import('/export-assets/fontkit.mjs?v=aa84fe556fd5'),fetch('/export-assets/archive-export-font.ttf?v=19e84afa1aa0',{signal:controller.signal,credentials:'same-origin'})]);if(!fontResponse.ok)throw new Error('PDF 字体读取失败，请重试。');current();const result=await module.createSelectedPDF(snapshot.records,{pdfLib,fontkit:fontkit.default,fontBytes:await fontResponse.arrayBuffer(),loadImage:imageBytes,signal:controller.signal,date,onProgress:(done,total)=>message('正在生成 PDF：'+done+' / '+total+' 件')});bytes=result.bytes;type='application/pdf';if(result.missingImages)detail='；'+result.missingImages+' 张图片未能读取，已保留来源链接';}
    current();message('正在确认精选状态…');await validate(snapshot.key,controller.signal);current();download(bytes,type,module.fileName(format,date));message('已生成 '+snapshot.records.length+' 件精选作品的 '+format.toUpperCase()+'，请查看浏览器下载'+detail+'。');
   }catch(error){if(error.name==='AbortError')message('已取消导出。');else message(error.message||'导出失败，请重试。','error');}
   finally{running=false;controller=null;if(alive){cancel.hidden=true;setLocked(false);refresh();}}
  }
  listen(trigger,'click',()=>{if(trigger.disabled)return;const open=panel.hidden;panel.hidden=!open;trigger.setAttribute('aria-expanded',String(open));if(open)panel.querySelector('button').focus();});
  panel.querySelectorAll('[data-export-format]').forEach(button=>listen(button,'click',()=>run(button.dataset.exportFormat)));
  listen(document,'click',event=>{if(!root.contains(event.target))close()});
  listen(root,'focusout',event=>{if(event.relatedTarget&&!root.contains(event.relatedTarget))close()});
  listen(document,'keydown',event=>{if(event.key==='Escape'&&!panel.hidden){event.preventDefault();close(true)}});
  listen(cancel,'click',()=>controller?.abort());
  scope?.onCleanup(()=>{alive=false;controller?.abort();close();});
  refresh();return {refresh,run};
 }};
})();


/* account-menu.js */
(() => {
 'use strict';
 const scope=window.MediaArtPage?.current;
 const menu=document.getElementById('account-menu'),trigger=document.getElementById('account-menu-trigger'),panel=document.getElementById('account-menu-panel');
 if(!menu||!trigger||!panel)return;
 const signin=menu.querySelector('.account-signin'),status=document.getElementById('account-status-trigger'),signout=panel.querySelector('.account-signout');
 const listen=(target,type,fn,options)=>{target?.addEventListener(type,fn,options);scope?.onCleanup(()=>target?.removeEventListener(type,fn,options));};
 const items=()=>[...panel.querySelectorAll('[role="menuitem"]')].filter(node=>!node.hidden&&!node.disabled);
 const focus=node=>node?.isConnected&&node.focus({preventScroll:true});
 let unresolvedState='loading';
 function close(restore=false){panel.hidden=true;trigger.setAttribute('aria-expanded','false');if(restore&&!trigger.hidden)focus(trigger);}
 function open(last=false){if(trigger.hidden||scope?.active===false)return;panel.hidden=false;trigger.setAttribute('aria-expanded','true');focus(last?items().at(-1):items()[0]);}
 function updateLoginReturn(){
  const path=window.location?.pathname;if(!path||!path.startsWith('/')||path.startsWith('//'))return;
  signin.setAttribute('href','/signin-with-chatgpt?return_to='+encodeURIComponent(path+(window.location.search||'')+(window.location.hash||'')));
 }
 function refresh(error=false){
  if(scope?.active===false)return;
  const wasFocused=menu.contains(document.activeElement),signedIn=!signout.hidden,guest=!signin.hidden;
  if(error===true)unresolvedState='error';else if(error==='loading')unresolvedState='loading';
  const state=signedIn?'signed-in':guest?'guest':unresolvedState;
  menu.dataset.accountState=state;trigger.hidden=!signedIn;status.hidden=signedIn||guest;status.disabled=state!=='error';
  status.querySelector('span').textContent=state==='error'?'重试':'账户';status.setAttribute('aria-label',state==='error'?'重新读取账户状态':'正在读取账户状态');
  if(!signedIn||!items().includes(document.activeElement)&&panel.contains(document.activeElement))close();
  if(wasFocused&&document.activeElement?.closest('[hidden]'))focus(signedIn?trigger:guest?signin:status);
  updateLoginReturn();
 }
 listen(status,'click',()=>{if(status.disabled)return;refresh('loading');document.querySelector('#retry-load,#random-retry')?.click();});
 listen(trigger,'click',()=>{if(panel.hidden)open();else close(true);});
 listen(trigger,'keydown',event=>{if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();open(event.key==='ArrowUp');}});
 listen(panel,'keydown',event=>{
  const options=items(),index=options.indexOf(document.activeElement);
  if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
   event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?options.length-1:(index+(event.key==='ArrowUp'?-1:1)+options.length)%options.length;focus(options[next]);
  }else if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);}
  else if(event.key==='Tab')close(true);
 });
 listen(panel,'click',event=>{if(event.target.closest?.('[role="menuitem"]'))close(panel.contains(document.activeElement));});
 listen(document,'pointerdown',event=>{if(!menu.contains(event.target))close();});
 listen(document,'focusin',event=>{if(!menu.contains(event.target))close();});
 listen(document,'keydown',event=>{if(event.key==='Escape'&&!panel.hidden){event.preventDefault();close(true);}});
 listen(window,'media-route',()=>{close();updateLoginReturn();});
 listen(window,'pagehide',()=>close());
 const controller={refresh,close};window.ArtworkAccountMenu=controller;
 scope?.onCleanup(()=>{close();if(window.ArtworkAccountMenu===controller)delete window.ArtworkAccountMenu;});
 refresh();
})();


/* selections.js */
(() => {
const pageScope = window.MediaArtPage?.current;
const listen = (target, ...args) => { target?.addEventListener?.(...args); pageScope?.onCleanup(() => target?.removeEventListener?.(...args)); };
// Only the current page is live DOM; the remaining catalog stays inert JSON.
function archiveRecords(){
 let records=[];try{records=JSON.parse(document.getElementById('archive-records')?.textContent||'[]')}catch(error){console.warn('Archive index unavailable; keeping the initial works',error)}
 if(!records.length)records=[...document.querySelectorAll('.card')].map(card=>({id:card.id,title:card.querySelector('h3')?.textContent,defaultStatus:card.dataset.defaultStatus,retired:card.dataset.retired==='true',search:card.dataset.search,searchPinyin:card.dataset.searchPinyin,html:card.outerHTML}));
 return records.map(record=>({...record,card:document.getElementById(record.id),searchIndex:ArchiveSearch.createIndex(record.search,record.searchPinyin)}));
}
function archiveCard(entry){
 if(!entry.card){const template=document.createElement('template');template.innerHTML=entry.html;entry.card=template.content.firstElementChild;}
 return entry.card;
}
function archivePager(draw){
 const panel=document.getElementById('archive-pagination'),button=document.getElementById('archive-load-more'),status=document.getElementById('archive-page-status');
 let limit=10,columns=0,observer,root,remaining=0,scheduled=false;
 pageScope?.onCleanup(()=>observer?.disconnect());
 const mobile=()=>window.matchMedia?.('(max-width: 860px)').matches??!(window.innerWidth>860);
 function measure(){
  const grid=[...document.querySelectorAll('.grid,.archive-grid')].find(el=>!el.hidden&&!el.closest('.section')?.hidden);
  if(!grid)return columns||1;
  const tracks=window.getComputedStyle?.(grid).gridTemplateColumns;
  return tracks&&tracks!=='none'?tracks.trim().split(/\s+(?![^()]*\))/).length:1;
 }
 function batch(){return mobile()?10:Math.ceil(10/Math.max(1,columns))*Math.max(1,columns)}
 function more(){if(!remaining)return;limit+=batch();draw();}
 function watch(){
  const nextRoot=mobile()?null:document.getElementById('radar-stage');
  observer?.disconnect();root=nextRoot;
  if(!window.IntersectionObserver||!remaining)return;
  observer=new window.IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)&&remaining)more();},{root,rootMargin:'650px 0px',threshold:0});
  observer.observe(panel);
 }
 button?.addEventListener('click',more);
 function resize(){
  if(pageScope && !pageScope.active)return;
  const next=measure();if(next===columns&&root===(mobile()?null:document.getElementById('radar-stage')))return;
  columns=next;limit=Math.max(batch(),Math.ceil(limit/columns)*columns);draw();
 }
 listen(window, 'resize',()=>{if(scheduled)return;scheduled=true;(window.requestAnimationFrame||((fn)=>fn()))(()=>{scheduled=false;resize()});});
 return {
  reset(){columns=measure();limit=batch();},
  reveal(index){columns=measure();limit=Math.max(limit,Math.ceil((index+1)/batch())*batch());},
  get limit(){const next=measure();if(!columns){columns=next;limit=batch()}else if(next!==columns){columns=next;limit=Math.max(batch(),Math.ceil(limit/columns)*columns)}return limit;},
  update(shown,total){remaining=Math.max(0,total-shown);if(panel){panel.hidden=!remaining;panel.dataset.batch=String(batch());status.textContent='已显示 '+shown+' / '+total+' 件作品';button.textContent='加载更多作品（'+Math.min(batch(),remaining)+'）';}watch();}
 };
}

const cards=archiveRecords();
const saveStatus=document.querySelector('#save-status');
const retry=document.querySelector('#retry-load');
const filters=[...document.querySelectorAll('[data-filter]')];
const undoToast=document.querySelector('#undo-toast'),undoMessage=document.querySelector('#undo-message'),undoButton=document.querySelector('#undo-remove');
let states={},serverRevisions={},canRemove=false,completeSnapshot=false,activeFilter='all',loaded=false,anonymous=false,searchBefore=null,loadVersion=0,loading=false,exporting=false,exporter;
const historyToggle=document.querySelector('#removal-history-toggle'),historyPanel=document.querySelector('#removal-history-panel'),historyList=document.querySelector('#removal-history-list'),historyStatus=document.querySelector('#removal-history-status'),historyRefresh=document.querySelector('#removal-history-refresh');
const historyRestore=document.querySelector('#removal-restore-toggle'),historyViews=[...document.querySelectorAll('[data-history-view]')];
let historyLoading=false,historyVersion=0,historyEvents=[],historyView='all',historyError=false;
function clearHistory(){historyVersion++;historyLoading=false;historyError=false;historyEvents=[];historyList?.replaceChildren();if(historyPanel)historyPanel.hidden=true;if(historyRefresh)historyRefresh.disabled=false;historyToggle?.setAttribute('aria-expanded','false');historyRestore?.setAttribute('aria-expanded','false');}
const alive=()=>!pageScope||pageScope.active;
const marker=id=>Object.hasOwn(serverRevisions,id)?serverRevisions[id]:null;
const busy=new Set(),revisions=new Map(),undoHistory=[];
const search=document.querySelector('#archive-search'),clearSearch=document.querySelector('#clear-search'),searchFeedback=document.querySelector('#search-feedback');
const terms=()=>ArchiveSearch.terms(search.value);
const labels={selected:'精选',rejected:'未入选',pending:'待选择'};
function announce(message,tone='neutral'){
 saveStatus.textContent=message;saveStatus.dataset.tone=tone;
}
const stateOf=entry=>{
 if(loaded&&!anonymous&&completeSnapshot&&!Object.hasOwn(states,entry.id))return 'removed';
 const value=anonymous?'pending':states[entry.id]||entry.defaultStatus||'pending';
 if(entry.retired && (anonymous || value==='rejected'))return 'removed';
 return value==='removed'||Object.hasOwn(labels,value)?value:'pending';
};
function setExpanded(button,expanded,remember=true){
 button.setAttribute('aria-expanded',String(expanded));
 document.getElementById(button.getAttribute('aria-controls')).hidden=!expanded;
 button.querySelector('.chevron').textContent=expanded?'▾':'▸';
 if(remember)try{window.localStorage.setItem('art-section-'+button.getAttribute('aria-controls'),String(expanded));}catch{}
}
function renderUndo(){
 const latest=undoHistory.at(-1);
 undoToast.hidden=!latest||!canRemove;
 if(!latest)return;
 const prefix=busy.has(latest.entry.id)?(stateOf(latest.entry)==='removed'?'正在保存移除… ':'正在撤销… '):undoHistory.length>1?'已移除 '+undoHistory.length+' 件 · 最近：':'已移除 ';
 undoMessage.textContent=prefix+'《'+latest.entry.title+'》';
 undoButton.disabled=!loaded||!canRemove||exporting||busy.has(latest.entry.id);
}
const pager=archivePager(render);
function bindCard(entry){
 const card=archiveCard(entry);if(entry.control)return card;
 entry.control=card.querySelector('[data-review]');entry.remove=card.querySelector('[data-remove]');
 entry.control.addEventListener('change',()=>{const wanted=entry.control.value;if(Object.hasOwn(labels,wanted))save(entry,wanted);});
 entry.remove.addEventListener('click',()=>{
  if(!loaded||!canRemove||exporting||busy.has(entry.id))return;
  const previous=stateOf(entry),revision=marker(entry.id);
  window.confirmArtworkRemoval({title:entry.title,trigger:entry.remove,onConfirm:()=>{if(alive()&&stateOf(entry)===previous&&marker(entry.id)===revision)save(entry,'removed');}});
 });return card;
}
function render(force=false){
 if(pageScope && !pageScope.active && force!==true)return;
 const counts={selected:0,rejected:0,pending:0},matching={selected:0,rejected:0,pending:0},query=terms(),groups={pending:[],selected:[],rejected:[]};
 cards.forEach(entry=>{const state=stateOf(entry);entry.state=state;if(state==='removed')return;counts[state]++;if(ArchiveSearch.matches(entry.searchIndex,query)){matching[state]++;groups[state].push(entry);}});
 const total=Object.values(counts).reduce((a,b)=>a+b,0),found=Object.values(matching).reduce((a,b)=>a+b,0);
 document.querySelectorAll('[data-total-count]').forEach(node=>node.textContent=total);
 document.querySelectorAll('.section').forEach(section=>{
  const state=section.id.slice(8);section.hidden=!matching[state]||(activeFilter!=='all'&&activeFilter!==state);
  if(query.length&&matching[state])setExpanded(section.querySelector('.section-toggle'),true,false);
  section.querySelector('.section-count').textContent=(query.length?matching[state]:counts[state])+' 件';
 });
 const eligible=Object.keys(groups).flatMap(state=>(activeFilter==='all'||activeFilter===state)&&!document.querySelector('#grid-'+state).hidden?groups[state]:[]);
 const shown=eligible.slice(0,pager.limit),live=new Set(shown);
 cards.forEach(entry=>{if(entry.card&&!live.has(entry)){entry.card.hidden=true;entry.card.remove();}});
 let number=0;for(const state of ['pending','selected','rejected'])for(const entry of cards){if(entry.state===state)entry.number=++number;}
 const previousByGrid=new Map();
 shown.forEach(entry=>{
  const card=bindCard(entry),{control,remove,id,state}=entry;control.disabled=!loaded||exporting||busy.has(id);remove.disabled=control.disabled||!canRemove;remove.hidden=!canRemove;card.dataset.state=state;card.classList.toggle('selected',state==='selected');
  // Setting selected options also works in DOM-only test environments.
  [...control.options].forEach(option=>{option.selected=option.value===state});
  card.hidden=false;card.querySelector('.index').textContent=String(entry.number).padStart(2,'0');
  const grid=document.querySelector('#grid-'+state),previous=previousByGrid.get(grid)||null;
  if(card.parentElement!==grid||card.previousElementSibling!==previous)grid.insertBefore(card,previous?previous.nextSibling:grid.firstChild);previousByGrid.set(grid,card);
 });
 filters.forEach(button=>{button.setAttribute('aria-pressed',String(activeFilter===button.dataset.filter));button.querySelector('span').textContent=button.dataset.filter==='all'?(query.length?found:total):(query.length?matching[button.dataset.filter]:counts[button.dataset.filter]);});
 const visible=activeFilter==='all'?found:matching[activeFilter],scopeLabels={all:['全部作品','All works'],pending:['待选择','To review'],selected:['精选','Selected'],rejected:['未入选','Not selected']};
 const scopeTitle=document.querySelector('#archive-scope-zh'),scopeEnglish=document.querySelector('#archive-scope-en'),scopeCount=document.querySelector('#archive-scope-count');
 if(scopeTitle)scopeTitle.textContent=scopeLabels[activeFilter][0];if(scopeEnglish)scopeEnglish.textContent=scopeLabels[activeFilter][1];if(scopeCount)scopeCount.textContent=String(visible);
 const empty=document.querySelector('#empty-selection');empty.hidden=visible>0;empty.textContent=query.length?'没有找到匹配的作品或作者。':'此分类暂时没有作品。';
 clearSearch.hidden=!search.value;searchFeedback.hidden=!query.length;searchFeedback.textContent=query.length?'找到 '+visible+' 件作品':'';
 pager.update(shown.length,eligible.length);renderUndo();
 for(const control of [historyToggle,historyRestore])if(control){control.hidden=!canRemove;control.disabled=!loaded||exporting;}if(!canRemove&&historyPanel){historyPanel.hidden=true;if(historyEvents.length||historyLoading)clearHistory();}
 window.ArtworkReviewDropdown?.refresh();window.ArtworkAccountMenu?.refresh();exporter?.refresh();
}

async function load(){
 if(pageScope && !pageScope.active)return;
 const version=++loadVersion,startingRevisions=new Map(revisions),pendingAtStart=new Set(busy);
 loading=true;window.ArtworkAccountMenu?.refresh('loading');exporter?.refresh();retry.hidden=true;announce('正在读取筛选状态…');
 try{
  const response=await fetch('/api/selections',{cache:'no-store'});
  if(response.status===401){
   if(version!==loadVersion || (pageScope && !pageScope.active))return;
   states={};serverRevisions={};canRemove=false;loaded=false;anonymous=true;clearHistory();undoHistory.length=0;document.querySelector('#archive-signin').hidden=false;document.querySelector('#archive-signout').hidden=true;render();revealHash();announce('访客模式：可浏览和搜索全部作品，登录后可保存筛选。');return;
  }
  if(!response.ok)throw new Error('读取失败，请重试');
  const data=await response.json();
  if(version!==loadVersion || (pageScope && !pageScope.active))return;
  const next=data.states||Object.fromEntries((data.selected||[]).map(id=>[id,'selected'])),nextRevisions={...(data.revisions||{})};
  // A late refresh must never overwrite a newer edit or in-flight optimistic removal.
  cards.forEach(({id})=>{if(pendingAtStart.has(id)||busy.has(id)||revisions.get(id)!==startingRevisions.get(id)){next[id]=states[id];nextRevisions[id]=marker(id);}});
  states=next;serverRevisions=nextRevisions;completeSnapshot=!!data.revisions&&typeof data.revisions==='object';canRemove=data.canRemove===true;loaded=true;anonymous=false;
  if(!canRemove){clearHistory();undoHistory.length=0;}
  for(let i=undoHistory.length-1;i>=0;i--)if(states[undoHistory[i].entry.id]!=='removed'||marker(undoHistory[i].entry.id)!==undoHistory[i].revision)undoHistory.splice(i,1);document.querySelector('#archive-signin').hidden=true;document.querySelector('#archive-signout').hidden=false;
  render();revealHash();announce('筛选状态会自动保存到账号');
 }catch(error){if(version===loadVersion){announce(error.message,'error');retry.hidden=false;window.ArtworkAccountMenu?.refresh(true);}}finally{if(version===loadVersion){loading=false;exporter?.refresh();}}
}
function focusAfterRemoval(entry){
 const index=cards.indexOf(entry),ordered=[...cards.slice(index+1),...cards.slice(0,index).reverse()];
 const next=ordered.find(({card,remove})=>card?.isConnected&&!card.hidden&&!card.closest('.section').hidden&&!card.parentElement.hidden&&!remove.disabled);
 (next?.remove||search).focus();
}
function conflictError(){const error=new Error('作品已在其他页面更新，请查看最新状态后再操作');error.conflict=true;return error;}
async function freshRemovalState(id,expectedStatus,expectedRevision){
 const response=await fetch('/api/selections',{cache:'no-store',credentials:'same-origin'});
 if(!response.ok){const error=new Error(response.status===401?'请重新登录此网页后再试':'无法核对最新状态，请重新读取后再试');error.refresh=response.status===401;throw error;}
 const data=await response.json();
 if(data.canRemove!==true){canRemove=false;throw new Error('此账号没有移除本站作品的权限');}
 if(!data.revisions||!Object.hasOwn(data.revisions,id)||data.states?.[id]!==expectedStatus||data.revisions[id]!==expectedRevision)throw conflictError();
 return data;
}
async function save(entry,wanted,{undoing=null}={}){
 if(!alive()||!loaded||exporting||busy.has(entry.id))return false;
 const previous=stateOf(entry),removing=wanted==='removed'&&!undoing;
 if(previous===wanted||((removing||undoing)&&!canRemove))return false;
 const expectedRevision=undoing?undoing.revision:marker(entry.id);
 let applied=false,refresh=false;
 busy.add(entry.id);revisions.set(entry.id,(revisions.get(entry.id)||0)+1);
 announce(removing||undoing?'正在核对最新状态…':'正在保存…');render();
 try{
  if(removing||undoing)await freshRemovalState(entry.id,previous,expectedRevision);
  if(!alive())return false;
  states[entry.id]=wanted;applied=true;render();if(removing)focusAfterRemoval(entry);
  const response=await fetch(undoing?'/api/removals/restore':'/api/selections',{method:undoing?'POST':'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(undoing?{id:entry.id,expectedRevision}:{id:entry.id,status:wanted,expectedStatus:previous,expectedRevision})});
  if(!alive())return false;
  if(response.status===409)throw conflictError();
  if(!response.ok)throw new Error(response.status===401?'请重新登录此网页后再试':response.status===403?'此账号没有移除本站作品的权限':'保存失败，请重新读取后再试');
  const data=await response.json();
  if(!alive())return false;
  if(typeof data.revision!=='string'||!data.revision){refresh=true;throw new Error('保存结果未确认，请重新读取作品状态');}
  serverRevisions[entry.id]=data.revision;states[entry.id]=data.status||wanted;
  if(removing)undoHistory.push({entry,previous,revision:data.revision});
  if(undoing){const index=undoHistory.indexOf(undoing);if(index!==-1)undoHistory.splice(index,1);}
  const retiredRejection=entry.retired&&wanted==='rejected';
  announce(retiredRejection?'已保存；此条目已撤下，不再显示在未入选中':undoing?'已恢复到本站，保留原筛选状态':removing?'已从本站移除，私密备份可恢复；七天后复核':'已保存为「'+labels[wanted]+'」');
  if(historyPanel&&!historyPanel.hidden)readHistory(false);
  return true;
 }catch(error){
  if(!alive())return false;
  if(applied)states[entry.id]=previous;
  refresh=refresh||error.refresh||error.conflict||applied;
  if(error.conflict&&undoing){const index=undoHistory.indexOf(undoing);if(index!==-1)undoHistory.splice(index,1);}
  busy.delete(entry.id);
  if(refresh)await load();
  if(alive())announce(error.message,'error');
  return false;
 }finally{busy.delete(entry.id);if(alive())render();}
}
undoButton.addEventListener('click',async()=>{
 const latest=undoHistory.at(-1);
 if(latest&&await save(latest.entry,latest.previous,{undoing:latest})&&alive()){
  if(latest.entry.card?.isConnected&&!latest.entry.card.hidden&&!latest.entry.card.parentElement.hidden&&!latest.entry.card.closest('.section').hidden)latest.entry.remove.focus();
  else if(!undoToast.hidden)undoButton.focus();
  else search.focus();
 }
});
function renderHistory(){
 if(!historyList||!alive())return;
 historyList.replaceChildren();
 const events=historyView==='recoverable'?historyEvents.filter(event=>event.active):historyEvents;
 document.querySelector('#removal-history-title').textContent=historyView==='recoverable'?'恢复作品':'移除记录';
 historyViews.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.historyView===historyView)));
 historyToggle?.setAttribute('aria-expanded',String(!historyPanel.hidden&&historyView==='all'));historyRestore?.setAttribute('aria-expanded',String(!historyPanel.hidden&&historyView==='recoverable'));
 for(const event of events){
  const item=document.createElement('li'),name=document.createElement('strong'),detail=document.createElement('p');
  name.textContent='《'+(event.title||event.id)+'》';
  const when=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?'时间待核实':date.toLocaleString('zh-CN');};
  detail.textContent='移除人：管理账户 · '+when(event.removedAt)+' · '+(event.restoredAt?'已于 '+when(event.restoredAt)+' 恢复':event.reviewDue?'已到七天复核时间，备份继续保留':'七天复核：'+when(event.reviewAfter));
  item.append(name,detail);
  if(event.active){const button=document.createElement('button');button.type='button';button.textContent='恢复到本站';button.disabled=historyLoading||busy.has(event.id)||exporting;button.addEventListener('click',()=>restoreHistory(event));item.append(button);}
  historyList.append(item);
 }
 if(!events.length&&!historyLoading&&!historyError)historyStatus.textContent=historyView==='recoverable'?'暂无可恢复的作品。':'暂无移除记录。';
}
async function readHistory(reconcile=true){
 if(!alive()||!canRemove||historyLoading)return;
 const version=++historyVersion;historyLoading=true;historyError=false;historyRefresh.disabled=true;historyStatus.textContent='正在读取私密移除记录…';renderHistory();
 try{
  if(reconcile){const response=await fetch('/api/removals/reconcile',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(!response.ok)throw new Error('移除备份暂时无法读取，请重试');}
  if(!alive()||version!==historyVersion)return;
  const response=await fetch('/api/removals',{cache:'no-store',credentials:'same-origin'});
  if(!response.ok)throw new Error(response.status===403?'此账号没有查看移除记录的权限':'移除记录读取失败，请重试');
  const data=await response.json();if(!alive()||version!==historyVersion)return;
  if(!Array.isArray(data.events))throw new Error('移除记录读取不完整，请重试');
  historyEvents=data.events;historyStatus.textContent='私密备份会保留；七天后复核，不会自动清理。';
 }catch(error){if(alive()&&version===historyVersion){historyError=true;historyStatus.textContent=error.message;}}
 finally{if(alive()&&version===historyVersion){historyLoading=false;historyRefresh.disabled=false;renderHistory();}}
}
async function restoreHistory(event){
 if(!alive()||!canRemove||!loaded||exporting||historyLoading||busy.has(event.id)||!event.active)return;
 busy.add(event.id);renderHistory();historyStatus.textContent='正在核对最新移除记录…';
 try{
  await freshRemovalState(event.id,'removed',event.selectionRevision);
  if(!alive())return;
  const response=await fetch('/api/removals/restore',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:event.id,expectedRevision:event.selectionRevision})});
  if(!alive())return;
  if(response.status===409)throw conflictError();
  if(!response.ok)throw new Error('恢复失败，请重新读取后再试');
  const result=await response.json();if(!alive())return;
  if(typeof result.revision!=='string'||!result.revision)throw new Error('恢复结果未确认，请重新读取记录');
  const entry=cards.find(entry=>entry.id===event.id);
  if(!entry){window.location?.reload?.();return;}
  states[event.id]=result.status;serverRevisions[event.id]=result.revision;revisions.set(event.id,(revisions.get(event.id)||0)+1);
  for(let i=undoHistory.length-1;i>=0;i--)if(undoHistory[i].entry.id===event.id)undoHistory.splice(i,1);
  announce('已恢复《'+(event.title||event.id)+'》到本站');
  busy.delete(event.id);await readHistory(false);
 }catch(error){if(alive()){busy.delete(event.id);await load();await readHistory(false);if(alive()){historyError=true;historyStatus.textContent=error.message;}}}
 finally{busy.delete(event.id);if(alive()){render();renderHistory();}}
}
function showHistory(view='all',{toggle=false}={}){
 if(!canRemove||exporting)return;
 const close=toggle&&!historyPanel.hidden&&historyView===view;historyView=view;historyPanel.hidden=close;
 historyToggle.setAttribute('aria-expanded',String(!close&&view==='all'));historyRestore?.setAttribute('aria-expanded',String(!close&&view==='recoverable'));
 if(!close){renderHistory();readHistory();historyPanel.scrollIntoView?.({block:'start',behavior:'smooth'});historyPanel.focus({preventScroll:true});}
}
historyToggle?.addEventListener('click',()=>showHistory('all',{toggle:true}));
historyRestore?.addEventListener('click',()=>showHistory('recoverable',{toggle:true}));
historyViews.forEach(button=>button.addEventListener('click',()=>{if(!canRemove)return;historyView=button.dataset.historyView;if(!historyError)historyStatus.textContent='私密备份会保留；七天后复核，不会自动清理。';renderHistory();}));
historyRefresh?.addEventListener('click',()=>readHistory());
document.querySelector('#dismiss-undo').addEventListener('click',()=>{undoHistory.length=0;renderUndo();search.focus();});
filters.forEach(button=>button.addEventListener('click',()=>{
 activeFilter=button.dataset.filter;pager.reset();
 if(activeFilter!=='all')setExpanded(document.querySelector('[aria-controls="grid-'+activeFilter+'"]'),true);
 render();
}));
document.querySelectorAll('.section-toggle').forEach(button=>{
 try{const saved=window.localStorage.getItem('art-section-'+button.getAttribute('aria-controls'));if(saved!==null)setExpanded(button,saved==='true');}catch{}
 button.addEventListener('click',()=>{setExpanded(button,button.getAttribute('aria-expanded')!=='true');pager.reset();render();});
});
function revealHash(){
 const hash=window.location?.hash;if(!hash)return;let id;try{id=decodeURIComponent(hash.slice(1));}catch{return;}
 if(id==='removal-history-panel'||id==='removal-restore-panel'){const view=id==='removal-restore-panel'?'recoverable':'all';if(canRemove&&(historyPanel?.hidden||historyView!==view))showHistory(view);return;}
 const entry=cards.find(entry=>entry.id===id),section=document.getElementById(id);
 if(entry&&stateOf(entry)==='removed')return;
 if(!entry&&!section?.classList.contains('section'))return;
 search.value='';searchBefore=null;activeFilter='all';
 const targetSection=entry?document.getElementById('section-'+stateOf(entry)):section;
 setExpanded(targetSection.querySelector('.section-toggle'),true);
 const eligible=['pending','selected','rejected'].flatMap(state=>document.querySelector('#grid-'+state).hidden?[]:cards.filter(item=>stateOf(item)===state));
 pager.reveal(entry?eligible.indexOf(entry):eligible.findIndex(item=>stateOf(item)===id.slice(8)));render();
 (entry?.card||section)?.scrollIntoView?.({block:'start'});
}

function updateSearch(){
 pager.reset();
 if(search.value.trim()){
  if(!searchBefore)searchBefore={filter:activeFilter,expanded:[...document.querySelectorAll('.section-toggle')].map(button=>[button,button.getAttribute('aria-expanded')==='true'])};
  activeFilter='all';
 }else if(searchBefore){
  activeFilter=searchBefore.filter;searchBefore.expanded.forEach(([button,expanded])=>setExpanded(button,expanded,false));searchBefore=null;
 }
 render();
}
search.addEventListener('input',updateSearch);
clearSearch.addEventListener('click',()=>{search.value='';updateSearch();search.focus()});
search.addEventListener('keydown',event=>{if(event.key==='Escape'){search.value='';updateSearch()}});
listen(window, 'hashchange',revealHash);
retry.addEventListener('click',load);
listen(window, 'pageshow',event=>{if(event.persisted&&!exporting){if(anonymous&&window.location?.reload){window.location.reload();return;}load();}});
pageScope?.onCleanup(()=>{loadVersion++;historyVersion++;states={};serverRevisions={};canRemove=false;loaded=false;anonymous=true;clearHistory();undoHistory.length=0;document.querySelector('#archive-signout').hidden=true;document.querySelector('#archive-signin').hidden=false;render(true);});
// Export uses two fresh authenticated reads, never optimistic or cached choices.
const exportKey=records=>records.map(record=>record.id).sort().join('\n');
async function readExport(signal){
 const response=await fetch('/api/selections',{cache:'no-store',credentials:'same-origin',signal});
 if(signal.aborted||pageScope&&!pageScope.active)throw new DOMException('已取消导出','AbortError');
 if(response.status===401){loaded=false;anonymous=true;canRemove=false;states={};serverRevisions={};clearHistory();document.querySelector('#archive-signin').hidden=false;document.querySelector('#archive-signout').hidden=true;render();throw new Error('登录已失效，请重新登录后导出。');}
 if(!response.ok)throw new Error('无法读取最新精选，请稍后重试。');
 const data=await response.json();if(!data.states||typeof data.states!=='object'||Array.isArray(data.states))throw new Error('精选状态读取不完整，请刷新后重试。');
 const selected=cards.filter(entry=>data.states[entry.id]==='selected');
 if(selected.some(entry=>!entry.exportData))throw new Error('作品资料读取不完整，请刷新后重新导出。');
 const records=selected.map(entry=>({...entry.exportData,imageURL:entry.exportData?.imageURL ? new URL(entry.exportData.imageURL,location.origin).href : ''}));
 return {records,key:exportKey(records),states:data.states};
}
exporter=window.ArtworkExport?.create({scope:pageScope,getState:()=>({loaded,anonymous,loading,busy:busy.size,count:cards.filter(entry=>stateOf(entry)==='selected').length}),setLocked(value){exporting=value;render();},async prepare(signal){const snapshot=await readExport(signal);if(signal.aborted||pageScope&&!pageScope.active)throw new DOMException('已取消导出','AbortError');states=snapshot.states;render();return snapshot;},async validate(key,signal){const latest=await readExport(signal);if(signal.aborted||pageScope&&!pageScope.active)throw new DOMException('已取消导出','AbortError');states=latest.states;render();if(latest.key!==key)throw new Error('精选列表刚刚发生变化，请重新导出最新列表。');}});
render();load();

})();


};

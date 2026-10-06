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


/* archive.js */
(() => {
const pageScope=window.MediaArtPage?.current;
const listen=(target,...args)=>{target?.addEventListener?.(...args);pageScope?.onCleanup(()=>target?.removeEventListener?.(...args));};
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

(() => {
 const input=document.querySelector('#archive-search'),clear=document.querySelector('#clear-search'),grid=document.getElementById('archive-grid');
 const records=archiveRecords(),feedback=document.querySelector('#search-feedback'),empty=document.querySelector('#empty-selection');
 const pager=archivePager(render);
 function render(){
  if(pageScope && !pageScope.active)return;
  const query=ArchiveSearch.terms(input.value),matching=records.filter(entry=>ArchiveSearch.matches(entry.searchIndex,query)),shown=matching.slice(0,pager.limit),live=new Set(shown);
  records.forEach(entry=>{if(entry.card&&!live.has(entry))entry.card.remove()});
  let previous=null;shown.forEach(entry=>{const card=archiveCard(entry);card.hidden=false;if(card.parentElement!==grid||card.previousElementSibling!==previous)grid.insertBefore(card,previous?previous.nextSibling:grid.firstChild);previous=card;});
  clear.hidden=!input.value;empty.hidden=matching.length>0;feedback.textContent=(query.length?'找到 ':'')+matching.length+' 件作品';
  pager.update(shown.length,matching.length);
 }
 function search(){pager.reset();render();}
 input.addEventListener('input',search);clear.addEventListener('click',()=>{input.value='';search();input.focus()});
 input.addEventListener('keydown',event=>{if(event.key==='Escape'){input.value='';search()}});
 function revealHash(){
  let id;try{id=decodeURIComponent(window.location?.hash.slice(1)||'')}catch{return;}
  const index=records.findIndex(entry=>entry.id===id);if(index<0)return;
  input.value='';pager.reveal(index);render();records[index].card.scrollIntoView?.({block:'start'});
 }
 listen(window, 'hashchange',revealHash);render();revealHash();
})();

})();


};

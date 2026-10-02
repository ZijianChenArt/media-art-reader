(() => {
  const shell = document.querySelector('[data-radar-data-url]');
  if (!shell) return;
  const fitBrand = () => {
    const text=shell.querySelector('.radar-brand span'),group=shell.querySelector('.radar-group');
    if(!text || !group) return;
    if(matchMedia('(max-width:860px)').matches){text.style.removeProperty('font-size');return;}
    text.style.fontSize='60px';
    const probe=document.createRange();probe.selectNodeContents(text);
    const width=probe.getBoundingClientRect().width;
    if(width) text.style.fontSize=Math.min(90,60*group.getBoundingClientRect().width/width)+'px';
  };
  document.fonts?.ready.then(fitBrand);addEventListener('resize',fitBrand);
  fetch(shell.dataset.radarDataUrl).then(response=>{if(!response.ok)throw new Error('Radar metadata unavailable');return response.json()}).then(data=>{
    const calls=Array.isArray(data.open_calls)?data.open_calls:[];
    shell.querySelectorAll('[data-radar-count]').forEach(node=>{
      const category=node.dataset.radarCount;
      const n=category==='all'?calls.length:calls.filter(call=>call.category===category).length;
      node.textContent=String(n).padStart(2,'0');
      node.closest('.radar-nav').classList.toggle('is-empty',category!=='all'&&!n);
    });
    const verified=calls.map(call=>call.verified_at).filter(Boolean).sort().at(-1);
  }).catch(()=>{});
})();

/* Shared by site-v15.js and radar-shell.js. Append once to each entry point. */
(() => {
  'use strict';
  const header = document.querySelector('[data-media-header]');
  const brand = header?.querySelector('.brand, .radar-brand');
  const nav = header?.querySelector('.index, .radar-index');
  // Random review deliberately has no full mobile navigation.
  if (!header || !brand || !nav || header.closest('[data-radar-page="random"]')) return;
  if (window.MediaArtHeader) return;

  const mobile = window.matchMedia('(max-width: 860px)');
  const hiddenClass = 'media-header--compact';
  let active = false, destroyed = false, compact = false, keyboard = false;
  let maxY = 0, hasBrandRow = false;
  let scrollFrame = 0, measureFrame = 0, observer;
  const yNow = () => Math.max(0, Math.min(window.scrollY || 0, maxY));
  const setCompact = value => {
    if (compact === value) return;
    compact = value;
    header.classList.toggle(hiddenClass, compact);
  };
  const editing = node => !!node?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
  const keepVisible = () => editing(document.activeElement) || (keyboard && header.contains(document.activeElement));

  function measure() {
    measureFrame = 0;
    if (!active) return;
    // Read geometry only after a resize/content/font change, never on scroll.
    const railBox = header.getBoundingClientRect();
    const navBox = nav.getBoundingClientRect();
    const paddingTop = parseFloat(getComputedStyle(header).paddingTop) || 0;
    const distance = Math.max(0, navBox.top - railBox.top - paddingTop);
    hasBrandRow = distance > 0;
    maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    header.style.setProperty('--media-brand-offset', `${distance}px`);
    header.toggleAttribute('data-media-header-ready', distance > 0);
    updateScroll();
  }
  function scheduleMeasure() {
    if (active && !measureFrame) measureFrame = requestAnimationFrame(measure);
  }
  function updateScroll() {
    scrollFrame = 0;
    if (!active) return;
    // Away from the top, upward scrolling must not reveal the brand.
    // Focus protection remains an accessibility exception while editing/tabbing.
    setCompact(hasBrandRow && yNow() > 8 && !keepVisible());
  }
  function onScroll() {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll);
  }
  function onFocus(event) {
    if (header.contains(event.target) || editing(event.target)) {
      setCompact(false);
    }
  }
  function onKey(event) {
    if (event.key === 'Tab' || ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) {
      keyboard = true;
      if (keepVisible()) { setCompact(false); }
    }
  }
  function onPointer() { keyboard = false; onScroll(); }
  function onBlur() { onScroll(); }
  function onResize() {
    // Keep top-only visibility while geometry/virtual-keyboard size changes.
    scheduleMeasure();
  }
  function disable() {
    active = false;
    cancelAnimationFrame(scrollFrame); cancelAnimationFrame(measureFrame);
    scrollFrame = 0; measureFrame = 0;
    observer?.disconnect(); observer = undefined;
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('focusin', onFocus);
    document.removeEventListener('focusout', onBlur);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('pointerdown', onPointer);
    setCompact(false);
    header.removeAttribute('data-media-header-ready');
    header.style.removeProperty('--media-brand-offset');
    keyboard = false; hasBrandRow = false;
  }
  function sync() {
    if (destroyed) return;
    if (!mobile.matches) { if (active) disable(); return; }
    if (!active) {
      active = true;
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onResize, { passive: true });
      document.addEventListener('focusin', onFocus);
      document.addEventListener('focusout', onBlur);
      document.addEventListener('keydown', onKey);
      document.addEventListener('pointerdown', onPointer, { passive: true });
      if ('ResizeObserver' in window) {
        observer = new ResizeObserver(scheduleMeasure);
        observer.observe(header); observer.observe(nav); observer.observe(document.documentElement);
      }
    }
    scheduleMeasure();
  }
  function onPageShow() { sync(); }
  function destroy() {
    if (destroyed) return;
    disable(); destroyed = true;
    mobile.removeEventListener('change', sync);
    window.removeEventListener('pageshow', onPageShow);
    window.removeEventListener('pagehide', disable);
    window.removeEventListener('load', scheduleMeasure);
    delete window.MediaArtHeader;
  }
  window.MediaArtHeader = Object.freeze({ refresh: scheduleMeasure, destroy });
  mobile.addEventListener('change', sync);
  window.addEventListener('pageshow', onPageShow);
  window.addEventListener('pagehide', disable);
  window.addEventListener('load', scheduleMeasure, { once: true });
  document.fonts?.ready.then(scheduleMeasure);
  sync();
})();

/* Measure the shared desktop entry once per layout change, never on scroll. */
(() => {
  const rail = document.querySelector('[data-media-header]');
  const index = rail?.querySelector('.index, .radar-index');
  const group = index?.querySelector('.group, .radar-group');
  if (!index || !group) return;
  const desktop = matchMedia('(min-width: 861px)');
  let frame = 0;
  function measure() {
    frame = 0;
    if (!desktop.matches) {
      index.style.removeProperty('--media-entry-height');
      index.style.removeProperty('--media-group-border');
      return;
    }
    const style = getComputedStyle(group);
    const border = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    const indexStyle = getComputedStyle(index);
    const gap = parseFloat(indexStyle.rowGap) || 0;
    const minimum = parseFloat(indexStyle.getPropertyValue('--media-entry-min')) || 90;
    const heading = group.firstElementChild.getBoundingClientRect().height;
    const widget = index.lastElementChild.getBoundingClientRect().height;
    const available = index.getBoundingClientRect().height - heading - border - widget - 2 * gap;
    index.style.setProperty('--media-group-border', `${border}px`);
    index.style.setProperty('--media-entry-height', `${Math.max(minimum, available / 5)}px`);
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(measure); }
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(schedule);
    observer.observe(index); observer.observe(rail);
  }
  desktop.addEventListener('change', schedule);
  addEventListener('resize', schedule, { passive: true });
  addEventListener('pageshow', schedule);
  document.fonts?.ready.then(schedule);
  schedule();
})();

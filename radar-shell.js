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
  let lastY = 0, travel = 0, direction = 0, headerHeight = 0, maxY = 0;
  let scrollFrame = 0, measureFrame = 0, observer;
  const yNow = () => Math.max(0, Math.min(window.scrollY || 0, maxY));
  const resetDirection = () => { lastY = yNow(); travel = 0; direction = 0; };
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
    headerHeight = railBox.height;
    maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    header.style.setProperty('--media-brand-offset', `${distance}px`);
    header.toggleAttribute('data-media-header-ready', distance > 0);
    if (!distance || keepVisible() || yNow() <= headerHeight) setCompact(false);
    resetDirection();
  }
  function scheduleMeasure() {
    if (active && !measureFrame) measureFrame = requestAnimationFrame(measure);
  }
  function updateScroll() {
    scrollFrame = 0;
    if (!active) return;
    const y = yNow(), delta = y - lastY;
    lastY = y;
    if (keepVisible() || y <= 8) {
      setCompact(false); travel = 0; direction = 0; return;
    }
    if (!delta) return;
    const nextDirection = delta > 0 ? 1 : -1;
    if (nextDirection !== direction) { direction = nextDirection; travel = 0; }
    travel += Math.abs(delta);
    if (direction === 1 && travel >= 18 && y > headerHeight) setCompact(true);
    if (direction === -1 && travel >= 10) setCompact(false);
  }
  function onScroll() {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll);
  }
  function onFocus(event) {
    if (header.contains(event.target) || editing(event.target)) {
      setCompact(false); resetDirection();
    }
  }
  function onKey(event) {
    if (event.key === 'Tab' || ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) {
      keyboard = true;
      if (keepVisible()) { setCompact(false); resetDirection(); }
    }
  }
  function onPointer() { keyboard = false; }
  function onResize() {
    // Reveal during orientation/keyboard transitions; re-measure once per frame.
    setCompact(false); scheduleMeasure();
  }
  function disable() {
    active = false;
    cancelAnimationFrame(scrollFrame); cancelAnimationFrame(measureFrame);
    scrollFrame = 0; measureFrame = 0;
    observer?.disconnect(); observer = undefined;
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('focusin', onFocus);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('pointerdown', onPointer);
    setCompact(false);
    header.removeAttribute('data-media-header-ready');
    header.style.removeProperty('--media-brand-offset');
    keyboard = false; travel = 0; direction = 0;
  }
  function sync() {
    if (destroyed) return;
    if (!mobile.matches) { if (active) disable(); return; }
    if (!active) {
      active = true;
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onResize, { passive: true });
      document.addEventListener('focusin', onFocus);
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

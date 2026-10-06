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

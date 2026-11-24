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

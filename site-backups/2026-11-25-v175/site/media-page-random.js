window.MediaArtPages ||= {};
window.MediaArtPages["random"] = function(){

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


/* random.js */
(() => {
const pageScope = window.MediaArtPage?.current;
const listen = (target, ...args) => { target?.addEventListener?.(...args); pageScope?.onCleanup(() => target?.removeEventListener?.(...args)); };
const templates=[...document.querySelectorAll('template[data-work]')];
const stage=document.querySelector('#random-stage'),empty=document.querySelector('#random-empty'),count=document.querySelector('#random-count'),status=document.querySelector('#random-status');
const keep=document.querySelector('#random-keep'),select=document.querySelector('#random-select'),remove=document.querySelector('#random-remove'),retry=document.querySelector('#random-retry'),restart=document.querySelector('#random-restart');
const next=document.querySelector('#random-next'),guest=document.querySelector('#random-guest'),decisionHint=document.querySelector('#random-decision-hint');
const undoBox=document.querySelector('#random-undo-box'),undoMessage=document.querySelector('#random-undo-message'),undoButton=document.querySelector('#random-undo');
const seen=new Set(),undoHistory=[];let current=null,currentStatus=null,currentRevision=null,busy=false,anonymous=false,canRemove=false,drawVersion=0;
const recovery=document.querySelector('#random-removal-history'),alive=()=>!pageScope||pageScope.active;
// Reserve only the floating controls' rendered height plus their safe-area gap.
// CSS adds 24px of breathing room so the card can scroll clear of the controls.
// Resize measurement keeps wrapped guest controls and enlarged text clear.
const decisions=document.querySelector('.random-decisions'),randomMain=document.querySelector('.random-main');
function updateDecisionClearance(){
 const height=decisions?.getBoundingClientRect?.().height;
 if(height>0)randomMain?.style.setProperty('--random-decisions-height',Math.ceil(height)+'px');
}
if(decisions&&window.ResizeObserver){const observer=new window.ResizeObserver(updateDecisionClearance);observer.observe(decisions);pageScope?.onCleanup(()=>observer.disconnect());}
listen(window, 'resize',updateDecisionClearance);
document.fonts?.ready.then(updateDecisionClearance);
updateDecisionClearance();
const desktopDetails=window.matchMedia?.('(min-width:861px)');
function showDesktopDetails(root=stage){root.querySelectorAll('.card-sources details').forEach(detail=>{const wide=!!desktopDetails?.matches;detail.open=wide;const summary=detail.querySelector('summary');if(summary){summary.hidden=wide;summary.setAttribute('aria-expanded',String(wide));}})}
// Desktop always shows both genuine photographs. CSS caps the photo column
// and determines its landscape frame sizes, independently of the text height.
function updateRandomGallery(){
 const gallery=stage.querySelector('[data-gallery]');
 if(!gallery)return;
 const slides=[...gallery.querySelectorAll('[data-slide]')],wasStacked=gallery.dataset.randomStacked==='true';
 const ratios=slides.map(slide=>{const img=slide.querySelector('img'),width=Number(img?.getAttribute('width'))||img?.naturalWidth,height=Number(img?.getAttribute('height'))||img?.naturalHeight;return width>0&&height>0?width/height:0}).filter(ratio=>Number.isFinite(ratio)&&ratio>0);
 const mediaWidth=ratios.length?Math.min(520,Math.max(160,Math.max(...ratios)*360)):520;
 gallery.closest('.card')?.style.setProperty('--random-media-width',Math.round(mediaWidth)+'px');
 const hasTwoPhotos=slides.length===2&&slides[0].getAttribute('href')!==slides[1].getAttribute('href');
 const stacked=!!desktopDetails?.matches&&hasTwoPhotos;
 if(stacked&&!wasStacked){
  gallery.dataset.randomActiveSlide=String(Math.max(0,slides.findIndex(slide=>!slide.hidden)));
  gallery.dataset.randomStacked='true';
  slides.forEach(slide=>{slide.hidden=false;const image=slide.querySelector('img');if(image)image.loading='eager';});
 }else if(!stacked&&wasStacked){
  delete gallery.dataset.randomStacked;
  const active=Number(gallery.dataset.randomActiveSlide)||0;
  slides.forEach((slide,index)=>{slide.hidden=index!==active;});
  const counter=gallery.querySelector('.gallery-count');if(counter)counter.textContent=(active+1)+' / '+slides.length;
 }
}
listen(desktopDetails, 'change',()=>{showDesktopDetails();updateRandomGallery();});
function announce(message,error=false){status.setAttribute('role',error?'alert':'status');status.setAttribute('aria-live',error?'assertive':'polite');status.dataset.error=String(error);status.textContent=message}
function renderUndo(){const latest=undoHistory.at(-1);undoBox.hidden=!latest||!canRemove;undoButton.disabled=busy||!latest||!canRemove;if(latest)undoMessage.textContent=(undoHistory.length>1?'已从本站移除 '+undoHistory.length+' 件 · 最近：':'已从本站移除 ')+'《'+latest.title+'》'}
function lock(value){
 if(!alive())return;
 busy=value;keep.disabled=select.disabled=value||!current||anonymous;remove.disabled=value||!current||anonymous||!canRemove;remove.hidden=!canRemove;
 next.disabled=value||!current;next.hidden=!anonymous;guest.hidden=!anonymous;
 if(recovery)recovery.hidden=!canRemove;
 document.querySelector('#random-removal-restore').hidden=!canRemove;
 window.ArtworkAccountMenu?.refresh(!value&&retry.hidden===false);
 decisionHint.textContent=anonymous?'登录后可保存筛选':canRemove?'选择后，自动查看下一件':'筛选只保存到你的账号';retry.disabled=restart.disabled=value;stage.setAttribute('aria-busy',String(value));renderUndo();
}
async function readStates(){
 if(anonymous)return null;
 window.ArtworkAccountMenu?.refresh('loading');
 const response=await fetch('/api/selections',{cache:'no-store'});
 if(!alive())return null;
 if(response.status===401){anonymous=true;canRemove=false;undoHistory.length=0;document.querySelector('#random-signout').hidden=true;document.querySelector('#random-signin').hidden=false;window.ArtworkAccountMenu?.refresh();return null;}
 if(!response.ok)throw new Error('暂时无法读取作品，请重试。');
 const data=await response.json();if(!alive())return null;
 if(!data.states)throw new Error('未能读取筛选状态，请重试。');
 canRemove=data.canRemove===true;
 document.querySelector('#random-signout').hidden=false;document.querySelector('#random-signin').hidden=true;
 return data;
}
async function draw(message='',preferredId=null){
 if(!alive())return;
 const version=++drawVersion;
 lock(true);retry.hidden=true;restart.hidden=true;empty.hidden=true;announce(message||'正在随机抽取…');
 try{
  const data=await readStates();if(!alive()||version!==drawVersion)return;
  const states=data?.states||{},eligible=anonymous?templates.filter(t=>t.dataset.retired!=='true'):templates.filter(t=>['pending','rejected'].includes(states[t.dataset.work])),available=eligible.filter(t=>!seen.has(t.dataset.work));
  current=currentStatus=currentRevision=null;stage.replaceChildren();count.textContent=eligible.length+' 件可选 · 已看 '+seen.size+' 件';
  if(!available.length){empty.hidden=false;empty.textContent=eligible.length?'本轮作品已看完。':'目前没有待选择或未入选作品。';restart.hidden=eligible.length===0;retry.hidden=eligible.length>0;announce(message||'');return}
  const template=available.find(t=>t.dataset.work===preferredId)||available[Math.floor(Math.random()*available.length)];
  current=template.dataset.work;currentStatus=anonymous?null:states[current];currentRevision=data?.revisions?.[current]??null;
  keep.textContent=currentStatus==='pending'?'未入选':'保持未入选';const fragment=template.content.cloneNode(true);fragment.querySelector('.card').hidden=false;fragment.querySelector('img')?.setAttribute('loading','eager');showDesktopDetails(fragment);stage.appendChild(fragment);updateRandomGallery();announce(message||'');document.querySelector('#radar-stage')?.scrollTo?.({top:0,behavior:'auto'});window.scrollTo?.({top:0,behavior:'auto'});
 }catch(error){if(alive()&&version===drawVersion){announce(error.message,true);window.ArtworkAccountMenu?.refresh(true);retry.hidden=false;current=currentStatus=currentRevision=null;stage.replaceChildren()}}
 finally{if(alive()&&version===drawVersion)lock(false)}
}
function conflictError(){const error=new Error('作品已在其他页面更新，请查看最新状态后再操作。');error.conflict=true;return error;}
async function freshRemovalState(id,expectedStatus,expectedRevision){
 const response=await fetch('/api/selections',{cache:'no-store',credentials:'same-origin'});
 if(!response.ok){const error=new Error(response.status===401?'请重新登录后再试。':'无法核对最新状态，请重新读取后再试。');error.refresh=response.status===401;throw error;}
 const data=await response.json();
 if(data.canRemove!==true){canRemove=false;throw new Error('此账号没有移除本站作品的权限。');}
 if(!data.revisions||!Object.hasOwn(data.revisions,id)||data.states?.[id]!==expectedStatus||data.revisions[id]!==expectedRevision)throw conflictError();
}
async function decide(wanted){
 if(!alive()||busy||!current||anonymous||(wanted==='removed'&&!canRemove))return;
 const id=current,previous=currentStatus,expectedRevision=currentRevision,title=stage.querySelector('h3')?.textContent||id,retired=stage.querySelector('.card')?.dataset.retired==='true';
 lock(true);retry.hidden=true;announce(wanted==='removed'?'正在核对最新状态…':'正在保存…');
 let sent=false;
 try{
  if(wanted==='removed')await freshRemovalState(id,previous,expectedRevision);
  if(!alive())return;
  sent=true;
  const response=await fetch('/api/selections',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status:wanted,expectedStatus:previous,expectedRevision})});
  if(!alive())return;
  if(response.status===409)throw conflictError();
  if(!response.ok)throw new Error(response.status===401?'请重新登录后再试。':response.status===403?'此账号没有移除本站作品的权限。':'保存失败，请重新读取后再试。');
  const data=await response.json();if(!alive())return;
  if(typeof data.revision!=='string'||!data.revision)throw new Error('保存结果未确认，请重新读取作品状态。');
  if(wanted==='removed')undoHistory.push({id,previous,title,revision:data.revision});
  seen.add(id);await draw(wanted==='selected'?'已加入精选。':wanted==='removed'?'已从本站移除，私密备份可恢复；七天后复核。':retired?'此条目已撤下，不再显示在未入选中。':'已标记为未入选。');
 }catch(error){
  if(!alive())return;
  if(sent||error.refresh||error.conflict){await draw('',id);if(!alive())return;}
  announce(error.message,true);
 }finally{if(alive())lock(false)}
}
async function undoRemoval(){
 if(!alive()||busy||!canRemove||!undoHistory.length)return;
 const entry=undoHistory.at(-1);lock(true);announce('正在核对最新移除记录…');
 try{
  await freshRemovalState(entry.id,'removed',entry.revision);if(!alive())return;
  const response=await fetch('/api/removals/restore',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:entry.id,expectedRevision:entry.revision})});
  if(!alive())return;
  if(response.status===409)throw conflictError();
  if(!response.ok)throw new Error(response.status===401?'请重新登录后再试。':'撤销失败，请重新读取后再试。');
  const result=await response.json();if(!alive())return;
  if(typeof result.revision!=='string'||!result.revision)throw new Error('恢复结果未确认，请重新读取作品状态。');
  undoHistory.pop();seen.delete(entry.id);await draw('已恢复到本站，保留原筛选状态。',entry.id);if(alive())keep.focus();
 }catch(error){
  if(!alive())return;
  if(error.conflict||error.refresh){undoHistory.pop();await draw('',current);}
  if(alive())announce(error.message,true);
 }finally{if(alive())lock(false)}
}
next.addEventListener('click',()=>{if(!busy&&current&&anonymous){seen.add(current);draw();}});
keep.addEventListener('click',()=>decide('rejected'));select.addEventListener('click',()=>decide('selected'));remove.addEventListener('click',()=>{if(!alive()||busy||!current||anonymous||!canRemove)return;const id=current,revision=currentRevision;window.confirmArtworkRemoval({title:stage.querySelector('h3')?.textContent||id,trigger:remove,onConfirm:()=>{if(alive()&&current===id&&currentRevision===revision)decide('removed');}});});undoButton.addEventListener('click',undoRemoval);
retry.addEventListener('click',()=>{if(!busy)draw()});restart.addEventListener('click',()=>{if(!busy){seen.clear();draw()}});
pageScope?.onCleanup(()=>{drawVersion++;current=currentStatus=currentRevision=null;anonymous=true;canRemove=false;undoHistory.length=0;stage.replaceChildren();lock(false);count.textContent='';});
draw();
listen(window, 'pageshow',event=>{if(event.persisted&&!busy){if(anonymous&&window.location?.reload){window.location.reload();return;}draw();}});

})();


};

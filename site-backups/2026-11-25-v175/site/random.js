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

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

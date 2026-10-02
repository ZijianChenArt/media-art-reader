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
  const next=measure();if(next===columns&&root===(mobile()?null:document.getElementById('radar-stage')))return;
  columns=next;limit=Math.max(batch(),Math.ceil(limit/columns)*columns);draw();
 }
 window.addEventListener('resize',()=>{if(scheduled)return;scheduled=true;(window.requestAnimationFrame||((fn)=>fn()))(()=>{scheduled=false;resize()});});
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
 window.addEventListener('hashchange',revealHash);render();revealHash();
})();

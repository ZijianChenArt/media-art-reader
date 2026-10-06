/* One persistent navigation shell. Only #radar-stage changes between documents. */
(() => {
 'use strict';
 if(window.MediaArtNavigation)return;
 const shell=document.querySelector('.radar-app'),stage=document.getElementById('radar-stage');
 if(!shell||!stage)return;
 const root=new URL('.',new URL(shell.dataset.radarDataUrl,location.href));
 const entry=document.querySelector('meta[name="media-page"]');
 let pageKey=entry.content,documentPath=location.pathname,version=0,pending=null;
 const factories=window.MediaArtPages ||= {},resources=new Map(),documents=new Map();
 let activeStyles=[...document.querySelectorAll('[data-media-page-style]')];
 activeStyles.forEach(link=>resources.set(new URL(link.getAttribute('href'),location.href).href,Promise.resolve(link)));
 const baseTitle=document.title;
 const permitted=new Map([[root.pathname,'home'],[root.pathname+'index.html','home'],[root.pathname+'archive/','archive'],[root.pathname+'archive/index.html','archive'],[root.pathname+'random/','random'],[root.pathname+'random/index.html','random']]);
 const canonical=url=>{const value=new URL(url,location.href);if(value.pathname.endsWith('/index.html'))value.pathname=value.pathname.slice(0,-10);return value;};
 window.MediaArtPage={current:null};
 // Cleanups are LIFO, so overlays release locks before their underlying page disappears.
 window.MediaArtPage.start=function(){const callbacks=[];const scope={active:true,callbacks,onCleanup(fn){callbacks.push(fn)}};this.current=scope;return scope;};
 window.MediaArtPage.stop=function(){const scope=this.current;if(!scope)return;scope.active=false;this.current=null;for(const fn of scope.callbacks.reverse()){try{fn()}catch(error){console.warn('Page cleanup failed',error)}}};
 const isPage=url=>url.origin===location.origin&&permitted.has(url.pathname)&&!url.search;
 function syncRail(url){
  const key=permitted.get(url.pathname),hash=url.hash.slice(1),filter=hash.split('/')[1]||'all';
  shell.dataset.radarPage=key;
  shell.querySelectorAll('.radar-nav').forEach(link=>{
   const to=new URL(link.href),route=to.hash.slice(1),on=key==='archive'||key==='random'?link.classList.contains('radar-archive-nav'):hash==='widget'?route==='widget':route.startsWith('opportunities')&&(route.split('/')[1]||'all')===filter;
   link.classList.toggle('is-active',on);if(on)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
  });
 }
 // Resolve the persistent rail once. Its relative URLs must not drift after pushState.
 shell.querySelectorAll('.radar-rail a[href]').forEach(link=>link.setAttribute('href',new URL(link.getAttribute('href'),location.href).href));
 function position(){return {stage:stage.scrollTop,window:window.scrollY||0};}
 function remember(){history.replaceState({...history.state,mediaScroll:position()},'',location.href);}
 function scroll(saved){stage.scrollTop=saved?.stage||0;window.scrollTo({top:saved?.window||0,behavior:'instant'});}
 function routeEvent(){window.dispatchEvent(new Event('media-route'));window.dispatchEvent(new Event('hashchange'));}
 function notify(message){let node=document.getElementById('media-navigation-status');if(!node){node=document.createElement('p');node.id='media-navigation-status';node.setAttribute('role','alert');stage.prepend(node)}node.textContent=message;}
 function asset(href,type){
  if(resources.has(href))return resources.get(href);
  const promise=new Promise((resolve,reject)=>{const node=document.createElement(type==='script'?'script':'link');if(type==='script')node.src=href;else{node.rel='stylesheet';node.href=href;node.media='not all';node.dataset.mediaPageStyle='';}node.onload=()=>resolve(node);node.onerror=()=>{node.remove();resources.delete(href);reject(new Error('页面资源暂时无法读取'))};document.head.insertBefore(node,document.querySelector('[data-media-shell-style]'));});resources.set(href,promise);return promise;
 }
 async function prepare(url){
  const key=canonical(url).pathname;
  if(documents.has(key))return documents.get(key);
  const promise=(async()=>{
   const response=await fetch(new URL(key,root),{credentials:'same-origin'});
   if(!response.ok)throw new Error('页面暂时无法读取');
   const html=await response.text(),doc=new DOMParser().parseFromString(html,'text/html');
   const panel=doc.getElementById('radar-stage'),meta=doc.querySelector('meta[name="media-page"]'),bundle=doc.querySelector('[data-media-page-bundle]');
   if(!panel||!meta||!bundle||!['home','archive','random'].includes(meta.content))throw new Error('页面格式已更新，请刷新后重试');
   // Relative content URLs keep their document-relative meaning after insertion.
   panel.querySelectorAll('[src],[href],[srcset]').forEach(node=>{for(const attr of ['src','href']){const value=node.getAttribute(attr);if(value&&!value.startsWith('#'))node.setAttribute(attr,new URL(value,url).href);}const value=node.getAttribute('srcset');if(value)node.setAttribute('srcset',value.split(',').map(part=>{const [src,...rest]=part.trim().split(/\s+/);return [new URL(src,url).href,...rest].join(' ')}).join(', '));});
   const styles=await Promise.all([...doc.querySelectorAll('[data-media-page-style]')].map(link=>asset(new URL(link.getAttribute('href'),url).href,'style')));
   if(!factories[meta.content])await asset(new URL(bundle.getAttribute('src'),url).href,'script');
   return {html:panel.innerHTML,key:meta.content,title:doc.title,styles};
  })();documents.set(key,promise);try{return await promise}catch(error){documents.delete(key);throw error}
 }
 function mount(){window.MediaArtPage.start();factories[pageKey]?.();}
 async function go(value,{pop=false,state=null}={}){
  const url=canonical(value);if(!isPage(url))return false;
  const ticket=++version;
  if(!pop)remember();
  // No new entry or DOM work for a repeated navigation click.
  if(canonical(location.href).href===url.href && !pop && !pending)return true;
  if(canonical(new URL(documentPath,root)).pathname===url.pathname){
   pending=null;stage.removeAttribute('aria-busy');
   if(!pop&&location.href!==url.href)history.pushState({},'',url);
   syncRail(url);routeEvent();if(pop)scroll(state?.mediaScroll);else scroll();
   let id='';try{id=decodeURIComponent(url.hash.slice(1))}catch{}document.getElementById(id)?.scrollIntoView?.({block:'start'});
   return true;
  }
  pending=url.href;stage.setAttribute('aria-busy','true');
  try{
   const next=await prepare(url);if(ticket!==version)return true;
   window.MediaArtPage.stop();
   activeStyles.forEach(link=>{link.media='not all'});next.styles.forEach(link=>{link.media='all'});activeStyles=next.styles;
   stage.innerHTML=next.html;pageKey=next.key;documentPath=url.pathname;document.title=next.title||baseTitle;delete document.body.dataset.route;
   if(!pop)history.pushState({},'',url);
   syncRail(url);mount();scroll(pop?state?.mediaScroll:null);if(pop){const scope=window.MediaArtPage.current;const restore=()=>{if(scope.active)scroll(state?.mediaScroll);};window.addEventListener('media-content-ready',restore,{once:true});scope.onCleanup(()=>window.removeEventListener('media-content-ready',restore));}stage.focus({preventScroll:true});window.MediaArtHeader?.refresh();
  }catch(error){if(ticket===version)notify(error.message+'，请再点一次重试。');}
  finally{if(ticket===version){pending=null;stage.removeAttribute('aria-busy')}}
  return true;
 }
 window.MediaArtNavigation={root:root.href,go};
 document.addEventListener('click',event=>{
  if(event.defaultPrevented||event.button>0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const link=event.target.closest?.('a[href]');if(!link||link.hasAttribute('download')||link.target&&link.target!=='_self')return;
  if(link.hasAttribute('data-media-skip')){event.preventDefault();stage.focus();return;}
  const url=canonical(link.href);if(!isPage(url))return;
  event.preventDefault();go(url);
 });
 window.addEventListener('popstate',event=>go(location.href,{pop:true,state:event.state}));
 window.addEventListener('hashchange',()=>syncRail(canonical(location.href)));
 window.addEventListener('pagehide',()=>window.MediaArtPage.stop());
 window.addEventListener('pageshow',event=>{if(event.persisted){window.MediaArtPage.stop();mount();}});
 history.scrollRestoration='manual';syncRail(canonical(location.href));mount();
})();

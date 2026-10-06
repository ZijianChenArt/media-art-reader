import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseHTML,DOMParser} from 'linkedom';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const records=['one','two','three'].map((id,i)=>({id,title:'Work '+id,artist:'Artist',image:'assets/test.jpg',number:i+1,year:'2026',medium:'Installation',description:'Description',tags:[],defaultStatus:'pending'}));
const nav=fs.readFileSync('media-navigation.js','utf8');
async function setup({initial='/',base='/',delayArchive=false,failArchive=false,delayStates=false,desktop=true}={}){
 const pages={home:fs.readFileSync('index.html','utf8'),archive:fs.readFileSync('archive/index.html','utf8')};
 for(const key in pages)pages[key]=pages[key].replaceAll('href="/','href="'+base).replaceAll('src="/','src="'+base).replaceAll('data-radar-data-url="/','data-radar-data-url="'+base);
 const current={url:new URL('https://test.example'+base+(initial==='/'?'':initial))};
 const key=initial.includes('archive')?'archive':'home';
 const {window}=parseHTML(pages[key]),document=window.document,calls=[],errors=[];
 for(const key of ['MediaArtNavigation','MediaArtPage','MediaArtPages','ArchiveSearch','ArtworkReviewDropdown','confirmArtworkRemoval'])delete window[key];
 const historyEntries=[{url:current.url.href,state:{}}];let index=0,releaseArchive,releaseStates;
 const location=new Proxy({}, {get(_,key){return current.url[key]},set(_,key,value){current.url[key]=value;return true}});
 window.location=location;
 Object.defineProperty(window.HTMLAnchorElement.prototype,'href',{configurable:true,get(){return new URL(this.getAttribute('href'),current.url).href},set(value){this.setAttribute('href',value)}});
 const history={get state(){return historyEntries[index].state},pushState(state,_,url){current.url=new URL(url,current.url);historyEntries.splice(++index);historyEntries.push({url:current.url.href,state})},replaceState(state,_,url){current.url=new URL(url,current.url);historyEntries[index]={url:current.url.href,state}}};
 window.scrollTo=({top}={})=>{window.scrollY=top||0};window.scrollY=0;
 const matchMedia=query=>({matches:desktop?query.includes('min-width'):query.includes('max-width'),addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
 window.matchMedia=matchMedia;document.fonts={ready:Promise.resolve()};window.requestAnimationFrame=fn=>setTimeout(fn,0);window.cancelAnimationFrame=clearTimeout;
 window.HTMLCanvasElement.prototype.getContext=()=>({measureText:()=>({actualBoundingBoxLeft:0})});
 window.Element.prototype.scrollIntoView=function(){};
 const fetch=async(url,options)=>{url=new URL(url,current.url);calls.push({url:url.href,options});if(url.pathname.endsWith('/api/selections')){if(delayStates)await new Promise(resolve=>releaseStates=resolve);return{ok:true,status:200,json:async()=>({states:{one:'selected'}})}};if(url.pathname.endsWith('latest.json'))return{ok:true,json:async()=>JSON.parse(fs.readFileSync('latest.json'))};if(url.pathname.includes('archive')){if(delayArchive)await new Promise(resolve=>releaseArchive=resolve);if(failArchive)return{ok:false,status:503};}const key=url.pathname.includes('archive')?'archive':url.pathname.includes('random')?'random':'home';return{ok:true,text:async()=>pages[key]};};
 const context=vm.createContext({window,document,location,history,fetch,DOMParser,URL,console:{log(){},warn(...args){errors.push(args.map(String).join(' '))}},Event:window.Event,matchMedia,getComputedStyle:()=>({gridTemplateColumns:'1fr 1fr 1fr',getPropertyValue:()=>'',fontStyle:'normal',fontWeight:'400',fontSize:'16px',fontFamily:'sans-serif'}),setTimeout,clearTimeout,requestAnimationFrame:window.requestAnimationFrame,cancelAnimationFrame:clearTimeout});
 const insert=document.head.insertBefore.bind(document.head);
 document.head.insertBefore=(node,before)=>{const result=insert(node,before);queueMicrotask(()=>{try{if(node.localName==='script'){const file=new URL(node.getAttribute('src'),current.url).pathname.split('/').at(-1);vm.runInContext(fs.readFileSync(''+file,'utf8'),context);}node.onload?.();}catch(error){errors.push(error.stack);node.onerror?.();}});return result;};
 vm.runInContext(fs.readFileSync('media-page-'+key+'.js','utf8'),context);vm.runInContext(nav,context);await tick();await tick();
 return {window,document,context,calls,errors,location,historyEntries,nav:window.MediaArtNavigation,release(){delayArchive=false;releaseArchive?.()},releaseStates(){delayStates=false;releaseStates?.()},back:async()=>{if(index>0){current.url=new URL(historyEntries[--index].url);await window.MediaArtNavigation.go(location.href,{pop:true,state:historyEntries[index].state});await tick()}},forward:async()=>{if(index+1<historyEntries.length){current.url=new URL(historyEntries[++index].url);await window.MediaArtNavigation.go(location.href,{pop:true,state:historyEntries[index].state});await tick()}},unfail(){failArchive=false},stop(){window.MediaArtPage.stop()}};
}
test('content navigation preserves exact rail and stage nodes across sections, repeat, back and forward',async()=>{
 const app=await setup(),rail=app.document.querySelector('.radar-rail'),stage=app.document.getElementById('radar-stage');
 assert.ok(app.document.querySelector('.ledger'));
 await app.nav.go('/archive/');await tick();assert.ok(app.document.querySelector('#archive-search'));assert.ok(app.document.querySelector('#archive-grid .card'));assert.ok(!app.document.querySelector('#archive-signout'));
 const length=app.historyEntries.length;await app.nav.go('/archive/');assert.equal(app.historyEntries.length,length);
 await app.nav.go('/#widget');await tick();assert.ok(app.document.querySelector('.widget-view'));assert.equal(app.document.querySelectorAll('dialog').length,0);
 await app.back();assert.ok(app.document.querySelector('#archive-search'));await app.forward();assert.ok(app.document.querySelector('.widget-view'));
 await app.nav.go('/#opportunities/exhibition');assert.ok(app.document.querySelector('.ledger'));assert.equal(app.document.querySelector('.radar-rail'),rail);assert.equal(app.document.getElementById('radar-stage'),stage);
 assert.deepEqual(app.errors,[]);app.stop();
});
test('direct archive entry, relative base path and home download stay under GitHub repository prefix',async()=>{
 const app=await setup({initial:'archive/',base:'/media-art-reader/'}),rail=app.document.querySelector('.radar-rail');
 await app.nav.go('/media-art-reader/#widget');await tick();assert.ok(app.document.querySelector('.widget-view'));
 assert.equal(app.document.querySelector('a[download]').href,'https://test.example/media-art-reader/Media-Art-Radar.js?v=34');
 await app.nav.go('/media-art-reader/archive/');await tick();assert.equal(app.document.querySelector('.radar-rail'),rail);assert.ok(app.calls.some(call=>call.url==='https://test.example/media-art-reader/latest.json'));assert.deepEqual(app.errors,[]);app.stop();
});
test('new navigation cancels a slow archive response and keeps the latest section',async()=>{
 const app=await setup({delayArchive:true});const pending=app.nav.go('/archive/');await tick();await app.nav.go('/#widget');app.release();await pending;await tick();
 assert.equal(app.location.hash,'#widget');assert.ok(app.document.querySelector('.widget-view'));assert.equal(app.document.getElementById('radar-stage').hasAttribute('aria-busy'),false);assert.deepEqual(app.errors,[]);app.stop();
});
test('failed navigation retains content and rail and an explicit retry succeeds',async()=>{
 const app=await setup({failArchive:true}),rail=app.document.querySelector('.radar-rail');await app.nav.go('/archive/');assert.ok(app.document.querySelector('.ledger'));assert.match(app.document.querySelector('[role="alert"]').textContent,/重试/);assert.equal(app.location.pathname,'/');app.unfail();await app.nav.go('/archive/');await tick();assert.ok(app.document.querySelector('#archive-search'));assert.equal(app.document.querySelector('.radar-rail'),rail);assert.deepEqual(app.errors,[]);app.stop();
});
test('rapid repeated archive requests create only one history entry and one active page',async()=>{
 const app=await setup({delayArchive:true});const first=app.nav.go('/archive/');await tick();const second=app.nav.go('/archive/');app.release();await Promise.all([first,second]);await tick();
 assert.equal(app.historyEntries.length,2);assert.equal(app.document.querySelectorAll('#archive-search').length,1);assert.equal(app.document.querySelectorAll('.artwork-lightbox').length,1);assert.deepEqual(app.errors,[]);app.stop();
});

test('search, gallery and mobile details work after repeated visits without duplicate handlers',async()=>{
 const app=await setup({desktop:false});for(let i=0;i<3;i++){await app.nav.go('/archive/');await tick();await app.nav.go('/#opportunities/residency');await tick();}await app.nav.go('/archive/');await tick();
 const input=app.document.querySelector('#archive-search');input.value='everything';input.dispatchEvent(new app.window.Event('input'));assert.ok(app.document.getElementById('everything'));app.document.querySelector('#clear-search').dispatchEvent(new app.window.Event('click'));
 const gallery=app.document.querySelector('[data-gallery]:has([data-gallery-step="1"])');assert.ok(gallery);const arrow=gallery.querySelector('[data-gallery-step="1"]');arrow.dispatchEvent(new app.window.Event('click',{bubbles:true,cancelable:true}));assert.equal(gallery.querySelector('[data-slide="1"]').hidden,false);
 const summary=app.document.querySelector('details summary');summary.dispatchEvent(new app.window.Event('click',{bubbles:true,cancelable:true}));assert.equal(summary.closest('details').open,true);summary.dispatchEvent(new app.window.Event('click',{bubbles:true,cancelable:true}));assert.equal(summary.closest('details').open,false);
 assert.ok(!app.calls.some(call=>call.url.includes('/api/')));assert.deepEqual(app.errors,[]);app.stop();
});

test('persistent keyboard skip links stay offscreen independent of page styles',()=>{const css=fs.readFileSync('radar-shell.css','utf8');assert.match(css,/\.skip\{position:absolute;left:-999px;/);assert.match(css,/body>\.skip-link\{[^}]*position:fixed;[^}]*transform:translateY\(-160%\)/);for(const page of ['index.html','archive/index.html']){const document=parseHTML(fs.readFileSync(page,'utf8')).document;const link=document.querySelector('[data-media-skip]');assert.equal(link.getAttribute('href'),'#radar-stage');}});

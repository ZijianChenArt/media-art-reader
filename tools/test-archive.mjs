import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sanitizePublicCatalog} from './public-catalog.mjs';
import {renderPublicCard,renderPublicArchive} from './render-public-archive.mjs';
import {skinPrivatePage} from './radar-shell.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const record={id:'sample',title:'Artwork',artist:'Artist',image:'assets/artwork.jpg',description:'Artwork description',exhibition:'Museum, 2026',defaultStatus:'selected',userId:'private-user',why:'Personal recommendation',localImage:'/private/path',additionalImages:[{image:'assets/second.jpg',localImage:'/private/second',credit:'Photo credit'}]};
test('public allowlist omits private fields recursively',()=>{
 const data=sanitizePublicCatalog([record]);const json=JSON.stringify(data);
 for(const marker of ['defaultStatus','userId','private-user','Personal recommendation','localImage','/private/'])assert.ok(!json.includes(marker),marker);
 assert.equal(data[0].additionalImages[0].credit,'Photo credit');assert.equal(data[0].number,1);
 assert.deepEqual(sanitizePublicCatalog([record],{excludeIds:['sample']}),[]);
});
test('invalid IDs, duplicate IDs, and escaping image paths are rejected',()=>{
 assert.throws(()=>sanitizePublicCatalog([{...record,id:'../x'}]));assert.throws(()=>sanitizePublicCatalog([record,record]));
 for(const image of ['/workspace/local.jpg','assets/../private.jpg','https://host/image.jpg'])assert.throws(()=>sanitizePublicCatalog([{...record,image}]));
});
test('public cards preserve two-image gallery, factual text, and sources without controls',()=>{
 const [data]=sanitizePublicCatalog([record]);const html=renderPublicCard(data);
 assert.equal((html.match(/data-slide=/g)||[]).length,2);assert.match(html,/data-gallery-step="-1"/);assert.match(html,/data-gallery-step="1"/);
 assert.ok(html.indexOf('class="exhibition"')<html.indexOf('class="description"'));assert.equal((html.match(/class="description"/g)||[]).length,1);
 for(const marker of ['data-review','data-remove','data-default-status','Personal recommendation'])assert.ok(!html.includes(marker));
 const page=renderPublicArchive([data]);assert.match(page,/https:\/\/media-art-fieldnotes\.mystic-dune-6472\.chatgpt\.site\/archive\//);assert.ok(!page.includes('/api/selections'));
});
test('rendering escapes HTML and rejects executable external links',()=>{
 const html=renderPublicCard({...record,title:'<script>alert(1)</script>',work:'javascript:alert(1)'});
 assert.ok(!html.includes('<script>'));assert.ok(!html.includes('href="javascript:'));assert.ok(html.includes('&lt;script&gt;'));
});
test('private wrapper preserves scripts and state controls and adds exactly one shell',()=>{
 const original='<!doctype html><html><head></head><body><header class="workspace-header"><h1>Old</h1></header><main><select data-review="sample"><option>Choice</option></select><div class="index">01</div></main><script src="/selections.js"></script></body></html>';
 const html=skinPrivatePage(original);
 assert.ok(html.includes('<select data-review="sample">'));assert.ok(html.includes('<div class="index">01</div>'));assert.ok(html.includes('/selections.js'));assert.ok(!html.includes('workspace-header'));assert.ok(html.includes('radar-index'));assert.equal((html.match(/data-radar-page=/g)||[]).length,1);
 assert.throws(()=>skinPrivatePage(html));
});
test('static build links and image assets resolve under Pages project and Site root',()=>{
 const html=fs.readFileSync(path.join(root,'archive/index.html'),'utf8');
 for(const prefix of ['/media-art-reader/','/']){
  const pageURL=new URL(prefix+'archive/','https://example.com');
  for(const [,value]of html.matchAll(/(?:src|href)="([^"]+)"/g)){
   if(value.startsWith('#')||/^https?:/.test(value))continue;
   const url=new URL(value.replaceAll('&amp;','&'),pageURL);assert.ok(url.pathname.startsWith(prefix));
   const file=path.join(root,url.pathname.slice(prefix.length));assert.ok(fs.existsSync(file),'Missing '+file);
  }
 }
});
test('homepage archive link is not intercepted by hash routing',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),script=fs.readFileSync(path.join(root,'site-v15.js'),'utf8');
 assert.match(html,/class="nav mini archive-nav" href="archive\/"/);assert.ok(script.includes("$$('.nav[data-route]').forEach(btn => btn.addEventListener"));
});

import {createHash} from 'node:crypto';
test('shared public asset URLs match current content fingerprints',()=>{
 for(const [page,names] of [['index.html',['site-v15.css','site-v15.js']],['archive/index.html',['radar-shell.css','radar-shell.js','archive/archive-detail.css','archive/archive-detail.js','archive/details-motion.js']]]){
  const html=fs.readFileSync(path.join(root,page),'utf8');
  for(const name of names){const fingerprint=createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex').slice(0,12);assert.ok(html.includes(path.basename(name)+'?v='+fingerprint),'Stale cache fingerprint: '+name);}
 }
});

test('desktop detail contract expands the original card in its own row without a modal',()=>{
 const script=fs.readFileSync(path.join(root,'archive/archive-detail.js'),'utf8');
 const css=fs.readFileSync(path.join(root,'archive/archive-detail.css'),'utf8');
 assert.match(script,/archive-inline-details/);assert.match(script,/card\.append\(panel\)/);
 assert.match(script,/body\.append\(content\)/);assert.match(script,/replaceWith\(state\.content\)/);
 assert.doesNotMatch(script,/showModal|createElement\(['"]dialog['"]\)|cloneNode|lockBackground/);
 assert.match(css,/translateX\(var\(--archive-detail-shift/);assert.match(css,/clip-path: inset\(0 100% 0 0\)/);
 assert.match(css,/prefers-reduced-motion: reduce/);assert.doesNotMatch(css,/::backdrop|position: fixed/);
});

test('in-place details preserve mobile, random, and dynamic archive lifecycle boundaries',()=>{
 const script=fs.readFileSync(path.join(root,'archive/archive-detail.js'),'utf8');
 assert.match(script,/min-width: 861px/);assert.match(script,/#random-stage/);
 assert.match(script,/MutationObserver/);assert.match(script,/ResizeObserver/);
 for(const name of ['input','change','popstate','hashchange','pagehide'])assert.ok(script.includes("'"+name+"'"),name);
 for(const marker of ['/api/selections','localStorage','fetch('])assert.ok(!script.includes(marker),marker);
});

test('public initial cards and full-catalog registry survive the detail change',()=>{
 const html=fs.readFileSync(path.join(root,'archive/index.html'),'utf8');
 const catalog=JSON.parse(fs.readFileSync(path.join(root,'archive/catalog.json'),'utf8'));
 const registry=JSON.parse(html.match(/<script type="application\/json" id="archive-records">([\s\S]*?)<\/script>/)[1]);
 assert.equal((html.match(/<article class="card"/g)||[]).length,10);
 assert.deepEqual(registry.map(record=>record.id),catalog.map(record=>record.id));
 for(const record of registry){assert.match(record.html,/class="details-content"/);assert.ok(!record.html.includes('archive-inline-details'));}
 for(const marker of ['data-review=','data-remove=','data-default-status=','/api/selections','/workspace/','/root/'])assert.ok(!html.includes(marker),marker);
});

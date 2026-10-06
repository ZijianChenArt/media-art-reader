import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseHTML} from 'linkedom';
import {skinRadarHome} from './radar-shell.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex').slice(0,12);
// Also used by the read-only GitHub mirror. Every URL stays relative to its base.
export function buildNavigation(directory,{pages=['index.html','archive/index.html','random/index.html'],sourceDirectory='public'}={}) {
 const root=path.resolve(directory),origin='https://build.invalid/';
 if(path.resolve(sourceDirectory)!==root)fs.copyFileSync(path.join(sourceDirectory,'media-navigation.js'),path.join(root,'media-navigation.js'));
 for(const file of pages){
  let html=fs.readFileSync(path.join(root,file),'utf8');
  if(file==='index.html'&&!html.includes('data-radar-page='))html=skinRadarHome(html);
  const {document}=parseHTML(html),key=file==='index.html'?'home':file.split('/')[0];
  const relative=file==='index.html'?'./':'../';
  const pageURL=new URL(file,origin);
  document.querySelectorAll('a.skip,a.skip-link').forEach(link=>{link.setAttribute('href','#radar-stage');link.setAttribute('data-media-skip','');});
  const scripts=[...document.querySelectorAll('script[src]')];
  const oldSources=document.querySelector('meta[name="media-sources"]');
  const sources=oldSources?JSON.parse(oldSources.content):scripts.map(script=>script.getAttribute('src'));
  document.querySelector('meta[name="media-page"]')?.remove();
  oldSources?.remove();
  const sourceMeta=document.createElement('meta');sourceMeta.name='media-sources';sourceMeta.content=JSON.stringify(sources.map(source=>source.split('?')[0]));document.head.append(sourceMeta);
  let bundle='window.MediaArtPages ||= {};\nwindow.MediaArtPages['+JSON.stringify(key)+'] = function(){\n';
  for(const source of sources){
   const src=new URL(source,pageURL),name=path.basename(src.pathname);
   if(!['radar-shell.js','legacy-archive.js'].includes(name))bundle+='\n/* '+name+' */\n'+fs.readFileSync(path.join(root,decodeURIComponent(src.pathname)), 'utf8')+'\n';
  }
  scripts.forEach(script=>{if(!script.getAttribute('src').includes('legacy-archive.js'))script.remove();});
  bundle+='\n};\n';
  fs.writeFileSync(path.join(root,`media-page-${key}.js`),bundle);
  const meta=document.createElement('meta');meta.name='media-page';meta.content=key;document.head.append(meta);
  let shellStyle;
  document.querySelectorAll('link[rel="stylesheet"]').forEach(link=>{
   if(link.getAttribute('href').split('?')[0].endsWith('radar-shell.css')){shellStyle=link;link.setAttribute('data-media-shell-style','');}
   else link.setAttribute('data-media-page-style','');
  });
  if(!shellStyle){shellStyle=document.createElement('link');shellStyle.rel='stylesheet';shellStyle.href=relative+'radar-shell.css?v='+hash(fs.readFileSync(path.join(root,'radar-shell.css')));shellStyle.setAttribute('data-media-shell-style','');}
  shellStyle.href=relative+'radar-shell.css?v='+hash(fs.readFileSync(path.join(root,'radar-shell.css')));
  document.head.append(shellStyle);
  for(const [name,attribute] of [[`media-page-${key}.js`,'data-media-page-bundle'],['media-navigation.js',null],['radar-shell.js',null]]){
   const script=document.createElement('script');script.src=relative+name+'?v='+hash(fs.readFileSync(path.join(root,name)));script.defer=true;if(attribute)script.setAttribute(attribute,'');document.body.append(script);
  }
  fs.writeFileSync(path.join(root,file),document.toString().replace(/[ \t]+\n/g,'\n'));
 }
}

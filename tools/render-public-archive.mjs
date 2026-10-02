import {buildPinyinIndex} from './build-search-index.mjs';
import {artworkRights} from './artwork-rights.mjs';
import {renderRadarShell,renderArchiveHeading} from './radar-shell.mjs';
const E=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link=(url,label)=>/^https?:\/\//.test(String(url||''))?`<a href="${E(url)}" target="_blank" rel="noopener noreferrer">${E(label)}</a>`:'';
// Same card anatomy and two-image gallery as the private archive; no review state.
export function renderPublicCard(work){
 const pictures=[{image:work.image,imagePosition:work.imagePosition,imageZoom:work.imageZoom,imageFit:work.imageFit},...(work.additionalImages||[]).slice(0,1)];
 const sources=[...(work.verificationSources||[]),...(work.sourceURLs||[]),...(work.sources||[]),work.officialSourceURL].filter(source=>typeof source==='string');
 return `<article class="card" id="${E(work.id)}" data-search="${E([work.title,work.artist,...(work.searchAliases||[]),...(work.tags||[]),work.exhibition].filter(Boolean).join(' '))}" data-search-pinyin="${E(JSON.stringify(buildPinyinIndex(work)))}" aria-labelledby="title-${E(work.id)}">
 <div class="image-wrap" data-gallery aria-label="${E(work.title)}作品图片">
 ${pictures.map((picture,index)=>`<a class="image-slide" data-slide="${index}" href="${E(picture.image)}" aria-haspopup="dialog" rel="noopener noreferrer" aria-label="放大查看《${E(work.title)}》第${index+1}张图片"${index?' hidden':''}><img src="${E(picture.image)}" alt="${E(work.title)}${pictures.length>1?' · '+(index+1)+' / '+pictures.length:''}" loading="lazy" decoding="async" style="object-fit:${picture.imageFit==='contain'?'contain':'cover'};object-position:${E(picture.imagePosition||'50% 50%')};transform:scale(${Number(picture.imageZoom)||1})"></a>`).join('')}
 <span class="work-number" aria-label="作品编号">${String(work.number).padStart(2,'0')}</span>
 ${pictures.length>1?`<button class="gallery-arrow gallery-prev" type="button" data-gallery-step="-1" aria-label="上一张作品图片">‹</button><button class="gallery-arrow gallery-next" type="button" data-gallery-step="1" aria-label="下一张作品图片">›</button><span class="gallery-count" aria-live="polite">1 / ${pictures.length}</span>`:''}</div>
 <div class="card-body"><div class="work-heading"><h3 id="title-${E(work.id)}">${E(work.title)}</h3><div class="artist">${E(String(work.artist||'').split('；')[0])}</div><div class="work-facts"><span class="work-year">${E(work.year)}</span><span>${E(work.medium)}</span></div></div>
 ${work.exhibition?`<p class="exhibition"><strong>展览记录</strong><span>${E(work.exhibition)}</span></p>`:work.award?`<p class="exhibition"><strong>展览／奖项记录</strong><span>${E(work.award)}</span></p>`:''}
 <div class="work-reading"><p class="description">${E(work.description)}</p></div>
 <div class="card-sources"><div class="links">${link(work.work,'官方作品资料')}${work.video!==work.work?link(work.video,'影像／现场记录'):''}</div>
 <details><summary>更多作品信息<span class="details-indicator" aria-hidden="true"></span></summary><div class="details-content">
 ${String(work.artist||'').includes('；')?`<p><strong>完整署名</strong><br>${E(work.artist)}</p>`:''}
 ${work.exhibition&&work.award?`<p>${E(work.award)}</p>`:''}${work.notes?`<p>${E(work.notes)}</p>`:''}${work.tags?.length?`<p class="tags">${work.tags.map(E).join(' / ')}</p>`:''}
 <p>${link(work.exhibitionurl||work.awardurl,'展览／奖项来源')}</p>
 ${sources.length?`<div class="verification-links">${[...new Set(sources)].map((source,i)=>link(source,`核验资料 ${i+1}`)).join('')}</div>`:''}
 <div class="credit">${E(work.imageNote||'作品记录')} · ${E(work.credit)} · ${link(work.imageSource,'图片来源')}</div>
 ${(work.additionalImages||[]).slice(0,1).map(picture=>`<div class="credit">图2 · ${E(picture.imageNote||'作品记录')} · ${E(picture.credit)} · ${link(picture.imageSource,'图片来源')}</div>`).join('')}
 ${artworkRights(work).map(({label,text})=>`<p class="artwork-rights">${label?E(label)+' · ':''}${E(text)}</p>`).join('')}</div></details></div></div></article>`;
}
export function renderPublicArchive(records,{privateUrl='https://media-art-fieldnotes.mystic-dune-6472.chatgpt.site/archive/'}={}){
 const content=`${renderArchiveHeading()}
 <main id="archive-content" tabindex="-1">
 <div class="archive-toolbar"><div class="archive-context"><p>作品、展览记录与一手出处。</p><a class="radar-workspace-link" href="${E(privateUrl)}">前往私人档案管理 ↗</a><small>筛选与移除操作仅在私人档案内提供</small></div>
 <label class="archive-search"><span class="sr-only">搜索作品、作者或关键词</span><input id="archive-search" type="search" placeholder="搜索作品、作者或关键词" autocomplete="off"><button id="clear-search" type="button" aria-label="清空搜索" hidden>×</button></label></div>
 <div class="catalog-heading"><h2>全部作品 <em>All works</em></h2><span id="search-feedback" role="status" aria-live="polite">${records.length} 件作品</span></div>
 <p class="empty-selection" id="empty-selection" hidden>没有找到匹配的作品或作者。</p>
 <div class="archive-grid" id="archive-grid">${records.map(renderPublicCard).join('\n')}</div>
 <noscript><p class="archive-note">作品可直接浏览；启用 JavaScript 后可搜索和切换第二张图片。</p></noscript>
 </main><footer class="archive-footer"><p>图像与作品版权归相应艺术家、摄影师及机构。请保留出处，转载与再利用前核实授权。</p><a href="#archive-content">回到顶部 ↑</a></footer>`;
 return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>媒体艺术档案 · Media Art Radar</title><meta name="description" content="Media Art Radar 媒体艺术作品档案：作品图片、创作信息、展览记录与一手出处。"><link rel="preload" href="../assets/fonts/space-grotesk-var.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="../radar-shell.css?v=662c57346348"><link rel="stylesheet" href="archive.css"><link rel="stylesheet" href="artwork-lightbox.css"><link rel="stylesheet" href="archive-detail.css"></head><body><a class="skip-link" href="#archive-content">跳到作品</a>${renderRadarShell(content)}<script src="../radar-shell.js?v=3e9b0e6072ac" defer></script><script src="details-motion.js" defer></script><script src="gallery.js" defer></script><script src="artwork-lightbox.js" defer></script><script src="archive-detail.js" defer></script><script src="archive-search.js" defer></script><script src="archive.js" defer></script></body></html>`;
}

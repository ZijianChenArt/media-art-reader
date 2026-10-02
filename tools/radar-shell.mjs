const E = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons = {
  exhibition:'<circle cx="6" cy="6" r="5" fill="currentColor"/>',
  residency:'<circle cx="6" cy="6" r="4.2" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  prize:'<path d="M6 .6 11.4 6 6 11.4.6 6z" fill="currentColor"/>',
  conference:'<path d="M6 .9 11.3 10.6H.7z" fill="currentColor"/>'
};
export function renderRadarShell(content, {rootHref='../', archiveHref='./', page='archive', privateMode=false}={}) {
  const sections=[['exhibition','展览征集','Exhibitions'],['residency','驻留','Residencies'],['prize','奖项','Prizes'],['conference','学术会议','Conferences']];
  return `<div class="radar-app" data-radar-page="${E(page)}" data-radar-data-url="${E(rootHref)}latest.json">
  <aside class="radar-rail" data-media-header><a class="radar-brand" href="${E(rootHref)}#opportunities" aria-label="Media Art Radar"><span>Media Art</span></a>
  <nav class="radar-index" aria-label="主要内容">
    <section class="radar-group" aria-label="国际机会精选">
      <a class="radar-nav radar-main" href="${E(rootHref)}#opportunities"><span class="radar-n">01</span><strong>国际机会精选</strong><span class="radar-c" data-radar-count="all">—</span></a>
      ${sections.map(([key,zh,en])=>`<a class="radar-nav radar-tile" href="${E(rootHref)}#opportunities/${key}"><i class="radar-g"><svg viewBox="0 0 12 12" aria-hidden="true">${icons[key]}</svg></i><span class="radar-c" data-radar-count="${key}">—</span><span class="radar-tl"><strong>${zh}</strong><em>${en}</em></span></a>`).join('')}
    </section>
    <a class="radar-nav radar-mini radar-archive-nav is-active" href="${E(archiveHref)}" aria-current="page"><span class="radar-n">02</span><strong>媒体艺术档案</strong><i>↗</i></a>
    <a class="radar-nav radar-mini" href="${E(rootHref)}#widget"><span class="radar-n">03</span><strong>小组件</strong><i>↗</i></a>
  </nav></aside>
  <div class="radar-stage" id="radar-stage"><div class="radar-view${privateMode?' radar-private':''}">${content}</div></div></div>`;
}
export function renderArchiveHeading({random=false, privateMode=false, archiveHref='./', randomHref='../random/'}={}) {
  return `<header class="radar-page-head"><h1><span>${random?'随机选择':'媒体艺术档案'}</span><em>${random?'Random':'Archive'}<span class="radar-dot">.</span></em></h1><div class="radar-page-meta">${random?'':'<span>02 / Archive</span>'}${privateMode?`<a class="radar-workspace-link" href="${E(random?archiveHref:randomHref)}">${random?'返回作品库':'随机选择'} ↗</a>`:''}</div></header>`;
}
// Apply after renderCatalog/renderRandom. IDs, state controls, scripts and templates stay intact.
export function skinPrivatePage(html, {random=false, rootHref='/', archiveHref='/archive/', randomHref='/random/', assetHref='/'}={}) {
  if (html.includes('data-radar-page=')) throw new Error('Page already has the Radar shell');
  let body=html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1];
  if(body===undefined) throw new Error('Expected a complete HTML document');
  body=body.replace(/<header class="workspace-header">[\s\S]*?<\/header>/,'');
  // The shell title replaces only the duplicated random-page title; retain its helpful description.
  if(random) body=body.replace('<h2>随机选择</h2>','');
  if(!random) {
    const count=body.match(/<span data-total-count>(\d+)<\/span>/)?.[1] || '—';
    const scope=`<div class="radar-archive-scope"><h2 id="archive-scope-zh">全部作品</h2><em id="archive-scope-en">All works</em><span id="archive-scope-count">${E(count)}</span></div>`;
    body=body.replace('<div class="selection-tools">',scope+'<div class="selection-tools">');
  }
  const heading=renderArchiveHeading({random,privateMode:true,archiveHref,randomHref});
  const wrapped=renderRadarShell(heading+body,{rootHref,archiveHref,page:random?'random':'archive',privateMode:true});
  return html.replace(/<body[^>]*>[\s\S]*?<\/body>/i,`<body>${wrapped}<script src="${E(assetHref)}radar-shell.js" defer></script></body>`)
    .replace('</head>',`<link rel="stylesheet" href="${E(assetHref)}radar-shell.css"></head>`);
}

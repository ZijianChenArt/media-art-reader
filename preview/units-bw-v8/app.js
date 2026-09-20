(() => {
  const DATA_URL='../../latest.json';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const short=(s,n=52)=>{s=String(s||'').replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1)+'…':s};
  const labels={exhibition:'展览征集',residency:'驻留',prize:'奖项',conference:'学术会议'};
  const imgs=['../../assets/diatomic-garden.jpg','../../assets/conspiratorial-design.jpg'];
  let data=null;

  const fmtDate=item=>{
    const d=item.deadline_date||(item.deadline_at||'').slice(0,10);
    if(!d) return '—';
    const [,m,day]=d.split('-');
    return m+'.'+day;
  };
  const daysLeft=item=>{
    const t=Date.parse(item.deadline_at||item.deadline_date);
    if(!Number.isFinite(t)) return null;
    return Math.max(0,Math.ceil((t-Date.now())/86400000));
  };
  const titleParts=t=>String(t||'').split('/').map(x=>x.trim()).filter(Boolean);

  function setActive(route,filter='all'){
    $$('.rail-nav button').forEach(b=>b.classList.remove('is-active'));
    if(route==='focus') $('.focus-nav')?.classList.add('is-active');
    if(route==='widget') $('.widget-nav')?.classList.add('is-active');
    if(route==='opportunities'){
      if(filter==='all') $('.opportunity-home')?.classList.add('is-active');
      else $('.cat[data-filter="'+filter+'"]')?.classList.add('is-active');
    }
  }

  function renderCard(item,i){
    const parts=titleParts(item.title);
    const d=daysLeft(item);
    const facts=[
      ['SUPPORT',item.highlight ? item.highlight+' '+(item.highlight_label||'') : short(item.funding,36)],
      ['TRAVEL',short(item.travel||item.accommodation,36)],
      ['FEE',short(item.application_fee,24)]
    ];
    return `<article class="call-card">
      <span class="card-index">${String(i+1).padStart(2,'0')}</span>
      <div class="card-meta">
        <span class="type">${esc(labels[item.category]||item.category||'OPEN CALL')}</span>
        <span>${esc(short(item.location,34))}</span>
        <span>项目 ${esc(item.project_when||'—')}</span>
      </div>
      <h2 class="card-title">${esc(parts[0]||item.title)}</h2>
      ${parts.length>1?`<p class="card-subtitle">${esc(parts.slice(1).join(' / '))}</p>`:''}
      <div class="deadline-block">
        <div class="deadline-date">${esc(fmtDate(item))}</div>
        <div class="deadline-copy">${d===null?'DATE TBA':d===0?'TODAY':'T−'+d+' DAYS'}<br><small>申请截止 / DEADLINE</small></div>
      </div>
      <div class="facts">${facts.map(([k,v])=>`<div class="fact"><small>${k}</small><b>${esc(v||'—')}</b></div>`).join('')}</div>
      <div class="official"><a href="${esc(item.url)}" target="_blank" rel="noopener">官方页面 <span>↗</span></a></div>
    </article>`;
  }

  function opportunitiesView(filter='all'){
    const calls=(data.open_calls||[]).slice().sort((a,b)=>Date.parse(a.deadline_at)-Date.parse(b.deadline_at));
    const shown=filter==='all'?calls:calls.filter(x=>x.category===filter);
    const label=filter==='all'?'全部机会':(labels[filter]||filter);
    const cards=shown.length?shown.map(renderCard).join(''):`<div class="empty">本期暂无${esc(label)}。</div>`;

    return `<section class="view opportunities-view">
      <header class="page-head">
        <div><div class="page-kicker">01 / OPPORTUNITIES</div><h1>国际机会精选 <em>Open calls.</em></h1></div>
        <p>只保留做决定最需要的信息：项目、截止日期、支持条件和官方入口。左侧分类直接切换这里的内容。</p>
      </header>
      <div class="opportunities-toolbar">
        <div class="filter-status">${esc(label)} <span>${String(shown.length).padStart(2,'0')} ITEMS</span></div>
        <button class="reset-filter ${filter!=='all'?'show':''}" type="button">显示全部机会</button>
      </div>
      <div class="cards ${filter!=='all'?'filtered':''}">${cards}</div>
    </section>`;
  }

  function focusView(){
    const items=(data.radar||[]).slice(0,2);
    return `<section class="view focus-view">
      <header class="page-head">
        <div><div class="page-kicker">02 / WEEKLY RADAR</div><h1>本周关注 <em>In focus.</em></h1></div>
        <p>这是独立的编辑页面。它不与机会列表混排，只保留本周值得继续追踪的作品、出版与研究线索。</p>
      </header>
      <div class="focus-layout">
        ${items.map((item,i)=>`<article class="${i===0?'focus-feature':'focus-secondary'}">
          <img src="${imgs[i]||imgs[0]}" alt="">
          <div class="focus-copy">
            <small>${esc(item.type||'IN FOCUS')}</small>
            <h2>${esc(item.title)}</h2>
            <p class="author">${esc(item.author||'')}</p>
            <p>${esc(item.summary||'')}</p>
            <p class="why">${esc(item.why||'')}</p>
            <a href="${esc(item.url)}" target="_blank" rel="noopener">阅读原文 ↗</a>
          </div>
        </article>`).join('')}
      </div>
    </section>`;
  }

  function widgetRows(calls,n=3){
    return calls.slice(0,n).map(item=>`<div class="w-row"><b>${esc(fmtDate(item))}</b><span>${esc(titleParts(item.title)[0]||item.title)}</span><span>T−${daysLeft(item)??'—'}</span></div>`).join('');
  }

  function widgetView(){
    const calls=(data.open_calls||[]).slice().sort((a,b)=>Date.parse(a.deadline_at)-Date.parse(b.deadline_at));
    const first=calls[0]||{};
    return `<section class="view widget-view">
      <header class="page-head">
        <div><div class="page-kicker">03 / WIDGETS</div><h1>小组件 <em>Widgets.</em></h1></div>
        <p>小组件是第三张独立页面。它只展示 iPhone / iPad / Mac 主屏幕上的轻量信息入口，并提供安装与脚本下载。</p>
      </header>

      <div class="widget-intro">
        <div class="widget-intro-copy">
          <h2>主屏幕上的 Media Art Radar</h2>
          <p>Scriptable 直接读取同一份 <code>latest.json</code>。小号只突出最近截止，中号与大号增加更多机会，超大号适合 iPad / Mac。</p>
          <div class="widget-actions">
            <a class="primary" href="../../Media-Art-Radar.js" download>下载脚本 ↓</a>
            <a href="../../install.html">完整安装说明 ↗</a>
          </div>
        </div>
        <div class="widget-status">
          <small>NEXT DEADLINE</small>
          <strong>${esc(fmtDate(first))}</strong>
          <span>${esc(titleParts(first.title)[0]||'—')} · T−${daysLeft(first)??'—'} DAYS</span>
        </div>
      </div>

      <div class="widget-grid">
        <article class="widget-card small">
          <header><b>小号</b><span>158 × 158</span></header>
          <div class="widget-screen dark">
            <div class="w-top"><span>MAR ↗</span><span>${esc(data.issue_id||'—')}</span></div>
            <div class="w-date">${esc(fmtDate(first))}</div>
            <div class="w-title">${esc(titleParts(first.title)[0]||'—')}</div>
            <div class="w-meta">最近截止 / T−${daysLeft(first)??'—'}</div>
          </div>
        </article>

        <article class="widget-card medium">
          <header><b>中号</b><span>338 × 158</span></header>
          <div class="widget-screen">
            <div class="w-top"><span>MEDIA ART RADAR</span><span>${esc(data.issue_id||'—')}</span></div>
            <div class="w-list">${widgetRows(calls,3)}</div>
            <div class="w-meta">快速扫过最近三个机会</div>
          </div>
        </article>

        <article class="widget-card large">
          <header><b>大号</b><span>338 × 354</span></header>
          <div class="widget-screen">
            <div class="w-top"><span>MEDIA ART</span><span>${String(calls.length).padStart(2,'0')} OPEN</span></div>
            <div class="w-date">${esc(fmtDate(first))}</div>
            <div class="w-title">${esc(titleParts(first.title)[0]||'—')}</div>
            <div class="w-list">${widgetRows(calls.slice(1),3)}</div>
          </div>
        </article>

        <article class="widget-card xlarge">
          <header><b>超大号</b><span>iPad / Mac</span></header>
          <div class="widget-screen dark">
            <div class="w-top"><span>RADAR / GRID</span><span>${esc(data.issue_id||'—')}</span></div>
            <div class="w-list">${widgetRows(calls,5)}</div>
            <div class="w-meta">五个机会 + 刊头信息</div>
          </div>
        </article>
      </div>
    </section>`;
  }

  function parseHash(){
    const raw=location.hash.replace(/^#/,'');
    if(!raw) return {route:'opportunities',filter:'all'};
    const [route,filter]=raw.split('/');
    if(route==='focus') return {route:'focus',filter:'all'};
    if(route==='widget') return {route:'widget',filter:'all'};
    if(route==='opportunities') return {route:'opportunities',filter:filter||'all'};
    return {route:'opportunities',filter:'all'};
  }

  function render(route,filter='all',push=false){
    if(!data) return;
    setActive(route,filter);
    if(route==='focus') $('#view').innerHTML=focusView();
    else if(route==='widget') $('#view').innerHTML=widgetView();
    else $('#view').innerHTML=opportunitiesView(filter);
    $('#stage').scrollTop=0;
    if(push){
      const hash=route==='opportunities' && filter!=='all' ? '#opportunities/'+filter : '#'+route;
      if(location.hash!==hash) history.pushState(null,'',hash);
    }
    $('.reset-filter')?.addEventListener('click',()=>render('opportunities','all',true));
  }

  fetch(DATA_URL,{cache:'no-store'})
    .then(r=>r.json())
    .then(json=>{
      data=json;
      $('#issue').textContent=data.issue_id||'—';
      $('#verified').textContent='VERIFIED '+String(data.generated_at||'').slice(0,10);
      const state=parseHash();
      render(state.route,state.filter,false);
    })
    .catch(()=>{
      $('#view').innerHTML='<div class="view"><div class="empty">数据暂时无法读取，请稍后刷新。</div></div>';
    });

  $$('.rail-nav button').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const route=btn.dataset.route||'opportunities';
      const filter=btn.dataset.filter||'all';
      render(route,filter,true);
    });
  });

  $('.wordmark')?.addEventListener('click',e=>{
    e.preventDefault();
    render('opportunities','all',true);
  });

  addEventListener('popstate',()=>{
    const state=parseHash();
    render(state.route,state.filter,false);
  });
})();
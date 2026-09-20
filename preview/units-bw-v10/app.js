(() => {
  const DATA_URL='../../latest.json';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const short=(s,n=48)=>{s=String(s||'').replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1)+'…':s};
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
  const place=item=>short(String(item.location||'').split('；')[0],30);

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
    const key=item.highlight ? item.highlight+' '+(item.highlight_label||'') : short(item.funding,44);
    return `<article class="call-card">
      <span class="card-index">${String(i+1).padStart(2,'0')}</span>
      <div class="card-meta">
        <span class="type">${esc(labels[item.category]||item.category||'OPEN CALL')}</span>
        <span>${esc(place(item))}</span>
      </div>
      <h2 class="card-title">${esc(parts[0]||item.title)}</h2>
      ${parts.length>1?`<p class="card-subtitle">${esc(parts.slice(1).join(' / '))}</p>`:''}
      <div class="deadline-block">
        <div class="deadline-date">${esc(fmtDate(item))}</div>
        <div class="deadline-copy">${d===null?'DATE TBA':d===0?'TODAY':'T−'+d+' DAYS'}</div>
      </div>
      <div class="keyline"><small>SUPPORT</small><b>${esc(key||'—')}</b></div>
      <div class="official"><a href="${esc(item.url)}" target="_blank" rel="noopener">官方页面 <span>↗</span></a></div>
    </article>`;
  }

  function opportunitiesView(filter='all'){
    const calls=(data.open_calls||[]).slice().sort((a,b)=>Date.parse(a.deadline_at)-Date.parse(b.deadline_at));
    const shown=filter==='all'?calls:calls.filter(x=>x.category===filter);
    const label=filter==='all'?'全部机会':(labels[filter]||filter);
    const cards=shown.length?shown.map(renderCard).join(''):`<div class="empty">本期暂无${esc(label)}。</div>`;
    return `<section class="view">
      <header class="page-head">
        <div>
          <div class="page-kicker">01 / OPPORTUNITIES</div>
          <h1>国际机会精选 <em>Open calls.</em></h1>
        </div>
      </header>
      <div class="opportunities-toolbar">
        <div class="filter-status">${esc(label)} <span>${String(shown.length).padStart(2,'0')}</span></div>
        <button class="reset-filter ${filter!=='all'?'show':''}" type="button">全部机会</button>
      </div>
      <div class="cards">${cards}</div>
    </section>`;
  }

  function focusView(){
    const items=(data.radar||[]).slice(0,2);
    return `<section class="view">
      <header class="page-head">
        <div>
          <div class="page-kicker">02 / WEEKLY RADAR</div>
          <h1>本周关注 <em>In focus.</em></h1>
        </div>
      </header>
      <div class="focus-layout">
        ${items.map((item,i)=>`<article class="focus-card">
          <img src="${imgs[i]||imgs[0]}" alt="">
          <div class="focus-copy">
            <small>${esc(item.type||'IN FOCUS')}</small>
            <h2>${esc(item.title)}</h2>
            <p class="author">${esc(item.author||'')}</p>
            <a href="${esc(item.url)}" target="_blank" rel="noopener">阅读原文 ↗</a>
          </div>
        </article>`).join('')}
      </div>
    </section>`;
  }

  function widgetRows(calls,n=3){
    return calls.slice(0,n).map(item=>({
      date:fmtDate(item),
      name:titleParts(item.title)[0]||item.title,
      days:daysLeft(item)
    }));
  }

  function widgetView(){
    const calls=(data.open_calls||[]).slice().sort((a,b)=>Date.parse(a.deadline_at)-Date.parse(b.deadline_at));
    const first=calls[0]||{};
    const rest=widgetRows(calls.slice(1),4);
    const med=widgetRows(calls.slice(1),3);
    const issue=(String(data.issue_id||'').match(/W\d+/i)||[String(data.issue_id||'')])[0];
    const firstCat=labels[first.category]||first.category||'OPEN CALL';
    const firstClass=first.category||'exhibition';
    const support=first.highlight ? first.highlight+' '+(first.highlight_label||'') : short(first.funding,36);

    return `<section class="view widget-view">
      <header class="page-head">
        <div>
          <div class="page-kicker">03 / WIDGETS</div>
          <h1>小组件 <em>Widgets.</em></h1>
        </div>
        <div class="widget-actions-top">
          <a class="primary" href="../../Media-Art-Radar.js" download>下载脚本 ↓</a>
          <a href="../../install.html">安装说明 ↗</a>
        </div>
      </header>

      <div class="widget-showcase">
        <figure class="widget-preview small">
          <figcaption><b>小号</b><span>158 × 158 pt · iPhone</span></figcaption>
          <div class="ios-widget ios-small dark">
            <div class="widget-inner">
              <div class="widget-top"><span>MAR ↗</span><span>${esc(issue)}</span></div>
              <div class="small-body">
                <div class="widget-date">${esc(fmtDate(first))}</div>
                <div class="widget-countdown">T−${daysLeft(first)??'—'} DAYS</div>
                <div class="widget-title">${esc(titleParts(first.title)[0]||'—')}</div>
              </div>
              <div class="small-foot">
                <span>${esc(firstCat)}</span><span>↗</span>
              </div>
            </div>
          </div>
        </figure>

        <figure class="widget-preview medium">
          <figcaption><b>中号</b><span>338 × 158 pt · iPhone</span></figcaption>
          <div class="ios-widget ios-medium">
            <div class="widget-inner">
              <div class="widget-top"><span>MEDIA ART RADAR</span><span>${esc(issue)}</span></div>
              <div class="medium-body">
                <div class="med-primary">
                  <span class="widget-cat ${esc(firstClass)}">${esc(firstCat)}</span>
                  <div class="widget-date">${esc(fmtDate(first))}</div>
                  <div class="widget-countdown">T−${daysLeft(first)??'—'} DAYS</div>
                  <div class="widget-title">${esc(titleParts(first.title)[0]||'—')}</div>
                </div>
                <div class="med-index">
                  ${med.map(x=>`<div class="med-row"><b>${esc(x.date)}</b><span class="med-name">${esc(x.name)}</span><span class="med-days">T−${x.days??'—'}</span></div>`).join('')}
                </div>
              </div>
            </div>
          </div>
        </figure>

        <figure class="widget-preview large">
          <figcaption><b>大号</b><span>338 × 354 pt · iPhone</span></figcaption>
          <div class="ios-widget ios-large">
            <div class="widget-inner">
              <div class="large-mast">
                <div class="large-brand"><strong>MEDIA ART</strong><em>Radar ↗</em></div>
                <div class="large-meta">${esc(issue)}<br>${String(calls.length).padStart(2,'0')} OPEN</div>
              </div>

              <div class="large-hero">
                <div class="large-hero-top">
                  <span class="widget-cat ${esc(firstClass)}">${esc(firstCat)}</span>
                  <span class="widget-muted">${esc(short(String(first.location||'').split('；')[0],18))}</span>
                </div>
                <div class="widget-title">${esc(first.title||'—')}</div>
                <div class="large-hero-figure">
                  <div>
                    <div class="widget-date">${esc(fmtDate(first))}</div>
                    <div class="widget-countdown">T−${daysLeft(first)??'—'} DAYS</div>
                  </div>
                  <div class="large-highlight">
                    <b>${esc(first.highlight||'—')}</b>
                    <span>${esc(first.highlight_label||'')}</span>
                  </div>
                </div>
              </div>

              <div class="large-index">
                ${rest.map(x=>`<div class="large-row"><b>${esc(x.date)}</b><span class="name">${esc(x.name)}</span><span class="days">T−${x.days??'—'}</span></div>`).join('')}
              </div>
            </div>
          </div>
        </figure>

        <figure class="widget-preview xlarge">
          <figcaption><b>超大号</b><span>≈ 700 × 340 pt · iPad / Mac</span></figcaption>
          <div class="ios-widget ios-xlarge dark">
            <div class="widget-inner">
              <div class="widget-top"><span>MEDIA ART RADAR</span><span>${esc(issue)} · ${String(calls.length).padStart(2,'0')} OPEN</span></div>
              <div class="xl-layout">
                <div class="xl-feature">
                  <span class="widget-cat ${esc(firstClass)}">${esc(firstCat)}</span>
                  <div class="widget-title">${esc(first.title||'—')}</div>
                  <div class="widget-date">${esc(fmtDate(first))}</div>
                  <div class="widget-countdown">T−${daysLeft(first)??'—'} DAYS</div>
                  <div class="support">${esc(support||'')}</div>
                </div>
                <div class="xl-grid">
                  ${rest.map(x=>`<div class="xl-cell"><div class="cell-top"><span>OPEN CALL</span><span>↗</span></div><b>${esc(x.date)}</b><strong>${esc(x.name)}</strong><span>T−${x.days??'—'} DAYS</span></div>`).join('')}
                </div>
              </div>
            </div>
          </div>
        </figure>
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
      const hash=route==='opportunities'&&filter!=='all'?'#opportunities/'+filter:'#'+route;
      if(location.hash!==hash) history.pushState(null,'',hash);
    }
    $('.reset-filter')?.addEventListener('click',()=>render('opportunities','all',true));
  }

  fetch(DATA_URL,{cache:'no-store'})
    .then(r=>r.json())
    .then(json=>{
      data=json;
      const state=parseHash();
      render(state.route,state.filter,false);
    })
    .catch(()=>{
      $('#view').innerHTML='<div class="view"><div class="empty">数据暂时无法读取，请稍后刷新。</div></div>';
    });

  $$('.rail-nav button').forEach(btn=>{
    btn.addEventListener('click',()=>{
      render(btn.dataset.route||'opportunities',btn.dataset.filter||'all',true);
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
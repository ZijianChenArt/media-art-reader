(() => {
  const DATA_URL='../../latest.json';
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const short=(s,n=52)=>{s=String(s||'').replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1)+'…':s};
  const fmtDate=item=>{
    const d=item.deadline_date || (item.deadline_at||'').slice(0,10);
    if(!d) return '—';
    const [y,m,day]=d.split('-'); return m+'.'+day;
  };
  const daysLeft=item=>{
    const t=Date.parse(item.deadline_at||item.deadline_date);
    if(!Number.isFinite(t)) return null;
    return Math.max(0,Math.ceil((t-Date.now())/86400000));
  };
  const label={exhibition:'展览征集',residency:'驻留',prize:'奖项',conference:'学术会议'};
  const imgFor=i=>i===0?'../../assets/diatomic-garden.jpg':'../../assets/conspiratorial-design.jpg';

  fetch(DATA_URL,{cache:'no-store'}).then(r=>r.json()).then(data=>{
    $('#issue').textContent=data.issue_id||'—';
    $('#footer-issue').textContent='ISSUE '+(data.issue_id||'—');
    $('#verified').textContent='VERIFIED '+String(data.generated_at||'').slice(0,10);
    $('#call-count').textContent=String((data.open_calls||[]).length).padStart(2,'0');
    $('#focus-count').textContent=String((data.radar||[]).length).padStart(2,'0');

    const allCalls=(data.open_calls||[]).slice().sort((a,b)=>Date.parse(a.deadline_at)-Date.parse(b.deadline_at));
    const callsGrid=$('#calls-grid');
    const callsSection=$('#calls');
    const filterLabels={exhibition:'展览征集',residency:'驻留',prize:'奖项',conference:'学术会议'};
    let activeFilter='all';

    const renderCalls=(filter='all')=>{
      activeFilter=filter;
      const calls=filter==='all'?allCalls:allCalls.filter(item=>item.category===filter);
      callsSection.dataset.filter=filter;
      callsSection.dataset.filterLabel=filter==='all'?'全部机会':(filterLabels[filter]||filter);
      callsGrid.classList.toggle('is-filtered',filter!=='all');

      if(!calls.length){
        callsGrid.innerHTML='<div class="empty-state">本期暂无'+esc(filterLabels[filter]||'此类')+'机会。</div>';
        return;
      }

      callsGrid.innerHTML=calls.map((item,i)=>{
        const title=String(item.title||'').split('/').map(x=>x.trim());
        const d=daysLeft(item);
        const facts=[
          ['SUPPORT',item.highlight?item.highlight+' '+(item.highlight_label||''):short(item.funding,34)],
          ['TRAVEL',short(item.travel||item.accommodation,34)],
          ['FEE',short(item.application_fee,22)]
        ];
        return `<article class="call-card">
          <span class="idx">0${i+1}</span>
          <div class="call-top"><span class="type">${esc(label[item.category]||item.category||'OPEN CALL')}</span><span>${esc(short(item.location,28))}</span><span>项目 ${esc(item.project_when||'—')}</span></div>
          <h3 class="call-title">${esc(title[0]||item.title)}</h3>
          ${title.length>1?`<p class="call-sub">${esc(title.slice(1).join(' / '))}</p>`:''}
          <div class="deadline-row"><div class="deadline">${esc(fmtDate(item))}</div><div class="tminus">${d===null?'DATE TBA':d===0?'TODAY':'T−'+d+' DAYS'}<br><small>申请截止</small></div></div>
          <div class="facts">${facts.map(f=>`<div class="fact"><small>${f[0]}</small><b>${esc(f[1]||'—')}</b></div>`).join('')}</div>
          <div class="card-actions"><a class="official" href="${esc(item.url)}" target="_blank" rel="noopener">官方页面 <span>↗</span></a></div>
        </article>`;
      }).join('');
    };

    renderCalls('all');

    const railLinks=[...document.querySelectorAll('.rail-nav a')];
    const filterLinks=railLinks.filter(a=>a.dataset.filter);
    const focusLink=document.querySelector('.rail-nav .nav-focus');
    const main=document.querySelector('.main');

    const setActive=el=>{
      railLinks.forEach(a=>a.classList.toggle('is-active',a===el));
    };

    filterLinks.forEach(link=>{
      link.addEventListener('click',e=>{
        e.preventDefault();
        renderCalls(link.dataset.filter);
        setActive(link);
        document.getElementById('calls').scrollIntoView({behavior:'smooth',block:'start'});
      });
    });

    if(focusLink){
      focusLink.addEventListener('click',()=>setActive(focusLink));
    }

    document.querySelector('.logo')?.addEventListener('click',e=>{
      e.preventDefault();
      renderCalls('all');
      railLinks.forEach(a=>a.classList.remove('is-active'));
      document.getElementById('top').scrollIntoView({behavior:'smooth',block:'start'});
    });

    if(main){
      const focus=document.getElementById('focus');
      const calls=document.getElementById('calls');
      const io=new IntersectionObserver(entries=>{
        const focusEntry=entries.find(e=>e.target===focus);
        if(focusEntry?.isIntersecting && focusEntry.intersectionRatio>.25){
          setActive(focusLink);
          return;
        }
        const callsEntry=entries.find(e=>e.target===calls);
        if(callsEntry?.isIntersecting && activeFilter!=='all'){
          const active=filterLinks.find(a=>a.dataset.filter===activeFilter);
          if(active) setActive(active);
        }
      },{root:main,threshold:[.15,.25,.4]});
      [calls,focus].filter(Boolean).forEach(s=>io.observe(s));
    }

    $('#focus-grid').innerHTML=(data.radar||[]).slice(0,2).map((item,i)=>`
      <article class="focus-card">
        <img src="${imgFor(i)}" alt="">
        <div class="focus-copy">
          <small>${esc(item.type||'IN FOCUS')}</small>
          <h3>${esc(item.title)}</h3>
          <p>${esc(short(item.summary,150))}</p>
          <a href="${esc(item.url)}" target="_blank" rel="noopener">阅读原文 ↗</a>
        </div>
      </article>
    `).join('');
  }).catch(()=>{
    $('#calls-grid').innerHTML='<p>数据暂时无法读取，请稍后刷新。</p>';
  });
})();

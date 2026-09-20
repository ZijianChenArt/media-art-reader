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

    const calls=(data.open_calls||[]).slice().sort((a,b)=>Date.parse(a.deadline_at)-Date.parse(b.deadline_at));
    $('#calls-grid').innerHTML=calls.map((item,i)=>{
      const title=String(item.title||'').split('/').map(x=>x.trim());
      const d=daysLeft(item);
      const facts=[
        ['SUPPORT',item.highlight?item.highlight+' '+(item.highlight_label||''):short(item.funding,34)],
        ['TRAVEL',short(item.travel||item.accommodation,34)],
        ['FEE',short(item.application_fee,22)],
        ['FIT',short(item.fit,38)]
      ];
      return `<article class="call-card">
        <span class="idx">0${i+1}</span>
        <div class="call-top"><span class="type">${esc(label[item.category]||item.category||'OPEN CALL')}</span><span>${esc(short(item.location,28))}</span><span>项目 ${esc(item.project_when||'—')}</span></div>
        <h3 class="call-title">${esc(title[0]||item.title)}</h3>
        ${title.length>1?`<p class="call-sub">${esc(title.slice(1).join(' / '))}</p>`:''}
        <div class="deadline-row"><div class="deadline">${esc(fmtDate(item))}</div><div class="tminus">${d===null?'DATE TBA':d===0?'TODAY':'T−'+d+' DAYS'}<br><small>申请截止</small></div></div>
        <div class="facts">${facts.map(f=>`<div class="fact"><small>${f[0]}</small><b>${esc(f[1]||'—')}</b></div>`).join('')}</div>
        <div class="card-actions"><a class="official" href="${esc(item.url)}" target="_blank" rel="noopener">官方页面 <span>↗</span></a><a class="details" href="${esc(item.url)}" target="_blank" rel="noopener">详情</a></div>
      </article>`;
    }).join('');

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
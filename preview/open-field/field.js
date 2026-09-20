/* OPEN FIELD. Read-only JSON consumer. Dragging is local to this tab. */
(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const stage = $('#field-stage'), shell = $('#field-shell'), section = $('#field');
  const items = $('#items'), dialog = $('#details');
  const DAY = 86400000, WIDTH = 1320;
  let calls = [], payload = null, scale = 1, mode = 'free', depth = 3;
  let records = [], fieldHeight = 2200, invoker = null, resizeFrame = 0;
  const places = {
    'ctm-resynthesising-traditional-2027': 'Berlin, DE',
    'technarte-bilbao-2027': 'Bilbao, ES',
    'emap-residencies-2027': 'Europe / 15 hosts',
    'wave-farm-research-production-2027': 'New York, US',
    'emaf-40-2027': 'Osnabrück, DE'
  };
  // Editorial summaries of the existing source fields; unknown fees stay unknown.
  const summaries = {
    'ctm-resynthesising-traditional-2027': ['餐食、通票、必要签证费；现金补贴未公布', '交通最高 €300；提供住宿', '官方未说明'],
    'technarte-bilbao-2027': ['演讲费、制作资助未明确', '交通、住宿支持未明确', '官方未明确'],
    'emap-residencies-2027': ['主申请人 €4,000；另有制作预算 €4,000', '交通按上限承担；提供住宿', '未说明，不推定免费'],
    'wave-farm-research-production-2027': ['驻留 $1,000；Fellowship $2,000', '长途交通自理；提供住宿', '官方未说明'],
    'emaf-40-2027': ['装置酬金 €500；制作预算须协商', '交通补助；3 晚酒店', '免费']
  };
  const categories = {exhibition:'展览征集',residency:'驻留',prize:'奖项',conference:'学术会议'};
  const layouts = [
    {x:70,y:70,w:405,tilt:-2.5},
    {x:850,y:195,w:420,tilt:2.2},
    {x:430,y:710,w:465,tilt:-1.2},
    {x:100,y:1260,w:440,tilt:2.5},
    {x:820,y:1610,w:430,tilt:-2.2}
  ];
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function safeURL(value) {
    try { const u = new URL(String(value), location.href); return /^https?:$/.test(u.protocol) ? u.href : ''; }
    catch (_) { return ''; }
  }
  function dateParts(item) {
    const str = item.deadline_date || item.deadline_at || '';
    const match = String(str).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? {year:match[1], date:match[2]+'.'+match[3]} : {year:'',date:'待定'};
  }
  function updatedText(value) { return String(value || '').slice(0,10).replaceAll('-','.'); }
  function deadlineState(item) {
    const remaining = Date.parse(item.deadline_at) - Date.now();
    if (!Number.isFinite(remaining)) return {label:'截止待确认',state:''};
    if (remaining <= 0) return {label:item.deadline_precision === 'date' ? '截止日已到 · 查官网' : '已过截止时间',state:'closed'};
    const days = Math.ceil(remaining / DAY);
    return {label:'T−' + String(days).padStart(2,'0') + ' DAYS',state:days <= 14 ? 'soon' : ''};
  }
  function announce(message) { $('#announcer').textContent = message; }
  function external(url, cls, title) {
    const a = el('a',cls); a.href = safeURL(url) || '../../index.html';
    a.target = '_blank'; a.rel = 'noopener noreferrer';
    if (title) a.setAttribute('aria-label', title + '（新标签页）');
    return a;
  }
  function official(item) {
    const a = external(item.url,'official','打开 '+item.title+' 的官方页面');
    const text = el('span',null,'官方页面'); text.append(el('span','official-en','Official'));
    a.append(text,el('span','arrow','↗')); a.lastChild.setAttribute('aria-hidden','true');
    return a;
  }
  function handle(label, number) {
    const b = el('button','drag-handle'); b.type='button';
    b.append(el('span','call-no',number),el('span','call-kind',label),el('span','handle-glyph','⠿'));
    b.setAttribute('aria-label','移动 '+label+' '+number);
    b.setAttribute('aria-describedby','drag-help');
    return b;
  }
  function fact(list, label, value) {
    if (!value) return;
    const r = el('div'); r.append(el('dt',null,label),el('dd',null,value)); list.append(r);
  }
  function makeCall(item, index) {
    const card = el('article','field-item call call-'+(index+1));
    const titleID = 'title-' + index;
    card.id='opportunity-'+index; card.setAttribute('aria-labelledby',titleID);
    card.append(handle(categories[item.category] || '艺术机会',String(index+1).padStart(2,'0')));
    const loc = el('p','call-location'); loc.append(el('span',null,places[item.id] || item.location || '地点待确认'),el('span',null,item.project_when ? '项目 '+item.project_when : '项目时间见详情'));
    const parts = String(item.title || 'Untitled').split(/\s\/\s/);
    const h = el('h3',null,parts[0]); h.id=titleID;
    if (parts.length > 1) h.append(el('span','call-sub',parts.slice(1).join(' / ')));
    const core = el('div','card-core'), d=el('div','deadline'), dp=dateParts(item);
    d.append(el('span','date',dp.date),el('span','countdown',''),el('span','deadline-label','申请截止'+(dp.year ? ' / '+dp.year : '')));
    const facts = el('dl','quick-facts');
    const factsData = (payload.generated_at==='2026-09-17T12:39:29+08:00' ? summaries[item.id] : null) || [item.funding || '支持待确认',[item.travel,item.accommodation].filter(Boolean).join('；'),item.application_fee || '未说明'];
    fact(facts,'支持',factsData[0]); fact(facts,'交通 / 住宿',factsData[1]); fact(facts,'申请费',factsData[2]);
    core.append(d,facts);
    const foot=el('div','call-foot'), details=el('button','details-button','项目详情 +');
    details.type='button'; details.setAttribute('aria-haspopup','dialog');
    details.addEventListener('click',()=>openDetails(item,details));
    foot.append(official(item),details);
    let fine='';
    if (item.deadline_precision==='date') fine='仅公布日期，具体时刻及提前关闭条件见详情。';
    if (item.id==='emap-residencies-2027') fine='注意：居住／纳税地与合作项目资格限制。';
    if (item.id==='wave-farm-research-production-2027') fine='注意：全日制学生通常不符合。';
    if (item.id==='technarte-bilbao-2027') fine='演讲发表机会，不是作品制作委约。';
    card.append(loc,h,core,foot);
    if (fine) card.append(el('p','call-fine',fine));
    card._item=item;
    return card;
  }
  function makeArt(item,index) {
    const figure=el('article','field-item art-item art-'+(index+1));
    figure.id='reference-'+index;
    figure.append(handle(index===0?'IN FOCUS / 作品':'READING / 阅读','R'+(index+1)));
    const imgLink=external(item.url,'art-image','阅读 '+item.title);
    const artImages={'entangled-others-diatomic-garden-neural-20260914':'../../assets/diatomic-garden.jpg','bramanti-conspiratorial-design-neural-20260911':'../../assets/conspiratorial-design.jpg'};
    const img=el('img');const imageURL=artImages[item.id];if(imageURL)img.src=imageURL;
    img.alt=item.title+'，图像来源 Neural';img.width=600;img.height=index===0?917:956;img.loading='lazy';
    if(imageURL)imgLink.append(img);else{imgLink.append(el('span','art-placeholder','Read the work ↗'));}
    const cap=el('div','art-caption'), h=el('h3',null,index===1?'Conspiratorial Design':item.title);cap.append(h,el('span',null,'↗'));
    const by=el('p','art-by',item.author || '');
    const context=el('p','art-context',index===0?'生成艺术 / 生态与技术史':'理论出版物 / 信息设计');
    const link=external(item.url,'art-reading','阅读 '+item.title+' 原文');link.textContent='阅读原文 · Neural ↗';
    figure.append(imgLink,cap,by,context,link);
    return figure;
  }
  function addRecord(node,layout) {
    const r={node,...layout,home:{...layout}};
    node.style.width=r.w+'px';node.style.setProperty('--tilt',r.tilt+'deg');
    position(r);items.append(node);records.push(r);enableDrag(r);
  }
  function position(r){r.node.style.left=r.x+'px';r.node.style.top=r.y+'px';}
  function resizeField() {
    if (mode==='index') {shell.style.height='auto';stage.style.transform='none';return;}
    scale=shell.clientWidth/WIDTH;
    stage.style.transform='scale('+scale+')';
    fieldHeight=Math.max(2200,...records.map(r=>r.y+r.node.offsetHeight+100));
    stage.style.height=fieldHeight+'px';shell.style.height=(fieldHeight*scale)+'px';
  }
  function queueResize(){cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(resizeField);}
  function enableDrag(r) {
    const h=$('.drag-handle',r.node);let start=null;
    h.addEventListener('pointerdown',e=>{
      if (mode!=='free'||e.button!==0)return;
      start={x:e.clientX,y:e.clientY,rx:r.x,ry:r.y};h.setPointerCapture(e.pointerId);
      r.node.style.zIndex=String(++depth);r.node.classList.add('dragging');
    });
    h.addEventListener('pointermove',e=>{
      if(!start)return;
      r.x=Math.max(14,Math.min(WIDTH-r.w-14,start.rx+(e.clientX-start.x)/scale));
      r.y=Math.max(14,Math.min(fieldHeight-r.node.offsetHeight-40,start.ry+(e.clientY-start.y)/scale));
      position(r);
    });
    const end=()=>{if(!start)return;start=null;r.node.classList.remove('dragging');};
    h.addEventListener('pointerup',end);h.addEventListener('pointercancel',end);h.addEventListener('lostpointercapture',end);
    h.addEventListener('keydown',e=>{
      if(mode!=='free'||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
      e.preventDefault();const step=e.shiftKey?40:10;
      r.x=Math.max(14,Math.min(WIDTH-r.w-14,r.x+({ArrowLeft:-step,ArrowRight:step}[e.key]||0)));
      r.y=Math.max(14,Math.min(fieldHeight-r.node.offsetHeight-40,r.y+({ArrowUp:-step,ArrowDown:step}[e.key]||0)));
      r.node.style.zIndex=String(++depth);position(r);
    });
  }
  function updateDates(){records.forEach(r=>{if(!r.node._item)return;const s=deadlineState(r.node._item);r.node.classList.toggle('soon',s.state==='soon');r.node.classList.toggle('closed',s.state==='closed');$('.countdown',r.node).textContent=s.label;});}
  function setMode(next) {
    mode=next;section.classList.toggle('index-mode',mode==='index');
    $('#free-view').classList.toggle('active',mode==='free');$('#free-view').setAttribute('aria-pressed',String(mode==='free'));
    $('#index-view').classList.toggle('active',mode==='index');$('#index-view').setAttribute('aria-pressed',String(mode==='index'));
    $('#reset').disabled=mode==='index';
    $('#interaction-note').textContent=mode==='free'?'拖动纸张的抬头，重新组织你的视野。 DRAG TO REARRANGE ↗':'按截止日期从近到远排列；完整申请条件在「项目详情」。';
    records.forEach(r=>{const h=$('.drag-handle',r.node);h.tabIndex=mode==='free'?0:-1;});
    resizeField();announce(mode==='free'?'已切换为自由编排':'已按截止日期排列 '+calls.length+' 个机会');
  }
  $('#free-view').addEventListener('click',()=>setMode('free'));
  $('#index-view').addEventListener('click',()=>setMode('index'));
  $('#reset').addEventListener('click',()=>{records.forEach(r=>{Object.assign(r,r.home);position(r);r.node.style.zIndex='';});depth=3;queueResize();announce('已恢复初始编排。');});
  $('#focus-jump').addEventListener('click',()=>{if(mode==='index')setMode('free');const work=$('#reference-0');if(work){work.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});$('.drag-handle',work).focus({preventScroll:true});}else $('#field').scrollIntoView();});
  function openDetails(item,button) {
    const c=$('#detail-content');c.replaceChildren();invoker=button;
    c.append(el('p','detail-category',(categories[item.category]||'艺术机会')+' / '+(item.location||'')));
    const h=el('h2',null,item.title);h.id='detail-title';c.append(h,el('p','detail-date',dateParts(item).date));
    c.append(el('p','detail-deadline-note',item.deadline_display||'截止时间请查看官方页面。'),official(item));
    const list=el('dl','detail-data');
    [['项目时间','program_dates'],['资助与支持','funding'],['交通','travel'],['住宿','accommodation'],['申请费','application_fee'],['资格限制','eligibility'],['适合方向','fit'],['编辑推荐理由','why'],['截止时间说明','deadline_cutoff_note']].forEach(([label,key])=>fact(list,label,item[key]));
    c.append(list,el('p','detail-verified','内容核验于 '+updatedText(item.verified_at||payload.generated_at)+' · 当前界面未重新核验这些信息。'));
    if(Array.isArray(item.sources)){const links=el('div','detail-sources');item.sources.forEach((url,i)=>{if(!safeURL(url))return;const a=external(url,null,'查看参考来源 '+(i+1));a.textContent='参考来源 '+(i+1)+' ↗';links.append(a);});c.append(links);}
    if(!dialog.open)dialog.showModal();dialog.scrollTop=0;document.body.style.overflow='hidden';$('#close-detail').focus();
  }
  $('#close-detail').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  dialog.addEventListener('close',()=>{document.body.style.overflow='';if(invoker)invoker.focus({preventScroll:true});});
  async function load() {
    $('#error').hidden=true;$('#data-note').textContent='正在读取本站资讯…';
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
    try {
      const response=await fetch('../../latest.json',{signal:controller.signal,cache:'no-cache'});
      if(!response.ok)throw new Error('HTTP '+response.status);
      const data=await response.json();
      if(!data||!Array.isArray(data.open_calls))throw new Error('Missing open_calls');
      shell.hidden=false;payload=data;calls=data.open_calls.filter(x=>x&&typeof x.title==='string').slice().sort((a,b)=>(Date.parse(a.deadline_at)||Infinity)-(Date.parse(b.deadline_at)||Infinity));
      items.replaceChildren();records=[];
      calls.forEach((item,i)=>addRecord(makeCall(item,i),layouts[i]||{x:70+(i%2)*660,y:2150+Math.floor((i-5)/2)*570,w:440,tilt:i%2?2:-2}));
      const art=(Array.isArray(data.radar)?data.radar:[]).filter(x=>x&&typeof x.url==='string').slice(0,2);
      art.forEach((item,i)=>addRecord(makeArt(item,i),i===0?{x:537,y:70,w:238,tilt:5}:{x:959,y:1000,w:295,tilt:-4}));
      $('#call-count').textContent=String(calls.length).padStart(2,'0');$('#nav-count').textContent=String(calls.length).padStart(2,'0');$('#work-count').textContent=String(art.length).padStart(2,'0');
      $('#data-note').textContent='ISSUE '+(data.issue_id||'—')+' / 核验 '+updatedText(data.generated_at)+(Date.now()-Date.parse(data.generated_at)>8*DAY?' · 内容已超过 8 天，请复核官网':' · 资讯沿用原站');
      if(!calls.length)$('#data-note').textContent+=' · 暂无机会条目';
      updateDates();resizeField();
      document.fonts.ready.then(queueResize);
      items.querySelectorAll('img').forEach(img=>{img.addEventListener('load',queueResize);img.addEventListener('error',()=>{img.style.display='none';queueResize();});});
      announce('已载入 '+calls.length+' 个机会和 '+art.length+' 个阅读线索。');
    } catch(err) {
      shell.hidden=true;$('#error').hidden=false;$('#data-note').textContent='数据暂未加载 · 可重试或返回原网站';
      announce('暂时无法读取本站资讯。');
      console.warn('Open Field data:',err.message);
    } finally {clearTimeout(timer);}
  }
  $('#retry').addEventListener('click',load);
  window.addEventListener('resize',queueResize);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){updateDates();queueResize();}});
  setInterval(()=>{if(!document.hidden)updateDates();},60000);
  load();

  // Original procedural line sculpture: not a live data visualization.
  const canvas=$('#sculpture-canvas'), motion=$('#motion');
  const ctx=canvas.getContext('2d');
  if(!ctx){motion.hidden=true;return;}
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let paused=reduced.matches,visible=true,frame=0,last=0,phase=0,angle=0,targetAngle=0,cw=0,ch=0,dpr=1;
  function canvasSize(){const box=canvas.getBoundingClientRect();cw=box.width;ch=box.height;dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(cw*dpr);canvas.height=Math.round(ch*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);draw();}
  function project(u,v,time){
    const warp=.05*Math.sin(u*3+time);
    const radius=1.46+(.58+warp)*Math.cos(v);
    let x=radius*Math.cos(u),y=(.58+warp)*Math.sin(v),z=radius*Math.sin(u);
    const a=.98+angle,b=.22+.10*Math.sin(time*.4);
    const yy=y*Math.cos(a)-z*Math.sin(a),zz=y*Math.sin(a)+z*Math.cos(a);
    const xx=x*Math.cos(b)+zz*Math.sin(b),depth=-x*Math.sin(b)+zz*Math.cos(b);
    const perspective=5.7/(5.7-depth);
    const size=Math.min(cw*.205,ch*.218);
    return {x:cw*.50+xx*size*perspective,y:ch*.49+yy*size*perspective,z:depth};
  }
  function draw(){
    if(!cw||!ch)return;ctx.clearRect(0,0,cw,ch);
    const lines=[];
    for(let k=0;k<62;k++){
      const v=k/62*Math.PI*2,pts=[];let z=0;
      for(let j=0;j<=160;j++){const p=project(j/160*Math.PI*2,v,phase);pts.push(p);z+=p.z;}
      lines.push({pts,z:z/pts.length,alpha:.25,width:.55});
    }
    for(let k=0;k<28;k++){
      const u=k/28*Math.PI*2,pts=[];let z=0;
      for(let j=0;j<=72;j++){const p=project(u,j/72*Math.PI*2,phase);pts.push(p);z+=p.z;}
      lines.push({pts,z:z/pts.length,alpha:.10,width:.50});
    }
    lines.sort((a,b)=>a.z-b.z);
    for(const l of lines){ctx.beginPath();l.pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle='rgba(33,43,47,'+(l.alpha+Math.max(0,l.z)*.07)+')';ctx.lineWidth=l.width;ctx.stroke();}
  }
  function tick(now){frame=0;if(paused||!visible||document.hidden)return;if(now-last>45){phase+=.009;angle+=(targetAngle-angle)*.035;draw();last=now;}frame=requestAnimationFrame(tick);}
  function start(){if(!frame&&!paused&&visible&&!document.hidden)frame=requestAnimationFrame(tick);}
  function syncMotion(){motion.textContent=paused?'开启动态 ▷':'暂停动态 Ⅱ';motion.setAttribute('aria-pressed',String(paused));if(paused){cancelAnimationFrame(frame);frame=0;draw();}else start();}
  motion.addEventListener('click',()=>{paused=!paused;syncMotion();});
  canvas.addEventListener('pointermove',e=>{if(paused)return;const r=canvas.getBoundingClientRect();targetAngle=((e.clientX-r.left)/r.width-.5)*.2;});
  canvas.addEventListener('pointerleave',()=>{targetAngle=0;});
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(!visible){cancelAnimationFrame(frame);frame=0;}else start();});observer.observe(canvas);
  reduced.addEventListener('change',()=>{paused=reduced.matches;syncMotion();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else start();});
  window.addEventListener('resize',canvasSize);canvasSize();syncMotion();
})();

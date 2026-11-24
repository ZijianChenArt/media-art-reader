(() => {
 'use strict';
 window.ArtworkExport={create({scope,getState,prepare,validate,setLocked}){
  const root=document.getElementById('artwork-export'),trigger=document.getElementById('export-selected'),panel=document.getElementById('export-options'),status=document.getElementById('export-status'),cancel=document.getElementById('cancel-export');
  if(!root)return null;
  let running=false,controller=null,alive=true;
  const listen=(target,type,fn)=>{target.addEventListener(type,fn);scope?.onCleanup(()=>target.removeEventListener(type,fn));};
  const message=(value,tone='neutral')=>{if(!alive)return;status.textContent=value;status.dataset.tone=tone;};
  function close(focus=false){panel.hidden=true;trigger.setAttribute('aria-expanded','false');if(focus)trigger.focus();}
  function refresh(){const s=getState();trigger.disabled=running||!s.loaded||s.anonymous||s.loading||s.busy||!s.count;trigger.title=s.anonymous?'登录后可导出自己的精选作品':s.loading||!s.loaded?'读取筛选状态后可导出':s.busy?'请等待筛选保存完成':!s.count?'先将作品设为精选，再导出':'导出账号内全部精选作品，不受当前搜索和分类限制';trigger.setAttribute('aria-label',s.count?'导出精选，共 '+s.count+' 件作品':'导出精选');if(trigger.disabled)close();}
  const download=(bytes,type,name)=>{const url=URL.createObjectURL(new Blob([bytes],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);};
  const current=()=>{if(!alive||controller?.signal.aborted)throw new DOMException('已取消导出','AbortError');};
  async function imageBytes(work,signal){
   if(!work.imageURL || work.imageStatus==='unverified')return null;
   const url=new URL(work.imageURL,location.href);if(url.origin!==location.origin||!url.pathname.startsWith('/assets/optimized/'))return null;
   const response=await fetch(url,{signal,credentials:'same-origin'});if(!response.ok)throw new Error('图片读取失败');
   const blob=await response.blob(),object=URL.createObjectURL(blob),image=new Image();
   try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{image.src='';reject(new Error('图片读取超时'))},15000);const abort=()=>{clearTimeout(timer);image.src='';reject(new DOMException('已取消导出','AbortError'))};signal.addEventListener('abort',abort,{once:true});image.onload=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);resolve()};image.onerror=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);reject(new Error('图片读取失败'))};image.src=object;});current();const scale=Math.min(1,1400/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);const result=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.87));if(!result)throw new Error('图片转换失败');return new Uint8Array(await result.arrayBuffer());}finally{URL.revokeObjectURL(object);}
  }
  async function run(format){
   const s=getState();if(running||!alive||!s.loaded||s.anonymous||s.loading||s.busy||!s.count)return;
   close();running=true;controller=new AbortController();cancel.hidden=false;setLocked(true);refresh();message('正在读取最新精选…');
   try{
    const snapshot=await prepare(controller.signal);current();if(!snapshot.records.length){message('还没有精选作品。请先选择作品再导出。');return;}
    const module=await import('/selected-pdf.mjs?v=19e84afa1aa0');current();const date=new Date();let bytes,type,detail='';
    if(format==='csv'){bytes=module.createCSV(snapshot.records);type='text/csv;charset=utf-8';}
    else{message('正在准备 PDF 字体与图片…');const [pdfLib,fontkit,fontResponse]=await Promise.all([import('/export-assets/pdf-lib.mjs?v=ceaad70f8d35'),import('/export-assets/fontkit.mjs?v=aa84fe556fd5'),fetch('/export-assets/archive-export-font.ttf?v=19e84afa1aa0',{signal:controller.signal,credentials:'same-origin'})]);if(!fontResponse.ok)throw new Error('PDF 字体读取失败，请重试。');current();const result=await module.createSelectedPDF(snapshot.records,{pdfLib,fontkit:fontkit.default,fontBytes:await fontResponse.arrayBuffer(),loadImage:imageBytes,signal:controller.signal,date,onProgress:(done,total)=>message('正在生成 PDF：'+done+' / '+total+' 件')});bytes=result.bytes;type='application/pdf';if(result.missingImages)detail='；'+result.missingImages+' 张图片未能读取，已保留来源链接';}
    current();message('正在确认精选状态…');await validate(snapshot.key,controller.signal);current();download(bytes,type,module.fileName(format,date));message('已生成 '+snapshot.records.length+' 件精选作品的 '+format.toUpperCase()+'，请查看浏览器下载'+detail+'。');
   }catch(error){if(error.name==='AbortError')message('已取消导出。');else message(error.message||'导出失败，请重试。','error');}
   finally{running=false;controller=null;if(alive){cancel.hidden=true;setLocked(false);refresh();}}
  }
  listen(trigger,'click',()=>{if(trigger.disabled)return;const open=panel.hidden;panel.hidden=!open;trigger.setAttribute('aria-expanded',String(open));if(open)panel.querySelector('button').focus();});
  panel.querySelectorAll('[data-export-format]').forEach(button=>listen(button,'click',()=>run(button.dataset.exportFormat)));
  listen(document,'click',event=>{if(!root.contains(event.target))close()});
  listen(root,'focusout',event=>{if(event.relatedTarget&&!root.contains(event.relatedTarget))close()});
  listen(document,'keydown',event=>{if(event.key==='Escape'&&!panel.hidden){event.preventDefault();close(true)}});
  listen(cancel,'click',()=>controller?.abort());
  scope?.onCleanup(()=>{alive=false;controller?.abort();close();});
  refresh();return {refresh,run};
 }};
})();

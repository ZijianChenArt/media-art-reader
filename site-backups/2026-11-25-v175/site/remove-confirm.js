(() => {
const pageScope = window.MediaArtPage?.current;
const listen = (target, ...args) => { target?.addEventListener?.(...args); pageScope?.onCleanup(() => target?.removeEventListener?.(...args)); };
// Confirmation is read-only. Only an explicit confirm invokes the supplied action.
(() => {
 const dialog=document.createElement('dialog');
 dialog.className='remove-confirm';
 dialog.setAttribute('aria-labelledby','remove-confirm-title');
 dialog.setAttribute('aria-describedby','remove-confirm-description');
 dialog.setAttribute('aria-modal','true');
 dialog.innerHTML='<h2 id="remove-confirm-title">从本站移除作品？</h2><p id="remove-confirm-description"></p><div class="remove-confirm-actions"><button type="button" data-remove-cancel autofocus>取消</button><button type="button" data-remove-confirm>从本站移除</button></div>';
 document.body.appendChild(dialog);
 const description=dialog.querySelector('p'),cancel=dialog.querySelector('[data-remove-cancel]'),confirm=dialog.querySelector('[data-remove-confirm]');
 let pending=null;
 function finish(accepted=false){
  if(!pending)return;
  const action=pending;pending=null;
  if(dialog.open)dialog.close();
  if(action.trigger?.isConnected)action.trigger.focus({preventScroll:true});
  if(accepted)action.onConfirm();
 }
 cancel.addEventListener('click',()=>finish(false));
 confirm.addEventListener('click',()=>finish(true));
 dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});
 dialog.addEventListener('close',()=>{if(!dialog.open)finish(false);});
 listen(window, 'pagehide',()=>finish(false));
 pageScope?.onCleanup(()=>{finish(false);dialog.remove();delete window.confirmArtworkRemoval;});
 window.confirmArtworkRemoval=({title,trigger,onConfirm})=>{
  if(pending)return;
  if(typeof dialog.showModal!=='function'){
   if(typeof window.confirm==='function'&&window.confirm('确认将《'+title+'》从本站下架？所有访客都将看不到这件作品。保留私密可恢复备份及操作记录，七天后复核，不会自动清理。'))onConfirm();
   return;
  }
  pending={trigger,onConfirm};
  description.textContent='将《'+title+'》从本站下架，所有访客都将看不到这件作品。保留私密可恢复备份及操作记录，七天后复核，不会自动清理。';
  try{dialog.showModal();cancel.focus({preventScroll:true});}
  catch{finish(false);}
 };
})();

})();

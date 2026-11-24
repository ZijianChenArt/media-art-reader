(() => {
 'use strict';
 const scope=window.MediaArtPage?.current;
 const menu=document.getElementById('account-menu'),trigger=document.getElementById('account-menu-trigger'),panel=document.getElementById('account-menu-panel');
 if(!menu||!trigger||!panel)return;
 const signin=menu.querySelector('.account-signin'),status=document.getElementById('account-status-trigger'),signout=panel.querySelector('.account-signout');
 const listen=(target,type,fn,options)=>{target?.addEventListener(type,fn,options);scope?.onCleanup(()=>target?.removeEventListener(type,fn,options));};
 const items=()=>[...panel.querySelectorAll('[role="menuitem"]')].filter(node=>!node.hidden&&!node.disabled);
 const focus=node=>node?.isConnected&&node.focus({preventScroll:true});
 let unresolvedState='loading';
 function close(restore=false){panel.hidden=true;trigger.setAttribute('aria-expanded','false');if(restore&&!trigger.hidden)focus(trigger);}
 function open(last=false){if(trigger.hidden||scope?.active===false)return;panel.hidden=false;trigger.setAttribute('aria-expanded','true');focus(last?items().at(-1):items()[0]);}
 function updateLoginReturn(){
  const path=window.location?.pathname;if(!path||!path.startsWith('/')||path.startsWith('//'))return;
  signin.setAttribute('href','/signin-with-chatgpt?return_to='+encodeURIComponent(path+(window.location.search||'')+(window.location.hash||'')));
 }
 function refresh(error=false){
  if(scope?.active===false)return;
  const wasFocused=menu.contains(document.activeElement),signedIn=!signout.hidden,guest=!signin.hidden;
  if(error===true)unresolvedState='error';else if(error==='loading')unresolvedState='loading';
  const state=signedIn?'signed-in':guest?'guest':unresolvedState;
  menu.dataset.accountState=state;trigger.hidden=!signedIn;status.hidden=signedIn||guest;status.disabled=state!=='error';
  status.querySelector('span').textContent=state==='error'?'重试':'账户';status.setAttribute('aria-label',state==='error'?'重新读取账户状态':'正在读取账户状态');
  if(!signedIn||!items().includes(document.activeElement)&&panel.contains(document.activeElement))close();
  if(wasFocused&&document.activeElement?.closest('[hidden]'))focus(signedIn?trigger:guest?signin:status);
  updateLoginReturn();
 }
 listen(status,'click',()=>{if(status.disabled)return;refresh('loading');document.querySelector('#retry-load,#random-retry')?.click();});
 listen(trigger,'click',()=>{if(panel.hidden)open();else close(true);});
 listen(trigger,'keydown',event=>{if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();open(event.key==='ArrowUp');}});
 listen(panel,'keydown',event=>{
  const options=items(),index=options.indexOf(document.activeElement);
  if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
   event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?options.length-1:(index+(event.key==='ArrowUp'?-1:1)+options.length)%options.length;focus(options[next]);
  }else if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);}
  else if(event.key==='Tab')close(true);
 });
 listen(panel,'click',event=>{if(event.target.closest?.('[role="menuitem"]'))close(panel.contains(document.activeElement));});
 listen(document,'pointerdown',event=>{if(!menu.contains(event.target))close();});
 listen(document,'focusin',event=>{if(!menu.contains(event.target))close();});
 listen(document,'keydown',event=>{if(event.key==='Escape'&&!panel.hidden){event.preventDefault();close(true);}});
 listen(window,'media-route',()=>{close();updateLoginReturn();});
 listen(window,'pagehide',()=>close());
 const controller={refresh,close};window.ArtworkAccountMenu=controller;
 scope?.onCleanup(()=>{close();if(window.ArtworkAccountMenu===controller)delete window.ArtworkAccountMenu;});
 refresh();
})();

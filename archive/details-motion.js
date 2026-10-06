(() => {
const pageScope = window.MediaArtPage?.current;
const listen = (target, ...args) => { target?.addEventListener?.(...args); pageScope?.onCleanup(() => target?.removeEventListener?.(...args)); };
(() => {
 const active=new WeakMap();
 function toggle(details,summary){
  const panel=details.querySelector('.details-content');if(!panel)return;
  let old=active.get(details);
  // An external view may cancel native motion while changing disclosure state.
  if(old?.heightAnimation.playState==='idle'){old.contentAnimation.cancel();active.delete(details);old=null;}
  const expanded=!(old?old.expanded:details.open);
  const height=details.getBoundingClientRect().height;
  const opacity=details.open?getComputedStyle(panel).opacity:'0';
  old?.heightAnimation.cancel();old?.contentAnimation.cancel();active.delete(details);
  details.style.height='';details.style.overflow='';
  summary.setAttribute('aria-expanded',String(expanded));
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||!details.animate||!panel.animate){details.open=expanded;return;}
  // Measure native closed and open boxes synchronously, before the next paint.
  details.open=false;const closedHeight=details.getBoundingClientRect().height;
  details.open=true;const openHeight=details.getBoundingClientRect().height;
  details.style.overflow='hidden';
  const options={duration:320,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'};
  const state={expanded,heightAnimation:details.animate([{height:height+'px'},{height:(expanded?openHeight:closedHeight)+'px'}],options),contentAnimation:panel.animate([{opacity},{opacity:expanded?'1':'0'}],options)};
  active.set(details,state);
  state.heightAnimation.onfinish=()=>{
   if(active.get(details)!==state)return;
   details.open=expanded;state.heightAnimation.cancel();state.contentAnimation.cancel();
   details.style.height='';details.style.overflow='';active.delete(details);
  };
 }
 listen(document, 'click',event=>{
  const summary=event.target.closest?.('summary');if(!summary)return;
  const details=summary.parentElement;if(details?.tagName!=='DETAILS'||!details.closest('.card-sources'))return;
  if(event.button&&event.button!==0)return;
  event.preventDefault();toggle(details,summary);
 });
})();

})();

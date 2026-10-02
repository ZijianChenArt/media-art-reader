(() => {
 const input=document.querySelector('#archive-search'),clear=document.querySelector('#clear-search');
 const cards=[...document.querySelectorAll('.archive-grid>.card')],feedback=document.querySelector('#search-feedback'),empty=document.querySelector('#empty-selection');
 const index=cards.map(card=>({card,searchIndex:ArchiveSearch.createIndex(card.dataset.search,card.dataset.searchPinyin)}));
 function search(){
  const query=ArchiveSearch.terms(input.value);let visible=0;
  index.forEach(({card,searchIndex})=>{card.hidden=!ArchiveSearch.matches(searchIndex,query);if(!card.hidden)visible++;});
  clear.hidden=!input.value;empty.hidden=visible>0;
  feedback.textContent=(query.length?'找到 ':'')+visible+' 件作品';
 }
 input.addEventListener('input',search);clear.addEventListener('click',()=>{input.value='';search();input.focus()});
 input.addEventListener('keydown',event=>{if(event.key==='Escape'){input.value='';search()}});
 function revealHash(){
  let id;try{id=decodeURIComponent(location.hash.slice(1))}catch{return;}
  const target=document.getElementById(id);
  if(!target?.classList.contains('card'))return;
  input.value='';search();target.scrollIntoView({block:'start'});
 }
 addEventListener('hashchange',revealHash);revealHash();
})();

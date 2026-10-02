// Deduplicate generic ownership and exact repeated clauses at render time only.
// Keep per-photo credits, named rights holders and distinct license restrictions intact.
const genericOwnership=/^(?:作品(?:及|与)?)?(?:图像|图片|照片|摄影)?版权归(?:相应|各自)?(?:艺术家|摄影者|摄影师|相关|原始|所列|注明的|各自|及|与|和|、|／|\/|机构|权利人|所有|相应)+[；;。.]?$/u;
export function artworkRights(work){
 const seen=new Set();
 return [{rights:work.rights,label:''},...(work.additionalImages||[]).slice(0,1).map((image,index)=>({rights:image.rights,label:'图'+(index+2)}))].flatMap(({rights,label})=>{
  const clauses=String(rights||'').split(/(?<=[；;。])/u).map(s=>s.trim()).filter(Boolean);
  const distinct=clauses.filter(clause=>{
   const key=genericOwnership.test(clause)?'generic-ownership':clause.replace(/\s+/gu,'').replace(/[；;。.]$/u,'');
   if(seen.has(key))return false;
   seen.add(key);return true;
  });
  return distinct.length?[{label,text:distinct.join('')}]:[];
 });
}

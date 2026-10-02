// Public data uses a positive allowlist. Never spread private catalog records.
export const PUBLIC_FIELDS = ['id','title','artist','year','medium','description','exhibition','award','notes','tags','group','work','video','exhibitionurl','awardurl','image','imageNote','credit','imageSource','rights','imagePosition','imageZoom','imageFit','searchAliases','verificationSources','sourceURLs','sources','officialSourceURL','version'];
const PICTURE_FIELDS=['image','imageNote','credit','imageSource','rights','imagePosition','imageZoom','imageFit'];
const listFields=new Set(['tags','searchAliases','verificationSources','sourceURLs','sources']);
const pick=(value,keys)=>Object.fromEntries(keys.filter(key=>value[key]!==undefined).map(key=>[key,listFields.has(key)?(Array.isArray(value[key])?value[key].filter(item=>typeof item==='string'):[]):key==='imageZoom'?Number(value[key])||1:String(value[key]) ]));
const imagePath=value=>{
  const path=String(value||'');
  if(!/^(?:\/?assets\/)[\w. -]+$/.test(path))throw new Error('Expected a flat public assets/ image path');
  return path.replace(/^\//,'');
};
export function sanitizePublicCatalog(records,{excludeIds=[]}={}){
  const excluded=new Set(excludeIds),seen=new Set();
  return records.filter(record=>!excluded.has(record.id)).map((record,index)=>{
    if(!/^[a-zA-Z0-9][\w-]*$/.test(record.id)||seen.has(record.id))throw new Error('Invalid or duplicate artwork id');
    seen.add(record.id);
    const work=pick(record,PUBLIC_FIELDS);
    work.image=imagePath(work.image);work.number=index+1;
    work.additionalImages=(record.additionalImages||[]).slice(0,1).map(picture=>({...pick(picture,PICTURE_FIELDS),image:imagePath(picture.image)}));
    return work;
  });
}

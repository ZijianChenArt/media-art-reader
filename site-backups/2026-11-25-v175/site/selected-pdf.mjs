// Browser-only document generation. No selection or generated file is sent to a server.
export const unverifiedImageText = '暂无已核实的本作现场图';
export const cleanText = value => String(value ?? '').replace(/\r\n?/g,'\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').normalize('NFC');
export const safeURL = value => { try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; } };
export const fileName = (format, date = new Date()) => `media-art-selected-${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}.${format}`;
export function createCSV(works) {
 const cell = value => { let text = cleanText(value); if (/^[\s\uFEFF]*[=+@-]/u.test(text)) text = "'" + text; return '"' + text.replaceAll('"','""') + '"'; };
 const columns = ['作品名称','作者／完整署名','年份','媒介','简介','展览记录','奖项记录','官方作品资料','影像／现场记录','展览／奖项来源','作品图片','图片来源','图片署名','作品编号'];
 const rows = works.map(w => [w.title,w.artist,w.year,w.medium,w.description,w.exhibition,w.award,safeURL(w.work),safeURL(w.video),safeURL(w.exhibitionurl || w.awardurl),w.imageStatus==='unverified' ? unverifiedImageText : safeURL(w.imageURL),safeURL(w.imageSource),w.credit,w.id]);
 return '\uFEFF' + [columns,...rows].map(row=>row.map(cell).join(',')).join('\r\n') + '\r\n';
}
export function wrapText(text, font, size, maxWidth) {
 const lines=[];
 for (const paragraph of cleanText(text).split('\n')) {
  let line='';
  // Break CJK naturally while retaining ordinary words whenever they fit.
  const chunks=paragraph.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]|[^\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\s]+\s*|\s+/gu)||[''];
  for(const chunk of chunks) {
   if(font.widthOfTextAtSize(line+chunk,size)<=maxWidth){line+=chunk;continue;}
   if(line.trim())lines.push(line.trimEnd());line='';
   for(const char of chunk){if(line&&font.widthOfTextAtSize(line+char,size)>maxWidth){lines.push(line.trimEnd());line='';}line+=char;}
  }
  lines.push(line.trimEnd());
 }
 return lines;
}
export async function createSelectedPDF(works, {pdfLib, fontkit, fontBytes, loadImage, signal, onProgress=()=>{}, date=new Date()}={}) {
 if(!works.length)throw new Error('还没有精选作品。');
 const {PDFDocument,PDFName,PDFString,rgb}=pdfLib;
 const doc=await PDFDocument.create();doc.registerFontkit(fontkit);
 // Prebuilt catalog font is embedded whole for reliable CJK copy/search in every viewer.
 const font=await doc.embedFont(fontBytes,{subset:false});
 doc.setTitle('媒体艺术档案 · 精选作品');doc.setAuthor('Media Art Archive');doc.setSubject('个人精选作品资料');doc.setCreationDate(date);doc.setLanguage('zh-CN');
 const width=595.28,height=841.89,margin=44,bottom=55,ink=rgb(.06,.06,.06),muted=rgb(.36,.36,.36),paper=rgb(.95,.95,.95);
 let page,y,missingImages=0,unverifiedImages=0;
 const check=()=>{if(signal?.aborted)throw new DOMException('已取消导出','AbortError');};
 const newPage=()=>{page=doc.addPage([width,height]);y=height-44;page.drawText('MEDIA ART ARCHIVE / SELECTED',{x:margin,y,size:8,font,color:muted});page.drawLine({start:{x:margin,y:y-11},end:{x:width-margin,y:y-11},thickness:.7,color:ink});y-=38;};
 const ensure=amount=>{if(y-amount<bottom)newPage();};
 const text=(value,{size=10.5,color=ink,gap=8,lineHeight=size*1.65}={})=>{const lines=wrapText(value,font,size,width-margin*2);for(const line of lines){ensure(lineHeight);page.drawText(line,{x:margin,y:y-size,size,font,color});y-=lineHeight;}y-=gap;};
 const source=(label,value)=>{const url=safeURL(value);if(!url)return;const size=8.5,lineHeight=13;for(const line of wrapText(label+'  '+url,font,size,width-margin*2)){ensure(lineHeight);page.drawText(line,{x:margin,y:y-size,size,font,color:muted});const annotation=doc.context.obj({Type:'Annot',Subtype:'Link',Rect:[margin,y-lineHeight,width-margin,y+2],Border:[0,0,0],A:{Type:'Action',S:'URI',URI:PDFString.of(url)}});page.node.addAnnot(doc.context.register(annotation));y-=lineHeight;}y-=4;};
 for(let index=0;index<works.length;index++) {
  check();const work=works[index];newPage();
  text(`${String(index+1).padStart(2,'0')} / ${works.length}  精选作品`,{size:9,color:muted,gap:8});
  text(work.title,{size:23,lineHeight:31,gap:10});
  text(work.artist,{size:12,lineHeight:19,gap:6});
  text([work.year,work.medium].filter(Boolean).join(' / '),{size:10,color:muted,gap:14});
  const imageHeight=228;ensure(imageHeight+32);
  let image;
  try{const bytes=work.imageStatus==='unverified' ? null : await loadImage(work,signal);check();if(bytes)image=await doc.embedJpg(bytes);}catch(error){check();}
  if(image){const fit=image.scaleToFit(width-margin*2,imageHeight);page.drawRectangle({x:margin,y:y-imageHeight,width:width-margin*2,height:imageHeight,color:paper});page.drawImage(image,{x:(width-fit.width)/2,y:y-imageHeight+(imageHeight-fit.height)/2,width:fit.width,height:fit.height});y-=imageHeight+10;}
  else if(work.imageStatus==='unverified'){unverifiedImages++;text(unverifiedImageText,{size:9,color:muted});}
  else{missingImages++;text('图片暂时无法读取，请通过图片来源查看。',{size:9,color:muted});}
  if(work.credit)text('图片署名：'+work.credit,{size:8,color:muted,lineHeight:12,gap:13});
  text(work.description||'暂无简介。',{size:10.5,gap:12});
  if(work.exhibition)text('展览记录：'+work.exhibition,{size:9.5,color:muted,gap:5});
  if(work.award)text('奖项记录：'+work.award,{size:9.5,color:muted,gap:5});
  ensure(30);y-=6;
  source('官方作品资料',work.work);if(work.video!==work.work)source('影像／现场记录',work.video);source('展览／奖项来源',work.exhibitionurl||work.awardurl);source('图片来源',work.imageSource);
  if(work.rights)text(work.rights,{size:8,color:muted,lineHeight:12,gap:0});
  onProgress(index+1,works.length);
  // Give the UI time to paint progress and process cancellation on large exports.
  await new Promise(resolve=>setTimeout(resolve,0));
 }
 const pages=doc.getPages(),day=date.toISOString().slice(0,10);
 pages.forEach((item,index)=>{item.drawLine({start:{x:margin,y:43},end:{x:width-margin,y:43},thickness:.5,color:rgb(.7,.7,.7)});item.drawText(`私人研究与资料索引 · 图像版权归原权利人 · ${day}`,{x:margin,y:29,size:7.5,font,color:muted});item.drawText(`${index+1} / ${pages.length}`,{x:width-margin-42,y:29,size:8,font,color:muted});});
 check();const bytes=await doc.save();check();return {bytes,missingImages,unverifiedImages,pageCount:pages.length};
}

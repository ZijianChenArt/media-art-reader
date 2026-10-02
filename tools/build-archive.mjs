import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sanitizePublicCatalog} from './public-catalog.mjs';
import {renderPublicArchive} from './render-public-archive.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),input=args.find(arg=>!arg.startsWith('--'));
if(!input)throw new Error('Usage: node tools/build-archive.mjs <catalog.json> [--assets=<public-assets-dir>] [--exclude=<ids.json>] [--skip-assets]');
const option=name=>args.find(arg=>arg.startsWith('--'+name+'='))?.split('=').slice(1).join('=');
const excludeIds=option('exclude')?JSON.parse(fs.readFileSync(option('exclude'),'utf8')):[];
const data=sanitizePublicCatalog(JSON.parse(fs.readFileSync(input,'utf8')),{excludeIds});
const output=path.join(root,'archive');fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'catalog.json'),JSON.stringify(data,null,2)+'\n');
fs.writeFileSync(path.join(output,'index.html'),renderPublicArchive(data));
let copied=0;
if(!args.includes('--skip-assets')){
 const assetRoot=option('assets');if(!assetRoot)throw new Error('--assets is required unless using --skip-assets');
 // Only referenced artwork images are copied. Unreferenced personal files never enter the public directory.
 fs.rmSync(path.join(output,'assets'),{force:true,recursive:true});fs.mkdirSync(path.join(output,'assets'),{recursive:true});
 for(const image of new Set(data.flatMap(work=>[work.image,...work.additionalImages.map(picture=>picture.image)]))){
  const name=path.basename(image);fs.copyFileSync(path.join(assetRoot,name),path.join(output,'assets',name));copied++;
 }
}
console.log(JSON.stringify({records:data.length,imagesCopied:copied,galleryCount:data.filter(work=>work.additionalImages.length).length,output}));

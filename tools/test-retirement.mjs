import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizePublicCatalog} from './public-catalog.mjs';
const targets=['r2-yi','r7-olmedo-hic-et-nunc','r7-tieu-in-cold-print','r8-universal-primordial'];
const source=[...targets.map(id=>({id,title:id,image:'assets/test.jpg',retired:true})),{id:'active-one',title:'One',image:'assets/one.jpg'},{id:'active-two',title:'Two',image:'assets/two.jpg'}];
test('public sanitizer excludes retired metadata automatically, retains order, renumbers and does not leak the flag',()=>{
 const out=sanitizePublicCatalog(source);assert.equal(out.length,source.length-4);assert.ok(targets.every(id=>!out.some(w=>w.id===id)));assert.ok(!JSON.stringify(out).includes('"retired"'));assert.deepEqual(out.map(w=>w.number),out.map((_,i)=>i+1));
});
test('existing public exclusions compose with retirement instead of being replaced',()=>{
 const out=sanitizePublicCatalog(source,{excludeIds:['active-one']});assert.equal(out.length,1);assert.equal(out[0].id,'active-two');
});

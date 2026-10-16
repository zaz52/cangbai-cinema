import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import worker from '../src/index.js';

test('public site config exposes only valid copyright contact email', async () => {
  const env={ COPYRIGHT_CONTACT_EMAIL:'rights@example.org',PASSWORD:'never-expose-this',VOD_SOURCES:'[]' };
  const r=await worker.fetch(new Request('https://film.example/api/site-config'),env);
  assert.equal(r.status,200);
  const payload=await r.json();
  assert.deepEqual(payload,{copyrightContactEmail:'rights@example.org',nonCommercial:true});
  assert.ok(!(JSON.stringify(payload).includes('never-expose-this')));
});
test('missing or unsafe address never generates a public mailto address',async()=>{
  for(const email of ['','bad-address','evil@example.org\nBcc:someone@example.net']){
    const r=await worker.fetch(new Request('https://film.example/api/site-config'),{COPYRIGHT_CONTACT_EMAIL:email});
    assert.equal((await r.json()).copyrightContactEmail,null);
  }
});
test('site footer and copyright page make non-commercial takedown route visible',async()=>{
  const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  const copyright=await readFile(new URL('../public/copyright.html',import.meta.url),'utf8');
  assert.match(html,/href="\.\/copyright\.html"/);
  assert.match(copyright,/侵权投诉/);
  assert.match(copyright,/COPYRIGHT_CONTACT_EMAIL/);
  assert.match(copyright,/非营利性质本身不代表取得/);
});

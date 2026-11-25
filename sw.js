const C='ridelog-v7-1';
const F=['./','./index.html','./app.js','./manifest.json','./icon.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(F))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(a=>Promise.all(a.filter(x=>x!==C).map(x=>caches.delete(x))))));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(q=>{let z=q.clone();caches.open(C).then(c=>c.put(e.request,z));return q}).catch(()=>caches.match('./index.html')))));
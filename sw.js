'use strict';

/* e88 RECOVERY SERVICE WORKER
   목적: e87에서 남을 수 있는 service worker/cache/page를 강제로 제거하고
   현재 GitHub main(e86 stable rollback)의 index/app을 다시 읽게 한다.
   앱 기능 코드는 수정하지 않는다.
*/
const CACHE_NAME='essay-pwa-recovery-v88';
const APP_SHELL=[
  './',
  './index.html',
  './styles.css?v=86',
  './app.js?v=86',
  './manifest.webmanifest?v=86',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
  })());
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE_NAME && (k.startsWith('essay-pwa-')||k.includes('essay'))).map(k=>caches.delete(k)));
    await self.clients.claim();

    // 이미 열려 있는 e87 문서 자체를 교체해야 주입된 옛 이벤트가 사라진다.
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    await Promise.all(clients.map(async client=>{
      try{
        const u=new URL(client.url);
        if(u.origin===self.location.origin){
          u.searchParams.set('recovery','88');
          u.searchParams.set('v','86');
          await client.navigate(u.href);
        }
      }catch{}
    }));
  })());
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const u=new URL(event.request.url);
  if(u.origin!==self.location.origin)return;

  const isCode=event.request.mode==='navigate'||/\.(?:js|css|webmanifest)$/.test(u.pathname);
  if(isCode){
    event.respondWith((async()=>{
      try{
        const r=await fetch(event.request,{cache:'no-store'});
        if(!r||!r.ok)throw new Error('HTTP '+(r?.status||0));
        const cache=await caches.open(CACHE_NAME);
        cache.put(event.request,r.clone()).catch(()=>{});
        if(event.request.mode==='navigate')cache.put('./index.html',r.clone()).catch(()=>{});
        return r;
      }catch{
        return (await caches.match(event.request))||(await caches.match('./index.html'))||Response.error();
      }
    })());
    return;
  }

  event.respondWith((async()=>{
    const hit=await caches.match(event.request);
    if(hit)return hit;
    try{
      const r=await fetch(event.request);
      if(r?.ok){const cache=await caches.open(CACHE_NAME);cache.put(event.request,r.clone()).catch(()=>{});}
      return r;
    }catch{return Response.error();}
  })());
});

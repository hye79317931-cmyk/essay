'use strict';

const CACHE_NAME = 'essay-pwa-v75';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css?v=75',
  './app.js?v=75',
  './manifest.webmanifest?v=75',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith('essay-pwa-')&&k!==CACHE_NAME).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin) return;
  const code=event.request.mode==='navigate' || /\.(?:js|css|webmanifest)$/.test(url.pathname);
  if(code){
    event.respondWith((async()=>{
      try{
        const fresh=await fetch(event.request,{cache:'no-store'});
        const cache=await caches.open(CACHE_NAME);
        cache.put(event.request,fresh.clone()).catch(()=>{});
        return fresh;
      }catch{
        return (await caches.match(event.request)) || (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }
  event.respondWith((async()=>{
    const cached=await caches.match(event.request);
    if(cached)return cached;
    try{
      const fresh=await fetch(event.request);
      const cache=await caches.open(CACHE_NAME);
      cache.put(event.request,fresh.clone()).catch(()=>{});
      return fresh;
    }catch{return Response.error();}
  })());
});

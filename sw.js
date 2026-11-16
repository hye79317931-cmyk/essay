'use strict';

const CACHE_NAME = 'essay-pwa-v87-finish';
const FINISH_PATCH = './finish-v87.js?v=87';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css?v=86',
  './app.js?v=86',
  './manifest.webmanifest?v=86',
  './finish-v87.js?v=87',
  './icon-192.png',
  './icon-512.png'
];

function injectFinishPatch(html){
  if (html.includes('finish-v87.js')) return html;
  const tag = '<script src="./finish-v87.js?v=87"></script>';
  return html.includes('</body>') ? html.replace('</body>', `${tag}</body>`) : `${html}${tag}`;
}

async function htmlResponseWithPatch(response){
  const html = injectFinishPatch(await response.text());
  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.delete('content-length');
  return new Response(html, {status: response.status, statusText: response.statusText, headers});
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('essay-pwa-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request, {cache: 'no-store'});
        if (!response || !response.ok) throw new Error(`HTTP ${response?.status || 0}`);
        const patched = await htmlResponseWithPatch(response.clone());
        const cache = await caches.open(CACHE_NAME);
        cache.put('./index.html', patched.clone()).catch(() => {});
        return patched;
      } catch (err) {
        const cached = await caches.match('./index.html') || await caches.match('./');
        if (!cached) return Response.error();
        return htmlResponseWithPatch(cached.clone());
      }
    })());
    return;
  }

  if (url.pathname.endsWith('/finish-v87.js')) {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request, {cache: 'no-store'});
        if (response?.ok) return response;
      } catch {}
      return (await caches.match(FINISH_PATCH)) || Response.error();
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response?.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, response.clone()).catch(() => {});
      }
      return response;
    } catch {
      return Response.error();
    }
  })());
});

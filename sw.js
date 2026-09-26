const CACHE_NAME = "pritisak-v2";
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

self.addEventListener("install", function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(key){ return key !== CACHE_NAME; })
            .map(function(key){ return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

// Cache-first for the app shell, network-first fallback for everything else
// (e.g. Google Fonts), so the app still opens with no connection.
// /api/* always goes straight to the network: it's live data, never cached.
self.addEventListener("fetch", function(event){
  if(event.request.method !== "GET") return;
  if(new URL(event.request.url).pathname.startsWith("/api/")) return;

  event.respondWith(
    caches.match(event.request).then(function(cached){
      if(cached) return cached;
      return fetch(event.request).then(function(response){
        if(response && response.status === 200 && response.type === "basic"){
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(event.request, copy); });
        }
        return response;
      }).catch(function(){
        if(event.request.mode === "navigate") return caches.match("/index.html");
      });
    })
  );
});

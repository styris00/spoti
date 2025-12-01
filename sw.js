// sw.js — Service Worker pour cache + offline

// Nom du cache (versionné)
const CACHE_NAME = "spoti-cache-v1";

// Fichiers à mettre en cache immédiatement
const ASSETS = [
    "./",
    "./index.html",
    "./styles.css",
    "./auth.js",
    "./spotify-api.js",
    "./musics.js",
    "./playlists.js",
    "./db.js",
    "./ui.js",
    "./utils.js",
];

// ---------------------------------------------------------
// INSTALL
// ---------------------------------------------------------
self.addEventListener("install", (event) => {
    console.log("[SW] Install…");

    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log("[SW] Mise en cache statique…");
            return cache.addAll(ASSETS);
        })
    );

    self.skipWaiting();
});

// ---------------------------------------------------------
// ACTIVATE
// ---------------------------------------------------------
self.addEventListener("activate", (event) => {
    console.log("[SW] Activate…");

    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((oldKey) => {
                        console.log("[SW] Suppression ancien cache :", oldKey);
                        return caches.delete(oldKey);
                    })
            )
        )
    );

    self.clients.claim();
});

// ---------------------------------------------------------
// FETCH
// ---------------------------------------------------------
self.addEventListener("fetch", (event) => {
    const request = event.request;

    // Seulement GET
    if (request.method !== "GET") {
        return event.respondWith(fetch(request));
    }

    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            // Ressource trouvée dans le cache → on sert directement
            if (cachedResponse) {
                return cachedResponse;
            }

            // Sinon → fetch réseau + mise en cache dynamique
            return fetch(request)
                .then((networkResponse) => {
                    // éviter d’ajouter des réponses invalides au cache
                    if (
                        !networkResponse ||
                        networkResponse.status !== 200 ||
                        networkResponse.type !== "basic"
                    ) {
                        return networkResponse;
                    }

                    const cloned = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, cloned);
                    });

                    return networkResponse;
                })
                .catch(() => {
                    // Fallback offline
                    if (request.destination === "document") {
                        return caches.match("./index.html");
                    }
                });
        })
    );
});

// =======================================
//  db.js — Wrapper IndexedDB moderne
// =======================================

const DB_NAME = "spotiDB";
const DB_VERSION = 1;

let db = null;

// =======================================
//      INITIALISATION DE LA DATABASE
// =======================================

export function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject("Erreur ouverture IndexedDB");

        request.onupgradeneeded = (event) => {
            db = event.target.result;

            // ----- Store des musiques -----
            if (!db.objectStoreNames.contains("musics")) {
                const store = db.createObjectStore("musics", { keyPath: "id" });
                store.createIndex("by_artist", "artist");
                store.createIndex("by_popularity", "popularity");
                store.createIndex("by_addedAt", "addedAt");
            }

            // ----- Store des playlists -----
            if (!db.objectStoreNames.contains("playlists")) {
                const store = db.createObjectStore("playlists", {
                    keyPath: "id",
                    autoIncrement: true
                });
                store.createIndex("by_name", "name", { unique: false });
            }

            // ----- Store des settings -----
            if (!db.objectStoreNames.contains("settings")) {
                db.createObjectStore("settings", { keyPath: "key" });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };
    });
}


// =======================================
//        OUTILS DE TRANSACTION
// =======================================

function getStore(storeName, mode = "readonly") {
    return db.transaction(storeName, mode).objectStore(storeName);
}


// =======================================
//              CRUD SIMPLES
// =======================================

export function get(storeName, key) {
    return new Promise((resolve, reject) => {
        const request = getStore(storeName).get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject("Erreur DB get()");
    });
}

export function getAll(storeName) {
    return new Promise((resolve, reject) => {
        const request = getStore(storeName).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject("Erreur DB getAll()");
    });
}

export function put(storeName, value) {
    return new Promise((resolve, reject) => {
        const request = getStore(storeName, "readwrite").put(value);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject("Erreur DB put()");
       
    });
}

export function remove(storeName, key) {
    return new Promise((resolve, reject) => {
        const request = getStore(storeName, "readwrite").delete(key);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject("Erreur DB delete()");
    });
}


// =======================================
//        BULK PUT (Import massif)
// =======================================
//  Exécute toutes les insertions dans UNE seule transaction
//  → 30x plus rapide qu'une boucle de put() individuels
// =======================================

export function bulkPut(storeName, items) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);

        for (const item of items) {
            store.put(item);
        }

        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject("Erreur DB bulkPut()");
    });
}


// =======================================
//      HELPERS PERSONNALISÉS
// =======================================

export async function saveSetting(key, value) {
    return put("settings", { key, value });
}

export async function loadSetting(key) {
    return get("settings", key);
}

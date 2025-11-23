// =======================================
// musics.js
// Gestion des musiques : lecture depuis IndexedDB,
// filtrage, tri, rendu UI pour #list et #playlist-details
// =======================================

import { getAll, get, put, remove, bulkPut } from "./db.js";
import { showMessage } from "./ui.js"; // optionnel : afficher messages utilisateur

// -------------------------------------------------------
// Exports attendus par ui.js
// -------------------------------------------------------
export async function refreshMusicListUI() {
    const all = await loadAllMusics();
    const filtered = filterMusicsMainList(all);
    renderMusicList(filtered);
    updateSummary(filtered, "music-count", "total-duration");
}

export async function refreshPlaylistDetailsUI() {
    // On suppose que l'id de la playlist ouverte est stocké dans #titre-playlist data-id
    const titre = document.getElementById("titre-playlist");
    if (!titre) return;
    const playlistId = titre.dataset.spotifyId || titre.dataset.id;
    if (!playlistId) {
        // si pas d'ID → vider la vue
        renderPlaylistDetails([]);
        updateSummary([], "playlist-music-count", "playlist-total-duration");
        return;
    }

    // Dans ton design, playlist details peut être alimenté depuis IndexedDB ou via API.
    // Ici on cherche en DB les musiques marquées avec playlistId dans leur property 'playlistIds' (array)
    const all = await loadAllMusics();
    const inPlaylist = all.filter((m) => (m.playlistIds || []).includes(String(playlistId)));
    const filtered = filterMusicsPlaylistDetails(inPlaylist);
    renderPlaylistDetails(filtered);
    updateSummary(filtered, "playlist-music-count", "playlist-total-duration");
}

export function clearFiltersMainList() {
    ["title-filter", "album-filter", "author-filter"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
    ["select-title-hearts", "select-album-hearts", "select-author-hearts"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = "all";
    });
    ["min-select-energique", "max-select-energique", "min-select-joyeuse", "max-select-joyeuse", "min-select-musicale", "max-select-musicale"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = el.querySelector("option[selected]")?.value || el.options[0].value;
    });
    const sort = document.getElementById("sort-by-popularity");
    if (sort) sort.value = "no";
    refreshMusicListUI();
}

export function clearFiltersPlaylistDetails() {
    ["playlist-title-filter", "playlist-album-filter", "playlist-author-filter"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
    ["playlist-select-title-hearts", "playlist-select-album-hearts", "playlist-select-author-hearts"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = "all";
    });
    ["playlist-min-select-energique", "playlist-max-select-energique", "playlist-min-select-joyeuse", "playlist-max-select-joyeuse", "playlist-min-select-musicale", "playlist-max-select-musicale"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = el.querySelector("option[selected]")?.value || el.options[0].value;
    });
    const sort = document.getElementById("playlist-sort-by-popularity");
    if (sort) sort.value = "no";
    refreshPlaylistDetailsUI();
}


// -------------------------------------------------------
// Internal helpers
// -------------------------------------------------------

/**
 * Charge toutes les musiques depuis IndexedDB (store "musics")
 * Renvoie un array d'objets music.
 */
async function loadAllMusics() {
    try {
        const all = await getAll("musics");
        // Normaliser les IDs en string et s'assurer des champs nécessaires
        return all.map((m) => normalizeMusicObject(m));
    } catch (err) {
        console.error("Erreur loadAllMusics", err);
        return [];
    }
}

/**
 * Normalise/garantit présence des champs nécessaires pour le filtering/render
 */
function normalizeMusicObject(m) {
    return {
        id: String(m.id || m.trackId || m.uri || ""),
        title: m.name || m.title || m.track_name || "",
        artist: Array.isArray(m.artists) ? m.artists.join(", ") : m.artist || m.artiste || "",
        album: m.album || m.album_name || "",
        duration_ms: m.duration_ms || m.duration || 0,
        popularity: Number(m.popularity || 0),
        heart: Number(m.heart || 0), // 0 = none, 1 = simple (🤍), 2 = super (🧡) etc.
        energy: Number(m.energy || 0),
        joy: Number(m.joy || 0),
        musicality: Number(m.musicality || 0),
        playlistIds: m.playlistIds || m.playlists || [],
        // copie du payload original si besoin
        __raw: m
    };
}

/**
 * Filtrage pour la section principale (#list)
 */
function filterMusicsMainList(all) {
    const title = (document.getElementById("title-filter")?.value || "").toLowerCase();
    const album = (document.getElementById("album-filter")?.value || "").toLowerCase();
    const artist = (document.getElementById("author-filter")?.value || "").toLowerCase();

    const heartTitle = document.getElementById("select-title-hearts")?.value || "all";
    const heartAlbum = document.getElementById("select-album-hearts")?.value || "all";
    const heartAuthor = document.getElementById("select-author-hearts")?.value || "all";

    const minEnergy = Number(document.getElementById("min-select-energique")?.value || 0);
    const maxEnergy = Number(document.getElementById("max-select-energique")?.value || 4);
    const minJoy = Number(document.getElementById("min-select-joyeuse")?.value || 0);
    const maxJoy = Number(document.getElementById("max-select-joyeuse")?.value || 4);
    const minMus = Number(document.getElementById("min-select-musicale")?.value || 0);
    const maxMus = Number(document.getElementById("max-select-musicale")?.value || 4);

    const sortBy = document.getElementById("sort-by-popularity")?.value || "no";

    let res = all.filter((m) => {
        if (title && !m.title.toLowerCase().includes(title)) return false;
        if (album && !m.album.toLowerCase().includes(album)) return false;
        if (artist && !m.artist.toLowerCase().includes(artist)) return false;

        // hearts logic: helper
        if (!checkHeartFilter(m.heart, heartTitle) || !checkHeartFilter(m.heart, heartAlbum) || !checkHeartFilter(m.heart, heartAuthor)) return false;

        if (m.energy < minEnergy || m.energy > maxEnergy) return false;
        if (m.joy < minJoy || m.joy > maxJoy) return false;
        if (m.musicality < minMus || m.musicality > maxMus) return false;

        return true;
    });

    if (sortBy === "décroissant") {
        res.sort((a, b) => b.popularity - a.popularity);
    } else if (sortBy === "croissant") {
        res.sort((a, b) => a.popularity - b.popularity);
    }

    return res;
}

/**
 * Filtrage pour playlist details (même logique que main, mais inputs prefixés)
 */
function filterMusicsPlaylistDetails(all) {
    const title = (document.getElementById("playlist-title-filter")?.value || "").toLowerCase();
    const album = (document.getElementById("playlist-album-filter")?.value || "").toLowerCase();
    const artist = (document.getElementById("playlist-author-filter")?.value || "").toLowerCase();

    const heartTitle = document.getElementById("playlist-select-title-hearts")?.value || "all";
    const heartAlbum = document.getElementById("playlist-select-album-hearts")?.value || "all";
    const heartAuthor = document.getElementById("playlist-select-author-hearts")?.value || "all";

    const minEnergy = Number(document.getElementById("playlist-min-select-energique")?.value || 0);
    const maxEnergy = Number(document.getElementById("playlist-max-select-energique")?.value || 4);
    const minJoy = Number(document.getElementById("playlist-min-select-joyeuse")?.value || 0);
    const maxJoy = Number(document.getElementById("playlist-max-select-joyeuse")?.value || 4);
    const minMus = Number(document.getElementById("playlist-min-select-musicale")?.value || 0);
    const maxMus = Number(document.getElementById("playlist-max-select-musicale")?.value || 4);

    const sortBy = document.getElementById("playlist-sort-by-popularity")?.value || "no";

    let res = all.filter((m) => {
        if (title && !m.title.toLowerCase().includes(title)) return false;
        if (album && !m.album.toLowerCase().includes(album)) return false;
        if (artist && !m.artist.toLowerCase().includes(artist)) return false;

        if (!checkHeartFilter(m.heart, heartTitle) || !checkHeartFilter(m.heart, heartAlbum) || !checkHeartFilter(m.heart, heartAuthor)) return false;

        if (m.energy < minEnergy || m.energy > maxEnergy) return false;
        if (m.joy < minJoy || m.joy > maxJoy) return false;
        if (m.musicality < minMus || m.musicality > maxMus) return false;

        return true;
    });

    if (sortBy === "décroissant") {
        res.sort((a, b) => b.popularity - a.popularity);
    } else if (sortBy === "croissant") {
        res.sort((a, b) => a.popularity - b.popularity);
    }

    return res;
}

/**
 * checkHeartFilter interprets the UI select values:
 * - "all" = always true
 * - "all-hearts" = heart > 0
 * - "only-super-heart" = heart == 2
 * - "only-simple-heart" = heart == 1
 * - "only-without-heart" = heart == 0
 * - "all-except-super-heart" = heart != 2
 */
function checkHeartFilter(heartValue, filterValue) {
    switch (filterValue) {
        case "all":
            return true;
        case "all-hearts":
            return heartValue > 0;
        case "only-super-heart":
            return heartValue === 2;
        case "only-simple-heart":
            return heartValue === 1;
        case "only-without-heart":
            return heartValue === 0;
        case "all-except-super-heart":
            return heartValue !== 2;
        default:
            return true;
    }
}

/**
 * Rendu principal (#list -> #music-list)
 */
function renderMusicList(musics) {
    const container = document.getElementById("music-list");
    if (!container) return;

    if (!musics.length) {
        container.innerHTML = `<p class="empty">Aucune musique</p>`;
        return;
    }

    // Construire HTML en une passe (plus performant que append par élément)
    const html = musics
        .map((m) => {
            return `
        <div class="music-row" data-id="${escapeHtml(m.id)}">
            <div class="col title">${escapeHtml(m.title)}</div>
            <div class="col artist">${escapeHtml(m.artist)}</div>
            <div class="col album">${escapeHtml(m.album)}</div>
            <div class="col duration">${formatDuration(m.duration_ms)}</div>
            <div class="col pop">pop ${m.popularity}</div>
        </div>`;
        })
        .join("");

    container.innerHTML = html;
}

/**
 * Rendu playlist details (#playlist-details -> #music-of-playlist-list)
 */
function renderPlaylistDetails(musics) {
    const container = document.getElementById("music-of-playlist-list");
    if (!container) return;

    if (!musics.length) {
        container.innerHTML = `<p class="empty">Aucune musique dans cette playlist</p>`;
        return;
    }

    const html = musics
        .map((m) => {
            return `
        <div class="music-row" data-id="${escapeHtml(m.id)}">
            <div class="col title">${escapeHtml(m.title)}</div>
            <div class="col artist">${escapeHtml(m.artist)}</div>
            <div class="col album">${escapeHtml(m.album)}</div>
            <div class="col duration">${formatDuration(m.duration_ms)}</div>
            <div class="col pop">pop ${m.popularity}</div>
        </div>`;
        })
        .join("");

    container.innerHTML = html;
}

/**
 * Met à jour le résumé (nombre de titres + durée totale)
 * ids sont les ids des span à mettre à jour
 */
function updateSummary(musics, countSpanId, durationSpanId) {
    const countEl = document.getElementById(countSpanId);
    const durationEl = document.getElementById(durationSpanId);

    if (countEl) countEl.textContent = String(musics.length);

    if (durationEl) {
        const totalMs = musics.reduce((s, m) => s + (m.duration_ms || 0), 0);
        durationEl.textContent = formatDurationTotal(totalMs);
    }
}

/**
 * Helpers utilitaires
 */
function formatDuration(ms) {
    const s = Math.floor((ms || 0) / 1000);
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}m ${sec}s`;
}

function formatDurationTotal(ms) {
    const s = Math.floor((ms || 0) / 1000);
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min} min ${sec} s`;
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// -------------------------------------------------------
// Fonctions utilitaires d'édition / import quick helpers
// -------------------------------------------------------

/**
 * Ajoute un tableau de musiques (objet normalisé attendu) dans la DB en bulk.
 * Utilisé par playlists.importPlaylistTracks() après fetch des pistes.
 */
export async function saveMusicsBulk(musics) {
    // Ensure unique keys etc.
    const prepared = musics.map((m) => {
        const nm = normalizeMusicObject(m);
        // conserver playlistIds si fournis
        if (!nm.playlistIds) nm.playlistIds = [];
        return nm;
    });

    try {
        await bulkPut("musics", prepared);
        return true;
    } catch (err) {
        console.error("saveMusicsBulk error", err);
        return false;
    }
}

/**
 * Ajoute ou met à jour une musique individuelle (put)
 */
export async function saveMusic(musicObj) {
    const nm = normalizeMusicObject(musicObj);
    try {
        await put("musics", nm);
        return true;
    } catch (err) {
        console.error("saveMusic error", err);
        return false;
    }
}

/**
 * Supprime une musique par id
 */
export async function deleteMusic(id) {
    try {
        await remove("musics", id);
        return true;
    } catch (err) {
        console.error("deleteMusic error", err);
        return false;
    }
}


// -------------------------------------------------------
// Exposed convenience: render initial lists on load
// -------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
    // initial render for the main list & playlist details
    refreshMusicListUI();
    refreshPlaylistDetailsUI();
});

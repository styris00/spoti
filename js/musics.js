// =====================================================
// musics.js — version propre mais affichage identique
// =====================================================

import { getAll, put } from "./db.js";
import { formatDurationShort, formatDurationLong } from "./utils.js";

// -----------------------------------------------------
//   Mise à jour des listes (appelé par ui.js)
// -----------------------------------------------------

export async function refreshMusicListUI() {
    const allMusics = await loadAllMusics();
    const filtered = await applyFiltersMainList(allMusics);
    renderMusicList(filtered);
    updateListCounters(filtered, "music-count", "total-duration");
}

export async function refreshMusicToRateUI() {
    const allMusics = await loadAllMusics();
    const toRate = filterToRate(allMusics);
    renderMusicToRateList(toRate);
    updateListCounters(toRate, "music-count-musics-to-rate", "total-duration-musics-to-rate");
}

export async function refreshPlaylistDetailsUI(playlistId) {
    const allMusics = await loadAllMusics();
    const inPlaylist = allMusics.filter(m => (m.playlistIds || []).includes(String(playlistId)));
    const filtered = await applyFiltersPlaylistDetails(inPlaylist);
    renderPlaylistDetails(filtered);
    updateListCounters(filtered, "playlist-music-count", "playlist-total-duration");
}

// -----------------------------------------------------
//   Chargement IndexedDB
// -----------------------------------------------------

async function loadAllMusics() {
    try {
        const all = await getAll("musics");
        return all.map(normalizeMusic);
    } catch (err) {
        console.error("IndexedDB loadAllMusics error:", err);
        return [];
    }
}

function normalizeMusic(m) {
    return {
        id: String(m.id),
        title: m.title || m.name || "",
        author: m.author || (m.artists ? m.artists.join(", ") : ""),
        album: m.album || "",
        duration: m.duration || m.duration_ms || 0,
        popularity: Number(m.popularity || 0),
        imageUrl: m.imageUrl || "",
        customFields: {
            energique: m.customFields?.energique ?? null,
            joyeuse: m.customFields?.joyeuse ?? null,
            musicale: m.customFields?.musicale ?? null,
            heart: m.customFields?.heart ?? 0
        },
        playlistIds: m.playlistIds || []
    };
}

// -----------------------------------------------------
//   FILTRAGE (identique à ton ancienne logique)
// -----------------------------------------------------

async function applyFiltersMainList(list) {
    const title = (document.getElementById("title-filter")?.value || "").toLowerCase();
    const album = (document.getElementById("album-filter")?.value || "").toLowerCase();
    const author = (document.getElementById("author-filter")?.value || "").toLowerCase();
    const sortByPopularity = document.getElementById("sort-by-popularity")?.value || "no";

    let filtered = list.filter(m => {
        if (title && !m.title.toLowerCase().includes(title)) return false;
        if (album && !m.album.toLowerCase().includes(album)) return false;
        if (author && !m.author.toLowerCase().includes(author)) return false;
        return true;
    });

    if (sortByPopularity === "croissant") {
        filtered.sort((a, b) => a.popularity - b.popularity);
    } else if (sortByPopularity === "décroissant") {
        filtered.sort((a, b) => b.popularity - a.popularity);
    } else {
        filtered.sort((a, b) => b.id.localeCompare(a.id)); // ordre décroissant
    }

    return filtered;
}

function filterToRate(list) {
    return list.filter(m => {
        const f = m.customFields;
        return (
            !f.energique ||
            !f.joyeuse ||
            !f.musicale
        );
    });
}

async function applyFiltersPlaylistDetails(list) {
    const title = (document.getElementById("playlist-title-filter")?.value || "").toLowerCase();
    const album = (document.getElementById("playlist-album-filter")?.value || "").toLowerCase();
    const author = (document.getElementById("playlist-author-filter")?.value || "").toLowerCase();

    let filtered = list.filter(m => {
        if (title && !m.title.toLowerCase().includes(title)) return false;
        if (album && !m.album.toLowerCase().includes(album)) return false;
        if (author && !m.author.toLowerCase().includes(author)) return false;
        return true;
    });

    return filtered;
}

// -----------------------------------------------------
//   RENDU HTML (identique à ton ancien JS !)
// -----------------------------------------------------

function renderMusicList(list) {
    const container = document.getElementById("music-list");
    container.innerHTML = "";

    list.forEach(music => {
        const musicBox = document.createElement("div");
        musicBox.classList.add("music-box");

        musicBox.innerHTML = `
            <img src="${music.imageUrl}" alt="Illustration">
            <div class="music-info">
                <p class="music-titre">${music.title}</p>
                <p class="music-auteur">${music.author}</p>
            </div>
            <p class="music-duration">${formatDurationShort(music.duration)}</p>
            <button class="action-btn" data-id="${music.id}">⋮</button>
        `;

        container.appendChild(musicBox);
    });
}

function renderMusicToRateList(list) {
    const container = document.getElementById("music-to-rate-list");
    container.innerHTML = "";

    list.forEach(music => {
        const f = music.customFields;

        const musicBox = document.createElement("div");
        musicBox.classList.add("music-box-musics-to-rate");

        let html = `
            <div class="up-part-list-to-rate">
                <img src="${music.imageUrl}" alt="Illustration">
                <div class="music-info">
                    <p class="music-titre">${music.title}</p>
                    <p class="music-auteur">${music.author} (${music.album})</p>
                </div>
                <p class="music-duration">${formatDurationShort(music.duration)}</p>
                <button class="action-btn" data-id="${music.id}">⋮</button>
            </div>
            <div class="bottom-part-list-to-rate">
        `;

        const tags = ["Energique", "Joyeuse", "Musicale"];
        const keys = ["energique", "joyeuse", "musicale"];
        const options = ["0", "1", "1-2", "2", "1-3", "2-3", "3", "4"];

        keys.forEach((key, i) => {
            const value = f[key] ?? "0";

            html += `
                <div class="bottom-part-list-to-rate-div">
                    <p>${tags[i]}</p>
                    <select data-id="${music.id}" tag="${key}">
                        <option value="0" ${value === "0" ? "selected" : ""}>-</option>
            `;

            options.forEach(opt => {
                html += `<option value="${opt}" ${opt == value ? "selected" : ""}>${opt}</option>`;
            });

            html += `
                    </select>
                </div>
            `;
        });

        html += `<button class="validate-tags" data-id="${music.id}">✔</button>`;
        html += `</div>`;

        musicBox.innerHTML = html;
        container.appendChild(musicBox);

        // gestion bouton ✔
        musicBox.querySelector(".validate-tags").addEventListener("click", () => {
            const energ = container.querySelector(`select[data-id="${music.id}"][tag="energique"]`).value;
            const joy = container.querySelector(`select[data-id="${music.id}"][tag="joyeuse"]`).value;
            const mus = container.querySelector(`select[data-id="${music.id}"][tag="musicale"]`).value;

            updateMusicTags(music.id, energ, joy, mus);
            refreshMusicToRateUI();
        });
    });
}

function renderPlaylistDetails(list) {
    const container = document.getElementById("music-of-playlist-list");
    container.innerHTML = "";

    list.forEach(music => {
        const musicBox = document.createElement("div");
        musicBox.classList.add("music-box");

        musicBox.innerHTML = `
            <img src="${music.imageUrl}" alt="Illustration">
            <div class="music-info">
                <p class="music-titre">${music.title}</p>
                <p class="music-auteur">${music.author} (${music.album})</p>
            </div>
            <p class="music-duration">${formatDurationShort(music.duration)}</p>
            <button class="action-btn" data-id="${music.id}">⋮</button>
        `;

        container.appendChild(musicBox);
    });
}

// -----------------------------------------------------
//   Mise à jour DB (tags)
// -----------------------------------------------------

async function updateMusicTags(id, energique, joyeuse, musicale) {
    const all = await loadAllMusics();
    const m = all.find(x => x.id == id);
    if (!m) return;

    m.customFields.energique = energique;
    m.customFields.joyeuse = joyeuse;
    m.customFields.musicale = musicale;

    await put("musics", m);
}

// -----------------------------------------------------
//   Compteurs durée + nombre de titres
// -----------------------------------------------------

function updateListCounters(list, countId, durationId) {
    const count = document.getElementById(countId);
    const dur = document.getElementById(durationId);

    if (count) count.textContent = list.length;

    if (dur) {
        const totalMs = list.reduce((sum, m) => sum + m.duration, 0);
        dur.textContent = formatDurationLong(totalMs);
    }
}


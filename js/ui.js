// ======================================================
// ui.js — Gestion de l'interface utilisateur
// ======================================================

import { startAuth } from "./auth.js";
import { initDB } from "./db.js";
import {
    loadUserPlaylists,
    importPlaylistTracks,
    openPlaylistDetails,
    exportSelectedToSpotify
} from "./playlists.js";

import {
    refreshMusicListUI,
    refreshPlaylistDetailsUI,
    clearFiltersMainList,
    clearFiltersPlaylistDetails
} from "./musics.js";

// ======================================================
//                INITIALISATION GLOBALE
// ======================================================

export async function initUI() {
    await initDB();
    bindNavigation();
    bindGlobalButtons();
    bindFiltersMainList();
    bindFiltersPlaylistDetails();
}


// ======================================================
//                         NAVIGATION
// ======================================================

function bindNavigation() {
    const buttons = document.querySelectorAll(".nav-btn");

    buttons.forEach((btn) => {
        btn.addEventListener("click", () => {
            const target = btn.dataset.section;
            showSection(target);

            buttons.forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
        });
    });
}

function showSection(id) {
    document.querySelectorAll(".section").forEach((sec) => {
        sec.classList.remove("active");
    });

    const section = document.getElementById(id);
    if (section) section.classList.add("active");
}


// ======================================================
//                   BOUTONS GLOBAUX
// ======================================================

function bindGlobalButtons() {
    // Connexion Spotify
    document.getElementById("spotify-login")?.addEventListener("click", startAuth);

    // Charger playlists Spotify (section IMPORT)
    document.getElementById("playlist-select")?.addEventListener("mousedown", loadUserPlaylists);

    // Importer les musiques d’une playlist sélectionnée
    document.getElementById("import-musics")?.addEventListener("click", async () => {
        const playlistId = document.getElementById("playlist-select").value;
        if (!playlistId) return alert("Sélectionner une playlist");

        await importPlaylistTracks(playlistId);
        refreshMusicListUI();
        alert("Import terminé !");
    });

    // Créer playlist Spotify à partir des musiques importées
    document
        .getElementById("create-spotify-playlist-musics-to-rate")
        ?.addEventListener("click", exportSelectedToSpotify);

    // Sauvegarde DB
    document.getElementById("save-db-btn")?.addEventListener("click", () => {
        const event = new CustomEvent("exportDB");
        window.dispatchEvent(event);
    });

    // Restauration DB
    document.getElementById("restore-db-btn")?.addEventListener("click", () => {
        document.getElementById("restore-db-input").click();
    });
}


// ======================================================
//           FILTRES PRINCIPAUX (section LIST)
// ======================================================

function bindFiltersMainList() {
    const title = document.getElementById("title-filter");
    const album = document.getElementById("album-filter");
    const artist = document.getElementById("author-filter");

    const buttonsClear = [
        { id: "empty-input-1", input: title },
        { id: "empty-input-2", input: album },
        { id: "empty-input-3", input: artist }
    ];

    buttonsClear.forEach(({ id, input }) => {
        document.getElementById(id)?.addEventListener("click", () => {
            input.value = "";
            refreshMusicListUI();
        });
    });

    // Filtres texte
    [title, album, artist].forEach((input) => {
        input?.addEventListener("input", refreshMusicListUI);
    });

    // Tri popularité
    document.getElementById("sort-by-popularity")?.addEventListener("change", refreshMusicListUI);

    // Selects "hearts"
    ["select-title-hearts", "select-album-hearts", "select-author-hearts"].forEach((id) => {
        document.getElementById(id)?.addEventListener("change", refreshMusicListUI);
    });

    // Tags énergique / joyeuse / musicale
    [
        "min-select-energique",
        "max-select-energique",
        "min-select-joyeuse",
        "max-select-joyeuse",
        "min-select-musicale",
        "max-select-musicale"
    ].forEach((id) => {
        document.getElementById(id)?.addEventListener("change", refreshMusicListUI);
    });

    // Créer playlist à partir du filtre
    document
        .getElementById("create-app-playlist")
        ?.addEventListener("click", exportSelectedToSpotify);
}


// ======================================================
//           FILTRES PLAYLIST-DETAILS
// ======================================================

function bindFiltersPlaylistDetails() {
    const fields = [
        "playlist-title-filter",
        "playlist-album-filter",
        "playlist-author-filter",
        "playlist-select-title-hearts",
        "playlist-select-album-hearts",
        "playlist-select-author-hearts",
        "playlist-sort-by-popularity",
        "playlist-min-select-energique",
        "playlist-max-select-energique",
        "playlist-min-select-joyeuse",
        "playlist-max-select-joyeuse",
        "playlist-min-select-musicale",
        "playlist-max-select-musicale"
    ];

    fields.forEach((id) => {
        document.getElementById(id)?.addEventListener("input", refreshPlaylistDetailsUI);
        document.getElementById(id)?.addEventListener("change", refreshPlaylistDetailsUI);
    });

    // Bouton action playlist
    document.getElementById("playlist-action")?.addEventListener("click", exportSelectedToSpotify);
}


// ======================================================
//              AFFICHAGE DES PLAYLISTS
// ======================================================

export function displayPlaylists(playlists) {
    const container = document.getElementById("playlist-list");

    container.innerHTML = playlists
        .map(
            (pl) => `
        <div class="playlist-item" data-id="${pl.id}">
            <strong>${pl.name}</strong><br>
            <small>${pl.tracks.total} titres</small>
        </div>`
        )
        .join("");

    // Bind clic playlist
    document.querySelectorAll(".playlist-item").forEach((item) => {
        item.addEventListener("click", () => {
            openPlaylistDetails(item.dataset.id);
        });
    });
}

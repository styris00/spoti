// ui.js
// Gestion de l'interface utilisateur + gestion complète du flux OAuth

import { startAuth, handleAuthCallback, getValidAccessToken } from "./auth.js";
import { initDB, getAll as dbGetAll } from "./db.js";
import {
  loadUserPlaylists,
  importPlaylistTracks,
  openPlaylistDetails,
  exportDisplayedToSpotify
} from "./playlists.js";
import {
  refreshMusicListUI,
  refreshMusicToRateUI,
  refreshPlaylistDetailsUI
} from "./musics.js";


// ============================================================
//  POINT D’ENTRÉE : appelé depuis <script type="module"> dans index.html
// ============================================================

export async function bootstrapApp() {

  console.log("Bootstrapping App…");

  // 1) PRIORITÉ ABSOLUE : si Spotify vient de renvoyer ?code=…
  const isCallback = await handleAuthCallback();

  if (!isCallback) {
    // 2) Sinon → vérifier le token en localStorage
    let token = localStorage.getItem("spotify_access_token");
    let expires = parseInt(localStorage.getItem("spotify_token_expire_at") || "0", 10);

    if (!token || Date.now() > expires) {
      console.log("No valid token → redirect to Spotify login");
      return startAuth(); // IMPORTANT : ne JAMAIS continuer plus loin
    }
  }

  // 3) Récupère un token valide (refresh auto si besoin)
  await getValidAccessToken();

  // 4) Quand tout est OK → chargement de l'UI
  console.log("Token ready → launching UI");
  await initUI();
}



// ============================================================
//  INITIALISATION DE L’UI (pas appelée directement dans index.html !)
// ============================================================

export async function initUI() {
  console.log("Initializing UI…");

  await initDB();

  bindNavigation();
  bindButtons();
  bindFilterShortcuts();

  // Render initial lists
  refreshMusicListUI();
  refreshMusicToRateUI();
  refreshPlaylistDetailsUI(getCurrentPlaylistIdFromTitle());
}



// ============================================================
//  NAVIGATION
// ============================================================

function bindNavigation() {
  const buttons = document.querySelectorAll(".nav-btn");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.section;
      if (!target) return;

      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
      document.getElementById(target)?.classList.add("active");
    });
  });
}



// ============================================================
//  BOUTONS GLOBAUX
// ============================================================

function bindButtons() {

  // --- Auth Spotify ---
  document.getElementById("spotify-login")?.addEventListener("click", () => startAuth());

  // --- Charger playlists utilisateur ---
  const playlistSelect = document.getElementById("playlist-select");
  if (playlistSelect) {
    playlistSelect.addEventListener("mousedown", async () => {
      await loadUserPlaylists();
    });
  }

  // --- Importer playlist Spotify → IndexedDB ---
  document.getElementById("import-musics")?.addEventListener("click", async () => {
    const sel = document.getElementById("playlist-select");
    if (!sel || !sel.value) return alert("Sélectionner une playlist à importer.");
    await importPlaylistTracks(sel.value);
    refreshMusicListUI();
    refreshMusicToRateUI();
    alert("Import terminé.");
  });

  // --- Export musics-to-rate vers Spotify ---
  document.getElementById("create-spotify-playlist-musics-to-rate")?.addEventListener("click", async () => {
    await exportDisplayedToSpotify("#music-to-rate-list");
  });

  // --- Export musics list vers Spotify ---
  document.getElementById("create-app-playlist")?.addEventListener("click", async () => {
    await exportDisplayedToSpotify("#music-list");
  });

  // --- Aperçu DB ---
  document.getElementById("show-database-content")?.addEventListener("click", async () => {
    const all = await dbGetAll("musics");
    console.log("IndexedDB musics preview:", all.slice(0, 200));
    alert(`IndexedDB contient ${all.length} musiques (voir console).`);
  });

  // --- Save / Restore DB ---
  document.getElementById("save-db-btn")?.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("save-db-request"));
  });

  document.getElementById("restore-db-btn")?.addEventListener("click", () => {
    document.getElementById("restore-db-input")?.click();
  });

  document.getElementById("restore-db-input")?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) window.dispatchEvent(new CustomEvent("restore-db-file", { detail: file }));
  });

  // --- Playlist details (click delegation) ---
  document.getElementById("playlist-list")?.addEventListener("click", (ev) => {
    const el = ev.target.closest(".playlist-item");
    if (!el) return;
    const spotifyId = el.dataset.spotifyId || el.dataset.id;
    if (spotifyId) {
      openPlaylistDetails(spotifyId);
      document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
      const nav = [...document.querySelectorAll(".nav-btn")].find(b => b.dataset.section === "playlists");
      nav?.classList.add("active");
      document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
      document.getElementById("playlist-details")?.classList.add("active");
    }
  });
}



// ============================================================
//  FILTRES
// ============================================================

function bindFilterShortcuts() {

  // Clear inputs in main list
  ["empty-input-1", "empty-input-2", "empty-input-3"].forEach((btnId, i) => {
    const ids = ["title-filter", "album-filter", "author-filter"];
    document.getElementById(btnId)?.addEventListener("click", () => {
      document.getElementById(ids[i]).value = "";
      refreshMusicListUI();
    });
  });

  // Filters that refresh main list
  [
    "title-filter", "album-filter", "author-filter",
    "select-title-hearts", "select-album-hearts", "select-author-hearts",
    "min-select-energique", "max-select-energique",
    "min-select-joyeuse", "max-select-joyeuse",
    "min-select-musicale", "max-select-musicale",
    "sort-by-popularity"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", refreshMusicListUI);
      el.addEventListener("change", refreshMusicListUI);
    }
  });

  // Filters for playlist details
  [
    "playlist-title-filter", "playlist-album-filter", "playlist-author-filter",
    "playlist-select-title-hearts", "playlist-select-album-hearts", "playlist-select-author-hearts",
    "playlist-min-select-energique", "playlist-max-select-energique",
    "playlist-min-select-joyeuse", "playlist-max-select-joyeuse",
    "playlist-min-select-musicale", "playlist-max-select-musicale",
    "playlist-sort-by-popularity"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", () => refreshPlaylistDetailsUI(getCurrentPlaylistIdFromTitle()));
      el.addEventListener("change", () => refreshPlaylistDetailsUI(getCurrentPlaylistIdFromTitle()));
    }
  });
}



// ============================================================
//  HELPERS
// ============================================================

function getCurrentPlaylistIdFromTitle() {
  const titre = document.getElementById("titre-playlist");
  return titre?.dataset.spotifyId || titre?.dataset.id || null;
}

// playlists.js
// Import / export des playlists entre Spotify et IndexedDB

import { apiGet, apiPost } from "./spotify-api.js";
import { getAll as dbGetAll, bulkPut, get as dbGet, put as dbPut } from "./db.js";
import { formatDurationShort } from "./utils.js";

// Exports attendus
export async function loadUserPlaylists() {
  try {
    const data = await apiGet("https://api.spotify.com/v1/me/playlists?limit=50");
    if (!data || !data.items) return [];

    // Remplir le <select id="playlist-select">
    const sel = document.getElementById("playlist-select");
    if (sel) {
      // Keep the default option
      const prevValue = sel.value;
      sel.innerHTML = `<option value="">-- Sélectionner une playlist --</option>`;
      data.items.forEach(pl => {
        const opt = document.createElement("option");
        opt.value = pl.id;
        opt.textContent = `${pl.name} (${pl.tracks.total})`;
        sel.appendChild(opt);
      });
      // restore selection if possible
      sel.value = prevValue || "";
    }

    // Remplir la liste des playlists (section playlists)
    const listContainer = document.getElementById("playlist-list");
    if (listContainer) {
      listContainer.innerHTML = data.items.map(pl => {
        // keep data attributes for click delegation
        return `<div class="playlist-item" data-spotify-id="${pl.id}"><strong>${escapeHtml(pl.name)}</strong><br><small>${pl.tracks.total} titres</small></div>`;
      }).join("");
    }

    return data.items;
  } catch (err) {
    console.error("loadUserPlaylists error", err);
    return [];
  }
}

export async function importPlaylistTracks(playlistId) {
  if (!playlistId) return false;
  try {
    const pageSize = 100;
    let offset = 0;
    let allTracks = [];

    while (true) {
      const page = await apiGet(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?offset=${offset}&limit=${pageSize}`);
      if (!page || !page.items) break;

      // Map Spotify API track object to our DB shape (minimal)
      const tracks = page.items
        .filter(item => item.track) // parfois track peut être null
        .map(item => {
          const t = item.track;
          return {
            id: t.id || t.uri || `${t.uri}`,
            title: t.name || "",
            author: Array.isArray(t.artists) ? t.artists.map(a => a.name).join(", ") : (t.artists?.name || ""),
            album: t.album?.name || "",
            duration: t.duration_ms || 0,
            popularity: t.popularity || 0,
            imageUrl: t.album?.images?.[0]?.url || "",
            uri: t.uri || (t.id ? `spotify:track:${t.id}` : null),
            playlistIds: [String(playlistId)],
            customFields: {
              energique: null,
              joyeuse: null,
              musicale: null,
              heart: 0
            }
          };
        });

      allTracks = allTracks.concat(tracks);

      // next page?
      if (!page.next || page.items.length < pageSize) break;
      offset += pageSize;
    }

    // Bulk insert/update into IndexedDB
    if (allTracks.length) {
      await bulkPut("musics", allTracks);
    }

    return true;
  } catch (err) {
    console.error("importPlaylistTracks error", err);
    return false;
  }
}

export async function openPlaylistDetails(playlistId) {
  if (!playlistId) return;
  try {
    // Fetch playlist metadata to set title
    const pl = await apiGet(`https://api.spotify.com/v1/playlists/${playlistId}`);
    const titre = document.getElementById("titre-playlist");
    if (titre) {
      titre.textContent = pl?.name || "Détails playlist";
      titre.dataset.spotifyId = playlistId;
    }

    // Trigger UI refresh of playlist details (musics module)
    // musics.refreshPlaylistDetailsUI expects playlistId param (we call with id)
    // Instead of import cycle, dispatch a custom event that musics.js listens to.
    window.dispatchEvent(new CustomEvent("playlist-opened", { detail: { playlistId } }));
  } catch (err) {
    console.error("openPlaylistDetails error", err);
  }
}

/**
 * exportDisplayedToSpotify(selector)
 * - selector: container selector (e.g. "#music-list" or "#music-to-rate-list")
 * - reads visible .music-box elements, extracts data-id, finds their uri in DB and creates a playlist + fills it
 */
export async function exportDisplayedToSpotify(selector = "#music-list") {
  try {
    // find displayed music ids in the container
    const container = document.querySelector(selector);
    if (!container) return alert("Aucune musique affichée.");

    const visibleBoxes = Array.from(container.querySelectorAll(".music-box, .music-box-musics-to-rate"));
    if (!visibleBoxes.length) return alert("Aucune musique affichée.");

    // collect ids
    const ids = visibleBoxes.map(box => box.querySelector(".action-btn")?.getAttribute("data-id") || box.dataset.id).filter(Boolean);

    // fetch DB entries for these ids
    const all = await dbGetAll("musics");
    const mapById = new Map(all.map(m => [String(m.id), m]));
    const uris = ids.map(id => {
      const m = mapById.get(String(id));
      if (!m) return null;
      return m.uri || (m.id ? `spotify:track:${m.id}` : null);
    }).filter(Boolean);

    if (!uris.length) return alert("Aucune URI Spotify trouvée pour ces pistes.");

    // create playlist
    const me = await apiGet("https://api.spotify.com/v1/me");
    const userId = me?.id;
    if (!userId) return alert("Impossible de récupérer l'utilisateur Spotify.");

    const name = `Spoti++ export ${new Date().toISOString().slice(0,19).replace("T"," ")}`;
    const newPl = await apiPost(`https://api.spotify.com/v1/users/${userId}/playlists`, {
      name,
      description: "Playlist générée depuis Spoti++",
      public: false
    });

    const playlistId = newPl?.id;
    if (!playlistId) return alert("Impossible de créer la playlist Spotify.");

    // Add tracks in chunks (Spotify max 100 per request; use 90 for safety)
    const chunkSize = 90;
    for (let i = 0; i < uris.length; i += chunkSize) {
      const chunk = uris.slice(i, i + chunkSize);
      await apiPost(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, { uris: chunk });
    }

    alert(`Playlist créée : ${name} (${uris.length} titres)`);
    return true;
  } catch (err) {
    console.error("exportDisplayedToSpotify error", err);
    alert("Erreur lors de l'export vers Spotify (voir console).");
    return false;
  }
}

// small helper
function escapeHtml(s){ return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

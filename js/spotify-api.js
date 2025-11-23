// =====================================
// spotify-api.js — Wrapper API Spotify
// =====================================

import { getValidAccessToken } from "./auth.js";


// =====================================
//         Appel API générique GET
// =====================================

export async function apiGet(url) {
    let token = await getValidAccessToken();

    let response = await fetch(url, {
        headers: { "Authorization": `Bearer ${token}` }
    });

    // Token expiré → refresh → retry
    if (response.status === 401) {
        token = await getValidAccessToken();
        response = await fetch(url, {
            headers: { "Authorization": `Bearer ${token}` }
        });
    }

    return await response.json();
}


// =====================================
//        Appel API générique POST
// =====================================

export async function apiPost(url, body = {}) {
    let token = await getValidAccessToken();

    let response = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    if (response.status === 401) {
        token = await getValidAccessToken();
        response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });
    }

    return await response.json();
}


// =====================================
//               PUT
// =====================================

export async function apiPut(url, body = {}) {
    let token = await getValidAccessToken();

    let response = await fetch(url, {
        method: "PUT",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    if (response.status === 401) {
        token = await getValidAccessToken();
        response = await fetch(url, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });
    }

    return await response.json().catch(() => ({ success: response.ok }));
}


// =====================================
//       Exemples pratiques intégrés
// =====================================

export async function fetchUserPlaylists() {
    return await apiGet(`https://api.spotify.com/v1/me/playlists?limit=50`);
}

export async function fetchPlaylistTracks(playlistId, offset = 0, limit = 100) {
    return await apiGet(
        `https://api.spotify.com/v1/playlists/${playlistId}/tracks?offset=${offset}&limit=${limit}`
    );
}

export async function createPlaylist(userId, name, description = "") {
    return await apiPost(`https://api.spotify.com/v1/users/${userId}/playlists`, {
        name,
        description,
        public: false
    });
}

export async function addTracksToPlaylist(playlistId, uris) {
    return await apiPost(
        `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
        { uris }
    );
}

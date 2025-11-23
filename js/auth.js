// ===============================
//  auth.js — Gestion OAuth 2.0 + PKCE
// ===============================

// ---- Configuration Spotify ----
const CLIENT_ID = "90fc7089b14747f58ec11b9607ee63ac";   // Ton Client ID
const REDIRECT_URI = "https://styris00.github.io/spoti/"; // Ton redirect URI
const SCOPES = [
    "playlist-read-private",
    "playlist-read-collaborative",
    "playlist-modify-private",
    "playlist-modify-public",
    "user-read-email",
    "user-read-playback-state",
    "user-modify-playback-state",
    "streaming"
].join(" ");


// ============================================================
//               GÉNÉRATION PKCE (verifier + challenge)
// ============================================================

function generateRandomString(length = 128) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(buffer) {
    const data = new TextEncoder().encode(buffer);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return btoa(String.fromCharCode(...new Uint8Array(hash)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}


// ============================================================
//            Lancer l’authentification Spotify
// ============================================================

export async function startAuth() {
    const codeVerifier = generateRandomString(64);
    localStorage.setItem("pkce_code_verifier", codeVerifier);

    const codeChallenge = await sha256(codeVerifier);

    const authUrl =
        "https://accounts.spotify.com/authorize?" +
        new URLSearchParams({
            client_id: CLIENT_ID,
            response_type: "code",
            redirect_uri: REDIRECT_URI,
            scope: SCOPES,
            code_challenge_method: "S256",
            code_challenge: codeChallenge
        });

    window.location.href = authUrl;
}


// ============================================================
//      Traitement du CALLBACK (Spotify → ton application)
// ============================================================

export async function handleAuthCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (!code) return false; // Aucun code dans l’URL → pas un callback Spotify

    const codeVerifier = localStorage.getItem("pkce_code_verifier");

    const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        code_verifier: codeVerifier
    });

    const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body
    });

    const data = await response.json();

    if (data.error) {
        console.error("Erreur auth Spotify :", data);
        return false;
    }

    storeTokens(data);

    // Nettoie l’URL
    history.replaceState({}, "", REDIRECT_URI);

    return true;
}


// ============================================================
//                Stockage & manipulation des tokens
// ============================================================

function storeTokens(data) {
    localStorage.setItem("spotify_access_token", data.access_token);
    localStorage.setItem("spotify_refresh_token", data.refresh_token || localStorage.getItem("spotify_refresh_token"));
    localStorage.setItem("spotify_token_expire_at", String(Date.now() + data.expires_in * 1000));
}


export function getStoredToken() {
    return localStorage.getItem("spotify_access_token");
}


// ============================================================
//                        REFRESH TOKEN
// ============================================================

async function refreshAccessToken() {
    const refreshToken = localStorage.getItem("spotify_refresh_token");
    if (!refreshToken) {
        console.warn("Aucun refresh_token → redirection login Spotify");
        return startAuth();
    }

    const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: CLIENT_ID
    });

    const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body
    });

    const data = await response.json();

    if (data.error) {
        console.error("Impossible de refresh le token", data);
        return startAuth();
    }

    storeTokens(data);
    return data.access_token;
}


// ============================================================
//           Obtenir un access token valide automatiquement
// ============================================================

export async function getValidAccessToken() {
    const token = localStorage.getItem("spotify_access_token");
    const expiresAt = parseInt(localStorage.getItem("spotify_token_expire_at"), 10);

    if (token && Date.now() < expiresAt - 60 * 1000) {
        return token; // Token encore valide
    }

    return await refreshAccessToken();
}

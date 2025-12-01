// ===============================
//  auth.js — OAuth 2.0 PKCE (Version stable GitHub Pages)
// ===============================

// Doit être EXACTEMENT identique à celui du Dashboard Spotify
const CLIENT_ID = "90fc7089b14747f58ec11b9607ee63ac";
const REDIRECT_URI = "https://styris00.github.io/spoti/";   // SLASH FINAL OBLIGATOIRE !!!

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
// PKCE utils
// ============================================================

function generateRandomString(length = 64) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return [...array].map(v => v.toString(16).padStart(2, "0")).join("");
}

async function sha256(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hash = await crypto.subtle.digest("SHA-256", data);
    const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}


// ============================================================
// Lancer l’authentification
// ============================================================

export async function startAuth() {
    const codeVerifier = generateRandomString(64);
    localStorage.setItem("pkce_code_verifier", codeVerifier);

    const codeChallenge = await sha256(codeVerifier);

    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        response_type: "code",
        redirect_uri: REDIRECT_URI,
        scope: SCOPES,
        code_challenge_method: "S256",
        code_challenge: codeChallenge
    });

    window.location.href =
        "https://accounts.spotify.com/authorize?" + params.toString();
}


// ============================================================
// Traiter le retour Spotify (?code=…)
// ============================================================

export async function handleAuthCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    // Pas un retour OAuth
    if (!code) return false;

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
        console.error("Spotify OAuth error:", data);
        return false;
    }

    storeTokens(data);

    // Nettoie l’URL (GitHub Pages-friendly)
    history.replaceState({}, "", REDIRECT_URI);

    console.log("OAuth OK ✓");
    return true;
}


// ============================================================
// Stockage des tokens
// ============================================================

function storeTokens(data) {
    localStorage.setItem("spotify_access_token", data.access_token);

    if (data.refresh_token) {
        localStorage.setItem("spotify_refresh_token", data.refresh_token);
    }

    localStorage.setItem(
        "spotify_token_expire_at",
        Date.now() + data.expires_in * 1000
    );
}

export function getStoredToken() {
    return localStorage.getItem("spotify_access_token");
}


// ============================================================
// Refresh token
// ============================================================

async function refreshAccessToken() {
    const refreshToken = localStorage.getItem("spotify_refresh_token");

    if (!refreshToken) {
        console.warn("Pas de refresh token → nouvelle auth");
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
        console.warn("Impossible de refresh le token:", data);
        return startAuth();
    }

    storeTokens(data);
    return data.access_token;
}


// ============================================================
// Obtenir automatiquement un access_token valide
// ============================================================

export async function getValidAccessToken() {
    const token = localStorage.getItem("spotify_access_token");
    const expiresAt = parseInt(
        localStorage.getItem("spotify_token_expire_at") || "0",
        10
    );

    if (token && Date.now() < expiresAt - 10_000) {
        return token; // encore valable
    }

    // sinon refresh
    return await refreshAccessToken();
}

// utils.js
// Fonctions utilitaires générales utilisées par toute l'application

// ---------------------------------------------------------
// Durées
// ---------------------------------------------------------

export function formatDurationShort(ms) {
    if (!ms || ms <= 0) return "0:00";
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = String(totalSec % 60).padStart(2, "0");
    return `${min}:${sec}`;
}

export function formatDurationLong(ms) {
    if (!ms || ms <= 0) return "0 min";
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);

    if (h > 0) return `${h} h ${m} min`;
    return `${m} min`;
}

// ---------------------------------------------------------
// Debounce
// ---------------------------------------------------------

export function debounce(fn, delay = 250) {
    let timer = null;
    return (...args) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

// ---------------------------------------------------------
// Shuffle
// ---------------------------------------------------------

export function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// ---------------------------------------------------------
// HTML escaping
// ---------------------------------------------------------

export function escapeHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// ---------------------------------------------------------
// JSON file helpers
// ---------------------------------------------------------

export function downloadFile(filename, content) {
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    URL.revokeObjectURL(url);
    a.remove();
}

export function saveJSON(filename, obj) {
    downloadFile(filename, JSON.stringify(obj, null, 2));
}

export function readFileAsJSON(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error);
        reader.onload = () => {
            try {
                const data = JSON.parse(reader.result);
                resolve(data);
            } catch (e) {
                reject(e);
            }
        };
        reader.readAsText(file);
    });
}

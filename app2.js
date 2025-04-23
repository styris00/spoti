// Service Worker pour avoir une web app native indépendante installable
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(() => console.log('Service Worker registered'))
    .catch(error => console.log('SW registration failed:', error));
}

// ==============================================
// Navigation entre les sections de l'application
// ==============================================

document.querySelectorAll('.nav-btn').forEach(button => {
    button.addEventListener('click', () => {
        // Supprime les classes "active" des boutons et sections
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));

        // Active le bouton et la section correspondants
        button.classList.add('active');
        const sectionId = button.getAttribute('data-section');
        document.getElementById(sectionId).classList.add('active');

        // Met à jour les affichages du chaque liste dans chaque PAGE
        displayMusics();
        displayMusicsToRate();
        displayPlaylists();
    });
});



// ==============================================
// Gestion de IndexedDB
// ==============================================
let db;


// ==================== Configuration de IndexedDB ====================

// Configuration et ouverture de la base IndexedDB
const request = indexedDB.open('SpotifyAppDB', 1);

// Ceci est appelé lors de la première création de la base IndexedDB (ou si il y a une mise à jour de version de IndexedDB)
request.onupgradeneeded = event => {
    db = event.target.result;

    // Musiques
    if (!db.objectStoreNames.contains('musics')) {
        const musicStore = db.createObjectStore('musics', { keyPath: 'id'});
        musicStore.createIndex('title', 'title', { unique: false });
        musicStore.createIndex('author', 'author', { unique: false });
        musicStore.createIndex('customFields', 'customFields', { unique: false });
    }

    // Albums
    if (!db.objectStoreNames.contains('albums')) {
        const albumStore = db.createObjectStore('albums', { keyPath: 'id' });
        albumStore.createIndex('title', 'title', { unique: false });  // A MODIFIER
        albumStore.createIndex('release_date', 'release_date', { unique: false });  // A MODIFIER
        albumStore.createIndex('artist_id', 'artist_id', { unique: false }); // Association avec un artiste
    }

    // Artistes
    if (!db.objectStoreNames.contains('artists')) {
        const artistStore = db.createObjectStore('artists', { keyPath: 'id' });
        artistStore.createIndex('name', 'name', { unique: true });
        artistStore.createIndex('genre', 'genre', { unique: false });  // A MODIFIER
    }
    // Playlists
    if (!db.objectStoreNames.contains('playlists')) {
        const artistStore = db.createObjectStore('playlists', { keyPath: 'id', autoIncrement: true});
        artistStore.createIndex('name', 'name', { unique: true });
        artistStore.createIndex('genre', 'genre', { unique: false });  // A MODIFIER
    }
};

// Ceci est appelé lors d'un démarrage correct de la base de donnée
request.onsuccess = event => {
    db = event.target.result;
    console.log('IndexedDB initialisé');
    // Vérifier et mettre à jour les popularités si nécessaire
    updatePopularityDaily();
    // Affiche les musiques dès que la base est prête
    displayMusics();
    displayMusicsToRate();
    displayPlaylists();
};

// Ceci est appelé lors d'un démarrage incorrect de la base de donnée
request.onerror = event => {
    console.error('Erreur IndexedDB :', event.target.error);
};

// Fonction qui met à jour, tous les jours, toutes les "popularity" (artists, albums, musics)
// Appelée par "request.onsuccess" lorsque la base de données est correctement lancée (au démarrage de l'appli)
// Fait appel à updatePopularityInIndexedDB()
async function updatePopularityDaily() {
    const lastUpdateKey = 'lastPopularityUpdate';
    const currentDate = new Date().toISOString().split('T')[0]; // Format : YYYY-MM-DD

    // Vérifier la dernière date de mise à jour
    const lastUpdateDate = localStorage.getItem(lastUpdateKey);

    if (lastUpdateDate === currentDate) {
        console.log("Les popularités sont déjà à jour pour aujourd'hui.");
        return; // Pas besoin de mettre à jour
    }

    console.log("Mise à jour des popularités...");
    await updatePopularityInIndexedDB();

    // Enregistrer la date de mise à jour actuelle
    localStorage.setItem(lastUpdateKey, currentDate);
    console.log("Mise à jour des popularités terminée.");
}


// ==================== Ajouts dans IndexedDB ====================

// Ajouter une musique dans IndexedDB
function addMusicToIndexedDB(music) {
    const transaction = db.transaction('musics', 'readwrite');
    const objectStore = transaction.objectStore('musics');
    objectStore.add(music);
}

// Ajouter un album dans IndexedDB
function addAlbumToIndexedDB(album) {
    const transaction = db.transaction('albums', 'readwrite');
    const objectStore = transaction.objectStore('albums');
    objectStore.add(album);
}

// Ajouter un artiste dans IndexedDB
function addArtistToIndexedDB(artist) {
    const transaction = db.transaction('artists', 'readwrite');
    const objectStore = transaction.objectStore('artists');
    objectStore.add(artist);
}

// Ajouter une playlist dans IndexedDB
function addPlaylistToIndexedDB(playlist) {
    const transaction = db.transaction('playlists', 'readwrite');
    const objectStore = transaction.objectStore('playlists');
    objectStore.add(playlist);
}

// Vérifier si une musique existe dans IndexedDB
function isMusicInIndexedDB(musicId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('musics', 'readonly');
        const objectStore = transaction.objectStore('musics');
        const request = objectStore.get(musicId);

        request.onsuccess = () => resolve(request.result !== undefined);
        request.onerror = event => reject(event.target.error);
    });
}

// Vérifier si un album existe dans IndexedDB
function isAlbumInIndexedDB(albumId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('albums', 'readonly');
        const objectStore = transaction.objectStore('albums');
        const request = objectStore.get(albumId);

        request.onsuccess = () => resolve(request.result !== undefined);
        request.onerror = event => reject(event.target.error);
    });
}

// Vérifier si un artiste existe dans IndexedDB
function isArtistInIndexedDB(artistId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('artists', 'readonly');
        const objectStore = transaction.objectStore('artists');
        const request = objectStore.get(artistId);

        request.onsuccess = () => resolve(request.result !== undefined);
        request.onerror = event => reject(event.target.error);
    });
}

// Comparer et ajouter des musiques, albums, et artistes dans IndexedDB
// (Les json sont traités par les fonctions "Fetch" avant d'être ajoutés)
async function compareAndAddMusics(tracks) {
    for (const track of tracks) {

        // Vérifier et ajouter la musique
        const musicExists = await isMusicInIndexedDB(track.id);
        if (!musicExists) {
            const musicWithCustomFields = {
                ...track,
                customFields: {
                    heart: "none",
                    date_ajout: new Date(),
                },
            };
            addMusicToIndexedDB(musicWithCustomFields);
        }

        // Vérifier et ajouter l'album
        const albumExists = await isAlbumInIndexedDB(track.album_id);
        if (!albumExists) {
            try {
                const album = await fetchAlbum(track.album_id); // Récupérer l'album depuis l'API Spotify
                if (album) {
                    const albumWithCustomFields = {
                        ...album,
                        customFields: {
                            heart: "none",
                            date_ajout: new Date(),
                        },
                    };
                    addAlbumToIndexedDB(albumWithCustomFields); // Ajouter l'album dans IndexedDB
                }
            } catch (error) {
                console.error(`Erreur lors de la récupération de l'album ${track.album_id}:`, error);
            }
        }

        // Vérifier et ajouter les artistes
        const artistExists = await isArtistInIndexedDB(getOneArtist(track.author_id));
        if (!artistExists) {
            try {
                const artist = await fetchArtist(track.author_id); // Récupérer l'artiste depuis l'API Spotify
                if (artist) {
                    const artistWithCustomFields = {
                        ...artist,
                        customFields: {
                            heart: "none",
                            date_ajout: new Date(),
                        },
                    };
                    addArtistToIndexedDB(artistWithCustomFields); // Ajouter l'artiste dans IndexedDB
                }
            } catch (error) {
                console.error(`Erreur lors de la récupération de l'artiste ${track.author_id}:`, error);
            }
        }
    }

    console.log('Comparaison et ajout terminés.');
    displayMusics(); // Met à jour l'affichage après ajout
    displayMusicsToRate();
}

// Comparer une liste de musiques à IndexedDB et donne le nombre de musiques déjà connues
async function compareAndStatus(tracks) {
    let actuel = 0;
    for (const track of tracks) {
        const exists = await isMusicInIndexedDB(track.id);
        if (exists) {
            actuel = actuel + 1
        }
    }
    return {"actuel": actuel, "total": tracks.length}
}

// Fonction pour mettre à jour une musique dans IndexedDB avec certaines "updates" (json ? -> cf exemples)
function updateMusicInIndexedDB(musicId, updates) {
    const transaction = db.transaction('musics', 'readwrite');
    const objectStore = transaction.objectStore('musics');

    const request = objectStore.get(musicId);
    request.onsuccess = () => {
        const music = request.result;
        if (music) {
            // Gérer les champs imbriqués comme "customFields"
            if (music.customFields && updates.customFields) {
                music.customFields = {
                    ...music.customFields, // Conserve les anciens champs
                    ...updates.customFields // Ajoute ou remplace les nouveaux champs
                };
                delete updates.customFields; // Évite une double mise à jour
            }

            // Fusionner les autres propriétés
            Object.assign(music, updates);

            objectStore.put(music); // Sauvegarde la musique mise à jour
        }
    };

    request.onerror = (event) => {
        console.error('Erreur lors de la mise à jour de la musique :', event.target.error);
    };
}

// Fonction pour mettre à jour un album dans IndexedDB avec certaines "updates" (json ? -> cf exemples)
function updateAlbumInIndexedDB(albumId, updates) {
    const transaction = db.transaction('albums', 'readwrite');
    const objectStore = transaction.objectStore('albums');

    const request = objectStore.get(albumId);
    request.onsuccess = () => {
        const album = request.result;
        if (album) {
            // Si customFields existe déjà, fusionnez-le avec les nouvelles mises à jour
            if (album.customFields && updates.customFields) {
                album.customFields = {
                    ...album.customFields, // Conserve les anciens champs
                    ...updates.customFields // Ajoute ou remplace les nouveaux champs
                };
                delete updates.customFields; // Évitez une double mise à jour
            }

            // Fusionne les autres propriétés
            Object.assign(album, updates);

            // Sauvegarde l'album mis à jour
            objectStore.put(album);
        }
    };

    request.onerror = (event) => {
        console.error('Erreur lors de la mise à jour de l\'album :', event.target.error);
    };
}

// Fonction pour mettre à jour un artiste dans IndexedDB avec certaines "updates" (json ? -> cf exemples)
function updateArtistInIndexedDB(artistId, updates) {
    const transaction = db.transaction('artists', 'readwrite');
    const objectStore = transaction.objectStore('artists');

    const request = objectStore.get(artistId);
    request.onsuccess = () => {
        const artist = request.result;
        if (artist) {
            // Gérer les champs imbriqués si nécessaire (par exemple "customFields")
            if (artist.customFields && updates.customFields) {
                artist.customFields = {
                    ...artist.customFields, // Conserve les anciens champs
                    ...updates.customFields // Ajoute ou remplace les nouveaux champs
                };
                delete updates.customFields; // Évite une double mise à jour
            }

            // Fusionner les autres propriétés
            Object.assign(artist, updates);

            objectStore.put(artist); // Sauvegarde l'artiste mis à jour
        }
    };

    request.onerror = (event) => {
        console.error('Erreur lors de la mise à jour de l\'artiste :', event.target.error);
    };
}

// Fonction pour mettre à jour une playlist dans IndexedDB avec certaines "updates" (json ? -> cf exemples)
function updatePlaylistInIndexedDB(playlistId, updates) {
    const transaction = db.transaction('playlists', 'readwrite');
    const objectStore = transaction.objectStore('playlists');

    const request = objectStore.get(playlistId);
    request.onsuccess = () => {
        const playlist = request.result;
        if (playlist) {
            // Gérer les champs imbriqués si nécessaire (par exemple "customFields")
            if (playlist.criteria && updates.criteria) {
                playlist.criteria = {
                    ...playlist.criteria, // Conserve les anciens champs
                    ...updates.criteria // Ajoute ou remplace les nouveaux champs
                };
                delete updates.criteria; // Évite une double mise à jour
            }

            // Fusionner les autres propriétés
            Object.assign(playlist, updates);

            objectStore.put(playlist); // Sauvegarde l'artiste mis à jour
        }
    };

    request.onerror = (event) => {
        console.error('Erreur lors de la mise à jour de la playlist:', event.target.error);
    };
}

// Fonction pour supprimer des musiques dans IndexedDB
function deleteMusic(musicId) {
    const transaction = db.transaction('musics', 'readwrite');
    const objectStore = transaction.objectStore('musics');

    // Supprimer l'entrée par son ID
    const request = objectStore.delete(musicId);

    request.onsuccess = () => {
        // Optionnel : Actualiser la liste affichée
        displayMusics();
        displayMusicsToRate();
    };

    request.onerror = (event) => {
        console.error('Erreur lors de la suppression de la musique :', event.target.error);
    };
}

// Fonction pour supprimer des playlists dans IndexedDB
function deletePlaylist(playlistId) {
    const transaction = db.transaction('playlists', 'readwrite');
    const objectStore = transaction.objectStore('playlists');

    // Supprimer l'entrée par son ID
    const request = objectStore.delete(playlistId);

    request.onsuccess = () => {
        // Optionnel : Actualiser la liste affichée
        displayPlaylists();
    };

    request.onerror = (event) => {
        console.error('Erreur lors de la suppression de la playlist :', event.target.error);
    };
}

// Obtenir la musique de la base de données (asynchrone donc utiliser "const titre = await getMusicFromIndexedDB(music.id);")
function getMusicFromIndexedDB(titreId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('musics', 'readonly');
        const objectStore = transaction.objectStore('musics');
        const request = objectStore.get(titreId);

        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

// Obtenir l'album de la base de données (asynchrone donc utiliser "const album = await getAlbumFromIndexedDB(music.album_id);")
function getAlbumFromIndexedDB(albumId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('albums', 'readonly');
        const objectStore = transaction.objectStore('albums');
        const request = objectStore.get(albumId);

        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

// Obtenir l'artiste de la base de données (asynchrone donc utiliser "const artist = await getArtistFromIndexedDB(music.author_id);")
function getArtistFromIndexedDB(artistId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('artists', 'readonly');
        const objectStore = transaction.objectStore('artists');
        const request = objectStore.get(artistId);

        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

// Obtenir uniquement le premier artiste si plusieurs
function getOneArtist(artistId){
    // Extraire le premier artist_id si plusieurs sont présents
    const firstArtistId = artistId.split(',')[0].trim(); // On prend le premier ID d'artiste
    return firstArtistId
}

// Obtenir la playlist de la base de données (asynchrone donc utiliser "const titre = await getPlaylistFromIndexedDB(playlist.id);")
function getPlaylistFromIndexedDB(playlistId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('playlists', 'readonly');
        const objectStore = transaction.objectStore('playlists');
        const request = objectStore.get(Number(playlistId));

        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

// [DEBUG ONLY] Fonction pour récupérer et afficher les données d'IndexedDB
function showIndexedDBContent() { // [DEBUG ONLY]
    const transaction = db.transaction('musics', 'readonly');
    const objectStore = transaction.objectStore('musics');
    const request = objectStore.getAll(); // Récupère tous les enregistrements

    request.onsuccess = () => {
        const musics = request.result;
        console.log('Musiques de IndexedDB:', musics);
    };

    request.onerror = (event) => {
        console.error('Erreur lors de la récupération des données :', event.target.error);
    };

    const transaction2 = db.transaction('albums', 'readonly');
    const objectStore2 = transaction2.objectStore('albums');
    const request2 = objectStore2.getAll();

    request2.onsuccess = () => {
        console.log('Albums dans IndexedDB:', request2.result);
    };

    request2.onerror = event => {
        console.error('Erreur lors de la récupération des albums :', event.target.error);
    };

    const transaction3 = db.transaction('artists', 'readonly');
    const objectStore3 = transaction3.objectStore('artists');
    const request3 = objectStore3.getAll();

    request3.onsuccess = () => {
        console.log('Artistes dans IndexedDB:', request3.result);
    };

    request3.onerror = event => {
        console.error('Erreur lors de la récupération des artistes :', event.target.error);
    };

    const transaction4 = db.transaction('playlists', 'readonly');
    const objectStore4 = transaction4.objectStore('playlists');
    const request4 = objectStore4.getAll();

    request4.onsuccess = () => {
        console.log('Playlists dans IndexedDB:', request4.result);
    };

    request4.onerror = event => {
        console.error('Erreur lors de la récupération des playlists :', event.target.error);
    };
}

// [DEBUG ONLY] Connexion à l'interface : Ajouter un gestionnaire d'événement au bouton
document.getElementById('show-database-content').addEventListener('click', () => {
    showIndexedDBContent(); // [DEBUG ONLY]
});



// ==============================================
// Affichage et filtres des musiques
// ==============================================
let totalDuration; // accessible quand nécessaire dans le reste du code
let musicNumber; // accessible quand nécessaire dans le reste du code
let totalDuration_musicsToRate;
let musicNumber_musicsToRate; 

let isProgrammaticChange = false; // pour differencier les modifs faites par le programme et par l'utilisateur dans la PAGE DETAILS PLAYLIST
let playlistActuellementExaminee = null; // quelle PAGE DETAILS PLAYLIST est actuellement ouverte

// Formater la durée en "mm:ss"
function formatDurationShort(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// Formater la durée en "mm min ss s"
function formatDurationLong(seconds) {
    var jours = Math.floor(seconds / (3600*24));
    var heures = Math.floor((seconds - 24*3600*jours) / 3600);
    var mins = Math.floor((seconds- (3600 * (24*jours + heures))) / 60);
    var secs = Math.floor(seconds % 60);
    if (jours != 0){
        return `${jours} j ${heures} h`;
    }
    else {
        if (heures != 0){
            return `${heures} h ${mins} min`;
        } 
        else{
            return `${mins} min ${secs} s`;
        }
    }
}

// Fonction pour mélanger une liste d'éléments
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        // Obtenez un index aléatoire entre 0 et i
        const j = Math.floor(Math.random() * (i + 1));

        // Échangez les éléments array[i] et array[j]
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Fonction pour trier une liste de musiques par date (croissant ou décroissant)
function sortByDate(array, ordre = "décroissant") {
    return array.sort((a, b) => {
        let dateA;
        let dateB;
        if (a.date_ajout){
            dateA = new Date(a.date_ajout);
            dateB = new Date(b.date_ajout);
        }
        if (a.customFields){
            dateA = new Date(a.customFields.date_ajout);
            dateB = new Date(b.customFields.date_ajout);
        }

        if (ordre === "croissant") {
            return dateA - dateB; // Tri croissant
        } else if (ordre === "décroissant") {
            return dateB - dateA; // Tri décroissant
        } else {
            throw new Error("Ordre non valide : utilisez 'croissant' ou 'décroissant'.");
        }
    });
}

// Fonction pour trier une liste de musiques par popularité (croissant ou décroissant)
function sortByPopularity(array, ordre="croissant") {
    return array.sort((a, b) => {
        const popA = a.popularity;
        const popB = b.popularity;

        if (ordre === "croissant") {
            return popA - popB; // Tri croissant
        } else if (ordre === "décroissant") {
            return popB - popA; // Tri décroissant
        } else {
            throw new Error("Ordre non valide : utilisez 'croissant' ou 'décroissant'.");
        }
    });
}

// Afficher les musiques depuis IndexedDB (PAGE LISTE DES TITRES)
function displayMusics() {
    let criteria = applyFilters();
    const transaction = db.transaction('musics', 'readonly');
    const objectStore = transaction.objectStore('musics');
    const request = objectStore.getAll();

    request.onsuccess = async () => {
        const allMusics = request.result;

        // Filtrer les musiques basés sur les critères actuels de la zone de filtrage
        // Le filtrage se fait de manière asynchrone
        const filteredMusics = (await Promise.all(
            allMusics.map(async music => ({
                music,
                matches: await doesMusicCorrespondToCurrentFilters(music, criteria)
            }))
        )).filter(result => result.matches).map(result => result.music);

        // Met à jour l'affichage
        const musicContainer = document.getElementById('music-list');
        musicContainer.innerHTML = ''; // Réinitialise l'affichage
        totalDuration = 0;
        
        let sortedMusics;
        const sortByPop = document.getElementById('sort-by-popularity');
        const sortByPopValue = sortByPop.value;
        if (sortByPopValue == "no"){
            sortedMusics = sortByDate(filteredMusics, ordre="décroissant");
            // const shuffledMusics = shuffleArray(filteredMusics);
        };
        if (sortByPopValue == "croissant"){
            sortedMusics = sortByPopularity(filteredMusics, ordre="croissant");
        };
        if (sortByPopValue == "décroissant"){
            sortedMusics = sortByPopularity(filteredMusics, ordre="décroissant");
        };

        sortedMusics.forEach(music => {
            const musicBox = document.createElement('div');
            musicBox.classList.add('music-box');
            musicBox.innerHTML = `
                    <img src="${music.imageUrl}" alt="Illustration">
                    <div class="music-info">
                        <p class="music-titre">${music.title}</p>
                        <p class="music-auteur">${music.author}</p>
                    </div>
                    <p class="music-duration">${formatDurationShort(music.duration)}</p>
                    <button class="action-btn" data-id="${music.id}">⋮</button>
            `;
            musicContainer.appendChild(musicBox);
            totalDuration += music.duration;
        });
        musicNumber = filteredMusics.length;

        // Mise à jour des compteurs
        document.getElementById('music-count').textContent = musicNumber;
        document.getElementById('total-duration').textContent = formatDurationLong(totalDuration);
    };
};

// Afficher les musiques à évaluer (PAGE IMPORTER DES TITRES) depuis IndexedDB
function displayMusicsToRate() {
    const transaction = db.transaction('musics', 'readonly');
    const objectStore = transaction.objectStore('musics');
    const request = objectStore.getAll();

    request.onsuccess = () => {
        const musics = request.result.filter(music => {
            // Appliquer les critères de filtrage
            return (
                (!music.customFields.energique || !music.customFields.joyeuse || !music.customFields.musicale)
            );
        });

        // Met à jour l'affichage
        const musicContainer = document.getElementById('music-to-rate-list');
        musicContainer.innerHTML = ''; // Réinitialise l'affichage
        totalDuration_musicsToRate = 0;
        const sortedMusics = sortByDate(musics, ordre = "croissant")

        sortedMusics.forEach(music => {

            let scores = [-1 ,-1, -1];
            if (music.customFields.energique){
                scores[0] = music.customFields.energique;
            };
            if (music.customFields.joyeuse){
                scores[1] = music.customFields.joyeuse;
            };
            if (music.customFields.musicale){
                scores[2] = music.customFields.musicale;
            };

            const musicBox = document.createElement('div');
            musicBox.classList.add('music-box-musics-to-rate');

            let textHTML = ""
            textHTML = textHTML + `
                <div class="up-part-list-to-rate">
                    <img src="${music.imageUrl}" alt="Illustration">
                    <div class="music-info">
                        <p class="music-titre">${music.title}</p>
                        <p class="music-auteur">${music.author}&nbsp;&nbsp;&nbsp;&nbsp;(${music.album})</p>
                    </div>
                    <p class="music-duration">${formatDurationShort(music.duration)}</p>
                    <button class="action-btn" data-id="${music.id}">⋮</button>
                </div>
                <div class="bottom-part-list-to-rate">
            `;

            let arr1 = ["Energique", "Joyeuse", "Musicale"];
            let indexes = [0, 1, 2];
            for (let i of indexes) {
                textHTML = textHTML + `
                        <div class="bottom-part-list-to-rate-div">
                            <p>${arr1[i]}</p>
                            <select data-id="${music.id}" tag="${arr1[i].toLowerCase()}">
                `;
                
                if (scores[i] == -1){
                    textHTML = textHTML + `<option value="0" selected>-</option>`;
                };
                let arr2 = [0, 1, 2, 3, 4];
                let selected = scores[i]; // -1 si pas encore évalué
                for (let j of arr2) {
                    if (j == selected){
                        textHTML = textHTML + `<option value="${j}" selected>${j}</option>`;
                    }
                    else {
                        textHTML = textHTML + `<option value="${j}">${j}</option>`;
                    };
                };
                
                textHTML = textHTML + `
                            </select>
                        </div>
                `;
            };
            
            textHTML = textHTML + `
                    <!-- <select data-id="${music.id}" tag="heart">`;
            let arr3 = ["none", "heart", "super heart"];
            let smiley = [" ", "🤍", "🤍"];
            let indexes2 = [0, 1, 2];
            for (let k of indexes2) {
                if (k == music.customFields.heart){
                    textHTML = textHTML + `<option value="${arr3[k]}" selected>${smiley[k]}</option>`;
                }
                else {
                    textHTML = textHTML + `<option value="${arr3[k]}">${smiley[k]}</option>`;
                }
            };
            textHTML = textHTML + `
                    </select> -->
                    <button id="create-spotify-playlist-musics-to-rate${music.id}">✔</button>
                </div>
            `;

            musicBox.innerHTML = textHTML 
            musicContainer.appendChild(musicBox);
            totalDuration_musicsToRate += music.duration;

            const button = document.getElementById(`create-spotify-playlist-musics-to-rate${music.id}`);
            button.addEventListener('click', function() {
                // Récupérer les valeurs des selects correspondants
                const valeurEnergique = document.querySelector(`select[data-id="${music.id}"][tag="energique"]`).value;
                const valeurJoyeuse = document.querySelector(`select[data-id="${music.id}"][tag="joyeuse"]`).value;
                const valeurMusicale = document.querySelector(`select[data-id="${music.id}"][tag="musicale"]`).value;
                //const valeurHeart = document.querySelector(`select[data-id="${music.id}"][tag="musicale"]`).value;
    
                // Appeler la fonction qui met à jour les tags de la musique en fonction des "select" de ce titre
                updateMusicInIndexedDB(music.id, {
                         customFields: {
                             energique: valeurEnergique,
                             joyeuse: valeurJoyeuse,
                             musicale: valeurMusicale,
                             //heart: valeurHeart,
                         },
                     });
                
                // Raffraichir la liste
                displayMusicsToRate();
            });
        });
        musicNumber_musicsToRate = musics.length;

        // Mise à jour des compteurs
        document.getElementById('music-count-musics-to-rate').textContent = musicNumber_musicsToRate;
        document.getElementById('total-duration-musics-to-rate').textContent = formatDurationLong(totalDuration_musicsToRate);
    };
}

// Afficher les détails de la playlist (PAGE LIST DES PLAYLISTS)
function displayPlaylistDetails(playlist) {

    document.getElementById('titre-playlist').textContent = playlist.name;

    const criteria = playlist.criteria;

    displayPlaylistHeader(criteria);
    displayPlaylistListMusiques(criteria);

    // Connexion à l'interface : Filtrer les musiques dans la page détails playlist
    document.getElementById('playlist-title-filter').addEventListener('input', function () {if (!isProgrammaticChange) {changePlaylistDetails(playlist);}});
    document.getElementById('playlist-album-filter').addEventListener('input', function () {if (!isProgrammaticChange) {changePlaylistDetails(playlist);}});
    document.getElementById('playlist-author-filter').addEventListener('input', function () {if (!isProgrammaticChange) {changePlaylistDetails(playlist);}});
    document.getElementById('playlist-select-title-hearts').addEventListener('change', function () {if (!isProgrammaticChange) {changePlaylistDetails(playlist);}});
    document.getElementById('playlist-select-album-hearts').addEventListener('change', function () {if (!isProgrammaticChange) {changePlaylistDetails(playlist);}});
    document.getElementById('playlist-select-author-hearts').addEventListener('change', function () {if (!isProgrammaticChange) {changePlaylistDetails(playlist);}});
    document.getElementById('playlist-min-select-energique').addEventListener('change', function () {if (!isProgrammaticChange) {changePlaylistDetails(playlist);}});
    document.getElementById('playlist-max-select-energique').addEventListener('change', function () {if (!isProgrammaticChange) {changePlaylistDetails(playlist);}});
    document.getElementById('playlist-min-select-joyeuse').addEventListener('change', function () {if (!isProgrammaticChange) {changePlaylistDetails(playlist);}});
    document.getElementById('playlist-max-select-joyeuse').addEventListener('change', function () {if (!isProgrammaticChange) {changePlaylistDetails(playlist);}});
    document.getElementById('playlist-min-select-musicale').addEventListener('change', function () {if (!isProgrammaticChange) {changePlaylistDetails(playlist);}});
    document.getElementById('playlist-max-select-musicale').addEventListener('change', function () {if (!isProgrammaticChange) {changePlaylistDetails(playlist);}});
    document.getElementById('playlist-sort-by-popularity').addEventListener('change', function () {if (!isProgrammaticChange) {changePlaylistDetails(playlist);}});
};

function displayPlaylistHeader(criteria){
    document.getElementById('playlist-select-title-hearts').value = criteria.titleHeart;
    document.getElementById('playlist-select-album-hearts').value = criteria.albumHeart;
    document.getElementById('playlist-select-author-hearts').value = criteria.artistHeart;

    document.getElementById('playlist-min-select-energique').value = criteria.minEnergique;
    document.getElementById('playlist-max-select-energique').value = criteria.maxEnergique;
    document.getElementById('playlist-min-select-joyeuse').value = criteria.minJoyeuse;
    document.getElementById('playlist-max-select-joyeuse').value = criteria.maxJoyeuse;
    document.getElementById('playlist-min-select-musicale').value = criteria.minMusicale;
    document.getElementById('playlist-max-select-musicale').value = criteria.maxMusicale;

    document.getElementById('playlist-title-filter').value = criteria.title;
    document.getElementById('playlist-album-filter').value = criteria.album;
    document.getElementById('playlist-author-filter').value = criteria.author;
}

function displayPlaylistListMusiques(criteria){
    const transaction = db.transaction('musics', 'readonly');
    const objectStore = transaction.objectStore('musics');
    const request = objectStore.getAll();

    request.onsuccess = async () => {
        const allMusics = request.result;

        // Filtrer les musiques basés sur les critères actuels de la zone de filtrage
        // Le filtrage se fait de manière asynchrone
        const filteredMusics = (await Promise.all(
            allMusics.map(async music => ({
                music,
                matches: await doesMusicCorrespondToCurrentFilters(music, criteria)
            }))
        )).filter(result => result.matches).map(result => result.music);

        // Met à jour l'affichage
        const musicContainer = document.getElementById('music-of-playlist-list');
        musicContainer.innerHTML = ''; // Réinitialise l'affichage
        totalDuration = 0;
        
        let sortedMusics;
        const sortByPop = document.getElementById('playlist-sort-by-popularity');
        const sortByPopValue = sortByPop.value;
        if (sortByPopValue == "no"){
            sortedMusics = sortByDate(filteredMusics, ordre="décroissant");
            // const shuffledMusics = shuffleArray(filteredMusics);
        };
        if (sortByPopValue == "croissant"){
            sortedMusics = sortByPopularity(filteredMusics, ordre="croissant");
        };
        if (sortByPopValue == "décroissant"){
            sortedMusics = sortByPopularity(filteredMusics, ordre="décroissant");
        };

        sortedMusics.forEach(music => {
            const musicBox = document.createElement('div');
            musicBox.classList.add('music-box');
            musicBox.innerHTML = `
                    <img src="${music.imageUrl}" alt="Illustration">
                    <div class="music-info">
                        <p class="music-titre">${music.title}</p>
                        <p class="music-auteur">${music.author}</p>
                    </div>
                    <p class="music-duration">${formatDurationShort(music.duration)}</p>
                    <button class="action-btn" data-id="${music.id}">⋮</button>
            `;
            musicContainer.appendChild(musicBox);
            totalDuration += music.duration;
        });
        musicNumber = filteredMusics.length;

        // Mise à jour des compteurs
        document.getElementById('playlist-music-count').textContent = musicNumber;
        document.getElementById('playlist-total-duration').textContent = formatDurationLong(totalDuration);
    };
}

// Mettre à jour les critères de la playlist "playlist"
function changePlaylistDetails(playlist){
    const criteria = {
        title: document.getElementById('playlist-title-filter').value,
        album: document.getElementById('playlist-album-filter').value,
        author: document.getElementById('playlist-author-filter').value,
        titleHeart: document.getElementById('playlist-select-title-hearts').value,
        albumHeart: document.getElementById('playlist-select-album-hearts').value,
        artistHeart: document.getElementById('playlist-select-author-hearts').value,
        minEnergique: parseInt(document.getElementById('playlist-min-select-energique').value),
        maxEnergique: parseInt(document.getElementById('playlist-max-select-energique').value),
        minJoyeuse: parseInt(document.getElementById('playlist-min-select-joyeuse').value),
        maxJoyeuse: parseInt(document.getElementById('playlist-max-select-joyeuse').value),
        minMusicale: parseInt(document.getElementById('playlist-min-select-musicale').value),
        maxMusicale: parseInt(document.getElementById('playlist-max-select-musicale').value),
    };

    // Appeler la fonction qui met à jour la playlist
    updatePlaylistInIndexedDB(playlist.id, {
        criteria: {
            title: criteria.title,
            album: criteria.album,
            author: criteria.author,
            titleHeart: criteria.titleHeart,
            albumHeart: criteria.albumHeart,
            artistHeart: criteria.artistHeart,
            minEnergique: criteria.minEnergique,
            maxEnergique: criteria.maxEnergique,
            minJoyeuse: criteria.minJoyeuse,
            maxJoyeuse: criteria.maxJoyeuse,
            minMusicale: criteria.minMusicale,
            maxMusicale: criteria.maxMusicale,
        },
    });

    displayPlaylistListMusiques(criteria);
}


// Connexion à l'interface : Filtrer les musiques
document.getElementById('title-filter').addEventListener('input', displayMusics);
document.getElementById('album-filter').addEventListener('input', displayMusics);
document.getElementById('author-filter').addEventListener('input', displayMusics);
document.getElementById('select-title-hearts').addEventListener('change', displayMusics);
document.getElementById('select-album-hearts').addEventListener('change', displayMusics);
document.getElementById('select-author-hearts').addEventListener('change', displayMusics);
document.getElementById('min-select-energique').addEventListener('change', displayMusics);
document.getElementById('max-select-energique').addEventListener('change', displayMusics);
document.getElementById('min-select-joyeuse').addEventListener('change', displayMusics);
document.getElementById('max-select-joyeuse').addEventListener('change', displayMusics);
document.getElementById('min-select-musicale').addEventListener('change', displayMusics);
document.getElementById('max-select-musicale').addEventListener('change', displayMusics);
document.getElementById('sort-by-popularity').addEventListener('change', displayMusics);

// Fonction qui revoie la liste des critères actuels de la zone de filtrage
function applyFilters() {
    const criteria = {
        title: document.getElementById('title-filter').value,
        album: document.getElementById('album-filter').value,
        author: document.getElementById('author-filter').value,
        titleHeart: document.getElementById('select-title-hearts').value,
        albumHeart: document.getElementById('select-album-hearts').value,
        artistHeart: document.getElementById('select-author-hearts').value,
        minEnergique: parseInt(document.getElementById('min-select-energique').value),
        maxEnergique: parseInt(document.getElementById('max-select-energique').value),
        minJoyeuse: parseInt(document.getElementById('min-select-joyeuse').value),
        maxJoyeuse: parseInt(document.getElementById('max-select-joyeuse').value),
        minMusicale: parseInt(document.getElementById('min-select-musicale').value),
        maxMusicale: parseInt(document.getElementById('max-select-musicale').value),
    };
    return criteria;
}

function heartVerify(filter, element){
    let elementHeart = "none";
    if (element.customFields && element.customFields.heart){
        elementHeart = element.customFields.heart;
    };
    if (filter == "all"){
        return true
    } else if (filter == "all-hearts"){
        return (elementHeart == "heart" || elementHeart == "super heart")
    } else if (filter == "only-super-heart"){
        return elementHeart == "super heart"
    } else if (filter == "all-except-super-heart"){
        return (elementHeart == "none" || elementHeart == "heart")
    } else if (filter == "only-simple-heart"){
        return elementHeart == "heart"
    } else if (filter == "only-without-heart"){
        return elementHeart == "none"
    } 
}

function stringVerify(stringFilter, stringToTest) {
    // Convertir stringFilter en liste
    const words = stringFilter.split(',')
        .map(word => word.trim()) // Supprimer les espaces autour des mots
        .filter(word => word !== ""); // Supprimer les chaînes vides

    // Séparer les mots inclusifs et exclusifs
    const inclusives = words.filter(word => !word.startsWith('!'));
    const exclusives = words.filter(word => word.startsWith('!')).map(word => word.slice(1).trim());

    // Vérifier la présence d'au moins un mot inclusif dans stringToTest
    const hasInclusive = inclusives.length === 0 || inclusives.some(word => stringToTest.includes(word));

    // Vérifier que tous les mots exclusifs sont absents de stringToTest
    const hasNoExclusive = exclusives.every(word => !stringToTest.includes(word));

    // La validation est vraie si les deux conditions sont remplies
    return hasInclusive && hasNoExclusive;
}

async function doesMusicCorrespondToCurrentFilters(music, criteria){
        
    try {
        // Récupérer l'album et l'artiste de manière asynchrone
        const album = await getAlbumFromIndexedDB(music.album_id);
        const firstArtistId = music.author_id.split(',')[0].trim();
        const artist = await getArtistFromIndexedDB(firstArtistId);

        // Vérification des critères uniquement après avoir récupéré les données nécessaires
        const titleMatches = criteria.title == "" || stringVerify(criteria.title.toLowerCase(), music.title.toLowerCase());
        const albumMatches = criteria.album == "" || stringVerify(criteria.album.toLowerCase(), album.name.toLowerCase());
        const authorMatches = criteria.author == "" || stringVerify(criteria.author.toLowerCase(), artist.name.toLowerCase());

        const heartMatches =
            (music == null || heartVerify(criteria.titleHeart, music)) &&
            (album == null || heartVerify(criteria.albumHeart, album)) &&
            (artist == null || heartVerify(criteria.artistHeart, artist));

        const customFieldsNotUsed =
            (criteria.minEnergique == 0 && criteria.maxEnergique == 4 && criteria.minJoyeuse == 0 &&
                criteria.maxJoyeuse == 4 && criteria.minMusicale == 0 && criteria.maxMusicale == 4)

        const customFieldMatches =
            (criteria.minEnergique == null || music.customFields.energique >= criteria.minEnergique) &&
            (criteria.maxEnergique == null || music.customFields.energique <= criteria.maxEnergique) &&
            (criteria.minJoyeuse == null || music.customFields.joyeuse >= criteria.minJoyeuse) &&
            (criteria.maxJoyeuse == null || music.customFields.joyeuse <= criteria.maxJoyeuse) &&
            (criteria.minMusicale == null || music.customFields.musicale >= criteria.minMusicale) &&
            (criteria.maxMusicale == null || music.customFields.musicale <= criteria.maxMusicale);

        const matchesCriteria = (titleMatches && albumMatches && authorMatches && heartMatches) && (customFieldsNotUsed || customFieldMatches);
        
        return matchesCriteria;
    } catch (error) {
        console.error(`Erreur lors du traitement de la musique "${music.title}" :`, error);
        return null; // Ignorer cette musique en cas d'erreur
    }
}



// ==============================================
// Intégration avec Spotify API
// ==============================================
let accessToken;

// Loging into Spotify
const clientId = '90fc7089b14747f58ec11b9607ee63ac'; // Remplacez par votre Client ID
const redirectUri = 'http://localhost:3000/';
const scopes = [
    'playlist-read-private',
    'playlist-read-collaborative',
    'playlist-modify-private',  // Pour créer ou modifier des playlists privées
    'playlist-modify-public',    // Facultatif : Pour créer ou modifier des playlists publiques
    'user-read-playback-state', // Supplementaire (POUR LA LECTURE mais nécessite compte prémium (exemple : test7.html))
    'user-modify-playback-state', // Supplementaire (POUR LA LECTURE mais nécessite compte prémium (exemple : test7.html))
    'streaming', // Supplementaire (POUR LA LECTURE mais nécessite compte prémium (exemple : test7.html))
].join('%20');

// Connexion à l'interface : Loging into Spotify
document.getElementById('spotify-login').addEventListener('click', () => {
    const authUrl = `https://accounts.spotify.com/authorize?response_type=token&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}`;
    window.location.href = authUrl;
});

// GERER L'ACTUALISATION REGULIERE ??
// Gérer le token d'accès depuis l'URL
document.addEventListener('DOMContentLoaded', () => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    accessToken = params.get('access_token');

    if (accessToken) {
        fetchPlaylists(accessToken);
    } else {
        console.error('Aucun accessToken trouvé.');
    }
});

// Récupérer et afficher les playlists de l'utilisateur
function fetchPlaylists(accessToken) {
    fetch('https://api.spotify.com/v1/me/playlists', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    })
        .then(response => response.json())
        .then(data => {
            const playlistSelect = document.getElementById('playlist-select');
            playlistSelect.innerHTML = '<option value="">-- Sélectionner une playlist --</option>';
            data.items.forEach(playlist => {
                const option = document.createElement('option');
                option.value = playlist.id;
                option.textContent = playlist.name;
                playlistSelect.appendChild(option);
            }); // Peut-etre un "catch" là qui permettrait de se reconnecter à spotify si besoin ???
        });
}

// Connexion à l'interface : Récupérer les musiques d'une playlist Spotify
document.getElementById('import-musics').addEventListener('click', async event => {
    const playlistId = document.getElementById('playlist-select').value;

    if (playlistId) {
        let tracks = await fetchTracksFromPlaylist(playlistId);
        await compareAndAddMusics(tracks);
        alert("Titres importés depuis la playlist");
    }
});

// Récupérer les musiques d'une playlist Spotify
async  function fetchTracksFromPlaylist(playlistId) {

    let tracks = []; // Tableau pour stocker tous les morceaux
    let nextUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks`; // URL de base pour récupérer les morceaux

    try {
        while (nextUrl) {
            // Faire la requête pour récupérer les morceaux de la playlist
            const response = await fetch(nextUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Erreur lors de la récupération des morceaux:', errorData);
                return;
            }

            // Extraire les données de la réponse
            const data = await response.json();

            // Mapper les éléments de la réponse en un format structuré
            const mappedTracks = data.items.map(item => ({
                id: item.track.id,
                title: item.track.name,
                author: item.track.artists.map(artist => artist.name).join(', '),
                author_id: item.track.artists.map(artist => artist.id).join(', '),
                album: item.track.album.name,
                album_id: item.track.album.id,
                duration: Math.round(item.track.duration_ms / 1000), // Convertir la durée en secondes
                imageUrl: item.track.album.images[0]?.url || '', // Récupérer l'image de l'album (si disponible)
                popularity: item.track.popularity,
                uri: item.track.uri
            }));

            // Ajouter les morceaux mappés au tableau des morceaux
            tracks = tracks.concat(mappedTracks);

            // Vérifier s'il y a une page suivante
            nextUrl = data.next; // La prochaine URL à récupérer (si elle existe)
        }
        
        return tracks;

    } catch (error) {
        console.error('Erreur réseau:', error);
    }
}

// Récupérer les musiques d'un album Spotify
async function fetchTracksFromAlbum(albumId) {
    try {
        // Étape 1 : Récupérer les musiques de l'album
        const albumResponse = await fetch(`https://api.spotify.com/v1/albums/${albumId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!albumResponse.ok) {
            throw new Error(`Erreur lors de la récupération de l'album : ${albumResponse.statusText}`);
        }

        const albumData = await albumResponse.json();
        const trackItems = albumData.tracks.items;

        // Étape 2 : Filtrer les musiques qui ne sont pas encore dans IndexedDB
        const tracksToFetch = [];
        for (const track of trackItems) {
            const exists = await isMusicInIndexedDB(track.id);
            if (!exists) {
                tracksToFetch.push(track);
            }
        }

        // Étape 3 : Récupérer les détails uniquement pour les musiques manquantes
        const detailedTracksPromises = tracksToFetch.map(async (item) => {
            const trackResponse = await fetch(`https://api.spotify.com/v1/tracks/${item.id}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (!trackResponse.ok) {
                console.error(`Erreur pour récupérer les détails de la musique ${item.id}`);
                return null; // En cas d'erreur, ignorer cette musique
            }

            const trackData = await trackResponse.json();

            return {
                id: trackData.id,
                title: trackData.name,
                author: trackData.artists.map(artist => artist.name).join(', '),
                author_id: trackData.artists.map(artist => artist.id).join(', '),
                album: albumData.name,
                album_id: albumData.id,
                duration: Math.round(trackData.duration_ms / 1000),
                imageUrl: albumData.images[0]?.url || '',
                popularity: trackData.popularity,
                uri: trackData.uri,
            };
        });

        // Étape 4 : Attendre que toutes les promesses se résolvent
        const detailedTracks = await Promise.all(detailedTracksPromises);

        // Filtrer les musiques valides (non null)
        return detailedTracks.filter(track => track !== null);

    } catch (error) {
        console.error('Erreur lors de la récupération des musiques :', error);
        return [];
    }
}

// Récupérer les musiques d'un album Spotify rapidement (une seule requete "Album" mais incomplet pour les musiques -> NE PAS UTILISER POUR COMPLETER LA BASE DE DONNEES DE L'APP !!, juste pour compter)
function fetchTracksFromAlbumFAST(albumId) {
    return fetch(`https://api.spotify.com/v1/albums/${albumId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    })
        .then(response => response.json())
        .then(data => data.tracks.items.map(item => ({
            id: item.id,
            title: item.name,
            author: item.artists.map(artist => artist.name).join(', '),
            duration: Math.round(item.duration_ms / 1000),
            popularity: item.popularity,
            uri: item.uri
        })))
        .catch(error => {
            console.error('Erreur lors de la récupération des musiques :', error);
            return [];
        });
}

// Récupérer un artiste Spotify
async function fetchArtist(artistID) {
    try {
        const response = await fetch(`https://api.spotify.com/v1/artists/${getOneArtist(artistID)}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!response.ok) {
            throw new Error(`Erreur lors de la récupération de l'artiste : ${response.statusText}`);
        }

        const artistData = await response.json();

        return {
            id: artistData.id,
            name: artistData.name,
            popularity: artistData.popularity,
            imageUrl: artistData.images[0]?.url || '',
            uri: artistData.uri
        };
    } catch (error) {
        console.error('Erreur dans fetchArtist:', error);
        return null;
    }
}

// Récupérer un album Spotify
async function fetchAlbum(albumID) {
    try {
        const response = await fetch(`https://api.spotify.com/v1/albums/${albumID}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!response.ok) {
            throw new Error(`Erreur lors de la récupération de l'album : ${response.statusText}`);
        }

        const albumData = await response.json();

        return {
            id: albumData.id,
            name: albumData.name,
            popularity: albumData.popularity,
            imageUrl: albumData.images[0]?.url || '',
            total_tracks: albumData.total_tracks,
            uri: albumData.uri,
            artistName: albumData.artists[0]?.name || 'Inconnu'
        };
    } catch (error) {
        console.error('Erreur dans fetchAlbum:', error);
        return null;
    }
}

// Fonction qui permet de mettre à jour toutes les "popularity" (artists, albums, musics)
async function updatePopularityInIndexedDB() {
    const transaction = db.transaction(['musics', 'albums', 'artists'], 'readwrite');

    const musicStore = transaction.objectStore('musics');
    const albumStore = transaction.objectStore('albums');
    const artistStore = transaction.objectStore('artists');

    // Mettre à jour les musiques
    musicStore.openCursor().onsuccess = async event => {
        const cursor = event.target.result;
        if (cursor) {
            const music = cursor.value;
            const updatedTrack = await fetch(`https://api.spotify.com/v1/tracks/${music.id}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            })
                .then(response => response.json())
                .catch(error => {
                    console.error(`Erreur pour mettre à jour la musique ${music.id}:`, error);
                    return null;
                });

            if (updatedTrack) {
                music.popularity = updatedTrack.popularity;
                cursor.update(music); // Met à jour la valeur dans IndexedDB
            }
            cursor.continue();
        }
    };

    // Mettre à jour les albums
    albumStore.openCursor().onsuccess = async event => {
        const cursor = event.target.result;
        if (cursor) {
            const album = cursor.value;
            const updatedAlbum = await fetchAlbum(album.id);
            if (updatedAlbum) {
                album.popularity = updatedAlbum.popularity;
                cursor.update(album);
            }
            cursor.continue();
        }
    };

    // Mettre à jour les artistes
    artistStore.openCursor().onsuccess = async event => {
        const cursor = event.target.result;
        if (cursor) {
            const artist = cursor.value;
            const updatedArtist = await fetchArtist(artist.id);
            if (updatedArtist) {
                artist.popularity = updatedArtist.popularity;
                cursor.update(artist);
            }
            cursor.continue();
        }
    };

    transaction.oncomplete = () => {
        console.log('Mise à jour des popularités terminée.');
    };

    transaction.onerror = event => {
        console.error('Erreur lors de la mise à jour des popularités:', event.target.error);
    };
}

// Créer une playlist Spotify avec certaines musiques
function createNewPlaylist(name, tracks) {
    // Récupérer les informations de l'utilisateur
    fetch('https://api.spotify.com/v1/me', {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    })
    .then(response => response.json())
    .then(user => {
        // Créer une nouvelle playlist
        fetch(`https://api.spotify.com/v1/users/${user.id}/playlists`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: name,
                description: 'Générée par Spoti ++',
                public: false
            })
        })
        .then(response => response.json())
        .then(newPlaylist => {
            addTracksToPlaylist(newPlaylist.id, tracks);
            alert("Playlist créée");
        })
        .catch(error => console.error('Erreur lors de la création de la playlist:', error));
    });
}

// Ajouter une musique dans une playlist Spotify
function addTracksToPlaylist(playlistId, tracks) {
    const uris = tracks.map(track => track.uri);

    const maxTracksPerRequest = 90; // Limite de 90 morceaux par requête
    let startIndex = 0;

    while (startIndex < uris.length){
        const endIndex = Math.min(startIndex + maxTracksPerRequest, uris.length);
        const chunk = uris.slice(startIndex, endIndex);

        fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                uris: chunk
            })
        })
        .then(response => response.json())
        .catch(error => console.error('Erreur lors de l\'ajout des morceaux à la playlist:', error));
        
        // Mettez à jour l'index pour le prochain groupe de morceaux
        startIndex = endIndex;
    }

}



// ==============================================
// Gestion des menus d'actions (fenêtre modale) pour les PAGES "Liste des musiques" ET "Importer des titres" ET "Details playlist"
// ==============================================

// Connexion à l'interface : (PAGE LISTE TITRES) Gérer le menu d'action pour modifier ou supprimer une musique
document.getElementById('music-list').addEventListener('click', async event => {
    if (event.target.classList.contains('action-btn')) {
        const musicId = event.target.getAttribute('data-id');

        try {
            const music = await getMusicFromIndexedDB(musicId);
            showActionMenu(music);
        } catch (error) {
            onsole.error('Erreur lors de la récupération des données :', error);
        }
    }
});

// Connexion à l'interface : (PAGE IMPORTER) Gérer le menu d'action pour modifier ou supprimer une musique
document.getElementById('music-to-rate-list').addEventListener('click', async event => {
    if (event.target.classList.contains('action-btn')) {
        const musicId = event.target.getAttribute('data-id');
        
        try {
            const music = await getMusicFromIndexedDB(musicId);
            showActionMenu(music);
        } catch (error) {
            onsole.error('Erreur lors de la récupération des données :', error);
        }
    }
});

// Connexion à l'interface : (PAGE DETAILS PLAYLIST) Gérer le menu d'action pour modifier ou supprimer une musique
document.getElementById('music-of-playlist-list').addEventListener('click', async event => {
    if (event.target.classList.contains('action-btn')) {
        const musicId = event.target.getAttribute('data-id');
        
        try {
            const music = await getMusicFromIndexedDB(musicId);
            showActionMenu(music);
        } catch (error) {
            onsole.error('Erreur lors de la récupération des données :', error);
        }
    }
});

// Fonction pour créer et afficher le menu d'action
async function showActionMenu(music) {

    // Recuperer les données de l'album et de l'artiste
    let album;
    let artist;
    try {

        album = await getAlbumFromIndexedDB(music.album_id);
        artist = await getArtistFromIndexedDB(getOneArtist(music.author_id));
    
    } catch (error) {
        console.error('Erreur lors de la récupération des données :', error);
    }

    // Initialiser le tableau des scores du titre
    let scores = [-1 ,-1, -1];
    if (music.customFields.energique){
        scores[0] = music.customFields.energique;
    };
    if (music.customFields.joyeuse){
        scores[1] = music.customFields.joyeuse;
    };
    if (music.customFields.musicale){
        scores[2] = music.customFields.musicale;
    };

    // Créer le code HTML de la modale
    let modalHTML = `
    <div id="music-modal" class="modal">
        <div class="modal-content-info-musiques">`;

    let arr3 = ["none", "heart", "super heart"];
    let smiley = [" ", "🤍", "🧡"]; // 🖤🤍💛🧡
    let indexes2 = [0, 1, 2];

    if (artist && album) {

        modalHTML = modalHTML + `
            <!--<h3>Artiste</h3>-->
            <div class="modal-author-info">
                <img src="${artist.imageUrl}" alt="Illustration">
                <p class="artist-name">${artist.name}</p>
        `;
        
        modalHTML = modalHTML + `
                <select id="heart-artist" data-id="${artist.id}" tag="heart">`;
        //let arr3 = ["none", "heart", "super heart"];
        //let smiley = [" ", "🤍", "🧡"]; // 🖤🤍💛🧡
        //let indexes2 = [0, 1, 2];
        for (let k of indexes2) {
            if (arr3[k] == artist.customFields.heart){
                modalHTML = modalHTML + `<option value="${arr3[k]}" selected>${smiley[k]}</option>`;
            }
            else {
                modalHTML = modalHTML + `<option value="${arr3[k]}">${smiley[k]}</option>`;
            }
        };

        modalHTML = modalHTML + ` 
                </select>   
            </div>
            <hr>
            <!--<h3>Album</h3>-->
            <div class="modal-album-info">
                <img src="${album.imageUrl}" alt="Illustration">
                <div class="modal-album-right-part">
                    <div class="modal-album-details">
                        <p class="album-name">${album.name}</p>
        `;
        
        modalHTML = modalHTML + `
                        <select id="heart-album" data-id="${album.id}" tag="heart">`;
        //let arr3 = ["none", "heart", "super heart"]; // déja définis plus haut
        //let smiley = [" ", "🤍", "🧡"];
        //let indexes2 = [0, 1, 2];
        for (let k of indexes2) {
            if (arr3[k] == album.customFields.heart){
                modalHTML = modalHTML + `<option value="${arr3[k]}" selected>${smiley[k]}</option>`;
            }
            else {
                modalHTML = modalHTML + `<option value="${arr3[k]}">${smiley[k]}</option>`;
            }
        };

        modalHTML = modalHTML + ` 
                        </select>
                    </div>
                    <div class="modal-album-actions">
        `;

        // Obtenir le nombre total de titres dans l'album et le nombre actuellement enregistrés dans l'appli
        let actuel = 0;
        let total = 0;
        await fetchTracksFromAlbumFAST(music.album_id).then(async tracks => {
            albumStatus = await compareAndStatus(tracks);
            actuel = albumStatus.actuel;
            total = albumStatus.total;
        });

        if (actuel == total) {
            modalHTML = modalHTML + `
                        <p id="status-complete-album" class="status-album-complete">Complet (${actuel}/${total})</p>
            `;
        }
        else {
            modalHTML = modalHTML + `
                        <p id="status-complete-album" class="status-album-incomplete">Incomplet (${actuel}/${total})</p>
                        <button id="complete-album">Compléter</button>
            `;
        
        }
                    
        modalHTML = modalHTML + `
                    </div>
                </div>
            </div>
            <hr>`;
    }

    modalHTML = modalHTML + `
            <!--<h3>Titre</h3>-->
            <div class="modal-musique-title">
                <p class="music-name">${music.title}</p>
                <select id="heart-music" data-id="${music.id}" tag="heart">`;
    //let arr3 = ["none", "heart", "super heart"]; // déja définis plus haut
    //let smiley = [" ", "🤍", "🧡"];
    //let indexes2 = [0, 1, 2];
    for (let k of indexes2) {
        if (arr3[k] == music.customFields.heart){
            modalHTML = modalHTML + `<option value="${arr3[k]}" selected>${smiley[k]}</option>`;
        }
        else {
            modalHTML = modalHTML + `<option value="${arr3[k]}">${smiley[k]}</option>`;
        }
    };

    modalHTML = modalHTML + `
                </select>
            </div>
            <div class="modal-musique-infos">
                <p>Durée : ${formatDurationShort(music.duration)}</p>
                <p>Popularité Spotify : ${music.popularity}</p>
            </div>
            <div class="modal-musique-tags">`;

    let arr1 = ["Energique", "Joyeuse", "Musicale"];
    let indexes = [0, 1, 2];
    for (let i of indexes) {
        modalHTML = modalHTML + `
                <div class="modal-music-tags">
                    <p class="tag-name">${arr1[i]}</p>
                    <select id="select-${arr1[i].toLowerCase()}" data-id="${music.id}">
        `;
                
        let arr2 = [0, 1, 2, 3, 4];
        let selected = 0;
        if (scores[i] != -1){
            selected = scores[i];
        };
        for (let j of arr2) {
            if (j == selected){
                modalHTML = modalHTML + `<option value="${j}" selected>${j}</option>`;
            }
            else {
                modalHTML = modalHTML + `<option value="${j}">${j}</option>`;
            };
        };
        modalHTML = modalHTML + `
                    </select>
                </div>
        `;
    }
                
    modalHTML = modalHTML + `
            </div>
            <div class="end-line-of-modal-info-musiques">
                <button class="end-line" id="close-modal-info-musiques">Fermer</button>
                <button class="end-line" id="delete-music-btn">Supprimer</button>
            </div>
        </div>
    </div>
    `;
    
    // Ajouter le HTML de la modale à la page
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Afficher la modale
    const modal = document.getElementById("music-modal");
    modal.style.display = "block";

    // Récupérer les éléments de la modale
    const closeBtn = document.getElementById("close-modal-info-musiques");
    const deleteMusicBtn = document.getElementById("delete-music-btn");

    // Fermer la modale lorsque l'utilisateur clique sur le bouton de fermeture
    closeBtn.onclick = function() {
        modal.style.display = "none";
        modal.remove();  // Supprimer la modale après fermeture
    }

    // Supprmier le titre avec une fenêtre de confirmation
    deleteMusicBtn.onclick = function() {
        if (confirm(`Voulez-vous vraiment supprimer "${music.title}" de ${music.author} ?`)) {
            deleteMusic(music.id);
            modal.style.display = "none";
            modal.remove();
        }
    }

    if (artist && album) {
        // Connexion à l'interface : Mettre à jour le "heart" de l'artiste
        selectHeartArtist = document.getElementById('heart-artist')
        selectHeartArtist.addEventListener('change', event => {
            const valeurHeart = document.getElementById('heart-artist').value;
            // Appeler la fonction qui met à jour les tags de l'artiste
            updateArtistInIndexedDB(artist.id, {
                customFields: {
                    heart: valeurHeart,
                },
            });
            displayMusics();
            displayMusicsToRate();
        });

        // Connexion à l'interface : Mettre à jour le "heart" de l'album
        selectHeartAlbum = document.getElementById('heart-album')
        selectHeartAlbum.addEventListener('change', event => {
            const valeurHeart = document.getElementById('heart-album').value;
            // Appeler la fonction qui met à jour les tags de l'artiste
            updateAlbumInIndexedDB(album.id, {
                customFields: {
                    heart: valeurHeart,
                },
            });
            displayMusics();
            displayMusicsToRate();
        });
    };

    // Connexion à l'interface : Mettre à jour le "heart" de la musique
    selectHeartMusic = document.getElementById('heart-music')
    selectHeartMusic.addEventListener('change', event => {
        const valeurHeart = document.getElementById('heart-music').value;
        // Appeler la fonction qui met à jour les tags de l'artiste
        updateMusicInIndexedDB(music.id, {
            customFields: {
                heart: valeurHeart,
            },
        });
        displayMusics();
        displayMusicsToRate();
    });

    // Connexion à l'interface : Mettre à jour le "energique" de la musique
    selectEnergiqueMusic = document.getElementById('select-energique')
    selectEnergiqueMusic.addEventListener('change', event => {
        const valeurEnergique = document.getElementById('select-energique').value;
        // Appeler la fonction qui met à jour les tags de l'artiste
        updateMusicInIndexedDB(music.id, {
            customFields: {
                energique: valeurEnergique,
            },
        });
        displayMusics();
        displayMusicsToRate();
    });

    // Connexion à l'interface : Mettre à jour le "joyeuse" de la musique
    selectJoyeuseMusic = document.getElementById('select-joyeuse')
    selectJoyeuseMusic.addEventListener('change', event => {
        const valeurJoyeuse = document.getElementById('select-joyeuse').value;
        // Appeler la fonction qui met à jour les tags de l'artiste
        updateMusicInIndexedDB(music.id, {
            customFields: {
                joyeuse: valeurJoyeuse,
            },
        });
        displayMusics();
        displayMusicsToRate();
    });

    // Connexion à l'interface : Mettre à jour le "musicale" de la musique
    selectMusicaleMusic = document.getElementById('select-musicale')
    selectMusicaleMusic.addEventListener('change', event => {
        const valeurMusicale = document.getElementById('select-musicale').value;
        // Appeler la fonction qui met à jour les tags de l'artiste
        updateMusicInIndexedDB(music.id, {
            customFields: {
                musicale: valeurMusicale,
            },
        });
        displayMusics();
        displayMusicsToRate();
    });

    if (artist && album) {
        // Connexion à l'interface : Récupérer les musiques d'un album Spotify
        const completeAlbumElement = document.getElementById('complete-album');
        const text = document.getElementById('status-complete-album');
        if (completeAlbumElement) {
            completeAlbumElement.addEventListener('click', async event => {
                if (music.album_id) {
                    // Recupère les musiques de l'album et les ajoute via la fonction "compareAndAddMusics" pour ne pas avoir de doublons
                    let total = 0;
                    await fetchTracksFromAlbum(music.album_id).then(async tracks => {
                        await compareAndAddMusics(tracks);
                    });
                    let album = await getAlbumFromIndexedDB(music.album_id);
                    text.innerText = `Complet (${album.total_tracks}/${album.total_tracks})`
                    text.classList.remove("status-album-incomplete");
                    text.classList.add("status-album-complete");
                    completeAlbumElement.style.display = 'none'; // Cache l'élément
                }
            });
        }
    }

    // Fermer la modale si l'utilisateur clique en dehors de la fenêtre modale
    window.onclick = function(event) {
        if (event.target === modal) {
            modal.style.display = "none";
            modal.remove();  // Supprimer la modale après fermeture
        }
    }
}



// ==============================================
// Gestion de la fenêtre modale pour la création d'une playlist de l'application
// ==============================================

// Récupérer le bouton
const btn = document.getElementById("create-app-playlist");

// Fonction pour créer et afficher la fenêtre modale de création d'une playliste
function showPlaylistModal() {

    let criteria = applyFilters();
    //const transaction = db.transaction('musics', 'readonly');
    //const objectStore = transaction.objectStore('musics');
    //const request = objectStore.getAll();

    //request.onsuccess = async () => {
        //const allMusics = request.result;

        // Filtrer les musiques basés sur les critères actuels de la zone de filtrage
        // Le filtrage se fait de manière asynchrone
        //const filteredMusics = (await Promise.all(
        //    allMusics.map(async music => ({
        //        music,
        //        matches: await doesMusicCorrespondToCurrentFilters(music, criteria)
        //    }))
        //)).filter(result => result.matches).map(result => result.music);
        
        //let sortedMusics = sortByDate(filteredMusics, ordre="décroissant");
        // const shuffledMusics = shuffleArray(filteredMusics);

        //totalDuration = 0;
        //sortedMusics.forEach(music => {
        //    totalDuration += music.duration;
        //});
        //musicNumber = sortedMusics.length;

        // Créer le code HTML de la modale
        const modalHTML = `
            <div id="playlist-modal" class="modal">
                <div class="modal-content-create-playlist">
                    <h2>Nouvelle playlist</h2>
                    <p>Nombre de titres : <span id="track-count">${musicNumber}</span></p>
                    <p>Durée totale : <span id="total-duration">${formatDurationLong(totalDuration)}</span></p>
                    <input type="text" id="playlist-name" placeholder="Nom de la playlist">
                    <div class="end-line-of-modal-playlist-creation">
                        <button id="close-modal-playlist-creation">Fermer</button>
                        <button id="create-playlist-btn">Créer</button>
                    </div>
                </div>
            </div>
        `;
        
        // Ajouter le HTML de la modale à la page
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Afficher la modale
        const modal = document.getElementById("playlist-modal");
        modal.style.display = "block";

        // Récupérer les éléments de la modale
        const closeBtn = document.getElementById("close-modal-playlist-creation");
        const createPlaylistBtnShowPlaylistModal = document.getElementById("create-playlist-btn");
        const nameInput = document.getElementById("playlist-name");

        // Fermer la modale lorsque l'utilisateur clique sur le bouton de fermeture
        closeBtn.onclick = function() {
            modal.style.display = "none";
            modal.remove();  // Supprimer la modale après fermeture
        }

        // Créer la playlist et afficher le message dans la console
        createPlaylistBtnShowPlaylistModal.onclick = function() {
            const playlistName = nameInput.value;
            if (playlistName) {
                const playlist = {};
                if (criteria) playlist.criteria = criteria;
                playlist.name = playlistName;
                playlist.date_ajout = new Date();
                addPlaylistToIndexedDB(playlist);
                console.log("Playlist créée avec le nom : " + playlistName);
                modal.style.display = "none";
                modal.remove();  // Supprimer la modale après création
            } else {
                alert("Veuillez entrer un nom pour la playlist.");
            }
            displayPlaylists();
        }

        // Fermer la modale si l'utilisateur clique en dehors de la fenêtre modale
        window.onclick = function(event) {
            if (event.target === modal) {
                modal.style.display = "none";
                modal.remove();  // Supprimer la modale après fermeture
            }
        }
    
    //};
}

// Ajouter l'événement au bouton pour afficher la modale
btn.onclick = showPlaylistModal;



// ==============================================
// Gestion de la fenêtre modale pour le bouton "Action" de la page "détails playlist"
// ==============================================

// Récupérer le bouton
const btn_action_details_playlist = document.getElementById("playlist-action");

// Fonction pour créer et afficher la fenêtre modale de création d'une playliste
async function showActionMenuDetailsPlaylist() {

    playlist = await getPlaylistFromIndexedDB(playlistActuellementExaminee);

    const modalHTML = `
        <div id="playlist-modal" class="modal">
            <div class="modal-content-create-playlist">
                <h2>${playlist.name}</h2>
                <p>Nombre de titres : <span id="track-count">${musicNumber}</span></p>
                <p>Durée totale : <span id="total-duration">${formatDurationLong(totalDuration)}</span></p>
                <input type="text" id="playlist-name-detail-modal" placeholder="Nouveau nom de la playlist">
                <div class="end-line-of-detail-modal">
                    <button id="delete-playlist-detail-modal">Supprimer</button>
                    <button id="rename-playlist-btn-detail-modal">Renommer</button>
                </div>
                <div class="end-line-of-detail-modal">
                    <button id="close-detail-modal">Fermer</button>
                    <button id="create-playlist-btn-detail-modal">Créer sur Spotify</button>
                </div>
            </div>
        </div>
    `;
        
    // Ajouter le HTML de la modale à la page
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Afficher la modale
    const modal = document.getElementById("playlist-modal");
    modal.style.display = "block";

    // Récupérer les éléments de la modale
    const closeBtn = document.getElementById("close-detail-modal");
    const createPlaylistBtnShowActionMenuPlaylist = document.getElementById("create-playlist-btn-detail-modal");
    const deleteBtn = document.getElementById("delete-playlist-detail-modal");
    const renamePlaylistBtn = document.getElementById("rename-playlist-btn-detail-modal");
    const nameInput = document.getElementById("playlist-name-detail-modal");

    // Fermer la modale lorsque l'utilisateur clique sur le bouton de fermeture
    closeBtn.onclick = function() {
        modal.style.display = "none";
        modal.remove();  // Supprimer la modale après fermeture
    }

    // Renommer la playlist lorsque l'utilisateur clique sur le bouton de renommage
    renamePlaylistBtn.onclick = async function() {
        const playlistName = nameInput.value;
        if (playlistName) {
            // Appeler la fonction qui met à jour la playlist
            await updatePlaylistInIndexedDB(playlist.id, {
                name: playlistName,
            });
            const newPlaylist = await getPlaylistFromIndexedDB(playlist.id);
            displayPlaylistDetails(newPlaylist);
            modal.style.display = "none";
            modal.remove();  // Supprimer la modale après création
        } else {
            alert("Veuillez entrer un nom pour la playlist.");
        }
    }

    // Supprimer la playlist lorsque l'utilisateur clique sur le bouton de suppression
    deleteBtn.onclick = function() {
        if (window.confirm(`Êtes-vous sûr de vouloir supprimer la playlist "${playlist.name}" ?`)) {
            deletePlaylist(playlist.id)

            // Supprimer la modale après création
            modal.style.display = "none";
            modal.remove();

            // Supprime les classes "active" des boutons et sections
            document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));

            // Active le bouton et la section "details playlist"
            const button = document.querySelector('.nav-btn[data-section="playlists"]');
            button.classList.add('active');
            document.getElementById("playlists").classList.add('active');

            // Met à jour les affichages
            displayPlaylists();
        }
    }

    // Créer la playlist et afficher le message dans la console
    createPlaylistBtnShowActionMenuPlaylist.onclick = showPlaylistModalCreateSpotifyPlaylist;

    // Fermer la modale si l'utilisateur clique en dehors de la fenêtre modale
    window.onclick = function(event) {
        if (event.target === modal) {
            modal.style.display = "none";
            modal.remove();  // Supprimer la modale après fermeture
        }
    }
}

// Ajouter l'événement au bouton pour afficher la modale
btn_action_details_playlist.onclick = showActionMenuDetailsPlaylist;



// ==============================================
// Affichage des plalists de l'appli (PAGE PLAYLISTS)
// ==============================================


// Afficher les musiques depuis IndexedDB (PAGE LISTE DES TITRES)
function displayPlaylists() {
    const transaction = db.transaction('playlists', 'readonly');
    const objectStore = transaction.objectStore('playlists');
    const request = objectStore.getAll();

    request.onsuccess = async () => {
        const allPlaylists = request.result;
        
        // Met à jour l'affichage
        const playlistsContainer = document.getElementById('playlist-list');
        playlistsContainer.innerHTML = ''; // Réinitialise l'affichage
        let sortedPlaylists = sortByDate(allPlaylists, ordre="décroissant");

        sortedPlaylists.forEach(playlist => {
            const playlistBox = document.createElement('div');
            playlistBox.classList.add('playlist-box');



            playlistBox.innerHTML = `
                    <div class="playlist-info">
                        <p class="playlist-titre">${playlist.name}</p>
                        <div class="playlist-tags">
                            <p>Energique : ${playlist.criteria.minEnergique}-${playlist.criteria.maxEnergique}</p>
                            <p>Joyeuse : ${playlist.criteria.minJoyeuse}-${playlist.criteria.maxJoyeuse}</p>
                            <p>Musicale : ${playlist.criteria.minMusicale}-${playlist.criteria.maxMusicale}</p>
                        </div>
                        <p class="criteria">Artiste (${heartConvertToEmojis(playlist.criteria.artistHeart)}) ${playlist.criteria.author !== "" ? ":" : ""} ${playlist.criteria.author}</p>
                        <p class="criteria">Album (${heartConvertToEmojis(playlist.criteria.albumHeart)}) ${playlist.criteria.album !== "" ? ":" : ""} ${playlist.criteria.album}</p>
                        <p class="criteria">Titre (${heartConvertToEmojis(playlist.criteria.titleHeart)}) ${playlist.criteria.title !== "" ? ":" : ""} ${playlist.criteria.title}</p>
                    </div>
                    <button class="action-btn-playlist" data-id="${playlist.id}">⋮</button>
            `;
            playlistsContainer.appendChild(playlistBox);
        });
    };
};

// Connexion à l'interface : (PAGE IMPORTER) Gérer le menu d'action pour modifier ou supprimer une musique
document.getElementById('playlist-list').addEventListener('click', async event => {
    if (event.target.classList.contains('action-btn-playlist')) {
        const playlistId = event.target.getAttribute('data-id');
        
        const playlist = await getPlaylistFromIndexedDB(playlistId);
        showPlaylistMenu(playlist);
    }
});

function heartConvertToEmojis(heart){
    if (heart == "all"){
        return "✔"
    } else if (heart == "all-hearts"){
        return "🤍🧡"
    } else if (heart == "only-super-heart"){
        return "🧡"
    } else if (heart == "all-except-super-heart"){
        return "✖🧡"
    } else if (heart == "only-simple-heart"){
        return "🤍"
    } else if (heart == "only-without-heart"){
        return "✖"
    } 
}

function showPlaylistMenu(playlist){
    // Supprime les classes "active" des boutons et sections
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));

    // Active le bouton et la section "playlist-details"
    document.getElementById("playlist-details").classList.add('active');

    playlistActuellementExaminee = playlist.id;

    // Met à jour les affichages du chaque liste dans chaque PAGE
    displayPlaylistDetails(playlist);
}


// ==============================================
// Gestion de la fenêtre modale pour la création d'une playlist Spotify "To Rate"
// ! Cette playlist n'est pas dans un ordre aléatoire
// ==============================================

// Récupérer le bouton
const btnToRateModal = document.getElementById("create-spotify-playlist-musics-to-rate");

// Fonction pour créer et afficher la fenêtre modale de création d'une playliste
function showPlaylistModalCreatetoRateSpotifyPlaylist() {

    // Créer le code HTML de la modale
    const modalHTML = `
        <div id="playlist-modal" class="modal">
            <div class="modal-content-create-playlist">
                <h2>Nouvelle playlist Spotify</h2>
                <p>Nombre de titres : <span id="track-count">${musicNumber_musicsToRate}</span></p>
                <p>Durée totale : <span id="total-duration">${formatDurationLong(totalDuration_musicsToRate)}</span></p>
                <input type="text" id="playlist-name" placeholder="Nom de la playlist">
                <div class="end-line-of-modal-playlist-creation">
                    <button id="close-modal-playlist-creation">Fermer</button>
                    <button id="create-playlist-btn">Créer</button>
                </div>
            </div>
        </div>
    `;
    
    // Ajouter le HTML de la modale à la page
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Afficher la modale
    const modal = document.getElementById("playlist-modal");
    modal.style.display = "block";

    // Récupérer les éléments de la modale
    const closeBtn = document.getElementById("close-modal-playlist-creation");
    const createPlaylistBtnCreationFromToRate = document.getElementById("create-playlist-btn");
    const nameInput = document.getElementById("playlist-name");

    // Fermer la modale lorsque l'utilisateur clique sur le bouton de fermeture
    closeBtn.onclick = function() {
        modal.style.display = "none";
        modal.remove();  // Supprimer la modale après fermeture
    }

    // Créer la playlist et afficher le message dans la console
    createPlaylistBtnCreationFromToRate.onclick = function() {
        const playlistName = nameInput.value;
        if (playlistName) {

            const transaction = db.transaction('musics', 'readonly');
            const objectStore = transaction.objectStore('musics');
            const request = objectStore.getAll(); // Récupère tous les enregistrements

            request.onsuccess = () => {
                const musics = request.result.filter(music => {
                    // Appliquer les critères de filtrage
                    return (
                        (!music.customFields.energique || !music.customFields.joyeuse || !music.customFields.musicale)
                    );
                });
                if (musics.length > 0) {
                    createNewPlaylist(playlistName, sortByDate(musics, ordre = "croissant"));
                    console.log("Playlist créée (to rate) avec le nom : " + playlistName + " Ajouter une fenêtre de validation");
                }
            };

            request.onerror = (event) => {
                console.error('Erreur lors de la récupération des données :', event.target.error);
            };

            modal.style.display = "none";
            modal.remove();  // Supprimer la modale après création
        } else {
            alert("Veuillez entrer un nom pour la playlist.");
        }
    }

    // Fermer la modale si l'utilisateur clique en dehors de la fenêtre modale
    window.onclick = function(event) {
        if (event.target === modal) {
            modal.style.display = "none";
            modal.remove();  // Supprimer la modale après fermeture
        }
    }
}

// Ajouter l'événement au bouton pour afficher la modale
btnToRateModal.onclick = showPlaylistModalCreatetoRateSpotifyPlaylist;



// ==============================================
// Gestion de la fenêtre modale pour la création d'une playlist Spotify depuis une Playlist de l'appli
// ! Cette playlist est dans un ordre aléatoire
// ==============================================

// Fonction pour créer et afficher la fenêtre modale de création d'une playliste
async function showPlaylistModalCreateSpotifyPlaylist() {

    console.log("Bouton de création de playlist Spotify CLIQUE")

    playlist = await getPlaylistFromIndexedDB(playlistActuellementExaminee);
    
    const transaction = db.transaction('musics', 'readonly');
    const objectStore = transaction.objectStore('musics');
    const request = objectStore.getAll();

    request.onsuccess = async () => {
        const allMusics = request.result;

        // Filtrer les musiques basés sur les critères de la playlist
        // Le filtrage se fait de manière asynchrone
        const filteredMusics = (await Promise.all(
            allMusics.map(async music => ({
                music,
                matches: await doesMusicCorrespondToCurrentFilters(music, playlist.criteria)
            }))
        )).filter(result => result.matches).map(result => result.music);

        // Met à jour l'affichage
        totalDuration = 0;
        const shuffledMusics = shuffleArray(filteredMusics);

        shuffledMusics.forEach(music => {
            totalDuration += music.duration;
        });
        musicNumber = filteredMusics.length;

        // Supprimer la modale précédente dans ce cas (Car modale puis autre modale)
        const ancienneModal = document.getElementById("playlist-modal");
        ancienneModal.style.display = "none";
        ancienneModal.remove();  // Supprimer la modale après fermeture

        // Créer le code HTML de la modale
        const modalHTML = `
            <div id="playlist-modal" class="modal">
                <div class="modal-content-create-playlist">
                    <h2>Nouvelle playlist Spotify</h2>
                    <p>Nombre de titres : <span id="track-count">${musicNumber}</span></p>
                    <p>Durée totale : <span id="total-duration">${formatDurationLong(totalDuration)}</span></p>
                    <input type="text" id="playlist-name" placeholder="Nom de la playlist">
                    <div class="end-line-of-modal-playlist-creation">
                        <button id="close-modal-playlist-creation">Fermer</button>
                        <button id="create-playlist-btn">Créer</button>
                    </div>
                </div>
            </div>
        `;
        
        // Ajouter le HTML de la modale à la page
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Afficher la modale
        const modal = document.getElementById("playlist-modal");
        modal.style.display = "block";

        console.log(modal)

        // Récupérer les éléments de la modale
        const closeBtn = document.getElementById("close-modal-playlist-creation");
        const createPlaylistBtnCreationFromAction = document.getElementById("create-playlist-btn");
        const nameInput = document.getElementById("playlist-name");

        // Fermer la modale lorsque l'utilisateur clique sur le bouton de fermeture
        closeBtn.onclick = function() {
            modal.style.display = "none";
            modal.remove();  // Supprimer la modale après fermeture
        }

        // Créer la playlist et afficher le message dans la console
        createPlaylistBtnCreationFromAction.onclick = function() {
            const playlistName = nameInput.value;
            
            if (playlistName) {
                if (shuffledMusics.length > 0) {
                    createNewPlaylist(playlistName, shuffledMusics);
                    console.log("Playlist créée (depuis une playlist de l'appli) avec le nom : " + playlistName + " Ajouter une fenêtre de validation");
                }
                modal.style.display = "none";
                modal.remove();  // Supprimer la modale après création
            } else {
                alert("Veuillez entrer un nom pour la playlist.");
            }
        }

        // Fermer la modale si l'utilisateur clique en dehors de la fenêtre modale
        window.onclick = function(event) {
            if (event.target === modal) {
                modal.style.display = "none";
                modal.remove();  // Supprimer la modale après fermeture
            }
        }
    }
}



// ==============================================
// Gestion du scrolling pour la PAGE LISTE DES TITRES
// ==============================================

let lastScrollPosition = 0; // Position de défilement précédente
const menu_zone_filtrage = document.getElementById("haut-de-page");
const music_list = document.getElementById("music-list");
const menu_zone_details_playlist = document.getElementById("haut-de-page-playlist");
const music_of_playlist_list = document.getElementById("music-of-playlist-list");

window.addEventListener("scroll", () => {
    const currentScrollPosition = window.scrollY;

    if (currentScrollPosition > lastScrollPosition + 10) {
        // Défilement vers le bas - cacher le menu
        menu_zone_filtrage.classList.remove("menu-visible");
        menu_zone_filtrage.classList.add("menu-cache");
        menu_zone_details_playlist.classList.remove("menu-visible");
        menu_zone_details_playlist.classList.add("menu-cache");
        music_list.classList.add("menu-cache");
        music_of_playlist_list.classList.add("menu-cache");
    } else {
        if (currentScrollPosition < lastScrollPosition - 10) {
            // Défilement vers le haut - afficher le menu
            menu_zone_filtrage.classList.remove("menu-cache");
            menu_zone_filtrage.classList.add("menu-visible");
            menu_zone_details_playlist.classList.remove("menu-cache");
            menu_zone_details_playlist.classList.add("menu-visible");
            music_list.classList.remove("menu-cache");
            music_of_playlist_list.classList.remove("menu-cache");
        }
    }

    // Mettre à jour la position précédente
    lastScrollPosition = currentScrollPosition;
});



// ==============================================
// Gérer la sauvegarde des données (écrase les anciennes) -> PAGE SAUVEGARDE/SYNCHRONISATION
// ==============================================

async function saveDatabase() {
    const dbData = {}; // Objet pour stocker les données des 4 objectStore

    // Liste des objectStore à parcourir
    const storeNames = ['musics', 'albums', 'artists', 'playlists'];

    for (const storeName of storeNames) {
        dbData[storeName] = await getAllDataFromStore(storeName);
    }

    // Créer un fichier JSON à partir des données récupérées
    const jsonString = JSON.stringify(dbData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'database_backup.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Fonction pour récupérer toutes les données d'un objectStore
function getAllDataFromStore(storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

// Événement pour le bouton de sauvegarde
document.getElementById('save-db-btn').addEventListener('click', saveDatabase);


// ==============================================
// Gérer l'import de données (écrase les anciennes) -> PAGE SAUVEGARDE/SYNCHRONISATION
// ==============================================

function restoreDatabase(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const dbData = JSON.parse(e.target.result);
            const storeNames = Object.keys(dbData);

            for (const storeName of storeNames) {
                await clearAndInsertData(storeName, dbData[storeName]);
            }
            alert('Base de données restaurée avec succès !');
        } catch (error) {
            console.error('Erreur lors de la restauration des données :', error);
            alert('Erreur lors de la restauration.');
        }
    };

    reader.readAsText(file);
}

// Fonction pour vider un objectStore et insérer de nouvelles données
function clearAndInsertData(storeName, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const objectStore = transaction.objectStore(storeName);

        // Vider le store avant d'insérer les nouvelles données
        const clearRequest = objectStore.clear();
        clearRequest.onsuccess = () => {
            for (const item of data) {
                objectStore.add(item);
            }
            resolve();
        };
        clearRequest.onerror = (event) => reject(event.target.error);
    });
}

// Événement pour le bouton de restauration
document.getElementById('restore-db-btn').addEventListener('click', () => {
    document.getElementById('restore-db-input').click();
});
document.getElementById('restore-db-input').addEventListener('change', restoreDatabase);

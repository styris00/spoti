# 🎵 Spoti++ — Application de gestion avancée des playlists Spotify

Une application web permettant d’importer, filtrer, nettoyer, réorganiser et exporter des playlists Spotify, avec stockage local (IndexedDB), interface moderne et authentification OAuth 2.0 via **Authorization Code with PKCE**.

---

# 📚 Table des matières

1. [Introduction](#introduction)  
2. [Fonctionnalités principales](#fonctionnalités-principales)  
3. [Architecture du projet](#architecture-du-projet)  
4. [Installation et Déploiement](#installation-et-déploiement)  
5. [Configuration Spotify Developer](#configuration-spotify-developer)  
6. [Authentification Spotify (PKCE)](#authentification-spotify-pkce)  
7. [Structure de la base IndexedDB](#structure-de-la-base-indexeddb)  
8. [Workflow utilisateur](#workflow-utilisateur)  
9. [Roadmap et Optimisations](#roadmap-et-optimisations)  
10. [Licence](#licence)

---

# 1. 📖 Introduction

Cette application vous permet de gérer vos playlists Spotify avec beaucoup plus de liberté que l’interface officielle :

- Import de playlists
- Filtrage avancé
- Tri intelligent
- Nettoyage de doublons
- Gestion de musiques locales stockées côté utilisateur
- Export vers Spotify (création et remplissage de playlists)

Le tout en **100% front-end**, sans serveur, compatible avec GitHub Pages.

---

# 2. ✨ Fonctionnalités principales

### 🔐 Authentification PKCE (conforme 2025)
- Flow **Authorization Code with PKCE** (remplace Implicit Grant déprécié)
- Compatible avec les SPA
- Renouvellement automatique du token

### 🎧 Importation de playlists
- Récupération paginée des titres
- Comparaison avec la base locale
- Mise à jour intelligente

### 💾 Base locale IndexedDB
- Stockage durable côté navigateur
- Accès ultra rapide
- Pas de dépendance serveur
- Gestion de plusieurs milliers de musiques

### 🧹 Gestion des musiques
- Filtres
- Recherche instantanée
- Déduplication
- Notation personnalisée
- Sélections multiples

### 📤 Export Spotify
- Création de playlist
- Envoi par batch (API-limit aware)
- Retry automatique

---

# 3. 🏗 Architecture du projet

Pour améliorer la maintenabilité, le projet suit une architecture modulaire :
```
/spoti
    /js
        auth.js ← Authentification Spotify (PKCE)
        spotify-api.js ← Wrapper Fetch + tokens + retry
        db.js ← Gestion IndexedDB (init + CRUD)
        playlists.js ← Import/export Spotify
        musics.js ← Gestion et opérations sur les musiques
        ui.js ← Interface utilisateur / DOM
        utils.js ← Fonctions d’aide
        sw.js ← Service Worker (optionnel)
    index.html
    styles.css
    README.md
```



**Objectifs :**
- Séparation claire des responsabilités  
- Code plus lisible  
- Tests plus faciles  
- Extensibilité (nouveaux modules indépendants)

---

# 4. ⚙ Installation et Déploiement

### 🔧 Local
Aucun backend requis.  
Il suffit d’ouvrir `index.html` dans un navigateur moderne.

### 🌐 Déploiement GitHub Pages
1. Créer un repo (ex : `spoti`)
2. Mettre les fichiers à la racine
3. Dans *Settings → Pages* :  
   - Source : `main`  
   - Dossier : `/root`  
4. L’application sera disponible à :  
   `https://<votre_user>.github.io/spoti/`

---

# 5. 🎛 Configuration Spotify Developer

### 1. Créer une application Spotify
https://developer.spotify.com/dashboard

### 2. Configurer le Redirect URI
Ajouter :
https://<votre_user>.github.io/spoti/

### 3. Récupérer le Client ID
À copier dans `auth.js`.

### 4. Scopes nécessaires
- playlist-read-private  
- playlist-read-collaborative  
- playlist-modify-private  
- playlist-modify-public  
- user-read-email (optionnel)  

### 5. Désactivation du flow Implicit
Spotify désactive `response_type=token` fin 2025.  
Le projet utilise donc PKCE par défaut.

---

# 6. 🛡 Authentification Spotify (PKCE)

Le flow PKCE se déroule en 7 étapes :

1. Génération d’un `code_verifier`
2. Calcul du `code_challenge = SHA256(verifier)`
3. Redirection vers Spotify (`response_type=code`)
4. Retour avec `?code=...`
5. Échange du code contre :
   - `access_token`
   - `refresh_token`
6. Stockage sécurisé dans `localStorage`
7. Renouvellement automatique à l’expiration

**Avantages :**
- Sécurisé même en front-end pur
- Ne nécessite pas de `client_secret`
- Reconnexion automatique grâce au `refresh_token`

---

# 7. 🗄 Structure de la base IndexedDB

Base : **spotiDB**

### Store `musics`
- id (clé Spotify)
- name
- artists
- album
- duration
- popularity
- addedAt
- rating
- flags internes (doublon, favori…)

### Store `playlists`
- id interne
- name
- spotifyId
- count
- importedAt

### Store `settings` (optionnel)
- Préférences utilisateur

IndexedDB permet :
- des listes très longues
- des accès rapides
- une utilisation hors-ligne partielle

---

# 8. 👣 Workflow utilisateur

### 1) Connexion
L’utilisateur clique sur “Se connecter”, l’app redirige vers Spotify → token stocké.

### 2) Import d’une playlist
- Récupération paginée (limite 100 titres/req)
- Ajout / mise à jour dans IndexedDB
- Détection des nouveaux titres

### 3) Gestion locale
- Filtre
- Tri
- Éditions
- Suppressions
- Détection doublons

### 4) Export
- Création d’une nouvelle playlist Spotify
- Ajout par batches de 90 titres max
- Gestion des erreurs + retry

---

# 9. 🚀 Roadmap et Optimisations

### Techniques
- Ajout d’un système de logs unifié
- Amélioration du service worker (cache intelligent)
- Optimisation des requêtes batch
- Refactor complet du DOM en composants

### UI/UX
- Recherche plus rapide (debounce)

### Fonctionnalités futures
- Analyse de BPM / énergie
- Moteur de recommandations interne
- Historique des modifications de playlist



# Mboa-FloodWatch — Guide Complet de Deploiement

> Procedure detaillee pour deployer la plateforme en **local** et **en ligne** (Firebase Hosting).

---

## Table des Matieres

1. [Pre-requis](#1-pre-requis)
2. [Deploiement Local (Developpement)](#2-deploiement-local-developpement)
3. [Configuration Firebase (Production)](#3-configuration-firebase-production)
4. [Deploiement en Ligne (Firebase Hosting)](#4-deploiement-en-ligne-firebase-hosting)
5. [Deploiement du Script GEE (Backend Python)](#5-deploiement-du-script-gee-backend-python)
6. [Deploiement des Cloud Functions](#6-deploiement-des-cloud-functions)
7. [Configuration des Alertes SMS/Email](#7-configuration-des-alertes-smsemail)
8. [Verification Post-Deploiement](#8-verification-post-deploiement)
9. [Architecture de Production](#9-architecture-de-production)
10. [Depannage](#10-depannage)

---

## 1. Pre-requis

### Logiciels a installer

| Outil | Version | Installation |
|-------|---------|-------------|
| **Node.js** | >= 18 (recommande: 22) | https://nodejs.org/ |
| **npm** | >= 9 | Inclus avec Node.js |
| **Python** | >= 3.9 | https://www.python.org/ |
| **Git** | >= 2.30 | https://git-scm.com/ |
| **Firebase CLI** | >= 13 | `npm install -g firebase-tools` |

### Comptes necessaires

| Service | Usage | Lien |
|---------|-------|------|
| **Firebase / Google Cloud** | Hosting, Firestore, Cloud Functions | https://console.firebase.google.com/ |
| **Google Earth Engine** | Analyse Sentinel-1 SAR | https://earthengine.google.com/ |
| **Twilio** *(optionnel)* | Alertes SMS | https://www.twilio.com/ |
| **Gmail App Password** *(optionnel)* | Alertes Email | https://myaccount.google.com/apppasswords |

---

## 2. Deploiement Local (Developpement)

### Etape 2.1 — Cloner le depot

```bash
git clone https://github.com/mlklynch/mboa-floodwatch.git
cd mboa-floodwatch
```

### Etape 2.2 — Installer les dependances du frontend

```bash
cd frontend
npm install
```

Cela installe : React 19, Vite 8, Leaflet, Firebase SDK, Turf.js, ESLint.

### Etape 2.3 — Configurer les variables d'environnement (optionnel)

Creer le fichier `frontend/.env` :

```env
# Firebase Configuration
# Si ces variables ne sont pas definies, l'app utilise le projet par defaut
# "mboa-floodwatch-5227b" et fonctionne en mode demo si Firestore est inaccessible.

VITE_FIREBASE_API_KEY=votre-api-key
VITE_FIREBASE_AUTH_DOMAIN=mboa-floodwatch-5227b.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=mboa-floodwatch-5227b
VITE_FIREBASE_STORAGE_BUCKET=mboa-floodwatch-5227b.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=votre-sender-id
VITE_FIREBASE_APP_ID=votre-app-id
```

> **Note :** Sans fichier `.env`, l'application fonctionne quand meme avec des donnees de demonstration (8 polygones couvrant Douala, Yaounde, Maroua, Garoua, Bamenda, Limbe, Bertoua, Kribi).

### Etape 2.4 — Lancer le serveur de developpement

```bash
npm run dev
```

Le serveur demarre sur **http://localhost:5173**.

Vous devriez voir :
- La barre de navigation verte avec "Mboa-FloodWatch"
- Le panneau lateral avec les statistiques, archives et formulaire d'inscription
- La carte Leaflet centree sur le Cameroun avec les polygones de risque colores

### Etape 2.5 — Verifier la qualite du code

```bash
# Linter ESLint
npm run lint

# Build de production (verification)
npm run build
```

Le build genere les fichiers dans `frontend/dist/`.

### Etape 2.6 — Tester le build de production localement

```bash
npm run preview
```

Cela sert les fichiers du dossier `dist/` sur **http://localhost:4173**.

---

## 3. Configuration Firebase (Production)

### Etape 3.1 — Creer un projet Firebase

1. Aller sur https://console.firebase.google.com/
2. Cliquer **"Ajouter un projet"**
3. Nom du projet : `mboa-floodwatch` (ou votre choix)
4. Activer Google Analytics (optionnel)
5. Cliquer **"Creer le projet"**

### Etape 3.2 — Activer Firestore

1. Dans la console Firebase, aller a **"Firestore Database"**
2. Cliquer **"Creer une base de donnees"**
3. Choisir l'emplacement : **`eur3` (Europe)** (recommande pour le Cameroun)
4. Choisir **"Mode production"**
5. Cliquer **"Activer"**

### Etape 3.3 — Deployer les regles Firestore

Les regles sont deja definies dans `firestore.rules` :

```
service cloud.firestore {
  match /databases/{database}/documents {
    match /flood_events/{event} {
      allow read: if true;          // Lecture publique
      allow write: if false;        // Ecriture uniquement via Admin SDK (GEE)
      match /polygons/{poly} {
        allow read: if true;
      }
    }
    match /subscribers/{sub} {
      allow create: if true;        // Inscription publique
      allow read: if false;         // Donnees privees
    }
  }
}
```

Deployer :

```bash
firebase deploy --only firestore:rules
```

### Etape 3.4 — Enregistrer une application Web

1. Dans la console Firebase, aller a **"Parametres du projet"** (icone engrenage)
2. Sous **"Vos applications"**, cliquer **"</>"** (Web)
3. Nom : `Mboa-FloodWatch Web`
4. Cocher **"Configurer Firebase Hosting"**
5. Cliquer **"Enregistrer l'application"**
6. Copier les valeurs de configuration (`apiKey`, `authDomain`, etc.)
7. Les coller dans `frontend/.env` (voir Etape 2.3)

### Etape 3.5 — Generer un compte de service (pour le script GEE)

1. Dans la console Firebase, aller a **"Parametres du projet"** > **"Comptes de service"**
2. Cliquer **"Generer une nouvelle cle privee"**
3. Sauvegarder le fichier JSON sous `backend/gee/serviceAccountKey.json`

> **IMPORTANT :** Ne jamais commiter ce fichier ! Il est deja dans `.gitignore`.

---

## 4. Deploiement en Ligne (Firebase Hosting)

### Etape 4.1 — Authentifier Firebase CLI

```bash
firebase login
```

Cela ouvre un navigateur pour l'authentification Google.

### Etape 4.2 — Configurer le projet Firebase

```bash
# Depuis la racine du projet
firebase use mboa-floodwatch-5227b
```

Ou si vous utilisez un autre projet :

```bash
firebase use --add
# Selectionnez votre projet dans la liste
```

### Etape 4.3 — Builder le frontend pour la production

```bash
cd frontend
npm run build
```

Cela genere les fichiers optimises dans `frontend/dist/`.

Verifier que le dossier contient :
```
frontend/dist/
  index.html
  assets/
    index-[hash].js
    index-[hash].css
```

### Etape 4.4 — Deployer sur Firebase Hosting

```bash
# Depuis la racine du projet
cd ..
firebase deploy --only hosting
```

Sortie attendue :
```
=== Deploying to 'mboa-floodwatch-5227b'...
i  deploying hosting
i  hosting[mboa-floodwatch-5227b]: beginning deploy...
i  hosting[mboa-floodwatch-5227b]: found 5 files in frontend/dist
+  hosting[mboa-floodwatch-5227b]: file upload complete
i  hosting[mboa-floodwatch-5227b]: finalizing version...
+  hosting[mboa-floodwatch-5227b]: version finalized
i  hosting[mboa-floodwatch-5227b]: releasing new version...
+  hosting[mboa-floodwatch-5227b]: release complete

+  Deploy complete!

Hosting URL: https://mboa-floodwatch-5227b.web.app
```

### Etape 4.5 — Verifier le deploiement

Ouvrir l'URL fournie dans un navigateur :
- **URL principale :** `https://mboa-floodwatch-5227b.web.app`
- **URL alternative :** `https://mboa-floodwatch-5227b.firebaseapp.com`

> **Domaine personnalise (optionnel) :** Pour utiliser `mboa-floodwatch.cm`, aller dans Firebase Console > Hosting > Ajouter un domaine personnalise, puis configurer les enregistrements DNS chez votre registrar.

---

## 5. Deploiement du Script GEE (Backend Python)

Le script Python `backend/gee/detection_radar.py` est le moteur d'analyse Sentinel-1 SAR. Il s'execute manuellement ou via un cron/scheduler.

### Etape 5.1 — Creer l'environnement Python

```bash
cd backend/gee

# Creer un environnement virtuel
python3 -m venv venv
source venv/bin/activate    # Linux/Mac
# venv\Scripts\activate     # Windows

# Installer les dependances
pip install -r requirements.txt
```

Dependances installees : `earthengine-api`, `firebase-admin`, `geojson`.

### Etape 5.2 — Placer la cle de service

Copier le fichier `serviceAccountKey.json` (genere a l'Etape 3.5) dans `backend/gee/` :

```
backend/gee/
  detection_radar.py
  requirements.txt
  serviceAccountKey.json    <-- votre cle ici
```

### Etape 5.3 — Activer l'API Earth Engine

1. Aller sur https://console.cloud.google.com/
2. Selectionner votre projet (`mboa-floodwatch-5227b`)
3. Aller a **"API et services"** > **"Bibliotheque"**
4. Chercher **"Earth Engine API"**
5. Cliquer **"Activer"**

### Etape 5.4 — Enregistrer le projet GEE

1. Aller sur https://code.earthengine.google.com/
2. S'assurer que le compte de service est enregistre pour le projet
3. Ou visiter https://signup.earthengine.google.com/ pour enregistrer le projet

### Etape 5.5 — Executer une analyse

```bash
# Depuis backend/gee/
python detection_radar.py
```

Sortie attendue :
```
  MBOA-FLOODWATCH
  Pipeline Sentinel-1 SAR -> Firestore

[OK] Authentification Google Earth Engine reussie.
[OK] Authentification Firebase reussie.

============================================================
  MBOA-FLOODWATCH — Analyse Sentinel-1 SAR
  Region : Cameroun - Littoral (Douala/Edea)
  Avant  : 2026-03-01 -> 2026-03-20
  Apres  : 2026-04-01 -> 2026-04-11
============================================================

[INFO] 42 zones d'inondation detectees (apres filtrage).

  Classification des risques :
    Critique  (3) : 5 zones
    Alerte    (2) : 12 zones
    Vigilance (1) : 25 zones
    Total         : 42 zones

[OK] 42 zones envoyees a Firestore (event: event_20260401).
```

### Etape 5.6 — Analyser d'autres zones

Modifier les parametres dans `detection_radar.py` ou creer un script wrapper :

```python
from detection_radar import initialize_services, run_flood_detection_pipeline

initialize_services()

# Analyser toutes les zones predefinies
for zone_key in ["littoral", "extreme_nord", "nord", "sud_ouest"]:
    run_flood_detection_pipeline(
        before_start="2026-08-01",
        before_end="2026-09-15",
        after_start="2026-10-01",
        after_end="2026-10-31",
        zone_key=zone_key,
    )
```

### Etape 5.7 — Automatiser avec un cron (optionnel)

Pour executer l'analyse automatiquement chaque jour :

```bash
# Ouvrir le crontab
crontab -e

# Ajouter une ligne (execution chaque jour a 6h UTC)
0 6 * * * cd /chemin/vers/backend/gee && /chemin/vers/venv/bin/python detection_radar.py >> /var/log/mboa-floodwatch.log 2>&1
```

Ou via **Google Cloud Scheduler + Cloud Run** pour une solution serverless :

1. Containeriser le script avec Docker
2. Deployer sur Cloud Run
3. Creer un job Cloud Scheduler qui appelle le service quotidiennement

---

## 6. Deploiement des Cloud Functions

Les Cloud Functions gerent les alertes automatiques (SMS + Email) et l'inscription des abonnes.

### Etape 6.1 — Installer les dependances

```bash
cd functions
npm install
```

### Etape 6.2 — Configurer les secrets Twilio et SMTP

```bash
# Configuration Twilio (SMS)
firebase functions:config:set \
  twilio.sid="VOTRE_TWILIO_ACCOUNT_SID" \
  twilio.token="VOTRE_TWILIO_AUTH_TOKEN" \
  twilio.from="+1234567890"

# Configuration SMTP (Email via Gmail)
firebase functions:config:set \
  smtp.user="votre-email@gmail.com" \
  smtp.pass="votre-app-password"
```

> **Note :** Pour Gmail, vous devez utiliser un **mot de passe d'application** (pas votre mot de passe normal). Generez-le sur https://myaccount.google.com/apppasswords.

### Etape 6.3 — Tester localement (optionnel)

```bash
# Depuis la racine du projet
firebase emulators:start --only functions,firestore
```

Cela demarre les emulateurs Firebase locaux pour tester sans deployer.

### Etape 6.4 — Deployer les Cloud Functions

```bash
# Depuis la racine du projet
firebase deploy --only functions
```

Sortie attendue :
```
=== Deploying to 'mboa-floodwatch-5227b'...
i  deploying functions
i  functions: preparing functions directory for uploading...
+  functions: functions folder uploaded successfully
i  functions: creating Node.js 22 function onNewFloodEvent(europe-west3)...
i  functions: creating Node.js 22 function registerSubscriber(europe-west3)...
+  functions[onNewFloodEvent(europe-west3)]: Successful create operation.
+  functions[registerSubscriber(europe-west3)]: Successful create operation.

+  Deploy complete!
```

### Fonctions deployees :

| Fonction | Declencheur | Description |
|----------|------------|-------------|
| `onNewFloodEvent` | Firestore `onCreate` sur `flood_events/{eventId}` | Envoie SMS + Email aux abonnes dans les zones touchees |
| `registerSubscriber` | HTTPS Callable | Enregistre un nouvel abonne dans Firestore |

---

## 7. Configuration des Alertes SMS/Email

### Option A : Twilio (SMS)

1. Creer un compte sur https://www.twilio.com/
2. Acheter un numero de telephone
3. Noter le `Account SID`, `Auth Token`, et le numero `From`
4. Configurer via Firebase Functions Config (Etape 6.2)

**Alternative locale (Cameroun) :** Remplacer Twilio par un service SMS local comme :
- **Orange SMS API** : https://developer.orange.com/
- **MTN MoMo API** : https://momodeveloper.mtn.com/
- **Infobip** : https://www.infobip.com/

### Option B : Email (Gmail/SMTP)

1. Activer la verification en 2 etapes sur votre compte Gmail
2. Generer un mot de passe d'application : https://myaccount.google.com/apppasswords
3. Configurer via Firebase Functions Config (Etape 6.2)

---

## 8. Verification Post-Deploiement

### Checklist de verification

```
[ ] 1. Le site est accessible via l'URL Firebase Hosting
[ ] 2. La carte Leaflet se charge avec les tuiles OpenStreetMap
[ ] 3. Les polygones de risque sont visibles sur la carte
[ ] 4. Les statistiques (Critique/Alerte/Vigilance/Total) sont correctes
[ ] 5. Le clic sur un polygone affiche un popup avec le niveau de risque
[ ] 6. Le selecteur d'archives historiques charge differents evenements
[ ] 7. Le formulaire d'inscription valide les champs obligatoires
[ ] 8. Le bouton "Ma Position" detecte la geolocalisation (HTTPS requis)
[ ] 9. Les Cloud Functions sont deployees et actives
[ ] 10. Le script GEE s'execute correctement avec la cle de service
```

### Tester la geolocalisation

> **IMPORTANT :** La geolocalisation du navigateur (`navigator.geolocation`) necessite **HTTPS**. Elle ne fonctionnera pas sur `http://localhost` (sauf exception pour `localhost` dans certains navigateurs). Firebase Hosting fournit HTTPS automatiquement.

---

## 9. Architecture de Production

```
                    +-------------------+
                    |   Utilisateur     |
                    |   (Navigateur)    |
                    +--------+----------+
                             |
                             | HTTPS
                             v
                    +-------------------+
                    | Firebase Hosting  |
                    | (React + Leaflet) |
                    | mboa-floodwatch   |
                    |   .web.app        |
                    +--------+----------+
                             |
                    +--------v----------+
                    |    Firestore      |
                    | (Base de donnees) |
                    +---+----------+----+
                        |          |
              +---------+          +----------+
              |                               |
    +---------v---------+          +----------v----------+
    | Cloud Functions   |          | Script GEE Python   |
    | (Alertes SMS/     |          | (Sentinel-1 SAR     |
    |  Email auto)      |          |  -> Firestore)      |
    +---------+---------+          +----------+----------+
              |                               |
    +---------v---------+          +----------v----------+
    | Twilio / SMTP     |          | Google Earth Engine  |
    | (Envoi messages)  |          | (Imagerie satellite) |
    +-------------------+          +---------------------+
```

### Flux de donnees :

1. **Script GEE** analyse les images Sentinel-1 SAR et ecrit les polygones dans Firestore
2. **Cloud Function `onNewFloodEvent`** se declenche automatiquement a chaque nouveau `flood_event`
3. La fonction compare la position de chaque abonne avec les polygones de risque
4. Si un abonne est dans une zone a risque, un SMS/Email est envoye
5. Le **frontend React** lit les polygones depuis Firestore en temps reel et les affiche sur la carte

---

## 10. Depannage

### Probleme : "Permission denied" sur Firestore

**Cause :** Les regles Firestore n'ont pas ete deployees.
```bash
firebase deploy --only firestore:rules
```

### Probleme : Le script GEE echoue avec "Not signed up for Earth Engine"

**Solution :** Enregistrer le compte de service sur GEE :
1. Aller sur https://signup.earthengine.google.com/
2. Utiliser le meme compte Google lie au projet Firebase

### Probleme : Les stats affichent 0/0/0

**Cause :** Bug de type — `risk_level` stocke comme string dans Firestore.
**Solution :** Ce bug a ete corrige dans le code actuel avec `Number()` coercion. Si vous avez une ancienne version, mettez a jour depuis `main`.

### Probleme : Les Cloud Functions ne se deployent pas

**Cause possible :** Plan Firebase gratuit (Spark) ne supporte pas les fonctions avec appels sortants.
**Solution :** Passer au plan **Blaze** (facturation a l'usage) : Firebase Console > Plan > Passer a Blaze.

### Probleme : Firebase Hosting affiche une page blanche

**Verifier :**
1. Que `npm run build` a ete execute avant le deploiement
2. Que le dossier `frontend/dist/` contient `index.html` et le dossier `assets/`
3. Que `firebase.json` pointe vers `"public": "frontend/dist"`

### Probleme : "Module not found" lors du build

```bash
cd frontend
rm -rf node_modules
npm install
npm run build
```

---

## Deploiement Rapide (Resume)

Pour ceux qui veulent aller vite, voici les commandes essentielles :

```bash
# 1. Cloner et installer
git clone https://github.com/mlklynch/mboa-floodwatch.git
cd mboa-floodwatch/frontend
npm install

# 2. Tester localement
npm run dev
# Ouvrir http://localhost:5173

# 3. Builder pour la production
npm run build

# 4. Deployer en ligne
cd ..
firebase login
firebase use mboa-floodwatch-5227b
firebase deploy --only hosting

# 5. (Optionnel) Deployer les Cloud Functions
cd functions && npm install && cd ..
firebase deploy --only functions

# 6. (Optionnel) Executer l'analyse GEE
cd backend/gee
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
# Placer serviceAccountKey.json dans ce dossier
python detection_radar.py
```

**URL finale :** `https://mboa-floodwatch-5227b.web.app`

---

*Guide redige pour Mboa-FloodWatch v1.0 — Avril 2026*

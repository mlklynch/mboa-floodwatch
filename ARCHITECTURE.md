# 🌊 Mboa-FloodWatch — Architecture & Documentation

> Plateforme citoyenne de surveillance satellite des inondations au Cameroun

---

## 📁 Structure des Dossiers

```
mboa-floodwatch/
│
├── 📂 backend/
│   │
│   ├── 📂 gee/                            # Google Earth Engine (Python)
│   │   ├── flood_detection.py             # ✅ Pipeline Sentinel-1 → Firestore
│   │   ├── requirements.txt               # earthengine-api, firebase-admin, geojson, turf
│   │   └── scheduler/
│   │       └── cron_job.py                # Tâche planifiée (ex: Cloud Scheduler)
│   │
│   └── 📂 functions/                      # Firebase Cloud Functions (Node.js)
│       ├── index.js                       # ✅ Alertes SMS/Email + inscription abonnés
│       ├── package.json
│       └── .env.example
│
├── 📂 frontend/
│   │
│   ├── 📂 public/
│   │   └── index.html                     # ✅ Interface complète (HTML/CSS/JS + Leaflet)
│   │
│   └── 📂 src/                            # Version React (optionnelle)
│       ├── App.jsx
│       ├── components/
│       │   ├── MboaMap.jsx                # ✅ Carte Leaflet + géolocalisation + calques
│       │   ├── Navbar.jsx
│       │   ├── SidePanel.jsx
│       │   ├── SubscribeForm.jsx          # Formulaire d'inscription alertes
│       │   ├── ArchiveSelector.jsx        # Sélecteur dates historiques
│       │   └── StatsGrid.jsx              # Statistiques en temps réel
│       ├── hooks/
│       │   ├── useFloodData.js            # Hook Firestore (flood_events)
│       │   └── useGeolocation.js          # Hook géolocalisation navigateur
│       ├── services/
│       │   ├── firebase.js                # Initialisation Firebase
│       │   └── floodService.js            # CRUD Firestore
│       └── styles/
│           ├── global.css                 # Variables CSS + reset
│           ├── map.css                    # Styles carte Leaflet
│           └── design-system.css          # Composants UI Cameroun
│
├── 📂 firestore/
│   └── firestore.rules                    # Règles de sécurité Firestore
│
├── 📂 docs/
│   ├── ARCHITECTURE.md                    # ✅ Ce fichier
│   ├── API.md                             # Documentation endpoints
│   └── GEE_SETUP.md                       # Guide configuration GEE
│
├── firebase.json
├── .firebaserc
└── README.md
```

---

## 🏗️ Architecture Technique

```
┌────────────────────────────────────────────────────────────────┐
│                    MBOA-FLOODWATCH ARCHITECTURE                │
└────────────────────────────────────────────────────────────────┘

  Satellite Sentinel-1 (Copernicus/ESA)
         │  Images SAR (radar, 30m, toutes météos)
         ▼
  ┌──────────────────────────┐
  │  Google Earth Engine     │  flood_detection.py
  │  - Filtrage Speckle      │  • Collecte images avant/après
  │  - Seuillage σ⁰ < -5dB  │  • Double seuillage VV
  │  - Classification 1/2/3  │  • Vectorisation GeoJSON
  │  - Vectorisation Polygones│
  └────────────┬─────────────┘
               │  GeoJSON (Polygones de risque)
               ▼
  ┌──────────────────────────┐
  │  Firebase Firestore       │
  │  /flood_events/{id}       │  Base de données NoSQL
  │    /polygons/{id}         │  • Stockage temps réel
  │  /subscribers/{id}        │  • Écoute en temps réel
  │  /alerts/{id}             │
  └────────────┬─────────────┘
               │  Trigger onNewFloodEvent
               ▼
  ┌──────────────────────────┐
  │  Cloud Functions (Node)  │  index.js
  │  - Test collision géo     │  • Turf.js booleanPointInPolygon
  │  - Envoi SMS (Twilio)    │  • Filtrage abonnés concernés
  │  - Envoi Email (SMTP)    │  • Multi-canal
  └────────────┬─────────────┘
               │
               ▼
  ┌──────────────────────────┐
  │  Frontend (React/HTML)   │  MboaMap.jsx / index.html
  │  - Leaflet.js (carte)    │  • Affichage temps réel
  │  - Calques Vert/Jaune/Rouge│ • Géolocalisation utilisateur
  │  - Outil "Ma Position"   │  • Archives historiques
  │  - Archives historiques  │
  └──────────────────────────┘
         │
         ▼  Utilisateur
  📱 Navigateur Web / Mobile
  📟 SMS Twilio
  📧 Email HTML
```

---

## 🗃️ Schéma de Base de Données Firestore

```
firestore/
│
├── flood_events/
│   └── {event_id}/                        # ex: "event_20241015"
│       ├── before_date: "2024-09-15"
│       ├── after_date:  "2024-10-15"
│       ├── region:      "Cameroun"
│       ├── status:      "active"
│       ├── feature_count: 12
│       ├── created_at:  Timestamp
│       └── polygons/
│           └── {poly_id}/
│               ├── geometry:   string (JSON GeoJSON)
│               ├── risk_level: number (1|2|3)
│               ├── risk_label: string ("VIGILANCE"|"ALERTE"|"CRITIQUE")
│               ├── area_m2:    number
│               ├── event_id:   string
│               └── analyzed_at: string
│
├── subscribers/
│   └── {subscriber_id}/
│       ├── name:       string
│       ├── city:       string
│       ├── phone:      string | null
│       ├── email:      string | null
│       ├── latitude:   number | null
│       ├── longitude:  number | null
│       ├── active:     boolean
│       └── registered_at: Timestamp
│
└── alerts/
    └── {alert_id}/
        ├── user_id:    string → subscribers/{id}
        ├── event_id:   string → flood_events/{id}
        ├── risk_level: number
        ├── risk_label: string
        ├── city:       string
        ├── channels:   ["sms", "email"]
        └── sent_at:    Timestamp
```

---

## 🚀 Guide de Démarrage Rapide

### 1. Prérequis

```bash
# Python 3.9+
pip install earthengine-api firebase-admin geojson

# Node.js 18+
cd backend/functions
npm install firebase-admin firebase-functions twilio nodemailer @turf/turf

# Frontend React (optionnel)
cd frontend
npm create vite@latest . -- --template react
npm install leaflet @turf/turf firebase
```

### 2. Configuration Google Earth Engine

```bash
# Authentifier votre compte GEE
earthengine authenticate

# Créer un projet GCP et activer l'API Earth Engine
# Télécharger votre clé de service Firebase → serviceAccountKey.json
```

### 3. Configuration Firebase

```bash
# Installer Firebase CLI
npm install -g firebase-tools
firebase login

# Initialiser le projet
firebase init firestore functions hosting

# Configurer les secrets Cloud Functions
firebase functions:config:set \
  twilio.sid="ACxxxxxx" \
  twilio.token="xxxxxx" \
  twilio.from="+1234567890" \
  smtp.user="your@email.cm" \
  smtp.pass="your-smtp-password"

# Déployer
firebase deploy
```

### 4. Lancer la Détection (Pipeline Python)

```bash
# Analyse manuelle
python backend/gee/flood_detection.py

# Ou via paramètres (saison des pluies 2024)
python -c "
from backend.gee.flood_detection import run_flood_detection_pipeline
run_flood_detection_pipeline(
    before_start='2024-08-01', before_end='2024-09-15',
    after_start='2024-10-01',  after_end='2024-10-31'
)
"
```

---

## 🎨 Design System — Cameroun

| Token         | Valeur    | Usage                          |
|---------------|-----------|--------------------------------|
| `--green`     | `#007A5E` | Navbar, succès, vigilance       |
| `--red`       | `#CE1126` | Alertes critiques, danger       |
| `--yellow`    | `#FCD116` | Alerte modérée, CTA             |
| `--font-main` | Sora      | Interface principale            |
| `--font-mono` | Space Mono| Données satellite, coordonnées  |

---

## 📡 Fonctionnalités

| Code | Nom                    | Statut | Description                                    |
|------|------------------------|--------|------------------------------------------------|
| F1   | Sentinel-Radar         | ✅     | Détection inondation Sentinel-1 SAR via GEE    |
| F2   | Mboa-Map               | ✅     | Carte Leaflet + calques risque + Ma Position   |
| F3   | Notifications          | ✅     | SMS Twilio + Email HTML + inscription abonnés  |
| F4   | Archives Historiques   | ✅     | Sélecteur temporel + visualisation passée      |

---

## 📝 Licence

MIT — Mboa-FloodWatch est un projet open-source au service des citoyens camerounais.

> **"Mboa"** signifie *chez nous*, *notre maison* en langue camerounaise. 🇨🇲

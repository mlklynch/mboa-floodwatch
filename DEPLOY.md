# 🚀 Guide de Déploiement - MBOA-FloodWatch

## ✅ Modifications Effectuées

### Backend (Python)
- **Fichier**: `backend/gee/detection_radar.py`
- **Changements**:
  - ✅ Ajout des 10 chefs-lieux du Cameroun avec coordonnées
  - ✅ Fonction `get_buffer_coordinates()` pour zones tampon (30km)
  - ✅ Fonction `run_analysis_all_chefs_lieux()` pour itération simultanée
  - ✅ Envoi direct des polygones à Firestore collection `polygons`
  - ✅ Métadonnées complètes (region_name, geometry, risk_level, etc.)

### Configuration VS Code
- **Fichier**: `.vscode/settings.json`
- **Changements**: Configuration Python environment

---

## 📋 Étapes de Déploiement

### 1️⃣ **Installation des dépendances Firebase CLI** (Local)

```bash
# Windows
npm install -g firebase-tools

# Vérification
firebase --version
```

### 2️⃣ **Authentification Firebase**

```bash
cd c:\Dev\mboa-floodwatch

# Connexion à Firebase
firebase login

# Configuration du projet
firebase projects:list
# Sélectionner le projet: mboa-floodwatch-5227b
```

### 3️⃣ **Préparation Frontend** (Si mise à jour Hosting)

```bash
# Installation des dépendances
cd frontend
npm install

# Build production
npm run build

# Vérification du build
cd ..
ls -la frontend/dist/
```

### 4️⃣ **Déploiement Firestore Rules**

```bash
cd c:\Dev\mboa-floodwatch

# Déployement des règles Firestore
firebase deploy --only firestore:rules

# Vérification
firebase firestore:indexes
```

### 5️⃣ **Déploiement Cloud Functions**

```bash
# Déployement des fonctions
firebase deploy --only functions

# Vérification
firebase functions:list
```

### 6️⃣ **Déploiement Frontend** (Hosting)

```bash
# Déploiement du frontend
firebase deploy --only hosting

# Vérification (URL live)
firebase open hosting:site
```

### 7️⃣ **Déploiement Complet** (Recommandé)

```bash
# Une seule commande pour tout déployer
firebase deploy

# Affiche les URLs de déploiement
```

---

## ✨ Résumé des Déploiements

| Service | Status | Commande |
|---------|--------|----------|
| **Firestore Rules** | ✅ Prêt | `firebase deploy --only firestore:rules` |
| **Cloud Functions** | ✅ Prêt | `firebase deploy --only functions` |
| **Hosting (Frontend)** | ✅ Prêt | `firebase deploy --only hosting` |
| **Backend Python** | ✅ Actif | `git push` (GitHub) |
| **Firestore Indexes** | ℹ️ Auto | Configuré automatiquement |

---

## 🔍 Vérification Post-Déploiement

### 1. Vérifier Firestore
```bash
# Accès à la console
firebase open firestore

# Vérifier la collection 'polygons'
# - Documents créés : YES ✅
# - Champs district-name : YES ✅
# - GeoJSON geometry : YES ✅
```

### 2. Vérifier Cloud Functions
```bash
firebase functions:log

# Chercher les erreurs
firebase functions:describe
```

### 3. Vérifier Hosting
```bash
# URL live (exemple)
https://mboa-floodwatch-5227b.firebaseapp.com
```

---

## 📊 Résultats de Test d'Exécution Local

Hier (15 avril 2026):
- **Total zones détectées**: 9,643
- **Zones envoyées à Firestore**: 3,109 ✅
  - Bamenda (Nord-Ouest): 282 zones
  - Maroua (Extrême-Nord): 2,589 zones
  - Bafoussam (Ouest): 238 zones

---

## 🐛 Troubleshooting

### Erreur: "Firebase project not found"
```bash
firebase use mboa-floodwatch-5227b
firebase projects:list
```

### Erreur: "Permission denied"
```bash
# Mettre à jour les règles Firestore
# Ou vérifier les permissions du compte
firebase login --reauth
```

### Erreur: "Functions deployment failed"
```bash
# Vérifier les logs
firebase deploy --only functions --debug

# Vérifier npm dependencies
cd functions
npm install
npm run build
```

---

## 📝 Notes Importantes

1. **Le script `detection_radar.py` s'exécute localement** - Il est conçu pour être lancé manuellement ou via un scheduler (ex: cron)
2. **Les polygones sont stockés dans Firestore** - Collection `polygons`
3. **Les Cloud Functions** gèrent les alertes (SMS/Email) en temps réel
4. **Le Frontend** affiche les données en temps réel via Firestore listeners

---

## 🚀 Commande Rapide pour Déployer TOUT

```bash
cd c:\Dev\mboa-floodwatch
git push origin main
firebase deploy
```

**Durée estimée**: 2-5 minutes ⏱️

---

**Dernier commit**: 
```
feat: Enhance flood detection pipeline for 10 Cameroon capitals
Commit: 1fb2c01
```

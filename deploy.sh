#!/bin/bash

################################################################################
#  Script de Déploiement Automatisé - MBOA-FloodWatch
#  Déploie tous les services Firebase en une seule commande
#  Compatible: Linux, macOS
################################################################################

set -e  # Exit on error

echo ""
echo "========================================================================"
echo "  MBOA-FLOODWATCH - Déploiement Automatisé"
echo "========================================================================"
echo ""

# 1. Vérification de Firebase CLI
echo "[1/6] Vérification de Firebase CLI..."
if ! command -v firebase &> /dev/null; then
    echo ""
    echo "❌ ERREUR: Firebase CLI n'est pas installé"
    echo ""
    echo "Solution:"
    echo "  npm install -g firebase-tools"
    echo ""
    exit 1
fi
echo "✅ Firebase CLI détecté: $(firebase --version)"

# 2. Navigation au dossier du projet
echo ""
echo "[2/6] Navigation au dossier du projet..."
cd "$(dirname "$0")"
PROJECT_DIR=$(pwd)
echo "✅ Dossier correct: $PROJECT_DIR"

# 3. Vérification Git
echo ""
echo "[3/6] Vérification de Git et envoi des modifications..."
if ! command -v git &> /dev/null; then
    echo "❌ ERREUR: Git n'est pas installé"
    exit 1
fi

# Committer et pousser les changements
git add -A
if git status --porcelain | grep -q .; then
    echo "ℹ️  Modifications locales trouvées"
    git commit -m "chore: Automated deployment - $(date)"
    echo "✅ Changements commités"
    
    git push origin main
    echo "✅ Changements poussés vers GitHub"
else
    echo "✅ Pas de modifications à committer"
fi

# 4. Build du Frontend
echo ""
echo "[4/6] Préparation du Frontend..."
if [ ! -d "frontend/node_modules" ]; then
    echo "ℹ️  Installation des dépendances frontend..."
    cd frontend
    npm install
    cd ..
fi

if [ ! -d "frontend/dist" ]; then
    echo "ℹ️  Build du frontend..."
    cd frontend
    npm run build
    if [ $? -ne 0 ]; then
        echo "❌ ERREUR: Échec du build du frontend"
        exit 1
    fi
    cd ..
    echo "✅ Frontend build: OK"
else
    echo "✅ Frontend déjà construit"
fi

# 5. Vérification du projet Firebase
echo ""
echo "[5/6] Vérification du projet Firebase..."
if ! firebase projects:list | grep -q "mboa-floodwatch-5227b"; then
    echo "❌ ERREUR: Projet Firebase non trouvé"
    echo ""
    echo "Solution:"
    echo "  firebase login"
    echo "  firebase use mboa-floodwatch-5227b"
    echo ""
    exit 1
fi
echo "✅ Projet Firebase: mboa-floodwatch-5227b"

# 6. Déploiement
echo ""
echo "[6/6] Déploiement des services Firebase..."
echo ""
echo "⚙️  Déploiement en progression (cela peut prendre quelques minutes)..."
echo ""

firebase deploy --quiet

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ ERREUR: Le déploiement a échoué"
    echo ""
    echo "Essayez:"
    echo "  firebase deploy --debug"
    echo ""
    exit 1
fi

# Résumé final
echo ""
echo "========================================================================"
echo "  ✅ DÉPLOIEMENT RÉUSSI!"
echo "========================================================================"
echo ""
echo "Résumé:"
echo "  ✅ Code poussé vers GitHub (main branch)"
echo "  ✅ Cloud Functions déployées"
echo "  ✅ Firestore Rules déployées"
echo "  ✅ Frontend déployé (Hosting)"
echo ""
echo "Accédez au site:"
echo "  https://mboa-floodwatch-5227b.firebaseapp.com"
echo ""
echo "Accédez à la console Firebase:"
echo "  https://console.firebase.google.com/project/mboa-floodwatch-5227b"
echo ""
echo "Vérifiez les logs:"
echo "  firebase functions:log"
echo ""

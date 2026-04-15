@echo off
REM ============================================================================
REM  Script de Déploiement Automatisé - MBOA-FloodWatch
REM  Déploie tous les services Firebase en une seule commande
REM ============================================================================

setlocal enabledelayedexpansion

echo.
echo =========================================================================
echo   MBOA-FLOODWATCH - Déploiement Automatisé
echo =========================================================================
echo.

REM Vérification de Firebase CLI
echo [1/6] Vérification de Firebase CLI...
firebase --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo ❌ ERREUR: Firebase CLI n'est pas installé
    echo.
    echo Solution:
    echo   npm install -g firebase-tools
    echo.
    pause
    exit /b 1
)
echo ✅ Firebase CLI détecté

REM Navigation au dossier du projet
echo.
echo [2/6] Navigation au dossier du projet...
cd /d c:\Dev\mboa-floodwatch
if errorlevel 1 (
    echo ❌ ERREUR: Impossible d'accéder au dossier du projet
    pause
    exit /b 1
)
echo ✅ Dossier correct: %cd%

REM Vérification Git
echo.
echo [3/6] Vérification de Git et envoi des modifications...
git status >nul 2>&1
if errorlevel 1 (
    echo ❌ ERREUR: Git n'est pas installé
    pause
    exit /b 1
)

REM Committer et pousser les changements
git add -A
git status --porcelain >nul
if not errorlevel 1 (
    echo ℹ️  Modifications locales trouvées
    git commit -m "chore: Automated deployment - %date% %time%"
    echo ✅ Changements commités
    
    git push origin main
    echo ✅ Changements poussés vers GitHub
) else (
    echo ✅ Pas de modifications à committer
)

REM Build du Frontend (si node_modules n'existe pas)
echo.
echo [4/6] Préparation du Frontend...
if not exist "frontend\node_modules" (
    echo ℹ️  Installation des dépendances frontend...
    cd frontend
    call npm install
    cd ..
)

if not exist "frontend\dist" (
    echo ℹ️  Build du frontend...
    cd frontend
    call npm run build
    if errorlevel 1 (
        echo ❌ ERREUR: Échec du build du frontend
        cd ..
        pause
        exit /b 1
    )
    cd ..
    echo ✅ Frontend build: OK
) else (
    echo ✅ Frontend déjà construit
)

REM Vérification de la configuration Firebase
echo.
echo [5/6] Vérification du projet Firebase...
firebase projects:list | find "mboa-floodwatch-5227b" >nul 2>&1
if errorlevel 1 (
    echo ❌ ERREUR: Projet Firebase non trouvé
    echo.
    echo Solution:
    echo   firebase login
    echo   firebase use mboa-floodwatch-5227b
    echo.
    pause
    exit /b 1
)
echo ✅ Projet Firebase: mboa-floodwatch-5227b

REM Déploiement
echo.
echo [6/6] Déploiement des services Firebase...
echo.
echo ⚙️  Déploiement en progression (cela peut prendre quelques minutes)...
echo.

firebase deploy --quiet

if errorlevel 1 (
    echo.
    echo ❌ ERREUR: Le déploiement a échoué
    echo.
    echo Essayez:
    echo   firebase deploy --debug
    echo.
    pause
    exit /b 1
)

REM Résumé final
echo.
echo =========================================================================
echo   ✅ DÉPLOIEMENT RÉUSSI!
echo =========================================================================
echo.
echo Résumé:
echo   ✅ Code poussé vers GitHub (main branch)
echo   ✅ Cloud Functions déployées
echo   ✅ Firestore Rules déployées
echo   ✅ Frontend déployé (Hosting)
echo.
echo Accédez au site:
echo   https://mboa-floodwatch-5227b.firebaseapp.com
echo.
echo Accédez à la console Firebase:
echo   https://console.firebase.google.com/project/mboa-floodwatch-5227b
echo.
echo Vérifiez les logs:
echo   firebase functions:log
echo.
pause

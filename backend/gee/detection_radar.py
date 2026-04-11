import ee
import firebase_admin
import json
from firebase_admin import credentials, firestore

# 1. Chargement des credentials pour GEE et Firebase
# Le fichier serviceAccountKey.json doit être présent à la racine lors de l'exécution
service_account_file = "serviceAccountKey.json"

try:
    with open(service_account_file) as f:
        info = json.load(f)

    # INITIALISATION GEE (Authentification automatisée)
    # On utilise ee.ServiceAccountCredentials pour éviter le "earthengine authenticate" manuel
    geb_credentials = ee.ServiceAccountCredentials(info['client_email'], service_account_file)
    ee.Initialize(credentials=geb_credentials, project='mboa-floodwatch-5227b')
    print("✅ Authentification Google Earth Engine réussie.")

    # INITIALISATION FIREBASE
    cred = credentials.Certificate(service_account_file)
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("✅ Authentification Firebase réussie.")

except Exception as e:
    print(f"❌ Erreur lors de l'initialisation des services : {e}")
    exit(1)

def run_analysis(region_coords, before_date, after_date):
    """Effectue l'analyse radar et envoie les résultats à Firestore."""
    
    # Zone d'étude (Cameroun)
    area = ee.Geometry.Polygon(region_coords)
    
    # Collection Sentinel-1 SAR (Radar)
    collection = ee.ImageCollection('COPERNICUS/S1_GRD') \
        .filterBounds(area) \
        .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
    
    before = collection.filterDate(before_date[0], before_date[1]).mean()
    after = collection.filterDate(after_date[0], after_date[1]).mean()
    
    # Détection des changements (Seuil d'eau)
    diff = after.divide(before)
    
    # Sélection d'une seule bande et application du masque
    flood_mask = diff.select([0]).gt(1.25).selfMask().clip(area)
    
    # Conversion en polygones
    vectors = flood_mask.reduceToVectors(
        scale=30, 
        geometryType='polygon',
        eightConnected=True,
        labelProperty='flood_zone',
        reducer=ee.Reducer.countEvery()
    )

    # FILTRE : Suppression du bruit radar (on garde les zones > 10 pixels)
    filtered_vectors = vectors.filter(ee.Filter.gt('count', 10))
    features = filtered_vectors.getInfo()['features']
    
    # Envoi vers Firestore via un Batch
    doc_id = after_date[0]
    batch = db.batch()
    doc_ref = db.collection('flood_events').document(doc_id)
    
    batch.set(doc_ref, {
        'after_date': doc_id,
        'region': "Cameroun",
        'status': "active",
        'last_update': firestore.SERVER_TIMESTAMP
    })
    
    # Limiter à 400 polygones par batch pour respecter les limites Firestore si nécessaire
    for i, feat in enumerate(features[:400]): 
        poly_ref = doc_ref.collection('polygons').document(f"poly_{i}")
        batch.set(poly_ref, {
            'geometry': json.dumps(feat['geometry']), # JSON string pour Leaflet
            'risk_level': 3
        })
    
    batch.commit()
    print(f"✅ Analyse terminée. {len(features[:400])} zones détectées et envoyées à Firestore.")

if __name__ == "__main__":
    # Zone d'étude : Littoral (Douala/Edea)
    zone_littoral = [
        [9.5, 3.8], [9.9, 3.8], [9.9, 4.2], [9.5, 4.2], [9.5, 3.8]
    ]

    print("🚀 Démarrage de l'analyse Mboa-FloodWatch...")
    
    try:
        run_analysis(
            region_coords=zone_littoral,
            before_date=['2026-03-01', '2026-03-20'], 
            after_date=['2026-04-01', '2026-04-11']
        )
    except Exception as e:
        print(f"❌ Erreur critique lors de l'analyse : {e}")
import ee
import firebase_admin
from firebase_admin import credentials, firestore

# 1. Initialisation GEE & Firebase
# Le fichier serviceAccountKey.json doit être présent dans le dossier backend/gee/
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

# Initialisation de GEE avec l'ID du projet configuré
ee.Initialize(project='mboa-floodwatch-5227b')

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
    
    # CORRECTION : Sélection d'une seule bande et application du masque
    # selfMask() permet de ne traiter que les pixels inondés (valeur 1)
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
    # Cela évite l'erreur "Collection query aborted after accumulating over 5000 elements"
    filtered_vectors = vectors.filter(ee.Filter.gt('count', 10))
    features = filtered_vectors.getInfo()['features']
    
    # Envoi vers Firestore via un Batch pour optimiser les performances
    doc_id = after_date[0]
    batch = db.batch()
    doc_ref = db.collection('flood_events').document(doc_id)
    
    batch.set(doc_ref, {
        'after_date': doc_id,
        'region': "Cameroun",
        'status': "active"
    })
    
    for i, feat in enumerate(features):
        poly_ref = doc_ref.collection('polygons').document(f"poly_{i}")
        batch.set(poly_ref, {
            'geometry': str(feat['geometry']),
            'risk_level': 3
        })
    
    batch.commit()
    print(f"✅ Analyse terminée. {len(features)} zones détectées et envoyées à Firestore.")

# --- DÉCLENCHEUR D'ANALYSE ---

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
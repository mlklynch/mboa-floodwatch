"""
Mboa-FloodWatch — Module de Detection Sentinel-Radar (F1)

Pipeline de detection d'inondations via Sentinel-1 SAR :
  1. Collecte des images radar avant/apres les precipitations
  2. Filtrage speckle et seuillage sigma0
  3. Classification multi-niveaux (Vigilance / Alerte / Critique)
  4. Vectorisation en polygones GeoJSON
  5. Envoi vers Firebase Firestore
"""

import ee
import firebase_admin
import json
import math
from firebase_admin import credentials, firestore
from datetime import datetime

# ─── Configuration ───────────────────────────────────────────────────────────

SERVICE_ACCOUNT_FILE = "serviceAccountKey.json"
GCP_PROJECT = "mboa-floodwatch-5227b"

# Seuils de classification du risque (ratio sigma0 apres/avant)
RISK_THRESHOLDS = {
    "vigilance": 1.25,   # Niveau 1 : changement modere
    "alerte":    1.50,   # Niveau 2 : changement significatif
    "critique":  2.00,   # Niveau 3 : changement majeur
}

# Surface minimum en pixels pour filtrer le bruit radar
MIN_PIXEL_COUNT = 10

# Zones d'etude predefinies — 10 Regions du Cameroun
ZONES_CAMEROUN = {
    "adamaoua": {
        "name": "Cameroun - Adamaoua (Ngaoundere/Meiganga/Tibati)",
        "coords": [[11.5, 6.0], [14.5, 6.0], [14.5, 7.8], [11.5, 7.8], [11.5, 6.0]],
        "villes": ["Ngaoundere", "Meiganga", "Tibati", "Banyo", "Tignere"],
    },
    "centre": {
        "name": "Cameroun - Centre (Yaounde/Mbalmayo/Obala)",
        "coords": [[10.5, 3.3], [12.5, 3.3], [12.5, 4.8], [10.5, 4.8], [10.5, 3.3]],
        "villes": ["Yaounde", "Mbalmayo", "Obala", "Nanga-Eboko", "Eseka", "Monatele"],
    },
    "est": {
        "name": "Cameroun - Est (Bertoua/Batouri/Yokadouma)",
        "coords": [[13.0, 2.0], [16.0, 2.0], [16.0, 5.0], [13.0, 5.0], [13.0, 2.0]],
        "villes": ["Bertoua", "Batouri", "Yokadouma", "Abong-Mbang", "Belabo", "Moloundou"],
    },
    "extreme_nord": {
        "name": "Cameroun - Extreme-Nord (Maroua/Kousseri/Mokolo)",
        "coords": [[14.0, 10.0], [15.5, 10.0], [15.5, 12.5], [14.0, 12.5], [14.0, 10.0]],
        "villes": ["Maroua", "Kousseri", "Mokolo", "Mora", "Yagoua", "Kaele"],
    },
    "littoral": {
        "name": "Cameroun - Littoral (Douala/Edea/Nkongsamba)",
        "coords": [[9.4, 3.6], [10.3, 3.6], [10.3, 5.0], [9.4, 5.0], [9.4, 3.6]],
        "villes": ["Douala", "Edea", "Nkongsamba", "Manjo"],
    },
    "nord": {
        "name": "Cameroun - Nord (Garoua/Guider/Lagdo)",
        "coords": [[13.0, 8.0], [14.5, 8.0], [14.5, 10.0], [13.0, 10.0], [13.0, 8.0]],
        "villes": ["Garoua", "Guider", "Poli", "Tchollire", "Lagdo"],
    },
    "nord_ouest": {
        "name": "Cameroun - Nord-Ouest (Bamenda/Kumbo/Wum)",
        "coords": [[9.8, 5.8], [10.8, 5.8], [10.8, 6.5], [9.8, 6.5], [9.8, 5.8]],
        "villes": ["Bamenda", "Kumbo", "Wum", "Ndop", "Fundong"],
    },
    "ouest": {
        "name": "Cameroun - Ouest (Bafoussam/Dschang/Foumban)",
        "coords": [[9.9, 5.0], [11.0, 5.0], [11.0, 5.8], [9.9, 5.8], [9.9, 5.0]],
        "villes": ["Bafoussam", "Dschang", "Foumban", "Mbouda", "Bangangte", "Foumbot"],
    },
    "sud": {
        "name": "Cameroun - Sud (Ebolowa/Kribi/Sangmelima)",
        "coords": [[9.7, 2.0], [12.2, 2.0], [12.2, 3.2], [9.7, 3.2], [9.7, 2.0]],
        "villes": ["Ebolowa", "Kribi", "Sangmelima", "Ambam", "Campo"],
    },
    "sud_ouest": {
        "name": "Cameroun - Sud-Ouest (Buea/Limbe/Kumba)",
        "coords": [[8.9, 3.9], [9.6, 3.9], [9.6, 5.9], [8.9, 5.9], [8.9, 3.9]],
        "villes": ["Buea", "Limbe", "Kumba", "Mamfe", "Tiko", "Mudemba"],
    },
}

# ─── Initialisation des Services ─────────────────────────────────────────────

db = None

def initialize_services():
    """Initialise Google Earth Engine et Firebase avec le compte de service."""
    global db

    try:
        with open(SERVICE_ACCOUNT_FILE) as f:
            info = json.load(f)

        # GEE Authentication
        gee_credentials = ee.ServiceAccountCredentials(
            info["client_email"], SERVICE_ACCOUNT_FILE
        )
        ee.Initialize(credentials=gee_credentials, project=GCP_PROJECT)
        print("[OK] Authentification Google Earth Engine reussie.")

        # Firebase Authentication
        if not firebase_admin._apps:
            cred = credentials.Certificate(SERVICE_ACCOUNT_FILE)
            firebase_admin.initialize_app(cred)
        db = firestore.client()
        print("[OK] Authentification Firebase reussie.")

    except Exception as e:
        print(f"[ERREUR] Initialisation des services : {e}")
        raise


# ─── Pipeline de Detection ───────────────────────────────────────────────────

def apply_speckle_filter(image):
    """Applique un filtre de reduction du bruit speckle (focal median 3x3)."""
    return image.focal_median(radius=30, kernelType="circle", units="meters")


def classify_risk_level(area_m2, ratio_value):
    """
    Classifie le niveau de risque d'un polygone en fonction de sa surface
    et de l'intensite du changement radar.
      - Niveau 3 (Critique)  : grande surface OU ratio tres eleve
      - Niveau 2 (Alerte)    : surface moyenne OU ratio eleve
      - Niveau 1 (Vigilance) : petite surface, ratio modere
    """
    if area_m2 > 500000 or ratio_value >= RISK_THRESHOLDS["critique"]:
        return 3
    elif area_m2 > 100000 or ratio_value >= RISK_THRESHOLDS["alerte"]:
        return 2
    else:
        return 1


def compute_polygon_area(coordinates):
    """Calcule l'aire approximative d'un polygone en metres carres (Haversine)."""
    if not coordinates or len(coordinates) < 1:
        return 0
    ring = coordinates[0] if isinstance(coordinates[0][0], list) else coordinates
    if len(ring) < 3:
        return 0

    earth_radius = 6371000
    area = 0.0
    n = len(ring)
    for i in range(n):
        j = (i + 1) % n
        lat1, lon1 = math.radians(ring[i][1]), math.radians(ring[i][0])
        lat2, lon2 = math.radians(ring[j][1]), math.radians(ring[j][0])
        area += (lon2 - lon1) * (2 + math.sin(lat1) + math.sin(lat2))

    area = abs(area) * earth_radius * earth_radius / 2.0
    return area


def run_flood_detection_pipeline(
    before_start, before_end, after_start, after_end,
    region_coords=None, region_name="Cameroun", zone_key=None
):
    """
    Pipeline principal de detection d'inondations via Sentinel-1 SAR.

    Args:
        before_start: Date debut de la periode 'avant' (ex: '2026-08-01')
        before_end:   Date fin de la periode 'avant' (ex: '2026-09-15')
        after_start:  Date debut de la periode 'apres' (ex: '2026-10-01')
        after_end:    Date fin de la periode 'apres' (ex: '2026-10-31')
        region_coords: Coordonnees du polygone d'etude [[lon,lat], ...]
        region_name:   Nom descriptif de la region
        zone_key:      Cle d'une zone predefinie (ex: 'littoral')
    """
    # Resoudre la zone d'etude
    if zone_key and zone_key in ZONES_CAMEROUN:
        zone = ZONES_CAMEROUN[zone_key]
        region_coords = zone["coords"]
        region_name = zone["name"]
    elif region_coords is None:
        region_coords = ZONES_CAMEROUN["littoral"]["coords"]
        region_name = ZONES_CAMEROUN["littoral"]["name"]

    area = ee.Geometry.Polygon(region_coords)

    print(f"\n{'='*60}")
    print(f"  MBOA-FLOODWATCH — Analyse Sentinel-1 SAR")
    print(f"  Region : {region_name}")
    print(f"  Avant  : {before_start} -> {before_end}")
    print(f"  Apres  : {after_start} -> {after_end}")
    print(f"{'='*60}\n")

    # 1. Collection Sentinel-1 SAR GRD (VV + VH)
    s1_collection = (
        ee.ImageCollection("COPERNICUS/S1_GRD")
        .filterBounds(area)
        .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
        .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VH"))
        .filter(ee.Filter.eq("instrumentMode", "IW"))
        .filter(ee.Filter.eq("orbitProperties_pass", "DESCENDING"))
    )

    # 2. Images moyennes avant/apres avec filtre speckle
    before_img = apply_speckle_filter(
        s1_collection.filterDate(before_start, before_end).mean()
    )
    after_img = apply_speckle_filter(
        s1_collection.filterDate(after_start, after_end).mean()
    )

    # 3. Detection de changement (ratio VV)
    vv_before = before_img.select("VV")
    vv_after = after_img.select("VV")
    ratio = vv_after.divide(vv_before)

    # 4. Masque d'inondation (seuillage sigma0)
    flood_mask = ratio.gt(RISK_THRESHOLDS["vigilance"]).selfMask().clip(area)

    # 5. Vectorisation
    vectors = flood_mask.reduceToVectors(
        scale=30,
        geometryType="polygon",
        eightConnected=True,
        labelProperty="flood_zone",
        reducer=ee.Reducer.countEvery(),
    )

    # 6. Filtrage du bruit (suppression des petites zones)
    filtered_vectors = vectors.filter(ee.Filter.gt("count", MIN_PIXEL_COUNT))
    features = filtered_vectors.getInfo()["features"]

    print(f"[INFO] {len(features)} zones d'inondation detectees (apres filtrage).")

    if len(features) == 0:
        print("[INFO] Aucune zone d'inondation significative detectee.")
        return

    # 7. Classification des risques et preparation des polygones
    classified_polygons = []
    for feat in features:
        geometry = feat["geometry"]
        pixel_count = feat["properties"].get("count", 0)
        coords = geometry.get("coordinates", [])
        area_m2 = compute_polygon_area(coords)
        ratio_approx = 1.25 + (pixel_count / 100.0)  # Approximation du ratio
        risk_level = classify_risk_level(area_m2, ratio_approx)

        risk_labels = {1: "VIGILANCE", 2: "ALERTE", 3: "CRITIQUE"}

        classified_polygons.append({
            "geometry": json.dumps(geometry),
            "risk_level": risk_level,
            "risk_label": risk_labels[risk_level],
            "area_m2": round(area_m2),
            "pixel_count": pixel_count,
            "analyzed_at": datetime.utcnow().isoformat(),
        })

    # Stats
    critique_count = sum(1 for p in classified_polygons if p["risk_level"] == 3)
    alerte_count = sum(1 for p in classified_polygons if p["risk_level"] == 2)
    vigilance_count = sum(1 for p in classified_polygons if p["risk_level"] == 1)

    print(f"\n  Classification des risques :")
    print(f"    Critique  (3) : {critique_count} zones")
    print(f"    Alerte    (2) : {alerte_count} zones")
    print(f"    Vigilance (1) : {vigilance_count} zones")
    print(f"    Total         : {len(classified_polygons)} zones\n")

    # 8. Envoi vers Firestore
    if db is None:
        print("[AVERTISSEMENT] Firebase non initialise. Resultats non envoyes.")
        return classified_polygons

    event_id = f"event_{after_start.replace('-', '')}"
    batch = db.batch()
    doc_ref = db.collection("flood_events").document(event_id)

    batch.set(doc_ref, {
        "before_date": before_start,
        "after_date": after_start,
        "region": region_name,
        "status": "active",
        "feature_count": len(classified_polygons),
        "created_at": firestore.SERVER_TIMESTAMP,
    })

    # Limiter a 400 polygones par batch (limite Firestore: 500 ops)
    for i, poly_data in enumerate(classified_polygons[:400]):
        poly_ref = doc_ref.collection("polygons").document(f"poly_{i}")
        batch.set(poly_ref, {
            "geometry": poly_data["geometry"],
            "risk_level": poly_data["risk_level"],
            "risk_label": poly_data["risk_label"],
            "area_m2": poly_data["area_m2"],
            "event_id": event_id,
            "analyzed_at": poly_data["analyzed_at"],
        })

    batch.commit()
    print(f"[OK] {len(classified_polygons[:400])} zones envoyees a Firestore (event: {event_id}).")
    return classified_polygons


# ─── Point d'Entree ──────────────────────────────────────────────────────────

def run_all_regions(before_start, before_end, after_start, after_end):
    """
    Execute le pipeline de detection pour les 10 regions du Cameroun.
    Permet une couverture nationale complete.
    """
    print(f"\n{'='*60}")
    print(f"  ANALYSE NATIONALE — 10 REGIONS DU CAMEROUN")
    print(f"  Periode : {before_start} -> {after_end}")
    print(f"{'='*60}\n")

    results = {}
    for zone_key in ZONES_CAMEROUN:
        try:
            polys = run_flood_detection_pipeline(
                before_start=before_start,
                before_end=before_end,
                after_start=after_start,
                after_end=after_end,
                zone_key=zone_key,
            )
            results[zone_key] = polys or []
            print(f"[OK] {zone_key} : {len(results[zone_key])} zones detectees")
        except Exception as e:
            print(f"[ERREUR] {zone_key} : {e}")
            results[zone_key] = []

    total = sum(len(v) for v in results.values())
    print(f"\n{'='*60}")
    print(f"  TOTAL NATIONAL : {total} zones d'inondation detectees")
    print(f"{'='*60}\n")
    return results


if __name__ == "__main__":
    print("\n  MBOA-FLOODWATCH")
    print("  Pipeline Sentinel-1 SAR -> Firestore\n")

    initialize_services()

    try:
        # Analyse nationale — toutes les 10 regions
        run_all_regions(
            before_start="2026-03-01",
            before_end="2026-03-20",
            after_start="2026-04-01",
            after_end="2026-04-11",
        )
    except Exception as e:
        print(f"[ERREUR CRITIQUE] {e}")

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

# Chefs-lieux du Cameroun avec leurs coordonnees et zones tampon (30km)
CHEFS_LIEUX_CAMEROUN = [
    {
        "name": "Yaoundé",
        "region": "Centre",
        "lat": 3.8667,
        "lon": 11.5167,
        "buffer_km": 30,
    },
    {
        "name": "Douala",
        "region": "Littoral",
        "lat": 4.0511,
        "lon": 9.7679,
        "buffer_km": 30,
    },
    {
        "name": "Bamenda",
        "region": "Nord-Ouest",
        "lat": 5.9631,
        "lon": 10.1591,
        "buffer_km": 30,
    },
    {
        "name": "Buea",
        "region": "Sud-Ouest",
        "lat": 4.1578,
        "lon": 9.2414,
        "buffer_km": 30,
    },
    {
        "name": "Limbé",
        "region": "Sud-Ouest",
        "lat": 4.0186,
        "lon": 9.1386,
        "buffer_km": 30,
    },
    {
        "name": "Garoua",
        "region": "Nord",
        "lat": 9.3022,
        "lon": 13.3968,
        "buffer_km": 30,
    },
    {
        "name": "Maroua",
        "region": "Extrême-Nord",
        "lat": 10.5903,
        "lon": 14.3116,
        "buffer_km": 30,
    },
    {
        "name": "Bafoussam",
        "region": "Ouest",
        "lat": 5.7679,
        "lon": 10.4167,
        "buffer_km": 30,
    },
    {
        "name": "Edéa",
        "region": "Littoral",
        "lat": 3.8,
        "lon": 10.1333,
        "buffer_km": 30,
    },
    {
        "name": "Kumba",
        "region": "Sud-Ouest",
        "lat": 4.6333,
        "lon": 9.45,
        "buffer_km": 30,
    },
]

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

def get_buffer_coordinates(lat, lon, buffer_km=30):
    """
    Genere un carre de coordonnees [lon, lat] centré sur le point
    avec une zone tampon de buffer_km km.
    """
    lat_offset = (buffer_km / 111.0)  # 1 degre ≈ 111 km
    lon_offset = (buffer_km / (111.0 * math.cos(math.radians(lat))))

    return [
        [lon - lon_offset, lat - lat_offset],
        [lon + lon_offset, lat - lat_offset],
        [lon + lon_offset, lat + lat_offset],
        [lon - lon_offset, lat + lat_offset],
        [lon - lon_offset, lat - lat_offset],
    ]


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
    if zone_key and zone_key in ZONES_CAMEROUN: # type: ignore
        zone = ZONES_CAMEROUN[zone_key] # type: ignore
        region_coords = zone["coords"]
        region_name = zone["name"]
    elif region_coords is None:
        region_coords = ZONES_CAMEROUN["littoral"]["coords"] # type: ignore
        region_name = ZONES_CAMEROUN["littoral"]["name"] # type: ignore

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

    # Envoyer les polygones directement dans la collection 'polygons'
    # avec le nom de la ville et de la region
    batch = db.batch()
    batch_count = 0

    for i, poly_data in enumerate(classified_polygons):
        # Utiliser un ID unique basé sur la timestamp et l'index
        doc_id = f"{region_name}_{after_start}_{i}_{int(datetime.utcnow().timestamp())}"
        poly_ref = db.collection("polygons").document(doc_id)

        batch.set(poly_ref, {
            "geometry": poly_data["geometry"],
            "risk_level": poly_data["risk_level"],
            "risk_label": poly_data["risk_label"],
            "area_m2": poly_data["area_m2"],
            "pixel_count": poly_data["pixel_count"],
            "region_name": region_name,  # Nom de la ville/region
            "analyzed_at": poly_data["analyzed_at"],
            "created_at": firestore.SERVER_TIMESTAMP,
        })

        batch_count += 1

        # Firestore limite a 500 operations par batch
        if batch_count >= 400:
            batch.commit()
            print(f"[OK] {batch_count} polygones envoyes a Firestore.")
            batch = db.batch()
            batch_count = 0

    # Commit final
    if batch_count > 0:
        batch.commit()
        print(f"[OK] {batch_count} polygones envoyes a Firestore (final batch).")

    return classified_polygons


# ─── Point d'Entree ──────────────────────────────────────────────────────────

def run_analysis_all_chefs_lieux(before_start, before_end, after_start, after_end):
    """
    Lance l'analyse de detection d'inondations pour tous les 10 chefs-lieux
    du Cameroun.

    Args:
        before_start: Date debut de la periode 'avant' (ex: '2026-08-01')
        before_end:   Date fin de la periode 'avant' (ex: '2026-09-15')
        after_start:  Date debut de la periode 'apres' (ex: '2026-10-01')
        after_end:    Date fin de la periode 'apres' (ex: '2026-10-31')
    """
    print("\n" + "="*70)
    print("  ANALYSE SIMULTANEE - 10 CHEFS-LIEUX DU CAMEROUN")
    print("="*70)

    all_results = {}
    total_polygons = 0

    for chef_lieu in CHEFS_LIEUX_CAMEROUN:
        name = chef_lieu["name"]
        region = chef_lieu["region"]
        lat = chef_lieu["lat"]
        lon = chef_lieu["lon"]
        buffer_km = chef_lieu["buffer_km"]

        # Generer les coordonnees de la zone tampon
        coords = get_buffer_coordinates(lat, lon, buffer_km)
        region_name = f"{name} ({region})"

        print(f"\n  -> Analyse en cours : {region_name}...")

        try:
            results = run_flood_detection_pipeline(
                before_start=before_start,
                before_end=before_end,
                after_start=after_start,
                after_end=after_end,
                region_coords=coords,
                region_name=region_name,
            )

            all_results[name] = {
                "region": region,
                "polygon_count": len(results),
                "status": "success",
            }

            total_polygons += len(results)

        except Exception as e:
            print(f"  [ERREUR] {region_name} : {e}")
            all_results[name] = {
                "region": region,
                "polygon_count": 0,
                "status": "error",
                "error": str(e),
            }

    # Resumé final
    print("\n" + "="*70)
    print("  RESUME FINAL - ANALYSE COMPLETES")
    print("="*70)

    for name, data in all_results.items():
        status_icon = "✓" if data["status"] == "success" else "✗"
        print(
            f"  {status_icon} {name:20} ({data['region']:15}) : "
            f"{data['polygon_count']} polygone(s)"
        )

    print(f"\n  Total : {total_polygons} polygones envoyes a Firestore")
    print("="*70 + "\n")

    return all_results


if __name__ == "__main__":
    print("\n  MBOA-FLOODWATCH")
    print("  Pipeline Sentinel-1 SAR -> Firestore")
    print("  Detection d'inondations sur 10 chefs-lieux\n")

    initialize_services()

    try:
        # Parametres de l'analyse (A adapter selon votre cas d'usage)
        run_analysis_all_chefs_lieux(
            before_start="2026-03-01",
            before_end="2026-03-20",
            after_start="2026-04-01",
            after_end="2026-04-11",
        )
    except Exception as e:
        print(f"[ERREUR CRITIQUE] {e}")

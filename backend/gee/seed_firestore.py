"""
Mboa-FloodWatch — Firestore Seed Script

Peuple la base de donnees Firestore avec des donnees de demonstration
couvrant les 10 regions du Cameroun et leurs villes principales.

Usage:
    python seed_firestore.py

Pre-requis:
    - serviceAccountKey.json dans le meme repertoire
    - pip install firebase-admin
"""

import json
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime

SERVICE_ACCOUNT_FILE = "serviceAccountKey.json"

# ─── Donnees des 10 Regions du Cameroun ──────────────────────────────────────

REGIONS_DATA = {
    "Adamaoua": {
        "villes": {
            "Ngaoundere": [
                {"coords": [[13.54, 7.28], [13.62, 7.28], [13.62, 7.36], [13.54, 7.36], [13.54, 7.28]], "risk": 2, "area": 3400000},
                {"coords": [[13.48, 7.32], [13.55, 7.32], [13.55, 7.38], [13.48, 7.38], [13.48, 7.32]], "risk": 1, "area": 1800000},
            ],
            "Meiganga": [
                {"coords": [[14.26, 6.48], [14.34, 6.48], [14.34, 6.56], [14.26, 6.56], [14.26, 6.48]], "risk": 2, "area": 2900000},
            ],
            "Tibati": [
                {"coords": [[12.59, 6.43], [12.67, 6.43], [12.67, 6.51], [12.59, 6.51], [12.59, 6.43]], "risk": 1, "area": 1500000},
            ],
            "Banyo": [
                {"coords": [[11.78, 6.71], [11.86, 6.71], [11.86, 6.79], [11.78, 6.79], [11.78, 6.71]], "risk": 1, "area": 1200000},
            ],
            "Tignere": [
                {"coords": [[12.63, 7.35], [12.70, 7.35], [12.70, 7.42], [12.63, 7.42], [12.63, 7.35]], "risk": 2, "area": 2500000},
            ],
        },
    },
    "Centre": {
        "villes": {
            "Yaounde": [
                {"coords": [[11.48, 3.83], [11.56, 3.83], [11.56, 3.91], [11.48, 3.91], [11.48, 3.83]], "risk": 2, "area": 3100000},
                {"coords": [[11.52, 3.88], [11.58, 3.88], [11.58, 3.94], [11.52, 3.94], [11.52, 3.88]], "risk": 1, "area": 1600000},
            ],
            "Mbalmayo": [
                {"coords": [[11.46, 3.48], [11.54, 3.48], [11.54, 3.56], [11.46, 3.56], [11.46, 3.48]], "risk": 3, "area": 4200000},
            ],
            "Obala": [
                {"coords": [[11.49, 4.13], [11.57, 4.13], [11.57, 4.21], [11.49, 4.21], [11.49, 4.13]], "risk": 1, "area": 1400000},
            ],
            "Nanga-Eboko": [
                {"coords": [[12.33, 4.64], [12.41, 4.64], [12.41, 4.72], [12.33, 4.72], [12.33, 4.64]], "risk": 2, "area": 2800000},
            ],
            "Eseka": [
                {"coords": [[10.73, 3.63], [10.80, 3.63], [10.80, 3.70], [10.73, 3.70], [10.73, 3.63]], "risk": 1, "area": 1300000},
            ],
            "Monatele": [
                {"coords": [[11.17, 4.22], [11.24, 4.22], [11.24, 4.28], [11.17, 4.28], [11.17, 4.22]], "risk": 1, "area": 1100000},
            ],
        },
    },
    "Est": {
        "villes": {
            "Bertoua": [
                {"coords": [[13.64, 4.54], [13.72, 4.54], [13.72, 4.62], [13.64, 4.62], [13.64, 4.54]], "risk": 2, "area": 3000000},
            ],
            "Batouri": [
                {"coords": [[14.32, 4.39], [14.40, 4.39], [14.40, 4.47], [14.32, 4.47], [14.32, 4.39]], "risk": 1, "area": 1700000},
            ],
            "Yokadouma": [
                {"coords": [[15.01, 3.48], [15.09, 3.48], [15.09, 3.56], [15.01, 3.56], [15.01, 3.48]], "risk": 1, "area": 1400000},
            ],
            "Abong-Mbang": [
                {"coords": [[13.14, 3.94], [13.22, 3.94], [13.22, 4.02], [13.14, 4.02], [13.14, 3.94]], "risk": 2, "area": 2600000},
            ],
            "Belabo": [
                {"coords": [[13.28, 4.88], [13.35, 4.88], [13.35, 4.95], [13.28, 4.95], [13.28, 4.88]], "risk": 1, "area": 1200000},
            ],
            "Moloundou": [
                {"coords": [[15.19, 2.02], [15.27, 2.02], [15.27, 2.10], [15.19, 2.10], [15.19, 2.02]], "risk": 3, "area": 4800000},
            ],
        },
    },
    "Extreme-Nord": {
        "villes": {
            "Maroua": [
                {"coords": [[14.28, 10.55], [14.38, 10.55], [14.38, 10.65], [14.28, 10.65], [14.28, 10.55]], "risk": 3, "area": 5200000},
                {"coords": [[14.20, 10.48], [14.30, 10.48], [14.30, 10.56], [14.20, 10.56], [14.20, 10.48]], "risk": 3, "area": 4600000},
            ],
            "Kousseri": [
                {"coords": [[14.99, 12.04], [15.09, 12.04], [15.09, 12.14], [14.99, 12.14], [14.99, 12.04]], "risk": 3, "area": 6100000},
            ],
            "Mokolo": [
                {"coords": [[13.76, 10.70], [13.84, 10.70], [13.84, 10.78], [13.76, 10.78], [13.76, 10.70]], "risk": 2, "area": 3200000},
            ],
            "Mora": [
                {"coords": [[14.10, 11.01], [14.18, 11.01], [14.18, 11.09], [14.10, 11.09], [14.10, 11.01]], "risk": 2, "area": 2900000},
            ],
            "Yagoua": [
                {"coords": [[15.20, 10.32], [15.30, 10.32], [15.30, 10.42], [15.20, 10.42], [15.20, 10.32]], "risk": 3, "area": 5500000},
            ],
            "Kaele": [
                {"coords": [[14.42, 10.08], [14.50, 10.08], [14.50, 10.16], [14.42, 10.16], [14.42, 10.08]], "risk": 2, "area": 2700000},
            ],
        },
    },
    "Littoral": {
        "villes": {
            "Douala": [
                {"coords": [[9.65, 4.00], [9.75, 4.00], [9.75, 4.08], [9.65, 4.08], [9.65, 4.00]], "risk": 3, "area": 4500000},
                {"coords": [[9.55, 4.02], [9.63, 4.02], [9.63, 4.10], [9.55, 4.10], [9.55, 4.02]], "risk": 2, "area": 3200000},
                {"coords": [[9.72, 3.95], [9.80, 3.95], [9.80, 4.02], [9.72, 4.02], [9.72, 3.95]], "risk": 3, "area": 4100000},
            ],
            "Edea": [
                {"coords": [[10.05, 3.75], [10.15, 3.75], [10.15, 3.85], [10.05, 3.85], [10.05, 3.75]], "risk": 2, "area": 2800000},
                {"coords": [[10.10, 3.68], [10.18, 3.68], [10.18, 3.76], [10.10, 3.76], [10.10, 3.68]], "risk": 1, "area": 1800000},
            ],
            "Nkongsamba": [
                {"coords": [[9.90, 4.91], [9.98, 4.91], [9.98, 4.99], [9.90, 4.99], [9.90, 4.91]], "risk": 1, "area": 1600000},
            ],
            "Manjo": [
                {"coords": [[9.78, 4.80], [9.86, 4.80], [9.86, 4.88], [9.78, 4.88], [9.78, 4.80]], "risk": 1, "area": 1300000},
            ],
        },
    },
    "Nord": {
        "villes": {
            "Garoua": [
                {"coords": [[13.36, 9.26], [13.46, 9.26], [13.46, 9.36], [13.36, 9.36], [13.36, 9.26]], "risk": 3, "area": 4800000},
                {"coords": [[13.28, 9.30], [13.36, 9.30], [13.36, 9.38], [13.28, 9.38], [13.28, 9.30]], "risk": 2, "area": 3100000},
            ],
            "Guider": [
                {"coords": [[13.91, 9.89], [13.99, 9.89], [13.99, 9.97], [13.91, 9.97], [13.91, 9.89]], "risk": 2, "area": 2800000},
            ],
            "Poli": [
                {"coords": [[13.20, 8.44], [13.28, 8.44], [13.28, 8.52], [13.20, 8.52], [13.20, 8.44]], "risk": 1, "area": 1500000},
            ],
            "Tchollire": [
                {"coords": [[14.13, 8.36], [14.21, 8.36], [14.21, 8.44], [14.13, 8.44], [14.13, 8.36]], "risk": 1, "area": 1300000},
            ],
            "Lagdo": [
                {"coords": [[13.70, 9.05], [13.80, 9.05], [13.80, 9.15], [13.70, 9.15], [13.70, 9.05]], "risk": 3, "area": 5800000},
            ],
        },
    },
    "Nord-Ouest": {
        "villes": {
            "Bamenda": [
                {"coords": [[10.12, 5.93], [10.20, 5.93], [10.20, 6.01], [10.12, 6.01], [10.12, 5.93]], "risk": 2, "area": 2800000},
                {"coords": [[10.08, 5.97], [10.14, 5.97], [10.14, 6.03], [10.08, 6.03], [10.08, 5.97]], "risk": 1, "area": 1400000},
            ],
            "Kumbo": [
                {"coords": [[10.64, 6.18], [10.72, 6.18], [10.72, 6.26], [10.64, 6.26], [10.64, 6.18]], "risk": 1, "area": 1600000},
            ],
            "Wum": [
                {"coords": [[10.03, 6.34], [10.11, 6.34], [10.11, 6.42], [10.03, 6.42], [10.03, 6.34]], "risk": 2, "area": 2500000},
            ],
            "Ndop": [
                {"coords": [[10.38, 5.93], [10.46, 5.93], [10.46, 6.01], [10.38, 6.01], [10.38, 5.93]], "risk": 1, "area": 1200000},
            ],
            "Fundong": [
                {"coords": [[10.26, 6.23], [10.33, 6.23], [10.33, 6.30], [10.26, 6.30], [10.26, 6.23]], "risk": 1, "area": 1100000},
            ],
        },
    },
    "Ouest": {
        "villes": {
            "Bafoussam": [
                {"coords": [[10.38, 5.43], [10.46, 5.43], [10.46, 5.51], [10.38, 5.51], [10.38, 5.43]], "risk": 2, "area": 3000000},
            ],
            "Dschang": [
                {"coords": [[10.03, 5.40], [10.11, 5.40], [10.11, 5.48], [10.03, 5.48], [10.03, 5.40]], "risk": 1, "area": 1700000},
            ],
            "Foumban": [
                {"coords": [[10.86, 5.69], [10.94, 5.69], [10.94, 5.77], [10.86, 5.77], [10.86, 5.69]], "risk": 2, "area": 2600000},
            ],
            "Mbouda": [
                {"coords": [[10.21, 5.59], [10.29, 5.59], [10.29, 5.67], [10.21, 5.67], [10.21, 5.59]], "risk": 1, "area": 1400000},
            ],
            "Bangangte": [
                {"coords": [[10.48, 5.10], [10.56, 5.10], [10.56, 5.18], [10.48, 5.18], [10.48, 5.10]], "risk": 1, "area": 1300000},
            ],
            "Foumbot": [
                {"coords": [[10.60, 5.48], [10.68, 5.48], [10.68, 5.56], [10.60, 5.56], [10.60, 5.48]], "risk": 2, "area": 2400000},
            ],
        },
    },
    "Sud": {
        "villes": {
            "Ebolowa": [
                {"coords": [[11.11, 2.86], [11.19, 2.86], [11.19, 2.94], [11.11, 2.94], [11.11, 2.86]], "risk": 2, "area": 2800000},
            ],
            "Kribi": [
                {"coords": [[9.88, 2.92], [9.96, 2.92], [9.96, 3.00], [9.88, 3.00], [9.88, 2.92]], "risk": 2, "area": 2500000},
                {"coords": [[9.84, 2.85], [9.92, 2.85], [9.92, 2.93], [9.84, 2.93], [9.84, 2.85]], "risk": 1, "area": 1600000},
            ],
            "Sangmelima": [
                {"coords": [[11.94, 2.89], [12.02, 2.89], [12.02, 2.97], [11.94, 2.97], [11.94, 2.89]], "risk": 1, "area": 1400000},
            ],
            "Ambam": [
                {"coords": [[11.24, 2.34], [11.32, 2.34], [11.32, 2.42], [11.24, 2.42], [11.24, 2.34]], "risk": 1, "area": 1300000},
            ],
            "Campo": [
                {"coords": [[9.80, 2.33], [9.88, 2.33], [9.88, 2.41], [9.80, 2.41], [9.80, 2.33]], "risk": 3, "area": 4400000},
            ],
        },
    },
    "Sud-Ouest": {
        "villes": {
            "Buea": [
                {"coords": [[9.20, 4.12], [9.28, 4.12], [9.28, 4.20], [9.20, 4.20], [9.20, 4.12]], "risk": 2, "area": 2700000},
            ],
            "Limbe": [
                {"coords": [[9.16, 3.98], [9.24, 3.98], [9.24, 4.06], [9.16, 4.06], [9.16, 3.98]], "risk": 3, "area": 4300000},
                {"coords": [[9.12, 4.02], [9.18, 4.02], [9.18, 4.08], [9.12, 4.08], [9.12, 4.02]], "risk": 2, "area": 2100000},
            ],
            "Kumba": [
                {"coords": [[9.41, 4.60], [9.49, 4.60], [9.49, 4.68], [9.41, 4.68], [9.41, 4.60]], "risk": 2, "area": 2900000},
            ],
            "Mamfe": [
                {"coords": [[9.27, 5.73], [9.35, 5.73], [9.35, 5.81], [9.27, 5.81], [9.27, 5.73]], "risk": 1, "area": 1500000},
            ],
            "Tiko": [
                {"coords": [[9.33, 4.06], [9.40, 4.06], [9.40, 4.13], [9.33, 4.13], [9.33, 4.06]], "risk": 1, "area": 1300000},
            ],
            "Mudemba": [
                {"coords": [[9.50, 4.90], [9.57, 4.90], [9.57, 4.97], [9.50, 4.97], [9.50, 4.90]], "risk": 1, "area": 1100000},
            ],
        },
    },
}

RISK_LABELS = {1: "VIGILANCE", 2: "ALERTE", 3: "CRITIQUE"}


def seed_firestore():
    """Peuple Firestore avec les donnees des 10 regions du Cameroun."""

    # Initialisation Firebase
    cred = credentials.Certificate(SERVICE_ACCOUNT_FILE)
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    db = firestore.client()

    now = datetime.utcnow().isoformat()

    # Creer l'evenement principal
    event_id = "event_national_2026"
    event_ref = db.collection("flood_events").document(event_id)

    # Compter le nombre total de polygones
    total_polys = sum(
        len(zone)
        for region in REGIONS_DATA.values()
        for zones in region["villes"].values()
        for zone in [zones]
    )
    # Recompter correctement
    total_polys = 0
    for region_data in REGIONS_DATA.values():
        for zones in region_data["villes"].values():
            total_polys += len(zones)

    event_ref.set({
        "before_date": "2026-08-15",
        "after_date": "2026-10-01",
        "region": "Cameroun — Toutes Regions (Saison des pluies 2026)",
        "status": "active",
        "feature_count": total_polys,
        "created_at": firestore.SERVER_TIMESTAMP,
    })
    print(f"[OK] Evenement cree : {event_id} ({total_polys} polygones)")

    # Ajouter les polygones par batch (limite Firestore : 500 ops/batch)
    batch = db.batch()
    poly_index = 0
    batch_count = 0

    for region_name, region_data in REGIONS_DATA.items():
        for ville, zones in region_data["villes"].items():
            for zone in zones:
                poly_id = f"poly_{poly_index}"
                poly_ref = event_ref.collection("polygons").document(poly_id)

                geometry = {
                    "type": "Polygon",
                    "coordinates": [zone["coords"]],
                }

                batch.set(poly_ref, {
                    "geometry": json.dumps(geometry),
                    "risk_level": zone["risk"],
                    "risk_label": RISK_LABELS[zone["risk"]],
                    "area_m2": zone["area"],
                    "region": region_name,
                    "ville": ville,
                    "event_id": event_id,
                    "analyzed_at": now,
                })

                poly_index += 1
                batch_count += 1

                # Commit par batch de 400 (limite Firestore)
                if batch_count >= 400:
                    batch.commit()
                    print(f"  [BATCH] {batch_count} polygones envoyes...")
                    batch = db.batch()
                    batch_count = 0

    # Dernier batch
    if batch_count > 0:
        batch.commit()
        print(f"  [BATCH] {batch_count} polygones envoyes...")

    print(f"\n[OK] Seed termine : {poly_index} polygones au total")
    print(f"     Regions couvertes : {len(REGIONS_DATA)}")
    print(f"     Villes couvertes : {sum(len(r['villes']) for r in REGIONS_DATA.values())}")


if __name__ == "__main__":
    print("\n  MBOA-FLOODWATCH — Seed Firestore")
    print("  Donnees de demonstration nationales\n")
    seed_firestore()

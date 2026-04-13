/**
 * Mboa-FloodWatch — Firestore CRUD Service
 * Handles flood_events, polygons, and subscribers collections.
 */

import { db } from "./firebase";
import {
  collection,
  getDocs,
  addDoc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";

// ─── RISK STYLES (shared constants) ─────────────────────────────────────────

export const RISK_STYLES = {
  1: { color: "#007A5E", fillColor: "#007A5E", fillOpacity: 0.45, weight: 2,   label: "Vigilance", labelFr: "Vigilance" },
  2: { color: "#FCD116", fillColor: "#FCD116", fillOpacity: 0.50, weight: 2,   label: "Alerte",    labelFr: "Alerte" },
  3: { color: "#CE1126", fillColor: "#CE1126", fillOpacity: 0.60, weight: 2.5, label: "Critique",  labelFr: "Critique" },
};

export const CAMEROON_CENTER = [5.5, 12.3];
export const CAMEROON_ZOOM = 6;

// ─── FLOOD EVENTS ───────────────────────────────────────────────────────────

/**
 * Fetch all flood events from Firestore, sorted by after_date descending.
 */
export async function fetchFloodEvents() {
  try {
    const q = query(collection(db, "flood_events"), orderBy("after_date", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn("fetchFloodEvents fallback (no orderBy index):", err.message);
    const snap = await getDocs(collection(db, "flood_events"));
    const events = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    events.sort((a, b) => (b.after_date || "").localeCompare(a.after_date || ""));
    return events;
  }
}

/**
 * Fetch polygons sub-collection for a given flood event.
 */
export async function fetchEventPolygons(eventId) {
  const snap = await getDocs(
    collection(db, "flood_events", eventId, "polygons")
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ─── SUBSCRIBERS ────────────────────────────────────────────────────────────

/**
 * Register a new subscriber for flood alerts.
 */
export async function registerSubscriber({ name, city, phone, email, latitude, longitude }) {
  const docRef = await addDoc(collection(db, "subscribers"), {
    name,
    city,
    phone: phone || null,
    email: email || null,
    latitude: latitude || null,
    longitude: longitude || null,
    registered_at: serverTimestamp(),
    active: true,
  });
  return docRef.id;
}

// ─── DEMO DATA (fallback when Firestore is not configured) ──────────────────

export function getDemoFloodEvents() {
  return [
    {
      id: "event_20261001",
      before_date: "2026-08-15",
      after_date: "2026-10-01",
      region: "Cameroun — Toutes Regions (Saison des pluies 2026)",
      status: "active",
      feature_count: 58,
    },
    {
      id: "event_20260715",
      before_date: "2026-05-01",
      after_date: "2026-07-15",
      region: "Cameroun — Nord / Extreme-Nord (Juillet 2026)",
      status: "archive",
      feature_count: 24,
    },
    {
      id: "event_20260501",
      before_date: "2026-03-01",
      after_date: "2026-05-01",
      region: "Cameroun — Littoral / Sud-Ouest (Mai 2026)",
      status: "archive",
      feature_count: 18,
    },
    {
      id: "event_20251020",
      before_date: "2025-08-01",
      after_date: "2025-10-20",
      region: "Cameroun — Toutes Regions (Saison des pluies 2025)",
      status: "archive",
      feature_count: 45,
    },
  ];
}

/**
 * Helper to create a polygon entry.
 */
function poly(id, coords, risk_level, area_m2, region, ville) {
  const risk_labels = { 1: "VIGILANCE", 2: "ALERTE", 3: "CRITIQUE" };
  return {
    id,
    geometry: JSON.stringify({ type: "Polygon", coordinates: [coords] }),
    risk_level,
    risk_label: risk_labels[risk_level],
    area_m2,
    region,
    ville,
  };
}

export function getDemoPolygons() {
  return [
    // ═══════════════════════════════════════════════════
    // REGION 1 : ADAMAOUA (Capital: Ngaoundere)
    // ═══════════════════════════════════════════════════
    poly("poly_ngaoundere_1", [[13.54, 7.28], [13.62, 7.28], [13.62, 7.36], [13.54, 7.36], [13.54, 7.28]], 2, 3400000, "Adamaoua", "Ngaoundere"),
    poly("poly_ngaoundere_2", [[13.48, 7.32], [13.55, 7.32], [13.55, 7.38], [13.48, 7.38], [13.48, 7.32]], 1, 1800000, "Adamaoua", "Ngaoundere"),
    poly("poly_meiganga_1", [[14.26, 6.48], [14.34, 6.48], [14.34, 6.56], [14.26, 6.56], [14.26, 6.48]], 2, 2900000, "Adamaoua", "Meiganga"),
    poly("poly_tibati_1", [[12.59, 6.43], [12.67, 6.43], [12.67, 6.51], [12.59, 6.51], [12.59, 6.43]], 1, 1500000, "Adamaoua", "Tibati"),
    poly("poly_banyo_1", [[11.78, 6.71], [11.86, 6.71], [11.86, 6.79], [11.78, 6.79], [11.78, 6.71]], 1, 1200000, "Adamaoua", "Banyo"),
    poly("poly_tignere_1", [[12.63, 7.35], [12.70, 7.35], [12.70, 7.42], [12.63, 7.42], [12.63, 7.35]], 2, 2500000, "Adamaoua", "Tignere"),

    // ═══════════════════════════════════════════════════
    // REGION 2 : CENTRE (Capital: Yaounde)
    // ═══════════════════════════════════════════════════
    poly("poly_yaounde_1", [[11.48, 3.83], [11.56, 3.83], [11.56, 3.91], [11.48, 3.91], [11.48, 3.83]], 2, 3100000, "Centre", "Yaounde"),
    poly("poly_yaounde_2", [[11.52, 3.88], [11.58, 3.88], [11.58, 3.94], [11.52, 3.94], [11.52, 3.88]], 1, 1600000, "Centre", "Yaounde"),
    poly("poly_mbalmayo_1", [[11.46, 3.48], [11.54, 3.48], [11.54, 3.56], [11.46, 3.56], [11.46, 3.48]], 3, 4200000, "Centre", "Mbalmayo"),
    poly("poly_obala_1", [[11.49, 4.13], [11.57, 4.13], [11.57, 4.21], [11.49, 4.21], [11.49, 4.13]], 1, 1400000, "Centre", "Obala"),
    poly("poly_nanga_eboko_1", [[12.33, 4.64], [12.41, 4.64], [12.41, 4.72], [12.33, 4.72], [12.33, 4.64]], 2, 2800000, "Centre", "Nanga-Eboko"),
    poly("poly_eseka_1", [[10.73, 3.63], [10.80, 3.63], [10.80, 3.70], [10.73, 3.70], [10.73, 3.63]], 1, 1300000, "Centre", "Eseka"),
    poly("poly_monatele_1", [[11.17, 4.22], [11.24, 4.22], [11.24, 4.28], [11.17, 4.28], [11.17, 4.22]], 1, 1100000, "Centre", "Monatele"),

    // ═══════════════════════════════════════════════════
    // REGION 3 : EST (Capital: Bertoua)
    // ═══════════════════════════════════════════════════
    poly("poly_bertoua_1", [[13.64, 4.54], [13.72, 4.54], [13.72, 4.62], [13.64, 4.62], [13.64, 4.54]], 2, 3000000, "Est", "Bertoua"),
    poly("poly_batouri_1", [[14.32, 4.39], [14.40, 4.39], [14.40, 4.47], [14.32, 4.47], [14.32, 4.39]], 1, 1700000, "Est", "Batouri"),
    poly("poly_yokadouma_1", [[15.01, 3.48], [15.09, 3.48], [15.09, 3.56], [15.01, 3.56], [15.01, 3.48]], 1, 1400000, "Est", "Yokadouma"),
    poly("poly_abong_mbang_1", [[13.14, 3.94], [13.22, 3.94], [13.22, 4.02], [13.14, 4.02], [13.14, 3.94]], 2, 2600000, "Est", "Abong-Mbang"),
    poly("poly_belabo_1", [[13.28, 4.88], [13.35, 4.88], [13.35, 4.95], [13.28, 4.95], [13.28, 4.88]], 1, 1200000, "Est", "Belabo"),
    poly("poly_moloundou_1", [[15.19, 2.02], [15.27, 2.02], [15.27, 2.10], [15.19, 2.10], [15.19, 2.02]], 3, 4800000, "Est", "Moloundou"),

    // ═══════════════════════════════════════════════════
    // REGION 4 : EXTREME-NORD (Capital: Maroua)
    // ═══════════════════════════════════════════════════
    poly("poly_maroua_1", [[14.28, 10.55], [14.38, 10.55], [14.38, 10.65], [14.28, 10.65], [14.28, 10.55]], 3, 5200000, "Extreme-Nord", "Maroua"),
    poly("poly_maroua_2", [[14.20, 10.48], [14.30, 10.48], [14.30, 10.56], [14.20, 10.56], [14.20, 10.48]], 3, 4600000, "Extreme-Nord", "Maroua"),
    poly("poly_kousseri_1", [[14.99, 12.04], [15.09, 12.04], [15.09, 12.14], [14.99, 12.14], [14.99, 12.04]], 3, 6100000, "Extreme-Nord", "Kousseri"),
    poly("poly_mokolo_1", [[13.76, 10.70], [13.84, 10.70], [13.84, 10.78], [13.76, 10.78], [13.76, 10.70]], 2, 3200000, "Extreme-Nord", "Mokolo"),
    poly("poly_mora_1", [[14.10, 11.01], [14.18, 11.01], [14.18, 11.09], [14.10, 11.09], [14.10, 11.01]], 2, 2900000, "Extreme-Nord", "Mora"),
    poly("poly_yagoua_1", [[15.20, 10.32], [15.30, 10.32], [15.30, 10.42], [15.20, 10.42], [15.20, 10.32]], 3, 5500000, "Extreme-Nord", "Yagoua"),
    poly("poly_kaele_1", [[14.42, 10.08], [14.50, 10.08], [14.50, 10.16], [14.42, 10.16], [14.42, 10.08]], 2, 2700000, "Extreme-Nord", "Kaele"),

    // ═══════════════════════════════════════════════════
    // REGION 5 : LITTORAL (Capital: Douala)
    // ═══════════════════════════════════════════════════
    poly("poly_douala_1", [[9.65, 4.00], [9.75, 4.00], [9.75, 4.08], [9.65, 4.08], [9.65, 4.00]], 3, 4500000, "Littoral", "Douala"),
    poly("poly_douala_2", [[9.55, 4.02], [9.63, 4.02], [9.63, 4.10], [9.55, 4.10], [9.55, 4.02]], 2, 3200000, "Littoral", "Douala"),
    poly("poly_douala_3", [[9.72, 3.95], [9.80, 3.95], [9.80, 4.02], [9.72, 4.02], [9.72, 3.95]], 3, 4100000, "Littoral", "Douala"),
    poly("poly_edea_1", [[10.05, 3.75], [10.15, 3.75], [10.15, 3.85], [10.05, 3.85], [10.05, 3.75]], 2, 2800000, "Littoral", "Edea"),
    poly("poly_edea_2", [[10.10, 3.68], [10.18, 3.68], [10.18, 3.76], [10.10, 3.76], [10.10, 3.68]], 1, 1800000, "Littoral", "Edea"),
    poly("poly_nkongsamba_1", [[9.90, 4.91], [9.98, 4.91], [9.98, 4.99], [9.90, 4.99], [9.90, 4.91]], 1, 1600000, "Littoral", "Nkongsamba"),
    poly("poly_manjo_1", [[9.78, 4.80], [9.86, 4.80], [9.86, 4.88], [9.78, 4.88], [9.78, 4.80]], 1, 1300000, "Littoral", "Manjo"),

    // ═══════════════════════════════════════════════════
    // REGION 6 : NORD (Capital: Garoua)
    // ═══════════════════════════════════════════════════
    poly("poly_garoua_1", [[13.36, 9.26], [13.46, 9.26], [13.46, 9.36], [13.36, 9.36], [13.36, 9.26]], 3, 4800000, "Nord", "Garoua"),
    poly("poly_garoua_2", [[13.28, 9.30], [13.36, 9.30], [13.36, 9.38], [13.28, 9.38], [13.28, 9.30]], 2, 3100000, "Nord", "Garoua"),
    poly("poly_guider_1", [[13.91, 9.89], [13.99, 9.89], [13.99, 9.97], [13.91, 9.97], [13.91, 9.89]], 2, 2800000, "Nord", "Guider"),
    poly("poly_poli_1", [[13.20, 8.44], [13.28, 8.44], [13.28, 8.52], [13.20, 8.52], [13.20, 8.44]], 1, 1500000, "Nord", "Poli"),
    poly("poly_tchollire_1", [[14.13, 8.36], [14.21, 8.36], [14.21, 8.44], [14.13, 8.44], [14.13, 8.36]], 1, 1300000, "Nord", "Tchollire"),
    poly("poly_lagdo_1", [[13.70, 9.05], [13.80, 9.05], [13.80, 9.15], [13.70, 9.15], [13.70, 9.05]], 3, 5800000, "Nord", "Lagdo"),

    // ═══════════════════════════════════════════════════
    // REGION 7 : NORD-OUEST (Capital: Bamenda)
    // ═══════════════════════════════════════════════════
    poly("poly_bamenda_1", [[10.12, 5.93], [10.20, 5.93], [10.20, 6.01], [10.12, 6.01], [10.12, 5.93]], 2, 2800000, "Nord-Ouest", "Bamenda"),
    poly("poly_bamenda_2", [[10.08, 5.97], [10.14, 5.97], [10.14, 6.03], [10.08, 6.03], [10.08, 5.97]], 1, 1400000, "Nord-Ouest", "Bamenda"),
    poly("poly_kumbo_1", [[10.64, 6.18], [10.72, 6.18], [10.72, 6.26], [10.64, 6.26], [10.64, 6.18]], 1, 1600000, "Nord-Ouest", "Kumbo"),
    poly("poly_wum_1", [[10.03, 6.34], [10.11, 6.34], [10.11, 6.42], [10.03, 6.42], [10.03, 6.34]], 2, 2500000, "Nord-Ouest", "Wum"),
    poly("poly_ndop_1", [[10.38, 5.93], [10.46, 5.93], [10.46, 6.01], [10.38, 6.01], [10.38, 5.93]], 1, 1200000, "Nord-Ouest", "Ndop"),
    poly("poly_fundong_1", [[10.26, 6.23], [10.33, 6.23], [10.33, 6.30], [10.26, 6.30], [10.26, 6.23]], 1, 1100000, "Nord-Ouest", "Fundong"),

    // ═══════════════════════════════════════════════════
    // REGION 8 : OUEST (Capital: Bafoussam)
    // ═══════════════════════════════════════════════════
    poly("poly_bafoussam_1", [[10.38, 5.43], [10.46, 5.43], [10.46, 5.51], [10.38, 5.51], [10.38, 5.43]], 2, 3000000, "Ouest", "Bafoussam"),
    poly("poly_dschang_1", [[10.03, 5.40], [10.11, 5.40], [10.11, 5.48], [10.03, 5.48], [10.03, 5.40]], 1, 1700000, "Ouest", "Dschang"),
    poly("poly_foumban_1", [[10.86, 5.69], [10.94, 5.69], [10.94, 5.77], [10.86, 5.77], [10.86, 5.69]], 2, 2600000, "Ouest", "Foumban"),
    poly("poly_mbouda_1", [[10.21, 5.59], [10.29, 5.59], [10.29, 5.67], [10.21, 5.67], [10.21, 5.59]], 1, 1400000, "Ouest", "Mbouda"),
    poly("poly_bangangte_1", [[10.48, 5.10], [10.56, 5.10], [10.56, 5.18], [10.48, 5.18], [10.48, 5.10]], 1, 1300000, "Ouest", "Bangangte"),
    poly("poly_foumbot_1", [[10.60, 5.48], [10.68, 5.48], [10.68, 5.56], [10.60, 5.56], [10.60, 5.48]], 2, 2400000, "Ouest", "Foumbot"),

    // ═══════════════════════════════════════════════════
    // REGION 9 : SUD (Capital: Ebolowa)
    // ═══════════════════════════════════════════════════
    poly("poly_ebolowa_1", [[11.11, 2.86], [11.19, 2.86], [11.19, 2.94], [11.11, 2.94], [11.11, 2.86]], 2, 2800000, "Sud", "Ebolowa"),
    poly("poly_kribi_1", [[9.88, 2.92], [9.96, 2.92], [9.96, 3.00], [9.88, 3.00], [9.88, 2.92]], 2, 2500000, "Sud", "Kribi"),
    poly("poly_kribi_2", [[9.84, 2.85], [9.92, 2.85], [9.92, 2.93], [9.84, 2.93], [9.84, 2.85]], 1, 1600000, "Sud", "Kribi"),
    poly("poly_sangmelima_1", [[11.94, 2.89], [12.02, 2.89], [12.02, 2.97], [11.94, 2.97], [11.94, 2.89]], 1, 1400000, "Sud", "Sangmelima"),
    poly("poly_ambam_1", [[11.24, 2.34], [11.32, 2.34], [11.32, 2.42], [11.24, 2.42], [11.24, 2.34]], 1, 1300000, "Sud", "Ambam"),
    poly("poly_campo_1", [[9.80, 2.33], [9.88, 2.33], [9.88, 2.41], [9.80, 2.41], [9.80, 2.33]], 3, 4400000, "Sud", "Campo"),

    // ═══════════════════════════════════════════════════
    // REGION 10 : SUD-OUEST (Capital: Buea)
    // ═══════════════════════════════════════════════════
    poly("poly_buea_1", [[9.20, 4.12], [9.28, 4.12], [9.28, 4.20], [9.20, 4.20], [9.20, 4.12]], 2, 2700000, "Sud-Ouest", "Buea"),
    poly("poly_limbe_1", [[9.16, 3.98], [9.24, 3.98], [9.24, 4.06], [9.16, 4.06], [9.16, 3.98]], 3, 4300000, "Sud-Ouest", "Limbe"),
    poly("poly_limbe_2", [[9.12, 4.02], [9.18, 4.02], [9.18, 4.08], [9.12, 4.08], [9.12, 4.02]], 2, 2100000, "Sud-Ouest", "Limbe"),
    poly("poly_kumba_1", [[9.41, 4.60], [9.49, 4.60], [9.49, 4.68], [9.41, 4.68], [9.41, 4.60]], 2, 2900000, "Sud-Ouest", "Kumba"),
    poly("poly_mamfe_1", [[9.27, 5.73], [9.35, 5.73], [9.35, 5.81], [9.27, 5.81], [9.27, 5.73]], 1, 1500000, "Sud-Ouest", "Mamfe"),
    poly("poly_tiko_1", [[9.33, 4.06], [9.40, 4.06], [9.40, 4.13], [9.33, 4.13], [9.33, 4.06]], 1, 1300000, "Sud-Ouest", "Tiko"),
    poly("poly_mudemba_1", [[9.50, 4.90], [9.57, 4.90], [9.57, 4.97], [9.50, 4.97], [9.50, 4.90]], 1, 1100000, "Sud-Ouest", "Mudemba"),
  ];
}

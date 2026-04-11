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
      region: "Cameroun — Littoral",
      status: "active",
      feature_count: 8,
    },
    {
      id: "event_20260715",
      before_date: "2026-05-01",
      after_date: "2026-07-15",
      region: "Cameroun — Extrême-Nord",
      status: "archive",
      feature_count: 15,
    },
    {
      id: "event_20251020",
      before_date: "2025-08-01",
      after_date: "2025-10-20",
      region: "Cameroun — Littoral",
      status: "archive",
      feature_count: 12,
    },
  ];
}

export function getDemoPolygons() {
  return [
    {
      id: "poly_douala_1",
      geometry: JSON.stringify({
        type: "Polygon",
        coordinates: [[[9.65, 4.00], [9.75, 4.00], [9.75, 4.08], [9.65, 4.08], [9.65, 4.00]]],
      }),
      risk_level: 3,
      risk_label: "CRITIQUE",
      area_m2: 4500000,
    },
    {
      id: "poly_douala_2",
      geometry: JSON.stringify({
        type: "Polygon",
        coordinates: [[[9.55, 4.02], [9.63, 4.02], [9.63, 4.10], [9.55, 4.10], [9.55, 4.02]]],
      }),
      risk_level: 2,
      risk_label: "ALERTE",
      area_m2: 3200000,
    },
    {
      id: "poly_edea_1",
      geometry: JSON.stringify({
        type: "Polygon",
        coordinates: [[[10.05, 3.75], [10.15, 3.75], [10.15, 3.85], [10.05, 3.85], [10.05, 3.75]]],
      }),
      risk_level: 1,
      risk_label: "VIGILANCE",
      area_m2: 1800000,
    },
    {
      id: "poly_kribi_1",
      geometry: JSON.stringify({
        type: "Polygon",
        coordinates: [[[9.88, 2.92], [9.96, 2.92], [9.96, 3.00], [9.88, 3.00], [9.88, 2.92]]],
      }),
      risk_level: 2,
      risk_label: "ALERTE",
      area_m2: 2100000,
    },
    {
      id: "poly_maroua_1",
      geometry: JSON.stringify({
        type: "Polygon",
        coordinates: [[[14.28, 10.55], [14.38, 10.55], [14.38, 10.63], [14.28, 10.63], [14.28, 10.55]]],
      }),
      risk_level: 3,
      risk_label: "CRITIQUE",
      area_m2: 5200000,
    },
    {
      id: "poly_garoua_1",
      geometry: JSON.stringify({
        type: "Polygon",
        coordinates: [[[13.35, 9.27], [13.45, 9.27], [13.45, 9.35], [13.35, 9.35], [13.35, 9.27]]],
      }),
      risk_level: 1,
      risk_label: "VIGILANCE",
      area_m2: 1500000,
    },
    {
      id: "poly_limbe_1",
      geometry: JSON.stringify({
        type: "Polygon",
        coordinates: [[[9.18, 4.00], [9.25, 4.00], [9.25, 4.06], [9.18, 4.06], [9.18, 4.00]]],
      }),
      risk_level: 2,
      risk_label: "ALERTE",
      area_m2: 2800000,
    },
    {
      id: "poly_bamenda_1",
      geometry: JSON.stringify({
        type: "Polygon",
        coordinates: [[[10.12, 5.93], [10.20, 5.93], [10.20, 6.00], [10.12, 6.00], [10.12, 5.93]]],
      }),
      risk_level: 1,
      risk_label: "VIGILANCE",
      area_m2: 1200000,
    },
  ];
}

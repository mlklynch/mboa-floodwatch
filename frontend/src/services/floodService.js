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
 * Fetch all flood events from Firestore.
 * First tries flood_events collection, then creates events from regions in polygons collection.
 */
export async function fetchFloodEvents() {
  try {
    // Try to fetch actual flood_events collection
    const q = query(collection(db, "flood_events"), orderBy("after_date", "desc"));
    const snap = await getDocs(q);
    if (snap.docs.length > 0) {
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
  } catch (err) {
    console.warn("flood_events collection not available, trying polygons fallback:", err.message);
  }

  // Fallback: Create events from unique regions in polygons collection
  try {
    const snap = await getDocs(collection(db, "polygons"));
    const polygons = snap.docs.map((d) => d.data());
    
    // Extract unique regions
    const regionMap = {};
    polygons.forEach((poly) => {
      const region = poly.region_name || "Cameroun";
      if (!regionMap[region]) {
        regionMap[region] = {
          count: 0,
          analyzed_at: poly.analyzed_at || poly.created_at,
        };
      }
      regionMap[region].count += 1;
    });

    // Convert to event format
    const events = Object.entries(regionMap).map(([region, data]) => ({
      id: region.replace(/\s+/g, "_").toLowerCase(),
      region,
      after_date: data.analyzed_at || new Date().toISOString().split("T")[0],
      status: "active",
      feature_count: data.count,
    }));

    // Sort by analyzed_at descending
    events.sort((a, b) => (b.after_date || "").localeCompare(a.after_date || ""));
    
    return events;
  } catch (err) {
    console.error("Error fetching polygons for events:", err);
    return [];
  }
}

/**
 * Fetch polygons for a given region/event.
 * First tries flood_events sub-collection, then filters polygons by region_name.
 */
export async function fetchEventPolygons(eventId) {
  try {
    // Try to fetch from flood_events sub-collection
    const snap = await getDocs(
      collection(db, "flood_events", eventId, "polygons")
    );
    if (snap.docs.length > 0) {
      return snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        geometry: typeof d.data().geometry === "string" 
          ? JSON.parse(d.data().geometry) 
          : d.data().geometry,
      }));
    }
  } catch (err) {
    console.warn(`No sub-collection found for ${eventId}, trying region filter:`, err.message);
  }

  // Fallback: Filter polygons by region_name
  try {
    // Decode region from eventId (region names are lowercased/underscored)
    // We need to fetch all and filter since we don't know the exact region name
    const snap = await getDocs(collection(db, "polygons"));
    const allPolygons = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      geometry: typeof d.data().geometry === "string" 
        ? JSON.parse(d.data().geometry) 
        : d.data().geometry,
    }));

    // If eventId looks like a region key, filter by it
    // Otherwise return all (first time view)
    if (eventId && eventId !== "all") {
      // Try to match region by ID or by region_name
      return allPolygons.filter((p) => {
        const regionLower = (p.region_name || "").toLowerCase().replace(/\s+/g, "_");
        return regionLower === eventId || p.region_name === eventId;
      });
    }
    
    return allPolygons;
  } catch (err) {
    console.error("Error fetching polygons:", err);
    return [];
  }
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

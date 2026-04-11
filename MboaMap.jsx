/**
 * Mboa-FloodWatch — Composant MboaMap (F2)
 * Carte interactive Leaflet avec :
 *  - Calques de risque Vert / Jaune / Rouge
 *  - Outil "Ma Position" avec détection de zone à risque
 *  - Archives historiques (F4)
 *  - Légende dynamique
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { initializeApp }   from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc } from "firebase/firestore";
import * as turf           from "@turf/turf";

// ─── Configuration Firebase ───────────────────────────────────────────────────

const firebaseConfig = {
  apiKey:            process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain:        process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ─── Constantes de Style ──────────────────────────────────────────────────────

const RISK_STYLES = {
  1: { color: "#007A5E", fillColor: "#007A5E", fillOpacity: 0.45, weight: 2, label: "Vigilance",  emoji: "🟢" },
  2: { color: "#FCD116", fillColor: "#FCD116", fillOpacity: 0.50, weight: 2, label: "Alerte",     emoji: "🟡" },
  3: { color: "#CE1126", fillColor: "#CE1126", fillOpacity: 0.60, weight: 2.5,label: "Critique", emoji: "🔴" },
};

const CAMEROON_CENTER = [5.5, 12.3];
const CAMEROON_ZOOM   = 6;

// ─── Utilitaires ──────────────────────────────────────────────────────────────

function getRiskForPoint(lat, lng, polygons) {
  const point = turf.point([lng, lat]);
  let maxRisk = 0;
  for (const poly of polygons) {
    try {
      const turfPoly = turf.feature(JSON.parse(poly.geometry));
      if (turf.booleanPointInPolygon(point, turfPoly)) {
        maxRisk = Math.max(maxRisk, poly.risk_level || 0);
      }
    } catch (_) {}
  }
  return maxRisk;
}

// ─── Composant Principal ──────────────────────────────────────────────────────

export default function MboaMap() {
  const mapRef       = useRef(null);
  const leafletRef   = useRef(null);
  const riskLayerRef = useRef(null);

  const [loading,       setLoading]       = useState(true);
  const [events,        setEvents]        = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [userRisk,      setUserRisk]      = useState(null);  // null | 0 | 1 | 2 | 3
  const [userPos,       setUserPos]       = useState(null);
  const [polygonsCache, setPolygonsCache] = useState([]);
  const [geolocating,   setGeolocating]  = useState(false);
  const [sidebarOpen,   setSidebarOpen]  = useState(false);

  // ── Initialisation de la carte ────────────────────────────────────────────
  useEffect(() => {
    if (leafletRef.current) return;

    const map = L.map(mapRef.current, {
      center: CAMEROON_CENTER,
      zoom:   CAMEROON_ZOOM,
      zoomControl: false,
    });

    // Fond de carte OpenStreetMap
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);

    // Fond sombre pour mieux voir les alertes (optionnel)
    L.tileLayer(
      "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png",
      { opacity: 0.3, maxZoom: 18 }
    ).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);
    leafletRef.current = map;

    return () => { map.remove(); leafletRef.current = null; };
  }, []);

  // ── Chargement des événements disponibles ─────────────────────────────────
  useEffect(() => {
    async function loadEvents() {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, "flood_events"));
        const evts = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => b.after_date.localeCompare(a.after_date));
        setEvents(evts);
        if (evts.length > 0) setSelectedEvent(evts[0].id);
      } catch (err) {
        console.error("Erreur chargement événements :", err);
      }
      setLoading(false);
    }
    loadEvents();
  }, []);

  // ── Chargement des polygones d'un événement ───────────────────────────────
  const loadEventPolygons = useCallback(async (eventId) => {
    if (!eventId || !leafletRef.current) return;
    setLoading(true);

    // Nettoyer l'ancien calque
    if (riskLayerRef.current) {
      leafletRef.current.removeLayer(riskLayerRef.current);
      riskLayerRef.current = null;
    }

    try {
      const polygonsSnap = await getDocs(
        collection(db, "flood_events", eventId, "polygons")
      );
      const polygons = polygonsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPolygonsCache(polygons);

      const layers = [];
      for (const poly of polygons) {
        let geometry;
        try { geometry = JSON.parse(poly.geometry); } catch (_) { continue; }

        const riskLevel = poly.risk_level || 1;
        const style     = RISK_STYLES[Math.min(3, Math.max(1, Math.round(riskLevel)))] || RISK_STYLES[1];

        const layer = L.geoJSON(geometry, {
          style,
          onEachFeature: (feature, lyr) => {
            lyr.bindPopup(`
              <div class="mboa-popup">
                <span class="popup-badge" style="background:${style.fillColor}">
                  ${style.emoji} ${style.label}
                </span>
                <p>Niveau de risque : <strong>${style.label}</strong></p>
                <p style="font-size:12px;color:#666;">Zone détectée par Sentinel-1 SAR</p>
              </div>
            `);
            lyr.on("mouseover", () => lyr.setStyle({ fillOpacity: 0.8 }));
            lyr.on("mouseout",  () => lyr.setStyle({ fillOpacity: style.fillOpacity }));
          }
        });
        layers.push(layer);
      }

      if (layers.length > 0) {
        const group = L.layerGroup(layers).addTo(leafletRef.current);
        riskLayerRef.current = group;
        // Centrer sur les polygones
        const bounds = L.featureGroup(layers).getBounds();
        if (bounds.isValid()) leafletRef.current.fitBounds(bounds, { padding: [40, 40] });
      }
    } catch (err) {
      console.error("Erreur chargement polygones :", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadEventPolygons(selectedEvent); }, [selectedEvent, loadEventPolygons]);

  // ── F2 : Outil "Ma Position" ──────────────────────────────────────────────
  const handleMyPosition = useCallback(() => {
    if (!navigator.geolocation) {
      alert("La géolocalisation n'est pas supportée par votre navigateur.");
      return;
    }
    setGeolocating(true);
    setUserRisk(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setUserPos({ lat, lng });

        // Calculer le risque
        const risk = getRiskForPoint(lat, lng, polygonsCache);
        setUserRisk(risk);
        setSidebarOpen(true);

        // Marqueur utilisateur
        const map = leafletRef.current;
        if (map) {
          const icon = L.divIcon({
            className: "",
            html: `<div class="user-marker" style="
              width:36px;height:36px;border-radius:50%;
              background:${risk > 0 ? RISK_STYLES[Math.min(3,risk)].fillColor : '#007A5E'};
              border:3px solid #fff;box-shadow:0 2px 12px rgba(0,0,0,.4);
              display:flex;align-items:center;justify-content:center;
              font-size:18px;">📍</div>`,
            iconSize: [36, 36],
            iconAnchor: [18, 18],
          });
          L.marker([lat, lng], { icon })
            .addTo(map)
            .bindPopup(
              risk > 0
                ? `<strong>Vous êtes dans une zone ${RISK_STYLES[Math.min(3,risk)].label} !</strong>`
                : `<strong>Vous n'êtes pas dans une zone inondée.</strong>`
            )
            .openPopup();
          map.setView([lat, lng], 11, { animate: true });
        }
        setGeolocating(false);
      },
      (err) => {
        alert("Impossible d'obtenir votre position : " + err.message);
        setGeolocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [polygonsCache]);

  // ── Panneau de résultat "Ma Position" ─────────────────────────────────────
  const riskStyle = userRisk && RISK_STYLES[Math.min(3, userRisk)];

  return (
    <div className="mboa-map-wrapper">
      {/* Carte Leaflet */}
      <div ref={mapRef} className="mboa-leaflet-map" />

      {/* Barre d'outils flottante */}
      <div className="mboa-toolbar">
        <div className="mboa-logo-chip">
          <span className="logo-icon">🌊</span>
          <span>Mboa-FloodWatch</span>
        </div>

        {/* Sélecteur d'archives F4 */}
        <div className="mboa-event-selector">
          <label>📅 Archive :</label>
          <select
            value={selectedEvent || ""}
            onChange={e => setSelectedEvent(e.target.value)}
            disabled={loading}
          >
            {events.map(ev => (
              <option key={ev.id} value={ev.id}>
                {ev.after_date} — {ev.region || "Cameroun"}
              </option>
            ))}
          </select>
        </div>

        {/* Bouton Ma Position */}
        <button
          className={`btn-position ${geolocating ? "loading" : ""}`}
          onClick={handleMyPosition}
          disabled={geolocating || polygonsCache.length === 0}
          title="Vérifier si je suis dans une zone à risque"
        >
          {geolocating ? (
            <><span className="spinner" /> Localisation...</>
          ) : (
            <><span>📍</span> Ma Position</>
          )}
        </button>
      </div>

      {/* Légende */}
      <div className="mboa-legend">
        <h4>⚠️ Niveau de Risque</h4>
        {Object.entries(RISK_STYLES).map(([level, style]) => (
          <div key={level} className="legend-item">
            <span className="legend-dot" style={{ background: style.fillColor }} />
            <span>{style.emoji} {style.label}</span>
          </div>
        ))}
        <div className="legend-item">
          <span className="legend-dot" style={{ background: "#aaa", opacity: 0.4 }} />
          <span>⬜ Zone sûre</span>
        </div>
      </div>

      {/* Panneau latéral — Résultat Ma Position */}
      {sidebarOpen && userRisk !== null && (
        <div
          className="mboa-result-panel"
          style={{ borderTop: `5px solid ${userRisk > 0 ? riskStyle.fillColor : "#007A5E"}` }}
        >
          <button className="close-panel" onClick={() => setSidebarOpen(false)}>✕</button>
          {userRisk === 0 ? (
            <>
              <div className="result-icon safe">✅</div>
              <h3>Zone Sécurisée</h3>
              <p>Votre position actuelle ne se trouve dans aucune zone d'inondation détectée.</p>
            </>
          ) : (
            <>
              <div className="result-icon" style={{ color: riskStyle.fillColor }}>
                {riskStyle.emoji}
              </div>
              <h3 style={{ color: riskStyle.color }}>
                Alerte — Niveau {riskStyle.label}
              </h3>
              <p>
                Vous vous trouvez dans une zone d'inondation classifiée
                <strong style={{ color: riskStyle.fillColor }}> {riskStyle.label}</strong>.
              </p>
              <p style={{ fontSize: "13px", color: "#666" }}>
                Données Sentinel-1 SAR. Restez prudent et suivez les consignes officielles.
              </p>
            </>
          )}
          {userPos && (
            <p className="coords">
              📍 {userPos.lat.toFixed(5)}°N, {userPos.lng.toFixed(5)}°E
            </p>
          )}
        </div>
      )}

      {/* Indicateur de chargement */}
      {loading && (
        <div className="mboa-loading">
          <div className="loading-wave">🌊</div>
          <span>Chargement des données satellite...</span>
        </div>
      )}
    </div>
  );
}

/**
 * Mboa-FloodWatch — MboaMap Component (F2)
 * Interactive Leaflet map with:
 *  - Risk layers (Vert / Jaune / Rouge)
 *  - "Ma Position" geolocation tool
 *  - Dynamic legend
 */

import React, { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { RISK_STYLES, CAMEROON_CENTER, CAMEROON_ZOOM } from "../services/floodService";

export default function MboaMap({
  polygons,
  loading,
  userPosition,
  userRisk,
  locating,
  onLocate,
  onCloseResult,
}) {
  const mapContainerRef = useRef(null);
  const leafletMapRef   = useRef(null);
  const riskLayerRef    = useRef(null);
  const userMarkerRef   = useRef(null);

  // Initialize Leaflet map
  useEffect(() => {
    if (leafletMapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: CAMEROON_CENTER,
      zoom: CAMEROON_ZOOM,
      zoomControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);
    leafletMapRef.current = map;

    return () => {
      map.remove();
      leafletMapRef.current = null;
    };
  }, []);

  // Render risk polygons on the map
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    // Clear previous layers
    if (riskLayerRef.current) {
      map.removeLayer(riskLayerRef.current);
      riskLayerRef.current = null;
    }

    if (polygons.length === 0) return;

    const layers = [];
    for (const poly of polygons) {
      let geometry;
      try {
        geometry = typeof poly.geometry === "string"
          ? JSON.parse(poly.geometry)
          : poly.geometry;
      } catch {
        continue;
      }

      const riskLevel = poly.risk_level || 1;
      const style = RISK_STYLES[Math.min(3, Math.max(1, Math.round(riskLevel)))] || RISK_STYLES[1];

      const layer = L.geoJSON(geometry, {
        style: {
          color: style.color,
          fillColor: style.fillColor,
          fillOpacity: style.fillOpacity,
          weight: style.weight,
        },
        onEachFeature: (feature, lyr) => {
          const regionInfo = poly.region ? `<p style="font-size:12px;font-weight:600;margin:2px 0;">${poly.region}${poly.ville ? ` — ${poly.ville}` : ""}</p>` : "";
          lyr.bindPopup(`
            <div class="mboa-popup">
              <span class="popup-badge" style="background:${style.fillColor}">
                ${style.label}
              </span>
              ${regionInfo}
              <p><strong>Niveau : ${style.label}</strong></p>
              <p style="font-size:12px;color:#666;">Detecte par Sentinel-1 SAR</p>
            </div>
          `);
          lyr.on("mouseover", () => lyr.setStyle({ fillOpacity: 0.8 }));
          lyr.on("mouseout", () => lyr.setStyle({ fillOpacity: style.fillOpacity }));
        },
      });
      layers.push(layer);
    }

    if (layers.length > 0) {
      const group = L.layerGroup(layers).addTo(map);
      riskLayerRef.current = group;
      const bounds = L.featureGroup(layers).getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    }
  }, [polygons]);

  // Show user marker when position changes
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map || !userPosition) return;

    // Remove previous user marker
    if (userMarkerRef.current) {
      map.removeLayer(userMarkerRef.current);
    }

    const riskStyle = userRisk > 0
      ? RISK_STYLES[Math.min(3, userRisk)]
      : { fillColor: "#007A5E" };

    const icon = L.divIcon({
      className: "",
      html: `<div style="
        width:36px;height:36px;border-radius:50%;
        background:${riskStyle.fillColor};
        border:3px solid #fff;box-shadow:0 2px 12px rgba(0,0,0,.4);
        display:flex;align-items:center;justify-content:center;
        font-size:16px;color:#fff;font-weight:bold;
      ">&#9679;</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    const marker = L.marker([userPosition.lat, userPosition.lng], { icon })
      .addTo(map)
      .bindPopup(
        userRisk > 0
          ? `<strong>Vous etes dans une zone ${RISK_STYLES[Math.min(3, userRisk)].label} !</strong>`
          : "<strong>Vous n'etes pas dans une zone inondee.</strong>"
      )
      .openPopup();

    userMarkerRef.current = marker;
    map.setView([userPosition.lat, userPosition.lng], 11, { animate: true });
  }, [userPosition, userRisk]);

  const handleLocateClick = useCallback(() => {
    if (onLocate) onLocate();
  }, [onLocate]);

  const riskStyle = userRisk !== null && userRisk > 0
    ? RISK_STYLES[Math.min(3, userRisk)]
    : null;

  const resultClass = userRisk === 0 ? "safe" : userRisk === 1 ? "warning" : userRisk > 1 ? "danger" : "";

  return (
    <div className="map-area">
      <div id="mboa-map" ref={mapContainerRef} />

      {/* Ma Position Button */}
      <button
        className={`btn-my-position ${locating ? "locating" : ""}`}
        onClick={handleLocateClick}
        disabled={locating || polygons.length === 0}
      >
        {locating ? (
          <>
            <span className="spinner" />
            Localisation...
          </>
        ) : (
          "Ma Position"
        )}
      </button>

      {/* Dynamic Legend */}
      <div className="map-legend">
        <div className="legend-title">Niveau de Risque</div>
        <div className="legend-row">
          <span className="legend-swatch" style={{ background: "#CE1126" }} />
          Critique
        </div>
        <div className="legend-row">
          <span className="legend-swatch" style={{ background: "#FCD116" }} />
          Alerte
        </div>
        <div className="legend-row">
          <span className="legend-swatch" style={{ background: "#007A5E" }} />
          Vigilance
        </div>
        <div className="legend-row">
          <span className="legend-swatch" style={{ background: "#ccc", opacity: 0.5 }} />
          Zone sure
        </div>
      </div>

      {/* Position Result Panel */}
      {userRisk !== null && (
        <div className={`position-result ${resultClass}`}>
          <div className="position-result-header">
            <h3 style={{ color: riskStyle ? riskStyle.color : "#007A5E" }}>
              {userRisk === 0 ? "Zone Securisee" : `Alerte — ${riskStyle.label}`}
            </h3>
            <button className="position-result-close" onClick={onCloseResult}>
              &#10005;
            </button>
          </div>
          {userRisk === 0 ? (
            <p>Votre position actuelle ne se trouve dans aucune zone d&apos;inondation detectee.</p>
          ) : (
            <>
              <p>
                Vous vous trouvez dans une zone d&apos;inondation classifiee{" "}
                <strong style={{ color: riskStyle.color }}>{riskStyle.label}</strong>.
              </p>
              <p>Donnees Sentinel-1 SAR. Restez prudent et suivez les consignes officielles.</p>
            </>
          )}
          {userPosition && (
            <p className="coords">
              {userPosition.lat.toFixed(5)}°N, {userPosition.lng.toFixed(5)}°E
            </p>
          )}
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="map-loading">
          <div className="loading-wave">&#127754;</div>
          <span>Chargement des donnees satellite...</span>
        </div>
      )}
    </div>
  );
}

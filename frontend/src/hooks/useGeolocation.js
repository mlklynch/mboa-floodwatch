/**
 * Mboa-FloodWatch — useGeolocation Hook
 * Handles browser geolocation and risk detection for the "Ma Position" feature.
 */

import { useState, useCallback } from "react";
import * as turf from "@turf/turf";

/**
 * Determine the highest risk level for a given point against all polygons.
 */
function getRiskForPoint(lat, lng, polygons) {
  const point = turf.point([lng, lat]);
  let maxRisk = 0;

  for (const poly of polygons) {
    try {
      const geometry = typeof poly.geometry === "string"
        ? JSON.parse(poly.geometry)
        : poly.geometry;
      const turfPoly = turf.feature(geometry);
      if (turf.booleanPointInPolygon(point, turfPoly)) {
        maxRisk = Math.max(maxRisk, Number(poly.risk_level) || 0);
      }
    } catch {
      // Skip malformed polygons
    }
  }
  return maxRisk;
}

export default function useGeolocation() {
  const [position, setPosition]   = useState(null);
  const [riskLevel, setRiskLevel] = useState(null); // null | 0 | 1 | 2 | 3
  const [locating, setLocating]   = useState(false);
  const [error, setError]         = useState(null);

  const locate = useCallback((polygons) => {
    if (!navigator.geolocation) {
      setError("La geolocalisation n'est pas supportee par votre navigateur.");
      return;
    }

    setLocating(true);
    setError(null);
    setRiskLevel(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setPosition({ lat: latitude, lng: longitude });

        const risk = getRiskForPoint(latitude, longitude, polygons);
        setRiskLevel(risk);
        setLocating(false);
      },
      (err) => {
        setError("Impossible d'obtenir votre position : " + err.message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const reset = useCallback(() => {
    setPosition(null);
    setRiskLevel(null);
    setError(null);
  }, []);

  return {
    position,
    riskLevel,
    locating,
    error,
    locate,
    reset,
  };
}

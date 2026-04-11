/**
 * Mboa-FloodWatch — useFloodData Hook
 * Manages flood events and polygon data from Firestore (with demo fallback).
 */

import { useState, useEffect, useCallback } from "react";
import {
  fetchFloodEvents,
  fetchEventPolygons,
  getDemoFloodEvents,
  getDemoPolygons,
} from "../services/floodService";

export default function useFloodData() {
  const [events, setEvents]             = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [polygons, setPolygons]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [isDemo, setIsDemo]             = useState(false);

  // Load all flood events on mount
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const evts = await fetchFloodEvents();
        if (cancelled) return;
        if (evts.length > 0) {
          setEvents(evts);
          setSelectedEventId(evts[0].id);
          setIsDemo(false);
        } else {
          throw new Error("No events found");
        }
      } catch (err) {
        if (cancelled) return;
        console.warn("Using demo data:", err.message);
        const demoEvents = getDemoFloodEvents();
        setEvents(demoEvents);
        setSelectedEventId(demoEvents[0].id);
        setIsDemo(true);
      }
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // Load polygons when selected event changes
  const loadPolygons = useCallback(async (eventId) => {
    if (!eventId) return;
    setLoading(true);
    setError(null);

    try {
      if (isDemo) {
        setPolygons(getDemoPolygons());
      } else {
        const polys = await fetchEventPolygons(eventId);
        if (polys.length > 0) {
          setPolygons(polys);
        } else {
          setPolygons(getDemoPolygons());
        }
      }
    } catch (err) {
      console.warn("Polygons fallback to demo:", err.message);
      setPolygons(getDemoPolygons());
    }
    setLoading(false);
  }, [isDemo]);

  useEffect(() => {
    loadPolygons(selectedEventId);
  }, [selectedEventId, loadPolygons]);

  // Compute stats from current polygons (coerce risk_level to number for Firestore compatibility)
  const stats = {
    critique:  polygons.filter((p) => Number(p.risk_level) === 3).length,
    alerte:    polygons.filter((p) => Number(p.risk_level) === 2).length,
    vigilance: polygons.filter((p) => Number(p.risk_level) === 1).length,
    total:     polygons.length,
  };

  return {
    events,
    selectedEventId,
    setSelectedEventId,
    polygons,
    stats,
    loading,
    error,
    isDemo,
    reload: () => loadPolygons(selectedEventId),
  };
}

import './App.css';
import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import * as turf from "@turf/turf";
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Configuration Firebase
const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  // ... autres clés .env
});
const db = getFirestore(app);

export default function MboaMap() {
  const mapRef = useRef(null);
  const [polygons, setPolygons] = useState([]);
  const [risk, setRisk] = useState(null);

  useEffect(() => {
    // Initialisation OSM
    const map = L.map('map').setView([4.05, 9.7], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(map);
    mapRef.current = map;

    // Chargement des polygones depuis Firestore
    const loadPolygons = async () => {
      const { collection, getDocs } = await import("firebase/firestore");
      const querySnapshot = await getDocs(collection(db, "polygons"));
      const loadedPolygons = querySnapshot.docs.map(doc => doc.data());
      setPolygons(loadedPolygons);
    };
    loadPolygons();
  }, []);

  const handleGeoloc = () => {
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      const point = turf.point([longitude, latitude]);
      
      let inDanger = false;
      polygons.forEach(p => {
        const geom = typeof p.geometry === 'string' ? JSON.parse(p.geometry) : p.geometry;
        if (turf.booleanPointInPolygon(point, turf.feature(geom))) inDanger = true;
      });

      setRisk(inDanger ? "🔴 CRITIQUE" : "🟢 SÛR");
      L.marker([latitude, longitude]).addTo(mapRef.current).bindPopup("Ma Position").openPopup();
      mapRef.current.setView([latitude, longitude], 13);
    });
  };

  return (
    <div className="mboa-map-wrapper">
      <div id="map" className="mboa-leaflet-map"></div>
      <div className="mboa-toolbar">
        <h2 style={{color: '#007A5E', margin: 0}}>Mboa-FloodWatch</h2>
        <button className="mboa-btn-yellow" onClick={handleGeoloc}>📍 Ma Position</button>
      </div>
      {risk && (
        <div className="mboa-result-panel">
          <h3>Statut de Risque</h3>
          <h2 style={{ color: risk.includes("🔴") ? "#CE1126" : "#007A5E" }}>{risk}</h2>
        </div>
      )}
    </div>
  );
}
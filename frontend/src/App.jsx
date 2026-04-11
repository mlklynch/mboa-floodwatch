/**
 * Mboa-FloodWatch — Main Application Component
 * Citizen flood monitoring platform for Cameroon.
 */

import React, { useState, useCallback, useEffect } from "react";
import Navbar from "./components/Navbar";
import SidePanel from "./components/SidePanel";
import MboaMap from "./components/MboaMap";
import useFloodData from "./hooks/useFloodData";
import useGeolocation from "./hooks/useGeolocation";

export default function App() {
  const {
    events,
    selectedEventId,
    setSelectedEventId,
    polygons,
    stats,
    loading,
    isDemo,
  } = useFloodData();

  const {
    position: userPosition,
    riskLevel: userRisk,
    locating,
    locate,
    reset: resetGeolocation,
  } = useGeolocation();

  const [toast, setToast] = useState(null);

  // Toast notification handler
  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Trigger geolocation with current polygons
  const handleLocate = useCallback(() => {
    locate(polygons);
  }, [locate, polygons]);

  // Scroll side panel to subscribe form
  const handleSubscribeClick = useCallback(() => {
    const formSection = document.querySelector(".subscribe-form");
    if (formSection) {
      formSection.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  return (
    <div className="app-shell">
      <Navbar onSubscribeClick={handleSubscribeClick} />

      <div className="main-content">
        <SidePanel
          stats={stats}
          events={events}
          selectedEventId={selectedEventId}
          onSelectEvent={setSelectedEventId}
          loading={loading}
          isDemo={isDemo}
          onToast={showToast}
        />

        <MboaMap
          polygons={polygons}
          loading={loading}
          userPosition={userPosition}
          userRisk={userRisk}
          locating={locating}
          onLocate={handleLocate}
          onCloseResult={resetGeolocation}
        />
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          <span>{toast.message}</span>
          <button className="toast-close" onClick={() => setToast(null)}>
            &#10005;
          </button>
        </div>
      )}
    </div>
  );
}

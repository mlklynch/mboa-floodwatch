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
import { getSessionUser, setSessionUser, clearSessionUser } from "./services/authStorage";

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
  const [user, setUser] = useState(null);

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

  // Load current session user from localStorage
  useEffect(() => {
    const stored = getSessionUser();
    if (stored) {
      setUser(stored);
    }
  }, []);

  // Trigger geolocation with current polygons
  const handleLocate = useCallback(() => {
    locate(polygons);
  }, [locate, polygons]);

  const handleAuthenticated = useCallback((subscriber) => {
    const sessionUser = setSessionUser(subscriber);
    setUser(sessionUser);
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null);
    clearSessionUser();
    showToast("Deconnexion reussie.", "success");
  }, [showToast]);

  // Scroll side panel to subscribe form
  const handleSubscribeClick = useCallback(() => {
    const formSection = document.querySelector(".subscribe-form");
    if (formSection) {
      formSection.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  return (
    <div className="app-shell">
      <Navbar user={user} onSubscribeClick={handleSubscribeClick} />

      <div className="main-content">
        <SidePanel
          user={user}
          stats={stats}
          events={events}
          selectedEventId={selectedEventId}
          onSelectEvent={setSelectedEventId}
          loading={loading}
          isDemo={isDemo}
          onToast={showToast}
          onAuthenticated={handleAuthenticated}
          onLogout={handleLogout}
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

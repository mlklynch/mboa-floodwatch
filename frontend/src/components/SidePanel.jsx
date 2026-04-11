/**
 * Mboa-FloodWatch — SidePanel Component
 * Left panel containing StatsGrid, ArchiveSelector, and SubscribeForm.
 */

import React from "react";
import StatsGrid from "./StatsGrid";
import ArchiveSelector from "./ArchiveSelector";
import SubscribeForm from "./SubscribeForm";

export default function SidePanel({
  stats,
  events,
  selectedEventId,
  onSelectEvent,
  loading,
  isDemo,
  onToast,
}) {
  return (
    <aside className="side-panel">
      {/* Stats Section */}
      <div className="panel-section">
        <div className="section-title">
          Zones Detectees
        </div>
        <StatsGrid stats={stats} />
        {isDemo && (
          <p style={{
            fontSize: "11px",
            color: "#B45309",
            marginTop: "10px",
            background: "#FFFBEB",
            padding: "6px 10px",
            borderRadius: "6px",
            border: "1px solid #FDE68A",
          }}>
            Mode demo — donnees de demonstration
          </p>
        )}
      </div>

      {/* Archive Selector (F4) */}
      <div className="panel-section">
        <div className="section-title">
          Archives Historiques
        </div>
        <ArchiveSelector
          events={events}
          selectedEventId={selectedEventId}
          onSelectEvent={onSelectEvent}
          loading={loading}
        />
      </div>

      {/* Subscribe Form (F3) */}
      <div className="panel-section">
        <div className="section-title">
          Recevoir les Alertes
        </div>
        <SubscribeForm
          onSuccess={(msg) => onToast(msg, "success")}
          onError={(msg) => onToast(msg, "error")}
        />
      </div>
    </aside>
  );
}

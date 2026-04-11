/**
 * Mboa-FloodWatch — ArchiveSelector Component (F4)
 * Calendar-based selector for viewing historical flood data.
 */

import React from "react";

export default function ArchiveSelector({ events, selectedEventId, onSelectEvent, loading }) {
  return (
    <div className="archive-selector">
      <label htmlFor="event-select">Saison / Periode</label>
      <select
        id="event-select"
        value={selectedEventId || ""}
        onChange={(e) => onSelectEvent(e.target.value)}
        disabled={loading}
      >
        {events.map((ev) => (
          <option key={ev.id} value={ev.id}>
            {ev.after_date} — {ev.region || "Cameroun"}
          </option>
        ))}
      </select>

      <button
        className="btn-load-archive"
        onClick={() => onSelectEvent(selectedEventId)}
        disabled={loading}
      >
        {loading ? (
          <>
            <span className="spinner" />
            Chargement...
          </>
        ) : (
          <>
            Charger les Donnees
          </>
        )}
      </button>
    </div>
  );
}

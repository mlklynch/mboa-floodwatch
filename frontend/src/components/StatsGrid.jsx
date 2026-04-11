/**
 * Mboa-FloodWatch — StatsGrid Component
 * Displays real-time flood zone statistics by risk level.
 */

import React from "react";

export default function StatsGrid({ stats }) {
  return (
    <div className="stats-grid">
      <div className="stat-card stat-card-critique">
        <div className="stat-label">Critique</div>
        <div className="stat-value">{stats.critique}</div>
      </div>
      <div className="stat-card stat-card-alerte">
        <div className="stat-label">Alerte</div>
        <div className="stat-value">{stats.alerte}</div>
      </div>
      <div className="stat-card stat-card-vigilance">
        <div className="stat-label">Vigilance</div>
        <div className="stat-value">{stats.vigilance}</div>
      </div>
      <div className="stat-card stat-card-total">
        <div className="stat-label">Total Zones</div>
        <div className="stat-value">{stats.total}</div>
      </div>
    </div>
  );
}

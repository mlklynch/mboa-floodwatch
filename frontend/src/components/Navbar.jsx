/**
 * Mboa-FloodWatch — Navbar Component
 * Navigation bar with Cameroun branding and national colors.
 */

import React from "react";

export default function Navbar({ onSubscribeClick }) {
  return (
    <nav className="navbar">
      <a href="/" className="navbar-brand">
        <div className="brand-logo">
          <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Cameroun outline + radar wave + water drop */}
            <circle cx="20" cy="20" r="18" stroke="#FCD116" strokeWidth="2" fill="none" opacity="0.4" />
            <circle cx="20" cy="20" r="12" stroke="#FCD116" strokeWidth="1.5" fill="none" opacity="0.25" />
            <path
              d="M20 8 C14 12, 12 18, 14 24 C16 28, 20 32, 20 32 C20 32, 24 28, 26 24 C28 18, 26 12, 20 8Z"
              fill="#FCD116"
              opacity="0.9"
            />
            <circle cx="20" cy="20" r="4" fill="white" />
          </svg>
        </div>
        <div className="brand-text">
          <span className="brand-name">
            Mboa-<span>FloodWatch</span>
          </span>
          <span className="navbar-subtitle">Surveillance Satellite des Inondations</span>
        </div>
      </a>

      <div className="navbar-center">
        <div className="navbar-status">
          <span className="status-dot" />
          Sentinel-1 Actif
        </div>
      </div>

      <div className="navbar-actions">
        <button
          className="btn-nav btn-nav-ghost"
          onClick={() => window.open("https://github.com/mlklynch/mboa-floodwatch", "_blank")}
        >
          GitHub
        </button>
        <button className="btn-nav btn-nav-yellow" onClick={onSubscribeClick}>
          S&apos;inscrire aux Alertes
        </button>
      </div>
    </nav>
  );
}

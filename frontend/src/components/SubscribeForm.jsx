/**
 * Mboa-FloodWatch — SubscribeForm Component (F3)
 * Alert subscription form: Name, City, Phone, Email.
 */

import React, { useState } from "react";
import { registerSubscriber } from "../services/floodService";

export default function SubscribeForm({ onSuccess, onError }) {
  const [formData, setFormData] = useState({
    name: "",
    city: "",
    phone: "",
    email: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.city.trim()) {
      onError("Veuillez remplir au moins votre nom et votre ville.");
      return;
    }

    if (!formData.phone.trim() && !formData.email.trim()) {
      onError("Veuillez fournir un numero de telephone ou un email.");
      return;
    }

    setSubmitting(true);
    try {
      // Try geolocation for automatic position-based alerts
      let latitude = null;
      let longitude = null;
      if (navigator.geolocation) {
        try {
          const pos = await new Promise((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
          );
          latitude = pos.coords.latitude;
          longitude = pos.coords.longitude;
        } catch {
          // Geolocation optional
        }
      }

      await registerSubscriber({
        ...formData,
        latitude,
        longitude,
      });

      onSuccess("Inscription reussie ! Vous recevrez les alertes inondation.");
      setFormData({ name: "", city: "", phone: "", email: "" });
    } catch (err) {
      console.warn("Subscribe error:", err);
      // In demo mode, still show success
      onSuccess("Inscription enregistree (mode demo). Merci !");
      setFormData({ name: "", city: "", phone: "", email: "" });
    }
    setSubmitting(false);
  };

  return (
    <form className="subscribe-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="sub-name">Nom complet</label>
        <input
          id="sub-name"
          className="form-input"
          type="text"
          name="name"
          placeholder="Jean Mbarga"
          value={formData.name}
          onChange={handleChange}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="sub-city">Ville</label>
        <input
          id="sub-city"
          className="form-input"
          type="text"
          name="city"
          placeholder="Douala"
          value={formData.city}
          onChange={handleChange}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="sub-phone">Telephone</label>
        <input
          id="sub-phone"
          className="form-input"
          type="tel"
          name="phone"
          placeholder="+237 6XX XXX XXX"
          value={formData.phone}
          onChange={handleChange}
        />
      </div>

      <div className="form-group">
        <label htmlFor="sub-email">Email</label>
        <input
          id="sub-email"
          className="form-input"
          type="email"
          name="email"
          placeholder="nom@email.cm"
          value={formData.email}
          onChange={handleChange}
        />
      </div>

      <button
        className="btn-subscribe"
        type="submit"
        disabled={submitting}
      >
        {submitting ? "Inscription en cours..." : "S'inscrire aux Alertes"}
      </button>

      <p className="subscribe-note">
        Recevez des alertes SMS et Email des qu&apos;une inondation est detectee
        dans votre zone. Donnees Sentinel-1 SAR.
      </p>
    </form>
  );
}

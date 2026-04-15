import React, { useState } from "react";
import { findSubscriberByCredentials } from "../services/authStorage";

export default function LoginForm({ onSuccess, onError, onAuthenticated }) {
  const [credentials, setCredentials] = useState({ email: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCredentials((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!credentials.email.trim() && !credentials.phone.trim()) {
      onError("Veuillez saisir votre email ou votre telephone pour vous connecter.");
      return;
    }

    setSubmitting(true);
    try {
      const subscriber = findSubscriberByCredentials({
        email: credentials.email,
        phone: credentials.phone,
      });

      if (!subscriber) {
        onError("Utilisateur introuvable. Verifiez vos informations ou inscrivez-vous aux alertes.");
        setSubmitting(false);
        return;
      }

      onSuccess(`Bienvenue de retour, ${subscriber.name} !`);
      onAuthenticated?.(subscriber);
      setCredentials({ email: "", phone: "" });
    } catch (err) {
      console.warn("Login error:", err);
      onError("Erreur lors de la connexion. Merci de reessayer.");
    }
    setSubmitting(false);
  };

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          className="form-input"
          type="email"
          name="email"
          placeholder="nom@email.cm"
          value={credentials.email}
          onChange={handleChange}
        />
      </div>

      <div className="form-group">
        <label htmlFor="login-phone">Telephone</label>
        <input
          id="login-phone"
          className="form-input"
          type="tel"
          name="phone"
          placeholder="+237 6XX XXX XXX"
          value={credentials.phone}
          onChange={handleChange}
        />
      </div>

      <button className="btn-login" type="submit" disabled={submitting}>
        {submitting ? "Connexion..." : "Se connecter"}
      </button>
    </form>
  );
}

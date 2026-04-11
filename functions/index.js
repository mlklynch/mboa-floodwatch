/**
 * Mboa-FloodWatch — Firebase Cloud Functions
 * Logique d'alerte : SMS (Twilio) + Email (Nodemailer)
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const turf = require("@turf/turf");
const twilio = require("twilio");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = admin.firestore(); // Initialisation manquante corrigée

// ─── CONFIGURATION SÉCURISÉE (Anti-crash local) ───────────────────────────────
const config = functions.config();

const TWILIO_SID   = (config.twilio && config.twilio.sid)   ? config.twilio.sid   : "";
const TWILIO_TOKEN = (config.twilio && config.twilio.token) ? config.twilio.token : "";
const TWILIO_FROM  = (config.twilio && config.twilio.from)  ? config.twilio.from  : "";
const SMTP_USER    = (config.smtp   && config.smtp.user)    ? config.smtp.user    : "";
const SMTP_PASS    = (config.smtp   && config.smtp.pass)    ? config.smtp.pass    : "";

// Initialisation conditionnelle des clients
let twilioClient;
if (TWILIO_SID && TWILIO_TOKEN) {
    twilioClient = new twilio(TWILIO_SID, TWILIO_TOKEN);
}

let transporter;
if (SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: SMTP_USER, pass: SMTP_PASS }
    });
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const RISK_LABELS = {
  1: { fr: "Vigilance",  emoji: "🟡", color: "#FCD116" },
  2: { fr: "Alerte",     emoji: "🟠", color: "#FF8C00" },
  3: { fr: "Critique",   emoji: "🔴", color: "#CE1126" },
};

function buildSmsMessage(city, riskLabel, eventDate) {
  return (
    `🌊 MBOA-FLOODWATCH | Alerte Inondation\n` +
    `Ville : ${city}\n` +
    `Niveau : ${riskLabel.emoji} ${riskLabel.fr.toUpperCase()}\n` +
    `Date : ${eventDate}\n` +
    `Évitez les zones basses. Restez informé sur mboa-floodwatch.cm`
  );
}

function buildEmailHtml(userName, city, riskLevel, riskLabel, eventDate) {
  return `
  <!DOCTYPE html>
  <html lang="fr">
  <head><meta charset="UTF-8"/><style>
      body { font-family: sans-serif; background: #f4f4f4; padding: 20px; }
      .card { background: #fff; border-radius: 12px; max-width: 500px; margin: auto; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,.1); }
      .header { background: ${riskLabel.color}; padding: 20px; text-align: center; color: #fff; }
      .body { padding: 25px; }
      .btn { display:block; background:#007A5E; color:#fff; text-align:center; padding:12px; border-radius:8px; text-decoration:none; margin-top:15px; }
  </style></head>
  <body>
    <div class="card">
      <div class="header"><h1>${riskLabel.emoji} ALERTE INONDATION</h1></div>
      <div class="body">
        <p>Bonjour <strong>${userName}</strong>,</p>
        <p>📍 Ville : <strong>${city}</strong><br>⚠️ Niveau : <strong>${riskLabel.fr.toUpperCase()}</strong><br>📅 Date : <strong>${eventDate}</strong></p>
        <p style="color:#CE1126;">Restez à distance des zones basses.</p>
        <a class="btn" href="https://mboa-floodwatch.cm/carte">Voir la carte →</a>
      </div>
    </div>
  </body></html>`;
}

// ─── DÉCLENCHEUR : ENVOI DES ALERTES ─────────────────────────────────────────

exports.onNewFloodEvent = functions.firestore
  .document("flood_events/{eventId}")
  .onCreate(async (snap, context) => {
    const event = snap.data();
    const eventId = context.params.eventId;
    functions.logger.info(`🌊 Analyse de l'événement : ${eventId}`);

    const polygonsSnap = await snap.ref.collection("polygons").get();
    const polygons = polygonsSnap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      geometry: JSON.parse(d.data().geometry)
    }));

    if (polygons.length === 0) return null;

    const usersSnap = await db.collection("subscribers").get();
    const notifications = [];

    for (const userDoc of usersSnap.docs) {
      const user = userDoc.data();
      if (!user.longitude || !user.latitude) continue;

      const userPoint = turf.point([user.longitude, user.latitude]);
      let maxRisk = 0;

      for (const polygon of polygons) {
        try {
          if (turf.booleanPointInPolygon(userPoint, turf.feature(polygon.geometry))) {
            if (polygon.risk_level > maxRisk) maxRisk = polygon.risk_level;
          }
        } catch (e) { continue; }
      }

      if (maxRisk === 0) continue;

      const riskLabel = RISK_LABELS[maxRisk];
      const eventDate = new Date(event.after_date).toLocaleDateString("fr-FR", {
        day: "numeric", month: "long", year: "numeric"
      });

      // SMS
      if (user.phone && twilioClient) {
        notifications.push(
          twilioClient.messages.create({
            body: buildSmsMessage(user.city, riskLabel, eventDate),
            from: TWILIO_FROM,
            to: user.phone
          }).catch(e => functions.logger.error("Erreur SMS", e))
        );
      }

      // Email
      if (user.email && transporter) {
        notifications.push(
          transporter.sendMail({
            from: `"Mboa-FloodWatch" <${SMTP_USER}>`,
            to: user.email,
            subject: `${riskLabel.emoji} Alerte Inondation — ${user.city}`,
            html: buildEmailHtml(user.name, user.city, maxRisk, riskLabel, eventDate)
          }).catch(e => functions.logger.error("Erreur Email", e))
        );
      }
    }

    return Promise.all(notifications);
  });

// ─── APPEL HTTPS : INSCRIPTION ────────────────────────────────────────────────

exports.registerSubscriber = functions.https.onCall(async (data, context) => {
  const { name, city, phone, email, latitude, longitude } = data;
  if (!name || !city) throw new functions.https.HttpsError("invalid-argument", "Champs manquants");

  const docRef = await db.collection("subscribers").add({
    name, city, phone: phone || null, email: email || null,
    latitude: latitude || null, longitude: longitude || null,
    registered_at: admin.firestore.FieldValue.serverTimestamp(),
    active: true
  });

  return { status: "success", id: docRef.id };
});
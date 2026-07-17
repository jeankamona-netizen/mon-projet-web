// =====================================================================
// Journal d'audit — enregistrement centralisé des actions utilisateurs.
// journaliser() n'échoue JAMAIS le flux appelant : toute erreur d'écriture
// est avalée (l'audit ne doit pas casser une connexion ou un encaissement).
// =====================================================================
const pool = require('../database');

// Extrait l'adresse IP du client (derrière le proxy Render/Vercel si présent).
function ipDeRequete(req) {
  if (!req) return '';
  const xf = req.headers && req.headers['x-forwarded-for'];
  return (xf ? String(xf).split(',')[0].trim() : req.ip || '') || '';
}

async function journaliser({ role, utilisateur, identifiant, action, details, ip } = {}) {
  try {
    await pool.query(
      `INSERT INTO journal_audit (role, utilisateur, identifiant, action, details, ip)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        (role || '').slice(0, 30),
        (utilisateur || '').slice(0, 200),
        (identifiant || '').slice(0, 120),
        (action || '').slice(0, 120),
        (details || '').slice(0, 500),
        (ip || '').slice(0, 60),
      ]
    );
  } catch (e) {
    console.warn('⚠️ Journal audit non écrit :', e.message);
  }
}

// Décrit l'acteur d'une requête authentifiée à partir du JWT décodé posé par
// les middlewares (req.utilisateur pour finance/budget, req.admin pour l'admin).
function acteurDeReq(req) {
  const c = (req && (req.utilisateur || req.admin)) || {};
  const role = c.role || '';
  const identifiant = c.matricule || c.user || (c.agent_id != null ? String(c.agent_id) : '');
  const utilisateur = c.nom || c.user || identifiant;
  return { role, utilisateur, identifiant };
}

module.exports = { journaliser, ipDeRequete, acteurDeReq };

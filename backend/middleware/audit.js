const pool = require('../database');

const METHODES_TRACEES = ['POST', 'PUT', 'PATCH', 'DELETE'];

// Journalise automatiquement toute action admin qui modifie des données
// (déclenché après l'envoi de la réponse, ne ralentit pas la requête).
function journaliserActionsAdmin(req, res, next) {
  if (METHODES_TRACEES.includes(req.method)) {
    res.on('finish', () => {
      if (!req.admin || res.statusCode >= 400) return;
      pool.query(
        'INSERT INTO audit_log (admin_user, methode, chemin, statut_http) VALUES (?, ?, ?, ?)',
        [req.admin.user, req.method, req.originalUrl, res.statusCode]
      ).catch(err => console.error('Erreur journalisation audit:', err.message));
    });
  }
  next();
}

module.exports = { journaliserActionsAdmin };

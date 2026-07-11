const jwt = require('jsonwebtoken');

// =====================
// PROTECTION DES ROUTES ADMIN — vérifie un JWT valide dans le header Authorization
// =====================
function requireAdmin(req, res, next) {
  const entete = req.headers.authorization || '';
  const token = entete.startsWith('Bearer ') ? entete.slice(7) : null;

  if (!token) {
    return res.status(401).json({ erreur: 'Authentification requise.' });
  }

  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ erreur: 'Session invalide ou expirée, veuillez vous reconnecter.' });
  }
}

module.exports = { requireAdmin };

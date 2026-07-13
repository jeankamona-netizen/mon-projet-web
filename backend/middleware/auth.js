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
    const charge = jwt.verify(token, process.env.JWT_SECRET);
    // Un JWT valide ne suffit pas : seul le rôle 'admin' est autorisé ici
    // (la caisse possède aussi un JWT signé, mais n'a pas accès aux routes admin).
    if (charge.role !== 'admin') {
      return res.status(403).json({ erreur: 'Accès réservé à l\'administration.' });
    }
    req.admin = charge;
    next();
  } catch {
    return res.status(401).json({ erreur: 'Session invalide ou expirée, veuillez vous reconnecter.' });
  }
}

// Fabrique un middleware qui n'accepte qu'une liste de rôles donnée.
function exigerRoles(rolesAutorises, messageRefus) {
  return function (req, res, next) {
    const entete = req.headers.authorization || '';
    const token = entete.startsWith('Bearer ') ? entete.slice(7) : null;
    if (!token) return res.status(401).json({ erreur: 'Authentification requise.' });
    try {
      const charge = jwt.verify(token, process.env.JWT_SECRET);
      if (!rolesAutorises.includes(charge.role)) {
        return res.status(403).json({ erreur: messageRefus });
      }
      req.utilisateur = charge;
      next();
    } catch {
      return res.status(401).json({ erreur: 'Session invalide ou expirée, veuillez vous reconnecter.' });
    }
  };
}

// Consultation des finances : caisse, administrateur du budget, admin.
const requireFinance  = exigerRoles(['admin', 'caisse', 'budget'], 'Accès réservé au personnel des finances.');
// Opérations d'écriture (encaissement, barème des frais) : caissier et admin
// uniquement — l'administrateur du budget (role 'budget') est en lecture
// seule (voir estLectureSeule() côté frontend caisse.js).
const requireCaissier = exigerRoles(['admin', 'caisse'], 'Accès réservé à la caisse.');

module.exports = { requireAdmin, requireFinance, requireCaissier };

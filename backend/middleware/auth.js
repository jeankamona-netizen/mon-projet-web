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
// Barème des frais attendus : fixé par l'administrateur du budget (et l'admin) ;
// la caisse (caissier) est en lecture seule.
const requireBudget   = exigerRoles(['admin', 'budget'], 'Réservé à l\'administrateur du budget.');

// Espace décanal (doyen / vice-doyen) : mêmes pouvoirs que l'admin sur le
// périmètre pédagogique (vue d'ensemble, notes, horaires, programme,
// attributions, années, facultés/filières, annonces) — mais AUCUN accès à la
// gestion des inscrits, aux agents, aux messages/newsletter ni au journal
// d'audit, qui restent protégés par requireAdmin strict.
const requireAdminOuDoyen = exigerRoles(['admin', 'doyen'], 'Accès réservé à l\'administration et au décanat.');

// Gestion des inscrits : la caisse ET l'administrateur du budget peuvent, comme
// l'admin, inscrire/modifier/supprimer des étudiants (mais PAS réinitialiser un
// mot de passe ni imprimer un bulletin, qui restent en requireAdmin). Lecture
// de la liste ouverte à l'admin, au décanat (scopé à sa faculté), à la caisse
// et à l'administrateur du budget.
const requireGestionInscrits  = exigerRoles(['admin', 'caisse', 'budget'], 'Accès réservé à l\'administration et aux finances.');
const requireInscritsLecture  = exigerRoles(['admin', 'doyen', 'caisse', 'budget'], 'Accès réservé à l\'administration, au décanat et aux finances.');

// Libre-service d'un compte agent (profil / mot de passe) : tout agent connecté
// — caissier, administrateur du budget OU doyen/vice-doyen — sur SON PROPRE
// compte (borné en aval par le contrôle memeAgent).
const requireCompteAgent = exigerRoles(['admin', 'caisse', 'budget', 'doyen'], 'Authentification requise.');

// Faculté de rattachement du demandeur SI c'est un doyen/vice-doyen (rôle
// 'doyen'), sinon null. Les handlers ouverts au décanat s'en servent pour
// restreindre lecture ET écriture à la seule faculté du doyen. L'admin (rôle
// 'admin') n'est jamais restreint → retourne null. Le middleware pose la charge
// JWT sur req.utilisateur (exigerRoles) ; requireAdmin la pose sur req.admin.
function faculteDuDoyen(req) {
  const u = req.utilisateur || req.admin;
  return u && u.role === 'doyen' ? (u.faculte || null) : null;
}

module.exports = { requireAdmin, requireFinance, requireCaissier, requireBudget, requireAdminOuDoyen, requireGestionInscrits, requireInscritsLecture, requireCompteAgent, faculteDuDoyen };

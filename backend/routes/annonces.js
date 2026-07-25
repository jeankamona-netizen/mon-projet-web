const express = require('express');
const router = express.Router();
const pool = require('../database');
// Partager des informations (annonces, événements, communiqués) : ouvert à
// l'admin ET au décanat (doyen / vice-doyen).
const { requireAdminOuDoyen: requireAdmin, faculteDuDoyen } = require('../middleware/auth');
const { journaliser, ipDeRequete, acteurDeReq } = require('../models/audit');
const { envoyerAnnonceNewsletter } = require('../mailer');
const upload = require('../upload');

// Un doyen ne publie/modifie que des annonces ciblant SA faculté.
async function annonceDansFaculte(id, facDoyen) {
  if (!facDoyen) return true;
  const [[a]] = await pool.query('SELECT cible_faculte FROM annonce WHERE id = ?', [id]);
  return !!a && a.cible_faculte === facDoyen;
}

// « Non en règle avec les frais » : l'étudiant doit encore de l'argent pour SON
// année en cours (total du barème faculté+promotion+niveau+année > total versé).
// Sert au groupe dynamique 'etudiant_non_regle' des communiqués de la caisse.
async function etudiantDoitFrais(matricule) {
  const [[e]] = await pool.query(
    'SELECT faculte, promotion, niveau, annee_academique FROM etudiant WHERE id = ?', [matricule]
  );
  if (!e) return false;
  const [[bareme]] = await pool.query(
    'SELECT SUM(montant) AS total FROM frais_scolarite WHERE faculte = ? AND promotion = ? AND niveau = ? AND annee_academique = ?',
    [e.faculte, e.promotion, e.niveau, e.annee_academique]
  );
  const attendu = bareme && bareme.total !== null ? Number(bareme.total) : null;
  if (attendu === null || attendu <= 0) return false; // barème inconnu → on ne présume rien
  const [[p]] = await pool.query(
    'SELECT COALESCE(SUM(montant),0) AS total FROM paiement WHERE etudiant_id = ? AND annee_academique = ?',
    [matricule, e.annee_academique]
  );
  return Number(p.total) < attendu;
}

// ===== POST /api/annonces/image — téléverser l'image d'un événement (admin) =====
// L'image est choisie sur le disque de l'utilisateur (input type=file), envoyée
// en multipart et enregistrée dans frontend/uploads. On renvoie son chemin
// relatif (uploads/xxx) que le formulaire stocke ensuite dans annonce.image.
router.post('/image', requireAdmin, upload.single('image'), upload.verifierContenuFichiers, (req, res) => {
  if (!req.file) return res.status(400).json({ erreur: "Aucune image reçue." });
  res.status(201).json({ chemin: 'uploads/' + req.file.filename });
});

// ===== GET /api/annonces — toutes les annonces (avec filtres type/actif/faculté) =====
router.get('/', async (req, res) => {
  try {
    const { type, actif, faculte, role, matricule } = req.query;

    let sql = 'SELECT * FROM annonce WHERE 1=1';
    const params = [];

    if (type) { sql += ' AND type = ?'; params.push(type); }
    if (actif !== undefined) { sql += ' AND actif = ?'; params.push(actif === 'true' ? 1 : 0); }
    // faculte fourni → annonces visibles par tous (cible_faculte NULL) OU ciblant cette faculté
    if (faculte) { sql += ' AND (cible_faculte IS NULL OR cible_faculte = ?)'; params.push(faculte); }
    // role fourni (communiqués) → destinés à ce rôle OU à « tous ». Si le
    // destinataire fournit son matricule, il reçoit AUSSI les communiqués qui lui
    // sont personnellement adressés (cible_matricule) ; les messages individuels
    // d'autrui restent invisibles (cible_matricule IS NULL pour les diffusions).
    if (role) {
      const clauses = ["(cible_matricule IS NULL AND (cible_role = 'tous' OR cible_role = ?))"];
      params.push(role);
      if (matricule) { clauses.push('cible_matricule = ?'); params.push(matricule); }
      // Groupe dynamique « étudiants non en règle » : visible seulement si CET
      // étudiant doit encore des frais.
      if (role === 'etudiant' && matricule && await etudiantDoitFrais(matricule)) {
        clauses.push("(cible_matricule IS NULL AND cible_role = 'etudiant_non_regle')");
      }
      sql += ' AND (' + clauses.join(' OR ') + ')';
    }

    sql += ' ORDER BY date_annonce DESC';

    const [annonces] = await pool.query(sql, params);
    res.json(annonces);
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la récupération des annonces." });
  }
});

// ===== POST /api/annonces — créer une annonce =====
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { type, titre, description, date_annonce, icone, image, actif, cible_faculte, cible_role } = req.body;

    if (!type || !titre || !description || !date_annonce) {
      return res.status(400).json({ erreur: "Champs obligatoires manquants." });
    }
    // Un doyen ne peut cibler que sa faculté (le ciblage est forcé, quel que
    // soit ce que le client envoie).
    const facDoyen = faculteDuDoyen(req);
    // Le décanat ne publie PAS d'annonces/événements publics : uniquement des
    // communiqués internes (réservé à l'administration côté public).
    if (facDoyen && type !== 'communique') {
      return res.status(403).json({ erreur: "Le décanat ne peut publier que des communiqués internes." });
    }
    const cibleFaculteFinale = facDoyen || cible_faculte || null;
    const emetteur = (req.utilisateur && req.utilisateur.role) || 'admin';

    const [resultat] = await pool.query(
      'INSERT INTO annonce (type, titre, description, date_annonce, icone, image, actif, cible_faculte, cible_role, cible_matricule, emetteur) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [type, titre, description, date_annonce, icone || '📢', image || '', actif !== false, cibleFaculteFinale, cible_role || null, req.body.cible_matricule || null, emetteur]
    );

    journaliser({ ...acteurDeReq(req), action: 'Publication annonce', details: `${type} · ${titre}`, ip: ipDeRequete(req) });

    // Diffusion NEWSLETTER : une ANNONCE ou un ÉVÉNEMENT « à tous » (aucune
    // faculté ni rôle ciblés) et actif est envoyé par email à TOUS les abonnés.
    // (Les communiqués, internes à un rôle, ne partent PAS aux abonnés publics.)
    // Envoi en arrière-plan (ne bloque pas la réponse) ; erreurs seulement loguées.
    const estPublique = type === 'annonce' || type === 'evenement';
    const versTous = actif !== false && estPublique && !cibleFaculteFinale && (!cible_role || cible_role === 'tous');
    if (versTous) {
      pool.query('SELECT email FROM newsletter_abonne')
        .then(([abonnes]) => {
          const emails = abonnes.map(a => a.email).filter(Boolean);
          if (!emails.length) return;
          return envoyerAnnonceNewsletter(emails, { type, titre, description, date_annonce })
            .then(n => console.log(`📧 Newsletter : « ${titre} » envoyée à ${n} abonné(s).`));
        })
        .catch(err => console.error('⚠️ Envoi newsletter (annonce à tous) :', err.message));
    }

    res.status(201).json({ message: "Annonce publiée avec succès.", id: resultat.insertId, newsletter: versTous });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la publication." });
  }
});

// ===== PUT /api/annonces/:id — modifier =====
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { type, titre, description, date_annonce, icone, image, actif, cible_faculte, cible_role } = req.body;
    const facDoyen = faculteDuDoyen(req);
    // Décanat : uniquement des communiqués de SA faculté (les siens et ceux de
    // son binôme doyen/vice-doyen). Pas d'annonces publiques, pas les communiqués
    // de l'admin (cible_faculte NULL) ni ceux d'une autre faculté.
    if (facDoyen && type !== 'communique') {
      return res.status(403).json({ erreur: "Le décanat ne peut modifier que des communiqués internes." });
    }
    if (!await annonceDansFaculte(req.params.id, facDoyen)) {
      return res.status(403).json({ erreur: "Ce communiqué ne relève pas de votre faculté." });
    }
    const cibleFaculteFinale = facDoyen || cible_faculte || null;

    await pool.query(
      'UPDATE annonce SET type=?, titre=?, description=?, date_annonce=?, icone=?, image=?, actif=?, cible_faculte=?, cible_role=? WHERE id=?',
      [type, titre, description, date_annonce, icone, image, actif, cibleFaculteFinale, cible_role || null, req.params.id]
    );

    journaliser({ ...acteurDeReq(req), action: 'Modification annonce', details: `${titre || ''} (#${req.params.id})`.trim(), ip: ipDeRequete(req) });
    res.json({ message: "Annonce modifiée avec succès." });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la modification." });
  }
});

// ===== PATCH /api/annonces/:id/toggle — activer/désactiver =====
router.patch('/:id/toggle', requireAdmin, async (req, res) => {
  try {
    if (!await annonceDansFaculte(req.params.id, faculteDuDoyen(req))) {
      return res.status(403).json({ erreur: "Cette annonce ne concerne pas votre faculté." });
    }
    const [lignes] = await pool.query('SELECT actif FROM annonce WHERE id = ?', [req.params.id]);

    if (lignes.length === 0) {
      return res.status(404).json({ erreur: "Annonce non trouvée." });
    }

    const nouveauStatut = !lignes[0].actif;
    await pool.query('UPDATE annonce SET actif = ? WHERE id = ?', [nouveauStatut, req.params.id]);

    res.json({ message: "Statut mis à jour.", actif: nouveauStatut });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors du changement de statut." });
  }
});

// ===== DELETE /api/annonces/:id =====
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    if (!await annonceDansFaculte(req.params.id, faculteDuDoyen(req))) {
      return res.status(403).json({ erreur: "Cette annonce ne concerne pas votre faculté." });
    }
    const [[an]] = await pool.query('SELECT titre FROM annonce WHERE id = ?', [req.params.id]);
    await pool.query('DELETE FROM annonce WHERE id = ?', [req.params.id]);
    journaliser({ ...acteurDeReq(req), action: 'Suppression annonce', details: an ? an.titre : `Annonce #${req.params.id}`, ip: ipDeRequete(req) });
    res.json({ message: "Annonce supprimée." });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la suppression." });
  }
});

module.exports = router;
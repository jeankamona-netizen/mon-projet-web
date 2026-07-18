const express = require('express');
const router = express.Router();
const pool = require('../database');
// Partager des informations (annonces, événements, communiqués) : ouvert à
// l'admin ET au décanat (doyen / vice-doyen).
const { requireAdminOuDoyen: requireAdmin, faculteDuDoyen } = require('../middleware/auth');
const { journaliser, ipDeRequete, acteurDeReq } = require('../models/audit');
const upload = require('../upload');

// Un doyen ne publie/modifie que des annonces ciblant SA faculté.
async function annonceDansFaculte(id, facDoyen) {
  if (!facDoyen) return true;
  const [[a]] = await pool.query('SELECT cible_faculte FROM annonce WHERE id = ?', [id]);
  return !!a && a.cible_faculte === facDoyen;
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
    const { type, actif, faculte, role } = req.query;

    let sql = 'SELECT * FROM annonce WHERE 1=1';
    const params = [];

    if (type) { sql += ' AND type = ?'; params.push(type); }
    if (actif !== undefined) { sql += ' AND actif = ?'; params.push(actif === 'true' ? 1 : 0); }
    // faculte fourni → annonces visibles par tous (cible_faculte NULL) OU ciblant cette faculté
    if (faculte) { sql += ' AND (cible_faculte IS NULL OR cible_faculte = ?)'; params.push(faculte); }
    // role fourni (communiqués) → destinés à ce rôle OU à « tous »
    if (role) { sql += " AND (cible_role = 'tous' OR cible_role = ?)"; params.push(role); }

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
    const cibleFaculteFinale = facDoyen || cible_faculte || null;

    const [resultat] = await pool.query(
      'INSERT INTO annonce (type, titre, description, date_annonce, icone, image, actif, cible_faculte, cible_role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [type, titre, description, date_annonce, icone || '📢', image || '', actif !== false, cibleFaculteFinale, cible_role || null]
    );

    journaliser({ ...acteurDeReq(req), action: 'Publication annonce', details: `${type} · ${titre}`, ip: ipDeRequete(req) });
    res.status(201).json({ message: "Annonce publiée avec succès.", id: resultat.insertId });
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
    if (!await annonceDansFaculte(req.params.id, facDoyen)) {
      return res.status(403).json({ erreur: "Cette annonce ne concerne pas votre faculté." });
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
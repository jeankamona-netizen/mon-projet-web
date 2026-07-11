const express = require('express');
const router = express.Router();
const pool = require('../database');
const { requireAdmin } = require('../middleware/auth');

// Toutes les routes d'inscription aux cours sont réservées à l'admin
router.use(requireAdmin);

// ===== GET /api/inscriptions/cours/:coursId — étudiants inscrits à un cours =====
router.get('/cours/:coursId', async (req, res) => {
  try {
    const [etudiants] = await pool.query(`
      SELECT e.id, e.nom, e.postnom, e.prenom, e.promotion, e.faculte
      FROM inscription_cours ic
      JOIN etudiant e ON e.id = ic.etudiant_id
      WHERE ic.cours_id = ?
      ORDER BY e.nom, e.prenom
    `, [req.params.coursId]);
    res.json(etudiants);
  } catch (erreur) {
    res.status(500).json({ erreur: erreur.message });
  }
});

// ===== POST /api/inscriptions — inscrire un étudiant précis à un cours =====
router.post('/', async (req, res) => {
  const { etudiant_id, cours_id } = req.body;
  if (!etudiant_id || !cours_id) {
    return res.status(400).json({ erreur: 'Étudiant et cours sont obligatoires.' });
  }
  try {
    await pool.query(
      'INSERT IGNORE INTO inscription_cours (etudiant_id, cours_id) VALUES (?, ?)',
      [etudiant_id, cours_id]
    );
    res.status(201).json({ message: 'Étudiant inscrit au cours.' });
  } catch (erreur) {
    res.status(500).json({ erreur: erreur.message });
  }
});

// ===== POST /api/inscriptions/bulk — inscrire en masse les étudiants d'un cours =====
// Se base sur les champs structurés du cours (faculté + niveau + filière éventuelle),
// pas sur la chaîne "promotion" — évite les faux "aucun étudiant trouvé" dus à un
// format de promotion qui ne correspond pas exactement.
router.post('/bulk', async (req, res) => {
  const { cours_id } = req.body;
  if (!cours_id) {
    return res.status(400).json({ erreur: 'Le cours est obligatoire.' });
  }
  try {
    const [[cours]] = await pool.query(
      'SELECT faculte, niveau, filiere_id, annee_academique FROM cours WHERE id = ?',
      [cours_id]
    );
    if (!cours) return res.status(404).json({ erreur: 'Cours introuvable.' });
    if (!cours.faculte || !cours.niveau) {
      return res.status(400).json({ erreur: 'Ce cours n\'a pas de faculté/niveau défini — impossible d\'inscrire automatiquement.' });
    }

    let sql = 'SELECT id FROM etudiant WHERE faculte = ? AND niveau = ? AND annee_academique = ?';
    const params = [cours.faculte, cours.niveau, cours.annee_academique];
    if (cours.filiere_id) {
      sql += ' AND filiere_id = ?';
      params.push(cours.filiere_id);
    }

    const [etudiants] = await pool.query(sql, params);
    if (etudiants.length === 0) {
      return res.status(404).json({ erreur: `Aucun étudiant trouvé pour ${cours.faculte} — ${cours.niveau} (${cours.annee_academique}). Vérifiez que des étudiants existent avec cette faculté/niveau/année exacts.` });
    }

    const valeurs = etudiants.map(e => [e.id, cours_id]);
    await pool.query('INSERT IGNORE INTO inscription_cours (etudiant_id, cours_id) VALUES ?', [valeurs]);

    res.status(201).json({ message: `${etudiants.length} étudiant(s) inscrit(s) au cours.`, total: etudiants.length });
  } catch (erreur) {
    res.status(500).json({ erreur: erreur.message });
  }
});

// ===== POST /api/inscriptions/bulk-multi — inscrire les étudiants de plusieurs facultés/niveaux à la fois =====
// Permet à un même cours d'être suivi par plusieurs promotions/facultés en même
// temps (ex. un cours commun suivi par L1 Informatique + L1 Théologie + L1
// Éducation + L1 Économie simultanément).
router.post('/bulk-multi', async (req, res) => {
  const { cours_id, groupes } = req.body;
  if (!cours_id || !Array.isArray(groupes) || groupes.length === 0) {
    return res.status(400).json({ erreur: 'Le cours et au moins un groupe (faculté + niveau) sont obligatoires.' });
  }
  if (groupes.some(g => !g.faculte || !g.niveau)) {
    return res.status(400).json({ erreur: 'Chaque groupe doit préciser une faculté et un niveau.' });
  }
  try {
    const [[cours]] = await pool.query('SELECT annee_academique FROM cours WHERE id = ?', [cours_id]);
    if (!cours) return res.status(404).json({ erreur: 'Cours introuvable.' });

    const conditions = groupes.map(() => '(faculte = ? AND niveau = ?)').join(' OR ');
    const params = [];
    groupes.forEach(g => { params.push(g.faculte, g.niveau); });
    params.push(cours.annee_academique);

    const [etudiants] = await pool.query(
      `SELECT id FROM etudiant WHERE (${conditions}) AND annee_academique = ?`,
      params
    );

    if (etudiants.length === 0) {
      return res.status(404).json({ erreur: `Aucun étudiant trouvé pour les facultés/niveaux sélectionnés (${cours.annee_academique}).` });
    }

    const valeurs = etudiants.map(e => [e.id, cours_id]);
    await pool.query('INSERT IGNORE INTO inscription_cours (etudiant_id, cours_id) VALUES ?', [valeurs]);

    res.status(201).json({ message: `${etudiants.length} étudiant(s) inscrit(s) au cours.`, total: etudiants.length });
  } catch (erreur) {
    res.status(500).json({ erreur: erreur.message });
  }
});

// ===== DELETE /api/inscriptions/:etudiantId/:coursId — désinscrire =====
router.delete('/:etudiantId/:coursId', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM inscription_cours WHERE etudiant_id = ? AND cours_id = ?',
      [req.params.etudiantId, req.params.coursId]
    );
    res.json({ message: 'Étudiant désinscrit du cours.' });
  } catch (erreur) {
    res.status(500).json({ erreur: erreur.message });
  }
});

module.exports = router;

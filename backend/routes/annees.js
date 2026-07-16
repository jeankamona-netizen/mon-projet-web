const express = require('express');
const router = express.Router();
const pool = require('../database');
const { requireAdmin } = require('../middleware/auth');

// ===== GET /api/annees — liste des années académiques (pour alimenter les menus) =====
router.get('/', async (req, res) => {
  try {
    const [annees] = await pool.query(
      'SELECT id, libelle, est_courante FROM annee_academique ORDER BY libelle'
    );
    res.json(annees);
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la récupération des années." });
  }
});

// ===== POST /api/annees — ajouter une année académique (admin) =====
router.post('/', requireAdmin, async (req, res) => {
  const { libelle } = req.body;
  if (!/^\d{4}-\d{4}$/.test(libelle || '')) {
    return res.status(400).json({ erreur: 'Format attendu : AAAA-AAAA (ex. 2036-2037).' });
  }
  try {
    await pool.query('INSERT IGNORE INTO annee_academique (libelle) VALUES (?)', [libelle]);
    res.status(201).json({ message: 'Année ajoutée.' });
  } catch (erreur) {
    res.status(500).json({ erreur: erreur.message });
  }
});

// ===== PATCH /api/annees/:libelle/courante — définir l'année courante (admin) =====
router.patch('/:libelle/courante', requireAdmin, async (req, res) => {
  try {
    const [r] = await pool.query('UPDATE annee_academique SET est_courante = 1 WHERE libelle = ?', [req.params.libelle]);
    if (r.affectedRows === 0) return res.status(404).json({ erreur: 'Année introuvable.' });
    await pool.query('UPDATE annee_academique SET est_courante = 0 WHERE libelle != ?', [req.params.libelle]);
    res.json({ message: 'Année courante définie.' });
  } catch (erreur) {
    res.status(500).json({ erreur: erreur.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const pool = require('../database');
const { requireAdmin } = require('../middleware/auth');

// Toutes les routes paiements (gestion) sont réservées à l'admin
router.use(requireAdmin);

// ===== GET /api/paiements/etudiant/:id — historique des paiements d'un étudiant =====
router.get('/etudiant/:id', async (req, res) => {
  try {
    const [paiements] = await pool.query(
      'SELECT * FROM paiement WHERE etudiant_id = ? ORDER BY date_paiement DESC',
      [req.params.id]
    );
    res.json(paiements);
  } catch (erreur) {
    res.status(500).json({ erreur: erreur.message });
  }
});

// ===== POST /api/paiements — enregistrer un paiement =====
router.post('/', async (req, res) => {
  const { etudiant_id, montant, date_paiement, mode_paiement, reference, commentaire, annee_academique } = req.body;

  if (!etudiant_id || !montant || !date_paiement) {
    return res.status(400).json({ erreur: 'Étudiant, montant et date sont obligatoires.' });
  }
  if (montant <= 0) {
    return res.status(400).json({ erreur: 'Le montant doit être positif.' });
  }

  try {
    const [r] = await pool.query(
      `INSERT INTO paiement (etudiant_id, montant, date_paiement, mode_paiement, reference, commentaire, annee_academique)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [etudiant_id, montant, date_paiement, mode_paiement || null, reference || null, commentaire || null, annee_academique || null]
    );
    res.status(201).json({ message: 'Paiement enregistré.', id: r.insertId });
  } catch (erreur) {
    res.status(500).json({ erreur: erreur.message });
  }
});

// ===== DELETE /api/paiements/:id — supprimer un paiement =====
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM paiement WHERE id = ?', [req.params.id]);
    res.json({ message: 'Paiement supprimé.' });
  } catch (erreur) {
    res.status(500).json({ erreur: erreur.message });
  }
});

module.exports = router;

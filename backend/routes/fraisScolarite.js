const express = require('express');
const router = express.Router();
const pool = require('../database');
const { requireFinance, requireCaissier } = require('../middleware/auth');

// ===== GET /api/frais-scolarite — barème des frais attendus (consultation) =====
// Accessible à l'admin et à la caisse (elle en a besoin pour calculer le solde).
router.get('/', requireFinance, async (req, res) => {
  try {
    const { annee } = req.query;
    let sql = 'SELECT id, niveau, annee_academique, montant FROM frais_scolarite WHERE 1=1';
    const params = [];
    if (annee) { sql += ' AND annee_academique = ?'; params.push(annee); }
    sql += ' ORDER BY annee_academique DESC, FIELD(niveau, "Pré-U","L1","L2","L3","M1","M2","D1","D2")';
    const [lignes] = await pool.query(sql, params);
    res.json(lignes.map(l => ({ ...l, montant: Number(l.montant) })));
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la récupération du barème." });
  }
});

// ===== POST /api/frais-scolarite — définir/mettre à jour le montant attendu
// pour un niveau et une année (admin ou caisse — le budget est lecture seule) =====
router.post('/', requireCaissier, async (req, res) => {
  const { niveau, annee_academique, montant } = req.body;
  if (!niveau || !annee_academique || montant === undefined || isNaN(montant) || Number(montant) < 0) {
    return res.status(400).json({ erreur: "Niveau, année académique et montant (≥ 0) sont obligatoires." });
  }
  try {
    await pool.query(
      `INSERT INTO frais_scolarite (niveau, annee_academique, montant) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE montant = VALUES(montant)`,
      [niveau, annee_academique, montant]
    );
    res.status(201).json({ message: "Barème enregistré." });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de l'enregistrement du barème." });
  }
});

// ===== DELETE /api/frais-scolarite/:id (admin ou caisse) =====
router.delete('/:id', requireCaissier, async (req, res) => {
  try {
    await pool.query('DELETE FROM frais_scolarite WHERE id = ?', [req.params.id]);
    res.json({ message: "Ligne de barème supprimée." });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la suppression." });
  }
});

module.exports = router;

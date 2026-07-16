const express = require('express');
const router = express.Router();
const pool = require('../database');
const { requireFinance, requireBudget } = require('../middleware/auth');

// ===== GET /api/frais-scolarite — barème des frais attendus (consultation) =====
// Accessible à l'admin, à l'administrateur du budget ET à la caisse (elle en a
// besoin pour calculer le solde). Filtres : année, faculté, promotion.
router.get('/', requireFinance, async (req, res) => {
  try {
    const { annee, faculte, promotion } = req.query;
    let sql = 'SELECT id, faculte, promotion, annee_academique, montant FROM frais_scolarite WHERE 1=1';
    const params = [];
    if (annee)     { sql += ' AND annee_academique = ?'; params.push(annee); }
    if (faculte)   { sql += ' AND faculte = ?'; params.push(faculte); }
    if (promotion) { sql += ' AND promotion = ?'; params.push(promotion); }
    sql += ' ORDER BY annee_academique DESC, faculte, promotion';
    const [lignes] = await pool.query(sql, params);
    res.json(lignes.map(l => ({ ...l, montant: Number(l.montant) })));
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la récupération du barème." });
  }
});

// ===== POST /api/frais-scolarite — définir/mettre à jour le montant attendu =====
// Réservé à l'administrateur du budget (et à l'admin) ; la caisse est en lecture seule.
router.post('/', requireBudget, async (req, res) => {
  const { faculte, promotion, annee_academique, montant } = req.body;
  if (!faculte || !promotion || !annee_academique || montant === undefined || isNaN(montant) || Number(montant) < 0) {
    return res.status(400).json({ erreur: "Faculté, promotion, année académique et montant (≥ 0) sont obligatoires." });
  }
  try {
    await pool.query(
      `INSERT INTO frais_scolarite (faculte, promotion, annee_academique, montant) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE montant = VALUES(montant)`,
      [faculte, promotion, annee_academique, montant]
    );
    res.status(201).json({ message: "Barème enregistré." });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de l'enregistrement du barème." });
  }
});

// ===== DELETE /api/frais-scolarite/:id (administrateur du budget / admin) =====
router.delete('/:id', requireBudget, async (req, res) => {
  try {
    await pool.query('DELETE FROM frais_scolarite WHERE id = ?', [req.params.id]);
    res.json({ message: "Ligne de barème supprimée." });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la suppression." });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const pool = require('../database');
const { requireAdmin } = require('../middleware/auth');

// Tout le journal d'audit est réservé à l'administration.
router.use(requireAdmin);

// ===== GET /api/audit — liste des actions (filtres : date, rôle) =====
// date = AAAA-MM-JJ (actions de ce jour) ; role = admin|budget|caisse|professeur|etudiant.
router.get('/', async (req, res) => {
  try {
    const { date, role } = req.query;
    let sql = `SELECT id, date_action, role, utilisateur, identifiant, action, details, ip
               FROM journal_audit WHERE 1=1`;
    const params = [];
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      sql += ' AND DATE(date_action) = ?';
      params.push(date);
    }
    if (role) { sql += ' AND role = ?'; params.push(role); }
    sql += ' ORDER BY date_action DESC, id DESC LIMIT 1000';
    const [lignes] = await pool.query(sql, params);
    res.json(lignes);
  } catch (erreur) {
    console.error('Erreur journal audit:', erreur);
    res.status(500).json({ erreur: "Erreur lors de la récupération du journal d'audit." });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const pool = require('../database');
// Ajouter → Filières (rattachées aux facultés) : ouvert à l'admin ET au décanat.
const { requireAdminOuDoyen: requireAdmin } = require('../middleware/auth');
const { journaliser, ipDeRequete, acteurDeReq } = require('../models/audit');

// Gestion des filières (= promotions) rattachées à une faculté. Réservé à
// l'administrateur.

// ===== POST /api/filieres — créer une filière dans une faculté =====
router.post('/', requireAdmin, async (req, res) => {
  const nom = (req.body.nom || '').trim();
  const faculteId = req.body.faculte_id;
  if (!faculteId || !nom) return res.status(400).json({ erreur: "La faculté et le nom de la filière sont obligatoires." });
  try {
    const [fac] = await pool.query('SELECT id FROM faculte WHERE id = ?', [faculteId]);
    if (fac.length === 0) return res.status(404).json({ erreur: "Faculté introuvable." });
    const [r] = await pool.query('INSERT INTO filiere (nom, faculte_id) VALUES (?, ?)', [nom, faculteId]);
    journaliser({ ...acteurDeReq(req), action: 'Création filière', details: `${nom} (faculté #${faculteId})`, ip: ipDeRequete(req) });
    res.status(201).json({ id: r.insertId, nom, faculte_id: faculteId });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la création de la filière." });
  }
});

// ===== PUT /api/filieres/:id — renommer une filière =====
router.put('/:id', requireAdmin, async (req, res) => {
  const nom = (req.body.nom || '').trim();
  if (!nom) return res.status(400).json({ erreur: "Le nom de la filière est obligatoire." });
  try {
    await pool.query('UPDATE filiere SET nom = ? WHERE id = ?', [nom, req.params.id]);
    journaliser({ ...acteurDeReq(req), action: 'Modification filière', details: nom, ip: ipDeRequete(req) });
    res.json({ message: "Filière mise à jour." });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la mise à jour de la filière." });
  }
});

// ===== DELETE /api/filieres/:id — supprimer une filière =====
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM filiere WHERE id = ?', [req.params.id]);
    journaliser({ ...acteurDeReq(req), action: 'Suppression filière', details: `Filière #${req.params.id}`, ip: ipDeRequete(req) });
    res.json({ message: "Filière supprimée." });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la suppression de la filière." });
  }
});

module.exports = router;

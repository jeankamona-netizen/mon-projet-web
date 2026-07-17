const express = require('express');
const router = express.Router();
const pool = require('../database');
const { requireFinance, requireBudget } = require('../middleware/auth');
const { journaliser, ipDeRequete, acteurDeReq } = require('../models/audit');

// ===== GET /api/frais-scolarite — barème des frais attendus (consultation) =====
// Accessible à l'admin, à l'administrateur du budget ET à la caisse (elle en a
// besoin pour calculer le solde). Filtres : année, faculté, promotion.
router.get('/', requireFinance, async (req, res) => {
  try {
    const { annee, faculte, promotion, niveau } = req.query;
    let sql = 'SELECT id, faculte, promotion, niveau, annee_academique, rubrique, montant FROM frais_scolarite WHERE 1=1';
    const params = [];
    if (annee)     { sql += ' AND annee_academique = ?'; params.push(annee); }
    if (faculte)   { sql += ' AND faculte = ?'; params.push(faculte); }
    if (promotion) { sql += ' AND promotion = ?'; params.push(promotion); }
    if (niveau)    { sql += ' AND niveau = ?'; params.push(niveau); }
    sql += ' ORDER BY annee_academique DESC, faculte, promotion, niveau, rubrique';
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
  const { faculte, niveau, annee_academique, montant } = req.body;
  // La filière (promotion) est optionnelle : certains niveaux/facultés n'ont
  // pas de filière (ex. Pré-U, licence non subdivisée). On enregistre alors
  // avec « - ».
  const promotion = (req.body.promotion || '').trim() || '-';
  // Rubrique (frais) : chaque niveau peut avoir plusieurs rubriques (carte,
  // frais académiques, labo…), chacune avec son montant.
  const rubrique = (req.body.rubrique || '').trim() || 'Frais académiques';
  if (!faculte || !niveau || !annee_academique || montant === undefined || isNaN(montant) || Number(montant) < 0) {
    return res.status(400).json({ erreur: "Faculté, niveau, année académique et montant (≥ 0) sont obligatoires." });
  }
  try {
    await pool.query(
      `INSERT INTO frais_scolarite (faculte, promotion, niveau, annee_academique, rubrique, montant) VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE montant = VALUES(montant)`,
      [faculte, promotion, niveau, annee_academique, rubrique, montant]
    );
    const { role, utilisateur, identifiant } = acteurDeReq(req);
    journaliser({ role, utilisateur, identifiant, action: 'Barème défini', details: `${faculte} · ${niveau} ${promotion} · ${rubrique} : ${Number(montant).toFixed(2)} $ (${annee_academique})`, ip: ipDeRequete(req) });
    res.status(201).json({ message: "Barème enregistré." });
  } catch (erreur) {
    console.error('Erreur enregistrement barème:', erreur);
    // Détail SQL renvoyé au client (route admin/budget uniquement) pour
    // diagnostiquer un éventuel schéma de production non migré.
    res.status(500).json({ erreur: "Erreur barème : " + (erreur.sqlMessage || erreur.message) });
  }
});

// ===== DELETE /api/frais-scolarite/:id (administrateur du budget / admin) =====
router.delete('/:id', requireBudget, async (req, res) => {
  try {
    await pool.query('DELETE FROM frais_scolarite WHERE id = ?', [req.params.id]);
    const { role, utilisateur, identifiant } = acteurDeReq(req);
    journaliser({ role, utilisateur, identifiant, action: 'Barème supprimé', details: `Ligne de barème #${req.params.id} supprimée`, ip: ipDeRequete(req) });
    res.json({ message: "Ligne de barème supprimée." });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la suppression." });
  }
});

module.exports = router;

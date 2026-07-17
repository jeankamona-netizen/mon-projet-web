const express = require('express');
const router = express.Router();
const pool = require('../database');
const { requireFinance } = require('../middleware/auth');
const { journaliser, ipDeRequete, acteurDeReq } = require('../models/audit');

// ===== GET /api/paiements/etudiant/:id — historique des paiements d'un étudiant =====
// Consultation ouverte aux finances (caisse, budget, admin).
router.get('/etudiant/:id', requireFinance, async (req, res) => {
  try {
    const [paiements] = await pool.query(
      `SELECT p.*, a.noms AS agent_noms, a.prenom AS agent_prenom
       FROM paiement p LEFT JOIN agent a ON p.agent_id = a.id
       WHERE p.etudiant_id = ? ORDER BY p.date_paiement DESC, p.id DESC`,
      [req.params.id]
    );
    res.json(paiements);
  } catch (erreur) {
    res.status(500).json({ erreur: erreur.message });
  }
});

// ===== POST /api/paiements — enregistrer un paiement =====
// Ouvert à la caisse (caissier), à l'administrateur du budget et à l'admin :
// tous peuvent encaisser, modifier, supprimer et imprimer un versement.
router.post('/', requireFinance, async (req, res) => {
  const { etudiant_id, montant, date_paiement, mode_paiement, rubrique, reference, commentaire, annee_academique, niveau } = req.body;

  if (!etudiant_id || !montant || !date_paiement) {
    return res.status(400).json({ erreur: 'Étudiant, montant et date sont obligatoires.' });
  }
  if (montant <= 0) {
    return res.status(400).json({ erreur: 'Le montant doit être positif.' });
  }

  try {
    // agent_id vient du token (caissier connecté), jamais du corps de la requête.
    const agentId = req.utilisateur && req.utilisateur.agent_id ? req.utilisateur.agent_id : null;
    // niveau visé par le versement (celui de l'année réglée, pas le niveau courant).
    const [r] = await pool.query(
      `INSERT INTO paiement (etudiant_id, montant, date_paiement, mode_paiement, rubrique, reference, commentaire, annee_academique, niveau, agent_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [etudiant_id, montant, date_paiement, mode_paiement || null, rubrique || null, reference || null, commentaire || null, annee_academique || null, (niveau || '').trim(), agentId]
    );
    const { role, utilisateur, identifiant } = acteurDeReq(req);
    journaliser({ role, utilisateur, identifiant, action: 'Encaissement', details: `Versement ${Number(montant).toFixed(2)} $ — étudiant ${etudiant_id}${rubrique ? ' · ' + rubrique : ''}`, ip: ipDeRequete(req) });
    res.status(201).json({ message: 'Paiement enregistré.', id: r.insertId });
  } catch (erreur) {
    res.status(500).json({ erreur: erreur.message });
  }
});

// ===== DELETE /api/paiements/:id — supprimer un paiement =====
router.delete('/:id', requireFinance, async (req, res) => {
  try {
    await pool.query('DELETE FROM paiement WHERE id = ?', [req.params.id]);
    const { role, utilisateur, identifiant } = acteurDeReq(req);
    journaliser({ role, utilisateur, identifiant, action: 'Suppression versement', details: `Versement #${req.params.id} supprimé`, ip: ipDeRequete(req) });
    res.json({ message: 'Paiement supprimé.' });
  } catch (erreur) {
    res.status(500).json({ erreur: erreur.message });
  }
});

module.exports = router;

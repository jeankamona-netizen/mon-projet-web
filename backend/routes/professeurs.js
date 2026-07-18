const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../database');
const { requireAdmin } = require('../middleware/auth');
const { journaliser, ipDeRequete, acteurDeReq } = require('../models/audit');

// Toutes les routes professeurs sont réservées à l'admin
router.use(requireAdmin);

function genererMotDePasseTemporaire() {
  return crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, '').slice(0, 12);
}

router.get('/', async (req, res) => {
  try {
    // On ne renvoie jamais le hash du mot de passe au frontend
    const [profs] = await pool.query('SELECT id, nom, prenom, email, telephone, grade FROM professeur ORDER BY nom');
    res.json(profs);
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la récupération des professeurs." });
  }
});

// POST — ajouter un professeur, avec accès à l'espace professeur activé automatiquement
router.post('/', async (req, res) => {
  const { nom, prenom, email, telephone, grade } = req.body;
  if (!nom) return res.status(400).json({ erreur: "Le nom est obligatoire." });

  try {
    const motDePasseTemporaire = genererMotDePasseTemporaire();
    const hash = await bcrypt.hash(motDePasseTemporaire, 10);

    const [r] = await pool.query(
      'INSERT INTO professeur (nom, prenom, email, telephone, grade, mot_de_passe) VALUES (?, ?, ?, ?, ?, ?)',
      [nom, prenom || null, email || null, telephone || null, grade || null, hash]
    );
    journaliser({ ...acteurDeReq(req), action: 'Création professeur', details: `${prenom || ''} ${nom}`.trim() + (email ? ` (${email})` : ''), ip: ipDeRequete(req) });
    res.status(201).json({
      message: "Professeur ajouté.",
      id: r.insertId,
      motDePasseTemporaire
    });
  } catch (erreur) {
    res.status(500).json({ erreur: erreur.message });
  }
});

// PUT — modifier un professeur
router.put('/:id', async (req, res) => {
  const { nom, prenom, email, telephone, grade } = req.body;
  try {
    await pool.query(
      'UPDATE professeur SET nom=?, prenom=?, email=?, telephone=?, grade=? WHERE id=?',
      [nom, prenom || null, email || null, telephone || null, grade || null, req.params.id]
    );
    journaliser({ ...acteurDeReq(req), action: 'Modification professeur', details: `${prenom || ''} ${nom || ''}`.trim() + ` (#${req.params.id})`, ip: ipDeRequete(req) });
    res.json({ message: "Professeur modifié." });
  } catch (erreur) {
    res.status(500).json({ erreur: erreur.message });
  }
});

// DELETE — supprimer un professeur
router.delete('/:id', async (req, res) => {
  try {
    const [[prof]] = await pool.query('SELECT nom, prenom FROM professeur WHERE id = ?', [req.params.id]);
    await pool.query('DELETE FROM professeur WHERE id=?', [req.params.id]);
    journaliser({ ...acteurDeReq(req), action: 'Suppression professeur', details: prof ? `${prof.prenom || ''} ${prof.nom}`.trim() : `Professeur #${req.params.id}`, ip: ipDeRequete(req) });
    res.json({ message: "Professeur supprimé." });
  } catch (erreur) {
    res.status(500).json({ erreur: erreur.message });
  }
});

// POST — réinitialiser le mot de passe d'un professeur (pas d'envoi automatique
// par email pour les professeurs : le mot de passe est renvoyé à l'admin, à
// communiquer lui-même, comme à la création — voir POST / ci-dessus).
router.post('/:id/reinitialiser-mot-de-passe', async (req, res) => {
  try {
    const [profs] = await pool.query('SELECT id FROM professeur WHERE id = ?', [req.params.id]);
    if (profs.length === 0) return res.status(404).json({ erreur: 'Professeur non trouvé.' });

    const motDePasseTemporaire = genererMotDePasseTemporaire();
    const hash = await bcrypt.hash(motDePasseTemporaire, 10);
    await pool.query('UPDATE professeur SET mot_de_passe = ? WHERE id = ?', [hash, req.params.id]);

    journaliser({ ...acteurDeReq(req), action: 'Réinit. mot de passe professeur', details: `Professeur #${req.params.id}`, ip: ipDeRequete(req) });
    res.json({ motDePasseTemporaire });
  } catch (erreur) {
    res.status(500).json({ erreur: erreur.message });
  }
});

module.exports = router;

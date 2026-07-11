const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../database');
const { requireAdmin } = require('../middleware/auth');

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
    res.json({ message: "Professeur modifié." });
  } catch (erreur) {
    res.status(500).json({ erreur: erreur.message });
  }
});

// DELETE — supprimer un professeur
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM professeur WHERE id=?', [req.params.id]);
    res.json({ message: "Professeur supprimé." });
  } catch (erreur) {
    res.status(500).json({ erreur: erreur.message });
  }
});

module.exports = router;

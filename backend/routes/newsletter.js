const express = require('express');
const router = express.Router();
const pool = require('../database');
const { requireAdmin } = require('../middleware/auth');

const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ===== POST /api/newsletter — inscription (public, depuis le site) =====
router.post('/', async (req, res) => {
  const { email } = req.body;
  if (!email || !EMAIL_VALIDE.test(email)) {
    return res.status(400).json({ erreur: 'Adresse email invalide.' });
  }
  try {
    // Déjà inscrit = pas une erreur, on ne révèle pas non plus l'état existant.
    await pool.query('INSERT IGNORE INTO newsletter_abonne (email) VALUES (?)', [email]);
    res.status(201).json({ message: 'Inscription à la newsletter confirmée.' });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de l'inscription." });
  }
});

// ===== GET /api/newsletter — liste des abonnés (admin) =====
router.get('/', requireAdmin, async (req, res) => {
  try {
    const [abonnes] = await pool.query('SELECT id, email, date_inscription FROM newsletter_abonne ORDER BY date_inscription DESC');
    res.json(abonnes);
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la récupération des abonnés." });
  }
});

// ===== DELETE /api/newsletter/:id — désinscription manuelle (admin) =====
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM newsletter_abonne WHERE id = ?', [req.params.id]);
    res.json({ message: 'Abonné retiré.' });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: erreur.message });
  }
});

module.exports = router;

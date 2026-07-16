const express = require('express');
const router = express.Router();
const pool = require('../database');
const { requireAdmin } = require('../middleware/auth');
const { envoyerEmailReponseContact } = require('../mailer');

const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ===== POST /api/contact — envoi d'un message (public, depuis le site) =====
router.post('/', async (req, res) => {
  const { nom, email, sujet, message } = req.body;
  if (!nom || !email || !message) {
    return res.status(400).json({ erreur: 'Nom, email et message sont obligatoires.' });
  }
  if (!EMAIL_VALIDE.test(email)) {
    return res.status(400).json({ erreur: 'Adresse email invalide.' });
  }
  try {
    await pool.query(
      'INSERT INTO message_contact (nom, email, sujet, message) VALUES (?, ?, ?, ?)',
      [nom, email, sujet || null, message]
    );
    res.status(201).json({ message: 'Votre message a bien été envoyé. Nous vous répondrons dans les plus brefs délais.' });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de l'envoi du message." });
  }
});

// ===== GET /api/contact — liste des messages reçus (admin) =====
router.get('/', requireAdmin, async (req, res) => {
  try {
    const [messages] = await pool.query('SELECT * FROM message_contact ORDER BY date_envoi DESC');
    res.json(messages);
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la récupération des messages." });
  }
});

// ===== PATCH /api/contact/:id/lu — marquer comme lu (admin) =====
router.patch('/:id/lu', requireAdmin, async (req, res) => {
  try {
    await pool.query('UPDATE message_contact SET lu = 1 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Message marqué comme lu.' });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: erreur.message });
  }
});

// ===== POST /api/contact/:id/repondre — répondre par email (admin) =====
router.post('/:id/repondre', requireAdmin, async (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ erreur: 'Le message de réponse est obligatoire.' });
  }
  try {
    const [messages] = await pool.query('SELECT * FROM message_contact WHERE id = ?', [req.params.id]);
    if (messages.length === 0) return res.status(404).json({ erreur: 'Message introuvable.' });
    const original = messages[0];

    await envoyerEmailReponseContact(original.email, original.nom, original.sujet, original.message, message.trim());
    await pool.query('UPDATE message_contact SET lu = 1, repondu = 1 WHERE id = ?', [req.params.id]);

    res.json({ message: 'Réponse envoyée.' });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de l'envoi de la réponse." });
  }
});

// ===== DELETE /api/contact/:id (admin) =====
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM message_contact WHERE id = ?', [req.params.id]);
    res.json({ message: 'Message supprimé.' });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: erreur.message });
  }
});

module.exports = router;

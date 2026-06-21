const express = require('express');
const router = express.Router();
const pool = require('../database');

// ===== GET /api/notes — toutes les notes (admin) =====
router.get('/', async (req, res) => {
  try {
    const [notes] = await pool.query(`
      SELECT n.id, n.note, n.session, n.annee_academique,
             e.id AS etudiant_id, e.nom AS nom_etudiant, e.prenom AS prenom_etudiant,
             c.nom AS matiere
      FROM note n
      JOIN etudiant e ON n.etudiant_id = e.id
      JOIN cours c ON n.cours_id = c.id
      ORDER BY n.id DESC
    `);
    res.json(notes);
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la récupération des notes." });
  }
});

// ===== GET /api/notes/etudiant/:id — notes d'un étudiant précis =====
router.get('/etudiant/:id', async (req, res) => {
  try {
    const [notes] = await pool.query(`
      SELECT n.id, n.note, n.session, n.annee_academique, c.nom AS matiere, c.credits
      FROM note n
      JOIN cours c ON n.cours_id = c.id
      WHERE n.etudiant_id = ?
      ORDER BY n.session, c.code
    `, [req.params.id]);
    res.json(notes);
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la récupération des notes." });
  }
});

// ===== POST /api/notes — ajouter une note =====
router.post('/', async (req, res) => {
  try {
    const { etudiant_id, cours_id, note, session, annee_academique } = req.body;

    if (!etudiant_id || !cours_id || note === undefined || !session) {
      return res.status(400).json({ erreur: "Champs obligatoires manquants." });
    }

    if (note < 0 || note > 20) {
      return res.status(400).json({ erreur: "La note doit être comprise entre 0 et 20." });
    }

    const [resultat] = await pool.query(
      'INSERT INTO note (etudiant_id, cours_id, note, session, annee_academique) VALUES (?, ?, ?, ?, ?)',
      [etudiant_id, cours_id, note, session, annee_academique]
    );

    res.status(201).json({ message: "Note ajoutée avec succès.", id: resultat.insertId });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de l'ajout de la note." });
  }
});

// ===== PUT /api/notes/:id — modifier une note =====
router.put('/:id', async (req, res) => {
  try {
    const { note, session, annee_academique } = req.body;

    if (note < 0 || note > 20) {
      return res.status(400).json({ erreur: "La note doit être comprise entre 0 et 20." });
    }

    await pool.query(
      'UPDATE note SET note = ?, session = ?, annee_academique = ? WHERE id = ?',
      [note, session, annee_academique, req.params.id]
    );

    res.json({ message: "Note modifiée avec succès." });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la modification." });
  }
});

// ===== DELETE /api/notes/:id — supprimer une note =====
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM note WHERE id = ?', [req.params.id]);
    res.json({ message: "Note supprimée avec succès." });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la suppression." });
  }
});

module.exports = router;
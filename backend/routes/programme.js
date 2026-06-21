const express = require('express');
const router = express.Router();
const pool = require('../database');

// ===== GET /api/programme — tous les cours (avec filtres) =====
router.get('/', async (req, res) => {
  try {
    const { annee, promotion, semestre } = req.query;

    let sql = 'SELECT * FROM cours WHERE 1=1';
    const params = [];

    if (annee)     { sql += ' AND annee_academique = ?'; params.push(annee); }
    if (promotion) { sql += ' AND promotion = ?'; params.push(promotion); }
    if (semestre)  { sql += ' AND semestre = ?'; params.push(semestre); }

    sql += ' ORDER BY annee_academique DESC, promotion, semestre, code';

    const [cours] = await pool.query(sql, params);
    res.json(cours);
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la récupération du programme." });
  }
});

// ===== POST /api/programme — ajouter un cours au programme =====
router.post('/', async (req, res) => {
  try {
    const { code, nom, promotion, annee_academique, semestre, credits } = req.body;

    if (!code || !nom || !promotion || !annee_academique || !semestre || !credits) {
      return res.status(400).json({ erreur: "Champs obligatoires manquants." });
    }

    const [resultat] = await pool.query(
      'INSERT INTO cours (code, nom, promotion, annee_academique, semestre, credits) VALUES (?, ?, ?, ?, ?, ?)',
      [code.toUpperCase(), nom, promotion, annee_academique, semestre, credits]
    );

    res.status(201).json({ message: "Cours ajouté au programme.", id: resultat.insertId });
  } catch (erreur) {
    if (erreur.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ erreur: "Ce code de cours existe déjà pour cette promotion et année." });
    }
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de l'ajout du cours." });
  }
});

// ===== PUT /api/programme/:id =====
router.put('/:id', async (req, res) => {
  try {
    const { code, nom, promotion, annee_academique, semestre, credits } = req.body;

    await pool.query(
      'UPDATE cours SET code=?, nom=?, promotion=?, annee_academique=?, semestre=?, credits=? WHERE id=?',
      [code.toUpperCase(), nom, promotion, annee_academique, semestre, credits, req.params.id]
    );

    res.json({ message: "Cours modifié avec succès." });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la modification." });
  }
});

// ===== DELETE /api/programme/:id =====
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM cours WHERE id = ?', [req.params.id]);
    res.json({ message: "Cours retiré du programme." });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la suppression." });
  }
});

module.exports = router;
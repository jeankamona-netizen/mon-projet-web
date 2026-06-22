const express = require('express');
const router = express.Router();
const pool = require('../database');

// ===== GET /api/horaires — tous les horaires (avec filtres optionnels) =====
router.get('/', async (req, res) => {
  try {
    const { annee, promotion, jour } = req.query;

    let sql = `
      SELECT h.id, h.promotion, h.annee_academique, h.jour, 
       h.heure_debut, h.heure_fin, h.salle, h.professeur_id,
       c.nom AS cours, p.nom AS professeur
      FROM horaire h
      JOIN cours c ON h.cours_id = c.id
      LEFT JOIN professeur p ON h.professeur_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (annee)      { sql += ' AND h.annee_academique = ?'; params.push(annee); }
    if (promotion)   { sql += ' AND h.promotion = ?'; params.push(promotion); }
    if (jour)        { sql += ' AND h.jour = ?'; params.push(jour); }

    sql += ' ORDER BY h.annee_academique DESC, h.promotion, FIELD(h.jour, "Lundi","Mardi","Mercredi","Jeudi","Vendredi"), h.heure_debut';

    const [horaires] = await pool.query(sql, params);
    res.json(horaires);
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la récupération des horaires." });
  }
});

// ===== POST /api/horaires — ajouter un cours à l'horaire =====
router.post('/', async (req, res) => {
  try {
    const { promotion, annee_academique, jour, heure_debut, heure_fin, cours_id, professeur_id, salle } = req.body;

    if (!promotion || !annee_academique || !jour || !heure_debut || !heure_fin || !cours_id || !salle) {
      return res.status(400).json({ erreur: "Champs obligatoires manquants." });
    }

    // Vérification de conflit de salle (même année, jour, salle, créneau qui chevauche)
    const [conflitsSalle] = await pool.query(`
      SELECT * FROM horaire 
      WHERE annee_academique = ? AND jour = ? AND salle = ?
      AND heure_debut < ? AND heure_fin > ?
    `, [annee_academique, jour, salle, heure_fin, heure_debut]);

    if (conflitsSalle.length > 0) {
      return res.status(409).json({ erreur: `Conflit : la salle ${salle} est déjà occupée à ce créneau.` });
    }

    // Vérification de conflit de promotion
    const [conflitsPromo] = await pool.query(`
      SELECT * FROM horaire 
      WHERE annee_academique = ? AND promotion = ? AND jour = ?
      AND heure_debut < ? AND heure_fin > ?
    `, [annee_academique, promotion, jour, heure_fin, heure_debut]);

    if (conflitsPromo.length > 0) {
      return res.status(409).json({ erreur: `Conflit : ${promotion} a déjà cours à ce créneau.` });
    }

    const [resultat] = await pool.query(
      'INSERT INTO horaire (promotion, annee_academique, jour, heure_debut, heure_fin, cours_id, professeur_id, salle) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [promotion, annee_academique, jour, heure_debut, heure_fin, cours_id, professeur_id || null, salle]
    );

    res.status(201).json({ message: "Cours ajouté à l'horaire.", id: resultat.insertId });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de l'ajout du cours." });
  }
});

// ===== PUT /api/horaires/:id — modifier un cours de l'horaire =====
router.put('/:id', async (req, res) => {
  try {
    const { promotion, annee_academique, jour, heure_debut, heure_fin, cours_id, professeur_id, salle } = req.body;

    await pool.query(
      `UPDATE horaire SET promotion=?, annee_academique=?, jour=?, heure_debut=?, heure_fin=?, cours_id=?, professeur_id=?, salle=? WHERE id=?`,
      [promotion, annee_academique, jour, heure_debut, heure_fin, cours_id, professeur_id || null, salle, req.params.id]
    );

    res.json({ message: "Horaire modifié avec succès." });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la modification." });
  }
});

// ===== DELETE /api/horaires/:id =====
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM horaire WHERE id = ?', [req.params.id]);
    res.json({ message: "Cours supprimé de l'horaire." });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la suppression." });
  }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const pool = require('../database');
const { requireAdmin } = require('../middleware/auth');

// Toutes les routes horaires sont réservées à l'admin (gestion des cours/salles)
router.use(requireAdmin);

// ===== GET /api/horaires — tous les horaires (avec filtres optionnels) =====
router.get('/', async (req, res) => {
  try {
    const { annee, niveau, jour } = req.query;

    let sql = `
      SELECT h.id, h.promotion, h.annee_academique, h.jour, h.date_debut,
       h.heure_debut, h.heure_fin, h.salle, h.professeur_id, h.cours_id,
       c.nom AS cours, p.nom AS professeur, p.prenom AS professeur_prenom,
       (SELECT COUNT(*) FROM inscription_cours ic WHERE ic.cours_id = c.id) AS nb_etudiants
      FROM horaire h
      JOIN cours c ON h.cours_id = c.id
      LEFT JOIN professeur p ON h.professeur_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (annee)  { sql += ' AND h.annee_academique = ?'; params.push(annee); }
    // h.promotion est un libellé composé "NIVEAU LIBELLÉ" (ex. "L1 Gestion
    // Informatique") : pas de colonne niveau dédiée sur horaire, d'où le préfixe.
    if (niveau) { sql += ' AND h.promotion LIKE ?'; params.push(niveau + ' %'); }
    if (jour)   { sql += ' AND h.jour = ?'; params.push(jour); }

    sql += ' ORDER BY h.annee_academique DESC, h.promotion, FIELD(h.jour, "Lundi","Mardi","Mercredi","Jeudi","Vendredi"), h.heure_debut';

    const [horaires] = await pool.query(sql, params);
    res.json(horaires);
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la récupération des horaires." });
  }
});

// La contrainte porte sur la DATE précise (date_debut) et l'heure exacte
// (heure/minute), pas sur le jour de la semaine : deux créneaux du même
// jour (ex. tous les vendredis) mais à des dates différentes ne sont pas en
// conflit. Un même cours peut être donné en même temps, dans la même
// salle, à plusieurs promotions/facultés réunies (cours commun) : ce n'est
// pas un conflit. Un professeur peut être programmé plusieurs fois dans la
// même journée à des heures différentes ; en revanche, il ne peut jamais
// être aligné sur deux cours différents (classes différentes) qui se
// chevauchent à la même date et à la même heure — et une salle non plus.
async function trouverConflits({ date_debut, heure_debut, heure_fin, promotion, salle, professeur_id, cours_id, excluId }) {
  const conflits = {};

  // Conflit de salle : même date, créneau qui chevauche, cours différent
  // (le même cours dans la même salle au même horaire = cours commun, pas un conflit)
  let sqlSalle = `
    SELECT * FROM horaire
    WHERE date_debut = ? AND salle = ?
    AND heure_debut < ? AND heure_fin > ?
    AND cours_id != ?
  `;
  const paramsSalle = [date_debut, salle, heure_fin, heure_debut, cours_id];
  if (excluId) { sqlSalle += ' AND id != ?'; paramsSalle.push(excluId); }
  const [conflitsSalle] = await pool.query(sqlSalle, paramsSalle);
  if (conflitsSalle.length > 0) conflits.salle = `Conflit : la salle ${salle} est déjà occupée à cette date et à cette heure.`;

  // Conflit de promotion : la même promotion ne peut pas avoir deux cours à la même date et à la même heure
  let sqlPromo = `
    SELECT * FROM horaire
    WHERE date_debut = ? AND promotion = ?
    AND heure_debut < ? AND heure_fin > ?
  `;
  const paramsPromo = [date_debut, promotion, heure_fin, heure_debut];
  if (excluId) { sqlPromo += ' AND id != ?'; paramsPromo.push(excluId); }
  const [conflitsPromo] = await pool.query(sqlPromo, paramsPromo);
  if (conflitsPromo.length > 0) conflits.promotion = `Conflit : ${promotion} a déjà cours à cette date et à cette heure.`;

  // Conflit de professeur : occupé à la même date et à la même heure sur un
  // cours différent (classe différente), même dans une autre salle.
  // L'exception « cours commun » (même cours_id, même salle) reste
  // autorisée. Programmer le même professeur à des heures différentes le
  // même jour n'est PAS un conflit (heure_debut/heure_fin filtrent déjà ça).
  if (professeur_id) {
    let sqlProf = `
      SELECT h.*, c.nom AS cours_nom FROM horaire h
      JOIN cours c ON h.cours_id = c.id
      WHERE h.professeur_id = ? AND h.date_debut = ?
      AND h.heure_debut < ? AND h.heure_fin > ?
      AND NOT (h.cours_id = ? AND h.salle = ?)
    `;
    const paramsProf = [professeur_id, date_debut, heure_fin, heure_debut, cours_id, salle];
    if (excluId) { sqlProf += ' AND h.id != ?'; paramsProf.push(excluId); }
    const [conflitsProf] = await pool.query(sqlProf, paramsProf);
    if (conflitsProf.length > 0) {
      const c = conflitsProf[0];
      conflits.professeur = `Conflit : ce professeur donne déjà « ${c.cours_nom} » (${c.promotion}, salle ${c.salle}) à cette date et à cette heure.`;
    }
  }

  // Conflit étudiant : un étudiant inscrit à ce cours ne doit pas se
  // retrouver avec deux cours différents qui se chevauchent à la même date
  // et à la même heure — même s'ils appartiennent à des promotions
  // différentes (ex. cours au choix suivi en plus de sa promotion).
  let sqlEtudiant = `
    SELECT e.nom, e.prenom, c2.nom AS autre_cours
    FROM inscription_cours ic1
    JOIN etudiant e ON e.id = ic1.etudiant_id
    JOIN inscription_cours ic2 ON ic2.etudiant_id = ic1.etudiant_id AND ic2.cours_id != ic1.cours_id
    JOIN horaire h2 ON h2.cours_id = ic2.cours_id
      AND h2.date_debut = ? AND h2.heure_debut < ? AND h2.heure_fin > ?
    JOIN cours c2 ON c2.id = ic2.cours_id
    WHERE ic1.cours_id = ?
  `;
  const paramsEtudiant = [date_debut, heure_fin, heure_debut, cours_id];
  if (excluId) { sqlEtudiant += ' AND h2.id != ?'; paramsEtudiant.push(excluId); }
  sqlEtudiant += ' LIMIT 1';
  const [conflitsEtudiant] = await pool.query(sqlEtudiant, paramsEtudiant);
  if (conflitsEtudiant.length > 0) {
    const e = conflitsEtudiant[0];
    conflits.etudiant = `Conflit : l'étudiant ${e.nom} ${e.prenom} suit déjà « ${e.autre_cours} » à cette date et à cette heure.`;
  }

  return conflits;
}

// ===== POST /api/horaires — ajouter un cours à l'horaire =====
router.post('/', async (req, res) => {
  try {
    const { promotion, annee_academique, jour, date_debut, heure_debut, heure_fin, cours_id, professeur_id, salle } = req.body;

    if (!promotion || !annee_academique || !jour || !date_debut || !heure_debut || !heure_fin || !cours_id || !salle) {
      return res.status(400).json({ erreur: "Champs obligatoires manquants." });
    }

    const conflits = await trouverConflits({ date_debut, heure_debut, heure_fin, promotion, salle, professeur_id, cours_id });
    const premierConflit = conflits.salle || conflits.professeur || conflits.promotion || conflits.etudiant;
    if (premierConflit) {
      return res.status(409).json({ erreur: premierConflit });
    }

    const [resultat] = await pool.query(
      'INSERT INTO horaire (promotion, annee_academique, jour, date_debut, heure_debut, heure_fin, cours_id, professeur_id, salle) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [promotion, annee_academique, jour, date_debut, heure_debut, heure_fin, cours_id, professeur_id || null, salle]
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
    const { promotion, annee_academique, jour, date_debut, heure_debut, heure_fin, cours_id, professeur_id, salle } = req.body;

    if (!promotion || !annee_academique || !jour || !date_debut || !heure_debut || !heure_fin || !cours_id || !salle) {
      return res.status(400).json({ erreur: "Champs obligatoires manquants." });
    }

    const conflits = await trouverConflits({ date_debut, heure_debut, heure_fin, promotion, salle, professeur_id, cours_id, excluId: req.params.id });
    const premierConflit = conflits.salle || conflits.professeur || conflits.promotion || conflits.etudiant;
    if (premierConflit) {
      return res.status(409).json({ erreur: premierConflit });
    }

    await pool.query(
      `UPDATE horaire SET promotion=?, annee_academique=?, jour=?, date_debut=?, heure_debut=?, heure_fin=?, cours_id=?, professeur_id=?, salle=? WHERE id=?`,
      [promotion, annee_academique, jour, date_debut, heure_debut, heure_fin, cours_id, professeur_id || null, salle, req.params.id]
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

// PATCH /api/horaires/:id — attribuer un professeur seulement
router.patch('/:id', async (req, res) => {
  const { professeur_id } = req.body;
  try {
    if (professeur_id) {
      const [lignes] = await pool.query('SELECT * FROM horaire WHERE id = ?', [req.params.id]);
      if (lignes.length === 0) return res.status(404).json({ erreur: "Créneau introuvable." });
      const h = lignes[0];

      const conflits = await trouverConflits({
        date_debut: h.date_debut, heure_debut: h.heure_debut, heure_fin: h.heure_fin,
        promotion: h.promotion, salle: h.salle, professeur_id, cours_id: h.cours_id, excluId: req.params.id
      });
      if (conflits.professeur) return res.status(409).json({ erreur: conflits.professeur });
    }

    await pool.query(
      'UPDATE horaire SET professeur_id = ? WHERE id = ?',
      [professeur_id, req.params.id]
    );
    res.json({ message: "Professeur attribué avec succès." });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: erreur.message });
  }
});
module.exports = router;
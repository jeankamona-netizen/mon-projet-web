const express = require('express');
const router = express.Router();
const pool = require('../database');
// Toutes les routes horaires sont ouvertes à l'admin ET au décanat (doyen /
// vice-doyen) : on importe requireAdminOuDoyen sous l'alias requireAdmin.
const { requireAdminOuDoyen: requireAdmin, faculteDuDoyen } = require('../middleware/auth');
const { journaliser, ipDeRequete, acteurDeReq } = require('../models/audit');

// Vérifie qu'un cours appartient à la faculté du doyen (ou est un cours commun,
// faculte NULL) avant toute écriture d'horaire. Renvoie true si autorisé.
async function coursDansPerimetre(coursId, facDoyen) {
  if (!facDoyen) return true; // admin : aucun périmètre
  const [[c]] = await pool.query('SELECT faculte FROM cours WHERE id = ?', [coursId]);
  return !!c && (c.faculte === null || c.faculte === facDoyen);
}

// Toutes les routes horaires sont réservées à l'admin (gestion des cours/salles)
router.use(requireAdmin);

// ===== GET /api/horaires — tous les horaires (avec filtres optionnels) =====
router.get('/', async (req, res) => {
  try {
    const { annee, niveau, jour, faculte } = req.query;

    let sql = `
      SELECT h.id, h.promotion, h.annee_academique, h.jour, h.date_debut,
       h.heure_debut, h.heure_fin, h.salle, h.professeur_id, h.cours_id,
       c.nom AS cours, (c.faculte IS NULL) AS cours_commun,
       p.nom AS professeur, p.prenom AS professeur_prenom, p.grade,
       (SELECT COUNT(*) FROM inscription_cours ic WHERE ic.cours_id = c.id) AS nb_etudiants,
       -- Session commune à intitulés différents : même professeur, même
       -- salle, même date/heure, mais un cours_id différent (physiquement
       -- une seule séance enregistrée sous plusieurs intitulés/facultés).
       (SELECT GROUP_CONCAT(DISTINCT c2.nom SEPARATOR ' · ')
        FROM horaire h2 JOIN cours c2 ON c2.id = h2.cours_id
        WHERE h2.id != h.id AND h2.professeur_id = h.professeur_id AND h2.salle = h.salle
          AND h2.date_debut = h.date_debut AND h2.heure_debut = h.heure_debut AND h2.heure_fin = h.heure_fin
          AND h2.cours_id != h.cours_id AND h.professeur_id IS NOT NULL
       ) AS autres_intitules_session
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
    // Un doyen est verrouillé sur SA faculté (il ne peut pas élargir via le
    // paramètre) ; l'admin utilise le filtre facultatif du client. Les cours
    // communs (c.faculte NULL) restent visibles dans les deux cas.
    const faculteEffective = faculteDuDoyen(req) || faculte;
    if (faculteEffective){ sql += ' AND (c.faculte = ? OR c.faculte IS NULL)'; params.push(faculteEffective); }

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
//
// Exception « session commune à intitulés différents » : si le MÊME
// professeur donne cours dans la MÊME salle à la même date/heure, c'est
// physiquement une seule et même séance — même si elle est enregistrée sous
// plusieurs cours_id différents (intitulés distincts par faculté, ex. cours
// mutualisé entre Économie et Informatique). Ce n'est donc jamais un conflit
// de salle ni de professeur, quel que soit le cours_id ou la faculté.
async function trouverConflits({ date_debut, heure_debut, heure_fin, promotion, salle, professeur_id, cours_id, excluId }) {
  const conflits = {};

  // Conflit de salle : même date, créneau qui chevauche, cours différent ET
  // professeur différent (même cours, ou même professeur = session commune,
  // jamais un conflit).
  let sqlSalle = `
    SELECT * FROM horaire
    WHERE date_debut = ? AND salle = ?
    AND heure_debut < ? AND heure_fin > ?
    AND cours_id != ?
  `;
  const paramsSalle = [date_debut, salle, heure_fin, heure_debut, cours_id];
  if (professeur_id) { sqlSalle += ' AND (professeur_id IS NULL OR professeur_id != ?)'; paramsSalle.push(professeur_id); }
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

  // Conflit de professeur : occupé à la même date et à la même heure dans une
  // AUTRE salle (physiquement impossible). Rester dans la MÊME salle n'est
  // jamais un conflit, même sur un cours_id différent (session commune à
  // intitulés différents, cf. note ci-dessus). Programmer le même professeur
  // à des heures différentes le même jour n'est pas non plus un conflit
  // (heure_debut/heure_fin filtrent déjà ça).
  if (professeur_id) {
    let sqlProf = `
      SELECT h.*, c.nom AS cours_nom FROM horaire h
      JOIN cours c ON h.cours_id = c.id
      WHERE h.professeur_id = ? AND h.date_debut = ?
      AND h.heure_debut < ? AND h.heure_fin > ?
      AND h.salle != ?
    `;
    const paramsProf = [professeur_id, date_debut, heure_fin, heure_debut, salle];
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

    if (!await coursDansPerimetre(cours_id, faculteDuDoyen(req))) {
      return res.status(403).json({ erreur: "Ce cours n'appartient pas à votre faculté." });
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

    journaliser({ ...acteurDeReq(req), action: 'Ajout horaire', details: `${promotion} · ${jour} ${heure_debut}-${heure_fin} · salle ${salle}`, ip: ipDeRequete(req) });
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

    if (!await coursDansPerimetre(cours_id, faculteDuDoyen(req))) {
      return res.status(403).json({ erreur: "Ce cours n'appartient pas à votre faculté." });
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

    journaliser({ ...acteurDeReq(req), action: 'Modification horaire', details: `${promotion} · ${jour} ${heure_debut}-${heure_fin} (#${req.params.id})`, ip: ipDeRequete(req) });
    res.json({ message: "Horaire modifié avec succès." });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la modification." });
  }
});

// ===== DELETE /api/horaires/:id =====
router.delete('/:id', async (req, res) => {
  try {
    const facDoyen = faculteDuDoyen(req);
    if (facDoyen) {
      const [[h]] = await pool.query(
        'SELECT c.faculte FROM horaire h JOIN cours c ON c.id = h.cours_id WHERE h.id = ?', [req.params.id]
      );
      if (h && h.faculte !== null && h.faculte !== facDoyen) {
        return res.status(403).json({ erreur: "Ce créneau n'appartient pas à votre faculté." });
      }
    }
    await pool.query('DELETE FROM horaire WHERE id = ?', [req.params.id]);
    journaliser({ ...acteurDeReq(req), action: 'Suppression horaire', details: `Créneau #${req.params.id}`, ip: ipDeRequete(req) });
    res.json({ message: "Cours supprimé de l'horaire." });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la suppression." });
  }
});
module.exports = router;
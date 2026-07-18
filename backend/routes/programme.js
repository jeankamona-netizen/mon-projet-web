const express = require('express');
const router = express.Router();
const pool = require('../database');
// Programme annuel : ouvert à l'admin ET au décanat (doyen / vice-doyen).
const { requireAdminOuDoyen: requireAdmin } = require('../middleware/auth');
const { inscrireEtudiantsAuCours } = require('../models/inscriptionAuto');
const { journaliser, ipDeRequete, acteurDeReq } = require('../models/audit');

// Abréviations affichées sur le libellé "promotion" d'un cours commun, dans
// cet ordre d'affichage fixe.
const ABREVIATION_FACULTE = [
  ['Sciences Informatiques', 'INFO'],
  ['Sciences Économiques', 'ECO'],
  ['Faculté de Théologie', 'THEO'],
  ["Sciences de l'Éducation & Psychologie", 'SCP'],
];

// Construit le libellé "promotion" d'un cours commun à partir des facultés
// qui ont effectivement des étudiants à ce niveau/année (ex. "L1: INFO, ECO,
// THEO, SCP") — pas un libellé générique "Cours commun".
async function libellePromotionCommun(niveau, annee_academique) {
  const [rows] = await pool.query(
    'SELECT DISTINCT faculte FROM etudiant WHERE niveau = ? AND annee_academique = ? AND faculte IS NOT NULL',
    [niveau, annee_academique]
  );
  const presentes = new Set(rows.map(r => r.faculte));
  const abbrs = ABREVIATION_FACULTE.filter(([nom]) => presentes.has(nom)).map(([, abbr]) => abbr);
  return abbrs.length > 0 ? `${niveau || ''}: ${abbrs.join(', ')}`.trim() : `${niveau || ''} — Cours commun`.trim();
}

// Résout le nom de filière envoyé par le formulaire vers son id réel (scopé à
// la faculté choisie), et construit le libellé de rattachement horaire
// ("L1 Informatique", "L1 Design"...) à partir des champs structurés.
async function resoudreFiliereEtPromotion(niveau, faculte, nomFiliere) {
  let filiere_id = null;
  let libelle = faculte;

  if (nomFiliere) {
    const [[filiere]] = await pool.query(
      'SELECT f.id, f.nom FROM filiere f JOIN faculte fa ON f.faculte_id = fa.id WHERE f.nom = ? AND fa.nom = ?',
      [nomFiliere, faculte]
    );
    if (filiere) { filiere_id = filiere.id; libelle = filiere.nom; }
  }

  const promotion = `${niveau || ''} ${libelle || ''}`.trim();
  return { filiere_id, promotion };
}

// ===== GET /api/programme — tous les cours (avec filtres) =====
router.get('/', async (req, res) => {
  try {
    const { annee, promotion, semestre, faculte, niveau, filiere } = req.query;

    let sql = `
      SELECT c.*, f.nom AS filiere_nom, p.nom AS professeur_nom, p.prenom AS professeur_prenom
      FROM cours c
      LEFT JOIN filiere f ON c.filiere_id = f.id
      LEFT JOIN professeur p ON c.professeur_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (annee)     { sql += ' AND c.annee_academique = ?'; params.push(annee); }
    if (promotion) { sql += ' AND c.promotion = ?'; params.push(promotion); }
    if (semestre)  { sql += ' AND c.semestre = ?'; params.push(semestre); }
    // "TOUTES" = uniquement les cours de tronc commun (faculte NULL), pas tous
    // les cours de toutes les facultés. Sinon, un cours commun reste visible
    // en plus des cours propres à la faculté choisie dans le filtre.
    if (faculte === 'TOUTES') { sql += ' AND c.faculte IS NULL'; }
    else if (faculte)         { sql += ' AND (c.faculte = ? OR c.faculte IS NULL)'; params.push(faculte); }
    if (niveau)    { sql += ' AND c.niveau = ?'; params.push(niveau); }
    // Filière précise choisie, ou cours commun à toute la faculté (filiere_id NULL)
    if (filiere)   { sql += ' AND (f.nom = ? OR c.filiere_id IS NULL)'; params.push(filiere); }

    sql += ' ORDER BY c.annee_academique DESC, c.promotion, c.semestre, c.code';

    const [cours] = await pool.query(sql, params);
    res.json(cours);
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la récupération du programme." });
  }
});

// Crée un cours pour UNE cible (faculté + filière) et inscrit automatiquement
// les étudiants concernés : toute la faculté+niveau si aucune filière précise
// (cours commun, ex. Educit), sinon seulement les étudiants de la filière.
async function creerCoursPourCible(champs, faculte, nomFiliere) {
  const { code, nom, niveau, annee_academique, semestre, credits, cmi, td, tp } = champs;
  const { filiere_id, promotion } = await resoudreFiliereEtPromotion(niveau, faculte, nomFiliere || null);

  const [resultat] = await pool.query(
    'INSERT INTO cours (code, nom, faculte, filiere_id, niveau, promotion, annee_academique, semestre, credits, cmi, td, tp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [code.toUpperCase(), nom, faculte, filiere_id || null, niveau, promotion, annee_academique, semestre, credits, cmi ?? null, td ?? null, tp ?? null]
  );

  let sqlEtudiants = 'SELECT id FROM etudiant WHERE faculte = ? AND niveau = ?';
  const paramsEtudiants = [faculte, niveau];
  if (filiere_id) { sqlEtudiants += ' AND filiere_id = ?'; paramsEtudiants.push(filiere_id); }
  const [etudiantsConcernes] = await pool.query(sqlEtudiants, paramsEtudiants);

  if (etudiantsConcernes.length > 0) {
    const valeurs = etudiantsConcernes.map(e => [e.id, resultat.insertId]);
    await pool.query('INSERT IGNORE INTO inscription_cours (etudiant_id, cours_id) VALUES ?', [valeurs]);
  }

  return { id: resultat.insertId, etudiantsInscrits: etudiantsConcernes.length };
}

// Cours commun : UNE seule fiche partagée (faculte = NULL, filiere_id = NULL,
// promotion générique "<niveau> — Cours commun"), plutôt qu'une fiche par
// faculté ciblée. Un seul horaire suffit donc à le programmer pour tout le
// monde — structurellement impossible d'oublier de programmer une des
// facultés, puisqu'elle n'a plus de fiche séparée à programmer.
// Inscrit TOUS les étudiants du niveau/année (pas seulement les facultés
// cochées à la création) : c'est la même règle que pour tout cours commun
// (faculte NULL = concerne tout le monde à ce niveau, voir inscriptionAuto.js)
// — les cibles ne servent qu'à basculer en mode "cours commun" au moins 2
// facultés sélectionnées.
async function creerCoursCommun(champs) {
  const { code, nom, niveau, annee_academique, semestre, credits, cmi, td, tp } = champs;
  const promotion = await libellePromotionCommun(niveau, annee_academique);

  const [resultat] = await pool.query(
    'INSERT INTO cours (code, nom, faculte, filiere_id, niveau, promotion, annee_academique, semestre, credits, cmi, td, tp) VALUES (?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?)',
    [code.toUpperCase(), nom, niveau, promotion, annee_academique, semestre, credits, cmi ?? null, td ?? null, tp ?? null]
  );
  const coursId = resultat.insertId;

  const etudiantsInscrits = await inscrireEtudiantsAuCours(coursId, null, niveau, null, annee_academique);
  return { id: coursId, etudiantsInscrits };
}

// ===== POST /api/programme — ajouter un cours au programme =====
// Une seule faculté ciblée : fiche dédiée à cette faculté/filière (comportement
// historique, inchangé). Plusieurs facultés ciblées à la fois (champ `cibles`) =
// cours commun : UNE seule fiche partagée pour toutes (voir creerCoursCommun),
// pas une fiche par cible — évite d'oublier de programmer l'horaire de l'une
// d'entre elles.
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { code, nom, faculte, filiere, niveau, annee_academique, semestre, credits, cmi, td, tp, cibles } = req.body;

    if (!code || !nom || !niveau || !annee_academique || !semestre || !credits) {
      return res.status(400).json({ erreur: "Champs obligatoires manquants (code, nom, niveau, année, semestre, crédits)." });
    }

    const listeCibles = ((Array.isArray(cibles) && cibles.length)
      ? cibles
      : (faculte ? [{ faculte, filiere: filiere || null }] : [])
    ).filter(c => c && c.faculte);
    if (!listeCibles.length) {
      return res.status(400).json({ erreur: "Aucune faculté cible sélectionnée." });
    }

    const champs = { code, nom, niveau, annee_academique, semestre, credits, cmi: cmi || null, td: td || null, tp: tp || null };

    if (listeCibles.length === 1) {
      try {
        const r = await creerCoursPourCible(champs, listeCibles[0].faculte, listeCibles[0].filiere);
        journaliser({ ...acteurDeReq(req), action: 'Ajout cours', details: `${code} ${nom} · ${listeCibles[0].faculte} · ${niveau} ${annee_academique}`, ip: ipDeRequete(req) });
        return res.status(201).json({
          message: "Cours ajouté au programme.",
          coursCrees: 1, facultes: 1, etudiantsInscrits: r.etudiantsInscrits, doublons: [], id: r.id
        });
      } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ erreur: "Ce cours existe déjà pour : " + listeCibles[0].faculte + (listeCibles[0].filiere ? ' / ' + listeCibles[0].filiere : '') });
        }
        throw e;
      }
    }

    try {
      const r = await creerCoursCommun(champs);
      journaliser({ ...acteurDeReq(req), action: 'Ajout cours commun', details: `${code} ${nom} · ${niveau} ${annee_academique} · ${listeCibles.length} facultés`, ip: ipDeRequete(req) });
      res.status(201).json({
        message: "Cours commun ajouté au programme.",
        coursCrees: 1, facultes: listeCibles.length, etudiantsInscrits: r.etudiantsInscrits, doublons: [], id: r.id
      });
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ erreur: "Ce cours commun existe déjà pour ce niveau et cette année académique." });
      }
      throw e;
    }
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de l'ajout du cours." });
  }
});

// ===== PUT /api/programme/:id =====
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { code, nom, faculte, filiere, niveau, annee_academique, semestre, credits, cmi, td, tp } = req.body;
    const { filiere_id, promotion } = await resoudreFiliereEtPromotion(niveau, faculte, filiere || null);

    await pool.query(
      'UPDATE cours SET code=?, nom=?, faculte=?, filiere_id=?, niveau=?, promotion=?, annee_academique=?, semestre=?, credits=?, cmi=?, td=?, tp=? WHERE id=?',
      [code.toUpperCase(), nom, faculte, filiere_id || null, niveau, promotion, annee_academique, semestre, credits, cmi || null, td || null, tp || null, req.params.id]
    );

    // Si la cible (faculté/niveau/filière/année) du cours a changé, les
    // étudiants qui y correspondent désormais doivent l'avoir ipso facto.
    await inscrireEtudiantsAuCours(req.params.id, faculte, niveau, filiere_id, annee_academique);

    journaliser({ ...acteurDeReq(req), action: 'Modification cours', details: `${code} ${nom} (#${req.params.id})`, ip: ipDeRequete(req) });
    res.json({ message: "Cours modifié avec succès." });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la modification." });
  }
});

// ===== PATCH /api/programme/:id — attribuer un professeur seulement =====
router.patch('/:id', requireAdmin, async (req, res) => {
  const { professeur_id } = req.body;
  try {
    await pool.query(
      'UPDATE cours SET professeur_id = ? WHERE id = ?',
      [professeur_id || null, req.params.id]
    );
    journaliser({ ...acteurDeReq(req), action: 'Attribution professeur', details: `Cours #${req.params.id} → professeur ${professeur_id || '(retiré)'}`, ip: ipDeRequete(req) });
    res.json({ message: "Professeur attribué avec succès." });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de l'attribution." });
  }
});

// ===== DELETE /api/programme/:id =====
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const [[c]] = await pool.query('SELECT code, nom FROM cours WHERE id = ?', [req.params.id]);
    await pool.query('DELETE FROM cours WHERE id = ?', [req.params.id]);
    journaliser({ ...acteurDeReq(req), action: 'Suppression cours', details: c ? `${c.code} ${c.nom}` : `Cours #${req.params.id}`, ip: ipDeRequete(req) });
    res.json({ message: "Cours retiré du programme." });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la suppression." });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const pool = require('../database');
const { requireAdmin } = require('../middleware/auth');

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
    if (faculte)   { sql += ' AND c.faculte = ?'; params.push(faculte); }
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
  const { code, nom, niveau, annee_academique, semestre, credits } = champs;
  const { filiere_id, promotion } = await resoudreFiliereEtPromotion(niveau, faculte, nomFiliere || null);

  const [resultat] = await pool.query(
    'INSERT INTO cours (code, nom, faculte, filiere_id, niveau, promotion, annee_academique, semestre, credits) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [code.toUpperCase(), nom, faculte, filiere_id || null, niveau, promotion, annee_academique, semestre, credits]
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

// ===== POST /api/programme — ajouter un cours au programme =====
// Un même cours peut être programmé pour PLUSIEURS facultés/filières à la fois
// (champ `cibles`) : on crée alors une ligne cours par cible et on inscrit les
// étudiants de chacune, pour qu'il apparaisse dans le programme de chaque
// faculté/filière et chez chaque étudiant. Rétro-compatible : sans `cibles`,
// on retombe sur la faculté/filière unique du corps.
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { code, nom, faculte, filiere, niveau, annee_academique, semestre, credits, cibles } = req.body;

    if (!code || !nom || !niveau || !annee_academique || !semestre || !credits) {
      return res.status(400).json({ erreur: "Champs obligatoires manquants (code, nom, niveau, année, semestre, crédits)." });
    }

    const listeCibles = (Array.isArray(cibles) && cibles.length)
      ? cibles
      : (faculte ? [{ faculte, filiere: filiere || null }] : []);
    if (!listeCibles.length) {
      return res.status(400).json({ erreur: "Aucune faculté cible sélectionnée." });
    }

    const champs = { code, nom, niveau, annee_academique, semestre, credits };
    const crees = [];
    const doublons = [];
    let totalInscrits = 0;

    for (const cible of listeCibles) {
      if (!cible || !cible.faculte) continue;
      try {
        const r = await creerCoursPourCible(champs, cible.faculte, cible.filiere);
        crees.push(r);
        totalInscrits += r.etudiantsInscrits;
      } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') {
          doublons.push(cible.faculte + (cible.filiere ? ' / ' + cible.filiere : ''));
        } else {
          throw e;
        }
      }
    }

    if (!crees.length) {
      return res.status(409).json({ erreur: "Ce cours existe déjà pour : " + doublons.join(', ') });
    }

    res.status(201).json({
      message: "Cours ajouté au programme.",
      coursCrees: crees.length,
      etudiantsInscrits: totalInscrits,
      doublons,
      // Rétro-compat : certains appels lisent encore `id`/`etudiantsInscrits` (1re cible).
      id: crees[0].id
    });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de l'ajout du cours." });
  }
});

// ===== PUT /api/programme/:id =====
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { code, nom, faculte, filiere, niveau, annee_academique, semestre, credits } = req.body;
    const { filiere_id, promotion } = await resoudreFiliereEtPromotion(niveau, faculte, filiere || null);

    await pool.query(
      'UPDATE cours SET code=?, nom=?, faculte=?, filiere_id=?, niveau=?, promotion=?, annee_academique=?, semestre=?, credits=? WHERE id=?',
      [code.toUpperCase(), nom, faculte, filiere_id || null, niveau, promotion, annee_academique, semestre, credits, req.params.id]
    );

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
    res.json({ message: "Professeur attribué avec succès." });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de l'attribution." });
  }
});

// ===== DELETE /api/programme/:id =====
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM cours WHERE id = ?', [req.params.id]);
    res.json({ message: "Cours retiré du programme." });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la suppression." });
  }
});

module.exports = router;

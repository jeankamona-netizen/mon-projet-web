const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../database');
const { requireAdmin } = require('../middleware/auth');

// Toutes les routes de réinscription sont réservées à l'admin
router.use(requireAdmin);

function genererMotDePasseTemporaire() {
  return crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, '').slice(0, 12);
}

// Génère un matricule "UML-AAAA-0000" unique pour l'année donnée (anti-collision).
async function genererMatricule(anneeAcademique) {
  const prefixe = `UML-${String(anneeAcademique).slice(0, 4)}-`;
  const [rows] = await pool.query(
    'SELECT id FROM etudiant WHERE id LIKE ? ORDER BY id DESC LIMIT 1',
    [prefixe + '%']
  );
  let seq = 1;
  if (rows.length) {
    const dernier = parseInt(rows[0].id.split('-')[2], 10);
    if (!isNaN(dernier)) seq = dernier + 1;
  }
  while (true) {
    const matricule = prefixe + String(seq).padStart(4, '0');
    const [[exist]] = await pool.query('SELECT 1 AS x FROM etudiant WHERE id = ?', [matricule]);
    if (!exist) return matricule;
    seq++;
  }
}

// Inscrit un étudiant aux cours de sa faculté + niveau + année (sa filière
// précise + les cours communs à toute la faculté). Renvoie le nombre de cours.
async function inscrireAuxCoursDuNiveau(etudiantId, faculte, niveau, filiere_id, annee) {
  if (!faculte || !niveau || !annee) return 0;
  let sql = 'SELECT id FROM cours WHERE faculte = ? AND niveau = ? AND annee_academique = ? AND (filiere_id IS NULL';
  const params = [faculte, niveau, annee];
  if (filiere_id) { sql += ' OR filiere_id = ?'; params.push(filiere_id); }
  sql += ')';
  const [cours] = await pool.query(sql, params);
  if (cours.length === 0) return 0;
  const valeurs = cours.map(c => [etudiantId, c.id]);
  await pool.query('INSERT IGNORE INTO inscription_cours (etudiant_id, cours_id) VALUES ?', [valeurs]);
  return cours.length;
}

// ===== POST /api/reinscriptions/promouvoir — faire monter un étudiant existant de promotion =====
// L'étudiant conserve son matricule, son compte, ses anciennes notes et cours
// (historique) ; on met à jour son niveau + année, puis on l'inscrit aux cours
// du nouveau niveau.
router.post('/promouvoir', async (req, res) => {
  const { etudiant_id, nouveau_niveau, annee_academique } = req.body;
  if (!etudiant_id || !nouveau_niveau || !annee_academique) {
    return res.status(400).json({ erreur: 'Étudiant, nouveau niveau et année académique sont obligatoires.' });
  }
  try {
    const [[etu]] = await pool.query(
      'SELECT id, nom, prenom, faculte, filiere_id, niveau, annee_academique FROM etudiant WHERE id = ?',
      [etudiant_id]
    );
    if (!etu) return res.status(404).json({ erreur: 'Étudiant introuvable.' });
    if (etu.niveau === nouveau_niveau && etu.annee_academique === annee_academique) {
      return res.status(400).json({ erreur: 'L\'étudiant est déjà dans ce niveau pour cette année.' });
    }

    await pool.query(
      'UPDATE etudiant SET niveau = ?, annee_academique = ?, statut = \'actif\' WHERE id = ?',
      [nouveau_niveau, annee_academique, etudiant_id]
    );

    const coursInscrits = await inscrireAuxCoursDuNiveau(etudiant_id, etu.faculte, nouveau_niveau, etu.filiere_id, annee_academique);

    res.json({
      message: `${etu.prenom} ${etu.nom} promu(e) en ${nouveau_niveau} (${annee_academique}).`,
      coursInscrits
    });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: erreur.message });
  }
});

// ===== POST /api/reinscriptions/nouveau — inscrire un nouvel étudiant directement à un niveau donné (L2, L3…) =====
router.post('/nouveau', async (req, res) => {
  const { nom, postnom, prenom, sexe, date_naissance, email, telephone, faculte, filiere, niveau, annee_academique } = req.body;
  if (!nom || !prenom || !faculte || !niveau || !annee_academique) {
    return res.status(400).json({ erreur: 'Nom, prénom, faculté, niveau et année académique sont obligatoires.' });
  }
  try {
    // Résoudre la filière (scopée à la faculté choisie)
    let filiere_id = null;
    if (filiere) {
      const [[f]] = await pool.query(
        'SELECT f.id FROM filiere f JOIN faculte fa ON f.faculte_id = fa.id WHERE f.nom = ? AND fa.nom = ?',
        [filiere, faculte]
      );
      if (f) filiere_id = f.id;
    }

    const matricule = await genererMatricule(annee_academique);
    const motDePasse = genererMotDePasseTemporaire();
    const hash = await bcrypt.hash(motDePasse, 10);

    await pool.query(`
      INSERT INTO etudiant (id, nom, postnom, prenom, date_naissance, sexe, email, telephone,
                            mot_de_passe, filiere_id, faculte, promotion, niveau, annee_academique, statut)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'actif')
    `, [
      matricule, nom, postnom || null, prenom, date_naissance || null, sexe || null,
      email || null, telephone || null, hash, filiere_id, faculte, filiere || '', niveau, annee_academique
    ]);

    const coursInscrits = await inscrireAuxCoursDuNiveau(matricule, faculte, niveau, filiere_id, annee_academique);

    res.status(201).json({
      message: `Étudiant réinscrit en ${niveau}.`,
      matricule,
      motDePasseTemporaire: motDePasse,
      coursInscrits
    });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: erreur.message });
  }
});

module.exports = router;

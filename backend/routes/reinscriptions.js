const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../database');
const { requireAdmin, requireAdminOuDoyen, requireGestionInscrits, faculteDuDoyen } = require('../middleware/auth');
const { inscrireAuxCoursDuNiveau } = require('../models/inscriptionAuto');
const { journaliser, ipDeRequete, acteurDeReq } = require('../models/audit');
const { genererMatricule } = require('../models/matricule');
const { nomMajuscule } = require('../nom');

// La délibération (promotion d'un étudiant existant) est ouverte au décanat,
// restreinte à sa faculté ; l'inscription d'un nouvel étudiant reste réservée à
// l'admin. Les middlewares sont donc appliqués par route (pas de router.use).

function genererMotDePasseTemporaire() {
  return crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, '').slice(0, 12);
}

// ===== POST /api/reinscriptions/promouvoir — faire monter un étudiant existant de promotion =====
// L'étudiant conserve son matricule, son compte, ses anciennes notes et cours
// (historique) ; on met à jour son niveau + année, puis on l'inscrit aux cours
// du nouveau niveau.
router.post('/promouvoir', requireAdminOuDoyen, async (req, res) => {
  const { etudiant_id, nouveau_niveau, annee_academique, diplomer } = req.body;
  // « diplomer » = fin de cursus (L3 en fin de licence, M2 en fin de master) :
  // l'étudiant est marqué DIPLÔMÉ, sans promotion automatique vers le cycle
  // supérieur. Le passage au cycle suivant (Master, Doctorat) se fait par une
  // RÉINSCRIPTION explicite (même matricule).
  if (!etudiant_id || (!diplomer && (!nouveau_niveau || !annee_academique))) {
    return res.status(400).json({ erreur: 'Étudiant, nouveau niveau et année académique sont obligatoires.' });
  }
  try {
    const [[etu]] = await pool.query(
      'SELECT id, nom, prenom, faculte, filiere_id, niveau, annee_academique FROM etudiant WHERE id = ?',
      [etudiant_id]
    );
    if (!etu) return res.status(404).json({ erreur: 'Étudiant introuvable.' });
    // Un doyen ne peut délibérer que sur les étudiants de SA faculté.
    const facDoyen = faculteDuDoyen(req);
    if (facDoyen && etu.faculte !== facDoyen) {
      return res.status(403).json({ erreur: "Cet étudiant n'appartient pas à votre faculté." });
    }

    // Fin de cursus : on clôture (diplômé), on ne promeut PAS.
    if (diplomer) {
      await pool.query("UPDATE etudiant SET statut = 'diplome' WHERE id = ?", [etudiant_id]);
      journaliser({ ...acteurDeReq(req), action: 'Fin de cursus (diplômé)', details: `${etu.prenom} ${etu.nom} (${etudiant_id}) · ${etu.niveau} ${annee_academique || etu.annee_academique}`, ip: ipDeRequete(req) });
      return res.json({
        message: `${etu.prenom} ${etu.nom} : cursus clôturé (diplômé en ${etu.niveau}). Pour continuer au cycle supérieur, faites une réinscription (même matricule).`,
        coursInscrits: 0, diplome: true
      });
    }

    if (etu.niveau === nouveau_niveau && etu.annee_academique === annee_academique) {
      return res.status(400).json({ erreur: 'L\'étudiant est déjà dans ce niveau pour cette année.' });
    }

    await pool.query(
      'UPDATE etudiant SET niveau = ?, annee_academique = ?, statut = \'actif\' WHERE id = ?',
      [nouveau_niveau, annee_academique, etudiant_id]
    );

    const coursInscrits = await inscrireAuxCoursDuNiveau(etudiant_id, etu.faculte, nouveau_niveau, etu.filiere_id, annee_academique);

    journaliser({ ...acteurDeReq(req), action: 'Promotion étudiant', details: `${etu.prenom} ${etu.nom} (${etudiant_id}) → ${nouveau_niveau} ${annee_academique}`, ip: ipDeRequete(req) });
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
router.post('/nouveau', requireGestionInscrits, async (req, res) => {
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

    const matricule = await genererMatricule(annee_academique, faculte);
    const motDePasse = genererMotDePasseTemporaire();
    const hash = await bcrypt.hash(motDePasse, 10);

    await pool.query(`
      INSERT INTO etudiant (id, nom, postnom, prenom, date_naissance, sexe, email, telephone,
                            mot_de_passe, filiere_id, faculte, promotion, niveau, annee_academique, statut)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'actif')
    `, [
      matricule, nomMajuscule(nom), postnom || null, prenom, date_naissance || null, sexe || null,
      email || null, telephone || null, hash, filiere_id, faculte, filiere || '', niveau, annee_academique
    ]);

    const coursInscrits = await inscrireAuxCoursDuNiveau(matricule, faculte, niveau, filiere_id, annee_academique);

    journaliser({ ...acteurDeReq(req), action: 'Inscription nouvel étudiant', details: `${nom} ${prenom} (${matricule}) · ${niveau} ${faculte} ${annee_academique}`, ip: ipDeRequete(req) });
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

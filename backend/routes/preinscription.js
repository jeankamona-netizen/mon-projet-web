const express = require('express');
const router = express.Router();
const pool = require('../database');

// ===== POST /api/preinscription — soumettre un dossier =====
router.post('/', async (req, res) => {
  const {
    nom, postnom, prenom, dateNaissance, lieuNaissance, nationalite,
    sexe, etatCivil, typeIdentite, numIdentite,
    adresse1, adresse2, telephone, email,
    nomPere, telPere, nomMere, telMere, nomTuteur, telTuteur, adresseUrgence,
    ecole, villeEcole, numDiplome, pourcentage, anneeDiplome, sectionSecondaire,
    specialite, specialite2, niveau, redoublant, professionnel,
    refNom, refPostnom, refPrenom, refTelephone, refEmail,
    canalDecouverte
  } = req.body;

  if (!nom || !prenom || !specialite) {
    return res.status(400).json({
      erreur: "Veuillez remplir les champs obligatoires (nom, prénom, spécialité)."
    });
  }

  try {
    const [resultat] = await pool.query(`
      INSERT INTO preinscription (
        nom, postnom, prenom, date_naissance, lieu_naissance, nationalite,
        sexe, etat_civil, type_identite, num_identite,
        adresse1, adresse2, telephone, email,
        nom_pere, tel_pere, nom_mere, tel_mere, nom_tuteur, tel_tuteur, adresse_urgence,
        ecole, ville_ecole, num_diplome, pourcentage, annee_diplome, section_secondaire,
        specialite, specialite2, niveau, redoublant, professionnel,
        ref_nom, ref_postnom, ref_prenom, ref_telephone, ref_email,
        canal_decouverte, statut
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'en_attente')
    `, [
      nom, postnom || null, prenom,
      dateNaissance || null,
      lieuNaissance || null,
      nationalite || null,
      sexe || null,
      etatCivil || null,
      typeIdentite || null,
      numIdentite || null,
      adresse1 || null,
      adresse2 || null,
      telephone || null,
      email || null,
      nomPere || null, telPere || null,
      nomMere || null, telMere || null,
      nomTuteur || null, telTuteur || null,
      adresseUrgence || null,
      ecole || null,
      villeEcole || null,
      numDiplome || null,
      pourcentage || null,
      anneeDiplome || null,
      sectionSecondaire || null,
      specialite,
      specialite2 || null,
      niveau || null,
      redoublant ? 1 : 0,
      professionnel ? 1 : 0,
      refNom || null,
      refPostnom || null,
      refPrenom || null,
      refTelephone || null,
      refEmail || null,
      canalDecouverte || null
    ]);

    res.status(201).json({
      message: "Votre dossier a été soumis avec succès !",
      id: resultat.insertId
    });

  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de l'enregistrement du dossier." });
  }
});

// ===== GET /api/preinscription — toutes les demandes (admin) =====
router.get('/', async (req, res) => {
  try {
    const [dossiers] = await pool.query(
      'SELECT * FROM preinscription ORDER BY date_soumission DESC'
    );
    res.json(dossiers);
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la récupération des dossiers." });
  }
});

// ===== GET /api/preinscription/:id — un dossier précis =====
router.get('/:id', async (req, res) => {
  try {
    const [dossiers] = await pool.query(
      'SELECT * FROM preinscription WHERE id = ?',
      [req.params.id]
    );

    if (dossiers.length === 0) {
      return res.status(404).json({ erreur: "Dossier non trouvé." });
    }

    res.json(dossiers[0]);
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la récupération du dossier." });
  }
});

// ===== PUT /api/preinscription/:id — changer le statut =====
router.put('/:id', async (req, res) => {
  const { statut } = req.body;
  const statutsValides = ['en_attente', 'accepte', 'rejete'];

  if (!statutsValides.includes(statut)) {
    return res.status(400).json({ erreur: "Statut invalide." });
  }

  try {
    const [check] = await pool.query(
      'SELECT id FROM preinscription WHERE id = ?',
      [req.params.id]
    );

    if (check.length === 0) {
      return res.status(404).json({ erreur: "Dossier non trouvé." });
    }

    await pool.query(
      'UPDATE preinscription SET statut = ? WHERE id = ?',
      [statut, req.params.id]
    );

    const [dossiers] = await pool.query(
      'SELECT * FROM preinscription WHERE id = ?',
      [req.params.id]
    );

    res.json({
      message: `Statut mis à jour : ${statut}`,
      dossier: dossiers[0]
    });

  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la mise à jour du statut." });
  }
});

module.exports = router;
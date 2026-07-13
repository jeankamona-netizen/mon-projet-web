const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../database');
const { envoyerEmailAcceptation, envoyerEmailRejet } = require('../mailer');
const upload = require('../upload');
const { requireAdmin } = require('../middleware/auth');
const { inscrireAuxCoursDuNiveau } = require('../models/inscriptionAuto');

// Mot de passe temporaire aléatoire (12 caractères, non prévisible) — l'étudiant
// devra le changer, il est de toute façon hashé en bcrypt avant stockage.
function genererMotDePasseTemporaire() {
  return crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, '').slice(0, 12);
}

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

// ===== POST /api/preinscription/:id/documents — upload des pièces jointes =====
router.post('/:id/documents', upload.array('documents', 10), upload.verifierContenuFichiers, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ erreur: "Aucun fichier reçu." });
    }

    // Construire les chemins des fichiers uploadés
    const chemins = req.files.map(f => f.filename).join(',');

    // Sauvegarder les chemins dans la colonne document_path
    await pool.query(
      'UPDATE preinscription SET document_path = ? WHERE id = ?',
      [chemins, req.params.id]
    );

    res.json({
      message: `${req.files.length} fichier(s) uploadé(s) avec succès.`,
      fichiers: req.files.map(f => f.filename)
    });

  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de l'upload des documents." });
  }
});

// ===== GET /api/preinscription — toutes les demandes (admin) =====
router.get('/', requireAdmin, async (req, res) => {
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

// ===== PUT /api/preinscription/:id — changer le statut =====
router.put('/:id', requireAdmin, async (req, res) => {
  const { statut } = req.body;
  const statutsValides = ['en_attente', 'accepte', 'rejete'];

  if (!statutsValides.includes(statut)) {
    return res.status(400).json({ erreur: "Statut invalide." });
  }

  try {
    // Vérifier que le dossier existe
    const [dossiers] = await pool.query(
      'SELECT * FROM preinscription WHERE id = ?',
      [req.params.id]
    );

    if (dossiers.length === 0) {
      return res.status(404).json({ erreur: "Dossier non trouvé." });
    }

    const dossier = dossiers[0];

    // ===== CAS 1 : ACCEPTATION =====
    // → Mettre à jour le statut de la pré-inscription
    // → Créer un compte étudiant dans la table etudiant
    // ===== CAS 1 : ACCEPTATION =====
if (statut === 'accepte') {

  const annee = new Date().getFullYear();
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM etudiant');
  const numero = String(total + 1).padStart(4, '0');
  const numeroEtudiant = `UML-${annee}-${numero}`;

  // Retrouver la filière (et sa faculté de rattachement) depuis la spécialité
  // choisie. Certaines facultés n'ont pas de filière au niveau Licence (ex.
  // Théologie, dont la Licence n'est pas subdivisée) : le formulaire propose
  // alors directement le nom de la faculté comme "spécialité", sans filière.
  const [filieres] = await pool.query(
    'SELECT f.id, f.nom, fa.nom AS faculte_nom FROM filiere f JOIN faculte fa ON f.faculte_id = fa.id WHERE f.nom = ?',
    [dossier.specialite]
  );
  let filiere_id = filieres.length > 0 ? filieres[0].id : null;
  let faculteNom = filieres.length > 0 ? filieres[0].faculte_nom : null;
  if (!faculteNom) {
    const [facultes] = await pool.query('SELECT nom FROM faculte WHERE nom = ?', [dossier.specialite]);
    if (facultes.length > 0) faculteNom = facultes[0].nom;
  }

  // Niveau court à partir du niveau saisi au dossier
  let niveauCourt = 'L1';
  if (dossier.niveau) {
    if (dossier.niveau.toLowerCase().includes('master')) niveauCourt = 'M1';
    else if (dossier.niveau.toLowerCase().includes('doctorat')) niveauCourt = 'D1';
    else niveauCourt = 'L1';
  }
  // La colonne "promotion" affiche simplement le nom de la filière (même
  // convention que l'ajout manuel d'un inscrit — voir "Gérer les inscrits").
  const promotion = dossier.specialite || '';
  const motDePasse = genererMotDePasseTemporaire();
  const motDePasseHash = await bcrypt.hash(motDePasse, 10);

  const [dejaInscrit] = await pool.query(
    'SELECT id FROM etudiant WHERE nom = ? AND prenom = ? AND date_naissance = ?',
    [dossier.nom, dossier.prenom, dossier.date_naissance]
  );

  if (dejaInscrit.length === 0) {
    const anneeAcademique = `${annee}-${annee + 1}`;
    await pool.query(`
      INSERT INTO etudiant (
        id, nom, postnom, prenom, date_naissance, lieu_naissance,
        nationalite, sexe, email, telephone, adresse,
        mot_de_passe, filiere_id, faculte, promotion, niveau, annee_academique, statut
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'actif')
    `, [
      numeroEtudiant,
      dossier.nom,
      dossier.postnom || '',
      dossier.prenom,
      dossier.date_naissance || null,
      dossier.lieu_naissance || null,
      dossier.nationalite || null,
      dossier.sexe || null,
      dossier.email || null,
      dossier.telephone || null,
      dossier.adresse1 || null,
      motDePasseHash,
      filiere_id,
      faculteNom,
      promotion,
      niveauCourt,
      anneeAcademique
    ]);

    console.log(`✅ Étudiant créé : ${numeroEtudiant} — ${dossier.prenom} ${dossier.nom} | Faculté: ${faculteNom} | Filière: ${dossier.specialite} | Niveau: ${niveauCourt}`);

    // Inscrit automatiquement le nouvel étudiant aux cours déjà programmés pour sa
    // faculté + niveau (+ sa filière précise, les cours communs à toute la
    // faculté, et les cours communs à plusieurs facultés) — pas de correspondance
    // fragile par chaîne "promotion".
    await inscrireAuxCoursDuNiveau(numeroEtudiant, faculteNom, niveauCourt, filiere_id, anneeAcademique);

    if (dossier.email) {
      await envoyerEmailAcceptation(
        { nom: dossier.nom, prenom: dossier.prenom, email: dossier.email },
        numeroEtudiant,
        motDePasse
      ).catch(err => console.error('⚠️ Erreur envoi email:', err.message));
    }
  }
}
    // ===== CAS 2 : REJET =====
    // → Supprimer l'étudiant de la table etudiant s'il y existe déjà
    if (statut === 'rejete') {
      const [etudiantExistant] = await pool.query(
        'SELECT id FROM etudiant WHERE nom = ? AND prenom = ? AND date_naissance = ?',
        [dossier.nom, dossier.prenom, dossier.date_naissance]
      );

      if (etudiantExistant.length > 0) {
        await pool.query(
          'DELETE FROM etudiant WHERE id = ?',
          [etudiantExistant[0].id]
        );
        console.log(`🗑️ Étudiant supprimé suite au rejet du dossier n°${dossier.id}`);

        // Envoyer l'email de rejet
        if (dossier.email) {
          await envoyerEmailRejet(
            { nom: dossier.nom, prenom: dossier.prenom, email: dossier.email }
          ).catch(err => console.error('⚠️ Erreur envoi email rejet:', err.message));
        }
      }
    }

    // ===== MISE À JOUR DU STATUT DE LA PRÉ-INSCRIPTION (dans tous les cas) =====
    await pool.query(
      'UPDATE preinscription SET statut = ? WHERE id = ?',
      [statut, req.params.id]
    );

    // Récupérer le dossier mis à jour pour la réponse
    const [dossierMisAJour] = await pool.query(
      'SELECT * FROM preinscription WHERE id = ?',
      [req.params.id]
    );

    res.json({
      message: statut === 'accepte'
        ? `Candidature acceptée — compte étudiant créé avec succès.`
        : statut === 'rejete'
        ? `Candidature rejetée — étudiant retiré du registre.`
        : `Statut mis à jour : ${statut}`,
      dossier: dossierMisAJour[0]
    });

  } catch (erreur) {
    console.error('Erreur PUT preinscription:', erreur);
    res.status(500).json({ erreur: "Erreur lors de la mise à jour : " + erreur.message });
  }
});

module.exports = router;
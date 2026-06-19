const express = require('express');
const router = express.Router();

// ===== ÉTUDIANT TEST (en attendant MySQL) =====
const etudiantTest = {
  numeroEtudiant: "UML-2024-0012",
  motDePasse: "uml2026",
  nom: "Jean Kamona Netizen",
  filiere: "Génie Logicielle",
  niveau: "L2"
};

// ===== POST /api/auth/connexion =====
router.post('/connexion', (req, res) => {
  const { numeroEtudiant, motDePasse } = req.body;

  if (!numeroEtudiant || !motDePasse) {
    return res.status(400).json({ erreur: "Numéro étudiant et mot de passe requis." });
  }

  if (numeroEtudiant !== etudiantTest.numeroEtudiant || motDePasse !== etudiantTest.motDePasse) {
    return res.status(401).json({ erreur: "Numéro étudiant ou mot de passe incorrect." });
  }

  res.json({
    message: "Connexion réussie !",
    etudiant: {
      numeroEtudiant: etudiantTest.numeroEtudiant,
      nom: etudiantTest.nom,
      filiere: etudiantTest.filiere,
      niveau: etudiantTest.niveau
    }
  });
});

module.exports = router;
const express = require('express');
const router = express.Router();

// ===== DONNÉES TEMPORAIRES (en attendant la base de données) =====
const facultes = [
  {
    id: 1,
    nom: "Faculté de Théologie",
    filieres: ["Missiologie", "Théologie Pratique", "Théologie Systématique", "Théologie Biblique AT & NT"],
    masterDisponible: true
  },
  {
    id: 2,
    nom: "Sciences Informatiques",
    filieres: ["Gestion Informatique", "Réseau & Télécom", "Génie Logicielle", "Design"],
    masterDisponible: true
  },
  {
    id: 3,
    nom: "Sciences Économiques",
    filieres: ["Gestion des Ressources Humaines", "Finances Banque & Comptabilité", "Gestion Marketing", "Entrepreneuriat", "Douane"],
    masterDisponible: false
  },
  {
    id: 4,
    nom: "Sciences de l'Éducation & Psychologie",
    filieres: ["Sciences de l'Éducation", "Psychologie"],
    masterDisponible: false
  }
];

// ===== GET /api/facultes — liste toutes les facultés =====
router.get('/', (req, res) => {
  res.json(facultes);
});

// ===== GET /api/facultes/:id — une faculté précise =====
router.get('/:id', (req, res) => {
  const faculte = facultes.find(f => f.id === parseInt(req.params.id));

  if (!faculte) {
    return res.status(404).json({ erreur: "Faculté non trouvée" });
  }

  res.json(faculte);
});

module.exports = router;
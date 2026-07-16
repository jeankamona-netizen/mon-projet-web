const express = require('express');
const router = express.Router();
const pool = require('../database');

// ===== GET /api/facultes — liste toutes les facultés avec leurs filières =====
router.get('/', async (req, res) => {
  try {
    const [facultes] = await pool.query('SELECT * FROM faculte');

    // Pour chaque faculté, on récupère ses filières
    for (const faculte of facultes) {
      const [filieres] = await pool.query(
        'SELECT nom FROM filiere WHERE faculte_id = ?',
        [faculte.id]
      );
      faculte.filieres = filieres.map(f => f.nom);
    }

    res.json(facultes);

  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la récupération des facultés." });
  }
});

// ===== GET /api/facultes/:id — une faculté précise =====
router.get('/:id', async (req, res) => {
  try {
    const [facultes] = await pool.query(
      'SELECT * FROM faculte WHERE id = ?',
      [req.params.id]
    );

    if (facultes.length === 0) {
      return res.status(404).json({ erreur: "Faculté non trouvée" });
    }

    const faculte = facultes[0];
    const [filieres] = await pool.query(
      'SELECT nom FROM filiere WHERE faculte_id = ?',
      [faculte.id]
    );
    faculte.filieres = filieres.map(f => f.nom);

    res.json(faculte);

  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la récupération de la faculté." });
  }
});

module.exports = router;

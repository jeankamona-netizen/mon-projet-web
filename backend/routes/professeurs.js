const express = require('express');
const router = express.Router();
const pool = require('../database');

router.get('/', async (req, res) => {
  try {
    const [profs] = await pool.query('SELECT * FROM professeur ORDER BY nom');
    res.json(profs);
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la récupération des professeurs." });
  }
});

module.exports = router;
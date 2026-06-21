const express = require('express');
const router = express.Router();
const pool = require('../database');

// ===== GET /api/annonces — toutes les annonces (avec filtre type) =====
router.get('/', async (req, res) => {
  try {
    const { type, actif } = req.query;

    let sql = 'SELECT * FROM annonce WHERE 1=1';
    const params = [];

    if (type) { sql += ' AND type = ?'; params.push(type); }
    if (actif !== undefined) { sql += ' AND actif = ?'; params.push(actif === 'true' ? 1 : 0); }

    sql += ' ORDER BY date_annonce DESC';

    const [annonces] = await pool.query(sql, params);
    res.json(annonces);
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la récupération des annonces." });
  }
});

// ===== POST /api/annonces — créer une annonce =====
router.post('/', async (req, res) => {
  try {
    const { type, titre, description, date_annonce, icone, image, actif } = req.body;

    if (!type || !titre || !description || !date_annonce) {
      return res.status(400).json({ erreur: "Champs obligatoires manquants." });
    }

    const [resultat] = await pool.query(
      'INSERT INTO annonce (type, titre, description, date_annonce, icone, image, actif) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [type, titre, description, date_annonce, icone || '📢', image || '', actif !== false]
    );

    res.status(201).json({ message: "Annonce publiée avec succès.", id: resultat.insertId });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la publication." });
  }
});

// ===== PUT /api/annonces/:id — modifier =====
router.put('/:id', async (req, res) => {
  try {
    const { type, titre, description, date_annonce, icone, image, actif } = req.body;

    await pool.query(
      'UPDATE annonce SET type=?, titre=?, description=?, date_annonce=?, icone=?, image=?, actif=? WHERE id=?',
      [type, titre, description, date_annonce, icone, image, actif, req.params.id]
    );

    res.json({ message: "Annonce modifiée avec succès." });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la modification." });
  }
});

// ===== PATCH /api/annonces/:id/toggle — activer/désactiver =====
router.patch('/:id/toggle', async (req, res) => {
  try {
    const [lignes] = await pool.query('SELECT actif FROM annonce WHERE id = ?', [req.params.id]);

    if (lignes.length === 0) {
      return res.status(404).json({ erreur: "Annonce non trouvée." });
    }

    const nouveauStatut = !lignes[0].actif;
    await pool.query('UPDATE annonce SET actif = ? WHERE id = ?', [nouveauStatut, req.params.id]);

    res.json({ message: "Statut mis à jour.", actif: nouveauStatut });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors du changement de statut." });
  }
});

// ===== DELETE /api/annonces/:id =====
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM annonce WHERE id = ?', [req.params.id]);
    res.json({ message: "Annonce supprimée." });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la suppression." });
  }
});

module.exports = router;
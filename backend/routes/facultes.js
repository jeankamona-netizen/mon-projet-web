const express = require('express');
const router = express.Router();
const pool = require('../database');
const { requireAdmin } = require('../middleware/auth');

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

// ===== GET /api/facultes/gestion/liste — facultés + filières AVEC leurs id =====
// (réservé admin : la gestion a besoin des id de filière pour modifier/supprimer,
// contrairement à la route publique qui ne renvoie que les noms).
router.get('/gestion/liste', requireAdmin, async (req, res) => {
  try {
    const [facultes] = await pool.query('SELECT * FROM faculte ORDER BY nom');
    for (const faculte of facultes) {
      const [filieres] = await pool.query('SELECT id, nom FROM filiere WHERE faculte_id = ? ORDER BY nom', [faculte.id]);
      faculte.filieres = filieres;
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

// ===== POST /api/facultes — créer une faculté (admin) =====
router.post('/', requireAdmin, async (req, res) => {
  const nom = (req.body.nom || '').trim();
  const masterDispo = req.body.master_disponible ? 1 : 0;
  if (!nom) return res.status(400).json({ erreur: "Le nom de la faculté est obligatoire." });
  try {
    const [r] = await pool.query('INSERT INTO faculte (nom, master_disponible) VALUES (?, ?)', [nom, masterDispo]);
    res.status(201).json({ id: r.insertId, nom, master_disponible: masterDispo, filieres: [] });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la création de la faculté." });
  }
});

// ===== PUT /api/facultes/:id — modifier une faculté (admin) =====
router.put('/:id', requireAdmin, async (req, res) => {
  const nom = (req.body.nom || '').trim();
  const masterDispo = req.body.master_disponible ? 1 : 0;
  if (!nom) return res.status(400).json({ erreur: "Le nom de la faculté est obligatoire." });
  try {
    await pool.query('UPDATE faculte SET nom = ?, master_disponible = ? WHERE id = ?', [nom, masterDispo, req.params.id]);
    res.json({ message: "Faculté mise à jour." });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la mise à jour de la faculté." });
  }
});

// ===== DELETE /api/facultes/:id — supprimer une faculté et ses filières (admin) =====
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM filiere WHERE faculte_id = ?', [req.params.id]);
    await pool.query('DELETE FROM faculte WHERE id = ?', [req.params.id]);
    res.json({ message: "Faculté supprimée." });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la suppression de la faculté." });
  }
});

module.exports = router;

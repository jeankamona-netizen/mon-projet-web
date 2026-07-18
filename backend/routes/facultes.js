const express = require('express');
const router = express.Router();
const pool = require('../database');
// gestion/liste est ouverte au décanat (le doyen y gère les filières de SA
// faculté), mais créer / renommer / supprimer une faculté reste réservé à
// l'admin (requireAdmin strict) : renommer casserait le rattachement agent↔faculté.
const { requireAdminOuDoyen: requireDecanat, requireAdmin, faculteDuDoyen } = require('../middleware/auth');
const { journaliser, ipDeRequete, acteurDeReq } = require('../models/audit');

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
router.get('/gestion/liste', requireDecanat, async (req, res) => {
  try {
    // Un doyen ne voit et ne gère QUE sa faculté.
    const facDoyen = faculteDuDoyen(req);
    const [facultes] = facDoyen
      ? await pool.query('SELECT * FROM faculte WHERE nom = ? ORDER BY nom', [facDoyen])
      : await pool.query('SELECT * FROM faculte ORDER BY nom');
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
    journaliser({ ...acteurDeReq(req), action: 'Création faculté', details: nom, ip: ipDeRequete(req) });
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
    journaliser({ ...acteurDeReq(req), action: 'Modification faculté', details: nom, ip: ipDeRequete(req) });
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
    journaliser({ ...acteurDeReq(req), action: 'Suppression faculté', details: `Faculté #${req.params.id} (et ses filières)`, ip: ipDeRequete(req) });
    res.json({ message: "Faculté supprimée." });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la suppression de la faculté." });
  }
});

module.exports = router;

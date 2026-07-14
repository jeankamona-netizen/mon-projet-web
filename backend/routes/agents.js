const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../database');
const { requireAdmin } = require('../middleware/auth');

// La gestion des agents (personnel) est réservée à l'administration.
router.use(requireAdmin);

// Fonctions reconnues (déterminent l'accès aux interfaces).
const FONCTIONS = ['caissier', 'administrateur_budget'];

function genererMotDePasseTemporaire() {
  return crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, '').slice(0, 12);
}

// ===== GET /api/agents — liste des agents (sans mot de passe) =====
router.get('/', async (req, res) => {
  try {
    const [agents] = await pool.query(
      'SELECT id, matricule, noms, prenom, email, telephone, fonction FROM agent ORDER BY noms, prenom'
    );
    res.json(agents);
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la récupération des agents." });
  }
});

// ===== POST /api/agents — créer un agent =====
router.post('/', async (req, res) => {
  const { matricule, noms, prenom, email, telephone, fonction, mot_de_passe } = req.body;
  if (!matricule || !noms || !fonction || !mot_de_passe) {
    return res.status(400).json({ erreur: 'Matricule, noms, fonction et mot de passe sont obligatoires.' });
  }
  if (!FONCTIONS.includes(fonction)) {
    return res.status(400).json({ erreur: 'Fonction invalide.' });
  }
  if (mot_de_passe.length < 6) {
    return res.status(400).json({ erreur: 'Le mot de passe doit contenir au moins 6 caractères.' });
  }
  try {
    const hash = await bcrypt.hash(mot_de_passe, 10);
    const [r] = await pool.query(
      'INSERT INTO agent (matricule, noms, prenom, email, telephone, fonction, mot_de_passe) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [matricule, noms, prenom || null, email || null, telephone || null, fonction, hash]
    );
    res.status(201).json({ message: 'Agent créé.', id: r.insertId });
  } catch (erreur) {
    if (erreur.code === 'ER_DUP_ENTRY') return res.status(409).json({ erreur: 'Ce matricule existe déjà.' });
    console.error(erreur);
    res.status(500).json({ erreur: erreur.message });
  }
});

// ===== PUT /api/agents/:id — modifier un agent (mot de passe optionnel) =====
router.put('/:id', async (req, res) => {
  const { matricule, noms, prenom, email, telephone, fonction, mot_de_passe } = req.body;
  if (!matricule || !noms || !fonction) {
    return res.status(400).json({ erreur: 'Matricule, noms et fonction sont obligatoires.' });
  }
  if (!FONCTIONS.includes(fonction)) {
    return res.status(400).json({ erreur: 'Fonction invalide.' });
  }
  try {
    // Le mot de passe n'est réécrit que s'il est fourni (sinon on garde l'ancien).
    if (mot_de_passe) {
      if (mot_de_passe.length < 6) return res.status(400).json({ erreur: 'Le mot de passe doit contenir au moins 6 caractères.' });
      const hash = await bcrypt.hash(mot_de_passe, 10);
      await pool.query(
        'UPDATE agent SET matricule=?, noms=?, prenom=?, email=?, telephone=?, fonction=?, mot_de_passe=? WHERE id=?',
        [matricule, noms, prenom || null, email || null, telephone || null, fonction, hash, req.params.id]
      );
    } else {
      await pool.query(
        'UPDATE agent SET matricule=?, noms=?, prenom=?, email=?, telephone=?, fonction=? WHERE id=?',
        [matricule, noms, prenom || null, email || null, telephone || null, fonction, req.params.id]
      );
    }
    res.json({ message: 'Agent mis à jour.' });
  } catch (erreur) {
    if (erreur.code === 'ER_DUP_ENTRY') return res.status(409).json({ erreur: 'Ce matricule existe déjà.' });
    console.error(erreur);
    res.status(500).json({ erreur: erreur.message });
  }
});

// ===== DELETE /api/agents/:id =====
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM agent WHERE id = ?', [req.params.id]);
    res.json({ message: 'Agent supprimé.' });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: erreur.message });
  }
});

// ===== POST /api/agents/:id/reinitialiser-mot-de-passe — genere un nouveau
// mot de passe temporaire (comme pour les professeurs) : pas d'envoi
// automatique par email, l'admin le communique lui-meme a l'agent. =====
router.post('/:id/reinitialiser-mot-de-passe', async (req, res) => {
  try {
    const [agents] = await pool.query('SELECT id FROM agent WHERE id = ?', [req.params.id]);
    if (agents.length === 0) return res.status(404).json({ erreur: 'Agent non trouvé.' });

    const motDePasseTemporaire = genererMotDePasseTemporaire();
    const hash = await bcrypt.hash(motDePasseTemporaire, 10);
    await pool.query('UPDATE agent SET mot_de_passe = ? WHERE id = ?', [hash, req.params.id]);

    res.json({ motDePasseTemporaire });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: erreur.message });
  }
});

module.exports = router;

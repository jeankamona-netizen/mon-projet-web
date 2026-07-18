const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../database');
const { requireAdmin } = require('../middleware/auth');
const { journaliser, ipDeRequete, acteurDeReq } = require('../models/audit');
const { envoyerEmailReinitialisationCompte, envoyerEmailIdentifiantsAgent } = require('../mailer');
const { nomMajuscule } = require('../nom');
const { genererMatriculeAgent } = require('../models/matricule');

// Libellé d'espace + rôle de connexion selon la fonction de l'agent.
const ESPACE_PAR_FONCTION = {
  caissier: { espace: 'espace caisse', role: 'caissier' },
  administrateur_budget: { espace: 'espace administrateur du budget', role: 'caissier' },
  doyen: { espace: 'espace décanal', role: 'doyen' },
  vice_doyen: { espace: 'espace décanal', role: 'vice-doyen' },
};

// La gestion des agents (personnel) est réservée à l'administration.
router.use(requireAdmin);

// Fonctions reconnues (déterminent l'accès aux interfaces).
const FONCTIONS = ['caissier', 'administrateur_budget', 'doyen', 'vice_doyen'];

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
  const { noms, prenom, email, telephone, fonction, mot_de_passe } = req.body;
  if (!noms || !fonction || !mot_de_passe) {
    return res.status(400).json({ erreur: 'Noms, fonction et mot de passe sont obligatoires.' });
  }
  if (!FONCTIONS.includes(fonction)) {
    return res.status(400).json({ erreur: 'Fonction invalide.' });
  }
  if (mot_de_passe.length < 6) {
    return res.status(400).json({ erreur: 'Le mot de passe doit contenir au moins 6 caractères.' });
  }
  try {
    // Matricule généré automatiquement au format « {Initiale}{RRR}-{FONC}{YY} ».
    const matricule = await genererMatriculeAgent(fonction, noms, new Date().getFullYear());
    const hash = await bcrypt.hash(mot_de_passe, 10);
    const [r] = await pool.query(
      'INSERT INTO agent (matricule, noms, prenom, email, telephone, fonction, mot_de_passe) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [matricule, nomMajuscule(noms), prenom || null, email || null, telephone || null, fonction, hash]
    );
    // Email de bienvenue avec les identifiants (si une adresse est fournie).
    const conf = ESPACE_PAR_FONCTION[fonction] || { espace: 'compte', role: 'caissier' };
    const emailEnvoye = email
      ? await envoyerEmailIdentifiantsAgent({
          email, nom: `${prenom || ''} ${noms}`.trim(), matricule, motDePasse: mot_de_passe,
          espace: conf.espace, roleConnexion: conf.role,
        }).then(() => true).catch(err => { console.error('⚠️ Email identifiants agent :', err.message); return false; })
      : false;

    journaliser({ ...acteurDeReq(req), action: 'Création agent', details: `${prenom || ''} ${noms} (${matricule}) · ${fonction}`.trim() + (emailEnvoye ? ' · email envoyé' : ''), ip: ipDeRequete(req) });
    res.status(201).json({ message: 'Agent créé.', id: r.insertId, matricule, emailEnvoye });
  } catch (erreur) {
    if (erreur.code === 'ER_DUP_ENTRY') return res.status(409).json({ erreur: 'Ce matricule existe déjà.' });
    console.error(erreur);
    res.status(500).json({ erreur: erreur.message });
  }
});

// ===== PUT /api/agents/:id — modifier un agent (mot de passe optionnel) =====
// Le matricule n'est PLUS modifiable ici : il est attribué automatiquement à la
// création (format « {Initiale}{RRR}-{FONC}{YY} ») et reste stable.
router.put('/:id', async (req, res) => {
  const { noms, prenom, email, telephone, fonction, mot_de_passe } = req.body;
  if (!noms || !fonction) {
    return res.status(400).json({ erreur: 'Noms et fonction sont obligatoires.' });
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
        'UPDATE agent SET noms=?, prenom=?, email=?, telephone=?, fonction=?, mot_de_passe=? WHERE id=?',
        [nomMajuscule(noms), prenom || null, email || null, telephone || null, fonction, hash, req.params.id]
      );
    } else {
      await pool.query(
        'UPDATE agent SET noms=?, prenom=?, email=?, telephone=?, fonction=? WHERE id=?',
        [nomMajuscule(noms), prenom || null, email || null, telephone || null, fonction, req.params.id]
      );
    }
    journaliser({ ...acteurDeReq(req), action: 'Modification agent', details: `${prenom || ''} ${noms}`.trim(), ip: ipDeRequete(req) });
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
    const [[ag]] = await pool.query('SELECT noms, prenom, matricule FROM agent WHERE id = ?', [req.params.id]);
    await pool.query('DELETE FROM agent WHERE id = ?', [req.params.id]);
    journaliser({ ...acteurDeReq(req), action: 'Suppression agent', details: ag ? `${ag.prenom || ''} ${ag.noms} (${ag.matricule})`.trim() : `Agent #${req.params.id}`, ip: ipDeRequete(req) });
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
    const [agents] = await pool.query('SELECT id, noms, prenom, email, matricule, fonction FROM agent WHERE id = ?', [req.params.id]);
    if (agents.length === 0) return res.status(404).json({ erreur: 'Agent non trouvé.' });
    const agent = agents[0];

    const motDePasseTemporaire = genererMotDePasseTemporaire();
    const hash = await bcrypt.hash(motDePasseTemporaire, 10);
    await pool.query('UPDATE agent SET mot_de_passe = ? WHERE id = ?', [hash, req.params.id]);

    // Envoi automatique par email si l'agent a une adresse au dossier.
    const conf = ESPACE_PAR_FONCTION[agent.fonction] || { espace: 'compte', role: 'caissier' };
    const emailEnvoye = agent.email
      ? await envoyerEmailReinitialisationCompte({
          email: agent.email, nom: `${agent.prenom || ''} ${agent.noms || ''}`.trim(),
          identifiant: agent.matricule, motDePasse: motDePasseTemporaire,
          espace: conf.espace, roleConnexion: conf.role,
        }).then(() => true).catch(err => { console.error('⚠️ Email réinit. agent :', err.message); return false; })
      : false;

    journaliser({ ...acteurDeReq(req), action: 'Réinit. mot de passe agent', details: `${agent.prenom || ''} ${agent.noms || ''} (${agent.matricule})`.trim() + (emailEnvoye ? ' · email envoyé' : ''), ip: ipDeRequete(req) });
    res.json({ motDePasseTemporaire, emailEnvoye });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: erreur.message });
  }
});

module.exports = router;

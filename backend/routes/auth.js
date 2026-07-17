require('dotenv').config();
const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const pool = require('../database');
const { journaliser, ipDeRequete } = require('../models/audit');
const { requireFinance } = require('../middleware/auth');

// =====================
// AUTHENTIFICATION ADMIN — identifiants dans .env, jamais dans le frontend
// Session gérée par un vrai JWT signé, vérifié par le middleware requireAdmin
// sur toutes les routes sensibles (voir backend/middleware/auth.js)
// =====================
router.post('/admin', (req, res) => {
  const { user, password } = req.body;
  if (!user || !password)
    return res.status(400).json({ erreur: 'Identifiant et mot de passe requis.' });

  const adminUser = process.env.ADMIN_USER;
  const adminPass = process.env.ADMIN_PASS;

  if (!adminUser || !adminPass || !process.env.JWT_SECRET)
    return res.status(500).json({ erreur: 'Configuration serveur manquante.' });

  if (user !== adminUser || password !== adminPass)
    return res.status(401).json({ erreur: 'Identifiant ou mot de passe incorrect.' });

  const token = jwt.sign({ user: adminUser, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '8h' });
  journaliser({ role: 'admin', utilisateur: adminUser, identifiant: adminUser, action: 'Connexion', details: 'Connexion administration', ip: ipDeRequete(req) });
  res.json({ message: 'Connexion réussie.', token });
});

// =====================
// AUTHENTIFICATION AGENT — personnel de l'UML (table agent)
// La `fonction` détermine le rôle/accès : caissier → caisse, administrateur du
// budget → consultation/rapports. Connexion par matricule + mot de passe.
// =====================
const ROLE_PAR_FONCTION = {
  caissier: 'caisse',
  administrateur_budget: 'budget',
};

router.post('/agent', async (req, res) => {
  const { matricule, mot_de_passe } = req.body;
  if (!matricule || !mot_de_passe)
    return res.status(400).json({ erreur: 'Matricule et mot de passe requis.' });
  if (!process.env.JWT_SECRET)
    return res.status(500).json({ erreur: 'Configuration serveur manquante.' });

  try {
    const [agents] = await pool.query('SELECT * FROM agent WHERE matricule = ?', [matricule]);
    if (agents.length === 0)
      return res.status(401).json({ erreur: 'Matricule introuvable.' });

    const agent = agents[0];
    const valide = await bcrypt.compare(mot_de_passe, agent.mot_de_passe || '');
    if (!valide)
      return res.status(401).json({ erreur: 'Mot de passe incorrect.' });

    const role = ROLE_PAR_FONCTION[agent.fonction];
    if (!role)
      return res.status(403).json({ erreur: "Votre fonction ne donne accès à aucune interface." });

    const token = jwt.sign(
      { role, fonction: agent.fonction, agent_id: agent.id, matricule: agent.matricule,
        nom: `${agent.prenom || ''} ${agent.noms}`.trim() },
      process.env.JWT_SECRET, { expiresIn: '8h' }
    );
    journaliser({ role, utilisateur: `${agent.prenom || ''} ${agent.noms}`.trim(), identifiant: agent.matricule, action: 'Connexion', details: `Connexion ${agent.fonction || ''}`.trim(), ip: ipDeRequete(req) });
    res.json({
      message: 'Connexion réussie.', token,
      agent: { id: agent.id, matricule: agent.matricule, noms: agent.noms, prenom: agent.prenom, fonction: agent.fonction, role }
    });
  } catch (erreur) {
    console.error('Erreur auth agent:', erreur);
    res.status(500).json({ erreur: erreur.message });
  }
});

// =====================
// CONNEXION UNIVERSELLE — détecte automatiquement le type de compte à partir
// de l'identifiant saisi (matricule agent, identifiant admin, email professeur
// ou matricule étudiant), vérifie le mot de passe, et renvoie le type + la
// session appropriée. La page de connexion n'a plus besoin de choisir un rôle.
// =====================
router.post('/login', async (req, res) => {
  const { identifiant, mot_de_passe } = req.body;
  if (!identifiant || !mot_de_passe)
    return res.status(400).json({ erreur: 'Identifiant et mot de passe requis.' });
  if (!process.env.JWT_SECRET)
    return res.status(500).json({ erreur: 'Configuration serveur manquante.' });

  const echec = () => res.status(401).json({ erreur: 'Identifiant ou mot de passe incorrect.' });

  try {
    // 1) Agent (caissier / administrateur du budget) — reconnu par le matricule.
    const [agents] = await pool.query('SELECT * FROM agent WHERE matricule = ?', [identifiant]);
    if (agents.length) {
      const agent = agents[0];
      const ok = await bcrypt.compare(mot_de_passe, agent.mot_de_passe || '');
      if (!ok) return echec();
      const role = ROLE_PAR_FONCTION[agent.fonction];
      if (!role) return res.status(403).json({ erreur: "Votre fonction ne donne accès à aucune interface." });
      const token = jwt.sign(
        { role, fonction: agent.fonction, agent_id: agent.id, matricule: agent.matricule, nom: `${agent.prenom || ''} ${agent.noms}`.trim() },
        process.env.JWT_SECRET, { expiresIn: '8h' }
      );
      journaliser({ role, utilisateur: `${agent.prenom || ''} ${agent.noms}`.trim(), identifiant: agent.matricule, action: 'Connexion', details: `Connexion ${agent.fonction || ''}`.trim(), ip: ipDeRequete(req) });
      return res.json({ type: 'caisse', token, agent: { id: agent.id, matricule: agent.matricule, noms: agent.noms, prenom: agent.prenom, fonction: agent.fonction, role } });
    }

    // 2) Administration — identifiant + mot de passe dans .env.
    if (process.env.ADMIN_USER && identifiant === process.env.ADMIN_USER) {
      if (mot_de_passe !== process.env.ADMIN_PASS) return echec();
      const token = jwt.sign({ user: process.env.ADMIN_USER, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '8h' });
      journaliser({ role: 'admin', utilisateur: process.env.ADMIN_USER, identifiant: process.env.ADMIN_USER, action: 'Connexion', details: 'Connexion administration', ip: ipDeRequete(req) });
      return res.json({ type: 'admin', token });
    }

    // 3) Professeur — reconnu par son adresse email.
    const [profs] = await pool.query('SELECT * FROM professeur WHERE email = ?', [identifiant]);
    if (profs.length && profs[0].mot_de_passe) {
      const ok = await bcrypt.compare(mot_de_passe, profs[0].mot_de_passe);
      if (!ok) return echec();
      const { mot_de_passe: _, ...infos } = profs[0];
      journaliser({ role: 'professeur', utilisateur: `${profs[0].prenom || ''} ${profs[0].nom || ''}`.trim(), identifiant: profs[0].email, action: 'Connexion', details: 'Connexion professeur', ip: ipDeRequete(req) });
      return res.json({ type: 'professeur', professeur: infos });
    }

    // 4) Étudiant — reconnu par son matricule (id).
    const [etus] = await pool.query('SELECT * FROM etudiant WHERE id = ?', [identifiant]);
    if (etus.length) {
      const etu = etus[0];
      let ok = false;
      if (etu.mot_de_passe && etu.mot_de_passe.startsWith('$2')) {
        ok = await bcrypt.compare(mot_de_passe, etu.mot_de_passe);
      } else {
        ok = etu.mot_de_passe === mot_de_passe;
        if (ok) { const hash = await bcrypt.hash(mot_de_passe, 10); await pool.query('UPDATE etudiant SET mot_de_passe = ? WHERE id = ?', [hash, etu.id]); }
      }
      if (!ok) return echec();
      const { mot_de_passe: _, ...infos } = etu;
      journaliser({ role: 'etudiant', utilisateur: `${etu.nom || ''} ${etu.postnom || ''} ${etu.prenom || ''}`.replace(/\s+/g, ' ').trim(), identifiant: etu.id, action: 'Connexion', details: 'Connexion étudiant', ip: ipDeRequete(req) });
      return res.json({ type: 'etudiant', etudiant: infos });
    }

    return echec();
  } catch (erreur) {
    console.error('Erreur connexion universelle:', erreur);
    res.status(500).json({ erreur: erreur.message });
  }
});

// =====================
// AUTHENTIFICATION ÉTUDIANT — mot de passe hashé avec bcrypt
// =====================
router.post('/etudiant', async (req, res) => {
  const { numero, mot_de_passe } = req.body;
  if (!numero || !mot_de_passe)
    return res.status(400).json({ erreur: 'Numéro et mot de passe requis.' });

  try {
    const [etudiants] = await pool.query(
      'SELECT * FROM etudiant WHERE id = ?', [numero]
    );

    if (etudiants.length === 0)
      return res.status(401).json({ erreur: 'Numéro étudiant introuvable.' });

    const etudiant = etudiants[0];

    // Vérifier si le mot de passe est hashé (bcrypt commence par $2)
    let motDePasseValide = false;
    if (etudiant.mot_de_passe && etudiant.mot_de_passe.startsWith('$2')) {
      // Mot de passe hashé → comparaison bcrypt
      motDePasseValide = await bcrypt.compare(mot_de_passe, etudiant.mot_de_passe);
    } else {
      // Mot de passe temporaire en clair (première connexion)
      motDePasseValide = etudiant.mot_de_passe === mot_de_passe;
      if (motDePasseValide) {
        // Hasher automatiquement le mot de passe temporaire
        const hash = await bcrypt.hash(mot_de_passe, 10);
        await pool.query('UPDATE etudiant SET mot_de_passe = ? WHERE id = ?', [hash, numero]);
      }
    }

    if (!motDePasseValide)
      return res.status(401).json({ erreur: 'Mot de passe incorrect.' });

    // Renvoyer les infos sans le mot de passe
    const { mot_de_passe: _, ...infos } = etudiant;
    journaliser({ role: 'etudiant', utilisateur: `${etudiant.nom || ''} ${etudiant.postnom || ''} ${etudiant.prenom || ''}`.replace(/\s+/g, ' ').trim(), identifiant: etudiant.id, action: 'Connexion', details: 'Connexion étudiant', ip: ipDeRequete(req) });
    res.json({ message: 'Connexion réussie.', etudiant: infos });

  } catch (erreur) {
    console.error('Erreur auth étudiant:', erreur);
    res.status(500).json({ erreur: erreur.message });
  }
});

// =====================
// AUTHENTIFICATION PROFESSEUR — identifiant : email, mot de passe hashé
// =====================
router.post('/professeur', async (req, res) => {
  const { email, mot_de_passe } = req.body;
  if (!email || !mot_de_passe)
    return res.status(400).json({ erreur: 'Email et mot de passe requis.' });

  try {
    const [profs] = await pool.query('SELECT * FROM professeur WHERE email = ?', [email]);

    if (profs.length === 0 || !profs[0].mot_de_passe)
      return res.status(401).json({ erreur: 'Email introuvable ou accès non activé. Contactez l\'administration.' });

    const professeur = profs[0];
    const motDePasseValide = await bcrypt.compare(mot_de_passe, professeur.mot_de_passe);

    if (!motDePasseValide)
      return res.status(401).json({ erreur: 'Mot de passe incorrect.' });

    const { mot_de_passe: _, ...infos } = professeur;
    journaliser({ role: 'professeur', utilisateur: `${professeur.prenom || ''} ${professeur.nom || ''}`.trim(), identifiant: professeur.email, action: 'Connexion', details: 'Connexion professeur', ip: ipDeRequete(req) });
    res.json({ message: 'Connexion réussie.', professeur: infos });

  } catch (erreur) {
    console.error('Erreur auth professeur:', erreur);
    res.status(500).json({ erreur: erreur.message });
  }
});

// =====================
// MODIFICATION DU PROFIL PROFESSEUR (nom, prenom, email, telephone)
// =====================
router.put('/professeur/:id/profil', async (req, res) => {
  const { nom, prenom, email, telephone } = req.body;
  if (!nom || !email)
    return res.status(400).json({ erreur: 'Le nom et l\'email sont obligatoires.' });

  try {
    const [profs] = await pool.query('SELECT id FROM professeur WHERE id = ?', [req.params.id]);
    if (profs.length === 0)
      return res.status(404).json({ erreur: 'Professeur non trouvé.' });

    await pool.query(
      'UPDATE professeur SET nom = ?, prenom = ?, email = ?, telephone = ? WHERE id = ?',
      [nom, prenom || null, email, telephone || null, req.params.id]
    );

    const [maj] = await pool.query(
      'SELECT id, nom, prenom, email, telephone, grade FROM professeur WHERE id = ?',
      [req.params.id]
    );
    res.json({ message: 'Profil mis à jour avec succès.', professeur: maj[0] });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: erreur.message });
  }
});

// =====================
// CHANGEMENT DE MOT DE PASSE PROFESSEUR
// =====================
router.put('/professeur/:id/password', async (req, res) => {
  const { mot_de_passe_actuel, nouveau_mot_de_passe } = req.body;
  if (!mot_de_passe_actuel || !nouveau_mot_de_passe)
    return res.status(400).json({ erreur: 'Tous les champs sont requis.' });

  if (nouveau_mot_de_passe.length < 6)
    return res.status(400).json({ erreur: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' });

  try {
    const [profs] = await pool.query('SELECT mot_de_passe FROM professeur WHERE id = ?', [req.params.id]);
    if (profs.length === 0)
      return res.status(404).json({ erreur: 'Professeur non trouvé.' });

    const valide = await bcrypt.compare(mot_de_passe_actuel, profs[0].mot_de_passe || '');
    if (!valide)
      return res.status(401).json({ erreur: 'Mot de passe actuel incorrect.' });

    const hash = await bcrypt.hash(nouveau_mot_de_passe, 10);
    await pool.query('UPDATE professeur SET mot_de_passe = ? WHERE id = ?', [hash, req.params.id]);

    res.json({ message: 'Mot de passe mis à jour avec succès.' });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: erreur.message });
  }
});

// =====================
// CHANGEMENT DE MOT DE PASSE ÉTUDIANT
// =====================
router.put('/etudiant/:id/password', async (req, res) => {
  const { mot_de_passe_actuel, nouveau_mot_de_passe } = req.body;
  if (!mot_de_passe_actuel || !nouveau_mot_de_passe)
    return res.status(400).json({ erreur: 'Tous les champs sont requis.' });

  if (nouveau_mot_de_passe.length < 6)
    return res.status(400).json({ erreur: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' });

  try {
    const [etudiants] = await pool.query(
      'SELECT mot_de_passe FROM etudiant WHERE id = ?', [req.params.id]
    );
    if (etudiants.length === 0)
      return res.status(404).json({ erreur: 'Étudiant non trouvé.' });

    const actuel = etudiants[0].mot_de_passe;
    let valide = false;

    if (actuel && actuel.startsWith('$2')) {
      valide = await bcrypt.compare(mot_de_passe_actuel, actuel);
    } else {
      valide = actuel === mot_de_passe_actuel;
    }

    if (!valide)
      return res.status(401).json({ erreur: 'Mot de passe actuel incorrect.' });

    const hash = await bcrypt.hash(nouveau_mot_de_passe, 10);
    await pool.query('UPDATE etudiant SET mot_de_passe = ? WHERE id = ?', [hash, req.params.id]);

    res.json({ message: 'Mot de passe mis à jour avec succès.' });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: erreur.message });
  }
});

// =====================
// MODIFICATION DU PROFIL ÉTUDIANT (informations personnelles uniquement —
// pas la filière/promotion/niveau/année/statut, qui restent du ressort de
// l'admin). Self-service, sans validation admin.
// =====================
router.put('/etudiant/:id/profil', async (req, res) => {
  const { nom, postnom, prenom, date_naissance, nationalite, telephone, email, adresse } = req.body;
  if (!nom || !prenom)
    return res.status(400).json({ erreur: 'Le nom et le prénom sont obligatoires.' });

  try {
    const [etudiants] = await pool.query('SELECT id FROM etudiant WHERE id = ?', [req.params.id]);
    if (etudiants.length === 0)
      return res.status(404).json({ erreur: 'Étudiant non trouvé.' });

    await pool.query(
      'UPDATE etudiant SET nom = ?, postnom = ?, prenom = ?, date_naissance = ?, nationalite = ?, telephone = ?, email = ?, adresse = ? WHERE id = ?',
      [nom, postnom || null, prenom, date_naissance || null, nationalite || null, telephone || null, email || null, adresse || null, req.params.id]
    );

    const [maj] = await pool.query('SELECT * FROM etudiant WHERE id = ?', [req.params.id]);
    const { mot_de_passe: _, ...infos } = maj[0];
    res.json({ message: 'Profil mis à jour avec succès.', etudiant: infos });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: erreur.message });
  }
});

// =====================
// AGENT (caissier / administrateur du budget) — libre-service de son propre
// compte : consultation + modification de l'identité et du mot de passe.
// L'agent ne peut agir QUE sur son propre compte (agent_id du JWT).
// =====================
function memeAgent(req, res, next) {
  const idToken = req.utilisateur && req.utilisateur.agent_id;
  if (!idToken || String(idToken) !== String(req.params.id)) {
    return res.status(403).json({ erreur: "Vous ne pouvez modifier que votre propre compte." });
  }
  next();
}

// Consultation de son propre profil (pré-remplissage du formulaire).
router.get('/agent/:id/profil', requireFinance, memeAgent, async (req, res) => {
  try {
    const [agents] = await pool.query(
      'SELECT id, matricule, noms, prenom, email, telephone, fonction FROM agent WHERE id = ?',
      [req.params.id]
    );
    if (agents.length === 0) return res.status(404).json({ erreur: 'Agent non trouvé.' });
    res.json({ agent: agents[0] });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: erreur.message });
  }
});

// Modification de son identité (nom, prénom, email, téléphone). Le matricule
// reste géré par l'administration (identifiant de connexion).
router.put('/agent/:id/profil', requireFinance, memeAgent, async (req, res) => {
  const { noms, prenom, email, telephone } = req.body;
  if (!noms || !noms.trim()) return res.status(400).json({ erreur: 'Le nom est obligatoire.' });
  try {
    await pool.query(
      'UPDATE agent SET noms = ?, prenom = ?, email = ?, telephone = ? WHERE id = ?',
      [noms.trim(), prenom || null, email || null, telephone || null, req.params.id]
    );
    const [maj] = await pool.query(
      'SELECT id, matricule, noms, prenom, email, telephone, fonction FROM agent WHERE id = ?',
      [req.params.id]
    );
    journaliser({ role: req.utilisateur.role, utilisateur: `${maj[0].prenom || ''} ${maj[0].noms}`.trim(), identifiant: maj[0].matricule, action: 'Modification profil', details: 'Mise à jour de ses informations personnelles', ip: ipDeRequete(req) });
    res.json({ message: 'Profil mis à jour avec succès.', agent: maj[0] });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: erreur.message });
  }
});

// Changement de son mot de passe (vérifie l'ancien).
router.put('/agent/:id/password', requireFinance, memeAgent, async (req, res) => {
  const { mot_de_passe_actuel, nouveau_mot_de_passe } = req.body;
  if (!mot_de_passe_actuel || !nouveau_mot_de_passe)
    return res.status(400).json({ erreur: 'Tous les champs sont requis.' });
  if (nouveau_mot_de_passe.length < 6)
    return res.status(400).json({ erreur: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' });
  try {
    const [agents] = await pool.query('SELECT matricule, mot_de_passe FROM agent WHERE id = ?', [req.params.id]);
    if (agents.length === 0) return res.status(404).json({ erreur: 'Agent non trouvé.' });

    const valide = await bcrypt.compare(mot_de_passe_actuel, agents[0].mot_de_passe || '');
    if (!valide) return res.status(401).json({ erreur: 'Mot de passe actuel incorrect.' });

    const hash = await bcrypt.hash(nouveau_mot_de_passe, 10);
    await pool.query('UPDATE agent SET mot_de_passe = ? WHERE id = ?', [hash, req.params.id]);
    journaliser({ role: req.utilisateur.role, utilisateur: req.utilisateur.nom || agents[0].matricule, identifiant: agents[0].matricule, action: 'Changement mot de passe', details: 'A modifié son mot de passe', ip: ipDeRequete(req) });
    res.json({ message: 'Mot de passe mis à jour avec succès.' });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: erreur.message });
  }
});

module.exports = router;

require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const path      = require('path');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan    = require('morgan');
const pool      = require('./database');
const { requireAdmin } = require('./middleware/auth');
const { journaliserActionsAdmin } = require('./middleware/audit');
const { genererBulletinPDF } = require('./bulletin');
const upload    = require('./upload');
const app       = express();

// =====================
// VARIABLES D'ENVIRONNEMENT REQUISES — on échoue au démarrage plutôt qu'en pleine requête
// =====================
const envRequises = ['DB_HOST', 'DB_USER', 'DB_NAME', 'ADMIN_USER', 'ADMIN_PASS', 'JWT_SECRET'];
const envManquantes = envRequises.filter(cle => !process.env[cle]);
if (envManquantes.length > 0) {
  console.error(`❌ Variables d'environnement manquantes dans .env : ${envManquantes.join(', ')}`);
  process.exit(1);
}

// =====================
// PORT DYNAMIQUE — compatible avec Render, Railway, Heroku
// =====================
const PORT = process.env.PORT || 3000;

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' } // le frontend (autre origine) charge les images/PDF de /uploads
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// =====================
// CORS RESTREINT — seulement les origines autorisées
// =====================
const originesAutorisees = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  process.env.FRONTEND_URL, // ← ajoutez votre URL de production dans .env
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Permettre les requêtes sans origine (Postman, apps mobiles)
    if (!origin) return callback(null, true);
    if (originesAutorisees.includes(origin)) return callback(null, true);
    callback(new Error(`CORS bloqué pour l'origine : ${origin}`));
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(journaliserActionsAdmin);

// =====================
// RATE LIMITING — protection contre le bruteforce sur les routes de connexion
// =====================
const limiteurAuth = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { erreur: 'Trop de tentatives, réessayez dans quelques minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/auth', limiteurAuth);

// Fichiers uploadés accessibles via /uploads
app.use('/uploads', express.static(path.join(__dirname, '../frontend/uploads')));

// =====================
// TEST CONNEXION MySQL
// =====================
pool.getConnection()
  .then(connection => {
    console.log('✅ Connexion à MySQL réussie !');
    connection.release();
  })
  .catch(err => console.error('❌ Erreur MySQL :', err.message));

// =====================
// ROUTES
// =====================
const authRoutes          = require('./routes/auth');
const facultesRoutes      = require('./routes/facultes');
const notesRoutes         = require('./routes/notes');
const horairesRoutes      = require('./routes/horaires');
const programmeRoutes     = require('./routes/programme');
const annoncesRoutes      = require('./routes/annonces');
const preinscriptionRoutes = require('./routes/preinscription');
const professeursRoutes   = require('./routes/professeurs');
const paiementsRoutes     = require('./routes/paiements');
const inscriptionsRoutes  = require('./routes/inscriptions');
const reinscriptionsRoutes = require('./routes/reinscriptions');
const anneesRoutes        = require('./routes/annees');
const caisseRoutes        = require('./routes/caisse');
const agentsRoutes        = require('./routes/agents');

app.use('/api/auth',           authRoutes);
app.use('/api/facultes',       facultesRoutes);
app.use('/api/notes',          notesRoutes);
app.use('/api/horaires',       horairesRoutes);
app.use('/api/programme',      programmeRoutes);
app.use('/api/annonces',       annoncesRoutes);
app.use('/api/preinscription', preinscriptionRoutes);
app.use('/api/professeurs',    professeursRoutes);
app.use('/api/paiements',      paiementsRoutes);
app.use('/api/inscriptions',   inscriptionsRoutes);
app.use('/api/reinscriptions', reinscriptionsRoutes);
app.use('/api/annees',         anneesRoutes);
app.use('/api/caisse',         caisseRoutes);
app.use('/api/agents',         agentsRoutes);

// =====================
// STATISTIQUES (vue d'ensemble admin)
// =====================
app.get('/api/stats', requireAdmin, async (req, res) => {
  try {
    const [[{ etudiants }]]       = await pool.query('SELECT COUNT(*) AS etudiants FROM etudiant');
    const [[{ preinscriptions }]] = await pool.query('SELECT COUNT(*) AS preinscriptions FROM preinscription WHERE statut = "en_attente"');
    const [[{ cours }]]           = await pool.query('SELECT COUNT(*) AS cours FROM horaire');
    const [[{ annonces }]]        = await pool.query('SELECT COUNT(*) AS annonces FROM annonce WHERE actif = 1');
    res.json({ etudiants, preinscriptions, cours, annonces });
  } catch (erreur) {
    console.error('Erreur stats:', erreur);
    res.status(500).json({ erreur: erreur.message });
  }
});

// =====================
// STATISTIQUES AVANCÉES (vue d'ensemble admin)
// =====================
app.get('/api/stats/avancees', requireAdmin, async (req, res) => {
  try {
    const [evolution] = await pool.query(`
      SELECT DATE_FORMAT(date_soumission, '%Y-%m') AS mois, COUNT(*) AS total
      FROM preinscription
      GROUP BY mois
      ORDER BY mois ASC
    `);

    const [reussite] = await pool.query(`
      SELECT e.faculte,
             COUNT(*) AS total_notes,
             SUM(CASE WHEN n.note >= 10 THEN 1 ELSE 0 END) AS reussies
      FROM note n
      JOIN etudiant e ON n.etudiant_id = e.id
      WHERE n.note IS NOT NULL AND e.faculte IS NOT NULL
      GROUP BY e.faculte
    `);

    res.json({
      evolutionPreinscriptions: evolution,
      tauxReussiteParFaculte: reussite.map(r => ({
        faculte: r.faculte,
        totalNotes: r.total_notes,
        tauxReussite: Math.round((r.reussies / r.total_notes) * 100)
      }))
    });
  } catch (erreur) {
    res.status(500).json({ erreur: erreur.message });
  }
});

// =====================
// JOURNAL D'AUDIT (actions admin)
// =====================
app.get('/api/audit-log', requireAdmin, async (req, res) => {
  try {
    const [lignes] = await pool.query(
      'SELECT * FROM audit_log ORDER BY date_action DESC LIMIT 200'
    );
    res.json(lignes);
  } catch (erreur) {
    res.status(500).json({ erreur: erreur.message });
  }
});

// =====================
// ÉTUDIANTS (CRUD)
// =====================
app.get('/api/etudiants', requireAdmin, async (req, res) => {
  try {
    const { annee, promotion, nom, niveau, faculte } = req.query;
    let sql = 'SELECT * FROM etudiant WHERE 1=1';
    const params = [];
    if (annee)     { sql += ' AND annee_academique = ?'; params.push(annee); }
    if (promotion) { sql += ' AND promotion = ?'; params.push(promotion); }
    if (niveau)    { sql += ' AND niveau = ?'; params.push(niveau); }
    if (faculte)   { sql += ' AND faculte = ?'; params.push(faculte); }
    if (nom) {
      sql += ' AND (LOWER(nom) LIKE LOWER(?) OR LOWER(prenom) LIKE LOWER(?) OR LOWER(postnom) LIKE LOWER(?))';
      params.push(`%${nom}%`, `%${nom}%`, `%${nom}%`);
    }
    sql += ' ORDER BY nom, prenom';
    const [etudiants] = await pool.query(sql, params);
    res.json(etudiants);
  } catch (erreur) {
    res.status(500).json({ erreur: erreur.message });
  }
});

app.put('/api/etudiants/:id', requireAdmin, async (req, res) => {
  const { nom, postnom, prenom, date_naissance, sexe, email, telephone, faculte, promotion, niveau, annee_academique, statut } = req.body;
  if (!nom || !prenom) {
    return res.status(400).json({ erreur: 'Le nom et le prénom sont obligatoires.' });
  }
  try {
    // Recalcule filiere_id à partir du couple (faculté, promotion) à chaque
    // modification, pour que la relation reste cohérente avec le libellé
    // affiché — évite qu'ils divergent silencieusement comme avant (le champ
    // "promotion" pouvait être changé sans jamais mettre à jour filiere_id).
    let filiere_id = null;
    if (faculte && promotion) {
      const [[filiere]] = await pool.query(
        'SELECT f.id FROM filiere f JOIN faculte fa ON f.faculte_id = fa.id WHERE f.nom = ? AND fa.nom = ?',
        [promotion, faculte]
      );
      if (filiere) filiere_id = filiere.id;
    }

    await pool.query(
      `UPDATE etudiant SET nom=?,postnom=?,prenom=?,date_naissance=?,sexe=?,email=?,
       telephone=?,faculte=?,promotion=?,filiere_id=?,niveau=?,annee_academique=?,statut=? WHERE id=?`,
      [nom, postnom||null, prenom, date_naissance||null, sexe||null, email||null,
       telephone||null, faculte||null, promotion||null, filiere_id, niveau||null, annee_academique||null, statut||'actif', req.params.id]
    );
    res.json({ message: 'Étudiant mis à jour.' });
  } catch (erreur) { res.status(500).json({ erreur: erreur.message }); }
});

// Photo de l'étudiant (pour la carte) : téléversée depuis le disque par l'admin,
// stockée dans frontend/uploads. Chemin relatif enregistré dans etudiant.photo.
app.post('/api/etudiants/:id/photo', requireAdmin, upload.single('photo'), upload.verifierContenuFichiers, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ erreur: 'Aucune photo reçue.' });
    const chemin = 'uploads/' + req.file.filename;
    const [r] = await pool.query('UPDATE etudiant SET photo = ? WHERE id = ?', [chemin, req.params.id]);
    if (r.affectedRows === 0) return res.status(404).json({ erreur: 'Étudiant introuvable.' });
    res.status(201).json({ chemin });
  } catch (erreur) { res.status(500).json({ erreur: erreur.message }); }
});

app.delete('/api/etudiants/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM etudiant WHERE id = ?', [req.params.id]);
    res.json({ message: 'Étudiant supprimé.' });
  } catch (erreur) { res.status(500).json({ erreur: erreur.message }); }
});

// =====================
// NOTES PAR ÉTUDIANT (dashboard)
// =====================
app.get('/api/etudiant/:id/notes', async (req, res) => {
  try {
    // session/niveau/année viennent du cours : garantit le bon semestre et
    // permet de séparer les cursus (L1 2025-2026 vs L2 2026-2027) après promotion.
    const [notes] = await pool.query(`
      SELECT n.id, n.note_cc, n.note_examen, n.note, c.semestre AS session,
             c.annee_academique, c.niveau,
             c.nom AS matiere, c.code, c.credits
      FROM note n JOIN cours c ON n.cours_id = c.id
      WHERE n.etudiant_id = ?
      ORDER BY c.annee_academique DESC, c.semestre, c.code
    `, [req.params.id]);
    res.json(notes);
  } catch (erreur) { res.status(500).json({ erreur: erreur.message }); }
});

// =====================
// CURSUS D'UN ÉTUDIANT — périodes (niveau + année) suivies, pour consulter
// l'historique après une promotion.
// =====================
app.get('/api/etudiant/:id/cursus', async (req, res) => {
  try {
    const [[etu]] = await pool.query(
      'SELECT niveau, annee_academique, promotion, faculte FROM etudiant WHERE id = ?',
      [req.params.id]
    );
    if (!etu) return res.status(404).json({ erreur: 'Étudiant non trouvé.' });

    // Toutes les périodes où l'étudiant a des cours inscrits (courant + passés).
    const [periodes] = await pool.query(`
      SELECT DISTINCT c.niveau, c.annee_academique,
             COUNT(DISTINCT n.id) AS nb_notes
      FROM inscription_cours ic
      JOIN cours c ON c.id = ic.cours_id
      LEFT JOIN note n ON n.cours_id = c.id AND n.etudiant_id = ic.etudiant_id
      WHERE ic.etudiant_id = ?
      GROUP BY c.niveau, c.annee_academique
      ORDER BY c.annee_academique DESC, c.niveau DESC
    `, [req.params.id]);

    res.json({
      actuel: { niveau: etu.niveau, annee_academique: etu.annee_academique, promotion: etu.promotion, faculte: etu.faculte },
      periodes
    });
  } catch (erreur) { res.status(500).json({ erreur: erreur.message }); }
});

// =====================
// FRAIS DE SCOLARITÉ PAR ÉTUDIANT (dashboard)
// =====================
app.get('/api/etudiant/:id/paiements', async (req, res) => {
  try {
    const [etudiants] = await pool.query('SELECT id FROM etudiant WHERE id = ?', [req.params.id]);
    if (etudiants.length === 0) return res.status(404).json({ erreur: 'Étudiant non trouvé.' });

    const [paiements] = await pool.query(
      'SELECT id, montant, date_paiement, mode_paiement, reference, annee_academique FROM paiement WHERE etudiant_id = ? ORDER BY date_paiement DESC',
      [req.params.id]
    );
    const total = paiements.reduce((s, p) => s + Number(p.montant), 0);
    res.json({ paiements, total });
  } catch (erreur) { res.status(500).json({ erreur: erreur.message }); }
});

// =====================
// BULLETIN PDF PAR ÉTUDIANT — réservé à l'administrateur, l'étudiant n'a
// pas le droit d'imprimer/télécharger son propre bulletin.
// =====================
app.get('/api/etudiant/:id/bulletin', requireAdmin, async (req, res) => {
  try {
    const [etudiants] = await pool.query('SELECT * FROM etudiant WHERE id = ?', [req.params.id]);
    if (etudiants.length === 0) return res.status(404).json({ erreur: 'Étudiant non trouvé.' });

    const [notes] = await pool.query(`
      SELECT n.note, n.session, c.nom AS matiere, c.code, c.credits
      FROM note n JOIN cours c ON n.cours_id = c.id
      WHERE n.etudiant_id = ?
      ORDER BY n.session, c.code
    `, [req.params.id]);

    genererBulletinPDF(res, etudiants[0], notes);
  } catch (erreur) {
    console.error('Erreur bulletin:', erreur);
    res.status(500).json({ erreur: erreur.message });
  }
});

// =====================
// HORAIRES PAR ÉTUDIANT (dashboard)
// =====================
app.get('/api/etudiant/:id/horaires', async (req, res) => {
  try {
    const [etudiants] = await pool.query('SELECT id FROM etudiant WHERE id = ?', [req.params.id]);
    if (etudiants.length === 0) return res.status(404).json({ erreur: 'Étudiant non trouvé.' });

    // Basé sur les inscriptions individuelles (inscription_cours), pas sur la
    // simple correspondance de promotion : gère les cours partagés entre
    // facultés et les cours de rattrapage suivis hors de la promotion actuelle.
    const [horaires] = await pool.query(`
      SELECT h.id, h.jour, h.date_debut, h.heure_debut, h.heure_fin, h.salle,
             h.annee_academique, h.promotion,
             c.nom AS cours, c.code,
             p.nom AS professeur, p.grade
      FROM inscription_cours ic
      JOIN horaire h ON h.cours_id = ic.cours_id
      JOIN cours c ON h.cours_id = c.id
      LEFT JOIN professeur p ON h.professeur_id = p.id
      WHERE ic.etudiant_id = ?
      ORDER BY FIELD(h.jour,'Lundi','Mardi','Mercredi','Jeudi','Vendredi'), h.heure_debut
    `, [req.params.id]);
    res.json(horaires);
  } catch (erreur) { res.status(500).json({ erreur: erreur.message }); }
});

// =====================
// PROGRAMME PAR ÉTUDIANT (dashboard)
// =====================
app.get('/api/etudiant/:id/programme', async (req, res) => {
  try {
    const [etudiants] = await pool.query('SELECT id FROM etudiant WHERE id = ?', [req.params.id]);
    if (etudiants.length === 0) return res.status(404).json({ erreur: 'Étudiant non trouvé.' });

    const [cours] = await pool.query(`
      SELECT c.* FROM inscription_cours ic
      JOIN cours c ON ic.cours_id = c.id
      WHERE ic.etudiant_id = ?
      ORDER BY c.semestre, c.code
    `, [req.params.id]);
    res.json(cours);
  } catch (erreur) { res.status(500).json({ erreur: erreur.message }); }
});

// =====================
// HORAIRE DU PROFESSEUR (espace professeur)
// =====================
app.get('/api/professeur/:id/horaires', async (req, res) => {
  try {
    const [horaires] = await pool.query(`
      SELECT h.id, h.jour, h.date_debut, h.heure_debut, h.heure_fin, h.salle, h.promotion, h.annee_academique,
             c.id AS cours_id, c.nom AS cours, c.code,
             (SELECT COUNT(*) FROM inscription_cours ic WHERE ic.cours_id = c.id) AS nb_etudiants
      FROM horaire h
      JOIN cours c ON h.cours_id = c.id
      WHERE h.professeur_id = ?
      ORDER BY FIELD(h.jour,'Lundi','Mardi','Mercredi','Jeudi','Vendredi'), h.heure_debut
    `, [req.params.id]);
    res.json(horaires);
  } catch (erreur) { res.status(500).json({ erreur: erreur.message }); }
});

// =====================
// COURS ENSEIGNÉS PAR LE PROFESSEUR (pour la saisie de notes)
// =====================
app.get('/api/professeur/:id/cours', async (req, res) => {
  try {
    // Cours attribués au professeur (voir "Attributions des cours"), indépendamment
    // de l'existence d'un créneau horaire — un cours peut être attribué avant d'être programmé.
    const [cours] = await pool.query(`
      SELECT c.id, c.code, c.nom, c.promotion, c.annee_academique, c.semestre, c.credits
      FROM cours c
      WHERE c.professeur_id = ?
      ORDER BY c.annee_academique DESC, c.promotion, c.code
    `, [req.params.id]);
    res.json(cours);
  } catch (erreur) { res.status(500).json({ erreur: erreur.message }); }
});

// =====================
// ÉTUDIANTS D'UN COURS ENSEIGNÉ PAR LE PROFESSEUR + leurs notes existantes
// =====================
app.get('/api/professeur/:id/cours/:coursId/etudiants', async (req, res) => {
  try {
    const [autorise] = await pool.query(
      'SELECT 1 FROM cours WHERE id = ? AND professeur_id = ? LIMIT 1',
      [req.params.coursId, req.params.id]
    );
    if (autorise.length === 0) return res.status(403).json({ erreur: "Vous n'enseignez pas ce cours." });

    // Étudiants réellement inscrits au cours (inscription_cours), pas seulement
    // ceux dont la promotion correspond — gère cours partagés et rattrapages.
    const [etudiants] = await pool.query(`
      SELECT e.id, e.nom, e.postnom, e.prenom,
             n.id AS note_id, n.note_cc, n.note_examen, n.note, n.session
      FROM inscription_cours ic
      JOIN etudiant e ON e.id = ic.etudiant_id
      LEFT JOIN note n ON n.etudiant_id = e.id AND n.cours_id = ?
      WHERE ic.cours_id = ?
      ORDER BY e.nom, e.prenom
    `, [req.params.coursId, req.params.coursId]);
    res.json(etudiants);
  } catch (erreur) { res.status(500).json({ erreur: erreur.message }); }
});

// =====================
// SAISIE / MODIFICATION D'UNE NOTE PAR LE PROFESSEUR (uniquement ses propres cours)
// =====================
app.post('/api/professeur/:id/notes', async (req, res) => {
  const { etudiant_id, cours_id, note_cc, note_examen, annee_academique } = req.body;
  if (!etudiant_id || !cours_id) {
    return res.status(400).json({ erreur: 'Champs obligatoires manquants (étudiant, cours).' });
  }
  if (note_cc === undefined && note_examen === undefined) {
    return res.status(400).json({ erreur: "Renseignez au moins le contrôle continu ou l'examen." });
  }
  const horsPlage = v => v !== undefined && v !== null && (v < 0 || v > 20);
  if (horsPlage(note_cc) || horsPlage(note_examen)) {
    return res.status(400).json({ erreur: 'Le contrôle continu et l\'examen doivent être compris entre 0 et 20.' });
  }
  try {
    // La session est TOUJOURS le semestre du cours : un cours = un seul
    // semestre, donc une seule note par étudiant/cours (pas de doublon S1/S2).
    const [[cours]] = await pool.query(
      'SELECT semestre FROM cours WHERE id = ? AND professeur_id = ?',
      [cours_id, req.params.id]
    );
    if (!cours) return res.status(403).json({ erreur: "Vous n'enseignez pas ce cours." });
    const session = cours.semestre;

    // Le CC et l'examen peuvent arriver séparément : on fusionne avec la note
    // déjà enregistrée pour cet étudiant/cours au lieu de l'écraser.
    const [existante] = await pool.query(
      'SELECT id, note_cc, note_examen FROM note WHERE etudiant_id = ? AND cours_id = ?',
      [etudiant_id, cours_id]
    );

    const ccFinal     = note_cc     !== undefined ? note_cc     : (existante.length ? existante[0].note_cc     : null);
    const examenFinal = note_examen !== undefined ? note_examen : (existante.length ? existante[0].note_examen : null);
    // Moyenne sur 20 (50 % CC + 50 % examen) seulement quand les deux sont connus.
    // MySQL renvoie les colonnes DECIMAL sous forme de chaînes : Number() évite
    // une concaténation de chaînes au lieu d'une addition numérique.
    const note = (ccFinal === null || examenFinal === null) ? null : Math.round(((Number(ccFinal) + Number(examenFinal)) / 2) * 100) / 100;

    if (existante.length > 0) {
      await pool.query('UPDATE note SET note_cc = ?, note_examen = ?, note = ?, session = ? WHERE id = ?', [ccFinal, examenFinal, note, session, existante[0].id]);
      return res.json({ message: 'Note mise à jour.', id: existante[0].id, note });
    }

    const [r] = await pool.query(
      'INSERT INTO note (etudiant_id, cours_id, note_cc, note_examen, note, session, annee_academique) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [etudiant_id, cours_id, ccFinal, examenFinal, note, session, annee_academique]
    );
    res.status(201).json({ message: 'Note enregistrée.', id: r.insertId, note });
  } catch (erreur) { res.status(500).json({ erreur: erreur.message }); }
});

// =====================
// ROUTE INCONNUE — toute route /api/* non gérée renvoie du JSON, pas la page HTML par défaut d'Express
// =====================
app.use('/api', (req, res) => {
  res.status(404).json({ erreur: 'Route introuvable.' });
});

// =====================
// GESTIONNAIRE D'ERREURS CENTRALISÉ — filet de sécurité pour les erreurs non
// interceptées par les try/catch des routes (CORS, JSON malformé, upload trop
// volumineux, etc.) : toujours une réponse JSON cohérente, jamais de page HTML.
// =====================
app.use((err, req, res, next) => {
  console.error('Erreur non gérée:', err.message);
  if (err.message?.startsWith('CORS bloqué')) {
    return res.status(403).json({ erreur: err.message });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ erreur: 'Corps de requête JSON invalide.' });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ erreur: 'Fichier trop volumineux (5 Mo maximum).' });
  }
  res.status(err.status || 500).json({ erreur: err.message || 'Erreur interne du serveur.' });
});

// =====================
// DÉMARRAGE
// =====================
app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
});

require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const path      = require('path');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan    = require('morgan');
const pool      = require('./database');
const { requireAdmin, requireAdminOuDoyen, faculteDuDoyen } = require('./middleware/auth');
const { journaliserActionsAdmin } = require('./middleware/audit');
const crypto      = require('crypto');
const bcrypt      = require('bcryptjs');
const { genererBulletinPDF } = require('./bulletin');
const { envoyerEmailReinitialisation } = require('./mailer');
const { inscrireAuxCoursDuNiveau } = require('./models/inscriptionAuto');
const { journaliser, ipDeRequete, acteurDeReq } = require('./models/audit');
const { nomMajuscule } = require('./nom');
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
const { assurerSchema } = require('./models/ensureSchema');
pool.getConnection()
  .then(async connection => {
    console.log('✅ Connexion à MySQL réussie !');
    connection.release();
    try { await assurerSchema(pool); }
    catch (e) { console.error('⚠️ Vérification du schéma échouée :', e.message); }
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
const fraisScolariteRoutes = require('./routes/fraisScolarite');
const newsletterRoutes    = require('./routes/newsletter');
const contactRoutes       = require('./routes/contact');
const filieresRoutes      = require('./routes/filieres');
const auditRoutes         = require('./routes/audit');

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
app.use('/api/frais-scolarite', fraisScolariteRoutes);
app.use('/api/newsletter',     newsletterRoutes);
app.use('/api/contact',        contactRoutes);
app.use('/api/filieres',       filieresRoutes);
app.use('/api/audit',          auditRoutes);

// =====================
// STATISTIQUES (vue d'ensemble admin)
// =====================
app.get('/api/stats', requireAdminOuDoyen, async (req, res) => {
  try {
    const { annee } = req.query;
    // Doyen : tous les décomptes sont restreints à SA faculté.
    const facDoyen = faculteDuDoyen(req);

    // Étudiants : profil courant OU historique d'inscription_cours pour
    // cette année (même logique que /api/etudiants) — un étudiant promu ne
    // doit pas disparaître du décompte d'une année qu'il a réellement suivie.
    // Pour un doyen, décompte simple restreint à sa faculté.
    let etudiants;
    if (facDoyen) {
      const cond = ['faculte = ?']; const p = [facDoyen];
      if (annee) { cond.push('annee_academique = ?'); p.push(annee); }
      [[{ etudiants }]] = await pool.query('SELECT COUNT(*) AS etudiants FROM etudiant WHERE ' + cond.join(' AND '), p);
    } else if (annee) {
      [[{ etudiants }]] = await pool.query(`
          SELECT COUNT(DISTINCT id) AS etudiants FROM (
            SELECT e.id FROM etudiant e WHERE e.annee_academique = ?
            UNION
            SELECT ic.etudiant_id AS id FROM inscription_cours ic JOIN cours c ON c.id = ic.cours_id WHERE c.annee_academique = ?
          ) x
        `, [annee, annee]);
    } else {
      [[{ etudiants }]] = await pool.query('SELECT COUNT(*) AS etudiants FROM etudiant');
    }

    // Pré-inscriptions en attente : global pour l'admin ; pour un doyen,
    // celles dont la spécialité correspond à une filière de sa faculté (ou au
    // nom de sa faculté, pour les licences non subdivisées).
    let preinscriptions;
    if (facDoyen) {
      [[{ preinscriptions }]] = await pool.query(
        `SELECT COUNT(*) AS preinscriptions FROM preinscription
         WHERE statut = "en_attente" AND (specialite = ? OR specialite IN (
           SELECT f.nom FROM filiere f JOIN faculte fa ON f.faculte_id = fa.id WHERE fa.nom = ?))`,
        [facDoyen, facDoyen]);
    } else {
      [[{ preinscriptions }]] = await pool.query('SELECT COUNT(*) AS preinscriptions FROM preinscription WHERE statut = "en_attente"');
    }

    // « Cours programmés » = nombre de cours DISTINCTS planifiés dans la semaine
    // en cours (lundi → dimanche contenant aujourd'hui), pas le nombre de
    // créneaux. Restreint à la faculté du doyen (cours communs inclus).
    const borneSemaine = `h.date_debut BETWEEN
        DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
        AND DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 6 DAY)`;
    let coursSql = 'SELECT COUNT(DISTINCT h.cours_id) AS cours FROM horaire h';
    const coursCond = [borneSemaine]; const coursParams = [];
    if (facDoyen) { coursSql += ' JOIN cours c ON c.id = h.cours_id'; coursCond.push('(c.faculte = ? OR c.faculte IS NULL)'); coursParams.push(facDoyen); }
    if (annee)    { coursCond.push('h.annee_academique = ?'); coursParams.push(annee); }
    coursSql += ' WHERE ' + coursCond.join(' AND ');
    const [[{ cours }]] = await pool.query(coursSql, coursParams);

    // Annonces actives : global pour l'admin ; pour un doyen, celles ciblant sa
    // faculté ou diffusées à tous (cible_faculte NULL).
    let annonces;
    if (facDoyen) {
      [[{ annonces }]] = await pool.query('SELECT COUNT(*) AS annonces FROM annonce WHERE actif = 1 AND (cible_faculte = ? OR cible_faculte IS NULL)', [facDoyen]);
    } else {
      [[{ annonces }]] = await pool.query('SELECT COUNT(*) AS annonces FROM annonce WHERE actif = 1');
    }

    res.json({ etudiants, preinscriptions, cours, annonces });
  } catch (erreur) {
    console.error('Erreur stats:', erreur);
    res.status(500).json({ erreur: erreur.message });
  }
});

// =====================
// STATISTIQUES AVANCÉES (vue d'ensemble admin)
// =====================
app.get('/api/stats/avancees', requireAdminOuDoyen, async (req, res) => {
  try {
    const facDoyen = faculteDuDoyen(req);

    // Évolution des pré-inscriptions : pour un doyen, restreinte aux candidatures
    // de sa faculté (spécialité = filière de sa faculté ou nom de la faculté).
    const [evolution] = await pool.query(
      `SELECT DATE_FORMAT(date_soumission, '%Y-%m') AS mois, COUNT(*) AS total
       FROM preinscription
       ${facDoyen ? `WHERE (specialite = ? OR specialite IN (
         SELECT f.nom FROM filiere f JOIN faculte fa ON f.faculte_id = fa.id WHERE fa.nom = ?))` : ''}
       GROUP BY mois ORDER BY mois ASC`,
      facDoyen ? [facDoyen, facDoyen] : []
    );

    const [reussite] = await pool.query(
      `SELECT e.faculte,
             COUNT(*) AS total_notes,
             SUM(CASE WHEN n.note >= 10 THEN 1 ELSE 0 END) AS reussies
      FROM note n
      JOIN etudiant e ON n.etudiant_id = e.id
      WHERE n.note IS NOT NULL AND e.faculte IS NOT NULL
      ${facDoyen ? 'AND e.faculte = ?' : ''}
      GROUP BY e.faculte`,
      facDoyen ? [facDoyen] : []
    );

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
// GET ouvert au décanat (chart de la vue d'ensemble + recherche « Délibérer »),
// TOUJOURS restreint à la faculté du doyen. Les écritures (PUT/DELETE/photo/
// réinit. mot de passe) restent réservées à l'admin (requireAdmin).
app.get('/api/etudiants', requireAdminOuDoyen, async (req, res) => {
  try {
    const { annee, promotion, nom, niveau } = req.query;
    // Un doyen ne peut jamais élargir au-delà de sa faculté (le filtre client
    // est ignoré au profit de sa faculté de rattachement).
    const faculte = faculteDuDoyen(req) || req.query.faculte;
    let sql, params = [];

    if (annee || niveau) {
      // Un étudiant promu (L1 → L2 → ...) ne garde qu'un niveau/année
      // "courant" sur sa fiche : filtrer une année passée sur ces seules
      // colonnes le ferait disparaître des listes, alors que son historique
      // de cours (inscription_cours) n'est jamais supprimé à la promotion.
      // On le retrouve donc aussi via ses inscriptions de cette période, et
      // les colonnes affichées (faculté/promotion/niveau/année) reflètent
      // alors CETTE période précise plutôt que son profil courant.
      // « niveau_actuel » etc. gardent le vrai profil courant à part, pour
      // que la modification (modifierInscrit) n'écrase jamais une promotion
      // par erreur avec des valeurs historiques affichées dans la liste.
      const condHist = [];
      if (annee)  condHist.push('c.annee_academique = ?');
      if (niveau) condHist.push('c.niveau = ?');
      const condCourant = [];
      if (annee)  condCourant.push('e.annee_academique = ?');
      if (niveau) condCourant.push('e.niveau = ?');

      sql = `
        SELECT * FROM (
          SELECT e.id, e.nom, e.postnom, e.prenom, e.date_naissance, e.lieu_naissance,
                 e.nationalite, e.sexe, e.email, e.telephone, e.adresse, e.filiere_id,
                 fil.nom AS filiere,
                 e.statut, e.photo,
                 e.faculte AS faculte_actuelle, e.promotion AS promotion_actuelle,
                 e.niveau AS niveau_actuel, e.annee_academique AS annee_academique_actuelle,
                 COALESCE(h.faculte, e.faculte)                     AS faculte,
                 COALESCE(h.promotion, e.promotion)                 AS promotion,
                 COALESCE(h.niveau, e.niveau)                       AS niveau,
                 COALESCE(h.annee_academique, e.annee_academique)   AS annee_academique,
                 (h.etudiant_id IS NOT NULL AND NOT (${condCourant.length ? condCourant.join(' AND ') : '1=1'})) AS historique
          FROM etudiant e
          LEFT JOIN filiere fil ON e.filiere_id = fil.id
          LEFT JOIN (
            SELECT ic.etudiant_id,
                   MAX(c.faculte) AS faculte, MAX(c.promotion) AS promotion,
                   MAX(c.niveau) AS niveau, MAX(c.annee_academique) AS annee_academique
            FROM inscription_cours ic
            JOIN cours c ON c.id = ic.cours_id
            ${condHist.length ? 'WHERE ' + condHist.join(' AND ') : ''}
            GROUP BY ic.etudiant_id
          ) h ON h.etudiant_id = e.id
          WHERE (h.etudiant_id IS NOT NULL${condCourant.length ? ' OR (' + condCourant.join(' AND ') + ')' : ''})
        ) e
        WHERE 1=1
      `;
      // Ordre des paramètres : condCourant (dans le SELECT "historique"), condHist, condCourant (dans le WHERE final).
      if (annee)  params.push(annee);
      if (niveau) params.push(niveau);
      if (annee)  params.push(annee);
      if (niveau) params.push(niveau);
      if (annee)  params.push(annee);
      if (niveau) params.push(niveau);
    } else {
      sql = `
        SELECT e.id, e.nom, e.postnom, e.prenom, e.date_naissance, e.lieu_naissance,
               e.nationalite, e.sexe, e.email, e.telephone, e.adresse, e.filiere_id,
               fil.nom AS filiere,
               e.statut, e.photo, e.faculte, e.promotion, e.niveau, e.annee_academique,
               e.faculte AS faculte_actuelle, e.promotion AS promotion_actuelle,
               e.niveau AS niveau_actuel, e.annee_academique AS annee_academique_actuelle,
               FALSE AS historique
        FROM etudiant e
        LEFT JOIN filiere fil ON e.filiere_id = fil.id
        WHERE 1=1
      `;
    }

    // Filtre par filière/promotion ROBUSTE : le paramètre est un nom de filière
    // (ex. « Informatique de Gestion »), mais la colonne promotion affichée peut
    // être préfixée du niveau (« L1 Informatique de Gestion », dérivée des cours)
    // — une égalité stricte échouerait. On matche donc soit la promotion exacte,
    // soit — surtout — la filière de rattachement de l'étudiant (filiere_id),
    // qui est la source de vérité indépendante du libellé.
    if (promotion) {
      sql += ' AND (e.promotion = ? OR e.filiere_id IN (SELECT id FROM filiere WHERE nom = ?))';
      params.push(promotion, promotion);
    }
    if (faculte)   { sql += ' AND e.faculte = ?';   params.push(faculte); }
    if (nom) {
      // Recherche par nom, post-nom, prénom OU matricule (e.id) — utilisée par
      // la promotion et par l'onglet « Délibérer ».
      sql += ' AND (LOWER(e.nom) LIKE LOWER(?) OR LOWER(e.prenom) LIKE LOWER(?) OR LOWER(e.postnom) LIKE LOWER(?) OR LOWER(e.id) LIKE LOWER(?))';
      params.push(`%${nom}%`, `%${nom}%`, `%${nom}%`, `%${nom}%`);
    }
    sql += ' ORDER BY e.nom, e.prenom';

    const [etudiants] = await pool.query(sql, params);
    res.json(etudiants);
  } catch (erreur) {
    console.error(erreur);
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
      [nomMajuscule(nom), postnom||null, prenom, date_naissance||null, sexe||null, email||null,
       telephone||null, faculte||null, promotion||null, filiere_id, niveau||null, annee_academique||null, statut||'actif', req.params.id]
    );

    // Une correction manuelle de faculté/niveau/année doit aussi ramener les
    // cours déjà programmés pour ce nouveau profil — même logique que la
    // création/promotion (voir models/inscriptionAuto.js).
    await inscrireAuxCoursDuNiveau(req.params.id, faculte, niveau, filiere_id, annee_academique);

    journaliser({ ...acteurDeReq(req), action: 'Modification étudiant', details: `${nom} ${prenom} (${req.params.id}) · ${niveau || ''} ${promotion || ''}`.trim(), ip: ipDeRequete(req) });
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
    // On récupère le nom avant suppression, pour un journal d'audit lisible.
    const [[etu]] = await pool.query('SELECT nom, postnom, prenom FROM etudiant WHERE id = ?', [req.params.id]);
    await pool.query('DELETE FROM etudiant WHERE id = ?', [req.params.id]);
    const libelle = etu ? `${etu.nom || ''} ${etu.postnom || ''} ${etu.prenom || ''}`.replace(/\s+/g, ' ').trim() : '';
    journaliser({ ...acteurDeReq(req), action: 'Suppression étudiant', details: `${libelle} (${req.params.id})`.trim(), ip: ipDeRequete(req) });
    res.json({ message: 'Étudiant supprimé.' });
  } catch (erreur) { res.status(500).json({ erreur: erreur.message }); }
});

// Réinitialise le mot de passe d'un étudiant : génère un nouveau mot de passe
// temporaire, le hash (le clair n'est jamais stocké), et le renvoie à l'admin
// dans la réponse — indispensable si l'étudiant n'a pas d'email au dossier ou
// si l'envoi automatique à la création du compte a échoué/n'a jamais eu lieu.
app.post('/api/etudiants/:id/reinitialiser-mot-de-passe', requireAdmin, async (req, res) => {
  try {
    const [etudiants] = await pool.query('SELECT id, nom, prenom, email FROM etudiant WHERE id = ?', [req.params.id]);
    if (etudiants.length === 0) return res.status(404).json({ erreur: 'Étudiant non trouvé.' });
    const etudiant = etudiants[0];

    const motDePasse = crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, '').slice(0, 12);
    const hash = await bcrypt.hash(motDePasse, 10);
    await pool.query('UPDATE etudiant SET mot_de_passe = ? WHERE id = ?', [hash, req.params.id]);

    const emailEnvoye = etudiant.email
      ? await envoyerEmailReinitialisation(etudiant, motDePasse).then(() => true).catch(err => { console.error('⚠️ Erreur envoi email:', err.message); return false; })
      : false;

    journaliser({ ...acteurDeReq(req), action: 'Réinit. mot de passe étudiant', details: `${etudiant.nom || ''} ${etudiant.prenom || ''} (${etudiant.id})`.trim(), ip: ipDeRequete(req) });
    res.json({ matricule: etudiant.id, motDePasseTemporaire: motDePasse, emailEnvoye });
  } catch (erreur) { res.status(500).json({ erreur: erreur.message }); }
});

// =====================
// NOTES PAR ÉTUDIANT (dashboard)
// =====================
app.get('/api/etudiant/:id/notes', async (req, res) => {
  try {
    // Part des cours SUIVIS (inscription_cours), pas des notes déjà saisies :
    // sinon un étudiant sans aucune note (début de semestre, cours pas encore
    // corrigé...) apparaît à tort avec 0 cours au tableau de bord. La note
    // reste simplement NULL tant qu'elle n'a pas été saisie.
    // session/niveau/année viennent du cours : garantit le bon semestre et
    // permet de séparer les cursus (L1 2025-2026 vs L2 2026-2027) après promotion.
    const [notes] = await pool.query(`
      SELECT n.id, n.note_cc, n.note_examen, n.note, n.modifie_le, c.semestre AS session,
             c.annee_academique, c.niveau, c.id AS cours_id,
             c.nom AS matiere, c.code, c.credits, c.cmi, c.td, c.tp
      FROM inscription_cours ic
      JOIN cours c ON ic.cours_id = c.id
      LEFT JOIN note n ON n.etudiant_id = ic.etudiant_id AND n.cours_id = c.id
      WHERE ic.etudiant_id = ?
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
    const [etudiants] = await pool.query('SELECT id, faculte, promotion, niveau, annee_academique FROM etudiant WHERE id = ?', [req.params.id]);
    if (etudiants.length === 0) return res.status(404).json({ erreur: 'Étudiant non trouvé.' });
    const etu = etudiants[0];

    const [paiements] = await pool.query(
      'SELECT id, montant, date_paiement, mode_paiement, rubrique, reference, annee_academique FROM paiement WHERE etudiant_id = ? ORDER BY date_paiement DESC',
      [req.params.id]
    );
    const total = paiements.reduce((s, p) => s + Number(p.montant), 0);

    // Solde restant = SOMME de toutes les rubriques du barème (frais_scolarite)
    // de la faculté/filière/niveau/année de l'étudiant − ses versements de cette
    // même année. null si aucun barème n'a encore été défini.
    const [[bareme]] = await pool.query(
      'SELECT SUM(montant) AS total FROM frais_scolarite WHERE faculte = ? AND promotion = ? AND niveau = ? AND annee_academique = ?',
      [etu.faculte, etu.promotion, etu.niveau, etu.annee_academique]
    );
    const totalAnneeCourante = paiements
      .filter(p => p.annee_academique === etu.annee_academique)
      .reduce((s, p) => s + Number(p.montant), 0);
    const montant_attendu = bareme && bareme.total !== null ? Number(bareme.total) : null;
    const solde = montant_attendu === null ? null : Math.max(0, montant_attendu - totalAnneeCourante);

    res.json({ paiements, total, montant_attendu, solde });
  } catch (erreur) { res.status(500).json({ erreur: erreur.message }); }
});

// =====================
// BULLETIN PDF PAR ÉTUDIANT — réservé à l'administrateur, l'étudiant n'a
// pas le droit d'imprimer/télécharger son propre bulletin.
// =====================
app.get('/api/etudiant/:id/bulletin', requireAdmin, async (req, res) => {
  try {
    const [etudiants] = await pool.query(
      'SELECT e.*, f.nom AS filiere_nom FROM etudiant e LEFT JOIN filiere f ON e.filiere_id = f.id WHERE e.id = ?',
      [req.params.id]
    );
    if (etudiants.length === 0) return res.status(404).json({ erreur: 'Étudiant non trouvé.' });

    // Bulletin = année académique COURANTE de l'étudiant uniquement. Sans ce
    // filtre, un étudiant réinscrit (ex. L1 2026-2027 puis L2 2027-2028) verrait
    // les notes des deux années mélangées sur le même bulletin.
    const [notes] = await pool.query(`
      SELECT n.note, n.note_cc, n.note_examen, n.session, c.id AS cours_id, c.nom AS matiere, c.code, c.credits, n.annee_academique
      FROM note n JOIN cours c ON n.cours_id = c.id
      WHERE n.etudiant_id = ? AND n.annee_academique = ?
      ORDER BY n.session, c.code
    `, [req.params.id, etudiants[0].annee_academique]);

    // Assiduité par cours, agrégée pour être répartie ensuite par semestre
    // (chaque note connaît déjà son cours_id et sa session S1/S2).
    const [presenceLignes] = await pool.query(`
      SELECT h.cours_id, p.statut
      FROM presence p JOIN horaire h ON h.id = p.horaire_id
      WHERE p.etudiant_id = ?
    `, [req.params.id]);
    const presencesParCours = {};
    for (const l of presenceLignes) {
      if (!presencesParCours[l.cours_id]) presencesParCours[l.cours_id] = { cours_id: l.cours_id, total: 0, present: 0, absent: 0, retard: 0 };
      presencesParCours[l.cours_id].total++;
      presencesParCours[l.cours_id][l.statut]++;
    }

    genererBulletinPDF(res, etudiants[0], notes, Object.values(presencesParCours));
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
      SELECT c.id, c.code, c.nom, c.faculte, c.niveau, c.promotion, c.annee_academique,
             c.semestre, c.credits, c.cmi, c.td, c.tp
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
// PRÉSENCES — feuille d'appel d'une séance (espace professeur, uniquement ses propres cours)
// =====================
app.get('/api/professeur/:id/horaires/:horaireId/presences', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ erreur: "Le paramètre date est obligatoire." });
  try {
    const [autorise] = await pool.query(
      'SELECT cours_id FROM horaire WHERE id = ? AND professeur_id = ? LIMIT 1',
      [req.params.horaireId, req.params.id]
    );
    if (autorise.length === 0) return res.status(403).json({ erreur: "Ce créneau ne vous appartient pas." });

    // Étudiants inscrits au cours de ce créneau, avec leur statut de
    // présence pour cette date précise s'il a déjà été saisi.
    const [etudiants] = await pool.query(`
      SELECT e.id, e.nom, e.postnom, e.prenom, p.statut
      FROM inscription_cours ic
      JOIN etudiant e ON e.id = ic.etudiant_id
      LEFT JOIN presence p ON p.etudiant_id = e.id AND p.horaire_id = ? AND p.date_seance = ?
      WHERE ic.cours_id = ?
      ORDER BY e.nom, e.prenom
    `, [req.params.horaireId, date, autorise[0].cours_id]);
    res.json(etudiants);
  } catch (erreur) { res.status(500).json({ erreur: erreur.message }); }
});

app.post('/api/professeur/:id/horaires/:horaireId/presences', async (req, res) => {
  const { date_seance, presences } = req.body;
  if (!date_seance || !Array.isArray(presences) || presences.length === 0) {
    return res.status(400).json({ erreur: "Date de séance et liste de présences obligatoires." });
  }
  const statutsValides = ['present', 'absent', 'retard'];
  if (presences.some(p => !p.etudiant_id || !statutsValides.includes(p.statut))) {
    return res.status(400).json({ erreur: "Chaque présence doit préciser un étudiant et un statut valide." });
  }
  // La saisie/modification n'est autorisée que le jour même de la séance
  // (comparaison en UTC, cohérente avec les dates de colonnes du calendrier
  // envoyées par le frontend).
  if (date_seance !== new Date().toISOString().slice(0, 10)) {
    return res.status(403).json({ erreur: "Les présences ne peuvent être saisies ou modifiées que le jour même du cours." });
  }
  try {
    const [autorise] = await pool.query(
      'SELECT 1 FROM horaire WHERE id = ? AND professeur_id = ? LIMIT 1',
      [req.params.horaireId, req.params.id]
    );
    if (autorise.length === 0) return res.status(403).json({ erreur: "Ce créneau ne vous appartient pas." });

    for (const p of presences) {
      await pool.query(
        `INSERT INTO presence (horaire_id, etudiant_id, date_seance, statut) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE statut = VALUES(statut)`,
        [req.params.horaireId, p.etudiant_id, date_seance, p.statut]
      );
    }
    res.status(201).json({ message: 'Présences enregistrées.' });
  } catch (erreur) { res.status(500).json({ erreur: erreur.message }); }
});

// =====================
// PRÉSENCES — feuille d'appel d'une séance (espace admin, tous les cours,
// même règle de verrouillage au jour même que côté professeur)
// =====================
app.get('/api/admin/horaires/:horaireId/presences', requireAdmin, async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ erreur: "Le paramètre date est obligatoire." });
  try {
    const [horaireLigne] = await pool.query('SELECT cours_id FROM horaire WHERE id = ? LIMIT 1', [req.params.horaireId]);
    if (horaireLigne.length === 0) return res.status(404).json({ erreur: "Créneau introuvable." });

    const [etudiants] = await pool.query(`
      SELECT e.id, e.nom, e.postnom, e.prenom, p.statut
      FROM inscription_cours ic
      JOIN etudiant e ON e.id = ic.etudiant_id
      LEFT JOIN presence p ON p.etudiant_id = e.id AND p.horaire_id = ? AND p.date_seance = ?
      WHERE ic.cours_id = ?
      ORDER BY e.nom, e.prenom
    `, [req.params.horaireId, date, horaireLigne[0].cours_id]);
    res.json(etudiants);
  } catch (erreur) { res.status(500).json({ erreur: erreur.message }); }
});

app.post('/api/admin/horaires/:horaireId/presences', requireAdmin, async (req, res) => {
  const { date_seance, presences } = req.body;
  if (!date_seance || !Array.isArray(presences) || presences.length === 0) {
    return res.status(400).json({ erreur: "Date de séance et liste de présences obligatoires." });
  }
  const statutsValides = ['present', 'absent', 'retard'];
  if (presences.some(p => !p.etudiant_id || !statutsValides.includes(p.statut))) {
    return res.status(400).json({ erreur: "Chaque présence doit préciser un étudiant et un statut valide." });
  }
  if (date_seance !== new Date().toISOString().slice(0, 10)) {
    return res.status(403).json({ erreur: "Les présences ne peuvent être saisies ou modifiées que le jour même du cours." });
  }
  try {
    const [horaireLigne] = await pool.query('SELECT 1 FROM horaire WHERE id = ? LIMIT 1', [req.params.horaireId]);
    if (horaireLigne.length === 0) return res.status(404).json({ erreur: "Créneau introuvable." });

    for (const p of presences) {
      await pool.query(
        `INSERT INTO presence (horaire_id, etudiant_id, date_seance, statut) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE statut = VALUES(statut)`,
        [req.params.horaireId, p.etudiant_id, date_seance, p.statut]
      );
    }
    res.status(201).json({ message: 'Présences enregistrées.' });
  } catch (erreur) { res.status(500).json({ erreur: erreur.message }); }
});

// =====================
// PRÉSENCES — consultation par l'étudiant (taux d'assiduité par cours + historique)
// =====================
app.get('/api/etudiant/:id/presences', async (req, res) => {
  try {
    // Scopé sur l'année académique du cursus consulté (voir cursusActif côté
    // frontend) : un étudiant promu ne doit pas voir son taux d'assiduité
    // mélanger plusieurs années.
    const { annee } = req.query;
    const params = [req.params.id];
    let filtreAnnee = '';
    if (annee) { filtreAnnee = 'AND h.annee_academique = ?'; params.push(annee); }

    const [lignes] = await pool.query(`
      SELECT p.date_seance, p.statut, h.heure_debut, h.heure_fin, h.salle,
             c.id AS cours_id, c.nom AS cours, c.code
      FROM presence p
      JOIN horaire h ON h.id = p.horaire_id
      JOIN cours c ON c.id = h.cours_id
      WHERE p.etudiant_id = ? ${filtreAnnee}
      ORDER BY p.date_seance DESC
    `, params);

    const parCours = {};
    for (const l of lignes) {
      if (!parCours[l.cours_id]) parCours[l.cours_id] = { cours_id: l.cours_id, cours: l.cours, code: l.code, total: 0, present: 0, absent: 0, retard: 0, seances: [] };
      const c = parCours[l.cours_id];
      c.total++;
      c[l.statut]++;
      c.seances.push({ date_seance: l.date_seance, statut: l.statut, heure_debut: l.heure_debut, heure_fin: l.heure_fin, salle: l.salle });
    }
    const parCoursListe = Object.values(parCours).map(c => ({ ...c, taux_presence: c.total === 0 ? null : Math.round((c.present / c.total) * 1000) / 10 }));
    res.json(parCoursListe);
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

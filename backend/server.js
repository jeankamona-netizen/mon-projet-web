require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;


// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());

// ===== IMPORTATION DES ROUTES =====
const facultesRoutes      = require('./routes/facultes');
const preinscriptionRoutes = require('./routes/preinscription');
const authRoutes          = require('./routes/auth');
const pool = require('./database');

const notesRoutes = require('./routes/notes');
const horairesRoutes = require('./routes/horaires');
const programmeRoutes = require('./routes/programme');
const annoncesRoutes = require('./routes/annonces');

const professeursRoutes = require('./routes/professeurs');

// ===== TEST DE CONNEXION MYSQL =====
pool.getConnection()
  .then(connection => {
    console.log('✅ Connexion à MySQL réussie !');
    connection.release();
  })
  .catch(err => {
    console.error('❌ Erreur de connexion à MySQL :', err.message);
  });


// ===== BRANCHEMENT DES ROUTES =====
app.use('/api/facultes', facultesRoutes);
app.use('/api/preinscription', preinscriptionRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/horaires', horairesRoutes);
app.use('/api/programme', programmeRoutes);
app.use('/api/annonces', annoncesRoutes);
app.use('/api/professeurs', professeursRoutes);

// ===== ROUTE D'ACCUEIL =====
app.get('/', (req, res) => {
  res.send('🎓 API Université Méthodiste de Lubumbashi — opérationnelle');
});

// ===== DÉMARRAGE =====
app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
});

// ===== ROUTE STATISTIQUES (vue d'ensemble admin) =====
app.get('/api/stats', async (req, res) => {
  try {
    

    const [[{ etudiants }]]       = await pool.query('SELECT COUNT(*) AS etudiants FROM etudiant');
    const [[{ preinscriptions }]] = await pool.query('SELECT COUNT(*) AS preinscriptions FROM preinscription WHERE statut = "en_attente"');
    const [[{ cours }]]           = await pool.query('SELECT COUNT(*) AS cours FROM horaire');
    const [[{ annonces }]]        = await pool.query('SELECT COUNT(*) AS annonces FROM annonce WHERE actif = 1');

    res.json({ etudiants, preinscriptions, cours, annonces });
  } catch (erreur) {
     console.error('Erreur stats:', erreur.message);
    res.status(500).json({ erreur: erreur.message });
  }
});
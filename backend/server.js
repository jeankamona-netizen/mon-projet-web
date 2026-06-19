const express = require('express');
const app = express();
const PORT = 3000;

// ===== MIDDLEWARE =====
app.use(express.json());

// ===== IMPORTATION DES ROUTES =====
const facultesRoutes      = require('./routes/facultes');
const preinscriptionRoutes = require('./routes/preinscription');
const authRoutes          = require('./routes/auth');

// ===== BRANCHEMENT DES ROUTES =====
app.use('/api/facultes', facultesRoutes);
app.use('/api/preinscription', preinscriptionRoutes);
app.use('/api/auth', authRoutes);

// ===== ROUTE D'ACCUEIL =====
app.get('/', (req, res) => {
  res.send('🎓 API Université Méthodiste de Lubumbashi — opérationnelle');
});

// ===== DÉMARRAGE =====
app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
});
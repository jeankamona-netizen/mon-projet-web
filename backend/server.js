// ===== IMPORTATION D'EXPRESS =====
const express = require('express');
const app = express();

// ===== PORT D'ÉCOUTE =====
const PORT = 3000;

// ===== MIDDLEWARE — permet de lire le JSON envoyé par le frontend =====
app.use(express.json());

// ===== ROUTE DE TEST =====
app.get('/', (req, res) => {
  res.send('🎓 Bienvenue sur l\'API de l\'Université Méthodiste de Lubumbashi !');
});

// ===== DÉMARRAGE DU SERVEUR =====
app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
});
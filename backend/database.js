require('dotenv').config();
const mysql = require('mysql2/promise');

// Pool de connexions = plusieurs connexions prêtes à l'emploi,
// plus performant qu'une seule connexion ouverte/fermée à chaque requête
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;
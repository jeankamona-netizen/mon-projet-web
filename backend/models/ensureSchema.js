// =====================================================================
// Migrations légères, idempotentes, exécutées au démarrage du serveur.
// Objectif : garantir que le schéma de la base (dev OU production) contient
// bien les colonnes/index attendus par le code, même si une base ancienne
// n'a jamais été migrée à la main. Chaque étape vérifie l'état courant via
// information_schema avant d'agir — donc rejouable sans risque.
// =====================================================================

// Barème des frais attendus : la granularité a évolué vers
// (faculté, filière/promotion, niveau, année). Une base de production créée
// avant cette évolution peut manquer la colonne `niveau` ou la clé unique,
// ce qui fait échouer l'INSERT du barème (erreur 500).
async function assurerSchemaFraisScolarite(pool) {
  // 1. Table absente → on la crée avec le schéma complet et à jour.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS frais_scolarite (
      id INT AUTO_INCREMENT PRIMARY KEY,
      faculte VARCHAR(150) NOT NULL,
      promotion VARCHAR(100) NOT NULL,
      niveau VARCHAR(10) NOT NULL DEFAULT '',
      annee_academique VARCHAR(20) NOT NULL,
      montant DECIMAL(10,2) NOT NULL DEFAULT 0,
      UNIQUE KEY uq_bareme (faculte, promotion, niveau, annee_academique)
    )
  `);

  // 2. Table plus ancienne : ajouter la colonne `niveau` si elle manque.
  const [colonnes] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'frais_scolarite'`
  );
  const noms = colonnes.map(c => c.COLUMN_NAME);
  if (!noms.includes('niveau')) {
    await pool.query("ALTER TABLE frais_scolarite ADD COLUMN niveau VARCHAR(10) NOT NULL DEFAULT '' AFTER promotion");
  }

  // 3. S'assurer que la clé unique couvre bien (faculté, promotion, niveau,
  //    année) — indispensable au ON DUPLICATE KEY UPDATE du barème.
  const [index] = await pool.query(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'frais_scolarite'
       AND INDEX_NAME = 'uq_bareme' LIMIT 1`
  );
  if (index.length === 0) {
    try {
      await pool.query('ALTER TABLE frais_scolarite ADD UNIQUE KEY uq_bareme (faculte, promotion, niveau, annee_academique)');
    } catch (e) {
      // Doublons existants ou ancienne clé conflictuelle : on ne bloque pas le
      // démarrage, on signale seulement (l'INSERT fonctionnera quand même).
      console.warn('⚠️ uq_bareme non créée :', e.message);
    }
  }
}

async function assurerSchema(pool) {
  await assurerSchemaFraisScolarite(pool);
  console.log('✅ Schéma vérifié (frais_scolarite).');
}

module.exports = { assurerSchema };

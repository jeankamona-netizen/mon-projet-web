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
      faculte VARCHAR(150) NOT NULL DEFAULT '',
      promotion VARCHAR(100) NOT NULL DEFAULT '',
      niveau VARCHAR(10) NOT NULL DEFAULT '',
      annee_academique VARCHAR(20) NOT NULL DEFAULT '',
      montant DECIMAL(10,2) NOT NULL DEFAULT 0,
      UNIQUE KEY uq_bareme (faculte, promotion, niveau, annee_academique)
    )
  `);

  // 2. Table plus ancienne : ajouter TOUTE colonne attendue qui manque. Une
  //    base créée à la première version du barème (niveau seul) n'a ni
  //    `faculte` ni `promotion` → l'INSERT échouait ("Unknown column 'faculte'").
  const attendues = {
    faculte:          "VARCHAR(150) NOT NULL DEFAULT ''",
    promotion:        "VARCHAR(100) NOT NULL DEFAULT ''",
    niveau:           "VARCHAR(10) NOT NULL DEFAULT ''",
    annee_academique: "VARCHAR(20) NOT NULL DEFAULT ''",
    montant:          "DECIMAL(10,2) NOT NULL DEFAULT 0",
  };
  const [colonnes] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'frais_scolarite'`
  );
  const presentes = colonnes.map(c => c.COLUMN_NAME.toLowerCase());
  for (const [col, def] of Object.entries(attendues)) {
    if (!presentes.includes(col)) {
      await pool.query(`ALTER TABLE frais_scolarite ADD COLUMN ${col} ${def}`);
    }
  }

  // 3. Purger toute ancienne clé unique de granularité obsolète (ex. unique sur
  //    `niveau` seul), qui empêcherait deux barèmes de facultés différentes au
  //    même niveau. On garde PRIMARY et uq_bareme.
  const [uniques] = await pool.query(
    `SELECT DISTINCT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'frais_scolarite'
       AND NON_UNIQUE = 0 AND INDEX_NAME <> 'PRIMARY' AND INDEX_NAME <> 'uq_bareme'`
  );
  for (const u of uniques) {
    try { await pool.query(`ALTER TABLE frais_scolarite DROP INDEX \`${u.INDEX_NAME}\``); }
    catch (e) { console.warn('⚠️ suppression index', u.INDEX_NAME, ':', e.message); }
  }

  // 4. Créer la clé unique attendue si absente (indispensable au
  //    ON DUPLICATE KEY UPDATE du barème).
  const [index] = await pool.query(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'frais_scolarite'
       AND INDEX_NAME = 'uq_bareme' LIMIT 1`
  );
  if (index.length === 0) {
    try {
      await pool.query('ALTER TABLE frais_scolarite ADD UNIQUE KEY uq_bareme (faculte, promotion, niveau, annee_academique)');
    } catch (e) {
      console.warn('⚠️ uq_bareme non créée :', e.message);
    }
  }
}

async function assurerSchema(pool) {
  await assurerSchemaFraisScolarite(pool);
  console.log('✅ Schéma vérifié (frais_scolarite).');
}

module.exports = { assurerSchema };

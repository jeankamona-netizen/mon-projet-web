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
  // 1. Table absente → on la crée avec le schéma complet et à jour. Chaque
  //    ligne = une rubrique (frais) d'un niveau ; un niveau peut donc avoir
  //    plusieurs lignes (carte, frais académiques, labo…), le total étant ce
  //    que l'étudiant doit pour l'année.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS frais_scolarite (
      id INT AUTO_INCREMENT PRIMARY KEY,
      faculte VARCHAR(150) NOT NULL DEFAULT '',
      promotion VARCHAR(100) NOT NULL DEFAULT '',
      niveau VARCHAR(10) NOT NULL DEFAULT '',
      annee_academique VARCHAR(20) NOT NULL DEFAULT '',
      rubrique VARCHAR(100) NOT NULL DEFAULT '-',
      montant DECIMAL(10,2) NOT NULL DEFAULT 0,
      UNIQUE KEY uq_bareme (faculte, promotion, niveau, annee_academique, rubrique)
    )
  `);

  // 2. Table plus ancienne : ajouter TOUTE colonne attendue qui manque.
  const attendues = {
    faculte:          "VARCHAR(150) NOT NULL DEFAULT ''",
    promotion:        "VARCHAR(100) NOT NULL DEFAULT ''",
    niveau:           "VARCHAR(10) NOT NULL DEFAULT ''",
    annee_academique: "VARCHAR(20) NOT NULL DEFAULT ''",
    rubrique:         "VARCHAR(100) NOT NULL DEFAULT '-'",
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

  // 3. Clé unique : elle doit maintenant inclure `rubrique`. On repère les
  //    colonnes de uq_bareme ; si elle existe sans `rubrique` (ancienne
  //    granularité), on la supprime pour la recréer complète.
  const [colsUq] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'frais_scolarite' AND INDEX_NAME = 'uq_bareme'`
  );
  const uqExiste = colsUq.length > 0;
  const uqAvecRubrique = colsUq.some(c => c.COLUMN_NAME.toLowerCase() === 'rubrique');

  // Purger toute clé unique obsolète (autres que PRIMARY), + uq_bareme si elle
  // n'inclut pas encore la rubrique.
  const [uniques] = await pool.query(
    `SELECT DISTINCT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'frais_scolarite'
       AND NON_UNIQUE = 0 AND INDEX_NAME <> 'PRIMARY'`
  );
  for (const u of uniques) {
    const nom = u.INDEX_NAME;
    if (nom === 'uq_bareme' && uqAvecRubrique) continue; // déjà bonne
    try { await pool.query(`ALTER TABLE frais_scolarite DROP INDEX \`${nom}\``); }
    catch (e) { console.warn('⚠️ suppression index', nom, ':', e.message); }
  }

  // 4. Créer uq_bareme (avec rubrique) si elle n'existe pas ou vient d'être purgée.
  if (!uqExiste || !uqAvecRubrique) {
    try {
      await pool.query('ALTER TABLE frais_scolarite ADD UNIQUE KEY uq_bareme (faculte, promotion, niveau, annee_academique, rubrique)');
    } catch (e) {
      console.warn('⚠️ uq_bareme non créée :', e.message);
    }
  }
}

// Journal d'audit : trace toute action des utilisateurs authentifiés
// (admin, administrateur du budget, caissier, professeur, étudiant) — d'abord
// les connexions, puis les opérations sensibles (encaissements, barème, notes…).
async function assurerSchemaJournalAudit(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS journal_audit (
      id INT AUTO_INCREMENT PRIMARY KEY,
      date_action DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      role VARCHAR(30) NOT NULL DEFAULT '',
      utilisateur VARCHAR(200) NOT NULL DEFAULT '',
      identifiant VARCHAR(120) NOT NULL DEFAULT '',
      action VARCHAR(120) NOT NULL DEFAULT '',
      details VARCHAR(500) NOT NULL DEFAULT '',
      ip VARCHAR(60) NOT NULL DEFAULT '',
      INDEX idx_date (date_action),
      INDEX idx_role (role)
    )
  `);
}

// Versements : on mémorise le NIVEAU visé par le paiement (ex. un étudiant promu
// en L2 qui règle une dette de L1 → niveau = L1), afin que l'affichage et les
// rapports montrent le niveau réellement concerné et non le niveau courant.
async function assurerSchemaPaiement(pool) {
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'paiement'`
  );
  if (!cols.length) return; // table créée ailleurs (schéma principal)
  const noms = cols.map(c => c.COLUMN_NAME.toLowerCase());
  if (!noms.includes('niveau')) {
    await pool.query("ALTER TABLE paiement ADD COLUMN niveau VARCHAR(10) NOT NULL DEFAULT ''");
  }
}

async function assurerSchema(pool) {
  await assurerSchemaFraisScolarite(pool);
  await assurerSchemaJournalAudit(pool);
  await assurerSchemaPaiement(pool);
  console.log('✅ Schéma vérifié (frais_scolarite, journal_audit, paiement).');
}

module.exports = { assurerSchema };

const { seedMaquetteIG } = require('./seedMaquetteIG');

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

// Présences : feuille de présence par créneau d'horaire et par séance
// (present / retard / absent). La table peut manquer sur une base de production
// créée avant l'ajout de la fonctionnalité → sans elle, la saisie des présences
// (professeur ET décanat) échoue en 500. Création idempotente.
async function assurerSchemaPresence(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS presence (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      horaire_id   INT NOT NULL,
      etudiant_id  VARCHAR(20) NOT NULL,
      date_seance  DATE NOT NULL,
      statut       ENUM('present','absent','retard') NOT NULL DEFAULT 'absent',
      marque_le    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY horaire_etudiant_date (horaire_id, etudiant_id, date_seance),
      FOREIGN KEY (horaire_id)  REFERENCES horaire(id)  ON DELETE CASCADE,
      FOREIGN KEY (etudiant_id) REFERENCES etudiant(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

// Date d'inscription de l'étudiant (jour d'enregistrement) : permet de filtrer
// et de trier « Gérer les inscrits » du plus récent au plus ancien. Les fiches
// existantes prennent la date de la migration ; les nouvelles inscriptions
// reçoivent l'horodatage réel via le DEFAULT.
async function assurerSchemaDateInscription(pool) {
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'etudiant'`
  );
  if (!cols.length) return;
  const noms = cols.map(c => c.COLUMN_NAME.toLowerCase());
  if (!noms.includes('date_inscription')) {
    await pool.query('ALTER TABLE etudiant ADD COLUMN date_inscription DATETIME DEFAULT CURRENT_TIMESTAMP');
  }
}

// Rattachement d'un agent à une faculté : indispensable pour le décanat (doyen /
// vice-doyen), dont tout l'accès est limité à SA faculté. Stocké par NOM de
// faculté (comme cours.faculte et etudiant.faculte), pas par id, pour rester
// cohérent avec le reste du code qui filtre sur ces noms. Nullable : les autres
// fonctions (caissier, administrateur du budget) ne sont pas rattachées.
async function assurerSchemaAgentFaculte(pool) {
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agent'`
  );
  if (!cols.length) return;
  const noms = cols.map(c => c.COLUMN_NAME.toLowerCase());
  if (!noms.includes('faculte')) {
    await pool.query('ALTER TABLE agent ADD COLUMN faculte VARCHAR(150) NULL');
  }
}

// Nettoyage des NOMS de filières : retire les préfixes de niveau parasites
// (« L1 Systèmes Informatiques » → « Systèmes Informatiques ») qui font doublon
// avec la colonne Niveau. Les préfixes de CYCLE « Master »/« Doctorat » sont
// volontairement conservés (ils encodent le cycle pour le filtre du barème).
// On répercute le renommage sur les clés texte « promotion » qui doivent rester
// alignées sur le nom de filière : etudiant.promotion et frais_scolarite.promotion.
//  - horaire.promotion N'EST PAS touché : c'est un libellé composé « NIVEAU
//    LIBELLÉ » (pas de colonne niveau sur horaire), avec sa propre sémantique.
//  - cours : rattachement par filiere_id (clé étrangère), pas par le texte.
// Idempotent : au 2e passage plus aucune filière ne commence par un préfixe.
async function nettoyerPrefixesNiveauFilieres(pool) {
  // Uniquement les préfixes de niveau Licence (Pré-U, L1, L2, L3).
  const rx = /^(pr[ée]-?u(niversitaire)?|l[123])\s+/i;
  const [filieres] = await pool.query('SELECT id, nom, faculte_id FROM filiere');
  let renommees = 0, fusionnees = 0;
  for (const f of filieres) {
    if (!rx.test(f.nom)) continue;
    const ancien = f.nom;
    const nouveau = ancien.replace(rx, '').trim();
    if (!nouveau || nouveau === ancien) continue;

    // Collision : une autre filière de la même faculté porte déjà le nom nettoyé
    // → on fusionne (repointage des clés étrangères puis suppression du doublon).
    const [[existante]] = await pool.query(
      'SELECT id FROM filiere WHERE faculte_id = ? AND nom = ? AND id <> ? LIMIT 1',
      [f.faculte_id, nouveau, f.id]
    );
    if (existante) {
      await pool.query('UPDATE etudiant SET filiere_id = ? WHERE filiere_id = ?', [existante.id, f.id]);
      await pool.query('UPDATE cours    SET filiere_id = ? WHERE filiere_id = ?', [existante.id, f.id]);
      await pool.query('DELETE FROM filiere WHERE id = ?', [f.id]);
      fusionnees++;
    } else {
      await pool.query('UPDATE filiere SET nom = ? WHERE id = ?', [nouveau, f.id]);
      renommees++;
    }

    // Aligner les clés texte « promotion » sur le nouveau nom de filière.
    await pool.query('UPDATE etudiant        SET promotion = ? WHERE promotion = ?', [nouveau, ancien]);
    await pool.query('UPDATE frais_scolarite SET promotion = ? WHERE promotion = ?', [nouveau, ancien]);
  }
  if (renommees || fusionnees) {
    console.log(`✅ Filières nettoyées (préfixe niveau retiré) : ${renommees} renommée(s), ${fusionnees} fusionnée(s).`);
  }
}

// Cours en double « commun + filière » : un même cours (même code/faculté/
// niveau/année/semestre) existe à la fois en version COMMUNE (filiere_id NULL,
// qui couvre déjà tous les étudiants de la faculté) ET en copie(s) spécifique(s)
// à une filière. Un étudiant de cette filière matche les deux → il voit le cours
// EN DOUBLE (ex. Mireille : 21 cours au lieu de 14). On garde la version
// commune, on repointe inscriptions/notes/horaires des copies vers elle, puis
// on supprime les copies. Les cours filière SANS équivalent commun (vraie
// spécialisation) ne sont jamais touchés. Idempotent.
async function nettoyerCoursCommunEtFiliere(pool) {
  const [groupes] = await pool.query(`
    SELECT code, faculte, niveau, annee_academique, semestre,
           MIN(CASE WHEN filiere_id IS NULL THEN id END) AS commun_id
    FROM cours
    GROUP BY code, faculte, niveau, annee_academique, semestre
    HAVING SUM(filiere_id IS NULL) >= 1 AND SUM(filiere_id IS NOT NULL) >= 1
  `);
  let supprimes = 0;
  for (const g of groupes) {
    if (!g.commun_id) continue;
    const [copies] = await pool.query(
      `SELECT id FROM cours
       WHERE code = ? AND (faculte <=> ?) AND niveau = ? AND annee_academique = ?
         AND semestre = ? AND filiere_id IS NOT NULL`,
      [g.code, g.faculte, g.niveau, g.annee_academique, g.semestre]
    );
    for (const c of copies) {
      // Repointer vers le cours commun (UPDATE IGNORE évite les collisions de
      // clé unique (etudiant_id, cours_id)), puis purger les restes.
      await pool.query('UPDATE IGNORE inscription_cours SET cours_id = ? WHERE cours_id = ?', [g.commun_id, c.id]);
      await pool.query('DELETE FROM inscription_cours WHERE cours_id = ?', [c.id]);
      await pool.query('UPDATE IGNORE note SET cours_id = ? WHERE cours_id = ?', [g.commun_id, c.id]);
      await pool.query('DELETE FROM note WHERE cours_id = ?', [c.id]);
      await pool.query('UPDATE horaire SET cours_id = ? WHERE cours_id = ?', [g.commun_id, c.id]);
      await pool.query('DELETE FROM cours WHERE id = ?', [c.id]);
      supprimes++;
    }
  }
  if (supprimes) console.log(`✅ Cours dupliqués (commun + filière) nettoyés : ${supprimes} copie(s) filière supprimée(s).`);
}

// Resynchronisation des inscriptions aux cours : garantit que TOUT cours
// atteint bien tous les étudiants concernés (donc son programme annuel ET son
// horaire, tous deux basés sur inscription_cours). Corrige les manques
// historiques — un cours commun/multi-facultés créé alors que certains
// étudiants n'étaient pas encore inscrits, une fusion de doublons, etc.
// Règles (identiques à inscriptionAuto.js), pour un étudiant de même niveau + année :
//   • cours propre à une filière  → seulement les étudiants de cette filière ;
//   • cours commun (filiere_id NULL), de sa faculté OU inter-facultés (faculte NULL)
//     → tous les étudiants, SAUF ceux d'une filière AUTONOME (ex. Informatique de
//       Gestion), qui ne suivent que les cours de leur propre filière.
// INSERT IGNORE : idempotent, n'ajoute que ce qui manque, ne retire jamais rien.
async function resynchroniserInscriptions(pool) {
  const [auto] = await pool.query(
    "SELECT id FROM filiere WHERE nom IN ('Informatique de Gestion','Master Informatique de Gestion')"
  );
  const autoIds = auto.map(a => a.id);
  const horsAutonomes = autoIds.length
    ? `AND (e.filiere_id IS NULL OR e.filiere_id NOT IN (${autoIds.map(() => '?').join(',')}))`
    : '';
  const [r] = await pool.query(`
    INSERT IGNORE INTO inscription_cours (etudiant_id, cours_id)
    SELECT e.id, c.id
    FROM etudiant e
    JOIN cours c ON c.niveau = e.niveau AND c.annee_academique = e.annee_academique
    WHERE
      (c.filiere_id IS NOT NULL AND c.filiere_id = e.filiere_id)
      OR (c.filiere_id IS NULL AND (c.faculte IS NULL OR c.faculte = e.faculte) ${horsAutonomes})
  `, autoIds);
  if (r.affectedRows) console.log(`✅ Inscriptions resynchronisées : ${r.affectedRows} inscription(s) manquante(s) ajoutée(s).`);
}

// Le nom de famille (étudiant/professeur.nom, agent.noms, preinscription.nom)
// doit toujours être en MAJUSCULES. On met à niveau l'existant. La comparaison
// « <> BINARY UPPER(...) » est sensible à la casse (sinon la collation ci
// considérerait « kamona » = « KAMONA » et rien ne serait mis à jour).
async function majNomsMajuscules(pool) {
  const cibles = [
    { table: 'etudiant', col: 'nom' },
    { table: 'professeur', col: 'nom' },
    { table: 'agent', col: 'noms' },
    { table: 'preinscription', col: 'nom' },
  ];
  let total = 0;
  for (const c of cibles) {
    try {
      const [r] = await pool.query(
        `UPDATE ${c.table} SET ${c.col} = UPPER(${c.col})
         WHERE ${c.col} IS NOT NULL AND ${c.col} <> BINARY UPPER(${c.col})`
      );
      total += r.affectedRows || 0;
    } catch (e) { console.warn(`⚠️ MAJ noms ${c.table} :`, e.message); }
  }
  if (total) console.log(`✅ Noms de famille passés en majuscules : ${total} ligne(s).`);
}

async function assurerSchema(pool) {
  await assurerSchemaFraisScolarite(pool);
  await assurerSchemaJournalAudit(pool);
  await assurerSchemaPaiement(pool);
  await assurerSchemaPresence(pool);
  await assurerSchemaDateInscription(pool);
  await assurerSchemaAgentFaculte(pool);
  await nettoyerPrefixesNiveauFilieres(pool);
  await nettoyerCoursCommunEtFiliere(pool);
  await majNomsMajuscules(pool);
  // Chargement (idempotent) de la maquette Informatique de Gestion. Placé APRÈS
  // le nettoyage des cours pour ne pas être altéré par celui-ci.
  try { await seedMaquetteIG(); } catch (e) { console.error('⚠️ Seed maquette IG :', e.message); }
  // Resynchronisation des inscriptions EN DERNIER : après tout nettoyage/seed de
  // cours, pour que chaque cours (commun ou de filière) atteigne bien tous ses
  // étudiants (programme annuel + horaire).
  await resynchroniserInscriptions(pool);
  console.log('✅ Schéma vérifié (frais_scolarite, journal_audit, paiement, presence, agent.faculte, filières, cours, inscriptions, noms).');
}

module.exports = { assurerSchema };

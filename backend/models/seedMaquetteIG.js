const pool = require('../database');

// =====================
// CHARGEMENT DE LA MAQUETTE « Informatique de Gestion » (LIAGE + MIAGE-IMSI)
// dans le programme (table cours), pour la faculté Sciences Informatiques.
//
// Règle des codes : on n'enregistre PAS l'UE (unité d'enseignement) elle-même,
// mais chacun de ses EC (éléments constitutifs) ; le code de l'EC = code de
// l'UE suffixé de 1, 2, 3… (ex. LAC1111 → LAC11111 / LAC11112 / LAC11113).
// Une UE sans EC (ligne unique) garde son propre code.
//
// Mapping niveau/semestre (LMD) : LIAGE S1-2 → L1, S3-4 → L2, S5-6 → L3 ;
// MIAGE S1-2 → M1, S3-4 → M2. La colonne semestre vaut S1/S2 (par année).
// Colonnes : cmi = CM (cours magistral), td = TD, tp = TP, credits = Cr.
// Idempotent : rejouable sans doublon (clé unique code+promotion+année).
// =====================

const FACULTE = 'Sciences Informatiques';
const FILIERE_LICENCE = 'Informatique de Gestion';
const FILIERE_MASTER  = 'Master Informatique de Gestion';
const ANNEES = ['2026-2027', '2027-2028'];

// [code, intitulé, CM, TD, TP, Cr]
const COURS = {
  // ===================== LICENCE (LIAGE) =====================
  'L1|S1': [
    ['LAC11111', "Expression orale et écrite en français", 20, 5, 5, 2],
    ['LAC11112', "Expression orale et écrite en anglais", 20, 5, 5, 2],
    ['LAC11113', "Introduction à la communication", 20, 5, 5, 2],
    ['CHE11111', "Valeurs, principes et symboles de la République", 20, 5, 5, 2],
    ['CHE11112', "Hygiène et environnement", 20, 5, 5, 2],
    ['INF11111', "Introduction à l'informatique", 15, 5, 10, 2],
    ['INF11112', "Outils de bureautique, d'Internet et de design graphique", 10, 10, 70, 6],
    ['MIN11111', "Algèbre", 25, 15, 5, 3],
    ['MIN11112', "Analyse mathématique", 25, 15, 5, 3],
    ['ALP1111',  "Éléments d'algorithmique et de programmation orientée objet", 30, 30, 30, 6],
  ],
  'L1|S2': [
    ['STD1121',  "Statistique descriptive (analyse univariée et bivariée)", 30, 10, 5, 3],
    ['DRE11211', "Introduction à l'étude du droit", 20, 5, 5, 2],
    ['DRE11212', "Introduction à l'économie", 35, 5, 5, 3],
    ['SYI11211', "Architecture des ordinateurs", 30, 10, 5, 3],
    ['SYI11212', "Système d'exploitation", 30, 10, 5, 3],
    ['RIT1121',  "Introduction aux réseaux informatiques et de télécommunications", 30, 10, 5, 3],
    ['PRE11211', "PGEv en Java et en C#", 20, 15, 10, 3],
    ['PRE11212', "PGEv en C++ et en Python", 20, 15, 10, 3],
    ['MNG11211', "Introduction au management des organisations", 20, 5, 5, 2],
    ['MNG11212', "Introduction à la comptabilité et à la gestion financière", 15, 10, 5, 2],
    ['IGE1121',  "Stage de technicien de bureautique et d'Internet", 5, 5, 35, 3],
  ],
  'L2|S1': [ // Semestre 3
    ['MIN12321', "Mathématiques discrètes", 25, 15, 5, 3],
    ['MIN12322', "Analyse numérique", 20, 5, 5, 2],
    ['MAI12311', "Étude du SI par la méthode Merise", 20, 20, 5, 3],
    ['MAI12312', "Modélisation des systèmes avec le langage UML", 20, 20, 5, 3],
    ['RES12311', "Théorie et outils de la sécurité informatique", 25, 10, 10, 3],
    ['RES12312', "Réseaux informatiques", 40, 10, 10, 4],
    ['APA12311', "Algorithmes et structures de données", 30, 10, 5, 3],
    ['APA12312', "Programmation avancée : Design Patterns & Client/Serveur", 15, 20, 10, 3],
    ['TAB12311', "Théorie et développement de BD relationnelles", 40, 10, 10, 4],
    ['TAB12312', "Administration de bases de données", 10, 10, 10, 2],
  ],
  'L2|S2': [ // Semestre 4
    ['PSI1241',  "Probabilités et statistique inférentielle", 40, 10, 10, 4],
    ['BNR1241',  "Bases de données non relationnelles, Data Warehousing et Big Data", 30, 10, 20, 4],
    ['AMS12411', "Administration de systèmes sous Windows et Linux", 15, 15, 15, 3],
    ['AMS12412', "Éléments de maintenance informatique", 10, 5, 30, 3],
    ['CAR12411', "Conception de réseaux informatiques", 20, 20, 5, 3],
    ['CAR12412', "Administration de réseaux informatiques", 15, 15, 15, 3],
    ['DAD12411', "Développement d'applications Desktop", 15, 25, 20, 4],
    ['DAD12412', "Développement d'applications Web", 15, 25, 20, 4],
    ['IGE1242',  "Stage de technicien de systèmes et de réseaux", 5, 5, 35, 3],
  ],
  'L3|S1': [ // Semestre 5
    ['GII13511', "Gestion d'un parc informatique", 30, 10, 5, 3],
    ['GII13512', "Cloud Computing", 30, 10, 5, 3],
    ['DAM1351',  "Développement d'applications mobiles, Low Code et No Code", 30, 30, 30, 6],
    ['ILO13511', "Génie logiciel", 40, 10, 10, 4],
    ['ILO13512', "Conception des interfaces homme-machine", 15, 10, 5, 2],
    ['MNG13521', "Management des ressources humaines", 15, 10, 5, 2],
    ['MNG13522', "Progiciel de gestion intégré", 10, 20, 15, 3],
    ['EDE13511', "Économie du développement", 15, 10, 5, 2],
    ['EDE13512', "Entrepreneuriat", 20, 20, 5, 3],
    ['EDE13513', "Marketing de l'innovation technologique", 15, 10, 5, 2],
  ],
  'L3|S2': [ // Semestre 6
    ['DAP1361',  "Droit du travail, des affaires et de la propriété intellectuelle", 30, 10, 5, 3],
    ['SIG1361',  "Initiation au système d'information géographique", 25, 10, 10, 3],
    ['IPR13611', "Éthique et déontologie des professions de l'informatique", 15, 10, 5, 2],
    ['IPR13612', "Sécurité au travail", 10, 10, 10, 2],
    ['IGE1363',  "Stage professionnel", 10, 10, 115, 9],
    ['PIG1361',  "Projet tutoré", 10, 10, 145, 11],
  ],

  // ===================== MASTER (MIAGE-IMSI) =====================
  'M1|S1': [
    ['ROG2111',  "Recherche opérationnelle et théorie des graphes", 30, 10, 5, 3],
    ['BDA2111',  "Bases de données avancées : Big Data et Data Warehousing", 30, 15, 15, 4],
    ['IAA21111', "Ingénierie de connaissances et systèmes experts", 20, 15, 10, 3],
    ['IAA21112', "Data Mining et Machine Learning", 20, 15, 10, 3],
    ['STL21111', "Ingénierie des exigences et spécification formelle", 30, 10, 5, 3],
    ['STL21112', "Théorie et pratique du test logiciel", 20, 10, 15, 3],
    ['PRA21111', "Programmation parallèle et distribuée", 20, 10, 15, 3],
    ['PRA21112', "Programmation Client/Serveur et programmation réactive", 20, 10, 15, 3],
    ['ILA21111', "Web Engineering", 15, 15, 15, 3],
    ['ILA21112', "UX Design", 10, 10, 10, 2],
  ],
  'M1|S2': [
    ['ALA2121',  "Architecture logicielle avancée (ADD, Intégration, ligne de produits, SOA et microservices)", 30, 20, 10, 4],
    ['RSI21211', "Initiation à la recherche scientifique en informatique", 25, 10, 10, 3],
    ['RSI21212', "Planification d'un projet de recherche scientifique", 10, 10, 10, 2],
    ['LAC21211', "Anglais technique", 20, 15, 10, 3],
    ['LAC21212', "Communication scientifique", 20, 20, 10, 3],
    ['LAC21213', "Rédaction technique", 10, 10, 10, 2],
    ['SEI21211', "Éléments de cryptographie et cryptanalyse", 25, 10, 10, 3],
    ['SEI21212', "Ethical Hacking", 10, 15, 15, 3],
    ['AEN21211', "Enterprise Architecture Framework", 20, 5, 5, 2],
    ['AEN21212', "Urbanisation de systèmes d'information", 15, 10, 5, 2],
    ['SIL2121',  "Stage en ingénierie du logiciel", 5, 5, 35, 3],
  ],
  'M2|S1': [ // Semestre 3
    ['ILA22321', "Modélisation UML avancée et ingénierie dirigée par les modèles", 20, 15, 10, 3],
    ['ILA22322', "Gestion de configuration, DevOps et développement dans le Cloud", 15, 30, 15, 4],
    ['SGI22311', "Système de gestion de flux de travail", 10, 20, 15, 3],
    ['SGI22312', "Progiciel de gestion intégré", 10, 20, 15, 3],
    ['SGI22321', "Système de gestion électronique de documents", 10, 20, 15, 3],
    ['SGI22322', "Système d'information géographique", 20, 15, 10, 3],
    ['RSI22321', "Approche quantitative", 30, 20, 10, 4],
    ['RSI22322', "Approche qualitative, approche mixte et Design Science Research", 30, 20, 10, 4],
    ['MSO2231',  "Management stratégique et opérationnel", 20, 15, 10, 3],
  ],
  'M2|S2': [ // Semestre 4
    ['GPI22411', "Gouvernance et audit de systèmes d'information", 30, 15, 15, 4],
    ['GPI22412', "Gestion de programmes et projets informatiques", 30, 15, 15, 4],
    ['TSD22411', "TIC et développement durable", 20, 5, 5, 2],
    ['TSD22412', "E-Administration", 15, 10, 5, 2],
    ['SEI22411', "Consultance dans le secteur du numérique", 5, 5, 5, 1],
    ['SEI22412', "Développements récents en informatique", 5, 5, 5, 1],
    ['IGE2241',  "Stage professionnel", 10, 10, 85, 7],
    ['PPM2241',  "Projet personnel / Mémoire de recherche", 10, 20, 105, 9],
  ],
};

// Retourne l'id d'une filière de la faculté, en la créant si nécessaire.
async function assurerFiliere(nom, faculteId) {
  const [[fi]] = await pool.query('SELECT id FROM filiere WHERE nom = ? AND faculte_id = ?', [nom, faculteId]);
  if (fi) return fi.id;
  const [r] = await pool.query('INSERT INTO filiere (nom, faculte_id) VALUES (?, ?)', [nom, faculteId]);
  return r.insertId;
}

// Migration : le master a d'abord été chargé sous « Master Informatique de
// Gestion (MIAGE-IMSI) » ; on l'a simplifié en « Master Informatique de
// Gestion ». Renomme la filière et les libellés de promotion des cours déjà
// enregistrés (sans effet si l'ancien nom n'existe pas).
async function renommerAncienMaster() {
  const ancien = 'Master Informatique de Gestion (MIAGE-IMSI)';
  await pool.query('UPDATE filiere SET nom = ? WHERE nom = ?', [FILIERE_MASTER, ancien]);
  await pool.query('UPDATE cours SET promotion = REPLACE(promotion, ?, ?) WHERE promotion LIKE ?',
    [ancien, FILIERE_MASTER, `%${ancien}%`]);
}

async function seedMaquetteIG() {
  const [[fa]] = await pool.query('SELECT id FROM faculte WHERE nom = ?', [FACULTE]);
  if (!fa) return; // faculté absente : rien à charger

  await renommerAncienMaster();
  const idLicence = await assurerFiliere(FILIERE_LICENCE, fa.id);
  const idMaster  = await assurerFiliere(FILIERE_MASTER, fa.id);

  let inseres = 0;
  for (const annee of ANNEES) {
    // Court-circuit : cette maquette est-elle déjà chargée pour cette année ?
    const [[deja]] = await pool.query(
      'SELECT 1 AS x FROM cours WHERE code = ? AND annee_academique = ? LIMIT 1', ['LAC11111', annee]
    );
    if (deja) continue;

    for (const [cle, liste] of Object.entries(COURS)) {
      const [niveau, semestre] = cle.split('|');
      const estMaster = niveau[0] === 'M';
      const filiereId = estMaster ? idMaster : idLicence;
      const filiereNom = estMaster ? FILIERE_MASTER : FILIERE_LICENCE;
      const promotion = `${niveau} ${filiereNom}`;
      const rows = liste.map(([code, nom, cm, td, tp, cr]) =>
        [code, nom, FACULTE, filiereId, niveau, promotion, annee, semestre, cr, cm, td, tp]);
      if (!rows.length) continue;
      const [r] = await pool.query(
        `INSERT IGNORE INTO cours
           (code, nom, faculte, filiere_id, niveau, promotion, annee_academique, semestre, credits, cmi, td, tp)
         VALUES ?`, [rows]);
      inseres += r.affectedRows;
    }
  }
  if (inseres) console.log(`✅ Maquette Informatique de Gestion (LIAGE + MIAGE-IMSI) : ${inseres} cours chargés.`);
}

module.exports = { seedMaquetteIG };

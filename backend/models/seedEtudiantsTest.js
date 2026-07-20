// =====================================================================
// Étudiants fictifs de TEST — 5 par filière (L1 pour la licence, M1 pour les
// masters) + 5 par faculté à licence NON subdivisée (ex. Théologie), pour
// disposer de données de test dans chaque promotion. Idempotent : ne crée rien
// si des étudiants fictifs existent déjà (repérés par l'email « @test.uml »).
// Mot de passe commun : « test1234 ». Supprimables via :
//   DELETE FROM etudiant WHERE email LIKE '%@test.uml';
// =====================================================================
const bcrypt = require('bcryptjs');
const pool = require('../database');
const { genererMatricule } = require('./matricule');
const { inscrireAuxCoursDuNiveau } = require('./inscriptionAuto');

const PRENOMS = ['Jean', 'Marie', 'Patrick', 'Grâce', 'Emmanuel', 'Sarah', 'David', 'Esther',
  'Joseph', 'Ruth', 'Daniel', 'Rachel', 'Samuel', 'Deborah', 'Moïse', 'Naomi', 'Isaac',
  'Judith', 'Élie', 'Anne', 'Gédéon', 'Rebecca', 'Josué', 'Myriam', 'Aaron'];
const NOMS = ['MUKENDI', 'KABANGE', 'ILUNGA', 'TSHALA', 'KALALA', 'MWAMBA', 'NGOY', 'KASONGO',
  'BANZA', 'KABEYA', 'MUTOMBO', 'LUKUSA', 'KAPINGA', 'MBUYI', 'KANKU', 'NSENGA', 'KAZADI',
  'MPOYO', 'KABWE', 'MULUMBA', 'TSHIBANGU', 'MUKALAY', 'NGALULA', 'KADIMA', 'MWEPU'];

async function seedEtudiantsTest() {
  // Idempotence : si des fictifs existent déjà, on ne recrée rien.
  const [[{ n }]] = await pool.query("SELECT COUNT(*) AS n FROM etudiant WHERE email LIKE '%@test.uml'");
  if (n > 0) return;

  const [[ac]] = await pool.query("SELECT libelle FROM annee_academique WHERE est_courante = 1 LIMIT 1");
  const annee = ac ? ac.libelle : '2026-2027';
  const [filieres] = await pool.query(
    'SELECT f.id, f.nom, fa.nom AS faculte FROM filiere f JOIN faculte fa ON f.faculte_id = fa.id ORDER BY fa.nom, f.nom'
  );
  const [facultes] = await pool.query('SELECT nom FROM faculte');
  const hash = await bcrypt.hash('test1234', 10);

  let crees = 0, i = 0;
  async function creerGroupe(faculte, filiere_id, promotion, niveau, cle) {
    for (let k = 1; k <= 5; k++) {
      const prenom = PRENOMS[i % PRENOMS.length];
      const nom = NOMS[(i * 3 + k) % NOMS.length];
      i++;
      const email = `test.${cle}.${k}@test.uml`;
      const [[ex]] = await pool.query('SELECT id FROM etudiant WHERE email = ? LIMIT 1', [email]);
      if (ex) continue;
      const matricule = await genererMatricule(annee, faculte);
      await pool.query(
        `INSERT INTO etudiant (id, nom, postnom, prenom, date_naissance, sexe, email, telephone,
                               mot_de_passe, filiere_id, faculte, promotion, niveau, annee_academique, statut)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'actif')`,
        [matricule, nom, 'Test', prenom, niveau === 'M1' ? '1999-05-10' : '2004-03-12',
         k % 2 ? 'M' : 'F', email, '09' + String(90000000 + i), hash,
         filiere_id, faculte, promotion, niveau, annee]
      );
      try { await inscrireAuxCoursDuNiveau(matricule, faculte, niveau, filiere_id, annee); }
      catch (e) { console.warn('⚠️ inscription cours (fictif)', matricule, ':', e.message); }
      crees++;
    }
  }

  // 5 par filière : L1 pour la licence, M1 pour un master.
  for (const f of filieres) {
    const niveau = /^master/i.test(f.nom) ? 'M1' : 'L1';
    await creerGroupe(f.faculte, f.id, f.nom, niveau, 'f' + f.id);
  }
  // Facultés à licence NON subdivisée (aucune filière de licence, ex. Théologie)
  // → 5 étudiants L1 rattachés à la faculté (sans filière).
  for (const fa of facultes) {
    const aFiliereLicence = filieres.some(f => f.faculte === fa.nom && !/^master/i.test(f.nom));
    if (aFiliereLicence) continue;
    const promo = fa.nom.replace(/^Facult[ée]\s+d[e']\s*/i, '').trim() || fa.nom;
    await creerGroupe(fa.nom, null, promo, 'L1', 'fac' + fa.nom.replace(/\W+/g, ''));
  }

  if (crees) console.log(`✅ Étudiants fictifs de test créés : ${crees} (année ${annee}, mot de passe « test1234 », emails @test.uml).`);
}

module.exports = { seedEtudiantsTest };

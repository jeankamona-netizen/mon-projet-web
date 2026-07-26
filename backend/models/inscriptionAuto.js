const pool = require('../database');

// Filières « autonomes » : elles ont un cursus complet et propre (toutes leurs
// UE/EC), incompatible avec les cours communs partagés par les autres filières
// de la faculté. Leurs étudiants ne suivent QUE les cours de leur filière — pas
// les cours communs (filiere_id NULL). Ex. « Informatique de Gestion » (LIAGE)
// et son master, qui n'ont pas de tronc commun avec Génie Logiciel, Design, etc.
const FILIERES_AUTONOMES = ['Informatique de Gestion', 'Master en Informatique Appliquée à la Gestion des Entreprises'];

// Filières scientifiques qui passent par l'année préparatoire commune
// (Pré-U Sciences) avant la Licence. TOUTE autre filière/faculté (Informatique
// de Gestion, Théologie, Sciences Économiques, Sciences de l'Éducation…)
// démarre directement en L1.
const FILIERES_PREU = ['Systèmes Informatiques', 'Génie Logiciel', 'Intelligence Artificielle', 'Design'];

// Une filière (par NOM) est-elle autonome (cursus complet, sans cours communs) ?
function nomFiliereEstAutonome(nom) {
  return FILIERES_AUTONOMES.includes(String(nom || '').trim());
}

// Ids (en base) des filières autonomes — utilisés pour exclure les cours/étudiants.
async function idsFilieresAutonomes() {
  const [rows] = await pool.query(
    `SELECT id FROM filiere WHERE nom IN (${FILIERES_AUTONOMES.map(() => '?').join(',')})`,
    FILIERES_AUTONOMES
  );
  return rows.map(r => r.id);
}

// La filière (par id) est-elle autonome (sans cours communs) ?
async function filiereEstAutonome(filiere_id) {
  if (!filiere_id) return false;
  const [[f]] = await pool.query('SELECT nom FROM filiere WHERE id = ?', [filiere_id]);
  return !!f && FILIERES_AUTONOMES.includes(f.nom);
}

// Inscrit automatiquement un étudiant à tous les cours de sa faculté + niveau
// + année déjà programmés au moment de l'appel : sa filière précise, les
// cours propres à toute sa faculté (filiere_id NULL), ET les cours communs à
// plusieurs facultés (cours.faculte NULL). Appelée à chaque fois que le
// profil (faculté/niveau/filière/année) d'un étudiant est fixé ou change —
// création, réinscription, promotion, modification manuelle — pour que
// "inscrit dans une promotion ⇒ tous les cours de cette promotion figurent
// ipso facto à son programme" reste vrai, qu'il soit inscrit avant ou après
// la création du cours. INSERT IGNORE : ne duplique jamais, ne retire jamais
// une inscription existante (ex. cours au choix hors promotion).
async function inscrireAuxCoursDuNiveau(etudiantId, faculte, niveau, filiere_id, annee) {
  if (!faculte || !niveau || !annee) return 0;
  let cours;
  if (await filiereEstAutonome(filiere_id)) {
    // Filière autonome : UNIQUEMENT ses propres cours (aucun cours commun).
    [cours] = await pool.query(
      'SELECT id FROM cours WHERE faculte = ? AND niveau = ? AND annee_academique = ? AND filiere_id = ?',
      [faculte, niveau, annee, filiere_id]
    );
  } else {
    let sql = 'SELECT id FROM cours WHERE (faculte = ? OR faculte IS NULL) AND niveau = ? AND annee_academique = ? AND (filiere_id IS NULL';
    const params = [faculte, niveau, annee];
    if (filiere_id) { sql += ' OR filiere_id = ?'; params.push(filiere_id); }
    sql += ')';
    [cours] = await pool.query(sql, params);
  }
  if (cours.length === 0) return 0;
  const valeurs = cours.map(c => [etudiantId, c.id]);
  await pool.query('INSERT IGNORE INTO inscription_cours (etudiant_id, cours_id) VALUES ?', [valeurs]);
  return cours.length;
}

// Sens inverse : quand un cours voit son couple faculté/niveau/filière/année
// changer (édition manuelle en admin), on ramène tous les étudiants qui
// correspondent désormais à ce cours — même garantie "ipso facto" que
// inscrireAuxCoursDuNiveau, déclenchée côté cours plutôt que côté étudiant.
// faculte NULL = cours commun : concerne tous les étudiants du niveau/année.
async function inscrireEtudiantsAuCours(coursId, faculte, niveau, filiere_id, annee) {
  if (!niveau || !annee) return 0;
  let sql = 'SELECT id FROM etudiant WHERE niveau = ? AND annee_academique = ?';
  const params = [niveau, annee];
  if (faculte) { sql += ' AND faculte = ?'; params.push(faculte); }
  if (filiere_id) {
    sql += ' AND filiere_id = ?'; params.push(filiere_id);
  } else {
    // Cours commun (sans filière) : ne PAS y inscrire les étudiants des
    // filières autonomes (cursus complet incompatible avec les cours communs).
    const idsAutonomes = await idsFilieresAutonomes();
    if (idsAutonomes.length) {
      sql += ` AND (filiere_id IS NULL OR filiere_id NOT IN (${idsAutonomes.map(() => '?').join(',')}))`;
      params.push(...idsAutonomes);
    }
  }
  const [etudiants] = await pool.query(sql, params);
  if (etudiants.length === 0) return 0;
  const valeurs = etudiants.map(e => [e.id, coursId]);
  await pool.query('INSERT IGNORE INTO inscription_cours (etudiant_id, cours_id) VALUES ?', [valeurs]);
  return etudiants.length;
}

module.exports = { inscrireAuxCoursDuNiveau, inscrireEtudiantsAuCours, nomFiliereEstAutonome, FILIERES_AUTONOMES, FILIERES_PREU };

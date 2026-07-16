const pool = require('../database');

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
  let sql = 'SELECT id FROM cours WHERE (faculte = ? OR faculte IS NULL) AND niveau = ? AND annee_academique = ? AND (filiere_id IS NULL';
  const params = [faculte, niveau, annee];
  if (filiere_id) { sql += ' OR filiere_id = ?'; params.push(filiere_id); }
  sql += ')';
  const [cours] = await pool.query(sql, params);
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
  if (filiere_id) { sql += ' AND filiere_id = ?'; params.push(filiere_id); }
  const [etudiants] = await pool.query(sql, params);
  if (etudiants.length === 0) return 0;
  const valeurs = etudiants.map(e => [e.id, coursId]);
  await pool.query('INSERT IGNORE INTO inscription_cours (etudiant_id, cours_id) VALUES ?', [valeurs]);
  return etudiants.length;
}

module.exports = { inscrireAuxCoursDuNiveau, inscrireEtudiantsAuCours };

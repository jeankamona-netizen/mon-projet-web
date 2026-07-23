const pool = require('../database');

// Recalcule la Moy (note_cc) et le Total Général (note) de TOUTES les notes d'un
// cours selon le NOMBRE DE COMPOSANTES réellement utilisées pour ce cours :
//   diviseur = nombre de composantes (TP, TD, Interro) ayant au moins une valeur
//              parmi l'ensemble des étudiants inscrits au cours.
// Pour chaque étudiant : Moy = (somme de SES composantes, une manquée comptant 0)
//                              / diviseur.  Ex. cours coté sur 3 (TP,TD,Interro),
//   étudiant TP=8, TD manqué, Interro=6 → (8+0+6)/3 = 4,67.
//   Cours coté sur 2 (TP, Interro) → (8+6)/2 = 7.
// Les notes SANS aucune composante (Moy saisie directement par l'admin/décanat)
// ne sont jamais touchées : leur Moy reste manuelle.
async function recomputeMoyCours(coursId) {
  const [notes] = await pool.query(
    'SELECT id, tp, td, interro, note_examen FROM note WHERE cours_id = ?', [coursId]
  );
  if (!notes.length) return;
  const COMP = ['tp', 'td', 'interro'];
  const nonNul = v => v !== null && v !== undefined;
  const actives = COMP.filter(c => notes.some(n => nonNul(n[c])));
  const diviseur = actives.length;

  for (const n of notes) {
    const aComposante = COMP.some(c => nonNul(n[c]));
    if (!aComposante) continue; // Moy saisie directement → on ne recalcule pas.
    const somme = actives.reduce((s, c) => s + (nonNul(n[c]) ? Number(n[c]) : 0), 0);
    const cc = diviseur > 0 ? Math.round((somme / diviseur) * 100) / 100 : null;
    const exam = n.note_examen;
    const note = (cc === null || !nonNul(exam)) ? null : Math.round((cc + Number(exam)) * 100) / 100;
    await pool.query('UPDATE note SET note_cc = ?, note = ? WHERE id = ?', [cc, note, n.id]);
  }
}

module.exports = { recomputeMoyCours };

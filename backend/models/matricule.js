const pool = require('../database');

// Génère un matricule « UML-AAAA-0000 » UNIQUE et MONOTONE pour l'année donnée.
// Basé sur le PLUS GRAND numéro déjà attribué (jamais sur COUNT(*)) : insensible
// aux suppressions. Un matricule effacé n'est jamais réattribué → plus aucune
// erreur « Duplicate entry … for key etudiant.PRIMARY ». La boucle finale
// garantit l'unicité même en cas de trou dans la numérotation.
async function genererMatricule(anneeAcademique) {
  const prefixe = `UML-${String(anneeAcademique).slice(0, 4)}-`;
  const [rows] = await pool.query(
    'SELECT id FROM etudiant WHERE id LIKE ? ORDER BY id DESC LIMIT 1',
    [prefixe + '%']
  );
  let seq = 1;
  if (rows.length) {
    const dernier = parseInt(rows[0].id.split('-')[2], 10);
    if (!isNaN(dernier)) seq = dernier + 1;
  }
  while (true) {
    const matricule = prefixe + String(seq).padStart(4, '0');
    const [[exist]] = await pool.query('SELECT 1 AS x FROM etudiant WHERE id = ?', [matricule]);
    if (!exist) return matricule;
    seq++;
  }
}

module.exports = { genererMatricule };

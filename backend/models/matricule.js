const pool = require('../database');

// « 2026-2027 » → « 2627 » (deux derniers chiffres de chaque année de l'année
// académique). « 2026 » seul → « 2627 » (on déduit l'année suivante).
function suffixeAnnees(anneeAcademique) {
  const m = String(anneeAcademique || '').match(/\d{4}/g);
  if (m && m.length >= 2) return m[0].slice(2) + m[1].slice(2);
  if (m && m.length === 1) { const y = parseInt(m[0], 10); return String(y).slice(2) + String(y + 1).slice(2); }
  return '0000';
}

// Normalise un nom de faculté pour la comparaison (minuscules, sans accents,
// lettres seules) : « Faculté de Théologie » → « facultedetheologie ».
function normFacKey(nom) {
  return String(nom || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
}

// Codes de faculté fixes (choisis par l'université) — priment sur le calcul
// automatique. Ajoute une entrée ici pour toute nouvelle faculté à code imposé.
const CODES_FACULTE_FIXES = {
  [normFacKey('Sciences Informatiques')]: 'SI',
  [normFacKey('Sciences Économiques')]: 'SE',
  [normFacKey("Sciences de l'Éducation & Psychologie")]: 'SP',
  [normFacKey('Faculté de Théologie')]: 'TH',
};

// Code court de la faculté : code fixe si défini, sinon initiales de ses mots
// significatifs (2 lettres), sans accent. « Sciences Informatiques » → « SI ».
// Le tirage aléatoire garantit l'unicité même si deux facultés ont le même code.
function codeFaculte(nom) {
  const fixe = CODES_FACULTE_FIXES[normFacKey(nom)];
  if (fixe) return fixe;
  const petits = new Set(['de', 'la', 'le', 'les', 'du', 'des', 'et', 'en', 'l', 'd', 'a', 'à', '&']);
  const mots = String(nom || '')
    .replace(/['’‘&]/g, ' ')
    .split(/[\s\-]+/)
    .filter(m => m && !petits.has(m.toLowerCase()));
  let ini = mots.map(m => m[0]).join('');
  ini = ini.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
  return (ini.slice(0, 2) || 'XX').padEnd(2, 'X');
}

// Génère un matricule « UML{AABB}-{RRRR}{FF} » (ex. « UML2627-2340SI ») :
// UML + terminaisons de l'année académique + 4 chiffres aléatoires + code
// faculté. Le numéro est ALÉATOIRE et vérifié en base : insensible aux
// suppressions (un matricule effacé n'est jamais réattribué) → plus jamais
// d'erreur « Duplicate entry … for key etudiant.PRIMARY ».
async function genererMatricule(anneeAcademique, faculteNom) {
  const an = suffixeAnnees(anneeAcademique);
  const fac = codeFaculte(faculteNom);
  for (let i = 0; i < 100000; i++) {
    const rnd = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    const matricule = `UML${an}-${rnd}${fac}`;
    const [[exist]] = await pool.query('SELECT 1 AS x FROM etudiant WHERE id = ?', [matricule]);
    if (!exist) return matricule;
  }
  throw new Error('Impossible de générer un matricule unique.');
}

module.exports = { genererMatricule, suffixeAnnees, codeFaculte };

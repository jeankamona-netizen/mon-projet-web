// Le nom de famille (champ « nom » étudiant/professeur, « noms » agent) est
// TOUJOURS stocké en MAJUSCULES, partout dans l'application.
function nomMajuscule(s) {
  return String(s == null ? '' : s).trim().toUpperCase();
}

module.exports = { nomMajuscule };

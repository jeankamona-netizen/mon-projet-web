const PDFDocument = require('pdfkit');
const path = require('path');

// =====================================================================
// Bulletin PDF officiel UML — inspiré du modèle fourni (tableau Code UE /
// Éléments Constitutifs / Moyennes / Coefficient / Crédits / Résultat UE,
// bloc absences, barème de correspondance des notes). Tient sur UNE seule
// page A4 : Semestre 1, Semestre 2, résumé annuel et barème (en bas, petite
// police) sont tous compactés pour y entrer, avec repli sur une 2e page
// uniquement si le contenu déborde vraiment (beaucoup de cours).
// =====================================================================

const COULEUR_BLEU       = '#1a3a6b';
const COULEUR_OR         = '#f0c020';
const COULEUR_VERT       = '#2d7a2d';
const COULEUR_ROUGE      = '#cc2200';
const COULEUR_GRIS       = '#666666';
const COULEUR_GRIS_CLAIR = '#999999';
const COULEUR_TEXTE      = '#333333';
const COULEUR_BORDURE    = '#dddddd';
const COULEUR_ZEBRE      = '#f7f9fc';
const COULEUR_FOND_BOITE = '#f5f7fb';

const LARGEUR_PAGE = 495; // largeur utile (A4, marges de 50)
const X_DEPART = 50;

const LIBELLES_MENTION = [
  { min: 16, texte: 'Excellent' },
  { min: 14, texte: 'Très Bien' },
  { min: 12, texte: 'Bien' },
  { min: 10, texte: 'Passable' },
  { min: 0,  texte: 'Insuffisant' },
];

const LIBELLES_NIVEAU = {
  L1: 'Licence 1', L2: 'Licence 2', L3: 'Licence 3',
  M1: 'Master 1', M2: 'Master 2', D1: 'Doctorat 1', D2: 'Doctorat 2',
};

const BAREME_CONVERSION = [
  { classique: '16.00 - 20.00', ects: 'A',  us: 'A', japonais: 'S', commentaire: 'Excellent (Très bien)' },
  { classique: '14.00 - 15.99', ects: 'B',  us: 'B', japonais: 'A', commentaire: 'Very good (Bien)' },
  { classique: '12.00 - 13.99', ects: 'C',  us: 'C', japonais: 'B', commentaire: 'Good (Assez-bien)' },
  { classique: '11.00 - 11.99', ects: 'D',  us: 'D', japonais: 'C', commentaire: 'Satisfactory (Passable)' },
  { classique: '10.00 - 10.99', ects: 'E',  us: 'D', japonais: 'P', commentaire: 'Sufficient (Passable)' },
  { classique: '08.00 - 09.99', ects: 'FX', us: 'F', japonais: 'P', commentaire: 'Fail (échec) : rattrapage possible' },
  { classique: '00.00 - 07.99', ects: 'F',  us: 'F', japonais: 'P', commentaire: 'Fail (échec) : rattrapage nécessaire' },
];

const COLONNES_NOTES = [
  { titre: 'Code UE',               largeur: 55  },
  { titre: 'Éléments Constitutifs', largeur: 145 },
  { titre: 'Moy. CC',               largeur: 45  },
  { titre: 'Moy. Examen',           largeur: 50  },
  { titre: 'Moyenne UE',            largeur: 50  },
  { titre: 'Coeff.',                largeur: 35  },
  { titre: 'Créd. Capit.',          largeur: 65  },
  { titre: 'Résultat UE',           largeur: 50  },
];

function calculerMoyenne(notes) {
  const notees = notes.filter(n => n.note !== null);
  if (!notees.length) return null;
  return notees.reduce((s, n) => s + Number(n.note), 0) / notees.length;
}

function mention(moyenne) {
  if (moyenne === null) return '—';
  return LIBELLES_MENTION.find(m => moyenne >= m.min).texte;
}

function formaterDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

// Nouvelle page si le bloc à venir ne tient vraiment pas dans l'espace
// restant (filet de sécurité — un étudiant avec beaucoup de cours peut
// dépasser la page unique visée).
function assurerEspace(doc, hauteurNecessaire) {
  const basPage = doc.page.height - doc.page.margins.bottom;
  if (doc.y + hauteurNecessaire > basPage) {
    doc.addPage();
    doc.y = doc.page.margins.top;
  }
}

function ligneEtiquette(doc, x, y, largeur, etiquette, valeur) {
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COULEUR_TEXTE).text(etiquette, x, y, { continued: true });
  doc.font('Helvetica').text(' ' + (valeur || '—'), { width: largeur });
}

// ===== EN-TÊTE (bandeau, logo, titre) — compacté =====
function dessinerEnTete(doc) {
  doc.rect(X_DEPART, 38, LARGEUR_PAGE, 5).fill(COULEUR_BLEU);

  try {
    doc.image(path.join(__dirname, '../frontend/img/logo.png'), X_DEPART, 47, { width: 34 });
  } catch { /* logo optionnel */ }

  doc.fontSize(13).fillColor(COULEUR_BLEU).font('Helvetica-Bold')
    .text('Université Méthodiste de Lubumbashi', X_DEPART + 42, 49, { width: LARGEUR_PAGE - 42 });
  doc.fontSize(8).fillColor(COULEUR_GRIS).font('Helvetica')
    .text('Bulletin de notes officiel', X_DEPART + 42, 65);

  doc.moveTo(X_DEPART, 84).lineTo(X_DEPART + LARGEUR_PAGE, 84).strokeColor(COULEUR_OR).lineWidth(1.5).stroke();
  doc.y = 90;
}

// ===== IDENTITÉ DE L'ÉTUDIANT (une fois, en tête du document) — compacté =====
function dessinerInfosEtudiant(doc, etudiant) {
  const nomComplet = `${etudiant.prenom} ${etudiant.postnom || ''} ${etudiant.nom}`.replace(/\s+/g, ' ').trim().toUpperCase();
  const naissance = [formaterDate(etudiant.date_naissance), etudiant.lieu_naissance ? `à ${etudiant.lieu_naissance}` : null]
    .filter(Boolean).join(' ');

  const yDepart = doc.y;
  const xGauche = X_DEPART;
  const xDroite = X_DEPART + 350;
  const pas = 12;

  ligneEtiquette(doc, xGauche, yDepart,            330, 'Niveau :',   LIBELLES_NIVEAU[etudiant.niveau] || etudiant.niveau || '—');
  ligneEtiquette(doc, xDroite, yDepart,             145, 'Matricule :', etudiant.id);
  ligneEtiquette(doc, xGauche, yDepart + pas,       330, 'Faculté :',  etudiant.faculte);
  ligneEtiquette(doc, xGauche, yDepart + pas * 2,   330, 'Filière :',  etudiant.filiere_nom || etudiant.promotion);
  ligneEtiquette(doc, xGauche, yDepart + pas * 3,   330, "Nom de l'étudiant :", nomComplet);
  ligneEtiquette(doc, xGauche, yDepart + pas * 4,   330, 'Date et lieu de naissance :', naissance || '—');

  doc.y = yDepart + pas * 4 + 16;
  doc.moveTo(X_DEPART, doc.y).lineTo(X_DEPART + LARGEUR_PAGE, doc.y).strokeColor(COULEUR_BORDURE).lineWidth(1).stroke();
  doc.y += 8;
}

// ===== BANDEAU ANNÉE / CLASSE / PÉRIODE — compacté =====
function dessinerBandeauPeriode(doc, etudiant, anneeAcademique, periode) {
  const largeurCol = LARGEUR_PAGE / 3;
  const y = doc.y;
  const hauteurTitre = 12, hauteurValeur = 14;

  const cellules = [
    { titre: 'Année académique', valeur: anneeAcademique || etudiant.annee_academique || '—' },
    { titre: 'Classe',           valeur: etudiant.promotion || '—' },
    { titre: 'Période',          valeur: periode },
  ];
  cellules.forEach((c, i) => {
    const x = X_DEPART + i * largeurCol;
    doc.rect(x, y, largeurCol, hauteurTitre).fill(COULEUR_BLEU);
    doc.fontSize(7.3).font('Helvetica-Bold').fillColor('#ffffff')
      .text(c.titre, x, y + 3, { width: largeurCol, align: 'center' });
    doc.rect(x, y + hauteurTitre, largeurCol, hauteurValeur).strokeColor(COULEUR_BORDURE).lineWidth(0.5).stroke();
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(COULEUR_TEXTE)
      .text(c.valeur, x, y + hauteurTitre + 3, { width: largeurCol, align: 'center' });
  });
  doc.y = y + hauteurTitre + hauteurValeur + 6;
}

// ===== TABLEAU DES NOTES (Code UE = code du cours, comme demandé) — compacté =====
function dessinerTableauNotes(doc, notes) {
  assurerEspace(doc, 35);
  let y = doc.y;

  doc.rect(X_DEPART, y, LARGEUR_PAGE, 18).fill(COULEUR_BLEU);
  let x = X_DEPART;
  doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#ffffff');
  COLONNES_NOTES.forEach(c => {
    doc.text(c.titre, x + 3, y + 6, { width: c.largeur - 6, align: 'center' });
    x += c.largeur;
  });
  y += 18;
  doc.y = y;

  notes.forEach((n, i) => {
    // Libellés courts : "Non validée" et "En attente" débordaient sur deux
    // lignes dans la colonne Résultat UE (44pt de large) et chevauchaient la
    // ligne suivante — "Échec"/"Attente" tiennent toujours sur une ligne.
    const resultat = n.note === null ? 'Attente' : (n.note >= 10 ? 'Validée' : 'Échec');
    const couleurResultat = n.note === null ? COULEUR_GRIS_CLAIR : (n.note >= 10 ? COULEUR_VERT : COULEUR_ROUGE);
    const creditsCap = (n.note !== null && n.note >= 10) ? n.credits : 0;

    const valeurs = [
      n.code,
      n.matiere,
      n.note_cc !== null && n.note_cc !== undefined ? Number(n.note_cc).toFixed(2) : '—',
      n.note_examen !== null && n.note_examen !== undefined ? Number(n.note_examen).toFixed(2) : '—',
      n.note !== null ? Number(n.note).toFixed(2) : '—',
      String(n.credits),
      `${creditsCap}/${n.credits}`,
      resultat,
    ];

    // Hauteur de ligne = le maximum requis par chaque colonne (le code du
    // cours, la matière ou le résultat peuvent déborder sur une ligne).
    const hauteurLigne = Math.max(13, ...valeurs.map((val, j) =>
      doc.font('Helvetica').fontSize(7.2).heightOfString(String(val), { width: COLONNES_NOTES[j].largeur - 6 }) + 4
    ));

    assurerEspace(doc, hauteurLigne + 3);
    y = doc.y;

    if (i % 2 === 1) doc.rect(X_DEPART, y, LARGEUR_PAGE, hauteurLigne).fill(COULEUR_ZEBRE);

    x = X_DEPART;
    doc.fontSize(7.2);
    valeurs.forEach((val, j) => {
      doc.font(j === COLONNES_NOTES.length - 1 ? 'Helvetica-Bold' : 'Helvetica')
        .fillColor(j === COLONNES_NOTES.length - 1 ? couleurResultat : COULEUR_TEXTE)
        .text(String(val), x + 3, y + 3, { width: COLONNES_NOTES[j].largeur - 6, align: j === 1 ? 'left' : 'center' });
      x += COLONNES_NOTES[j].largeur;
    });

    y += hauteurLigne;
    doc.moveTo(X_DEPART, y).lineTo(X_DEPART + LARGEUR_PAGE, y).strokeColor(COULEUR_BORDURE).lineWidth(0.5).stroke();
    doc.y = y;
  });

  doc.y += 3;
}

function dessinerTotalGeneral(doc, notes) {
  const totalPoints   = notes.reduce((s, n) => s + (n.note !== null ? Number(n.note) * n.credits : 0), 0);
  const totalPossible = notes.reduce((s, n) => s + n.credits * 20, 0);

  assurerEspace(doc, 18);
  const y = doc.y;
  doc.rect(X_DEPART, y, LARGEUR_PAGE, 15).fillAndStroke('#eef2fb', COULEUR_BORDURE);
  doc.fontSize(8.3).font('Helvetica-Bold').fillColor(COULEUR_BLEU)
    .text('Total Général', X_DEPART + 8, y + 3.5);
  doc.text(`${totalPoints.toFixed(2)} / ${totalPossible}`, X_DEPART, y + 3.5, { width: LARGEUR_PAGE - 8, align: 'right' });
  doc.y = y + 20;
}

// Les absences ne sont pas encore suivies dans l'application : les champs
// restent volontairement vides (pas de valeur inventée) en attendant.
// Bloc compact sur deux lignes plutôt que deux grandes boîtes.
function dessinerAbsencesEtMoyenne(doc, notesSession) {
  assurerEspace(doc, 30);
  const y = doc.y;

  const moyenne = calculerMoyenne(notesSession);
  const creditsCapitalises = notesSession.filter(n => n.note !== null && n.note >= 10).reduce((s, n) => s + n.credits, 0);
  const creditsTotal = notesSession.reduce((s, n) => s + n.credits, 0);

  doc.rect(X_DEPART, y, LARGEUR_PAGE, 26).fillAndStroke(COULEUR_FOND_BOITE, COULEUR_BORDURE);

  doc.fontSize(7.5).font('Helvetica').fillColor(COULEUR_TEXTE)
    .text('Absences — Total : — · Justifiées : — · Non justifiées : — · Assiduité : —/20', X_DEPART + 8, y + 5, { width: LARGEUR_PAGE - 16 });

  doc.font('Helvetica-Bold').fillColor(COULEUR_BLEU)
    .text(`Moyenne semestrielle : ${moyenne !== null ? moyenne.toFixed(2) + '/20' : '—'}`, X_DEPART + 8, y + 16, { continued: true });
  doc.font('Helvetica').fillColor(COULEUR_TEXTE)
    .text(`    —    Crédits capitalisés : ${creditsCapitalises} / ${creditsTotal}`);

  doc.y = y + 32;
}

function dessinerObservation(doc, notesSession, numero) {
  assurerEspace(doc, 14);
  const moyenne = calculerMoyenne(notesSession);
  const statutSemestre = moyenne === null ? '' : (moyenne >= 10 ? 'Semestre Validé' : 'Semestre Non Validé');
  const observation = moyenne === null ? 'Notes en attente de complétion.' : `${mention(moyenne)}, ${statutSemestre}`;

  const y = doc.y;
  doc.fontSize(8).font('Helvetica-Bold').fillColor(COULEUR_TEXTE).text(`Observation S${numero} :`, X_DEPART, y, { continued: true });
  doc.font('Helvetica').fillColor(COULEUR_BLEU).text(' ' + observation);

  doc.y = y + 18;
}

function dessinerSemestre(doc, etudiant, notesSession, numero) {
  assurerEspace(doc, 40);
  doc.fontSize(10.5).font('Helvetica-Bold').fillColor(COULEUR_BLEU).text(`Semestre ${numero}`, X_DEPART, doc.y);
  doc.y += 14;

  const anneeAcademique = notesSession[0]?.annee_academique;
  dessinerBandeauPeriode(doc, etudiant, anneeAcademique, `Semestre ${numero} / Session 1`);

  if (!notesSession.length) {
    doc.fontSize(8.5).fillColor(COULEUR_GRIS_CLAIR).font('Helvetica')
      .text('Aucune note enregistrée pour ce semestre.', X_DEPART, doc.y);
    doc.y += 16;
    return;
  }

  dessinerTableauNotes(doc, notesSession);
  dessinerTotalGeneral(doc, notesSession);
  dessinerAbsencesEtMoyenne(doc, notesSession);
  dessinerObservation(doc, notesSession, numero);
}

function dessinerResumeEtSignature(doc, notes) {
  assurerEspace(doc, 45);
  const moyenne = calculerMoyenne(notes);
  const creditsValides = notes.filter(n => n.note !== null && n.note >= 10).reduce((s, n) => s + n.credits, 0);
  const creditsTotal   = notes.reduce((s, n) => s + n.credits, 0);

  const texteResume = notes.length
    ? `Moyenne générale annuelle : ${moyenne !== null ? moyenne.toFixed(2) + '/20' : '—'}    —    Mention : ${mention(moyenne)}    —    Crédits validés : ${creditsValides} / ${creditsTotal}`
    : 'Aucune note enregistrée pour le moment.';
  let taille = 9.5;
  doc.font('Helvetica-Bold');
  while (taille > 7 && doc.fontSize(taille).widthOfString(texteResume) > LARGEUR_PAGE) taille -= 0.5;

  const y = doc.y;
  doc.moveTo(X_DEPART, y).lineTo(X_DEPART + LARGEUR_PAGE, y).strokeColor(COULEUR_OR).lineWidth(1.5).stroke();
  doc.fontSize(taille).font('Helvetica-Bold').fillColor(COULEUR_BLEU)
    .text(texteResume, X_DEPART, y + 7, { width: LARGEUR_PAGE, align: 'center' });

  // Signature unique pour l'ensemble du bulletin (les deux semestres).
  const ySignature = y + 24;
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COULEUR_TEXTE)
    .text('La Direction', X_DEPART + LARGEUR_PAGE - 145, ySignature, { width: 145, align: 'center' });
  doc.moveTo(X_DEPART + LARGEUR_PAGE - 145, ySignature + 26).lineTo(X_DEPART + LARGEUR_PAGE, ySignature + 26)
    .strokeColor(COULEUR_BORDURE).stroke();

  doc.y = ySignature + 34;
}

function dessinerDateEtNote(doc) {
  assurerEspace(doc, 16);
  const y = doc.y;
  const dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  doc.fontSize(8.3).font('Helvetica').fillColor(COULEUR_TEXTE)
    .text(`Lubumbashi, le ${dateStr}`, X_DEPART, y, { width: 250 });
  doc.font('Helvetica-Bold').fillColor(COULEUR_ROUGE)
    .text('NB : Aucun duplicata ne sera délivré', X_DEPART + 250, y, { width: LARGEUR_PAGE - 250, align: 'right' });
  doc.y = y + 16;
}

// ===== BARÈME — tout en bas de page, petite police (9), comme demandé =====
// Ancré au bas de la page (pas seulement placé après le contenu qui
// précède) : s'il reste de la place libre, le barème est repoussé vers le
// bas plutôt que de flotter juste sous la signature.
function dessinerBareme(doc) {
  const hauteurLigne = 13;
  const hauteurTotale = 12 + 13 + BAREME_CONVERSION.length * hauteurLigne; // titre + en-tête + lignes
  const reservePied = 34; // marge de sécurité au-dessus du pied de page (évite tout chevauchement)
  const basPage = doc.page.height - doc.page.margins.bottom;
  const yAncre = basPage - hauteurTotale - reservePied;
  if (yAncre > doc.y) doc.y = yAncre;
  else assurerEspace(doc, hauteurTotale + reservePied);

  doc.fontSize(9).font('Helvetica-Bold').fillColor(COULEUR_TEXTE)
    .text('Système de correspondance des notes', X_DEPART, doc.y);
  doc.y += 12;

  const colonnes = [
    { titre: 'Note (/20)',   largeur: 70  },
    { titre: 'ECTS',         largeur: 40  },
    { titre: 'US',           largeur: 40  },
    { titre: 'Japonais',     largeur: 50  },
    { titre: 'Commentaire',  largeur: 295 },
  ];
  let y = doc.y;
  doc.rect(X_DEPART, y, LARGEUR_PAGE, 13).fill(COULEUR_BLEU);
  let x = X_DEPART;
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff');
  colonnes.forEach(c => { doc.text(c.titre, x + 3, y + 2.5, { width: c.largeur - 6 }); x += c.largeur; });
  y += 13;

  BAREME_CONVERSION.forEach((ligne, i) => {
    if (i % 2 === 1) doc.rect(X_DEPART, y, LARGEUR_PAGE, 13).fill(COULEUR_ZEBRE);
    x = X_DEPART;
    const valeurs = [ligne.classique, ligne.ects, ligne.us, ligne.japonais, ligne.commentaire];
    doc.fontSize(9).font('Helvetica').fillColor(COULEUR_TEXTE);
    valeurs.forEach((v, j) => { doc.text(v, x + 3, y + 2.5, { width: colonnes[j].largeur - 6 }); x += colonnes[j].largeur; });
    y += 13;
  });

  doc.y = y + 4;
}

function dessinerPiedDePage(doc) {
  const yPied = doc.page.height - doc.page.margins.bottom - 20;
  doc.fontSize(7)
    .fillColor(COULEUR_GRIS_CLAIR).font('Helvetica')
    .text(
      'Université Méthodiste de Lubumbashi — N°249, Croisement Av. Kasavubu & Likasi, Lubumbashi, RDC — contact@uml.ac.cd — Arrêté N° 0173/MINESU/2021',
      X_DEPART, yPied, { width: LARGEUR_PAGE, align: 'center' }
    );
}

function genererBulletinPDF(res, etudiant, notes) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const nomFichier = `bulletin_${etudiant.id}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${nomFichier}"`);
  doc.pipe(res);

  const s1 = notes.filter(n => n.session === 'S1');
  const s2 = notes.filter(n => n.session === 'S2');

  dessinerEnTete(doc);
  dessinerInfosEtudiant(doc, etudiant);

  dessinerSemestre(doc, etudiant, s1, 1);
  dessinerSemestre(doc, etudiant, s2, 2);

  dessinerResumeEtSignature(doc, notes);
  dessinerDateEtNote(doc);

  // Le barème reste tout en bas de la (dernière) page.
  dessinerBareme(doc);

  dessinerPiedDePage(doc);

  doc.end();
}

module.exports = { genererBulletinPDF };

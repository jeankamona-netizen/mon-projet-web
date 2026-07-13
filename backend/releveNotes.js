const PDFDocument = require('pdfkit');
const path = require('path');

// =====================================================================
// Relevé de notes CUMULATIF — un seul document couvrant TOUTES les années
// académiques de l'étudiant (contrairement au bulletin, qui ne couvre
// qu'une année/deux semestres). Reprend la charte visuelle du bulletin
// (bulletin.js) mais regroupe les cours par ANNÉE ACADÉMIQUE plutôt que
// par semestre, et ajoute un total général cumulé sur toute la scolarité.
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

const COLONNES_NOTES = [
  { titre: 'Code UE',               largeur: 55  },
  { titre: 'Éléments Constitutifs', largeur: 155 },
  { titre: 'Sem.',                  largeur: 30  },
  { titre: 'Moyenne UE',            largeur: 55  },
  { titre: 'Coeff.',                largeur: 40  },
  { titre: 'Créd. Capit.',          largeur: 70  },
  { titre: 'Résultat UE',           largeur: 60  },
];

function calculerMoyennePonderee(notes) {
  const notees = notes.filter(n => n.note !== null);
  if (!notees.length) return null;
  const totalPoints = notees.reduce((s, n) => s + Number(n.note) * n.credits, 0);
  const totalCredits = notees.reduce((s, n) => s + n.credits, 0);
  return totalCredits ? totalPoints / totalCredits : null;
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

function dessinerEnTete(doc) {
  doc.rect(X_DEPART, 38, LARGEUR_PAGE, 5).fill(COULEUR_BLEU);

  try {
    doc.image(path.join(__dirname, '../frontend/img/logo.png'), X_DEPART, 47, { width: 34 });
  } catch { /* logo optionnel */ }

  doc.fontSize(13).fillColor(COULEUR_BLEU).font('Helvetica-Bold')
    .text('Université Méthodiste de Lubumbashi', X_DEPART + 42, 49, { width: LARGEUR_PAGE - 42 });
  doc.fontSize(8).fillColor(COULEUR_GRIS).font('Helvetica')
    .text('Relevé de notes cumulatif — Ensemble de la scolarité', X_DEPART + 42, 65);

  doc.moveTo(X_DEPART, 84).lineTo(X_DEPART + LARGEUR_PAGE, 84).strokeColor(COULEUR_OR).lineWidth(1.5).stroke();
  doc.y = 90;
}

function dessinerInfosEtudiant(doc, etudiant) {
  const nomComplet = `${etudiant.prenom} ${etudiant.postnom || ''} ${etudiant.nom}`.replace(/\s+/g, ' ').trim().toUpperCase();
  const naissance = [formaterDate(etudiant.date_naissance), etudiant.lieu_naissance ? `à ${etudiant.lieu_naissance}` : null]
    .filter(Boolean).join(' ');

  const yDepart = doc.y;
  const xGauche = X_DEPART;
  const xDroite = X_DEPART + 350;
  const pas = 12;

  ligneEtiquette(doc, xGauche, yDepart,            330, 'Niveau actuel :', LIBELLES_NIVEAU[etudiant.niveau] || etudiant.niveau || '—');
  ligneEtiquette(doc, xDroite, yDepart,             145, 'Matricule :', etudiant.id);
  ligneEtiquette(doc, xGauche, yDepart + pas,       330, 'Faculté :',  etudiant.faculte);
  ligneEtiquette(doc, xGauche, yDepart + pas * 2,   330, 'Filière :',  etudiant.filiere_nom || etudiant.promotion);
  ligneEtiquette(doc, xGauche, yDepart + pas * 3,   330, "Nom de l'étudiant :", nomComplet);
  ligneEtiquette(doc, xGauche, yDepart + pas * 4,   330, 'Date et lieu de naissance :', naissance || '—');

  doc.y = yDepart + pas * 4 + 16;
  doc.moveTo(X_DEPART, doc.y).lineTo(X_DEPART + LARGEUR_PAGE, doc.y).strokeColor(COULEUR_BORDURE).lineWidth(1).stroke();
  doc.y += 8;
}

function dessinerBandeauAnnee(doc, anneeAcademique, niveau) {
  const largeurCol = LARGEUR_PAGE / 2;
  const y = doc.y;
  const hauteurTitre = 12, hauteurValeur = 14;

  const cellules = [
    { titre: 'Année académique', valeur: anneeAcademique || '—' },
    { titre: 'Niveau',           valeur: LIBELLES_NIVEAU[niveau] || niveau || '—' },
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
    const resultat = n.note === null ? 'Attente' : (n.note >= 10 ? 'Validée' : 'Échec');
    const couleurResultat = n.note === null ? COULEUR_GRIS_CLAIR : (n.note >= 10 ? COULEUR_VERT : COULEUR_ROUGE);
    const creditsCap = (n.note !== null && n.note >= 10) ? n.credits : 0;

    const valeurs = [
      n.code,
      n.matiere,
      n.session,
      n.note !== null ? Number(n.note).toFixed(2) : '—',
      String(n.credits),
      `${creditsCap}/${n.credits}`,
      resultat,
    ];

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

function dessinerBilanAnnee(doc, notes) {
  assurerEspace(doc, 26);
  const y = doc.y;

  const moyenne = calculerMoyennePonderee(notes);
  const creditsCapitalises = notes.filter(n => n.note !== null && n.note >= 10).reduce((s, n) => s + n.credits, 0);
  const creditsTotal = notes.reduce((s, n) => s + n.credits, 0);
  const statutAnnee = moyenne === null ? 'Notes en attente' : (moyenne >= 10 ? 'Année Validée' : 'Année Non Validée');

  doc.rect(X_DEPART, y, LARGEUR_PAGE, 20).fillAndStroke(COULEUR_FOND_BOITE, COULEUR_BORDURE);
  doc.font('Helvetica-Bold').fontSize(8.3).fillColor(COULEUR_BLEU)
    .text(`Moyenne annuelle : ${moyenne !== null ? moyenne.toFixed(2) + '/20' : '—'}`, X_DEPART + 8, y + 5, { continued: true });
  doc.font('Helvetica').fillColor(COULEUR_TEXTE)
    .text(`    —    Crédits capitalisés : ${creditsCapitalises} / ${creditsTotal}    —    ${statutAnnee}`);

  doc.y = y + 26;
}

function dessinerAnnee(doc, annee) {
  assurerEspace(doc, 40);
  doc.fontSize(10.5).font('Helvetica-Bold').fillColor(COULEUR_BLEU)
    .text(`Année académique ${annee.annee_academique}`, X_DEPART, doc.y);
  doc.y += 14;

  dessinerBandeauAnnee(doc, annee.annee_academique, annee.niveau);

  if (!annee.notes.length) {
    doc.fontSize(8.5).fillColor(COULEUR_GRIS_CLAIR).font('Helvetica')
      .text('Aucune note enregistrée pour cette année.', X_DEPART, doc.y);
    doc.y += 16;
    return;
  }

  dessinerTableauNotes(doc, annee.notes);
  dessinerBilanAnnee(doc, annee.notes);
}

function dessinerResumeCumulatifEtSignature(doc, toutesLesNotes) {
  assurerEspace(doc, 45);
  const moyenne = calculerMoyennePonderee(toutesLesNotes);
  const creditsValides = toutesLesNotes.filter(n => n.note !== null && n.note >= 10).reduce((s, n) => s + n.credits, 0);
  const creditsTotal   = toutesLesNotes.reduce((s, n) => s + n.credits, 0);

  const texteResume = toutesLesNotes.length
    ? `Moyenne cumulative générale : ${moyenne !== null ? moyenne.toFixed(2) + '/20' : '—'}    —    Mention : ${mention(moyenne)}    —    Crédits cumulés : ${creditsValides} / ${creditsTotal}`
    : 'Aucune note enregistrée pour le moment.';
  let taille = 9.5;
  doc.font('Helvetica-Bold');
  while (taille > 6.5 && doc.fontSize(taille).widthOfString(texteResume) > LARGEUR_PAGE) taille -= 0.5;

  const y = doc.y;
  doc.moveTo(X_DEPART, y).lineTo(X_DEPART + LARGEUR_PAGE, y).strokeColor(COULEUR_OR).lineWidth(1.5).stroke();
  doc.fontSize(taille).font('Helvetica-Bold').fillColor(COULEUR_BLEU)
    .text(texteResume, X_DEPART, y + 7, { width: LARGEUR_PAGE, align: 'center' });

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

function dessinerPiedDePage(doc) {
  const yPied = doc.page.height - doc.page.margins.bottom - 20;
  doc.fontSize(7)
    .fillColor(COULEUR_GRIS_CLAIR).font('Helvetica')
    .text(
      'Université Méthodiste de Lubumbashi — N°249, Croisement Av. Kasavubu & Likasi, Lubumbashi, RDC — contact@uml.ac.cd — Arrêté N° 0173/MINESU/2021',
      X_DEPART, yPied, { width: LARGEUR_PAGE, align: 'center' }
    );
}

// notesParAnnee : tableau trié [{ annee_academique, niveau, notes: [...] }, ...]
function genererReleveNotesCumulatifPDF(res, etudiant, notesParAnnee) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const nomFichier = `releve_cumulatif_${etudiant.id}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${nomFichier}"`);
  doc.pipe(res);

  dessinerEnTete(doc);
  dessinerInfosEtudiant(doc, etudiant);

  notesParAnnee.forEach(annee => dessinerAnnee(doc, annee));

  const toutesLesNotes = notesParAnnee.flatMap(a => a.notes);
  dessinerResumeCumulatifEtSignature(doc, toutesLesNotes);
  dessinerDateEtNote(doc);
  dessinerPiedDePage(doc);

  doc.end();
}

module.exports = { genererReleveNotesCumulatifPDF };

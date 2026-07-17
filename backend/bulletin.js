const PDFDocument = require('pdfkit');
const path = require('path');

// =====================================================================
// Bulletin PDF officiel UML — tableau Code UE / Éléments Constitutifs /
// Moyennes / Coefficient / Crédits / Résultat UE, assiduité /20 par
// semestre, résumé annuel et bloc signature (date, La Direction, sceau).
// Tient sur UNE seule page A4 : Semestre 1 et Semestre 2 sont compactés
// pour y entrer, avec repli sur une 2e page uniquement si le contenu
// déborde vraiment (beaucoup de cours).
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
  // Année académique placée juste sous le matricule (le bandeau Année/Classe/
  // Période a été retiré des semestres).
  ligneEtiquette(doc, xDroite, yDepart + pas,       145, 'Année :',    etudiant.annee_academique || '—');
  ligneEtiquette(doc, xGauche, yDepart + pas,       330, 'Faculté :',  etudiant.faculte);
  ligneEtiquette(doc, xGauche, yDepart + pas * 2,   330, 'Filière :',  etudiant.filiere_nom || etudiant.promotion);
  ligneEtiquette(doc, xGauche, yDepart + pas * 3,   330, "Nom de l'étudiant :", nomComplet);
  ligneEtiquette(doc, xGauche, yDepart + pas * 4,   330, 'Date et lieu de naissance :', naissance || '—');

  doc.y = yDepart + pas * 4 + 16;
  doc.moveTo(X_DEPART, doc.y).lineTo(X_DEPART + LARGEUR_PAGE, doc.y).strokeColor(COULEUR_BORDURE).lineWidth(1).stroke();
  doc.y += 8;
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

  assurerEspace(doc, 16);
  const y = doc.y;
  doc.rect(X_DEPART, y, LARGEUR_PAGE, 13).fillAndStroke('#eef2fb', COULEUR_BORDURE);
  doc.fontSize(8.3).font('Helvetica-Bold').fillColor(COULEUR_BLEU)
    .text('Total Général', X_DEPART + 8, y + 2.5);
  doc.text(`${totalPoints.toFixed(2)} / ${totalPossible}`, X_DEPART, y + 2.5, { width: LARGEUR_PAGE - 8, align: 'right' });
  doc.y = y + 17;
}

// Assiduité agrégée depuis la table presence (jointe côté serveur), scopée
// aux cours du semestre affiché. Si aucune séance n'a encore été enregistrée
// pour ces cours, on garde un texte neutre plutôt qu'une valeur inventée.
function dessinerAbsencesEtMoyenne(doc, notesSession, presenceSession) {
  assurerEspace(doc, 26);
  const y = doc.y;

  const moyenne = calculerMoyenne(notesSession);
  const creditsCapitalises = notesSession.filter(n => n.note !== null && n.note >= 10).reduce((s, n) => s + n.credits, 0);
  const creditsTotal = notesSession.reduce((s, n) => s + n.credits, 0);

  doc.rect(X_DEPART, y, LARGEUR_PAGE, 16).fillAndStroke(COULEUR_FOND_BOITE, COULEUR_BORDURE);

  // Assiduité cotée sur 20 = moyenne de la participation aux séances du
  // semestre (présent = 20, retard = 10, absent = 0). Pas de détail
  // absences/total/non justifiées — juste la note /20.
  const assiduite = presenceSession && presenceSession.total > 0
    ? ((presenceSession.present + presenceSession.retard * 0.5) / presenceSession.total) * 20
    : null;

  // Moyenne semestrielle, assiduité et crédits capitalisés sur une SEULE
  // ligne, même taille / police / couleur.
  const ligneSynthese =
    `Moyenne semestrielle : ${moyenne !== null ? moyenne.toFixed(2) + '/20' : '—'}` +
    `        Assiduité : ${assiduite !== null ? assiduite.toFixed(2) : '—'} /20` +
    `        Crédits capitalisés : ${creditsCapitalises} / ${creditsTotal}`;

  doc.fontSize(8.5).font('Helvetica-Bold').fillColor(COULEUR_TEXTE)
    .text(ligneSynthese, X_DEPART + 8, y + 4.5, { width: LARGEUR_PAGE - 16 });

  doc.y = y + 21;
}

function dessinerObservation(doc, notesSession, numero) {
  assurerEspace(doc, 14);
  const moyenne = calculerMoyenne(notesSession);
  const statutSemestre = moyenne === null ? '' : (moyenne >= 10 ? 'Semestre Validé' : 'Semestre Non Validé');
  const observation = moyenne === null ? 'Notes en attente de complétion.' : `${mention(moyenne)}, ${statutSemestre}`;

  const y = doc.y;
  // Libellé et valeur dans le même style (taille / police / couleur).
  doc.fontSize(8).font('Helvetica-Bold').fillColor(COULEUR_TEXTE)
    .text(`Observation S${numero} : ${observation}`, X_DEPART, y, { width: LARGEUR_PAGE });

  doc.y = y + 14;
}

function dessinerSemestre(doc, etudiant, notesSession, numero, presences) {
  assurerEspace(doc, 40);
  doc.fontSize(10.5).font('Helvetica-Bold').fillColor(COULEUR_BLEU).text(`Semestre ${numero}`, X_DEPART, doc.y);
  doc.y += 14;

  if (!notesSession.length) {
    doc.fontSize(8.5).fillColor(COULEUR_GRIS_CLAIR).font('Helvetica')
      .text('Aucune note enregistrée pour ce semestre.', X_DEPART, doc.y);
    doc.y += 16;
    return;
  }

  dessinerTableauNotes(doc, notesSession);
  dessinerTotalGeneral(doc, notesSession);

  // L'assiduité par semestre est déduite des cours notés dans ce semestre
  // (la table presence n'a pas de notion de session S1/S2 propre).
  const coursIds = new Set(notesSession.map(n => n.cours_id));
  const presenceSession = (presences || [])
    .filter(p => coursIds.has(p.cours_id))
    .reduce((acc, p) => ({
      total: acc.total + p.total, present: acc.present + p.present,
      absent: acc.absent + p.absent, retard: acc.retard + p.retard,
    }), { total: 0, present: 0, absent: 0, retard: 0 });

  dessinerAbsencesEtMoyenne(doc, notesSession, presenceSession);
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

  doc.y = y + 24;
}

// Bas du bulletin : ligne de démarcation, puis date (à gauche) et signature de
// la direction avec le sceau (à droite). Le NB est conservé sous la date.
function dessinerDateEtNote(doc) {
  assurerEspace(doc, 52);

  // Ligne de démarcation.
  const yLigne = doc.y;
  doc.moveTo(X_DEPART, yLigne).lineTo(X_DEPART + LARGEUR_PAGE, yLigne).strokeColor(COULEUR_BORDURE).lineWidth(1).stroke();

  const y = yLigne + 10;
  const dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  // Bas gauche : date.
  doc.fontSize(8.5).font('Helvetica').fillColor(COULEUR_TEXTE)
    .text(`Lubumbashi, le ${dateStr}`, X_DEPART, y, { width: 250 });

  // Bas droite : La Direction, avec « Sceau » juste en dessous.
  const largeurBloc = 160;
  const xBloc = X_DEPART + LARGEUR_PAGE - largeurBloc;
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor(COULEUR_TEXTE)
    .text('La Direction', xBloc, y, { width: largeurBloc, align: 'center' });
  doc.fontSize(8).font('Helvetica').fillColor(COULEUR_GRIS)
    .text('(Sceau)', xBloc, y + 28, { width: largeurBloc, align: 'center' });

  doc.y = y + 40;
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

function genererBulletinPDF(res, etudiant, notes, presences = []) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const nomFichier = `bulletin_${etudiant.id}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${nomFichier}"`);
  doc.pipe(res);

  const s1 = notes.filter(n => n.session === 'S1');
  const s2 = notes.filter(n => n.session === 'S2');

  dessinerEnTete(doc);
  dessinerInfosEtudiant(doc, etudiant);

  dessinerSemestre(doc, etudiant, s1, 1, presences);
  dessinerSemestre(doc, etudiant, s2, 2, presences);

  dessinerResumeEtSignature(doc, notes);
  dessinerDateEtNote(doc);

  dessinerPiedDePage(doc);

  doc.end();
}

module.exports = { genererBulletinPDF };

const PDFDocument = require('pdfkit');
const path = require('path');

const LIBELLES_MENTION = [
  { min: 16, texte: 'Excellence' },
  { min: 14, texte: 'Bien' },
  { min: 12, texte: 'Assez bien' },
  { min: 10, texte: 'Passable' },
  { min: 0,  texte: 'Insuffisant' },
];

function calculerMoyenne(notes) {
  const notees = notes.filter(n => n.note !== null);
  if (!notees.length) return null;
  return notees.reduce((s, n) => s + Number(n.note), 0) / notees.length;
}

function dessinerTableauSession(doc, titre, notes) {
  doc.moveDown(0.8);
  doc.fontSize(12).fillColor('#1a3a6b').font('Helvetica-Bold').text(titre);
  doc.moveDown(0.3);

  const colonnes = [
    { titre: 'Code',    largeur: 60 },
    { titre: 'Matière', largeur: 220 },
    { titre: 'Crédits', largeur: 60 },
    { titre: 'Note /20',largeur: 70 },
    { titre: 'Statut',  largeur: 80 },
  ];
  const xDepart = doc.x;
  let y = doc.y;

  doc.fontSize(9).font('Helvetica-Bold').fillColor('#666666');
  let x = xDepart;
  colonnes.forEach(c => { doc.text(c.titre, x, y, { width: c.largeur }); x += c.largeur; });
  y += 16;
  doc.moveTo(xDepart, y - 4).lineTo(xDepart + 490, y - 4).strokeColor('#dddddd').stroke();

  doc.font('Helvetica').fillColor('#333333');
  notes.forEach(n => {
    x = xDepart;
    const statut = n.note === null ? 'En attente' : (n.note >= 10 ? 'Réussi' : 'Échec');
    const valeurs = [n.code, n.matiere, String(n.credits), n.note !== null ? `${n.note}/20` : '—', statut];
    valeurs.forEach((val, i) => { doc.text(val, x, y, { width: colonnes[i].largeur }); x += colonnes[i].largeur; });
    y += 18;
  });

  doc.x = xDepart;
  doc.y = y + 4;
}

function genererBulletinPDF(res, etudiant, notes) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const nomFichier = `bulletin_${etudiant.id}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${nomFichier}"`);
  doc.pipe(res);

  // ===== EN-TÊTE =====
  try {
    doc.image(path.join(__dirname, '../frontend/img/logo.png'), 50, 45, { width: 42 });
  } catch { /* logo optionnel */ }

  doc.fontSize(15).fillColor('#1a3a6b').font('Helvetica-Bold')
    .text('Université Méthodiste de Lubumbashi', 105, 48);
  doc.fontSize(9).fillColor('#666666').font('Helvetica')
    .text('Bulletin de notes officiel', 105, 68);

  doc.moveTo(50, 100).lineTo(545, 100).strokeColor('#f0c020').lineWidth(2).stroke();
  doc.y = 115;

  // ===== INFOS ÉTUDIANT =====
  const nomComplet = `${etudiant.prenom} ${etudiant.postnom || ''} ${etudiant.nom}`.replace(/\s+/g, ' ').trim();
  doc.fontSize(10).fillColor('#333333').font('Helvetica-Bold').text('Matricule : ', 50, doc.y, { continued: true })
    .font('Helvetica').text(etudiant.id);
  doc.font('Helvetica-Bold').text('Nom complet : ', 50, doc.y + 4, { continued: true })
    .font('Helvetica').text(nomComplet);
  doc.font('Helvetica-Bold').text('Promotion : ', 50, doc.y + 4, { continued: true })
    .font('Helvetica').text(`${etudiant.niveau || ''} — ${etudiant.promotion || '—'}`);
  doc.font('Helvetica-Bold').text('Année académique : ', 50, doc.y + 4, { continued: true })
    .font('Helvetica').text(etudiant.annee_academique || '—');

  // ===== NOTES PAR SESSION =====
  const s1 = notes.filter(n => n.session === 'S1');
  const s2 = notes.filter(n => n.session === 'S2');
  if (s1.length) dessinerTableauSession(doc, 'Semestre 1', s1);
  if (s2.length) dessinerTableauSession(doc, 'Semestre 2', s2);
  if (!s1.length && !s2.length) {
    doc.moveDown(1).fontSize(10).fillColor('#999999').text('Aucune note enregistrée pour le moment.');
  }

  // ===== RÉSUMÉ =====
  const moyenne = calculerMoyenne(notes);
  const mention = moyenne === null ? '—' : LIBELLES_MENTION.find(m => moyenne >= m.min).texte;
  const creditsValides = notes.filter(n => n.note !== null && n.note >= 10).reduce((s, n) => s + (n.credits || 0), 0);
  const creditsTotal   = notes.reduce((s, n) => s + (n.credits || 0), 0);

  // Les trois indicateurs sont sur une seule ligne, même police et même taille —
  // la taille est réduite jusqu'à ce que la ligne tienne sur la largeur utile.
  const texteResume = `Moyenne générale : ${moyenne !== null ? moyenne.toFixed(2) + '/20' : '—'}    —    Mention : ${mention}    —    Crédits validés : ${creditsValides} / ${creditsTotal}`;
  let tailleResume = 11;
  doc.font('Helvetica-Bold');
  while (tailleResume > 7 && doc.fontSize(tailleResume).widthOfString(texteResume) > 495) tailleResume -= 0.5;

  doc.moveDown(1);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#eeeeee').lineWidth(1).stroke();
  doc.moveDown(0.6);
  doc.fontSize(tailleResume).font('Helvetica-Bold').fillColor('#1a3a6b')
    .text(texteResume, 50, doc.y, { width: 495 });

  // ===== PIED DE PAGE =====
  const yPied = doc.page.height - doc.page.margins.bottom - 30;
  doc.fontSize(8).fillColor('#999999').font('Helvetica')
    .text(`Document généré le ${new Date().toLocaleDateString('fr-FR')} — Université Méthodiste de Lubumbashi. Ce bulletin n'a de valeur officielle qu'accompagné du cachet de l'établissement.`,
      50, yPied, { width: 495, align: 'center', lineBreak: true });

  doc.end();
}

module.exports = { genererBulletinPDF };

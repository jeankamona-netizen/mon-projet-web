const express = require('express');
const router = express.Router();
const pool = require('../database');
// Gérer les notes : ouvert à l'admin ET au décanat (doyen / vice-doyen).
const { requireAdminOuDoyen: requireAdmin, faculteDuDoyen } = require('../middleware/auth');
const { journaliser, ipDeRequete, acteurDeReq } = require('../models/audit');

// Périmètre décanal : un doyen ne gère QUE les notes des étudiants de sa faculté.
async function etudiantDansFaculte(etudiantId, facDoyen) {
  if (!facDoyen) return true;
  const [[e]] = await pool.query('SELECT faculte FROM etudiant WHERE id = ?', [etudiantId]);
  return !!e && e.faculte === facDoyen;
}
async function noteDansFaculte(noteId, facDoyen) {
  if (!facDoyen) return true;
  const [[r]] = await pool.query('SELECT e.faculte FROM note n JOIN etudiant e ON e.id = n.etudiant_id WHERE n.id = ?', [noteId]);
  return !!r && r.faculte === facDoyen;
}

// Le contrôle continu et l'examen peuvent arriver séparément (l'un avant
// l'autre) : la moyenne sur 20 (50 % CC + 50 % examen) n'est calculée que
// lorsque les deux sont connus, sinon elle reste NULL en attendant.
function moyenneSiComplete(note_cc, note_examen) {
  if (note_cc === null || note_cc === undefined || note_examen === null || note_examen === undefined) return null;
  // MySQL renvoie les colonnes DECIMAL sous forme de chaînes : Number() évite
  // une concaténation de chaînes au lieu d'une addition numérique.
  return Math.round(((Number(note_cc) + Number(note_examen)) / 2) * 100) / 100;
}

function noteHorsPlage(valeur) {
  return valeur !== undefined && valeur !== null && (valeur < 0 || valeur > 20);
}

const LIBELLES_MENTION = [
  { min: 16, texte: 'Excellence' },
  { min: 14, texte: 'Bien' },
  { min: 12, texte: 'Assez bien' },
  { min: 10, texte: 'Passable' },
  { min: 0,  texte: 'Insuffisant' },
];

// ===== GET /api/notes/bulletins/resume — un résumé par étudiant (pour l'impression groupée de bulletins) =====
router.get('/bulletins/resume', requireAdmin, async (req, res) => {
  try {
    // Un résumé par (étudiant, année académique, niveau) : un étudiant réinscrit
    // apparaît une fois par année, avec la moyenne propre à cette année (pas de
    // mélange entre les années).
    const [lignes] = await pool.query(`
      SELECT e.id AS etudiant_id, e.nom, e.postnom, e.prenom, e.faculte, e.promotion, f.nom AS filiere,
             n.annee_academique, c.niveau,
             AVG(n.note) AS moyenne_generale,
             SUM(CASE WHEN n.note IS NOT NULL AND n.note >= 10 THEN c.credits ELSE 0 END) AS credits_valides,
             SUM(c.credits) AS credits_total
      FROM etudiant e
      LEFT JOIN filiere f ON e.filiere_id = f.id
      JOIN note n ON n.etudiant_id = e.id
      JOIN cours c ON n.cours_id = c.id
      ${faculteDuDoyen(req) ? 'WHERE e.faculte = ?' : ''}
      GROUP BY e.id, e.nom, e.postnom, e.prenom, e.faculte, e.promotion, f.nom, n.annee_academique, c.niveau
      ORDER BY e.nom, e.prenom
    `, faculteDuDoyen(req) ? [faculteDuDoyen(req)] : []);
    const resultats = lignes.map(l => {
      const moyenne = l.moyenne_generale !== null ? Number(l.moyenne_generale) : null;
      return {
        etudiant_id: l.etudiant_id,
        nom: l.nom, postnom: l.postnom, prenom: l.prenom,
        faculte: l.faculte, promotion: l.promotion, filiere: l.filiere,
        annee_academique: l.annee_academique || '—',
        niveau: l.niveau || '—',
        moyenne_generale: moyenne,
        credits_valides: Number(l.credits_valides),
        credits_total: Number(l.credits_total),
        mention: moyenne === null ? '—' : LIBELLES_MENTION.find(m => moyenne >= m.min).texte,
      };
    });
    res.json(resultats);
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la récupération du résumé des bulletins." });
  }
});

// ===== GET /api/notes/deliberation — rapport de délibération d'une promotion =====
// Params : faculte, niveau, annee (requis) ; filiere (nom, optionnel) ; semestre
// (S1/S2, optionnel → sinon toute l'année). Renvoie la liste des étudiants avec
// moyenne, crédits validés/total, mention et décision (Admis si moyenne ≥ 10),
// plus une synthèse statistique. Un doyen est verrouillé sur SA faculté.
router.get('/deliberation', requireAdmin, async (req, res) => {
  try {
    const facDoyen = faculteDuDoyen(req);
    const faculte = facDoyen || req.query.faculte;
    const { niveau, annee, filiere, semestre } = req.query;
    if (!faculte || !niveau || !annee) {
      return res.status(400).json({ erreur: 'Faculté, niveau et année académique sont requis.' });
    }

    // Résout la filière (nom → id), scopée à la faculté.
    let filiereId = null;
    if (filiere) {
      const [[f]] = await pool.query(
        'SELECT f.id FROM filiere f JOIN faculte fa ON fa.id = f.faculte_id WHERE f.nom = ? AND fa.nom = ?',
        [filiere, faculte]
      );
      if (f) filiereId = f.id;
    }

    const condCours = ['c.faculte = ?', 'c.niveau = ?', 'c.annee_academique = ?'];
    const params = [faculte, niveau, annee];
    if (semestre)  { condCours.push('c.semestre = ?'); params.push(semestre); }
    if (filiereId) { condCours.push('c.filiere_id = ?'); params.push(filiereId); }

    const [lignes] = await pool.query(`
      SELECT e.id AS etudiant_id, e.nom, e.postnom, e.prenom, fil.nom AS filiere,
             AVG(n.note) AS moyenne,
             SUM(CASE WHEN n.note IS NOT NULL AND n.note >= 10 THEN c.credits ELSE 0 END) AS credits_valides,
             SUM(c.credits) AS credits_total,
             SUM(n.note IS NOT NULL) AS nb_notes, COUNT(c.id) AS nb_cours
      FROM etudiant e
      JOIN inscription_cours ic ON ic.etudiant_id = e.id
      JOIN cours c ON c.id = ic.cours_id AND ${condCours.join(' AND ')}
      LEFT JOIN note n ON n.etudiant_id = e.id AND n.cours_id = c.id
      LEFT JOIN filiere fil ON e.filiere_id = fil.id
      GROUP BY e.id, e.nom, e.postnom, e.prenom, fil.nom
      ORDER BY e.nom, e.prenom
    `, params);

    const etudiants = lignes.map(l => {
      const moyenne = l.moyenne !== null ? Number(l.moyenne) : null;
      const decision = moyenne === null ? 'En attente' : (moyenne >= 10 ? 'Admis' : 'Ajourné');
      return {
        etudiant_id: l.etudiant_id, nom: l.nom, postnom: l.postnom, prenom: l.prenom,
        filiere: l.filiere,
        moyenne, credits_valides: Number(l.credits_valides), credits_total: Number(l.credits_total),
        mention: moyenne === null ? '—' : LIBELLES_MENTION.find(m => moyenne >= m.min).texte,
        decision,
      };
    });

    const notes = etudiants.filter(e => e.moyenne !== null);
    const admis = notes.filter(e => e.moyenne >= 10).length;
    const synthese = {
      effectif: etudiants.length,
      notes: notes.length,
      admis,
      ajournes: notes.length - admis,
      taux_reussite: notes.length ? Math.round((admis / notes.length) * 100) : 0,
      moyenne_promotion: notes.length ? Math.round((notes.reduce((s, e) => s + e.moyenne, 0) / notes.length) * 100) / 100 : null,
    };

    res.json({
      periode: { faculte, niveau, annee, filiere: filiere || null, semestre: semestre || null },
      etudiants, synthese,
    });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la génération du rapport de délibération." });
  }
});

// ===== GET /api/notes — toutes les notes (admin), filtrable par faculté/filière/année =====
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { faculte, filiere, annee } = req.query;
    let sql = `
      SELECT n.id, n.note_cc, n.note_examen, n.note, c.semestre AS session, c.annee_academique,
             e.id AS etudiant_id, e.nom AS nom_etudiant, e.postnom AS postnom_etudiant, e.prenom AS prenom_etudiant,
             e.faculte, f.nom AS filiere, c.niveau, c.code, c.nom AS matiere
      FROM note n
      JOIN etudiant e ON n.etudiant_id = e.id
      JOIN cours c ON n.cours_id = c.id
      LEFT JOIN filiere f ON e.filiere_id = f.id
      WHERE 1=1
    `;
    const params = [];
    // Un doyen est verrouillé sur les étudiants de SA faculté (il ne peut pas
    // élargir via le paramètre) ; l'admin utilise le filtre client.
    const faculteEffective = faculteDuDoyen(req) || faculte;
    if (faculteEffective) { sql += ' AND e.faculte = ?'; params.push(faculteEffective); }
    if (filiere) { sql += ' AND f.nom = ?'; params.push(filiere); }
    if (annee)   { sql += ' AND c.annee_academique = ?'; params.push(annee); }
    sql += ' ORDER BY n.id DESC';

    const [notes] = await pool.query(sql, params);
    res.json(notes);
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la récupération des notes." });
  }
});

// ===== POST /api/notes — ajouter/compléter une note =====
// Le contrôle continu et l'examen peuvent être saisis l'un sans l'autre (le
// CC arrive souvent avant l'examen) : on fusionne avec la note déjà
// enregistrée pour cet étudiant/cours/session au lieu d'exiger les deux à
// la fois. La moyenne n'est calculée que lorsque les deux sont connus.
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { etudiant_id, cours_id, note_cc, note_examen, annee_academique } = req.body;

    if (!etudiant_id || !cours_id) {
      return res.status(400).json({ erreur: "Champs obligatoires manquants (étudiant, cours)." });
    }
    if (note_cc === undefined && note_examen === undefined) {
      return res.status(400).json({ erreur: "Renseignez au moins le contrôle continu ou l'examen." });
    }
    if (noteHorsPlage(note_cc) || noteHorsPlage(note_examen)) {
      return res.status(400).json({ erreur: "Les notes doivent être comprises entre 0 et 20." });
    }
    if (!await etudiantDansFaculte(etudiant_id, faculteDuDoyen(req))) {
      return res.status(403).json({ erreur: "Cet étudiant n'appartient pas à votre faculté." });
    }

    // La session (semestre) d'une note est TOUJOURS celle de son cours : un
    // cours appartient à un seul semestre, donc un étudiant n'a qu'une seule
    // note par cours (jamais le même cours dans deux semestres différents).
    const [[cours]] = await pool.query('SELECT semestre FROM cours WHERE id = ?', [cours_id]);
    if (!cours) return res.status(404).json({ erreur: "Cours introuvable." });
    const session = cours.semestre;

    // Une note existe déjà pour cet étudiant et ce cours ? On la complète/écrase
    // au lieu d'en créer une deuxième (quel que soit le semestre).
    const [existante] = await pool.query(
      'SELECT id, note_cc, note_examen FROM note WHERE etudiant_id = ? AND cours_id = ?',
      [etudiant_id, cours_id]
    );

    const ccFinal     = note_cc     !== undefined ? note_cc     : (existante.length ? existante[0].note_cc     : null);
    const examenFinal = note_examen !== undefined ? note_examen : (existante.length ? existante[0].note_examen : null);
    const note = moyenneSiComplete(ccFinal, examenFinal);

    const acteur = acteurDeReq(req);
    if (existante.length > 0) {
      await pool.query(
        'UPDATE note SET note_cc = ?, note_examen = ?, note = ?, session = ?, annee_academique = ? WHERE id = ?',
        [ccFinal, examenFinal, note, session, annee_academique, existante[0].id]
      );
      journaliser({ ...acteur, action: 'Saisie de note', details: `Étudiant ${etudiant_id} · cours ${cours_id} · ${note != null ? note + '/20' : 'partiel'} (maj)`, ip: ipDeRequete(req) });
      return res.json({ message: "Note mise à jour.", id: existante[0].id, note });
    }

    const [resultat] = await pool.query(
      'INSERT INTO note (etudiant_id, cours_id, note_cc, note_examen, note, session, annee_academique) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [etudiant_id, cours_id, ccFinal, examenFinal, note, session, annee_academique]
    );

    journaliser({ ...acteur, action: 'Saisie de note', details: `Étudiant ${etudiant_id} · cours ${cours_id} · ${note != null ? note + '/20' : 'partiel'}`, ip: ipDeRequete(req) });
    res.status(201).json({ message: "Note ajoutée avec succès.", id: resultat.insertId, note });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de l'ajout de la note." });
  }
});

// ===== PUT /api/notes/:id — modifier une note (CC et/ou examen) =====
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { note_cc, note_examen, annee_academique } = req.body;

    if (noteHorsPlage(note_cc) || noteHorsPlage(note_examen)) {
      return res.status(400).json({ erreur: "Les notes doivent être comprises entre 0 et 20." });
    }
    if (!await noteDansFaculte(req.params.id, faculteDuDoyen(req))) {
      return res.status(403).json({ erreur: "Cette note n'appartient pas à votre faculté." });
    }

    // La session reste alignée sur le semestre du cours (jamais saisie libre).
    const [existante] = await pool.query(
      'SELECT n.note_cc, n.note_examen, c.semestre FROM note n JOIN cours c ON n.cours_id = c.id WHERE n.id = ?',
      [req.params.id]
    );
    if (existante.length === 0) return res.status(404).json({ erreur: "Note introuvable." });

    const ccFinal     = note_cc     !== undefined ? note_cc     : existante[0].note_cc;
    const examenFinal = note_examen !== undefined ? note_examen : existante[0].note_examen;
    const note = moyenneSiComplete(ccFinal, examenFinal);

    await pool.query(
      'UPDATE note SET note_cc = ?, note_examen = ?, note = ?, session = ?, annee_academique = ? WHERE id = ?',
      [ccFinal, examenFinal, note, existante[0].semestre, annee_academique, req.params.id]
    );

    res.json({ message: "Note modifiée avec succès.", note });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la modification." });
  }
});

// ===== DELETE /api/notes/:id — supprimer une note =====
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    if (!await noteDansFaculte(req.params.id, faculteDuDoyen(req))) {
      return res.status(403).json({ erreur: "Cette note n'appartient pas à votre faculté." });
    }
    await pool.query('DELETE FROM note WHERE id = ?', [req.params.id]);
    journaliser({ ...acteurDeReq(req), action: 'Suppression de note', details: `Note #${req.params.id} supprimée`, ip: ipDeRequete(req) });
    res.json({ message: "Note supprimée avec succès." });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la suppression." });
  }
});

module.exports = router;
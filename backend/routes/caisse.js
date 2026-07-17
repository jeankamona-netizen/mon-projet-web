const express = require('express');
const router = express.Router();
const pool = require('../database');
const { requireFinance } = require('../middleware/auth');

// Tout le module caisse est réservé au rôle caisse (ou admin).
router.use(requireFinance);

// ===== GET /api/caisse/etudiants — étudiants + total déjà versé (avec filtres) =====
// La caisse a besoin de la liste des étudiants et de leur solde ; on renvoie le
// cumul des versements par étudiant plutôt que d'ouvrir la route admin.
// montant_attendu/solde viennent du barème (frais_scolarite) pour la faculté +
// promotion + année de l'étudiant ; null si aucune ligne de barème n'existe
// encore pour ce triplet (pas confondu avec un solde de 0 $).
router.get('/etudiants', async (req, res) => {
  try {
    const { nom, annee, niveau, faculte } = req.query;
    // montant_attendu = SOMME de toutes les rubriques du barème correspondant
    // (faculté + filière + niveau + année) — sous-requête pour ne pas multiplier
    // le total des versements par le nombre de rubriques.
    let sql = `
      SELECT e.id, e.nom, e.postnom, e.prenom, e.faculte, f.nom AS filiere, e.promotion, e.niveau,
             e.annee_academique, e.statut,
             COALESCE(SUM(p.montant), 0) AS total_verse,
             COUNT(p.id) AS nb_versements,
             (SELECT SUM(fs.montant) FROM frais_scolarite fs
               WHERE fs.faculte = e.faculte AND fs.promotion = e.promotion
                 AND fs.niveau = e.niveau AND fs.annee_academique = e.annee_academique) AS montant_attendu,
             (SELECT p2.rubrique  FROM paiement p2 WHERE p2.etudiant_id = e.id ORDER BY p2.date_paiement DESC, p2.id DESC LIMIT 1) AS dernier_motif,
             (SELECT p2.reference FROM paiement p2 WHERE p2.etudiant_id = e.id ORDER BY p2.date_paiement DESC, p2.id DESC LIMIT 1) AS derniere_reference
      FROM etudiant e
      LEFT JOIN filiere f ON e.filiere_id = f.id
      LEFT JOIN paiement p ON p.etudiant_id = e.id
      WHERE 1=1
    `;
    const params = [];
    if (annee)   { sql += ' AND e.annee_academique = ?'; params.push(annee); }
    if (niveau)  { sql += ' AND e.niveau = ?'; params.push(niveau); }
    if (faculte) { sql += ' AND e.faculte = ?'; params.push(faculte); }
    if (nom) {
      sql += ' AND (LOWER(e.nom) LIKE LOWER(?) OR LOWER(e.prenom) LIKE LOWER(?) OR LOWER(e.postnom) LIKE LOWER(?) OR e.id LIKE ?)';
      params.push(`%${nom}%`, `%${nom}%`, `%${nom}%`, `%${nom}%`);
    }
    sql += ' GROUP BY e.id ORDER BY e.nom, e.prenom';

    const [lignes] = await pool.query(sql, params);
    res.json(lignes.map(l => {
      const total_verse = Number(l.total_verse);
      const montant_attendu = l.montant_attendu === null ? null : Number(l.montant_attendu);
      return {
        ...l, total_verse, nb_versements: Number(l.nb_versements), montant_attendu,
        solde: montant_attendu === null ? null : Math.max(0, montant_attendu - total_verse),
      };
    }));
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la récupération des étudiants." });
  }
});

// ===== GET /api/caisse/stats — synthèse financière =====
router.get('/stats', async (req, res) => {
  try {
    const [[global]] = await pool.query(
      'SELECT COALESCE(SUM(montant),0) AS total, COUNT(*) AS nb, COUNT(DISTINCT etudiant_id) AS payeurs FROM paiement'
    );
    const [[etudiants]] = await pool.query('SELECT COUNT(*) AS n FROM etudiant');
    // Encaissements par année académique (pour le graphique / la répartition).
    const [parAnnee] = await pool.query(
      `SELECT COALESCE(annee_academique, '—') AS annee, SUM(montant) AS total, COUNT(*) AS nb
       FROM paiement GROUP BY annee_academique ORDER BY annee DESC`
    );
    // 8 derniers versements, tous étudiants confondus.
    const [recents] = await pool.query(
      `SELECT p.id, p.montant, p.date_paiement, p.mode_paiement, p.rubrique, p.reference,
              e.nom, e.postnom, e.prenom, e.id AS etudiant_id, e.niveau, f.nom AS filiere, e.promotion
       FROM paiement p JOIN etudiant e ON p.etudiant_id = e.id
       LEFT JOIN filiere f ON e.filiere_id = f.id
       ORDER BY p.date_paiement DESC, p.id DESC LIMIT 8`
    );
    res.json({
      total_encaisse: Number(global.total),
      nb_versements: Number(global.nb),
      nb_payeurs: Number(global.payeurs),
      nb_etudiants: Number(etudiants.n),
      par_annee: parAnnee.map(a => ({ annee: a.annee, total: Number(a.total), nb: Number(a.nb) })),
      recents: recents.map(r => ({ ...r, montant: Number(r.montant) })),
    });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la récupération des statistiques." });
  }
});

// ===== GET /api/caisse/rapport — rapport journalier / mensuel / annuel =====
// type = 'jour' (valeur AAAA-MM-JJ) | 'mois' (AAAA-MM) | 'annee' (AAAA).
// Accessible au caissier ET à l'administrateur du budget (consultation).
router.get('/rapport', async (req, res) => {
  const { type, valeur } = req.query;
  const FORMATS = {
    jour:  { regex: /^\d{4}-\d{2}-\d{2}$/, condition: "DATE(p.date_paiement) = ?" },
    mois:  { regex: /^\d{4}-\d{2}$/,       condition: "DATE_FORMAT(p.date_paiement, '%Y-%m') = ?" },
    annee: { regex: /^\d{4}$/,             condition: "YEAR(p.date_paiement) = ?" },
  };
  const conf = FORMATS[type];
  if (!conf || !conf.regex.test(valeur || '')) {
    return res.status(400).json({ erreur: "Paramètres invalides (type: jour/mois/annee, valeur au bon format)." });
  }

  try {
    const [lignes] = await pool.query(
      `SELECT p.id, p.date_paiement, p.montant, p.rubrique, p.mode_paiement, p.reference,
              e.id AS matricule, e.nom, e.postnom, e.prenom, f.nom AS filiere, e.promotion, e.niveau,
              a.noms AS agent_noms, a.prenom AS agent_prenom
       FROM paiement p
       JOIN etudiant e ON p.etudiant_id = e.id
       LEFT JOIN filiere f ON e.filiere_id = f.id
       LEFT JOIN agent a ON p.agent_id = a.id
       WHERE ${conf.condition}
       ORDER BY p.date_paiement DESC, p.id DESC`,
      [valeur]
    );
    const [[resume]] = await pool.query(
      `SELECT COALESCE(SUM(montant),0) AS total, COUNT(*) AS nb
       FROM paiement p WHERE ${conf.condition}`, [valeur]
    );
    const [parRubrique] = await pool.query(
      `SELECT COALESCE(rubrique,'—') AS rubrique, SUM(montant) AS total, COUNT(*) AS nb
       FROM paiement p WHERE ${conf.condition}
       GROUP BY rubrique ORDER BY total DESC`, [valeur]
    );
    res.json({
      type, valeur,
      total: Number(resume.total), nb: Number(resume.nb),
      par_rubrique: parRubrique.map(r => ({ rubrique: r.rubrique, total: Number(r.total), nb: Number(r.nb) })),
      lignes: lignes.map(l => ({ ...l, montant: Number(l.montant) })),
    });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur lors de la génération du rapport." });
  }
});

module.exports = router;

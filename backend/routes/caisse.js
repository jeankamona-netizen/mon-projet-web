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

// ===== GET /api/caisse/etudiant/:id/situation — périodes & soldes par année =====
// Un étudiant promu (L1→L2→L3) peut traîner une dette d'une année antérieure.
// On renvoie donc TOUTES les périodes (année + niveau) qu'il a traversées, avec
// pour chacune le barème attendu, le total versé et le solde — afin que la
// caisse puisse régulariser une dette passée (ajout/modif/suppression ciblés).
router.get('/etudiant/:id/situation', async (req, res) => {
  try {
    const [etus] = await pool.query(
      'SELECT id, nom, postnom, prenom, faculte, promotion, niveau, annee_academique FROM etudiant WHERE id = ?',
      [req.params.id]
    );
    if (!etus.length) return res.status(404).json({ erreur: 'Étudiant introuvable.' });
    const etu = etus[0];

    // Périodes = année → niveau. Sources : profil courant, historique
    // d'inscription aux cours (niveau réel de l'année), années des versements.
    const periodesMap = new Map();
    const ajouter = (annee, niveau) => {
      if (!annee) return;
      if (!periodesMap.has(annee)) periodesMap.set(annee, { annee_academique: annee, niveau: niveau || etu.niveau });
      else if (niveau && !periodesMap.get(annee).niveau) periodesMap.get(annee).niveau = niveau;
    };
    ajouter(etu.annee_academique, etu.niveau);
    const [hist] = await pool.query(
      `SELECT DISTINCT c.annee_academique, c.niveau
       FROM inscription_cours ic JOIN cours c ON c.id = ic.cours_id
       WHERE ic.etudiant_id = ?`, [req.params.id]
    );
    hist.forEach(h => ajouter(h.annee_academique, h.niveau));
    const [ap] = await pool.query('SELECT DISTINCT annee_academique FROM paiement WHERE etudiant_id = ?', [req.params.id]);
    ap.forEach(a => ajouter(a.annee_academique, null));

    // Barème (somme des rubriques) + versements de l'année, pour chaque période.
    const periodes = [];
    for (const p of periodesMap.values()) {
      const [[bareme]] = await pool.query(
        'SELECT SUM(montant) AS total FROM frais_scolarite WHERE faculte = ? AND promotion = ? AND niveau = ? AND annee_academique = ?',
        [etu.faculte, etu.promotion, p.niveau, p.annee_academique]
      );
      const [[verse]] = await pool.query(
        'SELECT COALESCE(SUM(montant),0) AS total FROM paiement WHERE etudiant_id = ? AND annee_academique = ?',
        [req.params.id, p.annee_academique]
      );
      const montant_attendu = bareme && bareme.total !== null ? Number(bareme.total) : null;
      const total_verse = Number(verse.total);
      periodes.push({
        annee_academique: p.annee_academique, niveau: p.niveau,
        faculte: etu.faculte, promotion: etu.promotion,
        montant_attendu, total_verse,
        solde: montant_attendu === null ? null : Math.max(0, montant_attendu - total_verse),
      });
    }
    periodes.sort((a, b) => (a.annee_academique < b.annee_academique ? 1 : -1));
    res.json({
      etudiant: { id: etu.id, nom: etu.nom, postnom: etu.postnom, prenom: etu.prenom, annee_courante: etu.annee_academique },
      periodes,
    });
  } catch (erreur) {
    console.error('Erreur situation étudiant:', erreur);
    res.status(500).json({ erreur: erreur.message });
  }
});

// ===== GET /api/caisse/liste — liste des étudiants + frais par rubrique =====
// Filtres : année (défaut = à préciser côté client), faculté (ou toutes),
// niveau (ou tous). Une colonne par rubrique effectivement versée + total.
router.get('/liste', async (req, res) => {
  try {
    const { annee, faculte, niveau } = req.query;

    // N'afficher que les étudiants INSCRITS pour l'année (et le niveau) demandés :
    // profil courant OU historique d'inscription aux cours de cette période
    // (un étudiant promu garde sa fiche au niveau courant, mais reste retrouvable
    // sur une année passée via inscription_cours). Mirroir de /api/etudiants ;
    // les colonnes faculté/promotion/niveau reflètent alors CETTE période.
    let sqlE, pE = [];
    if (annee || niveau) {
      const condHist = [];
      if (annee)  condHist.push('c.annee_academique = ?');
      if (niveau) condHist.push('c.niveau = ?');
      const condCourant = [];
      if (annee)  condCourant.push('e.annee_academique = ?');
      if (niveau) condCourant.push('e.niveau = ?');
      sqlE = `
        SELECT * FROM (
          SELECT e.id, e.nom, e.postnom, e.prenom, fil.nom AS filiere,
                 COALESCE(h.faculte, e.faculte)     AS faculte,
                 COALESCE(h.promotion, e.promotion) AS promotion,
                 COALESCE(h.niveau, e.niveau)       AS niveau
          FROM etudiant e
          LEFT JOIN filiere fil ON e.filiere_id = fil.id
          LEFT JOIN (
            SELECT ic.etudiant_id,
                   MAX(c.faculte) AS faculte, MAX(c.promotion) AS promotion,
                   MAX(c.niveau) AS niveau, MAX(c.annee_academique) AS annee_academique
            FROM inscription_cours ic JOIN cours c ON c.id = ic.cours_id
            ${condHist.length ? 'WHERE ' + condHist.join(' AND ') : ''}
            GROUP BY ic.etudiant_id
          ) h ON h.etudiant_id = e.id
          WHERE (h.etudiant_id IS NOT NULL${condCourant.length ? ' OR (' + condCourant.join(' AND ') + ')' : ''})
        ) e
        WHERE 1=1`;
      if (annee)  pE.push(annee);
      if (niveau) pE.push(niveau);
      if (annee)  pE.push(annee);
      if (niveau) pE.push(niveau);
    } else {
      sqlE = `SELECT e.id, e.nom, e.postnom, e.prenom, e.faculte, e.niveau, e.promotion, fil.nom AS filiere
              FROM etudiant e LEFT JOIN filiere fil ON e.filiere_id = fil.id WHERE 1=1`;
    }
    if (faculte) { sqlE += ' AND e.faculte = ?'; pE.push(faculte); }
    sqlE += ' ORDER BY e.faculte, e.niveau, e.nom, e.prenom';
    const [etudiants] = await pool.query(sqlE, pE);

    // Versements de l'année regroupés par étudiant + rubrique.
    let sqlP = `SELECT p.etudiant_id, COALESCE(NULLIF(p.rubrique,''),'Autre') AS rubrique, SUM(p.montant) AS total
                FROM paiement p WHERE 1=1`;
    const pP = [];
    if (annee) { sqlP += ' AND p.annee_academique = ?'; pP.push(annee); }
    sqlP += ' GROUP BY p.etudiant_id, rubrique';
    const [versements] = await pool.query(sqlP, pP);

    const parEtudiant = {};
    const rubriquesSet = new Set();
    versements.forEach(v => {
      rubriquesSet.add(v.rubrique);
      (parEtudiant[v.etudiant_id] = parEtudiant[v.etudiant_id] || {})[v.rubrique] = Number(v.total);
    });

    // Ordre des colonnes de rubriques : priorité connue, puis alphabétique.
    const PRIORITE = ['Frais académiques', 'Minerval', "Frais d'inscription", "Carte d'étudiant", 'Frais de connexion', 'Frais de laboratoire', 'Frais de session', 'Frais connexes', 'Autre'];
    const rubriques = [...rubriquesSet].sort((a, b) => {
      const ia = PRIORITE.indexOf(a), ib = PRIORITE.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
    });

    const lignes = etudiants.map(e => {
      const map = parEtudiant[e.id] || {};
      const total = Object.values(map).reduce((s, v) => s + v, 0);
      return {
        id: e.id, nom: e.nom, postnom: e.postnom, prenom: e.prenom,
        faculte: e.faculte, niveau: e.niveau, filiere: e.filiere, promotion: e.promotion,
        par_rubrique: map, total,
      };
    });

    res.json({ annee: annee || '', rubriques, etudiants: lignes });
  } catch (erreur) {
    console.error('Erreur liste étudiants:', erreur);
    res.status(500).json({ erreur: erreur.message });
  }
});

// ===== GET /api/caisse/stats — synthèse financière =====
router.get('/stats', async (req, res) => {
  try {
    // Un CAISSIER (role 'caisse') ne voit, pour « Total encaissé » et
    // « Versements enregistrés », que SES propres opérations de la JOURNÉE en
    // cours. L'administrateur du budget et l'admin gardent la vue globale.
    const u = req.utilisateur || {};
    const estCaissier = u.role === 'caisse';
    const [[enc]] = estCaissier
      ? await pool.query(
          'SELECT COALESCE(SUM(montant),0) AS total, COUNT(*) AS nb FROM paiement WHERE agent_id = ? AND date_paiement = CURDATE()',
          [u.agent_id || 0]
        )
      : await pool.query('SELECT COALESCE(SUM(montant),0) AS total, COUNT(*) AS nb FROM paiement');

    // « Étudiants ayant payé » = étudiants DISTINCTS ayant versé AUJOURD'HUI
    // (le jour des opérations en cours). « Sans aucun versement » reste une
    // photo globale (étudiants sans le moindre paiement de leur historique).
    const [[payeursJourRow]] = await pool.query(
      'SELECT COUNT(DISTINCT etudiant_id) AS payeurs FROM paiement WHERE date_paiement = CURDATE()'
    );
    const [[payeursRow]] = await pool.query('SELECT COUNT(DISTINCT etudiant_id) AS payeurs FROM paiement');
    const [[etudiants]] = await pool.query('SELECT COUNT(*) AS n FROM etudiant');
    // Encaissements de l'ANNÉE ACADÉMIQUE COURANTE uniquement (définie par
    // l'admin dans « Années académiques »). Repli sur toutes les années si
    // aucune année courante n'est encore fixée.
    const [[anneeCourante]] = await pool.query(
      'SELECT libelle FROM annee_academique WHERE est_courante = 1 LIMIT 1'
    );
    const libelleCourant = anneeCourante ? anneeCourante.libelle : null;
    const [parAnnee] = libelleCourant
      ? await pool.query(
          `SELECT COALESCE(annee_academique, '—') AS annee, SUM(montant) AS total, COUNT(*) AS nb
           FROM paiement WHERE annee_academique = ? GROUP BY annee_academique ORDER BY annee DESC`,
          [libelleCourant]
        )
      : await pool.query(
          `SELECT COALESCE(annee_academique, '—') AS annee, SUM(montant) AS total, COUNT(*) AS nb
           FROM paiement GROUP BY annee_academique ORDER BY annee DESC`
        );
    // « Derniers versements » = uniquement ceux de la JOURNÉE en cours, pour
    // l'admin, l'administrateur du budget ET le caissier. Le caissier ne voit
    // en plus que les SIENS (cohérent avec ses indicateurs du jour).
    const recentsSql =
      `SELECT p.id, p.montant, p.date_paiement, p.mode_paiement, p.rubrique, p.reference, p.annee_academique,
              e.nom, e.postnom, e.prenom, e.id AS matricule, e.id AS etudiant_id,
              COALESCE(NULLIF(p.niveau, ''), e.niveau) AS niveau, f.nom AS filiere, e.promotion
       FROM paiement p JOIN etudiant e ON p.etudiant_id = e.id
       LEFT JOIN filiere f ON e.filiere_id = f.id
       WHERE p.date_paiement = CURDATE()${estCaissier ? ' AND p.agent_id = ?' : ''}
       ORDER BY p.id DESC, e.id
       LIMIT 50`;
    const [recents] = await pool.query(recentsSql, estCaissier ? [u.agent_id || 0] : []);
    res.json({
      total_encaisse: Number(enc.total),
      nb_versements: Number(enc.nb),
      nb_payeurs: Number(payeursRow.payeurs),
      nb_payeurs_jour: Number(payeursJourRow.payeurs),
      nb_etudiants: Number(etudiants.n),
      // Indique au frontend que les deux premiers indicateurs sont « du jour »
      // (pour adapter les libellés côté caissier).
      encaisse_du_jour: estCaissier,
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
              e.id AS matricule, e.nom, e.postnom, e.prenom, f.nom AS filiere, e.promotion,
              COALESCE(NULLIF(p.niveau, ''), e.niveau) AS niveau,
              a.noms AS agent_noms, a.prenom AS agent_prenom
       FROM paiement p
       JOIN etudiant e ON p.etudiant_id = e.id
       LEFT JOIN filiere f ON e.filiere_id = f.id
       LEFT JOIN agent a ON p.agent_id = a.id
       WHERE ${conf.condition}
       ORDER BY p.date_paiement DESC, e.id, p.id`,
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

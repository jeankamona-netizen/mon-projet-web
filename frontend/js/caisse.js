// =====================
// ESPACE CAISSE — finances (agents : caissier, administrateur du budget)
// L'accès dépend de la fonction de l'agent (rôle dans le JWT).
// =====================

function toggleCaissePassword() {
  const input = document.getElementById('caisse-pass');
  if (input) input.type = input.type === 'password' ? 'text' : 'password';
}

async function connexionCaisse() {
  const matricule = document.getElementById('caisse-matricule')?.value.trim();
  const mot_de_passe = document.getElementById('caisse-pass')?.value.trim();
  const erreurBox = document.getElementById('caisse-erreur');
  if (erreurBox) erreurBox.style.display = 'none';

  if (!matricule || !mot_de_passe) {
    if (erreurBox) { erreurBox.textContent = '⚠️ Veuillez remplir tous les champs.'; erreurBox.style.display = 'block'; }
    return;
  }
  try {
    const r = await fetch(`${BASE_URL}/api/auth/agent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matricule, mot_de_passe })
    });
    const d = await r.json();
    if (!r.ok) {
      if (erreurBox) { erreurBox.textContent = '❌ ' + d.erreur; erreurBox.style.display = 'block'; }
      return;
    }
    sessionStorage.setItem('caisse_token', d.token);
    sessionStorage.setItem('caisse_agent', JSON.stringify(d.agent));
    window.location.href = 'caisse-dashboard.html';
  } catch {
    if (erreurBox) { erreurBox.textContent = '⚠️ Impossible de contacter le serveur.'; erreurBox.style.display = 'block'; }
  }
}

function deconnecterCaisse() {
  sessionStorage.removeItem('caisse_token');
  sessionStorage.removeItem('caisse_agent');
}

function getAgentCaisse() {
  try { return JSON.parse(sessionStorage.getItem('caisse_agent') || 'null'); } catch { return null; }
}
// Encaissement ouvert à tous les rôles des finances (caissier ET administrateur
// du budget) : plus aucun rôle n'est en lecture seule sur les versements.
function estLectureSeule() { return false; }
// À l'inverse, le barème est fixé par l'administrateur du budget (et l'admin) ;
// le caissier ne peut que le consulter.
function peutEditerBareme() { const r = (getAgentCaisse() || {}).role; return r === 'budget' || r === 'admin'; }
// L'export Excel / PDF des listes et rapports est réservé à l'administrateur du
// budget (le caissier n'exporte pas de synthèse globale).
function estAdminBudget() { const r = (getAgentCaisse() || {}).role; return r === 'budget' || r === 'admin'; }
// Affiche/masque les boutons d'export (classe .export-budget) selon le rôle.
function appliquerVisibiliteBudget() {
  const visible = estAdminBudget();
  document.querySelectorAll('.export-budget').forEach(el => {
    // Les boutons d'export de rapport restent cachés tant qu'aucun rapport n'est
    // généré : leur affichage est piloté par genererRapport().
    if (el.classList.contains('rapport-export')) { if (!visible) el.style.display = 'none'; return; }
    el.style.display = visible ? '' : 'none';
  });
}
function nomCaissier() {
  const a = getAgentCaisse();
  return a ? `${a.prenom || ''} ${a.noms || ''}`.trim() : '—';
}
function libelleFonctionAgent(agent) {
  const map = { administrateur_budget: 'Administrateur du budget', caissier: 'Caissier(ère)' };
  return map[agent?.fonction] || agent?.fonction || '';
}
// Titre à placer AVANT le nom de l'agent sur l'en-tête du rapport
// (ex. « Le/La Caissier(e) Dieudonné … »).
function titreAvantNom() {
  const a = getAgentCaisse() || {};
  if (a.fonction === 'caissier') return 'Le/La Caissier(e)';
  if (a.fonction === 'administrateur_budget') return "L'Administrateur du budget";
  if (a.role === 'admin') return "L'Administration";
  return '';
}

async function fetchCaisse(url, options = {}) {
  const token = sessionStorage.getItem('caisse_token');
  const headers = { ...(options.headers || {}), Authorization: `Bearer ${token}` };
  const reponse = await fetch(url, { ...options, headers });
  if (reponse.status === 401) {
    sessionStorage.removeItem('caisse_token');
    afficherToast('⚠️ Session expirée, veuillez vous reconnecter.', 'erreur');
    window.location.href = 'login.html?role=caissier';
    throw new Error('Session expirée.');
  }
  return reponse;
}

function exigerConnexionCaisse() {
  if (!sessionStorage.getItem('caisse_token')) { window.location.href = 'login.html?role=caissier'; return false; }
  return true;
}

// =====================
// NAVIGATION
// =====================
function afficherSectionCaisse(id, lien) {
  document.querySelectorAll('.dash-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
  lien?.classList.add('active');
  if (id === 'caisse-accueil')  chargerStatsCaisse();
  if (id === 'caisse-frais')    chargerEtudiantsCaisse();
  if (id === 'caisse-rapports') initRapports();
  if (id === 'caisse-listes')   chargerListes();
  if (id === 'caisse-inscrits') chargerInscritsCaisse();
  if (id === 'caisse-bareme')   chargerBareme();
}

// Navigue vers une section depuis les cartes-statistiques cliquables de la vue
// d'ensemble (le lien latéral correspondant reste mis en évidence).
function ouvrirSectionCaisse(id) {
  const lien = document.querySelector(`.nav-item[onclick*="'${id}'"]`);
  afficherSectionCaisse(id, lien);
}

// Carte « Total encaissé aujourd'hui » → Rapports, filtré sur la journée en
// cours (mes mouvements du jour), généré automatiquement.
function ouvrirMouvementsDuJour() {
  ouvrirSectionCaisse('caisse-rapports');
  const type = document.getElementById('rapport-type');
  const jour = document.getElementById('rapport-jour');
  if (type) type.value = 'jour';
  if (jour) jour.value = new Date().toISOString().split('T')[0];
  basculerChampRapport();
  genererRapport();
}

// Carte « Mes versements du jour » → Frais & versements.
function ouvrirFraisVersements() { ouvrirSectionCaisse('caisse-frais'); }

// Carte « Étudiants ayant payé » → Listes des étudiants (année en cours).
function ouvrirListesEtudiants() { ouvrirSectionCaisse('caisse-listes'); }

function formaterDateCaisse(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR');
}
function montant(n) { return Number(n || 0).toFixed(2); }
// Sérialise un objet en JSON sûr à insérer dans un attribut HTML (onclick…).
// Sans ça, une apostrophe dans les données (ex. rubrique « Carte d'étudiant »,
// « Frais d'inscription ») ferme prématurément l'attribut et casse le onclick.
function attrJSON(obj) {
  return JSON.stringify(obj)
    .replace(/&/g, '&amp;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
// Retire un préfixe de niveau/cycle en tête d'un nom de filière (« L1 Systèmes
// Informatiques » → « Systèmes Informatiques »), pour ne pas répéter le niveau.
function sansPrefixeNiveau(nom) {
  if (!nom) return '';
  const nettoye = String(nom).replace(/^\s*(Pr[ée]-?U(niversitaire)?|Master|Doctorat|[LMD][123])\s+/i, '').trim();
  return nettoye || String(nom).trim();
}
// Libellé « niveau + filière » (ex. « L2 Sciences de gestion »). La filière
// affichée est nettoyée de tout préfixe de niveau pour éviter « L2 L2 … ».
// Si la filière vaut « - » (niveau sans filière : Pré-U, licence non
// subdivisée) → niveau seul.
function libelleFiliere(niveau, filiere) {
  const f = sansPrefixeNiveau((filiere || '').trim());
  return f && f !== '-' ? `${niveau || ''} ${f}`.trim() : (niveau || '—');
}

// =====================
// VUE D'ENSEMBLE
// =====================
async function chargerStatsCaisse() {
  try {
    const r = await fetchCaisse(`${BASE_URL}/api/caisse/stats`);
    const d = await r.json();
    document.getElementById('cpt-total').textContent = montant(d.total_encaisse);
    document.getElementById('cpt-versements').textContent = d.nb_versements;
    // « Étudiants ayant payé » = ceux ayant versé aujourd'hui (jour des opérations).
    document.getElementById('cpt-payeurs').textContent = d.nb_payeurs_jour ?? 0;
    // « Sans aucun versement » = inscrits de l'année courante sans versement cette année.
    document.getElementById('cpt-restants').textContent = d.nb_sans_versement ?? 0;
    // Caissier : les deux premiers indicateurs ne concernent que SES versements
    // du jour → on l'indique clairement dans les libellés.
    const lblTotal = document.getElementById('lbl-total');
    const lblVers  = document.getElementById('lbl-versements');
    if (d.encaisse_du_jour) {
      if (lblTotal) lblTotal.textContent = "Total encaissé aujourd'hui ($)";
      if (lblVers)  lblVers.textContent  = "Mes versements du jour";
    } else {
      // Admin / budget : indicateurs de l'ANNÉE COURANTE (pas tout l'historique).
      const an = d.annee_stats ? ` — ${d.annee_stats}` : '';
      if (lblTotal) lblTotal.textContent = `Total encaissé${an} ($)`;
      if (lblVers)  lblVers.textContent  = `Versements enregistrés${an}`;
    }

    const tbAnnee = document.getElementById('caisse-par-annee');
    if (tbAnnee) tbAnnee.innerHTML = (d.par_annee || []).length
      ? d.par_annee.map(a => `<tr><td>${a.annee}</td><td>${a.nb}</td><td>${montant(a.total)}</td></tr>`).join('')
      : `<tr><td colspan="3" class="admin-vide">Aucun encaissement.</td></tr>`;

    const tbRec = document.getElementById('caisse-recents');
    if (tbRec) {
      const groupes = grouperVersementsRapport(d.recents);
      tbRec.innerHTML = groupes.length
        ? groupes.map(g => g.items.map((p, i) => {
            const premier = i === 0;
            const dernier = i === g.items.length - 1;
            return `<tr${dernier ? ' class="rapport-sep"' : ''}>
              <td>${premier ? g.dateAff : ''}</td>
              <td>${premier ? `${g.entete.nom} ${g.entete.postnom || ''} ${g.entete.prenom}` : ''}</td>
              <td>${premier ? libelleFiliere(g.entete.niveau, g.entete.filiere || g.entete.promotion) : ''}</td>
              <td>${p.rubrique || '—'}</td>
              <td>${p.reference || '—'}</td>
              <td>${montant(p.montant)}</td>
            </tr>`;
          }).join('')).join('')
        : `<tr><td colspan="6" class="admin-vide">Aucun versement aujourd'hui.</td></tr>`;
    }
  } catch { /* redirigé si 401 */ }
}

// =====================
// FRAIS & VERSEMENTS
// =====================
let etudiantsCaisse = [];
let etudiantCourantCaisse = null;
// Toutes les années académiques du système (pour rattacher un versement à
// n'importe quelle année, même une dette antérieure hors historique de cours).
let anneesCaisse = [];
let anneeCouranteCaisse = '';
// Modal « Frais de scolarité » (consultation par année) — état isolé.
let fraisEtudiantCourant = null;
let situationFrais = null;
let paiementsFrais = [];

async function chargerAnneesCaisse() {
  try {
    const r = await fetch(`${BASE_URL}/api/annees`);
    if (!r.ok) return;
    const annees = await r.json();
    const courante = annees.find(a => a.est_courante)?.libelle;
    anneesCaisse = annees;
    anneeCouranteCaisse = courante || '';
    // Année académique courante dans la zone bleue (badge jaune).
    const badgeAnnee = document.getElementById('caisse-annee-sidebar');
    if (badgeAnnee) badgeAnnee.textContent = courante || '—';
    const opts = annees.map(a => `<option value="${a.libelle}">${a.libelle}</option>`).join('');
    // Filtre étudiants : « Toutes » + défaut année en cours.
    const selEtu = document.getElementById('caisse-filtre-annee');
    if (selEtu) { selEtu.innerHTML = '<option value="">Toutes les années</option>' + opts; if (courante) selEtu.value = courante; }
    // Barème : année en cours par défaut (sert de filtre d'affichage + année de saisie).
    const selBa = document.getElementById('bareme-annee');
    if (selBa) { selBa.innerHTML = opts; if (courante) selBa.value = courante; }
    // Listes : année en cours par défaut.
    const selLi = document.getElementById('liste-annee');
    if (selLi) { selLi.innerHTML = opts; if (courante) selLi.value = courante; }
    // Gérer les inscrits : filtre (« Toutes » + courante), modal modif et
    // modal nouvel étudiant (année courante par défaut).
    const selFiltre = document.getElementById('filtre-inscrits-annee');
    if (selFiltre) { selFiltre.innerHTML = '<option value="">Toutes les années</option>' + opts; if (courante) selFiltre.value = courante; }
    const selMod = document.getElementById('inscrit-annee');
    if (selMod) { selMod.innerHTML = opts; if (courante) selMod.value = courante; }
    const selNouv = document.getElementById('reins-annee-nouveau');
    if (selNouv) { selNouv.innerHTML = opts; if (courante) selNouv.value = courante; }
  } catch { /* silencieux */ }
}

function majPromotionsBareme() {
  const facSel = document.getElementById('bareme-faculte');
  const promoSel = document.getElementById('bareme-promotion');
  const nivSel = document.getElementById('bareme-niveau');
  if (!facSel || !promoSel) return;
  // Options limitées à la faculté ET au niveau (cycle) choisis ; option
  // générique (« Sciences »/« Théologie ») quand il n'y a pas de vraie filière.
  const filieres = optionsFiliereFacNiveau(facSel.value, nivSel?.value || '');
  // « Toutes les filières » seulement quand il y a réellement plusieurs filières.
  const optToutes = filieres.length > 1 ? '<option value="__toutes__">— Toutes les filières —</option>' : '';
  promoSel.innerHTML = '<option value="">— Filière —</option>' + optToutes +
    filieres.map(fl => `<option value="${fl}">${fl}</option>`).join('');
  // Une seule option (générique) → on la présélectionne pour éviter « — Filière — ».
  if (filieres.length === 1) promoSel.value = filieres[0];
}

// =====================
// LISTES DES ÉTUDIANTS (frais par rubrique)
// =====================
let derniereListe = null;

async function chargerListes() {
  const thead = document.getElementById('liste-thead');
  const tbody = document.getElementById('liste-body');
  if (!tbody) return;
  const annee = document.getElementById('liste-annee')?.value || '';
  const faculte = document.getElementById('liste-faculte')?.value || '';
  const niveau = document.getElementById('liste-niveau')?.value || '';
  const date = document.getElementById('liste-date')?.value || '';
  tbody.innerHTML = `<tr><td class="admin-vide">Chargement...</td></tr>`;
  try {
    // Chaque filtre se combine (ET) : année, faculté, niveau et date de paiement.
    const params = new URLSearchParams();
    if (annee) params.append('annee', annee);
    if (faculte) params.append('faculte', faculte);
    if (niveau) params.append('niveau', niveau);
    if (date) params.append('date', date);
    const r = await fetchCaisse(`${BASE_URL}/api/caisse/liste?${params}`);
    const d = await r.json();
    derniereListe = { ...d, faculte, niveau, date };
    const rubriques = d.rubriques || [];
    const nbCol = 4 + rubriques.length; // N°, Étudiant, Promotion, [rubriques], Total

    if (thead) thead.innerHTML = `<tr>
      <th style="width:44px">N°</th><th>Étudiant</th><th>Promotion</th>
      ${rubriques.map(x => `<th>${x} ($)</th>`).join('')}
      <th>Total versé</th>
    </tr>`;

    const etudiants = d.etudiants || [];
    if (!etudiants.length) { tbody.innerHTML = `<tr><td colspan="${nbCol}" class="admin-vide">Aucun étudiant pour ces filtres.</td></tr>`; return; }

    // Totaux par rubrique + total général (ligne de bas de tableau).
    const totaux = {}; let totalGeneral = 0;
    etudiants.forEach(e => { rubriques.forEach(x => { totaux[x] = (totaux[x] || 0) + (Number(e.par_rubrique[x]) || 0); }); totalGeneral += Number(e.total) || 0; });

    tbody.innerHTML = etudiants.map((e, i) => `<tr>
      <td>${i + 1}</td>
      <td><strong>${e.nom}</strong> ${e.postnom || ''} ${e.prenom}<br><span style="font-size:11px;color:#999">${e.id}</span></td>
      <td>${libelleFiliere(e.niveau, e.filiere || e.promotion)}</td>
      ${rubriques.map(x => `<td>${e.par_rubrique[x] ? montant(e.par_rubrique[x]) + ' $' : '—'}</td>`).join('')}
      <td><strong style="color:var(--vert)">${montant(e.total)} $</strong></td>
    </tr>`).join('') +
      `<tr class="bareme-total-row">
        <td></td><td colspan="2"><strong>Total général (${etudiants.length} étudiant${etudiants.length > 1 ? 's' : ''})</strong></td>
        ${rubriques.map(x => `<td><strong>${montant(totaux[x])} $</strong></td>`).join('')}
        <td><strong style="color:var(--bleu)">${montant(totalGeneral)} $</strong></td>
      </tr>`;
  } catch { tbody.innerHTML = `<tr><td class="admin-vide">⚠️ Erreur.</td></tr>`; }
}

function imprimerListe() {
  const d = derniereListe;
  if (!d || !(d.etudiants || []).length) { afficherToast('⚠️ Aucune donnée à imprimer.', 'erreur'); return; }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const logoSrc = `${location.origin}/img/logo.png`;
  const rubriques = d.rubriques || [];
  const facLib = d.faculte || 'Toutes les facultés';
  const nivLib = d.niveau || 'Tous niveaux';
  const dateLib = d.date ? new Date(d.date).toLocaleDateString('fr-FR') : 'Toutes les dates';

  const totaux = {}; let totalGeneral = 0;
  d.etudiants.forEach(e => { rubriques.forEach(x => { totaux[x] = (totaux[x] || 0) + (Number(e.par_rubrique[x]) || 0); }); totalGeneral += Number(e.total) || 0; });

  const entetes = `<th>N°</th><th>Étudiant</th><th>Promotion</th>${rubriques.map(x => `<th class="n">${esc(x)}</th>`).join('')}<th class="n">Total</th>`;
  const corps = d.etudiants.map((e, i) => `<tr>
      <td>${i + 1}</td>
      <td>${esc(`${e.nom} ${e.postnom || ''} ${e.prenom}`)}<br><small>${esc(e.id)}</small></td>
      <td>${esc(libelleFiliere(e.niveau, e.filiere || e.promotion))}</td>
      ${rubriques.map(x => `<td class="n">${e.par_rubrique[x] ? montant(e.par_rubrique[x]) + ' $' : '—'}</td>`).join('')}
      <td class="n"><b>${montant(e.total)} $</b></td>
    </tr>`).join('');
  const ligneTotal = `<tr class="tot">
      <td></td><td colspan="2"><b>Total général (${d.etudiants.length})</b></td>
      ${rubriques.map(x => `<td class="n"><b>${montant(totaux[x])} $</b></td>`).join('')}
      <td class="n"><b>${montant(totalGeneral)} $</b></td>
    </tr>`;

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Liste des étudiants — ${esc(d.annee || '')}</title>
<style>
  :root { --bleu:#1a3a6b; --jaune:#f0c020; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Segoe UI',Arial,sans-serif; color:#1a1a1a; padding:20px; }
  .barre { text-align:center; margin-bottom:16px; }
  .barre button { font-size:14px; padding:9px 20px; border:none; border-radius:6px; background:var(--bleu); color:#fff; cursor:pointer; }
  .tete { display:flex; align-items:center; gap:12px; border-bottom:3px solid var(--jaune); padding-bottom:10px; margin-bottom:6px; }
  .tete img { width:46px; height:46px; object-fit:contain; }
  .tete .u { font-size:16px; font-weight:800; color:var(--bleu); line-height:1.2; }
  .tete .u small { display:block; font-size:10px; font-weight:600; color:#666; }
  h1 { font-size:15px; color:var(--bleu); margin:12px 0 2px; }
  .filtres { color:#666; font-size:12px; margin-bottom:12px; }
  table { width:100%; border-collapse:collapse; margin-bottom:18px; font-size:11px; }
  th { background:var(--bleu); color:#fff; padding:6px 7px; text-align:left; font-size:10px; }
  td { padding:5px 7px; border-bottom:1px solid #eef1f5; vertical-align:top; }
  td small { color:#999; font-size:9px; }
  td.n, th.n { text-align:right; }
  tr.tot td { border-top:2px solid var(--bleu); background:#eef2fb; }
  .signe { margin-top:26px; text-align:right; font-size:12px; }
  .signe span { border-top:1px solid #999; padding-top:4px; display:inline-block; min-width:200px; }
  @media print { .barre { display:none; } body { padding:0; } @page { size:A4 landscape; margin:12mm; }
    * { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style></head><body>
  <div class="barre"><button onclick="window.print()">🖨️ Imprimer la liste</button></div>
  <div class="tete">
    <img src="${logoSrc}" alt="" onerror="this.style.display='none'">
    <div class="u">UNIVERSITÉ MÉTHODISTE DE LUBUMBASHI<small>Scientia, Sanctitas et Veritas</small></div>
  </div>
  <h1>Liste des étudiants — frais versés par rubrique</h1>
  <div class="filtres">Année : ${esc(d.annee || '—')} · Faculté : ${esc(facLib)} · Niveau : ${esc(nivLib)} · Date de paiement : ${esc(dateLib)} · Édité le ${new Date().toLocaleDateString('fr-FR')} par ${esc(`${titreAvantNom()} ${nomCaissier()}`.trim())}</div>
  <table><thead><tr>${entetes}</tr></thead><tbody>${corps}${ligneTotal}</tbody></table>
  <div class="signe"><span>${esc(nomCaissier())}</span></div>
<script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 400); });<\/script>
</body></html>`;

  const w = window.open('', '_blank', 'width=1000,height=700');
  if (!w) { afficherToast('⚠️ Autorisez les pop-ups pour imprimer.', 'erreur'); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

// =====================
// EXPORT EXCEL (administrateur du budget)
// Génère un classeur Excel à partir d'un tableau HTML (Excel ouvre nativement
// un HTML enregistré en .xls, accents et colonnes préservés). Chaque « section »
// = un sous-titre + une ligne d'en-têtes + les lignes de données.
// =====================
function telechargerExcelUML(nomFichier, titre, sousTitre, sections) {
  const esc = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const blocs = sections.map(sec => {
    const entetes = `<tr>${sec.entetes.map(h => `<th style="background:#1a3a6b;color:#fff;border:1px solid #7f8fb0;padding:5px 8px;text-align:left">${esc(h)}</th>`).join('')}</tr>`;
    const corps = sec.lignes.map(ligne => `<tr>${ligne.map(c => {
      const num = typeof c === 'number';
      return `<td style="border:1px solid #cfd6e4;padding:4px 8px${num ? ';mso-number-format:\\@' : ''}">${esc(c)}</td>`;
    }).join('')}</tr>`).join('');
    const soustitre = sec.titre ? `<tr><td colspan="${sec.entetes.length}" style="font-weight:bold;color:#1a3a6b;padding:8px 0 2px">${esc(sec.titre)}</td></tr>` : '';
    return `<table border="0" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:11pt;margin-bottom:14px">${soustitre}${entetes}${corps}</table>`;
  }).join('');
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>UML</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
<body><div style="font-weight:bold;font-size:14pt;color:#1a3a6b">UNIVERSITÉ MÉTHODISTE DE LUBUMBASHI</div>
<div style="font-size:12pt;color:#1a3a6b">${esc(titre)}</div>
<div style="font-size:9pt;color:#666;margin-bottom:10px">${esc(sousTitre)}</div>${blocs}</body></html>`;
  const blob = new Blob(['﻿', html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${nomFichier}.xls`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// Export Excel de la liste des étudiants (frais versés par rubrique).
function exporterListeExcel() {
  const d = derniereListe;
  if (!d || !(d.etudiants || []).length) { afficherToast('⚠️ Aucune donnée à exporter.', 'erreur'); return; }
  const rubriques = d.rubriques || [];
  const totaux = {}; let totalGeneral = 0;
  d.etudiants.forEach(e => { rubriques.forEach(x => { totaux[x] = (totaux[x] || 0) + (Number(e.par_rubrique[x]) || 0); }); totalGeneral += Number(e.total) || 0; });

  const entetes = ['N°', 'Matricule', 'Étudiant', 'Promotion', ...rubriques.map(x => `${x} ($)`), 'Total versé ($)'];
  const lignes = d.etudiants.map((e, i) => [
    i + 1, e.id, `${e.nom} ${e.postnom || ''} ${e.prenom}`.replace(/\s+/g, ' ').trim(),
    libelleFiliere(e.niveau, e.filiere || e.promotion),
    ...rubriques.map(x => Number(e.par_rubrique[x]) || 0),
    Number(e.total) || 0
  ]);
  lignes.push(['', '', `Total général (${d.etudiants.length})`, '', ...rubriques.map(x => totaux[x] || 0), totalGeneral]);

  const facLib = d.faculte || 'Toutes les facultés';
  const nivLib = d.niveau || 'Tous niveaux';
  const dateLib = d.date ? new Date(d.date).toLocaleDateString('fr-FR') : 'Toutes les dates';
  const sousTitre = `Liste des étudiants — frais versés · Année : ${d.annee || '—'} · Faculté : ${facLib} · Niveau : ${nivLib} · Date : ${dateLib} · Édité le ${new Date().toLocaleDateString('fr-FR')} par ${titreAvantNom()} ${nomCaissier()}`.trim();
  telechargerExcelUML(`liste-etudiants-${(d.annee || 'toutes').replace(/\W+/g, '-')}`, 'Liste des étudiants — frais versés', sousTitre, [{ titre: '', entetes, lignes }]);
}

// Export Excel du rapport d'encaissement (répartition + détail).
function exporterRapportExcel() {
  const d = dernierRapport;
  if (!d) { afficherToast('⚠️ Générez d\'abord un rapport.', 'erreur'); return; }
  const repartition = {
    titre: 'Répartition par rubrique',
    entetes: ['Rubrique', 'Nombre', 'Total ($)'],
    lignes: (d.par_rubrique || []).map(r => [r.rubrique, Number(r.nb) || 0, Number(r.total) || 0])
  };
  repartition.lignes.push(['TOTAL', Number(d.nb) || 0, Number(d.total) || 0]);

  const detail = {
    titre: 'Détail des versements',
    entetes: ['Date', 'Étudiant', 'Niveau', 'Rubrique', 'Référence', 'Montant ($)'],
    lignes: (d.lignes || []).map(l => [
      formaterDateCaisse(l.date_paiement),
      `${l.nom} ${l.postnom || ''} ${l.prenom}`.replace(/\s+/g, ' ').trim(),
      libelleFiliere(l.niveau, l.filiere || l.promotion),
      l.rubrique || '—', l.reference || '—', Number(l.montant) || 0
    ])
  };
  const sousTitre = `Rapport ${d.libelleType || ''} · ${d.periode || ''} · Total : ${montant(d.total)} $ (${d.nb} versement${d.nb > 1 ? 's' : ''}) · Édité le ${new Date().toLocaleDateString('fr-FR')} par ${titreAvantNom()} ${nomCaissier()}`.trim();
  telechargerExcelUML(`rapport-${(d.libelleType || 'caisse').toLowerCase()}-${(d.periode || '').replace(/\W+/g, '-')}`, `Rapport d'encaissement — ${d.libelleType || ''}`, sousTitre, [repartition, detail]);
}

// =====================
// BARÈME DES FRAIS ATTENDUS
// =====================
async function chargerBareme() {
  const tbody = document.getElementById('bareme-body');
  if (!tbody) return;
  const editable = peutEditerBareme();
  const form = document.getElementById('bareme-form');
  if (form) form.style.display = editable ? '' : 'none';
  const colAction = document.getElementById('bareme-col-action');
  if (colAction) colAction.style.display = editable ? '' : 'none';
  tbody.innerHTML = `<tr><td colspan="6" class="admin-vide">Chargement...</td></tr>`;
  try {
    const annee = document.getElementById('bareme-annee')?.value || '';
    const params = new URLSearchParams();
    if (annee) params.append('annee', annee);
    const r = await fetchCaisse(`${BASE_URL}/api/frais-scolarite?${params}`);
    const lignes = await r.json();
    if (!lignes.length) { tbody.innerHTML = `<tr><td colspan="6" class="admin-vide">Aucun barème défini pour cette année.</td></tr>`; return; }
    // Regroupement par faculté + filière + niveau (les lignes arrivent déjà
    // triées par le backend). Chaque groupe affiche ses rubriques numérotées en
    // continu, puis une ligne de démarcation « Total attendu » propre au groupe.
    const groupes = [];
    const posGroupe = {};
    lignes.forEach(l => {
      const k = `${l.faculte}|${l.promotion}|${l.niveau}`;
      if (posGroupe[k] === undefined) { posGroupe[k] = groupes.length; groupes.push({ faculte: l.faculte, promotion: l.promotion, niveau: l.niveau, lignes: [] }); }
      groupes[posGroupe[k]].lignes.push(l);
    });
    tbody.innerHTML = groupes.map(g => {
      const total = g.lignes.reduce((s, l) => s + Number(l.montant), 0);
      // Numérotation qui redémarre à 1 pour chaque groupe (faculté · filière).
      const rubriques = g.lignes.map((l, j) => {
        return `<tr>
          <td>${j + 1}</td>
          <td>${l.faculte}</td>
          <td>${libelleFiliere(l.niveau, l.promotion)}</td>
          <td>${l.rubrique || '—'}</td>
          <td><strong>${montant(l.montant)} $</strong></td>
          ${editable ? `<td class="admin-actions-cell"><button class="btn-icone danger" onclick="supprimerBareme(${l.id})" aria-label="Supprimer">${icone('corbeille')}</button></td>` : ''}
        </tr>`;
      }).join('');
      // Ligne de total attendu du groupe (ce que l'étudiant doit pour l'année).
      const totalRow = `<tr class="bareme-total-row">
        <td></td>
        <td colspan="2"><strong>Total attendu : ${g.faculte} · ${libelleFiliere(g.niveau, g.promotion)}</strong></td>
        <td></td>
        <td><strong style="color:var(--bleu)">${montant(total)} $</strong></td>
        ${editable ? '<td></td>' : ''}
      </tr>`;
      return rubriques + totalRow;
    }).join('');
  } catch { tbody.innerHTML = `<tr><td colspan="6" class="admin-vide">⚠️ Erreur.</td></tr>`; }
}

async function enregistrerBareme() {
  if (!peutEditerBareme()) { afficherToast('⚠️ Seul l\'administrateur du budget peut modifier le barème.', 'erreur'); return; }
  const annee_academique = document.getElementById('bareme-annee')?.value;
  const faculte = document.getElementById('bareme-faculte')?.value;
  const promotion = document.getElementById('bareme-promotion')?.value;
  const niveau = document.getElementById('bareme-niveau')?.value;
  const rubrique = document.getElementById('bareme-rubrique')?.value || 'Frais académiques';
  const montantVal = parseFloat(document.getElementById('bareme-montant')?.value);
  // La filière est OPTIONNELLE : un niveau/faculté sans filière (ex. Pré-U,
  // licence non subdivisée) s'enregistre avec « - ».
  if (!annee_academique || !faculte || !niveau) { afficherToast('⚠️ Choisissez année, faculté et niveau.', 'erreur'); return; }
  if (isNaN(montantVal) || montantVal < 0) { afficherToast('⚠️ Entrez un montant valide.', 'erreur'); return; }

  // « Toutes les filières » → une ligne par filière DU CYCLE du niveau (L1 →
  // filières de Licence uniquement, M1 → filières Master, etc.) ; sinon la
  // filière choisie, ou « - » si aucune n'est sélectionnée.
  const cibles = promotion === '__toutes__' ? filieresDuCycle(faculte, niveau) : [promotion || '-'];
  if (!cibles.length) { afficherToast('⚠️ Aucune filière de ce cycle pour cette faculté (laissez « — Filière — » pour enregistrer sans filière).', 'erreur'); return; }

  try {
    let ok = 0, echecs = 0, dernierMsg = '';
    for (const fil of cibles) {
      const r = await fetchCaisse(`${BASE_URL}/api/frais-scolarite`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faculte, promotion: fil, niveau, annee_academique, rubrique, montant: montantVal })
      });
      const d = await r.json();
      if (r.ok) ok++; else { echecs++; dernierMsg = d.erreur || ''; }
    }
    if (echecs && !ok) { afficherToast('❌ ' + (dernierMsg || 'Échec de l\'enregistrement.'), 'erreur'); return; }
    afficherToast(cibles.length > 1
      ? `✅ Barème appliqué à ${ok} filière(s)${echecs ? ` · ${echecs} échec(s)` : ''}.`
      : '✅ Barème enregistré.');
    document.getElementById('bareme-montant').value = '';
    chargerBareme();
    chargerEtudiantsCaisse();
  } catch { afficherToast('⚠️ Serveur indisponible.', 'erreur'); }
}

async function supprimerBareme(id) {
  if (!peutEditerBareme()) return;
  if (!await confirmerAction('Supprimer cette ligne de barème ? Le solde des étudiants concernés ne sera plus calculable tant qu\'aucune autre ligne ne la remplace.', { titre: 'Supprimer le barème', texteConfirmer: 'Supprimer' })) return;
  try {
    await fetchCaisse(`${BASE_URL}/api/frais-scolarite/${id}`, { method: 'DELETE' });
    afficherToast('🗑️ Supprimé.');
    chargerBareme();
    chargerEtudiantsCaisse();
  } catch (err) { console.error(err); }
}

async function chargerEtudiantsCaisse() {
  const tbody = document.getElementById('caisse-etudiants-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="8" class="admin-vide">Chargement...</td></tr>`;
  const cellSub = 'font-size:11px;color:#999';
  try {
    const nom = document.getElementById('caisse-recherche')?.value || '';
    const annee = document.getElementById('caisse-filtre-annee')?.value || '';
    const faculte = document.getElementById('caisse-filtre-faculte')?.value || '';
    const niveau = document.getElementById('caisse-filtre-niveau')?.value || '';
    const params = new URLSearchParams();
    if (nom) params.append('nom', nom);
    if (annee) params.append('annee', annee);
    if (faculte) params.append('faculte', faculte);
    if (niveau) params.append('niveau', niveau);
    const r = await fetchCaisse(`${BASE_URL}/api/caisse/etudiants?${params}`);
    etudiantsCaisse = await r.json();
    if (!etudiantsCaisse.length) { tbody.innerHTML = `<tr><td colspan="8" class="admin-vide">Aucun étudiant trouvé.</td></tr>`; return; }
    const libelle = estLectureSeule() ? 'Consulter la situation' : 'Gérer les versements';
    tbody.innerHTML = etudiantsCaisse.map((e, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${e.nom}</strong> ${e.postnom || ''} ${e.prenom}<br><span style="${cellSub}">${e.id}</span></td>
        <td>${e.faculte || '—'}<br><span style="${cellSub}">${e.niveau || ''}${e.niveau && e.annee_academique ? ' · ' : ''}${e.annee_academique || ''}</span></td>
        <td>${e.dernier_motif || '—'}</td>
        <td>${e.derniere_reference || '—'}</td>
        <td><strong style="color:var(--vert)">${montant(e.total_verse)} $</strong></td>
        <td>${e.solde === null ? '<span style="color:#999">Barème non défini</span>' : `<strong style="color:${e.solde > 0 ? 'var(--rouge,#c0392b)' : 'var(--vert)'}">${montant(e.solde)} $</strong>`}</td>
        <td class="admin-actions-cell">
          <button class="btn-icone" onclick="ouvrirModalPaiementsCaisse('${e.id}')" title="${libelle}">💵</button>
          <button class="btn-icone" onclick="ouvrirFraisEtudiant('${e.id}')" title="Frais de scolarité par année">📄</button>
        </td>
      </tr>`).join('');
  } catch { tbody.innerHTML = `<tr><td colspan="8" class="admin-vide">⚠️ Erreur.</td></tr>`; }
}

// =====================
// MODAL VERSEMENTS
// =====================
// Situation de l'étudiant courant (périodes/soldes par année) + cache des
// versements toutes années confondues, pour filtrer par année sélectionnée.
let situationCaisse = null;
let paiementsToutesAnnees = [];

async function ouvrirModalPaiementsCaisse(etudiantId) {
  etudiantCourantCaisse = etudiantsCaisse.find(e => e.id === etudiantId) || null;
  const nomEtudiant = etudiantCourantCaisse
    ? `${etudiantCourantCaisse.nom} ${etudiantCourantCaisse.prenom}` : etudiantId;
  document.getElementById('paiements-etudiant-id').value = etudiantId;
  document.getElementById('paiements-nom-etudiant').textContent = nomEtudiant;
  document.getElementById('paiement-montant').value = '';
  document.getElementById('paiement-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('paiement-reference').value = '';

  const saisie = document.getElementById('paiement-saisie');
  if (saisie) saisie.style.display = estLectureSeule() ? 'none' : '';

  document.getElementById('modal-paiements')?.classList.add('active');

  // Charger la situation (périodes/soldes par année) et remplir le sélecteur.
  situationCaisse = null;
  const selAnnee = document.getElementById('paiement-annee');
  if (selAnnee) selAnnee.innerHTML = '<option>Chargement...</option>';
  await rafraichirSituationCaisse(etudiantId);
  const courante = (situationCaisse && situationCaisse.etudiant && situationCaisse.etudiant.annee_courante) || (etudiantCourantCaisse || {}).annee_academique || '';
  remplirAnneesPaiement(courante);

  await chargerPaiementsCaisse();
}

function fermerModalPaiements() { document.getElementById('modal-paiements')?.classList.remove('active'); }

// Récupère la situation (périodes/soldes par année) de l'étudiant courant.
async function rafraichirSituationCaisse(etudiantId) {
  try {
    const r = await fetchCaisse(`${BASE_URL}/api/caisse/etudiant/${etudiantId}/situation`);
    situationCaisse = await r.json();
  } catch { situationCaisse = { periodes: [] }; }
}

// Remplit le sélecteur d'année : UNION des périodes de l'étudiant (avec niveau
// et dette) ET de toutes les années académiques du système — afin de pouvoir
// rattacher un versement à n'importe quelle année (ex. une dette de L1
// 2026-2027 pour un étudiant admis directement en L2). La dette est signalée.
function remplirAnneesPaiement(anneePref) {
  const selAnnee = document.getElementById('paiement-annee');
  if (!selAnnee) return;
  const periodes = (situationCaisse && situationCaisse.periodes) || [];
  const courante = (situationCaisse && situationCaisse.etudiant && situationCaisse.etudiant.annee_courante) || (etudiantCourantCaisse || {}).annee_academique || anneeCouranteCaisse || '';
  const parAnnee = {};
  periodes.forEach(p => { parAnnee[p.annee_academique] = p; });

  // Ensemble des années : périodes + toutes les années du système + courante.
  const set = new Set(periodes.map(p => p.annee_academique));
  (anneesCaisse || []).forEach(a => set.add(a.libelle));
  if (courante) set.add(courante);
  const liste = [...set].filter(Boolean).sort((a, b) => (a < b ? 1 : -1)); // décroissant

  selAnnee.innerHTML = liste.length
    ? liste.map(an => {
        const p = parAnnee[an];
        const suffixe = p ? `${p.niveau ? ' · ' + p.niveau : ''}${p.solde > 0 ? '  — dette ' + montant(p.solde) + ' $' : ''}` : '';
        return `<option value="${an}">${an}${suffixe}</option>`;
      }).join('')
    : `<option value="${courante}">${courante || '—'}</option>`;

  const cible = (anneePref && liste.includes(anneePref)) ? anneePref
              : (courante && liste.includes(courante)) ? courante
              : (liste[0] || courante);
  if (cible) selAnnee.value = cible;
  majNiveauPaiement();
}

// Recharge situation + versements après un ajout/suppression, en conservant
// l'année sélectionnée (régularisation d'une dette antérieure).
async function rafraichirModalPaiements() {
  const etudiantId = document.getElementById('paiements-etudiant-id').value;
  const anneeAvant = document.getElementById('paiement-annee')?.value;
  await rafraichirSituationCaisse(etudiantId);
  remplirAnneesPaiement(anneeAvant);
  await chargerPaiementsCaisse();
}

// Re-render lorsqu'on change l'année (régularisation d'une dette antérieure).
function changerAnneePaiement() { majNiveauPaiement(); afficherPaiementsAnnee(); }

// Affiche le sélecteur « Niveau » UNIQUEMENT pour une année hors cursus (aucune
// période connue → le niveau réglé doit être saisi à la main). Pour une année
// connue, le niveau est déduit de la période : le bloc reste masqué pour éviter
// le doublon avec le libellé de l'année (« 2026-2027 · Pré-U »).
function majNiveauPaiement() {
  const bloc = document.getElementById('paiement-niveau-bloc');
  const sel = document.getElementById('paiement-niveau-select');
  if (!bloc || !sel) return;
  const periode = periodeSelectionnee();
  if (periode) {
    bloc.style.display = 'none';
  } else {
    bloc.style.display = 'inline-flex';
    const niv = (etudiantCourantCaisse || {}).niveau || '';
    if (niv && [...sel.options].some(o => o.value === niv)) sel.value = niv;
  }
}

// Période (barème/solde) correspondant à l'année sélectionnée.
function periodeSelectionnee() {
  const annee = document.getElementById('paiement-annee')?.value || '';
  const periodes = (situationCaisse && situationCaisse.periodes) || [];
  return periodes.find(p => p.annee_academique === annee) || null;
}

async function chargerPaiementsCaisse() {
  const etudiantId = document.getElementById('paiements-etudiant-id').value;
  const tbody = document.getElementById('paiements-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6" class="admin-vide">Chargement...</td></tr>`;
  try {
    const r = await fetchCaisse(`${BASE_URL}/api/paiements/etudiant/${etudiantId}`);
    paiementsToutesAnnees = await r.json();
    afficherPaiementsAnnee();
  } catch { tbody.innerHTML = `<tr><td colspan="6" class="admin-vide">⚠️ Erreur.</td></tr>`; }
}

// Affiche les versements de l'année sélectionnée + total & solde de cette année.
function afficherPaiementsAnnee() {
  const tbody = document.getElementById('paiements-body');
  if (!tbody) return;
  const annee = document.getElementById('paiement-annee')?.value || '';
  const periode = periodeSelectionnee();
  const paiements = paiementsToutesAnnees.filter(p => (p.annee_academique || '') === annee);
  const total = paiements.reduce((s, p) => s + Number(p.montant), 0);
  document.getElementById('paiements-total').textContent = `${total.toFixed(2)} $`;

  // Info sur le barème de l'année choisie (utile pour une année antérieure).
  const info = document.getElementById('paiement-annee-info');
  if (info) info.textContent = periode && periode.montant_attendu != null
    ? `Barème ${annee} : ${montant(periode.montant_attendu)} $`
    : (periode ? 'Aucun barème défini pour cette année.' : 'Année hors cursus enregistré — choisissez le niveau réglé.');

  const soldeEl = document.getElementById('paiements-solde');
  if (soldeEl) {
    // Solde uniquement pour une période connue (barème rattaché) ; pour une
    // année hors cursus, on n'affiche pas de solde trompeur.
    const attendu = periode ? periode.montant_attendu : null;
    if (attendu == null) { soldeEl.textContent = periode ? 'Barème non défini' : '—'; soldeEl.style.fontSize = '13px'; soldeEl.style.color = '#999'; }
    else {
      const solde = Math.max(0, Number(attendu) - total);
      soldeEl.textContent = `${solde.toFixed(2)} $`;
      soldeEl.style.fontSize = '22px';
      soldeEl.style.color = solde > 0 ? 'var(--rouge, #c0392b)' : 'var(--vert)';
    }
  }

  const lecture = estLectureSeule();
  tbody.innerHTML = paiements.length === 0
    ? `<tr><td colspan="6" class="admin-vide">Aucun versement pour ${annee || 'cette année'}.</td></tr>`
    : paiements.map(p => `<tr>
        <td>${formaterDateCaisse(p.date_paiement)}</td>
        <td>${Number(p.montant).toFixed(2)} $</td>
        <td>${p.rubrique || '—'}</td>
        <td>${p.reference || '—'}</td>
        <td>${p.mode_paiement || '—'}</td>
        <td class="admin-actions-cell">
          <button class="btn-icone" onclick='reimprimerRecu(${attrJSON(p)})' title="Réimprimer le reçu">🧾</button>
          ${lecture ? '' : `<button class="btn-icone danger" onclick="supprimerPaiementCaisse(${p.id})" aria-label="Supprimer">${icone('corbeille')}</button>`}
        </td>
      </tr>`).join('');
}

async function ajouterPaiementCaisse() {
  if (estLectureSeule()) { afficherToast('⚠️ Encaissement non autorisé pour ce compte.', 'erreur'); return; }
  const etudiant_id = document.getElementById('paiements-etudiant-id').value;
  const montantVal = parseFloat(document.getElementById('paiement-montant').value);
  const date_paiement = document.getElementById('paiement-date').value;
  const mode_paiement = document.getElementById('paiement-mode').value;
  const rubrique = document.getElementById('paiement-rubrique').value;
  const reference = document.getElementById('paiement-reference').value.trim();
  // Année choisie dans le sélecteur (année courante par défaut, ou une année
  // antérieure pour régulariser une dette d'un étudiant promu).
  const annee_academique = document.getElementById('paiement-annee')?.value || (etudiantCourantCaisse || {}).annee_academique || null;
  const periode = periodeSelectionnee();
  // Niveau visé par le versement : pour une année connue, celui de sa période
  // (ex. L1 pour une dette de L1 réglée par un étudiant désormais en L2). Pour
  // une année hors cursus, le sélecteur « Niveau » (alors visible) fait foi ;
  // à défaut, le niveau courant de l'étudiant.
  const niveau = (periode && periode.niveau)
    || document.getElementById('paiement-niveau-select')?.value
    || (etudiantCourantCaisse || {}).niveau || '';

  if (isNaN(montantVal) || montantVal <= 0) { afficherToast('⚠️ Entrez un montant valide.', 'erreur'); return; }
  if (!date_paiement) { afficherToast('⚠️ La date est obligatoire.', 'erreur'); return; }
  try {
    const r = await fetchCaisse(`${BASE_URL}/api/paiements`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ etudiant_id, montant: montantVal, date_paiement, mode_paiement, rubrique, reference, annee_academique, niveau })
    });
    const d = await r.json();
    if (!r.ok) { afficherToast('❌ ' + d.erreur, 'erreur'); return; }
    afficherToast('✅ Versement enregistré.');
    // Reçu imprimé automatiquement — avec le niveau/année réellement enregistrés.
    const etuRecu = { ...etudiantCourantCaisse, annee_academique, niveau };
    imprimerRecu({ id: d.id, montant: montantVal, date_paiement, rubrique, reference, mode_paiement }, etuRecu, nomCaissier());
    document.getElementById('paiement-montant').value = '';
    document.getElementById('paiement-reference').value = '';
    await rafraichirModalPaiements();
    chargerEtudiantsCaisse();
  } catch { afficherToast('⚠️ Serveur indisponible.', 'erreur'); }
}

async function supprimerPaiementCaisse(id) {
  if (!await confirmerAction('Supprimer ce versement ? Cette action est irréversible.', { titre: 'Supprimer le versement', texteConfirmer: 'Supprimer' })) return;
  try {
    await fetchCaisse(`${BASE_URL}/api/paiements/${id}`, { method: 'DELETE' });
    afficherToast('🗑️ Versement supprimé.');
    await rafraichirModalPaiements();
    chargerEtudiantsCaisse();
  } catch (err) { console.error(err); }
}

// Réimpression depuis l'historique : le caissier est celui qui a encaissé.
function reimprimerRecu(p) {
  const caissier = (p.agent_prenom || p.agent_noms)
    ? `${p.agent_prenom || ''} ${p.agent_noms || ''}`.trim() : nomCaissier();
  imprimerRecu(p, etudiantCourantCaisse, caissier);
}

// =====================
// MODAL CONSULTATION DES FRAIS DE SCOLARITÉ (par année)
// Vue lecture : versements de l'étudiant filtrés par année, avec réimpression
// du reçu et suppression. (Distinct du modal d'encaissement 💵.)
// =====================
async function ouvrirFraisEtudiant(etudiantId) {
  fraisEtudiantCourant = etudiantsCaisse.find(e => e.id === etudiantId) || null;
  const nom = fraisEtudiantCourant ? `${fraisEtudiantCourant.nom} ${fraisEtudiantCourant.prenom}` : etudiantId;
  document.getElementById('frais-etudiant-id').value = etudiantId;
  document.getElementById('frais-nom-etudiant').textContent = nom;
  document.getElementById('modal-frais-etudiant')?.classList.add('active');

  const selA = document.getElementById('frais-annee');
  if (selA) selA.innerHTML = '<option>Chargement...</option>';
  document.getElementById('frais-body').innerHTML = `<tr><td colspan="6" class="admin-vide">Chargement...</td></tr>`;

  try { const r = await fetchCaisse(`${BASE_URL}/api/caisse/etudiant/${etudiantId}/situation`); situationFrais = await r.json(); } catch { situationFrais = { periodes: [] }; }
  try { const r = await fetchCaisse(`${BASE_URL}/api/paiements/etudiant/${etudiantId}`); paiementsFrais = await r.json(); } catch { paiementsFrais = []; }

  const periodes = (situationFrais && situationFrais.periodes) || [];
  const courante = (situationFrais && situationFrais.etudiant && situationFrais.etudiant.annee_courante) || (fraisEtudiantCourant || {}).annee_academique || '';
  if (selA) {
    selA.innerHTML = periodes.length
      ? periodes.map(p => `<option value="${p.annee_academique}">${p.annee_academique}${p.niveau ? ' · ' + p.niveau : ''}</option>`).join('')
      : `<option value="${courante}">${courante || '—'}</option>`;
    if (courante && periodes.some(p => p.annee_academique === courante)) selA.value = courante;
  }
  afficherFraisAnnee();
}

function fermerModalFrais() { document.getElementById('modal-frais-etudiant')?.classList.remove('active'); }

function afficherFraisAnnee() {
  const tbody = document.getElementById('frais-body');
  if (!tbody) return;
  const annee = document.getElementById('frais-annee')?.value || '';
  const paiements = (paiementsFrais || []).filter(p => (p.annee_academique || '') === annee);
  const total = paiements.reduce((s, p) => s + Number(p.montant), 0);
  const tEl = document.getElementById('frais-total');
  if (tEl) tEl.textContent = `Total ${annee} : ${total.toFixed(2)} $`;

  const lecture = estLectureSeule();
  tbody.innerHTML = paiements.length === 0
    ? `<tr><td colspan="6" class="admin-vide">Aucun versement pour ${annee || 'cette année'}.</td></tr>`
    : paiements.map(p => `<tr>
        <td>${formaterDateCaisse(p.date_paiement)}</td>
        <td>${Number(p.montant).toFixed(2)} $</td>
        <td>${p.rubrique || '—'}</td>
        <td>${p.reference || '—'}</td>
        <td>${p.mode_paiement || '—'}</td>
        <td class="admin-actions-cell">
          <button class="btn-icone" onclick='reimprimerRecuFrais(${attrJSON(p)})' title="Réimprimer le reçu">🧾</button>
          ${lecture ? '' : `<button class="btn-icone danger" onclick="supprimerFraisEtudiant(${p.id})" aria-label="Supprimer">${icone('corbeille')}</button>`}
        </td>
      </tr>`).join('');
}

// Réimpression : reçu avec le niveau/année réellement rattachés au versement.
function reimprimerRecuFrais(p) {
  const caissier = (p.agent_prenom || p.agent_noms) ? `${p.agent_prenom || ''} ${p.agent_noms || ''}`.trim() : nomCaissier();
  const etu = { ...(fraisEtudiantCourant || {}), niveau: p.niveau || (fraisEtudiantCourant || {}).niveau, annee_academique: p.annee_academique || (fraisEtudiantCourant || {}).annee_academique };
  imprimerRecu(p, etu, caissier);
}

async function supprimerFraisEtudiant(id) {
  if (!await confirmerAction('Supprimer ce versement ? Cette action est irréversible.', { titre: 'Supprimer le versement', texteConfirmer: 'Supprimer' })) return;
  try {
    await fetchCaisse(`${BASE_URL}/api/paiements/${id}`, { method: 'DELETE' });
    afficherToast('🗑️ Versement supprimé.');
    const eid = document.getElementById('frais-etudiant-id').value;
    try { const r = await fetchCaisse(`${BASE_URL}/api/paiements/etudiant/${eid}`); paiementsFrais = await r.json(); } catch { /* garde l'ancien cache */ }
    afficherFraisAnnee();
    chargerEtudiantsCaisse();
  } catch (err) { console.error(err); }
}

// =====================
// REÇU DE PAIEMENT (impression)
// =====================
function imprimerRecu(p, etu, caissier) {
  if (!etu) { afficherToast('⚠️ Données étudiant indisponibles pour le reçu.', 'erreur'); return; }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nomComplet = `${etu.nom || ''} ${etu.postnom || ''} ${etu.prenom || ''}`.replace(/\s+/g, ' ').trim();
  const numero = 'REC-' + String(p.id || Date.now()).padStart(5, '0');
  const logoSrc = `${location.origin}/img/logo.png`;
  const ligne = (c, v) => `<tr><td class="c">${c}</td><td class="v">${esc(v || '—')}</td></tr>`;

  // QR reprenant les informations du reçu (vérifiable au scan). Autonome (texte).
  let qrRecuSrc = '';
  try {
    if (typeof qrcode !== 'undefined') {
      const payloadRecu =
        `REÇU UML — ${numero}\n` +
        `Matricule: ${etu.id}\n` +
        `Étudiant: ${nomComplet}\n` +
        `Montant: ${montant(p.montant)} $\n` +
        `Motif: ${p.rubrique || '—'}\n` +
        `Référence: ${p.reference || '—'}\n` +
        `Mode: ${p.mode_paiement || '—'}\n` +
        `Date: ${formaterDateCaisse(p.date_paiement)}\n` +
        `Année: ${etu.annee_academique || '—'}\n` +
        `Caissier: ${caissier}`;
      const qr = qrcode(0, 'M'); qr.addData(payloadRecu); qr.make();
      qrRecuSrc = qr.createDataURL(3, 4);
    }
  } catch { /* QR indisponible : le reçu reste valide sans lui */ }

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Reçu ${esc(numero)}</title>
<style>
  :root { --bleu:#1a3a6b; --jaune:#f0c020; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Segoe UI',Arial,sans-serif; background:#e9edf2; color:#1a1a1a; padding:24px; }
  .barre { text-align:center; margin-bottom:16px; }
  .barre button { font-size:14px; padding:9px 20px; border:none; border-radius:6px; background:var(--bleu); color:#fff; cursor:pointer; }
  .recu { width:420px; margin:0 auto; background:#fff; border:1px solid #ccc; border-radius:8px; overflow:hidden; }
  .r-tete { display:flex; align-items:center; gap:10px; padding:12px 16px; background:#fff; color:var(--bleu); border-bottom:3px solid var(--bleu); }
  .r-tete .logo { width:40px; height:40px; object-fit:contain; flex:0 0 auto; }
  .r-tete .u { font-size:13px; font-weight:800; line-height:1.15; flex:1 1 auto; }
  .r-tete .u small { display:block; font-weight:600; font-size:9px; color:#666; }
  .r-tete .qr { width:66px; height:66px; flex:0 0 auto; }
  .r-titre { background:var(--jaune); color:var(--bleu); text-align:center; font-weight:800; letter-spacing:1px; padding:5px; font-size:13px; }
  .r-num { text-align:center; font-size:11px; color:#666; padding:6px; }
  table { width:100%; border-collapse:collapse; }
  td { padding:6px 16px; font-size:12px; border-bottom:1px solid #eef1f5; }
  td.c { color:#777; width:42%; }
  td.v { font-weight:600; }
  .r-montant { display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:#f4f6f9; }
  .r-montant .l { font-size:12px; color:#555; }
  .r-montant .m { font-size:22px; font-weight:800; color:var(--bleu); }
  .r-sign { display:flex; justify-content:space-between; padding:22px 16px 12px; font-size:11px; color:#444; }
  .r-sign .b { text-align:center; }
  .r-sign .l { border-top:1px solid #999; padding-top:3px; margin-top:20px; display:block; min-width:120px; }
  .r-pied { text-align:center; font-size:9px; color:#999; padding:8px; border-top:1px dashed #ccc; }
  @media print { body { background:#fff; padding:0; } .barre { display:none; } .recu { border:none; }
    @page { size:auto; margin:12mm; } * { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style></head><body>
  <div class="barre"><button onclick="window.print()">🖨️ Imprimer le reçu</button></div>
  <div class="recu">
    <div class="r-tete">
      <img class="logo" src="${logoSrc}" alt="" onerror="this.style.display='none'">
      <div class="u">UNIVERSITÉ MÉTHODISTE DE LUBUMBASHI<small>Scientia, Sanctitas et Veritas</small></div>
      ${qrRecuSrc ? `<img class="qr" src="${qrRecuSrc}" alt="QR du reçu" title="Scanner pour vérifier ce reçu">` : ''}
    </div>
    <div class="r-titre">REÇU DE PAIEMENT</div>
    <div class="r-num">N° ${esc(numero)} — ${formaterDateCaisse(p.date_paiement)}</div>
    <table>
      ${ligne('Matricule', etu.id)}
      ${ligne('Étudiant', nomComplet)}
      ${ligne('Filière', etu.filiere || etu.promotion)}
      ${ligne('Niveau', etu.niveau)}
      ${ligne('Année académique', etu.annee_academique)}
      ${ligne('Motif (rubrique)', p.rubrique)}
      ${ligne('Référence', p.reference)}
      ${ligne('Mode de paiement', p.mode_paiement)}
    </table>
    <div class="r-montant"><span class="l">Montant perçu</span><span class="m">${montant(p.montant)} $</span></div>
    <div class="r-sign">
      <div class="b"><span class="l">${esc(caissier)}</span></div>
      <div class="b"><span class="l">Sceau</span></div>
    </div>
    <div class="r-pied">Reçu généré électroniquement — Université Méthodiste de Lubumbashi</div>
  </div>
<script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 400); });<\/script>
</body></html>`;

  const w = window.open('', '_blank', 'width=560,height=680');
  if (!w) { afficherToast('⚠️ Autorisez les pop-ups pour imprimer le reçu.', 'erreur'); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

// =====================
// RAPPORTS (journalier / mensuel / annuel)
// =====================
let dernierRapport = null;
let rapportInitialise = false;

function initRapports() {
  if (rapportInitialise) return;
  rapportInitialise = true;
  const auj = new Date();
  const j = document.getElementById('rapport-jour');
  const m = document.getElementById('rapport-mois');
  if (j) j.value = auj.toISOString().split('T')[0];
  if (m) m.value = auj.toISOString().slice(0, 7);
  const selA = document.getElementById('rapport-annee');
  if (selA) {
    const a = auj.getFullYear();
    let html = '';
    for (let y = a + 1; y >= a - 6; y--) html += `<option value="${y}"${y === a ? ' selected' : ''}>${y}</option>`;
    selA.innerHTML = html;
  }
  basculerChampRapport();
}

function basculerChampRapport() {
  const type = document.getElementById('rapport-type').value;
  document.getElementById('rapport-jour').style.display  = type === 'jour'  ? '' : 'none';
  document.getElementById('rapport-mois').style.display  = type === 'mois'  ? '' : 'none';
  document.getElementById('rapport-annee').style.display = type === 'annee' ? '' : 'none';
}

function valeurRapport(type) {
  if (type === 'jour')  return document.getElementById('rapport-jour').value;
  if (type === 'mois')  return document.getElementById('rapport-mois').value;
  return document.getElementById('rapport-annee').value;
}

const LIBELLE_TYPE_RAPPORT = { jour: 'Journalier', mois: 'Mensuel', annee: 'Annuel' };

function periodeLisible(type, valeur) {
  if (type === 'jour')  return formaterDateCaisse(valeur);
  if (type === 'annee') return `Année ${valeur}`;
  const [y, mo] = valeur.split('-');
  const mois = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  return `${mois[Number(mo) - 1]} ${y}`;
}

async function genererRapport() {
  const type = document.getElementById('rapport-type').value;
  const valeur = valeurRapport(type);
  if (!valeur) { afficherToast('⚠️ Choisissez une période.', 'erreur'); return; }
  const zone = document.getElementById('rapport-resultat');
  zone.innerHTML = '<div class="dash-card"><p class="admin-vide">Génération...</p></div>';
  try {
    const r = await fetchCaisse(`${BASE_URL}/api/caisse/rapport?type=${type}&valeur=${encodeURIComponent(valeur)}`);
    const d = await r.json();
    if (!r.ok) { zone.innerHTML = `<div class="dash-card"><p class="admin-vide">⚠️ ${d.erreur}</p></div>`; return; }
    dernierRapport = { ...d, libelleType: LIBELLE_TYPE_RAPPORT[type], periode: periodeLisible(type, valeur) };
    afficherRapport(dernierRapport);
    document.getElementById('btn-imprimer-rapport').style.display = d.nb ? '' : 'none';
    // Export Excel / PDF : uniquement l'administrateur du budget, une fois un
    // rapport non vide généré.
    document.querySelectorAll('.rapport-export').forEach(b => { b.style.display = (d.nb && estAdminBudget()) ? '' : 'none'; });
  } catch { zone.innerHTML = '<div class="dash-card"><p class="admin-vide">⚠️ Erreur.</p></div>'; }
}

// Regroupe les versements par étudiant + date : quand un étudiant paie
// plusieurs frais le même jour, son nom / niveau / date ne sont écrits qu'une
// fois, les rubriques suivent en dessous, et une ligne de démarcation sépare
// l'étudiant suivant. (Les lignes arrivent déjà triées par date puis étudiant.)
function grouperVersementsRapport(lignes) {
  const groupes = [];
  const pos = {};
  (lignes || []).forEach(l => {
    const dateAff = formaterDateCaisse(l.date_paiement);
    const cle = `${l.matricule || ''}|${dateAff}`;
    if (pos[cle] === undefined) { pos[cle] = groupes.length; groupes.push({ dateAff, entete: l, items: [] }); }
    groupes[pos[cle]].items.push(l);
  });
  return groupes;
}

function afficherRapport(d) {
  const zone = document.getElementById('rapport-resultat');
  const rub = (d.par_rubrique || []).map(r => `<tr><td>${r.rubrique}</td><td>${r.nb}</td><td>${montant(r.total)} $</td></tr>`).join('')
    || '<tr><td colspan="3" class="admin-vide">—</td></tr>';
  const groupes = grouperVersementsRapport(d.lignes);
  const lignes = groupes.length ? groupes.map(g => g.items.map((l, i) => {
    const premier = i === 0;
    const dernier = i === g.items.length - 1;
    return `<tr${dernier ? ' class="rapport-sep"' : ''}>
      <td>${premier ? g.dateAff : ''}</td>
      <td>${premier ? `${g.entete.nom} ${g.entete.postnom || ''} ${g.entete.prenom}` : ''}</td>
      <td>${premier ? libelleFiliere(g.entete.niveau, g.entete.filiere || g.entete.promotion) : ''}</td>
      <td>${l.rubrique || '—'}</td>
      <td>${l.reference || '—'}</td>
      <td>${montant(l.montant)} $</td>
    </tr>`;
  }).join('')).join('') : '<tr><td colspan="6" class="admin-vide">Aucun versement sur cette période.</td></tr>';

  zone.innerHTML = `
    <div class="stats-grid" style="margin-bottom:16px">
      <div class="stat-card"><span class="stat-valeur">${montant(d.total)}</span><span class="stat-label">Total encaissé ($) — ${d.periode}</span></div>
      <div class="stat-card"><span class="stat-valeur">${d.nb}</span><span class="stat-label">Versements</span></div>
    </div>
    <div class="dash-card" style="margin-bottom:16px">
      <h3>Répartition par rubrique</h3>
      <table class="dash-table"><thead><tr><th>Rubrique</th><th>Nombre</th><th>Total</th></tr></thead><tbody>${rub}</tbody></table>
    </div>
    <div class="dash-card">
      <h3>Détail des versements</h3>
      <table class="dash-table"><thead><tr><th>Date</th><th>Étudiant</th><th>Niveau</th><th>Rubrique</th><th>Référence</th><th>Montant</th></tr></thead><tbody>${lignes}</tbody></table>
    </div>`;
}

function imprimerRapport() {
  const d = dernierRapport;
  if (!d) { afficherToast('⚠️ Générez d\'abord un rapport.', 'erreur'); return; }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const logoSrc = `${location.origin}/img/logo.png`;
  const rub = (d.par_rubrique || []).map(r => `<tr><td>${esc(r.rubrique)}</td><td>${r.nb}</td><td class="n">${montant(r.total)} $</td></tr>`).join('');
  const groupesImpr = grouperVersementsRapport(d.lignes);
  const lignes = groupesImpr.length ? groupesImpr.map(g => g.items.map((l, i) => {
    const premier = i === 0;
    const dernier = i === g.items.length - 1;
    const sep = dernier ? ' style="border-bottom:2px solid #1a3a6b"' : '';
    return `<tr>
      <td${sep}>${premier ? formaterDateCaisse(l.date_paiement) : ''}</td>
      <td${sep}>${premier ? esc(`${g.entete.nom} ${g.entete.postnom || ''} ${g.entete.prenom}`) : ''}</td>
      <td${sep}>${premier ? esc(libelleFiliere(g.entete.niveau, g.entete.filiere || g.entete.promotion)) : ''}</td>
      <td${sep}>${esc(l.rubrique || '')}</td>
      <td${sep}>${esc(l.reference || '')}</td>
      <td class="n"${sep ? ' style="border-bottom:2px solid #1a3a6b;text-align:right"' : ''}>${montant(l.montant)} $</td>
    </tr>`;
  }).join('')).join('') : '<tr><td colspan="6" style="text-align:center;color:#999">Aucun versement.</td></tr>';

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Rapport ${esc(d.libelleType)} — ${esc(d.periode)}</title>
<style>
  :root { --bleu:#1a3a6b; --jaune:#f0c020; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Segoe UI',Arial,sans-serif; color:#1a1a1a; padding:24px; }
  .barre { text-align:center; margin-bottom:16px; }
  .barre button { font-size:14px; padding:9px 20px; border:none; border-radius:6px; background:var(--bleu); color:#fff; cursor:pointer; }
  .tete { display:flex; align-items:center; gap:12px; border-bottom:3px solid var(--jaune); padding-bottom:10px; margin-bottom:6px; }
  .tete img { width:46px; height:46px; object-fit:contain; }
  .tete .u { font-size:16px; font-weight:800; color:var(--bleu); line-height:1.2; }
  .tete .u small { display:block; font-size:10px; font-weight:600; color:#666; }
  h1 { font-size:16px; color:var(--bleu); margin:14px 0 2px; }
  .periode { color:#666; font-size:12px; margin-bottom:12px; }
  .totaux { display:flex; gap:24px; margin:12px 0 18px; }
  .totaux div { background:#f4f6f9; border-radius:8px; padding:10px 18px; }
  .totaux .v { font-size:20px; font-weight:800; color:var(--bleu); }
  .totaux .l { font-size:11px; color:#666; }
  table { width:100%; border-collapse:collapse; margin-bottom:18px; font-size:11px; }
  th { background:var(--bleu); color:#fff; padding:6px 8px; text-align:left; font-size:10px; }
  td { padding:5px 8px; border-bottom:1px solid #eef1f5; }
  td.n, th.n { text-align:right; }
  h2 { font-size:12px; color:var(--bleu); margin:6px 0; text-transform:uppercase; letter-spacing:.5px; }
  .signe { margin-top:30px; text-align:right; font-size:12px; }
  .signe span { border-top:1px solid #999; padding-top:4px; display:inline-block; min-width:200px; }
  @media print { .barre { display:none; } body { padding:0; } @page { size:A4; margin:14mm; }
    * { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style></head><body>
  <div class="barre"><button onclick="window.print()">🖨️ Imprimer le rapport</button></div>
  <div class="tete">
    <img src="${logoSrc}" alt="" onerror="this.style.display='none'">
    <div class="u">UNIVERSITÉ MÉTHODISTE DE LUBUMBASHI<small>Scientia, Sanctitas et Veritas</small></div>
  </div>
  <h1>Rapport d'encaissement — ${esc(d.libelleType)}</h1>
  <div class="periode">Période : ${esc(d.periode)} · Édité le ${new Date().toLocaleDateString('fr-FR')} par ${esc(`${titreAvantNom()} ${nomCaissier()}`.trim())}</div>
  <div class="totaux">
    <div><div class="v">${montant(d.total)} $</div><div class="l">Total encaissé</div></div>
    <div><div class="v">${d.nb}</div><div class="l">Versements</div></div>
  </div>
  <h2>Répartition par rubrique</h2>
  <table><thead><tr><th>Rubrique</th><th>Nombre</th><th class="n">Total</th></tr></thead><tbody>${rub || '<tr><td colspan="3" style="text-align:center;color:#999">—</td></tr>'}</tbody></table>
  <h2>Détail des versements</h2>
  <table><thead><tr><th>Date</th><th>Étudiant</th><th>Niveau</th><th>Rubrique</th><th>Référence</th><th class="n">Montant</th></tr></thead><tbody>${lignes}</tbody></table>
  <div class="signe"><span>${esc(nomCaissier())}</span></div>
<script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 400); });<\/script>
</body></html>`;

  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) { afficherToast('⚠️ Autorisez les pop-ups pour imprimer.', 'erreur'); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

// =====================
// INFORMATIONS PERSONNELLES DE L'AGENT (libre-service)
// =====================
async function ouvrirInfosAgent(event) {
  if (event) event.preventDefault();
  document.getElementById('caisse-menu')?.classList.remove('ouvert');
  const a = getAgentCaisse() || {};
  // Pré-remplissage immédiat depuis la session, complété par le serveur.
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('agent-noms', a.noms); set('agent-prenom', a.prenom); set('agent-matricule', a.matricule);
  set('agent-email', ''); set('agent-telephone', '');
  ['agent-pass-actuel', 'agent-pass-nouveau', 'agent-pass-confirmer'].forEach(id => set(id, ''));
  document.getElementById('modal-infos-agent')?.classList.add('active');
  try {
    const r = await fetchCaisse(`${BASE_URL}/api/auth/agent/${a.id}/profil`);
    if (r.ok) {
      const ag = (await r.json()).agent || {};
      set('agent-noms', ag.noms); set('agent-prenom', ag.prenom);
      set('agent-email', ag.email); set('agent-telephone', ag.telephone);
      set('agent-matricule', ag.matricule);
    }
  } catch { /* la session suffit au pré-remplissage */ }
}

function fermerInfosAgent() { document.getElementById('modal-infos-agent')?.classList.remove('active'); }

// Rafraîchit l'affichage du profil (avatar sidebar + menu) après modification.
function majAffichageAgent(agent) {
  const nomComplet = `${agent.prenom || ''} ${agent.noms || ''}`.trim();
  const initiales = `${(agent.prenom || '')[0] || ''}${(agent.noms || '')[0] || ''}`.toUpperCase() || 'AG';
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('caisse-avatar-sidebar', initiales);
  set('caisse-nom-sidebar', nomComplet);
  set('caisse-menu-prenom', agent.prenom || nomComplet);
}

async function sauverProfilAgent() {
  const a = getAgentCaisse() || {};
  const noms = document.getElementById('agent-noms').value.trim();
  const prenom = document.getElementById('agent-prenom').value.trim();
  const email = document.getElementById('agent-email').value.trim();
  const telephone = document.getElementById('agent-telephone').value.trim();
  if (!noms) { afficherToast('⚠️ Le nom est obligatoire.', 'erreur'); return; }
  try {
    const r = await fetchCaisse(`${BASE_URL}/api/auth/agent/${a.id}/profil`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ noms, prenom, email, telephone })
    });
    const d = await r.json();
    if (!r.ok) { afficherToast('❌ ' + d.erreur, 'erreur'); return; }
    // Met à jour la session + l'affichage (garde le token et le rôle).
    const maj = { ...a, noms, prenom, email, telephone };
    sessionStorage.setItem('caisse_agent', JSON.stringify(maj));
    majAffichageAgent(maj);
    afficherToast('✅ Informations mises à jour.');
  } catch { afficherToast('⚠️ Serveur indisponible.', 'erreur'); }
}

async function changerMotDePasseAgent() {
  const a = getAgentCaisse() || {};
  const actuel = document.getElementById('agent-pass-actuel').value;
  const nouveau = document.getElementById('agent-pass-nouveau').value;
  const confirmer = document.getElementById('agent-pass-confirmer').value;
  if (!actuel || !nouveau) { afficherToast('⚠️ Remplissez tous les champs.', 'erreur'); return; }
  if (nouveau.length < 6) { afficherToast('⚠️ Le nouveau mot de passe doit contenir au moins 6 caractères.', 'erreur'); return; }
  if (nouveau !== confirmer) { afficherToast('⚠️ La confirmation ne correspond pas.', 'erreur'); return; }
  try {
    const r = await fetchCaisse(`${BASE_URL}/api/auth/agent/${a.id}/password`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mot_de_passe_actuel: actuel, nouveau_mot_de_passe: nouveau })
    });
    const d = await r.json();
    if (!r.ok) { afficherToast('❌ ' + d.erreur, 'erreur'); return; }
    afficherToast('✅ Mot de passe mis à jour.');
    ['agent-pass-actuel', 'agent-pass-nouveau', 'agent-pass-confirmer'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
  } catch { afficherToast('⚠️ Serveur indisponible.', 'erreur'); }
}

// =====================
// CLOCHE — communiqués de l'admin destinés au rôle de l'agent (caisse / budget)
// =====================
let communiquesCaisse = [];

async function chargerCommuniquesCaisse() {
  const agent = getAgentCaisse();
  if (!agent) return;
  try {
    const r = await fetch(`${BASE_URL}/api/annonces?type=communique&role=${encodeURIComponent(agent.role)}&actif=true`);
    if (!r.ok) throw new Error();
    communiquesCaisse = await r.json();
    majNotifsCaisse();
  } catch { /* silencieux */ }
}

function cleNotifsCaisse() { const a = getAgentCaisse(); return a ? `notif_vus_caisse_${a.id}` : null; }
function lireNotifsCaisseVus() { const c = cleNotifsCaisse(); if (!c) return []; try { return JSON.parse(localStorage.getItem(c) || '[]'); } catch { return []; } }

function majNotifsCaisse() {
  const vus = lireNotifsCaisseVus();
  // La cloche n'affiche que les communiqués NON ENCORE lus : ils restent tant
  // que l'agent n'a pas cliqué dessus.
  const nouvelles = communiquesCaisse.filter(c => !vus.includes(c.id));
  const badge = document.getElementById('caisse-notif-badge');
  if (badge) { if (nouvelles.length) { badge.textContent = nouvelles.length > 99 ? '99+' : nouvelles.length; badge.style.display = ''; } else badge.style.display = 'none'; }
  const liste = document.getElementById('caisse-notif-liste');
  if (liste) {
    liste.innerHTML = nouvelles.length === 0
      ? '<p class="notif-vide">Aucune information pour le moment.</p>'
      : nouvelles.map(c => `
          <div class="notif-item" role="button" tabindex="0" onclick="marquerCommuniqueLuCaisse(${JSON.stringify(c.id)})">
            <span class="notif-item-icone">📣</span>
            <div><span class="notif-item-titre">${c.titre}</span><span class="notif-item-sous">${c.description || ''}</span></div>
          </div>`).join('');
  }
}

// Clic sur un communiqué → marqué lu (il disparaît de la cloche).
function marquerCommuniqueLuCaisse(id) {
  const vus = lireNotifsCaisseVus();
  if (!vus.includes(id)) vus.push(id);
  const cle = cleNotifsCaisse();
  if (cle) localStorage.setItem(cle, JSON.stringify(vus));
  majNotifsCaisse();
}

function basculerNotifsCaisse(event) {
  if (event) event.stopPropagation();
  const p = document.getElementById('caisse-notif-panneau');
  if (!p) return;
  document.getElementById('caisse-menu')?.classList.remove('ouvert');
  // On n'efface plus le badge à l'ouverture : un communiqué ne disparaît que
  // lorsque l'agent clique dessus (voir marquerCommuniqueLuCaisse).
  p.classList.toggle('ouvert');
}

function basculerMenuCaisse(event) {
  if (event) event.stopPropagation();
  document.getElementById('caisse-notif-panneau')?.classList.remove('ouvert');
  document.getElementById('caisse-menu')?.classList.toggle('ouvert');
}

// =====================
// INITIALISATION
// =====================
// =====================
// GÉRER LES INSCRITS (caisse) — mêmes pouvoirs que l'admin SAUF réinitialiser
// le mot de passe et imprimer le bulletin (boutons volontairement absents).
// Réutilise les routes /api/etudiants et /api/reinscriptions/nouveau, ouvertes
// au rôle caisse côté serveur (requireAdminOuCaisse / requireInscritsLecture).
// =====================
let inscritsCaisse = [];

// Filière affichée : nom nettoyé du préfixe de niveau (repli sur la promotion).
function filiereAffichee(e) {
  return sansPrefixeNiveau(e.filiere || e.promotion) || '—';
}

async function chargerInscritsCaisse() {
  const tbody = document.getElementById('admin-inscrits-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6" class="admin-vide">Chargement...</td></tr>`;
  try {
    const nom = document.getElementById('recherche-inscrits')?.value || '';
    const annee = document.getElementById('filtre-inscrits-annee')?.value || '';
    const niveau = document.getElementById('filtre-inscrits-niveau')?.value || '';
    const faculte = document.getElementById('filtre-inscrits-faculte')?.value || '';
    const date = document.getElementById('filtre-inscrits-date')?.value || '';
    const params = new URLSearchParams();
    if (nom) params.append('nom', nom);
    if (annee) params.append('annee', annee);
    if (niveau) params.append('niveau', niveau);
    if (faculte) params.append('faculte', faculte);
    if (date) params.append('date', date);
    const r = await fetchCaisse(`${BASE_URL}/api/etudiants?${params}`);
    inscritsCaisse = await r.json();
    if (!Array.isArray(inscritsCaisse) || !inscritsCaisse.length) { tbody.innerHTML = `<tr><td colspan="6" class="admin-vide">Aucun étudiant trouvé.</td></tr>`; return; }
    // Affichage par défaut du plus récent au plus ancien (date d'inscription) ;
    // les étudiants déjà promus (lignes « historique ») passent en dernier.
    inscritsCaisse.sort((a, b) => {
      if (!!a.historique !== !!b.historique) return a.historique ? 1 : -1;
      return String(b.date_inscription || '').localeCompare(String(a.date_inscription || ''));
    });
    // Niveau + Filière fusionnés en « Promotion » (ex. « L1 Théologie »).
    // ⚠️ Pas de bouton « bulletin » ni « réinitialiser le mot de passe » pour la
    // caisse — uniquement carte étudiant, modifier et supprimer.
    tbody.innerHTML = inscritsCaisse.map(e => `
      <tr>
        <td><strong>${e.nom}</strong> ${e.postnom||''} ${e.prenom}${e.historique?' <span class="badge attente" style="font-size:10px" title="Étudiant promu depuis — historique de cette période">Historique</span>':''} <span style="font-size:11px;color:#999">· ${e.id}</span></td>
        <td>${libelleFiliere(e.niveau, e.filiere || e.promotion)}</td>
        <td>${e.faculte||'—'}</td>
        <td>${e.annee_academique||'—'}</td>
        <td><span class="badge ${e.statut==='actif'?'reussi':e.statut==='diplome'?'attente':'echec'}">${e.statut||'actif'}</span></td>
        <td class="admin-actions-cell">
          <button class="btn-icone" onclick="imprimerCarteEtudiantCaisse('${e.id}')" aria-label="Imprimer la carte étudiant" title="Imprimer la carte étudiant">${icone('carte')}</button>
          <button class="btn-icone" onclick="modifierInscritCaisse('${e.id}')" aria-label="Modifier">${icone('crayon')}</button>
          <button class="btn-icone danger" onclick="supprimerInscritCaisse('${e.id}')" aria-label="Supprimer">${icone('corbeille')}</button>
        </td>
      </tr>`).join('');
  } catch { tbody.innerHTML = `<tr><td colspan="6" class="admin-vide">⚠️ Erreur.</td></tr>`; }
}

// Filières limitées à la faculté + niveau (cycle) choisis dans le modal de modif.
function chargerFilieresPourInscrit() {
  const f = document.getElementById('inscrit-faculte')?.value || '';
  const niveau = document.getElementById('inscrit-promotion')?.value || '';
  const sel = document.getElementById('inscrit-filiere');
  if (!sel) return;
  if (!f) { sel.innerHTML = '<option value="">— Choisir une faculté d\'abord —</option>'; return; }
  const fl = optionsFiliereFacNiveau(f, niveau);
  sel.innerHTML = fl.length === 0
    ? '<option value="">— Choisir un niveau —</option>'
    : (fl.length === 1
        ? fl.map(x => `<option value="${x}">${afficherNomFiliere(x)}</option>`).join('')
        : '<option value="">— Choisir une filière —</option>' + fl.map(x => `<option value="${x}">${afficherNomFiliere(x)}</option>`).join(''));
}

function modifierInscritCaisse(id) {
  const e = inscritsCaisse.find(x => x.id === id);
  if (!e) { afficherToast('⚠️ Étudiant non trouvé. Actualisez.', 'erreur'); return; }
  // Toujours éditer le profil COURANT (champs *_actuel[le]) même sur une ligne
  // « Historique », pour ne jamais écraser une promotion par des valeurs d'une
  // période passée.
  const anneeReelle     = e.historique ? e.annee_academique_actuelle : e.annee_academique;
  const niveauReel      = e.historique ? e.niveau_actuel             : e.niveau;
  const faculteReelle   = e.historique ? e.faculte_actuelle          : e.faculte;
  const promotionReelle = e.historique ? e.promotion_actuelle        : e.promotion;
  if (e.historique) afficherToast('ℹ️ Cet étudiant a été promu depuis — vous modifiez son profil courant.');

  document.getElementById('inscrit-id-edit').value   = e.id;
  document.getElementById('inscrit-nom').value       = e.nom || '';
  document.getElementById('inscrit-postnom').value   = e.postnom || '';
  document.getElementById('inscrit-prenom').value    = e.prenom || '';
  document.getElementById('inscrit-ddn').value       = e.date_naissance ? e.date_naissance.split('T')[0] : '';
  document.getElementById('inscrit-sexe').value      = e.sexe || 'M';
  document.getElementById('inscrit-email').value     = e.email || '';
  document.getElementById('inscrit-telephone').value = e.telephone || '';
  const selAnnee = document.getElementById('inscrit-annee');
  if (selAnnee) {
    if (anneeReelle && !Array.from(selAnnee.options).some(o => o.value === anneeReelle)) {
      const opt = document.createElement('option'); opt.value = anneeReelle; opt.textContent = anneeReelle; selAnnee.appendChild(opt);
    }
    selAnnee.value = anneeReelle || anneeCouranteCaisse || '';
  }
  document.getElementById('inscrit-statut').value    = e.statut || 'actif';
  document.getElementById('inscrit-promotion').value = niveauReel || 'L1';
  document.getElementById('inscrit-faculte').value   = faculteReelle || '';
  chargerFilieresPourInscrit();
  const sel = document.getElementById('inscrit-filiere');
  if (promotionReelle) {
    if (!Array.from(sel.options).some(o => o.value === promotionReelle)) {
      const opt = document.createElement('option'); opt.value = promotionReelle; opt.textContent = promotionReelle; sel.appendChild(opt);
    }
    sel.value = promotionReelle;
  }
  document.getElementById('inscrit-photo').value = e.photo || '';
  const fch = document.getElementById('inscrit-photo-fichier'); if (fch) fch.value = '';
  const ap = document.getElementById('inscrit-photo-apercu');
  if (ap) ap.innerHTML = e.photo ? `<img src="${BASE_URL}/${e.photo}" alt="" style="max-width:90px;border-radius:6px">` : '<span style="color:#999;font-size:12px">Aucune photo</span>';
  document.getElementById('modal-inscrit')?.classList.add('active');
}

function fermerModalInscrit() { document.getElementById('modal-inscrit')?.classList.remove('active'); }

// Aperçu local (sans téléversement) de la photo choisie.
function apercuPhotoInscrit(input) {
  const zone = document.getElementById('inscrit-photo-apercu');
  if (!zone) return;
  const f = input.files?.[0];
  zone.innerHTML = f ? `<img src="${URL.createObjectURL(f)}" alt="" style="max-width:90px;border-radius:6px">` : '';
}

async function sauvegarderInscritCaisse() {
  const id = document.getElementById('inscrit-id-edit').value;
  const corps = {
    nom: document.getElementById('inscrit-nom').value.trim(),
    postnom: document.getElementById('inscrit-postnom').value.trim(),
    prenom: document.getElementById('inscrit-prenom').value.trim(),
    date_naissance: document.getElementById('inscrit-ddn').value,
    sexe: document.getElementById('inscrit-sexe').value,
    email: document.getElementById('inscrit-email').value.trim(),
    telephone: document.getElementById('inscrit-telephone').value.trim(),
    faculte: document.getElementById('inscrit-faculte').value,
    promotion: document.getElementById('inscrit-filiere').value,
    niveau: document.getElementById('inscrit-promotion').value,
    annee_academique: document.getElementById('inscrit-annee').value,
    statut: document.getElementById('inscrit-statut').value
  };
  if (niveauEstMaster(corps.niveau) && !corps.promotion) {
    afficherToast('⚠️ Pour un Master, veuillez choisir une filière de master.', 'erreur'); return;
  }
  try {
    const r = await fetchCaisse(`${BASE_URL}/api/etudiants/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
    const d = await r.json();
    if (!r.ok) { afficherToast('❌ ' + (d.erreur || 'Mise à jour impossible'), 'erreur'); return; }
    const fichierPhoto = document.getElementById('inscrit-photo-fichier')?.files?.[0];
    if (fichierPhoto) {
      const fd = new FormData(); fd.append('photo', fichierPhoto);
      const rp = await fetchCaisse(`${BASE_URL}/api/etudiants/${id}/photo`, { method: 'POST', body: fd });
      if (!rp.ok) { const dp = await rp.json(); afficherToast('⚠️ ' + (dp.erreur || "Échec de l'envoi de la photo."), 'erreur'); }
    }
    afficherToast('✅ Mis à jour !'); fermerModalInscrit(); chargerInscritsCaisse(); chargerStatsCaisse();
  } catch { afficherToast('⚠️ Serveur indisponible.', 'erreur'); }
}

async function supprimerInscritCaisse(id) {
  if (!await confirmerAction(`Supprimer l'étudiant ${id} ? Cette action est irréversible.`, { titre: "Supprimer l'étudiant", texteConfirmer: 'Supprimer' })) return;
  try {
    const r = await fetchCaisse(`${BASE_URL}/api/etudiants/${id}`, { method: 'DELETE' });
    const d = await r.json();
    if (!r.ok) { afficherToast('❌ ' + (d.erreur || 'Suppression impossible'), 'erreur'); return; }
    afficherToast('✅ Étudiant supprimé.'); chargerInscritsCaisse(); chargerStatsCaisse();
  } catch { afficherToast('⚠️ Serveur indisponible.', 'erreur'); }
}

// ----- Inscrire un nouvel étudiant (modal) -----
function ouvrirModalNouvelInscritCaisse() {
  ['reins-nom','reins-postnom','reins-prenom','reins-ddn','reins-lieunaissance','reins-email','reins-telephone'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const selFac = document.getElementById('reins-faculte'); if (selFac) selFac.selectedIndex = 0;
  const selAnn = document.getElementById('reins-annee-nouveau'); if (selAnn && anneeCouranteCaisse) selAnn.value = anneeCouranteCaisse;
  chargerFilieresPourReinscription();
  document.getElementById('modal-nouvel-inscrit')?.classList.add('active');
}
function fermerModalNouvelInscritCaisse() { document.getElementById('modal-nouvel-inscrit')?.classList.remove('active'); }

function chargerFilieresPourReinscription() {
  const faculte = document.getElementById('reins-faculte')?.value || '';
  const niveau = document.getElementById('reins-niveau')?.value || '';
  const sel = document.getElementById('reins-filiere');
  if (!sel) return;
  if (!faculte) { sel.innerHTML = '<option value="">— Choisir une faculté d\'abord —</option>'; return; }
  const filieres = optionsFiliereFacNiveau(faculte, niveau);
  sel.innerHTML = filieres.length === 0
    ? '<option value="">— Choisir un niveau —</option>'
    : (filieres.length === 1
        ? filieres.map(f => `<option value="${f}">${afficherNomFiliere(f)}</option>`).join('')
        : '<option value="">— Choisir une filière —</option>' + filieres.map(f => `<option value="${f}">${afficherNomFiliere(f)}</option>`).join(''));
}

async function reinscrireNouvelEtudiantCaisse() {
  const corps = {
    nom: document.getElementById('reins-nom').value.trim(),
    postnom: document.getElementById('reins-postnom').value.trim(),
    prenom: document.getElementById('reins-prenom').value.trim(),
    sexe: document.getElementById('reins-sexe').value,
    date_naissance: document.getElementById('reins-ddn').value,
    email: document.getElementById('reins-email').value.trim(),
    telephone: document.getElementById('reins-telephone').value.trim(),
    faculte: document.getElementById('reins-faculte').value,
    filiere: document.getElementById('reins-filiere').value,
    niveau: document.getElementById('reins-niveau').value,
    annee_academique: document.getElementById('reins-annee-nouveau').value
  };
  if (!corps.nom || !corps.prenom || !corps.faculte || !corps.niveau || !corps.annee_academique) {
    afficherToast('⚠️ Nom, prénom, faculté, niveau et année sont obligatoires.', 'erreur'); return;
  }
  if (niveauEstMaster(corps.niveau) && !corps.filiere) {
    afficherToast('⚠️ Pour un Master, veuillez choisir une filière de master.', 'erreur'); return;
  }
  try {
    const r = await fetchCaisse(`${BASE_URL}/api/reinscriptions/nouveau`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
    const d = await r.json();
    if (!r.ok) { afficherToast('❌ ' + (d.erreur || 'Inscription impossible'), 'erreur'); return; }
    fermerModalNouvelInscritCaisse();
    chargerInscritsCaisse(); chargerStatsCaisse();
    await confirmerAction(
      `Étudiant inscrit en ${corps.niveau} (${d.coursInscrits} cours). Matricule : ${d.matricule} — Mot de passe temporaire : ${d.motDePasseTemporaire}`,
      { titre: '✅ Inscription réussie', texteConfirmer: 'Compris' }
    );
  } catch { afficherToast('⚠️ Serveur indisponible.', 'erreur'); }
}

// Carte d'étudiant (identité + photo + QR) — même rendu que côté admin.
function imprimerCarteEtudiantCaisse(id) {
  const e = inscritsCaisse.find(x => x.id === id);
  if (!e) { afficherToast('⚠️ Étudiant non trouvé. Actualisez.', 'erreur'); return; }
  if (typeof qrcode === 'undefined') { afficherToast('⚠️ Générateur de QR indisponible (vérifiez la connexion).', 'erreur'); return; }

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
  const nomComplet = `${e.nom || ''} ${e.postnom || ''} ${e.prenom || ''}`.replace(/\s+/g, ' ').trim();
  const ddn = e.date_naissance ? new Date(e.date_naissance).toLocaleDateString('fr-FR') : '—';
  // QR : URL de vérification en ligne (identité + classe + situation financière
  // de l'année de la carte). Voir /verifier.html + /api/verification/carte.
  const verifUrl = `${location.origin}/verifier.html?m=${encodeURIComponent(e.id)}&a=${encodeURIComponent(e.annee_academique || '')}&s=${encodeURIComponent(e.verif_sig || '')}`;
  const qr = qrcode(0, 'M'); qr.addData(verifUrl); qr.make();
  const qrSrc = qr.createDataURL(4, 6);
  const initiales = `${(e.prenom || '')[0] || ''}${(e.nom || '')[0] || ''}`.toUpperCase() || 'ET';
  const photoHTML = e.photo ? `<img class="r-photo" src="${BASE_URL}/${esc(e.photo)}" alt="Photo">` : `<div class="r-photo r-photo-vide">${esc(initiales)}</div>`;
  const naissance = `${ddn}${e.lieu_naissance ? ' à ' + esc(e.lieu_naissance) : ''}`;
  const prenomNom = `${e.prenom || ''} ${e.nom || ''}`.replace(/\s+/g, ' ').trim();
  const MOIS = ['Sep', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'];
  const cellulesMois = MOIS.map(m => `<div class="v-mois"><div class="v-case"></div><span>${m}</span></div>`).join('');

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Carte étudiant ${esc(e.id)}</title>
<style>
  :root { --bleu:#1a3a6b; --bleu2:#24508f; --jaune:#f0c020; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #e9edf2; padding: 24px; color: #1a1a1a; }
  .barre { text-align: center; margin-bottom: 18px; }
  .barre button { font-size: 14px; padding: 9px 20px; border: none; border-radius: 6px; background: var(--bleu); color: #fff; cursor: pointer; }
  .carte { width: 340px; height: 214px; margin: 0 auto 22px; border-radius: 12px; overflow: hidden;
           box-shadow: 0 6px 18px rgba(0,0,0,.18); position: relative; }
  .recto { background: linear-gradient(135deg, #14294b 0%, var(--bleu) 55%, var(--bleu2) 100%); color: #fff; }
  .r-annee { position: absolute; top: 0; right: 0; width: 112px; padding: 6px 10px 8px; text-align: center;
             background: var(--jaune); color: var(--bleu); border-bottom-left-radius: 16px; }
  .r-annee small { display: block; font-size: 7px; font-weight: 700; letter-spacing: .3px; text-transform: uppercase; }
  .r-annee b { font-size: 11px; }
  .r-top { display: flex; align-items: center; gap: 8px; padding: 9px 12px 4px; }
  .r-top .u { font-size: 11px; font-weight: 800; line-height: 1.12; letter-spacing: .3px; }
  .r-fac { padding: 2px 12px 6px; color: var(--jaune); font-size: 9.5px; font-weight: 700; }
  .r-body { display: flex; padding: 0 12px; gap: 10px; }
  .r-infos { flex: 1 1 auto; min-width: 0; }
  .r-nom { font-size: 12px; font-weight: 800; text-transform: uppercase; line-height: 1.15; }
  .r-nom span { display: block; font-size: 10px; font-weight: 600; text-transform: none; }
  .r-sub { font-size: 8px; color: #cdd8ea; margin: 3px 0 5px; }
  .r-infos p { font-size: 8.5px; line-height: 1.5; }
  .r-infos p b { color: var(--jaune); font-weight: 600; }
  .r-photo { width: 88px; height: 104px; object-fit: cover; border-radius: 4px; border: 2px solid var(--jaune); flex: 0 0 auto; }
  .r-photo-vide { display: flex; align-items: center; justify-content: center; background: #0e1f3a; color: var(--jaune); font-size: 32px; font-weight: 800; }
  .r-pied { position: absolute; left: 0; right: 0; bottom: 0; background: var(--jaune); color: var(--bleu);
            font-size: 7.5px; font-weight: 600; padding: 3px 12px; display: flex; justify-content: space-between; }
  .verso { background: linear-gradient(135deg, #f4f6f9, #e3e8ef); color: var(--bleu); }
  .v-top { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 2px solid var(--jaune); }
  .v-top .n { font-size: 10px; font-weight: 800; }
  .v-top .a { font-size: 8.5px; font-weight: 700; }
  .v-top .a small { color: #6a768a; }
  .v-corps { display: flex; gap: 10px; padding: 9px 12px 4px; }
  .v-qr { text-align: center; flex: 0 0 auto; }
  .v-qr img { width: 78px; height: 78px; }
  .v-qr span { display: block; font-size: 6.5px; color: #6a768a; margin-top: 2px; }
  .v-grille { flex: 1 1 auto; display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px 6px; align-content: start; }
  .v-mois { text-align: center; }
  .v-case { height: 24px; border: 1px solid var(--bleu); border-radius: 4px; background: rgba(240,192,32,.10); }
  .v-mois span { font-size: 6.5px; color: var(--bleu); }
  .v-pied { position: absolute; left: 0; right: 0; bottom: 0; text-align: center; font-size: 6.5px;
            color: #6a768a; padding: 2px; border-top: 1px solid #d4dae3; }
  @media print {
    body { background: #fff; padding: 0; }
    .barre { display: none; }
    .carte { box-shadow: none; margin: 0 auto; }
    .verso { page-break-before: always; }
    @page { size: auto; margin: 10mm; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style></head><body>
  <div class="barre"><button onclick="window.print()">🖨️ Imprimer la carte (recto / verso)</button></div>
  <div class="carte recto">
    <div class="r-annee"><small>Année académique</small><b>${esc(e.annee_academique || '—')}</b></div>
    <div class="r-top"><div class="u">UNIVERSITÉ MÉTHODISTE<br>DE LUBUMBASHI</div></div>
    <div class="r-fac">${esc(e.faculte || 'Université Méthodiste de Lubumbashi')}</div>
    <div class="r-body">
      <div class="r-infos">
        <div class="r-nom">${esc(`${e.nom || ''} ${e.postnom || ''}`.trim())}<span>${esc(e.prenom || '')}</span></div>
        <div class="r-sub">Né(e) le ${naissance}</div>
        <p>Étudiant(e)</p>
        <p>Niveau : <b>${esc(e.niveau || '—')}</b></p>
        <p>Matricule : <b>${esc(e.id)}</b></p>
        <p>Classe : <b>${esc(e.promotion || '—')}</b></p>
      </div>
      ${photoHTML}
    </div>
    <div class="r-pied"><span>Lubumbashi — R.D. Congo</span><span>Carte strictement personnelle</span></div>
  </div>
  <div class="carte verso">
    <div class="v-top"><span class="n">${esc(prenomNom)}</span><span class="a"><small>Année académique</small> ${esc(e.annee_academique || '—')}</span></div>
    <div class="v-corps"><div class="v-qr"><img src="${qrSrc}" alt="QR"><span>Vérification</span></div><div class="v-grille">${cellulesMois}</div></div>
    <div class="v-pied">En cas de perte, prière de la remettre à l'Université Méthodiste de Lubumbashi</div>
  </div>
<script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 500); });<\/script>
</body></html>`;

  const w = window.open('', '_blank', 'width=760,height=560');
  if (!w) { afficherToast('⚠️ Autorisez les pop-ups pour imprimer la carte.', 'erreur'); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

document.addEventListener('DOMContentLoaded', () => {
  const champPass = document.getElementById('caisse-pass');
  if (champPass) champPass.addEventListener('keypress', e => { if (e.key === 'Enter') connexionCaisse(); });

  if (document.getElementById('caisse-etudiants-body')) {
    if (!exigerConnexionCaisse()) return;
    const agent = getAgentCaisse();
    if (agent) {
      const nomComplet = `${agent.prenom || ''} ${agent.noms || ''}`.trim();
      const fct = libelleFonctionAgent(agent);
      const initiales = `${(agent.prenom || '')[0] || ''}${(agent.noms || '')[0] || ''}`.toUpperCase() || 'AG';
      // Bloc profil bleu de la barre latérale (comme l'admin).
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      set('caisse-avatar-sidebar', initiales);
      set('caisse-nom-sidebar', nomComplet);
      set('caisse-fonction-sidebar', fct);
      // Menu burger (bonjour + fonction).
      set('caisse-menu-prenom', agent.prenom || nomComplet);
      set('caisse-menu-fonction', fct);
    }
    appliquerVisibiliteBudget();
    chargerAnneesCaisse();
    chargerStatsCaisse();
    chargerCommuniquesCaisse();
    chargerFacultesDB().then(() => {
      remplirSelectFacultes('caisse-filtre-faculte');
      remplirSelectFacultes('bareme-faculte');
      remplirSelectFacultes('liste-faculte');
      // Gérer les inscrits : filtre facultés + selects des deux modals.
      remplirSelectFacultes('filtre-inscrits-faculte');
      remplirSelectFacultes('inscrit-faculte');
      remplirSelectFacultes('reins-faculte');
    });

    // Fermer les panneaux (cloche, menu) au clic en dehors.
    document.addEventListener('click', e => {
      const notifWrap = document.querySelector('.dash-notif-wrap');
      if (notifWrap && !notifWrap.contains(e.target)) document.getElementById('caisse-notif-panneau')?.classList.remove('ouvert');
      const menuWrap = document.querySelector('.dash-menu-wrap');
      if (menuWrap && !menuWrap.contains(e.target)) document.getElementById('caisse-menu')?.classList.remove('ouvert');
    });
  }
});

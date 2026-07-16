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
// L'administrateur du budget consulte sans encaisser (lecture seule des versements).
function estLectureSeule() { return (getAgentCaisse() || {}).role === 'budget'; }
// À l'inverse, le barème est fixé par l'administrateur du budget (et l'admin) ;
// le caissier ne peut que le consulter.
function peutEditerBareme() { const r = (getAgentCaisse() || {}).role; return r === 'budget' || r === 'admin'; }
function nomCaissier() {
  const a = getAgentCaisse();
  return a ? `${a.prenom || ''} ${a.noms || ''}`.trim() : '—';
}
function libelleFonctionAgent(agent) {
  const map = { administrateur_budget: 'Administrateur du budget', caissier: 'Caissier(ère)' };
  return map[agent?.fonction] || agent?.fonction || '';
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
  if (id === 'caisse-bareme')   chargerBareme();
}

function formaterDateCaisse(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR');
}
function montant(n) { return Number(n || 0).toFixed(2); }

// =====================
// VUE D'ENSEMBLE
// =====================
async function chargerStatsCaisse() {
  try {
    const r = await fetchCaisse(`${BASE_URL}/api/caisse/stats`);
    const d = await r.json();
    document.getElementById('cpt-total').textContent = montant(d.total_encaisse);
    document.getElementById('cpt-versements').textContent = d.nb_versements;
    document.getElementById('cpt-payeurs').textContent = d.nb_payeurs;
    document.getElementById('cpt-restants').textContent = Math.max(0, (d.nb_etudiants || 0) - (d.nb_payeurs || 0));

    const tbAnnee = document.getElementById('caisse-par-annee');
    if (tbAnnee) tbAnnee.innerHTML = (d.par_annee || []).length
      ? d.par_annee.map(a => `<tr><td>${a.annee}</td><td>${a.nb}</td><td>${montant(a.total)}</td></tr>`).join('')
      : `<tr><td colspan="3" class="admin-vide">Aucun encaissement.</td></tr>`;

    const tbRec = document.getElementById('caisse-recents');
    if (tbRec) tbRec.innerHTML = (d.recents || []).length
      ? d.recents.map(p => `<tr>
          <td>${formaterDateCaisse(p.date_paiement)}</td>
          <td>${p.nom} ${p.postnom || ''} ${p.prenom}</td>
          <td>${p.niveau || '—'}</td>
          <td>${p.filiere || p.promotion || '—'}</td>
          <td>${p.rubrique || '—'}</td>
          <td>${p.reference || '—'}</td>
          <td>${montant(p.montant)}</td>
        </tr>`).join('')
      : `<tr><td colspan="7" class="admin-vide">Aucun versement récent.</td></tr>`;
  } catch { /* redirigé si 401 */ }
}

// =====================
// FRAIS & VERSEMENTS
// =====================
let etudiantsCaisse = [];
let etudiantCourantCaisse = null;

async function chargerAnneesCaisse() {
  try {
    const r = await fetch(`${BASE_URL}/api/annees`);
    if (!r.ok) return;
    const annees = await r.json();
    const courante = annees.find(a => a.est_courante)?.libelle;
    const opts = annees.map(a => `<option value="${a.libelle}">${a.libelle}</option>`).join('');
    // Filtre étudiants : « Toutes » + défaut année en cours.
    const selEtu = document.getElementById('caisse-filtre-annee');
    if (selEtu) { selEtu.innerHTML = '<option value="">Toutes les années</option>' + opts; if (courante) selEtu.value = courante; }
    // Barème : année en cours par défaut (sert de filtre d'affichage + année de saisie).
    const selBa = document.getElementById('bareme-annee');
    if (selBa) { selBa.innerHTML = opts; if (courante) selBa.value = courante; }
  } catch { /* silencieux */ }
}

// Remplit la liste des filières selon la faculté choisie (formulaire de saisie).
function filieresDeFaculte(nomFaculte) {
  const fac = (facultesDB || []).find(f => f.nom === nomFaculte);
  return (fac && fac.filieres ? fac.filieres : []).map(fl => (typeof fl === 'string' ? fl : fl.nom));
}
function majPromotionsBareme() {
  const facSel = document.getElementById('bareme-faculte');
  const promoSel = document.getElementById('bareme-promotion');
  if (!facSel || !promoSel) return;
  const filieres = filieresDeFaculte(facSel.value);
  // Option « Toutes les filières » : applique le même barème à toutes les filières de la faculté.
  const optToutes = filieres.length ? '<option value="__toutes__">— Toutes les filières —</option>' : '';
  promoSel.innerHTML = '<option value="">— Filière —</option>' + optToutes +
    filieres.map(fl => `<option value="${fl}">${fl}</option>`).join('');
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
    tbody.innerHTML = lignes.map((l, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${l.faculte}</td>
        <td>${l.promotion}</td>
        <td><span class="annee-badge">${l.niveau}</span></td>
        <td><strong>${montant(l.montant)} $</strong></td>
        ${editable ? `<td class="admin-actions-cell"><button class="btn-icone danger" onclick="supprimerBareme(${l.id})" aria-label="Supprimer">${icone('corbeille')}</button></td>` : ''}
      </tr>`).join('');
  } catch { tbody.innerHTML = `<tr><td colspan="6" class="admin-vide">⚠️ Erreur.</td></tr>`; }
}

async function enregistrerBareme() {
  if (!peutEditerBareme()) { afficherToast('⚠️ Seul l\'administrateur du budget peut modifier le barème.', 'erreur'); return; }
  const annee_academique = document.getElementById('bareme-annee')?.value;
  const faculte = document.getElementById('bareme-faculte')?.value;
  const promotion = document.getElementById('bareme-promotion')?.value;
  const niveau = document.getElementById('bareme-niveau')?.value;
  const montantVal = parseFloat(document.getElementById('bareme-montant')?.value);
  if (!annee_academique || !faculte || !promotion || !niveau) { afficherToast('⚠️ Choisissez année, faculté, filière et niveau.', 'erreur'); return; }
  if (isNaN(montantVal) || montantVal < 0) { afficherToast('⚠️ Entrez un montant valide.', 'erreur'); return; }

  // « Toutes les filières » : on applique le barème à chacune des filières de la faculté.
  const cibles = promotion === '__toutes__' ? filieresDeFaculte(faculte) : [promotion];
  if (!cibles.length) { afficherToast('⚠️ Aucune filière trouvée pour cette faculté.', 'erreur'); return; }

  try {
    let ok = 0, echecs = 0, dernierMsg = '';
    for (const fil of cibles) {
      const r = await fetchCaisse(`${BASE_URL}/api/frais-scolarite`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faculte, promotion: fil, niveau, annee_academique, montant: montantVal })
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
    tbody.innerHTML = etudiantsCaisse.map(e => `
      <tr>
        <td><code style="font-size:11px">${e.id}</code></td>
        <td><strong>${e.nom}</strong> ${e.postnom || ''} ${e.prenom}</td>
        <td>${e.faculte || '—'}</td>
        <td>${e.niveau ? `<span class="annee-badge">${e.niveau}</span>` : '—'}</td>
        <td>${e.annee_academique || '—'}</td>
        <td><strong style="color:var(--vert)">${montant(e.total_verse)} $</strong></td>
        <td>${e.solde === null ? '<span style="color:#999">Barème non défini</span>' : `<strong style="color:${e.solde > 0 ? 'var(--rouge,#c0392b)' : 'var(--vert)'}">${montant(e.solde)} $</strong>`}</td>
        <td class="admin-actions-cell">
          <button class="btn-icone" onclick="ouvrirModalPaiementsCaisse('${e.id}')" title="${libelle}">💵</button>
        </td>
      </tr>`).join('');
  } catch { tbody.innerHTML = `<tr><td colspan="8" class="admin-vide">⚠️ Erreur.</td></tr>`; }
}

// =====================
// MODAL VERSEMENTS
// =====================
async function ouvrirModalPaiementsCaisse(etudiantId) {
  etudiantCourantCaisse = etudiantsCaisse.find(e => e.id === etudiantId) || null;
  const nomEtudiant = etudiantCourantCaisse
    ? `${etudiantCourantCaisse.nom} ${etudiantCourantCaisse.prenom}` : etudiantId;
  document.getElementById('paiements-etudiant-id').value = etudiantId;
  document.getElementById('paiements-nom-etudiant').textContent = nomEtudiant;
  document.getElementById('paiement-montant').value = '';
  document.getElementById('paiement-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('paiement-reference').value = '';

  // Administrateur du budget : consultation seule → on masque tout le formulaire de saisie.
  const saisie = document.getElementById('paiement-saisie');
  if (saisie) saisie.style.display = estLectureSeule() ? 'none' : '';

  document.getElementById('modal-paiements')?.classList.add('active');
  await chargerPaiementsCaisse();
}

function fermerModalPaiements() { document.getElementById('modal-paiements')?.classList.remove('active'); }

async function chargerPaiementsCaisse() {
  const etudiantId = document.getElementById('paiements-etudiant-id').value;
  const tbody = document.getElementById('paiements-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="4" class="admin-vide">Chargement...</td></tr>`;
  try {
    const r = await fetchCaisse(`${BASE_URL}/api/paiements/etudiant/${etudiantId}`);
    const paiements = await r.json();
    const total = paiements.reduce((s, p) => s + Number(p.montant), 0);
    document.getElementById('paiements-total').textContent = `${total.toFixed(2)} $`;

    // Solde = barème (attaché à l'étudiant depuis GET /api/caisse/etudiants) −
    // total versé recalculé ici (à jour même juste après un ajout/suppression).
    const soldeEl = document.getElementById('paiements-solde');
    if (soldeEl) {
      const attendu = etudiantCourantCaisse?.montant_attendu;
      if (attendu == null) { soldeEl.textContent = 'Barème non défini'; soldeEl.style.fontSize = '13px'; }
      else {
        const solde = Math.max(0, Number(attendu) - total);
        soldeEl.textContent = `${solde.toFixed(2)} $`;
        soldeEl.style.fontSize = '22px';
        soldeEl.style.color = solde > 0 ? 'var(--rouge, #c0392b)' : 'var(--vert)';
      }
    }

    const lecture = estLectureSeule();
    tbody.innerHTML = paiements.length === 0
      ? `<tr><td colspan="6" class="admin-vide">Aucun versement enregistré.</td></tr>`
      : paiements.map(p => `<tr>
          <td>${formaterDateCaisse(p.date_paiement)}</td>
          <td>${Number(p.montant).toFixed(2)} $</td>
          <td>${p.rubrique || '—'}</td>
          <td>${p.reference || '—'}</td>
          <td>${p.mode_paiement || '—'}</td>
          <td class="admin-actions-cell">
            <button class="btn-icone" onclick='reimprimerRecu(${JSON.stringify(p)})' title="Réimprimer le reçu">🧾</button>
            ${lecture ? '' : `<button class="btn-icone danger" onclick="supprimerPaiementCaisse(${p.id})" aria-label="Supprimer">${icone('corbeille')}</button>`}
          </td>
        </tr>`).join('');
  } catch { tbody.innerHTML = `<tr><td colspan="6" class="admin-vide">⚠️ Erreur.</td></tr>`; }
}

async function ajouterPaiementCaisse() {
  if (estLectureSeule()) { afficherToast('⚠️ Consultation seule : encaissement réservé au caissier.', 'erreur'); return; }
  const etudiant_id = document.getElementById('paiements-etudiant-id').value;
  const montantVal = parseFloat(document.getElementById('paiement-montant').value);
  const date_paiement = document.getElementById('paiement-date').value;
  const mode_paiement = document.getElementById('paiement-mode').value;
  const rubrique = document.getElementById('paiement-rubrique').value;
  const reference = document.getElementById('paiement-reference').value.trim();
  const annee_academique = (etudiantCourantCaisse || {}).annee_academique || null;

  if (isNaN(montantVal) || montantVal <= 0) { afficherToast('⚠️ Entrez un montant valide.', 'erreur'); return; }
  if (!date_paiement) { afficherToast('⚠️ La date est obligatoire.', 'erreur'); return; }
  try {
    const r = await fetchCaisse(`${BASE_URL}/api/paiements`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ etudiant_id, montant: montantVal, date_paiement, mode_paiement, rubrique, reference, annee_academique })
    });
    const d = await r.json();
    if (!r.ok) { afficherToast('❌ ' + d.erreur, 'erreur'); return; }
    afficherToast('✅ Versement enregistré.');
    // Reçu imprimé automatiquement après encaissement.
    imprimerRecu({ id: d.id, montant: montantVal, date_paiement, rubrique, reference, mode_paiement }, etudiantCourantCaisse, nomCaissier());
    document.getElementById('paiement-montant').value = '';
    document.getElementById('paiement-reference').value = '';
    chargerPaiementsCaisse();
    chargerEtudiantsCaisse();
  } catch { afficherToast('⚠️ Serveur indisponible.', 'erreur'); }
}

async function supprimerPaiementCaisse(id) {
  if (!await confirmerAction('Supprimer ce versement ? Cette action est irréversible.', { titre: 'Supprimer le versement', texteConfirmer: 'Supprimer' })) return;
  try {
    await fetchCaisse(`${BASE_URL}/api/paiements/${id}`, { method: 'DELETE' });
    afficherToast('🗑️ Versement supprimé.');
    chargerPaiementsCaisse();
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
// REÇU DE PAIEMENT (impression)
// =====================
function imprimerRecu(p, etu, caissier) {
  if (!etu) { afficherToast('⚠️ Données étudiant indisponibles pour le reçu.', 'erreur'); return; }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nomComplet = `${etu.nom || ''} ${etu.postnom || ''} ${etu.prenom || ''}`.replace(/\s+/g, ' ').trim();
  const numero = 'REC-' + String(p.id || Date.now()).padStart(5, '0');
  const logoSrc = `${location.origin}/img/logo.png`;
  const ligne = (c, v) => `<tr><td class="c">${c}</td><td class="v">${esc(v || '—')}</td></tr>`;

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Reçu ${esc(numero)}</title>
<style>
  :root { --bleu:#1a3a6b; --jaune:#f0c020; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Segoe UI',Arial,sans-serif; background:#e9edf2; color:#1a1a1a; padding:24px; }
  .barre { text-align:center; margin-bottom:16px; }
  .barre button { font-size:14px; padding:9px 20px; border:none; border-radius:6px; background:var(--bleu); color:#fff; cursor:pointer; }
  .recu { width:420px; margin:0 auto; background:#fff; border:1px solid #ccc; border-radius:8px; overflow:hidden; }
  .r-tete { display:flex; align-items:center; gap:10px; padding:12px 16px; background:linear-gradient(120deg,var(--bleu),#24508f); color:#fff; }
  .r-tete img { width:38px; height:38px; object-fit:contain; background:#fff; border-radius:5px; padding:2px; }
  .r-tete .u { font-size:13px; font-weight:800; line-height:1.15; }
  .r-tete .u small { display:block; font-weight:600; font-size:9px; opacity:.85; }
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
      <img src="${logoSrc}" alt="" onerror="this.style.display='none'">
      <div class="u">UNIVERSITÉ MÉTHODISTE DE LUBUMBASHI<small>Scientia, Sanctitas et Veritas</small></div>
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
      <div class="b"><span class="l">Le/La caissier(e) — ${esc(caissier)}</span></div>
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
  } catch { zone.innerHTML = '<div class="dash-card"><p class="admin-vide">⚠️ Erreur.</p></div>'; }
}

function afficherRapport(d) {
  const zone = document.getElementById('rapport-resultat');
  const rub = (d.par_rubrique || []).map(r => `<tr><td>${r.rubrique}</td><td>${r.nb}</td><td>${montant(r.total)} $</td></tr>`).join('')
    || '<tr><td colspan="3" class="admin-vide">—</td></tr>';
  const lignes = (d.lignes || []).map(l => `<tr>
      <td>${formaterDateCaisse(l.date_paiement)}</td>
      <td>${l.nom} ${l.postnom || ''} ${l.prenom}</td>
      <td>${l.niveau || '—'}</td>
      <td>${l.filiere || l.promotion || '—'}</td>
      <td>${l.rubrique || '—'}</td>
      <td>${l.reference || '—'}</td>
      <td>${montant(l.montant)} $</td>
    </tr>`).join('') || '<tr><td colspan="7" class="admin-vide">Aucun versement sur cette période.</td></tr>';

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
      <table class="dash-table"><thead><tr><th>Date</th><th>Étudiant</th><th>Niveau</th><th>Filière</th><th>Rubrique</th><th>Référence</th><th>Montant</th></tr></thead><tbody>${lignes}</tbody></table>
    </div>`;
}

function imprimerRapport() {
  const d = dernierRapport;
  if (!d) { afficherToast('⚠️ Générez d\'abord un rapport.', 'erreur'); return; }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const logoSrc = `${location.origin}/img/logo.png`;
  const rub = (d.par_rubrique || []).map(r => `<tr><td>${esc(r.rubrique)}</td><td>${r.nb}</td><td class="n">${montant(r.total)} $</td></tr>`).join('');
  const lignes = (d.lignes || []).map(l => `<tr>
      <td>${formaterDateCaisse(l.date_paiement)}</td>
      <td>${esc(`${l.nom} ${l.postnom || ''} ${l.prenom}`)}</td>
      <td>${esc(l.niveau || '')}</td>
      <td>${esc(l.filiere || l.promotion || '')}</td>
      <td>${esc(l.rubrique || '')}</td>
      <td>${esc(l.reference || '')}</td>
      <td class="n">${montant(l.montant)} $</td>
    </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;color:#999">Aucun versement.</td></tr>';

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
  <div class="periode">Période : ${esc(d.periode)} · Édité le ${new Date().toLocaleDateString('fr-FR')} par ${esc(nomCaissier())}</div>
  <div class="totaux">
    <div><div class="v">${montant(d.total)} $</div><div class="l">Total encaissé</div></div>
    <div><div class="v">${d.nb}</div><div class="l">Versements</div></div>
  </div>
  <h2>Répartition par rubrique</h2>
  <table><thead><tr><th>Rubrique</th><th>Nombre</th><th class="n">Total</th></tr></thead><tbody>${rub || '<tr><td colspan="3" style="text-align:center;color:#999">—</td></tr>'}</tbody></table>
  <h2>Détail des versements</h2>
  <table><thead><tr><th>Date</th><th>Étudiant</th><th>Niveau</th><th>Filière</th><th>Rubrique</th><th>Référence</th><th class="n">Montant</th></tr></thead><tbody>${lignes}</tbody></table>
  <div class="signe"><span>Le/La caissier(e) — ${esc(nomCaissier())}</span></div>
<script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 400); });<\/script>
</body></html>`;

  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) { afficherToast('⚠️ Autorisez les pop-ups pour imprimer.', 'erreur'); return; }
  w.document.open(); w.document.write(html); w.document.close();
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
  const nouvelles = communiquesCaisse.filter(c => !vus.includes(c.id));
  const badge = document.getElementById('caisse-notif-badge');
  if (badge) { if (nouvelles.length) { badge.textContent = nouvelles.length > 99 ? '99+' : nouvelles.length; badge.style.display = ''; } else badge.style.display = 'none'; }
  const liste = document.getElementById('caisse-notif-liste');
  if (liste) {
    liste.innerHTML = communiquesCaisse.length === 0
      ? '<p class="notif-vide">Aucune information pour le moment.</p>'
      : communiquesCaisse.map(c => `
          <div class="notif-item">
            <span class="notif-item-icone">📣</span>
            <div><span class="notif-item-titre">${c.titre}</span><span class="notif-item-sous">${c.description || ''}</span></div>
          </div>`).join('');
  }
}

function basculerNotifsCaisse(event) {
  if (event) event.stopPropagation();
  const p = document.getElementById('caisse-notif-panneau');
  if (!p) return;
  document.getElementById('caisse-menu')?.classList.remove('ouvert');
  const ouvert = p.classList.toggle('ouvert');
  if (ouvert) {
    const cle = cleNotifsCaisse();
    if (cle) localStorage.setItem(cle, JSON.stringify(communiquesCaisse.map(c => c.id)));
    const badge = document.getElementById('caisse-notif-badge'); if (badge) badge.style.display = 'none';
  }
}

function basculerMenuCaisse(event) {
  if (event) event.stopPropagation();
  document.getElementById('caisse-notif-panneau')?.classList.remove('ouvert');
  document.getElementById('caisse-menu')?.classList.toggle('ouvert');
}

// =====================
// INITIALISATION
// =====================
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
    chargerAnneesCaisse();
    chargerStatsCaisse();
    chargerCommuniquesCaisse();
    chargerFacultesDB().then(() => {
      remplirSelectFacultes('caisse-filtre-faculte');
      remplirSelectFacultes('bareme-faculte');
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

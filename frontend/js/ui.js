// =====================
// UI PARTAGÉE — toasts et confirmation, remplace alert()/confirm() natifs
// Chargé sur toutes les pages, avant login.js/dashboard.js/admin.js
// =====================

// =====================
// FACULTÉS & FILIÈRES — chargées une seule fois depuis la base de données,
// jamais codées en dur, partagées par toutes les pages qui chargent ui.js.
// Toute zone qui affiche des facultés/filières doit passer par facultesDB
// (ou remplirSelectFacultes ci-dessous), pour ne jamais se désynchroniser
// des filières réellement en base (créées/renommées/fusionnées côté admin).
// =====================
let facultesDB = []; // [{id, nom, master_disponible, filieres:[...]}]

async function chargerFacultesDB() {
  try {
    // cache:'no-store' : la liste des filières doit TOUJOURS être fraîche, sinon
    // une nouvelle filière (ex. « Informatique de Gestion ») peut manquer dans
    // les menus tant que le navigateur ressert une réponse mise en cache.
    const r = await fetch(`${BASE_URL}/api/facultes`, { cache: 'no-store' });
    facultesDB = await r.json();
    // Ordonne les filières par cycle : licence d'abord, puis master, puis
    // doctorat — pour qu'une filière de licence (ex. « Informatique de Gestion »)
    // apparaisse TOUJOURS avec les licences, jamais parmi/​après les masters,
    // dans tous les menus qui listent la totalité des filières (horaire, programme…).
    (facultesDB || []).forEach(f => { if (Array.isArray(f.filieres)) f.filieres = trierFilieresParCycle(f.filieres); });
  } catch (err) { console.error('Impossible de charger les facultés :', err); }
  return facultesDB;
}

// Régénère les <option> d'un <select> de faculté à partir de facultesDB, en
// conservant ses N premières options (placeholder(s) fixes du select, ex.
// « — Choisir — » ou « Toutes les facultés ») telles quelles.
// options.garder : nombre d'options de tête à préserver (défaut 1).
// options.libelleCourt(nom) : libellé d'affichage alternatif (ex. abréviation
// pour un filtre étroit) — la VALEUR reste toujours le nom exact en base ;
// seul l'affichage est raccourci, et retombe sur le nom complet si absent.
function remplirSelectFacultes(selectId, options = {}) {
  const sel = document.getElementById(selectId);
  if (!sel || facultesDB.length === 0) return;
  const { garder = 1, libelleCourt = null } = options;
  const valeurActuelle = sel.value;
  const placeholders = [...sel.options].slice(0, garder).map(o => o.outerHTML).join('');
  sel.innerHTML = placeholders + facultesDB.map(f => {
    const libelle = (libelleCourt && libelleCourt(f.nom)) || f.nom;
    return `<option value="${f.nom}">${libelle}</option>`;
  }).join('');
  if ([...sel.options].some(o => o.value === valeurActuelle)) sel.value = valeurActuelle;
}

// Régénère un groupe de cases à cocher « une par faculté » (ex. ciblage
// multi-facultés d'un cours commun) à partir de facultesDB.
function remplirCheckboxesFacultes(conteneurId) {
  const conteneur = document.getElementById(conteneurId);
  if (!conteneur || facultesDB.length === 0) return;
  conteneur.innerHTML = facultesDB.map(f =>
    `<label class="faculte-checkbox-item"><input type="checkbox" value="${f.nom}"> ${f.nom}</label>`
  ).join('');
}

// =====================
// FILIÈRES selon FACULTÉ + NIVEAU (cycle) — logique partagée (barème, inscription,
// réinscription, pré-inscription) pour ne jamais proposer une filière hors sujet
// (ex. « Pré-U Design » ou « Pré-U Master 1 »).
// =====================
function filieresDeFaculteNom(nomFaculte) {
  const fac = (facultesDB || []).find(f => f.nom === nomFaculte);
  return (fac && fac.filieres ? fac.filieres : []).map(fl => (typeof fl === 'string' ? fl : fl.nom));
}
// Cycle d'un niveau (codes courts : Pré-U, L1..L3, M1/M2, D1/D2).
function cycleDuNiveau(niveau) {
  if (/^M/i.test(niveau)) return 'master';
  if (/^D/i.test(niveau)) return 'doctorat';
  return 'licence';
}
// Le nom d'une filière encode son cycle : « Master… »/« Master1… », « Doctorat… ».
function filiereEstMaster(nom)   { return /^master/i.test(String(nom || '')); }
function filiereEstDoctorat(nom) { return /^doctorat/i.test(String(nom || '')); }
// Rang d'affichage par cycle : licence (0) avant master (1) avant doctorat (2).
function cycleRangFiliere(nom) {
  if (filiereEstDoctorat(nom)) return 2;
  if (filiereEstMaster(nom))   return 1;
  return 0;
}
// Trie une liste de filières par cycle (licence → master → doctorat), en
// conservant l'ordre d'origine à l'intérieur d'un même cycle (tri stable).
function trierFilieresParCycle(filieres) {
  return [...filieres].sort((a, b) =>
    cycleRangFiliere(typeof a === 'string' ? a : a.nom) - cycleRangFiliere(typeof b === 'string' ? b : b.nom)
  );
}
// Filières d'une faculté correspondant au CYCLE du niveau choisi.
function filieresDuCycle(nomFaculte, niveau) {
  const toutes = filieresDeFaculteNom(nomFaculte);
  const cyc = cycleDuNiveau(niveau);
  if (cyc === 'master')   return toutes.filter(filiereEstMaster);
  if (cyc === 'doctorat') return toutes.filter(filiereEstDoctorat);
  return toutes.filter(n => !filiereEstMaster(n) && !filiereEstDoctorat(n)); // licence
}
// Nom générique quand aucune filière ne s'applique : Pré-U → « Sciences » ; sinon
// le nom de la faculté sans le préfixe « Faculté de/d' » (ex. « Théologie »).
function nomFiliereGenerique(nomFaculte, niveau) {
  if (/^Pr[ée]-?U/i.test(niveau || '')) return 'Sciences';
  return String(nomFaculte || '').replace(/^Facult[ée]\s+(de\s+|d['’]\s*)?/i, '').trim() || nomFaculte || '';
}
// Options de filière à proposer pour (faculté, niveau) :
//  - Pré-U : aucune subdivision → une seule option générique (« Sciences »).
//  - Niveau avec filières du cycle → ces filières.
//  - Sinon (ex. Théologie licence, ou cycle sans filière propre) → option générique.
function optionsFiliereFacNiveau(nomFaculte, niveau) {
  if (!nomFaculte || !niveau) return [];
  if (/^Pr[ée]-?U/i.test(niveau)) return [nomFiliereGenerique(nomFaculte, niveau)];
  const cibles = filieresDuCycle(nomFaculte, niveau);
  return cibles.length ? cibles : [nomFiliereGenerique(nomFaculte, niveau)];
}

function afficherToast(message, type = 'succes') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = `toast${type === 'erreur' ? ' erreur' : ''}`;
  requestAnimationFrame(() => toast.classList.add('visible'));
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('visible'), 3500);
}

function confirmerAction(message, options = {}) {
  const { titre = 'Confirmation', texteConfirmer = 'Confirmer' } = options;

  return new Promise(resolve => {
    let overlay = document.getElementById('confirm-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'confirm-overlay';
      overlay.className = 'confirm-overlay';
      overlay.innerHTML = `
        <div class="confirm-box" role="alertdialog" aria-modal="true" aria-labelledby="confirm-titre">
          <h3 id="confirm-titre"></h3>
          <p class="confirm-message"></p>
          <div class="confirm-actions">
            <button type="button" class="btn-neutre" data-role="annuler">Annuler</button>
            <button type="button" class="btn-danger" data-role="confirmer"></button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
    }

    overlay.querySelector('#confirm-titre').textContent = titre;
    overlay.querySelector('.confirm-message').textContent = message;
    const btnConfirmer = overlay.querySelector('[data-role="confirmer"]');
    const btnAnnuler   = overlay.querySelector('[data-role="annuler"]');
    btnConfirmer.textContent = texteConfirmer;
    overlay.classList.add('active');

    const nettoyer = (resultat) => {
      overlay.classList.remove('active');
      btnConfirmer.removeEventListener('click', surConfirmer);
      btnAnnuler.removeEventListener('click', surAnnuler);
      overlay.removeEventListener('click', surClicExterieur);
      document.removeEventListener('keydown', surEchap);
      resolve(resultat);
    };
    const surConfirmer     = () => nettoyer(true);
    const surAnnuler       = () => nettoyer(false);
    const surClicExterieur = (e) => { if (e.target === overlay) nettoyer(false); };
    const surEchap         = (e) => { if (e.key === 'Escape') nettoyer(false); };

    btnConfirmer.addEventListener('click', surConfirmer);
    btnAnnuler.addEventListener('click', surAnnuler);
    overlay.addEventListener('click', surClicExterieur);
    document.addEventListener('keydown', surEchap);
    btnConfirmer.focus();
  });
}

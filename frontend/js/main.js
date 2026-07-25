// main.js — UML : navigation mobile + galerie lightbox
console.log('Site UML chargé');

// =====================
// MENU MOBILE
// =====================
function basculerMenuMobile() {
  document.querySelector('.nav-links')?.classList.toggle('open');
  document.querySelector('.nav-toggle')?.classList.toggle('open');
}

// =====================
// GALERIE — LIGHTBOX
// =====================
let photosGalerie = [];
let indexPhotoActuelle = 0;

function initialiserLightbox() {
  const cartes = document.querySelectorAll('.galerie-card');
  if (!cartes.length) return;

  photosGalerie = Array.from(cartes).map(carte => ({
    src: carte.querySelector('img')?.src || '',
    alt: carte.querySelector('img')?.alt || '',
    legende: carte.querySelector('.galerie-overlay p')?.textContent || ''
  }));

  cartes.forEach((carte, i) => {
    carte.style.cursor = 'pointer';
    carte.setAttribute('tabindex', '0');
    carte.setAttribute('role', 'button');
    carte.setAttribute('aria-label', 'Agrandir la photo : ' + (photosGalerie[i].legende || 'photo'));
    // Rappelée après l'ajout des photos d'événements : ne pas réattacher un
    // second écouteur sur les cartes déjà initialisées (double-ouverture du
    // lightbox au clic sinon). L'index i reste valable pour elles : la
    // galerie ne fait qu'ajouter des cartes à la fin, jamais en réordonner.
    if (carte.dataset.lightboxPret) return;
    carte.dataset.lightboxPret = '1';
    carte.addEventListener('click', () => ouvrirLightbox(i));
    carte.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ouvrirLightbox(i); }
    });
  });
}

function ouvrirLightbox(index) {
  indexPhotoActuelle = index;
  afficherPhotoActuelle();
  document.getElementById('lightbox')?.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function fermerLightbox() {
  document.getElementById('lightbox')?.classList.remove('active');
  document.body.style.overflow = '';
}

function changerPhoto(delta) {
  if (!photosGalerie.length) return;
  indexPhotoActuelle = (indexPhotoActuelle + delta + photosGalerie.length) % photosGalerie.length;
  afficherPhotoActuelle();
}

function afficherPhotoActuelle() {
  const photo = photosGalerie[indexPhotoActuelle];
  if (!photo) return;
  const img = document.getElementById('lb-img');
  const legende = document.getElementById('lb-legende');
  if (img) { img.src = photo.src; img.alt = photo.alt; }
  if (legende) legende.textContent = photo.legende;
}

// =====================
// ANNONCES & ÉVÉNEMENTS (ticker + calendrier public)
// =====================
const MOIS_COURT = ['JAN','FÉV','MAR','AVR','MAI','JUIN','JUIL','AOÛT','SEP','OCT','NOV','DÉC'];

// Une image téléversée depuis l'admin ("uploads/xxx") est servie par le
// BACKEND (Render), pas par le site statique (Vercel) : il faut préfixer
// BASE_URL, sinon le navigateur cherche le fichier sur le mauvais domaine.
function urlImageAnnonce(image) {
  if (!image) return 'img/campagne.jpg';
  return image.startsWith('uploads/') ? `${BASE_URL}/${image}` : `img/${image}`;
}

async function chargerAnnoncesPubliques() {
  const ticker = document.getElementById('ticker-contenu');
  const grille = document.getElementById('evenements-grid');
  if (!ticker && !grille) return;

  try {
    const r = await fetch(`${BASE_URL}/api/annonces?actif=true`);
    if (!r.ok) throw new Error();
    // Les communiqués sont internes (comptes étudiants/enseignants) : on les
    // exclut du site public (bandeau d'actualités + galerie d'événements).
    const annonces = (await r.json()).filter(a => a.type !== 'communique');

    if (ticker) {
      if (annonces.length === 0) {
        ticker.innerHTML = '<span class="ticker-item">Aucune actualité pour le moment.</span>';
      } else {
        const items = annonces.map(a => `<span class="ticker-item">${a.icone || '📢'} ${a.titre}</span>`).join('');
        ticker.innerHTML = items + items; // dupliqué pour l'effet de défilement continu
      }
    }

    if (grille) {
      const evenements = annonces.filter(a => a.type === 'evenement');
      grille.innerHTML = evenements.length === 0
        ? '<p style="text-align:center;color:#888;grid-column:1/-1">Aucun événement programmé pour le moment.</p>'
        : evenements.map(e => {
            const d = new Date(e.date_annonce);
            const mois = MOIS_COURT[d.getUTCMonth()];
            const jour = String(d.getUTCDate()).padStart(2, '0');
            const image = urlImageAnnonce(e.image);
            return `<div class="event-card">
              <div class="event-img" style="background-image: url('${image}')">
                <div class="event-date">
                  <span class="event-mois">${mois}</span>
                  <span class="event-jour">${jour}</span>
                </div>
              </div>
              <div class="event-body">
                <h4>${e.titre}</h4>
                <p>${e.description}</p>
                ${e.cible_faculte ? `<div class="event-tags"><span class="tag bleu">${e.cible_faculte}</span></div>` : ''}
              </div>
            </div>`;
          }).join('');
    }
  } catch {
    if (ticker) ticker.innerHTML = '<span class="ticker-item">⚠️ Impossible de charger les actualités.</span>';
    if (grille) grille.innerHTML = '<p style="text-align:center;color:#888;grid-column:1/-1">⚠️ Impossible de charger les événements.</p>';
  }
}

// =====================
// FORMULAIRE DE CONTACT
// =====================
async function envoyerMessageContact() {
  const nom     = document.getElementById('contact-nom')?.value.trim();
  const email   = document.getElementById('contact-email')?.value.trim();
  const sujet   = document.getElementById('contact-sujet')?.value.trim();
  const message = document.getElementById('contact-message')?.value.trim();
  const statut  = document.getElementById('contact-statut');
  if (!statut) return;

  if (!nom || !email || !message) {
    statut.style.display = 'block';
    statut.style.background = '#fde8e8'; statut.style.color = '#A32D2D';
    statut.textContent = '⚠️ Nom, email et message sont obligatoires.';
    return;
  }

  try {
    const r = await fetch(`${BASE_URL}/api/contact`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom, email, sujet, message })
    });
    const d = await r.json();
    statut.style.display = 'block';
    if (!r.ok) {
      statut.style.background = '#fde8e8'; statut.style.color = '#A32D2D';
      statut.textContent = '⚠️ ' + d.erreur;
      return;
    }
    statut.style.background = '#e6f4ea'; statut.style.color = '#2d7a2d';
    statut.textContent = '✅ ' + d.message;
    ['contact-nom', 'contact-email', 'contact-sujet', 'contact-message'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  } catch {
    statut.style.display = 'block';
    statut.style.background = '#fde8e8'; statut.style.color = '#A32D2D';
    statut.textContent = '⚠️ Serveur indisponible, réessayez plus tard.';
  }
}

// =====================
// NEWSLETTER
// =====================
async function inscrireNewsletter() {
  const champ  = document.getElementById('newsletter-email');
  const statut = document.getElementById('newsletter-statut');
  const email  = champ?.value.trim();
  if (!statut) return;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    statut.style.display = 'block'; statut.style.color = '#ffb4b4';
    statut.textContent = '⚠️ Adresse email invalide.';
    return;
  }

  try {
    const r = await fetch(`${BASE_URL}/api/newsletter`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const d = await r.json();
    statut.style.display = 'block';
    if (!r.ok) { statut.style.color = '#ffb4b4'; statut.textContent = '⚠️ ' + d.erreur; return; }
    statut.style.color = '#8fd99f';
    statut.textContent = '✅ Inscription confirmée !';
    if (champ) champ.value = '';
  } catch {
    statut.style.display = 'block'; statut.style.color = '#ffb4b4';
    statut.textContent = '⚠️ Serveur indisponible.';
  }
}

// =====================
// FACULTÉS (page d'accueil) — cartes cliquables, icônes professionnelles
// =====================
const ICO_FAC = {
  book:     '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  bookOpen: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  monitor:  '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
  code:     '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  chip:     '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/>',
  chart:    '<path d="M3 3v18h18"/><path d="M7 14l3-3 3 3 5-6"/>',
  bars:     '<line x1="6" y1="20" x2="6" y2="14"/><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/>',
  cap:      '<path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1 3 3 6 3s6-2 6-3v-5"/>',
  bulb:     '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',
  pen:      '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  award:    '<circle cx="12" cy="8" r="6"/><path d="M15.5 13.5 17 22l-5-3-5 3 1.5-8.5"/>',
  building: '<line x1="3" y1="21" x2="21" y2="21"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6"/>',
};
const svgFac = (p, s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const escFacPub = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function accentFaculte(nom) {
  const n = (nom || '').toLowerCase();
  if (/th[eé]olog/.test(n)) return '#1a3a6b';
  if (/informati|num[eé]rique/.test(n)) return '#2d7a2d';
  if (/[eé]conomi|gestion/.test(n)) return '#9a7000';
  if (/[eé]ducation|psycholog/.test(n)) return '#c0392b';
  return '#1a3a6b';
}
function iconeFaculte(nom) {
  const n = (nom || '').toLowerCase();
  if (/th[eé]olog/.test(n)) return ICO_FAC.bookOpen;
  if (/informati|num[eé]rique/.test(n)) return ICO_FAC.monitor;
  if (/[eé]conomi|gestion/.test(n)) return ICO_FAC.chart;
  if (/[eé]ducation|psycholog/.test(n)) return ICO_FAC.cap;
  return ICO_FAC.building;
}
function iconeFiliere(nom) {
  const n = (nom || '').toLowerCase();
  if (/^master/.test(n)) return ICO_FAC.cap;
  if (/intelligence|\bia\b/.test(n)) return ICO_FAC.chip;
  if (/design/.test(n)) return ICO_FAC.pen;
  if (/logiciel|syst[eè]me|r[eé]seau|t[eé]l[eé]com|s[eé]curit|informati/.test(n)) return ICO_FAC.code;
  if (/gestion|[eé]conomi|comptab|finance/.test(n)) return ICO_FAC.bars;
  if (/psycholog/.test(n)) return ICO_FAC.bulb;
  if (/[eé]ducation/.test(n)) return ICO_FAC.cap;
  if (/th[eé]olog|ex[eé]g|mission|[eé]glise|religion|pastoral|testament|bibl/.test(n)) return ICO_FAC.book;
  return ICO_FAC.award;
}

async function chargerFacultesPubliques() {
  const grid = document.getElementById('facultes-grid');
  if (!grid || typeof chargerFacultesDB !== 'function') return;
  await chargerFacultesDB();
  const facs = facultesDB || [];
  if (!facs.length) { grid.innerHTML = '<p class="admin-vide" style="grid-column:1/-1;text-align:center;color:#999">Aucune faculté pour le moment.</p>'; return; }
  grid.innerHTML = facs.map(f => {
    const accent = accentFaculte(f.nom);
    const filieres = (f.filieres || []).map(x => (typeof x === 'string' ? x : x.nom));
    const aMaster = filieres.some(filiereEstMaster);
    const lis = filieres.map(fl =>
      `<li><span class="fac-fil-ico" style="color:${accent}">${svgFac(iconeFiliere(fl), 16)}</span>${escFacPub(fl)}</li>`
    ).join('');
    return `
      <div class="faculte-card">
        <button type="button" class="fac-entete" aria-expanded="false" onclick="basculerFaculte(this)">
          <span class="fac-icone" style="color:${accent};background:${accent}1f">${svgFac(iconeFaculte(f.nom), 24)}</span>
          <span class="fac-titre">${escFacPub(f.nom)}</span>
          <span class="fac-meta">${filieres.length} filière${filieres.length > 1 ? 's' : ''}</span>
          <span class="fac-chevron">${svgFac('<polyline points="6 9 12 15 18 9"/>', 18)}</span>
        </button>
        <div class="fac-corps">
          <ul class="fac-filieres">${lis || '<li style="color:#999">Aucune filière renseignée</li>'}</ul>
          ${aMaster ? '<div class="master-badge">Master disponible</div>' : ''}
        </div>
      </div>`;
  }).join('');
}

function basculerFaculte(btn) {
  const carte = btn.closest('.faculte-card');
  if (!carte) return;
  const ouvert = carte.classList.toggle('ouvert');
  btn.setAttribute('aria-expanded', ouvert ? 'true' : 'false');
}

document.addEventListener('DOMContentLoaded', () => {
  initialiserLightbox();
  chargerAnnoncesPubliques();
  chargerFacultesPubliques();

  const lightbox = document.getElementById('lightbox');
  lightbox?.addEventListener('click', e => { if (e.target === lightbox) fermerLightbox(); });

  document.addEventListener('keydown', e => {
    if (!lightbox?.classList.contains('active')) return;
    if (e.key === 'Escape')    fermerLightbox();
    if (e.key === 'ArrowLeft')  changerPhoto(-1);
    if (e.key === 'ArrowRight') changerPhoto(1);
  });

  // Fermer le menu mobile après un clic sur un lien
  document.querySelectorAll('.nav-links a').forEach(lien => {
    lien.addEventListener('click', () => document.querySelector('.nav-links')?.classList.remove('open'));
  });
});

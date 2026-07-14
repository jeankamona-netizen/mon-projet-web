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
// FACULTÉS — vitrine de la page d'accueil, chargée depuis la base (jamais
// codée en dur) pour ne jamais afficher une filière renommée/supprimée.
// =====================
const STYLE_FACULTE = {
  'Faculté de Théologie':                    'theologie',
  'Sciences Informatiques':                  'informatique',
  'Sciences Économiques':                    'economie',
  "Sciences de l'Éducation & Psychologie":  'education',
};

async function chargerFacultesAccueil() {
  const grille = document.getElementById('facultes-grid');
  if (!grille) return;
  try {
    await chargerFacultesDB();
    if (facultesDB.length === 0) { grille.innerHTML = '<p style="text-align:center;color:#888;grid-column:1/-1">Aucune faculté enregistrée.</p>'; return; }
    const NB_COLONNES = 3;
    grille.innerHTML = facultesDB.map((f, i) => {
      const style = STYLE_FACULTE[f.nom] || 'theologie';
      // Sépare visuellement Licence/Pré-U (filières sans préfixe) et Master
      // (préfixées "Master ") quand la faculté propose les deux cycles.
      const licence = (f.filieres || []).filter(nom => !nom.startsWith('Master '));
      const master  = (f.filieres || []).filter(nom => nom.startsWith('Master '));
      const filieres = (f.filieres && f.filieres.length > 0)
        ? licence.map(nom => `<li>✓ ${nom}</li>`).join('')
          + (licence.length > 0 && master.length > 0 ? '<li class="filiere-separateur" aria-hidden="true"></li>' : '')
          + master.map(nom => `<li>✓ ${nom}</li>`).join('')
        : '<li>✓ Programme non subdivisé en filières</li>';
      const badge = f.master_disponible
        ? '<div class="master-badge">Master disponible</div>'
        : '<div class="master-badge">En progression</div>';
      // Une faculté au-delà de la première rangée ne redescend pas en colonne
      // 1 : elle continue de s'empiler sous la colonne centrale (ex. la 4e
      // faculté se place sous la 2e carte, au centre).
      const colonneCentrale = Math.ceil(NB_COLONNES / 2);
      const placement = i >= NB_COLONNES ? ` style="grid-column:${colonneCentrale};grid-row:${i - NB_COLONNES + 2}"` : '';
      return `
        <div class="faculte-card"${placement}>
          <div class="faculte-header ${style}"><h3>${f.nom}</h3></div>
          <ul class="filieres">${filieres}</ul>
          ${badge}
        </div>`;
    }).join('');
  } catch {
    grille.innerHTML = '<p style="text-align:center;color:#888;grid-column:1/-1">⚠️ Impossible de charger les facultés.</p>';
  }
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

// Ajoute une carte galerie (avec lightbox) par événement ayant une vraie
// photo téléversée — fusionne "Vie universitaire" et événements au même
// endroit, pour que "Tous les événements" fasse défiler les deux ensemble.
function ajouterPhotosEvenementsALaGalerie(evenementsAvecImage) {
  const grille = document.querySelector('.galerie-grid');
  if (!grille || evenementsAvecImage.length === 0) return;

  const cartesExistantes = new Set(Array.from(grille.querySelectorAll('.galerie-card[data-evenement-id]')).map(c => c.dataset.evenementId));
  const nouvelles = evenementsAvecImage.filter(e => !cartesExistantes.has(String(e.id)));
  if (nouvelles.length === 0) return;

  grille.insertAdjacentHTML('beforeend', nouvelles.map(e => `
    <div class="galerie-card" data-evenement-id="${e.id}">
      <img src="${urlImageAnnonce(e.image)}" alt="${e.titre}" loading="lazy">
      <div class="galerie-overlay">
        <span class="galerie-tag">Événement</span>
        <p>${e.titre}</p>
      </div>
    </div>`).join(''));

  initialiserLightbox();
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

    // Fusionne les photos d'événements (qui ont une vraie image téléversée)
    // dans la galerie "Vie universitaire", pour que le bouton "Tous les
    // événements" fasse défiler événements ET vie UML au même endroit.
    ajouterPhotosEvenementsALaGalerie(annonces.filter(a => a.type === 'evenement' && a.image));
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

document.addEventListener('DOMContentLoaded', () => {
  initialiserLightbox();
  chargerAnnoncesPubliques();
  chargerFacultesAccueil();

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

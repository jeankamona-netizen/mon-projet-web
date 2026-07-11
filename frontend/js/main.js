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

async function chargerAnnoncesPubliques() {
  const ticker = document.getElementById('ticker-contenu');
  const grille = document.getElementById('evenements-grid');
  if (!ticker && !grille) return;

  try {
    const r = await fetch(`${BASE_URL}/api/annonces?actif=true`);
    if (!r.ok) throw new Error();
    const annonces = await r.json();

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
            // Image téléversée depuis le disque → chemin "uploads/xxx" servi tel quel ;
            // ancien format (nom de fichier seul dans img/) conservé pour compatibilité.
            const image = e.image ? (e.image.startsWith('uploads/') ? e.image : `img/${e.image}`) : 'img/campagne.jpg';
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

document.addEventListener('DOMContentLoaded', () => {
  initialiserLightbox();
  chargerAnnoncesPubliques();

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

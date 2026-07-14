// =====================
// CONFIGURATION GLOBALE — modifiez ici pour la production
// =====================
const BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000'
  : 'https://uml-backend-x24k.onrender.com';

// PWA : coquille statique installable, jamais l'API (voir sw.js). Pas de
// service worker en local, pour ne jamais interférer avec le dev en cours.
if ('serviceWorker' in navigator && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* silencieux : l'app reste utilisable sans PWA */ });
  });
}


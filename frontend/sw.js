// Service worker UML — installabilité PWA + résilience hors-ligne minimale.
//
// Ne met JAMAIS en cache l'API (notes, horaires, paiements...) : l'app doit
// toujours refléter les données réelles du serveur, jamais une copie
// périmée. Seule la coquille statique (HTML/CSS/JS/images du même
// domaine) est concernée, en stratégie "réseau d'abord, cache en secours"
// pour ne jamais servir une version obsolète tant qu'il y a du réseau —
// voir vercel.json (Cache-Control no-cache) pour la même logique côté HTTP.

const CACHE = 'uml-shell-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((noms) =>
      Promise.all(noms.filter((n) => n !== CACHE).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Jamais d'interception pour l'API (autre domaine, données toujours fraîches)
  // ni pour les méthodes non-GET (POST/PUT/DELETE ne doivent jamais être servies via le cache).
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(req)
      .then((reponse) => {
        const copie = reponse.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copie));
        return reponse;
      })
      .catch(() => caches.match(req))
  );
});

// ===== SLIDER =====
const slides = document.querySelectorAll('.slide');
const dotsContainer = document.getElementById('dots');
let courant = 0;
let intervalle;

// Créer les points de navigation
slides.forEach((_, i) => {
  const dot = document.createElement('div');
  dot.classList.add('dot');
  if (i === 0) dot.classList.add('active');
  dot.addEventListener('click', () => allerA(i));
  dotsContainer.appendChild(dot);
});

function allerA(index) {
  slides[courant].classList.remove('active');
  document.querySelectorAll('.dot')[courant].classList.remove('active');
  courant = (index + slides.length) % slides.length;
  slides[courant].classList.add('active');
  document.querySelectorAll('.dot')[courant].classList.add('active');
}

function changerSlide(direction) {
  allerA(courant + direction);
  resetIntervalle();
}

function resetIntervalle() {
  clearInterval(intervalle);
  intervalle = setInterval(() => allerA(courant + 1), 5000);
}

// Démarrage automatique toutes les 5 secondes
intervalle = setInterval(() => allerA(courant + 1), 5000);
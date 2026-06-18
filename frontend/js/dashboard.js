// ===== NAVIGATION SECTIONS =====
function afficherSection(id, lien) {
  document.querySelectorAll('.dash-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  lien.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== FILTRE NOTES PAR SESSION =====
function filtrerSession(session, btn) {
  document.querySelectorAll('.filtre-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('#notes-body tr').forEach(row => {
    row.style.display = row.dataset.session === session ? '' : 'none';
  });
}

// Afficher S1 par défaut
document.addEventListener('DOMContentLoaded', () => {
  filtrerSession('S1', document.querySelector('.filtre-btn'));
});
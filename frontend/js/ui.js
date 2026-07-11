// =====================
// UI PARTAGÉE — toasts et confirmation, remplace alert()/confirm() natifs
// Chargé sur toutes les pages, avant login.js/dashboard.js/admin.js
// =====================

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

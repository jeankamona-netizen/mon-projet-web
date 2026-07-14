require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// En local FRONTEND_URL n'est pas toujours défini : on retombe sur le
// serveur de développement plutôt que de casser le lien dans l'email.
const URL_CONNEXION = `${process.env.FRONTEND_URL || 'http://localhost:5500/frontend'}/login.html`;

async function envoyerEmailAcceptation(etudiant, numeroEtudiant, motDePasse) {
  const options = {
    from: `"UML — Université Méthodiste de Lubumbashi" <${process.env.EMAIL_USER}>`,
    to: etudiant.email,
    subject: '✅ Votre candidature a été acceptée — Identifiants de connexion',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#1a3a6b;padding:20px;text-align:center">
          <h2 style="color:#f0c020;margin:0">Université Méthodiste de Lubumbashi</h2>
          <p style="color:#ccd9f0;margin:4px 0;font-style:italic">Scientia, Sanctitas et Veritas</p>
        </div>
        <div style="padding:28px 24px;background:#f8f9fa">
          <h3 style="color:#1a3a6b">Félicitations, ${etudiant.prenom} ${etudiant.nom} !</h3>
          <p>Votre candidature à l'<strong>Université Méthodiste de Lubumbashi</strong> 
             a été <strong style="color:#2d7a2d">acceptée</strong>.</p>
          <p>Voici vos identifiants de connexion à l'espace étudiant :</p>

          <div style="background:#ffffff;border:1px solid #ddd;border-radius:8px;padding:16px;margin:20px 0">
            <p style="margin:6px 0"><strong>Numéro étudiant :</strong> 
               <code style="background:#eef;padding:2px 8px;border-radius:4px">${numeroEtudiant}</code></p>
            <p style="margin:6px 0"><strong>Mot de passe temporaire :</strong> 
               <code style="background:#eef;padding:2px 8px;border-radius:4px">${motDePasse}</code></p>
          </div>

          <p style="color:#cc2200;font-size:13px">
            ⚠️ Veuillez changer votre mot de passe dès votre première connexion.
          </p>

          <a href="${URL_CONNEXION}"
             style="display:inline-block;background:#1a3a6b;color:#fff;
                    padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:10px">
            Se connecter à l'espace étudiant
          </a>

          <p style="margin-top:24px;font-size:12px;color:#888">
            Adresse : N°249, Croisement Av. Kasavubu & Likasi, Lubumbashi, RDC<br>
            Email : lmu.lubumbashi@gmail.com
          </p>
        </div>
      </div>
    `
  };

  await transporter.sendMail(options);
  console.log(`📧 Email envoyé à ${etudiant.email}`);
}

async function envoyerEmailReinitialisation(etudiant, motDePasse) {
  if (!etudiant.email) return;

  const options = {
    from: `"UML — Université Méthodiste de Lubumbashi" <${process.env.EMAIL_USER}>`,
    to: etudiant.email,
    subject: '🔑 Réinitialisation de votre mot de passe — UML',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#1a3a6b;padding:20px;text-align:center">
          <h2 style="color:#f0c020;margin:0">Université Méthodiste de Lubumbashi</h2>
        </div>
        <div style="padding:28px 24px;background:#f8f9fa">
          <h3 style="color:#1a3a6b">Bonjour, ${etudiant.prenom} ${etudiant.nom}</h3>
          <p>Le mot de passe de votre espace étudiant a été réinitialisé par l'administration.</p>

          <div style="background:#ffffff;border:1px solid #ddd;border-radius:8px;padding:16px;margin:20px 0">
            <p style="margin:6px 0"><strong>Numéro étudiant :</strong>
               <code style="background:#eef;padding:2px 8px;border-radius:4px">${etudiant.id}</code></p>
            <p style="margin:6px 0"><strong>Nouveau mot de passe temporaire :</strong>
               <code style="background:#eef;padding:2px 8px;border-radius:4px">${motDePasse}</code></p>
          </div>

          <p style="color:#cc2200;font-size:13px">
            ⚠️ Veuillez changer votre mot de passe dès votre prochaine connexion.
          </p>

          <a href="${URL_CONNEXION}"
             style="display:inline-block;background:#1a3a6b;color:#fff;
                    padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:10px">
            Se connecter à l'espace étudiant
          </a>

          <p style="margin-top:24px;font-size:12px;color:#888">
            Adresse : N°249, Croisement Av. Kasavubu & Likasi, Lubumbashi, RDC<br>
            Email : lmu.lubumbashi@gmail.com
          </p>
        </div>
      </div>
    `
  };

  await transporter.sendMail(options);
  console.log(`📧 Email de réinitialisation envoyé à ${etudiant.email}`);
}

async function envoyerEmailRejet(etudiant) {
  if (!etudiant.email) return;

  const options = {
    from: `"UML — Université Méthodiste de Lubumbashi" <${process.env.EMAIL_USER}>`,
    to: etudiant.email,
    subject: 'Résultat de votre candidature — UML',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#1a3a6b;padding:20px;text-align:center">
          <h2 style="color:#f0c020;margin:0">Université Méthodiste de Lubumbashi</h2>
        </div>
        <div style="padding:28px 24px;background:#f8f9fa">
          <h3 style="color:#1a3a6b">Bonjour, ${etudiant.prenom} ${etudiant.nom}</h3>
          <p>Après examen de votre dossier, nous avons le regret de vous informer 
             que votre candidature n'a pas été retenue pour cette année académique.</p>
          <p>Vous pouvez soumettre une nouvelle candidature lors de la prochaine 
             période d'inscription.</p>
          <p style="margin-top:24px;font-size:12px;color:#888">
            Pour plus d'informations, contactez l'administration :<br>
            lmu.lubumbashi@gmail.com — N°249, Av. Kasavubu & Likasi, Lubumbashi
          </p>
        </div>
      </div>
    `
  };

  await transporter.sendMail(options);
  console.log(`📧 Email de rejet envoyé à ${etudiant.email}`);
}

module.exports = { envoyerEmailAcceptation, envoyerEmailReinitialisation, envoyerEmailRejet };
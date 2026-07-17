require('dotenv').config();
const nodemailer = require('nodemailer');

const EXPEDITEUR_NOM   = 'UML — Université Méthodiste de Lubumbashi';
const EXPEDITEUR_EMAIL = process.env.EMAIL_USER || 'info.uml.lubumbashi@gmail.com';

// Sur l'hébergement (Render free), les ports SMTP sortants sont bloqués : la
// connexion Gmail expire (Connection timeout). On envoie donc via l'API HTTP
// de Brevo (port 443, jamais bloqué) dès que BREVO_API_KEY est défini. Le
// transport SMTP ci-dessous ne sert plus que de repli en développement local.
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,          // STARTTLS
  requireTLS: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
});

// Envoi unifié : Brevo (HTTPS) si une clé API est configurée, sinon SMTP local.
async function envoyer({ to, subject, html }) {
  if (!to) return;

  if (process.env.BREVO_API_KEY) {
    const reponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: EXPEDITEUR_NOM, email: EXPEDITEUR_EMAIL },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });
    if (!reponse.ok) {
      const detail = await reponse.text().catch(() => '');
      throw new Error(`Brevo ${reponse.status} : ${detail}`);
    }
    return;
  }

  // Repli développement local (SMTP direct).
  await transporter.sendMail({ from: `"${EXPEDITEUR_NOM}" <${EXPEDITEUR_EMAIL}>`, to, subject, html });
}

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
            Email : info.uml.lubumbashi@gmail.com
          </p>
        </div>
      </div>
    `
  };

  await envoyer(options);
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
            Email : info.uml.lubumbashi@gmail.com
          </p>
        </div>
      </div>
    `
  };

  await envoyer(options);
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
            info.uml.lubumbashi@gmail.com — N°249, Av. Kasavubu & Likasi, Lubumbashi
          </p>
        </div>
      </div>
    `
  };

  await envoyer(options);
  console.log(`📧 Email de rejet envoyé à ${etudiant.email}`);
}

// Le message d'origine (et son sujet) viennent du formulaire public de
// contact : texte libre non fiable, à échapper avant insertion dans le HTML
// de l'email de réponse.
const echapperHtml = (texte) => String(texte ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

async function envoyerEmailReponseContact(destinataire, nomDestinataire, sujetOriginal, messageOriginal, reponse) {
  const options = {
    from: `"UML — Université Méthodiste de Lubumbashi" <${process.env.EMAIL_USER}>`,
    to: destinataire,
    subject: sujetOriginal ? `Re: ${sujetOriginal}` : 'Réponse à votre message — UML',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#1a3a6b;padding:20px;text-align:center">
          <h2 style="color:#f0c020;margin:0">Université Méthodiste de Lubumbashi</h2>
        </div>
        <div style="padding:28px 24px;background:#f8f9fa">
          <h3 style="color:#1a3a6b">Bonjour, ${echapperHtml(nomDestinataire)}</h3>
          <p style="white-space:pre-wrap">${echapperHtml(reponse)}</p>

          <div style="background:#ffffff;border-left:3px solid #ddd;border-radius:4px;padding:14px 16px;margin:24px 0;color:#777;font-size:13px">
            <p style="margin:0 0 6px"><strong>Votre message initial :</strong></p>
            <p style="white-space:pre-wrap;margin:0">${echapperHtml(messageOriginal)}</p>
          </div>

          <p style="margin-top:24px;font-size:12px;color:#888">
            Adresse : N°249, Croisement Av. Kasavubu & Likasi, Lubumbashi, RDC<br>
            Email : info.uml.lubumbashi@gmail.com
          </p>
        </div>
      </div>
    `
  };

  await envoyer(options);
  console.log(`📧 Réponse envoyée à ${destinataire}`);
}

module.exports = { envoyerEmailAcceptation, envoyerEmailReinitialisation, envoyerEmailRejet, envoyerEmailReponseContact };
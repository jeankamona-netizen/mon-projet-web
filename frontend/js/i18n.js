// =====================
// i18n — site public uniquement (accueil, facultés, galerie, LMD, contact,
// footer). Les espaces connectés (admin/professeur/étudiant/caisse) restent
// en français pour l'instant.
// =====================
const TRADUCTIONS = {
  fr: {
    'nav.accueil': 'Accueil', 'nav.facultes': 'Facultés', 'nav.galerie': 'Galerie',
    'nav.lmd': 'LMD', 'nav.contact': 'Contact', 'nav.connexion': 'Connexion',

    'hero.devise': 'Intégrité, Efficacité &amp; Excellence Académique',
    'hero.systeme': 'Système LMD — Licence · Master · Doctorat',
    'hero.btn_preinscription': 'Faire une pré-inscription',
    'hero.btn_facultes': 'Nos facultés',

    'ticker.label': '📢 Actualités',

    'facultes.titre': 'Facultés organisées',
    'facultes.soustitre': '4 facultés avec plusieurs filières spécialisées',

    'evenements.titre': 'Calendrier des événements',
    'evenements.soustitre': "Restez informé des activités et dates importantes de l'UML",
    'evenements.btn_tous': '📅 Tous les événements',
    'evenements.btn_preinscription': '🎓 Faire une pré-inscription',

    'galerie.titre': 'Vie universitaire',
    'galerie.soustitre': "Découvrez l'UML à travers ses événements et activités",
    'galerie.tag1': 'Cérémonie', 'galerie.legende1': 'Collation des grades — promotion 2025',
    'galerie.tag2': 'Diplômés', 'galerie.legende2': 'Nos lauréats fiers et diplômés',
    'galerie.tag3': 'Remise', 'galerie.legende3': 'Remise officielle des diplômes',
    'galerie.tag4': 'Équipe', 'galerie.legende4': 'Notre corps académique dévoué',
    'galerie.tag5': 'Infrastructures', 'galerie.legende5': 'Salle informatique équipée',
    'galerie.tag6': 'Dispense de cours',
    'galerie.tag7': 'Acquisition', 'galerie.legende7': 'Modernisation des infrastructures informatiques',

    'lmd.titre': 'Système LMD',
    'lmd.soustitre': 'Licence · Master · Doctorat — reconnu internationalement',
    'lmd.licence_titre': 'Licence',
    'lmd.licence_texte': "3 ans après le diplôme d'État. Formation générale et spécialisée dans votre filière.",
    'lmd.licence_frais': '350$ — payable en tranches',
    'lmd.licence_inscription': 'Inscription : 20$ + Rame papiers',
    'lmd.master_titre': 'Master',
    'lmd.master_texte': '2 ans après la Licence. Approfondissement et spécialisation dans votre domaine.',
    'lmd.master_frais': '500$ — payable en tranches',
    'lmd.master_inscription': 'Inscription : 50$ + Rame papiers',
    'lmd.doctorat_titre': 'Doctorat',
    'lmd.doctorat_texte': 'Recherche avancée après le Master. Formation des enseignants et chercheurs.',
    'lmd.doctorat_frais': 'Théologie &amp; Informatique',
    'lmd.doctorat_inscription': "Contactez l'administration",

    'contact.titre': 'Nous contacter',
    'contact.soustitre': 'Une question ? Écrivez-nous, nous vous répondrons rapidement',
    'contact.infos_titre': 'Informations',
    'contact.adresse_label': 'Adresse',
    'contact.adresse_valeur': 'N°249, Croisement Av. Kasavubu &amp; Likasi<br>Lubumbashi, Katanga, RDC',
    'contact.telephone_label': 'Téléphone',
    'contact.email_label': 'Email',
    'contact.heures_label': "Heures d'ouverture",
    'contact.heures_valeur': 'Lundi - Vendredi : 7h00 - 17h00',
    'contact.arrete': 'Arrêté N° 0173/MINESU/2021',
    'contact.form_titre': 'Envoyez-nous un message',
    'contact.form_soustitre': 'Nous vous répondrons dans les plus brefs délais.',
    'contact.nom_label': 'Nom complet',
    'contact.email_form_label': 'Adresse email',
    'contact.sujet_label': 'Sujet',
    'contact.sujet_placeholder': 'Comment pouvons-nous vous aider ?',
    'contact.message_label': 'Message',
    'contact.message_placeholder': 'Votre message ici...',
    'contact.btn_envoyer': 'Envoyer le message',

    'footer.copyright': '© 2026 UML — Tous droits réservés',
    'footer.liens_rapides': 'Liens rapides',
    'footer.ressources': 'Ressources',
    'footer.pre_inscription': 'Pré-inscription en ligne',
    'footer.portail_connexion': 'Portail de connexion',
    'footer.facultes_filieres': 'Facultés &amp; filières',
    'footer.calendrier': 'Calendrier des événements',
    'footer.newsletter_titre': 'Newsletter',
    'footer.newsletter_texte': 'Recevez nos actualités et annonces importantes.',
    'footer.newsletter_placeholder': 'Votre adresse email...',
    'footer.newsletter_btn': "S'inscrire",
    'footer.espace_admin': 'Espace administration',
    'footer.espace_prof': 'Espace professeur',
    'footer.espace_caisse': 'Espace caisse',
  },
  en: {
    'nav.accueil': 'Home', 'nav.facultes': 'Faculties', 'nav.galerie': 'Gallery',
    'nav.lmd': 'BMD', 'nav.contact': 'Contact', 'nav.connexion': 'Login',

    'hero.devise': 'Integrity, Efficiency &amp; Academic Excellence',
    'hero.systeme': "BMD System — Bachelor's · Master's · Doctorate",
    'hero.btn_preinscription': 'Apply now',
    'hero.btn_facultes': 'Our faculties',

    'ticker.label': '📢 News',

    'facultes.titre': 'Our Faculties',
    'facultes.soustitre': '4 faculties with several specialized programs',

    'evenements.titre': 'Events Calendar',
    'evenements.soustitre': 'Stay informed about UML activities and important dates',
    'evenements.btn_tous': '📅 All events',
    'evenements.btn_preinscription': '🎓 Apply now',

    'galerie.titre': 'Campus Life',
    'galerie.soustitre': 'Discover UML through its events and activities',
    'galerie.tag1': 'Ceremony', 'galerie.legende1': 'Graduation ceremony — class of 2025',
    'galerie.tag2': 'Graduates', 'galerie.legende2': 'Our proud graduates',
    'galerie.tag3': 'Ceremony', 'galerie.legende3': 'Official diploma ceremony',
    'galerie.tag4': 'Faculty', 'galerie.legende4': 'Our dedicated academic staff',
    'galerie.tag5': 'Facilities', 'galerie.legende5': 'Equipped computer lab',
    'galerie.tag6': 'Lectures',
    'galerie.tag7': 'New equipment', 'galerie.legende7': 'Modernizing our IT infrastructure',

    'lmd.titre': 'BMD System',
    'lmd.soustitre': "Bachelor's · Master's · Doctorate — internationally recognized",
    'lmd.licence_titre': "Bachelor's",
    'lmd.licence_texte': "3 years after secondary school diploma. General and specialized training in your field.",
    'lmd.licence_frais': '$350 — payable in installments',
    'lmd.licence_inscription': 'Registration: $20 + supplies',
    'lmd.master_titre': "Master's",
    'lmd.master_texte': "2 years after the Bachelor's degree. In-depth specialization in your field.",
    'lmd.master_frais': '$500 — payable in installments',
    'lmd.master_inscription': 'Registration: $50 + supplies',
    'lmd.doctorat_titre': 'Doctorate',
    'lmd.doctorat_texte': "Advanced research after the Master's degree. Training for teachers and researchers.",
    'lmd.doctorat_frais': 'Theology &amp; Computer Science',
    'lmd.doctorat_inscription': 'Contact the administration',

    'contact.titre': 'Contact Us',
    'contact.soustitre': 'Have a question? Write to us, we will get back to you quickly',
    'contact.infos_titre': 'Information',
    'contact.adresse_label': 'Address',
    'contact.adresse_valeur': 'N°249, Corner of Av. Kasavubu &amp; Likasi<br>Lubumbashi, Katanga, DRC',
    'contact.telephone_label': 'Phone',
    'contact.email_label': 'Email',
    'contact.heures_label': 'Opening hours',
    'contact.heures_valeur': 'Monday - Friday: 7:00 AM - 5:00 PM',
    'contact.arrete': 'Decree N° 0173/MINESU/2021',
    'contact.form_titre': 'Send us a message',
    'contact.form_soustitre': 'We will respond as soon as possible.',
    'contact.nom_label': 'Full name',
    'contact.email_form_label': 'Email address',
    'contact.sujet_label': 'Subject',
    'contact.sujet_placeholder': 'How can we help you?',
    'contact.message_label': 'Message',
    'contact.message_placeholder': 'Your message here...',
    'contact.btn_envoyer': 'Send message',

    'footer.copyright': '© 2026 UML — All rights reserved',
    'footer.liens_rapides': 'Quick Links',
    'footer.ressources': 'Resources',
    'footer.pre_inscription': 'Apply online',
    'footer.portail_connexion': 'Login portal',
    'footer.facultes_filieres': 'Faculties &amp; programs',
    'footer.calendrier': 'Events calendar',
    'footer.newsletter_titre': 'Newsletter',
    'footer.newsletter_texte': 'Receive our news and important announcements.',
    'footer.newsletter_placeholder': 'Your email address...',
    'footer.newsletter_btn': 'Subscribe',
    'footer.espace_admin': 'Administration portal',
    'footer.espace_prof': 'Faculty portal',
    'footer.espace_caisse': 'Finance office portal',
  },
};

function appliquerLangue(langue) {
  const dict = TRADUCTIONS[langue] || TRADUCTIONS.fr;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const cle = el.getAttribute('data-i18n');
    if (dict[cle] !== undefined) el.innerHTML = dict[cle];
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const cle = el.getAttribute('data-i18n-placeholder');
    if (dict[cle] !== undefined) el.setAttribute('placeholder', dict[cle]);
  });
  document.documentElement.lang = langue;
  const badge = document.getElementById('lang-actuelle');
  if (badge) badge.textContent = langue.toUpperCase();
}

function definirLangue(langue) {
  localStorage.setItem('uml_langue', langue);
  appliquerLangue(langue);
  document.getElementById('lang-menu')?.classList.remove('ouvert');
}

function basculerMenuLangue(event) {
  event.stopPropagation();
  document.getElementById('lang-menu')?.classList.toggle('ouvert');
}

document.addEventListener('click', () => document.getElementById('lang-menu')?.classList.remove('ouvert'));

document.addEventListener('DOMContentLoaded', () => {
  appliquerLangue(localStorage.getItem('uml_langue') || 'fr');
});

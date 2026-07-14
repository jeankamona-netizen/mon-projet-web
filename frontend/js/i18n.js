// =====================
// i18n — site public uniquement (accueil, facultés, galerie, LMD, contact,
// footer). Les espaces connectés (admin/professeur/étudiant/caisse) restent
// en français pour l'instant.
// =====================
const TRADUCTIONS = {
  fr: {
    'nav.accueil': 'Accueil', 'nav.facultes': 'Facultés', 'nav.apropos': 'À propos', 'nav.galerie': 'Galerie',
    'nav.lmd': 'LMD', 'nav.contact': 'Contact', 'nav.connexion': 'Connexion',

    'hero.devise': 'Intégrité, Efficacité &amp; Excellence Académique',
    'hero.systeme': 'Système LMD — Licence · Master · Doctorat',
    'hero.btn_preinscription': 'Faire une pré-inscription',
    'hero.btn_facultes': 'Nos facultés',

    'ticker.label': '📢 Actualités',

    'facultes.titre': 'Facultés organisées',
    'facultes.soustitre': '4 facultés avec plusieurs filières spécialisées',

    'apropos.titre': 'À propos de l\'UML',
    'apropos.soustitre': 'Notre histoire, notre mission, nos valeurs et notre localisation',
    'apropos.histoire_titre': 'Notre histoire',
    'apropos.histoire_texte': 'L\'Université Méthodiste de Lubumbashi (UML) a été créée en 2019 par le Révérend Professeur Ordinaire Jean-Marie Nkonge, sous l\'égide de l\'Évêque Professeur Ordinaire Kasap O\'wan Tshibang, alors à la tête de l\'Église Méthodiste Unie de la région Sud-Congo – Zambie. Institution d\'enseignement supérieur d\'inspiration chrétienne méthodiste, implantée à Lubumbashi (Katanga, RDC), elle est organisée autour de quatre facultés et adopte pleinement le système LMD (Licence – Master – Doctorat).',
    'apropos.partenaires_titre': 'Nos partenaires',
    'apropos.partenaires_soustexte': 'Ils accompagnent l\'UML dans sa mission de formation et de service',
    'apropos.recteur_titre': 'Le mot du Recteur',
    'apropos.recteur_proverbe': '« Kumbuka kile kilikuleta » — Souviens-toi de ce qui t\'a amené ici.',
    'apropos.recteur_texte': 'Bienvenue à l\'Université Méthodiste de Lubumbashi. J\'aime rappeler à nos étudiants ce proverbe : reste conscient du but qui te conduit à l\'université, travaille avec conscience et persévérance, et n\'oublie jamais pourquoi tu es sur les bancs de l\'école. C\'est dans cet esprit d\'excellence, d\'intégrité et de foi que nous vous accompagnons vers la réussite.',
    'apropos.recteur_nom': 'Rév. Prof. Ordinaire Jean-Marie Nkonge',
    'apropos.recteur_fonction': 'Recteur de l\'Université Méthodiste de Lubumbashi',
    'apropos.mission_titre': 'Notre mission',
    'apropos.mission_texte': 'Former des cadres compétents, intègres et responsables, capables de contribuer au développement de la société congolaise et de l\'Afrique. L\'UML allie l\'excellence académique à une formation humaine et spirituelle, préparant ses étudiants à devenir des acteurs de changement au service du bien commun.',
    'apropos.localisation_titre': 'Notre localisation',
    'apropos.adresse_label': 'Adresse',
    'apropos.heures_label': 'Heures d\'ouverture',
    'apropos.itineraire': 'Voir l\'itinéraire sur Google Maps →',

    'valeurs.titre': 'Nos Valeurs Fondamentales',
    'valeurs.soustitre': 'Trois principes qui découlent de notre devise et guident toute la vie de l\'UML',
    'valeurs.integrite_titre': 'Intégrité',
    'valeurs.integrite_desc': 'Honnêteté intellectuelle et morale, enracinée dans les valeurs chrétiennes méthodistes qui fondent l\'université.',
    'valeurs.efficacite_titre': 'Efficacité',
    'valeurs.efficacite_desc': 'Rigueur, sérieux et sens du résultat, au service de la réussite et de l\'insertion de nos étudiants.',
    'valeurs.excellence_titre': 'Excellence Académique',
    'valeurs.excellence_desc': 'Recherche constante de la qualité dans l\'enseignement, la recherche et l\'encadrement des étudiants.',

    'evenements.titre': 'Calendrier des événements',
    'evenements.soustitre': "Restez informé des activités et dates importantes de l'UML",
    'evenements.statique_titre': 'Temps forts de l\'année académique',
    'evenements.s1_titre': 'Rentrée académique',
    'evenements.s1_desc': 'Accueil des nouveaux étudiants et ouverture solennelle de l\'année.',
    'evenements.s2_titre': 'Semaine scientifique',
    'evenements.s2_desc': 'Conférences, ateliers et présentation des travaux de recherche.',
    'evenements.s3_titre': 'Collation des grades',
    'evenements.s3_desc': 'Cérémonie solennelle de remise des diplômes aux lauréats.',
    'evenements.dynamique_titre': 'Prochains événements',
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
    'nav.accueil': 'Home', 'nav.facultes': 'Faculties', 'nav.apropos': 'About', 'nav.galerie': 'Gallery',
    'nav.lmd': 'BMD', 'nav.contact': 'Contact', 'nav.connexion': 'Login',

    'hero.devise': 'Integrity, Efficiency &amp; Academic Excellence',
    'hero.systeme': "BMD System — Bachelor's · Master's · Doctorate",
    'hero.btn_preinscription': 'Apply now',
    'hero.btn_facultes': 'Our faculties',

    'ticker.label': '📢 News',

    'facultes.titre': 'Our Faculties',
    'facultes.soustitre': '4 faculties with several specialized programs',

    'apropos.titre': 'About UML',
    'apropos.soustitre': 'Our history, our mission, our values and our location',
    'apropos.histoire_titre': 'Our history',
    'apropos.histoire_texte': 'The Methodist University of Lubumbashi (UML) was founded in 2019 by Reverend Full Professor Jean-Marie Nkonge, under the auspices of Bishop Full Professor Kasap O\'wan Tshibang, then head of the United Methodist Church of the South Congo – Zambia area. A Methodist Christian institution of higher education, located in Lubumbashi (Katanga, DRC), it is organized around four faculties and fully adopts the BMD system (Bachelor\'s – Master\'s – Doctorate).',
    'apropos.partenaires_titre': 'Our partners',
    'apropos.partenaires_soustexte': 'They support UML in its mission of education and service',
    'apropos.recteur_titre': 'A word from the Rector',
    'apropos.recteur_proverbe': '"Kumbuka kile kilikuleta" — Remember what brought you here.',
    'apropos.recteur_texte': 'Welcome to the Methodist University of Lubumbashi. I like to remind our students of this proverb: stay mindful of the goal that leads you to university, work with diligence and perseverance, and never forget why you are in school. It is in this spirit of excellence, integrity and faith that we guide you toward success.',
    'apropos.recteur_nom': 'Rev. Prof. Ordinaire Jean-Marie Nkonge',
    'apropos.recteur_fonction': 'Rector of the Methodist University of Lubumbashi',
    'apropos.mission_titre': 'Our mission',
    'apropos.mission_texte': 'To train competent, upright and responsible leaders, able to contribute to the development of Congolese society and Africa. UML combines academic excellence with human and spiritual formation, preparing its students to become agents of change serving the common good.',
    'apropos.localisation_titre': 'Our location',
    'apropos.adresse_label': 'Address',
    'apropos.heures_label': 'Opening hours',
    'apropos.itineraire': 'Get directions on Google Maps →',

    'valeurs.titre': 'Our Core Values',
    'valeurs.soustitre': 'Three principles that flow from our motto and guide all of UML\'s life',
    'valeurs.integrite_titre': 'Integrity',
    'valeurs.integrite_desc': 'Intellectual and moral honesty, rooted in the Methodist Christian values on which the university is founded.',
    'valeurs.efficacite_titre': 'Efficiency',
    'valeurs.efficacite_desc': 'Rigor, seriousness and a results-driven mindset, serving our students\' success and employability.',
    'valeurs.excellence_titre': 'Academic Excellence',
    'valeurs.excellence_desc': 'A constant pursuit of quality in teaching, research and student mentoring.',

    'evenements.titre': 'Events Calendar',
    'evenements.soustitre': 'Stay informed about UML activities and important dates',
    'evenements.statique_titre': 'Academic year highlights',
    'evenements.s1_titre': 'Academic year opening',
    'evenements.s1_desc': 'Welcoming new students and the official opening of the year.',
    'evenements.s2_titre': 'Science week',
    'evenements.s2_desc': 'Lectures, workshops and presentation of research work.',
    'evenements.s3_titre': 'Graduation ceremony',
    'evenements.s3_desc': 'Official ceremony awarding diplomas to graduates.',
    'evenements.dynamique_titre': 'Upcoming events',
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

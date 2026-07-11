-- =====================================================================
-- DONNÉES DE DÉMONSTRATION — Université Méthodiste de Lubumbashi (UML)
-- À exécuter après schema.sql : mysql -u root -p uml_db < seed.sql
-- =====================================================================

USE uml_db;

-- =====================================================================
-- FACULTÉS & FILIÈRES (identiques à celles affichées sur la page publique)
-- =====================================================================
INSERT INTO faculte (nom) VALUES
  ('Faculté de Théologie'),
  ('Sciences Informatiques'),
  ('Sciences Économiques'),
  ("Sciences de l'Éducation & Psychologie");

INSERT INTO filiere (nom, faculte_id) VALUES
  ('Missiologie',                    (SELECT id FROM faculte WHERE nom = 'Faculté de Théologie')),
  ('Théologie Pratique',             (SELECT id FROM faculte WHERE nom = 'Faculté de Théologie')),
  ('Théologie Systématique',         (SELECT id FROM faculte WHERE nom = 'Faculté de Théologie')),
  ('Théologie Biblique AT & NT',     (SELECT id FROM faculte WHERE nom = 'Faculté de Théologie')),
  ('Gestion Informatique',           (SELECT id FROM faculte WHERE nom = 'Sciences Informatiques')),
  ('Réseau & Télécom',               (SELECT id FROM faculte WHERE nom = 'Sciences Informatiques')),
  ('Génie Logicielle',               (SELECT id FROM faculte WHERE nom = 'Sciences Informatiques')),
  ('Design',                         (SELECT id FROM faculte WHERE nom = 'Sciences Informatiques')),
  ('Gestion des Ressources Humaines',(SELECT id FROM faculte WHERE nom = 'Sciences Économiques')),
  ('Finances, Banque & Comptabilité',(SELECT id FROM faculte WHERE nom = 'Sciences Économiques')),
  ('Gestion Marketing',              (SELECT id FROM faculte WHERE nom = 'Sciences Économiques')),
  ('Entrepreneuriat',                (SELECT id FROM faculte WHERE nom = 'Sciences Économiques')),
  ('Douane',                         (SELECT id FROM faculte WHERE nom = 'Sciences Économiques')),
  ("Sciences de l'Éducation",        (SELECT id FROM faculte WHERE nom = "Sciences de l'Éducation & Psychologie")),
  ('Psychologie',                    (SELECT id FROM faculte WHERE nom = "Sciences de l'Éducation & Psychologie"));

-- =====================================================================
-- PROFESSEURS
-- =====================================================================
INSERT INTO professeur (nom, prenom, email, telephone, grade) VALUES
  ('Mukendi',  'Joseph',   'j.mukendi@uml.ac.cd',  '+243 970 000 001', 'Professeur Ordinaire'),
  ('Kalonji',  'Grace',    'g.kalonji@uml.ac.cd',  '+243 970 000 002', 'Chef de Travaux'),
  ('Ilunga',   'Patrick',  'p.ilunga@uml.ac.cd',   '+243 970 000 003', 'Assistant');

-- =====================================================================
-- PROGRAMME — cours de démonstration pour "L1 Génie Logicielle" (2025-2026)
-- =====================================================================
INSERT INTO cours (code, nom, faculte, filiere_id, niveau, promotion, annee_academique, semestre, credits) VALUES
  ('INFO101', 'Algorithmique & Structures de Données', 'Sciences Informatiques', (SELECT id FROM filiere WHERE nom = 'Génie Logicielle'), 'L1', 'L1 Génie Logicielle', '2025-2026', 'S1', 6),
  ('MATH101', 'Mathématiques Générales',               'Sciences Informatiques', (SELECT id FROM filiere WHERE nom = 'Génie Logicielle'), 'L1', 'L1 Génie Logicielle', '2025-2026', 'S1', 5),
  ('INFO102', 'Bases de Données',                       'Sciences Informatiques', (SELECT id FROM filiere WHERE nom = 'Génie Logicielle'), 'L1', 'L1 Génie Logicielle', '2025-2026', 'S2', 6),
  ('ANGL101', 'Anglais Technique',                      'Sciences Informatiques', NULL, 'L1', 'L1 Sciences Informatiques', '2025-2026', 'S2', 3);

-- =====================================================================
-- HORAIRE de démonstration
-- =====================================================================
INSERT INTO horaire (promotion, annee_academique, jour, date_debut, heure_debut, heure_fin, cours_id, professeur_id, salle) VALUES
  ('L1 Génie Logicielle', '2025-2026', 'Lundi', '2025-09-08', '07:30', '09:30',
    (SELECT id FROM cours WHERE code='INFO101'), (SELECT id FROM professeur WHERE nom='Mukendi'), 'A101'),
  ('L1 Génie Logicielle', '2025-2026', 'Mardi', '2025-09-09', '09:30', '11:30',
    (SELECT id FROM cours WHERE code='MATH101'), (SELECT id FROM professeur WHERE nom='Kalonji'), 'A102');

-- =====================================================================
-- ÉTUDIANT DE DÉMONSTRATION — mot de passe temporaire : Demo1234!
-- =====================================================================
INSERT INTO etudiant (id, nom, postnom, prenom, date_naissance, sexe, email, telephone, mot_de_passe,
                       filiere_id, faculte, promotion, niveau, annee_academique, statut) VALUES
  ('UML-2026-0001', 'Kamona', 'Mulumbwa', 'Jean', '2004-05-12', 'M', 'jean.kamona@example.com', '+243 970 111 222',
   '$2b$10$91GJ7/WSYHFyohp5vy6ipe5.qBt.tePSwla85PXobZ85Z/iqS0jNe',
   (SELECT id FROM filiere WHERE nom = 'Génie Logicielle'),
   'Sciences Informatiques', 'L1 Génie Logicielle', 'L1', '2025-2026', 'actif');

INSERT INTO note (etudiant_id, cours_id, note_cc, note_examen, note, session, annee_academique) VALUES
  ('UML-2026-0001', (SELECT id FROM cours WHERE code='INFO101'), 16.0, 15.0, 15.5, 'S1', '2025-2026'),
  ('UML-2026-0001', (SELECT id FROM cours WHERE code='MATH101'), 13.0, 11.0, 12.0, 'S1', '2025-2026');

-- Inscription individuelle aux cours (remplace la correspondance par promotion)
INSERT INTO inscription_cours (etudiant_id, cours_id) VALUES
  ('UML-2026-0001', (SELECT id FROM cours WHERE code='INFO101')),
  ('UML-2026-0001', (SELECT id FROM cours WHERE code='MATH101')),
  ('UML-2026-0001', (SELECT id FROM cours WHERE code='INFO102')),
  ('UML-2026-0001', (SELECT id FROM cours WHERE code='ANGL101'));

INSERT INTO paiement (etudiant_id, montant, date_paiement, mode_paiement, reference, annee_academique) VALUES
  ('UML-2026-0001', 150.00, '2025-09-05', 'Mobile Money', 'MM-20250905-001', '2025-2026'),
  ('UML-2026-0001', 100.00, '2025-11-12', 'Espèces', NULL, '2025-2026');

-- =====================================================================
-- ANNONCES
-- =====================================================================
INSERT INTO annonce (type, titre, description, date_annonce, icone, actif) VALUES
  ('annonce', 'Début des inscriptions 2025-2026', 'Les inscriptions pour l\'année académique 2025-2026 sont officiellement ouvertes.', '2026-08-01', '📅', 1),
  ('evenement', 'Collation des grades 2025', 'Cérémonie officielle de remise des diplômes pour la promotion 2025.', '2025-12-15', '🎓', 1);

-- =====================================================================
-- PRÉ-INSCRIPTION EN ATTENTE (exemple pour tester le back-office)
-- =====================================================================
INSERT INTO preinscription (nom, prenom, sexe, telephone, email, ecole, pourcentage, section_secondaire, specialite, niveau, statut) VALUES
  ('Mwamba', 'Chantal', 'F', '+243 970 333 444', 'chantal.mwamba@example.com', 'Institut de la Gombe', '72', 'Scientifique', 'Design', 'Licence (Bac)', 'en_attente');

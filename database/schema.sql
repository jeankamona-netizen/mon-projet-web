-- =====================================================================
-- SCHÉMA DE BASE DE DONNÉES — Université Méthodiste de Lubumbashi (UML)
-- Extrait fidèlement de la base MySQL réelle (SHOW CREATE TABLE) pour que
-- l'environnement soit reproductible à l'identique sur une autre machine.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS uml_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE uml_db;

-- =====================================================================
-- FACULTÉ
-- =====================================================================
CREATE TABLE faculte (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  nom                VARCHAR(150) NOT NULL,
  master_disponible  TINYINT(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- FILIÈRE (rattachée à une faculté)
-- =====================================================================
CREATE TABLE filiere (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nom         VARCHAR(150) NOT NULL,
  faculte_id  INT NOT NULL,
  FOREIGN KEY (faculte_id) REFERENCES faculte(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- ANNÉE ACADÉMIQUE — source unique des années (évite de coder les années
-- en dur dans le frontend ; les menus se remplissent depuis cette table).
-- Les colonnes annee_academique (VARCHAR) des autres tables reprennent le libellé.
-- =====================================================================
CREATE TABLE annee_academique (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  libelle       VARCHAR(20) NOT NULL UNIQUE, -- ex. "2026-2027"
  est_courante  TINYINT(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- PROFESSEUR
-- =====================================================================
CREATE TABLE professeur (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nom           VARCHAR(100) NOT NULL,
  prenom        VARCHAR(100),
  email         VARCHAR(150),
  telephone     VARCHAR(30),
  grade         VARCHAR(100),
  mot_de_passe  VARCHAR(255) -- hash bcrypt, NULL tant que l'admin n'a pas activé l'accès
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- ÉTUDIANT — id au format matricule "UML-AAAA-0000" (généré dans preinscription.js)
-- =====================================================================
CREATE TABLE etudiant (
  id                VARCHAR(20) PRIMARY KEY,
  nom               VARCHAR(100) NOT NULL,
  postnom           VARCHAR(100),
  prenom            VARCHAR(100) NOT NULL,
  date_naissance    DATE,
  lieu_naissance    VARCHAR(100),
  nationalite       VARCHAR(50),
  sexe              ENUM('M','F'),
  email             VARCHAR(150),
  telephone         VARCHAR(30),
  adresse           VARCHAR(255),
  mot_de_passe      VARCHAR(255) NOT NULL, -- hash bcrypt
  filiere_id        INT,
  promotion         VARCHAR(50),  -- ex. "L1 Design"
  niveau            VARCHAR(10),  -- ex. "L1", "M1"
  faculte           VARCHAR(150), -- dénormalisé : utilisé par le filtrage admin (server.js)
  annee_academique  VARCHAR(20),  -- ex. "2025-2026"
  statut            VARCHAR(30) DEFAULT 'actif', -- 'actif' | 'diplome' | 'abandon'
  photo             VARCHAR(255) DEFAULT NULL, -- chemin relatif (uploads/xxx) de la photo pour la carte étudiant
  FOREIGN KEY (filiere_id) REFERENCES filiere(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- COURS (programme annuel)
-- =====================================================================
CREATE TABLE cours (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  code              VARCHAR(20) NOT NULL,
  nom               VARCHAR(150) NOT NULL,
  faculte           VARCHAR(150), -- faculté visée (ex. "Sciences Informatiques")
  filiere_id        INT,          -- filière précise ; NULL = cours commun à toute la faculté (ex. Educit)
  niveau             VARCHAR(10),  -- ex. "L1", "M1", "Pré-U"
  promotion         VARCHAR(150) NOT NULL, -- libellé d'affichage/rattachement horaire, ex. "L1 Informatique"
  annee_academique  VARCHAR(20) NOT NULL,
  semestre          ENUM('S1','S2') NOT NULL,
  credits           INT NOT NULL,
  cmi               INT, -- heures de Cours Magistral (Intégré) — maquette officielle
  td                INT, -- heures de Travaux Dirigés
  tp                INT, -- heures de Travaux Pratiques
  professeur_id     INT, -- professeur attribué au cours (indépendant de l'horaire, voir "Attributions des cours")
  UNIQUE KEY code_promo_annee (code, promotion, annee_academique),
  FOREIGN KEY (filiere_id) REFERENCES filiere(id) ON DELETE SET NULL,
  FOREIGN KEY (professeur_id) REFERENCES professeur(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- NOTE
-- =====================================================================
CREATE TABLE note (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  etudiant_id       VARCHAR(20) NOT NULL,
  cours_id          INT NOT NULL,
  note_cc           DECIMAL(4,2), -- contrôle continu, sur 20
  note_examen       DECIMAL(4,2), -- examen, sur 20
  note              DECIMAL(4,2), -- moyenne calculée : (note_cc + note_examen) / 2
  session           ENUM('S1','S2') NOT NULL, -- toujours = cours.semestre (dérivé côté serveur)
  annee_academique  VARCHAR(20) NOT NULL,
  -- Un cours appartient à un seul semestre : une seule note par étudiant et par
  -- cours (jamais le même cours dans deux semestres différents).
  UNIQUE KEY etudiant_cours (etudiant_id, cours_id),
  FOREIGN KEY (etudiant_id) REFERENCES etudiant(id),
  FOREIGN KEY (cours_id)    REFERENCES cours(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- HORAIRE
-- =====================================================================
CREATE TABLE horaire (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  promotion         VARCHAR(150) NOT NULL,
  annee_academique  VARCHAR(20) NOT NULL,
  jour              ENUM('Lundi','Mardi','Mercredi','Jeudi','Vendredi') NOT NULL,
  date_debut        DATE, -- date à partir de laquelle ce créneau hebdomadaire récurrent est valide
  heure_debut       TIME NOT NULL,
  heure_fin         TIME NOT NULL,
  cours_id          INT NOT NULL,
  professeur_id     INT,
  salle             VARCHAR(50) NOT NULL,
  FOREIGN KEY (cours_id)      REFERENCES cours(id),
  FOREIGN KEY (professeur_id) REFERENCES professeur(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- PRESENCE — feuille d'appel par séance. Une séance est identifiée par
-- (horaire_id, date_seance) : le même créneau horaire hebdomadaire récurrent
-- donne lieu à une ligne de présence différente chaque semaine où il a lieu.
-- =====================================================================
CREATE TABLE presence (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  horaire_id   INT NOT NULL,
  etudiant_id  VARCHAR(20) NOT NULL,
  date_seance  DATE NOT NULL,
  statut       ENUM('present','absent','retard') NOT NULL DEFAULT 'absent',
  marque_le    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY horaire_etudiant_date (horaire_id, etudiant_id, date_seance),
  FOREIGN KEY (horaire_id)  REFERENCES horaire(id)  ON DELETE CASCADE,
  FOREIGN KEY (etudiant_id) REFERENCES etudiant(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- INSCRIPTION_COURS — inscription individuelle d'un étudiant à un cours
-- (remplace la correspondance par simple égalité de chaîne "promotion" :
-- permet les cours partagés entre plusieurs filières/facultés et les cours
-- de rattrapage suivis par un étudiant hors de sa promotion actuelle)
-- =====================================================================
CREATE TABLE inscription_cours (
  etudiant_id       VARCHAR(20) NOT NULL,
  cours_id          INT NOT NULL,
  date_inscription  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (etudiant_id, cours_id),
  FOREIGN KEY (etudiant_id) REFERENCES etudiant(id) ON DELETE CASCADE,
  FOREIGN KEY (cours_id)    REFERENCES cours(id)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- PRÉ-INSCRIPTION
-- =====================================================================
CREATE TABLE preinscription (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  nom                 VARCHAR(100) NOT NULL,
  postnom             VARCHAR(100),
  prenom              VARCHAR(100) NOT NULL,
  date_naissance      DATE,
  lieu_naissance      VARCHAR(100),
  nationalite         VARCHAR(50),
  sexe                ENUM('M','F'),
  etat_civil          VARCHAR(30),
  type_identite       VARCHAR(50),
  num_identite        VARCHAR(50),
  adresse1            VARCHAR(255),
  adresse2            VARCHAR(255),
  telephone           VARCHAR(30),
  email               VARCHAR(150),
  nom_pere            VARCHAR(150),
  tel_pere            VARCHAR(30),
  nom_mere            VARCHAR(150),
  tel_mere            VARCHAR(30),
  nom_tuteur          VARCHAR(150),
  tel_tuteur          VARCHAR(30),
  adresse_urgence     VARCHAR(255),
  ecole               VARCHAR(200),
  ville_ecole         VARCHAR(100),
  num_diplome         VARCHAR(50),
  pourcentage         VARCHAR(20),
  annee_diplome       DATE,
  section_secondaire  VARCHAR(100),
  specialite          VARCHAR(150),
  specialite2         VARCHAR(150),
  niveau              VARCHAR(30),
  redoublant          TINYINT(1) DEFAULT 0,
  professionnel       TINYINT(1) DEFAULT 0,
  ref_nom             VARCHAR(100),
  ref_postnom         VARCHAR(100),
  ref_prenom          VARCHAR(100),
  ref_telephone       VARCHAR(30),
  ref_email           VARCHAR(150),
  canal_decouverte    VARCHAR(50),
  document_path       VARCHAR(255), -- noms de fichiers séparés par des virgules
  statut              ENUM('en_attente','accepte','rejete') DEFAULT 'en_attente',
  date_soumission     DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_preinscription_statut (statut)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- ANNONCE
-- =====================================================================
CREATE TABLE annonce (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  type           ENUM('annonce','evenement','communique') NOT NULL,
  titre          VARCHAR(200) NOT NULL,
  description    TEXT,
  date_annonce   DATE NOT NULL,
  icone          VARCHAR(10),
  image          VARCHAR(255),
  actif          TINYINT(1) DEFAULT 1,
  cible_faculte  VARCHAR(150), -- NULL = visible par tous ; sinon restreint à une faculté
  -- Destinataire d'un communiqué : 'etudiant', 'professeur' ou 'tous'.
  -- NULL pour les annonces/événements classiques (non concernés).
  cible_role     VARCHAR(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- AUDIT_LOG — journal des actions admin sensibles
-- =====================================================================
CREATE TABLE audit_log (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  admin_user    VARCHAR(100) NOT NULL,
  methode       VARCHAR(10) NOT NULL,
  chemin        VARCHAR(255) NOT NULL,
  statut_http   INT NOT NULL,
  date_action   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_date (date_action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- PAIEMENT — suivi des frais de scolarité (historique des versements)
-- =====================================================================
CREATE TABLE paiement (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  etudiant_id          VARCHAR(20) NOT NULL,
  montant              DECIMAL(10,2) NOT NULL,
  date_paiement        DATE NOT NULL,
  mode_paiement        VARCHAR(50),  -- ex. Espèces, Virement, Mobile Money
  rubrique             VARCHAR(100), -- motif du versement (ex. Minerval, Frais de connexion)
  reference            VARCHAR(100),
  commentaire          VARCHAR(255),
  annee_academique     VARCHAR(20),
  agent_id             INT,          -- caissier ayant encaissé (voir table agent)
  date_enregistrement  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (etudiant_id) REFERENCES etudiant(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- FRAIS_SCOLARITE — barème des frais attendus par niveau et par année
-- académique (montant total, tous rubriques confondus). Sert à calculer le
-- solde restant d'un étudiant : montant attendu − somme de ses versements
-- (table paiement) pour la même année. Aucune ligne définie pour un
-- niveau/année = solde non calculable (pas assimilé à 0 $ dû).
-- =====================================================================
CREATE TABLE frais_scolarite (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  niveau            VARCHAR(10) NOT NULL,
  annee_academique  VARCHAR(20) NOT NULL,
  montant           DECIMAL(10,2) NOT NULL,
  UNIQUE KEY niveau_annee (niveau, annee_academique)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- AGENT — personnel de l'UML. La colonne `fonction` détermine à quelles
-- interfaces l'agent a accès (caissier → caisse, administrateur_budget →
-- consultation/rapports, etc.).
-- =====================================================================
CREATE TABLE agent (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  matricule     VARCHAR(30) UNIQUE NOT NULL,
  noms          VARCHAR(100) NOT NULL,
  prenom        VARCHAR(100),
  email         VARCHAR(150),
  telephone     VARCHAR(30),
  fonction      VARCHAR(50) NOT NULL, -- 'caissier' | 'administrateur_budget' | ...
  mot_de_passe  VARCHAR(255) NOT NULL -- hash bcrypt
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

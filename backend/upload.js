const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../frontend/uploads'));
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const nomPropre = file.originalname.replace(/\s+/g, '_');
    cb(null, `${timestamp}_${nomPropre}`);
  }
});

const filtreTypes = (req, file, cb) => {
  const typesAutorises = /pdf|jpg|jpeg|png/;
  const estValide = typesAutorises.test(path.extname(file.originalname).toLowerCase());
  if (estValide) {
    cb(null, true);
  } else {
    cb(new Error('Seuls les fichiers PDF, JPG et PNG sont acceptés.'));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max par fichier
  fileFilter: filtreTypes
});

// =====================
// VÉRIFICATION DU CONTENU RÉEL (signature binaire) — l'extension seule peut être
// falsifiée. On vérifie que les premiers octets du fichier écrit sur disque
// correspondent bien à un PDF, JPEG ou PNG, sinon on le supprime.
// =====================
const SIGNATURES = [
  { type: 'PDF',  bytes: [0x25, 0x50, 0x44, 0x46] },             // %PDF
  { type: 'JPEG', bytes: [0xFF, 0xD8, 0xFF] },
  { type: 'PNG',  bytes: [0x89, 0x50, 0x4E, 0x47] },
];

function correspondSignature(buffer) {
  return SIGNATURES.some(({ bytes }) => bytes.every((octet, i) => buffer[i] === octet));
}

function verifierContenuFichiers(req, res, next) {
  const fichiers = req.files || (req.file ? [req.file] : []);
  try {
    for (const fichier of fichiers) {
      const entete = Buffer.alloc(8);
      const fd = fs.openSync(fichier.path, 'r');
      fs.readSync(fd, entete, 0, 8, 0);
      fs.closeSync(fd);

      if (!correspondSignature(entete)) {
        fichiers.forEach(f => fs.unlink(f.path, () => {}));
        return res.status(400).json({ erreur: `Le fichier "${fichier.originalname}" n'est pas un PDF/JPG/PNG valide.` });
      }
    }
    next();
  } catch (erreur) {
    return res.status(400).json({ erreur: 'Erreur lors de la vérification des fichiers.' });
  }
}

module.exports = upload;
module.exports.verifierContenuFichiers = verifierContenuFichiers;
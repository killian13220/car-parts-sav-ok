const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const connectDB = require('./db');
const Ticket = require('./models/ticket');
const StatusUpdate = require('./models/status');
const User = require('./models/user');
const ResponseTemplate = require('./models/responseTemplate');
const Notification = require('./models/notification');
const bcrypt = require('bcryptjs');
const { sendStatusUpdateEmail, sendTicketCreationEmail, sendAssignmentEmail, sendAssistanceRequestEmail, sendEscalationEmail, sendSlaReminderEmail, sendPasswordResetEmail } = require('./services/emailService');
const setupStatsRoutes = require('./stats-api');
const { authenticateAdmin: adminAuthMW } = require('./middleware/auth');
const { startSlaWatcher } = require('./jobs/slaWatcher');
require('dotenv').config();
const { isS3Enabled, uploadBuffer, streamToResponse } = require('./services/storage');

// Initialisation de l'application Express
const app = express();
const PORT = process.env.PORT || 3001;
// L'application est derrière un proxy (Railway/Render)
app.set('trust proxy', 1);

// Connexion à MongoDB
connectDB();

// Seed default response templates if collection is empty
async function seedResponseTemplates() {
  try {
    const count = await ResponseTemplate.countDocuments();
    if (count === 0) {
      await ResponseTemplate.insertMany([
        { key: 'ask_more_info', label: 'Demande d\'informations complémentaires', content: 'Bonjour {{client.firstName}},\n\nPour avancer sur votre dossier {{ticket.number}}, pourriez-vous nous préciser: {{ticket.missingInfo}}\n\nCordialement,\nService SAV', isActive: true },
        { key: 'in_supplier_process', label: 'Dossier en cours chez le fournisseur', content: 'Bonjour {{client.firstName}},\n\nVotre dossier {{ticket.number}} est actuellement en cours d\'analyse chez notre fournisseur. Nous reviendrons vers vous dès que possible.\n\nCordialement,\nService SAV', isActive: true },
        { key: 'waiting_client', label: 'En attente du client', content: 'Bonjour {{client.firstName}},\n\nNous restons en attente de votre retour concernant le dossier {{ticket.number}}.\n\nCordialement,\nService SAV', isActive: true },
        { key: 'blocked', label: 'Dossier temporairement bloqué', content: 'Bonjour {{client.firstName}},\n\nVotre dossier {{ticket.number}} est temporairement bloqué. Nous vous tiendrons informé dès évolution.\n\nCordialement,\nService SAV', isActive: true }
      ]);
      console.log('[seed] Modèles de réponse par défaut insérés');
    }
  } catch (e) {
    console.error('[seed] Erreur lors du seed des modèles de réponse:', e);
  }
}
seedResponseTemplates();

// Middleware
// CORS configurable via CORS_ORIGIN (ex: "https://example.com,https://admin.example.com").
// Défaut à '*' si non spécifié (développement).
app.use(cors({
  origin: (process.env.CORS_ORIGIN && process.env.CORS_ORIGIN.trim() !== '')
    ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
    : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
// Sécurité HTTP de base (désactive CSP stricte pour éviter de casser l'admin inline)
app.use(helmet({
  contentSecurityPolicy: false,
}));
// Compression des réponses
app.use(compression());
// Parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting sur les routes admin (anti-abus)
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 requêtes/15min/IP
  standardHeaders: true,
  legacyHeaders: false,
});

// Limiteur pour les demandes de réinitialisation de mot de passe
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requêtes/15min/IP
  standardHeaders: true,
  legacyHeaders: false,
});

 

// S'assurer que le répertoire d'uploads existe (supporte UPLOADS_DIR)
const configuredUploadsDir = (process.env.UPLOADS_DIR && process.env.UPLOADS_DIR.trim() !== '')
  ? process.env.UPLOADS_DIR.trim()
  : path.join(__dirname, '../uploads');
const uploadsDir = path.isAbsolute(configuredUploadsDir)
  ? configuredUploadsDir
  : path.join(__dirname, '..', configuredUploadsDir);
try {
  fs.mkdirSync(uploadsDir, { recursive: true });
} catch (e) {
  console.error('Impossible de créer le répertoire uploads:', e);
}

// Préparer une liste d'emplacements possibles pour servir les fichiers (compatibilité)
// 1) uploadsDir (valeur actuelle de UPLOADS_DIR)
// 2) uploadsDir + '/uploads' (cas où les fichiers ont été stockés dans un sous-dossier "uploads")
// 3) parent de uploadsDir (cas où les fichiers sont à la racine du volume)
const altUploadDirs = [uploadsDir];
const nestedUploads = path.join(uploadsDir, 'uploads');
try {
  if (fs.existsSync(nestedUploads) && !altUploadDirs.includes(nestedUploads)) {
    altUploadDirs.push(nestedUploads);
  }
} catch {}
const parentUploads = path.dirname(uploadsDir);
try {
  // Ne jamais ajouter la racine '/': risque de fuite de fichiers système
  if (parentUploads !== '/' && fs.existsSync(parentUploads) && !altUploadDirs.includes(parentUploads)) {
    altUploadDirs.push(parentUploads);
  }
} catch {}
// Ajouter aussi des emplacements historiques probables
const appUploads = path.join(__dirname, '../uploads'); // ex: /app/uploads
try {
  if (fs.existsSync(appUploads) && !altUploadDirs.includes(appUploads)) {
    altUploadDirs.push(appUploads);
  }
} catch {}
const dataUploads = '/data/uploads';
try {
  if (fs.existsSync(dataUploads) && !altUploadDirs.includes(dataUploads)) {
    altUploadDirs.push(dataUploads);
  }
} catch {}
const dataRoot = '/data';
try {
  if (fs.existsSync(dataRoot) && !altUploadDirs.includes(dataRoot)) {
    altUploadDirs.push(dataRoot);
  }
} catch {}

console.log('UPLOADS_DIR env =', process.env.UPLOADS_DIR, ' -> resolved uploadsDir =', uploadsDir);
console.log('Static uploads mapping order:', altUploadDirs);

// Activer le stockage S3/R2 si configuré
const S3_ENABLED = isS3Enabled();
console.log('Storage driver:', S3_ENABLED ? 's3' : 'local');

// Configuration de multer pour le téléchargement de fichiers
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// Limite de taille de fichier configurable (par défaut 25MB)
const MAX_FILE_SIZE_MB = parseInt(process.env.UPLOAD_MAX_FILE_SIZE_MB || '25', 10);

const upload = multer({ 
  storage: S3_ENABLED ? multer.memoryStorage() : diskStorage,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 }, // Limite en MB
  fileFilter: (req, file, cb) => {
    // Vérifier les types de fichiers autorisés
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt|csv|zip|mp4|avi|mov|wmv|mkv/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé. Seuls les images, vidéos (MP4, AVI, MOV), PDF, documents Office et archives sont acceptés.'));
    }
  }
});

// En mode S3/R2, exposer une route /uploads/:key qui streame depuis le bucket
if (S3_ENABLED) {
  app.get('/uploads/:key', async (req, res) => {
    try {
      const key = String(req.params.key || '').trim();
      if (!key) return res.status(400).send('Clé manquante');
      await streamToResponse(res, key);
    } catch (e) {
      console.error('[uploads] Erreur de lecture depuis R2:', e && e.message ? e.message : e);
      return res.status(404).send('Fichier non trouvé');
    }
  });
}

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, '../')));
// On sert /uploads depuis plusieurs emplacements, dans l'ordre, pour couvrir les anciens et nouveaux chemins
for (const d of altUploadDirs) {
  app.use('/uploads', express.static(d, { fallthrough: true }));
}
app.use('/admin', express.static(path.join(__dirname, '../admin')));
app.use('/tracking', express.static(path.join(__dirname, '../tracking')));

// Health check (statut et DB)
app.get('/healthz', (req, res) => {
  const dbState = (mongoose && mongoose.connection)
    ? mongoose.connection.readyState
    : -1;
  res.json({ status: 'ok', db: dbState, uptime: process.uptime() });
});

// Readiness probe (prêt à recevoir du trafic)
app.get('/readyz', (req, res) => {
  const dbState = (mongoose && mongoose.connection)
    ? mongoose.connection.readyState
    : -1;
  const ok = dbState === 1; // prêt si DB connectée
  if (!ok) return res.status(503).json({ status: 'not-ready', db: dbState });
  return res.json({ status: 'ready', db: dbState });
});

// --- Auth publique: demande de réinitialisation de mot de passe ---
// Body: { email }
app.post('/api/auth/request-password-reset', resetLimiter, async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email manquant' });
    }
    const user = await User.findOne({ email, isActive: true });
    // Toujours répondre succès pour éviter l'énumération d'emails
    if (!user) {
      return res.json({ success: true, message: 'Si un compte existe, un email a été envoyé' });
    }

    // Générer un token aléatoire et stocker le hash + expiration (60 min)
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    user.passwordResetTokenHash = tokenHash;
    user.passwordResetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);
    user.lastPasswordResetRequestedAt = new Date();
    await user.save();

    // Construire le lien de réinitialisation (même domaine que la requête)
    const origin = `${req.protocol}://${req.get('host')}`;
    const resetLink = `${origin}/admin/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

    // Envoyer l'email (ne bloque pas la réponse au client si l'envoi échoue)
    try {
      await sendPasswordResetEmail(user, resetLink);
    } catch (mailErr) {
      console.error('[auth] request-password-reset email send failed:', mailErr);
      // On ne renvoie pas d'erreur au client pour éviter de révéler des détails et améliorer l'UX
    }
    return res.json({ success: true, message: 'Si un compte existe, un email a été envoyé' });
  } catch (e) {
    console.error('[auth] request-password-reset error:', e);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// --- Page publique: formulaire de réinitialisation ---
app.get('/admin/reset-password', (req, res) => {
  const token = String(req.query.token || '');
  const email = String(req.query.email || '');
  const html = `<!doctype html>
  <html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Réinitialiser le mot de passe</title>
    <style>
      body{font-family:Arial,sans-serif;background:#f6f7fb;margin:0;padding:0}
      .card{max-width:420px;margin:40px auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 10px 15px -3px rgba(0,0,0,.1);overflow:hidden}
      .header{background:#003366;color:#fff;padding:16px;text-align:center}
      .content{padding:20px}
      label{display:block;margin:12px 0 6px;color:#111827}
      input{width:100%;padding:10px;border:1px solid #d1d5db;border-radius:6px}
      button{background:#E60000;color:#fff;border:none;padding:10px 14px;border-radius:6px;cursor:pointer;margin-top:16px}
      .info{font-size:12px;color:#6b7280;margin-top:10px}
      .error{color:#b91c1c;margin-top:10px}
      .success{color:#065f46;margin-top:10px}
    </style>
  </head>
  <body>
    <div class="card">
      <div class="header"><h2>Réinitialiser le mot de passe</h2></div>
      <div class="content">
        <form id="resetForm">
          <input type="hidden" name="token" value="${token}" />
          <input type="hidden" name="email" value="${email}" />
          <label for="password">Nouveau mot de passe</label>
          <input id="password" name="password" type="password" minlength="8" required />
          <label for="confirm">Confirmer le mot de passe</label>
          <input id="confirm" name="confirm" type="password" minlength="8" required />
          <button type="submit">Valider</button>
          <div class="info">Le mot de passe doit contenir au moins 8 caractères.</div>
          <div id="msg" class="info"></div>
        </form>
      </div>
    </div>
    <script>
      const form = document.getElementById('resetForm');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const email = fd.get('email');
        const token = fd.get('token');
        const password = fd.get('password');
        const confirm = fd.get('confirm');
        const msg = document.getElementById('msg');
        msg.className='info'; msg.textContent='';
        if (!password || password.length < 8) { msg.className='error'; msg.textContent='Mot de passe trop court'; return; }
        if (password !== confirm) { msg.className='error'; msg.textContent='Les mots de passe ne correspondent pas'; return; }
        try {
          const resp = await fetch('/api/auth/reset-password', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, token, password })
          });
          const data = await resp.json();
          if (resp.ok) { msg.className='success'; msg.textContent='Mot de passe mis à jour. Vous pouvez vous connecter.'; }
          else { msg.className='error'; msg.textContent=data && data.message ? data.message : 'Erreur'; }
        } catch (err){ msg.className='error'; msg.textContent='Erreur réseau'; }
      });
    </script>
  </body>
  </html>`;
  res.set('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
});

// --- Auth publique: réinitialisation de mot de passe ---
// Body: { email, token, password }
app.post('/api/auth/reset-password', resetLimiter, async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const token = String(req.body.token || '').trim();
    const password = String(req.body.password || '');
    if (!email || !token || !password) {
      return res.status(400).json({ success: false, message: 'Paramètres manquants' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Mot de passe trop court (min 8)' });
    }
    const user = await User.findOne({ email, isActive: true });
    if (!user || !user.passwordResetTokenHash || !user.passwordResetTokenExpires) {
      return res.status(400).json({ success: false, message: 'Lien invalide ou expiré' });
    }
    if (user.passwordResetTokenExpires.getTime() < Date.now()) {
      return res.status(400).json({ success: false, message: 'Lien expiré' });
    }
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    if (tokenHash !== String(user.passwordResetTokenHash)) {
      return res.status(400).json({ success: false, message: 'Lien invalide' });
    }

    // Mettre à jour le mot de passe
    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(password, salt);
    user.passwordHash = newHash;
    // Invalider le token
    user.passwordResetTokenHash = null;
    user.passwordResetTokenExpires = null;
    await user.save();
    return res.json({ success: true, message: 'Mot de passe mis à jour' });
  } catch (e) {
    console.error('[auth] reset-password error:', e);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});
// --- Diagnostic: savoir où se trouve un fichier (protégé admin) ---
// Exemple: GET /api/admin/uploads/where?name=documents-123.jpeg
app.get('/api/admin/uploads/where', adminAuthMW, (req, res) => {
  try {
    const name = (req.query.name || '').toString();
    if (!name) {
      return res.status(400).json({ success: false, message: 'Paramètre "name" manquant' });
    }

    const results = [];
    let foundPath = null;
    for (const base of altUploadDirs) {
      const candidate = path.join(base, name);
      let exists = false;
      try {
        exists = fs.existsSync(candidate);
      } catch {}
      results.push({ base, path: candidate, exists });
      if (exists && !foundPath) foundPath = candidate;
    }

    return res.json({ success: true, name, found: !!foundPath, foundPath, checked: results, mappingOrder: altUploadDirs });
  } catch (e) {
    console.error('Erreur where uploads:', e);
    return res.status(500).json({ success: false, message: 'Erreur interne during where check' });
  }
});

// --- Utilitaires encodage noms de fichiers ---
function looksMojibake(str) {
  if (!str) return false;
  // Détection simple de suites typiques: "Ã", "Â", "â", "€"
  return /[ÃÂâ€]/.test(str);
}

function sanitizeFileName(input) {
  try {
    let name = String(input || '').trim();
    if (typeof name.normalize === 'function') name = name.normalize('NFC');
    if (looksMojibake(name)) {
      try { name = Buffer.from(name, 'latin1').toString('utf8'); } catch (_) {}
    }
    name = name.replace(/[\u0000-\u001F\u007F]/g, '');
    name = name.replace(/[\\/]/g, '_');
    if (name.length > 180) name = name.slice(0, 180);
    if (!name) name = 'fichier';
    return name;
  } catch (_) {
    return 'fichier';
  }
}

// Routes API

// Créer un nouveau ticket
app.post('/api/tickets', upload.array('documents', 10), async (req, res) => {
  try {
    console.log('Requête reçue:', req.body);
    console.log('Fichiers reçus:', req.files);
    
    // Générer un numéro de ticket unique
    const ticketNumber = Ticket.generateTicketNumber();
    
    // Préparer les données du ticket
    const ticketData = {
      ticketNumber,
      // Définir le type de réclamation
      claimType: req.body.claimType || 'piece_defectueuse',
      clientInfo: {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        phone: req.body.phone
      },
      orderInfo: {
        orderNumber: req.body.orderNumber,
        orderDate: req.body.orderDate
      },
      vehicleInfo: {
        make: req.body.make,
        model: req.body.model,
        year: req.body.year,
        vin: req.body.vin,
        registrationNumber: req.body.registrationNumber,
        installationDate: req.body.installationDate
      },
      partInfo: {
        // Définir une valeur par défaut 'autres' si le type de pièce est vide
        partType: req.body.partType || 'autres',
        symptom: req.body.symptom,
        failureTime: req.body.failureTime,
        errorCodes: req.body.errorCodes,
        // Correction des noms de champs pour correspondre au formulaire
        professionalInstallation: req.body.montage_pro === 'oui' || req.body.professionalInstallation === 'true' || req.body.professionalInstallation === 'on' || req.body.professionalInstallation === true || req.body.professionalInstallation === '1' || req.body.professionalInstallation === 'yes' || req.body.professionalInstallation === 'oui',
        oilFilled: req.body.mise_huile === 'oui' || req.body.oilFilled === 'true' || req.body.oilFilled === 'on' || req.body.oilFilled === true || req.body.oilFilled === '1' || req.body.oilFilled === 'yes' || req.body.oilFilled === 'oui',
        oilQuantity: req.body.oilQuantity,
        oilReference: req.body.oilReference,
        newParts: req.body.newParts === 'true' || req.body.pieces_neuves === 'oui',
        // Correction pour prendre en compte le nom du champ dans le formulaire
        newPartsDetails: req.body.pieces_details || req.body.newPartsDetails
      },
      documents: []
    };
    
    // Ajouter les documents téléchargés
    if (req.files && req.files.length > 0) {
      // Récupérer les types de documents
      const documentTypes = Array.isArray(req.body.documentTypes) ? req.body.documentTypes : [req.body.documentTypes];
      
      for (let index = 0; index < req.files.length; index++) {
        const file = req.files[index];
        // Mapper les types de documents du formulaire vers les types autorisés dans le schéma
        let documentType = 'documents_autres'; // Type par défaut
        
        // Récupérer le type de document du formulaire
        const formDocType = documentTypes[index] || '';
        
        // Mapper les types de documents du formulaire vers les types autorisés
        if (formDocType.includes('justificatif_pro')) {
          documentType = 'factures_pieces';
        } else if (formDocType.includes('lecture_obd')) {
          documentType = 'lecture_obd';
        } else if (formDocType.includes('photo')) {
          documentType = 'photo_piece';
        } else if (formDocType.includes('facture')) {
          documentType = 'factures_pieces';
        } else if (formDocType.includes('media')) {
          documentType = 'media_transmission';
        } else if (formDocType.includes('moteur')) {
          documentType = 'photos_moteur';
        } else if (formDocType.includes('entretien')) {
          documentType = 'factures_entretien';
        }
        
        console.log(`Mappage de type de document: ${formDocType} -> ${documentType}`);
        
        // Déterminer le chemin/clé stockée selon le driver
        let storedPath = '';
        if (S3_ENABLED) {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          const ext = path.extname(file.originalname);
          const key = `${file.fieldname}-${uniqueSuffix}${ext}`;
          try {
            await uploadBuffer(key, file.mimetype, file.buffer);
            storedPath = `/uploads/${key}`;
          } catch (upErr) {
            console.error('[upload] Erreur upload R2:', upErr && upErr.message ? upErr.message : upErr);
            throw upErr;
          }
        } else {
          storedPath = file.path;
        }
        
        ticketData.documents.push({
          type: documentType,
          fileName: sanitizeFileName(file.originalname),
          filePath: storedPath,
          fileType: file.mimetype,
          uploadedBy: 'client',
          uploadDate: new Date()
        });
      }
    }
    
    // Créer le ticket dans la base de données
    const newTicket = new Ticket(ticketData);
    await newTicket.save();
    
    // Créer la première mise à jour de statut
    const statusUpdate = new StatusUpdate({
      ticketId: newTicket._id,
      status: 'nouveau',
      comment: 'Ticket créé',
      updatedBy: 'system',
      clientNotified: true
    });
    await statusUpdate.save();
    
    // Envoyer un email de confirmation au client
    try {
      const info = await sendTicketCreationEmail(newTicket);
      if (info) {
        console.log(`Email de confirmation envoyé au client ${newTicket.clientInfo.email}`);
      } else {
        console.warn(`Envoi de l'email de confirmation échoué pour ${newTicket.clientInfo.email}`);
      }
    } catch (emailError) {
      console.error('Erreur lors de l\'envoi de l\'email de confirmation:', emailError);
      // On continue même si l'envoi d'email échoue
    }
    
    // Envoyer la réponse
    res.status(201).json({
      success: true,
      ticketNumber: ticketNumber,
      message: 'Votre demande SAV a été enregistrée avec succès'
    });
    
  } catch (error) {
    console.error('Erreur lors de la création du ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Une erreur est survenue lors de l\'enregistrement de votre demande'
    });
  }
});

// Obtenir un ticket par son numéro
app.get('/api/tickets/:ticketNumber', async (req, res) => {
  try {
    console.log('Recherche du ticket:', req.params.ticketNumber);
    
    if (!req.params.ticketNumber) {
      console.log('Numéro de ticket manquant dans la requête');
      return res.status(400).json({
        success: false,
        message: 'Numéro de ticket requis'
      });
    }
    
    const ticket = await Ticket.findOne({ ticketNumber: req.params.ticketNumber });
    console.log('Résultat de la recherche:', ticket ? 'Ticket trouvé' : 'Ticket non trouvé');
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket non trouvé. Vérifiez le numéro et réessayez.'
      });
    }
    
    // Obtenir l'historique des statuts
    const statusHistory = await StatusUpdate.find({ ticketId: ticket._id }).sort({ updatedAt: -1 });
    console.log(`${statusHistory.length} mises à jour de statut trouvées pour le ticket`);
    
    res.status(200).json({
      success: true,
      ticket,
      statusHistory
    });
    
  } catch (error) {
    console.error('Erreur lors de la récupération du ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Une erreur est survenue lors de la récupération du ticket'
    });
  }
});

// Middleware d'authentification simple pour l'interface admin
const authenticateAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentification requise'
    });
  }
  
  // Décodage de l'authentification Basic
  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');
  
  // Identifiants fixes pour l'accès directeur (optionnels via env)
  const DIRECTOR_ACCOUNT_ENABLED = process.env.DIRECTOR_ACCOUNT_ENABLED === 'true';
  const directeurUsername = 'directeur';
  const directeurPassword = 'CarParts2025';
  
  // Vérification des identifiants ENV/directeur (fallback)
  if ((username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) ||
      (DIRECTOR_ACCOUNT_ENABLED && username.toLowerCase() === directeurUsername && password === directeurPassword)) {
    req.auth = { type: 'env', role: 'admin', username };
    return next();
  }

  // Vérification en base (utilisateurs SAV)
  try {
    const user = await User.findOne({ email: username.toLowerCase(), isActive: true });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Identifiants incorrects' });
    }
    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      return res.status(401).json({ success: false, message: 'Identifiants incorrects' });
    }
    // Auth OK
    req.auth = { type: 'user', role: user.role, id: user._id.toString(), email: user.email };
    return next();
  } catch (err) {
    console.error('Erreur d\'authentification admin:', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur lors de l\'authentification' });
  }
};

// Routes admin (protégées par authentification)

// Middleware d'autorisation réservé aux administrateurs
const ensureAdmin = (req, res, next) => {
  if (req.auth && req.auth.role === 'admin') return next();
  return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs' });
};

// Autoriser les rôles admin OU agent (SAV)
const ensureAdminOrAgent = (req, res, next) => {
  if (req.auth && (req.auth.role === 'admin' || req.auth.role === 'agent')) return next();
  return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs ou agents SAV' });
};

// Informations sur l'utilisateur authentifié
app.get('/api/admin/me', authenticateAdmin, (req, res) => {
  try {
    const info = req.auth || {};
    return res.json({ success: true, role: info.role, id: info.id, email: info.email });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Test d'alerte SLA 24h sur un ticket spécifique (ADMIN uniquement)
app.post('/api/admin/test/sla-alert/:ticketId([0-9a-fA-F]{24})', authenticateAdmin, ensureAdmin, async (req, res) => {
  const routeTag = '[POST /api/admin/test/sla-alert/:ticketId]';
  try {
    const { ticketId } = req.params;
    console.log(`${routeTag} Reçu pour ticketId=${ticketId}`);

    // Charger le ticket avec l'agent assigné pour obtenir l'email
    const ticket = await Ticket.findById(ticketId)
      .populate('assignedTo', 'firstName lastName email role isActive')
      .exec();

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket non trouvé' });
    }

    // Ne pas envoyer pour les tickets fermés
    if (['clôturé', 'refusé'].includes(ticket.currentStatus)) {
      return res.status(400).json({ success: false, message: 'Le ticket est fermé; aucune alerte SLA' });
    }

    // Envoyer un email d'alerte de test en simulant 24h de retard
    try {
      const info = await sendSlaReminderEmail(ticket, ticket.assignedTo, 24);
      if (info) {
        console.log(`${routeTag} Email de test SLA envoyé`, { messageId: info.messageId, to: (ticket.assignedTo && ticket.assignedTo.email) });
        return res.json({ success: true, message: 'Alerte SLA (24h) envoyée pour test', messageId: info.messageId });
      }
      return res.status(500).json({ success: false, message: 'Échec de l\'envoi de l\'email (voir logs serveur)' });
    } catch (emailErr) {
      console.error(`${routeTag} Erreur d\'envoi:`, emailErr);
      return res.status(500).json({ success: false, message: 'Erreur lors de l\'envoi de l\'email', details: emailErr && emailErr.message });
    }
  } catch (error) {
    console.error(`${routeTag} Erreur inattendue:`, error);
    return res.status(500).json({ success: false, message: 'Erreur serveur', details: error && error.message });
  }
});

// Gestion des utilisateurs SAV (CRUD)
// Lister les utilisateurs
app.get('/api/admin/users', authenticateAdmin, ensureAdmin, async (req, res) => {
  try {
    const users = await User.find({}, '-passwordHash').sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (error) {
    console.error('Erreur lors de la liste des utilisateurs:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Créer un utilisateur SAV
app.post('/api/admin/users', authenticateAdmin, ensureAdmin, async (req, res) => {
  try {
    const { firstName = '', lastName = '', email, password, role = 'agent', isActive = true } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email et mot de passe requis' });
    }
    const normalizedEmail = String(email).toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Un utilisateur avec cet email existe déjà' });
    }
    if (!['admin', 'agent'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Rôle invalide' });
    }
    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await User.create({ firstName, lastName, email: normalizedEmail, passwordHash, role, isActive: !!isActive });
    const { passwordHash: _, ...safe } = user.toObject();
    res.status(201).json({ success: true, user: safe });
  } catch (error) {
    console.error('Erreur lors de la création utilisateur:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Mettre à jour un utilisateur SAV
app.put('/api/admin/users/:id', authenticateAdmin, ensureAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = {};
    const allowed = ['firstName', 'lastName', 'role', 'isActive'];
    allowed.forEach(k => {
      if (k in req.body) updates[k] = req.body[k];
    });
    if ('role' in updates && !['admin', 'agent'].includes(updates.role)) {
      return res.status(400).json({ success: false, message: 'Rôle invalide' });
    }
    if (req.body.password) {
      updates.passwordHash = await bcrypt.hash(String(req.body.password), 10);
    }
    if (req.body.email) {
      const normalizedEmail = String(req.body.email).toLowerCase().trim();
      const exists = await User.findOne({ email: normalizedEmail, _id: { $ne: id } });
      if (exists) {
        return res.status(409).json({ success: false, message: 'Email déjà utilisé par un autre compte' });
      }
      updates.email = normalizedEmail;
    }
    const user = await User.findByIdAndUpdate(id, updates, { new: true, runValidators: true, fields: { passwordHash: 0 } });
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    res.json({ success: true, user });
  } catch (error) {
    console.error('Erreur lors de la mise à jour utilisateur:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Supprimer un utilisateur SAV
app.delete('/api/admin/users/:id', authenticateAdmin, ensureAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    // ...
    if (req.auth && req.auth.id === id) {
      return res.status(400).json({ success: false, message: 'Impossible de supprimer votre propre compte' });
    }
    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur lors de la suppression utilisateur:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// --- Gestion des modèles de réponse (CRUD) ---
// Lister les modèles
app.get('/api/admin/templates', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    const filter = {};
    if (String(req.query.active || '').trim() === '1') filter.isActive = true;
    const templates = await ResponseTemplate.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, templates });
  } catch (error) {
    console.error('Erreur lors de la liste des modèles:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Créer un modèle
app.post('/api/admin/templates', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    const { key, label, content, isActive = true } = req.body || {};
    if (!key || !label || !content) {
      return res.status(400).json({ success: false, message: 'Champs requis: key, label, content' });
    }
    const doc = await ResponseTemplate.create({ key: String(key).toLowerCase().trim(), label: String(label).trim(), content: String(content).trim(), isActive: !!isActive });
    res.status(201).json({ success: true, template: doc });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Cette clé existe déjà' });
    }
    console.error('Erreur lors de la création du modèle:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Mettre à jour un modèle
app.put('/api/admin/templates/:id', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = {};
    ['key','label','content','isActive'].forEach(k => {
      if (k in req.body) updates[k] = req.body[k];
    });
    if ('key' in updates) updates.key = String(updates.key).toLowerCase().trim();
    if ('label' in updates) updates.label = String(updates.label).trim();
    if ('content' in updates) updates.content = String(updates.content).trim();
    const doc = await ResponseTemplate.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Modèle non trouvé' });
    res.json({ success: true, template: doc });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Cette clé existe déjà' });
    }
    console.error('Erreur lors de la mise à jour du modèle:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Supprimer un modèle
app.delete('/api/admin/templates/:id', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await ResponseTemplate.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Modèle non trouvé' });
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur lors de la suppression du modèle:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// --- Édition de la documentation Markdown (admin/docs) ---
// Sécurisation: accès Admin uniquement, restriction au répertoire admin/docs, extensions .md uniquement
const docsBaseDir = path.join(__dirname, '../admin/docs');

function isSubPath(parent, child) {
  const rel = path.relative(parent, child);
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function safeDocAbsolutePath(relPath = '') {
  const cleaned = path.normalize(String(relPath).replace(/^\/+/, ''));
  const abs = path.join(docsBaseDir, cleaned);
  if (!abs.startsWith(docsBaseDir)) {
    throw new Error('Chemin en dehors du répertoire docs');
  }
  if (!cleaned.endsWith('.md')) {
    throw new Error('Seuls les fichiers .md sont autorisés');
  }
  return abs;
}

async function listMarkdownFilesRecursive(dir, basePrefix = '') {
  const out = [];
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const abs = path.join(dir, ent.name);
    const rel = path.join(basePrefix, ent.name);
    if (ent.isDirectory()) {
      // Limiter la profondeur de navigation à l'arborescence existante
      const nested = await listMarkdownFilesRecursive(abs, rel);
      out.push(...nested);
    } else if (ent.isFile() && ent.name.toLowerCase().endsWith('.md')) {
      try {
        const st = await fs.promises.stat(abs);
        out.push({
          path: rel.replace(/\\/g, '/'),
          name: ent.name,
          size: st.size,
          mtime: st.mtimeMs
        });
      } catch (_) {}
    }
  }
  // Trier par chemin
  out.sort((a, b) => a.path.localeCompare(b.path));
  return out;
}

// Lister les fichiers .md sous admin/docs
app.get('/api/admin/docs', authenticateAdmin, ensureAdmin, async (req, res) => {
  try {
    const list = await listMarkdownFilesRecursive(docsBaseDir, '');
    res.json({ success: true, files: list });
  } catch (error) {
    console.error('Erreur listage docs:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Version publique (lecture seule) pour la page #docs
app.get('/api/docs', async (req, res) => {
  try {
    const list = await listMarkdownFilesRecursive(docsBaseDir, '');
    res.json({ success: true, files: list });
  } catch (error) {
    console.error('Erreur listage docs (public):', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Lire le contenu d'un fichier .md
app.get('/api/admin/docs/content', authenticateAdmin, ensureAdmin, async (req, res) => {
  try {
    const rel = String(req.query.path || '').trim();
    if (!rel) return res.status(400).json({ success: false, message: 'Paramètre path requis' });
    const abs = safeDocAbsolutePath(rel);
    const content = await fs.promises.readFile(abs, 'utf8');
    res.json({ success: true, path: rel, content });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ success: false, message: 'Fichier non trouvé' });
    }
    console.error('Erreur lecture doc:', error);
    res.status(400).json({ success: false, message: error.message || 'Erreur' });
  }
});

// Écrire (créer/mettre à jour) un fichier .md
app.put('/api/admin/docs/content', authenticateAdmin, ensureAdmin, async (req, res) => {
  try {
    const rel = String((req.body && req.body.path) || '').trim();
    const content = String((req.body && req.body.content) || '');
    if (!rel) return res.status(400).json({ success: false, message: 'Paramètre path requis' });
    const abs = safeDocAbsolutePath(rel);
    // Créer le répertoire parent si nécessaire
    await fs.promises.mkdir(path.dirname(abs), { recursive: true });
    await fs.promises.writeFile(abs, content, 'utf8');
    const st = await fs.promises.stat(abs);
    res.json({ success: true, path: rel, size: st.size, mtime: st.mtimeMs });
  } catch (error) {
    console.error('Erreur écriture doc:', error);
    res.status(400).json({ success: false, message: error.message || 'Erreur' });
  }
});

// Supprimer un fichier .md
app.delete('/api/admin/docs/content', authenticateAdmin, ensureAdmin, async (req, res) => {
  try {
    const rel = String(req.query.path || '').trim();
    if (!rel) return res.status(400).json({ success: false, message: 'Paramètre path requis' });
    const abs = safeDocAbsolutePath(rel);
    await fs.promises.unlink(abs);
    return res.json({ success: true, path: rel });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ success: false, message: 'Fichier non trouvé' });
    }
    console.error('Erreur suppression doc:', error);
    res.status(400).json({ success: false, message: error.message || 'Erreur' });
  }
});

// Récupérer les détails d'un ticket spécifique (admin)
app.get('/api/admin/tickets/:ticketId([0-9a-fA-F]{24})', authenticateAdmin, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.ticketId).populate('assignedTo', 'firstName lastName email role isActive');
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket non trouvé'
      });
    }
    
    // Récupérer l'historique des statuts
    const StatusUpdate = require('./models/status');
    const statusHistory = await StatusUpdate.find({ ticketId: ticket._id }).sort({ updatedAt: -1 });
    
    res.status(200).json({
      success: true,
      ticket,
      statusHistory
    });
    
  } catch (error) {
    console.error('Erreur lors de la récupération des détails du ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Une erreur est survenue lors de la récupération des détails du ticket'
    });
  }
});

// Endpoints d'assignation / assistance / escalade
app.post('/api/admin/tickets/:ticketId([0-9a-fA-F]{24})/assign', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { userId } = req.body || {};
    if (!userId) {
      return res.status(400).json({ success: false, message: "Paramètre 'userId' requis" });
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'Identifiant utilisateur invalide' });
    }

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket non trouvé' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur assigné introuvable' });
    }
    if (!['admin', 'agent'].includes(user.role)) {
      return res.status(400).json({ success: false, message: 'Le destinataire doit être admin ou agent' });
    }
    if (user.isActive === false) {
      return res.status(400).json({ success: false, message: 'Utilisateur inactif: assignation impossible' });
    }

    // Un agent ne peut assigner qu'à lui-même
    if (req.auth && req.auth.role === 'agent' && String(req.auth.id) !== String(user._id)) {
      return res.status(403).json({ success: false, message: "Un agent ne peut assigner un ticket qu'à lui-même" });
    }

    ticket.assignedTo = user._id;
    await ticket.save();
    const updated = await Ticket.findById(ticket._id).populate('assignedTo', 'firstName lastName email role isActive');

    // Notification email (non bloquante)
    try {
      await sendAssignmentEmail(updated, user);
    } catch (e) {
      console.error('[assign] Erreur envoi email assignation:', e && e.message ? e.message : e);
    }

    // Créer une notification in‑app pour l'utilisateur assigné (non bloquante)
    try {
      await Notification.create({
        userId: user._id,
        type: 'assignment',
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        title: 'Nouveau ticket assigné',
        message: `Le ticket ${ticket.ticketNumber} vous a été assigné.`
      });
    } catch (e) {
      console.error('[assign] Erreur création notification:', e && e.message ? e.message : e);
    }

    return res.json({ success: true, ticket: updated });
  } catch (error) {
    console.error('Erreur lors de l\'assignation du ticket:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur lors de l\'assignation' });
  }
});

app.post('/api/admin/tickets/:ticketId([0-9a-fA-F]{24})/assistance', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const message = (req.body && typeof req.body.message === 'string') ? req.body.message : '';

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket non trouvé' });
    }

    let byUser = null;
    try {
      if (req.auth && req.auth.id) {
        byUser = await User.findById(req.auth.id).select('email firstName lastName role isActive');
      }
    } catch (_) {}

    try {
      await sendAssistanceRequestEmail(ticket, byUser || { email: (req.auth && req.auth.email) || '' }, message);
    } catch (e) {
      console.error('[assistance] Erreur envoi email demande assistance:', e && e.message ? e.message : e);
    }
    // Notifier tous les administrateurs en in‑app (non bloquant)
    try {
      const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
      if (admins && admins.length) {
        const docs = admins.map(a => ({
          userId: a._id,
          type: 'assistance',
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber,
          title: 'Demande d’assistance',
          message: `Une demande d’assistance a été créée sur le ticket ${ticket.ticketNumber}.`
        }));
        await Notification.insertMany(docs, { ordered: false });
      }
    } catch (e) {
      console.error('[assistance] Erreur création notifications:', e && e.message ? e.message : e);
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Erreur lors de la demande d\'assistance:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur lors de la demande d\'assistance' });
  }
});

app.post('/api/admin/tickets/:ticketId([0-9a-fA-F]{24})/escalate', authenticateAdmin, ensureAdmin, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const reason = (req.body && typeof req.body.reason === 'string') ? req.body.reason.trim() : '';
    if (!reason) {
      return res.status(400).json({ success: false, message: "Paramètre 'reason' (raison) requis" });
    }

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket non trouvé' });
    }

    ticket.isEscalated = true;
    ticket.escalationReason = reason;
    await ticket.save();

    let byUser = null;
    try {
      if (req.auth && req.auth.id) {
        byUser = await User.findById(req.auth.id).select('email firstName lastName role isActive');
      }
    } catch (_) {}

    try {
      await sendEscalationEmail(ticket, reason, byUser || { email: (req.auth && req.auth.email) || '' });
    } catch (e) {
      console.error('[escalate] Erreur envoi email escalade:', e && e.message ? e.message : e);
    }
    // Notifier tous les administrateurs en in‑app (non bloquant)
    try {
      const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
      if (admins && admins.length) {
        const docs = admins.map(a => ({
          userId: a._id,
          type: 'escalation',
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber,
          title: 'Ticket escaladé',
          message: `Le ticket ${ticket.ticketNumber} a été escaladé.`
        }));
        await Notification.insertMany(docs, { ordered: false });
      }
    } catch (e) {
      console.error('[escalate] Erreur création notifications:', e && e.message ? e.message : e);
    }

    const updated = await Ticket.findById(ticket._id).populate('assignedTo', 'firstName lastName email role isActive');
    return res.json({ success: true, ticket: updated });

  } catch (error) {
    console.error('Erreur lors de l\'escalade du ticket:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur lors de l\'escalade' });
  }
});

// ===== Notifications (in‑app) =====
// Lister les notifications de l'utilisateur connecté
app.get('/api/admin/notifications', authenticateAdmin, async (req, res) => {
  try {
    const userId = req.auth && req.auth.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Non authentifié' });
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const notifications = await Notification.find({ userId })
      .sort({ isRead: 1, createdAt: -1 })
      .limit(limit)
      .lean();
    const unreadCount = await Notification.countDocuments({ userId, isRead: false });
    return res.json({ success: true, notifications, unreadCount });
  } catch (error) {
    console.error('Erreur lors de la liste des notifications:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Marquer comme lues des notifications (par liste d'ids) ou toutes
app.post('/api/admin/notifications/mark-read', authenticateAdmin, async (req, res) => {
  try {
    const userId = req.auth && req.auth.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Non authentifié' });
    const { ids = [], all = false } = req.body || {};
    if (!all && (!Array.isArray(ids) || ids.length === 0)) {
      return res.status(400).json({ success: false, message: 'Aucune notification à marquer comme lue' });
    }
    if (all) {
      await Notification.updateMany({ userId, isRead: false }, { $set: { isRead: true } });
    } else {
      const safeIds = ids.filter(id => typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/));
      if (safeIds.length === 0) {
        return res.status(400).json({ success: false, message: 'Identifiants invalides' });
      }
      await Notification.updateMany({ userId, _id: { $in: safeIds } }, { $set: { isRead: true } });
    }
    const unreadCount = await Notification.countDocuments({ userId, isRead: false });
    return res.json({ success: true, unreadCount });
  } catch (error) {
    console.error('Erreur lors du marquage des notifications:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Récupérer la liste des tickets (admin)
app.get('/api/admin/tickets', authenticateAdmin, async (req, res) => {
  try {
    // Débogage - Afficher les paramètres de requête
    console.log('Paramètres de requête reçus:', req.query);
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    // Si limit est explicitement 0, ne pas appliquer de limite
    const hasLimit = req.query.limit !== undefined && req.query.limit !== '';
    const parsedLimit = parseInt(req.query.limit);
    const limit = hasLimit ? (parsedLimit === 0 ? null : parsedLimit) : 10;
    const skip = (page - 1) * (limit || 0); // Utiliser 0 pour le calcul si limit est null
    
    // Préparer les conditions de filtre
    const conditions = [];
    
    // Filtres de base
    const baseFilter = {};
    if (req.query.status) baseFilter.currentStatus = req.query.status;
    if (req.query.partType) baseFilter['partInfo.partType'] = req.query.partType;
    if (req.query.priority) baseFilter.priority = req.query.priority;
    
    // Si nous avons des filtres de base, les ajouter aux conditions
    if (Object.keys(baseFilter).length > 0) {
      conditions.push(baseFilter);
    }
    
    // Filtre par numéro de ticket
    if (req.query.ticketNumber && req.query.ticketNumber.trim() !== '') {
      const ticketNumberValue = req.query.ticketNumber.trim();
      console.log('Recherche par numéro de ticket:', ticketNumberValue);
      
      // Utiliser une correspondance exacte pour le numéro de ticket
      // C'est plus fiable que l'expression régulière pour ce cas précis
      console.log('Utilisation d\'une correspondance exacte pour le numéro de ticket');
      
      // Ajouter le filtre directement sans utiliser d'expression régulière
      conditions.push({ ticketNumber: ticketNumberValue });
      
      // Log pour débogage
      console.log('Condition ajoutée pour le numéro de ticket:', { ticketNumber: ticketNumberValue });
    }
    
    // Filtre par numéro de commande
    if (req.query.orderNumber && req.query.orderNumber.trim() !== '') {
      const orderNumberValue = req.query.orderNumber.trim();
      console.log('Recherche par numéro de commande:', orderNumberValue);
      
      // Échapper les caractères spéciaux dans la recherche
      conditions.push({ 
        'orderInfo.orderNumber': new RegExp(orderNumberValue.replace(/[-\[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i') 
      });
    }
    
    // Filtre par prénom de client
    if (req.query.clientFirstName && req.query.clientFirstName.trim() !== '') {
      const clientFirstNameValue = req.query.clientFirstName.trim();
      console.log('Recherche par prénom de client:', clientFirstNameValue);
      
      // Échapper les caractères spéciaux dans la recherche
      const escapedClientFirstName = clientFirstNameValue.replace(/[-\[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      const clientFirstNameRegex = new RegExp(escapedClientFirstName, 'i');
      
      // Recherche dans le prénom
      conditions.push({ 'clientInfo.firstName': clientFirstNameRegex });
    }
    
    // Filtre par nom de client
    if (req.query.clientName && req.query.clientName.trim() !== '') {
      const clientNameValue = req.query.clientName.trim();
      console.log('Recherche par nom de client:', clientNameValue);
      
      // Échapper les caractères spéciaux dans la recherche
      const escapedClientName = clientNameValue.replace(/[-\[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      const clientNameRegex = new RegExp(escapedClientName, 'i');
      
      // Recherche dans le nom de famille uniquement
      conditions.push({ 'clientInfo.lastName': clientNameRegex });
    }
    
    // Filtres par date
    if (req.query.dateFrom || req.query.dateTo) {
      const dateFilter = {};
      
      if (req.query.dateFrom) {
        dateFilter.$gte = new Date(req.query.dateFrom);
      }
      
      if (req.query.dateTo) {
        // Ajouter un jour à dateTo pour inclure toute la journée
        const dateTo = new Date(req.query.dateTo);
        dateTo.setDate(dateTo.getDate() + 1);
        dateFilter.$lt = dateTo;
      }
      
      conditions.push({ createdAt: dateFilter });
    }
    
    // Filtre par date de mise à jour (pour le polling)
    if (req.query.updatedSince) {
      const updatedSinceDate = new Date(req.query.updatedSince);
      if (!isNaN(updatedSinceDate.getTime())) {
        conditions.push({ updatedAt: { $gt: updatedSinceDate } });
      }
    }
    
    // Recherche globale
    if (req.query.search && req.query.search.trim() !== '') {
      const searchRegex = new RegExp(req.query.search, 'i');
      conditions.push({
        $or: [
          { ticketNumber: searchRegex },
          { 'clientInfo.firstName': searchRegex },
          { 'clientInfo.lastName': searchRegex },
          { 'clientInfo.email': searchRegex },
          { 'vehicleInfo.vin': searchRegex },
          { 'vehicleInfo.registrationNumber': searchRegex },
          { 'orderInfo.orderNumber': searchRegex }
        ]
      });
    }
    
    // Construire le filtre final
    const filter = conditions.length > 0 ? { $and: conditions } : {};
    
    // Débogage - Afficher les filtres générés
    console.log('Filtres appliqués:', JSON.stringify(filter, null, 2));
    
    // Débogage - Afficher le nombre de conditions
    console.log(`Nombre de conditions appliquées: ${conditions.length}`);
    
    // Débogage - Vérifier les paramètres spécifiques
    if (req.query.ticketNumber) {
      console.log(`Filtre par numéro de ticket: ${req.query.ticketNumber}`);
    }
    if (req.query.orderNumber) {
      console.log(`Filtre par numéro de commande: ${req.query.orderNumber}`);
    }
    if (req.query.clientName) {
      console.log(`Filtre par nom de client: ${req.query.clientName}`);
    }
    
    // Exécuter la requête avec des logs détaillés
    console.log('Exécution de la requête avec les filtres suivants:', JSON.stringify(filter, null, 2));
    
    // Construire la requête de base
    let query = Ticket.find(filter).sort({ createdAt: -1 }).skip(skip);
    
    // N'appliquer la limite que si elle n'est pas null
    if (limit !== null) {
      query = query.limit(limit);
    }
    
    // Exécuter la requête
    const tickets = await query;
    
    console.log(`Nombre de tickets trouvés: ${tickets.length}`);
    
    if (tickets.length > 0 && req.query.ticketNumber) {
      console.log('Premier ticket trouvé:', tickets[0].ticketNumber);
      console.log('Numéro de ticket recherché:', req.query.ticketNumber);
    }
    
    // Compter le nombre total de tickets
    const total = await Ticket.countDocuments(filter);
    console.log(`Nombre total de tickets correspondant aux filtres: ${total}`);
    
    // Débogage - Afficher le nombre de résultats
    console.log(`Tickets trouvés: ${tickets.length} sur un total de ${total}`);
    if (tickets.length > 0) {
      console.log('Premier ticket:', tickets[0].ticketNumber);
    }
    
    res.status(200).json({
      success: true,
      tickets,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Erreur lors de la récupération des tickets:', error);
    res.status(500).json({
      success: false,
      message: 'Une erreur est survenue lors de la récupération des tickets'
    });
  }
});

// Récupérer les tickets qui ont reçu des réponses client depuis un instant donné
app.get('/api/admin/tickets/client-updates', authenticateAdmin, async (req, res) => {
  try {
    const { since } = req.query;
    if (!since) {
      return res.status(400).json({ success: false, message: "Paramètre 'since' requis (ISO date)" });
    }
    const sinceDate = new Date(since);
    if (isNaN(sinceDate.getTime())) {
      return res.status(400).json({ success: false, message: "Paramètre 'since' invalide" });
    }

    const StatusUpdate = require('./models/status');

    // Trouver les updates client depuis 'since' et regrouper par ticket pour ne garder que la plus récente
    const updates = await StatusUpdate.aggregate([
      { $match: { updatedBy: 'client', updatedAt: { $gt: sinceDate } } },
      { $sort: { updatedAt: -1 } },
      { $group: { _id: '$ticketId', lastUpdateAt: { $first: '$updatedAt' }, lastComment: { $first: '$comment' } } },
      { $lookup: { from: 'tickets', localField: '_id', foreignField: '_id', as: 'ticket' } },
      { $unwind: '$ticket' },
      { $project: {
          _id: 0,
          ticketId: '$_id',
          updatedAt: '$lastUpdateAt',
          comment: '$lastComment',
          ticketNumber: '$ticket.ticketNumber',
          currentStatus: '$ticket.currentStatus',
          priority: '$ticket.priority',
          clientFirstName: '$ticket.clientInfo.firstName',
          clientLastName: '$ticket.clientInfo.lastName'
        }
      }
    ]);

    res.status(200).json({ success: true, updates });
  } catch (error) {
    console.error('Erreur lors de la récupération des réponses client:', error);
    res.status(500).json({ success: false, message: "Une erreur est survenue lors de la récupération des réponses client" });
  }
});

// Récupérer tous les tickets actuellement en attente de réponse agent (dernière mise à jour client > dernière mise à jour admin)
app.get('/api/admin/tickets/awaiting-agent-response', authenticateAdmin, async (req, res) => {
  try {
    const StatusUpdate = require('./models/status');

    // Agrégation pour trouver, par ticket, la dernière MAJ client et la dernière MAJ admin
    const awaiting = await StatusUpdate.aggregate([
      {
        $group: {
          _id: '$ticketId',
          lastClientAt: {
            $max: {
              $cond: [{ $eq: ['$updatedBy', 'client'] }, '$updatedAt', null]
            }
          },
          lastAdminAt: {
            $max: {
              $cond: [{ $ne: ['$updatedBy', 'client'] }, '$updatedAt', null]
            }
          }
        }
      },
      {
        // Tickets où on a au moins une MAJ client et soit pas de MAJ admin, soit MAJ client plus récente
        $match: {
          lastClientAt: { $ne: null },
          $or: [
            { lastAdminAt: null },
            { $expr: { $gt: ['$lastClientAt', '$lastAdminAt'] } }
          ]
        }
      },
      { $lookup: { from: 'tickets', localField: '_id', foreignField: '_id', as: 'ticket' } },
      { $unwind: '$ticket' },
      {
        $project: {
          _id: 0,
          ticketId: '$_id',
          updatedAt: '$lastClientAt',
          ticketNumber: '$ticket.ticketNumber',
          currentStatus: '$ticket.currentStatus',
          priority: '$ticket.priority',
          clientFirstName: '$ticket.clientInfo.firstName',
          clientLastName: '$ticket.clientInfo.lastName'
        }
      },
      { $sort: { updatedAt: -1 } }
    ]);

    res.status(200).json({ success: true, awaiting });
  } catch (error) {
    console.error('Erreur lors de la récupération des tickets en attente de réponse agent:', error);
    res.status(500).json({ success: false, message: "Une erreur est survenue lors de la récupération des tickets en attente de réponse agent" });
  }
});

// Mettre à jour le statut d'un ticket (admin)
// Route pour mettre à jour les champs professionalInstallation et oilFilled d'un ticket
app.post('/api/admin/tickets/:ticketId/update-boolean-fields', authenticateAdmin, async (req, res) => {
  try {
    const { professionalInstallation, oilFilled } = req.body;
    
    const ticket = await Ticket.findById(req.params.ticketId);
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket non trouvé'
      });
    }
    
    // Mise à jour des champs booléens avec une meilleure gestion des valeurs
    if (professionalInstallation !== undefined) {
      ticket.partInfo.professionalInstallation = professionalInstallation === true || 
                                                 professionalInstallation === 'true' || 
                                                 professionalInstallation === 'on' || 
                                                 professionalInstallation === '1' || 
                                                 professionalInstallation === 'yes' || 
                                                 professionalInstallation === 'oui';
    }
    
    if (oilFilled !== undefined) {
      ticket.partInfo.oilFilled = oilFilled === true || 
                                  oilFilled === 'true' || 
                                  oilFilled === 'on' || 
                                  oilFilled === '1' || 
                                  oilFilled === 'yes' || 
                                  oilFilled === 'oui';
    }
    
    await ticket.save();
    
    res.status(200).json({
      success: true,
      message: 'Champs booléens mis à jour avec succès',
      ticket
    });
    
  } catch (error) {
    console.error('Erreur lors de la mise à jour des champs booléens:', error);
    res.status(500).json({
      success: false,
      message: 'Une erreur est survenue lors de la mise à jour des champs booléens'
    });
  }
});

app.post('/api/admin/tickets/:ticketId/status', authenticateAdmin, async (req, res) => {
  const routeTag = '[POST /api/admin/tickets/:ticketId/status]';
  try {
    console.log(`${routeTag} Requête reçue`, {
      params: req.params,
      body: {
        status: req.body?.status,
        comment: req.body?.comment,
        additionalInfoRequested: req.body?.additionalInfoRequested,
        clientNotified: req.body?.clientNotified,
        priority: req.body?.priority,
        updatedBy: req.body?.updatedBy
      },
      auth: req?.auth ? { user: req.auth.email || req.auth.username, role: req.auth.role } : null
    });

    const { status, comment, additionalInfoRequested, clientNotified, priority } = req.body || {};

    // Valider l'ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.ticketId)) {
      console.warn(`${routeTag} ticketId invalide`, req.params.ticketId);
      return res.status(400).json({ success: false, message: 'ticketId invalide' });
    }

    // Vérifier si le ticket existe
    let ticket;
    try {
      ticket = await Ticket.findById(req.params.ticketId);
    } catch (findErr) {
      console.error(`${routeTag} Erreur lors de la recherche du ticket:`, findErr);
      return res.status(500).json({ success: false, message: 'Erreur lors de la recherche du ticket', details: findErr.message });
    }
    if (!ticket) {
      console.warn(`${routeTag} Ticket non trouvé`, req.params.ticketId);
      return res.status(404).json({ success: false, message: 'Ticket non trouvé' });
    }

    // Créer la mise à jour de statut
    let statusUpdate;
    try {
      statusUpdate = new StatusUpdate({
        ticketId: ticket._id,
        status,
        comment,
        additionalInfoRequested: additionalInfoRequested || undefined,
        clientNotified: clientNotified === true,
        updatedBy: req.body?.updatedBy || 'admin'
      });
      await statusUpdate.save();
      console.log(`${routeTag} StatusUpdate créé`, { id: statusUpdate._id.toString() });
    } catch (suErr) {
      console.error(`${routeTag} Erreur lors de l'enregistrement du StatusUpdate:`, suErr);
      if (suErr.name === 'ValidationError') {
        return res.status(400).json({ success: false, message: 'Validation StatusUpdate', errors: suErr.errors });
      }
      return res.status(500).json({ success: false, message: 'Erreur lors de l\'enregistrement du statut', details: suErr.message });
    }

    // Mettre à jour le ticket
    try {
      if (status) ticket.currentStatus = status;
      if (priority && ['faible', 'moyen', 'élevé', 'urgent'].includes(priority)) {
        ticket.priority = priority;
      }
      if (comment) ticket.internalNotes = ticket.internalNotes ? `${ticket.internalNotes}\n${comment}` : comment;
      await ticket.save();
      console.log(`${routeTag} Ticket mis à jour`, { id: ticket._id.toString(), currentStatus: ticket.currentStatus, priority: ticket.priority });
    } catch (ticketErr) {
      console.error(`${routeTag} Erreur lors de la sauvegarde du ticket:`, ticketErr);
      return res.status(500).json({ success: false, message: 'Erreur lors de la sauvegarde du ticket', details: ticketErr.message });
    }

    // Envoyer un email au client si demandé (non bloquant)
    if (clientNotified === true) {
      try {
        const info = await sendStatusUpdateEmail(ticket, status, comment);
        if (info) {
          console.log(`${routeTag} Email de notification envoyé au client ${ticket.clientInfo.email} pour le ticket ${ticket.ticketNumber}`);
        } else {
          console.warn(`${routeTag} Envoi de l'email de notification échoué pour ${ticket.clientInfo.email} (ticket ${ticket.ticketNumber})`);
        }
      } catch (emailError) {
        console.error(`${routeTag} Erreur lors de l'envoi de l'email:`, emailError);
        // Ne pas bloquer la mise à jour du ticket si l'email échoue
      }
    }

    res.status(200).json({
      success: true,
      message: 'Statut du ticket mis à jour avec succès',
      ticket,
      statusUpdate
    });

  } catch (error) {
    console.error(`${routeTag} Erreur inattendue:`, error);
    res.status(500).json({
      success: false,
      message: 'Une erreur est survenue lors de la mise à jour du statut',
      details: error?.message
    });
  }
});

// Enregistrer/mettre à jour les notes internes d'un ticket (admin/agent)
app.post('/api/admin/tickets/:ticketId/notes', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    const rawId = req.params.ticketId;
    const notes = (req.body && typeof req.body.notes === 'string') ? req.body.notes : '';

    if (typeof notes !== 'string') {
      return res.status(400).json({ success: false, message: 'Format de notes invalide' });
    }

    let ticket = null;
    // Accepter soit un ObjectId, soit un numéro de ticket CPF-...
    if (mongoose.Types.ObjectId.isValid(rawId)) {
      ticket = await Ticket.findById(rawId);
    } else if (rawId && rawId.startsWith('CPF-')) {
      ticket = await Ticket.findOne({ ticketNumber: rawId });
    }

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket non trouvé' });
    }

    ticket.internalNotes = notes;
    await ticket.save();

    return res.json({ success: true, message: 'Notes internes mises à jour', ticket });
  } catch (error) {
    console.error('Erreur lors de la mise à jour des notes internes:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur lors de la mise à jour des notes internes' });
  }
});

// Route pour ajouter des informations complémentaires à un ticket existant
app.post('/api/tickets/additional-info', upload.array('files', 10), async (req, res) => {
  try {
    console.log('Requête d\'informations complémentaires reçue:', req.body);
    console.log('Fichiers reçus:', req.files);
    
    const { ticketNumber, message } = req.body;
    
    console.log('ticketNumber:', ticketNumber);
    console.log('message:', message);
    // Heuristique simple: si l'admin téléverse des pièces via l'interface admin,
    // le message est préfixé par "[Admin]". Dans ce cas, on NE crée PAS de StatusUpdate
    // supplémentaire ici (car la route admin a déjà créé une mise à jour),
    // afin d'éviter le doublon côté suivi client.
    const isAdminMessage = typeof message === 'string' && message.trim().startsWith('[Admin]');
    
    if (!ticketNumber) {
      console.log('Erreur: Numéro de ticket manquant');
      return res.status(400).json({ success: false, message: 'Numéro de ticket requis' });
    }
    
    // Rechercher le ticket existant avec la dernière version
    const ticket = await Ticket.findOne({ ticketNumber });
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket non trouvé' });
    }
    
    // Traiter les fichiers téléchargés
    const uploadedFiles = [];
    if (req.files && req.files.length > 0) {
      console.log(`Traitement de ${req.files.length} fichiers téléchargés...`);
      for (const file of req.files) {
        let storedPath = '';
        if (S3_ENABLED) {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          const ext = path.extname(file.originalname);
          const key = `${file.fieldname}-${uniqueSuffix}${ext}`;
          try {
            await uploadBuffer(key, file.mimetype, file.buffer);
            storedPath = `/uploads/${key}`;
          } catch (upErr) {
            console.error('[upload+info] Erreur upload R2:', upErr && upErr.message ? upErr.message : upErr);
            throw upErr;
          }
        } else {
          storedPath = file.path;
        }
        const newDocument = {
          fileName: sanitizeFileName(file.originalname),  // Nom de fichier nettoyé
          filePath: storedPath,         // Chemin public (local) ou URL proxy (/uploads/key) en S3
          fileType: file.mimetype,     // Utiliser le même format que pour les documents initiaux
          type: 'documents_autres',    // Utiliser une valeur autorisée dans l'énumération
          uploadedBy: isAdminMessage ? 'admin' : 'client',
          uploadDate: new Date(),
          size: file.size
        };
        uploadedFiles.push(newDocument);
        console.log(`Fichier traité: ${file.originalname}, chemin: ${storedPath}`);
      }
      
      // Ajouter les nouveaux fichiers au ticket
      if (!ticket.documents) {
        ticket.documents = [];
      }
      console.log(`Ajout de ${uploadedFiles.length} documents au ticket. Avant: ${ticket.documents.length} documents`);
      ticket.documents = [...ticket.documents, ...uploadedFiles];
      console.log(`Après: ${ticket.documents.length} documents`);
    }
    
    // Créer une mise à jour de statut UNIQUEMENT pour une réponse CLIENT (pas pour l'admin)
    if (!isAdminMessage) {
      console.log('Création de la mise à jour de statut (réponse client)...');
      try {
        const statusUpdate = new StatusUpdate({
          ticketId: ticket._id,
          status: ticket.currentStatus, // Conserver le statut actuel
          comment: `Informations complémentaires reçues du client: ${message || 'Aucun message'}`,
          updatedBy: 'client',
          clientNotified: false
        });
        console.log('Sauvegarde de la mise à jour de statut...');
        await statusUpdate.save();
        console.log('Mise à jour de statut sauvegardée avec succès');
      } catch (error) {
        console.error('Erreur lors de la création de la mise à jour de statut pour informations complémentaires:', error);
        return res.status(500).json({ success: false, message: 'Erreur lors de l\'enregistrement des informations complémentaires' });
      }
    } else {
      console.log('Téléversement initié par un administrateur détecté ([Admin]); aucune StatusUpdate supplémentaire créée pour éviter les doublons.');
    }

    // Sauvegarder le ticket avec les nouveaux documents (sans dupliquer l'ajout)
    console.log('Sauvegarde du ticket avec les nouveaux documents...');
    try {
      // Mise à jour directe: les fichiers ont déjà été ajoutés à ticket.documents ci-dessus
      await Ticket.findByIdAndUpdate(ticket._id, { documents: ticket.documents });
      console.log('Ticket sauvegardé avec succès');
    } catch (saveError) {
      if (saveError.name === 'VersionError') {
        console.log('Erreur de version détectée, récupération de la dernière version du ticket...');
        const result = await Ticket.findOneAndUpdate(
          { ticketNumber }, 
          { $push: { documents: { $each: uploadedFiles } } },
          { new: true, runValidators: true }
        );
        if (!result) {
          throw new Error('Ticket non trouvé après erreur de version');
        }
        console.log(`Documents ajoutés avec succès. Total documents: ${result.documents.length}`);
        console.log('Ticket sauvegardé avec succès après résolution de l\'erreur de version');
      } else {
        // Si ce n'est pas une erreur de version, relancer l'erreur
        throw saveError;
      }
    }
    
    // Envoyer un email au service SAV pour notifier des nouvelles informations
    // Note: cette fonction devrait être implémentée dans emailService.js
    // sendClientResponseEmail(ticket, message, uploadedFiles);
    
    res.json({ 
      success: true, 
      message: 'Informations complémentaires ajoutées avec succès',
      ticket: ticket
    });
    
  } catch (error) {
    console.error('Erreur lors de l\'ajout d\'informations complémentaires:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur lors de l\'ajout d\'informations complémentaires' });
  }
});

// Route pour supprimer un ticket (admin uniquement)
app.delete('/api/admin/tickets/:ticketId', authenticateAdmin, async (req, res) => {
  try {
    const ticketId = req.params.ticketId;
    console.log('Tentative de suppression du ticket avec ID:', ticketId);
    console.log('URL de la requête:', req.originalUrl);
    console.log('Méthode de la requête:', req.method);
    console.log('Headers de la requête:', req.headers);
    
    // Vérifier si l'ID est un ObjectId MongoDB valide
    const isValidObjectId = mongoose.Types.ObjectId.isValid(ticketId);
    console.log('L\'ID est-il un ObjectId MongoDB valide ?', isValidObjectId);
    
    let ticket;
    
    if (isValidObjectId) {
      // Recherche par ID MongoDB
      console.log('Recherche du ticket par ID MongoDB...');
      ticket = await Ticket.findById(ticketId);
    } else {
      // Si l'ID n'est pas un ObjectId valide, essayer de chercher par numéro de ticket
      console.log('ID non valide, tentative de recherche par numéro de ticket...');
      if (ticketId.startsWith('CPF-')) {
        ticket = await Ticket.findOne({ ticketNumber: ticketId });
      } else {
        console.error('Format d\'identifiant non reconnu:', ticketId);
        return res.status(400).json({
          success: false,
          message: 'Format d\'identifiant non reconnu'
        });
      }
    }
    
    // Afficher quelques tickets pour débogage
    const allTickets = await Ticket.find({}).limit(5);
    console.log('Exemple de tickets disponibles:', allTickets.map(t => ({ 
      id: t._id.toString(), 
      number: t.ticketNumber 
    })));
    
    if (!ticket) {
      console.log('Ticket non trouvé avec identifiant:', ticketId);
      return res.status(404).json({
        success: false,
        message: 'Ticket non trouvé'
      });
    }
    
    console.log('Ticket trouvé:', ticket.ticketNumber, 'avec ID:', ticket._id.toString());
    
    console.log('Ticket trouvé, suppression de l\'historique des statuts...');
    // Supprimer également l'historique des statuts associé au ticket
    await StatusUpdate.deleteMany({ ticketId: ticketId });
    
    console.log('Suppression du ticket...');
    // Supprimer le ticket
    await Ticket.findByIdAndDelete(ticketId);
    
    console.log('Ticket supprimé avec succès');
    res.status(200).json({
      success: true,
      message: 'Ticket supprimé avec succès'
    });
    
  } catch (error) {
    console.error('Erreur lors de la suppression du ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Une erreur est survenue lors de la suppression du ticket'
    });
  }
});

// Initialiser les routes de statistiques pour le dashboard
setupStatsRoutes(app, authenticateAdmin);

// Gestionnaire global d'erreurs pour renvoyer un JSON propre (notamment pour Multer)
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error('MulterError:', err);
    // 413 Payload Too Large
    return res.status(413).json({
      success: false,
      message: `Fichier trop volumineux. Limite ${MAX_FILE_SIZE_MB}MB`,
      code: err.code
    });
  }
  if (err) {
    console.error('Erreur non gérée:', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
  next();
});

// Démarrer le watcher SLA (rappels 20h / alertes 24h)
try {
  startSlaWatcher();
} catch (e) {
  console.error('[slaWatcher] non démarré:', e);
}

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur le port ${PORT}`);
});

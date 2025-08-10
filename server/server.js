const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const connectDB = require('./db');
const Ticket = require('./models/ticket');
const StatusUpdate = require('./models/status');
const User = require('./models/user');
const ResponseTemplate = require('./models/responseTemplate');
const bcrypt = require('bcryptjs');
const { sendStatusUpdateEmail, sendTicketCreationEmail } = require('./services/emailService');
const setupStatsRoutes = require('./stats-api');
require('dotenv').config();

// Initialisation de l'application Express
const app = express();
const PORT = process.env.PORT || 3000;
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

// Configuration de multer pour le téléchargement de fichiers
const storage = multer.diskStorage({
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
  storage: storage,
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

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, '../')));
app.use('/uploads', express.static(uploadsDir));
app.use('/admin', express.static(path.join(__dirname, '../admin')));
app.use('/tracking', express.static(path.join(__dirname, '../tracking')));

// Health check (statut et DB)
app.get('/healthz', (req, res) => {
  const dbState = mongoose.connection && typeof mongoose.connection.readyState !== 'undefined'
    ? mongoose.connection.readyState
    : -1;
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    db: dbState // 1 = connected, 2 = connecting, 0 = disconnected
  });
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
      
      req.files.forEach((file, index) => {
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
        
        ticketData.documents.push({
          type: documentType,
          fileName: file.originalname,
          filePath: file.path,
          fileType: file.mimetype,
          uploadDate: new Date()
        });
      });
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

// Récupérer les détails d'un ticket spécifique (admin)
app.get('/api/admin/tickets/:ticketId([0-9a-fA-F]{24})', authenticateAdmin, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.ticketId);
    
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

// Route pour ajouter des informations complémentaires à un ticket existant
app.post('/api/tickets/additional-info', upload.array('files', 10), async (req, res) => {
  try {
    console.log('Requête d\'informations complémentaires reçue:', req.body);
    console.log('Fichiers reçus:', req.files);
    
    const { ticketNumber, message } = req.body;
    
    console.log('ticketNumber:', ticketNumber);
    console.log('message:', message);
    
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
        const newDocument = {
          fileName: file.originalname,  // Utiliser le même format que pour les documents initiaux
          filePath: file.path,         // Utiliser le même format que pour les documents initiaux
          fileType: file.mimetype,     // Utiliser le même format que pour les documents initiaux
          type: 'documents_autres',    // Utiliser une valeur autorisée dans l'énumération
          uploadDate: new Date(),
          size: file.size
        };
        uploadedFiles.push(newDocument);
        console.log(`Fichier traité: ${file.originalname}, chemin: ${file.path}`);
      }
      
      // Ajouter les nouveaux fichiers au ticket
      if (!ticket.documents) {
        ticket.documents = [];
      }
      console.log(`Ajout de ${uploadedFiles.length} documents au ticket. Avant: ${ticket.documents.length} documents`);
      ticket.documents = [...ticket.documents, ...uploadedFiles];
      console.log(`Après: ${ticket.documents.length} documents`);
    }
    
    // Créer une mise à jour de statut pour enregistrer les informations complémentaires
    console.log('Création de la mise à jour de statut...');
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
      
      console.log('Sauvegarde du ticket avec les nouveaux documents...');
      try {
        // Désactiver la vérification de version pour éviter les erreurs de version
        // Mettre à jour directement le document en utilisant findByIdAndUpdate au lieu de la méthode increment() qui n'existe pas
        ticket.documents = [...ticket.documents, ...uploadedFiles]; // Ajouter les documents au tableau existant
        await Ticket.findByIdAndUpdate(ticket._id, { documents: ticket.documents });
        console.log('Ticket sauvegardé avec succès');
      } catch (saveError) {
        if (saveError.name === 'VersionError') {
          // En cas d'erreur de version, récupérer la version la plus récente du ticket et réappliquer les modifications
          console.log('Erreur de version détectée, récupération de la dernière version du ticket...');
          // Utiliser findOneAndUpdate pour éviter les erreurs de version
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
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      throw error; // Relancer l'erreur pour qu'elle soit capturée par le bloc catch principal
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

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur le port ${PORT}`);
});

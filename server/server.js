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
const Documentation = require('./models/documentation');
const Order = require('./models/order');
const bcrypt = require('bcryptjs');
// Assurer la disponibilité de fetch côté serveur (Node < 18)
let fetch = global.fetch;
if (!fetch) {
  try { fetch = require('undici').fetch; } catch (_) {}
}

// Détection auto: commande susceptible d'exiger des références techniques (méca/TCU)
function detectTechRefFromItems(items) {
  try {
    if (!Array.isArray(items) || items.length === 0) return false;
    const keywords = [
      'mecatron', 'mécatron', 'mechatron', 'tcu', 'boite', 'boîte', 'gearbox', 'mechatronics',
      'dq200', 'dq250', 'dq381', '0am', '0cw', '0am927', '0am 927', '0am-927'
    ];
    for (const it of items) {
      const name = String(it?.name || '').toLowerCase();
      const sku = String(it?.sku || '').toLowerCase();
      for (const k of keywords) {
        if (name.includes(k) || sku.includes(k)) return true;
      }
    }
    return false;
  } catch { return false; }
}

// Détection du type de produit (mécatronique/TCU, pont, boîte de transfert, moteur, autres)
function detectProductTypeFromItems(items) {
  try {
    if (!Array.isArray(items) || items.length === 0) return 'autres';
    const norm = (s) => String(s || '').toLowerCase();
    // Groupes de mots-clés par catégorie (priorité: méca/TCU > pont > boîte transfert > moteur)
    const kw = {
      mecatronique_tcu: [
        'mecatron', 'mécatron', 'mechatron', 'mechatronic', 'mechatronics',
        'tcu', 'dq200', 'dq250', 'dq381', '0am', '0cq', '0cw', '0am927', '0am 927', '0am-927',
        '0am927769', '0am927769d'
      ],
      pont: [ 'pont', 'differential', 'différentiel', 'differentiel', 'diff ', 'diff-' ],
      boite_transfert: [ 'boite de transfert', 'boîte de transfert', 'transfer case', 'atc', 'xdrive', 'nvg', 'vg ' ],
      moteur: [ 'moteur', 'engine', 'bloc moteur', 'block engine', 'block moteur', 'mtr ' ]
    };
    const containsAny = (text, keys) => keys.some(k => text.includes(k));
    for (const it of items) {
      const name = norm(it?.name);
      const sku = norm(it?.sku);
      const text = `${name} ${sku}`;
      if (containsAny(text, kw.mecatronique_tcu)) return 'mecatronique_tcu';
      if (containsAny(text, kw.pont)) return 'pont';
      if (containsAny(text, kw.boite_transfert)) return 'boite_transfert';
      if (containsAny(text, kw.moteur)) return 'moteur';
    }
    return 'autres';
  } catch { return 'autres'; }
}
const { sendStatusUpdateEmail, sendTicketCreationEmail, sendAssignmentEmail, sendAssistanceRequestEmail, sendEscalationEmail, sendSlaReminderEmail, sendPasswordResetEmail } = require('./services/emailService');
const setupStatsRoutes = require('./stats-api');
const { authenticateAdmin: adminAuthMW } = require('./middleware/auth');
const { startSlaWatcher } = require('./jobs/slaWatcher');
require('dotenv').config();
const { isS3Enabled, uploadBuffer, streamToResponse } = require('./services/storage');

// Initialisation de l'application Express
const app = express();
const PORT = process.env.PORT || 3001;
const WEBSITE_URL = (process.env.WEBSITE_URL && process.env.WEBSITE_URL.trim()) || `http://localhost:${PORT}`;
const ORDERS_SYNC_ENABLED = String(process.env.ORDERS_SYNC_ENABLED || 'false').toLowerCase() === 'true';
const ORDERS_SYNC_INTERVAL_MINUTES = parseInt(process.env.ORDERS_SYNC_INTERVAL_MINUTES || '15', 10);
// L'application est derrière un proxy (Railway/Render)
app.set('trust proxy', 1);

// Connexion à MongoDB
connectDB();

// Quand la connexion DB est ouverte, lancer l'import auto si nécessaire
mongoose.connection.once('open', () => {
  try { autoImportDocsFromFSIfEmpty(); } catch (_) {}
  // Recalcul rétroactif automatique des références requises sur anciennes commandes
  try {
    rebuildTechnicalRefsInternal()
      .then(({ scanned, updated }) => {
        console.log(`[techref] Rétroactif terminé: ${updated} mise(s) à jour sur ${scanned} commande(s)`);
      })
      .catch((e) => console.warn('[techref] Rétroactif: erreur non bloquante', e?.message || e));
  } catch(_) {}
  // Recalcul rétroactif automatique du type de produit (pour tri/filtre UI)
  try {
    rebuildProductTypeInternal()
      .then(({ scanned, updated }) => {
        console.log(`[ptype] Rétroactif terminé: ${updated} mise(s) à jour sur ${scanned} commande(s)`);
      })
      .catch((e) => console.warn('[ptype] Rétroactif: erreur non bloquante', e?.message || e));
  } catch(_) {}
});

// (Route diagnostics/env déplacée plus bas après définition des middlewares)

// (Route DELETE déplacée plus bas après définition des middlewares)

// (Route déplacée plus bas après définition des middlewares)

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

// Fonction interne: recalculer en base les références techniques requises (rétroactif)
async function rebuildTechnicalRefsInternal() {
  let scanned = 0;
  let updated = 0;
  const cursor = Order.find({}, { items: 1, meta: 1 }).cursor();
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    scanned++;
    const items = Array.isArray(doc.items) ? doc.items : [];
    const needs = detectTechRefFromItems(items);
    const alreadyTrue = !!(doc.meta && doc.meta.technicalRefRequired === true);
    if (needs && !alreadyTrue) {
      doc.meta = doc.meta || {};
      doc.meta.technicalRefRequired = true;
      doc.events = doc.events || [];
      doc.events.push({ type: 'technical_ref_required_set', message: 'Référence technique requise (rétroactif auto)', at: new Date() });
      await doc.save();
      updated++;
    }
  }
  return { scanned, updated };
}

// Fonction interne: recalculer en base le type de produit à partir des items
async function rebuildProductTypeInternal() {
  let scanned = 0;
  let updated = 0;
  const cursor = Order.find({}, { items: 1, meta: 1 }).cursor();
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    scanned++;
    const items = Array.isArray(doc.items) ? doc.items : [];
    const ptype = detectProductTypeFromItems(items);
    const hasMeta = !!doc.meta && typeof doc.meta === 'object';
    const current = hasMeta ? doc.meta.productType : undefined;
    if (current !== ptype) {
      doc.meta = doc.meta || {};
      doc.meta.productType = ptype;
      doc.events = doc.events || [];
      doc.events.push({ type: 'product_type_set', message: `Type produit = ${ptype}`, at: new Date() });
      await doc.save();
      updated++;
    }
  }
  return { scanned, updated };
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
app.use(express.json({
  verify: (req, res, buf) => {
    try {
      // Conserver le body brut pour WooCommerce (signature HMAC)
      if (req.originalUrl && req.originalUrl.startsWith('/api/webhooks/woocommerce')) {
        req.rawBody = Buffer.from(buf);
      }
    } catch (_) {}
  }
}));
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

// Synchroniser toutes les commandes WooCommerce (pagination complète)
async function syncWooAllOrders() {
  try {
    const base = (process.env.WOOCOMMERCE_BASE_URL || '').trim();
    const ck = (process.env.WOOCOMMERCE_CONSUMER_KEY || '').trim();
    const cs = (process.env.WOOCOMMERCE_CONSUMER_SECRET || '').trim();
    if (!base || !ck || !cs) throw new Error('Variables WooCommerce manquantes');
    let page = 1;
    const perPage = 25; // réduire davantage pour fiabiliser en prod (Railway)
    let processed = 0;
    for (;;) {
      const baseUrl = `${base.replace(/\/$/, '')}/wp-json/wc/v3/orders?per_page=${perPage}&page=${page}&orderby=date&order=desc`;
      const headers = { 'Authorization': `Basic ${base64(`${ck}:${cs}`)}`, 'Accept': 'application/json', 'User-Agent': 'CarPartsSAV/1.0' };
      let resp = await fetch(baseUrl, { headers });
      if (!resp.ok) {
        const alt = `${base.replace(/\/$/, '')}/wp-json/wc/v3/orders?consumer_key=${encodeURIComponent(ck)}&consumer_secret=${encodeURIComponent(cs)}&per_page=${perPage}&page=${page}&orderby=date&order=desc`;
        resp = await fetch(alt, { headers: { 'Accept': 'application/json', 'User-Agent': 'CarPartsSAV/1.0' } });
        if (!resp.ok) {
          // backoff 1s puis 2e tentative en alt
          await new Promise(r => setTimeout(r, 1000));
          resp = await fetch(alt, { headers: { 'Accept': 'application/json', 'User-Agent': 'CarPartsSAV/1.0' } });
        }
      }
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        console.warn('[orders-sync-full] Woo HTTP', resp.status, txt);
        break;
      }
      const list = await resp.json().catch(() => []);
      if (!Array.isArray(list) || list.length === 0) break;
      for (const payload of list) {
        const wooId = String(payload.id || payload.resource_id || '').trim();
        if (!wooId) continue;
        const internalStatus = mapWooStatusToInternal(payload.status);
        const amount = parseFloat((payload.total || payload.total_due || '0').toString());
        const currency = (payload.currency || 'EUR').toString();
        const wooCreatedRaw = payload.date_created_gmt || payload.date_created || null;
        const wooUpdatedRaw = payload.date_modified_gmt || payload.date_modified || null;
        const wooCreated = wooCreatedRaw ? new Date(wooCreatedRaw) : null;
        const wooUpdated = wooUpdatedRaw ? new Date(wooUpdatedRaw) : null;
        const customer = payload.billing ? {
          name: `${payload.billing.first_name || ''} ${payload.billing.last_name || ''}`.trim(),
          email: payload.billing.email || '',
          phone: payload.billing.phone || ''
        } : { name: '', email: '', phone: '' };
        const items = Array.isArray(payload.line_items) ? payload.line_items.map(li => ({
          sku: li.sku || '',
          name: li.name || '',
          qty: li.quantity || 0,
          unitPrice: parseFloat((li.price || li.total || 0).toString())
        })) : [];
        const productType = detectProductTypeFromItems(items);
        const billingAddress = payload.billing ? {
          name: `${payload.billing.first_name || ''} ${payload.billing.last_name || ''}`.trim(),
          company: payload.billing.company || '',
          address1: payload.billing.address_1 || '',
          address2: payload.billing.address_2 || '',
          city: payload.billing.city || '',
          postcode: payload.billing.postcode || '',
          country: payload.billing.country || '',
          email: payload.billing.email || '',
          phone: payload.billing.phone || ''
        } : null;
        const shippingAddress = payload.shipping ? {
          name: `${payload.shipping.first_name || ''} ${payload.shipping.last_name || ''}`.trim(),
          company: payload.shipping.company || '',
          address1: payload.shipping.address_1 || '',
          address2: payload.shipping.address_2 || '',
          city: payload.shipping.city || '',
          postcode: payload.shipping.postcode || '',
          country: payload.shipping.country || '',
          phone: payload.shipping.phone || (payload.billing?.phone || '')
        } : null;
        const update = {
          provider: 'woocommerce',
          providerOrderId: wooId,
          number: payload.number ? String(payload.number) : undefined,
          status: internalStatus,
          customer,
          totals: { currency, amount: isNaN(amount) ? 0 : amount },
          items,
          events: [{ type: 'woo_sync_full', message: `Full sync Woo status=${payload.status}`, payloadSnippet: { id: wooId, status: payload.status } }],
          ...(wooCreated ? { 'meta.sourceCreatedAt': wooCreated } : {}),
          ...(wooUpdated ? { 'meta.sourceUpdatedAt': wooUpdated } : {}),
          ...(billingAddress ? { 'billing.address': billingAddress } : {}),
          ...(shippingAddress ? { 'shipping.address': shippingAddress } : {})
        };
        update['meta.productType'] = productType;
        // VIN/Plaque depuis meta_data / lignes / note client
        let vinMeta = null;
        try { vinMeta = extractVinFromWooOrder(payload); } catch {}
        // Fallback: si non trouvé, charger le détail de la commande (liste tronque parfois les métadonnées)
        if (!vinMeta || !vinMeta.value) {
          try {
            const detail = await fetchWooOrderDetail(base, ck, cs, wooId);
            const v2 = extractVinFromWooOrder(detail);
            if (v2 && v2.value) vinMeta = v2;
          } catch { /* ignore */ }
        }
        if (vinMeta && vinMeta.value) {
          update['meta.vinOrPlate'] = vinMeta.value;
          if (vinMeta.key) update['meta.wooVinMetaKey'] = vinMeta.key;
          if (vinMeta.id) update['meta.wooVinMetaId'] = String(vinMeta.id);
        }
        const setOnInsert = wooCreated ? { createdAt: wooCreated } : {};
        // Définir le flag de référence technique requise uniquement à la création (respect du toggle manuel ensuite)
        try {
          const autoFlag = detectTechRefFromItems(items);
          if (autoFlag) setOnInsert['meta.technicalRefRequired'] = true;
        } catch {}
        const ops = { $set: update, $setOnInsert: setOnInsert };
        await Order.updateOne(
          { provider: 'woocommerce', providerOrderId: wooId },
          ops,
          { upsert: true }
        );
      }
      processed += list.length;
      console.log(`[orders-sync-full] Page ${page} -> ${list.length} commande(s)`);
      page += 1;
      await new Promise(r => setTimeout(r, 300)); // petite pause pour éviter le rate-limit
    }
    console.log(`[orders-sync-full] Terminé. Total importé/actualisé: ${processed}`);
    return { processed };
  } catch (e) {
    console.error('[orders-sync-full] Erreur', e && e.message ? e.message : e);
    throw e;
  }
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

// Helpers WooCommerce
async function wooUpdateOrder(wooOrderId, wooPayload) {
  const base = (process.env.WOOCOMMERCE_BASE_URL || '').trim();
  const ck = (process.env.WOOCOMMERCE_CONSUMER_KEY || '').trim();
  const cs = (process.env.WOOCOMMERCE_CONSUMER_SECRET || '').trim();
  if (!base || !ck || !cs) throw new Error('Config WooCommerce manquante');
  const url = `${base.replace(/\/$/, '')}/wp-json/wc/v3/orders/${encodeURIComponent(String(wooOrderId))}`;
  const headersPut = { 'Authorization': `Basic ${base64(`${ck}:${cs}`)}`, 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'CarPartsSAV/1.0' };
  let resp = await fetch(url, { method: 'PUT', headers: headersPut, body: JSON.stringify(wooPayload) });
  if (!resp.ok) {
    const alt = `${url}?consumer_key=${encodeURIComponent(ck)}&consumer_secret=${encodeURIComponent(cs)}`;
    resp = await fetch(alt, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'CarPartsSAV/1.0' }, body: JSON.stringify(wooPayload) });
  }
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`Woo update HTTP ${resp.status}: ${txt}`);
  }
  return await resp.json();
}

// Récupérer le détail d'une commande Woo (contient meta_data complet, notes, etc.)
async function fetchWooOrderDetail(base, ck, cs, wooOrderId) {
  const baseClean = base.replace(/\/$/, '');
  const headers = { 'Authorization': `Basic ${base64(`${ck}:${cs}`)}`, 'Accept': 'application/json', 'User-Agent': 'CarPartsSAV/1.0' };
  let resp = await fetch(`${baseClean}/wp-json/wc/v3/orders/${encodeURIComponent(wooOrderId)}`, { headers });
  if (!resp.ok) {
    const alt = `${baseClean}/wp-json/wc/v3/orders/${encodeURIComponent(wooOrderId)}?consumer_key=${encodeURIComponent(ck)}&consumer_secret=${encodeURIComponent(cs)}`;
    resp = await fetch(alt, { headers: { 'Accept': 'application/json', 'User-Agent': 'CarPartsSAV/1.0' } });
  }
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`Woo order detail HTTP ${resp.status}: ${txt}`);
  }
  return await resp.json();
}

function splitName(fullName) {
  const s = String(fullName || '').trim();
  if (!s) return { first_name: '', last_name: '' };
  const parts = s.split(/\s+/);
  if (parts.length === 1) return { first_name: parts[0], last_name: '' };
  const last = parts.pop();
  return { first_name: parts.join(' '), last_name: last };
}

// Extraire un VIN ou une plaque depuis un texte libre (ex: "VIN: WVWZZZ...")
function extractVinOrPlateFromText(text) {
  try {
    const str = String(text ?? '').trim();
    if (!str) return null;
    // Chercher un VIN n'importe où dans la chaîne
    const vinMatch = str.match(/([A-HJ-NPR-Z0-9]{17})/i); // exclut I, O, Q
    if (vinMatch && vinMatch[1]) {
      return { type: 'vin', value: vinMatch[1].toUpperCase() };
    }
    // Chercher une plaque FR AA-123-AA (avec ou sans tirets)
    const plateMatch = str.match(/\b([A-Z]{2}-?\d{3}-?[A-Z]{2})\b/i);
    if (plateMatch && plateMatch[1]) {
      // Normaliser en AA-123-AA
      const raw = plateMatch[1].toUpperCase().replace(/[^A-Z0-9]/g, '');
      return { type: 'plate', value: `${raw.slice(0,2)}-${raw.slice(2,5)}-${raw.slice(5,7)}` };
    }
    return null;
  } catch { return null; }
}

// Extraire VIN / Plaque depuis les meta WooCommerce
function extractVinFromWooMeta(metaArr) {
  try {
    if (!Array.isArray(metaArr)) return null;
    const norm = (s) => String(s || '').toLowerCase();
    const normKey = (s) => norm(s).replace(/[^a-z0-9]/g, '');
    const isUrl = (v) => /^(https?:\/\/|www\.)/i.test(v) || v.includes('://') || /\/(product|wp-|\?|#)/i.test(v);
    const looksVin = (v) => /^[A-HJ-NPR-Z0-9]{17}$/i.test(String(v).replace(/\s/g, ''));
    const looksFrPlate = (v) => /\b[A-Z]{2}-?\d{3}-?[A-Z]{2}\b/i.test(String(v).replace(/\s/g, ''));
    const keywordKeys = [
      'vin', 'vin_', 'vinclient', 'vinplaque', 'vinouplaque', 'vinimmatriculation',
      'plaque', 'immatriculation', 'numeroimmatriculation',
      'registration', 'licenseplate', 'numberplate', 'vehiclevin', 'vehiculevin'
    ];
    const keyIncludes = ['vin', 'immatric', 'plaque', 'registration', 'license', 'plate'];

    let best = null;
    let bestScore = -1;
    for (const m of metaArr) {
      const rawKey = m?.key ?? m?.display_key ?? '';
      const keyL = norm(rawKey);
      const keyN = normKey(rawKey);
      const rawVal = m?.value;
      let val = '';
      if (rawVal == null) val = '';
      else if (typeof rawVal === 'string' || typeof rawVal === 'number' || typeof rawVal === 'boolean') val = String(rawVal);
      else if (Array.isArray(rawVal)) val = rawVal.map(x => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ');
      else if (typeof rawVal === 'object') val = JSON.stringify(rawVal);
      val = String(val).trim();
      if (!val) continue;
      if (isUrl(val)) continue; // ignorer URLs et referrers

      const byExactKey = keywordKeys.some(k => keyN === normKey(k));
      const byKeyInclude = keyIncludes.some(k => keyL.includes(k));
      const foundInText = extractVinOrPlateFromText(val);
      const byVin = looksVin(val) || (foundInText?.type === 'vin');
      const byPlate = looksFrPlate(val) || (foundInText?.type === 'plate');

      // Scoring: clé exacte + contenu trouvé > clé indicative + contenu > détection brute
      let score = -1;
      if (byExactKey && (byVin || byPlate)) score = 110;
      else if (byExactKey) score = 100;
      else if (byKeyInclude && (byVin || byPlate)) score = 90;
      else if (byKeyInclude) score = 80;
      if (byVin) score = Math.max(score, 78);
      if (byPlate) score = Math.max(score, 68);
      if (score < 0) continue; // rien d'assez fiable

      // Préférence: si clé parle de vin/plaque mais valeur trop longue, on filtre
      if ((byExactKey || byKeyInclude) && val.length > 64) continue;

      let chosen = val;
      if (foundInText && foundInText.value) chosen = foundInText.value; // extraire proprement "VIN: XXXXX"
      if (score > bestScore) {
        bestScore = score;
        best = { key: rawKey || 'vin_or_plaque', id: m.id != null ? String(m.id) : undefined, value: chosen };
      }
    }
    return best;
  } catch { return null; }
}

// Chercher VIN/plaques dans les meta des lignes d'articles
function extractVinFromWooLineItems(lineItems) {
  try {
    if (!Array.isArray(lineItems)) return null;
    for (const li of lineItems) {
      const metas = Array.isArray(li?.meta_data) ? li.meta_data : [];
      const found = extractVinFromWooMeta(metas);
      if (found && found.value) return found;
      // Essayer aussi dans le nom de la ligne
      const fromName = extractVinOrPlateFromText(li?.name || '');
      if (fromName) return { key: 'line_item_name', value: fromName.value };
    }
    return null;
  } catch { return null; }
}

// Orchestrateur: extrait depuis order.meta_data, lignes et customer_note
function extractVinFromWooOrder(payload) {
  try {
    // 1) meta_data de la commande
    const a = extractVinFromWooMeta(payload?.meta_data);
    if (a && a.value) return a;
    // 2) meta_data des lignes (ou nom)
    const b = extractVinFromWooLineItems(payload?.line_items);
    if (b && b.value) return b;
    // 3) note client
    const c0 = extractVinOrPlateFromText(payload?.customer_note || '');
    if (c0 && c0.value) return { key: 'customer_note', value: c0.value };
    // 4) à défaut, tenter certains champs texte
    const d0 = extractVinOrPlateFromText(payload?.billing?.company || '');
    if (d0 && d0.value) return { key: 'billing.company', value: d0.value };
    const d1 = extractVinOrPlateFromText(payload?.shipping?.company || '');
    if (d1 && d1.value) return { key: 'shipping.company', value: d1.value };
    return null;
  } catch { return null; }
}
// Mise à jour d'une commande (et sync Woo si provider=woocommerce)
app.put('/api/admin/orders/:id', adminAuthMW, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable' });

    const body = req.body || {};
    const next = { events: order.events || [] };

    // Customer
    if (body.customer && typeof body.customer === 'object') {
      order.customer = order.customer || {};
      if (typeof body.customer.name === 'string') order.customer.name = body.customer.name;
      if (typeof body.customer.email === 'string') order.customer.email = body.customer.email;
      if (typeof body.customer.phone === 'string') order.customer.phone = body.customer.phone;
    }

    // Billing address
    if (body.billing && typeof body.billing === 'object' && body.billing.address) {
      order.billing = order.billing || {};
      order.billing.address = body.billing.address;
    }

    // Shipping address
    if (body.shipping && typeof body.shipping === 'object' && body.shipping.address) {
      order.shipping = order.shipping || {};
      order.shipping.address = body.shipping.address;
    }

    // Estimated delivery date (optionnelle)
    if (body.shipping && typeof body.shipping === 'object' && 'estimatedDeliveryAt' in body.shipping) {
      order.shipping = order.shipping || {};
      const raw = body.shipping.estimatedDeliveryAt;
      if (typeof raw === 'string') {
        const s = raw.trim();
        if (s) {
          // Accepte 'YYYY-MM-DD' ou ISO
          const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00.000Z` : s;
          const d = new Date(iso);
          if (!isNaN(d.getTime())) {
            order.shipping.estimatedDeliveryAt = d;
            next.events.push({ type: 'estimated_delivery_set', message: `Livraison estimée: ${d.toISOString().slice(0,10)}`, at: new Date() });
          }
        } else {
          // Vide => suppression
          order.shipping.estimatedDeliveryAt = undefined;
          next.events.push({ type: 'estimated_delivery_unset', message: 'Livraison estimée retirée', at: new Date() });
        }
      }
    }

    // VIN / Plaque (métadonnée interne et Woo)
    let vinFromBody;
    if (body.meta && typeof body.meta === 'object' && typeof body.meta.vinOrPlate === 'string') {
      vinFromBody = body.meta.vinOrPlate.trim();
      order.meta = order.meta || {};
      order.meta.vinOrPlate = vinFromBody;
    }

    // Références techniques (mécatronique/TCU)
    if (body.meta && typeof body.meta === 'object') {
      order.meta = order.meta || {};
      if (typeof body.meta.engineDisplacement === 'string') {
        const prev = order.meta.engineDisplacement || '';
        const nextVal = body.meta.engineDisplacement.trim();
        order.meta.engineDisplacement = nextVal;
        if (nextVal !== prev) next.events.push({ type: 'technical_ref_updated', message: `Cylindrée: ${nextVal || '—'}`, at: new Date() });
      }
      if (typeof body.meta.tcuReference === 'string') {
        const prev = order.meta.tcuReference || '';
        const nextVal = body.meta.tcuReference.trim().toUpperCase();
        order.meta.tcuReference = nextVal;
        if (nextVal !== prev) next.events.push({ type: 'technical_ref_updated', message: `TCU: ${nextVal || '—'}`, at: new Date() });
      }
      if (typeof body.meta.technicalRefRequired === 'boolean') {
        const prev = !!order.meta.technicalRefRequired;
        const nextVal = !!body.meta.technicalRefRequired;
        order.meta.technicalRefRequired = nextVal;
        if (nextVal !== prev) next.events.push({ type: 'technical_ref_required_set', message: nextVal ? 'Référence technique requise' : 'Référence technique non requise', at: new Date() });
      }
    }

    // Préparer push Woo si applicable
    if (order.provider === 'woocommerce' && order.providerOrderId) {
      const billingAddr = body.billing?.address || order.billing?.address || {};
      const shippingAddr = body.shipping?.address || order.shipping?.address || {};
      const nameForBilling = (body.customer?.name) || billingAddr.name || order.customer?.name || '';
      const splitBill = splitName(nameForBilling);
      const wooPayload = {
        billing: {
          first_name: splitBill.first_name,
          last_name: splitBill.last_name,
          company: billingAddr.company || '',
          address_1: billingAddr.address1 || '',
          address_2: billingAddr.address2 || '',
          city: billingAddr.city || '',
          postcode: billingAddr.postcode || '',
          country: billingAddr.country || '',
          email: (body.customer?.email) || order.customer?.email || '',
          phone: (body.customer?.phone) || order.customer?.phone || ''
        },
        shipping: {
          first_name: (shippingAddr.name ? splitName(shippingAddr.name).first_name : splitBill.first_name),
          last_name: (shippingAddr.name ? splitName(shippingAddr.name).last_name : splitBill.last_name),
          company: shippingAddr.company || '',
          address_1: shippingAddr.address1 || '',
          address_2: shippingAddr.address2 || '',
          city: shippingAddr.city || '',
          postcode: shippingAddr.postcode || '',
          country: shippingAddr.country || ''
        }
      };

      // Inclure meta_data si vin/plaque fourni
      if (typeof vinFromBody === 'string') {
        const metaArr = [];
        const keyToUse = (order.meta?.wooVinMetaKey) || 'vin_or_plaque';
        const idToUse = order.meta?.wooVinMetaId ? Number(order.meta.wooVinMetaId) : undefined;
        const metaEntry = { key: keyToUse, value: vinFromBody };
        if (!Number.isNaN(idToUse) && idToUse) metaEntry.id = idToUse;
        metaArr.push(metaEntry);
        wooPayload.meta_data = metaArr;
      }

      // Envoyer vers Woo d'abord, sinon on ne sauvegarde pas localement pour éviter les écarts
      const wooResp = await wooUpdateOrder(order.providerOrderId, wooPayload);
      // Mettre à jour les dates source si renvoyées
      try {
        const wooCreated = wooResp.date_created_gmt || wooResp.date_created || null;
        const wooUpdated = wooResp.date_modified_gmt || wooResp.date_modified || null;
        order.meta = order.meta || {};
        if (wooCreated) order.meta.sourceCreatedAt = new Date(wooCreated);
        if (wooUpdated) order.meta.sourceUpdatedAt = new Date(wooUpdated);
        // Actualiser vin/plaque et méta id/key depuis la réponse (meta, lignes, note)
        const metaFromResp = extractVinFromWooOrder(wooResp);
        if (metaFromResp && metaFromResp.value) {
          order.meta.vinOrPlate = metaFromResp.value;
          order.meta.wooVinMetaKey = metaFromResp.key || order.meta.wooVinMetaKey || 'vin_or_plaque';
          if (metaFromResp.id) order.meta.wooVinMetaId = metaFromResp.id;
        }
      } catch {}
      next.events.push({ type: 'woo_update_pushed', message: 'Mise à jour envoyée à Woo', payloadSnippet: { id: order.providerOrderId } });
    }

    next.events.push({ type: 'order_updated_admin', message: 'Commande modifiée par admin' });
    order.events = next.events;
    await order.save();
    res.json({ success: true, order });
  } catch (e) {
    console.error('[orders:update] erreur', e);
    res.status(500).json({ success: false, message: e.message || 'Erreur serveur' });
  }
});

// --- Job de secours: resynchronisation périodique des commandes (Woo & Mollie) ---
function base64(str) { return Buffer.from(str, 'utf8').toString('base64'); }

async function syncWooRecentOrders() {
  try {
    const base = (process.env.WOOCOMMERCE_BASE_URL || '').trim();
    const ck = (process.env.WOOCOMMERCE_CONSUMER_KEY || '').trim();
    const cs = (process.env.WOOCOMMERCE_CONSUMER_SECRET || '').trim();
    if (!base || !ck || !cs) return;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const url = `${base.replace(/\/$/, '')}/wp-json/wc/v3/orders?after=${encodeURIComponent(since)}&per_page=20&orderby=date&order=desc`;
    const headers2 = { 'Authorization': `Basic ${base64(`${ck}:${cs}`)}`, 'Accept': 'application/json', 'User-Agent': 'CarPartsSAV/1.0' };
    let resp = await fetch(url, { headers: headers2 });
    if (!resp.ok) {
      const url2 = `${base.replace(/\/$/, '')}/wp-json/wc/v3/orders?consumer_key=${encodeURIComponent(ck)}&consumer_secret=${encodeURIComponent(cs)}&after=${encodeURIComponent(since)}&per_page=20&orderby=date&order=desc`;
      resp = await fetch(url2, { headers: { 'Accept': 'application/json', 'User-Agent': 'CarPartsSAV/1.0' } });
      if (!resp.ok) {
        await new Promise(r => setTimeout(r, 1000));
        resp = await fetch(url2, { headers: { 'Accept': 'application/json', 'User-Agent': 'CarPartsSAV/1.0' } });
      }
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      console.warn('[orders-sync] Woo HTTP', resp.status, txt);
      return;
    }
    const list = await resp.json().catch(() => []);
    if (!Array.isArray(list) || list.length === 0) return;
    for (const payload of list) {
      const wooId = String(payload.id || payload.resource_id || '').trim();
      if (!wooId) continue;
      const internalStatus = mapWooStatusToInternal(payload.status);
      const amount = parseFloat((payload.total || payload.total_due || '0').toString());
      const currency = (payload.currency || 'EUR').toString();
      const wooCreatedRaw = payload.date_created_gmt || payload.date_created || null;
      const wooUpdatedRaw = payload.date_modified_gmt || payload.date_modified || null;
      const wooCreated = wooCreatedRaw ? new Date(wooCreatedRaw) : null;
      const wooUpdated = wooUpdatedRaw ? new Date(wooUpdatedRaw) : null;
      const customer = payload.billing ? {
        name: `${payload.billing.first_name || ''} ${payload.billing.last_name || ''}`.trim(),
        email: payload.billing.email || '',
        phone: payload.billing.phone || ''
      } : { name: '', email: '', phone: '' };
      const items = Array.isArray(payload.line_items) ? payload.line_items.map(li => ({
        sku: li.sku || '',
        name: li.name || '',
        qty: li.quantity || 0,
        unitPrice: parseFloat((li.price || li.total || 0).toString())
      })) : [];
      const billingAddress2 = payload.billing ? {
        name: `${payload.billing.first_name || ''} ${payload.billing.last_name || ''}`.trim(),
        company: payload.billing.company || '',
        address1: payload.billing.address_1 || '',
        address2: payload.billing.address_2 || '',
        city: payload.billing.city || '',
        postcode: payload.billing.postcode || '',
        country: payload.billing.country || '',
        email: payload.billing.email || '',
        phone: payload.billing.phone || ''
      } : null;
      const shippingAddress2 = payload.shipping ? {
        name: `${payload.shipping.first_name || ''} ${payload.shipping.last_name || ''}`.trim(),
        company: payload.shipping.company || '',
        address1: payload.shipping.address_1 || '',
        address2: payload.shipping.address_2 || '',
        city: payload.shipping.city || '',
        postcode: payload.shipping.postcode || '',
        country: payload.shipping.country || '',
        phone: payload.shipping.phone || (payload.billing?.phone || '')
      } : null;
      const update = {
        provider: 'woocommerce',
        providerOrderId: wooId,
        number: payload.number ? String(payload.number) : undefined,
        status: internalStatus,
        customer,
        totals: { currency, amount: isNaN(amount) ? 0 : amount },
        items,
        events: [{ type: 'woo_sync', message: `Sync Woo status=${payload.status}`, payloadSnippet: { id: wooId, status: payload.status } }],
        ...(wooCreated ? { 'meta.sourceCreatedAt': wooCreated } : {}),
        ...(wooUpdated ? { 'meta.sourceUpdatedAt': wooUpdated } : {}),
        ...(billingAddress2 ? { 'billing.address': billingAddress2 } : {}),
        ...(shippingAddress2 ? { 'shipping.address': shippingAddress2 } : {})
      };
      const productType2 = detectProductTypeFromItems(items);
      update['meta.productType'] = productType2;
      // VIN/Plaque depuis meta_data / lignes / note client
      let vinMeta2 = null;
      try { vinMeta2 = extractVinFromWooOrder(payload); } catch {}
      if (!vinMeta2 || !vinMeta2.value) {
        try {
          const detail2 = await fetchWooOrderDetail(base, ck, cs, wooId);
          const v3 = extractVinFromWooOrder(detail2);
          if (v3 && v3.value) vinMeta2 = v3;
        } catch { /* ignore */ }
      }
      if (vinMeta2 && vinMeta2.value) {
        update['meta.vinOrPlate'] = vinMeta2.value;
        if (vinMeta2.key) update['meta.wooVinMetaKey'] = vinMeta2.key;
        if (vinMeta2.id) update['meta.wooVinMetaId'] = String(vinMeta2.id);
      }
      const setOnInsert = wooCreated ? { createdAt: wooCreated } : {};
      try {
        const autoFlag = detectTechRefFromItems(items);
        if (autoFlag) setOnInsert['meta.technicalRefRequired'] = true;
      } catch {}
      const ops2 = { $set: update, $setOnInsert: setOnInsert };
      await Order.updateOne(
        { provider: 'woocommerce', providerOrderId: wooId },
        ops2,
        { upsert: true }
      );
    }
    console.log(`[orders-sync] Woo: ${list.length} commande(s) synchronisées`);
  } catch (e) {
    console.error('[orders-sync] Woo erreur', e && e.message ? e.message : e);
  }
}

async function syncMollieRecentPayments() {
  try {
    const key = (process.env.MOLLIE_API_KEY || '').trim();
    if (!key) return;
    const resp = await fetch('https://api.mollie.com/v2/payments?limit=50', {
      headers: { 'Authorization': `Bearer ${key}` }
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      console.warn('[orders-sync] Mollie HTTP', resp.status, txt);
      return;
    }
    const data = await resp.json().catch(() => ({}));
    const list = Array.isArray(data._embedded?.payments) ? data._embedded.payments : [];
    if (list.length === 0) return;
    for (const p of list) {
      if (!p || !p.id) continue;
      let order = await Order.findOne({ 'payment.molliePaymentId': p.id });
      const amountValue = parseFloat(p.amount?.value || '0');
      if (!order) {
        order = new Order({
          provider: 'mollie',
          status: mapMollieStatusToInternal(p.status),
          totals: { currency: p.amount?.currency || 'EUR', amount: isNaN(amountValue) ? 0 : amountValue },
          payment: {
            method: `mollie:${p.method || 'link'}`,
            molliePaymentId: p.id,
            mollieMode: p.mode,
            mollieStatus: p.status,
            paidAt: p.paidAt ? new Date(p.paidAt) : undefined
          },
          customer: {
            name: p.consumerName || '',
            email: (p.billingEmail || p.email) || ''
          },
          events: [{ type: 'mollie_sync_create', message: 'Commande créée par sync Mollie', payloadSnippet: { id: p.id, status: p.status } }]
        });
        await order.save();
      } else {
        order.payment = order.payment || {};
        order.payment.method = `mollie:${p.method || 'link'}`;
        order.payment.molliePaymentId = p.id;
        order.payment.mollieMode = p.mode;
        order.payment.mollieStatus = p.status;
        if (p.paidAt) order.payment.paidAt = new Date(p.paidAt);
        order.status = mapMollieStatusToInternal(p.status);
        order.events = order.events || [];
        order.events.push({ type: 'mollie_sync_update', message: 'Mise à jour par sync Mollie', payloadSnippet: { id: p.id, status: p.status } });
        await order.save();
      }
    }
    console.log(`[orders-sync] Mollie: ${list.length} paiement(s) synchronisés`);
  } catch (e) {
    console.error('[orders-sync] Mollie erreur', e && e.message ? e.message : e);
  }
}

async function runOrdersSync() {
  await Promise.allSettled([
    syncWooRecentOrders(),
    syncMollieRecentPayments()
  ]);
}

if (ORDERS_SYNC_ENABLED) {
  // Lancer au démarrage (après connexion DB) et ensuite périodiquement
  mongoose.connection.once('open', () => {
    setTimeout(() => { try { runOrdersSync(); } catch(_) {} }, 2000);
  });
  setInterval(() => { try { runOrdersSync(); } catch(_) {} }, Math.max(1, ORDERS_SYNC_INTERVAL_MINUTES) * 60 * 1000);
  console.log(`[orders-sync] Activé (intervalle: ${ORDERS_SYNC_INTERVAL_MINUTES} min)`);
}

// Renseigner l'expédition et marquer comme expédiée (déplacée plus bas après authenticateAdmin)
// app.post('/api/admin/orders/:id/ship', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
//   try {
//     const order = await Order.findById(req.params.id);
//     if (!order) return res.status(404).json({ success: false, message: 'Commande non trouvée' });
//     const { carrier, trackingNumber, address } = req.body || {};
//     order.shipping = order.shipping || {};
//     if (address && typeof address === 'object') order.shipping.address = address;
//     if (carrier) order.shipping.carrier = String(carrier);
//     if (trackingNumber) order.shipping.trackingNumber = String(trackingNumber);
//     order.shipping.shippedAt = new Date();
//     order.status = 'fulfilled';
//     order.events = order.events || [];
//     order.events.push({ type: 'order_shipped', message: 'Commande expédiée', payloadSnippet: { carrier: order.shipping.carrier, trackingNumber: order.shipping.trackingNumber } });
//     await order.save();
//     res.json({ success: true, order });
//   } catch (e) {
//     console.error('[orders:ship] erreur', e);
//     res.status(500).json({ success: false, message: 'Erreur serveur' });
//   }
// });

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

// Diagnostic des variables d'environnement (ADMIN uniquement)
app.get('/api/admin/diagnostics/env', authenticateAdmin, ensureAdmin, (req, res) => {
  const mask = (v, start = 2, end = 4) => {
    if (!v) return '';
    const s = String(v);
    if (s.length <= start + end) return '*'.repeat(Math.max(4, s.length));
    return s.slice(0, start) + '***' + s.slice(-end);
  };
  const maskUri = (uri) => {
    if (!uri) return '';
    try {
      const u = new URL(uri);
      const host = u.host;
      const db = (u.pathname || '').replace(/^\//, '');
      return `${u.protocol}//${host}/${db ? db : ''}`;
    } catch {
      return mask(uri, 4, 4);
    }
  };
  const envOut = {
    NODE_ENV: process.env.NODE_ENV || '',
    WEBSITE_URL: process.env.WEBSITE_URL || '',
    CORS_ORIGIN: process.env.CORS_ORIGIN || '',
    WOOCOMMERCE_BASE_URL: process.env.WOOCOMMERCE_BASE_URL || '',
    WOOCOMMERCE_CONSUMER_KEY: mask(process.env.WOOCOMMERCE_CONSUMER_KEY || ''),
    WOOCOMMERCE_CONSUMER_SECRET: mask(process.env.WOOCOMMERCE_CONSUMER_SECRET || ''),
    ORDERS_SYNC_ENABLED: process.env.ORDERS_SYNC_ENABLED || '',
    ORDERS_SYNC_INTERVAL_MINUTES: process.env.ORDERS_SYNC_INTERVAL_MINUTES || '',
    STORAGE_DRIVER: process.env.STORAGE_DRIVER || '',
    UPLOADS_DIR: process.env.UPLOADS_DIR || '',
    MONGODB_URI: maskUri(process.env.MONGODB_URI || ''),
  };
  const present = Object.fromEntries(Object.entries(envOut).map(([k, v]) => [k, !!(v && String(v).length > 0)]));
  res.json({ success: true, env: envOut, present });
});

// Diagnostic de l'API WooCommerce (ADMIN uniquement)
app.get('/api/admin/diagnostics/woo', authenticateAdmin, ensureAdmin, async (req, res) => {
  const base = (process.env.WOOCOMMERCE_BASE_URL || '').trim();
  const ck = (process.env.WOOCOMMERCE_CONSUMER_KEY || '').trim();
  const cs = (process.env.WOOCOMMERCE_CONSUMER_SECRET || '').trim();
  const present = { base: !!base, ck: !!ck, cs: !!cs };
  let urlUsed = null; let method = null; let status = null; let bodySnippet = '';
  try {
    if (!present.base || !present.ck || !present.cs) {
      return res.json({ success: false, message: 'Variables WooCommerce manquantes', present });
    }
    const baseUrl = `${base.replace(/\/$/, '')}/wp-json/wc/v3/orders?per_page=1&orderby=date&order=desc`;
    urlUsed = baseUrl; method = 'basic';
    let r = await fetch(baseUrl, { headers: { 'Authorization': `Basic ${base64(`${ck}:${cs}`)}`, 'Accept': 'application/json', 'User-Agent': 'CarPartsSAV/1.0' } });
    status = r.status;
    if (!r.ok) {
      const alt = `${base.replace(/\/$/, '')}/wp-json/wc/v3/orders?consumer_key=${encodeURIComponent(ck)}&consumer_secret=${encodeURIComponent(cs)}&per_page=1&orderby=date&order=desc`;
      urlUsed = alt; method = 'query';
      r = await fetch(alt, { headers: { 'Accept': 'application/json', 'User-Agent': 'CarPartsSAV/1.0' } });
      status = r.status;
    }
    const txt = await r.text().catch(() => '');
    bodySnippet = (txt || '').slice(0, 600);
    return res.json({ success: true, present, method, status, urlUsed, bodySnippetLength: bodySnippet.length, bodySnippet });
  } catch (e) {
    return res.json({ success: false, present, method, status, urlUsed, error: (e && e.message) || String(e) });
  }
});

// Supprimer une commande (ADMIN uniquement)
app.delete('/api/admin/orders/:id', authenticateAdmin, ensureAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'ID invalide' });
    }
    const order = await Order.findById(id).lean();
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable' });
    await Order.findByIdAndDelete(id);
    return res.json({ success: true });
  } catch (e) {
    console.error('[orders:delete] erreur', e);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Recalculer les références requises (rétroactif) sur toutes les commandes existantes
app.post('/api/admin/orders/rebuild-technical-refs', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    let scanned = 0;
    let updated = 0;
    const cursor = Order.find({}, { items: 1, meta: 1 }).cursor();
    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
      scanned++;
      const items = Array.isArray(doc.items) ? doc.items : [];
      const needs = detectTechRefFromItems(items);
      const alreadyTrue = !!(doc.meta && doc.meta.technicalRefRequired === true);
      if (needs && !alreadyTrue) {
        doc.meta = doc.meta || {};
        doc.meta.technicalRefRequired = true;
        doc.events = doc.events || [];
        doc.events.push({ type: 'technical_ref_required_set', message: 'Référence technique requise (rétroactif)', at: new Date() });
        await doc.save();
        updated++;
      }
    }
    res.json({ success: true, scanned, updated });
  } catch (e) {
    console.error('[orders:rebuild-techref] erreur', e);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
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
const DOCS_STORAGE = (process.env.DOCS_STORAGE || 'db').toLowerCase();

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

// Normaliser et sécuriser un chemin relatif de documentation pour stockage en base
function sanitizeDocRelPath(relPath = '') {
  const raw = String(relPath || '').trim();
  if (!raw) throw new Error('Paramètre path requis');
  // retirer les slashes initiaux
  const noLead = raw.replace(/^\/+/, '');
  // normaliser et utiliser des slashes POSIX
  const normalizedFS = path.normalize(noLead);
  const normalized = normalizedFS.replace(/\\/g, '/');
  if (normalized.includes('..')) {
    throw new Error('Chemin invalide');
  }
  if (!normalized.toLowerCase().endsWith('.md')) {
    throw new Error('Seuls les fichiers .md sont autorisés');
  }
  return normalized;
}

// Lister récursivement les fichiers .md (fallback FS)
async function listMarkdownFilesRecursive(dir, basePrefix = '') {
  const out = [];
  let entries = [];
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    const abs = path.join(dir, ent.name);
    const rel = path.join(basePrefix, ent.name);
    if (ent.isDirectory()) {
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
      } catch {}
    }
  }
  out.sort((a, b) => a.path.localeCompare(b.path));
  return out;
}

// Import automatique des docs FS vers DB si collection vide et stockage DB activé
async function autoImportDocsFromFSIfEmpty() {
  try {
    if (DOCS_STORAGE !== 'db') return;
    const count = await Documentation.estimatedDocumentCount();
    if (count > 0) return;
    const list = await listMarkdownFilesRecursive(docsBaseDir, '');
    if (!list || list.length === 0) return;
    let imported = 0;
    for (const f of list) {
      const abs = safeDocAbsolutePath(f.path);
      let content = '';
      try { content = await fs.promises.readFile(abs, 'utf8'); } catch {}
      const size = Buffer.byteLength(String(content || ''), 'utf8');
      const name = path.basename(f.path);
      try {
        await Documentation.updateOne(
          { path: f.path },
          { $set: { path: f.path, name, content, size } },
          { upsert: true }
        );
        imported++;
      } catch (e) {
        // Ignorer les doublons éventuels en cas de concurrence de démarrage
        if (e && e.code === 11000) {
          continue;
        }
        throw e;
      }
    }
    console.log(`[docs] Import automatique terminé: ${imported} documents importés depuis admin/docs vers la DB`);
  } catch (e) {
    console.error('[docs] Échec import automatique FS->DB:', e && e.message ? e.message : e);
  }
}

// Lister les fichiers .md sous admin/docs
app.get('/api/admin/docs', authenticateAdmin, ensureAdmin, async (req, res) => {
  try {
    let files = [];
    if (DOCS_STORAGE === 'db') {
      const docs = await Documentation.find({}, 'path name size updatedAt content').sort({ path: 1 }).lean();
      files = docs.map(d => ({
        path: d.path,
        name: d.name,
        size: typeof d.size === 'number' ? d.size : Buffer.byteLength(String(d.content || ''), 'utf8'),
        mtime: d.updatedAt ? new Date(d.updatedAt).getTime() : Date.now()
      }));
      // Fallback: si la DB est vide, retourner le listing FS pour ne rien casser le premier chargement
      if (!files || files.length === 0) {
        files = await listMarkdownFilesRecursive(docsBaseDir, '');
      }
    } else {
      files = await listMarkdownFilesRecursive(docsBaseDir, '');
    }
    res.json({ success: true, files });
  } catch (error) {
    console.error('Erreur listage docs:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Version publique (lecture seule) pour la page #docs
app.get('/api/docs', async (req, res) => {
  try {
    let files = [];
    if (DOCS_STORAGE === 'db') {
      const docs = await Documentation.find({}, 'path name size updatedAt content').sort({ path: 1 }).lean();
      files = docs.map(d => ({
        path: d.path,
        name: d.name,
        size: typeof d.size === 'number' ? d.size : Buffer.byteLength(String(d.content || ''), 'utf8'),
        mtime: d.updatedAt ? new Date(d.updatedAt).getTime() : Date.now()
      }));
    } else {
      files = await listMarkdownFilesRecursive(docsBaseDir, '');
    }
    res.json({ success: true, files });
  } catch (error) {
    console.error('Erreur listage docs (public):', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Lire le contenu d'un fichier .md
app.get('/api/admin/docs/content', authenticateAdmin, ensureAdmin, async (req, res) => {
  try {
    const rel = sanitizeDocRelPath(req.query.path || '');
    if (DOCS_STORAGE === 'db') {
      let doc = await Documentation.findOne({ path: rel }).lean();
      if (!doc) {
        // Fallback: tenter de lire depuis le FS puis insérer en DB pour ne pas casser l'UX
        try {
          const abs = safeDocAbsolutePath(rel);
          const content = await fs.promises.readFile(abs, 'utf8');
          const size = Buffer.byteLength(content, 'utf8');
          const name = path.basename(rel);
          await Documentation.updateOne(
            { path: rel },
            { $set: { path: rel, name, content, size } },
            { upsert: true }
          );
          return res.json({ success: true, path: rel, content });
        } catch (_) {
          return res.status(404).json({ success: false, message: 'Fichier non trouvé' });
        }
      }
      return res.json({ success: true, path: rel, content: String(doc.content || '') });
    } else {
      const abs = safeDocAbsolutePath(rel);
      const content = await fs.promises.readFile(abs, 'utf8');
      return res.json({ success: true, path: rel, content });
    }
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
    const rel = sanitizeDocRelPath((req.body && req.body.path) || '');
    const content = String((req.body && req.body.content) || '');
    const name = path.basename(rel);
    if (DOCS_STORAGE === 'db') {
      const size = Buffer.byteLength(content, 'utf8');
      const now = new Date();
      const updated = await Documentation.findOneAndUpdate(
        { path: rel },
        { $set: { path: rel, name, content, size, updatedAt: now } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      return res.json({ success: true, path: rel, size: updated.size || size, mtime: updated.updatedAt ? updated.updatedAt.getTime() : now.getTime() });
    } else {
      const abs = safeDocAbsolutePath(rel);
      // Créer le répertoire parent si nécessaire
      await fs.promises.mkdir(path.dirname(abs), { recursive: true });
      await fs.promises.writeFile(abs, content, 'utf8');
      const st = await fs.promises.stat(abs);
      return res.json({ success: true, path: rel, size: st.size, mtime: st.mtimeMs });
    }
  } catch (error) {
    console.error('Erreur écriture doc:', error);
    res.status(400).json({ success: false, message: error.message || 'Erreur' });
  }
});

// Supprimer un fichier .md
app.delete('/api/admin/docs/content', authenticateAdmin, ensureAdmin, async (req, res) => {
  try {
    const rel = sanitizeDocRelPath(req.query.path || '');
    if (DOCS_STORAGE === 'db') {
      const result = await Documentation.deleteOne({ path: rel });
      if (result.deletedCount === 0) {
        return res.status(404).json({ success: false, message: 'Fichier non trouvé' });
      }
      return res.json({ success: true, path: rel });
    } else {
      const abs = safeDocAbsolutePath(rel);
      await fs.promises.unlink(abs);
      return res.json({ success: true, path: rel });
    }
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
    // ... (rest of the code remains the same)
    
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

// ============================
//  COMMANDE: Admin & Webhooks
// ============================

function toAmountString(n) {
  const v = Number(n || 0);
  return v.toFixed(2);
}

function mapWooStatusToInternal(s) {
  const st = String(s || '').toLowerCase();
  if (st === 'processing') return 'processing';
  if (st === 'on-hold') return 'awaiting_transfer';
  if (st === 'completed') return 'fulfilled';
  if (st === 'pending') return 'pending_payment';
  if (st === 'cancelled') return 'cancelled';
  if (st === 'refunded') return 'refunded';
  if (st === 'failed') return 'failed';
  return 'processing';
}

function mapMollieStatusToInternal(s) {
  const st = String(s || '').toLowerCase();
  if (st === 'paid') return 'paid';
  if (['open','pending','authorized'].includes(st)) return 'pending_payment';
  if (['failed','expired','canceled'].includes(st)) return 'failed';
  if (['refunded','chargedback'].includes(st)) return 'refunded';
  return 'processing';
}

function requireMollieApiKey() {
  const key = process.env.MOLLIE_API_KEY && process.env.MOLLIE_API_KEY.trim();
  if (!key) throw new Error('MOLLIE_API_KEY manquant');
  return key;
}

async function mollieCreatePayment(params) {
  const apiKey = requireMollieApiKey();
  const resp = await fetch('https://api.mollie.com/v2/payments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(params)
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`Mollie create payment HTTP ${resp.status}: ${txt}`);
  }
  return await resp.json();
}

async function mollieGetPayment(paymentId) {
  const apiKey = requireMollieApiKey();
  const resp = await fetch(`https://api.mollie.com/v2/payments/${encodeURIComponent(paymentId)}`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`Mollie get payment HTTP ${resp.status}: ${txt}`);
  }
  return await resp.json();
}

// --- Endpoints Admin Commandes ---
// Liste des commandes (filtres: q, provider, status, période; tri: number/status/amount/date)
app.get('/api/admin/orders', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '25', 10)));
    const skip = (page - 1) * limit;
    const q = String(req.query.q || '').trim();
    const status = String(req.query.status || '').trim();
    const provider = String(req.query.provider || '').trim();
    const productType = String(req.query.productType || '').trim();
    const from = String(req.query.from || '').trim();
    const to = String(req.query.to || '').trim();
    const sortBy = String(req.query.sort || '').trim() || 'date';
    const missingTechRef = String(req.query.missingTechRef || '').trim().toLowerCase();
    const dir = (String(req.query.dir || '').trim().toLowerCase() === 'asc') ? 1 : -1;

    const filter = {};
    if (status) filter.status = status;
    if (provider) filter.provider = provider;
    if (productType) filter['meta.productType'] = productType;
    if (q) {
      filter.$or = [
        { number: new RegExp(q, 'i') },
        { 'customer.email': new RegExp(q, 'i') },
        { 'items.name': new RegExp(q, 'i') },
        { 'items.sku': new RegExp(q, 'i') }
      ];
    }
    // Filtre période (sur updatedAt)
    if (from || to) {
      const range = {};
      const parseDate = (s) => {
        // accepter yyyy-mm-dd ou ISO
        if (!s) return null;
        const d = s.length === 10 ? new Date(s + 'T00:00:00.000Z') : new Date(s);
        return isNaN(d.getTime()) ? null : d;
      };
      const dFrom = parseDate(from);
      const dTo = parseDate(to);
      if (dFrom) range.$gte = dFrom;
      if (dTo) {
        // inclure toute la journée si format court
        if (to.length === 10) {
          const end = new Date(dTo);
          end.setUTCHours(23,59,59,999);
          range.$lte = end;
        } else {
          range.$lte = dTo;
        }
      }
      filter.updatedAt = range;
    }

    // Tri
    const sortMap = {
      'date': 'updatedAt', // remplacé par agrégation spéciale ci-dessous
      'created': 'createdAt',
      'amount': 'totals.amount',
      'status': 'status',
      'number': 'number',
      'type': 'meta.productType'
    };

    const total = await Order.countDocuments(filter);
    let orders = [];
    if (sortBy === 'date') {
      // Utiliser la vraie date de création: meta.sourceCreatedAt sinon createdAt
      const pipeline = [
        { $match: filter },
        { $addFields: { _sourceDate: { $ifNull: [ '$meta.sourceCreatedAt', '$createdAt' ] } } },
        { $sort: { _sourceDate: dir } },
        { $skip: skip },
        { $limit: limit }
      ];
      orders = await Order.aggregate(pipeline);
    } else {
      const sortField = sortMap[sortBy] || 'updatedAt';
      const sort = {}; sort[sortField] = dir;
      orders = await Order.find(filter).sort(sort).skip(skip).limit(limit).lean();
    }

    res.json({ success: true, page, limit, total, orders });
  } catch (e) {
    console.error('[orders:list] erreur', e);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Export CSV des commandes selon les mêmes filtres
app.get('/api/admin/orders/export.csv', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    // Reutiliser la logique de filtres et tri, mais avec un plus grand plafond
    const q = String(req.query.q || '').trim();
    const status = String(req.query.status || '').trim();
    const provider = String(req.query.provider || '').trim();
    const productType = String(req.query.productType || '').trim();
    const from = String(req.query.from || '').trim();
    const to = String(req.query.to || '').trim();
    const sortBy = String(req.query.sort || '').trim() || 'date';
    const dir = (String(req.query.dir || '').trim().toLowerCase() === 'asc') ? 1 : -1;
    const limit = Math.min(5000, Math.max(1, parseInt(req.query.limit || '1000', 10)));

    const filter = {};
    if (status) filter.status = status;
    if (provider) filter.provider = provider;
    if (productType) filter['meta.productType'] = productType;
    if (q) {
      filter.$or = [
        { number: new RegExp(q, 'i') },
        { 'customer.email': new RegExp(q, 'i') },
        { 'items.name': new RegExp(q, 'i') },
        { 'items.sku': new RegExp(q, 'i') }
      ];
    }
    if (from || to) {
      const range = {};
      const parseDate = (s) => {
        if (!s) return null;
        const d = s.length === 10 ? new Date(s + 'T00:00:00.000Z') : new Date(s);
        return isNaN(d.getTime()) ? null : d;
      };
      const dFrom = parseDate(from);
      const dTo = parseDate(to);
      if (dFrom) range.$gte = dFrom;
      if (dTo) {
        if (to.length === 10) {
          const end = new Date(dTo);
          end.setUTCHours(23,59,59,999);
          range.$lte = end;
        } else {
          range.$lte = dTo;
        }
      }
      filter.updatedAt = range;
    }
    const sortMap = {
      'date': 'updatedAt', // remplacé par agrégation spéciale ci-dessous
      'created': 'createdAt',
      'amount': 'totals.amount',
      'status': 'status',
      'number': 'number',
      'type': 'meta.productType'
    };

    let orders = [];
    if (sortBy === 'date') {
      const pipeline = [
        { $match: filter },
        { $addFields: { _sourceDate: { $ifNull: [ '$meta.sourceCreatedAt', '$createdAt' ] } } },
        { $sort: { _sourceDate: dir } },
        { $limit: limit }
      ];
      orders = await Order.aggregate(pipeline);
    } else {
      const sortField = sortMap[sortBy] || 'updatedAt';
      const sort = {}; sort[sortField] = dir;
      orders = await Order.find(filter).sort(sort).limit(limit).lean();
    }

    const esc = (v) => {
      const s = (v === null || v === undefined) ? '' : String(v);
      if (s.includes('"') || s.includes(',') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const headers = ['id','number','provider','status','product_type','date_created','date_updated','customer_name','customer_email','customer_phone','currency','amount','items_count'];
    const rows = [headers.join(',')];
    for (const o of orders) {
      const row = [
        esc(o._id),
        esc(o.number || ''),
        esc(o.provider || ''),
        esc(o.status || ''),
        esc(o.meta?.productType || ''),
        esc(o.createdAt ? new Date(o.createdAt).toISOString() : ''),
        esc(o.updatedAt ? new Date(o.updatedAt).toISOString() : ''),
        esc(o.customer?.name || ''),
        esc(o.customer?.email || ''),
        esc(o.customer?.phone || ''),
        esc(o.totals?.currency || 'EUR'),
        esc(o.totals?.amount || 0),
        esc(Array.isArray(o.items) ? o.items.length : 0)
      ];
      rows.push(row.join(','));
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="orders-export.csv"');
    res.send(rows.join('\n'));
  } catch (e) {
    console.error('[orders:export] erreur', e);
    res.status(500).send('Erreur export CSV');
  }
});

// Détail d\'une commande
app.get('/api/admin/orders/:id', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).lean();
    if (!order) return res.status(404).json({ success: false, message: 'Commande non trouvée' });
    res.json({ success: true, order });
  } catch (e) {
    res.status(400).json({ success: false, message: 'Identifiant invalide' });
  }
});

// Ajouter une note interne sur une commande
app.post('/api/admin/orders/:id/notes', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Commande non trouvée' });
    const msg = (req.body && typeof req.body.message === 'string') ? req.body.message.trim() : '';
    if (!msg) return res.status(400).json({ success: false, message: 'Note vide' });
    order.events = order.events || [];
    const by = (req.auth && (req.auth.email || req.auth.username)) || 'admin';
    order.events.push({ type: 'note', message: msg, at: new Date(), payloadSnippet: { by } });
    await order.save();
    res.json({ success: true, order });
  } catch (e) {
    console.error('[orders:add-note] erreur', e);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Créer une commande (brouillon) pour générer ensuite un lien de paiement Mollie
app.post('/api/admin/orders', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    const body = req.body || {};
    const provider = body.provider && typeof body.provider === 'string' ? body.provider : 'manual';
    const number = body.number && String(body.number).trim() !== '' ? String(body.number).trim() : undefined;
    const customer = body.customer && typeof body.customer === 'object' ? body.customer : {};
    const totals = body.totals && typeof body.totals === 'object' ? body.totals : { currency: 'EUR', amount: 0 };
    const items = Array.isArray(body.items) ? body.items : [];

    const order = new Order({
      provider,
      number,
      status: 'pending_payment',
      customer: {
        name: customer.name || '',
        email: customer.email || '',
        phone: customer.phone || ''
      },
      totals: {
        currency: (totals.currency || 'EUR'),
        amount: Number(totals.amount || 0),
        shipping: Number(totals.shipping || 0),
        tax: Number(totals.tax || 0)
      },
      items: items.map(it => ({
        sku: it.sku || '',
        name: it.name || '',
        qty: Number(it.qty || 0),
        unitPrice: Number(it.unitPrice || 0)
      })),
      events: [{ type: 'order_created_admin', message: 'Commande créée par admin' }]
    });

    // Adresse de facturation éventuelle
    if (body.billing && typeof body.billing === 'object' && body.billing.address && typeof body.billing.address === 'object') {
      order.billing = order.billing || {};
      order.billing.address = body.billing.address;
    }

    // Adresse de livraison éventuelle
    if (body.shipping && typeof body.shipping === 'object' && body.shipping.address && typeof body.shipping.address === 'object') {
      order.shipping = order.shipping || {};
      order.shipping.address = body.shipping.address;
    }

    // Livraison estimée éventuelle (création)
    if (body.shipping && typeof body.shipping === 'object' && typeof body.shipping.estimatedDeliveryAt === 'string') {
      const s = body.shipping.estimatedDeliveryAt.trim();
      if (s) {
        const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00.000Z` : s;
        const d = new Date(iso);
        if (!isNaN(d.getTime())) {
          order.shipping = order.shipping || {};
          order.shipping.estimatedDeliveryAt = d;
          order.events = order.events || [];
          order.events.push({ type: 'estimated_delivery_set', message: `Livraison estimée: ${d.toISOString().slice(0,10)}` });
        }
      }
    }

    // VIN / Plaque saisi à la création
    if (body.meta && typeof body.meta === 'object' && typeof body.meta.vinOrPlate === 'string' && body.meta.vinOrPlate.trim()) {
      order.meta = order.meta || {};
      order.meta.vinOrPlate = body.meta.vinOrPlate.trim();
    }

    // Références techniques à la création
    if (body.meta && typeof body.meta === 'object') {
      order.meta = order.meta || {};
      if (typeof body.meta.engineDisplacement === 'string') {
        order.meta.engineDisplacement = body.meta.engineDisplacement.trim();
      }
      if (typeof body.meta.tcuReference === 'string') {
        order.meta.tcuReference = body.meta.tcuReference.trim().toUpperCase();
      }
      if (typeof body.meta.technicalRefRequired === 'boolean') {
        order.meta.technicalRefRequired = !!body.meta.technicalRefRequired;
      }
      if (order.meta.engineDisplacement || order.meta.tcuReference || order.meta.technicalRefRequired) {
        order.events = order.events || [];
        order.events.push({ type: 'technical_ref_initialized', message: 'Référence technique initialisée' });
      }
    }

    // Détection auto méca/TCU pour toutes les créations (manuelles ou autres)
    try {
      const autoFlag = detectTechRefFromItems(order.items || []);
      const alreadySet = !!(order.meta && typeof order.meta.technicalRefRequired === 'boolean');
      if (autoFlag && !alreadySet) {
        order.meta = order.meta || {};
        order.meta.technicalRefRequired = true;
        order.events = order.events || [];
        order.events.push({ type: 'technical_ref_required_set', message: 'Référence technique requise (auto)' });
      }
    } catch {}

    // Détection du type de produit (pour tri/filtre)
    try {
      const ptype = detectProductTypeFromItems(order.items || []);
      order.meta = order.meta || {};
      order.meta.productType = ptype;
    } catch {}

    // Marquer payée immédiatement (virement)
    if (body.markPaid) {
      order.status = 'paid';
      order.payment = order.payment || {};
      order.payment.method = 'bank_transfer';
      order.payment.paidAt = new Date();
      order.events.push({ type: 'mark_paid_bank_transfer', message: 'Marquée payée (virement) lors de la création' });
    }

    await order.save();
    res.json({ success: true, order });
  } catch (e) {
    console.error('[orders:create] erreur', e);
    res.status(400).json({ success: false, message: e.message || 'Erreur' });
  }
});

// Marquer payé (virement)
app.post('/api/admin/orders/:id/mark-paid', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Commande non trouvée' });
    order.status = 'paid';
    order.payment = order.payment || {};
    order.payment.method = order.payment.method || 'bank_transfer';
    order.payment.paidAt = new Date();
    order.events = order.events || [];
    order.events.push({ type: 'mark_paid_bank_transfer', message: 'Marqué comme payé (virement) par admin' });
    await order.save();
    res.json({ success: true, order });
  } catch (e) {
    console.error('[orders:mark-paid] erreur', e);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Créer un lien de paiement (fonctionnalité non disponible dans cette version)
app.post('/api/admin/orders/:id/payment-link', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    const id = req.params.id;
    const order = await Order.findById(id).lean();
    if (!order) return res.status(404).json({ success: false, message: 'Commande non trouvée' });
    return res.status(501).json({ success: false, message: 'Lien de paiement non disponible' });
  } catch (e) {
    console.error('[orders:payment-link] erreur', e);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Synchronisation manuelle immédiate (WooCommerce + Mollie)
app.post('/api/admin/orders/sync-now', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    await runOrdersSync();
    return res.json({ success: true });
  } catch (e) {
    console.error('[orders:sync-now] erreur', e);
    return res.status(500).json({ success: false, message: 'Erreur lors de la synchronisation' });
  }
});

// Synchronisation complète de WooCommerce (toutes les commandes)
app.post('/api/admin/orders/sync-woo-all', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    const out = await syncWooAllOrders();
    res.json({ success: true, ...out });
  } catch (e) {
    console.error('[orders:sync-woo-all] erreur', e);
    res.status(500).json({ success: false, message: e.message || 'Erreur lors de la synchro complète Woo' });
  }
});

function ppFormatDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  const Y = d.getUTCFullYear();
  const M = pad(d.getUTCMonth() + 1);
  const D = pad(d.getUTCDate());
  const h = pad(d.getUTCHours());
  const m = pad(d.getUTCMinutes());
  const s = pad(d.getUTCSeconds());
  return `${Y}-${M}-${D} ${h}:${m}:${s}`;
}

function mapCarrierToParcelPanelCode(carrier) {
  const c = String(carrier || '').trim().toLowerCase();
  const map = {
    'colissimo': 'colissimo',
    'la poste': 'laposte',
    'laposte': 'laposte',
    'chronopost': 'chronopost',
    'mondial relay': 'mondialrelay',
    'mondialrelay': 'mondialrelay',
    'dhl': 'dhl',
    'ups': 'ups',
    'gls': 'gls',
    'dpd': 'dpd',
    'tnt': 'tnt',
    'fedex': 'fedex'
  };
  // tenter correspondance partielle
  for (const k of Object.keys(map)) {
    if (c.includes(k)) return map[k];
  }
  return c || 'other';
}

async function pushTrackingToParcelPanel({ wooOrderId, trackingNumber, carrier, shippedAt, lineItems }) {
  const apiKey = (process.env.PARCELPANEL_API_KEY || '').trim();
  if (!apiKey) return { attempted: false, ok: false, message: 'PARCELPANEL_API_KEY manquant' };
  try {
    const courier_code = mapCarrierToParcelPanelCode(carrier);
    const body = {
      shipments: [
        {
          order_id: wooOrderId,
          tracking_number: trackingNumber,
          courier_code,
          date_shipped: ppFormatDate(shippedAt || new Date()),
          status_shipped: 1,
          ...(Array.isArray(lineItems) && lineItems.length > 0 ? { line_items: lineItems.map(li => ({ sku: li.sku || '', qty: li.qty || 0 })) } : {})
        }
      ]
    };
    const resp = await fetch('https://wp-api.parcelpanel.com/api/v1/tracking/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'PP-Api-Key': apiKey },
      body: JSON.stringify(body)
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) return { attempted: true, ok: false, message: `HTTP ${resp.status}`, raw: json };
    const ok = json && (json.code === 200) && json.data && json.data.success && json.data.success.length > 0;
    return { attempted: true, ok: !!ok, message: ok ? 'OK' : (json && json.msg) || 'Echec API', raw: json };
  } catch (e) {
    return { attempted: true, ok: false, message: e.message || 'Erreur inconnue' };
  }
}

// Renseigner l'expédition et marquer comme expédiée
app.post('/api/admin/orders/:id/ship', authenticateAdmin, ensureAdminOrAgent, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Commande non trouvée' });
    const { carrier, trackingNumber, address } = req.body || {};
    order.shipping = order.shipping || {};
    if (address && typeof address === 'object') order.shipping.address = address;
    if (carrier) order.shipping.carrier = String(carrier);
    if (trackingNumber) order.shipping.trackingNumber = String(trackingNumber);
    order.shipping.shippedAt = new Date();
    order.status = 'fulfilled';
    order.events = order.events || [];
    order.events.push({ type: 'order_shipped', message: 'Commande expédiée', payloadSnippet: { carrier: order.shipping.carrier, trackingNumber: order.shipping.trackingNumber } });
    await order.save();

    // Si commande Woo et API ParcelPanel disponible, pousser le suivi
    let parcelPanel = { attempted: false, ok: false };
    try {
      if (order.provider === 'woocommerce' && order.providerOrderId) {
        parcelPanel = await pushTrackingToParcelPanel({
          wooOrderId: String(order.providerOrderId),
          trackingNumber: order.shipping.trackingNumber,
          carrier: order.shipping.carrier,
          shippedAt: order.shipping.shippedAt,
          lineItems: Array.isArray(order.items) ? order.items : []
        });
        if (!parcelPanel.ok) console.warn('[orders:ship] ParcelPanel push non OK:', parcelPanel.message);
      }
    } catch (e) {
      console.warn('[orders:ship] ParcelPanel push erreur', e);
    }

    res.json({ success: true, order, parcelPanel });
  } catch (e) {
    console.error('[orders:ship] erreur', e);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// --- Webhook Mollie ---
// Mollie envoie un id de paiement ; nous récupérons l\'objet via l\'API et mettons à jour la commande
app.post('/api/webhooks/mollie/:token', async (req, res) => {
  try {
    const token = String(req.params.token || '').trim();
    const expected = String(process.env.MOLLIE_WEBHOOK_TOKEN || '').trim();
    if (!expected || token !== expected) {
      return res.status(401).json({ success: false, message: 'Token invalide' });
    }
    const paymentId = String((req.body && req.body.id) || '').trim();
    if (!paymentId) {
      return res.status(400).json({ success: false, message: 'id de paiement manquant' });
    }

    const payment = await mollieGetPayment(paymentId);

    // Tenter de retrouver la commande par paymentId
    let order = await Order.findOne({ 'payment.molliePaymentId': payment.id });
    if (!order) {
      // Créer une commande minimale si pas trouvée (ex: paiement créé hors flux interne)
      const amountValue = parseFloat(payment.amount?.value || '0');
      order = new Order({
        provider: 'mollie',
        status: mapMollieStatusToInternal(payment.status),
        totals: { currency: payment.amount?.currency || 'EUR', amount: isNaN(amountValue) ? 0 : amountValue },
        payment: {
          method: `mollie:${payment.method || 'link'}`,
          molliePaymentId: payment.id,
          mollieMode: payment.mode,
          mollieStatus: payment.status,
          paidAt: payment.paidAt ? new Date(payment.paidAt) : undefined
        },
        customer: {
          name: payment.consumerName || '',
          email: (payment.billingEmail || payment.email) || ''
        },
        events: [{ type: 'mollie_webhook_create', message: 'Commande créée via webhook Mollie', payloadSnippet: { id: payment.id, status: payment.status } }]
      });
    } else {
      order.payment = order.payment || {};
      order.payment.method = `mollie:${payment.method || 'link'}`;
      order.payment.molliePaymentId = payment.id;
      order.payment.mollieMode = payment.mode;
      order.payment.mollieStatus = payment.status;
      if (payment.paidAt) order.payment.paidAt = new Date(payment.paidAt);
      order.status = mapMollieStatusToInternal(payment.status);
      order.events = order.events || [];
      order.events.push({ type: 'mollie_webhook_update', message: 'Mise à jour via webhook Mollie', payloadSnippet: { id: payment.id, status: payment.status } });
    }
    await order.save();

    return res.json({ success: true });
  } catch (e) {
    console.error('[webhook:mollie] erreur', e);
    // Toujours 200 pour éviter les retries agressifs si l\'erreur est passagère
    return res.json({ success: true });
  }
});

// --- Webhook WooCommerce ---
// Vérifie la signature HMAC SHA256 (X-WC-Webhook-Signature) sur le body brut
app.post('/api/webhooks/woocommerce', async (req, res) => {
  try {
    const secret = String(process.env.WOOCOMMERCE_WEBHOOK_SECRET || '').trim();
    const sig = req.header('x-wc-webhook-signature') || req.header('X-WC-Webhook-Signature');
    if (!secret || !sig) {
      return res.status(401).json({ success: false, message: 'Signature manquante' });
    }
    const bodyRaw = req.rawBody; // Buffer fixé par express.json verify
    if (!bodyRaw || !Buffer.isBuffer(bodyRaw)) {
      return res.status(400).json({ success: false, message: 'Corps brut introuvable pour vérification' });
    }
    const computed = crypto.createHmac('sha256', secret).update(bodyRaw).digest('base64');
    if (computed !== sig) {
      return res.status(401).json({ success: false, message: 'Signature invalide' });
    }
    const payload = JSON.parse(bodyRaw.toString('utf8'));
    const wooId = String(payload.id || payload.resource_id || '').trim();
    if (!wooId) {
      return res.status(400).json({ success: false, message: 'Identifiant commande manquant' });
    }

    const internalStatus = mapWooStatusToInternal(payload.status);
    const amount = parseFloat((payload.total || payload.total_due || '0').toString());
    const currency = (payload.currency || 'EUR').toString();
    const customer = payload.billing ? {
      name: `${payload.billing.first_name || ''} ${payload.billing.last_name || ''}`.trim(),
      email: payload.billing.email || '',
      phone: payload.billing.phone || ''
    } : { name: '', email: '', phone: '' };
    const items = Array.isArray(payload.line_items) ? payload.line_items.map(li => ({
      sku: li.sku || '',
      name: li.name || '',
      qty: li.quantity || 0,
      unitPrice: parseFloat((li.price || li.total || 0).toString())
    })) : [];

    const update = {
      provider: 'woocommerce',
      providerOrderId: wooId,
      number: payload.number ? String(payload.number) : undefined,
      status: internalStatus,
      customer,
      totals: { currency, amount: isNaN(amount) ? 0 : amount },
      items,
      events: [{ type: 'woo_webhook', message: `Événement Woo status=${payload.status}`, payloadSnippet: { id: wooId, status: payload.status } }]
    };

    await Order.updateOne(
      { provider: 'woocommerce', providerOrderId: wooId },
      { $set: update },
      { upsert: true }
    );

    return res.json({ success: true });
  } catch (e) {
    console.error('[webhook:woocommerce] erreur', e);
    // 200 pour éviter les retries démesurés, mais logger l\'erreur
    return res.json({ success: true });
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

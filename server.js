require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { Readable } = require('stream');
const cloudinary = require('cloudinary').v2;

const app = express();
const PORT = process.env.PORT || 3000;

// ── Cloudinary Configuration ─────────────────────────────────
const isCloudinaryConfigured = Boolean(
    process.env.CLOUDINARY_URL ||
    (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
);

const rawFolder = (process.env.CLOUDINARY_FOLDER || 'vk-events').toString().trim().replace(/[\s/]+$/, '');
const CLOUDINARY_FOLDER = rawFolder || 'vk-events';

if (isCloudinaryConfigured) {
    if (process.env.CLOUDINARY_URL) {
        cloudinary.config({
            cloudinary_url: process.env.CLOUDINARY_URL
        });
    } else {
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
            secure: true
        });
    }
    console.log(`☁️  Cloudinary configured: ${cloudinary.config().cloud_name || 'Active'} (Folder: ${CLOUDINARY_FOLDER})`);
} else {
    console.log('📁 Cloudinary credentials not detected.');
}

// Helper: Stream buffer directly to Cloudinary with metadata context
function uploadBufferToCloudinary(buffer, originalname, folder = CLOUDINARY_FOLDER, meta = {}) {
    return new Promise((resolve, reject) => {
        const cleanFolder = (folder || CLOUDINARY_FOLDER || 'vk-events').toString().trim().replace(/[\s/]+$/, '') || 'vk-events';
        const ext = path.extname(originalname).toLowerCase();
        const safeBase = path.basename(originalname, ext)
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .slice(0, 30);
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e6);
        const publicId = `${safeBase || 'event'}-${uniqueSuffix}`;

        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: cleanFolder,
                public_id: publicId,
                resource_type: 'image',
                overwrite: true,
                context: {
                    category: meta.category || 'Other',
                    spanType: meta.spanType || 'normal',
                    aspectRatio: String(meta.aspectRatio || ''),
                    originalName: originalname,
                    customId: meta.customId || ('media_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8))
                },
                tags: meta.category ? [meta.category.replace(/[^a-zA-Z0-9]/g, '_')] : []
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );

        Readable.from(buffer).pipe(uploadStream);
    });
}

// ── Directory Setup ──────────────────────────────────────────
const STORAGE_ROOT = process.env.PERSISTENT_STORAGE_PATH || (
    // Auto-detect Render's default persistent disk mount path
    require('fs').existsSync('/opt/render/project/storage')
        ? '/opt/render/project/storage'
        : null
) || path.join(__dirname);

const DATA_DIR = path.join(STORAGE_ROOT, 'data');
const DB_FILE  = path.join(DATA_DIR, 'gallery-db.json');

console.log(`📁 Storage root : ${STORAGE_ROOT}`);
console.log(`🗄  Database     : ${DB_FILE}`);

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2), 'utf8');
}

// ── Middleware ───────────────────────────────────────────────
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve website static files (built Vite bundle in dist)
const DIST_DIR = path.join(__dirname, 'dist');
if (fs.existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR));
} else {
    console.warn('⚠️  WARNING: dist/ folder not found. Run "npm run build" to generate production assets.');
}

// ── Database Helpers ─────────────────────────────────────────
function readDb() {
    try {
        if (!fs.existsSync(DB_FILE)) return [];
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(raw || '[]');
    } catch (err) {
        console.error('Error reading gallery database:', err);
        return [];
    }
}

function writeDb(data) {
    try {
        const tmpFile = DB_FILE + '.tmp';
        fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf8');
        fs.renameSync(tmpFile, DB_FILE);
        return true;
    } catch (err) {
        console.error('Error writing gallery database:', err);
        return false;
    }
}

// ── Multer Storage Setup (Memory Storage) ─────────────────────
const fileFilter = (req, file, cb) => {
    const allowed = /\.(jpe?g|png|webp|gif|svg)$/i;
    if (allowed.test(path.extname(file.originalname)) || (file.mimetype && file.mimetype.startsWith('image/'))) {
        cb(null, true);
    } else {
        cb(new Error('Only image files (JPG, PNG, WEBP, GIF, SVG) are allowed'));
    }
};

const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter,
    limits: { fileSize: 30 * 1024 * 1024 } // 30 MB max
});

// ── Category Mapping & Cloudinary Media Fetching ──────────────
const KNOWN_CATEGORIES = [
    'Birthday',
    'Anniversary',
    'Baby Welcome',
    'Haldi & Mehendi',
    'Religious & Pooja',
    'Ring Ceremony',
    'Shop Decoration',
    'Event Entry',
    'Our Inventory',
    'Other'
];

function inferCategoryFromPublicId(publicId) {
    const lower = (publicId || '').toLowerCase();
    for (const cat of KNOWN_CATEGORIES) {
        const cleanCat = cat.toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanPublic = lower.replace(/[^a-z0-9]/g, '');
        if (cleanPublic.includes(cleanCat)) {
            return cat;
        }
    }
    if (lower.includes('anniversay') || lower.includes('anniversary')) return 'Anniversary';
    if (lower.includes('birthday') || lower.includes('bday')) return 'Birthday';
    if (lower.includes('ring')) return 'Ring Ceremony';
    if (lower.includes('entry')) return 'Event Entry';
    if (lower.includes('haldi') || lower.includes('mehendi')) return 'Haldi & Mehendi';
    if (lower.includes('baby')) return 'Baby Welcome';
    if (lower.includes('shop')) return 'Shop Decoration';
    if (lower.includes('pooja') || lower.includes('religious')) return 'Religious & Pooja';
    return 'Other';
}

// In-memory caching for Cloudinary resources (prevents hitting API rate limits on every page load)
let mediaCache = null;
let mediaCacheTimestamp = 0;
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

function invalidateMediaCache() {
    mediaCache = null;
    mediaCacheTimestamp = 0;
}

async function getGalleryMedia() {
    if (!isCloudinaryConfigured) {
        return readDb();
    }

    const now = Date.now();
    if (mediaCache && (now - mediaCacheTimestamp < CACHE_TTL_MS)) {
        return mediaCache;
    }

    try {
        const localDb = readDb();
        const localMap = new Map();
        localDb.forEach(item => {
            if (item.cloudinaryPublicId) {
                localMap.set(item.cloudinaryPublicId, item);
            }
        });

        const res = await cloudinary.api.resources({
            type: 'upload',
            prefix: CLOUDINARY_FOLDER,
            max_results: 500,
            context: true,
            tags: true,
            direction: 'desc'
        });

        const cldItems = (res.resources || []).map(r => {
            const ctx = (r.context && r.context.custom) || r.context || {};
            const localMeta = localMap.get(r.public_id) || {};

            const category = ctx.category || localMeta.category || inferCategoryFromPublicId(r.public_id);
            const spanType = ctx.spanType || localMeta.spanType || 'normal';
            let aspectRatio = ctx.aspectRatio ? parseFloat(ctx.aspectRatio) : localMeta.aspectRatio;
            if (!aspectRatio && r.width && r.height) {
                aspectRatio = Math.round((r.width / r.height) * 100) / 100;
            }

            const optUrl = cloudinary.url(r.public_id, {
                secure: true,
                quality: 'auto',
                fetch_format: 'auto'
            });

            return {
                id: ctx.customId || localMeta.id || ('cld_' + r.asset_id),
                category: category,
                filename: localMeta.filename || path.basename(r.public_id),
                originalName: ctx.originalName || localMeta.originalName || path.basename(r.public_id),
                type: 'image',
                src: optUrl,
                srcFull: r.secure_url || optUrl,
                cloudinaryPublicId: r.public_id,
                storageType: 'cloudinary',
                spanType: spanType,
                aspectRatio: aspectRatio,
                size: r.bytes,
                mimetype: r.format ? `image/${r.format}` : 'image/jpeg',
                featured: spanType === 'large',
                isStatic: false,
                createdAt: localMeta.createdAt || new Date(r.created_at).getTime()
            };
        });

        // Any local-only items not on Cloudinary (e.g. legacy local uploads)
        const localOnly = localDb.filter(i => !i.cloudinaryPublicId && i.storageType !== 'cloudinary');

        const merged = [...cldItems, ...localOnly];
        merged.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        mediaCache = merged;
        mediaCacheTimestamp = now;
        return merged;
    } catch (err) {
        console.warn('Could not query Cloudinary API resources, falling back to local database:', err.message);
        return readDb();
    }
}

// ── API Routes ───────────────────────────────────────────────

// 1. Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        storage: isCloudinaryConfigured ? 'cloudinary' : 'database-only',
        cloudinary: {
            configured: isCloudinaryConfigured,
            cloudName: isCloudinaryConfigured ? (cloudinary.config().cloud_name || 'configured') : null,
            folder: CLOUDINARY_FOLDER
        }
    });
});

// 2. GET /api/media — fetch all permanent uploaded images (persisted across deploys)
app.get('/api/media', async (req, res) => {
    try {
        const items = await getGalleryMedia();
        res.json({ success: true, data: items });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. POST /api/upload — upload one or more images permanently
app.post('/api/upload', (req, res, next) => {
    upload.array('images', 20)(req, res, async (err) => {
        if (err) {
            console.error('Multer upload error:', err);
            return res.status(400).json({ success: false, error: err.message });
        }

        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ success: false, error: 'No image files provided' });
            }

            const category = req.body.category || 'Other';
            let metaList = [];
            try {
                if (req.body.metadata) {
                    metaList = JSON.parse(req.body.metadata);
                }
            } catch (metaErr) {
                metaList = [];
            }

            const currentDb = readDb();
            const newRecords = [];

            for (let index = 0; index < req.files.length; index++) {
                const file = req.files[index];
                const meta = (Array.isArray(metaList) && metaList[index]) ? metaList[index] : {};
                const spanType = (meta && meta.spanType === 'large') ? 'large' : 'normal';
                let aspectRatio = (meta && typeof meta.aspectRatio === 'number') ? meta.aspectRatio : null;

                let srcUrl = '';
                let srcFullUrl = '';
                let filename = '';
                let cloudinaryPublicId = null;
                let storageType = 'local';
                let fileSize = file.size;

                if (!isCloudinaryConfigured) {
                    return res.status(500).json({
                        success: false,
                        error: 'Cloudinary storage is required. Please check your CLOUDINARY credentials.'
                    });
                }

                let cldResult;
                try {
                    const customId = 'media_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
                    cldResult = await uploadBufferToCloudinary(file.buffer, file.originalname, CLOUDINARY_FOLDER, {
                        category,
                        spanType,
                        aspectRatio,
                        customId
                    });
                } catch (cldErr) {
                    console.error('Cloudinary upload failed:', cldErr.message);
                    return res.status(500).json({ success: false, error: `Cloudinary upload failed: ${cldErr.message}` });
                }

                cloudinaryPublicId = cldResult.public_id;
                storageType = 'cloudinary';
                fileSize = cldResult.bytes || file.size;

                // Cloudinary auto-optimization URL for regular display
                srcUrl = cloudinary.url(cldResult.public_id, {
                    secure: true,
                    quality: 'auto',
                    fetch_format: 'auto'
                });
                // Original full resolution for lightbox / full view
                srcFullUrl = cldResult.secure_url || srcUrl;

                // Calculate exact aspect ratio if available from Cloudinary
                if (cldResult.width && cldResult.height) {
                    aspectRatio = Math.round((cldResult.width / cldResult.height) * 100) / 100;
                }

                const item = {
                    id: 'media_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
                    category: category,
                    filename: file.originalname,
                    originalName: file.originalname,
                    type: 'image',
                    src: srcUrl,
                    srcFull: srcFullUrl,
                    cloudinaryPublicId: cloudinaryPublicId,
                    storageType: 'cloudinary',
                    spanType: spanType,
                    aspectRatio: aspectRatio,
                    size: fileSize,
                    mimetype: file.mimetype,
                    featured: spanType === 'large',
                    isStatic: false,
                    createdAt: Date.now()
                };

                currentDb.push(item);
                newRecords.push(item);
            }

            writeDb(currentDb);
            invalidateMediaCache();

            res.json({
                success: true,
                count: newRecords.length,
                data: newRecords
            });
        } catch (innerErr) {
            console.error('Upload handling error:', innerErr);
            res.status(500).json({ success: false, error: innerErr.message });
        }
    });
});

// 4. POST /api/media/delete — permanently delete images from Cloudinary & DB
app.post('/api/media/delete', async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, error: 'Array of ids required' });
        }

        const currentDb = readDb();
        const activeItems = await getGalleryMedia();
        let deletedCount = 0;
        const remainingDb = [];

        for (const item of activeItems) {
            const isMatch = ids.includes(item.id) || ids.includes(item.cloudinaryPublicId);
            if (isMatch) {
                // Delete from Cloudinary
                if (item.cloudinaryPublicId) {
                    try {
                        await cloudinary.uploader.destroy(item.cloudinaryPublicId);
                    } catch (cldErr) {
                        console.warn(`Could not delete Cloudinary image ${item.cloudinaryPublicId}:`, cldErr.message);
                    }
                }
                deletedCount++;
            }
        }

        // Clean local DB
        for (const item of currentDb) {
            if (!ids.includes(item.id) && !ids.includes(item.cloudinaryPublicId)) {
                remainingDb.push(item);
            }
        }

        writeDb(remainingDb);
        invalidateMediaCache();

        res.json({
            success: true,
            deletedCount,
            remainingCount: remainingDb.length
        });
    } catch (err) {
        console.error('Delete handling error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Fallback route for SPA client routes
app.get('*', (req, res, next) => {
    if (path.extname(req.path)) {
        return next();
    }
    const distIndex = path.join(DIST_DIR, 'index.html');
    if (fs.existsSync(distIndex)) {
        return res.sendFile(distIndex);
    }
    res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Build Missing</title></head>
        <body style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h2>⚠️ Production Build Not Found</h2>
            <p>The <code>dist/</code> folder does not exist on this server.</p>
            <p>Please configure your Render <strong>Build Command</strong> to:</p>
            <pre style="background: #f1f1f1; padding: 12px; display: inline-block; border-radius: 6px;">npm install && npm run build</pre>
        </body>
        </html>
    `);
});

// ── Start Server ─────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
    const interfaces = os.networkInterfaces();
    let localIp = 'localhost';

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                localIp = iface.address;
                break;
            }
        }
    }

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║               VK EVENTS — BACKEND SERVER                   ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  Local Computer : http://localhost:${PORT}                   ║`);
    console.log(`║  On Your Phone  : http://${localIp}:${PORT}               ║`);
    if (isCloudinaryConfigured) {
        console.log(`║  Storage Mode   : ☁️  Cloudinary (${cloudinary.config().cloud_name || 'Active'}) ║`);
    } else {
        console.log(`║  Storage Mode   : 📁 Database Fallback Mode                   ║`);
    }
    console.log('╚════════════════════════════════════════════════════════════╝\n');
});

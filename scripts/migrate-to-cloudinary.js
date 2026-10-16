// scripts/migrate-to-cloudinary.js
// ─────────────────────────────────────────────────────────
// VK Events — Migration Script: Local Uploads -> Cloudinary
// Reads data/gallery-db.json, uploads any local images to
// Cloudinary, and updates records with Cloudinary URLs & IDs.
// ─────────────────────────────────────────────────────────

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;

const isCloudinaryConfigured = Boolean(
    process.env.CLOUDINARY_URL ||
    (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
);

if (!isCloudinaryConfigured) {
    console.error('\n❌ ERROR: Cloudinary is not configured.');
    console.error('Please configure your Cloudinary credentials in .env or environment variables:');
    console.error('  CLOUDINARY_CLOUD_NAME=your_cloud_name');
    console.error('  CLOUDINARY_API_KEY=your_api_key');
    console.error('  CLOUDINARY_API_SECRET=your_api_secret');
    console.error('Or:');
    console.error('  CLOUDINARY_URL=cloudinary://<key>:<secret>@<cloud_name>\n');
    process.exit(1);
}

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

const STORAGE_ROOT = process.env.PERSISTENT_STORAGE_PATH || (
    fs.existsSync('/opt/render/project/storage') ? '/opt/render/project/storage' : null
) || path.join(__dirname, '..');

const UPLOAD_DIR = path.join(STORAGE_ROOT, 'uploads');
const DB_FILE = path.join(STORAGE_ROOT, 'data', 'gallery-db.json');
const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || 'vk-events';

async function migrate() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║        VK EVENTS — CLOUDINARY MIGRATION UTILITY            ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  Cloud Name   : ${(cloudinary.config().cloud_name || 'Configured').padEnd(41)}║`);
    console.log(`║  Folder       : ${CLOUDINARY_FOLDER.padEnd(41)}║`);
    console.log(`║  Upload Dir   : ${UPLOAD_DIR.slice(-41).padEnd(41)}║`);
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    if (!fs.existsSync(DB_FILE)) {
        console.log('⚠️  No database file found at ' + DB_FILE + '. Nothing to migrate.');
        return;
    }

    let items = [];
    try {
        items = JSON.parse(fs.readFileSync(DB_FILE, 'utf8') || '[]');
    } catch (err) {
        console.error('❌ Failed to parse gallery database:', err.message);
        process.exit(1);
    }

    if (items.length === 0) {
        console.log('ℹ️  Gallery database is empty. No photos to migrate.');
        return;
    }

    let migratedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < items.length; i++) {
        const item = items[i];

        // Skip if already on Cloudinary
        if (item.cloudinaryPublicId || (item.src && item.src.includes('cloudinary.com'))) {
            skippedCount++;
            continue;
        }

        const localFilename = item.filename;
        if (!localFilename) {
            skippedCount++;
            continue;
        }

        const localPath = path.join(UPLOAD_DIR, localFilename);
        if (!fs.existsSync(localPath)) {
            console.warn(`⚠️  [${i + 1}/${items.length}] Local file not found: ${localFilename}`);
            failedCount++;
            continue;
        }

        try {
            console.log(`⏳ [${i + 1}/${items.length}] Uploading ${localFilename} to Cloudinary…`);
            const ext = path.extname(localFilename).toLowerCase();
            const safeBase = path.basename(localFilename, ext)
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '-')
                .slice(0, 30);
            const publicId = `${safeBase || 'event'}-${Date.now()}`;

            const result = await cloudinary.uploader.upload(localPath, {
                folder: CLOUDINARY_FOLDER,
                public_id: publicId,
                resource_type: 'image',
                context: {
                    category: item.category || 'Other',
                    spanType: item.spanType || 'normal',
                    aspectRatio: String(item.aspectRatio || ''),
                    originalName: item.originalName || localFilename,
                    customId: item.id || ('media_' + Date.now())
                },
                tags: item.category ? [item.category.replace(/[^a-zA-Z0-9]/g, '_')] : []
            });

            item.cloudinaryPublicId = result.public_id;
            item.storageType = 'cloudinary';
            item.src = cloudinary.url(result.public_id, {
                secure: true,
                quality: 'auto',
                fetch_format: 'auto'
            });
            item.srcFull = result.secure_url || item.src;
            if (result.width && result.height) {
                item.aspectRatio = Math.round((result.width / result.height) * 100) / 100;
            }

            migratedCount++;
            console.log(`  ✅ Successfully migrated to: ${item.src}`);
        } catch (uploadErr) {
            console.error(`  ❌ Failed to upload ${localFilename}:`, uploadErr.message);
            failedCount++;
        }
    }

    try {
        const tmpFile = DB_FILE + '.tmp';
        fs.writeFileSync(tmpFile, JSON.stringify(items, null, 2), 'utf8');
        fs.renameSync(tmpFile, DB_FILE);
    } catch (saveErr) {
        console.error('❌ Failed to save updated database:', saveErr.message);
        process.exit(1);
    }

    console.log('\n════════════════════════════════════════');
    console.log(`🎉 Migration summary:`);
    console.log(`   ✅ Newly migrated       : ${migratedCount}`);
    console.log(`   ⏭️  Already on Cloudinary : ${skippedCount}`);
    console.log(`   ❌ Failed/Missing local  : ${failedCount}`);
    console.log('════════════════════════════════════════\n');
}

migrate();

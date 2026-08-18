import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { supabaseAdmin } from '../config/supabase.js';
import { verifyAuth } from '../middleware/auth.js';
import { extractTextFromBuffer } from '../lib/extractAttachmentText.js';

const router = Router();

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error('Unsupported file type'));
      return;
    }
    cb(null, true);
  },
});

function sanitizeFilename(name) {
  const base = name.replace(/[/\\]/g, '_').replace(/[^a-zA-Z0-9._-]/g, '_');
  return base.slice(-120) || 'file';
}

/**
 * POST /api/upload
 * multipart/form-data, field name "file"
 * Uploads to the private "attachments" Storage bucket under the caller's
 * own folder and returns a reference the frontend attaches to a chat message.
 */
router.post('/', verifyAuth, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      const message =
        err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 10MB).' : err.message;
      return res.status(400).json({ error: message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'file is required' });
    }

    const safeName = sanitizeFilename(req.file.originalname);
    const path = `${req.user.id}/${randomUUID()}-${safeName}`;

    const { error } = await supabaseAdmin.storage
      .from('attachments')
      .upload(path, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (error) {
      console.error('[upload] storage upload failed', { userId: req.user.id, error: error.message });
      return res.status(500).json({ error: 'Upload failed. Please try again.' });
    }

    res.status(201).json({
      path,
      name: req.file.originalname,
      size: req.file.size,
      contentType: req.file.mimetype,
      extractedText: extractTextFromBuffer(req.file.buffer, {
        mimeType: req.file.mimetype,
        filename: req.file.originalname,
      }).text || undefined,
    });
  });
});

export default router;

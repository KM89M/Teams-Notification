import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

const ALLOWED_IMAGE_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function isPrivateOrLoopbackIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts;
    if (a === 0) return true;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }

  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    if (lower.startsWith('fe80:')) return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    if (lower.startsWith('::ffff:')) {
      return isPrivateOrLoopbackIp(lower.slice(7));
    }
    return false;
  }

  return true;
}

export async function validateOutboundUrl(
  rawUrl: string,
  options: { requireHttps?: boolean } = {},
): Promise<{ ok: true; url: URL } | { ok: false; error: string }> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { ok: false, error: 'الرابط غير صالح' };
  }

  const allowedProtocols = options.requireHttps ? ['https:'] : ['https:', 'http:'];
  if (!allowedProtocols.includes(parsed.protocol)) {
    return {
      ok: false,
      error: options.requireHttps
        ? 'يجب أن يبدأ رابط الويب هوك بـ https://'
        : 'يجب أن يبدأ الرابط بـ http:// أو https://',
    };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    !hostname ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    return { ok: false, error: 'الرابط يشير إلى عنوان داخلي غير مسموح به' };
  }

  if (net.isIP(hostname)) {
    if (isPrivateOrLoopbackIp(hostname)) {
      return { ok: false, error: 'الرابط يشير إلى شبكة خاصة غير مسموح بها' };
    }
    return { ok: true, url: parsed };
  }

  try {
    const records = await dns.lookup(hostname, { all: true });
    if (records.some((rec) => isPrivateOrLoopbackIp(rec.address))) {
      return { ok: false, error: 'النطاق يوجه إلى عنوان داخلي غير مسموح به' };
    }
  } catch {
    // Allow hostname syntax if DNS is temporarily unavailable; outbound fetch will surface real network errors
  }

  return { ok: true, url: parsed };
}

export function getUploadsDir(): string {
  const dir = path.resolve(process.cwd(), 'public', 'uploads');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function saveBase64Image(
  base64Data: string,
): { ok: true; url: string } | { ok: false; error: string } {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(
    base64Data.trim(),
  );
  if (!match) {
    return { ok: false, error: 'صيغة الصورة غير مدعومة' };
  }

  const mime = match[1].toLowerCase();
  const ext = ALLOWED_IMAGE_MIME[mime];
  if (!ext) {
    return {
      ok: false,
      error: 'نوع الصورة غير مسموح به. الأنواع المدعومة: PNG, JPG, GIF, WebP',
    };
  }

  const buffer = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
  if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
    return { ok: false, error: 'حجم الصورة يتجاوز الحد الأقصى المسموح به (5 ميجابايت)' };
  }

  const uploadsDir = getUploadsDir();
  const filename = `${crypto.randomUUID()}.${ext}`;
  const targetPath = path.resolve(uploadsDir, filename);

  if (!targetPath.startsWith(uploadsDir + path.sep)) {
    return { ok: false, error: 'مسار الحفظ غير صالح' };
  }

  fs.writeFileSync(targetPath, buffer);
  return { ok: true, url: `/uploads/${filename}` };
}

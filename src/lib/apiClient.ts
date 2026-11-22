import type { Announcement, PublishResponse, TeamChannel } from '../types';

const LS_CHANNELS_KEY = 'teams_announcer_channels_v1';
const LS_ANNOUNCEMENTS_KEY = 'teams_announcer_announcements_v1';

let serverModeCache: boolean | null = null;

function isJsonResponse(res: Response): boolean {
  const ct = res.headers.get('content-type') || '';
  return ct.toLowerCase().includes('application/json');
}

function readLocal<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeLocal<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

function makeId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 24)
    : `${Date.now()}${Math.random().toString(36).slice(2, 10)}`;
}

export function isStaticFallbackMode(): boolean {
  return serverModeCache === false;
}

export async function apiListChannels(): Promise<TeamChannel[]> {
  try {
    const res = await fetch('./api/channels');
    if (res.ok && isJsonResponse(res)) {
      serverModeCache = true;
      return (await res.json()) as TeamChannel[];
    }
    if (res.status === 404 || !isJsonResponse(res)) {
      serverModeCache = false;
      return readLocal<TeamChannel>(LS_CHANNELS_KEY);
    }
    throw new Error('Failed to fetch channels');
  } catch {
    if (serverModeCache === false) {
      return readLocal<TeamChannel>(LS_CHANNELS_KEY);
    }
    serverModeCache = false;
    return readLocal<TeamChannel>(LS_CHANNELS_KEY);
  }
}

export async function apiCreateChannel(input: {
  name: string;
  webhookUrl: string;
  description?: string;
}): Promise<{ ok: true; data: TeamChannel } | { ok: false; error: string }> {
  if (serverModeCache !== false) {
    try {
      const res = await fetch('./api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (isJsonResponse(res)) {
        serverModeCache = true;
        const data = await res.json();
        if (!res.ok) return { ok: false, error: data.error || 'تعذر إضافة القناة' };
        return { ok: true, data: data as TeamChannel };
      }
      serverModeCache = false;
    } catch {
      serverModeCache = false;
    }
  }

  const now = new Date().toISOString();
  const created: TeamChannel = {
    id: makeId(),
    name: input.name,
    webhookUrl: input.webhookUrl,
    description: input.description || null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  const current = readLocal<TeamChannel>(LS_CHANNELS_KEY);
  writeLocal(LS_CHANNELS_KEY, [created, ...current]);
  return { ok: true, data: created };
}

export async function apiToggleChannel(
  id: string,
  isActive: boolean,
): Promise<{ ok: true; data: TeamChannel } | { ok: false; error: string }> {
  if (serverModeCache !== false) {
    try {
      const res = await fetch(`./api/channels/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      if (isJsonResponse(res)) {
        serverModeCache = true;
        const data = await res.json();
        if (!res.ok) return { ok: false, error: data.error || 'تعذر تحديث القناة' };
        return { ok: true, data: data as TeamChannel };
      }
      serverModeCache = false;
    } catch {
      serverModeCache = false;
    }
  }

  const current = readLocal<TeamChannel>(LS_CHANNELS_KEY);
  let updatedItem: TeamChannel | null = null;
  const next = current.map((ch) => {
    if (ch.id === id) {
      updatedItem = { ...ch, isActive, updatedAt: new Date().toISOString() };
      return updatedItem;
    }
    return ch;
  });
  if (!updatedItem) return { ok: false, error: 'القناة غير موجودة' };
  writeLocal(LS_CHANNELS_KEY, next);
  return { ok: true, data: updatedItem };
}

export async function apiDeleteChannel(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (serverModeCache !== false) {
    try {
      const res = await fetch(`./api/channels/${id}`, { method: 'DELETE' });
      if (isJsonResponse(res)) {
        serverModeCache = true;
        if (!res.ok) {
          const data = await res.json();
          return { ok: false, error: data.error || 'تعذر حذف القناة' };
        }
        return { ok: true };
      }
      serverModeCache = false;
    } catch {
      serverModeCache = false;
    }
  }

  const current = readLocal<TeamChannel>(LS_CHANNELS_KEY);
  writeLocal(
    LS_CHANNELS_KEY,
    current.filter((c) => c.id !== id),
  );
  return { ok: true };
}

export async function apiTestWebhook(
  webhookUrl: string,
): Promise<{ success: boolean; error?: string }> {
  if (serverModeCache !== false) {
    try {
      const res = await fetch('./api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl }),
      });
      if (isJsonResponse(res)) {
        serverModeCache = true;
        return (await res.json()) as { success: boolean; error?: string };
      }
      serverModeCache = false;
    } catch {
      serverModeCache = false;
    }
  }

  return {
    success: false,
    error:
      'الاستضافة الثابتة (GitHub Pages) لا تحتوي على خادم خلفي لإرسال طلبات Webhook بسبب قيود المتصفح (CORS). شغّل الخادم (node server.ts) للنشر الفعلي إلى Teams.',
  };
}

export async function apiUploadImage(
  base64Data: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (serverModeCache !== false) {
    try {
      const res = await fetch('./api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data }),
      });
      if (isJsonResponse(res)) {
        serverModeCache = true;
        const data = await res.json();
        if (!res.ok) return { ok: false, error: data.error || 'فشل رفع الصورة' };
        return { ok: true, url: data.url as string };
      }
      serverModeCache = false;
    } catch {
      serverModeCache = false;
    }
  }

  // Static fallback: use base64 data URL for local preview
  return { ok: true, url: base64Data };
}

export async function apiListAnnouncements(): Promise<Announcement[]> {
  try {
    const res = await fetch('./api/announcements');
    if (res.ok && isJsonResponse(res)) {
      serverModeCache = true;
      return (await res.json()) as Announcement[];
    }
    serverModeCache = false;
    return readLocal<Announcement>(LS_ANNOUNCEMENTS_KEY);
  } catch {
    serverModeCache = false;
    return readLocal<Announcement>(LS_ANNOUNCEMENTS_KEY);
  }
}

export async function apiCreateAnnouncement(input: {
  title: string;
  subheading: string;
  content: string;
  contentColor: string;
  priority: string;
  channelIds: string[];
  headerColor: string;
  titleSize: string;
  titleAlignment: string;
  alignment: string;
  announcementDate: string;
  source: string;
  imageUrl: string;
}): Promise<{ ok: true; data: Announcement } | { ok: false; error: string }> {
  if (serverModeCache !== false) {
    try {
      const res = await fetch('./api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (isJsonResponse(res)) {
        serverModeCache = true;
        const data = await res.json();
        if (!res.ok) return { ok: false, error: data.error || 'تعذر حفظ الإعلان' };
        return { ok: true, data: data as Announcement };
      }
      serverModeCache = false;
    } catch {
      serverModeCache = false;
    }
  }

  const now = new Date().toISOString();
  const created: Announcement = {
    id: makeId(),
    title: input.title,
    subheading: input.subheading,
    content: input.content,
    contentColor: input.contentColor,
    priority: input.priority,
    status: 'مسودة',
    channelIds: input.channelIds.join(','),
    headerColor: input.headerColor,
    titleSize: input.titleSize,
    titleAlignment: input.titleAlignment,
    alignment: input.alignment,
    announcementDate: input.announcementDate,
    source: input.source,
    imageUrl: input.imageUrl,
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  const current = readLocal<Announcement>(LS_ANNOUNCEMENTS_KEY);
  writeLocal(LS_ANNOUNCEMENTS_KEY, [created, ...current]);
  return { ok: true, data: created };
}

export async function apiPublishAnnouncement(
  announcementId: string,
): Promise<PublishResponse> {
  if (serverModeCache !== false) {
    try {
      const res = await fetch('./api/announcements/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ announcementId }),
      });
      if (isJsonResponse(res)) {
        serverModeCache = true;
        return (await res.json()) as PublishResponse;
      }
      serverModeCache = false;
    } catch {
      serverModeCache = false;
    }
  }

  return {
    success: false,
    totalChannels: 0,
    successful: 0,
    results: [],
    error:
      'تم حفظ الإعلان محلياً كمسودة. يتطلب النشر الفعلي إلى Microsoft Teams تشغيل الخادم الخلفي (Express Server) لأن GitHub Pages استضافة ملفات ثابتة فقط.',
  };
}

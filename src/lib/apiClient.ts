import type { Announcement, PublishResponse, TeamChannel } from '../types';
import {
  buildClientAdaptiveCardPayload,
  buildClientTestWebhookPayload,
} from './adaptiveCardClient';

const LS_CHANNELS_KEY = 'teams_announcer_channels_v1';
const LS_ANNOUNCEMENTS_KEY = 'teams_announcer_announcements_v1';
const LS_BACKEND_URL_KEY = 'teams_announcer_backend_url_v1';

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

export function getBackendUrl(): string {
  try {
    return (localStorage.getItem(LS_BACKEND_URL_KEY) || '').trim();
  } catch {
    return '';
  }
}

export function setBackendUrl(url: string): void {
  try {
    const cleaned = url.trim().replace(/\/+$/, '');
    if (cleaned) {
      localStorage.setItem(LS_BACKEND_URL_KEY, cleaned);
    } else {
      localStorage.removeItem(LS_BACKEND_URL_KEY);
    }
    serverModeCache = null;
  } catch {
    // Ignore storage errors
  }
}

function buildApiEndpoint(apiPath: string): string {
  const base = getBackendUrl();
  if (base && /^https?:\/\//i.test(base)) {
    return `${base}${apiPath}`;
  }
  return `.${apiPath}`;
}

function makeId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 24)
    : `${Date.now()}${Math.random().toString(36).slice(2, 10)}`;
}

export function isStaticFallbackMode(): boolean {
  return serverModeCache === false;
}

async function postWebhookDirectFromBrowser(
  webhookUrl: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = (await res.text()).trim();
    if ((res.status === 200 && text === '1') || res.status === 202) {
      return { ok: true };
    }
    return {
      ok: false,
      error: text
        ? `Teams rejected (HTTP ${res.status}): ${text}`
        : `Teams returned HTTP ${res.status}`,
    };
  } catch {
    return {
      ok: false,
      error:
        'حظر المتصفح الإرسال المباشر إلى رابط Teams بسبب قيود CORS. يمكنك ربط رابط خادم خلفي (Express Server) من الأعلى أو استخدام رابط Power Automate Workflow يدعم CORS أو تشغيل التطبيق عبر Node.js.',
    };
  }
}

export async function apiListChannels(): Promise<TeamChannel[]> {
  try {
    const res = await fetch(buildApiEndpoint('/api/channels'));
    if (res.ok && isJsonResponse(res)) {
      serverModeCache = true;
      return (await res.json()) as TeamChannel[];
    }
    serverModeCache = false;
    return readLocal<TeamChannel>(LS_CHANNELS_KEY);
  } catch {
    serverModeCache = false;
    return readLocal<TeamChannel>(LS_CHANNELS_KEY);
  }
}

export async function apiCreateChannel(input: {
  name: string;
  webhookUrl: string;
  description?: string;
}): Promise<{ ok: true; data: TeamChannel } | { ok: false; error: string }> {
  if (serverModeCache !== false || getBackendUrl()) {
    try {
      const res = await fetch(buildApiEndpoint('/api/channels'), {
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
  if (serverModeCache !== false || getBackendUrl()) {
    try {
      const res = await fetch(buildApiEndpoint(`/api/channels/${id}`), {
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
  if (serverModeCache !== false || getBackendUrl()) {
    try {
      const res = await fetch(buildApiEndpoint(`/api/channels/${id}`), {
        method: 'DELETE',
      });
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
  if (serverModeCache !== false || getBackendUrl()) {
    try {
      const res = await fetch(buildApiEndpoint('/api/test'), {
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

  const payload = buildClientTestWebhookPayload();
  const outcome = await postWebhookDirectFromBrowser(webhookUrl, payload);
  return { success: outcome.ok, error: outcome.error };
}

export async function apiUploadImage(
  base64Data: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (serverModeCache !== false || getBackendUrl()) {
    try {
      const res = await fetch(buildApiEndpoint('/api/upload'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data }),
      });
      if (isJsonResponse(res)) {
        serverModeCache = true;
        const data = await res.json();
        if (!res.ok) return { ok: false, error: data.error || 'فشل رفع الصورة' };
        const rawUrl = String(data.url || '');
        const base = getBackendUrl();
        const fullUrl =
          base && rawUrl.startsWith('/') ? `${base}${rawUrl}` : rawUrl;
        return { ok: true, url: fullUrl };
      }
      serverModeCache = false;
    } catch {
      serverModeCache = false;
    }
  }

  return { ok: true, url: base64Data };
}

export async function apiListAnnouncements(): Promise<Announcement[]> {
  try {
    const res = await fetch(buildApiEndpoint('/api/announcements'));
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
  if (serverModeCache !== false || getBackendUrl()) {
    try {
      const res = await fetch(buildApiEndpoint('/api/announcements'), {
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
  if (serverModeCache !== false || getBackendUrl()) {
    try {
      const res = await fetch(buildApiEndpoint('/api/announcements/publish'), {
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

  const announcements = readLocal<Announcement>(LS_ANNOUNCEMENTS_KEY);
  const announcement = announcements.find((a) => a.id === announcementId);
  if (!announcement) {
    return {
      success: false,
      totalChannels: 0,
      successful: 0,
      results: [],
      error: 'الإعلان غير موجود',
    };
  }

  const targetIds = announcement.channelIds
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const channels = readLocal<TeamChannel>(LS_CHANNELS_KEY).filter(
    (c) => c.isActive && targetIds.includes(c.id),
  );

  if (channels.length === 0) {
    return {
      success: false,
      totalChannels: 0,
      successful: 0,
      results: [],
      error: 'لا توجد قنوات نشطة محددة لهذا الإعلان',
    };
  }

  const payload = buildClientAdaptiveCardPayload(announcement);
  const results: Array<{ channel: string; ok: boolean; detail: string }> = [];
  let successful = 0;

  for (const ch of channels) {
    const outcome = await postWebhookDirectFromBrowser(ch.webhookUrl, payload);
    if (outcome.ok) {
      successful += 1;
      results.push({ channel: ch.name, ok: true, detail: 'Sent successfully' });
    } else {
      results.push({
        channel: ch.name,
        ok: false,
        detail: outcome.error || 'Unknown error',
      });
    }
  }

  if (successful > 0) {
    const now = new Date().toISOString();
    writeLocal(
      LS_ANNOUNCEMENTS_KEY,
      announcements.map((a) =>
        a.id === announcementId
          ? { ...a, status: 'منشور', publishedAt: now, updatedAt: now }
          : a,
      ),
    );
  }

  return {
    success: successful > 0,
    totalChannels: channels.length,
    successful,
    results,
  };
}

import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import {
  buildAnnouncementCardPayload,
  buildTestWebhookPayload,
} from './server/adaptiveCard.ts';
import {
  createAnnouncement,
  createChannel,
  deleteChannel,
  getActiveChannelsByIds,
  getAnnouncementById,
  listAnnouncements,
  listChannels,
  markAnnouncementPublished,
  toggleChannelActive,
} from './server/db.ts';
import {
  getUploadsDir,
  saveBase64Image,
  validateOutboundUrl,
} from './server/security.ts';

const PORT = Number(process.env.PORT) || 3000;

async function postToTeamsWebhook(
  webhookUrl: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; statusCode?: number; body?: string; error?: string }> {
  const urlCheck = await validateOutboundUrl(webhookUrl, { requireHttps: true });
  if (!urlCheck.ok) {
    return { ok: false, error: urlCheck.error };
  }

  try {
    const response = await fetch(urlCheck.url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const responseText = (await response.text()).trim();
    if (response.status === 200 && responseText === '1') {
      return { ok: true, statusCode: response.status, body: responseText };
    }

    if (!responseText) {
      return {
        ok: false,
        statusCode: response.status,
        body: '',
        error: `Teams returned empty response (HTTP ${response.status}).`,
      };
    }

    return {
      ok: false,
      statusCode: response.status,
      body: responseText,
      error: `Teams rejected (HTTP ${response.status}): ${responseText}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network request failed';
    return { ok: false, error: message };
  }
}

async function startServer() {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '10mb' }));

  app.use('/api', (req, res, next) => {
    const origin = req.headers.origin;
    if (
      origin &&
      (/^https:\/\/[a-z0-9-]+\.github\.io$/i.test(origin) ||
        /^http:\/\/localhost:\d+$/i.test(origin))
    ) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  const uploadsDir = getUploadsDir();
  app.use('/uploads', express.static(uploadsDir));

  // Channels API
  app.get('/api/channels', (_req, res) => {
    try {
      res.json(listChannels());
    } catch {
      res.status(500).json({ error: 'تعذر تحميل القنوات' });
    }
  });

  app.post('/api/channels', async (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const webhookUrl =
      typeof req.body?.webhookUrl === 'string' ? req.body.webhookUrl.trim() : '';
    const description =
      typeof req.body?.description === 'string' ? req.body.description.trim() : '';

    if (!name || !webhookUrl) {
      res.status(400).json({ error: 'الاسم ورابط الويب هوك مطلوبان' });
      return;
    }

    const urlCheck = await validateOutboundUrl(webhookUrl, { requireHttps: true });
    if (!urlCheck.ok) {
      res.status(400).json({ error: urlCheck.error });
      return;
    }

    try {
      const created = createChannel({
        name,
        webhookUrl: urlCheck.url.toString(),
        description: description || null,
      });
      res.status(201).json(created);
    } catch {
      res.status(500).json({ error: 'تعذر حفظ القناة' });
    }
  });

  app.delete('/api/channels/:id', (req, res) => {
    const id = req.params.id;
    const deleted = deleteChannel(id);
    if (!deleted) {
      res.status(404).json({ error: 'القناة غير موجودة' });
      return;
    }
    res.json({ success: true });
  });

  app.patch('/api/channels/:id', (req, res) => {
    const id = req.params.id;
    if (typeof req.body?.isActive !== 'boolean') {
      res.status(400).json({ error: 'حالة القناة مطلوبة' });
      return;
    }
    const updated = toggleChannelActive(id, req.body.isActive);
    if (!updated) {
      res.status(404).json({ error: 'القناة غير موجودة' });
      return;
    }
    res.json(updated);
  });

  // Announcements API
  app.get('/api/announcements', (_req, res) => {
    try {
      res.json(listAnnouncements());
    } catch {
      res.status(500).json({ error: 'تعذر تحميل سجل الإعلانات' });
    }
  });

  app.post('/api/announcements', async (req, res) => {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const content = typeof req.body?.content === 'string' ? req.body.content : '';

    if (!title || !content.trim()) {
      res.status(400).json({ error: 'العنوان والمحتوى مطلوبان' });
      return;
    }

    const rawImageUrl =
      typeof req.body?.imageUrl === 'string' ? req.body.imageUrl.trim() : '';
    if (rawImageUrl && !rawImageUrl.startsWith('/uploads/')) {
      const imgCheck = await validateOutboundUrl(rawImageUrl, { requireHttps: false });
      if (!imgCheck.ok) {
        res.status(400).json({ error: 'رابط الصورة غير صالح' });
        return;
      }
    }

    try {
      const created = createAnnouncement({
        title,
        subheading:
          typeof req.body?.subheading === 'string' ? req.body.subheading.trim() : '',
        content,
        contentColor:
          typeof req.body?.contentColor === 'string'
            ? req.body.contentColor
            : 'default',
        priority:
          typeof req.body?.priority === 'string' ? req.body.priority : 'عادي',
        channelIds: Array.isArray(req.body?.channelIds)
          ? req.body.channelIds.map((c: unknown) => String(c))
          : [],
        headerColor:
          typeof req.body?.headerColor === 'string' ? req.body.headerColor : '008272',
        titleSize:
          typeof req.body?.titleSize === 'string' ? req.body.titleSize : 'Large',
        titleAlignment:
          typeof req.body?.titleAlignment === 'string'
            ? req.body.titleAlignment
            : 'right',
        alignment:
          typeof req.body?.alignment === 'string' ? req.body.alignment : 'right',
        announcementDate:
          typeof req.body?.announcementDate === 'string'
            ? req.body.announcementDate
            : '',
        source: typeof req.body?.source === 'string' ? req.body.source : '',
        imageUrl: rawImageUrl,
      });
      res.status(201).json(created);
    } catch {
      res.status(500).json({ error: 'تعذر حفظ الإعلان' });
    }
  });

  app.post('/api/announcements/publish', async (req, res) => {
    const announcementId =
      typeof req.body?.announcementId === 'string' ? req.body.announcementId.trim() : '';

    if (!announcementId) {
      res.status(400).json({ error: 'معرف الإعلان مطلوب' });
      return;
    }

    const announcement = getAnnouncementById(announcementId);
    if (!announcement) {
      res.status(404).json({ error: 'الإعلان غير موجود' });
      return;
    }

    const targetIds = announcement.channelIds
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const activeChannels = getActiveChannelsByIds(targetIds);

    if (activeChannels.length === 0) {
      res.status(400).json({
        success: false,
        totalChannels: 0,
        successful: 0,
        results: [],
        error: 'لا توجد قنوات نشطة محددة لهذا الإعلان',
      });
      return;
    }

    const host = req.get('x-forwarded-host') || req.get('host') || '';
    const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
    const originBaseUrl =
      process.env.APP_URL && /^https?:\/\//i.test(process.env.APP_URL)
        ? process.env.APP_URL
        : host
          ? `${proto}://${host}`
          : '';

    const payload = buildAnnouncementCardPayload(announcement, originBaseUrl);
    const results: Array<{ channel: string; ok: boolean; detail: string }> = [];
    let successCount = 0;

    // Sequential loop per specification
    for (const channel of activeChannels) {
      const outcome = await postToTeamsWebhook(channel.webhookUrl, payload);
      if (outcome.ok) {
        successCount += 1;
        results.push({
          channel: channel.name,
          ok: true,
          detail: 'Sent successfully',
        });
      } else {
        results.push({
          channel: channel.name,
          ok: false,
          detail: outcome.error || 'Unknown error',
        });
      }
    }

    if (successCount > 0) {
      markAnnouncementPublished(announcement.id);
    }

    res.json({
      success: successCount > 0,
      totalChannels: activeChannels.length,
      successful: successCount,
      results,
    });
  });

  // Webhook Test API
  app.post('/api/test', async (req, res) => {
    const webhookUrl =
      typeof req.body?.webhookUrl === 'string' ? req.body.webhookUrl.trim() : '';

    if (!webhookUrl) {
      res.status(400).json({ success: false, error: 'رابط الويب هوك مطلوب' });
      return;
    }

    const payload = buildTestWebhookPayload();
    const outcome = await postToTeamsWebhook(webhookUrl, payload);

    res.json({
      success: outcome.ok,
      statusCode: outcome.statusCode,
      teamsResponse: outcome.body,
      error: outcome.error,
    });
  });

  // Image Upload API
  app.post('/api/upload', (req, res) => {
    const base64Data =
      typeof req.body?.base64Data === 'string' ? req.body.base64Data : '';

    if (!base64Data) {
      res.status(400).json({ error: 'بيانات الصورة مطلوبة' });
      return;
    }

    const saved = saveBase64Image(base64Data);
    if (!saved.ok) {
      res.status(400).json({ error: saved.error });
      return;
    }

    res.json({ url: saved.url });
  });

  // Vite middleware in development, dist in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Teams Announcer running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

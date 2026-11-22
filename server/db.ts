import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface TeamChannel {
  id: string;
  name: string;
  webhookUrl: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  subheading: string;
  content: string;
  contentColor: string;
  priority: string;
  status: string;
  channelIds: string;
  headerColor: string;
  titleSize: string;
  titleAlignment: string;
  alignment: string;
  announcementDate: string;
  source: string;
  imageUrl: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RawChannelRow {
  id: string;
  name: string;
  webhookUrl: string;
  description: string | null;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

const dbPath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.resolve(process.cwd(), 'db', 'custom.db');

fs.mkdirSync(path.dirname(dbPath), {recursive: true});

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS TeamChannel (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    webhookUrl TEXT NOT NULL,
    description TEXT,
    isActive INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS Announcement (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subheading TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL,
    contentColor TEXT NOT NULL DEFAULT 'default',
    priority TEXT NOT NULL DEFAULT 'عادي',
    status TEXT NOT NULL DEFAULT 'مسودة',
    channelIds TEXT NOT NULL DEFAULT '',
    headerColor TEXT NOT NULL DEFAULT '0078D7',
    titleSize TEXT NOT NULL DEFAULT 'Large',
    titleAlignment TEXT NOT NULL DEFAULT 'right',
    alignment TEXT NOT NULL DEFAULT 'right',
    announcementDate TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT '',
    imageUrl TEXT NOT NULL DEFAULT '',
    publishedAt TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
`);

function mapChannel(row: RawChannelRow): TeamChannel {
  return {
    id: row.id,
    name: row.name,
    webhookUrl: row.webhookUrl,
    description: row.description,
    isActive: row.isActive === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function listChannels(): TeamChannel[] {
  const rows = db
    .prepare('SELECT * FROM TeamChannel ORDER BY createdAt DESC')
    .all() as RawChannelRow[];
  return rows.map(mapChannel);
}

export function createChannel(input: {
  name: string;
  webhookUrl: string;
  description?: string | null;
}): TeamChannel {
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO TeamChannel (id, name, webhookUrl, description, isActive, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, 1, ?, ?)`,
  ).run(id, input.name, input.webhookUrl, input.description || null, now, now);

  const created = db
    .prepare('SELECT * FROM TeamChannel WHERE id = ?')
    .get(id) as RawChannelRow;
  return mapChannel(created);
}

export function toggleChannelActive(id: string, isActive: boolean): TeamChannel | null {
  const now = new Date().toISOString();
  const result = db
    .prepare('UPDATE TeamChannel SET isActive = ?, updatedAt = ? WHERE id = ?')
    .run(isActive ? 1 : 0, now, id);
  if (result.changes === 0) {
    return null;
  }
  const updated = db
    .prepare('SELECT * FROM TeamChannel WHERE id = ?')
    .get(id) as RawChannelRow;
  return mapChannel(updated);
}

export function deleteChannel(id: string): boolean {
  const result = db.prepare('DELETE FROM TeamChannel WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getActiveChannelsByIds(ids: string[]): TeamChannel[] {
  const cleaned = ids.map((s) => s.trim()).filter(Boolean);
  if (cleaned.length === 0) {
    return [];
  }
  const placeholders = cleaned.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT * FROM TeamChannel WHERE isActive = 1 AND id IN (${placeholders})`,
    )
    .all(...cleaned) as RawChannelRow[];
  return rows.map(mapChannel);
}

export function listAnnouncements(): Announcement[] {
  return db
    .prepare('SELECT * FROM Announcement ORDER BY createdAt DESC')
    .all() as Announcement[];
}

export function getAnnouncementById(id: string): Announcement | null {
  const row = db
    .prepare('SELECT * FROM Announcement WHERE id = ?')
    .get(id) as Announcement | undefined;
  return row ?? null;
}

export function createAnnouncement(input: {
  title: string;
  subheading?: string;
  content: string;
  contentColor?: string;
  priority?: string;
  channelIds: string[];
  headerColor?: string;
  titleSize?: string;
  titleAlignment?: string;
  alignment?: string;
  announcementDate?: string;
  source?: string;
  imageUrl?: string;
}): Announcement {
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  const now = new Date().toISOString();
  const channelIdsStr = Array.isArray(input.channelIds)
    ? input.channelIds.map((c) => String(c).trim()).filter(Boolean).join(',')
    : '';

  db.prepare(
    `INSERT INTO Announcement (
      id, title, subheading, content, contentColor, priority, status,
      channelIds, headerColor, titleSize, titleAlignment, alignment,
      announcementDate, source, imageUrl, publishedAt, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, 'مسودة', ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
  ).run(
    id,
    input.title,
    input.subheading ?? '',
    input.content,
    input.contentColor || 'default',
    input.priority || 'عادي',
    channelIdsStr,
    input.headerColor || '008272',
    input.titleSize || 'Large',
    input.titleAlignment || 'right',
    input.alignment || 'right',
    input.announcementDate ?? '',
    input.source ?? '',
    input.imageUrl ?? '',
    now,
    now,
  );

  return db
    .prepare('SELECT * FROM Announcement WHERE id = ?')
    .get(id) as Announcement;
}

export function markAnnouncementPublished(id: string): Announcement | null {
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `UPDATE Announcement
       SET status = 'منشور', publishedAt = ?, updatedAt = ?
       WHERE id = ?`,
    )
    .run(now, now, id);
  if (result.changes === 0) {
    return null;
  }
  return getAnnouncementById(id);
}

import type { Announcement } from '../types';

type CardAlignment = 'Right' | 'Center' | 'Left';
type TeamsColor =
  | 'Default'
  | 'Dark'
  | 'Light'
  | 'Accent'
  | 'Good'
  | 'Warning'
  | 'Attention';

interface InlineRun {
  text: string;
  bold: boolean;
  color: TeamsColor;
  url?: string;
}

const HEADER_STYLE_MAP: Record<string, string> = {
  '0078D7': 'emphasis',
  '008272': 'good',
  D13438: 'danger',
  CA5010: 'warning',
  '986F0B': 'attention',
  '5C2D91': 'accent',
  none: 'default',
};

const HEX_COLOR_MAP: Record<string, TeamsColor> = {
  '#333333': 'Default',
  '#000000': 'Dark',
  '#0078d7': 'Accent',
  '#008272': 'Good',
  '#ca5010': 'Warning',
  '#d13438': 'Attention',
  '#999999': 'Light',
  '#ff0000': 'Attention',
  '#e74c3c': 'Attention',
  '#f39c12': 'Warning',
  '#986f0b': 'Warning',
  '#27ae60': 'Good',
  '#2ecc71': 'Good',
  '#3498db': 'Accent',
  '#9b59b6': 'Accent',
  '#5c2d91': 'Accent',
};

const NAMED_TEAMS_COLORS: Record<string, TeamsColor> = {
  default: 'Default',
  dark: 'Dark',
  light: 'Light',
  accent: 'Accent',
  good: 'Good',
  warning: 'Warning',
  attention: 'Attention',
};

const TEAMS_COLOR_RGB: Array<{ name: TeamsColor; r: number; g: number; b: number }> = [
  { name: 'Dark', r: 0, g: 0, b: 0 },
  { name: 'Default', r: 51, g: 51, b: 51 },
  { name: 'Accent', r: 0, g: 120, b: 215 },
  { name: 'Good', r: 0, g: 130, b: 114 },
  { name: 'Warning', r: 202, g: 80, b: 16 },
  { name: 'Attention', r: 209, g: 52, b: 56 },
  { name: 'Light', r: 153, g: 153, b: 153 },
];

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    });
}

function rgbToNearestTeamsColor(r: number, g: number, b: number): TeamsColor {
  let best: TeamsColor = 'Default';
  let minDist = Infinity;
  for (const candidate of TEAMS_COLOR_RGB) {
    const dist =
      (r - candidate.r) ** 2 + (g - candidate.g) ** 2 + (b - candidate.b) ** 2;
    if (dist < minDist) {
      minDist = dist;
      best = candidate.name;
    }
  }
  return best;
}

function mapColorToTeams(rawColor: string | undefined): TeamsColor {
  if (!rawColor) return 'Default';
  const trimmed = rawColor.trim().toLowerCase();
  if (NAMED_TEAMS_COLORS[trimmed]) return NAMED_TEAMS_COLORS[trimmed];

  const rgbMatch = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(trimmed);
  if (rgbMatch) {
    const r = Number.parseInt(rgbMatch[1], 10);
    const g = Number.parseInt(rgbMatch[2], 10);
    const b = Number.parseInt(rgbMatch[3], 10);
    const hex =
      '#' +
      [r, g, b]
        .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0'))
        .join('');
    return HEX_COLOR_MAP[hex] ?? rgbToNearestTeamsColor(r, g, b);
  }

  let normalizedHex = trimmed;
  if (/^[0-9a-f]{6}$/i.test(normalizedHex)) {
    normalizedHex = `#${normalizedHex}`;
  } else if (/^#[0-9a-f]{3}$/i.test(normalizedHex)) {
    normalizedHex =
      '#' +
      normalizedHex[1] +
      normalizedHex[1] +
      normalizedHex[2] +
      normalizedHex[2] +
      normalizedHex[3] +
      normalizedHex[3];
  }

  if (HEX_COLOR_MAP[normalizedHex]) return HEX_COLOR_MAP[normalizedHex];

  if (/^#[0-9a-f]{6}$/i.test(normalizedHex)) {
    const r = Number.parseInt(normalizedHex.slice(1, 3), 16);
    const g = Number.parseInt(normalizedHex.slice(3, 5), 16);
    const b = Number.parseInt(normalizedHex.slice(5, 7), 16);
    return rgbToNearestTeamsColor(r, g, b);
  }

  return 'Default';
}

function mapAlignment(alignment: string | undefined): CardAlignment {
  const lower = (alignment || 'right').toLowerCase();
  if (lower === 'left') return 'Left';
  if (lower === 'center') return 'Center';
  return 'Right';
}

function extractAttr(attrs: string, attrName: string): string | undefined {
  const regex = new RegExp(`${attrName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = regex.exec(attrs);
  if (!match) return undefined;
  return match[1] ?? match[2] ?? match[3];
}

function extractStyleColor(attrs: string): string | undefined {
  const style = extractAttr(attrs, 'style');
  if (!style) return undefined;
  const colorMatch = /(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(style);
  return colorMatch ? colorMatch[1].trim() : undefined;
}

function parseInlines(line: string): InlineRun[] {
  const tagRegex = /<\/?(?:b|strong|u|i|em|font|span|a)(?:\s+[^>]*)?>/gi;
  const runs: InlineRun[] = [];
  let boldDepth = 0;
  const colorStack: TeamsColor[] = [];
  const tagColorFlags: boolean[] = [];
  const urlStack: Array<string | undefined> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const pushText = (rawSegment: string) => {
    const cleanText = decodeHtmlEntities(rawSegment.replace(/<[^>]*>/g, ''));
    if (!cleanText) return;
    const currentColor =
      colorStack.length > 0 ? colorStack[colorStack.length - 1] : 'Default';
    const currentUrl =
      urlStack.length > 0 ? urlStack[urlStack.length - 1] : undefined;
    const isBold = boldDepth > 0;
    const prev = runs[runs.length - 1];
    if (
      prev &&
      prev.bold === isBold &&
      prev.color === currentColor &&
      prev.url === currentUrl
    ) {
      prev.text += cleanText;
    } else {
      runs.push({ text: cleanText, bold: isBold, color: currentColor, url: currentUrl });
    }
  };

  while ((match = tagRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      pushText(line.slice(lastIndex, match.index));
    }
    const fullTag = match[0];
    const isClosing = fullTag.startsWith('</');
    const nameMatch = /^<\/?([a-z]+)/i.exec(fullTag);
    const tagName = nameMatch ? nameMatch[1].toLowerCase() : '';
    const attrs = fullTag.slice(isClosing ? 2 + tagName.length : 1 + tagName.length, -1);

    if (tagName === 'b' || tagName === 'strong') {
      boldDepth = isClosing ? Math.max(0, boldDepth - 1) : boldDepth + 1;
    } else if (tagName === 'font' || tagName === 'span') {
      if (isClosing) {
        if (tagColorFlags.pop()) colorStack.pop();
      } else {
        const rawColor =
          (tagName === 'font' ? extractAttr(attrs, 'color') : undefined) ||
          extractStyleColor(attrs);
        if (rawColor) {
          colorStack.push(mapColorToTeams(rawColor));
          tagColorFlags.push(true);
        } else {
          tagColorFlags.push(false);
        }
      }
    } else if (tagName === 'a') {
      if (isClosing) {
        urlStack.pop();
      } else {
        const rawHref = extractAttr(attrs, 'href');
        const decodedHref = rawHref ? decodeHtmlEntities(rawHref).trim() : '';
        urlStack.push(/^https?:\/\//i.test(decodedHref) ? decodedHref : undefined);
      }
    }
    lastIndex = tagRegex.lastIndex;
  }

  if (lastIndex < line.length) {
    pushText(line.slice(lastIndex));
  }
  return runs;
}

function buildContentElements(
  content: string,
  alignment: string,
): Record<string, unknown>[] {
  const cardAlignment = mapAlignment(alignment);
  if (!/<[a-z][\s\S]*>/i.test(content)) {
    const cleanPlain = decodeHtmlEntities(content).trim();
    if (!cleanPlain) return [];
    return [
      {
        type: 'TextBlock',
        text: cleanPlain,
        wrap: true,
        spacing: 'Medium',
        horizontalAlignment: cardAlignment,
      },
    ];
  }

  const normalized = content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|h[1-6]|li)>/gi, '\n')
    .replace(/<(div|p|h[1-6]|ul|ol|li)(?:\s+[^>]*)?>/gi, '')
    .replace(/<\/(ul|ol)>/gi, '\n')
    .replace(/<strong(\s+[^>]*)?>/gi, '<b>')
    .replace(/<\/strong>/gi, '</b>')
    .replace(/<em(\s+[^>]*)?>/gi, '<i>')
    .replace(/<\/em>/gi, '</i>')
    .replace(/&nbsp;/gi, ' ');

  const lines = normalized
    .split('\n')
    .filter((line) => decodeHtmlEntities(line.replace(/<[^>]*>/g, '')).trim().length > 0);

  const elements: Record<string, unknown>[] = [];
  lines.forEach((line, idx) => {
    const runs = parseInlines(line);
    if (runs.length === 0) return;
    const spacing = idx === 0 ? 'Medium' : 'Small';
    const isPlainSingle =
      runs.length === 1 && !runs[0].bold && runs[0].color === 'Default' && !runs[0].url;

    if (isPlainSingle) {
      elements.push({
        type: 'TextBlock',
        text: runs[0].text,
        wrap: true,
        spacing,
        horizontalAlignment: cardAlignment,
      });
    } else {
      elements.push({
        type: 'RichTextBlock',
        spacing,
        horizontalAlignment: cardAlignment,
        inlines: runs.map((run) => {
          const textRun: Record<string, unknown> = { type: 'TextRun', text: run.text };
          if (run.bold) textRun.weight = 'Bolder';
          if (run.color !== 'Default') textRun.color = run.color;
          if (run.url) {
            textRun.underline = true;
            if (run.color === 'Default') textRun.color = 'Accent';
            textRun.selectAction = { type: 'Action.OpenUrl', url: run.url };
          }
          return textRun;
        }),
      });
    }
  });
  return elements;
}

function extractUrls(html: string): Array<{ url: string; text: string }> {
  const linkRegex = /<a\s+[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi;
  const seen = new Set<string>();
  const links: Array<{ url: string; text: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null) {
    const rawHref = match[1] ?? match[2] ?? '';
    const url = decodeHtmlEntities(rawHref).trim();
    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    const rawText = decodeHtmlEntities((match[3] || '').replace(/<[^>]*>/g, '')).trim();
    let title = rawText || url;
    if (title.length > 30) title = `${title.slice(0, 27)}...`;
    links.push({ url, text: title });
  }
  return links;
}

export function buildClientAdaptiveCardPayload(
  announcement: Pick<
    Announcement,
    | 'title'
    | 'subheading'
    | 'content'
    | 'headerColor'
    | 'titleSize'
    | 'titleAlignment'
    | 'alignment'
    | 'imageUrl'
    | 'announcementDate'
    | 'source'
    | 'priority'
  >,
): Record<string, unknown> {
  const headerStyle =
    HEADER_STYLE_MAP[announcement.headerColor] ??
    HEADER_STYLE_MAP[announcement.headerColor?.toUpperCase()] ??
    'default';
  const validSizes = ['Medium', 'Large', 'ExtraLarge'];
  const titleSize = validSizes.includes(announcement.titleSize)
    ? announcement.titleSize
    : 'Large';
  const cardTitleAlign = mapAlignment(announcement.titleAlignment);
  const body: Record<string, unknown>[] = [];

  if (headerStyle !== 'default') {
    body.push({
      type: 'Container',
      style: headerStyle,
      bleed: true,
      items: [
        {
          type: 'TextBlock',
          text: announcement.title,
          size: titleSize,
          weight: 'Bolder',
          color: 'Light',
          wrap: true,
          horizontalAlignment: cardTitleAlign,
        },
      ],
    });
  } else {
    body.push({
      type: 'TextBlock',
      text: announcement.title,
      size: titleSize,
      weight: 'Bolder',
      wrap: true,
      horizontalAlignment: cardTitleAlign,
    });
  }

  if (announcement.subheading?.trim()) {
    body.push({
      type: 'TextBlock',
      text: announcement.subheading.trim(),
      size: 'Medium',
      weight: 'Bolder',
      isSubtle: true,
      wrap: true,
      spacing: 'Small',
      horizontalAlignment: cardTitleAlign,
    });
  }

  body.push(...buildContentElements(announcement.content, announcement.alignment));

  if (announcement.imageUrl && /^https?:\/\//i.test(announcement.imageUrl.trim())) {
    body.push({
      type: 'Image',
      url: announcement.imageUrl.trim(),
      size: 'Large',
      spacing: 'Medium',
    });
  }

  const extractedLinks = extractUrls(announcement.content);
  if (extractedLinks.length > 0) {
    body.push({
      type: 'ActionSet',
      actions: extractedLinks.map((link) => ({
        type: 'Action.OpenUrl',
        title: link.text,
        url: link.url,
      })),
      spacing: 'Medium',
    });
  }

  body.push({
    type: 'TextBlock',
    text: '',
    separator: true,
    spacing: 'Medium',
  });

  body.push({
    type: 'TextBlock',
    text: '**Knowledge Management | Customer Care**',
    size: 'Small',
    weight: 'Bolder',
    color: 'Accent',
    wrap: true,
    horizontalAlignment: 'Left',
    spacing: 'Small',
  });

  const priorityMap: Record<string, string> = {
    عاجل: 'Urgent',
    مهم: 'Important',
    عادي: 'Normal',
  };

  const facts: Array<{ title: string; value: string }> = [];
  if (announcement.announcementDate?.trim()) {
    facts.push({ title: 'Date', value: announcement.announcementDate.trim() });
  }
  if (announcement.source?.trim()) {
    facts.push({ title: 'Source', value: announcement.source.trim() });
  }
  if (announcement.priority?.trim()) {
    facts.push({ title: 'Priority', value: priorityMap[announcement.priority] || 'Normal' });
  }
  if (facts.length > 0) {
    body.push({ type: 'FactSet', facts, spacing: 'Small' });
  }

  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          msteams: { width: 'Full' },
          body,
        },
      },
    ],
  };
}

export function buildClientTestWebhookPayload(): Record<string, unknown> {
  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          msteams: { width: 'Full' },
          body: [
            {
              type: 'Container',
              style: 'good',
              bleed: true,
              items: [
                {
                  type: 'TextBlock',
                  text: 'Webhook Test - Connected!',
                  size: 'Large',
                  weight: 'Bolder',
                  color: 'Light',
                  wrap: true,
                },
              ],
            },
            {
              type: 'TextBlock',
              text: 'Teams Announcer is working correctly.',
              wrap: true,
              spacing: 'Medium',
            },
          ],
        },
      },
    ],
  };
}

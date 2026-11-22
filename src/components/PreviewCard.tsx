import DOMPurify from 'dompurify';
import { ExternalLink, ImageOff } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { TextAlignment, TitleSize } from '../types';

interface PreviewCardProps {
  title: string;
  subheading: string;
  content: string;
  headerColor: string;
  titleSize: TitleSize;
  titleAlignment: TextAlignment;
  alignment: TextAlignment;
  imageUrl: string;
  announcementDate: string;
  source: string;
  priority: string;
}

const HEADER_HEX_MAP: Record<string, string> = {
  '0078D7': '#0078D7',
  '008272': '#008272',
  D13438: '#D13438',
  CA5010: '#CA5010',
  '986F0B': '#986F0B',
  '5C2D91': '#5C2D91',
};

const PRIORITY_EN_MAP: Record<string, string> = {
  عاجل: 'Urgent',
  مهم: 'Important',
  عادي: 'Normal',
};

function getTitleSizeClass(size: TitleSize): string {
  if (size === 'Medium') return 'text-base';
  if (size === 'ExtraLarge') return 'text-xl';
  return 'text-lg';
}

function getAlignClass(align: TextAlignment): string {
  if (align === 'left') return 'text-left';
  if (align === 'center') return 'text-center';
  return 'text-right';
}

function formatPreviewDate(dateStr: string): string {
  if (!dateStr.trim()) return '';
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function extractPreviewLinks(html: string): Array<{ url: string; text: string }> {
  if (!html) return [];
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const anchors = Array.from(doc.querySelectorAll('a[href]'));
  const seen = new Set<string>();
  const links: Array<{ url: string; text: string }> = [];

  for (const a of anchors) {
    const href = (a.getAttribute('href') || '').trim();
    if (!/^https?:\/\//i.test(href) || seen.has(href)) continue;
    seen.add(href);
    let label = (a.textContent || '').trim() || href;
    if (label.length > 30) {
      label = `${label.slice(0, 27)}...`;
    }
    links.push({ url: href, text: label });
  }
  return links;
}

export function PreviewCard({
  title,
  subheading,
  content,
  headerColor,
  titleSize,
  titleAlignment,
  alignment,
  imageUrl,
  announcementDate,
  source,
  priority,
}: PreviewCardProps) {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [imageUrl]);

  const headerHex = HEADER_HEX_MAP[headerColor];
  const isColoredHeader = Boolean(headerHex && headerColor !== 'none');

  const sanitizedContent = useMemo(() => {
    if (!content) return '';
    return DOMPurify.sanitize(content, {
      ALLOWED_TAGS: ['b', 'strong', 'u', 'i', 'em', 'font', 'span', 'a', 'br', 'div', 'p'],
      ALLOWED_ATTR: ['color', 'style', 'href', 'target', 'rel'],
      ALLOW_DATA_ATTR: false,
    });
  }, [content]);

  const extractedLinks = useMemo(() => extractPreviewLinks(sanitizedContent), [sanitizedContent]);
  const formattedDate = formatPreviewDate(announcementDate);
  const enPriority = PRIORITY_EN_MAP[priority] || 'Normal';

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-xs">
      {/* 1. Header */}
      {isColoredHeader ? (
        <div
          className="px-4 py-3.5"
          style={{ backgroundColor: headerHex }}
        >
          <h3
            className={`font-bold text-white leading-snug break-words ${getTitleSizeClass(
              titleSize,
            )} ${getAlignClass(titleAlignment)}`}
            dir={titleAlignment === 'left' ? 'ltr' : 'rtl'}
          >
            {title.trim() || 'عنوان الإعلان سيظهر هنا'}
          </h3>
        </div>
      ) : (
        <div className="px-4 pt-4 pb-1">
          <h3
            className={`font-bold text-slate-900 leading-snug break-words ${getTitleSizeClass(
              titleSize,
            )} ${getAlignClass(titleAlignment)}`}
            dir={titleAlignment === 'left' ? 'ltr' : 'rtl'}
          >
            {title.trim() || 'عنوان الإعلان سيظهر هنا'}
          </h3>
        </div>
      )}

      <div className="p-4 space-y-3">
        {/* 2. Subheading */}
        {subheading.trim() && (
          <p
            className={`text-sm font-semibold text-slate-500 ${getAlignClass(
              titleAlignment,
            )}`}
            dir={titleAlignment === 'left' ? 'ltr' : 'rtl'}
          >
            {subheading.trim()}
          </p>
        )}

        {/* 3. Rich HTML content */}
        {sanitizedContent.trim() ? (
          <div
            className={`preview-content text-sm text-slate-800 leading-relaxed break-words ${getAlignClass(
              alignment,
            )}`}
            dir={alignment === 'left' ? 'ltr' : 'rtl'}
            dangerouslySetInnerHTML={{ __html: sanitizedContent }}
          />
        ) : (
          <p className="text-sm text-slate-400 italic text-right">
            محتوى الإعلان سيظهر هنا عند الكتابة...
          </p>
        )}

        {/* 4. Image */}
        {imageUrl.trim() && !imageError && (
          <div className="pt-1 flex justify-center">
            <img
              src={imageUrl.trim()}
              alt="مرفق الإعلان"
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
              className="max-h-60 w-auto rounded-md border border-slate-100 object-contain"
            />
          </div>
        )}
        {imageUrl.trim() && imageError && (
          <div className="flex items-center justify-center gap-2 rounded-md border border-dashed border-slate-200 bg-slate-50 py-4 text-xs text-slate-500">
            <ImageOff className="size-4" />
            <span>تعذر تحميل معاينة الصورة</span>
          </div>
        )}

        {/* 5. In-body ActionSet links (before separator & metadata) */}
        {extractedLinks.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1" dir="rtl">
            {extractedLinks.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-[#0078D7] hover:bg-slate-50 transition-colors"
              >
                <ExternalLink className="size-3 shrink-0" />
                <span>{link.text}</span>
              </a>
            ))}
          </div>
        )}

        {/* 6. Separator */}
        <div className="border-t border-slate-200 pt-3" />

        {/* 7 & 8. LTR Metadata Footer */}
        <div dir="ltr" className="text-left space-y-1.5">
          <div className="text-[11px] font-bold text-[#0078D7]">
            Knowledge Management | Customer Care
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-[11px] text-slate-600 tabular-nums">
            {formattedDate && (
              <>
                <span className="font-semibold text-slate-700">Date:</span>
                <span>{formattedDate}</span>
              </>
            )}
            {source && (
              <>
                <span className="font-semibold text-slate-700">Source:</span>
                <span>{source}</span>
              </>
            )}
            <span className="font-semibold text-slate-700">Priority:</span>
            <span>{enPriority}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

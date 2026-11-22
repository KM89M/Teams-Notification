import {
  AlertTriangle,
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  CheckCircle2,
  ImagePlus,
  Link2,
  Maximize2,
  Palette,
  RefreshCw,
  Save,
  Send,
  X,
} from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { toast } from 'sonner';
import type {
  PriorityLevel,
  TeamChannel,
  TextAlignment,
  TitleSize,
} from '../types';
import { PreviewCard } from './PreviewCard';

interface ComposerTabProps {
  channels: TeamChannel[];
  onSaveDraft: (payload: AnnouncementFormPayload) => Promise<string | null>;
  onPublishNew: (payload: AnnouncementFormPayload) => Promise<boolean>;
}

export interface AnnouncementFormPayload {
  title: string;
  subheading: string;
  content: string;
  contentColor: string;
  priority: PriorityLevel;
  channelIds: string[];
  headerColor: string;
  titleSize: TitleSize;
  titleAlignment: TextAlignment;
  alignment: TextAlignment;
  announcementDate: string;
  source: string;
  imageUrl: string;
}

const TEXT_COLOR_SWATCHES = [
  { label: 'أسود', hex: '#000000' },
  { label: 'أحمر', hex: '#D13438' },
  { label: 'أزرق', hex: '#0078D7' },
  { label: 'أخضر', hex: '#008272' },
  { label: 'برتقالي', hex: '#CA5010' },
  { label: 'بنفسجي', hex: '#5C2D91' },
  { label: 'ذهبي', hex: '#986F0B' },
  { label: 'رمادي', hex: '#999999' },
];

const HEADER_COLOR_PRESETS = [
  { label: 'أزرق', value: '0078D7', hex: '#0078D7' },
  { label: 'أخضر', value: '008272', hex: '#008272' },
  { label: 'أحمر', value: 'D13438', hex: '#D13438' },
  { label: 'برتقالي', value: 'CA5010', hex: '#CA5010' },
  { label: 'ذهبي', value: '986F0B', hex: '#986F0B' },
  { label: 'بنفسجي', value: '5C2D91', hex: '#5C2D91' },
  { label: 'بدون لون', value: 'none', hex: '#E8E8E8' },
];

const SOURCE_OPTIONS = [
  { label: 'K.M', value: 'K.M' },
  { label: 'G.M', value: 'G.M' },
  { label: 'C.C', value: 'C.C' },
  { label: 'B.O', value: 'B.O' },
  { label: 'K.M & B.O', value: 'K.M&B.O' },
  { label: 'K.M & CC', value: 'K.M&CC' },
];

const TITLE_SIZE_OPTIONS: Array<{ label: string; value: TitleSize }> = [
  { label: 'متوسط', value: 'Medium' },
  { label: 'كبير', value: 'Large' },
  { label: 'كبير جداً', value: 'ExtraLarge' },
];

export function ComposerTab({
  channels,
  onSaveDraft,
  onPublishNew,
}: ComposerTabProps) {
  const [annTitle, setAnnTitle] = useState('');
  const [annSubheading, setAnnSubheading] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annPriority, setAnnPriority] = useState<PriorityLevel>('عادي');
  const [annHeaderColor, setAnnHeaderColor] = useState('0078D7');
  const [annTitleSize, setAnnTitleSize] = useState<TitleSize>('Large');
  const [annTitleAlignment, setAnnTitleAlignment] = useState<TextAlignment>('right');
  const [annAlignment, setAnnAlignment] = useState<TextAlignment>('right');
  const [annDate, setAnnDate] = useState('');
  const [annSource, setAnnSource] = useState('');
  const [annImageUrl, setAnnImageUrl] = useState('');
  const [annExternalImageUrl, setAnnExternalImageUrl] = useState('');
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [activeColor, setActiveColor] = useState('#D13438');
  const [editorKey, setEditorKey] = useState(0);

  const [uploadingImage, setUploadingImage] = useState(false);
  const [submittingAction, setSubmittingAction] = useState<'draft' | 'publish' | null>(
    null,
  );
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  // Link dialog state (replaces window.prompt for iframe reliability while preserving cloned Range)
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkUrlInput, setLinkUrlInput] = useState('https://');

  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const savedColorRangeRef = useRef<Range | null>(null);

  const activeChannels = channels.filter((c) => c.isActive);
  const effectiveImageUrl = annExternalImageUrl.trim() || annImageUrl;

  useEffect(() => {
    const activeSet = new Set(activeChannels.map((c) => c.id));
    setSelectedChannelIds((prev) => prev.filter((id) => activeSet.has(id)));
  }, [channels]);

  const syncEditorContent = () => {
    if (editorRef.current) {
      setAnnContent(editorRef.current.innerHTML);
    }
  };

  const handleEditorInput = () => {
    syncEditorContent();
  };

  const resetForm = () => {
    setAnnTitle('');
    setAnnSubheading('');
    setAnnContent('');
    setAnnPriority('عادي');
    setAnnHeaderColor('0078D7');
    setAnnTitleSize('Large');
    setAnnTitleAlignment('right');
    setAnnAlignment('right');
    setAnnDate('');
    setAnnSource('');
    setAnnImageUrl('');
    setAnnExternalImageUrl('');
    setSelectedChannelIds([]);
    setActiveColor('#D13438');
    setEditorKey((k) => k + 1);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleBoldClick = () => {
    editorRef.current?.focus();
    document.execCommand('bold');
    setTimeout(syncEditorContent, 10);
  };

  const handleSwatchColor = (hex: string) => {
    setActiveColor(hex);
    editorRef.current?.focus();
    setTimeout(() => {
      const sel = window.getSelection();
      if (
        !sel ||
        sel.rangeCount === 0 ||
        sel.isCollapsed ||
        !editorRef.current?.contains(sel.anchorNode)
      ) {
        toast.error('حدد النص أولاً ثم اختر اللون');
        return;
      }
      const range = sel.getRangeAt(0).cloneRange();
      document.execCommand('removeFormat');
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('foreColor', false, hex);
      setTimeout(syncEditorContent, 10);
    }, 20);
  };

  const captureSelectionBeforePicker = () => {
    const sel = window.getSelection();
    if (
      sel &&
      sel.rangeCount > 0 &&
      !sel.isCollapsed &&
      editorRef.current?.contains(sel.anchorNode)
    ) {
      savedColorRangeRef.current = sel.getRangeAt(0).cloneRange();
    } else {
      savedColorRangeRef.current = null;
    }
  };

  const handleCustomColorChange = (e: ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value;
    setActiveColor(hex);
    const saved = savedColorRangeRef.current;
    editorRef.current?.focus();
    setTimeout(() => {
      const sel = window.getSelection();
      if (saved && sel) {
        sel.removeAllRanges();
        sel.addRange(saved);
      }
      const activeSel = window.getSelection();
      if (
        !activeSel ||
        activeSel.rangeCount === 0 ||
        activeSel.isCollapsed ||
        !editorRef.current?.contains(activeSel.anchorNode)
      ) {
        toast.error('حدد النص أولاً ثم اختر اللون');
        return;
      }
      document.execCommand('foreColor', false, hex);
      savedColorRangeRef.current = activeSel.getRangeAt(0).cloneRange();
      setTimeout(syncEditorContent, 10);
    }, 20);
  };

  const handleOpenLinkModal = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      toast.error('حدد النص أولاً ثم اضغط زر الرابط');
      return;
    }
    if (!editorRef.current?.contains(sel.anchorNode)) {
      toast.error('حدد النص داخل محرر المحتوى');
      return;
    }
    // Clone Range BEFORE opening modal/prompt since focus shift clears selection
    savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    setLinkUrlInput('https://');
    setLinkModalOpen(true);
  };

  const handleConfirmInsertLink = () => {
    const rawUrl = linkUrlInput.trim();
    if (!/^https?:\/\/.+/i.test(rawUrl)) {
      toast.error('يرجى إدخال رابط صحيح يبدأ بـ https:// أو http://');
      return;
    }

    setLinkModalOpen(false);
    editorRef.current?.focus();

    setTimeout(() => {
      const sel = window.getSelection();
      if (sel && savedRangeRef.current) {
        sel.removeAllRanges();
        sel.addRange(savedRangeRef.current);
      }
      document.execCommand('createLink', false, rawUrl);

      setTimeout(() => {
        if (editorRef.current) {
          const anchors = editorRef.current.querySelectorAll('a');
          anchors.forEach((a) => {
            a.style.color = '#0078D7';
            a.style.textDecoration = 'underline';
            a.setAttribute('target', '_blank');
            a.setAttribute('rel', 'noopener noreferrer');
          });
          syncEditorContent();
        }
        savedRangeRef.current = null;
      }, 50);
    }, 10);
  };

  const handleImageFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار ملف صورة صالح');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('الحد الأقصى لحجم الصورة هو 5 ميجابايت');
      return;
    }

    setUploadingImage(true);
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'فشل رفع الصورة');
        return;
      }

      setAnnImageUrl(data.url);
      setAnnExternalImageUrl('');
      toast.success('تم رفع الصورة بنجاح');
    } catch {
      toast.error('حدث خطأ أثناء رفع الصورة');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleClearImage = () => {
    setAnnImageUrl('');
    setAnnExternalImageUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const allActiveSelected =
    activeChannels.length > 0 &&
    selectedChannelIds.length === activeChannels.length;

  const handleToggleSelectAll = () => {
    if (allActiveSelected) {
      setSelectedChannelIds([]);
    } else {
      setSelectedChannelIds(activeChannels.map((c) => c.id));
    }
  };

  const handleToggleChannel = (id: string) => {
    setSelectedChannelIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const buildValidatedPayload = (): AnnouncementFormPayload | null => {
    if (!annTitle.trim()) {
      toast.error('يرجى إدخال عنوان الإعلان');
      return null;
    }

    const plainText = (editorRef.current?.textContent || '').trim();
    if (!plainText) {
      toast.error('يرجى إدخال محتوى الإعلان');
      return null;
    }

    if (selectedChannelIds.length === 0) {
      toast.error('يرجى تحديد قناة واحدة على الأقل');
      return null;
    }

    return {
      title: annTitle.trim(),
      subheading: annSubheading.trim(),
      content: editorRef.current?.innerHTML || annContent,
      contentColor: activeColor,
      priority: annPriority,
      channelIds: selectedChannelIds,
      headerColor: annHeaderColor,
      titleSize: annTitleSize,
      titleAlignment: annTitleAlignment,
      alignment: annAlignment,
      announcementDate: annDate,
      source: annSource,
      imageUrl: effectiveImageUrl,
    };
  };

  const handleSaveAsDraft = async () => {
    const payload = buildValidatedPayload();
    if (!payload) return;

    setSubmittingAction('draft');
    try {
      const id = await onSaveDraft(payload);
      if (id) {
        resetForm();
      }
    } finally {
      setSubmittingAction(null);
    }
  };

  const handlePublishNow = async () => {
    const payload = buildValidatedPayload();
    if (!payload) return;

    setSubmittingAction('publish');
    try {
      const ok = await onPublishNew(payload);
      if (ok) {
        setPreviewModalOpen(false);
        resetForm();
      }
    } finally {
      setSubmittingAction(null);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* Left: Announcement composer (3 cols) */}
        <div className="lg:col-span-3 rounded-xl border border-slate-200 bg-white shadow-xs p-5 space-y-5">
          {/* 1. Title + inline size & alignment toolbar */}
          <div className="space-y-2">
            <label
              htmlFor="ann-title"
              className="block text-sm font-medium text-slate-700"
            >
              عنوان الإعلان
            </label>
            <input
              id="ann-title"
              type="text"
              value={annTitle}
              onChange={(e) => setAnnTitle(e.target.value)}
              placeholder="اكتب عنوان الإعلان الرئيسي..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            />

            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <div
                className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5"
                role="group"
                aria-label="حجم العنوان"
              >
                {TITLE_SIZE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAnnTitleSize(opt.value)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      annTitleSize === opt.value
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="h-5 w-px bg-slate-200" aria-hidden="true" />

              <div
                className="inline-flex items-center gap-1"
                role="group"
                aria-label="محاذاة العنوان"
              >
                <button
                  type="button"
                  onClick={() => setAnnTitleAlignment('right')}
                  title="محاذاة العنوان لليمين"
                  className={`inline-flex size-7 items-center justify-center rounded-md transition-colors cursor-pointer ${
                    annTitleAlignment === 'right'
                      ? 'bg-slate-200 text-slate-900'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <AlignRight className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setAnnTitleAlignment('center')}
                  title="توسيط العنوان"
                  className={`inline-flex size-7 items-center justify-center rounded-md transition-colors cursor-pointer ${
                    annTitleAlignment === 'center'
                      ? 'bg-slate-200 text-slate-900'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <AlignCenter className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setAnnTitleAlignment('left')}
                  title="محاذاة العنوان لليسار"
                  className={`inline-flex size-7 items-center justify-center rounded-md transition-colors cursor-pointer ${
                    annTitleAlignment === 'left'
                      ? 'bg-slate-200 text-slate-900'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <AlignLeft className="size-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* 2. Subheading */}
          <div className="space-y-1.5">
            <label
              htmlFor="ann-subheading"
              className="block text-sm font-medium text-slate-700"
            >
              العنوان الفرعي (اختياري)
            </label>
            <input
              id="ann-subheading"
              type="text"
              value={annSubheading}
              onChange={(e) => setAnnSubheading(e.target.value)}
              placeholder="وصف مختصر أسفل العنوان الرئيسي..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            />
          </div>

          {/* 3. Rich text editor */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">
              محتوى الإعلان
            </label>

            <div>
              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-1.5 rounded-t-lg border border-b-0 border-slate-200 bg-slate-50/90 px-2.5 py-2">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleBoldClick}
                  title="خط عريض (Bold)"
                  className="inline-flex size-7 items-center justify-center rounded-md text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
                >
                  <Bold className="size-4" />
                </button>

                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleOpenLinkModal}
                  title="إدراج رابط"
                  className="inline-flex size-7 items-center justify-center rounded-md text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
                >
                  <Link2 className="size-4" />
                </button>

                <div className="h-5 w-px bg-slate-200 mx-0.5" aria-hidden="true" />

                <button
                  type="button"
                  onClick={() => setAnnAlignment('right')}
                  title="محاذاة النص لليمين"
                  className={`inline-flex size-7 items-center justify-center rounded-md transition-colors cursor-pointer ${
                    annAlignment === 'right'
                      ? 'bg-slate-200 text-slate-900'
                      : 'text-slate-600 hover:bg-slate-200/60'
                  }`}
                >
                  <AlignRight className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setAnnAlignment('center')}
                  title="توسيط النص"
                  className={`inline-flex size-7 items-center justify-center rounded-md transition-colors cursor-pointer ${
                    annAlignment === 'center'
                      ? 'bg-slate-200 text-slate-900'
                      : 'text-slate-600 hover:bg-slate-200/60'
                  }`}
                >
                  <AlignCenter className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setAnnAlignment('left')}
                  title="محاذاة النص لليسار"
                  className={`inline-flex size-7 items-center justify-center rounded-md transition-colors cursor-pointer ${
                    annAlignment === 'left'
                      ? 'bg-slate-200 text-slate-900'
                      : 'text-slate-600 hover:bg-slate-200/60'
                  }`}
                >
                  <AlignLeft className="size-4" />
                </button>

                <div className="h-5 w-px bg-slate-200 mx-0.5" aria-hidden="true" />

                <Palette className="size-4 text-slate-500 ml-0.5" aria-hidden="true" />

                <div className="flex flex-wrap items-center gap-1.5">
                  {TEXT_COLOR_SWATCHES.map((swatch) => {
                    const isSelected =
                      activeColor.toLowerCase() === swatch.hex.toLowerCase();
                    return (
                      <button
                        key={swatch.hex}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSwatchColor(swatch.hex)}
                        title={swatch.label}
                        aria-label={`تلوين النص باللون ${swatch.label}`}
                        className={`relative size-5 rounded-full transition-transform cursor-pointer ${
                          isSelected ? 'ring-2 ring-emerald-500 ring-offset-1 scale-110' : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: swatch.hex }}
                      >
                        {isSelected && (
                          <span className="absolute inset-0 m-auto size-1.5 rounded-full bg-white" />
                        )}
                      </button>
                    );
                  })}

                  <label
                    title="لون مخصص"
                    className="relative inline-flex items-center justify-center cursor-pointer"
                    onPointerDown={captureSelectionBeforePicker}
                  >
                    <input
                      type="color"
                      value={activeColor}
                      onChange={handleCustomColorChange}
                      aria-label="اختيار لون نص مخصص"
                      className="custom-color-input border border-slate-300"
                    />
                  </label>
                </div>
              </div>

              <div
                key={editorKey}
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleEditorInput}
                className="rich-editor"
                dir={annAlignment === 'left' ? 'ltr' : 'rtl'}
                data-placeholder="اكتب محتوى الإعلان هنا..."
              />
            </div>
          </div>

          {/* 4. Image attachment */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              إرفاق صورة (اختياري)
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={handleImageFileSelect}
              className="hidden"
            />

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {uploadingImage ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : (
                  <ImagePlus className="size-4" />
                )}
                <span>رفع صورة</span>
              </button>

              <input
                type="url"
                dir="ltr"
                value={annExternalImageUrl}
                onChange={(e) => {
                  setAnnExternalImageUrl(e.target.value);
                  if (e.target.value.trim()) {
                    setAnnImageUrl('');
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }
                }}
                placeholder="أو الصق رابط صورة خارجي (https://...)"
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>

            {effectiveImageUrl && (
              <div className="relative inline-block mt-1 rounded-lg border border-slate-200 p-1.5 bg-slate-50">
                <img
                  src={effectiveImageUrl}
                  alt="صورة الإعلان المرفقة"
                  referrerPolicy="no-referrer"
                  className="h-20 w-auto rounded object-contain"
                />
                <button
                  type="button"
                  onClick={handleClearImage}
                  aria-label="إزالة الصورة"
                  className="absolute -top-2 -left-2 inline-flex size-6 items-center justify-center rounded-full bg-red-600 text-white shadow-sm hover:bg-red-700 transition-colors cursor-pointer"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}

            <p className="text-xs text-slate-500">
              الحد الأقصى: 5 ميجابايت — PNG, JPG, GIF, WebP
            </p>
          </div>

          {/* 5. Priority + 6. Header Color */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="ann-priority"
                className="block text-sm font-medium text-slate-700"
              >
                الأولوية
              </label>
              <div className="relative">
                <select
                  id="ann-priority"
                  value={annPriority}
                  onChange={(e) => setAnnPriority(e.target.value as PriorityLevel)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                >
                  <option value="عادي">عادي</option>
                  <option value="مهم">مهم</option>
                  <option value="عاجل">عاجل</option>
                </select>
                <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                  {annPriority === 'عادي' && (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                      <CheckCircle2 className="size-3.5" />
                      <span>أولوية عادية (Normal)</span>
                    </span>
                  )}
                  {annPriority === 'مهم' && (
                    <span className="inline-flex items-center gap-1 text-orange-600 font-medium">
                      <AlertTriangle className="size-3.5" />
                      <span>أولوية مهمة (Important)</span>
                    </span>
                  )}
                  {annPriority === 'عاجل' && (
                    <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                      <AlertTriangle className="size-3.5" />
                      <span>أولوية عاجلة (Urgent)</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="block text-sm font-medium text-slate-700">
                لون الرأسية
              </span>
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {HEADER_COLOR_PRESETS.map((preset) => {
                  const selected = annHeaderColor === preset.value;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setAnnHeaderColor(preset.value)}
                      title={preset.label}
                      aria-label={`لون الرأسية: ${preset.label}`}
                      className={`size-7 rounded-full border border-slate-300/70 transition-transform cursor-pointer ${
                        selected
                          ? 'scale-110 ring-2 ring-offset-2 ring-slate-800'
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: preset.hex }}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* 7. Date + Source */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="ann-date"
                className="block text-sm font-medium text-slate-700"
              >
                تاريخ الإعلان (اختياري)
              </label>
              <input
                id="ann-date"
                type="date"
                value={annDate}
                onChange={(e) => setAnnDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="ann-source"
                className="block text-sm font-medium text-slate-700"
              >
                المصدر (Source)
              </label>
              <select
                id="ann-source"
                value={annSource}
                onChange={(e) => setAnnSource(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              >
                <option value="">اختر المصدر (اختياري)</option>
                {SOURCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 8. Target channels */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">
                القنوات المستهدفة
              </span>
              {activeChannels.length > 0 && (
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allActiveSelected}
                    onChange={handleToggleSelectAll}
                    className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                  />
                  <span>تحديد الكل</span>
                </label>
              )}
            </div>

            <div className="max-h-[120px] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 space-y-1.5">
              {activeChannels.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-2">
                  لا توجد قنوات نشطة حالياً — أضف أو فعّل قناة من تبويب إدارة القنوات
                </p>
              ) : (
                activeChannels.map((channel) => (
                  <label
                    key={channel.id}
                    className="flex items-center gap-2.5 rounded-md px-2 py-1 text-sm text-slate-800 hover:bg-white cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedChannelIds.includes(channel.id)}
                      onChange={() => handleToggleChannel(channel.id)}
                      className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                    />
                    <span className="truncate">{channel.name}</span>
                  </label>
                ))
              )}
            </div>

            <p
              className={`text-xs font-medium tabular-nums ${
                selectedChannelIds.length > 0
                  ? 'text-emerald-700'
                  : 'text-slate-500'
              }`}
            >
              تم تحديد {selectedChannelIds.length} قناة
            </p>
          </div>

          {/* 9. Action buttons */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleSaveAsDraft}
              disabled={submittingAction !== null}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {submittingAction === 'draft' ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              <span>حفظ كمسودة</span>
            </button>

            <button
              type="button"
              onClick={() => setPreviewModalOpen(true)}
              disabled={submittingAction !== null}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Maximize2 className="size-4" />
              <span>معاينة</span>
            </button>

            <button
              type="button"
              onClick={handlePublishNow}
              disabled={submittingAction !== null}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors cursor-pointer mr-auto whitespace-nowrap shrink-0"
            >
              {submittingAction === 'publish' ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              <span>نشر الآن</span>
            </button>
          </div>
        </div>

        {/* Right: Sticky Live Preview + Tips (2 cols) */}
        <div className="lg:col-span-2 lg:sticky lg:top-20 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white shadow-xs p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-sm font-semibold text-slate-900">
                معاينة بطاقة Teams المباشرة
              </h3>
              <span className="text-xs text-slate-500">Adaptive Card 1.4</span>
            </div>

            <PreviewCard
              title={annTitle}
              subheading={annSubheading}
              content={annContent}
              headerColor={annHeaderColor}
              titleSize={annTitleSize}
              titleAlignment={annTitleAlignment}
              alignment={annAlignment}
              imageUrl={effectiveImageUrl}
              announcementDate={annDate}
              source={annSource}
              priority={annPriority}
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white/90 p-4 space-y-2">
            <h4 className="text-xs font-semibold text-slate-800">
              نصائح التنسيق
            </h4>
            <ul className="text-xs text-slate-600 space-y-1.5 leading-relaxed list-disc list-inside">
              <li>
                لتطبيق <span className="font-semibold text-slate-800">الخط العريض</span> أو{' '}
                <span className="font-semibold text-slate-800">تلوين كلمة</span>، ظلل النص داخل المحرر أولاً ثم اضغط الأداة.
              </li>
              <li>
                لإضافة رابط، حدد الكلمة ثم اضغط أيقونة الرابط ليتم تحويلها إلى نص قابل للنقر وزر إجراء داخل البطاقة.
              </li>
              <li>
                استخدم أزرار المحاذاة لضبط اتجاه النصوص العربية أو الإنجليزية بشكل مستقل للعنوان والمحتوى.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Link URL modal */}
      {linkModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="insert-link-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl space-y-4">
            <h3
              id="insert-link-title"
              className="text-base font-semibold text-slate-900"
            >
              إدراج رابط تشعبي
            </h3>
            <div className="space-y-1.5">
              <label
                htmlFor="link-url-input"
                className="block text-xs font-medium text-slate-600"
              >
                أدخل عنوان الرابط (URL)
              </label>
              <input
                id="link-url-input"
                type="url"
                dir="ltr"
                autoFocus
                value={linkUrlInput}
                onChange={(e) => setLinkUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirmInsertLink();
                  }
                }}
                placeholder="https://example.com"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left font-mono text-xs text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setLinkModalOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmInsertLink}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 cursor-pointer"
              >
                إدراج الرابط
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-screen Preview Dialog */}
      {previewModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="full-preview-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3
                id="full-preview-title"
                className="text-base font-semibold text-slate-900"
              >
                معاينة الإعلان الكاملة
              </h3>
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                aria-label="إغلاق"
                className="inline-flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto bg-slate-50">
              <PreviewCard
                title={annTitle}
                subheading={annSubheading}
                content={annContent}
                headerColor={annHeaderColor}
                titleSize={annTitleSize}
                titleAlignment={annTitleAlignment}
                alignment={annAlignment}
                imageUrl={effectiveImageUrl}
                announcementDate={annDate}
                source={annSource}
                priority={annPriority}
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 px-5 py-3.5 bg-white">
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                disabled={submittingAction === 'publish'}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                إغلاق
              </button>
              <button
                type="button"
                onClick={handlePublishNow}
                disabled={submittingAction === 'publish'}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 cursor-pointer"
              >
                {submittingAction === 'publish' ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                <span>تأكيد النشر</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import {
  CheckCircle2,
  PauseCircle,
  Plus,
  RefreshCw,
  Trash2,
  Webhook,
  Zap,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import {
  apiCreateChannel,
  apiDeleteChannel,
  apiTestWebhook,
  apiToggleChannel,
} from '../lib/apiClient';
import type { TeamChannel } from '../types';

interface ChannelsTabProps {
  channels: TeamChannel[];
  loading: boolean;
  onRefresh: () => Promise<void>;
}

function maskWebhookUrl(url: string): string {
  if (url.length <= 44) return url;
  return `${url.slice(0, 30)}...${url.slice(-10)}`;
}

export function ChannelsTab({ channels, loading, onRefresh }: ChannelsTabProps) {
  const [name, setName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TeamChannel | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleAddChannel = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !webhookUrl.trim()) {
      toast.error('الاسم ورابط الويب هوك مطلوبان');
      return;
    }

    setSubmitting(true);
    try {
      const result = await apiCreateChannel({
        name: name.trim(),
        webhookUrl: webhookUrl.trim(),
        description: description.trim(),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`تمت إضافة قناة "${result.data.name}" بنجاح`);
      setName('');
      setWebhookUrl('');
      setDescription('');
      await onRefresh();
    } catch {
      toast.error('حدث خطأ في الاتصال بالخادم');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestWebhook = async (channel: TeamChannel) => {
    setTestingId(channel.id);
    try {
      const data = await apiTestWebhook(channel.webhookUrl);
      if (data.success) {
        toast.success(`تم إرسال رسالة الاختبار إلى "${channel.name}" بنجاح`);
      } else {
        toast.error(
          `فشل اختبار قناة "${channel.name}": ${data.error || 'استجابة غير متوقعة'}`,
          { duration: 10000 },
        );
      }
    } catch {
      toast.error('تعذر تنفيذ اختبار الويب هوك', { duration: 10000 });
    } finally {
      setTestingId(null);
    }
  };

  const handleToggleActive = async (channel: TeamChannel) => {
    setTogglingId(channel.id);
    try {
      const result = await apiToggleChannel(channel.id, !channel.isActive);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.data.isActive
          ? `تم تفعيل قناة "${channel.name}"`
          : `تم تعطيل قناة "${channel.name}"`,
      );
      await onRefresh();
    } catch {
      toast.error('حدث خطأ أثناء تحديث القناة');
    } finally {
      setTogglingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await apiDeleteChannel(deleteTarget.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`تم حذف قناة "${deleteTarget.name}"`);
      setDeleteTarget(null);
      await onRefresh();
    } catch {
      toast.error('حدث خطأ أثناء حذف القناة');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
      {/* Left column: Add channel form */}
      <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white shadow-xs p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-900">
            إضافة قناة جديدة
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            أضف رابط الويب هوك (Incoming Webhook) الخاص بقناة Microsoft Teams
          </p>
        </div>

        <form onSubmit={handleAddChannel} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="channel-name"
              className="block text-sm font-medium text-slate-700"
            >
              اسم القناة
            </label>
            <input
              id="channel-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: قسم الموارد البشرية"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="channel-webhook"
              className="block text-sm font-medium text-slate-700"
            >
              رابط الويب هوك (Webhook URL)
            </label>
            <input
              id="channel-webhook"
              type="url"
              dir="ltr"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://outlook.office.com/webhook/..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="channel-description"
              className="block text-sm font-medium text-slate-700"
            >
              وصف القناة (اختياري)
            </label>
            <textarea
              id="channel-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ملاحظات حول الفريق أو الغرض من القناة..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:opacity-60 transition-colors cursor-pointer"
          >
            {submitting ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            <span>إضافة القناة</span>
          </button>
        </form>
      </div>

      {/* Right column: Registered channels */}
      <div className="lg:col-span-3 rounded-xl border border-slate-200 bg-white shadow-xs p-5">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              القنوات المسجلة
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              إجمالي القنوات: {channels.length}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRefresh()}
            disabled={loading}
            aria-label="تحديث القنوات"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading && channels.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="h-20 rounded-lg border border-slate-100 bg-slate-50 animate-pulse"
              />
            ))}
          </div>
        ) : channels.length === 0 ? (
          <div className="py-12 text-center">
            <Webhook className="size-10 mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-700">
              لا توجد قنوات مسجلة
            </p>
            <p className="text-xs text-slate-500 mt-1">
              ابدأ بإضافة أول قناة Microsoft Teams من النموذج المجاور
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {channels.map((channel) => (
              <div
                key={channel.id}
                className={`py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4 transition-opacity ${
                  channel.isActive ? '' : 'opacity-60'
                }`}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-sm font-semibold text-slate-900 truncate">
                      {channel.name}
                    </span>
                    {channel.isActive ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        <CheckCircle2 className="size-3" />
                        <span>نشطة</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        <PauseCircle className="size-3" />
                        <span>معطلة</span>
                      </span>
                    )}
                  </div>

                  {channel.description && (
                    <p className="text-xs text-slate-500 line-clamp-1">
                      {channel.description}
                    </p>
                  )}

                  <p
                    dir="ltr"
                    className="text-left font-mono text-xs text-slate-500 truncate"
                  >
                    {maskWebhookUrl(channel.webhookUrl)}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleTestWebhook(channel)}
                    disabled={testingId === channel.id}
                    title="اختبار الويب هوك"
                    aria-label={`اختبار قناة ${channel.name}`}
                    className="inline-flex size-8 items-center justify-center rounded-lg text-blue-600 hover:bg-blue-50 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {testingId === channel.id ? (
                      <RefreshCw className="size-4 animate-spin" />
                    ) : (
                      <Zap className="size-4" />
                    )}
                  </button>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={channel.isActive}
                    aria-label={`تفعيل أو تعطيل ${channel.name}`}
                    disabled={togglingId === channel.id}
                    onClick={() => handleToggleActive(channel)}
                    dir="ltr"
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1 ${
                      channel.isActive ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block size-4 transform rounded-full bg-white shadow-xs transition-transform ${
                        channel.isActive ? 'translate-x-4.5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeleteTarget(channel)}
                    title="حذف القناة"
                    aria-label={`حذف قناة ${channel.name}`}
                    className="inline-flex size-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-channel-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <h3
              id="delete-channel-title"
              className="text-base font-semibold text-slate-900"
            >
              تأكيد حذف القناة
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              هل أنت متأكد من رغبتك في حذف قناة{' '}
              <span className="font-semibold text-slate-900">
                {deleteTarget.name}
              </span>
              ؟ لن تتمكن من استرجاع بياناتها بعد الحذف.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition-colors cursor-pointer"
              >
                {deleting && <RefreshCw className="size-3.5 animate-spin" />}
                <span>تأكيد الحذف</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

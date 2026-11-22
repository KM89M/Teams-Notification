import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Megaphone,
  RefreshCw,
  Send,
} from 'lucide-react';
import { useState } from 'react';
import type { Announcement } from '../types';

interface HistoryTabProps {
  announcements: Announcement[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onPublishDraft: (announcementId: string) => Promise<boolean | void>;
}

function formatArabicDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function PriorityBadge({ priority }: { priority: string }) {
  if (priority === 'عاجل') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-0.5 text-xs font-medium text-white whitespace-nowrap">
        <AlertTriangle className="size-3" />
        <span>عاجل</span>
      </span>
    );
  }
  if (priority === 'مهم') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-orange-600 px-2 py-0.5 text-xs font-medium text-white whitespace-nowrap">
        <AlertTriangle className="size-3" />
        <span>مهم</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white whitespace-nowrap">
      <CheckCircle2 className="size-3" />
      <span>عادي</span>
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'منشور') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white whitespace-nowrap">
        <CheckCircle2 className="size-3" />
        <span>منشور</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 whitespace-nowrap">
      <Clock className="size-3" />
      <span>مسودة</span>
    </span>
  );
}

export function HistoryTab({
  announcements,
  loading,
  onRefresh,
  onPublishDraft,
}: HistoryTabProps) {
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const handlePublish = async (id: string) => {
    setPublishingId(id);
    try {
      await onPublishDraft(id);
    } finally {
      setPublishingId(null);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-xs p-5">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            سجل الإعلانات
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
            إجمالي السجلات: {announcements.length}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onRefresh()}
          disabled={loading}
          aria-label="تحديث السجل"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>تحديث</span>
        </button>
      </div>

      {loading && announcements.length === 0 ? (
        <div className="space-y-2.5">
          {[1, 2, 3, 4].map((row) => (
            <div
              key={row}
              className="h-11 rounded-lg bg-slate-50 border border-slate-100 animate-pulse"
            />
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <div className="py-14 text-center">
          <Megaphone className="size-10 mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-700">
            لا توجد إعلانات بعد
          </p>
          <p className="text-xs text-slate-500 mt-1">
            ستظهر هنا جميع المسودات والإعلانات المنشورة مع تواريخها
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                <th className="py-2.5 px-3">العنوان</th>
                <th className="py-2.5 px-3">الأولوية</th>
                <th className="py-2.5 px-3">المصدر</th>
                <th className="py-2.5 px-3">الحالة</th>
                <th className="py-2.5 px-3">تاريخ الإنشاء</th>
                <th className="py-2.5 px-3 text-left">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {announcements.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-slate-50/80 transition-colors"
                >
                  <td className="py-3 px-3 font-medium text-slate-900 max-w-xs truncate">
                    {item.title}
                  </td>
                  <td className="py-3 px-3">
                    <PriorityBadge priority={item.priority} />
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-600 font-mono">
                    {item.source || '—'}
                  </td>
                  <td className="py-3 px-3">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                    {formatArabicDate(item.createdAt)}
                  </td>
                  <td className="py-3 px-3 text-left">
                    {item.status === 'مسودة' ? (
                      <button
                        type="button"
                        onClick={() => handlePublish(item.id)}
                        disabled={publishingId === item.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        {publishingId === item.id ? (
                          <RefreshCw className="size-3.5 animate-spin" />
                        ) : (
                          <Send className="size-3.5" />
                        )}
                        <span>نشر</span>
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">تم النشر</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

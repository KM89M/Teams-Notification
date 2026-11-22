import { Clock, Megaphone, Plus, Webhook } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Toaster, toast } from 'sonner';
import { ChannelsTab } from './components/ChannelsTab';
import {
  ComposerTab,
  type AnnouncementFormPayload,
} from './components/ComposerTab';
import { HistoryTab } from './components/HistoryTab';
import {
  apiCreateAnnouncement,
  apiListAnnouncements,
  apiListChannels,
  apiPublishAnnouncement,
  getBackendUrl,
  isStaticFallbackMode,
  setBackendUrl,
} from './lib/apiClient';
import type { Announcement, TeamChannel } from './types';

type ActiveTab = 'channels' | 'compose' | 'history';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('channels');
  const [channels, setChannels] = useState<TeamChannel[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [staticMode, setStaticMode] = useState(false);
  const [showBackendConfig, setShowBackendConfig] = useState(false);
  const [backendUrlInput, setBackendUrlInput] = useState(() => getBackendUrl());

  const fetchChannels = useCallback(async () => {
    setLoadingChannels(true);
    try {
      const data = await apiListChannels();
      setChannels(data);
      setStaticMode(isStaticFallbackMode());
    } catch {
      toast.error('تعذر تحميل قائمة القنوات');
    } finally {
      setLoadingChannels(false);
    }
  }, []);

  const fetchAnnouncements = useCallback(async () => {
    setLoadingAnnouncements(true);
    try {
      const data = await apiListAnnouncements();
      setAnnouncements(data);
      setStaticMode(isStaticFallbackMode());
    } catch {
      toast.error('تعذر تحميل سجل الإعلانات');
    } finally {
      setLoadingAnnouncements(false);
    }
  }, []);

  useEffect(() => {
    fetchChannels();
    fetchAnnouncements();
  }, [fetchChannels, fetchAnnouncements]);

  const createAnnouncementRecord = async (
    payload: AnnouncementFormPayload,
  ): Promise<Announcement | null> => {
    try {
      const result = await apiCreateAnnouncement(payload);
      if (!result.ok) {
        toast.error(result.error);
        return null;
      }
      return result.data;
    } catch {
      toast.error('حدث خطأ في الاتصال بالخادم');
      return null;
    }
  };

  const publishAnnouncementById = async (
    announcementId: string,
  ): Promise<boolean> => {
    try {
      const data = await apiPublishAnnouncement(announcementId);

      if (!data.results?.length && data.error) {
        toast.error(data.error, { duration: 10000 });
        return false;
      }

      const details = data.results
        .map((r) => `${r.channel}: ${r.ok ? 'تم الإرسال' : r.detail}`)
        .join(' | ');

      if (data.success) {
        if (data.successful === data.totalChannels) {
          toast.success(
            `تم نشر الإعلان بنجاح إلى ${data.successful} من ${data.totalChannels} قناة`,
          );
        } else {
          toast.warning(
            `تم النشر إلى ${data.successful} من ${data.totalChannels} قناة (${details})`,
            { duration: 10000 },
          );
        }
        await fetchAnnouncements();
        return true;
      }

      toast.error(`فشل النشر إلى جميع القنوات: ${details}`, {
        duration: 10000,
      });
      await fetchAnnouncements();
      return false;
    } catch {
      toast.error('حدث خطأ أثناء إرسال الإعلان إلى Microsoft Teams', {
        duration: 10000,
      });
      return false;
    }
  };

  const handleSaveDraft = async (
    payload: AnnouncementFormPayload,
  ): Promise<string | null> => {
    const created = await createAnnouncementRecord(payload);
    if (!created) return null;
    toast.success('تم حفظ الإعلان كمسودة بنجاح');
    await fetchAnnouncements();
    return created.id;
  };

  const handlePublishNew = async (
    payload: AnnouncementFormPayload,
  ): Promise<boolean> => {
    const created = await createAnnouncementRecord(payload);
    if (!created) return false;
    const published = await publishAnnouncementById(created.id);
    if (!published) {
      // Draft was still created; refresh history so user can retry
      await fetchAnnouncements();
    }
    return published;
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-emerald-50/30">
      <Toaster position="top-center" richColors dir="rtl" />

      {/* Sticky Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3.5 flex items-center gap-3.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
            <Megaphone className="size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
              نظام نشر الإعلانات
            </h1>
            <p className="text-xs text-slate-500 truncate">
              Microsoft Teams — إدارة القنوات ونشر الإعلانات للموظفين
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-6 space-y-6">
        {staticMode && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="leading-relaxed">
                وضع الاستضافة الثابتة (GitHub Pages): يتم حفظ القنوات والمسودات في المتصفح محلياً. قد يحظر المتصفح الإرسال المباشر لبعض روابط Teams بسبب قيود CORS إلا إذا كان الرابط من Power Automate أو تم ربط خادم خلفي (Node.js).
              </p>
              <button
                type="button"
                onClick={() => setShowBackendConfig((v) => !v)}
                className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100/60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {showBackendConfig ? 'إخفاء إعداد الخادم' : 'ربط خادم خلفي (Backend)'}
              </button>
            </div>

            {showBackendConfig && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1 border-t border-amber-200/80">
                <input
                  type="url"
                  dir="ltr"
                  value={backendUrlInput}
                  onChange={(e) => setBackendUrlInput(e.target.value)}
                  placeholder="https://your-teams-server.example.com"
                  className="flex-1 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-left font-mono text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={async () => {
                      const trimmed = backendUrlInput.trim();
                      if (trimmed && !/^https?:\/\/.+/i.test(trimmed)) {
                        toast.error('يرجى إدخال رابط يبدأ بـ https:// أو http://');
                        return;
                      }
                      setBackendUrl(trimmed);
                      await Promise.all([fetchChannels(), fetchAnnouncements()]);
                      if (isStaticFallbackMode()) {
                        toast.error('تعذر الاتصال بالخادم المحدد — تأكد من تشغيله وتفعيل CORS');
                      } else {
                        toast.success('تم الاتصال بالخادم الخلفي بنجاح');
                        setShowBackendConfig(false);
                      }
                    }}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer whitespace-nowrap"
                  >
                    حفظ واتصال
                  </button>
                  {getBackendUrl() && (
                    <button
                      type="button"
                      onClick={async () => {
                        setBackendUrl('');
                        setBackendUrlInput('');
                        await Promise.all([fetchChannels(), fetchAnnouncements()]);
                        toast.success('تم فصل الخادم الخلفي');
                      }}
                      className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100/60 cursor-pointer whitespace-nowrap"
                    >
                      فصل
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Three-Tab Navigation */}
        <div
          role="tablist"
          aria-label="أقسام النظام"
          className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-xs"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'channels'}
            onClick={() => setActiveTab('channels')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'channels'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Webhook className="size-4" />
            <span>إدارة القنوات</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'compose'}
            onClick={() => setActiveTab('compose')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'compose'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Plus className="size-4" />
            <span>إعلان جديد</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'history'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Clock className="size-4" />
            <span>سجل الإعلانات</span>
          </button>
        </div>

        {/* Tab Panels */}
        {activeTab === 'channels' && (
          <ChannelsTab
            channels={channels}
            loading={loadingChannels}
            onRefresh={fetchChannels}
          />
        )}

        {activeTab === 'compose' && (
          <ComposerTab
            channels={channels}
            onSaveDraft={handleSaveDraft}
            onPublishNew={handlePublishNew}
          />
        )}

        {activeTab === 'history' && (
          <HistoryTab
            announcements={announcements}
            loading={loadingAnnouncements}
            onRefresh={fetchAnnouncements}
            onPublishDraft={publishAnnouncementById}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/70 bg-white/60 py-4 text-center text-xs text-slate-500">
        نظام نشر الإعلانات — Microsoft Teams © {new Date().getFullYear()}
      </footer>
    </div>
  );
}

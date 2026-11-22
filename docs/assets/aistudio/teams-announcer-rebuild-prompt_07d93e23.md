# COMPREHENSIVE REBUILD PROMPT — Teams Announcement Publishing Web App

> Copy this entire prompt into an AI coding tool to rebuild the project exactly as it exists.
> Every feature, endpoint, data model, and hard-won implementation detail is specified below.

---

## 1. ROLE AND GOAL

You are a senior full-stack developer. Build a complete, production-ready **Microsoft Teams announcement publishing web application**. The app lets an internal communications team (Knowledge Management | Customer Care) register Teams channel incoming webhooks, compose rich announcements in Arabic (RTL), preview them, and publish them as **Adaptive Cards** to one or many Teams channels. Drafts are saved in a local SQLite database with full publish history.

Build it as a **single Next.js App Router project** with **one main page** containing **three tabs**, backed by **Prisma + SQLite** and **six API routes**. The UI is entirely **Arabic RTL**, dark-on-light, emerald-accented, clean corporate style.

---

## 2. TECH STACK (exact)

- **Next.js 16** (App Router, `output: "standalone"`, `reactStrictMode: false`, `typescript.ignoreBuildErrors: true` in `next.config.ts`)
- **React 19**, **TypeScript 5**
- **Tailwind CSS 4** (`@tailwindcss/postcss`) + `tw-animate-css`
- **shadcn/ui** components on Radix primitives: Tabs, Card, Input, Textarea, Button, Switch, Label, Badge, Skeleton, Checkbox, Separator, Select, AlertDialog, Dialog, Table
- **Prisma 6** ORM with **SQLite** provider (`DATABASE_URL=file:/home/z/my-project/db/custom.db` in `.env`)
- **lucide-react** icons; **sonner** toaster (`<Toaster position="top-center" richColors />` in root layout)
- Dev server: `next dev -p 3000`. The reverse proxy in front of the app expects **port 3000** — never use another port.

---

## 3. DATA MODEL (Prisma — use exactly)

```prisma
generator client { provider = "prisma-client-js" }
datasource db   { provider = "sqlite"; url = env("DATABASE_URL") }

model TeamChannel {
  id          String   @id @default(cuid())
  name        String
  webhookUrl  String
  description String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Announcement {
  id               String    @id @default(cuid())
  title            String
  subheading       String    @default("")
  content          String    // stores HTML from the contentEditable editor
  contentColor     String    @default("default")
  priority         String    @default("عادي")   // عادي | مهم | عاجل
  status           String    @default("مسودة")  // مسودة | منشور
  channelIds       String    @default("")       // comma-separated channel IDs (no join table)
  headerColor      String    @default("0078D7") // hex WITHOUT '#', or 'none'
  titleSize        String    @default("Large")  // Medium | Large | ExtraLarge
  titleAlignment   String    @default("right")  // right | left | center
  alignment        String    @default("right")  // content alignment: right | left | center
  announcementDate String    @default("")       // yyyy-mm-dd string
  source           String    @default("")       // K.M | G.M | C.C | B.O | K.M&B.O | K.M&CC
  imageUrl         String    @default("")
  publishedAt      DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
}
```

Create `src/lib/db.ts`: a module-scoped PrismaClient cached on `globalThis` in development (standard Next.js pattern) with `log: ['error', 'warn']`.

---

## 4. API ROUTES (all six, exact contracts)

All responses are JSON; error messages in Arabic.

### `GET /api/channels`
Returns all channels `orderBy: { createdAt: 'desc' }`.

### `POST /api/channels`
Body `{ name, webhookUrl, description? }`. 400 if name or webhookUrl missing: error `'الاسم ورابط الويب هوك مطلوبان'`. Creates channel, returns 201 with the created record.

### `DELETE /api/channels/[id]`
Deletes the channel. Returns `{ success: true }`. (Route handler signature: `{ params }: { params: Promise<{ id: string }> }` — Next.js 16 async params.)

### `PATCH /api/channels/[id]`
Body `{ isActive: boolean }`. Toggles channel active state.

### `GET /api/announcements`
All announcements, newest first.

### `POST /api/announcements`
Body: `{ title, subheading, content, contentColor, priority, channelIds (array), headerColor, titleSize, titleAlignment, alignment, announcementDate, source, imageUrl }`.
Required: `title`, `content` → else 400 `'العنوان والمحتوى مطلوبان'`.
**Important:** `channelIds` arrives as an array and is stored via `channelIds.join(',')`. Defaults: headerColor `008272`, titleSize `Large`, alignments `right`. Returns 201 with created record.

### `POST /api/announcements/publish` — THE CORE ROUTE (see section 7 for card logic)
Body `{ announcementId }`. Steps:
1. Load announcement; 404 `'الإعلان غير موجود'` if missing.
2. `channelIds.split(',')` → load active channels via `findMany({ where: { id: { in: channelIds }, isActive: true } })`.
3. Build the Adaptive Card payload (section 7).
4. POST to each channel webhook with `fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })`, **sequentially** (a for-loop, not Promise.all).
5. **Success detection quirk:** success is `response.status === 200 && (await response.text()).trim() === '1'`. Teams incoming webhooks reply with the literal body `1`. Anything else is a failure with message `'Teams rejected (HTTP <status>): <body>'` or `'Teams returned empty response (HTTP <status>).'`.
6. If at least one channel succeeded: update announcement `status: 'منشور'`, `publishedAt: new Date()`.
7. Respond: `{ success: successCount > 0, totalChannels, successful, results: [{ channel: name, ok: boolean, detail: 'Sent successfully' | error }] }`.

### `POST /api/test` (webhook test — REQUIRED, do not forget)
Body `{ webhookUrl }`. Builds a small green test Adaptive Card ("Webhook Test - Connected!" / "Teams Announcer is working correctly."), POSTs it to the given URL, returns `{ success, statusCode?, teamsResponse?, error? }`. Success = HTTP 200 with body `1`.

### `POST /api/upload` (image upload — REQUIRED, do not forget)
Body `{ base64Data }` (a full data-URL string from `FileReader.readAsDataURL`). Decode the base64 payload, write to `public/uploads/<uuid>.<ext>`, return `{ url: '/uploads/<file>' }`. Limit 5 MB, images only.

---

## 5. PAGE LAYOUT (single page, `src/app/page.tsx`, 'use client')

Root: `min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-emerald-50/30`. **`<html lang="ar" dir="rtl">`** in the root layout; metadata title `نظام نشر الإعلانات - Microsoft Teams`.

**Header** (sticky, `bg-white/80 backdrop-blur-sm`): emerald rounded-xl icon tile with `Megaphone` icon; title `نظام نشر الإعلانات`; subtitle `Microsoft Teams — إدارة القنوات ونشر الإعلانات للموظفين`.

**Main** (`max-w-6xl`): a Tabs component, three tabs:

1. **إدارة القنوات** (channels, default tab) — icon `Webhook`
2. **إعلان جديد** (new announcement) — icon `Plus`
3. **سجل الإعلانات** (history) — icon `Clock`

**Footer:** centered small text `نظام نشر الإعلانات — Microsoft Teams © <year>`.

### Tab 1 — Channel management (grid `lg:grid-cols-5`)
- **Left card (col-span-2):** "إضافة قناة جديدة" form — channel name input (placeholder `مثال: قسم الموارد البشرية`), webhook URL input (`dir="ltr" text-left`, placeholder `https://outlook.office.com/webhook/...`), optional description textarea, full-width emerald submit button.
- **Right (col-span-3):** list of registered channels with count. Each card: name, active badge (`نشطة` emerald / `معطلة` secondary), description (line-clamp-1), **masked webhook** (monospace, `dir="ltr"`; mask helper shows first 30 chars + `...` + last 10), and actions: blue `Zap` icon button = test webhook, `Switch` = toggle active, red `Trash2` inside an **AlertDialog** confirmation (`تأكيد حذف القناة`). Disabled channels render at `opacity-60`.
- Loading state: 3 skeleton cards. Empty state: big muted `Webhook` icon + `لا توجد قنوات مسجلة`.

### Tab 2 — New announcement (grid `lg:grid-cols-5`; editor col-span-3, live preview col-span-2 sticky top-20)
Form fields, in order:
1. **عنوان الإعلان** — title input. Directly under it an inline toolbar row: **font size** segmented buttons (متوسط/كبير/كبير جداً → `Medium`/`Large`/`ExtraLarge`, active = emerald bg white text) + vertical Separator + **title alignment** three icon buttons (`AlignRight`/`AlignCenter`/`AlignLeft`, active = `variant="secondary"`).
2. **العنوان الفرعي (اختياري)** — subheading input.
3. **محتوى الإعلان** — the rich text editor (section 6).
4. **إرفاق صورة (اختياري)** — hidden file input + "رفع صورة" outline button (`ImagePlus`), thumbnail preview + red `X` remove button when set, plus a **second input to paste an external image URL** (`dir="ltr"`, placeholder `أو الصق رابط صورة خارجي (https://...)`). Helper text: `الحد الأقصى: 5 ميجابايت — PNG, JPG, GIF, WebP`. External URL and uploaded file are mutually exclusive: typing in the external field clears the upload and vice versa. Effective image = `annExternalImageUrl.trim() || annImageUrl`.
5. **الأولوية** — Select: `عادي` (emerald CheckCircle), `مهم` (orange AlertTriangle), `عاجل` (red AlertTriangle).
6. **لون الرأسية** — 7 color dot buttons (w-7 h-7 rounded-full): أزرق `#0078D7`, أخضر `#008272`, أحمر `#D13438`, برتقالي `#CA5010`, ذهبي `#986F0B`, بنفسجي `#5C2D91`, بدون لون `#E8E8E8`. Selected dot: `scale-110 ring-2 ring-offset-2 ring-gray-800`.
7. **تاريخ الإعلان (اختياري)** — `<Input type="date">` and **المصدر (Source)** — Select with the six fixed options `K.M, G.M, C.C, B.O, K.M & B.O, K.M & CC` (stored values: `K.M, G.M, C.C, B.O, K.M&B.O, K.M&CC`).
8. **القنوات المستهدفة** — bordered box (max-h-[120px], scrollable) of active channels each with a Checkbox; a "تحديد الكل" master checkbox on the header row (toggles all active ids); counter line `تم تحديد N قناة` in emerald when > 0.
9. **Action row:** `حفظ كمسودة` (outline), `معاينة` (outline, `Maximize2`, opens full-screen preview Dialog), `نشر الآن` (emerald, `Send`). Buttons show `RefreshCw animate-spin` while submitting.

**Live PreviewCard** (also reused inside the Dialog): rounded-lg card with colored header band (hex from the header preset, white bold title with chosen size/alignment), optional subheading, content rendered via `dangerouslySetInnerHTML` with content alignment, image (`max-h-60 object-contain`, hidden on load error), `border-t` separator, then an **LTR metadata footer**: bold `Knowledge Management | Customer Care`, then `Date: <en-GB format like 25 Nov 2026>`, `Source: <value>`, `Priority: <Urgent|Important|Normal>` — all `text-[11px]`. Below it a tips box (`نصائح التنسيق`) explaining bold / word coloring / alignment.

**Preview Dialog:** title `معاينة الإعلان الكاملة`, the full PreviewCard, footer buttons `إغلاق` and `تأكيد النشر` (calls publish path then closes).

### Tab 3 — History
Card with refresh button (`RefreshCw`, spins while loading) and count. A shadcn **Table**: columns العنوان | الأولوية | المصدر | الحالة | تاريخ الإنشاء | إجراء.
- Priority badge: `عاجل` → `destructive` variant, `مهم` → orange solid, `عادي` → emerald solid; with matching small icon.
- Status badge: `منشور` → emerald solid with CheckCircle; `مسودة` → secondary with Clock.
- Date via `toLocaleDateString('ar-SA', { year, month: 'long', day, hour: '2-digit', minute: '2-digit' })`.
- **إجراء:** only for drafts — emerald `نشر` button that calls the publish endpoint for that id.
- Loading skeletons; empty state with Megaphone icon + `لا توجد إعلانات بعد`.

---

## 6. RICH TEXT EDITOR (critical implementation)

Use a plain **`contentEditable` div** — do NOT use a rich-text library.

```tsx
<div key={editorKey} ref={editorRef} contentEditable suppressContentEditableWarning
  onInput={handleEditorInput}
  className="rich-editor rounded-t-none"
  dir={annAlignment === 'left' ? 'ltr' : 'rtl'}
  data-placeholder="اكتب محتوى الإعلان هنا..." />
```

- **Toolbar row** sits above the editor, styled `rounded-t-md border border-b-0 bg-muted/50`: Bold button (`document.execCommand('bold')`), Link button, Separator, the three content-alignment icon buttons, Separator, a `Palette` icon, then the color system.
- **Color system:** 8 fixed swatch circles — أسود `#000000`, أحمر `#D13438`, أزرق `#0078D7`, أخضر `#008272`, برتقالي `#CA5010`, بنفسجي `#5C2D91`, ذهبي `#986F0B`, رمادي `#999999` — **plus a native `<input type="color">` custom picker** (CSS: hide default appearance, make the swatch a circle, `::-webkit-color-swatch { border:none; border-radius:50% }`). The active swatch shows a white center dot and `ring-2 ring-emerald-500`.
- **Per-word coloring procedure (hardened):** on swatch click → set active color → `editorRef.current?.focus()` → after a 20 ms `setTimeout`, take `window.getSelection()`; require a non-collapsed selection, else `toast.error('حدد النص أولاً ثم اختر اللون')`. First run `document.execCommand('removeFormat')`, then re-add the saved range to the selection, then `document.execCommand('foreColor', false, hex)` (the removeFormat pass prevents nested `<font>` stacking when recoloring). Sync `annContent = editorRef.current.innerHTML` 10 ms later. The custom color input uses the same flow (without removeFormat).
- **Hyperlink insertion (hardened against focus loss):** clicking the link button → validate a non-collapsed selection inside the editor (error toasts: `حدد النص أولاً ثم اضغط زر الرابط` / `حدد النص داخل محرر المحتوى`) → **clone the Range into a ref BEFORE calling `prompt()`** because prompt() destroys the selection → after the user enters the URL, `editorRef.current.focus()`, restore the saved range into the selection, `document.execCommand('createLink', false, url)`, then after 50 ms iterate all `<a>` in the editor setting `style.color = '#0078D7'`, `style.textDecoration = 'underline'`, `target = '_blank'`, `rel = 'noopener noreferrer'`, and sync innerHTML into state.
- **CSS** (in a `<style>` tag inside the component): `[data-placeholder]:empty::before { content: attr(data-placeholder); color: hsl(var(--muted-foreground)); pointer-events:none; display:block }`; `.rich-editor` = min-height 150px, max-height 300px scroll, padding .75rem, border/radius matching inputs, focus ring; `.rich-editor a { color:#0078D7; text-decoration:underline; pointer-events:none }`.
- **State sync & reset:** `handleEditorInput` copies innerHTML into `annContent` on every input. The editor's innerHTML is hydrated from `annContent` **only** when `editorKey` changes (increment `editorKey` in `resetForm()` to clear it — never bind innerHTML to state on every render, that fights the browser).
- Validation before save: title required; content required **checked via `editorRef.current.textContent.trim()`** (not state), channels ≥ 1 required.
- Content column alignment: three buttons set `annAlignment` (right/left/center) which drives both editor `dir` and card `horizontalAlignment`.

---

## 7. ADAPTIVE CARD BUILDER (the core algorithm — implement exactly)

Card version **1.4**, `msteams: { width: 'Full' }`, wrapped in the standard webhook envelope:

```json
{ "type": "message", "attachments": [{ "contentType": "application/vnd.microsoft.card.adaptive",
  "content": { "$schema": "http://adaptivecards.io/schemas/adaptive-card.json", "type": "AdaptiveCard", "version": "1.4", "msteams": { "width": "Full" }, "body": [ ... ] } }] }
```

### Body element order (MANDATORY — this order was explicitly user-approved):
1. **Header** — if headerColor maps to a style other than `default`: `{ type:'Container', style:<headerStyle>, bleed:true, items:[{ type:'TextBlock', text:title, size:<titleSize>, weight:'Bolder', color:'Light', wrap:true, horizontalAlignment:<titleAlignment> }] }`. Else a plain bold TextBlock (no colored container).
2. **Subheading** (if set): TextBlock `size:'Medium'`, `weight:'Bolder'`, `isSubtle:true`, `wrap:true`, `spacing:'Small'`, same title alignment.
3. **Content blocks** (below).
4. **Image** (if imageUrl): resolve relative URLs against the request host (`request.headers.get('host')` + `x-forwarded-proto`, default `https`); only `http(s)` URLs are emitted: `{ type:'Image', url, size:'Large', spacing:'Medium' }`.
5. **ActionSet with the content hyperlinks** (see below) — positioned HERE, after content/image and BEFORE the metadata. Never use card-level `actions` (Teams renders those at the very bottom of the card, after the FactSet — the user rejected that).
6. **Separator:** `{ type:'TextBlock', text:'', separator:true, spacing:'Medium' }`.
7. **Footer line:** `{ type:'TextBlock', text:'**Knowledge Management | Customer Care**', size:'Small', weight:'Bolder', color:'Accent', wrap:true, horizontalAlignment:'Left', spacing:'Small' }` (literal `**` renders bold in Teams markdown).
8. **FactSet** metadata: `Date` (announcementDate), `Source`, `Priority` (translated: عاجل→Urgent, مهم→Important, عادي→Normal), each only if present; `spacing:'Small'`.

### Mappings
- headerColor → Container style: `0078D7→emphasis`, `008272→good`, `D13438→danger`, `CA5010→warning`, `986F0B→attention`, `5C2D91→accent`, `none→default`.
- titleSize passes through (`Medium|Large|ExtraLarge`, fallback `Large`).
- Text color hex → Adaptive Card named colors (function `mapColorToTeams`): lowercase hex lookup including `#333333→Default`, `#000000→Dark`, `#0078d7→Accent`, `#008272→Good`, `#ca5010→Warning`, `#d13438→Attention`, `#999999→Light`, plus `#ff0000/#e74c3c→Attention`, `#f39c12→Warning`, `#27ae60/#2ecc71→Good`, `#3498db/#9b59b6→Accent`; accept input with or without `#`; also accept an already-named color; fallback `Default`.

### HTML → Adaptive Card content conversion (`buildContentElements`)
- If the content has **no HTML tags** (regex `/<[a-z][\s\S]*>/i`), emit one plain TextBlock, `wrap:true`, `spacing:'Medium'`, `horizontalAlignment: alignment`.
- Otherwise: normalize — `<br>` → `\n`, `</div|p|h1-6>` → `\n`, strip opening block tags, `<strong>`→`<b>`, `<em>`→`<i>`, `&nbsp;`→space. Split on `\n`, drop empties → one Adaptive Card element per line, `spacing` = `Medium` for the first line, `Small` after.
- **Per line, parse inline runs** with a hand-rolled scanner (`parseInlines`): repeatedly match the next tag among `b|strong|u|i|em|font|span|a` (case-insensitive), tracking three state flags — `bold` (toggled by b/strong), `color` (Teams named color from `font[color]` attr or `span style="color:..."`), `currentUrl` (from `<a href>`); text between tags is HTML-entity-decoded (`&amp; &lt; &gt; &quot; &#39; &nbsp;` + numeric `&#123;`) and pushed as `{ text, bold, color, url? }`; adjacent runs with identical flags are merged.
- Emit per line: if every run is default (not bold, Default color, no url) and ≤ 1 run → plain `TextBlock`; otherwise → **`RichTextBlock`** with `inlines: [{ type:'TextRun', text, bold?, color?, underline:true + url? }]`, `horizontalAlignment: alignment`. **RichTextBlock + TextRun is what actually preserves per-word colors, bold, and inline links inside Teams messages** — plain TextBlock markdown is not sufficient for colored runs. Filter out any line that produced no text/inlines.

### Hyperlink extraction for the ActionSet (`extractUrls`)
Regex-scan the raw HTML for all `<a href="...">text</a>`; keep only http/https URLs, deduplicate, entity-decode the URL, derive the button title from the anchor's stripped text (fallback = the URL), truncate titles > 30 chars to `first 27 + '...'`. Emit:
`{ type:'ActionSet', actions: extractedLinks.map(l => ({ type:'Action.OpenUrl', title:l.text, url:l.url })), spacing:'Medium' }`.
(Reason: Teams strips inline `<a>` targets in some hosts and always stacks card-level actions at the bottom; an in-body ActionSet is the only way to place link buttons between the content and the metadata — this was a user-approved fix.)

---

## 8. DESIGN SYSTEM

- Light theme only; page background gradient `from-slate-50 to-emerald-50/30`; primary accent **emerald-600/700/800** for all primary buttons, active states, icon tiles and highlights; destructive red for delete/test-fail; blue for webhook-test icon.
- Cards: default shadcn styling (`rounded-xl border shadow-sm`).
- All icons `size-3.5`/`size-4`; icon-only buttons `size-7`/`size-8` ghost variant.
- Webhook URLs always displayed LTR + monospace + masked; metadata preview block LTR even in the RTL page.
- Toasts via sonner everywhere; failures `duration: 10000` for Teams errors (they contain multi-line details).
- Form reset (`resetForm`) clears every field, restores defaults (`#D13438` active color, `0078D7` header, `Large` size, `right` alignments), clears selected channels, bumps `editorKey`, resets the file input.

---

## 9. CRITICAL RULES / LESSONS LEARNED (do not regress)

1. **Link buttons go in an in-body `ActionSet`**, never in card-level `actions` (they must appear after content, before the separator + metadata).
2. **Teams webhook success = HTTP 200 AND response body exactly `'1'`** — a 200 with any other body is a rejection.
3. **Save the selection Range before `prompt()`** for hyperlinks; restore it after focus or the link lands in the wrong place.
4. **`removeFormat` before `foreColor`** when re-coloring to avoid nested `<font>` tags.
5. **Per-word colors require `RichTextBlock` + `TextRun`** inlines with Teams named colors (hex does not work inside TextRuns).
6. `channelIds` is a **comma-joined string** column, not a relation table.
7. Server must listen on **port 3000**; production runs the standalone build (`next build` then copy `.next/static` and `public` into `.next/standalone`).
8. Route handlers in Next 16 receive `params` as a **Promise** — `const { id } = await params`.
9. Never re-bind `editorRef.current.innerHTML` from state on render; hydrate only via `editorKey` remounts.
10. Priority and status are stored as **Arabic strings** (`عادي/مهم/عاجل`, `مسودة/منشور`) and translated only at the Teams-card/preview boundary.

---

## 10. ACCEPTANCE CHECKLIST

- [ ] Add / toggle / delete channels; webhook masked; test button sends a real Teams message.
- [ ] Title size + title alignment persist and render in both preview and Teams card header.
- [ ] Bold, per-word color (palette + custom picker), and hyperlinks survive: editor → DB → Teams card (colors/bold via RichTextBlock, links as both underlined TextRuns and in-body Action.OpenUrl buttons placed before the metadata).
- [ ] Image via upload and via external URL appears in preview and card; relative upload URLs are absolutized against the request host.
- [ ] Draft → publish from history works; status flips to منشور with timestamp only when ≥ 1 channel succeeded.
- [ ] Multi-channel publish reports per-channel success/failure details in the toast.
- [ ] Whole UI in Arabic RTL with emerald corporate styling and sonner toasts.

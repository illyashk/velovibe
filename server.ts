import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import type { Spot } from './src/types/velovibe';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = parseInt(process.env.PORT || '3000', 10);
const DATA_CACHE_TTL_MS = 10 * 60 * 1000;
const dataCache = new Map<string, { expiresAt: number; value: unknown }>();
const aiRequestTimes = new Map<string, number[]>();
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ownerEmail = process.env.OWNER_EMAIL?.trim().toLocaleLowerCase('en-US');
const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

app.disable('x-powered-by');
app.use((_, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'geolocation=(self)');
  next();
});
app.use(express.json({ limit: '32kb' }));

app.post('/api/auth/bootstrap-admin', async (req: Request, res: Response) => {
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Supabase не налаштовано на сервері.' });
    return;
  }

  const authorization = req.header('authorization');
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) {
    res.status(401).json({ error: 'Потрібна активна сесія Supabase.' });
    return;
  }

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
    if (error || !data.user) {
      res.status(401).json({ error: 'Сесію Supabase не підтверджено.' });
      return;
    }

    const userEmail = data.user.email?.trim().toLocaleLowerCase('en-US');
    const isOwner = Boolean(ownerEmail && userEmail === ownerEmail);
    if (isOwner && !data.user.email_confirmed_at) {
      res.status(403).json({ error: 'Підтверди пошту в Supabase, перш ніж отримати права адміністратора.' });
      return;
    }

    if (isOwner && data.user.app_metadata.role !== 'admin') {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
        app_metadata: { ...data.user.app_metadata, role: 'admin' },
      });
      if (updateError) {
        console.error('Failed to assign the initial VeloVibe admin role:', updateError);
        res.status(500).json({ error: 'Не вдалося призначити роль адміністратора.' });
        return;
      }
    }

    res.json({
      role: isOwner || data.user.app_metadata.role === 'admin' ? 'admin' : 'rider',
      refreshSession: isOwner && data.user.app_metadata.role !== 'admin',
    });
  } catch (error: unknown) {
    console.error('Supabase admin bootstrap request failed:', error);
    res.status(502).json({ error: 'Не вдалося перевірити обліковий запис Supabase.' });
  }
});

app.delete('/api/account', async (req: Request, res: Response) => {
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Supabase не налаштовано на сервері.' });
    return;
  }
  const accessToken = req.header('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) {
    res.status(401).json({ error: 'Потрібна активна сесія Supabase.' });
    return;
  }
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
    if (error || !data.user) {
      res.status(401).json({ error: 'Сесію Supabase не підтверджено.' });
      return;
    }
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(data.user.id);
    if (deleteError) {
      console.error('Failed to delete VeloVibe account:', deleteError);
      res.status(500).json({ error: 'Не вдалося видалити акаунт. Спробуй пізніше або звернись до адміністратора.' });
      return;
    }
    res.status(204).end();
  } catch (error: unknown) {
    console.error('Account deletion request failed:', error);
    res.status(502).json({ error: 'Не вдалося зв’язатися із Supabase для видалення акаунта.' });
  }
});

async function getAuthenticatedAdmin(req: Request) {
  if (!supabaseAdmin) {
    return null;
  }
  const authorization = req.header('authorization');
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) {
    return null;
  }
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) {
    return null;
  }
  const isOwner = Boolean(ownerEmail && data.user.email?.trim().toLocaleLowerCase('en-US') === ownerEmail);
  const isAdmin = isOwner || data.user.app_metadata?.role === 'admin';
  if (!isAdmin) {
    return null;
  }
  return { userId: data.user.id, isOwner };
}

app.get('/api/admin/users', async (req: Request, res: Response) => {
  const account = await getAuthenticatedAdmin(req);
  if (!account) {
    res.status(401).json({ error: 'Тільки адміністратор може переглядати профілі користувачів.' });
    return;
  }
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Supabase не налаштовано на сервері.' });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, display_name, rider_profile, onboarding_complete, ai_history_consent, updated_at')
    .order('updated_at', { ascending: false });

  if (error) {
    res.status(500).json({ error: `Не вдалося завантажити користувачів: ${error.message}` });
    return;
  }

  res.json({ users: data ?? [] });
});

app.patch('/api/admin/users/:userId', async (req: Request, res: Response) => {
  const account = await getAuthenticatedAdmin(req);
  if (!account) {
    res.status(401).json({ error: 'Тільки адміністратор може редагувати профілі користувачів.' });
    return;
  }
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Supabase не налаштовано на сервері.' });
    return;
  }

  const targetUserId = req.params.userId;
  const { display_name, rider_profile, onboarding_complete, ai_history_consent } = req.body as {
    display_name?: string;
    rider_profile?: Record<string, unknown>;
    onboarding_complete?: boolean;
    ai_history_consent?: boolean;
  };

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (typeof display_name === 'string') payload.display_name = display_name;
  if (rider_profile && typeof rider_profile === 'object') payload.rider_profile = rider_profile;
  if (typeof onboarding_complete === 'boolean') payload.onboarding_complete = onboarding_complete;
  if (typeof ai_history_consent === 'boolean') payload.ai_history_consent = ai_history_consent;

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(payload)
    .eq('id', targetUserId)
    .select('id, display_name, rider_profile, onboarding_complete, ai_history_consent, updated_at')
    .single();

  if (error) {
    res.status(500).json({ error: `Не вдалося оновити профіль користувача: ${error.message}` });
    return;
  }

  res.json({ profile: data });
});

function extractModelSearchQuery(message: string): string {
  const cleaned = message
    .replace(/(знайди|пошук|search|find|look up|model|модель|bike|bicycle|байк)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || message.trim();
}

function isLikelyModelSearchRequest(message: string): boolean {
  const lower = message.toLocaleLowerCase('en-US');
  return (
    /(модель|model|bike|bicycle|байк|frame|фрейм|марка|brand)/i.test(lower) &&
    /(шук|пошук|search|find|look up|інтернет|internet|web|знайди)/i.test(lower)
  );
}

async function fetchText(url: string | URL, init?: RequestInit): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`Upstream request failed with status ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ');
}

function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function searchBikeModelOnline(query: string): Promise<Array<{ title: string; url: string }>> {
  const normalized = query.trim();
  if (!normalized) return [];

  const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(`bike model ${normalized}`)}`;
  const html = await fetchText(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      'Accept-Language': 'uk-UA,uk;q=0.9,en;q=0.8',
    },
  });

  const matches = [...html.matchAll(/<h2 class="result__title">\s*<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gis)]
    .map(([, rawUrl, title]) => {
      const rawDecoded = decodeHtmlEntities(stripHtmlTags(rawUrl || ''));
      const decodedTitle = decodeHtmlEntities(stripHtmlTags(title || ''));
      const parsedUrl = rawDecoded.startsWith('//') ? `https:${rawDecoded}` : rawDecoded;
      let safeUrl = parsedUrl;
      try {
        const urlObject = new URL(parsedUrl);
        const uddg = urlObject.searchParams.get('uddg');
        if (uddg) {
          safeUrl = decodeURIComponent(uddg);
        }
      } catch {
        safeUrl = parsedUrl;
      }
      return {
        title: decodedTitle || normalized,
        url: safeUrl,
      };
    })
    .filter(({ title, url }) => title && url && !url.includes('duckduckgo.com'))
    .slice(0, 5);

  return matches;
}

app.get('/api/velovibe/model-search', async (req: Request, res: Response) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!query) {
    res.status(400).json({ error: 'Потрібно передати параметр q з моделлю велосипеда.' });
    return;
  }

  try {
    const results = await searchBikeModelOnline(query);
    res.json({ query, source: 'DuckDuckGo HTML', results });
  } catch (error: unknown) {
    console.error('Model search failed:', error);
    res.status(502).json({ error: 'Не вдалося знайти модель у відкритому інтернет-пошуку.' });
  }
});

async function fetchJson(url: string | URL, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35_000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Upstream request failed with status ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function getCached<T>(key: string): T | undefined {
  const entry = dataCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    dataCache.delete(key);
    return undefined;
  }
  return entry.value as T;
}

function setCached(key: string, value: unknown): void {
  if (dataCache.size >= 200) {
    const oldestKey = dataCache.keys().next().value;
    if (oldestKey) dataCache.delete(oldestKey);
  }
  dataCache.set(key, { value, expiresAt: Date.now() + DATA_CACHE_TTL_MS });
}

function readCoordinate(value: unknown, min: number, max: number): number | null {
  const coordinate = typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(coordinate) && coordinate >= min && coordinate <= max
    ? coordinate
    : null;
}

function getCitySlug(region: string): string | undefined {
  const normalized = region.toLocaleLowerCase('uk-UA');
  const cities: Array<[string, string[]]> = [
    ['vinnytsia', ['вінниц', 'vinnyts']],
    ['kyiv', ['київ', 'kyiv']],
    ['lviv', ['львів', 'lviv']],
    ['dnipro', ['дніпр', 'dnipro']],
    ['odesa', ['одес', 'odesa', 'odessa']],
    ['kharkiv', ['харків', 'kharkiv']],
    ['ivano-frankivsk', ['івано-франків', 'ivano-frankivsk']],
    ['uzhhorod', ['ужгород', 'uzhhorod']],
    ['chernivtsi', ['чернівц', 'chernivtsi']],
    ['karpaty', ['карпат', 'carpath']],
  ];
  return cities.find(([, aliases]) => aliases.some((alias) => normalized.includes(alias)))?.[0];
}

function mapOsmElement(element: Record<string, unknown>, checkedAt: string): Spot | null {
  const tags = element.tags && typeof element.tags === 'object'
    ? element.tags as Record<string, string>
    : {};
  const name = tags['name:uk'] || tags.name || tags['name:en'];
  const id = typeof element.id === 'number' ? element.id : null;
  const osmType = element.type;
  const lat = typeof element.lat === 'number'
    ? element.lat
    : (element.center as { lat?: unknown } | undefined)?.lat;
  const lng = typeof element.lon === 'number'
    ? element.lon
    : (element.center as { lon?: unknown } | undefined)?.lon;
  if (
    !name ||
    id === null ||
    (osmType !== 'node' && osmType !== 'way' && osmType !== 'relation') ||
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    lat < 44 || lat > 53 ||
    lng < 21 || lng > 41
  ) return null;

  const locationName = [
    tags['addr:city'],
    tags['addr:town'],
    tags['addr:village'],
    tags['addr:suburb'],
    tags['addr:place'],
  ].find(Boolean);
  const adminRegion = tags['addr:state'] || tags['is_in:state'] || tags['addr:province'];
  const region = [locationName, adminRegion].filter(Boolean).join(', ') || 'Україна · район не вказаний в OSM';
  const leisure = tags.leisure;
  const sport = (tags.sport || '').toLowerCase();
  const type: Spot['type'] = leisure === 'bike_park'
    ? 'bikepark'
    : leisure === 'pitch' && sport === 'bmx'
    ? 'pumptrack'
    : sport === 'bmx'
    ? 'dirt'
    : 'street';

  return {
    id: `osm:${osmType}:${id}`,
    name,
    locationStatus: 'verified',
    locationSource: `https://www.openstreetmap.org/${osmType}/${id}`,
    region,
    locationName,
    coords: { lat, lng },
    type,
    description: tags['description:uk'] || tags.description,
    surface: tags.surface,
    city: getCitySlug(region),
    osmType,
    osmId: id,
    checkedAt,
  };
}

const apiKey = process.env.GEMINI_API_KEY;
const aiClient = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    })
  : null;

const VELOVIBE_SYSTEM_PROMPT = `Ти — VeloVibe AI, український цифровий велокопілот для райдерів і механіків. Відповідай сучасною природною українською, дружньо й технічно точно. Назви виробників, моделей і стандартів залишай мовою оригіналу, пояснення давай українською.

Допомагай з вибором і налаштуванням велосипеда, геометрією та сумісністю деталей. Не вигадуй сумісність, моменти затягування, тиски чи інші характеристики: уточнюй точні моделі та радь звірятися з інструкціями виробника. Безпека райдера понад усе; не радь їздити на пошкоджених деталях або ремонтувати критичні вузли небезпечним способом.

Важливо про маршрути: VeloVibe показує об’єкти з координатами та посиланнями OpenStreetMap, але це не означає виїзну перевірку, точний вхід, доступність, стан траси, перепади, покриття чи складність. Не видавай непідтверджені відомості за факти й не вигадуй їх. Для конкретного маршруту попроси посилання на офіційне джерело або GPX і наголоси, що умови треба перевіряти окремо. Не стверджуй, що знаєш актуальну погоду чи стан траси без актуального джерела; якщо користувач надає дані Open-Meteo, спирайся лише на них і називай їх модельними поточними умовами. Для побутових вимірювань використовуй метричну систему, для вартості — гривні.

Пиши стисло, використовуй Markdown і таблиці, коли вони справді допомагають.`;

function generateExpertFallback(message: string): string {
  const lower = message.toLowerCase();
  const asksAboutPlaces =
    /вінниц|сабарів|лісопарк|татиш|лапат|лопат|дідьков|київ|голосіїв|вднг|китаєв|карпат|буковел|пилипець|боржав|тростян|драгобрат|львів|винник|дніпр|одес|хортиц|спот|трейл|траса|маршрут|координат|де покатат/.test(lower);

  if (asksAboutPlaces) {
    return `Не хочу вигадувати точку старту, маршрут чи умови траси. На мапі VeloVibe показуються позначені в OpenStreetMap об’єкти з посиланнями на джерело, але це не підтверджує вхід, доступність або стан трейлу. Відкрий картку конкретного місця й звір її з місцевою спільнотою чи офіційним джерелом; якщо маєш GPX або посилання, надішли його для обережного розбору.`;
  }

  if (lower.includes('геометр') || lower.includes('reach') || lower.includes('stack') || lower.includes('річ') || lower.includes('стак')) {
    return `**Reach** — горизонтальна відстань від каретки до верхньої частини кермової труби; разом із довжиною виносу впливає на простір у стійці. **Stack** — вертикальна відстань між цими точками; впливає на висоту передньої частини велосипеда.

Порівнюй значення для однакового розміру рами й враховуй довжину підсідельної труби, кут підсідельної, колісну базу та власну посадку. Самі по собі Reach/Stack не визначають, чи підійде рама: звірся з таблицею виробника та зроби тестову посадку.`;
  }

  if (lower.includes('гальм') || lower.includes('brake') || lower.includes('dot') || lower.includes('мінерал')) {
    return `**Не змішуй DOT і мінеральну оливу.** Тип рідини визначає саме модель гальм; перевір напис на ручці й сервісну інструкцію виробника. Під час прокачування захисти ротор і колодки від рідини та користуйся відповідним комплектом. Якщо невідомі тип рідини, послідовність чи момент затягування — зупинись і звернись до майстерні.`;
  }

  return `Зараз копілот працює без Gemini й має обмежені офлайн-відповіді. Можу допомогти з базовими поняттями геометрії або безпечною підготовкою до обслуговування. Для сумісності компонентів звір точні моделі й документацію виробника; для актуальної інформації про маршрути потрібне перевірене джерело.`;
}

type GeminiContent = {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
};

app.post('/api/velovibe/chat', async (req: Request, res: Response) => {
  try {
    const authorization = req.header('authorization');
    const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!supabaseAdmin || !accessToken) {
      res.status(supabaseAdmin ? 401 : 503).json({
        error: supabaseAdmin ? 'Увійди, щоб скористатися AI-копілотом.' : 'Supabase не налаштовано на сервері.',
      });
      return;
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
    if (authError || !authData.user) {
      res.status(401).json({ error: 'Сесію Supabase не підтверджено. Увійди знову.' });
      return;
    }

    const now = Date.now();
    const recentRequests = (aiRequestTimes.get(authData.user.id) || [])
      .filter((timestamp) => now - timestamp < 60_000);
    if (recentRequests.length >= 20) {
      res.status(429).json({ error: 'Забагато запитів до AI. Зачекай хвилину й спробуй знову.' });
      return;
    }
    recentRequests.push(now);
    aiRequestTimes.set(authData.user.id, recentRequests);
    if (aiRequestTimes.size > 5000) {
      for (const [userId, timestamps] of aiRequestTimes) {
        if (timestamps.every((timestamp) => now - timestamp >= 60_000)) aiRequestTimes.delete(userId);
      }
    }

    const { message, history, riderProfile } = req.body as {
      message?: unknown;
      history?: unknown;
      riderProfile?: unknown;
    };
    if (typeof message !== 'string' || message.trim().length === 0 || message.length > 4000) {
      res.status(400).json({ error: 'Повідомлення має містити від 1 до 4000 символів.' });
      return;
    }

    const profileContext = riderProfile && typeof riderProfile === 'object'
      ? riderProfile as Record<string, unknown>
      : {};
    const safeProfile = {
      bikeModel: typeof profileContext.bikeModel === 'string' ? profileContext.bikeModel.slice(0, 100) : 'не вказано',
      discipline: typeof profileContext.discipline === 'string' ? profileContext.discipline.slice(0, 30) : 'не вказано',
      riderWeightKg: typeof profileContext.riderWeightKg === 'number' && Number.isFinite(profileContext.riderWeightKg)
        ? profileContext.riderWeightKg
        : 'не вказано',
      riderHeightCm: typeof profileContext.riderHeightCm === 'number' && Number.isFinite(profileContext.riderHeightCm)
        ? profileContext.riderHeightCm
        : 'не вказано',
      frameSize: typeof profileContext.frameSize === 'string' ? profileContext.frameSize.slice(0, 30) : 'не вказано',
      forkTravelMm: typeof profileContext.forkTravelMm === 'number' && Number.isFinite(profileContext.forkTravelMm)
        ? profileContext.forkTravelMm
        : 'не вказано',
      shockTravelMm: typeof profileContext.shockTravelMm === 'number' && Number.isFinite(profileContext.shockTravelMm)
        ? profileContext.shockTravelMm
        : 'не вказано',
    };
    const riderContext = `Контекст профілю райдера (відомості, введені самим користувачем; не є підтвердженим оглядом): ${JSON.stringify(safeProfile)}. Використовуй лише доречні поля, не вигадуй відсутніх значень.`;

    const modelSearchContext = isLikelyModelSearchRequest(message)
      ? await searchBikeModelOnline(extractModelSearchQuery(message))
      : [];
    const webSearchSummary = modelSearchContext.length > 0
      ? `\nІнтернет-пошук моделей: ${modelSearchContext
          .map((result, index) => `${index + 1}. ${result.title} — ${result.url}`)
          .join('\n')}`
      : '';

    if (!aiClient) {
      res.json({ reply: generateExpertFallback(`${message}${webSearchSummary ? `\n${webSearchSummary}` : ''}`) });
      return;
    }

    const contents: GeminiContent[] = [];
    if (Array.isArray(history)) {
      for (const item of history.slice(-6)) {
        if (item && typeof item === 'object' && 'role' in item && 'text' in item) {
          const role = item.role;
          const text = typeof item.text === 'string' ? item.text.slice(0, 4000) : '';
          if (text && role === 'user') contents.push({ role: 'user', parts: [{ text }] });
          if (text && role === 'assistant') contents.push({ role: 'model', parts: [{ text }] });
        }
      }
    }
    contents.push({ role: 'user', parts: [{ text: `${riderContext}${webSearchSummary}\nЗапит райдера: ${message}` }] });

    const response = await aiClient.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: { systemInstruction: VELOVIBE_SYSTEM_PROMPT },
    });

    res.json({ reply: response.text || generateExpertFallback(message) });
  } catch (error: unknown) {
    console.error('Error calling Gemini API:', error);
    const fallbackMessage =
      typeof req.body === 'object' &&
      req.body &&
      'message' in req.body &&
      typeof req.body.message === 'string'
        ? req.body.message
        : '';
    res.json({
      reply: generateExpertFallback(fallbackMessage),
      warning: 'Відповідь згенеровано офлайн: сервер Gemini тимчасово недоступний.',
    });
  }
});

app.get('/api/velovibe/spots', async (req: Request, res: Response) => {
  const forceRefresh = req.query.refresh === '1';
  const cached = forceRefresh ? undefined : getCached<{ spots: Spot[]; checkedAt: string }>('osm:ukraine-spots');
  if (cached) {
    res.json({ ...cached, source: 'OpenStreetMap', cached: true });
    return;
  }

  const query = `
    [out:json][timeout:30];
    area["ISO3166-1"="UA"][admin_level=2]->.ukraine;
    (
      nwr["leisure"="bike_park"]["name"](area.ukraine);
      nwr["leisure"="pitch"]["sport"~"bmx|cycling|mountain_biking|mtb"]["name"](area.ukraine);
      nwr["leisure"="track"]["sport"~"bmx|cycling|mountain_biking|mtb"]["name"](area.ukraine);
    );
    out center tags;
  `;

  try {
    const result = await fetchJson('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'VeloVibe/1.0 (Ukraine cycling map)',
      },
      body: `data=${encodeURIComponent(query)}`,
    }) as { elements?: unknown };
    const elements = Array.isArray(result.elements) ? result.elements : null;
    if (!elements) throw new Error('Overpass response has no elements array');

    const checkedAt = new Date().toISOString();
    const spots = elements
      .filter((element): element is Record<string, unknown> => Boolean(element && typeof element === 'object'))
      .map((element) => mapOsmElement(element, checkedAt))
      .filter((spot): spot is Spot => spot !== null)
      .filter((spot, index, items) => items.findIndex((item) => item.id === spot.id) === index);
    const payload = { spots, checkedAt };
    setCached('osm:ukraine-spots', payload);
    res.json({ ...payload, source: 'OpenStreetMap', cached: false });
  } catch (error: unknown) {
    console.error('OpenStreetMap spots request failed:', error);
    res.status(502).json({ error: 'Не вдалося завантажити веломісця з OpenStreetMap. Спробуй оновити список пізніше.' });
  }
});

app.get('/api/velovibe/weather', async (req: Request, res: Response) => {
  const lat = readCoordinate(req.query.lat, -90, 90);
  const lon = readCoordinate(req.query.lon, -180, 180);
  if (lat === null || lon === null) {
    res.status(400).json({ error: 'Потрібні коректні координати lat та lon.' });
    return;
  }

  const cacheKey = `weather:${lat.toFixed(2)}:${lon.toFixed(2)}`;
  const cached = req.query.refresh === '1'
    ? undefined
    : getCached<Record<string, unknown>>(cacheKey);
  if (cached) {
    res.json({ ...cached, cached: true });
    return;
  }

  const weatherUrl = new URL('https://api.open-meteo.com/v1/forecast');
  weatherUrl.search = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    current: [
      'temperature_2m',
      'relative_humidity_2m',
      'apparent_temperature',
      'precipitation',
      'weather_code',
      'wind_speed_10m',
      'wind_direction_10m',
      'wind_gusts_10m',
    ].join(','),
    temperature_unit: 'celsius',
    wind_speed_unit: 'kmh',
    precipitation_unit: 'mm',
    timezone: 'auto',
  }).toString();

  try {
    const result = await fetchJson(weatherUrl) as {
      current?: Record<string, unknown>;
      current_units?: Record<string, unknown>;
      timezone?: unknown;
    };
    const current = result.current;
    const numericFields = [
      'temperature_2m',
      'relative_humidity_2m',
      'apparent_temperature',
      'precipitation',
      'weather_code',
      'wind_speed_10m',
      'wind_direction_10m',
      'wind_gusts_10m',
    ];
    if (
      !current ||
      typeof current.time !== 'string' ||
      numericFields.some((field) => typeof current[field] !== 'number' || !Number.isFinite(current[field]))
    ) throw new Error('Open-Meteo response has incomplete current conditions');

    const payload = {
      current,
      units: result.current_units || {},
      timezone: typeof result.timezone === 'string' ? result.timezone : 'локальний час місця',
      coordinates: { lat, lon },
      source: 'Open-Meteo',
      fetchedAt: new Date().toISOString(),
      observationType: 'modelled-current-conditions',
    };
    setCached(cacheKey, payload);
    res.json({ ...payload, cached: false });
  } catch (error: unknown) {
    console.error('Open-Meteo weather request failed:', error);
    res.status(502).json({ error: 'Не вдалося отримати актуальні погодні дані. Спробуй оновити їх пізніше.' });
  }
});

app.get('/api/velovibe/health', (_req: Request, res: Response) => {
  res.json({
    status: 'online',
    system: 'VeloVibe AI Copilot',
    engine: aiClient ? 'Gemini 3.8 Flash' : 'Local Knowledge Engine',
    integrations: {
      supabase: Boolean(supabaseAdmin),
      gemini: Boolean(aiClient),
    },
    timestamp: new Date().toISOString(),
  });
});

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 VeloVibe AI Server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

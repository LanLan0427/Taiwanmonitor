/**
 * Taiwan Data API Proxy - Vercel Edge Function
 * Proxies requests to Taiwan open data APIs (CWA, Taipower, MOENV)
 * to avoid CORS issues and add caching.
 */

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, { data: unknown; ts: number }>();

function getCached(key: string): unknown | null {
    const entry = cache.get(key);
    if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
    return null;
}

function setCache(key: string, data: unknown): void {
    cache.set(key, { data, ts: Date.now() });
}

// CWA Earthquake API
async function fetchCWAEarthquakes(apiKey?: string): Promise<unknown> {
    const cached = getCached('cwa-eq');
    if (cached) return cached;

    // Use significant earthquake report + small area report
    const urls = [
        `https://opendata.cwa.gov.tw/api/v1/rest/datastore/E-A0015-001?Authorization=${apiKey || 'CWA-OPENDATA-KEY'}&limit=10&format=JSON`,
        `https://opendata.cwa.gov.tw/api/v1/rest/datastore/E-A0016-001?Authorization=${apiKey || 'CWA-OPENDATA-KEY'}&limit=5&format=JSON`,
    ];

    try {
        const results = await Promise.allSettled(urls.map(url =>
            fetch(url, { headers: { 'Accept': 'application/json' } }).then(r => r.json())
        ));

        const earthquakes: unknown[] = [];
        const debugPayload: unknown[] = [];
        for (const result of results) {
            if (result.status === 'fulfilled') {
                debugPayload.push(result.value);
                if (result.value?.records?.Earthquake) {
                    earthquakes.push(...result.value.records.Earthquake);
                }
            } else {
                debugPayload.push({ error: result.reason });
            }
        }

        const data = { earthquakes, debug: debugPayload, updatedAt: new Date().toISOString() };
        if (earthquakes.length > 0) {
            setCache('cwa-eq', data);
        }
        return data;
    } catch (e) {
        return { earthquakes: [], error: String(e) };
    }
}

// Taipower supply data
async function fetchTaipowerSupply(): Promise<unknown> {
    const cached = getCached('taipower');
    if (cached) return cached;

    try {
        // Taipower real-time generation info
        const res = await fetch('https://www.taipower.com.tw/d006/loadGraph/loadGraph/data/genary.json', {
            headers: { 'Accept': 'application/json', 'User-Agent': 'TaiwanMonitor/1.0' },
        });

        if (!res.ok) throw new Error(`Taipower HTTP ${res.status}`);
        const raw = await res.json();

        const data = { ...raw, updatedAt: new Date().toISOString() };
        setCache('taipower', data);
        return data;
    } catch (e) {
        return { error: String(e) };
    }
}

// MOENV AQI data
async function fetchAQI(apiKey?: string): Promise<unknown> {
    const cached = getCached('aqi');
    if (cached) return cached;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const aqiKey = apiKey || process.env.MOENV_API_KEY || 'e8dd42e6-9b8b-43f8-991e-b3dee723a52d';
        const res = await fetch(`https://data.moenv.gov.tw/api/v2/aqx_p_432?api_key=${aqiKey}&limit=100&sort=ImportDate%20desc&format=JSON`, {
            headers: { 'Accept': 'application/json' },
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) throw new Error(`AQI HTTP ${res.status}`);
        const raw = await res.json();

        const records = Array.isArray(raw) ? raw : (raw?.records || []);
        const data = { stations: records, updatedAt: new Date().toISOString() };
        setCache('aqi', data);
        return data;
    } catch (e) {
        return { stations: [], error: String(e) };
    }
}

// WRA Reservoir data
async function fetchReservoirs(): Promise<unknown> {
    const cached = getCached('reservoirs');
    if (cached) return cached;

    try {
        const [stationsRes, dataRes] = await Promise.all([
            fetch('https://fhy.wra.gov.tw/WraApi/v1/Reservoir/Station', { headers: { 'Accept': 'application/json' } }),
            fetch('https://fhy.wra.gov.tw/WraApi/v1/Reservoir/RealTimeInfo', { headers: { 'Accept': 'application/json' } })
        ]);

        if (!stationsRes.ok || !dataRes.ok) throw new Error('WRA API Error');
        const stations: any[] = await stationsRes.json();
        const data: any[] = await dataRes.json();

        // Map station names to real-time data
        const stationMap = new Map();
        for (const s of stations) {
            stationMap.set(s.StationNo, s);
        }

        const merged = data.map(d => {
            const st = stationMap.get(d.StationNo);
            return {
                ...d,
                StationName: st ? st.StationName : '未知測站',
                Longitude: st ? st.Longitude : 120.9,
                Latitude: st ? st.Latitude : 23.7
            };
        });

        const result = { reservoirs: merged, updatedAt: new Date().toISOString() };
        setCache('reservoirs', result);
        return result;
    } catch (e) {
        return { reservoirs: [], error: String(e) };
    }
}

// CWA Weather Observation (automatic stations)
async function fetchCWAWeather(apiKey?: string): Promise<unknown> {
    const cached = getCached('cwa-weather');
    if (cached) return cached;

    try {
        const key = apiKey || 'CWA-OPENDATA-KEY';
        const res = await fetch(
            `https://opendata.cwa.gov.tw/api/v1/rest/datastore/O-A0003-001?Authorization=${key}&format=JSON`,
            { headers: { 'Accept': 'application/json' } }
        );
        if (!res.ok) throw new Error(`CWA Weather HTTP ${res.status}`);
        const raw = await res.json();
        const stations = raw?.records?.Station || [];
        const data = { stations, updatedAt: new Date().toISOString() };
        if (stations.length > 0) setCache('cwa-weather', data);
        return data;
    } catch (e) {
        return { stations: [], error: String(e) };
    }
}

// CWA 36-hour Forecast
async function fetchCWAForecast(apiKey?: string): Promise<unknown> {
    const cached = getCached('cwa-forecast');
    if (cached) return cached;

    try {
        const key = apiKey || 'CWA-OPENDATA-KEY';
        const res = await fetch(
            `https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-C0032-001?Authorization=${key}&format=JSON`,
            { headers: { 'Accept': 'application/json' } }
        );
        if (!res.ok) throw new Error(`CWA Forecast HTTP ${res.status}`);
        const raw = await res.json();
        const locations = raw?.records?.location || [];
        const data = { locations, updatedAt: new Date().toISOString() };
        if (locations.length > 0) setCache('cwa-forecast', data);
        return data;
    } catch (e) {
        return { locations: [], error: String(e) };
    }
}

// CWA Typhoon bulletin
async function fetchCWATyphoon(apiKey?: string): Promise<unknown> {
    const cached = getCached('cwa-typhoon');
    if (cached) return cached;

    try {
        const key = apiKey || 'CWA-OPENDATA-KEY';
        const res = await fetch(
            `https://opendata.cwa.gov.tw/api/v1/rest/datastore/W-C0034-005?Authorization=${key}&format=JSON`,
            { headers: { 'Accept': 'application/json' } }
        );
        if (!res.ok) throw new Error(`CWA Typhoon HTTP ${res.status}`);
        const raw = await res.json();
        const data = { ...raw?.records, updatedAt: new Date().toISOString() };
        setCache('cwa-typhoon', data);
        return data;
    } catch (e) {
        return { error: String(e) };
    }
}

// MOENV UV index
async function fetchMOENVUV(apiKey?: string): Promise<unknown> {
    const cached = getCached('moenv-uv');
    if (cached) return cached;

    try {
        const key = apiKey || process.env.MOENV_API_KEY || '';
        const res = await fetch(
            `https://data.moenv.gov.tw/api/v2/uv_s_01?api_key=${key}&limit=100&sort=publishtime%20desc&format=JSON`,
            { headers: { 'Accept': 'application/json' } }
        );
        if (!res.ok) throw new Error(`MOENV UV HTTP ${res.status}`);
        const raw = await res.json();
        const records = Array.isArray(raw) ? raw : (raw?.records || []);
        const data = { stations: records, updatedAt: new Date().toISOString() };
        if (records.length > 0) setCache('moenv-uv', data);
        return data;
    } catch (e) {
        return { stations: [], error: String(e) };
    }
}

// Taipower Power Outage data
async function fetchTaipowerOutage(): Promise<unknown> {
    const cached = getCached('taipower-outage');
    if (cached) return cached;

    try {
        const res = await fetch('https://www.taipower.com.tw/d006/loadGraph/loadGraph/data/pstoutage.json', {
            headers: { 'Accept': 'application/json', 'User-Agent': 'TaiwanMonitor/1.0' },
        });
        if (!res.ok) throw new Error(`Taipower Outage HTTP ${res.status}`);
        const raw = await res.json();
        const data = { outages: raw, updatedAt: new Date().toISOString() };
        setCache('taipower-outage', data);
        return data;
    } catch (e) {
        return { outages: [], error: String(e) };
    }
}

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const type = url.searchParams.get('type') || 'power';
    const cwaKey = url.searchParams.get('cwa_key') || process.env.CWA_API_KEY || '';
    const moenvKey = url.searchParams.get('moenv_key') || process.env.MOENV_API_KEY || '';

    let data: unknown;

    switch (type) {
        case 'earthquake':
            data = await fetchCWAEarthquakes(cwaKey);
            break;
        case 'power':
            data = await fetchTaipowerSupply();
            break;
        case 'aqi':
            data = await fetchAQI(moenvKey);
            break;
        case 'reservoir':
            data = await fetchReservoirs();
            break;
        case 'weather':
            data = await fetchCWAWeather(cwaKey);
            break;
        case 'forecast':
            data = await fetchCWAForecast(cwaKey);
            break;
        case 'typhoon':
            data = await fetchCWATyphoon(cwaKey);
            break;
        case 'uv':
            data = await fetchMOENVUV(moenvKey);
            break;
        case 'outage':
            data = await fetchTaipowerOutage();
            break;
        default:
            data = { error: `Unknown type: ${type}` };
    }

    return new Response(JSON.stringify(data), {
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 's-maxage=300, stale-while-revalidate=60',
            'Access-Control-Allow-Origin': '*',
        },
    });
}

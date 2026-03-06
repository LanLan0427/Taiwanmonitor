/**
 * TDX API Proxy - Vercel Edge Function
 * Proxies requests to Taiwan Transport Data eXchange (TDX)
 * Handles OAuth2 Token generation, caching, and merging station coordinates with live liveboards.
 */

const CACHE_TTL_TOKEN = 12 * 60 * 60 * 1000; // 12 hours
const CACHE_TTL_STATION = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_TTL_LIVE = 30 * 1000; // 30 seconds

const cache = new Map<string, { data: any; ts: number }>();

function getCached(key: string, ttl: number): any {
    const entry = cache.get(key);
    if (entry && Date.now() - entry.ts < ttl) return entry.data;
    return null;
}

function setCache(key: string, data: any): void {
    cache.set(key, { data, ts: Date.now() });
}

// 1. Fetch OAuth2 Token
async function fetchTDXToken(): Promise<string | null> {
    const cached = getCached('tdx-token', CACHE_TTL_TOKEN);
    if (cached) return cached;

    const clientId = process.env.VITE_TDX_CLIENT_ID || process.env.TDX_CLIENT_ID;
    const clientSecret = process.env.VITE_TDX_CLIENT_SECRET || process.env.TDX_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        console.error('[TDX] Missing Client ID or Secret in environment variables');
        return null; // Local config error handled in vite config anyway, edge needs real env vars
    }

    try {
        const body = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret
        });

        const res = await fetch('https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString()
        });

        if (!res.ok) throw new Error(`TDX Token HTTP ${res.status}`);
        const data = await res.json();

        if (data.access_token) {
            setCache('tdx-token', data.access_token);
            return data.access_token;
        }
        return null;
    } catch (e) {
        console.error('[TDX] Token fetch error:', e);
        return null;
    }
}

// 2. Fetch TRA Stations
async function fetchTRAStations(token: string): Promise<any> {
    const cached = getCached('tra-stations', CACHE_TTL_STATION);
    if (cached) return cached;

    try {
        const res = await fetch('https://tdx.transportdata.tw/api/basic/v3/Rail/TRA/Station?$format=JSON', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`TDX Station HTTP ${res.status}`);
        const data = await res.json();

        // Map StationID to { PositionLon, PositionLat, StationName }
        const stationMap: Record<string, any> = {};
        if (data && data.Stations) {
            data.Stations.forEach((s: any) => {
                stationMap[s.StationID] = {
                    lon: s.StationPosition.PositionLon,
                    lat: s.StationPosition.PositionLat,
                    name: s.StationName.Zh_tw,
                    enName: s.StationName.En
                };
            });
        }

        setCache('tra-stations', stationMap);
        return stationMap;
    } catch (e) {
        console.error('[TDX] Station fetch error:', e);
        return {};
    }
}

// 3. Fetch TRA Live Board
async function fetchTRALiveBoard(token: string): Promise<any[]> {
    try {
        const res = await fetch('https://tdx.transportdata.tw/api/basic/v3/Rail/TRA/TrainLiveBoard?$format=JSON', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`TDX LiveBoard HTTP ${res.status}`);
        const data = await res.json();
        return data.TrainLiveBoards || [];
    } catch (e) {
        console.error('[TDX] LiveBoard fetch error:', e);
        return [];
    }
}

// Main Edge Handler
export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const type = url.searchParams.get('type') || 'tra';

    if (type === 'tra') {
        const cachedCombined = getCached('tra-live-combined', CACHE_TTL_LIVE);
        if (cachedCombined) {
            return new Response(JSON.stringify(cachedCombined), {
                headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30' }
            });
        }

        const token = await fetchTDXToken();
        if (!token) {
            return new Response(JSON.stringify({ vehicles: [], error: 'TDX Auth Failed' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 500
            });
        }

        const [stations, liveboards] = await Promise.all([
            fetchTRAStations(token),
            fetchTRALiveBoard(token)
        ]);

        const vehicles = liveboards.map(lb => {
            const st = stations[lb.StationID];
            if (!st) return null;
            return {
                id: lb.TrainNo,
                line: 'TRA',
                type: lb.TrainTypeName.Zh_tw,
                delay: lb.DelayTime,
                station: st.name,
                direction: lb.Direction, // 0:順行(北上?), 1:逆行(南下?) (Depend on TDX dict, usually 0:順行, 1:逆行)
                status: lb.TrainStationStatus, // 0: 進站中, 1: 停靠中, 2: 離站
                lat: st.lat,
                lon: st.lon,
                updated: lb.UpdateTime
            };
        }).filter(Boolean);

        const result = { vehicles, updatedAt: new Date().toISOString() };
        setCache('tra-live-combined', result);

        return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30' }
        });
    }

    return new Response(JSON.stringify({ error: `Unknown type: ${type}` }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400
    });
}

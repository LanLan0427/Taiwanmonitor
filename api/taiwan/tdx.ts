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

// 4. Fetch THSR Stations
async function fetchTHSRStations(token: string): Promise<any> {
    const cached = getCached('thsr-stations', CACHE_TTL_STATION);
    if (cached) return cached;

    try {
        const res = await fetch('https://tdx.transportdata.tw/api/basic/v2/Rail/THSR/Station?$format=JSON', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`TDX THSR Station HTTP ${res.status}`);
        const data = await res.json();
        const stationMap: Record<string, any> = {};
        for (const s of data) {
            stationMap[s.StationID] = {
                lon: s.StationPosition.PositionLon,
                lat: s.StationPosition.PositionLat,
                name: s.StationName.Zh_tw,
                enName: s.StationName.En,
            };
        }
        setCache('thsr-stations', stationMap);
        return stationMap;
    } catch (e) {
        console.error('[TDX] THSR Station fetch error:', e);
        return {};
    }
}

// 5. Fetch THSR Available Seat Status
async function fetchTHSRAvailability(token: string): Promise<any[]> {
    try {
        const res = await fetch('https://tdx.transportdata.tw/api/basic/v2/Rail/THSR/AvailableSeatStatusList?$format=JSON', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`TDX THSR Availability HTTP ${res.status}`);
        const data = await res.json();
        return data.AvailableSeats || data || [];
    } catch (e) {
        console.error('[TDX] THSR Availability fetch error:', e);
        return [];
    }
}

// 6. Fetch Airport FIDS (Flight Information Display)
async function fetchAirportFIDS(token: string, airportId: string, direction: 'Arrival' | 'Departure'): Promise<any[]> {
    try {
        const res = await fetch(`https://tdx.transportdata.tw/api/basic/v2/Air/FIDS/Airport/${airportId}/${direction}?$top=50&$format=JSON`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`TDX FIDS HTTP ${res.status}`);
        const data = await res.json();
        return data.FIDSArrivals || data.FIDSDepartures || data || [];
    } catch (e) {
        console.error(`[TDX] FIDS ${direction} fetch error:`, e);
        return [];
    }
}

// 7. Fetch Highway Live Traffic
async function fetchHighwayLiveTraffic(token: string): Promise<any[]> {
    try {
        const res = await fetch('https://tdx.transportdata.tw/api/basic/v2/Road/Traffic/Live/Freeway?$top=200&$format=JSON', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`TDX Highway HTTP ${res.status}`);
        const data = await res.json();
        return data.LiveTraffics || data || [];
    } catch (e) {
        console.error('[TDX] Highway fetch error:', e);
        return [];
    }
}

// 8. Fetch YouBike Availability
async function fetchYouBikeAvailability(token: string, city: string): Promise<any[]> {
    try {
        const res = await fetch(`https://tdx.transportdata.tw/api/basic/v2/Bike/Availability/City/${city}?$top=500&$format=JSON`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`TDX YouBike HTTP ${res.status}`);
        const data = await res.json();
        return data || [];
    } catch (e) {
        console.error(`[TDX] YouBike ${city} fetch error:`, e);
        return [];
    }
}

// Main Edge Handler
export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const type = url.searchParams.get('type') || 'tra';

    const token = await fetchTDXToken();
    if (!token) {
        return new Response(JSON.stringify({ error: 'TDX Auth Failed' }), {
            headers: { 'Content-Type': 'application/json' },
            status: 500
        });
    }

    // ── TRA ──────────────────────────────────────────────────────────
    if (type === 'tra') {
        const cachedCombined = getCached('tra-live-combined', CACHE_TTL_LIVE);
        if (cachedCombined) {
            return jsonResponse(cachedCombined, 30);
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
                direction: lb.Direction,
                status: lb.TrainStationStatus,
                lat: st.lat,
                lon: st.lon,
                updated: lb.UpdateTime
            };
        }).filter(Boolean);

        const result = { vehicles, updatedAt: new Date().toISOString() };
        setCache('tra-live-combined', result);
        return jsonResponse(result, 30);
    }

    // ── THSR ─────────────────────────────────────────────────────────
    if (type === 'thsr') {
        const cached = getCached('thsr-live-combined', CACHE_TTL_LIVE);
        if (cached) return jsonResponse(cached, 30);

        const [stations, seats] = await Promise.all([
            fetchTHSRStations(token),
            fetchTHSRAvailability(token),
        ]);

        const trains = seats.map((s: any) => {
            const stopStations = s.StopStations || [];
            const firstStop = stopStations[0];
            const lastStop = stopStations[stopStations.length - 1];
            const st = firstStop ? stations[firstStop.StationID] : null;
            return {
                id: s.TrainNo || '',
                direction: s.Direction ?? 0,
                originStation: firstStop?.StationName?.Zh_tw || '',
                destStation: lastStop?.StationName?.Zh_tw || '',
                seatStatus: stopStations.map((ss: any) => ({
                    station: ss.StationName?.Zh_tw || '',
                    stationId: ss.StationID || '',
                    standard: ss.StandardSeatStatus ?? '',
                    business: ss.BusinessSeatStatus ?? '',
                })),
                lat: st?.lat || 0,
                lon: st?.lon || 0,
            };
        }).filter((t: any) => t.id);

        const result = { trains, updatedAt: new Date().toISOString() };
        setCache('thsr-live-combined', result);
        return jsonResponse(result, 30);
    }

    // ── Flights ──────────────────────────────────────────────────────
    if (type === 'flights') {
        const cached = getCached('flights-combined', 60 * 1000);
        if (cached) return jsonResponse(cached, 60);

        const airports = ['TPE', 'TSA', 'KHH'];
        const results = await Promise.allSettled(
            airports.flatMap(ap => [
                fetchAirportFIDS(token, ap, 'Arrival').then(d => d.map((f: any) => ({ ...f, _airport: ap, _dir: 'arrival' }))),
                fetchAirportFIDS(token, ap, 'Departure').then(d => d.map((f: any) => ({ ...f, _airport: ap, _dir: 'departure' }))),
            ])
        );

        const flights: any[] = [];
        for (const r of results) {
            if (r.status === 'fulfilled') flights.push(...r.value);
        }

        const parsed = flights.map((f: any) => ({
            flightNo: f.FlightNumber || f.AirlineID + f.FlightNumber || '',
            airline: f.AirlineName?.Zh_tw || f.AirlineID || '',
            airport: f._airport,
            direction: f._dir,
            origin: f.DepartureAirportName?.Zh_tw || f.DepartureAirportID || '',
            destination: f.ArrivalAirportName?.Zh_tw || f.ArrivalAirportID || '',
            scheduledTime: f.ScheduleArrivalTime || f.ScheduleDepartureTime || '',
            actualTime: f.ActualArrivalTime || f.ActualDepartureTime || '',
            estimatedTime: f.EstimatedArrivalTime || f.EstimatedDepartureTime || '',
            terminal: f.Terminal || '',
            gate: f.Gate || '',
            status: f.ArrivalRemark || f.DepartureRemark || '',
            isCargo: f.IsCargo ?? false,
        })).filter((f: any) => f.flightNo && !f.isCargo);

        const result = { flights: parsed, updatedAt: new Date().toISOString() };
        setCache('flights-combined', result);
        return jsonResponse(result, 60);
    }

    // ── Highway ──────────────────────────────────────────────────────
    if (type === 'highway') {
        const cached = getCached('highway-live', 60 * 1000);
        if (cached) return jsonResponse(cached, 60);

        const raw = await fetchHighwayLiveTraffic(token);
        const sections = raw.map((s: any) => ({
            sectionId: s.SectionID || '',
            sectionName: s.SectionName || '',
            routeId: s.RouteID || '',
            routeName: s.RouteName?.Zh_tw || s.RouteID || '',
            direction: s.RoadDirection || '',
            travelTime: s.TravelTime ?? 0,
            travelSpeed: s.TravelSpeed ?? 0,
            congestionLevel: s.Level ?? s.CongestionLevel ?? 0,
            srcDetId: s.SrcDetID || '',
            dstDetId: s.DstDetID || '',
        }));

        const result = { sections, updatedAt: new Date().toISOString() };
        setCache('highway-live', result);
        return jsonResponse(result, 60);
    }

    // ── YouBike ──────────────────────────────────────────────────────
    if (type === 'youbike') {
        const cached = getCached('youbike-combined', 60 * 1000);
        if (cached) return jsonResponse(cached, 60);

        const cities = ['Taipei', 'NewTaipei', 'Taoyuan', 'Taichung', 'Kaohsiung'];
        const results = await Promise.allSettled(
            cities.map(city => fetchYouBikeAvailability(token, city).then(d => d.map((s: any) => ({ ...s, _city: city }))))
        );

        const stations: any[] = [];
        for (const r of results) {
            if (r.status === 'fulfilled') stations.push(...r.value);
        }

        const parsed = stations.map((s: any) => ({
            stationId: s.StationUID || s.StationID || '',
            name: s.StationName?.Zh_tw || '',
            city: s._city || '',
            availableRent: s.AvailableRentBikes ?? 0,
            availableReturn: s.AvailableReturnBikes ?? 0,
            capacity: (s.AvailableRentBikes ?? 0) + (s.AvailableReturnBikes ?? 0),
            serviceStatus: s.ServiceStatus ?? 1,
            lat: s.StationPosition?.PositionLat ?? 0,
            lon: s.StationPosition?.PositionLon ?? 0,
            updatedAt: s.SrcUpdateTime || s.UpdateTime || '',
        })).filter((s: any) => s.name && s.serviceStatus === 1);

        const result = { stations: parsed, updatedAt: new Date().toISOString() };
        setCache('youbike-combined', result);
        return jsonResponse(result, 60);
    }

    return new Response(JSON.stringify({ error: `Unknown type: ${type}` }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400
    });
}

function jsonResponse(data: any, maxAge: number): Response {
    return new Response(JSON.stringify(data), {
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': `public, max-age=${maxAge}`,
            'Access-Control-Allow-Origin': '*',
        }
    });
}

/**
 * Taiwan-specific data services
 * Fetches earthquake, power supply, and air quality data for Taiwan Monitor
 */

import { createCircuitBreaker } from '@/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TaiwanEarthquake {
    id: string;
    time: string;
    location: string;
    magnitude: number;
    depth: number;
    lat: number;
    lon: number;
    maxIntensity: string;
    intensityAreas: Array<{ area: string; intensity: string }>;
}

export interface TaipowerSupply {
    updatedAt: string;
    supplyCapacity: number;   // MW - 供電能力
    currentLoad: number;      // MW - 目前用電
    reserveMargin: number;    // % - 備轉容量率
    reserveCapacity: number;  // MW - 備轉容量
    lightSignal: 'green' | 'yellow' | 'orange' | 'red'; // 供電燈號
    sources: Array<{
        name: string;
        capacity: number;
        generation: number;
        percentage: number;
    }>;
    byType: Array<{
        type: string;
        capacity: number;
        generation: number;
        percentage: number;
    }>;
}

export interface AQIStation {
    siteName: string;
    county: string;
    aqi: number;
    status: string;
    pm25: number;
    pm10: number;
    o3: string;
    pollutant: string;
    publishTime: string;
    longitude: number;
    latitude: number;
}

export interface WRAReservoir {
    id: string;
    name: string;
    waterHeight: number;
    effectiveStorage: number; // 萬立方公尺
    percentage: number; // %
    time: string;
    status: number;
}

// ─── Circuit Breakers ─────────────────────────────────────────────────────────

const powerBreaker = createCircuitBreaker<TaipowerSupply | null>({
    name: 'Taipower',
    cacheTtlMs: 5 * 60 * 1000,
    persistCache: true,
});

const aqiBreaker = createCircuitBreaker<AQIStation[]>({
    name: 'Taiwan-AQI',
    cacheTtlMs: 5 * 60 * 1000,
    persistCache: false,
});

const earthquakeBreaker = createCircuitBreaker<TaiwanEarthquake[]>({
    name: 'CWA-Earthquake',
    cacheTtlMs: 10 * 60 * 1000,
    persistCache: true,
});

const reservoirBreaker = createCircuitBreaker<WRAReservoir[]>({
    name: 'WRA-Reservoir',
    cacheTtlMs: 10 * 60 * 1000,
    persistCache: false,
});

// ─── Taipower Supply ──────────────────────────────────────────────────────────

export async function fetchTaipowerSupply(): Promise<TaipowerSupply | null> {
    return powerBreaker.execute(async () => {
        // Taipower public JSON endpoint (fetched via our Edge Function in production,
        // or directly in dev with Vite proxy / fallback)
        const url = import.meta.env.DEV
            ? '/api/taiwan/data?type=power'
            : '/api/taiwan/data?type=power';
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();
        if (raw.error) throw new Error(raw.error);
        return parseTaipowerData(raw);
    }, null);
}

function parseTaipowerData(raw: Record<string, unknown>): TaipowerSupply {
    // Taipower JSON structure: aaData array with generation info
    // row[0] = energy type (燃氣/燃煤/核能/風力/太陽能/水力/etc)
    // row[1] = group or sub-type
    // row[2] = unit name (大潭CC#1, etc)
    // row[3] = capacity (MW)
    // row[4] = generation (MW)
    // row[5] = percentage
    const aaData = (raw as { aaData?: unknown[][] })?.aaData || [];

    let totalCapacity = 0;
    let totalGeneration = 0;

    // Group by plant name (strip unit number)
    const plantMap = new Map<string, { capacity: number; generation: number }>();
    // Group by energy type
    const typeMap = new Map<string, { capacity: number; generation: number }>();

    for (const row of aaData) {
        if (!Array.isArray(row) || row.length < 6) continue;
        const energyType = String(row[0] || '').replace(/<[^>]*>/g, '').trim();
        const unitName = String(row[2] || '').replace(/<[^>]*>/g, '').trim();
        const cap = parseFloat(String(row[3] || '0').replace(/,/g, ''));
        const gen = parseFloat(String(row[4] || '0').replace(/,/g, ''));

        if (isNaN(cap) || isNaN(gen) || !unitName) continue;

        totalCapacity += cap;
        totalGeneration += gen;

        // Extract plant base name (remove CC#1, #2, etc.)
        const plantName = unitName.replace(/[#＃]\d+.*$/, '').replace(/CC$/, '').replace(/GT$/, '').replace(/ST$/, '').replace(/\d+$/, '').trim() || unitName;

        // Merge into plant map
        const plant = plantMap.get(plantName) || { capacity: 0, generation: 0 };
        plant.capacity += cap;
        plant.generation += gen;
        plantMap.set(plantName, plant);

        // Merge into type map
        if (energyType) {
            const t = typeMap.get(energyType) || { capacity: 0, generation: 0 };
            t.capacity += cap;
            t.generation += gen;
            typeMap.set(energyType, t);
        }
    }

    const reserve = totalCapacity - totalGeneration;
    const reserveRate = totalGeneration > 0 ? (reserve / totalGeneration) * 100 : 0;

    // Convert plant map to sorted array (by generation desc)
    const sources = Array.from(plantMap.entries())
        .map(([name, d]) => ({
            name,
            capacity: Math.round(d.capacity),
            generation: Math.round(d.generation),
            percentage: totalGeneration > 0 ? Math.round((d.generation / totalGeneration) * 1000) / 10 : 0,
        }))
        .filter(s => s.generation > 0)
        .sort((a, b) => b.generation - a.generation)
        .slice(0, 12);

    // Convert type map to sorted array (by generation desc)
    const byType = Array.from(typeMap.entries())
        .map(([type, d]) => ({
            type,
            capacity: Math.round(d.capacity),
            generation: Math.round(d.generation),
            percentage: totalGeneration > 0 ? Math.round((d.generation / totalGeneration) * 1000) / 10 : 0,
        }))
        .filter(t => t.generation > 0)
        .sort((a, b) => b.generation - a.generation);

    return {
        updatedAt: String(raw.updatedAt || new Date().toISOString()),
        supplyCapacity: Math.round(totalCapacity),
        currentLoad: Math.round(totalGeneration),
        reserveCapacity: Math.round(reserve),
        reserveMargin: Math.round(reserveRate * 10) / 10,
        lightSignal: reserveRate >= 10 ? 'green' : reserveRate >= 6 ? 'yellow' : reserveRate >= 3 ? 'orange' : 'red',
        sources,
        byType,
    };
}

// ─── CWA Earthquake ───────────────────────────────────────────────────────────

export async function fetchTaiwanEarthquakes(): Promise<TaiwanEarthquake[]> {
    return earthquakeBreaker.execute(async () => {
        const apiKey = import.meta.env.VITE_CWA_API_KEY || import.meta.env.CWA_API_KEY || '';
        console.log('[Debug] fetchTaiwanEarthquakes apiKey length:', apiKey.length);
        const url = import.meta.env.DEV
            ? `/api/taiwan/data?type=earthquake&cwa_key=${apiKey}`
            : `/api/taiwan/data?type=earthquake&cwa_key=${apiKey}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();
        console.log('[Debug] CWA Edge response payload:', raw);
        if (raw.error && !raw.earthquakes?.length) throw new Error(raw.error);
        return parseCWAEarthquakes(raw.earthquakes || []);
    }, []);
}

function parseCWAEarthquakes(quakes: unknown[]): TaiwanEarthquake[] {
    return quakes.slice(0, 15).map((q: unknown) => {
        const quake = q as Record<string, unknown>;
        const info = (quake.EarthquakeInfo || {}) as Record<string, unknown>;
        const origin = (info.OriginTime || '') as string;
        const epiCenter = (info.Epicenter || {}) as Record<string, unknown>;
        const mag = (info.EarthquakeMagnitude || {}) as Record<string, unknown>;
        const si = (quake.Intensity || {}) as Record<string, unknown>;
        const shakingAreas = ((si.ShakingArea || []) as unknown[]);

        const intensityAreas: TaiwanEarthquake['intensityAreas'] = [];
        let maxIntensity = '1';
        for (const area of shakingAreas) {
            const a = area as Record<string, unknown>;
            const areaName = String(a.CountyName || a.AreaName || '');
            const intensity = String(a.AreaIntensity || a.SeismicIntensity || '1');
            if (areaName) {
                intensityAreas.push({ area: areaName, intensity });
                if (parseInt(intensity) > parseInt(maxIntensity)) maxIntensity = intensity;
            }
        }

        return {
            id: String(quake.EarthquakeNo || Math.random()),
            time: origin,
            location: String(epiCenter.Location || ''),
            magnitude: Number(mag.MagnitudeValue || 0),
            depth: Number(info.FocalDepth || 0),
            lat: Number(epiCenter.EpicenterLatitude || 0),
            lon: Number(epiCenter.EpicenterLongitude || 0),
            maxIntensity,
            intensityAreas: intensityAreas.slice(0, 5),
        };
    }).filter(eq => eq.magnitude > 0);
}

// ─── AQI ──────────────────────────────────────────────────────────────────────

export async function fetchTaiwanAQI(): Promise<AQIStation[]> {
    // Clear any stale/empty cached data so the breaker always refetches
    const existingCache = aqiBreaker.getCached();
    if (existingCache !== null && existingCache.length === 0) {
        aqiBreaker.clearCache();
    }
    return aqiBreaker.execute(async () => {
        const url = import.meta.env.DEV
            ? `/api/taiwan/data?type=aqi&_t=${Date.now()}`
            : '/api/taiwan/data?type=aqi';
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();
        if (raw.error && !raw.stations?.length) throw new Error(raw.error);
        const stations = parseAQIData(raw.stations || []);
        if (stations.length === 0) {
            throw new Error('AQI parsed 0 stations — will not cache empty result');
        }
        return stations;
    }, []);
}

function parseAQIData(stations: unknown[]): AQIStation[] {
    return stations.map((s: unknown) => {
        const st = s as Record<string, string>;
        return {
            siteName: st.sitename || st.SiteName || '',
            county: st.county || st.County || '',
            aqi: parseInt(st.aqi || st.AQI || '0'),
            status: st.status || st.Status || '',
            pm25: parseFloat(st['pm2.5'] || st.PM25 || st['PM2.5'] || '0'),
            pm10: parseFloat(st.pm10 || st.PM10 || '0'),
            o3: st.o3 || st.O3 || '',
            pollutant: st.pollutant || st.Pollutant || '',
            publishTime: st.publishtime || st.PublishTime || '',
            longitude: parseFloat(st.longitude || st.Longitude || '0'),
            latitude: parseFloat(st.latitude || st.Latitude || '0'),
        };
    }).filter(s => s.siteName && s.aqi > 0)
        .sort((a, b) => b.aqi - a.aqi);
}

// ─── WRA Reservoir ────────────────────────────────────────────────────────────

export async function fetchTaiwanReservoirs(): Promise<WRAReservoir[]> {
    // Clear any stale/empty cached data so the breaker always refetches
    const existingCache = reservoirBreaker.getCached();
    if (existingCache !== null && existingCache.length === 0) {
        reservoirBreaker.clearCache();
    }
    return reservoirBreaker.execute(async () => {
        const url = import.meta.env.DEV
            ? `/api/taiwan/data?type=reservoir&_t=${Date.now()}`
            : '/api/taiwan/data?type=reservoir';
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();
        if (raw.error && !raw.reservoirs?.length) throw new Error(raw.error);
        const reservoirs = parseReservoirData(raw.reservoirs || []);
        if (reservoirs.length === 0) {
            throw new Error('Reservoir parsed 0 entries — will not cache empty result');
        }
        return reservoirs;
    }, []);
}

function parseReservoirData(reservoirs: unknown[]): WRAReservoir[] {
    return reservoirs.map((r: unknown) => {
        const res = r as Record<string, any>;
        return {
            id: String(res.StationNo || ''),
            name: String(res.StationName || '未知測站'),
            waterHeight: Number(res.WaterHeight || 0),
            effectiveStorage: Number(res.EffectiveStorage || 0),
            percentage: Number(res.PercentageOfStorage || 0),
            time: String(res.Time || ''),
            status: Number(res.Status || -1),
        };
    }).filter(r => r.name !== '未知測站' && r.percentage > 0)
        .sort((a, b) => b.percentage - a.percentage); // Sort by percentage descending
}

// ─── Status ───────────────────────────────────────────────────────────────────

export function getTaipowerStatus(): string { return powerBreaker.getStatus(); }
export function getAQIStatus(): string { return aqiBreaker.getStatus(); }
export function getEarthquakeStatus(): string { return earthquakeBreaker.getStatus(); }
export function getReservoirStatus(): string { return reservoirBreaker.getStatus(); }

// ─── CWA Weather Types ────────────────────────────────────────────────────────

export interface CWAWeatherStation {
    stationName: string;
    city: string;
    temp: number;        // °C
    humidity: number;    // %
    windSpeed: number;   // m/s
    windDir: string;
    rain: number;        // mm (10min)
    pressure: number;    // hPa
    lat: number;
    lon: number;
    time: string;
}

export interface CWAForecastLocation {
    name: string;        // 縣市名稱
    wx: string;          // 天氣現象
    wxIcon: string;      // 天氣代碼
    minTemp: number;
    maxTemp: number;
    pop: number;         // 降雨機率 %
    ci: string;          // 舒適度
    startTime: string;
    endTime: string;
}

export interface CWATyphoonInfo {
    active: boolean;
    name?: string;
    category?: string;
    lat?: number;
    lon?: number;
    pressure?: number;
    windSpeed?: number;
    message?: string;
    updatedAt: string;
}

export interface UVStation {
    siteName: string;
    county: string;
    uvi: number;
    level: string;       // 低量級/中量級/高量級/過量級/危險級
    publishTime: string;
    lat: number;
    lon: number;
}

// ─── Weather/Forecast/Typhoon/UV Circuit Breakers ─────────────────────────────

const weatherBreaker = createCircuitBreaker<CWAWeatherStation[]>({
    name: 'CWA-Weather',
    cacheTtlMs: 10 * 60 * 1000,
    persistCache: false,
});

const forecastBreaker = createCircuitBreaker<CWAForecastLocation[]>({
    name: 'CWA-Forecast',
    cacheTtlMs: 30 * 60 * 1000,
    persistCache: true,
});

const typhoonBreaker = createCircuitBreaker<CWATyphoonInfo>({
    name: 'CWA-Typhoon',
    cacheTtlMs: 15 * 60 * 1000,
    persistCache: false,
});

const uvBreaker = createCircuitBreaker<UVStation[]>({
    name: 'MOENV-UV',
    cacheTtlMs: 30 * 60 * 1000,
    persistCache: false,
});

// ─── CWA Weather Observation ──────────────────────────────────────────────────

export async function fetchCWAWeather(): Promise<CWAWeatherStation[]> {
    return weatherBreaker.execute(async () => {
        const apiKey = import.meta.env.VITE_CWA_API_KEY || '';
        const res = await fetch(`/api/taiwan/data?type=weather&cwa_key=${apiKey}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();
        if (raw.error && !raw.stations?.length) throw new Error(raw.error);
        return parseCWAWeather(raw.stations || []);
    }, []);
}

function parseCWAWeather(stations: unknown[]): CWAWeatherStation[] {
    return stations.map((s: unknown) => {
        const st = s as Record<string, any>;
        const obs = st.WeatherElement || {};
        const geo = st.GeoInfo || {};
        return {
            stationName: String(st.StationName || ''),
            city: String(geo.CountyName || ''),
            temp: Number(obs.AirTemperature || 0),
            humidity: Number(obs.RelativeHumidity || 0),
            windSpeed: Number(obs.WindSpeed || 0),
            windDir: String(obs.WindDirection || ''),
            rain: Number(obs.Now?.Precipitation || 0),
            pressure: Number(obs.AirPressure || 0),
            lat: Number(st.StationLatitude || geo.Coordinates?.[1]?.StationLatitude || 0),
            lon: Number(st.StationLongitude || geo.Coordinates?.[1]?.StationLongitude || 0),
            time: String(st.ObsTime?.DateTime || ''),
        };
    }).filter(s => s.stationName && s.temp > -40 && s.temp !== 0 && s.humidity >= 0);
}

// ─── CWA 36-hour Forecast ─────────────────────────────────────────────────────

export async function fetchCWAForecast(): Promise<CWAForecastLocation[]> {
    return forecastBreaker.execute(async () => {
        const apiKey = import.meta.env.VITE_CWA_API_KEY || '';
        const res = await fetch(`/api/taiwan/data?type=forecast&cwa_key=${apiKey}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();
        if (raw.error && !raw.locations?.length) throw new Error(raw.error);
        return parseCWAForecast(raw.locations || []);
    }, []);
}

function parseCWAForecast(locations: unknown[]): CWAForecastLocation[] {
    return locations.map((loc: unknown) => {
        const l = loc as Record<string, any>;
        const elements = l.weatherElement || [];
        const getEl = (name: string) => elements.find((e: any) => e.elementName === name);
        const wxEl = getEl('Wx');
        const popEl = getEl('PoP');
        const minTEl = getEl('MinT');
        const maxTEl = getEl('MaxT');
        const ciEl = getEl('CI');
        const firstTime = wxEl?.time?.[0] || {};
        return {
            name: String(l.locationName || ''),
            wx: String(firstTime.parameter?.parameterName || ''),
            wxIcon: String(firstTime.parameter?.parameterValue || ''),
            minTemp: Number(minTEl?.time?.[0]?.parameter?.parameterName || 0),
            maxTemp: Number(maxTEl?.time?.[0]?.parameter?.parameterName || 0),
            pop: Number(popEl?.time?.[0]?.parameter?.parameterName || 0),
            ci: String(ciEl?.time?.[0]?.parameter?.parameterName || ''),
            startTime: String(firstTime.startTime || ''),
            endTime: String(firstTime.endTime || ''),
        };
    }).filter(l => l.name);
}

// ─── CWA Typhoon ──────────────────────────────────────────────────────────────

export async function fetchCWATyphoon(): Promise<CWATyphoonInfo> {
    const defaultInfo: CWATyphoonInfo = { active: false, updatedAt: new Date().toISOString() };
    return typhoonBreaker.execute(async () => {
        const apiKey = import.meta.env.VITE_CWA_API_KEY || '';
        const res = await fetch(`/api/taiwan/data?type=typhoon&cwa_key=${apiKey}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();
        if (raw.error) {
            // No typhoon is not an error
            return { active: false, message: '目前無颱風', updatedAt: raw.updatedAt || new Date().toISOString() };
        }
        return parseCWATyphoon(raw);
    }, defaultInfo);
}

function parseCWATyphoon(raw: Record<string, any>): CWATyphoonInfo {
    // Check if there are any typhoon warnings
    const typhoon = raw?.typhoon;
    if (!typhoon || (Array.isArray(typhoon) && typhoon.length === 0)) {
        return { active: false, message: '目前無颱風警報', updatedAt: raw.updatedAt || new Date().toISOString() };
    }
    const info = Array.isArray(typhoon) ? typhoon[0] : typhoon;
    return {
        active: true,
        name: String(info.typhoonName || info.cwaTyphoonName || ''),
        category: String(info.scale || ''),
        lat: Number(info.lat || info.latitude || 0),
        lon: Number(info.lon || info.longitude || 0),
        pressure: Number(info.pressure || 0),
        windSpeed: Number(info.windSpeed || info.maxWindSpeed || 0),
        message: String(info.contents || info.message || ''),
        updatedAt: raw.updatedAt || new Date().toISOString(),
    };
}

// ─── MOENV UV ─────────────────────────────────────────────────────────────────

export async function fetchMOENVUV(): Promise<UVStation[]> {
    return uvBreaker.execute(async () => {
        const apiKey = import.meta.env.VITE_MOENV_API_KEY || '';
        const res = await fetch(`/api/taiwan/data?type=uv&moenv_key=${apiKey}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();
        if (raw.error && !raw.stations?.length) throw new Error(raw.error);
        return parseUVData(raw.stations || []);
    }, []);
}

function parseUVData(stations: unknown[]): UVStation[] {
    return stations.map((s: unknown) => {
        const st = s as Record<string, string>;
        const uvi = parseFloat(st.uvi || st.UVI || '0');
        let level = '低量級';
        if (uvi >= 11) level = '危險級';
        else if (uvi >= 8) level = '過量級';
        else if (uvi >= 6) level = '高量級';
        else if (uvi >= 3) level = '中量級';
        return {
            siteName: st.sitename || st.SiteName || st.site || '',
            county: st.county || st.County || '',
            uvi,
            level,
            publishTime: st.publishtime || st.PublishTime || '',
            lat: parseFloat(st.wgs84lat || st.Latitude || '0'),
            lon: parseFloat(st.wgs84lon || st.Longitude || '0'),
        };
    }).filter(s => s.siteName && s.uvi >= 0)
        .sort((a, b) => b.uvi - a.uvi);
}

// ─── Taipower Outage ──────────────────────────────────────────────────────────

export interface TaipowerOutage {
    area: string;
    district: string;
    road: string;
    reason: string;
    affectedHouseholds: number;
    startTime: string;
    estimatedRecovery: string;
    status: string;
}

const outageBreaker = createCircuitBreaker<TaipowerOutage[]>({
    name: 'Taipower-Outage',
    cacheTtlMs: 5 * 60 * 1000,
    persistCache: false,
});

export async function fetchTaipowerOutage(): Promise<TaipowerOutage[]> {
    return outageBreaker.execute(async () => {
        const res = await fetch('/api/taiwan/data?type=outage');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();
        if (raw.error && !Array.isArray(raw)) throw new Error(raw.error);
        // Handle both: { outages: [...] } from edge function, or direct raw array/object from vite plugin
        const outageData = raw.outages || raw.records || (Array.isArray(raw) ? raw : raw);
        return parseOutageData(outageData);
    }, []);
}

function parseOutageData(outages: unknown): TaipowerOutage[] {
    // Taipower outage JSON can be nested arrays or objects
    const items: TaipowerOutage[] = [];
    const rawArr = Array.isArray(outages) ? outages : [];

    for (const region of rawArr) {
        if (Array.isArray(region)) {
            for (const entry of region) {
                const e = entry as Record<string, any>;
                items.push({
                    area: String(e.Area || e.county || ''),
                    district: String(e.District || e.town || ''),
                    road: String(e.Road || e.road || ''),
                    reason: String(e.Reason || e.cause || ''),
                    affectedHouseholds: Number(e.Households || e.cnt || 0),
                    startTime: String(e.OccurTime || e.startTime || ''),
                    estimatedRecovery: String(e.EstRecoverTime || e.estimatedRecoveryTime || ''),
                    status: String(e.Status || e.status || ''),
                });
            }
        } else if (region && typeof region === 'object') {
            const e = region as Record<string, any>;
            items.push({
                area: String(e.Area || e.county || ''),
                district: String(e.District || e.town || ''),
                road: String(e.Road || e.road || ''),
                reason: String(e.Reason || e.cause || ''),
                affectedHouseholds: Number(e.Households || e.cnt || 0),
                startTime: String(e.OccurTime || e.startTime || ''),
                estimatedRecovery: String(e.EstRecoverTime || e.estimatedRecoveryTime || ''),
                status: String(e.Status || e.status || ''),
            });
        }
    }

    return items.filter(i => i.area);
}

export function getOutageStatus(): string { return outageBreaker.getStatus(); }

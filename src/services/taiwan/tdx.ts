import { createCircuitBreaker } from '../../utils/circuit-breaker';

export interface TDXVehicle {
    id: string;         // Train number
    line: string;       // TRA, HSR, etc.
    type: string;       // Local Train, Tze-Chiang, etc.
    delay: number;      // Minutes late
    station: string;    // Nearest station
    direction: number;  // 0: forward, 1: reverse
    status: number;     // 0: incoming, 1: stopped, 2: departed
    lat: number;
    lon: number;
    updated: string;
}

export interface THSRTrain {
    id: string;
    direction: number;
    originStation: string;
    destStation: string;
    seatStatus: Array<{
        station: string;
        stationId: string;
        standard: string;  // 'O' = available, 'X' = full
        business: string;
    }>;
    lat: number;
    lon: number;
}

export interface TaiwanFlight {
    flightNo: string;
    airline: string;
    airport: string;       // TPE, TSA, KHH
    direction: string;     // arrival, departure
    origin: string;
    destination: string;
    scheduledTime: string;
    actualTime: string;
    estimatedTime: string;
    terminal: string;
    gate: string;
    status: string;
}

export interface HighwaySection {
    sectionId: string;
    sectionName: string;
    routeId: string;
    routeName: string;
    direction: string;
    travelTime: number;
    travelSpeed: number;
    congestionLevel: number;  // 0: free, 1: slightly congested, 2: congested, 3: heavy
}

// ─── Circuit Breakers ─────────────────────────────────────────────

const tdxBreaker = createCircuitBreaker<TDXVehicle[]>({
    name: 'tdx',
    maxFailures: 3,
    cooldownMs: 15000,
});

const thsrBreaker = createCircuitBreaker<THSRTrain[]>({
    name: 'tdx-thsr',
    maxFailures: 3,
    cooldownMs: 15000,
});

const flightBreaker = createCircuitBreaker<TaiwanFlight[]>({
    name: 'tdx-flights',
    maxFailures: 3,
    cooldownMs: 15000,
});

const highwayBreaker = createCircuitBreaker<HighwaySection[]>({
    name: 'tdx-highway',
    maxFailures: 3,
    cooldownMs: 15000,
});

// ─── Fetch Functions ──────────────────────────────────────────────

export async function fetchTRAVehicles(): Promise<TDXVehicle[]> {
    return tdxBreaker.execute(async () => {
        const res = await fetch('/api/taiwan/tdx?type=tra');
        if (!res.ok) throw new Error(`TDX HTTP error ${res.status}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        return data.vehicles || [];
    }, []);
}

export async function fetchTHSRTrains(): Promise<THSRTrain[]> {
    return thsrBreaker.execute(async () => {
        const res = await fetch('/api/taiwan/tdx?type=thsr');
        if (!res.ok) throw new Error(`TDX THSR HTTP error ${res.status}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        // If pre-parsed (edge function)
        if (data.trains && Array.isArray(data.trains)) return data.trains;

        // Parse raw TDX response
        const stationMap: Record<string, string> = data.stations || {};
        const availability: any[] = data.availability || [];
        const trains: THSRTrain[] = [];
        for (const train of availability) {
            const seats = (train.SeatStatusList || train.StopStations || []).map((s: any) => ({
                station: stationMap[s.StationID] || s.StationName?.Zh_tw || s.StationID || '—',
                stationId: s.StationID || '',
                standard: s.StandardSeatStatus || s.StandardSeat || '—',
                business: s.BusinessSeatStatus || s.BusinessSeat || '—',
            }));
            trains.push({
                id: train.TrainNo || train.TrainNumber || '',
                direction: train.Direction ?? 0,
                originStation: stationMap[train.StartingStationID] || train.StartingStationName?.Zh_tw || '—',
                destStation: stationMap[train.EndingStationID] || train.EndingStationName?.Zh_tw || '—',
                seatStatus: seats,
                lat: 0, lon: 0,
            });
        }
        return trains;
    }, []);
}

export async function fetchTaiwanFlights(): Promise<TaiwanFlight[]> {
    return flightBreaker.execute(async () => {
        const res = await fetch('/api/taiwan/tdx?type=flights');
        if (!res.ok) throw new Error(`TDX Flights HTTP error ${res.status}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        // If pre-parsed (edge function)
        if (data.flights && Array.isArray(data.flights)) return data.flights;

        // Parse raw TDX FIDS response
        // Shape: { airports: [{ airport: "TPE", data: [{ AirportID, FIDSDeparture: [...], FIDSArrival: [...] }] }] }
        const flights: TaiwanFlight[] = [];
        const airportResults = data.airports || [];
        for (const apRes of airportResults) {
            const airport = apRes.airport || '';
            const fidsArr = apRes.data;
            if (!fidsArr || !Array.isArray(fidsArr)) continue;

            for (const fids of fidsArr) {
                // Arrivals — TDX uses singular: FIDSArrival
                const arrivals = fids.FIDSArrival || fids.FIDSArrivals || [];
                for (const f of arrivals) {
                    flights.push({
                        flightNo: f.FlightNumber || '',
                        airline: f.AirlineName?.Zh_tw || f.AirlineID || '',
                        airport,
                        direction: 'arrival',
                        origin: f.DepartureAirportName?.Zh_tw || f.DepartureAirportID || '',
                        destination: airport,
                        scheduledTime: f.ScheduleArrivalTime || '',
                        actualTime: f.ActualArrivalTime || '',
                        estimatedTime: f.EstimatedArrivalTime || '',
                        terminal: f.Terminal || '',
                        gate: f.Gate || '',
                        status: f.ArrivalRemark || '',
                    });
                }
                // Departures — TDX uses singular: FIDSDeparture
                const departures = fids.FIDSDeparture || fids.FIDSDepartures || [];
                for (const f of departures) {
                    flights.push({
                        flightNo: f.FlightNumber || '',
                        airline: f.AirlineName?.Zh_tw || f.AirlineID || '',
                        airport,
                        direction: 'departure',
                        origin: airport,
                        destination: f.ArrivalAirportName?.Zh_tw || f.ArrivalAirportID || '',
                        scheduledTime: f.ScheduleDepartureTime || '',
                        actualTime: f.ActualDepartureTime || '',
                        estimatedTime: f.EstimatedDepartureTime || '',
                        terminal: f.Terminal || '',
                        gate: f.Gate || '',
                        status: f.DepartureRemark || '',
                    });
                }
            }
        }
        return flights;
    }, []);
}

export async function fetchHighwayTraffic(): Promise<HighwaySection[]> {
    return highwayBreaker.execute(async () => {
        const res = await fetch('/api/taiwan/tdx?type=highway');
        if (!res.ok) throw new Error(`TDX Highway HTTP error ${res.status}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        // If pre-parsed (edge function)
        if (data.sections && Array.isArray(data.sections) && data.sections.length > 0 && data.sections[0].sectionId) {
            return data.sections;
        }

        // Parse raw TDX response — flat sections, no nested flows
        // Shape: { sections: [{ SectionID, TravelTime, TravelSpeed, CongestionLevel, ... }] }
        const raw = data.sections || [];
        const sections: HighwaySection[] = [];
        for (const s of (Array.isArray(raw) ? raw : [])) {
            const speed = s.TravelSpeed ?? 0;
            const congStr = String(s.CongestionLevel || '0');
            let congestion = parseInt(congStr, 10);
            if (isNaN(congestion)) congestion = 0;

            sections.push({
                sectionId: s.SectionID || '',
                sectionName: s.SectionName || '',
                routeId: s.RouteID || '',
                routeName: s.RouteName?.Zh_tw || s.RouteID || '',
                direction: s.RoadDirection || '',
                travelTime: s.TravelTime ?? 0,
                travelSpeed: speed,
                congestionLevel: s.Level ?? congestion,
            });
        }
        if (sections.length === 0) {
            throw new Error('TDX Highway returned 0 sections');
        }
        return sections;
    }, []);
}


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

const tdxBreaker = createCircuitBreaker<TDXVehicle[]>({
    name: 'tdx',
    maxFailures: 3,
    cooldownMs: 15000,
});

export async function fetchTRAVehicles(): Promise<TDXVehicle[]> {
    return tdxBreaker.execute(async () => {
        const url = import.meta.env.DEV ? '/api/taiwan/tdx?type=tra' : '/api/taiwan/tdx?type=tra';
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`TDX HTTP error ${res.status}`);
        }
        const data = await res.json();
        if (data.error) {
            throw new Error(data.error);
        }
        return data.vehicles || [];
    }, []);
}

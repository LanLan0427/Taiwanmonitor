import { ScatterplotLayer } from '@deck.gl/layers';
import type { TDXVehicle } from '../../services/taiwan/tdx';

export function createTDXTrafficLayer(data: TDXVehicle[], visible: boolean) {
    return new ScatterplotLayer<TDXVehicle>({
        id: 'taiwan-tra-layer',
        data,
        visible,
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 100],
        getPosition: d => [d.lon, d.lat],
        getRadius: 4000,
        radiusMinPixels: 8,
        radiusMaxPixels: 18,
        getFillColor: d => d.delay > 5 ? [239, 68, 68, 220] : [59, 130, 246, 220],
        getLineColor: [255, 255, 255, 255],
        lineWidthMinPixels: 1.5,
        updateTriggers: {
            getFillColor: [data]
        }
    });
}

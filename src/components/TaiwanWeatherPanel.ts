/**
 * TaiwanWeatherPanel - 天氣觀測 / 預報 / 颱風
 */
import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';
import type { CWAWeatherStation, CWAForecastLocation, CWATyphoonInfo } from '@/services/taiwan';

type SubTab = 'weather' | 'forecast' | 'typhoon';
type WeatherSort = 'temp' | 'rain' | 'name';

export class TaiwanWeatherPanel extends Panel {
    private stations: CWAWeatherStation[] = [];
    private forecast: CWAForecastLocation[] = [];
    private typhoon: CWATyphoonInfo | null = null;
    private activeTab: SubTab = 'weather';
    private weatherSort: WeatherSort = 'temp';
    private lastUpdate: Date | null = null;

    constructor() {
        super({ id: 'taiwan-weather', title: '☀️ 天氣 / 🌀 颱風' });
        this.content.addEventListener('click', (e) => {
            const tab = (e.target as HTMLElement).closest('.taiwan-tab') as HTMLElement | null;
            if (tab?.dataset.tab) {
                this.activeTab = tab.dataset.tab as SubTab;
                this.render();
            }
        });
        this.content.addEventListener('change', (e) => {
            const sel = e.target as HTMLSelectElement;
            if (sel?.id === 'weather-sort-select') {
                this.weatherSort = sel.value as WeatherSort;
                this.render();
            }
        });
    }

    public updateWeather(data: CWAWeatherStation[]): void {
        this.stations = data;
        this.lastUpdate = new Date();
        this.render();
    }

    public updateForecast(data: CWAForecastLocation[]): void {
        this.forecast = data;
        this.lastUpdate = new Date();
        this.render();
    }

    public updateTyphoon(data: CWATyphoonInfo): void {
        this.typhoon = data;
        this.lastUpdate = new Date();
        this.render();
    }

    private selectStyle = 'background:rgba(255,255,255,0.08);color:var(--text-primary);border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:4px 8px;font-size:12px;cursor:pointer;outline:none;';

    private render(): void {
        const tabsHtml = `
      <div class="economic-tabs">
        <button class="economic-tab taiwan-tab ${this.activeTab === 'weather' ? 'active' : ''}" data-tab="weather">🌡️ 即時天氣</button>
        <button class="economic-tab taiwan-tab ${this.activeTab === 'forecast' ? 'active' : ''}" data-tab="forecast">🌦️ 預報</button>
        <button class="economic-tab taiwan-tab ${this.activeTab === 'typhoon' ? 'active' : ''}" data-tab="typhoon">
          🌀 颱風${this.typhoon?.active ? ' ⚠️' : ''}
        </button>
      </div>`;
        let contentHtml: string;
        let sourceLabel: string;
        switch (this.activeTab) {
            case 'weather': contentHtml = this.renderWeather(); sourceLabel = '中央氣象署 CWA'; break;
            case 'forecast': contentHtml = this.renderForecast(); sourceLabel = '中央氣象署 CWA'; break;
            case 'typhoon': contentHtml = this.renderTyphoon(); sourceLabel = '中央氣象署 CWA'; break;
        }
        const updateTime = this.lastUpdate?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '';
        this.setContent(`
      ${tabsHtml}
      <div class="economic-content">${contentHtml}</div>
      <div class="economic-footer">
        <span class="economic-source">${sourceLabel} • ${updateTime}</span>
      </div>
    `);
    }

    private renderWeather(): string {
        if (this.stations.length === 0) return '<div class="economic-empty">天氣觀測資料載入中...</div>';

        let sorted = [...this.stations];
        switch (this.weatherSort) {
            case 'temp': sorted.sort((a, b) => b.temp - a.temp); break;
            case 'rain': sorted.sort((a, b) => b.rain - a.rain); break;
            case 'name': sorted.sort((a, b) => a.city.localeCompare(b.city)); break;
        }

        const maxTemp = Math.max(...this.stations.map(s => s.temp));
        const minTemp = Math.min(...this.stations.map(s => s.temp));
        const avgTemp = (this.stations.reduce((s, st) => s + st.temp, 0) / this.stations.length).toFixed(1);

        return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:12px;">
        <span>🌡️ ${minTemp.toFixed(1)}° ~ ${maxTemp.toFixed(1)}° (平均 ${avgTemp}°)</span>
        <span style="color:var(--text-dim);">${this.stations.length} 站</span>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <select id="weather-sort-select" style="${this.selectStyle}">
          <option value="temp" ${this.weatherSort === 'temp' ? 'selected' : ''}>🌡️ 依溫度排序</option>
          <option value="rain" ${this.weatherSort === 'rain' ? 'selected' : ''}>🌧️ 依雨量排序</option>
          <option value="name" ${this.weatherSort === 'name' ? 'selected' : ''}>📍 依地區排序</option>
        </select>
      </div>
      <div style="max-height:280px;overflow-y:auto;">
        ${sorted.slice(0, 25).map(s => {
            const tempColor = s.temp >= 35 ? '#ff1744' : s.temp >= 30 ? '#ff9100' : s.temp >= 20 ? '#ffd600' : s.temp >= 10 ? '#4fc3f7' : '#2196f3';
            return `
            <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
              <span style="font-size:16px;font-weight:700;color:${tempColor};min-width:45px;text-align:right;">${s.temp.toFixed(1)}°</span>
              <div style="flex:1;min-width:0;">
                <div style="font-size:12px;font-weight:500;">${escapeHtml(s.stationName)}</div>
                <div style="font-size:10px;color:var(--text-dim);">${escapeHtml(s.city)} · 💧${s.humidity}% · 💨${s.windSpeed}m/s ${escapeHtml(s.windDir)}</div>
              </div>
              ${s.rain > 0 ? `<span style="font-size:11px;color:#4fc3f7;font-weight:600;">🌧${s.rain}mm</span>` : ''}
            </div>`;
        }).join('')}
        ${sorted.length > 25 ? `<div style="font-size:11px;color:var(--text-dim);padding:6px 0;text-align:center;">...還有 ${sorted.length - 25} 站</div>` : ''}
      </div>
    `;
    }

    private renderForecast(): string {
        if (this.forecast.length === 0) return '<div class="economic-empty">天氣預報資料載入中...</div>';

        return `
      <div style="font-size:11px;color:var(--text-dim);margin-bottom:8px;">
        36小時天氣預報 · ${this.forecast[0]?.startTime?.substring(0, 16) || ''} ~ ${this.forecast[0]?.endTime?.substring(0, 16) || ''}
      </div>
      <div style="max-height:320px;overflow-y:auto;">
        ${this.forecast.map(loc => {
            const popColor = loc.pop >= 70 ? '#4fc3f7' : loc.pop >= 30 ? '#ffd600' : '#4caf50';
            return `
            <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
              <div style="min-width:55px;">
                <div style="font-size:13px;font-weight:600;">${escapeHtml(loc.name)}</div>
              </div>
              <div style="flex:1;font-size:12px;color:var(--text-secondary);">${escapeHtml(loc.wx)}</div>
              <div style="text-align:right;">
                <div style="font-size:12px;font-weight:500;">${loc.minTemp}° ~ ${loc.maxTemp}°</div>
                <div style="font-size:10px;color:${popColor};">☔ ${loc.pop}%</div>
              </div>
            </div>`;
        }).join('')}
      </div>
    `;
    }

    private renderTyphoon(): string {
        if (!this.typhoon) return '<div class="economic-empty">颱風資料載入中...</div>';
        if (!this.typhoon.active) {
            return `
        <div style="text-align:center;padding:30px 10px;">
          <div style="font-size:48px;margin-bottom:12px;">☀️</div>
          <div style="font-size:14px;font-weight:500;margin-bottom:6px;">目前無颱風警報</div>
          <div style="font-size:12px;color:var(--text-dim);">太平洋地區目前沒有影響台灣的颱風</div>
        </div>`;
        }
        const t = this.typhoon;
        return `
      <div style="background:rgba(255,0,0,0.08);border:1px solid rgba(255,0,0,0.2);border-radius:8px;padding:12px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-size:16px;font-weight:700;color:#ff1744;">🌀 ${escapeHtml(t.name || '颱風')}</span>
          <span style="font-size:12px;color:var(--text-dim);">${escapeHtml(t.category || '')}</span>
        </div>
        ${t.windSpeed ? `<div style="font-size:12px;margin-bottom:4px;">💨 最大風速: ${t.windSpeed} m/s</div>` : ''}
        ${t.pressure ? `<div style="font-size:12px;margin-bottom:4px;">🌡️ 中心氣壓: ${t.pressure} hPa</div>` : ''}
        ${t.lat && t.lon ? `<div style="font-size:12px;margin-bottom:4px;">📍 位置: ${t.lat.toFixed(1)}°N ${t.lon.toFixed(1)}°E</div>` : ''}
      </div>
      ${t.message ? `<div style="font-size:12px;color:var(--text-secondary);line-height:1.6;max-height:200px;overflow-y:auto;">${escapeHtml(t.message)}</div>` : ''}
    `;
    }
}

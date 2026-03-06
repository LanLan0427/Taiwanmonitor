/**
 * TaiwanEnvPanel - 空品＋水情資訊
 */
import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';
import type { AQIStation, WRAReservoir, UVStation } from '@/services/taiwan';

type SubTab = 'aqi' | 'reservoir' | 'uv';
type AqiView = 'all' | 'good' | 'moderate' | 'unhealthy';
type ResView = 'major' | 'all' | 'low';

export class TaiwanEnvPanel extends Panel {
  private aqiStations: AQIStation[] = [];
  private reservoirs: WRAReservoir[] = [];
  private uvStations: UVStation[] = [];
  private aqiLoaded = false;
  private resLoaded = false;
  private uvLoaded = false;
  private activeTab: SubTab = 'aqi';
  private aqiView: AqiView = 'all';
  private resView: ResView = 'major';
  private lastUpdate: Date | null = null;

  constructor() {
    super({ id: 'taiwan-env', title: '🌡️ 空品 / 💧 水情' });
    this.content.addEventListener('click', (e) => {
      const tab = (e.target as HTMLElement).closest('.taiwan-tab') as HTMLElement | null;
      if (tab?.dataset.tab) {
        this.activeTab = tab.dataset.tab as SubTab;
        this.render();
      }
    });
    this.content.addEventListener('change', (e) => {
      const sel = e.target as HTMLSelectElement;
      if (sel?.id === 'aqi-view-select') {
        this.aqiView = sel.value as AqiView;
        this.render();
      } else if (sel?.id === 'res-view-select') {
        this.resView = sel.value as ResView;
        this.render();
      }
    });
  }

  public updateAQI(data: AQIStation[]): void {
    this.aqiStations = data;
    this.aqiLoaded = true;
    this.lastUpdate = new Date();
    this.render();
  }

  public updateReservoirs(data: WRAReservoir[]): void {
    this.reservoirs = data;
    this.resLoaded = true;
    this.lastUpdate = new Date();
    this.render();
  }

  public updateUV(data: UVStation[]): void {
    this.uvStations = data;
    this.uvLoaded = true;
    this.lastUpdate = new Date();
    this.render();
  }

  private selectStyle = 'background:rgba(255,255,255,0.08);color:var(--text-primary);border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:4px 8px;font-size:12px;cursor:pointer;outline:none;';

  private render(): void {
    const tabsHtml = `
      <div class="economic-tabs">
        <button class="economic-tab taiwan-tab ${this.activeTab === 'aqi' ? 'active' : ''}" data-tab="aqi">
          🌡️ 空品
        </button>
        <button class="economic-tab taiwan-tab ${this.activeTab === 'reservoir' ? 'active' : ''}" data-tab="reservoir">
          💧 水情
        </button>
        <button class="economic-tab taiwan-tab ${this.activeTab === 'uv' ? 'active' : ''}" data-tab="uv">
          ☀️ 紫外線
        </button>
      </div>
    `;
    let contentHtml: string;
    let sourceLabel: string;
    switch (this.activeTab) {
      case 'aqi': contentHtml = this.renderAQI(); sourceLabel = '環境部 MOENV'; break;
      case 'reservoir': contentHtml = this.renderReservoirs(); sourceLabel = '經濟部水利署 WRA'; break;
      case 'uv': contentHtml = this.renderUV(); sourceLabel = '環境部 MOENV'; break;
    }
    const updateTime = this.lastUpdate
      ? this.lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    this.setContent(`
      ${tabsHtml}
      <div class="economic-content">${contentHtml}</div>
      <div class="economic-footer">
        <span class="economic-source">${sourceLabel} • ${updateTime}</span>
      </div>
    `);
  }

  private getAQIColor(aqi: number): string {
    if (aqi <= 50) return '#4caf50';
    if (aqi <= 100) return '#ffc107';
    if (aqi <= 150) return '#ff9800';
    if (aqi <= 200) return '#f44336';
    return '#9c27b0';
  }

  private getAQILabel(aqi: number): string {
    if (aqi <= 50) return '良好';
    if (aqi <= 100) return '普通';
    if (aqi <= 150) return '對敏感族群不健康';
    if (aqi <= 200) return '不健康';
    return '危害';
  }

  private renderAQI(): string {
    if (!this.aqiLoaded) return '<div class="economic-empty">空氣品質資料載入中...</div>';
    if (this.aqiStations.length === 0) return '<div class="economic-empty">目前無法取得空氣品質資料 (API 限定)</div>';

    let filtered = [...this.aqiStations];
    switch (this.aqiView) {
      case 'good': filtered = filtered.filter(s => s.aqi <= 50); break;
      case 'moderate': filtered = filtered.filter(s => s.aqi > 50 && s.aqi <= 100); break;
      case 'unhealthy': filtered = filtered.filter(s => s.aqi > 100); break;
    }
    // Sort: worst AQI first for unhealthy, best first for good
    if (this.aqiView === 'unhealthy') {
      filtered.sort((a, b) => b.aqi - a.aqi);
    } else {
      filtered.sort((a, b) => a.aqi - b.aqi);
    }

    // Summary stats
    const good = this.aqiStations.filter(s => s.aqi <= 50).length;
    const moderate = this.aqiStations.filter(s => s.aqi > 50 && s.aqi <= 100).length;
    const bad = this.aqiStations.filter(s => s.aqi > 100).length;

    return `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <select id="aqi-view-select" style="${this.selectStyle}">
          <option value="all" ${this.aqiView === 'all' ? 'selected' : ''}>📋 全部測站 (${this.aqiStations.length})</option>
          <option value="good" ${this.aqiView === 'good' ? 'selected' : ''}>🟢 良好 (${good})</option>
          <option value="moderate" ${this.aqiView === 'moderate' ? 'selected' : ''}>🟡 普通 (${moderate})</option>
          <option value="unhealthy" ${this.aqiView === 'unhealthy' ? 'selected' : ''}>🔴 不健康 (${bad})</option>
        </select>
        <span style="font-size:11px;color:var(--text-dim);">${filtered.length} 站</span>
      </div>
      ${filtered.length === 0 ? '<div class="economic-empty">無符合條件的測站</div>' : `
        <div style="max-height:320px;overflow-y:auto;">
          ${filtered.slice(0, 20).map(s => {
      const color = this.getAQIColor(s.aqi);
      return `
              <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                <div style="min-width:36px;text-align:center;font-weight:700;font-size:14px;color:${color};">${s.aqi}</div>
                <div style="flex:1;min-width:0;">
                  <div style="font-size:13px;font-weight:500;">${escapeHtml(s.siteName)}</div>
                  <div style="font-size:11px;color:var(--text-dim);">${escapeHtml(s.county)} · PM2.5: ${s.pm25}</div>
                </div>
                <div style="font-size:11px;color:${color};font-weight:600;">${this.getAQILabel(s.aqi)}</div>
              </div>`;
    }).join('')}
          ${filtered.length > 20 ? `<div style="font-size:11px;color:var(--text-dim);padding:6px 0;text-align:center;">...還有 ${filtered.length - 20} 站</div>` : ''}
        </div>`}
    `;
  }

  private renderReservoirs(): string {
    if (!this.resLoaded) return '<div class="economic-empty">水庫水情資料載入中...</div>';
    if (this.reservoirs.length === 0) return '<div class="economic-empty">目前無法取得水情資料</div>';

    const majorNames = ['石門水庫', '翡翠水庫', '曾文水庫', '德基水庫', '日月潭水庫', '鯉魚潭水庫', '烏山頭水庫', '寶山第二水庫', '牡丹水庫'];
    let list: WRAReservoir[];
    switch (this.resView) {
      case 'major':
        list = this.reservoirs.filter(r => majorNames.includes(r.name));
        break;
      case 'low':
        list = [...this.reservoirs].filter(r => r.percentage < 50).sort((a, b) => a.percentage - b.percentage);
        break;
      default:
        list = [...this.reservoirs].sort((a, b) => b.percentage - a.percentage);
    }

    // Summary
    const lowCount = this.reservoirs.filter(r => r.percentage < 30).length;
    const avgPct = this.reservoirs.length > 0
      ? (this.reservoirs.reduce((sum, r) => sum + r.percentage, 0) / this.reservoirs.length).toFixed(1)
      : '0';

    return `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <select id="res-view-select" style="${this.selectStyle}">
          <option value="major" ${this.resView === 'major' ? 'selected' : ''}>⭐ 主要水庫 (${majorNames.length})</option>
          <option value="all" ${this.resView === 'all' ? 'selected' : ''}>📋 全部水庫 (${this.reservoirs.length})</option>
          <option value="low" ${this.resView === 'low' ? 'selected' : ''}>⚠️ 蓄水率 < 50%</option>
        </select>
        <span style="font-size:11px;color:var(--text-dim);">平均 ${avgPct}%${lowCount > 0 ? ` · ${lowCount} 座偏低` : ''}</span>
      </div>
      ${list.length === 0 ? '<div class="economic-empty">無符合條件的水庫</div>' : `
        <div style="max-height:350px;overflow-y:auto;">
          ${list.slice(0, 15).map(r => {
      const pct = r.percentage;
      const barColor = pct < 20 ? '#ff1744' : pct < 40 ? '#ff9100' : pct < 60 ? '#ffd600' : '#00b0ff';
      const effStorage = r.effectiveStorage < 10000
        ? r.effectiveStorage.toFixed(1) + ' 萬'
        : (r.effectiveStorage / 10000).toFixed(2) + ' 億';
      return `
              <div style="margin-bottom:12px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:13px;">
                  <span style="font-weight:500">${escapeHtml(r.name)}</span>
                  <span style="color:${barColor};font-weight:bold;">${pct.toFixed(1)}%</span>
                </div>
                <div style="background:rgba(255,255,255,0.05);border-radius:4px;overflow:hidden;height:16px;position:relative;">
                  <div style="position:absolute;left:0;top:0;height:100%;width:${pct}%;background:${barColor};transition:width 0.5s;"></div>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-dim);margin-top:4px;">
                  <span>有效蓄水量: ${effStorage} m³</span>
                  <span>水位: ${r.waterHeight.toFixed(2)} m</span>
                </div>
              </div>`;
    }).join('')}
          ${list.length > 15 ? `<div style="font-size:11px;color:var(--text-dim);padding:4px 0;text-align:center;">...還有 ${list.length - 15} 座水庫</div>` : ''}
        </div>`}
    `;
  }

  private getUVColor(uvi: number): string {
    if (uvi >= 11) return '#9c27b0';
    if (uvi >= 8) return '#f44336';
    if (uvi >= 6) return '#ff9800';
    if (uvi >= 3) return '#ffc107';
    return '#4caf50';
  }

  private renderUV(): string {
    if (!this.uvLoaded) return '<div class="economic-empty">紫外線資料載入中...</div>';
    if (this.uvStations.length === 0) return '<div class="economic-empty">目前無法取得紫外線資料</div>';

    const maxUV = Math.max(...this.uvStations.map(s => s.uvi));
    const avgUV = (this.uvStations.reduce((s, st) => s + st.uvi, 0) / this.uvStations.length).toFixed(1);

    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:12px;">
        <span>☀️ 最高 UVI: <strong style="color:${this.getUVColor(maxUV)}">${maxUV.toFixed(1)}</strong> · 平均: ${avgUV}</span>
        <span style="color:var(--text-dim);">${this.uvStations.length} 站</span>
      </div>
      <div style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap;font-size:10px;">
        <span style="padding:2px 6px;border-radius:10px;background:#4caf50;color:white;">0-2 低量</span>
        <span style="padding:2px 6px;border-radius:10px;background:#ffc107;color:black;">3-5 中量</span>
        <span style="padding:2px 6px;border-radius:10px;background:#ff9800;color:white;">6-7 高量</span>
        <span style="padding:2px 6px;border-radius:10px;background:#f44336;color:white;">8-10 過量</span>
        <span style="padding:2px 6px;border-radius:10px;background:#9c27b0;color:white;">11+ 危險</span>
      </div>
      <div style="max-height:280px;overflow-y:auto;">
        ${this.uvStations.slice(0, 20).map(s => {
      const color = this.getUVColor(s.uvi);
      return `
            <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
              <div style="min-width:36px;text-align:center;font-weight:700;font-size:14px;color:${color};">${s.uvi.toFixed(1)}</div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:13px;font-weight:500;">${escapeHtml(s.siteName)}</div>
                <div style="font-size:11px;color:var(--text-dim);">${escapeHtml(s.county)}</div>
              </div>
              <div style="font-size:11px;color:${color};font-weight:600;">${escapeHtml(s.level)}</div>
            </div>`;
    }).join('')}
        ${this.uvStations.length > 20 ? `<div style="font-size:11px;color:var(--text-dim);padding:6px 0;text-align:center;">...還有 ${this.uvStations.length - 20} 站</div>` : ''}
      </div>
    `;
  }
}

/**
 * TaiwanPowerEqPanel - 供電＋地震資訊
 */
import { Panel } from './Panel';
import { t } from '@/services/i18n';
import { escapeHtml } from '@/utils/sanitize';
import type { TaipowerSupply, TaiwanEarthquake } from '@/services/taiwan';

type SubTab = 'power' | 'earthquake';
type PowerView = 'type' | 'plant';
type EqFilter = 'all' | 'm4' | 'm5';

export class TaiwanPowerEqPanel extends Panel {
  private powerData: TaipowerSupply | null = null;
  private earthquakes: TaiwanEarthquake[] = [];
  private activeTab: SubTab = 'power';
  private powerView: PowerView = 'type';
  private eqFilter: EqFilter = 'all';
  private lastUpdate: Date | null = null;

  constructor() {
    super({ id: 'taiwan-power-eq', title: '⚡ 供電 / 🌏 地震' });
    this.content.addEventListener('click', (e) => {
      const tab = (e.target as HTMLElement).closest('.taiwan-tab') as HTMLElement | null;
      if (tab?.dataset.tab) {
        this.activeTab = tab.dataset.tab as SubTab;
        this.render();
      }
    });
    this.content.addEventListener('change', (e) => {
      const sel = e.target as HTMLSelectElement;
      if (sel?.id === 'power-view-select') {
        this.powerView = sel.value as PowerView;
        this.render();
      } else if (sel?.id === 'eq-filter-select') {
        this.eqFilter = sel.value as EqFilter;
        this.render();
      }
    });
  }

  public updatePower(data: TaipowerSupply): void {
    this.powerData = data;
    this.lastUpdate = new Date();
    this.render();
  }

  public updateEarthquakes(data: TaiwanEarthquake[]): void {
    this.earthquakes = data;
    this.lastUpdate = new Date();
    this.render();
  }

  private render(): void {
    const tabsHtml = `
      <div class="economic-tabs">
        <button class="economic-tab taiwan-tab ${this.activeTab === 'power' ? 'active' : ''}" data-tab="power">
          ⚡ ${t('panels.taiwanPower') || '供電'}
        </button>
        <button class="economic-tab taiwan-tab ${this.activeTab === 'earthquake' ? 'active' : ''}" data-tab="earthquake">
          🌏 ${t('panels.taiwanEarthquake') || '地震'}
        </button>
      </div>
    `;
    const contentHtml = this.activeTab === 'power' ? this.renderPower() : this.renderEarthquakes();
    const sourceLabel = this.activeTab === 'power' ? '台灣電力公司' : '中央氣象署 CWA';
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

  private selectStyle = 'background:rgba(255,255,255,0.08);color:var(--text-primary);border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:4px 8px;font-size:12px;cursor:pointer;outline:none;';

  private renderPower(): string {
    if (!this.powerData) return '<div class="economic-empty">供電資料載入中...</div>';
    const d = this.powerData;
    const sc: Record<string, string> = { green: '#4caf50', yellow: '#ffeb3b', orange: '#ff9800', red: '#f44336' };
    const sl: Record<string, string> = { green: '供電充裕', yellow: '供電吃緊', orange: '供電警戒', red: '限電警戒' };
    const sigColor = sc[d.lightSignal] || '#888';
    const sigLabel = sl[d.lightSignal] || d.lightSignal;
    const detail = this.powerView === 'type' ? this.renderEnergyTypes(d) : this.renderPlants(d);
    return `
      <div style="margin-bottom:10px;">
        <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${sigColor};margin-right:6px;vertical-align:middle;"></span>
        <strong style="color:${sigColor}">${escapeHtml(sigLabel)}</strong>
        <span style="color:var(--text-dim);font-size:12px;margin-left:6px;">備轉容量率 ${d.reserveMargin.toFixed(1)}% (${d.reserveCapacity.toFixed(0)} MW)</span>
      </div>
      <div style="background:rgba(255,255,255,0.05);border-radius:4px;overflow:hidden;height:20px;position:relative;margin-bottom:10px;">
        <div style="position:absolute;left:0;top:0;height:100%;width:${Math.min(100, (d.currentLoad / d.supplyCapacity) * 100)}%;background:linear-gradient(90deg,#4caf50 0%,#ffc107 80%,#f44336 100%);transition:width 0.5s;"></div>
        <div style="position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:white;text-shadow:0 1px 2px rgba(0,0,0,0.6);">
          ${(d.currentLoad / 1000).toFixed(1)} GW / ${(d.supplyCapacity / 1000).toFixed(1)} GW
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <select id="power-view-select" style="${this.selectStyle}">
          <option value="type" ${this.powerView === 'type' ? 'selected' : ''}>📊 能源結構</option>
          <option value="plant" ${this.powerView === 'plant' ? 'selected' : ''}>🏭 主要電廠</option>
        </select>
        <span style="font-size:11px;color:var(--text-dim);">${this.powerView === 'type' ? d.byType.length + ' 類' : d.sources.length + ' 座'}</span>
      </div>
      ${detail}
    `;
  }

  private renderEnergyTypes(d: TaipowerSupply): string {
    if (d.byType.length === 0) return '';
    const tc: Record<string, string> = {
      '燃氣': '#ff9800', '燃煤': '#795548', '核能': '#e91e63', '風力': '#4fc3f7',
      '太陽能': '#ffd600', '水力': '#2196f3', '燃油': '#9e9e9e', '地熱': '#ff5722',
      '抽蓄發電': '#7c4dff', '民營電廠-Loss': '#616161', '汽電共生': '#8bc34a',
    };
    const c = (t: string) => tc[t] || '#78909c';
    return `<div style="max-height:250px;overflow-y:auto;">
      ${d.byType.map(t => `
        <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
          <div style="width:10px;height:10px;border-radius:50%;background:${c(t.type)};flex-shrink:0;"></div>
          <span style="flex:1;font-size:12px;color:var(--text-secondary);">${escapeHtml(t.type)}</span>
          <div style="width:80px;height:8px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden;flex-shrink:0;">
            <div style="height:100%;width:${t.percentage}%;background:${c(t.type)};border-radius:4px;"></div>
          </div>
          <span style="font-size:11px;font-weight:600;min-width:50px;text-align:right;">${t.generation} MW</span>
          <span style="font-size:11px;color:var(--text-dim);min-width:35px;text-align:right;">${t.percentage}%</span>
        </div>`).join('')}
    </div>`;
  }

  private renderPlants(d: TaipowerSupply): string {
    if (d.sources.length === 0) return '';
    return `<div style="max-height:250px;overflow-y:auto;">
      ${d.sources.map((s, i) => `
        <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
          <span style="font-size:11px;color:var(--text-dim);min-width:18px;text-align:right;">${i + 1}</span>
          <span style="flex:1;font-size:12px;color:var(--text-secondary);">${escapeHtml(s.name)}</span>
          <div style="width:60px;height:8px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden;flex-shrink:0;">
            <div style="height:100%;width:${Math.min(100, s.percentage * 3)}%;background:#4fc3f7;border-radius:4px;"></div>
          </div>
          <span style="font-size:11px;font-weight:600;min-width:55px;text-align:right;">${s.generation} MW</span>
          <span style="font-size:11px;color:var(--text-dim);min-width:35px;text-align:right;">${s.percentage}%</span>
        </div>`).join('')}
    </div>`;
  }

  private renderEarthquakes(): string {
    if (this.earthquakes.length === 0) return '<div class="economic-empty">暫無地震報告</div>';
    const minMag = this.eqFilter === 'm5' ? 5 : this.eqFilter === 'm4' ? 4 : 0;
    const filtered = this.earthquakes.filter(eq => eq.magnitude >= minMag);
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <select id="eq-filter-select" style="${this.selectStyle}">
          <option value="all" ${this.eqFilter === 'all' ? 'selected' : ''}>📋 全部地震</option>
          <option value="m4" ${this.eqFilter === 'm4' ? 'selected' : ''}>⚠️ 規模 ≥ 4.0</option>
          <option value="m5" ${this.eqFilter === 'm5' ? 'selected' : ''}>🚨 規模 ≥ 5.0</option>
        </select>
        <span style="font-size:11px;color:var(--text-dim);">${filtered.length} 筆</span>
      </div>
      ${filtered.length === 0 ? '<div class="economic-empty">無符合條件的地震</div>' : `
        <div style="max-height:300px;overflow-y:auto;">
          ${filtered.slice(0, 10).map(eq => {
      const mc = eq.magnitude >= 5 ? '#ff1744' : eq.magnitude >= 4 ? '#ff9100' : '#ffd600';
      return `
              <div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                  <span style="font-weight:600;font-size:18px;color:${mc};">M ${eq.magnitude.toFixed(1)}</span>
                  <span style="font-size:11px;color:var(--text-dim);">${escapeHtml(eq.time)}</span>
                </div>
                <div style="font-size:12px;color:var(--text-secondary);margin-bottom:2px;">${escapeHtml(eq.location)}</div>
                <div style="font-size:11px;color:var(--text-dim);">深度 ${eq.depth} km · 最大震度 ${escapeHtml(eq.maxIntensity)}</div>
              </div>`;
    }).join('')}
        </div>`}
    `;
  }
}

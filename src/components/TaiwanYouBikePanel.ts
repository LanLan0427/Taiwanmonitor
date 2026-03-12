/**
 * TaiwanYouBikePanel - YouBike 站點即時車輛數
 */
import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';
import type { YouBikeStation } from '@/services/taiwan/tdx';

type BikeCity = 'all' | 'Taipei' | 'NewTaipei' | 'Taoyuan' | 'Taichung' | 'Kaohsiung';

const CITY_NAMES: Record<string, string> = {
  Taipei: '台北',
  NewTaipei: '新北',
  Taoyuan: '桃園',
  Taichung: '台中',
  Kaohsiung: '高雄',
};

export class TaiwanYouBikePanel extends Panel {
  private stations: YouBikeStation[] = [];
  private loaded = false;
  private city: BikeCity = 'all';
  private lastUpdate: Date | null = null;

  constructor() {
    super({ id: 'taiwan-youbike', title: '🚲 YouBike 站點' });
    this.content.addEventListener('change', (e) => {
      const sel = e.target as HTMLSelectElement;
      if (sel?.id === 'bike-city-select') {
        this.city = sel.value as BikeCity;
        this.render();
      }
    });
  }

  public updateStations(data: YouBikeStation[]): void {
    this.stations = data;
    this.loaded = true;
    this.lastUpdate = new Date();
    this.render();
  }

  private selectStyle = 'background:rgba(255,255,255,0.08);color:var(--text-primary);border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:4px 8px;font-size:12px;cursor:pointer;outline:none;';

  private render(): void {
    const updateTime = this.lastUpdate
      ? this.lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';
    this.setContent(`
      <div class="economic-content">${this.renderStations()}</div>
      <div class="economic-footer">
        <span class="economic-source">TDX YouBike • ${updateTime}</span>
      </div>
    `);
  }

  private getAvailabilityColor(rent: number, capacity: number): string {
    if (capacity === 0) return '#888';
    const ratio = rent / capacity;
    if (ratio >= 0.5) return '#4caf50';
    if (ratio >= 0.2) return '#ffc107';
    if (ratio > 0) return '#ff9800';
    return '#ff1744';
  }

  private renderStations(): string {
    if (!this.loaded) return '<div class="economic-empty">YouBike 資料載入中...</div>';
    if (this.stations.length === 0) return '<div class="economic-empty">目前無法取得 YouBike 資料</div>';

    let filtered = [...this.stations];
    if (this.city !== 'all') filtered = filtered.filter(s => s.city === this.city);

    // Sort by availability (lowest first to highlight shortage)
    filtered.sort((a, b) => a.availableRent - b.availableRent);

    // City counts
    const cityCounts: Record<string, number> = {};
    for (const s of this.stations) {
      cityCounts[s.city] = (cityCounts[s.city] || 0) + 1;
    }

    // Summary
    const totalRent = filtered.reduce((s, st) => s + st.availableRent, 0);
    const totalReturn = filtered.reduce((s, st) => s + st.availableReturn, 0);
    const emptyCount = filtered.filter(s => s.availableRent === 0).length;

    return `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <select id="bike-city-select" style="${this.selectStyle}">
          <option value="all" ${this.city === 'all' ? 'selected' : ''}>📋 所有城市 (${this.stations.length})</option>
          ${Object.entries(CITY_NAMES).map(([k, v]) =>
      `<option value="${k}" ${this.city === k ? 'selected' : ''}>${v} (${cityCounts[k] || 0})</option>`
    ).join('')}
        </select>
      </div>

      <div style="display:flex;gap:12px;margin-bottom:10px;font-size:12px;">
        <div style="text-align:center;flex:1;padding:8px;border-radius:8px;background:rgba(76,175,80,0.1);">
          <div style="font-size:18px;font-weight:700;color:#4caf50;">${totalRent}</div>
          <div style="color:var(--text-dim);">可借</div>
        </div>
        <div style="text-align:center;flex:1;padding:8px;border-radius:8px;background:rgba(33,150,243,0.1);">
          <div style="font-size:18px;font-weight:700;color:#2196f3;">${totalReturn}</div>
          <div style="color:var(--text-dim);">可還</div>
        </div>
        <div style="text-align:center;flex:1;padding:8px;border-radius:8px;background:rgba(255,23,68,0.1);">
          <div style="font-size:18px;font-weight:700;color:#ff1744;">${emptyCount}</div>
          <div style="color:var(--text-dim);">無車</div>
        </div>
      </div>

      <div style="max-height:280px;overflow-y:auto;">
        ${filtered.slice(0, 30).map(s => {
      const color = this.getAvailabilityColor(s.availableRent, s.capacity);
      const cityLabel = CITY_NAMES[s.city] || s.city;
      return `
            <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
              <div style="min-width:32px;text-align:center;font-weight:700;font-size:14px;color:${color};">${s.availableRent}</div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(s.name)}</div>
                <div style="font-size:10px;color:var(--text-dim);">${escapeHtml(cityLabel)} · 空位 ${s.availableReturn}</div>
              </div>
              <div style="display:flex;align-items:center;gap:4px;">
                <div style="width:40px;height:6px;border-radius:3px;background:rgba(255,255,255,0.1);overflow:hidden;">
                  <div style="height:100%;width:${s.capacity > 0 ? (s.availableRent / s.capacity * 100) : 0}%;background:${color};border-radius:3px;"></div>
                </div>
                <span style="font-size:10px;color:var(--text-dim);">${s.capacity}</span>
              </div>
            </div>`;
    }).join('')}
        ${filtered.length > 30 ? `<div style="font-size:11px;color:var(--text-dim);padding:6px 0;text-align:center;">...還有 ${filtered.length - 30} 站</div>` : ''}
      </div>
    `;
  }
}

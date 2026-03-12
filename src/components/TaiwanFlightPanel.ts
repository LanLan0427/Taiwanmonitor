/**
 * TaiwanFlightPanel - 機場航班起降
 */
import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';
import type { TaiwanFlight } from '@/services/taiwan/tdx';

type FlightDir = 'all' | 'arrival' | 'departure';
type FlightAirport = 'all' | 'TPE' | 'TSA' | 'KHH';

const AIRPORT_NAMES: Record<string, string> = {
  TPE: '桃園 TPE',
  TSA: '松山 TSA',
  KHH: '高雄 KHH',
};

export class TaiwanFlightPanel extends Panel {
  private flights: TaiwanFlight[] = [];
  private loaded = false;
  private dir: FlightDir = 'all';
  private airport: FlightAirport = 'all';
  private lastUpdate: Date | null = null;

  constructor() {
    super({ id: 'taiwan-flight', title: '✈️ 機場航班' });
    this.content.addEventListener('change', (e) => {
      const sel = e.target as HTMLSelectElement;
      if (sel?.id === 'flight-dir-select') {
        this.dir = sel.value as FlightDir;
        this.render();
      } else if (sel?.id === 'flight-ap-select') {
        this.airport = sel.value as FlightAirport;
        this.render();
      }
    });
  }

  public updateFlights(data: TaiwanFlight[]): void {
    this.flights = data;
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
      <div class="economic-content">${this.renderFlights()}</div>
      <div class="economic-footer">
        <span class="economic-source">TDX 交通部 • ${updateTime}</span>
      </div>
    `);
  }

  private renderFlights(): string {
    if (!this.loaded) return '<div class="economic-empty">航班資料載入中...</div>';
    if (this.flights.length === 0) return '<div class="economic-empty">目前無法取得航班資料</div>';

    let filtered = [...this.flights];
    if (this.dir !== 'all') filtered = filtered.filter(f => f.direction === this.dir);
    if (this.airport !== 'all') filtered = filtered.filter(f => f.airport === this.airport);

    const arrCount = this.flights.filter(f => f.direction === 'arrival').length;
    const depCount = this.flights.filter(f => f.direction === 'departure').length;

    // Airport counts
    const apCounts: Record<string, number> = {};
    for (const f of this.flights) apCounts[f.airport] = (apCounts[f.airport] || 0) + 1;

    return `
      <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;">
        <select id="flight-dir-select" style="${this.selectStyle}">
          <option value="all" ${this.dir === 'all' ? 'selected' : ''}>📋 全部 (${this.flights.length})</option>
          <option value="arrival" ${this.dir === 'arrival' ? 'selected' : ''}>🛬 到達 (${arrCount})</option>
          <option value="departure" ${this.dir === 'departure' ? 'selected' : ''}>🛫 出發 (${depCount})</option>
        </select>
        <select id="flight-ap-select" style="${this.selectStyle}">
          <option value="all" ${this.airport === 'all' ? 'selected' : ''}>🏢 所有機場</option>
          ${Object.entries(AIRPORT_NAMES).map(([k, v]) =>
      `<option value="${k}" ${this.airport === k ? 'selected' : ''}>${v} (${apCounts[k] || 0})</option>`
    ).join('')}
        </select>
        <span style="font-size:11px;color:var(--text-dim);margin-left:auto;align-self:center;">${filtered.length} 班</span>
      </div>
      ${filtered.length === 0 ? '<div class="economic-empty">無符合條件的航班</div>' : `
        <div style="max-height:320px;overflow-y:auto;">
          ${filtered.slice(0, 30).map(f => this.renderFlight(f)).join('')}
          ${filtered.length > 30 ? `<div style="font-size:11px;color:var(--text-dim);padding:6px 0;text-align:center;">...還有 ${filtered.length - 30} 班航班</div>` : ''}
        </div>`}
    `;
  }

  private renderFlight(f: TaiwanFlight): string {
    const dirIcon = f.direction === 'arrival' ? '🛬' : '🛫';
    const place = f.direction === 'arrival' ? f.origin : f.destination;
    const rawTime = f.actualTime || f.estimatedTime || f.scheduledTime;
    // Extract HH:MM from ISO format like "2026-03-11T00:05" or "00:05"
    const time = rawTime ? (rawTime.includes('T') ? rawTime.split('T')[1]?.slice(0, 5) : rawTime.slice(0, 5)) : '';
    const isDelayed = f.status && (f.status.includes('延') || f.status.includes('Delay'));
    const statusColor = isDelayed ? '#ff9100' : f.status?.includes('取消') ? '#ff1744' : '#4caf50';
    const airlineLabel = f.airline || f.flightNo;

    return `
      <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
        <div style="font-size:14px;">${dirIcon}</div>
        <div style="min-width:65px;font-weight:600;font-size:13px;color:var(--text-primary);">${escapeHtml(f.flightNo)}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:12px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${escapeHtml(airlineLabel)} · ${escapeHtml(place)}
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:12px;font-weight:500;">${time || '—'}</div>
          ${f.status ? `<div style="font-size:10px;color:${statusColor};">${escapeHtml(f.status)}</div>` : ''}
        </div>
      </div>`;
  }
}

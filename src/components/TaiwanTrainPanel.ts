/**
 * TaiwanTrainPanel - 台鐵 & 高鐵即時動態
 */
import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';
import type { TDXVehicle, THSRTrain } from '@/services/taiwan/tdx';

type RailTab = 'tra' | 'thsr';
type TrainView = 'all' | 'delayed' | 'ontime';
type TrainSort = 'delay' | 'id' | 'type';

export class TaiwanTrainPanel extends Panel {
  private traVehicles: TDXVehicle[] = [];
  private thsrTrains: THSRTrain[] = [];
  private traLoaded = false;
  private thsrLoaded = false;
  private railTab: RailTab = 'tra';
  private trainView: TrainView = 'all';
  private trainSort: TrainSort = 'delay';
  private lastUpdate: Date | null = null;

  constructor() {
    super({ id: 'taiwan-train', title: '🚆 鐵路即時動態' });
    this.content.addEventListener('click', (e) => {
      const tab = (e.target as HTMLElement).closest('.taiwan-tab') as HTMLElement | null;
      if (tab?.dataset.tab) {
        this.railTab = tab.dataset.tab as RailTab;
        this.render();
      }
    });
    this.content.addEventListener('change', (e) => {
      const sel = e.target as HTMLSelectElement;
      if (sel?.id === 'train-view-select') {
        this.trainView = sel.value as TrainView;
        this.render();
      } else if (sel?.id === 'train-sort-select') {
        this.trainSort = sel.value as TrainSort;
        this.render();
      }
    });
  }

  public updateTRA(data: TDXVehicle[]): void {
    this.traVehicles = data;
    this.traLoaded = true;
    this.lastUpdate = new Date();
    this.render();
  }

  public updateTHSR(data: THSRTrain[]): void {
    this.thsrTrains = data;
    this.thsrLoaded = true;
    this.lastUpdate = new Date();
    this.render();
  }

  private selectStyle = 'background:rgba(255,255,255,0.08);color:var(--text-primary);border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:4px 8px;font-size:12px;cursor:pointer;outline:none;';

  private render(): void {
    const updateTime = this.lastUpdate
      ? this.lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    const tabsHtml = `
      <div class="economic-tabs">
        <button class="economic-tab taiwan-tab ${this.railTab === 'tra' ? 'active' : ''}" data-tab="tra">
          🚃 台鐵
        </button>
        <button class="economic-tab taiwan-tab ${this.railTab === 'thsr' ? 'active' : ''}" data-tab="thsr">
          🚄 高鐵
        </button>
      </div>
    `;

    const content = this.railTab === 'tra' ? this.renderTRA() : this.renderTHSR();
    const source = this.railTab === 'tra' ? '台鐵 TDX' : '高鐵 TDX';

    this.setContent(`
      ${tabsHtml}
      <div class="economic-content">${content}</div>
      <div class="economic-footer">
        <span class="economic-source">${source} • ${updateTime}</span>
      </div>
    `);
  }

  private statusLabel(s: number): string {
    switch (s) {
      case 0: return '進站中';
      case 1: return '停靠中';
      case 2: return '已離站';
      default: return '—';
    }
  }

  private renderVehicle(v: TDXVehicle): string {
    const delayColor = v.delay > 10 ? '#ff1744' : v.delay > 5 ? '#ff9100' : v.delay > 0 ? '#ffd600' : '#4caf50';
    const delayText = v.delay > 0 ? `晚 ${v.delay} 分` : '準點';
    return `
      <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
        <div style="min-width:50px;font-weight:600;font-size:13px;color:var(--text-primary);">${escapeHtml(v.id)}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:12px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${escapeHtml(v.type)} · ${escapeHtml(v.station)} · ${this.statusLabel(v.status)}
          </div>
        </div>
        <div style="font-size:12px;font-weight:600;color:${delayColor};white-space:nowrap;">${delayText}</div>
      </div>`;
  }

  private renderTRA(): string {
    if (!this.traLoaded) return '<div class="economic-empty">台鐵即時動態載入中...</div>';
    if (this.traVehicles.length === 0) return '<div class="economic-empty">目前無法取得台鐵即時資料</div>';

    const total = this.traVehicles.length;
    const delayedCount = this.traVehicles.filter(v => v.delay > 0).length;
    const onTimeCount = total - delayedCount;
    const delayRate = total > 0 ? ((delayedCount / total) * 100).toFixed(1) : '0';

    let filtered: TDXVehicle[];
    switch (this.trainView) {
      case 'delayed': filtered = this.traVehicles.filter(v => v.delay > 0); break;
      case 'ontime': filtered = this.traVehicles.filter(v => v.delay === 0); break;
      default: filtered = [...this.traVehicles];
    }

    switch (this.trainSort) {
      case 'delay': filtered.sort((a, b) => b.delay - a.delay); break;
      case 'id': filtered.sort((a, b) => a.id.localeCompare(b.id)); break;
      case 'type': filtered.sort((a, b) => a.type.localeCompare(b.type) || b.delay - a.delay); break;
    }

    const types = new Map<string, number>();
    this.traVehicles.forEach(v => types.set(v.type, (types.get(v.type) || 0) + 1));

    return `
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;">
        <span>行駛中: <strong>${total}</strong></span>
        <span style="color:${delayedCount > 0 ? '#ff9100' : '#4caf50'};">誤點: <strong>${delayedCount}</strong> (${delayRate}%) · 準點: <strong>${onTimeCount}</strong></span>
      </div>

      <div style="display:flex;gap:6px;margin-bottom:4px;flex-wrap:wrap;">
        ${Array.from(types.entries()).map(([t, n]) =>
      `<span style="font-size:10px;padding:2px 6px;border-radius:10px;background:rgba(255,255,255,0.06);color:var(--text-secondary);">${escapeHtml(t)} ${n}</span>`
    ).join('')}
      </div>

      <div style="display:flex;align-items:center;gap:8px;margin:8px 0;">
        <select id="train-view-select" style="${this.selectStyle}">
          <option value="all" ${this.trainView === 'all' ? 'selected' : ''}>📋 全部列車 (${total})</option>
          <option value="delayed" ${this.trainView === 'delayed' ? 'selected' : ''}>⚠️ 誤點列車 (${delayedCount})</option>
          <option value="ontime" ${this.trainView === 'ontime' ? 'selected' : ''}>✅ 準點列車 (${onTimeCount})</option>
        </select>
        <select id="train-sort-select" style="${this.selectStyle}">
          <option value="delay" ${this.trainSort === 'delay' ? 'selected' : ''}>依誤點排序</option>
          <option value="id" ${this.trainSort === 'id' ? 'selected' : ''}>依車次排序</option>
          <option value="type" ${this.trainSort === 'type' ? 'selected' : ''}>依車種排序</option>
        </select>
        <span style="font-size:11px;color:var(--text-dim);margin-left:auto;">${filtered.length} 班</span>
      </div>

      ${filtered.length === 0 ? '<div class="economic-empty">無符合條件的列車</div>' : `
        <div style="max-height:300px;overflow-y:auto;">
          ${filtered.slice(0, 30).map(v => this.renderVehicle(v)).join('')}
          ${filtered.length > 30 ? `<div style="font-size:11px;color:var(--text-dim);padding:6px 0;text-align:center;">...還有 ${filtered.length - 30} 班列車</div>` : ''}
        </div>`}
    `;
  }

  private seatStatusIcon(status: string): string {
    if (status === 'O') return '<span style="color:#4caf50;">⬤</span>';
    if (status === 'X') return '<span style="color:#ff1744;">✕</span>';
    return '<span style="color:#888;">—</span>';
  }

  private renderTHSR(): string {
    if (!this.thsrLoaded) return '<div class="economic-empty">高鐵資料載入中...</div>';
    if (this.thsrTrains.length === 0) return '<div class="economic-empty">目前無法取得高鐵即時資料</div>';

    const southbound = this.thsrTrains.filter(t => t.direction === 0).length;
    const northbound = this.thsrTrains.filter(t => t.direction === 1).length;

    return `
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;">
        <span>營運中: <strong>${this.thsrTrains.length}</strong> 班次</span>
        <span style="color:var(--text-secondary);">南下 ${southbound} · 北上 ${northbound}</span>
      </div>
      <div style="max-height:320px;overflow-y:auto;">
        ${this.thsrTrains.slice(0, 30).map(t => {
      const dirLabel = t.direction === 0 ? '南下' : '北上';
      const dirColor = t.direction === 0 ? '#ff9800' : '#2196f3';
      // Show seat status for last few stops
      const lastStops = t.seatStatus.slice(-4);
      return `
            <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
              <div style="min-width:50px;font-weight:600;font-size:13px;color:var(--text-primary);">${escapeHtml(t.id)}</div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:12px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  ${escapeHtml(t.originStation)} → ${escapeHtml(t.destStation)}
                </div>
                <div style="font-size:10px;color:var(--text-dim);margin-top:2px;">
                  ${lastStops.map(s => `${escapeHtml(s.station)}: ${this.seatStatusIcon(s.standard)}`).join(' ')}
                </div>
              </div>
              <div style="font-size:11px;font-weight:600;color:${dirColor};white-space:nowrap;">${dirLabel}</div>
            </div>`;
    }).join('')}
        ${this.thsrTrains.length > 30 ? `<div style="font-size:11px;color:var(--text-dim);padding:6px 0;text-align:center;">...還有 ${this.thsrTrains.length - 30} 班</div>` : ''}
      </div>
      <div style="font-size:10px;color:var(--text-dim);margin-top:6px;">座位狀態: <span style="color:#4caf50;">⬤</span> 有位 <span style="color:#ff1744;">✕</span> 客滿</div>
    `;
  }
}


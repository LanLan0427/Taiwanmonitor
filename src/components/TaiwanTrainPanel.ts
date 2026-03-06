/**
 * TaiwanTrainPanel - 台鐵即時動態
 */
import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';
import type { TDXVehicle } from '@/services/taiwan/tdx';

type TrainView = 'all' | 'delayed' | 'ontime';
type TrainSort = 'delay' | 'id' | 'type';

export class TaiwanTrainPanel extends Panel {
  private traVehicles: TDXVehicle[] = [];
  private traLoaded = false;
  private trainView: TrainView = 'all';
  private trainSort: TrainSort = 'delay';
  private lastUpdate: Date | null = null;

  constructor() {
    super({ id: 'taiwan-train', title: '🚆 台鐵即時動態' });
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

  private selectStyle = 'background:rgba(255,255,255,0.08);color:var(--text-primary);border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:4px 8px;font-size:12px;cursor:pointer;outline:none;';

  private render(): void {
    const updateTime = this.lastUpdate
      ? this.lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';
    this.setContent(`
      <div class="economic-content">${this.renderTRA()}</div>
      <div class="economic-footer">
        <span class="economic-source">台鐵 TDX • ${updateTime}</span>
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

    // Filter
    let filtered: TDXVehicle[];
    switch (this.trainView) {
      case 'delayed': filtered = this.traVehicles.filter(v => v.delay > 0); break;
      case 'ontime': filtered = this.traVehicles.filter(v => v.delay === 0); break;
      default: filtered = [...this.traVehicles];
    }

    // Sort
    switch (this.trainSort) {
      case 'delay': filtered.sort((a, b) => b.delay - a.delay); break;
      case 'id': filtered.sort((a, b) => a.id.localeCompare(b.id)); break;
      case 'type': filtered.sort((a, b) => a.type.localeCompare(b.type) || b.delay - a.delay); break;
    }

    // Train types summary
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
}

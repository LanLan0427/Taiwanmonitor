/**
 * TaiwanHighwayPanel - 高速公路即時路況
 */
import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';
import type { HighwaySection } from '@/services/taiwan/tdx';

type HwyView = 'congested' | 'all';

export class TaiwanHighwayPanel extends Panel {
  private sections: HighwaySection[] = [];
  private loaded = false;
  private view: HwyView = 'congested';
  private lastUpdate: Date | null = null;

  constructor() {
    super({ id: 'taiwan-highway', title: '🛣️ 國道路況' });
    this.content.addEventListener('change', (e) => {
      const sel = e.target as HTMLSelectElement;
      if (sel?.id === 'hwy-view-select') {
        this.view = sel.value as HwyView;
        this.render();
      }
    });
  }

  public updateSections(data: HighwaySection[]): void {
    this.sections = data;
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
      <div class="economic-content">${this.renderSections()}</div>
      <div class="economic-footer">
        <span class="economic-source">TDX 高速公路局 • ${updateTime}</span>
      </div>
    `);
  }

  private getCongestionColor(level: number): string {
    switch (level) {
      case 0: return '#4caf50';  // 暢通
      case 1: return '#ffc107';  // 略壅
      case 2: return '#ff9800';  // 壅塞
      case 3: return '#ff1744';  // 嚴重壅塞
      default: return '#888';
    }
  }

  private getCongestionLabel(level: number): string {
    switch (level) {
      case 0: return '暢通';
      case 1: return '略壅';
      case 2: return '壅塞';
      case 3: return '嚴重壅塞';
      default: return '—';
    }
  }

  private renderSections(): string {
    if (!this.loaded) return '<div class="economic-empty">國道路況載入中...</div>';
    if (this.sections.length === 0) return '<div class="economic-empty">目前無法取得國道路況資料</div>';

    let filtered = [...this.sections];
    if (this.view === 'congested') {
      filtered = filtered.filter(s => s.congestionLevel >= 1);
    }
    filtered.sort((a, b) => b.congestionLevel - a.congestionLevel || a.travelSpeed - b.travelSpeed);

    const congestedCount = this.sections.filter(s => s.congestionLevel >= 1).length;
    const heavyCount = this.sections.filter(s => s.congestionLevel >= 2).length;
    const avgSpeed = this.sections.length > 0
      ? Math.round(this.sections.reduce((s, sec) => s + sec.travelSpeed, 0) / this.sections.filter(s => s.travelSpeed > 0).length || 0)
      : 0;

    return `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <select id="hwy-view-select" style="${this.selectStyle}">
          <option value="congested" ${this.view === 'congested' ? 'selected' : ''}>⚠️ 壅塞路段 (${congestedCount})</option>
          <option value="all" ${this.view === 'all' ? 'selected' : ''}>📋 全部路段 (${this.sections.length})</option>
        </select>
        <span style="font-size:11px;color:var(--text-dim);">
          ${heavyCount > 0 ? `<span style="color:#ff1744;">${heavyCount} 段壅塞</span> · ` : ''}平均 ${avgSpeed} km/h
        </span>
      </div>

      ${filtered.length === 0 ? '<div class="economic-empty">🎉 目前所有路段暢通</div>' : `
        <div style="max-height:300px;overflow-y:auto;">
          ${filtered.slice(0, 30).map(s => {
      const color = this.getCongestionColor(s.congestionLevel);
      const label = this.getCongestionLabel(s.congestionLevel);
      const sectionLabel = s.sectionName || `路段 ${s.sectionId}`;
      return `
              <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                <div style="min-width:8px;height:8px;border-radius:50%;background:${color};"></div>
                <div style="flex:1;min-width:0;">
                  <div style="font-size:13px;font-weight:500;">${escapeHtml(sectionLabel)}</div>
                  <div style="font-size:11px;color:var(--text-dim);">${label}${s.direction ? ' · ' + escapeHtml(s.direction) : ''}</div>
                </div>
                <div style="text-align:right;">
                  <div style="font-size:12px;font-weight:600;color:${color};">${s.travelSpeed > 0 ? s.travelSpeed + ' km/h' : label}</div>
                  ${s.travelTime > 0 ? `<div style="font-size:10px;color:var(--text-dim);">${Math.round(s.travelTime / 60)} 分鐘</div>` : ''}
                </div>
              </div>`;
    }).join('')}
          ${filtered.length > 30 ? `<div style="font-size:11px;color:var(--text-dim);padding:6px 0;text-align:center;">...還有 ${filtered.length - 30} 段</div>` : ''}
        </div>`}
    `;
  }
}

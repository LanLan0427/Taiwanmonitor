# 台灣功能完成度對照表

更新時間：2026-03-12

本文件整理目前 `Taiwan Monitor` 版本中，台灣在地功能的實作完成度。判定依據為目前程式碼內可找到的資料服務、API 代理、面板整合與功能關聯實作。

## 判定說明

- **已完成**：已找到資料抓取、解析、代理或面板整合的明確實作
- **未完成**：目前程式碼中未找到對應功能實作
- **部分完成**：已有部分能力，但未達任務描述的完整範圍

## 一、災防 / 環境

| 項目 | 狀態 | 說明 | 主要檔案 |
|------|------|------|----------|
| CWA 即時天氣觀測 | 已完成 | 已串接中央氣象署即時觀測站資料 | `src/services/taiwan/index.ts`, `api/taiwan/data.ts` |
| CWA 36 小時天氣預報 | 已完成 | 已提供縣市預報資料與解析 | `src/services/taiwan/index.ts`, `api/taiwan/data.ts` |
| CWA 颱風資訊 | 已完成 | 已提供颱風警報 / 無颱風提示 | `src/services/taiwan/index.ts`, `api/taiwan/data.ts` |
| CWA 地震資訊 | 已完成 | 已整合顯著地震與小區域地震資料 | `src/services/taiwan/index.ts`, `api/taiwan/data.ts` |
| CWA 雷達回波 | 未完成 | 未找到台灣氣象雷達回波資料服務或面板整合 | — |
| NCDR 災害示警 API | 未完成 | 未找到 `NCDR`、災害示警、土石流、淹水、道路封閉等相關實作 | — |
| MOENV AQI 空氣品質 | 已完成 | 已整合 AQI、PM2.5、PM10、O₃ 與排序分級 | `src/services/taiwan/index.ts`, `api/taiwan/data.ts` |
| MOENV UV 紫外線 | 已完成 | 已整合 UVI 與等級分類 | `src/services/taiwan/index.ts`, `api/taiwan/data.ts` |

## 二、交通 / 基建

| 項目 | 狀態 | 說明 | 主要檔案 |
|------|------|------|----------|
| TDX 台鐵即時動態 | 已完成 | 已整合列車動態與面板顯示 | `src/services/taiwan/tdx.ts`, `api/taiwan/tdx.ts`, `src/components/TaiwanTrainPanel.ts` |
| TDX 高鐵資訊 | 已完成 | 已整合班次座位狀態與面板顯示 | `src/services/taiwan/tdx.ts`, `api/taiwan/tdx.ts`, `src/components/TaiwanTrainPanel.ts` |
| TDX 機場航班 | 已完成 | 已整合桃園、松山、高雄到離站航班 | `src/services/taiwan/tdx.ts`, `api/taiwan/tdx.ts`, `src/components/TaiwanFlightPanel.ts` |
| TDX 國道路況 | 已完成 | 已整合旅行時間、車速、壅塞等級 | `src/services/taiwan/tdx.ts`, `api/taiwan/tdx.ts`, `src/components/TaiwanHighwayPanel.ts` |
| TDX 國道 CCTV | 未完成 | 未找到 `CCTV` 資料抓取、代理或影像顯示實作 | — |
| 台電發電資訊 | 已完成 | 已整合供電能力、負載、備轉、燈號與發電分類 | `src/services/taiwan/index.ts`, `api/taiwan/data.ts`, `src/components/TaiwanPowerEqPanel.ts` |
| 台電停電資訊 | 已完成 | 已整合停電資料代理與面板顯示 | `api/taiwan/data.ts`, `src/components/TaiwanPowerEqPanel.ts` |
| 水利署水庫水情 | 已完成 | 已整合主要水庫蓄水率、水位與有效蓄水量 | `src/services/taiwan/index.ts`, `api/taiwan/data.ts`, `src/components/TaiwanEnvPanel.ts` |

## 三、總結

### 已完成

- CWA：即時天氣、預報、颱風、地震
- MOENV：AQI、UV
- TDX：台鐵、高鐵、航班、國道路況
- 台電：發電 / 備轉 / 停電
- 水利署：水庫水情

### 尚未完成

- CWA 雷達回波
- NCDR 災害示警 API
- TDX 國道 CCTV

## 四、後續建議

若要補齊目前缺口，建議優先順序如下：

1. `NCDR 災害示警`：可補足防災資訊完整性
2. `CWA 雷達回波`：可提升天氣面板即時觀測價值
3. `TDX 國道 CCTV`：可補足交通監控視覺化能力
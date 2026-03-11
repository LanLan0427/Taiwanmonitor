# 🇹🇼 Taiwan Monitor

**台灣即時儀表板** — 整合天氣、空品、供電、地震、水庫水情、紫外線及台鐵動態等台灣在地資訊的即時監控平台。

> **Note:** 本專案基於 [World Monitor](https://github.com/koala73/worldmonitor)（作者：Elie Habib）進行二次開發，加入台灣在地化功能與資料來源。原始專案採用 **AGPL-3.0** 授權，本專案同樣遵循該授權條款。

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

---

## 專案特色

Taiwan Monitor 保留了 World Monitor 強大的全球情資儀表板架構（互動式 3D 地圖、AI 新聞摘要、多圖層資料疊加等），並額外加入了以下**台灣專屬功能**：

### 🌦️ 天氣觀測・預報・颱風

| 功能 | 資料來源 | 說明 |
|------|----------|------|
| **即時天氣觀測** | 中央氣象署 (CWA) 自動氣象站 | 各測站即時溫度、濕度、風速、風向、降雨量、氣壓 |
| **36 小時天氣預報** | 中央氣象署 (CWA) | 各縣市天氣現象、最高／最低氣溫、降雨機率、舒適度 |
| **颱風警報** | 中央氣象署 (CWA) | 颱風名稱、等級、位置、氣壓、風速，無颱風時提示 |

### 🌿 環境監測

| 功能 | 資料來源 | 說明 |
|------|----------|------|
| **空氣品質 (AQI)** | 環境部 (MOENV) | 各測站 AQI 指數、PM2.5、PM10、O₃、主要污染物，依嚴重度排序並以顏色分級 |
| **水庫水情** | 水利署 (WRA) | 全台主要水庫蓄水百分比、有效蓄水量、水位高度 |
| **紫外線指數** | 環境部 (MOENV) | 各測站 UVI，自動分級（低量 → 危險） |

### ⚡ 供電與地震

| 功能 | 資料來源 | 說明 |
|------|----------|------|
| **即時供電資訊** | 台灣電力公司 (Taipower) | 供電能力、目前用電、備轉容量率、供電燈號（綠/黃/橘/紅）、依發電類型及電廠分類 |
| **地震資訊** | 中央氣象署 (CWA) | 最近 15 筆地震紀錄，含震央、規模、深度、最大震度及各地震度分布 |

### 🚆 台鐵即時動態

| 功能 | 資料來源 | 說明 |
|------|----------|------|
| **列車動態** | 交通部 TDX 平台 | 即時行駛列車狀態、誤點時間，支援篩選（全部/誤點/準點）及排序（依誤點/車次/車種） |

---

## 技術架構

- **前端**：TypeScript + Vite + MapLibre GL JS + deck.gl
- **後端 API 代理**：Vercel Edge Functions（`api/taiwan/data.ts`）代理台灣政府開放資料 API，解決 CORS 問題並加入快取
- **資料服務層**：`src/services/taiwan/` — 各資料來源的 fetch、parse 與 Circuit Breaker 機制
- **UI 面板**：`src/components/Taiwan*.ts` — 四個台灣專屬面板元件
- **交通圖層**：`src/components/layers/TDXTrafficLayer.ts` — 台鐵車站與列車地圖圖層
- **在地化**：`src/locales/zh-TW.json` — 繁體中文語系檔

### 使用的台灣開放資料 API

| API | 用途 | 快取機制 |
|-----|------|----------|
| [中央氣象署開放資料平台](https://opendata.cwa.gov.tw/) | 地震、天氣觀測、預報、颱風 | Circuit Breaker + 5–30 分鐘快取 |
| [環境部開放資料平台](https://data.moenv.gov.tw/) | AQI 空氣品質、紫外線指數 | Circuit Breaker + 5–30 分鐘快取 |
| [台灣電力公司](https://www.taipower.com.tw/) | 供電資訊 | Circuit Breaker + 5 分鐘快取 |
| [水利署](https://fhy.wra.gov.tw/) | 水庫水情 | Circuit Breaker + 10 分鐘快取 |
| [交通部 TDX 平台](https://tdx.transportdata.tw/) | 台鐵即時動態、車站資訊 | 依 TDX 授權規範 |

---

## 快速開始

### 環境需求

- [Node.js](https://nodejs.org/) v18 以上
- npm

### 安裝與執行

```bash
# 1. 下載專案
git clone https://github.com/LanLan0427/Taiwanmonitor.git

# 2. 進入專案目錄
cd Taiwanmonitor

# 3. 安裝套件
npm install

# 4. 設定環境變數（複製範本並填入 API Key）
cp .env.example .env

# 5. 啟動開發伺服器
npm run dev
```

### 環境變數

在 `.env` 檔案中設定以下 API Key（部分資料來源需要申請）：

| 變數名稱 | 說明 | 申請連結 |
|----------|------|----------|
| `VITE_CWA_API_KEY` | 中央氣象署 API Key | [CWA 開放資料](https://opendata.cwa.gov.tw/) |
| `VITE_MOENV_API_KEY` | 環境部 API Key | [MOENV 開放資料](https://data.moenv.gov.tw/) |
| `VITE_TDX_CLIENT_ID` | TDX 平台 Client ID | [TDX 會員申請](https://tdx.transportdata.tw/) |
| `VITE_TDX_CLIENT_SECRET` | TDX 平台 Client Secret | 同上 |

---

## 專案結構

```
Taiwanmonitor/
├── api/taiwan/           # Vercel Edge Function — 資料 API 代理
│   ├── data.ts           #   CWA/Taipower/MOENV/WRA 代理
│   └── tdx.ts            #   TDX 平台代理
├── src/
│   ├── components/
│   │   ├── TaiwanWeatherPanel.ts    # 天氣觀測/預報/颱風面板
│   │   ├── TaiwanEnvPanel.ts        # 空品/水庫/紫外線面板
│   │   ├── TaiwanPowerEqPanel.ts    # 供電/地震面板
│   │   ├── TaiwanTrainPanel.ts      # 台鐵即時動態面板
│   │   └── layers/
│   │       └── TDXTrafficLayer.ts   # 台鐵地圖圖層
│   ├── services/taiwan/
│   │   ├── index.ts                 # 台灣資料服務層
│   │   └── tdx.ts                   # TDX API 整合
│   └── locales/
│       └── zh-TW.json               # 繁體中文語系
├── .env.example          # 環境變數範本
├── LICENSE               # AGPL-3.0 授權
└── README.md             # 本文件
```

---

## 致謝

- **[World Monitor](https://github.com/koala73/worldmonitor)** — 由 Elie Habib 開發的原始專案，提供了強大的即時全球情資儀表板架構。本專案基於其開源程式碼進行台灣在地化開發。
- **[中央氣象署](https://www.cwa.gov.tw/)** — 天氣、地震、颱風資料
- **[環境部](https://www.moenv.gov.tw/)** — 空氣品質、紫外線資料
- **[台灣電力公司](https://www.taipower.com.tw/)** — 供電資訊
- **[水利署](https://www.wra.gov.tw/)** — 水庫水情資料
- **[交通部 TDX 平台](https://tdx.transportdata.tw/)** — 台鐵即時動態

---

## 授權

本專案採用 **[GNU Affero General Public License v3.0 (AGPL-3.0)](./LICENSE)** 授權。

原始專案版權所有 © 2024-2026 Elie Habib。台灣在地化修改由 LanLan0427 進行。

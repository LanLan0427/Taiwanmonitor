export interface VariantMeta {
  title: string;
  description: string;
  keywords: string;
  url: string;
  siteName: string;
  shortName: string;
  subject: string;
  classification: string;
  categories: string[];
  features: string[];
}

export const VARIANT_META: { full: VariantMeta;[k: string]: VariantMeta } = {
  full: {
    title: 'World Monitor - Real-Time Global Intelligence Dashboard',
    description: 'Real-time global intelligence dashboard with live news, markets, military tracking, infrastructure monitoring, and geopolitical data. OSINT in one view.',
    keywords: 'global intelligence, geopolitical dashboard, world news, market data, military bases, nuclear facilities, undersea cables, conflict zones, real-time monitoring, situation awareness, OSINT, flight tracking, AIS ships, earthquake monitor, protest tracker, power outages, oil prices, government spending, polymarket predictions',
    url: 'https://worldmonitor.app/',
    siteName: 'World Monitor',
    shortName: 'WorldMonitor',
    subject: 'Real-Time Global Intelligence and Situation Awareness',
    classification: 'Intelligence Dashboard, OSINT Tool, News Aggregator',
    categories: ['news', 'productivity'],
    features: [
      'Real-time news aggregation',
      'Stock market tracking',
      'Military flight monitoring',
      'Ship AIS tracking',
      'Earthquake alerts',
      'Protest tracking',
      'Power outage monitoring',
      'Oil price analytics',
      'Government spending data',
      'Prediction markets',
      'Infrastructure monitoring',
      'Geopolitical intelligence',
    ],
  },
  tech: {
    title: 'Tech Monitor - Real-Time AI & Tech Industry Dashboard',
    description: 'Real-time AI and tech industry dashboard tracking tech giants, AI labs, startup ecosystems, funding rounds, and tech events worldwide.',
    keywords: 'tech dashboard, AI industry, startup ecosystem, tech companies, AI labs, venture capital, tech events, tech conferences, cloud infrastructure, datacenters, tech layoffs, funding rounds, unicorns, FAANG, tech HQ, accelerators, Y Combinator, tech news',
    url: 'https://tech.worldmonitor.app/',
    siteName: 'Tech Monitor',
    shortName: 'TechMonitor',
    subject: 'AI, Tech Industry, and Startup Ecosystem Intelligence',
    classification: 'Tech Dashboard, AI Tracker, Startup Intelligence',
    categories: ['news', 'business'],
    features: [
      'Tech news aggregation',
      'AI lab tracking',
      'Startup ecosystem mapping',
      'Tech HQ locations',
      'Conference & event calendar',
      'Cloud infrastructure monitoring',
      'Datacenter mapping',
      'Tech layoff tracking',
      'Funding round analytics',
      'Tech stock tracking',
      'Service status monitoring',
    ],
  },
  happy: {
    title: 'Happy Monitor - Good News & Global Progress',
    description: 'Curated positive news, progress data, and uplifting stories from around the world.',
    keywords: 'good news, positive news, global progress, happy news, uplifting stories, human achievement, science breakthroughs, conservation wins',
    url: 'https://happy.worldmonitor.app/',
    siteName: 'Happy Monitor',
    shortName: 'HappyMonitor',
    subject: 'Good News, Global Progress, and Human Achievement',
    classification: 'Positive News Dashboard, Progress Tracker',
    categories: ['news', 'lifestyle'],
    features: [
      'Curated positive news',
      'Global progress tracking',
      'Live humanity counters',
      'Science breakthrough feed',
      'Conservation tracker',
      'Renewable energy dashboard',
    ],
  },
  finance: {
    title: 'Finance Monitor - Real-Time Markets & Trading Dashboard',
    description: 'Real-time finance and trading dashboard tracking global markets, stock exchanges, central banks, commodities, forex, crypto, and economic indicators worldwide.',
    keywords: 'finance dashboard, trading dashboard, stock market, forex, commodities, central banks, crypto, economic indicators, market news, financial centers, stock exchanges, bonds, derivatives, fintech, hedge funds, IPO tracker, market analysis',
    url: 'https://finance.worldmonitor.app/',
    siteName: 'Finance Monitor',
    shortName: 'FinanceMonitor',
    subject: 'Global Markets, Trading, and Financial Intelligence',
    classification: 'Finance Dashboard, Market Tracker, Trading Intelligence',
    categories: ['finance', 'news'],
    features: [
      'Real-time market data',
      'Stock exchange mapping',
      'Central bank monitoring',
      'Commodity price tracking',
      'Forex & currency news',
      'Crypto & digital assets',
      'Economic indicator alerts',
      'IPO & earnings tracking',
      'Financial center mapping',
      'Sector heatmap',
      'Market radar signals',
    ],
  },
  taiwan: {
    title: 'Taiwan Monitor - 台灣即時情報儀表板',
    description: '台灣即時情報儀表板：整合新聞聚合、台海動態、台股追蹤、氣象預警及基礎設施監控。',
    keywords: '台灣情報, 台海局勢, 台股, 加權指數, 地震, 颱風, 台灣新聞, 國防, 半導體, TSMC, 台積電, 台灣監控, Taiwan intelligence, Taiwan monitor, OSINT',
    url: 'https://taiwan.worldmonitor.app/',
    siteName: 'Taiwan Monitor',
    shortName: 'TaiwanMonitor',
    subject: '台灣即時情報與態勢感知',
    classification: '情報儀表板, 新聞聚合, 台灣監控',
    categories: ['news', 'productivity'],
    features: [
      '台灣即時新聞聚合',
      '台股加權指數追蹤',
      '台海軍事動態監控',
      '地震颱風即時預警',
      '台電供電資訊',
      '半導體產業追蹤',
      '海底電纜監控',
      '國際情報分析',
    ],
  },
};

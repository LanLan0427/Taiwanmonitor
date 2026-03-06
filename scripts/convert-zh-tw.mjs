import { readFileSync, writeFileSync } from 'fs';
import { Converter } from 'opencc-js';

// Create a S2TWP (Simplified to Traditional with Taiwan phrases) converter
const convert = Converter({ from: 'cn', to: 'twp' });

const zhSimplified = readFileSync('src/locales/zh.json', 'utf-8');
const zhTraditional = convert(zhSimplified);

writeFileSync('src/locales/zh-TW.json', zhTraditional, 'utf-8');
console.log('✅ zh-TW.json created successfully!');

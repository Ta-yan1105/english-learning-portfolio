export const WPM_SCALE_MAX = 600;
export const WPM_LEVELS = [
  { max: 70,       lv: 1,  ja: 'ゆっくり',               en: 'Slow',                                  color: '#e0e7ff', textColor: '#4338ca' },
  { max: 100,      lv: 2,  ja: '英語圏の子供レベル',     en: 'Native-English child level',           color: '#c7d2fe', textColor: '#4338ca' },
  { max: 130,      lv: 3,  ja: '標準',                   en: 'Average',                               color: '#a5b4fc', textColor: '#312e81' },
  { max: 155,      lv: 4,  ja: 'スムーズ',               en: 'Smooth',                                color: '#818cf8', textColor: 'white' },
  { max: 180,      lv: 5,  ja: '英語圏の高校生レベル',   en: 'Native-English high-schooler level',   color: '#6366f1', textColor: 'white' },
  { max: 205,      lv: 6,  ja: '英語圏の大学生レベル',   en: 'Native-English college-student level', color: '#4f46e5', textColor: 'white' },
  { max: 230,      lv: 7,  ja: '英語圏の教養ある大人',   en: 'Educated native-English adult level',  color: '#4338ca', textColor: 'white' },
  { max: 255,      lv: 8,  ja: 'ネイティブレベル',       en: 'Native level',                          color: '#3730a3', textColor: 'white' },
  { max: 280,      lv: 9,  ja: 'ニュースキャスター級',   en: 'News-anchor level',                     color: '#312e81', textColor: 'white' },
  { max: 310,      lv: 10, ja: 'ディベート選手級',       en: 'Debate-champion level',                 color: '#27227a', textColor: 'white' },
  { max: 350,      lv: 11, ja: '同時通訳者級',           en: 'Simultaneous-interpreter level',        color: '#1e1b4b', textColor: 'white' },
  { max: 400,      lv: 12, ja: 'ラップMC級',             en: 'Rap-MC level',                          color: '#581c87', textColor: 'white' },
  { max: 450,      lv: 13, ja: '競馬実況アナ級',         en: 'Horse-race-announcer level',           color: '#86198f', textColor: 'white' },
  { max: 500,      lv: 14, ja: '早口言葉チャンピオン級', en: 'Tongue-twister-champion level',        color: '#9f1239', textColor: 'white' },
  { max: Infinity, lv: 15, ja: '測定不能級',             en: 'Off-the-charts level',                  color: '#7c2d12', textColor: 'white' },
];

export const getWpmLevel = (wpm) => WPM_LEVELS.find(l => wpm <= l.max) || WPM_LEVELS[WPM_LEVELS.length - 1];

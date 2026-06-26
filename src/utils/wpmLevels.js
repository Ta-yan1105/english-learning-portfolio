export const WPM_SCALE_MAX = 260;
export const WPM_LEVELS = [
  { max: 70,       lv: 1, ja: 'ゆっくり',           en: 'Slow',                  color: '#e0e7ff', textColor: '#4338ca' },
  { max: 100,      lv: 2, ja: '英語圏の子供レベル',     en: 'Native-English child level',           color: '#c7d2fe', textColor: '#4338ca' },
  { max: 130,      lv: 3, ja: '標準',                   en: 'Average',                               color: '#a5b4fc', textColor: '#312e81' },
  { max: 155,      lv: 4, ja: 'スムーズ',               en: 'Smooth',                                color: '#818cf8', textColor: 'white' },
  { max: 180,      lv: 5, ja: '英語圏の高校生レベル',   en: 'Native-English high-schooler level',   color: '#6366f1', textColor: 'white' },
  { max: 205,      lv: 6, ja: '英語圏の大学生レベル',   en: 'Native-English college-student level', color: '#4f46e5', textColor: 'white' },
  { max: 230,      lv: 7, ja: '英語圏の教養ある大人',   en: 'Educated native-English adult level',  color: '#4338ca', textColor: 'white' },
  { max: Infinity, lv: 8, ja: 'ネイティブレベル',       en: 'Native level',                          color: '#3730a3', textColor: 'white' },
];

export const getWpmLevel = (wpm) => WPM_LEVELS.find(l => wpm <= l.max) || WPM_LEVELS[WPM_LEVELS.length - 1];

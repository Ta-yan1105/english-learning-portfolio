/* 日本の祝日を計算する（1955年〜2099年を想定）
   ハッピーマンデー・春分秋分・振替休日・国民の休日に対応 */

const pad = (n) => String(n).padStart(2, '0');
const key = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

/* その月の第n月曜日の日 */
const nthMonday = (year, month, nth) => {
  const firstDow = new Date(year, month - 1, 1).getDay(); // 0=日
  const firstMonday = 1 + ((8 - firstDow) % 7);
  return firstMonday + (nth - 1) * 7;
};

/* 春分・秋分（1980年基準の近似式。2099年まで実用上一致する） */
const equinox = (year, springOrAutumn) => {
  const base = springOrAutumn === 'spring' ? 20.8431 : 23.2488;
  return Math.floor(base + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
};

/* その年の祝日を { 'YYYY-MM-DD': '名称' } で返す */
export const getHolidays = (year) => {
  const h = {};
  const add = (m, d, name) => { h[key(year, m, d)] = name; };

  add(1, 1, '元日');
  add(1, nthMonday(year, 1, 2), '成人の日');
  add(2, 11, '建国記念の日');
  if (year >= 2020) add(2, 23, '天皇誕生日');
  add(3, equinox(year, 'spring'), '春分の日');
  add(4, 29, '昭和の日');
  add(5, 3, '憲法記念日');
  add(5, 4, 'みどりの日');
  add(5, 5, 'こどもの日');
  add(7, nthMonday(year, 7, 3), '海の日');
  if (year >= 2016) add(8, 11, '山の日');
  add(9, nthMonday(year, 9, 3), '敬老の日');
  add(9, equinox(year, 'autumn'), '秋分の日');
  add(10, nthMonday(year, 10, 2), year >= 2020 ? 'スポーツの日' : '体育の日');
  add(11, 3, '文化の日');
  add(11, 23, '勤労感謝の日');

  /* 振替休日：日曜が祝日なら、次の平日を休みにする */
  const substitutes = {};
  Object.keys(h).forEach(k => {
    const dt = new Date(k + 'T00:00:00');
    if (dt.getDay() !== 0) return;
    const next = new Date(dt);
    do { next.setDate(next.getDate() + 1); }
    while (h[key(next.getFullYear(), next.getMonth() + 1, next.getDate())]);
    substitutes[key(next.getFullYear(), next.getMonth() + 1, next.getDate())] = '振替休日';
  });
  Object.assign(h, substitutes);

  /* 国民の休日：祝日に挟まれた平日（敬老の日と秋分の日の間など） */
  const between = {};
  Object.keys(h).forEach(k => {
    const dt = new Date(k + 'T00:00:00');
    const mid = new Date(dt); mid.setDate(mid.getDate() + 1);
    const after = new Date(dt); after.setDate(after.getDate() + 2);
    const midKey = key(mid.getFullYear(), mid.getMonth() + 1, mid.getDate());
    const afterKey = key(after.getFullYear(), after.getMonth() + 1, after.getDate());
    if (!h[midKey] && h[afterKey] && mid.getDay() !== 0 && mid.getDay() !== 6) {
      between[midKey] = '国民の休日';
    }
  });
  Object.assign(h, between);

  return h;
};

/* 複数年ぶんをまとめて引けるようにキャッシュする */
const cache = {};
export const holidayName = (dateStr) => {
  const year = Number(dateStr.slice(0, 4));
  if (!cache[year]) cache[year] = getHolidays(year);
  return cache[year][dateStr] || null;
};

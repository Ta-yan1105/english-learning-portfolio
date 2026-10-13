/* 資格試験のパート別 標準タイム
   - 英検の試験時間は公式（eiken.or.jp 各級ページ）の表記そのまま
   - TOEIC は公式が定めるのはセクション全体の時間（R=75分）のみ。
     パート別は一般的に推奨されている配分で、合計が75分になるよう組んである */

export const TOEIC_PARTS = [
  { id: 'p5',  label: 'Part 5', name: '短文穴埋め',     minutes: 10, questions: 30 },
  { id: 'p6',  label: 'Part 6', name: '長文穴埋め',     minutes: 10, questions: 16 },
  { id: 'p7s', label: 'P7 1文書', name: 'シングルパッセージ', minutes: 29, questions: 29 },
  { id: 'p7d', label: 'P7 2文書', name: 'ダブルパッセージ',   minutes: 10, questions: 10 },
  { id: 'p7t', label: 'P7 3文書', name: 'トリプルパッセージ', minutes: 16, questions: 15 },
  { id: 'p7',  label: 'Part 7 全体', name: '読解ぜんぶ',     minutes: 55, questions: 54 },
  { id: 'r',   label: 'R全体',  name: 'Part 5〜7',      minutes: 75, questions: 100 },
  { id: 'l',   label: 'L全体',  name: 'Part 1〜4（音声進行）', minutes: 45, questions: 100, fixed: true },
];

export const EIKEN_GRADES = [
  { id: 'g1',  label: '1級',      rw: 100, listening: 35 },
  { id: 'gp1', label: '準1級',    rw: 90,  listening: 30 },
  { id: 'g2',  label: '2級',      rw: 85,  listening: 25 },
  { id: 'gp2p',label: '準2級+',   rw: 85,  listening: 25 },
  { id: 'gp2', label: '準2級',    rw: 80,  listening: 25 },
  { id: 'g3',  label: '3級',      rw: 65,  listening: 25 },
];

/* 1問あたりの目安（秒）。問題数がないものは出さない */
export const perQuestionSeconds = (minutes, questions) =>
  questions ? Math.round((minutes * 60) / questions) : null;

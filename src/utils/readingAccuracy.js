const normalizeWord = (w) => w.toLowerCase().replace(/[^a-z']/g, '');

// 期待する英文(expectedText)と文字起こし結果(spokenText)を単語単位でLCS（最長共通部分列）アルゴリズムで比較し、
// 読み飛ばし・誤読を検出する。語順を保ったまま「読めた単語」だけを一致とみなす。
export function scoreReadingAccuracy(expectedText, spokenText) {
  const expected = (expectedText || '').split(/\s+/).filter(Boolean);
  const spoken = (spokenText || '').split(/\s+/).filter(Boolean).map(normalizeWord);
  const expectedNorm = expected.map(normalizeWord);

  const n = expectedNorm.length;
  const m = spoken.length;

  if (n === 0) return { words: [], accuracy: 0 };
  if (m === 0) return { words: expected.map(text => ({ text, matched: false })), accuracy: 0 };

  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (expectedNorm[i - 1] && expectedNorm[i - 1] === spoken[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const matched = new Array(n).fill(false);
  let i = n, j = m;
  while (i > 0 && j > 0) {
    if (expectedNorm[i - 1] === spoken[j - 1]) {
      matched[i - 1] = true;
      i--; j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  const matchCount = matched.filter(Boolean).length;
  const accuracy = Math.round((matchCount / n) * 100);
  return { words: expected.map((text, idx) => ({ text, matched: matched[idx] })), accuracy };
}

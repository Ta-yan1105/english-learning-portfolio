/* 計測パネルの共通外装（学習記録フォーム・ストップウォッチで共有）
   白いカードの上に置くため、色は淡いインディゴに抑えて調和させる */

export const hud = {
  label:  '#9aa2c4', // 小さな見出し
  ink:    '#334155', // 本文
  line:   '#e6e9f6', // 枠線・区切り
  track:  '#eceefa', // バーの地色
  chip:   '#f5f7fd', // チップの地色
  chipIn: '#c9cfe8', // チップの枠線
};

export const hudPanelStyle = (isMobile) => ({
  position: 'relative',
  padding: isMobile ? '14px 12px' : '18px 22px',
  borderRadius: '22px',
  border: `1.5px solid ${hud.line}`,
  backgroundImage: `
    linear-gradient(rgba(99,102,241,0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(99,102,241,0.045) 1px, transparent 1px),
    radial-gradient(ellipse at 15% -10%, rgba(129,140,248,0.16) 0%, transparent 60%),
    linear-gradient(160deg, #fcfdff 0%, #f3f5fd 55%, #fbfcff 100%)
  `,
  backgroundSize: '24px 24px, 24px 24px, 100% 100%, 100% 100%',
  boxShadow: '0 10px 28px rgba(30,27,75,0.07), inset 0 1px 0 #ffffff',
  overflow: 'hidden',
  boxSizing: 'border-box',
  textAlign: 'left',
});

/* 点滅ランプ付きのパネル見出し */
export const HudHeading = ({ text, dot = '#818cf8', isMobile = false }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: isMobile ? '14px' : '16px' }}>
    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: dot, boxShadow: `0 0 7px ${dot}`, animation: 'hudPulse 1.8s ease-in-out infinite' }}/>
    <span style={{ fontSize: '10px', fontWeight: '900', letterSpacing: '0.22em', color: hud.label }}>{text}</span>
  </div>
);

/* パネル内の区切り線 */
export const HudDivider = ({ margin = '16px 0' }) => (
  <div style={{ height: '1px', margin, background: `linear-gradient(90deg, transparent, ${hud.chipIn}, transparent)` }}/>
);

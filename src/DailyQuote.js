import React, { useState } from 'react';
import { quotesData } from './quotes_data'; // 365日分のデータを読み込み

export default function DailyQuote() {
  const [currentQuote, setCurrentQuote] = useState(quotesData[0]);

  const drawRandomQuote = () => {
    const randomIndex = Math.floor(Math.random() * quotesData.length);
    setCurrentQuote(quotesData[randomIndex]);
  };

  return (
    <div style={{ width: '100%', padding: '0 0 20px 0', fontFamily: 'sans-serif', boxSizing: 'border-box' }}>
      <div style={{ 
        width: '100%', 
        backgroundColor: '#ffffff', 
        borderRadius: '24px', 
        boxShadow: '0 10px 30px rgba(0,0,0,0.08)', 
        overflow: 'hidden',
        textAlign: 'left'
      }}>
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          backgroundColor: '#1E3A8A', 
          color: 'white',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%)', borderRadius: '50%' }}></div>

          <div style={{ 
            flex: '1 1 200px', 
            padding: '30px', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            zIndex: 1
          }}>
            <img 
              src={currentQuote.image} 
              alt={currentQuote.author} 
              style={{ 
                width: '180px', 
                height: '180px', 
                borderRadius: '50%', 
                objectFit: 'cover', 
                border: '6px solid rgba(255, 255, 255, 0.15)', 
                boxShadow: '0 12px 24px rgba(0,0,0,0.4)'
              }} 
            />
          </div>

          <div style={{ 
            flex: '2 1 400px', 
            padding: '40px 30px', 
            display: 'flex', 
            flexDirection: 'column',
            justifyContent: 'center',
            zIndex: 1
          }}>
            <h2 style={{ margin: 0, fontSize: '2.2rem', fontStyle: 'italic', lineHeight: '1.3', fontWeight: '900', textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>
              "{currentQuote.english}"
            </h2>
            <p style={{ margin: '15px 0 0 0', fontSize: '1.2rem', color: '#93C5FD', fontWeight: 'bold' }}>
              — {currentQuote.author}
            </p>
          </div>
        </div>

        <div style={{ padding: '30px' }}>
          <p style={{ fontSize: '1.3rem', fontWeight: '900', color: '#1e293b', marginBottom: '10px', lineHeight: '1.5' }}>
            {currentQuote.japanese}
          </p>
          <p style={{ fontSize: '1rem', color: '#64748b', marginBottom: '25px', fontWeight: 'bold' }}>
            💡 {currentQuote.info}
          </p>
          
          <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '16px', borderLeft: '6px solid #4f46e5', fontSize: '1rem', color: '#334155', lineHeight: '1.8', fontWeight: 'bold' }}>
            {/* エクセルから取得した深い解説を表示 */}
            {currentQuote.grammar.split('\n').map((line, index) => (
              <span key={index}>{line}<br /></span>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '30px' }}>
            <button 
              onClick={drawRandomQuote} 
              style={{ 
                padding: '16px 32px', 
                fontSize: '1.1rem', 
                fontWeight: '900', 
                color: 'white', 
                backgroundColor: '#4f46e5', 
                border: 'none', 
                borderRadius: '50px', 
                cursor: 'pointer',
                boxShadow: '0 8px 15px rgba(79, 70, 229, 0.3)'
              }}
            >
              ✨ 次の名言
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
const xlsx = require('xlsx');
const fs = require('fs');
const axios = require('axios'); // より強力な通信ツール

const filePath = '英語名言.xlsx';

// サーバーに負荷をかけないための待機関数
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWikipediaImage(authorName) {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(authorName)}&prop=pageimages&format=json&pithumbsize=250`;
    
    // Wikipediaに弾かれないよう「身分証（User-Agent）」を提示してアクセス
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'EnglishLearningApp/1.0 (learning-portfolio)' }
    });
    
    const pages = response.data.query.pages;
    const pageId = Object.keys(pages)[0];
    
    // ページが存在し、かつ画像がある場合
    if (pageId !== "-1" && pages[pageId] && pages[pageId].thumbnail) {
      return pages[pageId].thumbnail.source;
    }
  } catch (error) {
    // 通信エラー時
  }
  return null;
}

async function convertData() {
  try {
    console.log('🚀 Excelを読み込み、Wikipediaから顔写真を自動取得します...');
    
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);
    
    const formattedData = [];
    let successCount = 0;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const english = (row['名言（英語）'] || '').toString().trim();
      if (!english) continue;

      const japanese = (row['名言の日本語訳'] || '').toString().trim();
      const author = (row['発言者'] || '').toString().trim();
      const info = (row['発言者の情報'] || '').toString().trim();
      const grammar = (row['文法解説'] || '').toString().trim();
      
      let imageUrl = (row['写真JPEG'] || '').toString().trim();

      // ★修正ポイント：空欄だけでなく「-」や「NaN」も無いものとして扱う
      if (!imageUrl || imageUrl === 'NaN' || imageUrl === '-') {
        console.log(`[${i + 1}/${data.length}] 🔍 ${author} を検索中...`);
        
        const wikiImage = await fetchWikipediaImage(author);
        
        if (wikiImage) {
          imageUrl = wikiImage;
          console.log(`  👉 ✅ 写真を発見！`);
          successCount++;
        } else {
          const authorForApi = author.replace(/\s+/g, '+');
          imageUrl = `https://ui-avatars.com/api/?name=${authorForApi}&background=random&color=fff&size=250`;
          console.log(`  👉 ❌ 写真なし（アイコンを生成します）`);
        }
        
        // Wikipediaのサーバーに優しくするため、0.1秒待機
        await sleep(100);
      }

      formattedData.push({
        english,
        japanese,
        author,
        info,
        grammar,
        image: imageUrl
      });
    }

    const fileContent = `export const quotesData = ${JSON.stringify(formattedData, null, 2)};\n`;
    fs.writeFileSync('src/quotes_data.js', fileContent, 'utf8');
    
    console.log(`\n🎉 大成功！ ${successCount}人の顔写真をWikipediaから取得し、全データをアプリに反映しました！`);

  } catch (error) {
    console.error('エラーが発生しました:', error.message);
  }
}

// 実行
convertData();
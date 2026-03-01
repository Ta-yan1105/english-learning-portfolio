const xlsx = require('xlsx');
const fs = require('fs');

// ★ Node.js 18以上であれば fetch が標準で使えます
const filePath = '英語名言.xlsx';

// WikipediaのAPIを使って顔写真を自動取得する関数
async function fetchWikipediaImage(authorName) {
  try {
    // 英語版Wikipediaから人物の画像（幅250px）を検索
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(authorName)}&prop=pageimages&format=json&pithumbsize=250`;
    const response = await fetch(url);
    const data = await response.json();
    
    const pages = data.query.pages;
    const pageId = Object.keys(pages)[0];
    
    // 画像が見つかった場合はそのURLを返す
    if (pages[pageId] && pages[pageId].thumbnail) {
      return pages[pageId].thumbnail.source;
    }
  } catch (error) {
    // エラー時は何もしない
  }
  return null;
}

async function convertData() {
  try {
    console.log('⏳ Excelを読み込み、Wikipediaから顔写真を自動取得しています...（数十秒かかります）');
    
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);
    
    const formattedData = [];

    // 1行ずつデータを処理
    for (const row of data) {
      const english = (row['名言（英語）'] || '').toString().trim();
      if (!english) continue; // 英語が空の行はスキップ

      const japanese = (row['名言の日本語訳'] || '').toString().trim();
      const author = (row['発言者'] || '').toString().trim();
      const info = (row['発言者の情報'] || '').toString().trim();
      const grammar = (row['文法解説'] || '').toString().trim();
      
      // ① まずはExcelにURLが直接貼られているかチェック
      let imageUrl = (row['写真JPEG'] || '').toString().trim();

      // ② Excelが空欄なら、Wikipediaから自動で探してくる！
      if (!imageUrl || imageUrl === 'NaN') {
        const wikiImage = await fetchWikipediaImage(author);
        
        if (wikiImage) {
          imageUrl = wikiImage;
        } else {
          // ③ Wikipediaにも写真がない人物の場合は、イニシャルアイコンを自動生成
          const authorForApi = author.replace(/\s+/g, '+');
          imageUrl = `https://ui-avatars.com/api/?name=${authorForApi}&background=random&color=fff&size=250`;
        }
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
    
    console.log('🎉 大成功！365日分のデータと写真が src/quotes_data.js に完璧に反映されました！');

  } catch (error) {
    console.error('エラーが発生しました:', error);
  }
}

// 実行
convertData();
const xlsx = require('xlsx');
const fs = require('fs');

// 読み込むExcelファイルの名前
const filePath = '英語名言.xlsx';

try {
  // Excelファイルの読み込み
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0]; // 1つ目のシートを選択
  const sheet = workbook.Sheets[sheetName];
  
  // Excelのデータをプログラムで扱いやすい形（JSON）に変換
  const data = xlsx.utils.sheet_to_json(sheet);
  
  const formattedData = data.map(row => {
    // 1列目のヘッダー名に合わせてデータを抽出（空の場合は空文字に）
    const english = (row['名言（英語）'] || '').toString().trim();
    const japanese = (row['名言の日本語訳'] || '').toString().trim();
    const author = (row['発言者'] || '').toString().trim();
    const info = (row['発言者の情報'] || '').toString().trim();
    const grammar = (row['文法解説'] || '').toString().trim();
    const photoUrl = (row['写真JPEG'] || '').toString().trim();
    
    // 写真がない場合のイニシャルアイコン生成
    const authorForApi = author.replace(/\s+/g, '+');
    const imageUrl = (!photoUrl || photoUrl === 'NaN') 
      ? `https://ui-avatars.com/api/?name=${authorForApi}&background=random&color=fff&size=250`
      : photoUrl;
      
    return {
      english,
      japanese,
      author,
      info,
      grammar,
      image: imageUrl
    };
  }).filter(item => item.english !== ''); // 英語の名言が空の行はスキップ

  // src/quotes_data.js に書き出すためのテキストを作成
  const fileContent = `export const quotesData = ${JSON.stringify(formattedData, null, 2)};\n`;
  
  fs.writeFileSync('src/quotes_data.js', fileContent, 'utf8');
  console.log('🎉 大成功！Excelファイル（英語名言.xlsx）から全データを src/quotes_data.js に反映しました！');
  
} catch (error) {
  console.error(`エラー: ${filePath} の読み込みに失敗しました。ファイル名が正しいか、またはExcelファイルが開いたままになっていないか確認してください。`);
  console.error(error);
}
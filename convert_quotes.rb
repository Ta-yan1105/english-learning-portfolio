require 'csv'
require 'json'

file_path = 'quotes.csv' # ※ファイル名を quotes.csv に変更した場合

unless File.exist?(file_path)
  puts "エラー: #{file_path} が見つかりません。"
  exit
end

quotes = CSV.read(file_path, headers: true)

formatted_data = quotes.map do |row|
  english = row['名言（英語）'].to_s
  
  # ★エクセルの「文法解説」列から直接読み込むように変更！
  grammar = row['文法解説'].to_s
  
  # もしエクセルに解説がまだ書かれていない場合の処理
  if grammar.empty?
    grammar = "※ここに深い文法解説が入ります。エクセルの「文法解説」列にテキストを入力してください。"
  end

  author_name = row['発言者'].to_s.strip.gsub(/\s+/, '+')
  image_url = "https://ui-avatars.com/api/?name=#{author_name}&background=random&color=fff&size=150"

  {
    english: english,
    japanese: row['名言の日本語訳'].to_s,
    author: row['発言者'].to_s,
    info: row['発言者の情報'].to_s,
    grammar: grammar,
    image: image_url
  }
end

File.open("src/quotes_data.js", "w") do |file|
  file.puts "export const quotesData = "
  file.puts JSON.pretty_generate(formatted_data)
  file.puts ";"
end

puts "変換完了！深い文法解説を読み込む準備が整いました！"
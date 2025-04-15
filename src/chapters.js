const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');

// 获取项目根目录（src的上一级目录）
const rootDir = path.resolve(__dirname, '..');
function splitChapters(name) {
  // 要处理的文件路径
  const inputFile = path.join(rootDir, 'novel', `${name}.txt`);
  const outputDir = path.join(rootDir, `data/${name}/chapters`);

  // 确保输出目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    // 以二进制方式读取文件
    const buffer = fs.readFileSync(inputFile);
    
    // 使用 GB2312 编码解码
    const content = iconv.decode(buffer, 'gb2312');

    // 使用正则按"第X章"进行分割
    const chapters = content.split(/(?=^第\d+章)/m);

    chapters.forEach((chapter, index) => {
      const match = chapter.match(/^第\d+章/);
      if (match) {
        const chapterName = match[0].replace(/\s/g, '');
        const filename = `${chapterName}.txt`;
        const filePath = path.join(outputDir, filename);
        // 使用 GB2312 编码保存文件
        const chapterBuffer = iconv.encode(chapter.trim(), 'utf-8');
        fs.writeFileSync(filePath, chapterBuffer);
        console.log(`已保存: ${filename}`);
      }
    });

    console.log('✅ 所有章节已分割完成！');
  } catch (error) {
    console.error('处理文件时出错:', error.message);
  }
}

module.exports = { splitChapters };
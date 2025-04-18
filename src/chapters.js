const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');

// 获取项目根目录（src的上一级目录）
const rootDir = path.resolve(__dirname, '..');

// 中文数字映射
const chineseNumberMap = {
  '零': '0', '一': '1', '二': '2', '三': '3', '四': '4',
  '五': '5', '六': '6', '七': '7', '八': '8', '九': '9',
  '十': '10', '百': '100', '千': '1000', '万': '10000'
};

// 支持的编码列表
const ENCODINGS = ['utf8', 'gb2312', 'gbk', 'big5'];

function detectEncoding(buffer) {
  for (const encoding of ENCODINGS) {
    try {
      const testContent = iconv.decode(buffer, encoding);
      // 如果解码成功且包含中文字符，则认为是正确的编码
      if (/[\u4e00-\u9fa5]/.test(testContent)) {
        return encoding;
      }
    } catch (e) {
      continue;
    }
  }
  return 'utf8'; // 默认返回utf8
}

// 将中文数字转换为阿拉伯数字
function convertChineseNumber(chineseNum) {
  let result = '';
  let temp = '';
  let number = 0;
  
  for (let i = 0; i < chineseNum.length; i++) {
    const char = chineseNum[i];
    if (chineseNumberMap[char]) {
      if (['十', '百', '千', '万'].includes(char)) {
        if (temp === '') {
          number += chineseNumberMap[char];
        } else {
          number += parseInt(temp) * chineseNumberMap[char];
        }
        temp = '';
      } else {
        temp += chineseNumberMap[char];
      }
    } else {
      if (temp !== '') {
        number += parseInt(temp);
        temp = '';
      }
      result += number > 0 ? number.toString() : '';
      number = 0;
      result += char;
    }
  }
  
  if (temp !== '') {
    number += parseInt(temp);
  }
  if (number > 0) {
    result += number.toString();
  }
  
  return result;
}

function splitChapters(name) {
  // 要处理的文件路径
  const inputFile = path.join(rootDir, 'novel', `${name}.txt`);
  const outputDir = path.join(rootDir, `data/${name}/chapters`);

  // 确保输出目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    // 检查输入文件是否存在
    if (!fs.existsSync(inputFile)) {
      throw new Error(`文件不存在: ${inputFile}`);
    }

    // 以二进制方式读取文件
    const buffer = fs.readFileSync(inputFile);
    
    // 自动检测文件编码
    // const encoding = detectEncoding(buffer);
    // console.log(`检测到文件编码: ${encoding}`);
    const encoding = 'gb2312';
    
    // 解码文件内容
    const content = iconv.decode(buffer, encoding);

    // 使用更完善的正则表达式匹配章节
    const chapterPattern = /^第[零一二三四五六七八九十百千万\d]+[章节回]/m;
    const chapters = content.split(new RegExp(`(?=${chapterPattern.source})`, 'm'));

    let validChapters = 0;
    chapters.forEach((chapter, index) => {
      const match = chapter.match(chapterPattern);
      if (match) {
        const originalChapterName = match[0].replace(/\s/g, '');
        // 转换章节名中的中文数字为阿拉伯数字
        const chapterName = convertChineseNumber(originalChapterName);
        const filename = `${chapterName}.txt`;
        const filePath = path.join(outputDir, filename);
        
        // 清理章节内容
        const cleanContent = chapter.trim();
        if (cleanContent.length > 0) {
          // 使用 utf-8 编码保存文件
          const chapterBuffer = iconv.encode(cleanContent, 'utf-8');
          fs.writeFileSync(filePath, chapterBuffer);
          console.log(`已保存: ${filename} (原章节名: ${originalChapterName})`);
          validChapters++;
        }
      }
    });

    if (validChapters === 0) {
      throw new Error('未找到任何章节，请检查文件格式是否正确');
    }

    console.log(`✅ 成功分割 ${validChapters} 个章节！`);
  } catch (error) {
    console.error('处理文件时出错:', error.message);
    throw error; // 重新抛出错误以便调用者处理
  }
}

module.exports = { splitChapters };
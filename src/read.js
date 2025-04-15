const fs = require('fs');
const path = require('path');
const OpenAI = require("openai");
require('dotenv').config();

// 获取项目根目录（src的上一级目录）
const rootDir = path.resolve(__dirname, '..');

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

// 读取同级目录下的所有 TXT 文件作为章节
function loadChaptersFromFiles(inputDir) {
  const chapters = [];
  const files = fs.readdirSync(inputDir).filter(file => file.endsWith('.txt'));

  files.forEach(file => {
    const chapterNumber = parseInt(file.match(/第(\d+)章/)[1]); // 从文件名提取章节号
    const content = fs.readFileSync(path.join(inputDir, file), 'utf-8');
    
    // 尝试从内容中提取章节名
    let chapterName = '';
    const titleMatch = content.match(/第\d+章\s*([^\n]+)/);
    if (titleMatch && titleMatch[1]) {
      chapterName = titleMatch[1].trim();
    }
    
    chapters.push({
      chapterNumber,
      chapterName,
      content
    });
  });

  // 按章节号排序
  return chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
}

// 分析单章的函数
async function analyzeChapter(chapter) {
  try {
    const prompt = `
你是一名专业的小说分析师，从读者的角度分析以下小说章节内容，并按要求提取信息。请以清晰、结构化的方式回答，语言简洁但详尽。

**章节内容**：
${chapter.content}

**要求**：
1. **拆解内容**：总结本章的主要情节,把握剧情发展脉络。
2. **人物分析**：
   - 列出本章出现的所有人物。
   - 分析每个人的性格特征（基于行为、对话等）。
   - 描述人物之间的关系（明确或推测）。
3. **读者视角**：
   - 提取本章的**伏笔**（可能暗示未来情节的细节）。

**输出格式**：
- 主要情节：...
- 人物分析：
  - 人物列表（性格特征及人物关系）：...
- 读者视角：
  - 伏笔：...

请直接提供分析结果，不要复述要求或多余说明。
`;

    const completion = await client.chat.completions.create({
        model: "moonshot-v1-auto",         
        messages: [{ 
            role: "system", content: "你是一名专业的小说分析师，擅长从读者视角拆解和分析小说内容。",
            role: "user", content: prompt
        }],
        temperature: 0.1
    });

    return {
      chapterNumber: chapter.chapterNumber,
      chapterName: chapter.chapterName,
      analysis: completion.choices[0].message.content.trim(),
      status: 'success'
    };
  } catch (error) {
    console.error(`分析章节 ${chapter.chapterNumber} 失败:`, error.message);
    return {
      chapterNumber: chapter.chapterNumber,
      chapterName: chapter.chapterName,
      analysis: null,
      status: 'failed',
      error: error.message
    };
  }
}

// 将结果写入 TXT 文件的函数
function writeResultsToTxt(results, txtPath) {
    let txtContent = '小说章节分析结果\n\n';
    
    results.forEach(result => {
      txtContent += `第${result.chapterNumber}章`;
      if (result.chapterName) {
        txtContent += ` ${result.chapterName}`;
      }
      txtContent += '\n';
      
      if (result.status === 'success') {
        txtContent += `${result.analysis}\n`;
      } else {
        txtContent += `分析失败：${result.error}\n`;
      }
      txtContent += '\n';
    });

    fs.writeFileSync(txtPath, txtContent, 'utf-8');
}

// 主函数
async function readBook(name, batchSize = 2, mergeSize = 4) {
  // 要处理的文件路径
  const inputDir = path.join(rootDir, `data/${name}/chapters`);
  const outputDir = path.join(rootDir, `data/${name}/detail`);
  
  // 确保输出目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('加载章节文件...');
  const chapters = loadChaptersFromFiles(inputDir);
  if (chapters.length === 0) {
    console.log('未找到章节文件！请确保同级目录下有以"第X章.txt"命名的文件。');
    return;
  }
  console.log(`共找到 ${chapters.length} 个章节，开始批量分析...`);

  const results = [];
  let processedCount = 0;
  let count = 0;
  
  // 分批处理，控制并发请求数量
  for (let i = 0; i < chapters.length; i += batchSize) {
    const batch = chapters.slice(i, i + batchSize);
    console.log(`正在分析章节 ${i + 1} 到 ${Math.min(i + batchSize, chapters.length)}...`);
    
    try {
      const batchResults = await Promise.all(
        batch.map(chapter => analyzeChapter(chapter))
      );
      
      results.push(...batchResults);
      processedCount += batchResults.length;
      
      // 每 mergeSize 个章节保存一次结果
      if (processedCount >= mergeSize || i + batchSize >= chapters.length) {
        count++;
        const saveStart = Math.max(0, results.length - processedCount);
        const saveEnd = results.length;
        const resultsToSave = results.slice(saveStart, saveEnd);
        
        console.log(`正在保存第 ${saveStart + 1} 到 ${saveEnd} 章的分析结果...`);
        const mergeName = `${saveStart + 1}-${saveEnd}章`;
        
        // 保存 JSON 格式
        const jsonPath = path.join(outputDir, `${mergeName}.json`);
        fs.writeFileSync(jsonPath, JSON.stringify(resultsToSave, null, 2));
        
        // 保存 TXT 格式
        const txtPath = path.join(outputDir, `${count}.txt`);
        writeResultsToTxt(resultsToSave, txtPath);
        
        processedCount = 0;
      }
      
      // 添加延迟，防止 API 请求过快
      if (i + batchSize < chapters.length) {
        console.log('等待 1 秒以避免并发限制...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

    } catch (error) {
      console.error(`处理批次 ${i + 1} 到 ${Math.min(i + batchSize, chapters.length)} 时出错:`, error);
      // 保存已处理的结果
      if (results.length > 0) {
        const mergeName = `error_save_${i}`;
        const jsonPath = path.join(outputDir, `${mergeName}.json`);
        fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
        writeResultsToTxt(results, outputDir, `${mergeName}.txt`);
      }
      throw error; // 重新抛出错误，让调用者知道发生了错误
    }
  }

  console.log('所有章节分析完成！');
}

module.exports = { readBook };
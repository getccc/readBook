const fs = require('fs');
const path = require('path');
const zhipuAI = require('./zhipuAI');
require('dotenv').config();

// 获取项目根目录（src的上一级目录）
const rootDir = path.resolve(__dirname, '../..');

const zhipu = new zhipuAI(process.env.ZHIPU_API_KEY);

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

    const completion = await zhipu.chatCompletions({
      // model: 'glm-4-plus',
      model: 'glm-4-air',
      messages: [
          { role: 'system', content: '你是一名专业的小说分析师，擅长从读者视角拆解和分析小说内容。' },
          { role: 'user', content: prompt }
      ],
      temperature: 0.05,
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
async function readBook(name, batchSize = 5, mergeSize = 30) {
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
        
        // 获取实际的章节号范围
        const startChapter = resultsToSave[0].chapterNumber;
        const endChapter = resultsToSave[resultsToSave.length - 1].chapterNumber;
        
        console.log(`正在保存第 ${startChapter} 到 ${endChapter} 章的分析结果...`);
        
        // 保存 JSON 格式
        const jsonPath = path.join(outputDir, `${startChapter}-${endChapter}章.json`);
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
        const startChapter = results[0].chapterNumber;
        const endChapter = results[results.length - 1].chapterNumber;
        const mergeName = `error_save_${startChapter}-${endChapter}章`;
        const jsonPath = path.join(outputDir, `${mergeName}.json`);
        fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
        writeResultsToTxt(results, path.join(outputDir, `${mergeName}.txt`));
      }
      throw error; // 重新抛出错误，让调用者知道发生了错误
    }
  }

  console.log('所有章节分析完成！');
}

// 从 JSON 文件中加载章节数据,找到分析失败的章节
function loadJson(outputDir) {
  const allResults = [];
  const files = fs.readdirSync(outputDir).filter(file => file.endsWith('.json'));
  
  files.forEach(file => {
    const filePath = path.join(outputDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const results = JSON.parse(content);
    allResults.push(...results);
  });

  // 按章节号排序
  return allResults.sort((a, b) => a.chapterNumber - b.chapterNumber);
}

// 找到对应的txt章节文件
function loadTxt(chapterDir, chapterNumber) {
  const files = fs.readdirSync(chapterDir).filter(file => file.endsWith('.txt'));
  const targetFile = files.find(file => {
    const match = file.match(/第(\d+)章/);
    return match && parseInt(match[1]) === chapterNumber;
  });

  if (!targetFile) {
    throw new Error(`未找到第 ${chapterNumber} 章的 TXT 文件`);
  }

  const content = fs.readFileSync(path.join(chapterDir, targetFile), 'utf-8');
  let chapterName = '';
  const titleMatch = content.match(/第\d+章\s*([^\n]+)/);
  if (titleMatch && titleMatch[1]) {
    chapterName = titleMatch[1].trim();
  }

  return {
    chapterNumber,
    chapterName,
    content
  };
}

// 根据JSON结果重新生成TXT文件
function writeForJson(outputDir, results, mergeSize = 30) {
  // 确保输出目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 按章节号排序
  const sortedResults = results.sort((a, b) => a.chapterNumber - b.chapterNumber);
  
  // 更新所有JSON文件
  const files = fs.readdirSync(outputDir).filter(file => file.endsWith('.json'));
  files.forEach(file => {
    const filePath = path.join(outputDir, file);
    fs.unlinkSync(filePath);
  });

  let count = 0;
  console.log('开始重新生成结果文件...');

  // 重新生成JSON文件
  for (let i = 0; i < sortedResults.length; i += mergeSize) {
    count++;
    const batch = sortedResults.slice(i, i + mergeSize);
    const startChapter = batch[0].chapterNumber;
    const endChapter = batch[batch.length - 1].chapterNumber;
    
    // 保存 JSON 格式
    const jsonPath = path.join(outputDir, `${startChapter}-${endChapter}章.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(batch, null, 2));
    console.log(`已保存 JSON 文件: ${startChapter}-${endChapter}章.json`);
    
    // 保存 TXT 格式
    const txtPath = path.join(outputDir, `${count}.txt`);
    writeResultsToTxt(batch, txtPath);
    console.log(`已保存 TXT 文件: ${count}.txt`);
  }

  console.log('所有结果文件重新生成完成！');
}

async function retryFailedChapters(name) {
  const chapterDir = path.join(rootDir, `data/${name}/chapters`);
  const outputDir = path.join(rootDir, `data/${name}/detail`);

  console.log('开始重试失败的章节...');
  
  // 加载所有JSON文件并找出失败的章节
  const allResults = loadJson(outputDir);
  const failedChapters = allResults.filter(res => res.status === 'failed');
  
  if (failedChapters.length === 0) {
    console.log('没有发现失败的章节，无需重试。');
    return;
  }

  console.log(`发现 ${failedChapters.length} 个失败的章节，开始重试...`);

  // 重试失败的章节
  for (const failedChapter of failedChapters) {
    console.log(`正在重试第 ${failedChapter.chapterNumber} 章...`);
    try {
      const chapter = loadTxt(chapterDir, failedChapter.chapterNumber);
      const result = await analyzeChapter(chapter);
      
      // 更新结果
      const index = allResults.findIndex(r => r.chapterNumber === failedChapter.chapterNumber);
      if (index !== -1) {
        allResults[index] = result;
      }
      
      // 添加延迟，防止 API 请求过快
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`重试第 ${failedChapter.chapterNumber} 章失败:`, error.message);
    }
  }

  // 重新生成所有文件
  console.log('正在重新生成结果文件...');
  writeForJson(outputDir, allResults);
  
  console.log('重试完成！');
}

module.exports = { readBook, retryFailedChapters };
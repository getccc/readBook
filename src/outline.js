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

// 读取文件
function loadChaptersFromFiles(inputDir) {
  try {
    const details = [];
    const files = fs.readdirSync(inputDir).filter(file => file.endsWith('.txt'));

    if (files.length === 0) {
      throw new Error(`在目录 ${inputDir} 中未找到任何 .txt 文件`);
    }

    files.forEach(file => {
      const number = parseInt(file);
      if (isNaN(number)) {
        throw new Error(`文件名 ${file} 不是有效的数字`);
      }
      
      const content = fs.readFileSync(path.join(inputDir, file), 'utf-8');
      if (!content.trim()) {
        throw new Error(`文件 ${file} 内容为空`);
      }
    
      details.push({
        number,
        content
      });
    });

    // 排序
    return details.sort((a, b) => a.number - b.number);
  } catch (error) {
    console.error('加载章纲文件失败:', error.message);
    throw error;
  }
}

// 分析细纲并提取事件脉络
async function analyzeOutline(detail) {
  try {
    const prompt = `
你是一名专业的小说分析师，擅长从章纲中提取事件脉络、人物关系和剧情发展脉络。请从读者的角度，分析以下小说多个章节提炼内容，按序按结构的组成，并按要求提取信息。回答需结构化、语言简洁但详尽：

**章纲内容**：
${detail.content}

**要求**：
1. **合并内容**：
   - 将每一章的主要情节合并成一个整体,对环境、心理、外貌、语言描写进行简化/概括。
   - 对事件进行提取并总结（可以有多个事件，依次例举）,关注推动剧情发展的事件（起因、经过、高潮、结果）
2. **合并人物**：
   - 分析整理出现过的所有人物的性格特征（基于行为、对话等）。
   - 将所有人物合并去重。
   - 区分出主角，配角，龙套。
3. **读者视角**：
   - 根据剧情发展脉络，提取出作者前后章节照应的伏笔（伏笔要简练，只关注主角和主要配角的伏笔）。

**输出格式**：
- 主要情节：...
- 事件脉络：
  - 事件1：...
  - 事件2：...
  ...
- 人物分析：
  - 人物列表（角色，性格特征及人物关系）：...
- 读者视角：
  - 伏笔：...
`;

    const completion = await client.chat.completions.create({
      model: "moonshot-v1-32k",
      messages: [{
        role: "system",
        content: "你是一名专业的小说分析师，擅长从章纲中提取故事脉络和事件发展。"
      }, {
        role: "user",
        content: prompt
      }],
      temperature: 0,
      max_tokens: 8000
    });

    return {
      status: 'success',
      content: completion.choices[0].message.content.trim(),
      message: '该阶段的故事脉络分析完成'
    };
  } catch (error) {
    console.error('分析细纲失败:', error.message);
    return {
      status: 'failed',
      error: error.message
    };
  }
}

// 保存分析结果
function saveAnalysisResult(outputDir, count, content) {
  try {
    const outputPath = path.join(outputDir, `${count}.txt`);
    fs.writeFileSync(outputPath, content.trim(), 'utf-8');
    console.log(`已保存分析结果到: ${outputPath}`);
  } catch (error) {
    console.error('保存分析结果失败:', error.message);
    throw error;
  }
}

// 主函数
async function readDeail(name, batchSize = 2) {
  try {
    // 要处理的文件路径
    const inputDir = path.join(rootDir, `data/${name}/detail`);
    const outputDir = path.join(rootDir, `data/${name}/outline`);

    // 确保输出目录存在
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log('加载章纲文件...');
    const details = loadChaptersFromFiles(inputDir);
    
    let count = 0;
    // 分批处理，控制并发请求数量
    for (let i = 0; i < details.length; i += batchSize) {
      const batch = details.slice(i, i + batchSize);
      console.log(`正在分析细纲 ${i + 1} 到 ${Math.min(i + batchSize, details.length)}...`);
      
      const batchResults = await Promise.all(
        batch.map(detail => analyzeOutline(detail))
      );

      // 将分析结果保存到新文件
      batchResults.forEach(result => {
        if (result.status === 'success') {
          count++;
          saveAnalysisResult(outputDir, count, result.content);
        } else {
          console.error(`分析失败: ${result.error}`);
        }
      });
      
      // 添加延迟，防止 API 请求过快
      if (i + batchSize < details.length) {
        console.log('等待 1 秒以避免并发限制...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('所有章纲分析完成！');
  } catch (error) {
    console.error('处理章纲失败:', error.message);
    throw error;
  }
}

module.exports = { readDeail };
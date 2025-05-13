const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {

  const browser = await puppeteer.launch({
    headless: true, // 无头模式
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled', // 隐藏 WebDriver 特征
      '--disable-web-security', // 禁用 Web 安全策略
      '--window-size=1920,1080', // 设置窗口大小
    ],
    defaultViewport: { width: 1920, height: 1080 }, // 设置视口
    executablePath: null, // 如果有特定的 Chrome 路径，可以设置
  });

  const page = await browser.newPage();

  // 设置用户代理
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');

  // 隐藏 WebDriver 特征
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
  });

  // 添加额外的 Headers
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  });

  try {
    // 访问目标页面
    await page.goto('https://gmgn.ai/?chain=sol&0bu=1&0di=1', {
      waitUntil: 'domcontentloaded', // 等待网络空闲，确保动态内容加载
      timeout: 120000, // 超时时间 120 秒
    });

    // 模拟用户行为：滚动页面
    console.log('模拟用户行为：滚动页面...');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await delay(5000); // 等待 5 秒，确保动态加载

    // 等待 .g-table-container 元素加载完成
    console.log('等待 .g-table-container 元素加载...');
    await page.waitForSelector('.g-table-container', { timeout: 180000 });

    // 检查是否存在骨架屏
    const hasSkeleton = await page.evaluate(() => {
      return !document.querySelector('.g-table-container');
    });
    if (hasSkeleton) {
      console.log('骨架屏仍存在，等待数据加载...');
      await page.waitForFunction(
        () => document.querySelector('.g-table-container'),
        { timeout: 180000 }
      );
    }

    // 获取页面 HTML
    const html = await page.content();

    // 保存 HTML 到文件
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputFile = path.join(outputDir, 'gmgn.html');
    fs.writeFileSync(outputFile, html);

    // 解析 HTML
    const tableContainer = await page.$('.g-table-container');
    if (!tableContainer) {
      console.log('未找到 .g-table-container 元素，检查选择器或数据是否加载。');
      return;
    }
    console.log('页面获取成功');
    // 提取表头
    const headers = await page.$$eval('.g-table-header', (divs) => {
      // 确保至少有一个 .g-table-header 元素
      if (!divs.length) return [];
      // 选择第一个 .g-table-header 内的表格头
      const headerCells = divs[0].querySelectorAll('thead > tr > th');
      // 映射每个 th 元素，提取文本内容
      return Array.from(headerCells).map(cell => {
        // 查找包含文本的 div 或 span，处理可能的嵌套结构
        const textElement = cell.querySelector('div > div, div > span')?.textContent || '';
        return textElement.trim().replace(/\s+/g, ' ') || '未知';
      });
    });
    console.log('表头：', headers);

    // 提取数据行
    const dataRows = await page.$$eval('.g-table-tbody-virtual-holder-inner', (divs) => {
      if (!divs.length) return [];
    
      // 获取所有行
      const rows = divs[0].querySelectorAll('.g-table-row');
      if (!rows.length) return [];
    
      // 映射每一行，提取每个单元格的内容
      return Array.from(rows).map(row => {
        // 获取当前行的所有单元格（包括固定列）
        const cells = row.querySelectorAll('.g-table-cell, .g-table-cell-fix-left, .g-table-cell-fix-right');
        
        // 映射每个单元格，提取文本内容
        return Array.from(cells).map(cell => {
          // 优先尝试提取 <p> 内的文本
          let text = cell.querySelector('p')?.textContent?.trim().replace(/\s+/g, ' ') || '';
    
          // 如果 <p> 为空，尝试提取 <div> 内的文本（忽略样式类）
          if (!text) {
            const divText = Array.from(cell.querySelectorAll('div'))
              .filter(div => !div.className.includes('css-')) // 排除包含 css- 的 div
              .map(div => div.textContent.trim().replace(/\s+/g, ' '))
              .join(' ') || '';
            text = divText || text;
          }
    
          // 如果仍为空，使用整个 cell 的文本
          if (!text) {
            text = cell.textContent.trim().replace(/\s+/g, ' ') || '未知';
          }
    
          // 处理带颜色的百分比（如 +0.6%）
          const percentage = cell.querySelector('span[style*="color: rgb(160, 235, 170)"]')?.textContent?.trim() || '';
          if (percentage) text = percentage;
    
          // 处理安全检测列的多行数据
          if (cell.querySelector('.css-1i27l4i')) {
            const items = Array.from(cell.querySelectorAll('.css-2je2xw')).map(item => {
              const label = item.querySelector('.css-x83h7')?.textContent?.trim() || '';
              const value = item.querySelector('p:not(.css-x83h7), .css-1k6q6xs')?.textContent?.trim() || '';
              return `${label}: ${value}`;
            });
            text = items.join(' | ');
          }
    
          return text || '未知';
        });
      });
    });
    console.log('数据行：', dataRows);

  } catch (error) {
    console.error('爬取失败：', error.message);
  } finally {
    // 关闭浏览器
    await browser.close();
  }
})();
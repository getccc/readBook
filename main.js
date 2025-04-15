const chapters = require('./src/chapters');
const read = require('./src/read');
const outline = require('./src/outline');
require('dotenv').config();


const name = '盾击';

function main() {
  // 初始化
  // chapters.splitChapters(name);
  // read.readBook(name, 6, 30);

  // 重试
  // read.retryFailedChapters(name);
  
  // 大纲
  outline.readDeail(name);
}

main();
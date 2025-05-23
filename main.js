const chapters = require('./src/chapters');
const rest = require('./src/rest');
const read = require('./src/read');
const outline = require('./src/outline');

const zpread = require('./src/zhipu/zpread');
const zpline = require('./src/zhipu/zpline');

const dpread = require('./src/local/dpread');
require('dotenv').config();


const name = '测试';

function main() {

  // 分割章节
  // rest.splitChapters(name);


  // kimi
  // read.readBook(name, 6, 30);
  // read.retryFailedChapters(name); // 重试
  // outline.readDeail(name);   // 大纲


  // 智普AI
  // zpread.readBook(name);
  // zpline.readDeail(name);

  dpread.readBook(name);
}

main();
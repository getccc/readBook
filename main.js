const chapters = require('./src/chapters');
const read = require('./src/read');
const outline = require('./src/outline');
require('dotenv').config();


const name = '盾击';

function main() {
  chapters.splitChapters(name);
  read.readBook(name, 10, 30);
  outline.readDeail(name);
}

main();
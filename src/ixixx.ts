// this file is a translation of ixIxx.c from
// https://github.com/ucscGenomeBrowser/kent/blob/master/src/index/ixIxx/ixIxx.c
// into js the license of ixIxx.c file is reproduced below as the MIT license
// stipulates

/*
MIT License

Copyright (C) 2001 UC Regents

Permission is hereby granted, free of charge, to any person or non-commercial
entity obtaining a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including without
limitation the rights to use, copy, modify, merge, publish, distribute,
sublicense, and/or sell copies of the Software, and to permit persons to whom
the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
  */
import fs from "fs";
import { open } from "fs/promises";
import readline from "readline";
/* Characters that may be part of a word. */

const wordMiddleChars = [] as boolean[];
const wordBeginChars = [] as boolean[];

function isalpha(c: string) {
  return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z");
}

function isdigit(c: string) {
  return c >= "0" && c <= "9";
}

function isalnum(c: string) {
  return isalpha(c) || isdigit(c);
}

function initCharTables() {
  /* Initialize tables that describe characters. */
  for (let c = 0; c < 256; ++c) {
    if (isalnum(String.fromCharCode(c))) {
      wordBeginChars[c] = wordMiddleChars[c] = true;
    }
  }
  wordBeginChars["_".charCodeAt(0)] = wordMiddleChars["_".charCodeAt(0)] = true;
  wordMiddleChars[".".charCodeAt(0)] = true;
  wordMiddleChars["-".charCodeAt(0)] = true;
}

type Hash = any;

function indexWords(
  wordHash: Hash,
  itemId: string,
  words: string[],
  itemIdHash: Hash
) {
  itemIdHash[itemId] = true;
  words.forEach((word, wordIx) => {
    if (!wordHash[word]) {
      wordHash[word] = { name: word, val: [] };
    }
    wordHash[word].val.push({ itemId, wordIx });
  });
}

async function writeIndexHash(
  wordHash: {
    [key: string]: { name: string; val: { itemId: number; wordIx: number }[] };
  },
  fileName: string
) {
  let els = Object.values(wordHash).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  const file = await open(fileName, "w");

  els.forEach(({ name, val }) => {
    const entries = val
      .sort((a, b) => a.wordIx - b.wordIx)
      .map((pos: any) => `${pos.itemId},${pos.wordIx}`);
    file.writeFile(`${name} ${entries.join(" ")}\n`);
  });
  file.close();
}

async function makeIx(inFile: string, outIndex: string) {
  initCharTables();
  /* Create an index file. */
  const fileStream = fs.createReadStream(inFile);
  const rl = readline.createInterface({
    input: fileStream,
  });

  const wordHash = {};
  const itemIdHash = {};

  for await (const line of rl) {
    const [id, ...text] = line.toLowerCase().split(/\s/);
    indexWords(
      wordHash,
      id,
      text.filter((f) => !!f),
      itemIdHash
    );
  }

  writeIndexHash(wordHash, outIndex);
}

const prefixSize = 5;
let binSize = 64 * 1024;
function getPrefix(word: string) {
  return word.slice(0, prefixSize).padEnd(5, " ");
}

async function makeIxx(inIx: string, outIxx: string) {
  const fileStream = fs.createReadStream(inIx);
  const rl = readline.createInterface({
    input: fileStream,
  });
  const outFile = await open(outIxx, "w");

  let lastPrefix;
  let writtenPrefix;
  let writtenPos = -binSize;
  let startPrefixPos = 0;
  let bytes = 0;

  // loop over other line
  for await (const line of rl) {
    const [word] = line.split(/\s/);
    const curPrefix = getPrefix(word);
    if (curPrefix !== lastPrefix) {
      startPrefixPos = bytes;
    }

    if (bytes - writtenPos >= binSize && curPrefix !== writtenPrefix) {
      outFile.writeFile(
        `${curPrefix}${startPrefixPos
          .toString(16)
          .toUpperCase()
          .padStart(10, "0")}\n`
      );
      writtenPos = bytes;
      writtenPrefix = curPrefix;
    }
    lastPrefix = curPrefix;
    bytes += line.length + 1;
  }

  outFile.close();
}

/* ixIxx - Create indices for simple line-oriented file of format
 * <symbol> <free text>. */
export async function ixIxx(inText: string, outIx: string, outIxx: string) {
  await makeIx(inText, outIx);
  await makeIxx(outIx, outIxx);
}

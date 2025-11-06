'use strict';

const fs = require('fs');
const path = require('path');

const inputPath = path.resolve(__dirname, '..', '..', 'M5_quiz.txt');
const outputPath = path.resolve(__dirname, '..', 'public', 'data', 'm5_quiz.json');

function normalizeQuestion(raw) {
  return raw
    .replace(/^\d+\.\s*/, '')
    .replace(/[（(]\s*\d+(?:\.\d+)?\s*分\s*[）)]\s*$/, '')
    .trim();
}

function parseScore(raw) {
  const match = raw.match(/[（(]\s*(\d+(?:\.\d+)?)\s*分\s*[）)]/);
  return match ? Number(match[1]) : null;
}

function parseOptions(optionText) {
  const options = [];
  const pattern = /([A-Z])\.\s*(.+?)(?=(?:\s+[A-Z]\.)|$)/g;
  let match;
  while ((match = pattern.exec(optionText)) !== null) {
    const [, label, text] = match;
    options.push({ label, text: text.trim() });
  }
  return options;
}

function parseAnswer(line) {
  const match = line.match(/^答案:\s*([A-Z])\.\s*(.+)$/);
  if (!match) {
    throw new Error(`无法解析答案行: ${line}`);
  }
  return { label: match[1], text: match[2].trim() };
}

function toJson() {
  const raw = fs.readFileSync(inputPath, 'utf8');
  const blocks = raw
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  const questions = [];

  for (const block of blocks) {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    if (lines.length < 3) {
      continue;
    }

    const questionLine = lines[0];
    const score = parseScore(questionLine);
    const question = normalizeQuestion(questionLine);

    const answerLine = lines.find((line) => line.startsWith('答案:'));
    if (!answerLine) {
      throw new Error(`缺少答案行: ${block}`);
    }

    const optionLines = [];
    for (const line of lines.slice(1)) {
      if (line.startsWith('答案:')) {
        break;
      }
      optionLines.push(line.replace(/^选项:\s*/, '').trim());
    }

    const optionText = optionLines.join(' ');
    const options = parseOptions(optionText);
    const answer = parseAnswer(answerLine);

    questions.push({
      id: questions.length + 1,
      question,
      score,
      options,
      answer,
    });
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(questions, null, 2), 'utf8');
}

toJson();

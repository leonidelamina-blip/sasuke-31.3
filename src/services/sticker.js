'use strict';
// Figurinhas (WebP 512x512) e espelhamento. Usa "sharp" se estiver instalado; senão usa o ffmpeg do servidor.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { userError } = require('../utils/format');
const log = require('../utils/logger');

const LIMITE = { img: 100 * 1024, anim: 500 * 1024 };
let ffOk = null;

const exec = (cmd, args, timeout) => new Promise((res, rej) => {
  execFile(cmd, args, { timeout, maxBuffer: 1024 * 1024 }, (e, so, se) => (e ? rej(Object.assign(e, { stderr: se })) : res(so)));
});

async function temFfmpeg() {
  if (ffOk === null) { try { await exec('ffmpeg', ['-version'], 5000); ffOk = true; } catch { ffOk = false; } }
  return ffOk;
}

function sharpLib() { try { return require('sharp'); } catch { return null; } }

async function ffmpeg(buf, extIn, args, extOut) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sasuke-m-'));
  const inF = path.join(dir, 'in' + extIn); const outF = path.join(dir, 'out' + extOut);
  try {
    fs.writeFileSync(inF, buf);
    await exec('ffmpeg', ['-y', '-v', 'error', ...args(inF), outF], 45000);
    return fs.readFileSync(outF);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

/** Extensão pelo conteúdo (o ffmpeg precisa dela para reconhecer o ficheiro). */
function extDe(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8) return '.jpg';
  if (buf.slice(1, 4).toString() === 'PNG') return '.png';
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return '.webp';
  if (buf.slice(0, 3).toString() === 'GIF') return '.gif';
  return '.mp4';
}

const FALTA = 'Para criar figurinhas preciso do pacote "sharp" (npm install) ou do programa ffmpeg no servidor. Nenhum dos dois está disponível.';
const PAD = 'scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0';

/** Foto/vídeo/GIF -> WebP de figurinha. */
async function paraFigurinha(buf, { video = false } = {}) {
  const limite = video ? LIMITE.anim : LIMITE.img;
  const sharp = !video && sharpLib();
  if (sharp) {
    try {
      let out;
      for (const q of [75, 55, 35]) {
        out = await sharp(buf).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: q }).toBuffer();
        if (out.length <= limite) break;
      }
      return out;
    } catch (e) { log.warn('sharp falhou, a tentar ffmpeg: ' + e.message); }
  }
  if (!(await temFfmpeg())) throw userError(FALTA);
  try {
    let out;
    for (const q of [70, 50, 30]) {
      out = video
        ? await ffmpeg(buf, extDe(buf), (i) => ['-t', '8', '-i', i, '-vf', `fps=12,${PAD}`, '-c:v', 'libwebp', '-lossless', '0', '-q:v', String(q), '-loop', '0', '-an'], '.webp')
        : await ffmpeg(buf, extDe(buf), (i) => ['-i', i, '-vf', PAD, '-c:v', 'libwebp', '-lossless', '0', '-q:v', String(q), '-frames:v', '1'], '.webp');
      if (out.length <= limite) break;
    }
    return out;
  } catch (e) {
    log.warn('ffmpeg (figurinha) falhou: ' + (e.stderr || e.message).slice(0, 200));
    throw userError('Não consegui converter esse ficheiro em figurinha. Experimenta outra foto/vídeo.');
  }
}

/** Espelha a imagem na horizontal. */
async function espelhar(buf) {
  const sharp = sharpLib();
  if (sharp) { try { return await sharp(buf).flop().jpeg({ quality: 90 }).toBuffer(); } catch (e) { log.warn('sharp falhou: ' + e.message); } }
  if (!(await temFfmpeg())) throw userError('Para espelhar fotos preciso do pacote "sharp" (npm install) ou do programa ffmpeg no servidor.');
  try { return await ffmpeg(buf, extDe(buf), (i) => ['-i', i, '-vf', 'hflip', '-frames:v', '1', '-q:v', '2'], '.jpg'); } catch (e) {
    log.warn('ffmpeg (espelhar) falhou: ' + (e.stderr || e.message).slice(0, 200));
    throw userError('Não consegui espelhar essa imagem.');
  }
}

module.exports = { paraFigurinha, espelhar, temFfmpeg };

'use strict';
const { fonte1 } = require('../utils/format');

// Dados dos personagens. As frases temáticas são textos originais (não são citações oficiais).
const PERSONAGENS = {
  sasuke:  { busca: 'Sasuke Uchiha',  cla: 'Uchiha',  objectivo: 'Vingança', anime: 'Naruto', reaction: '👁️', frase: 'Quem carrega o peso do passado não procura luz — procura respostas.' },
  naruto:  { busca: 'Naruto Uzumaki', cla: 'Uzumaki', objectivo: 'Tornar-se Hokage e ser reconhecido', anime: 'Naruto', reaction: '🍥', frase: 'Quem nunca desiste transforma a dor em caminho.' },
  itachi:  { busca: 'Itachi Uchiha',  cla: 'Uchiha',  objectivo: 'Proteger a aldeia e o irmão', anime: 'Naruto', reaction: '🩸', frase: 'O silêncio também é uma forma de sacrifício.' },
  madara:  { busca: 'Madara Uchiha',  cla: 'Uchiha',  objectivo: 'Impor um mundo de paz através do Tsukuyomi Infinito', anime: 'Naruto', reaction: '🔥', frase: 'Onde a paz falha, o poder escreve a ordem.' },
  kakashi: { busca: 'Kakashi Hatake', cla: 'Hatake',  objectivo: 'Proteger a equipa e honrar quem perdeu', anime: 'Naruto', reaction: '📖', frase: 'Um verdadeiro shinobi carrega a memória de todos os que ficaram.' },
  sakura:  { busca: 'Sakura Haruno',  cla: 'Haruno',  objectivo: 'Tornar-se forte e proteger a Equipa 7', anime: 'Naruto', reaction: '🌸', frase: 'A força nasce quando se decide parar de ser protegida.' },
  hinata:  { busca: 'Hinata Hyuga',   cla: 'Hyuga',   objectivo: 'Ganhar coragem e caminhar ao lado de Naruto', anime: 'Naruto', reaction: '💜', frase: 'A coragem silenciosa também move montanhas.' },
  obito:   { busca: 'Obito Uchiha',   cla: 'Uchiha',  objectivo: 'Criar um mundo sem dor através do Plano Olho da Lua', anime: 'Naruto', reaction: '🌀', frase: 'Quem perde tudo pode confundir ilusão com salvação.' },
};

function legenda(key) {
  const p = PERSONAGENS[key];
  return [
    `${p.reaction} ${fonte1(p.busca.toUpperCase())}`,
    '',
    `🩸 “${p.frase}”`,
    '',
    `⚫ Clã: ${p.cla}`,
    `🎯 Objectivo: ${p.objectivo}`,
    `🎌 Anime: ${p.anime}`,
  ].join('\n');
}

// Lista curada usada por .waifu (a fotografia e o anime vêm da fonte externa).
const WAIFUS = [
  'Hinata Hyuga', 'Sakura Haruno', 'Mikasa Ackerman', 'Zero Two', 'Rem', 'Asuna Yuuki', 'Nezuko Kamado',
  'Makima', 'Power', 'Hatsune Miku', 'Violet Evergarden', 'Erza Scarlet', 'Rias Gremory', 'Kaguya Shinomiya',
  'Chizuru Mizuhara', 'Yor Forger', 'Marin Kitagawa', 'Frieren', 'Anya Forger', 'Nami', 'Nico Robin',
  'Tohru Honda', 'Kurumi Tokisaki', 'Emilia', 'Megumin', 'Aqua', 'Ochaco Uraraka', 'Mai Sakurajima',
];

const JUTSUS = [
  ['Katon: Gōkakyū no Jutsu', 'Fogo', 'Sopra uma enorme bola de fogo que varre o campo de batalha.'],
  ['Chidori', 'Raio', 'Concentra chakra de raio na mão para um golpe perfurante de alta velocidade.'],
  ['Amaterasu', 'Mangekyō', 'Chamas negras que ardem até consumir o alvo.'],
  ['Tsukuyomi', 'Mangekyō', 'Ilusão suprema em que o tempo é controlado por quem a lança.'],
  ['Susanoo', 'Mangekyō', 'Gigante de chakra que protege e ataca ao mesmo tempo.'],
  ['Kage Bunshin no Jutsu', 'Clone', 'Cria clones sólidos que partilham a experiência com o original.'],
  ['Rasengan', 'Chakra', 'Esfera giratória de chakra com enorme poder destrutivo.'],
  ['Kamui', 'Dimensional', 'Técnica de espaço-tempo que permite atravessar ou enviar matéria para outra dimensão.'],
  ['Mokuton: Jukai Kōtan', 'Madeira', 'Faz crescer uma floresta inteira para prender e esmagar.'],
  ['Suiton: Suiryūdan no Jutsu', 'Água', 'Ergue um dragão de água para atacar à distância.'],
  ['Doton: Doryūheki', 'Terra', 'Levanta uma muralha de terra para defesa imediata.'],
  ['Raikiri', 'Raio', 'Corte de raio concentrado capaz de atravessar quase tudo.'],
  ['Byakugan', 'Dōjutsu', 'Visão quase total que enxerga o fluxo de chakra.'],
  ['Hachimon Tonkō', 'Taijutsu', 'Abre os portões internos do corpo para um poder extremo, com grande custo.'],
  ['Edo Tensei', 'Proibido', 'Traz almas de volta ao mundo dos vivos em corpos artificiais.'],
  ['Shunshin no Jutsu', 'Velocidade', 'Deslocamento instantâneo que parece teletransporte.'],
];

module.exports = { PERSONAGENS, legenda, WAIFUS, JUTSUS };

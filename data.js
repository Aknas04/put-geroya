// =====================================================
//  Данные игры: классы, навыки, предметы, земли, враги.
//  Меняйте числа здесь, чтобы настроить баланс.
// =====================================================

// Сколько обычных побед нужно в земле, чтобы найти босса
const BOSS_WINS = 5;

// Множители сложности: больше 1 — сложнее (для золота — щедрее)
const DIFFICULTY = { enemyHp: 1.15, enemyAtk: 1.25, bossHp: 1.5, bossAtk: 1.35, gold: 0.8 };

const CLASSES = {
  warrior: {
    name: 'Воин', icon: '⚔️', weaponIcon: '🗡️',
    desc: 'Много здоровья и брони. Бьёт сильно и надёжно.',
    base: { hp: 120, mp: 20, atk: 14, def: 6, mag: 4, crit: 0.05 },
    grow: { hp: 14, mp: 3, atk: 3, def: 2, mag: 1 },
    skills: ['power', 'warcry', 'whirl'],
  },
  mage: {
    name: 'Маг', icon: '🔮', weaponIcon: '🪄',
    desc: 'Мало здоровья, зато разрушительные заклинания.',
    base: { hp: 80, mp: 60, atk: 8, def: 3, mag: 18, crit: 0.05 },
    grow: { hp: 8, mp: 8, atk: 1, def: 1, mag: 3 },
    skills: ['fireball', 'heal', 'frost', 'meteor'],
  },
  ranger: {
    name: 'Следопыт', icon: '🏹', weaponIcon: '🏹',
    desc: 'Меткий и ловкий: частые критические удары и яды.',
    base: { hp: 100, mp: 35, atk: 12, def: 4, mag: 6, crit: 0.2 },
    grow: { hp: 11, mp: 4, atk: 3, def: 1, mag: 1, crit: 0.005 },
    skills: ['double', 'poisonArrow', 'eagle'],
  },
};

// use() вызывается в бою; функции hitEnemy, healPlayer и др. — в game.js
const SKILLS = {
  power: {
    name: 'Мощный удар', icon: '💥', lvl: 1, mp: 6, desc: 'Удар силой ×1.8',
    use: () => hitEnemy(st().atk, 1.8),
  },
  warcry: {
    name: 'Боевой клич', icon: '📯', lvl: 3, mp: 8, desc: 'Сила +50% на 3 хода',
    use: () => { B.p.buff = 3; addLog('Вы издаёте боевой клич! Сила растёт.'); },
  },
  whirl: {
    name: 'Вихрь клинков', icon: '🌪️', lvl: 6, mp: 14, desc: 'Удар силой ×2.8',
    use: () => hitEnemy(st().atk, 2.8),
  },
  fireball: {
    name: 'Огненный шар', icon: '🔥', lvl: 1, mp: 5, desc: 'Магия ×1.6',
    use: () => hitEnemy(st().mag, 1.6, { magic: true }),
  },
  heal: {
    name: 'Исцеление', icon: '💚', lvl: 2, mp: 8, desc: 'Лечит раны и снимает яд',
    use: () => addLog(`Вы восстанавливаете ${healPlayer(st().mag * 2 + 10)} здоровья.`),
  },
  frost: {
    name: 'Ледяная стрела', icon: '❄️', lvl: 4, mp: 9, desc: 'Магия ×1.3, может заморозить',
    use: () => {
      hitEnemy(st().mag, 1.3, { magic: true });
      if (B.e.hp > 0 && Math.random() < 0.6) {
        B.e.frozen = 1;
        addLog(`${B.e.name} покрывается льдом!`);
      }
    },
  },
  meteor: {
    name: 'Метеор', icon: '☄️', lvl: 7, mp: 22, desc: 'Магия ×3.2',
    use: () => hitEnemy(st().mag, 3.2, { magic: true }),
  },
  double: {
    name: 'Двойной выстрел', icon: '🎯', lvl: 1, mp: 5, desc: 'Два выстрела по ×0.9',
    use: () => {
      hitEnemy(st().atk, 0.9);
      if (B.e.hp > 0) hitEnemy(st().atk, 0.9);
    },
  },
  poisonArrow: {
    name: 'Ядовитая стрела', icon: '🐍', lvl: 3, mp: 7, desc: 'Выстрел и яд на 4 хода',
    use: () => {
      hitEnemy(st().atk, 0.8);
      if (B.e.hp > 0) {
        B.e.poison = { turns: 4, dmg: Math.round(st().atk * 0.5) };
        addLog(`☠️ ${B.e.name} отравлен!`);
      }
    },
  },
  eagle: {
    name: 'Глаз орла', icon: '🦅', lvl: 6, mp: 12, desc: 'Точный критический выстрел ×2.2',
    use: () => hitEnemy(st().atk, 2.2, { crit: true }),
  },
};

const ITEMS = {
  potion: { name: 'Зелье здоровья', icon: '🧪', price: 15, desc: '+60 ❤️, снимает яд', use: () => healPlayer(60) },
  bigPotion: { name: 'Большое зелье', icon: '🍷', price: 45, desc: '+200 ❤️, снимает яд', use: () => healPlayer(200) },
  ether: { name: 'Эликсир маны', icon: '🔷', price: 20, desc: '+40 💧', use: () => restoreMp(40) },
};

// Оружие усиливает и силу, и магию; название зависит от класса
const WEAPONS = [
  { names: { warrior: 'Старый меч', mage: 'Ученический посох', ranger: 'Простой лук' }, atk: 0, mag: 0, price: 0 },
  { names: { warrior: 'Железный меч', mage: 'Дубовый посох', ranger: 'Охотничий лук' }, atk: 5, mag: 5, price: 60 },
  { names: { warrior: 'Стальной клинок', mage: 'Посох с кристаллом', ranger: 'Составной лук' }, atk: 10, mag: 10, price: 160 },
  { names: { warrior: 'Рунный меч', mage: 'Рунный посох', ranger: 'Рунный лук' }, atk: 16, mag: 16, price: 360 },
  { names: { warrior: 'Клинок Зари', mage: 'Посох Зари', ranger: 'Лук Зари' }, atk: 24, mag: 24, price: 750 },
];

const ARMORS = [
  { name: 'Дорожная одежда', def: 0, hp: 0, price: 0 },
  { name: 'Кожаная броня', def: 3, hp: 15, price: 50 },
  { name: 'Кольчуга', def: 6, hp: 35, price: 140 },
  { name: 'Пластинчатый доспех', def: 10, hp: 60, price: 320 },
  { name: 'Доспех Зари', def: 15, hp: 90, price: 700 },
];

// Приёмы врагов: attack — обычный удар, heavy — готовит мощный удар на следующий ход,
// poison — отравляет, heal — лечится (если ранен), drain — крадёт здоровье, multi — два удара.
// Чем чаще приём повторяется в списке, тем чаще враг его использует.
const AREAS = [
  {
    name: 'Шепчущий лес', icon: '🌲', color: '#1d3a2a', lvl: 1,
    desc: 'Древние деревья шепчут на забытом языке. Здесь бродят волки и ядовитые твари.',
    enemies: [
      { name: 'Лесной волк', icon: '🐺', hp: 30, atk: 8, def: 2, xp: 8, gold: 6, moves: ['attack', 'attack', 'heavy'] },
      { name: 'Ядовитый гриб', icon: '🍄', hp: 24, atk: 6, def: 1, xp: 7, gold: 5, moves: ['attack', 'poison'] },
      { name: 'Лесной паук', icon: '🕷️', hp: 26, atk: 7, def: 2, xp: 8, gold: 6, moves: ['attack', 'multi', 'poison'] },
    ],
    boss: { name: 'Древень-хранитель', icon: '🌳', hp: 120, atk: 12, def: 4, xp: 40, gold: 45, moves: ['attack', 'attack', 'heavy', 'heal'] },
  },
  {
    name: 'Туманные топи', icon: '🌫️', color: '#1f3138', lvl: 4,
    desc: 'Вязкий туман скрывает тропу. Каждый неверный шаг может стать последним.',
    enemies: [
      { name: 'Болотная жаба', icon: '🐸', hp: 60, atk: 15, def: 5, xp: 20, gold: 14, moves: ['attack', 'attack', 'poison'] },
      { name: 'Трясинный змей', icon: '🐍', hp: 55, atk: 16, def: 4, xp: 21, gold: 15, moves: ['attack', 'poison', 'multi'] },
      { name: 'Блуждающий огонёк', icon: '👻', hp: 50, atk: 17, def: 6, xp: 22, gold: 16, moves: ['attack', 'drain'] },
    ],
    boss: { name: 'Владыка трясины', icon: '🐊', hp: 240, atk: 22, def: 8, xp: 110, gold: 110, moves: ['attack', 'heavy', 'drain', 'poison'] },
  },
  {
    name: 'Каменные пики', icon: '⛰️', color: '#2b2a3d', lvl: 7,
    desc: 'Ледяной ветер воет меж скал. В пещерах дремлют каменные стражи.',
    enemies: [
      { name: 'Пещерная мышь', icon: '🦇', hp: 85, atk: 23, def: 8, xp: 45, gold: 26, moves: ['attack', 'multi', 'drain'] },
      { name: 'Каменный голем', icon: '🗿', hp: 120, atk: 24, def: 13, xp: 50, gold: 30, moves: ['attack', 'heavy'] },
      { name: 'Горная гарпия', icon: '🦅', hp: 90, atk: 26, def: 9, xp: 48, gold: 28, moves: ['attack', 'multi'] },
    ],
    boss: { name: 'Ледяной великан', icon: '🧌', hp: 380, atk: 32, def: 13, xp: 220, gold: 200, moves: ['attack', 'heavy', 'heavy', 'multi'] },
  },
  {
    name: 'Пепельная пустошь', icon: '🌋', color: '#3a2420', lvl: 10,
    desc: 'Земля треснула от жара. В пепле бродят те, кто давно должен был умереть.',
    enemies: [
      { name: 'Огненный дух', icon: '🔥', hp: 140, atk: 33, def: 12, xp: 75, gold: 42, moves: ['attack', 'drain', 'multi'] },
      { name: 'Пустынный скорпион', icon: '🦂', hp: 150, atk: 32, def: 15, xp: 78, gold: 45, moves: ['attack', 'poison', 'heavy'] },
      { name: 'Пепельный скелет', icon: '💀', hp: 135, atk: 35, def: 13, xp: 76, gold: 44, moves: ['attack', 'attack', 'heavy'] },
    ],
    boss: { name: 'Пепельный змей', icon: '🐉', hp: 540, atk: 42, def: 17, xp: 350, gold: 320, moves: ['attack', 'heavy', 'multi', 'poison'] },
  },
  {
    name: 'Цитадель Тьмы', icon: '🏰', color: '#251a33', lvl: 13,
    desc: 'Чёрные стены уходят в небо. Здесь кончается путь каждого героя — или начинается легенда.',
    enemies: [
      { name: 'Проклятый страж', icon: '🧟', hp: 210, atk: 44, def: 19, xp: 120, gold: 70, moves: ['attack', 'attack', 'heavy'] },
      { name: 'Кровавый граф', icon: '🧛', hp: 200, atk: 45, def: 18, xp: 125, gold: 72, moves: ['attack', 'drain', 'drain'] },
      { name: 'Око бездны', icon: '👁️', hp: 190, atk: 47, def: 17, xp: 125, gold: 74, moves: ['attack', 'multi', 'poison'] },
    ],
    boss: { name: 'Безликий Король', icon: '👤', hp: 950, atk: 55, def: 22, xp: 600, gold: 500, moves: ['attack', 'heavy', 'drain', 'multi'] },
  },
];

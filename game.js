// =====================================================
//  Логика игры «Путь Героя»
// =====================================================
const $ = (s) => document.querySelector(s);
const app = $('#app');
const SAVE_KEY = 'put-geroya-save';

let S = null;          // герой (сохраняется)
let B = null;          // текущий бой
let screen = 'title';
let screenArg = null;
let heroReturn = ['town', null]; // куда вернуться из экрана «Герой»
let createState = { name: '', cls: 'warrior' };
let lastEvent = '';    // сообщение после исследования земли

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const xpNeed = (lvl) => Math.round(12 * Math.pow(lvl, 1.6));
const innPrice = () => 3 + S.lvl * 2;
const LAST_AREA = AREAS.length - 1;

// ===== Сохранение =====
function loadSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return null; }
}
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch {}
}

// Итоговые характеристики героя с учётом снаряжения
function st() {
  const w = WEAPONS[S.weapon], a = ARMORS[S.armor];
  return {
    maxHp: S.base.hp + a.hp,
    maxMp: S.base.mp,
    atk: S.base.atk + w.atk,
    mag: S.base.mag + w.mag,
    def: S.base.def + a.def,
    crit: S.base.crit,
  };
}

function newHero(name, cls) {
  S = {
    name, cls, lvl: 1, xp: 0, gold: 20,
    base: { ...CLASSES[cls].base },
    weapon: 0, armor: 0,
    items: { potion: 3, bigPotion: 0, ether: 1 },
    unlocked: 0,
    wins: AREAS.map(() => 0),
    bosses: AREAS.map(() => false),
    won: false,
  };
  S.hp = st().maxHp;
  S.mp = st().maxMp;
  save();
}

function learnedSkills() {
  return CLASSES[S.cls].skills.filter((id) => SKILLS[id].lvl <= S.lvl);
}

// ===== Навигация =====
function go(name, arg = null) {
  if (name === 'hero' && screen !== 'hero') heroReturn = [screen, screenArg];
  screen = name;
  screenArg = arg;
  if (S) save();
  render();
  window.scrollTo(0, 0);
}

function render() {
  app.innerHTML = SCREENS[screen](screenArg);
  if (screen === 'battle') flushFx();
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ===== Кусочки интерфейса =====
function bar(cur, max, cls, label = true) {
  const pct = Math.max(0, Math.min(100, (cur / max) * 100));
  return `<div class="bar ${cls}"><i style="width:${pct}%"></i>${label ? `<span>${cur} / ${max}</span>` : ''}</div>`;
}

function heroBar() {
  const s = st();
  return `
  <div class="hero-bar">
    <div class="hb-top">
      <span class="hb-name">${CLASSES[S.cls].icon} ${esc(S.name)}</span>
      <span>Ур. ${S.lvl}</span>
      <span class="gold">🪙 ${S.gold}</span>
    </div>
    ${bar(S.hp, s.maxHp, 'hp')}
    ${bar(S.mp, s.maxMp, 'mp')}
    ${bar(S.xp, xpNeed(S.lvl), 'xp thin', false)}
  </div>`;
}

function shopRow(icon, name, desc, price, action, v) {
  return `
  <div class="row">
    <span class="row-icon">${icon}</span>
    <span class="row-text"><b>${name}</b><small>${desc}</small></span>
    <button class="btn buy" data-a="${action}" data-v="${v}" ${S.gold < price ? 'disabled' : ''}>${price} 🪙</button>
  </div>`;
}

// ===== Экраны =====
const SCREENS = {
  title() {
    const has = !!loadSave();
    return `
    <div class="screen center">
      <div class="logo">⚔️</div>
      <h1>Путь Героя</h1>
      <p class="sub">Пять земель. Одна тьма. Один герой.</p>
      ${has ? '<button class="btn primary" data-a="continue">Продолжить</button>' : ''}
      <button class="btn ${has ? '' : 'primary'}" data-a="newGame">Новая игра</button>
    </div>`;
  },

  create() {
    return `
    <div class="screen">
      <h2>Создание героя</h2>
      <label class="field">Имя героя
        <input id="hero-name" maxlength="16" placeholder="Например, Арлан" autocomplete="off" value="${esc(createState.name)}">
      </label>
      <h3>Выберите класс</h3>
      <div class="classes">
        ${Object.entries(CLASSES).map(([id, c]) => `
          <button class="class-card ${createState.cls === id ? 'sel' : ''}" data-a="pickClass" data-v="${id}">
            <span class="ci">${c.icon}</span>
            <span class="ct"><b>${c.name}</b><small>${c.desc}</small>
              <span class="cstats">❤️ ${c.base.hp} · 💧 ${c.base.mp} · ⚔️ ${c.base.atk} · ✨ ${c.base.mag} · 🛡️ ${c.base.def}</span>
            </span>
          </button>`).join('')}
      </div>
      <button class="btn primary" data-a="startGame">Начать путь</button>
      <button class="btn ghost" data-a="go" data-v="title">Назад</button>
    </div>`;
  },

  intro() {
    return `
    <div class="screen center">
      <div class="logo">📜</div>
      <h2>Начало пути</h2>
      <p class="story">Над Пятью Землями сгущается Пепельная Тьма. Её источник — <b>Безликий Король</b>, засевший в Цитадели на краю мира.</p>
      <p class="story">Старейшина деревни Тихий Ручей вручает тебе, ${esc(S.name)}, старое оружие: «Иди через лес, топи, горы и пустошь. Только так можно дойти до Цитадели».</p>
      <button class="btn primary" data-a="go" data-v="town">В путь!</button>
    </div>`;
  },

  town() {
    return `
    <div class="screen" style="--area:#2a2340">
      ${heroBar()}
      <div class="place">
        <div class="place-icon">🏘️</div>
        <h2>Деревня Тихий Ручей</h2>
        <p>Безопасное место, чтобы отдохнуть и подготовиться к пути.</p>
      </div>
      <div class="menu">
        <button class="btn primary" data-a="go" data-v="map">🗺️ Отправиться в путь</button>
        <button class="btn" data-a="go" data-v="shop">🏪 Лавка</button>
        <button class="btn" data-a="inn">🍺 Таверна: отдых за ${innPrice()} 🪙</button>
        <button class="btn" data-a="go" data-v="hero">🎒 Герой и сумка</button>
      </div>
      <button class="btn ghost small" data-a="go" data-v="title">Главное меню</button>
    </div>`;
  },

  map() {
    return `
    <div class="screen">
      ${heroBar()}
      <h2>Карта мира</h2>
      <div class="menu">
        ${AREAS.map((a, i) => {
          const locked = i > S.unlocked;
          return `
          <button class="area-card ${locked ? 'locked' : ''}" style="--area:${a.color}" data-a="enterArea" data-v="${i}" ${locked ? 'disabled' : ''}>
            <span class="row-icon">${locked ? '🔒' : a.icon}</span>
            <span class="row-text"><b>${a.name}</b>
              <small>${locked ? 'Победите босса предыдущей земли' : `Рекомендуемый уровень: ${a.lvl}`}</small></span>
            ${S.bosses[i] ? '<span class="done">✓</span>' : ''}
          </button>`;
        }).join('')}
      </div>
      <button class="btn ghost" data-a="go" data-v="town">← В деревню</button>
    </div>`;
  },

  area(i) {
    const a = AREAS[i], wins = S.wins[i];
    let bossPart;
    if (S.bosses[i]) bossPart = `<p class="note">✓ ${a.boss.name} повержен</p>`;
    else if (wins >= BOSS_WINS)
      bossPart = `<button class="btn danger" data-a="fightBoss" data-v="${i}">${a.boss.icon} Бросить вызов: ${a.boss.name}</button>`;
    else bossPart = `<p class="note">Победите ещё ${BOSS_WINS - wins}, чтобы найти логово босса</p>`;
    return `
    <div class="screen" style="--area:${a.color}">
      ${heroBar()}
      <div class="place">
        <div class="place-icon">${a.icon}</div>
        <h2>${a.name}</h2>
        <p>${a.desc}</p>
      </div>
      ${lastEvent ? `<div class="event">${lastEvent}</div>` : ''}
      <div class="menu">
        <button class="btn primary" data-a="explore" data-v="${i}">🧭 Исследовать</button>
        ${bossPart}
        <button class="btn" data-a="go" data-v="hero">🎒 Сумка</button>
        <button class="btn ghost" data-a="go" data-v="map">← К карте</button>
      </div>
    </div>`;
  },

  hero() {
    const s = st(), c = CLASSES[S.cls];
    const stat = (icon, name, val) => `<div class="stat"><span>${icon} ${name}</span><b>${val}</b></div>`;
    const items = Object.entries(ITEMS).filter(([id]) => S.items[id] > 0);
    return `
    <div class="screen">
      ${heroBar()}
      <h2>${c.icon} ${esc(S.name)}, ${c.name.toLowerCase()} ${S.lvl} ур.</h2>
      <div class="stats">
        ${stat('❤️', 'Здоровье', s.maxHp)}
        ${stat('💧', 'Мана', s.maxMp)}
        ${stat('⚔️', 'Сила', s.atk)}
        ${stat('✨', 'Магия', s.mag)}
        ${stat('🛡️', 'Защита', s.def)}
        ${stat('🎯', 'Крит', Math.round(s.crit * 100) + '%')}
      </div>
      <p class="note">Опыт: ${S.xp} / ${xpNeed(S.lvl)} · Земель очищено: ${S.bosses.filter(Boolean).length} из ${AREAS.length}</p>

      <h3>Снаряжение</h3>
      <div class="row"><span class="row-icon">${c.weaponIcon}</span><span class="row-text"><b>${WEAPONS[S.weapon].names[S.cls]}</b><small>+${WEAPONS[S.weapon].atk} к силе и магии</small></span></div>
      <div class="row"><span class="row-icon">🥋</span><span class="row-text"><b>${ARMORS[S.armor].name}</b><small>+${ARMORS[S.armor].def} к защите, +${ARMORS[S.armor].hp} к здоровью</small></span></div>

      <h3>Сумка</h3>
      ${items.length ? items.map(([id, it]) => `
        <div class="row"><span class="row-icon">${it.icon}</span>
          <span class="row-text"><b>${it.name} ×${S.items[id]}</b><small>${it.desc}</small></span>
          <button class="btn buy" data-a="useItem" data-v="${id}">Выпить</button>
        </div>`).join('') : '<p class="note">Сумка пуста</p>'}

      <h3>Навыки</h3>
      ${c.skills.map((id) => {
        const sk = SKILLS[id], open = sk.lvl <= S.lvl;
        return `<div class="row ${open ? '' : 'locked'}"><span class="row-icon">${open ? sk.icon : '🔒'}</span>
          <span class="row-text"><b>${sk.name}</b><small>${open ? `${sk.desc} · ${sk.mp} 💧` : `Откроется на ${sk.lvl} уровне`}</small></span></div>`;
      }).join('')}

      <button class="btn ghost" data-a="back">← Назад</button>
    </div>`;
  },

  shop() {
    const c = CLASSES[S.cls];
    const nextW = WEAPONS.map((w, i) => [w, i]).filter(([, i]) => i > S.weapon).slice(0, 2);
    const nextA = ARMORS.map((a, i) => [a, i]).filter(([, i]) => i > S.armor).slice(0, 2);
    return `
    <div class="screen" style="--area:#2a2340">
      ${heroBar()}
      <h2>🏪 Лавка</h2>
      <h3>Зелья</h3>
      ${Object.entries(ITEMS).map(([id, it]) => shopRow(it.icon, it.name, `${it.desc} · в сумке: ${S.items[id]}`, it.price, 'buyItem', id)).join('')}
      <h3>Оружие</h3>
      <p class="note">Сейчас: ${WEAPONS[S.weapon].names[S.cls]}</p>
      ${nextW.length ? nextW.map(([w, i]) => shopRow(c.weaponIcon, w.names[S.cls], `+${w.atk} к силе и магии`, w.price, 'buyWeapon', i)).join('') : '<p class="note">У вас лучшее оружие</p>'}
      <h3>Броня</h3>
      <p class="note">Сейчас: ${ARMORS[S.armor].name}</p>
      ${nextA.length ? nextA.map(([a, i]) => shopRow('🥋', a.name, `+${a.def} к защите, +${a.hp} к здоровью`, a.price, 'buyArmor', i)).join('') : '<p class="note">У вас лучшая броня</p>'}
      <button class="btn ghost" data-a="go" data-v="town">← В деревню</button>
    </div>`;
  },

  battle() {
    const e = B.e, s = st(), p = B.p;
    const eStatus = [
      e.poison && `☠️ яд (${e.poison.turns})`,
      e.frozen && '❄️ заморожен',
      e.charging && '⚠️ готовит мощный удар',
    ].filter(Boolean).join(' · ');
    const pStatus = [
      p.buff && `📯 сила ×1.5 (${p.buff})`,
      p.poison && `☠️ яд (${p.poison.turns})`,
      p.defending && '🛡️ защита',
    ].filter(Boolean).join(' · ');
    return `
    <div class="screen battle ${B.boss ? 'boss' : ''}" style="--area:${AREAS[B.area].color}">
      <div class="enemy-box" id="enemy-box">
        <div class="e-name">${e.name}${B.boss ? ' <span class="tag">БОСС</span>' : ''}</div>
        ${bar(e.hp, e.maxHp, 'hp')}
        <div class="status">${eStatus}</div>
        <div class="e-icon ${e.hp <= 0 ? 'dead' : ''}">${e.icon}</div>
      </div>
      <div class="log">${B.log.slice(-4).map((l) => `<p>${l}</p>`).join('')}</div>
      <div class="player-box" id="player-box">
        <div class="hb-top"><span class="hb-name">${CLASSES[S.cls].icon} ${esc(S.name)}</span><span>Ур. ${S.lvl}</span></div>
        ${bar(S.hp, s.maxHp, 'hp')}
        ${bar(S.mp, s.maxMp, 'mp')}
        <div class="status">${pStatus}</div>
      </div>
      <div class="actions">${battleActions()}</div>
    </div>`;
  },

  ending() {
    return `
    <div class="screen center" style="--area:#3d2f1a">
      <div class="logo">🌅</div>
      <h1>Тьма рассеяна!</h1>
      <p class="story">Безликий Король пал, и над Пятью Землями впервые за много лет встаёт солнце. Имя <b>${esc(S.name)}</b> будут вспоминать у каждого очага.</p>
      <p class="story">Вы можете продолжить странствия: монстры ещё бродят по землям, а сильнее можно становиться бесконечно.</p>
      <button class="btn primary" data-a="go" data-v="town">Вернуться в деревню</button>
    </div>`;
  },
};

function battleActions() {
  if (B.over) {
    return `
    <div class="result ${B.over.win ? 'win' : 'lose'}">
      <h3>${B.over.win ? '🏆 Победа!' : '💀 Поражение…'}</h3>
      ${B.over.lines.map((l) => `<p>${l}</p>`).join('')}
      <button class="btn primary" data-a="battleDone">Продолжить</button>
    </div>`;
  }
  const off = B.busy ? 'disabled' : '';
  if (B.menu === 'skills') {
    return learnedSkills().map((id) => {
      const sk = SKILLS[id];
      return `<button class="act" data-a="skill" data-v="${id}" ${B.busy || S.mp < sk.mp ? 'disabled' : ''}>
        ${sk.icon} ${sk.name}<small>${sk.desc} · ${sk.mp} 💧</small></button>`;
    }).join('') + `<button class="act wide ghost" data-a="menu">← Назад</button>`;
  }
  if (B.menu === 'items') {
    const list = Object.entries(ITEMS).filter(([id]) => S.items[id] > 0);
    return (list.length
      ? list.map(([id, it]) => `<button class="act" data-a="item" data-v="${id}" ${off}>${it.icon} ${it.name} ×${S.items[id]}<small>${it.desc}</small></button>`).join('')
      : '<p class="note wide">Сумка пуста</p>') + `<button class="act wide ghost" data-a="menu">← Назад</button>`;
  }
  return `
    <button class="act" data-a="attack" ${off}>⚔️ Атака</button>
    <button class="act" data-a="menu" data-v="skills" ${off}>✨ Навыки</button>
    <button class="act" data-a="menu" data-v="items" ${off}>🧪 Предметы</button>
    <button class="act" data-a="defend" ${off}>🛡️ Защита<small>урон −60%, +10% 💧</small></button>
    <button class="act wide ghost" data-a="flee" ${B.busy || B.boss ? 'disabled' : ''}>🏃 Сбежать${B.boss ? ' (нельзя)' : ''}</button>`;
}

// ===== Бой =====
function addLog(msg) {
  B.log.push(msg.trim());
}

function startBattle(areaIdx, boss) {
  const a = AREAS[areaIdx];
  const def = boss ? a.boss : pick(a.enemies);
  const hp = Math.round(def.hp * (boss ? DIFFICULTY.bossHp : DIFFICULTY.enemyHp));
  const atk = Math.round(def.atk * (boss ? DIFFICULTY.bossAtk : DIFFICULTY.enemyAtk));
  B = {
    area: areaIdx, boss,
    e: { ...def, hp, maxHp: hp, atk, gold: def.gold * DIFFICULTY.gold, poison: null, frozen: 0, charging: false },
    p: { buff: 0, poison: null, defending: false },
    log: [], fx: [], busy: false, menu: null, over: null,
  };
  lastEvent = '';
  addLog(boss ? `${def.icon} ${def.name} преграждает путь!` : `${def.icon} На вас нападает ${def.name}!`);
  go('battle');
}

function hitEnemy(power, mult, opt = {}) {
  const e = B.e;
  if (!opt.magic && B.p.buff) power *= 1.5;
  const defFactor = opt.magic ? 0.3 : 0.6; // магия хуже блокируется бронёй
  let d = Math.max(1, (power * mult - e.def * defFactor) * (0.9 + Math.random() * 0.2));
  const crit = opt.crit || Math.random() < st().crit;
  if (crit) d *= 1.75;
  d = Math.round(d);
  e.hp = Math.max(0, e.hp - d);
  addLog(crit ? `💥 Критический удар! ${e.name}: −${d}.` : `${e.name}: −${d}.`);
  B.fx.push({ target: 'enemy', text: '−' + d, cls: crit ? 'crit' : 'dmg', shake: true });
  return d;
}

function hitPlayer(power, mult, prefix) {
  let d = Math.max(1, (power * mult - st().def * 0.6) * (0.9 + Math.random() * 0.2));
  if (B.p.defending) d *= 0.4;
  d = Math.round(d);
  S.hp = Math.max(0, S.hp - d);
  addLog(`${prefix} Вы теряете ${d} ❤️${B.p.defending ? ' (защита)' : ''}.`);
  B.fx.push({ target: 'player', text: '−' + d, cls: 'dmg', shake: true });
  return d;
}

function healPlayer(amount) {
  const before = S.hp;
  S.hp = Math.min(st().maxHp, S.hp + Math.round(amount));
  const healed = S.hp - before;
  if (B && !B.over) {
    B.p.poison = null;
    B.fx.push({ target: 'player', text: '+' + healed, cls: 'heal' });
  }
  return healed;
}

function restoreMp(amount) {
  const before = S.mp;
  S.mp = Math.min(st().maxMp, S.mp + amount);
  return S.mp - before;
}

function playerAct(kind, v) {
  if (!B || B.busy || B.over) return;
  const s = st();
  if (kind === 'attack') {
    hitEnemy(s.atk, 1);
  } else if (kind === 'skill') {
    const sk = SKILLS[v];
    if (!sk || S.mp < sk.mp) return;
    S.mp -= sk.mp;
    addLog(`${sk.icon} ${sk.name}!`);
    sk.use();
  } else if (kind === 'item') {
    const it = ITEMS[v];
    if (!it || !S.items[v]) return;
    S.items[v]--;
    const amount = it.use();
    addLog(`${it.icon} ${it.name}: +${amount}.`);
  } else if (kind === 'defend') {
    B.p.defending = true;
    const r = restoreMp(Math.round(s.maxMp * 0.1));
    addLog(`🛡️ Вы встаёте в защитную стойку${r ? ` (+${r} 💧)` : ''}.`);
  } else if (kind === 'flee') {
    if (Math.random() < 0.6) {
      lastEvent = '🏃 Вы сбежали от врага.';
      const area = B.area;
      B = null;
      return go('area', area);
    }
    addLog('🏃 Сбежать не удалось!');
  }
  B.menu = null;
  if (B.p.buff && v !== 'warcry') B.p.buff--;

  if (B.e.hp <= 0) {
    B.busy = true;
    render();
    return setTimeout(victory, 600);
  }
  B.busy = true;
  render();
  setTimeout(enemyTurn, 850);
}

function enemyTurn() {
  if (!B) return;
  const e = B.e;
  if (e.poison) {
    const d = e.poison.dmg;
    e.hp = Math.max(0, e.hp - d);
    addLog(`☠️ Яд: ${e.name} −${d}.`);
    B.fx.push({ target: 'enemy', text: '−' + d, cls: 'poison' });
    if (--e.poison.turns <= 0) e.poison = null;
    if (e.hp <= 0) {
      render();
      return setTimeout(victory, 600);
    }
  }

  if (e.frozen) {
    e.frozen = 0;
    addLog(`❄️ ${e.name} скован льдом и пропускает ход.`);
  } else if (e.charging) {
    e.charging = false;
    hitPlayer(e.atk, 2.2, `💢 ${e.name} обрушивает мощный удар!`);
  } else {
    enemyMove(e);
  }

  if (S.hp <= 0) {
    render();
    return setTimeout(defeat, 700);
  }
  startPlayerTurn();
}

function enemyMove(e) {
  let move = pick(e.moves);
  if (move === 'heal' && e.hp > e.maxHp * 0.5) move = 'attack';
  switch (move) {
    case 'heavy':
      e.charging = true;
      addLog(`⚠️ ${e.name} готовит мощный удар! Самое время защититься.`);
      break;
    case 'poison':
      hitPlayer(e.atk, 0.7, `${e.name} бьёт ядом!`);
      if (S.hp > 0) {
        B.p.poison = { turns: 3, dmg: Math.max(2, Math.round(e.atk * 0.3)) };
        addLog('☠️ Вы отравлены!');
      }
      break;
    case 'heal': {
      const h = Math.round(e.maxHp * 0.2);
      e.hp = Math.min(e.maxHp, e.hp + h);
      addLog(`💚 ${e.name} восстанавливает ${h} здоровья.`);
      B.fx.push({ target: 'enemy', text: '+' + h, cls: 'heal' });
      break;
    }
    case 'drain': {
      const d = hitPlayer(e.atk, 0.9, `🩸 ${e.name} высасывает силы!`);
      e.hp = Math.min(e.maxHp, e.hp + Math.round(d * 0.6));
      break;
    }
    case 'multi':
      hitPlayer(e.atk, 0.55, `${e.name} атакует дважды!`);
      if (S.hp > 0) hitPlayer(e.atk, 0.55, '');
      break;
    default:
      hitPlayer(e.atk, 1, `${e.name} атакует.`);
  }
}

function startPlayerTurn() {
  B.p.defending = false;
  if (B.p.poison) {
    const d = B.p.poison.dmg;
    S.hp = Math.max(1, S.hp - d); // яд не убивает, но оставляет на грани
    addLog(`☠️ Яд: вы теряете ${d} ❤️.`);
    B.fx.push({ target: 'player', text: '−' + d, cls: 'poison' });
    if (--B.p.poison.turns <= 0) B.p.poison = null;
  }
  B.busy = false;
  render();
}

function levelUp() {
  const out = [];
  const grow = CLASSES[S.cls].grow;
  while (S.xp >= xpNeed(S.lvl)) {
    S.xp -= xpNeed(S.lvl);
    S.lvl++;
    for (const k in grow) S.base[k] += grow[k];
    out.push(`⭐ Новый уровень: ${S.lvl}!`);
    CLASSES[S.cls].skills.forEach((id) => {
      if (SKILLS[id].lvl === S.lvl) out.push(`📜 Новый навык: ${SKILLS[id].icon} ${SKILLS[id].name}`);
    });
  }
  if (out.length) {
    S.hp = st().maxHp;
    S.mp = st().maxMp;
  }
  return out;
}

function victory() {
  const e = B.e;
  const gold = rand(Math.round(e.gold * 0.8), Math.round(e.gold * 1.2));
  S.xp += e.xp;
  S.gold += gold;
  const lines = [`+${e.xp} опыта · +${gold} 🪙`];

  if (B.boss) {
    if (!S.bosses[B.area]) {
      S.bosses[B.area] = true;
      if (B.area < LAST_AREA) {
        S.unlocked = Math.max(S.unlocked, B.area + 1);
        lines.push(`🗺️ Открыта новая земля: ${AREAS[B.area + 1].icon} ${AREAS[B.area + 1].name}`);
      } else {
        S.won = true;
      }
    }
  } else {
    S.wins[B.area]++;
    if (Math.random() < 0.2) {
      const id = Math.random() < 0.75 ? 'potion' : 'ether';
      S.items[id]++;
      lines.push(`Добыча: ${ITEMS[id].icon} ${ITEMS[id].name}`);
    }
  }
  lines.push(...levelUp());
  B.over = { win: true, lines };
  save();
  render();
}

function defeat() {
  const lost = Math.floor(S.gold / 2);
  S.gold -= lost;
  S.hp = st().maxHp;
  S.mp = st().maxMp;
  B.over = { win: false, lines: [`Вы теряете ${lost} 🪙.`, 'Жители деревни нашли вас и выходили.'] };
  save();
  render();
}

// Всплывающие числа урона и тряска
function flushFx() {
  const list = B.fx;
  B.fx = [];
  list.forEach((f, i) => {
    const box = $(f.target === 'enemy' ? '#enemy-box' : '#player-box');
    if (!box) return;
    const el = document.createElement('span');
    el.className = 'pop ' + f.cls;
    el.textContent = f.text;
    el.style.left = 35 + Math.random() * 30 + '%';
    el.style.animationDelay = i * 150 + 'ms';
    box.appendChild(el);
    if (f.shake) box.classList.add('shake');
  });
}

// ===== Действия по нажатию кнопок =====
const ACTIONS = {
  continue() {
    S = loadSave();
    if (!S) return go('title');
    go('town');
  },
  newGame() {
    if (loadSave() && !confirm('Начать заново? Текущий герой будет удалён.')) return;
    createState = { name: '', cls: 'warrior' };
    go('create');
  },
  pickClass(v) {
    createState.cls = v;
    render();
  },
  startGame() {
    newHero(createState.name.trim() || 'Безымянный', createState.cls);
    go('intro');
  },
  go(v) {
    if (v === 'title' && S) {
      save();
      S = null;
    }
    go(v);
  },
  back() {
    go(...heroReturn);
  },
  inn() {
    const s = st(), price = innPrice();
    if (S.hp === s.maxHp && S.mp === s.maxMp) return toast('Вы и так полны сил');
    if (S.gold < price) return toast('Не хватает золота');
    S.gold -= price;
    S.hp = s.maxHp;
    S.mp = s.maxMp;
    toast('🍺 Вы отдохнули. Здоровье и мана восстановлены!');
    go('town');
  },
  enterArea(v) {
    lastEvent = '';
    go('area', +v);
  },
  explore(v) {
    const i = +v, a = AREAS[i], s = st(), r = Math.random();
    if (r < 0.75) return startBattle(i, false);
    if (r < 0.87) {
      if (Math.random() < 0.5) {
        const g = rand(a.enemies[0].gold, a.enemies[0].gold * 3);
        S.gold += g;
        lastEvent = `🧰 Вы нашли сундук: +${g} 🪙`;
      } else {
        const id = Math.random() < 0.7 ? 'potion' : 'ether';
        S.items[id]++;
        lastEvent = `🧰 В сундуке: ${ITEMS[id].icon} ${ITEMS[id].name}!`;
      }
    } else if (r < 0.95) {
      S.hp = Math.min(s.maxHp, S.hp + Math.round(s.maxHp * 0.3));
      S.mp = Math.min(s.maxMp, S.mp + Math.round(s.maxMp * 0.3));
      lastEvent = '💧 Вы нашли чистый родник и восстановили силы.';
    } else {
      const d = Math.round(s.maxHp * 0.1);
      S.hp = Math.max(1, S.hp - d);
      lastEvent = `🪤 Ловушка! Вы теряете ${d} ❤️`;
    }
    go('area', i);
  },
  fightBoss(v) {
    startBattle(+v, true);
  },
  attack() { playerAct('attack'); },
  defend() { playerAct('defend'); },
  flee() { playerAct('flee'); },
  skill(v) { playerAct('skill', v); },
  item(v) { playerAct('item', v); },
  menu(v) {
    if (B.busy) return;
    B.menu = v || null;
    render();
  },
  battleDone() {
    const { win } = B.over;
    const area = B.area, finalBoss = B.boss && area === LAST_AREA;
    B = null;
    if (!win) return go('town');
    go(finalBoss ? 'ending' : 'area', area);
  },
  buyItem(v) {
    const it = ITEMS[v];
    if (S.gold < it.price) return;
    S.gold -= it.price;
    S.items[v]++;
    toast(`Куплено: ${it.icon} ${it.name}`);
    go('shop');
  },
  buyWeapon(v) {
    const w = WEAPONS[+v];
    if (S.gold < w.price || +v <= S.weapon) return;
    S.gold -= w.price;
    S.weapon = +v;
    toast(`${CLASSES[S.cls].weaponIcon} Новое оружие: ${w.names[S.cls]}`);
    go('shop');
  },
  buyArmor(v) {
    const a = ARMORS[+v];
    if (S.gold < a.price || +v <= S.armor) return;
    S.gold -= a.price;
    S.hp += a.hp - ARMORS[S.armor].hp; // прибавка к здоровью сразу
    S.armor = +v;
    toast(`🥋 Новая броня: ${a.name}`);
    go('shop');
  },
  useItem(v) {
    const it = ITEMS[v], s = st();
    if (!S.items[v]) return;
    if (v === 'ether' ? S.mp === s.maxMp : S.hp === s.maxHp) return toast('Сейчас это не нужно');
    S.items[v]--;
    toast(`${it.icon} +${it.use()}`);
    go('hero');
  },
};

app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]');
  if (!el || el.disabled) return;
  ACTIONS[el.dataset.a]?.(el.dataset.v);
});

app.addEventListener('input', (e) => {
  if (e.target.id === 'hero-name') createState.name = e.target.value;
});

// ===== Запуск =====
render();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

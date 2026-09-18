'use strict';

const THEMES = [
  {id:'general',    n:'Обычные'},
  {id:'celebs',     n:'Личности'},
  {id:'movies',     n:'Кино и сериалы'},
  {id:'literature', n:'Литература'},
  {id:'philosophy', n:'Философия'},
  {id:'history',    n:'История'},
  {id:'biology',    n:'Биология'},
  {id:'geography',  n:'География'},
  {id:'science',    n:'Наука'},
  {id:'cinema',     n:'Съёмки'},
  {id:'music',      n:'Музыка'},
  {id:'art',        n:'Искусство'},
  {id:'food',       n:'Еда'},
  {id:'sport',      n:'Спорт'},
  {id:'tech',       n:'Технологии'},
  {id:'psych',      n:'Психология'},
  {id:'slang',      n:'Сленг'},
];
const LEVELS  = ['Лёгкий','Нормальный','Сложный','Спёкшийся'];
const LVL_C   = ['#34d399','#38bdf8','#c084fc','#fbbf24'];
const LVL_BG  = ['rgba(52,211,153,.3)','rgba(56,189,248,.3)','rgba(168,85,247,.34)','rgba(245,158,11,.34)'];
const COLORS  = ['#a855f7','#ec4899','#38bdf8','#f59e0b','#34d399','#fb7185','#818cf8','#facc15'];
const TITLES  = {classic:'Классика', topics:'По темам', bvg:'Boys vs Girls', draw:'Рисунок', whose:'Чья фраза'};

const TEAM_NAMES = [
  'Облупленные','Отстреляные','Команда имени Марка Америки','Команда имени Валеры Барнюка',
  'Команда имени Стоиной','Приозёрные','Анальники','Оральники','Лысые','Пузатые','Вурдалаки',
  'Лысые пузатые вурдалаки с гиперлордозом','Операция «Стриж»','Курпон','Просто Катя',
  'Крутящие гуся','Недостаточно средств','Царские','Священная Самса',
  'Спёкшийся против зловещего Бонга','Кролик убивающий членом','«ВСЕ»','Глум','План Б',
  'Потухшие','Опухшие','Севшие батарейки','Спермы Габара','Тебе 20 лет','Бурики','Шурики'
];

const PRESETS = {
  classic:{time:60, goal:30, count:0, penalty:true},
  topics :{time:60, goal:30, count:0, penalty:true},
  bvg    :{time:60, goal:30, count:0, penalty:true},
  draw   :{time:120,goal:10, count:3, penalty:false},
  whose  :{time:90, goal:12, count:5, penalty:false},
};
const DEFAULTS = {
  mode:'classic', teams:[], levels:[0,1], themes:[],
  time:60, goal:30, count:0,
  penalty:true, last:true, sound:true, vibro:true, opts:false, swap:false, hints:false,
};

let S = load(), scores = [], turn = 0, round = 1;
let queues = {}, log = [], cur = null;
let timer = null, tLeft = 0, tTotal = 0, running = false, lastCall = false, answered = false;
let wake = null, wakeBusy = false;

function load(){
  try{ const r = localStorage.getItem('alias-lug-v3'); if(r) return Object.assign({}, DEFAULTS, JSON.parse(r)); }catch(e){}
  return JSON.parse(JSON.stringify(DEFAULTS));
}
function save(){ try{ localStorage.setItem('alias-lug-v3', JSON.stringify(S)); }catch(e){} }

const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const shuffle = a => { for(let i=a.length-1;i>0;i--){const j=(Math.random()*(i+1))|0;[a[i],a[j]]=[a[j],a[i]];} return a; };
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const num = n => n.toLocaleString('ru-RU');
const color = i => COLORS[i % COLORS.length];
function plural(n,a,b,c){ const m=n%100, k=n%10; return (m>=11&&m<=14)?c : k===1?a : (k>=2&&k<=4)?b : c; }
function randomNames(k){ return shuffle(TEAM_NAMES.slice()).slice(0,k).map(n=>({n})); }

/* =====================================================
   ЗВУК
   мягкий синтез: несколько голосов, плавная атака,
   срез верхов фильтром и общий компрессор
   ===================================================== */
let AC = null, MASTER = null;
function audio(){
  if(!AC){
    AC = new (window.AudioContext || window.webkitAudioContext)();
    MASTER = AC.createGain();
    MASTER.gain.value = 1;
    const comp = AC.createDynamicsCompressor();
    comp.threshold.value = -8; comp.knee.value = 20; comp.ratio.value = 2.5;
    MASTER.connect(comp); comp.connect(AC.destination);
  }
  if(AC.state === 'suspended') AC.resume();
  return AC;
}
/* голоса: [множитель частоты, расстройка в центах, громкость] */
const PLAIN = [[1,0,1]];
const RICH  = [[1,0,1],[1,-7,.5],[2,4,.22]];

function tone(f, dur, o){
  if(!S.sound) return;
  o = o || {};
  try{
    const ac = audio(), t0 = ac.currentTime + (o.at || 0);
    const peak = o.v == null ? .14 : o.v;
    const atk  = o.a == null ? .016 : o.a;

    const filt = ac.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(o.cut || 4600, t0);
    filt.Q.value = .5;

    const g = ac.createGain();
    g.gain.setValueAtTime(.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + atk);
    g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);

    filt.connect(g); g.connect(MASTER);

    (o.rich ? RICH : PLAIN).forEach(v=>{
      const osc = ac.createOscillator(), vg = ac.createGain();
      osc.type = o.type || 'triangle';
      osc.frequency.setValueAtTime(f * v[0], t0);
      if(o.to) osc.frequency.exponentialRampToValueAtTime(o.to * v[0], t0 + dur * .85);
      osc.detune.value = v[1];
      vg.gain.value = v[2];
      osc.connect(vg); vg.connect(filt);
      osc.start(t0); osc.stop(t0 + dur + .04);
    });
  }catch(e){}
}

/* звук строим вне кадра взаимодействия, иначе телефон дёргается на свайпе */
function soon(fn){ setTimeout(fn, 0); }

const sndStart = ()=>{ tone(523.25,.32,{v:.10,rich:true}); tone(783.99,.46,{at:.10,v:.10,rich:true}); };
const sndHit   = ()=>{ tone(1046.5,.46,{v:.16,rich:true,cut:5400}); tone(1568,.52,{at:.07,v:.12,rich:true,cut:6200}); };
const sndMiss  = ()=>{ tone(311.13,.34,{v:.3,to:196,cut:1500,a:.01}); tone(155.56,.4,{v:.18,to:98,cut:600,type:'sine',a:.012}); };
const sndTick  = ()=>{ tone(1174.66,.45,{v:.5,cut:4600,a:.004,rich:true}); tone(2349.32,.22,{v:.12,cut:7200,a:.003}); };
const sndEnd   = ()=>{
  tone(880,.8,{v:.22,rich:true,cut:4400});
  tone(698.46,.85,{at:.24,v:.22,rich:true,cut:4400});
  tone(587.33,1.35,{at:.48,v:.26,rich:true,cut:3900});
  tone(146.83,1.6,{at:.48,v:.16,type:'sine',cut:520});
};
const sndWin   = ()=> [523.25,659.25,783.99,1046.5].forEach((f,i)=>tone(f,.65,{at:i*.11,v:.12,rich:true,cut:5400}));
const sndFlip  = ()=>  tone(660,.13,{v:.06,cut:3200,type:'sine'});

let touched = false;
document.addEventListener('pointerdown', ()=>{ touched = true; }, {capture:true, once:true});
function buzz(p){ if(touched && S.vibro && navigator.vibrate) try{ navigator.vibrate(p); }catch(e){} }

/* ---------- экран не гаснет ---------- */
async function wakeOn(){
  if(wake || wakeBusy || !('wakeLock' in navigator)) return;
  wakeBusy = true;
  try{ wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', ()=>{ wake = null; }); }catch(e){}
  wakeBusy = false;
}
function wakeOff(){ try{ wake && wake.release(); }catch(e){} wake = null; }
document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='visible' && running) wakeOn(); });

function show(id){
  $$('.screen').forEach(s=>s.classList.toggle('on', s.id === 's-'+id));
  window.scrollTo(0,0);
  if(id !== 'home') trapBack();
}

/* =====================================================
   ЖЕСТ И КНОПКА «НАЗАД»
   держим в истории одну лишнюю запись: телефонный «назад»
   съедает её и ходит по экранам игры, а не уводит с сайта
   ===================================================== */
let trapped = false;
function currentScreen(){
  const on = $$('.screen').find(s=>s.classList.contains('on'));
  return on ? on.id.slice(2) : 'home';
}
function trapBack(){
  if(trapped) return;
  trapped = true;
  try{ history.pushState({alias:1}, ''); }catch(e){}
}
window.addEventListener('popstate', ()=>{
  trapped = false;
  const m = $('.modal');
  if(m){ m.remove(); trapBack(); return; }      // сначала закрываем справку
  const id = currentScreen();
  if(id === 'home') return;                      // с главной отпускаем наружу
  if(id === 'play' && (running || lastCall)){ endRound(); return; }
  stopTimer(); wakeOff(); show('home');
});

$$('[data-go]').forEach(b=>b.addEventListener('click', ()=>{ stopTimer(); wakeOff(); show(b.dataset.go); }));

/* ---------- колоды ---------- */
function wordsFor(themes, levels){
  const out = [], seen = new Set();
  themes.forEach(t=>{
    const bank = (window.ALIAS_WORDS||{})[t];
    if(!bank) return;
    const meta = THEMES.find(x=>x.id===t);
    levels.forEach(l=>(bank[l]||[]).forEach(w=>{
      const k = w.toLowerCase();
      if(seen.has(k)) return;
      seen.add(k);
      out.push({kind:'word', text:w, lvl:l, tag:(meta?meta.n:t)+' · '+LEVELS[l]});
    }));
  });
  return out;
}
function poolFor(team){
  if(S.mode==='draw')
    return {key:'photo', make:()=>(window.ALIAS_PHOTOS||[]).map(f=>({kind:'photo', file:f}))};
  if(S.mode==='whose'){
    const P = window.ALIAS_PHRASES || {authors:[], items:[]};
    return {key:'phrase', make:()=>P.items.map(i=>({kind:'phrase', text:i[0], who:P.authors[i[1]], whoIdx:i[1]}))};
  }
  if(S.mode==='bvg'){
    const bank = (team===0) !== !!S.swap ? 'girls' : 'boys';
    return {key:'bvg'+bank+S.levels.join(''), make:()=>wordsFor([bank], S.levels)};
  }
  return {key:S.themes.join()+S.levels.join(''), make:()=>wordsFor(S.themes, S.levels)};
}
function nextCard(team){
  const p = poolFor(team);
  if(!queues[p.key] || !queues[p.key].length) queues[p.key] = shuffle(p.make());
  return queues[p.key].pop() || null;
}

/* ---------- главная ---------- */
$$('.mode').forEach(b=>b.addEventListener('click', ()=>openSetup(b.dataset.mode)));

/* ---------- настройки ---------- */
function openSetup(mode){
  S.mode = mode;
  Object.assign(S, PRESETS[mode]);
  S.teams = mode==='bvg' ? [{n:'Парни'},{n:'Девчонки'}] : randomNames(2);
  if(mode==='classic') S.themes = ['general'];
  if(mode==='topics')  S.themes = [];

  $('#setup-title').textContent = TITLES[mode];
  const words = mode==='classic' || mode==='topics' || mode==='bvg';
  $('#box-levels').hidden  = !words;
  $('#box-themes').hidden  = mode!=='topics';
  $('#f-count').hidden     = words;
  $('#sw-penalty').hidden  = mode==='whose';
  $('#sw-last').hidden     = !words;
  $('#sw-hints').hidden    = !words;
  $('#sw-opts').hidden     = mode!=='whose';
  $('#sw-swap').hidden     = mode!=='bvg';
  $('#addteam').hidden     = mode==='bvg';
  $('#reroll-teams').hidden= mode==='bvg';

  const w = [];
  if(mode==='draw' && !(window.ALIAS_PHOTOS||[]).length)
    w.push('Фото не подгрузились. Запусти через <b>start.bat</b>.');
  if(mode==='whose' && !((window.ALIAS_PHRASES||{}).items||[]).length)
    w.push('Нет файла <b>data/phrases.js</b>.');
  $('#setup-warn').innerHTML = w.map(t=>`<div class="err">${t}</div>`).join('');

  renderTeams(); renderLevels(); renderThemes(); renderRules();
  show('setup');
}

function renderTeams(){
  const box = $('#teams');
  box.innerHTML = '';
  S.teams.forEach((t,i)=>{
    const row = document.createElement('div');
    row.className = 'team';
    row.innerHTML = `<span class="dot" style="background:${color(i)}"></span>`+
      `<input value="${esc(t.n)}" maxlength="44">`+
      (S.teams.length>2 && S.mode!=='bvg' ? '<button class="rm">×</button>' : '');
    row.querySelector('input').addEventListener('input', e=>{ S.teams[i].n = e.target.value; save(); });
    const rm = row.querySelector('.rm');
    if(rm) rm.addEventListener('click', ()=>{ S.teams.splice(i,1); save(); renderTeams(); });
    box.appendChild(row);
  });
}
$('#addteam').addEventListener('click', ()=>{
  if(S.teams.length >= 8) return;
  const used = new Set(S.teams.map(t=>t.n));
  const free = TEAM_NAMES.filter(n=>!used.has(n));
  S.teams.push({n: free.length ? free[(Math.random()*free.length)|0] : 'Команда '+(S.teams.length+1)});
  save(); buzz(8); renderTeams();
});
$('#reroll-teams').addEventListener('click', ()=>{
  S.teams = randomNames(S.teams.length || 2);
  save(); buzz(10); renderTeams();
});

function renderLevels(){
  const box = $('#levels');
  box.innerHTML = '';
  LEVELS.forEach((n,i)=>{
    const p = document.createElement('div');
    p.className = 'pill l'+(i+1)+(S.levels.includes(i)?' sel':'');
    p.textContent = n;
    p.addEventListener('click', ()=>{
      const k = S.levels.indexOf(i);
      if(k>=0){ if(S.levels.length>1) S.levels.splice(k,1); } else S.levels.push(i);
      S.levels.sort(); save(); buzz(8); renderLevels(); renderThemes();
    });
    box.appendChild(p);
  });
}
function renderThemes(){
  const box = $('#themes');
  box.innerHTML = '';
  THEMES.forEach(t=>{
    const bank = (window.ALIAS_WORDS||{})[t.id];
    const c = bank ? S.levels.reduce((a,l)=>a+(bank[l]||[]).length, 0) : 0;
    const d = document.createElement('div');
    d.className = 'theme'+(S.themes.includes(t.id)?' sel':'');
    d.innerHTML = `<span class="n">${t.n}</span><span class="c">${num(c)} ${plural(c,'слово','слова','слов')}</span>`;
    d.addEventListener('click', ()=>{
      const k = S.themes.indexOf(t.id);
      if(k>=0) S.themes.splice(k,1); else S.themes.push(t.id);
      save(); buzz(8); renderThemes(); checkStart();
    });
    box.appendChild(d);
  });
  checkStart();
}
function checkStart(){
  const btn = $('#start');
  const bad = S.mode==='topics' && !S.themes.length;
  btn.disabled = bad;
  btn.textContent = bad ? 'Выбери хотя бы одну тему' : 'Поехали';
}
function bindRange(id, key, out, fmt){
  const r = $(id);
  r.value = S[key];
  const paint = ()=>{ $(out).textContent = fmt ? fmt(S[key]) : S[key]; };
  paint();
  r.oninput = ()=>{ S[key] = +r.value; paint(); save(); };
}
function bindSwitch(id, key){
  const el = $(id);
  el.classList.toggle('on', !!S[key]);
  el.onclick = ()=>{ S[key] = !S[key]; el.classList.toggle('on', !!S[key]); save(); buzz(8); };
}
function renderRules(){
  bindRange('#r-time','time','#v-time');
  bindRange('#r-goal','goal','#v-goal', v=>v+' '+plural(v,'очка','очков','очков'));
  bindRange('#r-count','count','#v-count');
  ['penalty','last','hints','opts','swap','sound','vibro'].forEach(k=>bindSwitch('#sw-'+k, k));
}

/* ---------- старт ---------- */
$('#start').addEventListener('click', ()=>{
  S.teams = S.teams.map(t=>({n:(t.n||'').trim()})).filter(t=>t.n);
  if(S.teams.length < 2) S.teams = randomNames(2);
  save();
  scores = S.teams.map(()=>0);
  turn = 0; round = 1; queues = {};
  goReady();
});

function goReady(){
  $('#ready-mode').textContent = TITLES[S.mode];
  $('#ready-ring').textContent = round;
  $('#ready-ring').style.color = color(turn);
  $('#ready-team').textContent = S.teams[turn].n;
  $('#ready-team').style.color = color(turn);
  const chip = $('#ready-chip');
  if(S.mode === 'bvg'){
    const girls = (turn===0) !== !!S.swap;
    chip.innerHTML = `<span class="chip">${girls ? 'женский набор' : 'мужской набор'}</span>`;
  } else chip.innerHTML = '';
  show('ready');
}
$('#btn-start-round').addEventListener('click', startRound);
$('#btn-board').addEventListener('click', ()=>renderBoard(false));

/* ---------- ход ---------- */
function startRound(){
  log = []; lastCall = false;
  tTotal = tLeft = S.time;
  $('#play-team').textContent = S.teams[turn].n;
  $('#play-team').style.color = color(turn);
  $('#play-sub').textContent = 'раунд '+round+' · '+scores[turn];
  paintScore(true); paintTimer(true);
  drawCard(); show('play');
  running = true; wakeOn();
  clearInterval(timer);
  timer = setInterval(tick, 1000);
  sndStart(); buzz(12);
}
function stopTimer(){ running = false; clearInterval(timer); timer = null; }

function tick(){
  if(!running) return;
  tLeft--;
  if(tLeft <= 3 && tLeft > 0){ sndTick(); buzz(40); }
  if(tLeft <= 0){
    tLeft = 0; paintTimer(); stopTimer(); wakeOff();
    sndEnd(); buzz([120,80,120,80,240]);
    const words = S.mode==='classic' || S.mode==='topics' || S.mode==='bvg';
    if(S.last && words && cur){
      lastCall = true;
      $('#play-sub').textContent = 'последнее слово — угадывают все';
      $('#tnum').textContent = '!';
    } else endRound();
    return;
  }
  paintTimer();
}
function paintTimer(jump){
  const C = 2*Math.PI*24, f = tTotal ? tLeft/tTotal : 0, arc = $('#tarc');
  if(jump) arc.classList.add('jump');
  arc.setAttribute('stroke-dasharray', C.toFixed(1));
  arc.setAttribute('stroke-dashoffset', (C*(1-f)).toFixed(1));
  if(jump){ void arc.getBoundingClientRect(); arc.classList.remove('jump'); }
  const n = $('#tnum');
  n.textContent = tLeft;
  n.style.color = tLeft<=5 ? '#fb7185' : '';
}
function points(){
  const hit = log.filter(x=>x.ok).length;
  return hit - (S.penalty ? log.length-hit : 0);
}
function paintScore(quiet){
  const p = points(), el = $('#play-score');
  el.textContent = p;
  el.style.color = p<0 ? '#fb7185' : '';
  if(!quiet){
    el.classList.add('bump');
    setTimeout(()=>el.classList.remove('bump'), 230);
  }
}
$('#btn-quit').addEventListener('click', ()=>{ if(running || lastCall) endRound(); else show('home'); });

/* ---------- карточка ---------- */
const TINTS = '<div class="tint g"></div><div class="tint r"></div>'+
              '<div class="verdict g">ЕСТЬ</div><div class="verdict r">МИМО</div>';

function setControls(on){
  $('#btn-hit').disabled = $('#btn-skip').disabled = !on;
  $('#s-play .actions').hidden = !on;
  $$('#s-play .hint').forEach(h=>h.hidden = !on);
}
function drawCard(){
  cur = nextCard(turn);
  answered = false;
  const st = $('#stage'), ex = $('#extra');
  ex.innerHTML = '';

  if(!cur){
    st.innerHTML = '<div class="wordcard"><div class="w">Карточки кончились</div></div>';
    setControls(false);
    return;
  }
  setControls(true);

  if(cur.kind === 'word'){
    const longest = Math.max.apply(null, cur.text.split(' ').map(w=>w.length));
    const size = longest > 15 ? ' s' : (longest > 10 || cur.text.length > 20) ? ' m' : '';
    const word = cur.text;
    st.innerHTML = `<div class="wordcard swipe">${TINTS}`+
      `<div><div class="w${size}">${esc(word)}</div><div class="tag">${esc(cur.tag)}</div></div>`+
      (S.hints ? '<button class="cardhint" type="button">?</button>' : '')+
      `</div>`;
    const card = st.firstElementChild;
    card.style.setProperty('--lvl',  LVL_BG[cur.lvl] || LVL_BG[2]);
    card.style.setProperty('--lvlc', LVL_C[cur.lvl]  || LVL_C[2]);
    swipeable(card);
    const hint = card.querySelector('.cardhint');
    if(hint){
      hint.addEventListener('pointerdown', e=>e.stopPropagation());
      hint.addEventListener('click', e=>{ e.stopPropagation(); openSheet(word); });
      soon(()=>explain(word));    // тянем заранее, чтобы открылось мгновенно
    }
  }
  else if(cur.kind === 'photo'){
    st.innerHTML = `<div class="photowrap swipe">${TINTS}`+
      `<img src="photos/${cur.file}" alt="">`+
      `<div class="veil"><div><b>только объясняющий</b><i>нажми, чтобы открыть</i></div></div></div>`;
    const wrap = st.firstElementChild;
    wrap.querySelector('.veil').addEventListener('click', e=>e.currentTarget.classList.add('hide'));
    swipeable(wrap);
    ex.innerHTML = '<div class="under"><button class="reroll">другое фото</button></div>';
    ex.querySelector('.reroll').addEventListener('click', drawCard);
  }
  else {
    const P = window.ALIAS_PHRASES;
    st.innerHTML = `<div class="phrase${S.opts?'':' swipe'}">${S.opts?'':TINTS}`+
      `<div class="q">${esc(cur.text)}</div>`+
      `<div class="answer"><span class="av" style="background:${color(cur.whoIdx)}">`+
      `${esc(cur.who.trim()[0].toUpperCase())}</span><span class="nm">${esc(cur.who)}</span></div></div>`;
    const ans = st.querySelector('.answer');

    if(S.opts){
      const wrong = shuffle(P.authors.map((_,i)=>i).filter(i=>i!==cur.whoIdx)).slice(0,3);
      ex.innerHTML = '<div class="opts">'+shuffle([cur.whoIdx, ...wrong])
        .map(i=>`<button class="opt" data-i="${i}">${esc(P.authors[i])}</button>`).join('')+'</div>';
      $$('#extra .opt').forEach(b=>b.addEventListener('click', ()=>{
        if(answered) return;
        answered = true;
        const good = +b.dataset.i === cur.whoIdx;
        $$('#extra .opt').forEach(x=>{
          x.disabled = true;
          if(+x.dataset.i === cur.whoIdx) x.classList.add('right');
          else if(x === b) x.classList.add('wrong');
          else x.classList.add('dim');
        });
        ans.classList.add('show');
        setTimeout(()=>resolve(good), 820);
      }));
      setControls(false);
    } else {
      ex.innerHTML = '<div class="under"><button class="reroll">показать автора</button></div>';
      ex.querySelector('.reroll').addEventListener('click', e=>{ ans.classList.add('show'); sndFlip(); e.target.remove(); });
      swipeable(st.firstElementChild);
    }
  }
}

/* ---------- свайп ---------- */
function swipeable(el){
  let id = null, x0 = 0, y0 = 0, t0 = 0, dx = 0, live = false;
  let raf = 0, want = 0, mark = 0;
  const TH = Math.max(66, Math.min(140, window.innerWidth * 0.2));

  /* рисуем не чаще одного раза за кадр */
  function paint(){
    raf = 0;
    el.style.transform = `translate3d(${want}px,0,0) rotate(${want/30}deg)`;
    const m = want > 30 ? 1 : want < -30 ? -1 : 0;
    if(m !== mark){
      mark = m;
      el.classList.toggle('sw-ok',  m > 0);
      el.classList.toggle('sw-bad', m < 0);
    }
  }
  el.addEventListener('pointerdown', e=>{
    if(e.pointerType === 'mouse' && e.button !== 0) return;
    id = e.pointerId; x0 = e.clientX; y0 = e.clientY; t0 = Date.now();
    dx = 0; want = 0; mark = 0; live = true;
    el.style.animation = 'none';
    el.classList.remove('snap');
    try{ el.setPointerCapture(e.pointerId); }catch(err){}
  }, {passive:true});

  el.addEventListener('pointermove', e=>{
    if(!live || e.pointerId !== id) return;
    const ddx = e.clientX-x0, ddy = e.clientY-y0;
    if(!dx && Math.abs(ddy) > Math.abs(ddx)+8){ live = false; return; }
    dx = want = ddx;
    if(!raf) raf = requestAnimationFrame(paint);
  }, {passive:true});

  const finish = e=>{
    if(!live || (e && e.pointerId !== id)) return;
    live = false;
    if(raf){ cancelAnimationFrame(raf); raf = 0; }
    el.classList.add('snap');
    const speed = Math.abs(dx) / Math.max(1, Date.now()-t0);
    if(Math.abs(dx) > TH || (speed > 0.55 && Math.abs(dx) > 34)) resolve(dx > 0);
    else {
      el.style.transform = '';
      el.classList.remove('sw-ok','sw-bad');
    }
  };
  el.addEventListener('pointerup', finish);
  el.addEventListener('pointercancel', finish);
}

/* карточку всегда выбрасываем в сторону — и от свайпа, и от кнопки */
function flyAway(ok){
  const el = $('#stage > .swipe');
  if(!el) return false;
  el.style.animation = 'none';
  el.classList.add('snap', ok ? 'sw-ok' : 'sw-bad');
  el.style.transform = `translate3d(${ok?112:-112}vw,0,0) rotate(${ok?18:-18}deg)`;
  return true;
}

/* ---------- ответ ---------- */
function resolve(ok){
  if(!cur) return;
  soon(ok ? sndHit : sndMiss);
  soon(()=>buzz(ok ? 14 : [26,50,26]));

  const flew = flyAway(ok);
  log.push({ok, kind:cur.kind, text:cur.text||'', who:cur.who||'', file:cur.file||''});
  cur = null;
  paintScore();

  if(lastCall){ setTimeout(endRound, flew ? 240 : 0); lastCall = false; running = false; return; }
  if(S.count && log.length >= S.count){ stopTimer(); wakeOff(); setTimeout(endRound, flew ? 240 : 0); return; }
  setTimeout(drawCard, flew ? 230 : 110);
}
$('#btn-hit').addEventListener('click',  ()=>{ if(running||lastCall) resolve(true); });
$('#btn-skip').addEventListener('click', ()=>{ if(running||lastCall) resolve(false); });

document.addEventListener('keydown', e=>{
  if(e.target.tagName === 'INPUT') return;
  if(e.code === 'Escape'){ const m = $('.modal'); if(m){ m.remove(); return; } }
  if($('#s-ready').classList.contains('on') && (e.code==='Space'||e.code==='Enter')){ e.preventDefault(); startRound(); return; }
  if(!$('#s-play').classList.contains('on')) return;
  if(e.code==='ArrowRight'||e.code==='Space'||e.code==='Enter'){ e.preventDefault(); if(running||lastCall) resolve(true); }
  if(e.code==='ArrowLeft'||e.code==='Backspace'){ e.preventDefault(); if(running||lastCall) resolve(false); }
});

/* ---------- итог хода ---------- */
function endRound(){
  stopTimer(); wakeOff();
  lastCall = false; cur = null;
  renderReview();
  show('review');
}
function renderReview(){
  const p = points();
  $('#rv-num').textContent = (p>0?'+':'')+p;
  $('#rv-lbl').textContent = plural(Math.abs(p),'очко','очка','очков')+' · '+S.teams[turn].n;
  const box = $('#rv-list');
  box.innerHTML = '';
  if(!log.length){ box.innerHTML = '<div class="empty">пусто</div>'; return; }
  log.forEach((it,i)=>{
    const d = document.createElement('div');
    d.className = 'ritem '+(it.ok?'y':'n');
    d.style.animationDelay = Math.min(i*40, 420)+'ms';
    const label = it.kind==='phrase'
      ? `${esc(it.text.slice(0,52))}${it.text.length>52?'…':''} — ${esc(it.who)}`
      : esc(it.text);
    d.innerHTML =
      (it.kind==='photo' ? `<img src="photos/${it.file}" alt="">` : '')+
      `<span class="mark">${it.ok?'✓':'✕'}</span>`+
      `<span class="txt">${it.kind==='photo' ? 'фото' : label}</span>`+
      (it.kind==='word' ? '<button class="ask" title="что это">?</button>' : '');
    const flip = ()=>{ log[i].ok = !log[i].ok; buzz(8); sndFlip(); renderReview(); };
    d.querySelector('.mark').addEventListener('click', flip);
    d.querySelector('.txt').addEventListener('click', flip);
    const ask = d.querySelector('.ask');
    if(ask) ask.addEventListener('click', e=>{ e.stopPropagation(); openSheet(it.text); });
    box.appendChild(d);
  });
}
$('#rv-next').addEventListener('click', ()=>{
  scores[turn] += points();
  const done = scores.some(s=>s >= S.goal);
  turn = (turn+1) % S.teams.length;
  if(turn === 0) round++;
  done ? renderBoard(true) : goReady();
});

/* ---------- справка по слову ---------- */
const WIKI = {};
async function explain(word){
  const key = word.toLowerCase();
  if(key in WIKI) return WIKI[key];
  WIKI[key] = null;
  const u = 'https://ru.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1'+
            '&generator=search&gsrsearch='+encodeURIComponent(word)+'&gsrlimit=1'+
            '&prop=extracts&exintro=1&explaintext=1&exlimit=1&exchars=520';
  try{
    const r = await fetch(u);
    const j = await r.json();
    const pages = j && j.query && j.query.pages;
    const p = pages && Object.values(pages)[0];
    if(p && p.extract && p.extract.trim()) WIKI[key] = {t:p.title, x:p.extract.trim()};
  }catch(e){}
  return WIKI[key];
}
function openSheet(word){
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML =
    `<div class="sheet"><div class="grab"></div>`+
    `<div class="src">что это</div><h4>${esc(word)}</h4>`+
    `<p class="body">ищу…</p><div class="link"></div>`+
    `<button class="btn close">Закрыть</button></div>`;
  document.body.appendChild(m);
  const close = ()=>{ m.style.opacity = '0'; setTimeout(()=>m.remove(), 160); };
  m.style.transition = 'opacity .16s';
  m.addEventListener('click', e=>{ if(e.target === m) close(); });
  m.querySelector('.close').addEventListener('click', close);

  explain(word).then(res=>{
    if(!m.isConnected) return;
    const body = m.querySelector('.body');
    if(res){
      body.textContent = res.x;
      m.querySelector('.link').innerHTML =
        `<a href="https://ru.wikipedia.org/wiki/${encodeURIComponent(res.t.replace(/ /g,'_'))}" target="_blank" rel="noopener">`+
        `${esc(res.t)} — целиком в Википедии</a>`;
    } else {
      body.textContent = 'Ничего не нашлось. Справка тянется из Википедии — нужен интернет.';
    }
  });
}

/* ---------- табло ---------- */
function renderBoard(finished){
  const order = S.teams.map((_,i)=>i).sort((a,b)=>scores[b]-scores[a]);
  const max = Math.max(1, ...scores, S.goal);
  $('#board').innerHTML = order.map((i,pos)=>
    `<div class="brow${pos===0?' lead':''}" style="animation-delay:${pos*60}ms">`+
    `<span class="pos">${pos+1}</span>`+
    `<span class="dot" style="background:${color(i)}"></span>`+
    `<span class="nm">${esc(S.teams[i].n)}</span>`+
    `<span class="pts" style="color:${color(i)}">${scores[i]}</span>`+
    `<span class="bar" style="width:${Math.max(0,scores[i])/max*100}%"></span></div>`).join('');
  $('#win-block').innerHTML = finished
    ? `<div class="winner"><div class="kicker">победа</div>`+
      `<div class="nm">${esc(S.teams[order[0]].n)}</div>`+
      `<div class="s">${scores[order[0]]} ${plural(scores[order[0]],'очко','очка','очков')}</div></div>`
    : '';
  $('#bd-continue').hidden = !!finished;
  show('board');
  if(finished){ sndWin(); buzz([30,60,30,60,60]); }
}
$('#bd-continue').addEventListener('click', goReady);
$('#bd-again').addEventListener('click', ()=>{ scores = S.teams.map(()=>0); turn = 0; round = 1; goReady(); });
$('#bd-reset').addEventListener('click', ()=>{ scores = S.teams.map(()=>0); turn = 0; round = 1; show('home'); });

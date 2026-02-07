const beginBtn = document.getElementById('beginBtn');
const chaosLayer = document.getElementById('chaosLayer');
const title = document.getElementById('mainTitle');
const subtitle = document.getElementById('subtitle');
const jumpscare = document.getElementById('jumpscare');
const finale = document.getElementById('finale');

const TARGET_NAME = 'Dylon';

const whispers = [
  'it is behind you',
  'close this now',
  'no signal no signal',
  'do not blink',
  'you were warned',
  'they can see us',
  `where are you ${TARGET_NAME.toLowerCase()}`,
  `${TARGET_NAME.toLowerCase()} answer now`,
  'mute wont help'
];

const warnings = [
  'WARNING: UNKNOWN DEVICE CONNECTED',
  'CAMERA ACCESS FORCED',
  'ARCHIVE CORRUPTED',
  'SYSTEM MEMORY LEAK',
  'NO ESCAPE ROUTE FOUND',
  'FACIAL SIGNATURE SAVED',
  `PROFILE FOUND: ${TARGET_NAME.toUpperCase()}`,
  `${TARGET_NAME.toUpperCase()} GEOLOCK LOCATED`
];

// Replace these with direct image links if you want Google-sourced faces.
// Hotlinked links can fail; local images are most reliable.
const externalFaceUrls = [
  "https://forums.rpgmakerweb.com/data/attachments/57/57346-04eccb7c4f75c5afc33a27cc8b6b6320.jpg",
  "https://i.ytimg.com/vi/Q0ggEj4x2M0/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLAYXoHIJMQU_Bn5cSANPtTalquVfQ",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT7nSI6XizmBD8R6cLMJ7xdHty91E-hcziy0g&s",
  "https://i.ytimg.com/vi/eyVtaOPjDQA/sddefault.jpg",
  "https://media.tenor.com/P3uhwqRz_XMAAAAe/weird-instrumental.png"
];

const svgFaces = [
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 280 280'>
    <rect width='280' height='280' fill='black'/>
    <ellipse cx='140' cy='140' rx='95' ry='110' fill='#f2f2f2'/>
    <circle cx='102' cy='120' r='19' fill='black'/>
    <circle cx='178' cy='118' r='20' fill='black'/>
    <ellipse cx='140' cy='184' rx='56' ry='23' fill='#9e0000'/>
    <rect x='96' y='54' width='88' height='20' fill='#1a1a1a'/>
  </svg>`,
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 280 280'>
    <rect width='280' height='280' fill='#020202'/>
    <circle cx='140' cy='140' r='106' fill='#d9d9d9'/>
    <circle cx='105' cy='122' r='30' fill='black'/>
    <circle cx='175' cy='122' r='30' fill='black'/>
    <circle cx='105' cy='122' r='9' fill='#fff'/>
    <circle cx='175' cy='122' r='9' fill='#fff'/>
    <path d='M90 188 Q140 244 190 188' stroke='#aa0000' stroke-width='12' fill='none'/>
    <rect x='32' y='20' width='216' height='25' fill='#0e0e0e'/>
  </svg>`,
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 280 280'>
    <rect width='280' height='280' fill='#060606'/>
    <path d='M52 232 L140 34 L228 232 Z' fill='#ececec'/>
    <circle cx='112' cy='142' r='18' fill='black'/>
    <circle cx='169' cy='144' r='20' fill='black'/>
    <rect x='96' y='190' width='88' height='15' fill='#a30000'/>
    <path d='M95 88 Q140 52 186 88' stroke='#111' stroke-width='8' fill='none'/>
  </svg>`
];

let started = false;
let chaosInterval = null;
let hardModeTimeout = null;
let endTimeout = null;
let titleRestoreTimeout = null;

const localFaceUrls = svgFaces.map((svg) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
const facePool = externalFaceUrls.length > 0 ? externalFaceUrls : localFaceUrls;

beginBtn.addEventListener('click', () => {
  if (started) return;
  started = true;
  beginBtn.remove();
  subtitle.textContent = `too late, ${TARGET_NAME.toLowerCase()}`;

  startAudio();
  runChaos();

  hardModeTimeout = setTimeout(() => {
    subtitle.textContent = `${TARGET_NAME.toUpperCase()} IT IS GETTING CLOSER`;
    document.body.classList.add('glitch');
  }, 7000);

  endTimeout = setTimeout(() => {
    finale.classList.add('active');
    subtitle.textContent = `do not refresh ${TARGET_NAME.toUpperCase()}`;
  }, 30000);
});

function runChaos() {
  chaosInterval = setInterval(() => {
    const roll = Math.random();

    if (roll < 0.13) flash();
    else if (roll < 0.29) spawnWhisper();
    else if (roll < 0.44) spawnWarning();
    else if (roll < 0.56) glitchText();
    else if (roll < 0.68) spawnNameBurst();
    else if (roll < 0.79) spawnFace();
    else if (roll < 0.91) blackoutPulse();
    else triggerJumpScare();
  }, 380);

  setTimeout(() => {
    clearInterval(chaosInterval);
    chaosInterval = setInterval(() => {
      const roll = Math.random();

      if (roll < 0.1) flash();
      else if (roll < 0.24) spawnWhisper(true);
      else if (roll < 0.39) spawnWarning(true);
      else if (roll < 0.54) spawnFace(true);
      else if (roll < 0.69) spawnNameBurst(true);
      else if (roll < 0.82) blackoutPulse(true);
      else triggerJumpScare(true);
    }, 145);
  }, 11000);
}

function flash() {
  const el = document.createElement('div');
  el.className = 'flash';
  chaosLayer.appendChild(el);
  setTimeout(() => el.remove(), 260);
}

function spawnWhisper(intense = false) {
  const el = document.createElement('div');
  el.className = 'whisper';
  el.textContent = pick(whispers);
  el.style.left = `${Math.random() * 85}%`;
  el.style.top = `${Math.random() * 90}%`;
  el.style.transform = `scale(${0.6 + Math.random() * 1.5}) rotate(${rand(-22, 22)}deg)`;
  if (intense) el.style.color = '#9cf800';
  chaosLayer.appendChild(el);
  setTimeout(() => el.remove(), intense ? 1600 : 2600);
}

function spawnWarning(intense = false) {
  const el = document.createElement('div');
  el.className = 'warning';
  el.textContent = pick(warnings);
  el.style.left = `${Math.random() * 80}%`;
  el.style.top = `${Math.random() * 86}%`;
  if (intense) {
    el.style.background = '#fff';
    el.style.color = '#000';
    el.style.borderColor = '#000';
  }
  chaosLayer.appendChild(el);
  setTimeout(() => el.remove(), intense ? 900 : 1400 + Math.random() * 1400);
}

function spawnNameBurst(intense = false) {
  const el = document.createElement('div');
  el.className = 'nameBurst';
  const extra = intense ? ` ${TARGET_NAME.toUpperCase()} ${TARGET_NAME.toUpperCase()}` : '';
  el.textContent = `${TARGET_NAME.toUpperCase()}${extra}`;
  el.style.left = `${Math.random() * 72}%`;
  el.style.top = `${Math.random() * 85}%`;
  el.style.fontSize = `${rand(intense ? 28 : 18, intense ? 130 : 90)}px`;
  el.style.transform = `rotate(${rand(-30, 30)}deg)`;
  chaosLayer.appendChild(el);
  pulseBeep(intense ? 88 : 111, intense ? 0.25 : 0.14);
  setTimeout(() => el.remove(), intense ? 850 : 1250);
}

function spawnFace(intense = false) {
  const wrap = document.createElement('div');
  wrap.className = 'faceEvent';
  wrap.style.left = `${Math.random() * 75}%`;
  wrap.style.top = `${Math.random() * 72}%`;
  wrap.style.transform = `rotate(${rand(-26, 26)}deg) scale(${0.7 + Math.random() * 0.8})`;

  const img = document.createElement('img');
  img.alt = 'creepy face';
  img.src = pick(facePool);
  wrap.appendChild(img);

  chaosLayer.appendChild(wrap);
  pulseBeep(intense ? 155 : 175, intense ? 0.22 : 0.11);
  setTimeout(() => wrap.remove(), intense ? 1050 : 680);
}

function blackoutPulse(intense = false) {
  document.body.classList.add('blackout');
  subtitle.textContent = `${TARGET_NAME.toUpperCase()}?`;
  setTimeout(() => {
    document.body.classList.remove('blackout');
    subtitle.textContent = 'do not look away';
  }, intense ? 360 : 180);
}

function glitchText() {
  title.style.transform = `translate(${rand(-15, 15)}px, ${rand(-8, 8)}px)`;
  subtitle.style.transform = `translate(${rand(-8, 8)}px, ${rand(-5, 5)}px)`;
  title.textContent = `${TARGET_NAME.toUpperCase()}_${randomBinary(11)}`;

  clearTimeout(titleRestoreTimeout);
  titleRestoreTimeout = setTimeout(() => {
    title.style.transform = '';
    subtitle.style.transform = '';
    title.textContent = 'DO NOT TRUST THIS PAGE';
  }, 120);
}

function triggerJumpScare(longer = false) {
  jumpscare.classList.add('active');
  jumpscare.setAttribute('aria-hidden', 'false');
  jumpscare.querySelector('p').textContent = `${TARGET_NAME.toUpperCase()} YOU LOOKED`;
  pulseBeep(longer ? 130 : 210, longer ? 0.2 : 0.1);

  setTimeout(() => {
    jumpscare.classList.remove('active');
    jumpscare.setAttribute('aria-hidden', 'true');
  }, longer ? 420 : 180);
}

function startAudio() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = 0.045;
  master.connect(ctx.destination);

  const rumble = ctx.createOscillator();
  rumble.type = 'sawtooth';
  rumble.frequency.value = 44;

  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.type = 'triangle';
  lfo.frequency.value = 0.9;
  lfoGain.gain.value = 24;

  lfo.connect(lfoGain);
  lfoGain.connect(rumble.frequency);

  rumble.connect(master);
  rumble.start();
  lfo.start();

  const hiss = ctx.createBufferSource();
  hiss.buffer = whiteNoiseBuffer(ctx, 2);
  hiss.loop = true;

  const hissFilter = ctx.createBiquadFilter();
  hissFilter.type = 'highpass';
  hissFilter.frequency.value = 1700;

  const hissGain = ctx.createGain();
  hissGain.gain.value = 0.02;

  hiss.connect(hissFilter);
  hissFilter.connect(hissGain);
  hissGain.connect(master);
  hiss.start();

  window.__panicAudio = { ctx, master };
}

function pulseBeep(freq, sec) {
  const state = window.__panicAudio;
  if (!state) return;

  const { ctx, master } = state;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.frequency.value = freq;
  gain.gain.value = 0.001;

  osc.connect(gain);
  gain.connect(master);

  const now = ctx.currentTime;
  gain.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + sec);

  osc.start(now);
  osc.stop(now + sec + 0.02);
}

function whiteNoiseBuffer(ctx, seconds) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const channel = buffer.getChannelData(0);

  for (let i = 0; i < channel.length; i += 1) {
    channel[i] = Math.random() * 2 - 1;
  }

  return buffer;
}

function randomBinary(len) {
  let out = '';
  for (let i = 0; i < len; i += 1) {
    out += Math.random() > 0.5 ? '1' : '0';
  }
  return out;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

window.addEventListener('beforeunload', () => {
  if (chaosInterval) clearInterval(chaosInterval);
  if (hardModeTimeout) clearTimeout(hardModeTimeout);
  if (endTimeout) clearTimeout(endTimeout);
  if (titleRestoreTimeout) clearTimeout(titleRestoreTimeout);
});

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js';
import { getFirestore, doc, onSnapshot, collection, query, where } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const db = getFirestore(initializeApp(firebaseConfig));
const sessionId = new URLSearchParams(location.search).get('s') || 'processo-ai-2026';
const ref = doc(db,'sessions',sessionId);
const question = document.getElementById('displayQuestion');
const message = document.getElementById('displayMessage');
const results = document.getElementById('displayResults');
let lastRound = null;
let unsubCloud = null;
let cloudRound = null;

onSnapshot(ref, snap => {
  if (!snap.exists()) {
    setMode('holding');
    question.textContent = 'Sessione non configurata';
    message.textContent = 'Controlla il codice della sessione.';
    results.innerHTML = '';
    return;
  }
  const d = snap.data();
  lastRound = d.roundId;
  question.textContent = d.question || 'Interazione';

  if (d.type === 'wordcloud') {
    if (!d.showResults) {
      stopCloud();
      setMode('holding');
      showHolding(d);
      return;
    }
    setMode('cloud-mode');
    subscribeCloud(d.roundId);
    return;
  }

  stopCloud();
  if (!d.showResults) {
    setMode('holding');
    showHolding(d);
    return;
  }
  setMode('show-results');
  renderChoice(d);
});

function setMode(mode) {
  document.body.classList.remove('holding','show-results','cloud-mode');
  document.body.classList.add(mode);
}

function showHolding(d) {
  results.innerHTML = '';
  if (d.isOpen) message.innerHTML = '<span class="live-dot"></span> Votazione in corso';
  else message.textContent = 'Votazione conclusa. Il responso sarà rivelato tra poco.';
}

function renderChoice(d) {
  const counts = d.counts || [];
  const opts = d.options || [];
  const total = counts.reduce((a,b)=>a+b,0);
  const max = Math.max(0,...counts);
  message.innerHTML = `<strong class="voter-total">${total}</strong> votanti`;
  results.innerHTML = opts.map((o,i) => {
    const n = counts[i] || 0;
    const p = total ? Math.round(n*100/total) : 0;
    const winner = total > 0 && n === max;
    return `<div class="verdict-row${winner?' winner':''}">
      <div class="verdict-top">
        <div class="verdict-label">${esc(o)}</div>
        <div class="verdict-number"><strong>${p}%</strong><span>${n} ${n===1?'voto':'voti'}</span></div>
      </div>
      <div class="verdict-bar"><i data-width="${p}"></i></div>
    </div>`;
  }).join('');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.querySelectorAll('.verdict-bar i').forEach(el => el.style.width = `${el.dataset.width}%`);
  }));
}

function stopCloud() {
  if (unsubCloud) unsubCloud();
  unsubCloud = null;
  cloudRound = null;
}

function wordsFromDoc(data) {
  if (Array.isArray(data.texts)) return data.texts.map(x=>String(x||'').trim()).filter(Boolean);
  const one = String(data.text || '').trim();
  return one ? [one] : [];
}

function subscribeCloud(roundId) {
  if (!roundId) return;
  if (cloudRound === roundId && unsubCloud) return;
  stopCloud();
  cloudRound = roundId;
  const qq = query(collection(db,'responses'),where('sessionId','==',sessionId),where('roundId','==',roundId));
  unsubCloud = onSnapshot(qq, snap => {
    if (roundId !== lastRound) return;
    const freq = {};
    let wordTotal = 0;
    snap.docs.forEach(x => {
      wordsFromDoc(x.data()).forEach(raw => {
        raw = raw.replace(/\s+/g,' ');
        const key = raw.toLocaleLowerCase('it');
        if (!key) return;
        wordTotal++;
        if (!freq[key]) freq[key] = {label:raw,count:0};
        freq[key].count++;
      });
    });
    const arr = Object.values(freq).sort((a,b)=>b.count-a.count || a.label.localeCompare(b.label,'it'));
    const maxCount = Math.max(1,...arr.map(x=>x.count));
    const participants = snap.size;
    message.innerHTML = `<strong class="voter-total">${participants}</strong> ${participants===1?'partecipante':'partecipanti'} · <strong>${wordTotal}</strong> ${wordTotal===1?'parola':'parole'}`;
    if (!arr.length) {
      results.innerHTML = '<div class="cloud-empty">In attesa delle prime parole…</div>';
      return;
    }
    renderCloud(arr, maxCount);
  });
}


function renderCloud(arr, maxCount) {
  results.innerHTML = '<div class="display-cloud" id="displayCloud"></div>';
  const cloud = document.getElementById('displayCloud');
  const bounds = cloud.getBoundingClientRect();
  const W = Math.max(300, bounds.width);
  const H = Math.max(220, bounds.height);
  const cx = W / 2;
  const cy = H / 2;
  const placed = [];

  const items = arr.slice(0, 70).map((x, i) => {
    const weight = x.count / maxCount;
    const el = document.createElement('span');
    el.className = `display-cloud-word rank-${Math.min(i,7)}`;
    el.textContent = x.label;
    el.title = `${x.count}`;
    const minPx = Math.max(18, Math.min(W,H) * 0.032);
    const maxPx = Math.max(58, Math.min(W,H) * 0.15);
    const fontPx = minPx + (maxPx - minPx) * Math.pow(weight, .72);
    el.style.fontSize = `${fontPx}px`;
    el.style.position = 'absolute';
    el.style.visibility = 'hidden';
    el.style.left = '0px';
    el.style.top = '0px';
    cloud.appendChild(el);
    return {el, x, i};
  });

  const overlaps = (a,b,pad=5) => !(
    a.r + pad < b.l || a.l - pad > b.r || a.b + pad < b.t || a.t - pad > b.b
  );

  items.forEach(({el,i}) => {
    const ew = el.offsetWidth;
    const eh = el.offsetHeight;
    let best = null;
    const angleOffset = (i % 9) * .37;
    const maxSteps = 1400;

    for (let step=0; step<maxSteps; step++) {
      let x, y;
      if (i === 0) {
        x = cx - ew/2;
        y = cy - eh/2;
      } else {
        const angle = angleOffset + step * .31;
        const radius = 2.5 * Math.sqrt(step) * Math.min(W,H) / 42;
        x = cx + Math.cos(angle) * radius - ew/2;
        y = cy + Math.sin(angle) * radius * .68 - eh/2;
      }
      const box = {l:x, t:y, r:x+ew, b:y+eh};
      if (box.l < 4 || box.t < 4 || box.r > W-4 || box.b > H-4) continue;
      if (placed.every(p => !overlaps(box,p))) { best = box; break; }
    }

    if (!best) {
      // fallback: riduce gradualmente finché trova posto
      let size = parseFloat(el.style.fontSize);
      for (let shrink=0; shrink<6 && !best; shrink++) {
        size *= .86;
        el.style.fontSize = `${Math.max(14,size)}px`;
        const w = el.offsetWidth, h = el.offsetHeight;
        for (let step=0; step<1000; step++) {
          const angle = angleOffset + step * .34;
          const radius = 2.8 * Math.sqrt(step) * Math.min(W,H) / 42;
          const x = cx + Math.cos(angle) * radius - w/2;
          const y = cy + Math.sin(angle) * radius * .68 - h/2;
          const box = {l:x,t:y,r:x+w,b:y+h};
          if (box.l < 4 || box.t < 4 || box.r > W-4 || box.b > H-4) continue;
          if (placed.every(p => !overlaps(box,p,3))) { best=box; break; }
        }
      }
    }

    if (best) {
      el.style.left = `${best.l}px`;
      el.style.top = `${best.t}px`;
      el.style.visibility = 'visible';
      el.style.animationDelay = `${Math.min(i*22,350)}ms`;
      placed.push(best);
    } else {
      el.remove();
    }
  });
}

function esc(s) {
  return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

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

onSnapshot(ref, async snap => {
  if (!snap.exists()) {
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
      showHolding(d);
      return;
    }
    subscribeCloud(d.roundId);
    return;
  }

  stopCloud();

  if (!d.showResults) {
    showHolding(d);
    return;
  }
  renderChoice(d);
});

function showHolding(d) {
  results.innerHTML = '';
  if (d.isOpen) {
    message.innerHTML = '<span class="live-dot"></span> Votazione in corso';
  } else {
    message.textContent = 'Votazione conclusa. Il responso sarà rivelato tra poco.';
  }
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

function subscribeCloud(roundId) {
  if (!roundId) return;
  if (cloudRound === roundId && unsubCloud) return;
  stopCloud();
  cloudRound = roundId;
  const qq = query(collection(db,'responses'),where('sessionId','==',sessionId),where('roundId','==',roundId));
  unsubCloud = onSnapshot(qq, snap => {
    if (roundId !== lastRound) return;
    const freq = {};
    snap.docs.forEach(x => {
      const raw = (x.data().text || '').trim().replace(/\s+/g,' ');
      const key = raw.toLocaleLowerCase('it');
      if (!key) return;
      if (!freq[key]) freq[key] = {label:raw,count:0};
      freq[key].count++;
    });
    const arr = Object.values(freq).sort((a,b)=>b.count-a.count || a.label.localeCompare(b.label,'it'));
    const total = snap.size;
    const maxCount = Math.max(1,...arr.map(x=>x.count));
    message.innerHTML = `<strong class="voter-total">${total}</strong> ${total===1?'contributo':'contributi'}`;
    results.innerHTML = arr.length
      ? `<div class="display-cloud">${arr.map((x,i)=>`<span class="display-cloud-word rank-${Math.min(i,7)}" style="--weight:${(x.count/maxCount).toFixed(3)}" title="${x.count}">${esc(x.label)}</span>`).join('')}</div>`
      : '<div class="cloud-empty">In attesa delle prime parole…</div>';
  });
}

function esc(s) {
  return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

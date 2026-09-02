import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js';
import { getFirestore, doc, onSnapshot, collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const db = getFirestore(initializeApp(firebaseConfig));
const sessionId = new URLSearchParams(location.search).get('s') || 'processo-ai-2026';
const ref = doc(db,'sessions',sessionId);
const question = document.getElementById('displayQuestion');
const message = document.getElementById('displayMessage');
const results = document.getElementById('displayResults');
let lastRound = null;

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
      showHolding(d);
      return;
    }
    await renderCloud(d.roundId);
    return;
  }

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

async function renderCloud(roundId) {
  if (!roundId || roundId !== lastRound) return;
  const snap = await getDocs(query(collection(db,'responses'),where('sessionId','==',sessionId),where('roundId','==',roundId)));
  const freq = {};
  snap.docs.forEach(x => {
    const text = (x.data().text || '').trim().toLocaleLowerCase('it');
    if (text) freq[text] = (freq[text] || 0) + 1;
  });
  const arr = Object.entries(freq).sort((a,b)=>b[1]-a[1]);
  const total = arr.reduce((sum,[,n])=>sum+n,0);
  message.innerHTML = `<strong class="voter-total">${total}</strong> contributi`;
  results.innerHTML = `<div class="display-cloud">${arr.map(([w,n])=>`<span style="font-size:${Math.min(7,2.1+n*.65)}rem">${esc(w)}</span>`).join('')}</div>`;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js';
import { getFirestore, doc, onSnapshot, setDoc, updateDoc, collection, query, where, getDocs, writeBatch, serverTimestamp, getDoc } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const db = getFirestore(initializeApp(firebaseConfig));
const q = id => document.getElementById(id);
let currentSession = q('sessionInput').value.trim();
let unsub = null;
let unsubHistory = null;
const sessionRef = () => doc(db,'sessions',currentSession);
const roundRef = roundId => doc(db,'sessions',currentSession,'rounds',roundId);
const roundsRef = () => collection(db,'sessions',currentSession,'rounds');
const options = () => q('optionsInput').value.split('\n').map(x=>x.trim()).filter(Boolean);

function typeUI() {
  q('optionsWrap').style.display = q('typeInput').value === 'choice' ? 'block' : 'none';
}
q('typeInput').onchange = typeUI;
typeUI();

function subscribe() {
  if (unsub) unsub();
  if (unsubHistory) unsubHistory();

  unsub = onSnapshot(sessionRef(), async snap => {
    if (!snap.exists()) return render(null,[]);
    const d = snap.data();
    q('questionInput').value = d.question || '';
    q('typeInput').value = d.type || 'choice';
    typeUI();
    if (d.options?.length) q('optionsInput').value = d.options.join('\n');
    q('showResults').checked = !!d.showResults;
    if (d.type === 'wordcloud') await loadWords(d.roundId);
    else render(d,[]);
  });

  unsubHistory = onSnapshot(roundsRef(), snap => {
    const rounds = snap.docs.map(x => ({id:x.id,...x.data()}));
    rounds.sort((a,b) => timeMs(b.openedAt || b.createdAt) - timeMs(a.openedAt || a.createdAt));
    renderHistory(rounds);
  });

  updateUrls();
}

q('sessionInput').onchange = () => {
  currentSession = q('sessionInput').value.trim() || 'processo-ai-2026';
  subscribe();
};

async function saveDraft() {
  const type = q('typeInput').value;
  const opts = type === 'choice' ? options() : [];
  await setDoc(sessionRef(),{
    question:q('questionInput').value.trim(),
    type,
    options:opts,
    isOpen:false,
    showResults:false,
    updatedAt:serverTimestamp()
  },{merge:true});
}

async function openRound() {
  const type = q('typeInput').value;
  const opts = type === 'choice' ? options() : [];
  const roundId = crypto.randomUUID();
  const payload = {
    question:q('questionInput').value.trim(),
    type,
    options:opts,
    counts:opts.map(()=>0),
    isOpen:true,
    showResults:false,
    roundId,
    openedAt:serverTimestamp(),
    updatedAt:serverTimestamp()
  };

  await setDoc(sessionRef(),payload,{merge:true});
  await setDoc(roundRef(roundId),{
    roundId,
    question:payload.question,
    type,
    options:opts,
    counts:payload.counts,
    total:0,
    status:'open',
    openedAt:serverTimestamp(),
    updatedAt:serverTimestamp()
  });
}

async function closeRound() {
  const snap = await getDoc(sessionRef());
  if (!snap.exists()) return;
  const d = snap.data();
  if (!d.roundId) {
    await updateDoc(sessionRef(),{isOpen:false,updatedAt:serverTimestamp()});
    return;
  }

  let historyData = {
    question:d.question || '',
    type:d.type || 'choice',
    options:d.options || [],
    counts:d.counts || [],
    total:(d.counts || []).reduce((a,b)=>a+b,0),
    status:'closed',
    closedAt:serverTimestamp(),
    updatedAt:serverTimestamp()
  };

  if (d.type === 'wordcloud') {
    const words = await getRoundWords(d.roundId);
    const freq = wordFrequencies(words);
    historyData = {...historyData, total:words.length, wordCounts:freq};
  }

  await setDoc(roundRef(d.roundId),historyData,{merge:true});
  await updateDoc(sessionRef(),{isOpen:false,updatedAt:serverTimestamp()});
}

q('saveBtn').onclick = saveDraft;
q('openBtn').onclick = openRound;
q('closeBtn').onclick = closeRound;
q('showResults').onchange = () => updateDoc(sessionRef(),{showResults:q('showResults').checked,updatedAt:serverTimestamp()});
q('resetBtn').onclick = async () => {
  const snap = await getDoc(sessionRef());
  if (!snap.exists()) return;
  const d = snap.data();
  const oldRoundId = d.roundId;

  if (oldRoundId) {
    // Congela la tornata esistente prima di azzerarla, così non si perde dallo storico.
    let archived = {
      question:d.question || '', type:d.type || 'choice', options:d.options || [],
      counts:d.counts || [], total:(d.counts || []).reduce((a,b)=>a+b,0),
      status:'reset', closedAt:serverTimestamp(), updatedAt:serverTimestamp()
    };
    if (d.type === 'wordcloud') {
      const words = await getRoundWords(oldRoundId);
      archived.total = words.length;
      archived.wordCounts = wordFrequencies(words);
    }
    await setDoc(roundRef(oldRoundId),archived,{merge:true});
  }

  const newRoundId = crypto.randomUUID();
  const opts = d.type === 'choice' ? (d.options || options()) : [];
  await updateDoc(sessionRef(),{
    counts:opts.map(()=>0),
    showResults:false,
    roundId:newRoundId,
    isOpen:!!d.isOpen,
    openedAt:serverTimestamp(),
    updatedAt:serverTimestamp()
  });
  await setDoc(roundRef(newRoundId),{
    roundId:newRoundId, question:d.question || '', type:d.type || 'choice', options:opts,
    counts:opts.map(()=>0), total:0, status:d.isOpen?'open':'draft',
    openedAt:serverTimestamp(), updatedAt:serverTimestamp()
  });
};

async function getRoundWords(roundId) {
  if (!roundId) return [];
  const snap = await getDocs(query(collection(db,'responses'),where('sessionId','==',currentSession),where('roundId','==',roundId)));
  return snap.docs.map(x=>x.data().text||'').filter(Boolean);
}

async function loadWords(roundId) {
  const words = await getRoundWords(roundId);
  render({type:'wordcloud'},words);
}

function wordFrequencies(words) {
  const freq = {};
  words.forEach(w => {
    const k = String(w).trim().toLocaleLowerCase('it');
    if (k) freq[k] = (freq[k]||0)+1;
  });
  return freq;
}

function render(d,words) {
  if (d?.type === 'wordcloud') {
    const freq = wordFrequencies(words);
    const arr = Object.entries(freq).sort((a,b)=>b[1]-a[1]);
    q('totalVotes').textContent = words.length;
    q('results').innerHTML = `<div class="cloud">${arr.map(([w,n])=>`<span style="font-size:${Math.min(52,18+n*7)}px" title="${n}">${esc(w)}</span>`).join('')}</div>`;
    return;
  }

  const counts = d?.counts || [];
  const opts = d?.options || [];
  const total = counts.reduce((a,b)=>a+b,0);
  q('totalVotes').textContent = total;
  const max = Math.max(0,...counts);
  q('results').innerHTML = opts.map((o,i) => {
    const n = counts[i] || 0;
    const p = total ? Math.round(n*100/total) : 0;
    const lead = total > 0 && n === max ? ' leader' : '';
    return `<div class="result-row${lead}"><div class="result-meta"><strong>${esc(o)}</strong><span>${n} voti · ${p}%</span></div><div class="bar"><i style="width:${p}%"></i></div></div>`;
  }).join('');
}

function renderHistory(rounds) {
  const el = q('history');
  if (!rounds.length) {
    el.innerHTML = '<p class="muted">Nessuna votazione archiviata. La prima comparirà qui appena apri una tornata.</p>';
    return;
  }

  el.innerHTML = rounds.map((r,index) => {
    const status = r.status === 'open' ? 'IN CORSO' : r.status === 'reset' ? 'AZZERATA' : 'CONCLUSA';
    const date = formatDate(r.closedAt || r.openedAt);
    const total = Number.isFinite(r.total) ? r.total : (r.counts || []).reduce((a,b)=>a+b,0);
    let detail = '';

    if (r.type === 'wordcloud') {
      const top = Object.entries(r.wordCounts || {}).sort((a,b)=>b[1]-a[1]).slice(0,12);
      detail = top.length
        ? `<div class="history-cloud">${top.map(([w,n])=>`<span>${esc(w)} <b>${n}</b></span>`).join('')}</div>`
        : '<p class="muted compact">Nessuna parola registrata.</p>';
    } else {
      detail = (r.options || []).map((o,i) => {
        const n = (r.counts || [])[i] || 0;
        const p = total ? Math.round(n*100/total) : 0;
        return `<div class="history-result"><span>${esc(o)}</span><strong>${n} · ${p}%</strong></div>`;
      }).join('');
    }

    return `<details class="history-item" ${index===0?'open':''}>
      <summary>
        <span><span class="history-badge ${r.status==='open'?'live':''}">${status}</span><strong>${esc(r.question || 'Senza titolo')}</strong></span>
        <span class="history-summary">${total} ${total===1?'risposta':'risposte'} · ${esc(date)}</span>
      </summary>
      <div class="history-detail">
        <div class="history-meta">${r.type==='wordcloud'?'Word Cloud':'Scelta / voto'} · ID ${esc(r.id.slice(0,8))}</div>
        ${detail}
      </div>
    </details>`;
  }).join('');
}

function timeMs(v) {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (v.seconds) return v.seconds*1000;
  return 0;
}

function formatDate(v) {
  const ms = timeMs(v);
  if (!ms) return 'adesso';
  return new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(ms));
}

function esc(s) {
  return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function updateUrls() {
  const base = location.href.replace(/admin\.html.*$/,'');
  const suffix = `?s=${encodeURIComponent(currentSession)}`;
  q('participantUrl').textContent = `${base}${suffix}`;
  q('displayUrl').textContent = `${base}display.html${suffix}`;
  q('screenLink').href = `${base}display.html${suffix}`;
}

subscribe();

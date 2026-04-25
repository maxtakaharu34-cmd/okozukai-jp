// おこづかいちょう — kid-friendly allowance tracker
(() => {
  'use strict';

  const STORAGE_KEY = 'okozukai_v1';
  const SHARE_URL = 'https://maxtakaharu34-cmd.github.io/okozukai-jp/';

  // Two simple lists of categories — small, kid-friendly.
  const CATEGORIES = {
    in: [
      { id: 'allowance', label: 'おこづかい', emoji: '💴' },
      { id: 'newyear',   label: 'おとしだま', emoji: '🧧' },
      { id: 'helping',   label: 'おてつだい', emoji: '🧹' },
      { id: 'birthday',  label: 'たんじょうび', emoji: '🎂' },
      { id: 'gift-in',   label: 'プレゼント', emoji: '🎁' },
      { id: 'other-in',  label: 'そのた',   emoji: '✨' }
    ],
    out: [
      { id: 'snack',     label: 'おかし',   emoji: '🍭' },
      { id: 'toy',       label: 'おもちゃ', emoji: '🧸' },
      { id: 'book',      label: 'まんが',   emoji: '📚' },
      { id: 'game',      label: 'ゲーム',   emoji: '🎮' },
      { id: 'food-out',  label: 'おしょくじ', emoji: '🍔' },
      { id: 'gift-out',  label: 'プレゼント', emoji: '🎁' },
      { id: 'stationery',label: 'ぶんぼうぐ', emoji: '✏️' },
      { id: 'other-out', label: 'そのた',   emoji: '📦' }
    ]
  };

  const $ = (id) => document.getElementById(id);
  const balanceEl = $('balance');
  const deltaEl = $('delta');
  const goalNameEl = $('goal-name');
  const goalPctEl = $('goal-pct');
  const goalBarEl = $('goal-bar');
  const goalNowEl = $('goal-now');
  const goalTargetEl = $('goal-target');
  const recListEl = $('rec-list');
  const recCountEl = $('rec-count');

  const addModal = $('add-modal');
  const modalTitle = $('modal-title');
  const catGridEl = $('cat-grid');
  const fAmount = $('f-amount'), fDate = $('f-date'), fNote = $('f-note');
  const formError = $('form-error');

  const goalModal = $('goal-modal');
  const gName = $('g-name'), gTarget = $('g-target');

  const toastEl = $('toast');

  const state = {
    records: [],   // {id, kind:'in'|'out', categoryId, amount, date, note}
    goal:    { name: '', target: 0 },
    draft:   { kind: 'in', categoryId: '' }
  };
  load();

  function load() {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (!s) return;
      const obj = JSON.parse(s);
      if (Array.isArray(obj.records)) state.records = obj.records;
      if (obj.goal && typeof obj.goal === 'object') state.goal = obj.goal;
    } catch {}
  }
  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      records: state.records,
      goal: state.goal
    }));
  }

  function clearChildren(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function el(tag, props) {
    const e = document.createElement(tag);
    if (props) for (const k in props) {
      if (k === 'class') e.className = props[k];
      else if (k === 'style') Object.assign(e.style, props[k]);
      else if (k === 'text') e.textContent = props[k];
      else e.setAttribute(k, props[k]);
    }
    return e;
  }
  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function formatYen(n) {
    return '¥' + Math.round(n).toLocaleString('ja-JP');
  }
  function categoryById(id) {
    for (const arr of [CATEGORIES.in, CATEGORIES.out]) {
      const c = arr.find((x) => x.id === id);
      if (c) return c;
    }
    return null;
  }
  function showToast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toastEl.classList.remove('show'), 1500);
  }

  // ---------- Render ----------
  function render() {
    // Balance
    let inSum = 0, outSum = 0;
    let inThisMonth = 0, outThisMonth = 0;
    const ym = todayStr().slice(0, 7);
    for (const r of state.records) {
      if (r.kind === 'in')  inSum  += r.amount;
      else                  outSum += r.amount;
      if (r.date.slice(0, 7) === ym) {
        if (r.kind === 'in') inThisMonth += r.amount;
        else                  outThisMonth += r.amount;
      }
    }
    const balance = inSum - outSum;
    balanceEl.textContent = formatYen(balance);
    deltaEl.textContent = `今月: もらった ${formatYen(inThisMonth)} / つかった ${formatYen(outThisMonth)}`;

    // Goal
    if (state.goal.target > 0) {
      goalNameEl.textContent = state.goal.name || 'ほしいもの';
      goalNameEl.classList.remove('empty');
      goalNowEl.textContent = formatYen(balance);
      goalTargetEl.textContent = formatYen(state.goal.target);
      const pct = Math.max(0, Math.min(100, (balance / state.goal.target) * 100));
      goalPctEl.textContent = pct.toFixed(0) + '%';
      goalBarEl.style.width = pct + '%';
    } else {
      goalNameEl.textContent = 'ほしいもの未設定';
      goalNameEl.classList.add('empty');
      goalPctEl.textContent = '';
      goalNowEl.textContent = '¥0';
      goalTargetEl.textContent = '¥0';
      goalBarEl.style.width = '0%';
    }

    // Records
    const sorted = state.records.slice().sort((a, b) =>
      a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id
    );
    recCountEl.textContent = `(${sorted.length})`;
    clearChildren(recListEl);
    if (sorted.length === 0) {
      const e = el('div', { class: 'list-empty' });
      e.textContent = 'まだ なにも きろくしてないよ。\n「もらった」か「つかった」を おしてね';
      recListEl.appendChild(e);
      return;
    }
    for (const r of sorted) {
      const c = categoryById(r.categoryId);
      const row = el('div', { class: 'rec ' + r.kind });
      const ic = el('div', { class: 'icon', text: c?.emoji || '?' });
      ic.style.background = r.kind === 'in' ? '#d6f5d6' : '#ffd6dc';
      const meta = el('div', { class: 'meta' });
      meta.appendChild(el('div', { class: 'cat', text: c?.label || r.categoryId }));
      if (r.note) meta.appendChild(el('div', { class: 'note', text: r.note }));
      const dt = el('div', { class: 'date', text: r.date.slice(5).replace('-', '/') });
      const am = el('div', {
        class: 'amt',
        text: (r.kind === 'in' ? '+' : '-') + formatYen(r.amount)
      });
      const del = el('button', { class: 'del', text: '✕', title: 'けす' });
      del.addEventListener('click', () => {
        if (!confirm('この きろく を けしますか？')) return;
        state.records = state.records.filter((x) => x.id !== r.id);
        save();
        render();
      });
      row.appendChild(ic);
      row.appendChild(meta);
      row.appendChild(dt);
      row.appendChild(am);
      row.appendChild(del);
      recListEl.appendChild(row);
    }
  }

  // ---------- Add modal ----------
  function openAdd(kind) {
    state.draft = { kind, categoryId: CATEGORIES[kind][0].id };
    modalTitle.textContent = kind === 'in' ? '💰 もらった' : '🛒 つかった';
    fAmount.value = '';
    fDate.value = todayStr();
    fNote.value = '';
    formError.style.display = 'none';
    rebuildCatGrid();
    addModal.classList.add('show');
    setTimeout(() => fAmount.focus(), 50);
  }
  function rebuildCatGrid() {
    clearChildren(catGridEl);
    for (const c of CATEGORIES[state.draft.kind]) {
      const b = el('button', { class: 'cat-btn' + (c.id === state.draft.categoryId ? ' on' : '') });
      b.appendChild(el('div', { class: 'emoji', text: c.emoji }));
      b.appendChild(el('div', { text: c.label }));
      b.addEventListener('click', () => {
        state.draft.categoryId = c.id;
        rebuildCatGrid();
      });
      catGridEl.appendChild(b);
    }
  }
  function saveAdd() {
    const amount = Math.floor(Number(fAmount.value) || 0);
    if (amount <= 0) {
      formError.textContent = 'いくら？ を 1いじょう にゅうりょくしてね';
      formError.style.display = '';
      return;
    }
    state.records.push({
      id: Date.now(),
      kind: state.draft.kind,
      categoryId: state.draft.categoryId,
      amount,
      date: fDate.value || todayStr(),
      note: fNote.value.trim() || ''
    });
    save();
    addModal.classList.remove('show');
    render();
    showToast(state.draft.kind === 'in' ? 'もらった！' : 'つかった！');
  }

  // ---------- Goal modal ----------
  function openGoal() {
    gName.value = state.goal.name || '';
    gTarget.value = state.goal.target || '';
    goalModal.classList.add('show');
    setTimeout(() => gName.focus(), 50);
  }
  function saveGoal() {
    const name = gName.value.trim();
    const target = Math.floor(Number(gTarget.value) || 0);
    state.goal = { name, target };
    save();
    goalModal.classList.remove('show');
    render();
    if (target > 0) showToast('もくひょう セット！');
  }
  function clearGoal() {
    state.goal = { name: '', target: 0 };
    save();
    goalModal.classList.remove('show');
    render();
    showToast('もくひょう けしました');
  }

  // ---------- Wire up ----------
  $('btn-in').addEventListener('click', () => openAdd('in'));
  $('btn-out').addEventListener('click', () => openAdd('out'));
  $('btn-save').addEventListener('click', saveAdd);
  $('btn-cancel').addEventListener('click', () => addModal.classList.remove('show'));
  fAmount.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveAdd(); });
  addModal.addEventListener('click', (e) => {
    if (e.target === addModal) addModal.classList.remove('show');
  });

  $('btn-goal').addEventListener('click', openGoal);
  $('btn-goal-save').addEventListener('click', saveGoal);
  $('btn-goal-clear').addEventListener('click', clearGoal);
  goalModal.addEventListener('click', (e) => {
    if (e.target === goalModal) goalModal.classList.remove('show');
  });

  $('btn-reset').addEventListener('click', () => {
    if (!confirm('ぜんぶ けしますか？')) return;
    state.records = [];
    state.goal = { name: '', target: 0 };
    save();
    render();
    showToast('リセットしました');
  });
  $('btn-share').addEventListener('click', () => {
    let inSum = 0, outSum = 0;
    for (const r of state.records) {
      if (r.kind === 'in') inSum += r.amount; else outSum += r.amount;
    }
    const balance = inSum - outSum;
    let txt = `わたしのおこづかい：のこり ${formatYen(balance)} / ぜんぶで ${formatYen(inSum)} もらった！`;
    if (state.goal.target > 0) {
      const pct = ((balance / state.goal.target) * 100).toFixed(0);
      txt += ` 「${state.goal.name || 'ほしいもの'}」まで ${pct}% #おこづかいちょう`;
    } else {
      txt += ' #おこづかいちょう';
    }
    const url = `https://x.com/intent/post?text=${encodeURIComponent(txt)}&url=${encodeURIComponent(SHARE_URL)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  });

  render();
})();

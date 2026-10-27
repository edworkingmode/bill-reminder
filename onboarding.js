// 新手引導：第一次使用（沒有任何帳單）時自動打開，也可以從「全部帳單」頁重新打開。
// 流程：歡迎 → 勾選有哪些帳單 → 每一類快速填幾筆 → 完成＋加到主畫面教學。
// 依賴 index.html 的 store、esc、refresh、CATEGORY。
(() => {
  const GROUPS = {
    credit_card: { title: '信用卡', icon: '💳', tone: '', hint: '點銀行名稱就會加一張；每張填「每月幾號截止」。',
      chips: ['中國信託', '國泰世華', '台新', '玉山', '永豐', '星展', '滙豐', '富邦', '美國運通', '其他'], fields: ['due_day'] },
    rent: { title: '房租', icon: '🏠', tone: 'orange', hint: '用地址或社區名稱區分，例如「陽明路」。',
      chips: null, fields: ['location', 'due_day', 'default_amount'] },
    utility: { title: '水電瓦斯', icon: '💡', tone: 'violet', hint: '一個地址一行，勾選那裡要繳哪幾種。通常每兩個月一期。',
      chips: null, fields: ['location', 'types'] },
    phone: { title: '電話費', icon: '📱', tone: 'orange', hint: '點電信公司就會加一筆。',
      chips: ['中華電信', '台灣大哥大', '遠傳', '台灣之星', '其他'], fields: ['due_day'] },
    interest: { title: '貸款／利息', icon: '🏦', tone: 'orange', hint: '例如「土地銀行 利息」。',
      chips: null, fields: ['name', 'due_day'] },
    other: { title: '其他', icon: '🧾', tone: '', hint: '保險、管理費、學費……都可以。',
      chips: null, fields: ['name', 'due_day'] }
  };
  const UTIL = [['water', '水費'], ['electricity', '電費'], ['gas', '瓦斯費']];

  let step = 0, picked = [], rows = {}, el = null;

  const css = `
  .ob { position: fixed; inset: 0; z-index: 50; background: var(--paper); overflow-y: auto; -webkit-overflow-scrolling: touch; }
  .ob-in { width: min(100%, 430px); margin: 0 auto; padding: calc(16px + env(safe-area-inset-top)) 16px calc(120px + env(safe-area-inset-bottom)); }
  .ob-top { display: flex; align-items: center; gap: 10px; height: 44px; }
  .ob-top .back { background: rgba(0,0,0,.06); width: 44px; height: 44px; font-size: 20px; }
  .ob-top .skip { margin-left: auto; background: none; color: var(--soft); font-size: 16px; padding: 8px; }
  .ob-steps { display: flex; gap: 6px; flex: 1; justify-content: center; }
  .ob-steps i { width: 8px; height: 8px; border-radius: 99px; background: rgba(0,0,0,.14); }
  .ob-steps i.on { width: 22px; background: var(--accent); }
  .ob h1 { margin-top: 18px; }
  .ob .lead { color: var(--copy); font-size: 18px; margin: 6px 0 18px; }
  .ob-feats { display: grid; gap: 10px; margin: 18px 0; }
  .ob-feat { display: flex; gap: 14px; align-items: center; background: var(--card); border-radius: 17px; padding: 14px 16px; box-shadow: var(--shadow); font-size: 18px; }
  .ob-feat b { display: block; font-size: 19px; }
  .ob-feat span { color: var(--soft); font-size: 16px; }
  .ob-feat .ic { font-size: 28px; }
  .ob-tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .ob-tile { background: var(--card); border-radius: 17px; padding: 16px 12px; box-shadow: var(--shadow); text-align: center; font-size: 19px; font-weight: 600; border: 2px solid transparent; color: var(--ink); }
  .ob-tile .ic { display: block; font-size: 32px; margin-bottom: 4px; }
  .ob-tile { transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease; }
  .ob-tile:active { transform: scale(.96); }
  .ob-tile.on { border-color: transparent; background: linear-gradient(#fff, #fff) padding-box, linear-gradient(135deg, #5bfcc4, #f593e4, #71a4f0) border-box; box-shadow: 0 6px 18px rgba(245,147,228,.25); animation: pop .3s ease; }
  .ob-tile.on::after { content: "✓ 有"; display: block; font-size: 15px; margin-top: 2px; background: linear-gradient(90deg, #2bbf8f, #d65cbf, #4a7fd6); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .ob-chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 4px 0 16px; }
  .ob-chips button { transition: transform .15s ease; }
  .ob-chips button:active { transform: scale(.94); }
  .ob-chips button { background: #fff; color: var(--ink); padding: 0 16px; height: 46px; font-size: 18px; box-shadow: var(--shadow); }
  .ob-row:last-of-type { animation: rowIn .35s cubic-bezier(.16,1,.3,1); }
  @keyframes rowIn { from { opacity: 0; transform: translateY(8px) scale(.98); } }
  .ob-row { background: var(--card); border-radius: 17px; padding: 12px 14px; box-shadow: var(--shadow); margin-bottom: 10px; position: relative; }
  .ob-row .rm { position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,.06); width: 36px; height: 36px; font-size: 16px; color: var(--soft); }
  .ob-row .nm { font-size: 19px; font-weight: 600; padding-right: 40px; margin-bottom: 6px; }
  .ob-row label { margin: 8px 0 4px; font-size: 15px; }
  .ob-row .two { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .ob-checks { display: flex; gap: 8px; margin-top: 8px; }
  .ob-checks label:has(input:checked) { border-color: transparent; background: linear-gradient(#fff, #fff) padding-box, linear-gradient(135deg, #5bfcc4, #f593e4, #71a4f0) border-box; border-width: 2px; }
  .ob-checks label { transition: all .2s ease; flex: 1; margin: 0; display: flex; align-items: center; justify-content: center; gap: 6px; height: 48px; border-radius: 14px; background: rgba(0,0,0,.04); border: 1px solid rgba(0,0,0,.14); color: var(--ink); font-size: 18px; }

  .ob-add { width: 100%; height: 52px; background: rgba(0,0,0,.06); color: var(--ink); font-size: 18px; margin-top: 4px; }
  .ob-bottom { position: fixed; left: 0; right: 0; bottom: 0; padding: 12px 16px calc(14px + env(safe-area-inset-bottom)); background: linear-gradient(transparent, var(--paper) 30%); }
  .ob-bottom button { display: block; width: min(100%, 398px); margin: 0 auto; height: 58px; font-size: 20px; }
  .ob-how { background: var(--card); border-radius: 17px; padding: 14px 16px; box-shadow: var(--shadow); margin-top: 12px; font-size: 17px; }
  .ob-how b { display: block; font-size: 18px; margin-bottom: 4px; }
  .ob-how ol { margin: 0; padding-left: 22px; }
  .ob .hero { margin-top: 8px; }
  `;

  function mount() {
    if (!document.getElementById('ob-css')) { const s = document.createElement('style'); s.id = 'ob-css'; s.textContent = css; document.head.appendChild(s); }
    el = document.createElement('div'); el.className = 'ob'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', '新手引導');
    document.body.appendChild(el); document.body.style.overflow = 'hidden';
    el.addEventListener('click', onClick); el.addEventListener('input', onInput);
  }
  function close() { el?.remove(); el = null; document.body.style.overflow = ''; try { localStorage.setItem('ob-done', '1'); } catch {} }

  // 畫面順序：0 歡迎、1 勾選、2..(1+n) 各類、最後 完成
  const total = () => 3 + picked.length;
  const groupAt = s => picked[s - 2];
  const dots = () => `<div class="ob-steps">${Array.from({ length: total() }, (_, i) => `<i class="${i === step ? 'on' : ''}"></i>`).join('')}</div>`;
  const top = (back = true) => `<div class="ob-top">${back && step > 0 ? '<button class="back" data-ob="back" aria-label="上一步">‹</button>' : '<span style="width:44px"></span>'}${dots()}<button class="skip" data-ob="skip">${step === 0 ? '先看看' : '跳過'}</button></div>`;
  const bottom = (label, act = 'next', dis = false) => `<div class="ob-bottom"><button class="primary" data-ob="${act}" ${dis ? 'disabled style="opacity:.4"' : ''}>${label}</button></div>`;

  function render() {
    const y = el.scrollTop;
    let html = '';
    if (step === 0) {
      html = top(false) + `<h1>歡迎使用<br>繳費提醒</h1><p class="lead">花 3 分鐘，把每個月要繳的錢都記進來。</p>
        <div class="ob-feats">
          <div class="ob-feat"><span class="ic">📅</span><div><b>記住到期日</b><span>信用卡、房租、水電、電話一次看完</span></div></div>
          <div class="ob-feat"><span class="ic">🔔</span><div><b>快到期會提醒</b><span>首頁最上面就是最急的那一筆</span></div></div>
          <div class="ob-feat"><span class="ic">✅</span><div><b>按一下就記好</b><span>繳完按「繳了」，金額可以之後再補</span></div></div>
        </div>` + bottom('開始設定');
    } else if (step === 1) {
      html = top() + `<h1>你有哪些帳單？</h1><p class="lead">有的都點一下，可以選很多個。</p>
        <div class="ob-tiles">${Object.entries(GROUPS).map(([k, g]) => `<button class="ob-tile ${picked.includes(k) ? 'on' : ''}" data-pick="${k}"><span class="ic">${g.icon}</span>${g.title}</button>`).join('')}</div>`
        + bottom(picked.length ? `下一步（選了 ${picked.length} 類）` : '至少選一類', 'next', !picked.length);
    } else if (step < total() - 1) {
      const k = groupAt(step), g = GROUPS[k], list = rows[k] ||= [];
      if (!list.length && !g.chips) list.push(blank(k));
      html = top() + `<h1>${g.icon} ${g.title}</h1><p class="lead">${g.hint}</p>
        ${g.chips ? `<div class="ob-chips">${g.chips.map(c => `<button data-chip="${esc(c)}">＋ ${esc(c)}</button>`).join('')}</div>` : ''}
        ${list.map((r, i) => rowHtml(k, r, i)).join('')}
        ${g.chips ? (list.length ? '' : '<div class="empty">點上面的名稱加入</div>') : `<button class="ob-add" data-ob="addrow">＋ 再加一${k === 'utility' ? '個地址' : '筆'}</button>`}
        <p class="hint" style="margin-top:14px">不知道的欄位先空著，之後在「全部帳單」裡隨時可以補。</p>`
        + bottom(step === total() - 2 ? '完成' : '下一步');
    } else {
      const n = toBills().length;
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      html = top() + `<div class="hero"><div class="label">設定完成</div><div class="title">已經準備好</div><div class="metric"><span class="num">${n}</span><span class="unit">筆帳單</span></div><div class="caption">按下面的按鈕就會存起來</div></div>
        <div class="ob-how"><b>📲 把它放到手機主畫面</b>像 App 一樣，一點就打開：
          ${ios ? '<ol><li>按 Safari 下方的「分享」按鈕（方框加箭頭）</li><li>往下找「加入主畫面」</li><li>按右上角「新增」</li></ol>'
                : '<ol><li>按 Chrome 右上角的「⋮」</li><li>選「加到主畫面」或「安裝應用程式」</li><li>按「新增」</li></ol>'}</div>
        <div class="ob-how"><b>💡 小提醒</b>首頁最上面的大卡片就是最急的那一筆；繳完按「繳了」。</div>`
        + bottom(n ? `存好 ${n} 筆，開始使用` : '開始使用', 'finish');
    }
    el.innerHTML = `<div class="ob-in">${html}</div>`;
    el.scrollTop = y;
  }

  function blank(k, name = '') { return k === 'utility' ? { location: '', types: ['water', 'electricity', 'gas'] } : { name, location: '', due_day: '', default_amount: '' }; }
  function rowHtml(k, r, i) {
    const g = GROUPS[k], f = n => g.fields.includes(n);
    const day = f('due_day') ? `<div><label>每月幾號截止</label><input data-r="${i}" data-f="due_day" type="number" inputmode="numeric" min="1" max="31" placeholder="例如 15" value="${esc(r.due_day)}"></div>` : '';
    return `<div class="ob-row">
      ${(g.chips || list(k).length > 1) ? `<button class="rm" data-rm="${i}" aria-label="刪除">✕</button>` : ''}
      ${g.chips && !r.custom ? `<div class="nm">${esc(r.name)}</div>` : ''}
      ${f('name') || r.custom ? `<label>名稱</label><input data-r="${i}" data-f="name" placeholder="${k === 'interest' ? '例如 土地銀行 利息' : '例如 大樓管理費'}" value="${esc(r.name)}">` : ''}
      ${f('location') ? `<label>地址或名稱</label><input data-r="${i}" data-f="location" placeholder="例如 陽明路" value="${esc(r.location)}">` : ''}
      ${f('types') ? `<div class="ob-checks">${UTIL.map(([t, l]) => `<label><input type="checkbox" data-r="${i}" data-t="${t}" ${r.types.includes(t) ? 'checked' : ''}>${l.replace('費', '')}</label>`).join('')}</div>` : ''}
      ${f('default_amount') ? `<div class="two">${day}<div><label>每月金額（元）</label><input data-r="${i}" data-f="default_amount" type="number" inputmode="numeric" placeholder="例如 15000" value="${esc(r.default_amount)}"></div></div>` : day}
    </div>`;
  }
  const list = k => rows[k] || [];

  // 把引導填的內容轉成帳單規則；空白的列略過
  function toBills() {
    const out = [], num = v => v === '' || v == null ? null : Number(v);
    for (const k of picked) for (const r of list(k)) {
      if (k === 'utility') {
        if (!r.location.trim() && !r.types.length) continue;
        for (const [t, l] of UTIL) if (r.types.includes(t)) out.push({ name: l, category: t, location: r.location.trim() || null, due_type: 'every_n_months', interval_months: 2, amount_type: 'variable' });
      } else {
        const name = k === 'rent' ? '房租' : (r.name || '').trim();
        if (!name || (k === 'rent' && !r.location.trim() && !r.due_day && !r.default_amount)) continue;
        const day = num(r.due_day);
        out.push({ name, category: k === 'interest' ? 'interest' : k, location: r.location?.trim() || null, due_type: 'monthly_day', due_day: day >= 1 && day <= 31 ? day : null,
          interval_months: 1, amount_type: k === 'rent' ? 'fixed' : 'variable', default_amount: num(r.default_amount) });
      }
    }
    return out;
  }

  function onInput(e) {
    const t = e.target, k = groupAt(step); if (!k) return;
    const r = list(k)[t.dataset.r]; if (!r) return;
    if (t.dataset.f) r[t.dataset.f] = t.value;
    if (t.dataset.t) r.types = t.checked ? [...new Set([...r.types, t.dataset.t])] : r.types.filter(x => x !== t.dataset.t);
  }
  async function onClick(e) {
    const t = e.target.closest('button'); if (!t) return;
    const k = groupAt(step);
    if (t.dataset.pick) { const p = t.dataset.pick; picked = picked.includes(p) ? picked.filter(x => x !== p) : Object.keys(GROUPS).filter(x => x === p || picked.includes(x)); return render(); }
    if (t.dataset.chip) { list(k).push({ ...blank(k, t.dataset.chip === '其他' ? '' : t.dataset.chip), custom: t.dataset.chip === '其他' }); render(); el.querySelectorAll('.ob-row input')[el.querySelectorAll('.ob-row input').length - 1]?.focus(); return; }
    if (t.dataset.rm !== undefined) { list(k).splice(+t.dataset.rm, 1); return render(); }
    const a = t.dataset.ob;
    if (a === 'next') { step++; el.scrollTop = 0; render(); }
    else if (a === 'back') { step--; el.scrollTop = 0; render(); }
    else if (a === 'addrow') { list(k).push(blank(k)); render(); }
    else if (a === 'skip') { if (step === 0 || confirm('先跳過設定？之後可以在「全部帳單」重新打開。')) close(); }
    else if (a === 'finish') {
      const bills = toBills(); t.disabled = true; t.textContent = '儲存中…';
      try { for (const b of bills) await store.saveBill(b); }
      catch (err) { alert('存檔失敗：' + err.message); t.disabled = false; t.textContent = '再試一次'; return; }
      close(); refresh();
    }
  }

  window.openOnboarding = () => { step = 0; picked = []; rows = {}; mount(); render(); };
  window.shouldOnboard = bills => { try { return !bills.length && !localStorage.getItem('ob-done'); } catch { return !bills.length; } };
})();

// 信用卡詳情：點信用卡打開，上方是可翻面的信用卡（Edison 提供的 flip-card CSS，放大並加上 .fc 命名空間），
// 下方是這期截止日、發光勾選「這期已繳」、繳款紀錄。依賴 index.html 的 store、esc、BILLS、PAYS、occurrences 等。
(() => {
  const css = `
  #cardDlg { padding: 18px 16px 20px; }
  .fc-wrap { display: flex; flex-direction: column; align-items: center; gap: 8px; margin: 4px 0 6px; }
  .fc-hint { font-size: 14px; color: var(--soft); }
  /* 原尺寸 240×154、以 em 定位；把字級放大就整張等比放大。卡面文字比原版放大，長輩看得清楚 */
  .fc.flip-card { font-size: calc(min(340px, 100vw - 64px) / 15); width: 15em; height: 9.625em; background-color: transparent; perspective: 1000px; color: white; cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .fc .heading_8264 { position: absolute; letter-spacing: .12em; font-size: .62em; top: 1.6em; right: 1.6em; left: auto; font-weight: 600; }
  .fc .logo { position: absolute; top: 6.8em; left: 11.7em; }
  .fc .fchip { position: absolute; top: 2.3em; left: 1.5em; }
  .fc .contactless { position: absolute; top: 3.5em; left: 12.4em; }
  .fc .number { position: absolute; font-weight: bold; font-size: .75em; top: 6.64em; left: 1.28em; letter-spacing: .08em; }
  .fc .valid_thru { position: absolute; font-weight: bold; top: 635.8em; font-size: .01em; left: 140.3em; }
  .fc .date_8264 { position: absolute; font-weight: bold; font-size: .62em; top: 10.97em; left: 1.9em; }
  .fc .name { position: absolute; font-weight: 500; font-size: .62em; top: 12.98em; left: 1.9em; opacity: .85; }
  .fc .strip { position: absolute; width: 15em; height: 1.5em; top: 2.4em; background: repeating-linear-gradient(45deg, #303030, #303030 10px, #202020 10px, #202020 20px); }
  .fc .mstrip { position: absolute; background-color: #fff; width: 8em; height: .8em; top: 5em; left: .8em; border-radius: 2.5px; }
  .fc .sstrip { position: absolute; background-color: #fff; width: 4.1em; height: .8em; top: 5em; left: 10em; border-radius: 2.5px; }
  .fc .code { font-weight: bold; text-align: center; margin: .2em; color: black; font-size: .5em; line-height: 1.6em; }
  .fc .back-note { position: absolute; left: 1.6em; right: 1.6em; top: 12.6em; font-size: .55em; text-align: left; line-height: 1.6; opacity: .85; }
  .fc .flip-card-inner { position: relative; width: 100%; height: 100%; text-align: center; transition: transform .8s; transform-style: preserve-3d; }
  .fc:hover .flip-card-inner, .fc.flipped .flip-card-inner { transform: rotateY(180deg); }
  .fc .flip-card-front, .fc .flip-card-back { position: absolute; display: flex; flex-direction: column; justify-content: center; width: 100%; height: 100%;
    -webkit-backface-visibility: hidden; backface-visibility: hidden; border-radius: 1rem; background-color: #171717;
    box-shadow: rgba(0,0,0,.4) 0 2px 2px, rgba(0,0,0,.3) 0 7px 13px -3px, rgba(0,0,0,.2) 0 -1px 0 inset; }
  .fc .flip-card-back { transform: rotateY(180deg); }
  @media (hover: none) { .fc:hover .flip-card-inner { transform: none; } .fc.flipped:hover .flip-card-inner { transform: rotateY(180deg); } }
  .cd-period { background: #fff; border-radius: 17px; padding: 14px 16px; margin-top: 12px; box-shadow: var(--shadow); }
  .cd-period .due { font-size: 20px; font-weight: 600; }
  .cd-period .meta { color: var(--soft); font-size: 16px; }
  .cd-period .checkbox-wrapper { padding: 12px 4px 4px; }
  .cd-period .checkbox-wrapper .label { font-size: 20px; }
  .cd-hist { margin-top: 12px; }
  .cd-hist div { display: flex; justify-content: space-between; padding: 8px 4px; border-bottom: 1px solid var(--line); font-size: 17px; }
  .cd-hist div span:last-child { color: var(--soft); }
  `;
  const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);

  const dlg = document.createElement('dialog'); dlg.id = 'cardDlg'; document.body.appendChild(dlg);
  let cur = null;   // { b, due }

  const chipSvg = `<svg class="fchip" width="30" height="30" viewBox="0 0 50 50" aria-hidden="true"><rect x="5" y="10" width="40" height="30" rx="6" fill="#d8b56a"/><path d="M5 20h12M5 30h12M33 20h12M33 30h12M17 10v30M33 10v30" stroke="#a7843f" stroke-width="2" fill="none"/></svg>`;
  const nfcSvg = `<svg class="contactless" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M8.5 8.5a5 5 0 0 1 0 7M12 6a8.5 8.5 0 0 1 0 12M15.5 3.5a12 12 0 0 1 0 17"/></svg>`;
  const logoSvg = `<svg class="logo" width="36" height="36" viewBox="0 0 48 48" aria-hidden="true"><circle cx="18" cy="24" r="12" fill="#ff9800" opacity=".95"/><circle cx="30" cy="24" r="12" fill="#d50000" opacity=".85"/></svg>`;

  // 這張卡「目前這一期」：最早一期還沒繳的；都繳了就顯示最近一期
  function period(b) {
    const today = todayStr(), back = ymd(new Date(Date.now() - 60 * 86400000)), ahead = ymd(new Date(Date.now() + 40 * 86400000));
    const start = b.created_at && b.created_at.slice(0, 10) > back ? b.created_at.slice(0, 10) : back;
    const occ = occurrences(b, start, ahead), paid = new Set(PAYS.filter(p => p.bill_id === b.id).map(p => p.due_date));
    return occ.find(d => !paid.has(d)) || occ.filter(d => d <= today).pop() || occ[0] || null;
  }

  function render() {
    const { b, due } = cur;
    const p = due && PAYS.find(x => x.bill_id === b.id && x.due_date === due);
    const days = due ? daysBetween(todayStr(), due) : null;
    const last4 = (b.account_hint || '').replace(/\D/g, '').slice(-4);
    const hist = PAYS.filter(x => x.bill_id === b.id).sort((a, c) => c.due_date.localeCompare(a.due_date)).slice(0, 6);
    dlg.innerHTML = `
      <div class="fc-wrap">
        <div class="fc flip-card" role="button" aria-label="點一下翻面">
          <div class="flip-card-inner">
            <div class="flip-card-front">
              <p class="heading_8264">${esc(b.name)}</p>${logoSvg}${chipSvg}${nfcSvg}
              <p class="number">•••• •••• •••• ${last4 || '••••'}</p>
              <p class="valid_thru">VALID THRU</p>
              <p class="date_8264">截止 每月 ${b.due_day ?? '?'} 號</p>
              <p class="name">${b.statement_day ? `結帳 每月 ${b.statement_day} 號` : '結帳日 未填'}${b.note ? '・' + esc(b.note) : ''}</p>
            </div>
            <div class="flip-card-back">
              <div class="strip"></div><div class="mstrip"></div><div class="sstrip"><p class="code">${last4 || '----'}</p></div>
              <p class="back-note">${b.pay_method ? '繳法：' + esc(b.pay_method) + '<br>' : ''}${b.default_amount ? `參考金額：${Number(b.default_amount).toLocaleString()} 元` : '還沒有參考金額'}</p>
            </div>
          </div>
        </div>
        <div class="fc-hint">點卡片可以翻面</div>
      </div>
      <div class="cd-period">
        ${due ? `<div class="due">${fmtDate(due)} 截止</div>
          <div class="meta">${p ? `已經繳了${p.amount ? `・${Number(p.amount).toLocaleString()} 元` : ''}` : days < 0 ? `過期 ${-days} 天` : days === 0 ? '今天截止' : `還有 ${days} 天`}</div>
          <label class="checkbox-wrapper"><input type="checkbox" id="cdPaid" ${p ? 'checked' : ''}><span class="checkmark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span><span class="label">這期已繳</span></label>
          ${p ? `<button class="ghost" id="cdAmt">${p.amount ? '改金額' : '補金額'} ›</button>` : ''}`
        : '<div class="due">還沒有截止日</div><div class="meta">按下面「修改這張卡」填每月幾號截止</div>'}
      </div>
      ${hist.length ? `<div class="cd-hist"><h2 style="margin:16px 4px 4px">繳款紀錄</h2>${hist.map(x => `<div><span>${fmtDate(x.due_date)} 那期</span><span>${x.amount ? Number(x.amount).toLocaleString() + ' 元' : '沒填金額'}</span></div>`).join('')}</div>` : ''}
      <div class="row"><button class="secondary" id="cdEdit">修改這張卡</button><button class="primary" id="cdClose">關閉</button></div>`;
  }

  dlg.addEventListener('click', async e => {
    if (e.target.closest('.fc')) { e.target.closest('.fc').classList.toggle('flipped'); return; }
    if (e.target.id === 'cdClose') dlg.close();
    if (e.target.id === 'cdEdit') { dlg.close(); openBill(cur.b.id); }
    if (e.target.id === 'cdAmt') { dlg.close(); openPay(cur.b.id, cur.due); }
  });
  dlg.addEventListener('change', async e => {
    if (e.target.id !== 'cdPaid') return;
    const { b, due } = cur;
    try {
      if (e.target.checked) await store.pay(b.id, due, b.amount_type === 'fixed' && b.default_amount ? Number(b.default_amount) : null);
      else { const p = PAYS.find(x => x.bill_id === b.id && x.due_date === due); if (p) await store.unpay(p.id); }
      [BILLS, PAYS] = await Promise.all([store.bills(), store.payments()]);
      setTimeout(() => { render(); window.render?.(); }, 700);   // 等勾選動畫跑完再重畫
    } catch (err) { alert('存檔失敗：' + err.message); e.target.checked = !e.target.checked; }
  });
  dlg.addEventListener('close', () => refresh());

  window.openCard = (id, due) => {
    const b = BILLS.find(x => x.id === id); if (!b) return;
    cur = { b, due: due || period(b) }; render(); dlg.showModal();
  };
})();

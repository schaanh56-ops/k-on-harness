/*
 * dsh-kon-pet — K-ON! 平泽唯 desktop pet (client, injected by host).
 * Floating cutout with breathe / mouse-follow / click-reaction animations,
 * 20 dialogue lines, drag-to-move, hide, and DeepSeek API balance integration
 * (polls same-origin /api-balance; hides the stock dsh-api-balance badge and
 * surfaces 余额 / 今日合计 / 本月合计 / 缓存命中 / 模型合计 in a panel).
 */
(function () {
  'use strict';
  if (window.__konPetLoaded) return;
  window.__konPetLoaded = true;

  var ASSET = '/kon-pet/yui-cutout.png';
  var BALANCE_URL = '/api-balance';
  var LS_POS = 'kon-pet.pos';
  var LS_HIDDEN = 'kon-pet.hidden';
  var CONFIG_URL = '/kon-pet/config';

  /* ---------- 20 句台词（日文） + 余额台词 ---------- */
  var LINES = {
    shocked: [
      'え？', 'ええええ？！', 'あれ？', 'なにこれ…', 'うそでしょ…',
      'えへへ〜…あれ？', 'あ、思い出した！', 'あふぅ…', 'うにゃ〜…',
      'え？何？何？',
    ],
    recovered: [
      'やっほー！唯だよ〜！', 'うんうん、唯に任せて！', '今日も一日、がんばるぞ〜！',
      'わぁ〜！すっごい！', 'かわいい〜！',
    ],
    dazed: [
      'お腹空いたなぁ…', 'あ、そうだ！お菓子持ってきたんだ！',
      'えへへ〜、なんか楽しいことないかな〜', 'あれ？何か忘れちゃった？',
      'うん…あ、聞いてなかった！',
    ],
  };
  var BALANCE_LINES = {
    high: 'わぁ〜！いっぱい！',
    normal: 'うんうん、大丈夫！',
    low: 'え？もうないの？',
    empty: 'あふぅ…動けない…',
    unknown: 'え？',
  };
  function pick(list) { return list[(Math.random() * list.length) | 0]; }

  /* ---------- CSS ---------- */
  var CSS = [
    // hide the stock dsh-api-balance badge (keep its /api-balance endpoint)
    '[data-api-balance]{display:none!important;}',
    '#kon-pet-root{position:fixed;z-index:2147483000;user-select:none;-webkit-user-select:none;touch-action:none;font-family:"Yuanti SC","YouYuan","幼圆","PingFang SC","Microsoft YaHei",sans-serif;perspective:600px;}',
    '#kon-pet-root .kp-stage{cursor:grab;position:relative;}',
    '#kon-pet-root .kp-stage:active{cursor:grabbing;}',
    '#kon-pet-root .kp-sprite{display:block;width:172px;height:auto;transform-origin:50% 80%;animation:kp-breathe 2.4s ease-in-out infinite;filter:drop-shadow(0 10px 18px rgba(120,40,70,0.28));}',
    '#kon-pet-root .kp-sprite.kp-tap{animation:kp-breathe 2.4s ease-in-out infinite,kp-tap 0.9s ease;}',
    '#kon-pet-root .kp-sprite.kp-empty{filter:grayscale(1) drop-shadow(0 10px 18px rgba(0,0,0,0.3));}',
    '#kon-pet-root .kp-sprite.kp-low{filter:saturate(0.72) drop-shadow(0 10px 18px rgba(120,40,70,0.28));}',
    '#kon-pet-root .kp-sweat{position:absolute;top:16%;left:74%;width:18px;height:18px;display:none;animation:kp-sweat 2.6s ease-in-out infinite;z-index:6;}',
    '#kon-pet-root .kp-sweat.kp-on{display:block;}',
    '#kon-pet-root .kp-hide{position:absolute;top:-4px;right:-4px;width:22px;height:22px;border-radius:50%;border:1px solid rgba(255,255,255,0.7);background:rgba(242,107,143,0.9);color:#fff;font-size:13px;line-height:20px;text-align:center;cursor:pointer;opacity:0.42;transition:opacity .2s;box-shadow:0 2px 8px rgba(0,0,0,0.2);z-index:7;}',
    '#kon-pet-root:hover .kp-hide{opacity:1;}',
    '#kon-pet-root .kp-power{position:absolute;top:-4px;left:-4px;width:22px;height:22px;border-radius:50%;border:1px solid rgba(255,255,255,0.7);background:rgba(30,22,32,0.84);color:#fff;font-size:11px;line-height:20px;text-align:center;cursor:pointer;opacity:0.42;transition:opacity .2s;box-shadow:0 2px 8px rgba(0,0,0,0.2);z-index:7;}',
    '#kon-pet-root:hover .kp-power{opacity:1;}',
    '#kon-pet-root .kp-bubble{position:absolute;left:50%;bottom:calc(100% + 8px);transform:translateX(-50%) scale(0);transform-origin:50% 100%;max-width:240px;padding:8px 13px;border-radius:16px;background:rgba(255,143,171,0.88);border:1px solid rgba(255,255,255,0.5);color:#fff;font-size:13px;line-height:1.5;text-align:center;box-shadow:0 4px 20px rgba(255,143,171,0.35);transition:transform .2s cubic-bezier(.34,1.56,.64,1),opacity .18s;opacity:0;pointer-events:none;white-space:normal;z-index:6;}',
    '#kon-pet-root .kp-bubble.kp-on{transform:translateX(-50%) scale(1);opacity:1;}',
    '#kon-pet-root .kp-bubble::after{content:"";position:absolute;left:50%;top:100%;transform:translateX(-50%);border:6px solid transparent;border-top-color:rgba(255,143,171,0.88);}',
    '#kon-pet-root .kp-balance{position:absolute;left:50%;top:calc(100% + 6px);transform:translateX(-50%);display:flex;align-items:center;gap:5px;padding:3px 10px;border-radius:999px;background:rgba(30,22,32,0.86);color:#fff;font-size:11px;font-weight:600;cursor:pointer;border:1px solid rgba(255,255,255,0.16);box-shadow:0 3px 10px rgba(0,0,0,0.25);white-space:nowrap;z-index:6;}',
    '#kon-pet-root .kp-dot{width:7px;height:7px;border-radius:50%;background:#9aa0a6;}',
    '#kon-pet-root .kp-panel{position:absolute;left:50%;bottom:calc(100% + 34px);transform:translateX(-50%) translateY(8px);width:252px;background:rgba(30,22,32,0.95);color:#e8eaf0;border-radius:14px;padding:12px 14px;font-size:12px;line-height:1.7;border:1px solid rgba(255,255,255,0.14);box-shadow:0 8px 28px rgba(0,0,0,0.42);opacity:0;pointer-events:none;transition:opacity .18s ease,transform .2s cubic-bezier(.34,1.56,.64,1);z-index:8;}',
    '#kon-pet-root .kp-panel.kp-on{opacity:1;transform:translateX(-50%) translateY(0);pointer-events:auto;}',
    '#kon-pet-root .kp-panel-title{font-weight:700;color:#ff9db8;font-size:12px;letter-spacing:.5px;margin:2px 0 4px;}',
    '#kon-pet-root .kp-panel-title.kp-t2{margin-top:8px;}',
    '#kon-pet-root .kp-row{display:flex;justify-content:space-between;align-items:center;gap:8px;}',
    '#kon-pet-root .kp-row span{color:#aab0bb;}',
    '#kon-pet-root .kp-row b{color:#fff;font-weight:600;text-align:right;}',
    '#kon-pet-root .kp-row.kp-row-donut{justify-content:flex-start;gap:8px;}',
    '#kon-pet-root .kp-sub{color:#8f96a2;font-size:11px;padding-left:2px;}',
    '#kon-pet-root .kp-model{display:flex;justify-content:space-between;align-items:center;gap:6px;padding:1px 0;color:#c6ccd6;font-size:11px;}',
    '#kon-pet-root .kp-model span:first-child{color:#ffb3c6;font-weight:600;text-transform:uppercase;}',
    '#kon-pet-root .kp-model b{color:#fff;font-weight:600;}',
    '#kon-pet-root .kp-summon{display:none;position:fixed;right:24px;bottom:24px;z-index:2147483000;padding:8px 14px;border-radius:999px;background:rgba(242,107,143,0.92);color:#fff;font-size:12px;font-weight:600;cursor:pointer;border:1px solid rgba(255,255,255,0.5);box-shadow:0 4px 16px rgba(242,107,143,0.4);}',
    '#kon-pet-root .kp-summon.kp-on{display:block;}',
    '@keyframes kp-breathe{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}',
    '@keyframes kp-tap{0%{transform:scale(1)}12%{transform:scale(1.05)}24%{transform:scale(1)}45%{transform:rotateZ(-3deg)}62%{transform:rotateZ(3deg)}80%{transform:rotateZ(-1.5deg)}100%{transform:rotateZ(0)}}',
    '@keyframes kp-sweat{0%,100%{transform:translateY(0);opacity:0.9}50%{transform:translateY(4px);opacity:0.5}}',
    '@media (prefers-reduced-motion: reduce){#kon-pet-root .kp-sprite{animation:none}}',
  ].join('\n');

  /* ---------- 状态 ---------- */
  var balance = null;
  var enabled = true;
  var hidden = false;
  var hiddenInit = false;
  try { hiddenInit = localStorage.getItem(LS_HIDDEN) === '1'; } catch (e) {}

  /* ---------- DOM ---------- */
  var style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  var root = document.createElement('div');
  root.id = 'kon-pet-root';
  root.setAttribute('data-kon-pet', '');

  var stage = document.createElement('div');
  stage.className = 'kp-stage';

  var sprite = document.createElement('img');
  sprite.className = 'kp-sprite';
  sprite.src = ASSET;
  sprite.alt = 'Yui';
  sprite.draggable = false;

  var sweat = document.createElement('span');
  sweat.className = 'kp-sweat';
  sweat.innerHTML =
    '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 3c3 4.2 6 7.1 6 10.2A6 6 0 0 1 6 13.2C6 10.1 9 7.2 12 3z" fill="#6ec6ff" opacity="0.92"/></svg>';

  var hideBtn = document.createElement('button');
  hideBtn.className = 'kp-hide';
  hideBtn.textContent = '\u00d7';
  hideBtn.title = 'Hide Yui';

  var powerBtn = document.createElement('button');
  powerBtn.className = 'kp-power';
  powerBtn.textContent = '\u23fb';
  powerBtn.title = '\u542f\u52a8\u5f00\u5173\uff1a\u5173\u95ed\u5e73\u6cfd\u552f\u684c\u5ba0';

  var bubble = document.createElement('div');
  bubble.className = 'kp-bubble';

  var panel = document.createElement('div');
  panel.className = 'kp-panel';

  var balanceChip = document.createElement('div');
  balanceChip.className = 'kp-balance';
  var dot = document.createElement('span');
  dot.className = 'kp-dot';
  var balanceText = document.createElement('span');
  balanceText.textContent = '\u00a5\u2026';
  balanceChip.appendChild(dot);
  balanceChip.appendChild(balanceText);

  var summon = document.createElement('button');
  summon.className = 'kp-summon';
  summon.textContent = '\u266a summon yui';
  summon.title = '召唤唯';

  stage.appendChild(sprite);
  stage.appendChild(sweat);
  stage.appendChild(hideBtn);
  stage.appendChild(powerBtn);
  stage.appendChild(bubble);
  stage.appendChild(panel);
  stage.appendChild(balanceChip);
  root.appendChild(stage);
  document.body.appendChild(root);
  document.body.appendChild(summon);

  /* ---------- 位置 ---------- */
  function defaultPos() {
    var w = window.innerWidth, h = window.innerHeight;
    return { left: Math.max(8, w - 200), top: Math.max(8, h - 340) };
  }
  var pos = defaultPos();
  try {
    var saved = JSON.parse(localStorage.getItem(LS_POS) || 'null');
    if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') pos = saved;
  } catch (e) {}
  function applyPos() {
    root.style.left = pos.left + 'px';
    root.style.top = pos.top + 'px';
  }
  applyPos();

  /* ---------- 气泡 ---------- */
  var bubbleTimer = null;
  function say(text, ms, multiline) {
    bubble.style.whiteSpace = multiline ? 'pre-line' : 'normal';
    bubble.textContent = text;
    bubble.classList.add('kp-on');
    if (bubbleTimer) clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () {
      bubble.classList.remove('kp-on');
    }, ms || 3000);
  }

  /* ---------- 点击：惊吓 → 回神 ---------- */
  function tap() {
    sprite.classList.remove('kp-tap');
    void sprite.offsetWidth; /* reflow to restart animation */
    sprite.classList.add('kp-tap');
    setTimeout(function () { sprite.classList.remove('kp-tap'); }, 950);
    say(pick(LINES.shocked));
    lastInteract = Date.now();
  }

  /* ---------- 拖动 ---------- */
  var dragging = false, moved = false, startX = 0, startY = 0, origLeft = 0, origTop = 0;
  stage.addEventListener('mousedown', function (e) {
    if (e.target.closest && (e.target.closest('.kp-hide') || e.target.closest('.kp-balance') || e.target.closest('.kp-panel'))) return;
    dragging = true; moved = false;
    startX = e.clientX; startY = e.clientY;
    origLeft = pos.left; origTop = pos.top;
    e.preventDefault();
  });
  document.addEventListener('mousemove', function (e) {
    if (!dragging) return;
    var dx = e.clientX - startX, dy = e.clientY - startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
    pos.left = origLeft + dx; pos.top = origTop + dy;
    applyPos();
  });
  document.addEventListener('mouseup', function () {
    if (!dragging) return;
    dragging = false;
    try { localStorage.setItem(LS_POS, JSON.stringify(pos)); } catch (e) {}
    if (!moved) tap();
  });

  /* ---------- 悬停 / 空闲台词 ---------- */
  var hovered = false, lastInteract = Date.now();
  stage.addEventListener('mouseenter', function () {
    hovered = true;
    if (Date.now() - lastInteract > 8000) say(pick(LINES.dazed));
    else say('\u3042\u308c\uff1f'); /* あれ？ */
  });
  stage.addEventListener('mouseleave', function () { hovered = false; });

  setInterval(function () {
    if (hidden || hovered) return;
    if (Date.now() - lastInteract > 16000) {
      say(pick(LINES.dazed), 3500);
      lastInteract = Date.now();
    }
  }, 16000);

  /* ---------- 鼠标跟随（头部轻微转动） ---------- */
  var mx = 0, my = 0, hasMouse = false;
  document.addEventListener('mousemove', function (e) {
    mx = e.clientX; my = e.clientY; hasMouse = true;
  });
  function followLoop() {
    if (hasMouse && !hidden) {
      var rx = ((my / window.innerHeight) - 0.5) * -5; /* rotateX */
      var ry = ((mx / window.innerWidth) - 0.5) * 7;   /* rotateY */
      stage.style.transform =
        'rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)';
    }
    requestAnimationFrame(followLoop);
  }
  requestAnimationFrame(followLoop);

  /* ---------- 隐藏 / 召唤 / 启动开关 ---------- */
  function setHidden(h) {
    hidden = h;
    root.style.display = h ? 'none' : '';
    summon.classList.toggle('kp-on', h);
    summon.textContent = '\u266a summon yui';
    summon.title = '\u53ec\u5524\u552f';
    try { localStorage.setItem(LS_HIDDEN, h ? '1' : '0'); } catch (e) {}
  }
  function applyEnabled() {
    if (!enabled) {
      root.style.display = 'none';
      summon.textContent = '\u266a summon yui';
      summon.title = '\u542f\u7528\u5e73\u6cfd\u552f\u684c\u5ba0';
      summon.classList.add('kp-on');
    } else {
      setHidden(hiddenInit);
    }
  }
  async function setEnabled(v) {
    enabled = v;
    try {
      await fetch(CONFIG_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled: v }),
      });
    } catch (e) { /* keep local state */ }
    applyEnabled();
  }
  hideBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    setHidden(true);
  });
  powerBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    setEnabled(false);
  });
  summon.addEventListener('click', function () {
    if (!enabled) setEnabled(true);
    else setHidden(false);
  });

  /* ---------- 余额：分级 + 面板 ---------- */
  function fmtMoney(n) {
    if (n === null || n === undefined || isNaN(n)) return '\u2014';
    return '\u00a5' + Number(n).toFixed(2);
  }
  function fmtTokens(n) {
    if (n === null || n === undefined || isNaN(n)) return '\u2014';
    if (n >= 1e8) return (n / 1e8).toFixed(2) + '\u4ebf';
    if (n >= 1e4) return (n / 1e4).toFixed(1) + '\u4e07';
    return String(Math.round(n));
  }
  function tierOf(total) {
    if (total === null || total === undefined || isNaN(total)) return 'unknown';
    if (total <= 0) return 'empty';
    if (total < 1) return 'low';
    if (total < 50) return 'normal';
    return 'high';
  }
  var TIER_DOT = { high: '#7ac97a', normal: '#f26b8f', low: '#f0a04b', empty: '#9aa0a6', unknown: '#9aa0a6' };

  function donut(hit, miss, size, stroke) {
    var total = hit + miss;
    var pct = total > 0 ? hit / total : 0;
    var r = (size - stroke) / 2;
    var c = 2 * Math.PI * r;
    var cx = size / 2;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
      '<circle cx="' + cx + '" cy="' + cx + '" r="' + r + '" fill="none" stroke="rgba(255,183,77,0.45)" stroke-width="' + stroke + '"/>' +
      '<circle cx="' + cx + '" cy="' + cx + '" r="' + r + '" fill="none" stroke="#4caf50" stroke-width="' + stroke + '" stroke-linecap="round" stroke-dasharray="' + (pct * c) + ' ' + c + '" transform="rotate(-90 ' + cx + ' ' + cx + ')" opacity="0.95"/>' +
      '<text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" fill="#9fe0a0" font-size="' + Math.round(size * 0.28) + '" font-weight="700">' + (total > 0 ? Math.round(pct * 100) + '%' : '\u2014') + '</text>' +
      '</svg>';
  }

  function renderPanel() {
    var j = balance;
    if (!j) return '<div class="kp-sub">正在读取余额…</div>';
    if (j.ok === false && !j.stats) return '<div class="kp-sub">' + (j.error || '无余额数据') + '</div>';

    var total = j.total != null ? Number(j.total) : null;
    var today = j.stats && j.stats.today;
    var month = j.stats && j.stats.month;

    var html = '<div class="kp-panel-title">\u266a balance</div>';
    html += '<div class="kp-row"><span>\u4f59\u989d</span><b>' + fmtMoney(total) + '</b></div>';
    if (j.granted != null && Number(j.granted) > 0) html += '<div class="kp-row"><span>\u8d60\u9001</span><b>' + fmtMoney(j.granted) + '</b></div>';
    if (j.toppedUp != null && Number(j.toppedUp) > 0) html += '<div class="kp-row"><span>\u5145\u503c</span><b>' + fmtMoney(j.toppedUp) + '</b></div>';

    if (today) {
      var tt = (today.input || 0) + (today.output || 0);
      html += '<div class="kp-row"><span>\u4eca\u65e5\u5408\u8ba1</span><b>' + fmtTokens(tt) + ' tok \u00b7 ' + fmtMoney(today.cost) + '</b></div>';
    }
    if (month) {
      var mt = (month.input || 0) + (month.output || 0);
      html += '<div class="kp-row"><span>\u672c\u6708\u5408\u8ba1</span><b>' + fmtTokens(mt) + ' tok \u00b7 ' + fmtMoney(month.cost) + '</b></div>';
    }

    if (today) {
      var hit = today.cacheHit || 0;
      var miss = today.cacheMiss || 0;
      var totalIn = hit + miss;
      var pct = totalIn > 0 ? Math.round(hit / totalIn * 100) + '%' : '\u2014';
      html += '<div class="kp-row kp-row-donut"><span>\u7f13\u5b58\u547d\u4e2d</span>' + donut(hit, miss, 36, 6) + '<b>' + pct + '</b></div>';
      html += '<div class="kp-sub">\u547d\u4e2d ' + fmtTokens(hit) + ' \u00b7 \u672a\u547d\u4e2d ' + fmtTokens(miss) + '</div>';
    }

    if (today && today.byModel) {
      html += '<div class="kp-panel-title kp-t2">\u6a21\u578b\u5408\u8ba1</div>';
      var names = { pro: 'pro', flash: 'flash', other: 'other' };
      var any = false;
      for (var k in today.byModel) {
        var m = today.byModel[k];
        var mi = m.input || 0, mo = m.output || 0;
        if (mi + mo === 0) continue;
        any = true;
        html += '<div class="kp-model"><span>' + (names[k] || k) + '</span><span>in ' + fmtTokens(mi) + ' \u00b7 out ' + fmtTokens(mo) + '</span><b>' + fmtMoney(m.cost) + '</b></div>';
      }
      if (!any) html += '<div class="kp-sub">\u4eca\u65e5\u6682\u65e0\u8c03\u7528</div>';
    }
    return html;
  }

  function applyBalance() {
    var total = balance && balance.total != null ? Number(balance.total) : null;
    var tier = tierOf(total);
    dot.style.background = TIER_DOT[tier];
    balanceText.textContent = fmtMoney(total);
    panel.innerHTML = renderPanel();
    sprite.classList.toggle('kp-empty', tier === 'empty');
    sprite.classList.toggle('kp-low', tier === 'low');
    sweat.classList.toggle('kp-on', tier === 'low' || tier === 'empty');
  }

  balanceChip.addEventListener('click', function (e) {
    e.stopPropagation();
    var tier = tierOf(balance && balance.total != null ? Number(balance.total) : null);
    var line = BALANCE_LINES[tier] || BALANCE_LINES.unknown;
    say(line, 1800);
    panel.classList.toggle('kp-on');
    lastInteract = Date.now();
  });

  document.addEventListener('click', function (e) {
    if (panel.classList.contains('kp-on') && !(e.target.closest && e.target.closest('#kon-pet-root'))) {
      panel.classList.remove('kp-on');
    }
  });

  async function refreshBalance() {
    try {
      var r = await fetch(BALANCE_URL, { cache: 'no-store' });
      var j = await r.json();
      if (j && j.ok !== false) balance = j;
      else balance = balance || j;
      applyBalance();
    } catch (e) { /* offline / plugin absent: keep last */ }
  }
  refreshBalance();
  setInterval(refreshBalance, 60000);

  /* ---------- 初始化可见性（读取启动开关） ---------- */
  async function fetchEnabled() {
    try {
      var r = await fetch(CONFIG_URL, { cache: 'no-store' });
      var j = await r.json();
      if (j && typeof j.enabled === 'boolean') enabled = j.enabled;
    } catch (e) { /* default on */ }
    applyEnabled();
  }
  fetchEnabled();
})();

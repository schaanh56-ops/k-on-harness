/**
 * K-ON! 轻音少女 (kon) skin hooks — v2 skin contract escape hatch
 * (x-org.linxin666.skin-center/v1alpha1). Loading this module executes
 * nothing; apply() owns every DOM write and retracts it via ctx.onCleanup.
 *
 * Effects:
 *  - 五角色随机登场：进入会话/工作台时从五位主角随机选一位，作为毛玻璃
 *    动态模糊背景 + 强调色 + 罗马音徽标；切换会话/任务时丝滑换人（双图层
 *    交叉淡入淡出），退出回主页恢复合照。
 *  - 顶部缓落樱花（canvas，尊重 prefers-reduced-motion，隐藏时暂停）。
 *  - K-ON! 风格标题徽标 + 粉色音符 favicon。
 *  - 通过 CSS.registerProperty 让强调色 --kon-accent 平滑过渡。
 */

/** 五位主角（文件顺序按用户约定：梓/澪/紬/唯/律），界面只展示罗马音。 */
const CHARACTERS = [
  { id: 'yui',   name: 'yui hirasawa',    art: 'yui.jpg' },
  { id: 'mio',   name: 'mio akiyama',     art: 'mio.jpg' },
  { id: 'ritsu', name: 'ritsu tainaka',   art: 'ritsu.jpg' },
  { id: 'mugi',  name: 'tsumugi kotobuki', art: 'mugi.jpg' },
  { id: 'azusa', name: 'azusa nakano',    art: 'azusa.jpg' },
]

/** 粉色八分音符 favicon（内联 data URI，随皮肤携带）。 */
const FAVICON_URI =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
    '<rect x="2" y="2" width="60" height="60" rx="14" fill="#f26b8f"/>' +
    '<path d="M42 14v24.6a10 10 0 1 1-5-8.7V20.6l-15 4.1v21.7a10 10 0 1 1-5-8.7V15.4c0-1 .7-2 1.7-2.2l19-5.2c1.2-.3 2.4.4 2.9 1.4.3.6.4 1.1.4 1.6z" fill="#fff"/>' +
    '</svg>',
  )

/** K-ON! 徽标（自绘风格化文字，非官方商标素材）。 */
const LOGO_SVG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">' +
    '<path d="M8.5 15.5v-7l9-2.2v7.2a2.8 2.8 0 1 1-1.7-2.6V9.4l-5.6 1.4v5.7a2.8 2.8 0 1 1-1.7-2.6z" fill="#fff"/>' +
    '</svg>',
  )

function mk(tag, cls) {
  const el = document.createElement(tag)
  if (cls) el.className = cls
  return el
}

export default function defineSkinHooks() {
  return {
    apply(ctx) {
      const doc = document
      const body = doc.body
      const cleanups = []
      const on = (fn) => {
        cleanups.push(fn)
        ctx.onCleanup(fn)
      }

      // —— favicon ——
      const favicon = doc.createElement('link')
      favicon.rel = 'icon'
      favicon.type = 'image/svg+xml'
      favicon.href = FAVICON_URI
      doc.head.append(favicon)
      on(() => favicon.remove())

      // —— 让强调色平滑过渡（失败则退化为瞬时切换，不影响功能）——
      try {
        if (typeof CSS !== 'undefined' && CSS.registerProperty) {
          CSS.registerProperty({
            name: '--kon-accent',
            syntax: '<color>',
            inherits: true,
            initialValue: '#f26b8f',
          })
        }
      } catch (_) { /* noop */ }

      // —— 角色立绘双层（交叉淡入淡出）＋ 可读性纱幕 ——
      // 放在 background 层（z-index:-2），确保角色毛玻璃永远在对话框之下。
      const bg = ctx.layers.background
      const charA = mk('div', 'kon-char')
      const charB = mk('div', 'kon-char')
      charA.append(mk('div', 'kon-char-bg'))
      charB.append(mk('div', 'kon-char-bg'))
      const scrim = mk('div', 'kon-char-scrim')
      bg.append(charA, charB, scrim)
      on(() => {
        charA.remove(); charB.remove(); scrim.remove()
        body.removeAttribute('data-kon-char')
      })

      let front = charA
      let back = charB

      // —— 表面层：切换时立绘先清晰登场，再渐变退到毛玻璃背景 ——
      const surface = mk('div', 'kon-surface')
      const surfaceBg = mk('div', 'kon-surface-bg')
      surface.append(surfaceBg)
      ctx.layers.foreground.append(surface)
      on(() => surface.remove())
      let surfaceTimer = null

      // —— 预载五张立绘，避免首次切换抖动 ——
      for (const c of CHARACTERS) {
        const img = new Image()
        img.src = `${ctx.assetBase}/assets/${c.art}`
      }

      // —— 顶部：角色名徽标 ——
      const top = ctx.layers.top
      const badge = mk('div', 'kon-badge')
      const note = mk('span', 'kon-note')
      const badgeText = doc.createElement('span')
      badge.append(note, badgeText)
      top.append(badge)
      on(() => {
        badge.remove()
      })

      // —— 左侧功能栏：轻音少女音乐元素（固定装饰，不影响功能）——
      const deco = mk('div', 'kon-sidebar-deco')
      deco.setAttribute('aria-hidden', 'true')
      deco.textContent = '\u266a \u266b \u266a'
      doc.body.append(deco)
      on(() => deco.remove())

      // —— 樱花（foreground 层 canvas）——
      const canvas = mk('canvas', '')
      canvas.id = 'kon-sakura'
      ctx.layers.foreground.append(canvas)
      const sakura = startSakura(canvas)
      on(sakura.stop)

      // —— 状态机：会话/任务切换检测 + 角色换人 ——
      let currentCharId = null
      let inConv = false
      let lastViewKey = ''
      let lastDetailsHead = ''
      let lastDetailsLen = 0
      let lastRoll = 0
      let scheduled = false

      function rollCharacter() {
        const now = Date.now()
        if (now - lastRoll < 1200) return
        lastRoll = now
        let pool = CHARACTERS.filter((c) => c.id !== currentCharId)
        if (pool.length === 0) pool = CHARACTERS
        const pick = pool[(Math.random() * pool.length) | 0]
        currentCharId = pick.id

        back.querySelector('.kon-char-bg').style.backgroundImage =
          `url("${ctx.assetBase}/assets/${pick.art}")`
        back.classList.add('is-active')
        front.classList.remove('is-active')
        const t = front
        front = back
        back = t

        // 表面层：清晰登场，随后淡出退到背景
        surfaceBg.style.backgroundImage =
          `url("${ctx.assetBase}/assets/${pick.art}")`
        surface.classList.add('kon-surface-on')
        if (surfaceTimer) clearTimeout(surfaceTimer)
        surfaceTimer = setTimeout(() => {
          surface.classList.remove('kon-surface-on')
        }, 1500)

        body.setAttribute('data-kon-char', pick.id)
        badgeText.textContent = pick.name
        badge.classList.add('is-active')
      }

      function goHome() {
        inConv = false
        currentCharId = null
        surface.classList.remove('kon-surface-on')
        front.classList.remove('is-active')
        back.classList.remove('is-active')
        body.removeAttribute('data-kon-char')
        badge.classList.remove('is-active')
      }

      function evaluate() {
        scheduled = false
        const hasMsg = !!doc.querySelector('[data-chat-anchor-key]')
        if (!hasMsg) {
          if (inConv) goHome()
          return
        }
        const header = doc.querySelector('[data-slot="conversation.session.header"]')
        const title = header ? (header.textContent || '').trim() : ''
        const taskboard = !!doc.querySelector('[data-dsh-taskboard-view]')
        const ssh = !!doc.querySelector('[data-dsh-ssh-view]')
        const dialog = !!doc.querySelector('[role="dialog"]')
        const viewKey = [title, location.hash || '', taskboard, ssh, dialog].join('\u0001')

        const details = doc.querySelector('[data-slot="details"]')
        const dText = details ? (details.textContent || '').trim() : ''
        const dHead = dText.slice(0, 60)

        if (!inConv) {
          inConv = true
          rollCharacter()
          lastViewKey = viewKey
          lastDetailsHead = dHead
          lastDetailsLen = dText.length
          return
        }
        if (viewKey !== lastViewKey) {
          lastViewKey = viewKey
          lastDetailsHead = dHead
          lastDetailsLen = dText.length
          rollCharacter()
        } else if (dHead !== lastDetailsHead && Math.abs(dText.length - lastDetailsLen) > 24) {
          lastDetailsHead = dHead
          lastDetailsLen = dText.length
          rollCharacter()
        }
      }

      const requestEval = () => {
        if (scheduled) return
        scheduled = true
        requestAnimationFrame(evaluate)
      }

      const observer = new MutationObserver(requestEval)
      observer.observe(doc.body, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['data-dsh-conversation-content'],
      })
      on(() => observer.disconnect())

      // 初始评估（下一帧，等 DOM 稳定）
      requestEval()
    },
  }
}

/** 缓落樱花：单 canvas + rAF，隐藏页签时暂停，尊重 reduced-motion。 */
function startSakura(canvas) {
  const g = canvas.getContext('2d')
  if (!g) return { stop() {} }
  const reduced = typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches

  let W = 0
  let H = 0
  let petals = []
  let raf = 0
  let running = false

  function newPetal(anywhere) {
    return {
      x: Math.random() * W,
      y: anywhere ? Math.random() * H : -24,
      s: 4 + Math.random() * 7,
      vy: 0.45 + Math.random() * 1.15,
      sway: 0.7 + Math.random() * 1.5,
      phase: Math.random() * Math.PI * 2,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.028,
      alpha: 0.35 + Math.random() * 0.5,
      hue: 330 + Math.random() * 16,
    }
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    W = window.innerWidth
    H = window.innerHeight
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    canvas.style.width = W + 'px'
    canvas.style.height = H + 'px'
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    const target = Math.round(Math.min(40, Math.max(16, W / 46)))
    petals = []
    for (let i = 0; i < target; i++) petals.push(newPetal(true))
  }

  function drawPetal(p) {
    g.save()
    g.translate(p.x, p.y)
    g.rotate(p.rot)
    g.globalAlpha = p.alpha
    const grad = g.createLinearGradient(-p.s, -p.s, p.s, p.s)
    grad.addColorStop(0, `hsla(${p.hue}, 82%, 90%, 0.92)`)
    grad.addColorStop(1, `hsla(${p.hue}, 74%, 76%, 0.86)`)
    g.fillStyle = grad
    g.beginPath()
    g.moveTo(0, -p.s)
    g.bezierCurveTo(p.s * 0.85, -p.s * 0.5, p.s * 0.62, p.s * 0.62, 0, p.s)
    g.bezierCurveTo(-p.s * 0.62, p.s * 0.62, -p.s * 0.85, -p.s * 0.5, 0, -p.s)
    g.fill()
    g.restore()
  }

  function tick() {
    g.clearRect(0, 0, W, H)
    for (const p of petals) {
      p.y += p.vy
      p.x += Math.sin(p.phase) * p.sway * 0.4
      p.phase += 0.011
      p.rot += p.vr
      if (p.y > H + 24) Object.assign(p, newPetal(false))
      drawPetal(p)
    }
    raf = requestAnimationFrame(tick)
  }

  function start() {
    if (running || reduced) return
    running = true
    resize()
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', onVis)
    tick()
  }

  function onVis() {
    if (document.hidden) {
      if (running) {
        cancelAnimationFrame(raf)
        running = false
      }
    } else if (!running && !reduced) {
      running = true
      tick()
    }
  }

  function stop() {
    running = false
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', resize)
    document.removeEventListener('visibilitychange', onVis)
  }

  start()
  return { stop }
}

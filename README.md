# 轻音少女 · 放课后TEA TIME —— DeepSeek Harness 主题 + 平泽唯桌宠

> 一个由 **AI 辅助制作**的《轻音少女!》（K-ON! / けいおん!）同人主题，为
> [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的 Web GUI
> 提供一套主题皮肤 + 一个平泽唯桌宠。

⚠️ **非官方、非商用同人项目**。角色与《轻音少女!》相关版权归原作者
（かきふらい / 芳文社 Houbunsha）所有，本项目仅用于技术交流，与官方无任何关联。

## 功能一览

### 主题皮肤 `skin-kon`
- 主页：毛玻璃质感的五人合照背景
- 进入会话 / 工作台时，从五位主角中**随机登场一位**，整体 UI 色调随之切换：
  平泽唯·粉 / 秋山澪·深蓝 / 田井中律·明黄 / 琴吹紬·淡紫 / 中野梓·橙红
- 立绘**先在表面清晰登场、再渐变退到毛玻璃背景**，颜色由深到浅丝滑过渡
- 顶部缓落樱花、左侧功能栏轻音音符装饰、粉色音符 favicon

### 平泽唯桌宠 `dsh-kon-pet`
- 呼吸 / 鼠标跟随 / 点击「惊吓→回神」过程动画
- 20 句日文台词气泡
- 拖动定位 / 隐藏召唤 / 启动开关（⏻，服务端持久化）
- 余额面板：余额 / 今日合计 / 本月合计 / 缓存命中 / 模型合计（读取 `dsh-api-balance` 的 `/api-balance`）

## 使用步骤

### 前置要求
- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`），Node ≥ 22
- 已初始化 `web` profile，并安装以下插件：
  - `@linxin666/dsh-web-ui-all`（含「皮肤中心」skin-center）
  - `dsh-api-balance`（余额数据来源，可选但推荐，桌宠余额面板依赖它）

### 1. 安装主题皮肤
> 皮肤中心的交互特效（樱花 / 角色切换）写在 `hooks.mjs` 里，而皮肤中心**只对「内置皮肤」运行 hooks**，
> 所以要把 `skin-kon/` 复制进 skin-center 包内（而不是 `$DSH_HOME/skins`）。

找到 skin-center 包目录（在你的 profile 的 node_modules 内），把 `skin-kon/` 整体复制为它下面的 `skins/kon`：

```
<profile>/node_modules/@linxin666/dsh-client-ui-skin-center/skins/kon
```

复制完成后**刷新页面** → 设置 → 皮肤中心 → 应用「轻音少女 · 放课后TEA TIME」。

> 提示：如果你只想用静态配色、不想要 hooks 特效，也可以放到 `$DSH_HOME/skins/kon/` 作为普通用户皮肤（此时只有配色与背景，无樱花/角色切换）。

### 2. 安装桌宠插件
```bash
# 本地 link 安装（把 <path> 换成本仓库里的 dsh-kon-pet 路径）
dsh plugin --profile web add link:<path>/dsh-kon-pet

# 重启 dsh web 后生效
```

### 3. 使用
- 重启 `dsh web` 后，右下角出现**平泽唯**。
- 悬停：左上角 **⏻** = 启动开关，右上角 **×** = 隐藏。
- 点击下方余额胶囊 → 展开余额面板（余额 / 今日 / 本月 / 缓存命中 / 模型合计）。
- 点击唯本体 → 「惊吓」动画 + 台词气泡。

## 文件结构
```
.
├── skin-kon/            # 主题皮肤（皮肤中心 skin 目录）
│   ├── skin.json        # 皮肤清单（v2）
│   ├── skin.css         # 配色 / 毛玻璃 / 立绘过渡
│   ├── patches.css      # 少量 L3 补丁
│   ├── hooks.mjs        # 樱花 / 角色随机切换 / 音符装饰（内置皮肤生效）
│   └── assets/          # 合照、五角色立绘、logo
└── dsh-kon-pet/         # 平泽唯桌宠插件（dsh bundle）
    ├── package.json
    ├── patch.yml        # bundle 补丁（注册插件）
    ├── index.js         # host 侧：静态资源 + /kon-pet/config + tapIndex 注入
    ├── client.js        # 浏览器侧：浮层桌宠 + 动画 + 余额面板
    └── assets/          # 唯的透明抠图
```

## 常见问题
- **重启后没有桌宠**：检查 `~/.dsh/profiles/web/cordis.patch.yml`，确保 `dsh-kon-pet` 与 `dsh-api-balance` 没有被 `disabled: true`。
- **没有樱花/角色切换**：说明皮肤被当作「用户皮肤」加载了；请按上面第 1 步复制到 skin-center 包内成为内置皮肤。
- **余额面板没数据**：确认已安装 `dsh-api-balance` 且未被禁用。

## 许可
- 代码：MIT License（见 [LICENSE](LICENSE)）。
- 图片素材：同人用途，角色与《轻音少女!》版权归原作者所有；请勿用于商业用途。

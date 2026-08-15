# 磁力搜索增强

一个用于增强磁力搜索网站使用体验的 Tampermonkey 用户脚本，针对不同页面结构分别进行适配。

> 兼容性说明：仅在 Windows 与 Chromium 内核浏览器中测试；其他平台或浏览器内核尚未完成兼容性验证。

## 功能特性

- 过滤已知的外部视频广告结果。
- 过滤 SkrBT 列表和 Bootstrap 结果卡片中的“在线”外站推广结果。
- 为搜索结果增加编号和本页筛选功能。
- 支持折叠或展开结果中的文件列表。
- 将容易误解的结果链接改为“查看详情”。
- 用户点击“打开”或“复制”后再按需请求详情页。
- 提取并缓存真实的 `magnet:?xt=urn:btih:` 链接。
- 使用规范化详情 URL 作为缓存键，避免重复请求同一详情页。
- 支持 BT4G 搜索结果的“打开”和“复制”快捷操作。
- 在 BT4G 详情页增加明确的“复制磁链”按钮。
- 在有限时间内监听并处理 BT4G 动态插入的搜索结果。
- 支持 Zsky 资源卡片页面的“打开磁链”和“复制磁链”操作。
- 为第一类和第二类网站提供共享的“自动获取磁力链接”全局开关。
- 为成功缓存的结果显示绿色“已缓存磁力链接”提示。
- 显示自动获取进度和失败数量，并使用非阻塞式按钮反馈错误。
- 可配置自动缓存并发数、批次间隔和失败重试次数。

## 网站分类

### 第一类：磁力猫、磁力狗 Zsky 资源搜索站

- `https://clmclm.com/*`
- `https://www.clmclm.com/*`
- `https://clgclg.com/*`
- `https://www.clgclg.com/*`

### 第二类：同构 Bootstrap 搜索站

- `https://xiongmaogb.top/search*`
- `https://www.xiongmaogb.top/search*`
- `https://skrbtso.top/search*`
- `https://www.skrbtso.top/search*`
- `https://laowangso.top/search*`
- `https://www.laowangso.top/search*`
- `https://lemonun.top/search*`
- `https://www.lemonun.top/search*`

### 第三类：BT4G

- `https://bt4gprx.com/*`
- `https://www.bt4gprx.com/*`

## 安装方法

在已经安装 Tampermonkey 的浏览器中打开 [Greasy Fork 脚本页面](https://greasyfork.org/zh-CN/scripts/591460)，点击“安装此脚本”即可。

## 开发说明

`.user.js` 文件同时作为源代码和可直接分发的安装文件。第一类为使用 Zsky 资源卡片结构的磁力猫、磁力狗；第二类包含熊猫、SkrBT、老王和 Lemon 等 Bootstrap 搜索站，其中 SkrBT 新版使用列表结构，其余站点使用结果卡片结构；BT4G 为第三类。

“自动获取磁力链接”设置通过 `GM_getValue` 和 `GM_setValue` 保存，因此同一设置可以在第一类和第二类网站之间共享。每次修改脚本行为后都应递增 `@version`，以便用户脚本管理器和 Greasy Fork 检测更新。

自动缓存默认同时处理 4 条详情请求，每批完成后等待 1 秒再处理下一批；单条请求失败后最多额外重试 3 次。失败任务会追加到队尾，让尚未请求的新条目优先处理，所有新任务和重试任务共享同一个并发上限。

# 盛趣登录页面增强

一个用于增强盛趣登录页面体验的 Tampermonkey 用户脚本，可自动处理登录协议并记住常用登录选项。

## 功能特性

- 自动勾选隐私政策与服务协议复选框。
- 可将“密码登录”或“一键登录”设为默认打开的登录方式。
- 可配置默认账号，密码登录与一键登录共用该设置。
- 在登录页右下角提供轻量的“脚本设置”面板，两个配置项始终可见。
- 兼容登录表单延迟加载和局部刷新。
- 同时触发 `input` 与 `change` 事件，确保页面能够感知勾选状态。

## 支持页面

- 用户访问入口：`https://login.u.sdo.com/sdo/Login/LoginSDO.php*`
- 新版登录表单：`https://login.u.sdo.com/sdo/Login/LoginFrameFC.php*`
- 旧版登录表单：`https://login.u.sdo.com/sdo/iframe/*`

## 配置方法

打开盛趣登录页面后，点击登录框右下角的“脚本设置”：

1. 在“默认登录”中选择“密码登录”或“一键登录”。
2. 在“默认账号”中填写常用账号；留空则不自动填写。
3. 点击“保存”，设置会立即应用并在后续打开登录页时继续生效。

两个设置均保存在用户脚本管理器的本地存储中。脚本不会保存密码，也不会将账号发送到第三方。

## 实际匹配页面

- `https://login.u.sdo.com/sdo/iframe/*`
- `https://login.u.sdo.com/sdo/Login/LoginFrameFC.php*`

## 安装方法

在已经安装 Tampermonkey 的浏览器中打开 [Greasy Fork 脚本页面](https://greasyfork.org/zh-CN/scripts/591462)，点击“安装此脚本”即可。

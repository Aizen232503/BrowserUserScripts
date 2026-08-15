# 盛趣登录页面增强

一个用于增强盛趣登录页面体验的 Tampermonkey 用户脚本。

## 功能特性

- 自动勾选隐私政策与服务协议复选框。
- 兼容登录表单延迟加载和局部刷新。
- 同时触发 `input` 与 `change` 事件，确保页面能够感知勾选状态。

## 支持页面

- `https://login.u.sdo.com/sdo/iframe/*`

## 安装方法

在已经安装 Tampermonkey 的浏览器中打开 [`sdo-page-enhancer.user.js`](./sdo-page-enhancer.user.js) 即可安装。

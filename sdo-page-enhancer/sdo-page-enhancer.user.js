// ==UserScript==
// @name         盛趣最终幻想14相关页面增强
// @namespace    https://github.com/Aizen232503/BrowserUserScripts/sdo-page-enhancer
// @version      1.0.1
// @description  增强盛趣充值与登录页面，支持自动勾选登录协议，以及恢复FF14充值账号输入框
// @author       Aizen232503
// @license      GPL-3.0-only
// @homepageURL  https://github.com/Aizen232503/BrowserUserScripts/tree/main/sdo-page-enhancer
// @supportURL   https://github.com/Aizen232503/BrowserUserScripts/issues
// @updateURL    https://raw.githubusercontent.com/Aizen232503/BrowserUserScripts/main/sdo-page-enhancer/sdo-page-enhancer.user.js
// @downloadURL  https://raw.githubusercontent.com/Aizen232503/BrowserUserScripts/main/sdo-page-enhancer/sdo-page-enhancer.user.js
// @match        *://pay.sdo.com/item/GWPAY-100001900*
// @match        https://login.u.sdo.com/sdo/iframe/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  /**
   * 等待指定 ID 的元素出现后执行一次回调。
   * 盛趣页面会异步挂载表单，因此不能只在脚本启动时查询 DOM。
   */
  function observeUntilFound(elementId, callback) {
    const existingElement = document.getElementById(elementId);
    if (existingElement) {
      callback(existingElement);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = document.getElementById(elementId);
      if (!element) return;

      observer.disconnect();
      callback(element);
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  /** 恢复充值页被站点禁用的账号输入框。 */
  function enhanceRechargePage() {
    observeUntilFound('ds_account', (accountInput) => {
      accountInput.removeAttribute('disabled');
    });
  }

  /** 自动接受登录协议，并兼容页面稍后渲染或重置复选框的情况。 */
  function enhanceLoginPage() {
    // 同时触发 input 和 change，让原页面不同实现方式的监听器都能收到更新。
    const acceptAgreement = () => {
      const checkbox = document.getElementById('isAgreementAccept');
      if (!checkbox) return;
      if (checkbox.checked) return;

      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('input', { bubbles: true }));
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    };

    acceptAgreement();
    // 定时重试覆盖 iframe 初始加载期间的多阶段渲染。
    [100, 300, 600, 1000, 2000, 3000].forEach((delay) => {
      window.setTimeout(acceptAgreement, delay);
    });

    // 后续局部刷新时继续校正协议状态。
    new MutationObserver(acceptAgreement).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  // 两个匹配页面共用脚本入口，根据主机名只启用对应增强逻辑。
  if (location.hostname === 'pay.sdo.com') {
    enhanceRechargePage();
  } else if (location.hostname === 'login.u.sdo.com') {
    enhanceLoginPage();
  }
})();

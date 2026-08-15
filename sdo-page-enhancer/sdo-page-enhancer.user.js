// ==UserScript==
// @name         盛趣登录页面增强
// @namespace    https://github.com/Aizen232503/BrowserUserScripts/sdo-page-enhancer
// @version      1.1.3
// @description  自动勾选盛趣登录页面的隐私政策与服务协议
// @author       Aizen232503
// @license      GPL-3.0-only
// @homepageURL  https://github.com/Aizen232503/BrowserUserScripts/tree/main/sdo-page-enhancer
// @updateURL    https://raw.githubusercontent.com/Aizen232503/BrowserUserScripts/main/sdo-page-enhancer/sdo-page-enhancer.user.js
// @downloadURL  https://raw.githubusercontent.com/Aizen232503/BrowserUserScripts/main/sdo-page-enhancer/sdo-page-enhancer.user.js
// @match        https://login.u.sdo.com/sdo/iframe/*
// @match        https://login.u.sdo.com/sdo/Login/LoginFrameFC.php*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

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

  enhanceLoginPage();
})();

// ==UserScript==
// @name         盛趣登录页面增强
// @namespace    https://github.com/Aizen232503/BrowserUserScripts/sdo-page-enhancer
// @version      1.2.1
// @description  自动勾选盛趣登录协议，并支持配置默认登录方式和账号
// @author       Aizen232503
// @license      GPL-3.0-only
// @homepageURL  https://github.com/Aizen232503/BrowserUserScripts/tree/main/sdo-page-enhancer
// @updateURL    https://raw.githubusercontent.com/Aizen232503/BrowserUserScripts/main/sdo-page-enhancer/sdo-page-enhancer.user.js
// @downloadURL  https://raw.githubusercontent.com/Aizen232503/BrowserUserScripts/main/sdo-page-enhancer/sdo-page-enhancer.user.js
// @match        https://login.u.sdo.com/sdo/iframe/*
// @match        https://login.u.sdo.com/sdo/Login/LoginSDO.php*
// @match        https://login.u.sdo.com/sdo/Login/LoginFrameFC.php*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// ==/UserScript==

(() => {
  'use strict';

  // ============================================================================
  // 配置与运行状态
  // ============================================================================

  const STORAGE_KEYS = {
    defaultLoginTab: 'sdo-enhancer-default-login-tab',
    defaultAccount: 'sdo-enhancer-default-account',
    applyRevision: 'sdo-enhancer-apply-revision',
  };

  const LOGIN_TABS = {
    index: '密码登录',
    mobile: '一键登录',
    code2d: '二维码',
  };

  const config = {
    defaultLoginTab: GM_getValue(STORAGE_KEYS.defaultLoginTab, 'index'),
    defaultAccount: GM_getValue(STORAGE_KEYS.defaultAccount, ''),
  };

  if (!Object.prototype.hasOwnProperty.call(LOGIN_TABS, config.defaultLoginTab)) {
    config.defaultLoginTab = 'index';
  }

  let defaultTabApplied = false;
  let filledAccountInputs = new WeakSet();

  /** 每次设置操作都递增修订号，确保外层页面和 iframe 即使保存相同值也会同步。 */
  function notifyConfigChanged() {
    const revision = Number(GM_getValue(STORAGE_KEYS.applyRevision, 0)) || 0;
    GM_setValue(STORAGE_KEYS.applyRevision, revision + 1);
  }

  // ============================================================================
  // 登录页增强
  // ============================================================================

  /** 自动接受协议，并通知原页面可能注册的表单监听器。 */
  function acceptAgreement() {
    const checkbox = document.getElementById('isAgreementAccept');
    if (!checkbox || checkbox.checked) return;

    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('input', { bubbles: true }));
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * 官方页面会在接口返回后动态创建 Tab，因此只在目标 Tab 首次出现时应用。
   * 应用成功后不再自动切换，避免覆盖用户本次页面中的手动选择。
   */
  function applyDefaultLoginTab(force = false) {
    if (defaultTabApplied && !force) return;

    const tab = document.querySelector(`#nav > .btn_${config.defaultLoginTab}`);
    if (!tab) return;

    if (!tab.classList.contains('cur')) tab.click();
    defaultTabApplied = true;
  }

  /** 密码登录和一键登录共用 username 输入框，只对每个新出现的输入框填充一次。 */
  function applyDefaultAccount(force = false) {
    if (!config.defaultAccount) return;

    const input = document.getElementById('username');
    if (!input || (filledAccountInputs.has(input) && !force)) return;

    input.value = config.defaultAccount;
    ['input', 'change', 'keyup'].forEach((eventName) => {
      input.dispatchEvent(new Event(eventName, { bubbles: true }));
    });

    // 官方输入框使用独立 label 模拟 placeholder，需要同步其可见状态。
    const inputWrapper = input.parentElement;
    inputWrapper?.querySelector('.cell_input_notice')?.classList.add('cell_input_notice_hide');
    inputWrapper?.classList.add('width_clear_btn');
    filledAccountInputs.add(input);
  }

  function applyEnhancements() {
    acceptAgreement();
    applyDefaultLoginTab();
    applyDefaultAccount();
  }

  // ============================================================================
  // 页面内配置面板
  // ============================================================================

  /**
   * 新版登录页由外层页面承载 iframe，设置面板优先显示在外层页面右下角。
   * 直接访问登录表单或旧版嵌入方式无法由外层脚本承载时，则显示在当前页面。
   */
  function shouldCreateSettingsPanel() {
    if (window.top === window.self) return true;

    try {
      return !window.top.location.pathname.startsWith('/sdo/Login/LoginSDO.php');
    } catch {
      return true;
    }
  }

  /** 创建与磁力脚本一致的右下角固定设置面板，两个配置项始终显示。 */
  function createSettingsPanel() {
    if (!shouldCreateSettingsPanel()
      || !document.body
      || document.getElementById('sdo-enhancer-settings')) return;

    const style = document.createElement('style');
    style.textContent = `
      #sdo-enhancer-settings {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 2147483646;
        width: 280px;
        max-width: calc(100vw - 32px);
        padding: 10px 12px;
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        background: #fff;
        color: #1f2937;
        font: 13px/1.45 sans-serif;
        box-shadow: 0 5px 18px rgba(0, 0, 0, .18);
      }
      #sdo-enhancer-settings * { box-sizing: border-box; }
      .sdo-enhancer-settings-title {
        margin-bottom: 8px;
        font-weight: 700;
      }
      .sdo-enhancer-setting-row {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid #e2e8f0;
      }
      .sdo-enhancer-setting-label {
        display: block;
        margin-bottom: 6px;
        color: #475569;
      }
      .sdo-enhancer-radio-group {
        display: flex;
        flex-wrap: wrap;
        gap: 5px 12px;
      }
      .sdo-enhancer-radio-group label {
        display: flex;
        align-items: center;
        gap: 4px;
        cursor: pointer;
      }
      #sdo-enhancer-default-account {
        width: 100%;
        padding: 5px 7px;
        border: 1px solid #cbd5e1;
        border-radius: 4px;
        background: #fff;
      }
      #sdo-enhancer-settings-status {
        min-height: 19px;
        margin-top: 5px;
        color: #64748b;
      }
    `;
    document.head.appendChild(style);

    const root = document.createElement('aside');
    root.id = 'sdo-enhancer-settings';
    root.innerHTML = `
      <div class="sdo-enhancer-settings-title">盛趣登录设置</div>
      <div class="sdo-enhancer-setting-row">
        <span class="sdo-enhancer-setting-label">默认登录方式</span>
        <div class="sdo-enhancer-radio-group">
          <label><input type="radio" name="sdo-enhancer-default-tab" value="index">密码登录</label>
          <label><input type="radio" name="sdo-enhancer-default-tab" value="mobile">一键登录</label>
          <label><input type="radio" name="sdo-enhancer-default-tab" value="code2d">二维码</label>
        </div>
      </div>
      <label class="sdo-enhancer-setting-row">
        <span class="sdo-enhancer-setting-label">默认账号（按 Enter 生效）</span>
        <input id="sdo-enhancer-default-account" type="text" maxlength="50"
          autocomplete="off" placeholder="留空并回车可清除设置">
      </label>
      <div id="sdo-enhancer-settings-status" role="status" aria-live="polite">设置会保存在本地</div>
    `;
    document.body.appendChild(root);

    const accountInput = root.querySelector('#sdo-enhancer-default-account');
    const status = root.querySelector('#sdo-enhancer-settings-status');

    root.querySelectorAll('input[name="sdo-enhancer-default-tab"]').forEach((radio) => {
      radio.checked = radio.value === config.defaultLoginTab;
      radio.addEventListener('change', () => {
        if (!radio.checked) return;

        config.defaultLoginTab = radio.value;
        GM_setValue(STORAGE_KEYS.defaultLoginTab, config.defaultLoginTab);
        notifyConfigChanged();
        defaultTabApplied = false;
        applyDefaultLoginTab(true);
        status.style.color = '#26834f';
        status.textContent = `默认登录已设为${LOGIN_TABS[config.defaultLoginTab]}`;
      });
    });

    accountInput.value = config.defaultAccount;
    accountInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();

      config.defaultAccount = accountInput.value.trim();
      accountInput.value = config.defaultAccount;
      GM_setValue(STORAGE_KEYS.defaultAccount, config.defaultAccount);
      notifyConfigChanged();
      filledAccountInputs = new WeakSet();
      applyDefaultAccount(true);
      status.style.color = '#26834f';
      status.textContent = config.defaultAccount ? '默认账号已保存并应用' : '默认账号已清除';
    });
  }

  // 外层页面与登录 iframe 是两个脚本实例，通过共享存储监听实现即时联动。
  GM_addValueChangeListener(STORAGE_KEYS.applyRevision, () => {
    const storedLoginTab = GM_getValue(STORAGE_KEYS.defaultLoginTab, 'index');
    config.defaultLoginTab = Object.prototype.hasOwnProperty.call(LOGIN_TABS, storedLoginTab)
      ? storedLoginTab
      : 'index';
    config.defaultAccount = GM_getValue(STORAGE_KEYS.defaultAccount, '');
    defaultTabApplied = false;
    filledAccountInputs = new WeakSet();
    applyDefaultLoginTab(true);
    applyDefaultAccount(true);

    document.querySelectorAll('input[name="sdo-enhancer-default-tab"]').forEach((radio) => {
      radio.checked = radio.value === config.defaultLoginTab;
    });

    const settingInput = document.getElementById('sdo-enhancer-default-account');
    if (settingInput && settingInput !== document.activeElement) {
      settingInput.value = config.defaultAccount;
    }
  });

  createSettingsPanel();

  const isLoginFormDocument = location.pathname.startsWith('/sdo/iframe/')
    || location.pathname === '/sdo/Login/LoginFrameFC.php';
  if (isLoginFormDocument) {
    applyEnhancements();

    // 定时重试覆盖 iframe 初始加载期间的多阶段渲染。
    [100, 300, 600, 1000, 2000, 3000].forEach((delay) => {
      window.setTimeout(applyEnhancements, delay);
    });

    // 兼容官方页面异步创建 Tab、替换表单或进行局部刷新。
    new MutationObserver(applyEnhancements).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }
})();

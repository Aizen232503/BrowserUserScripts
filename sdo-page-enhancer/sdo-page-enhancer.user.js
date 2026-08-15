// ==UserScript==
// @name         盛趣登录页面增强
// @namespace    https://github.com/Aizen232503/BrowserUserScripts/sdo-page-enhancer
// @version      1.2.0
// @description  自动勾选盛趣登录协议，并支持配置默认登录方式和账号
// @author       Aizen232503
// @license      GPL-3.0-only
// @homepageURL  https://github.com/Aizen232503/BrowserUserScripts/tree/main/sdo-page-enhancer
// @updateURL    https://raw.githubusercontent.com/Aizen232503/BrowserUserScripts/main/sdo-page-enhancer/sdo-page-enhancer.user.js
// @downloadURL  https://raw.githubusercontent.com/Aizen232503/BrowserUserScripts/main/sdo-page-enhancer/sdo-page-enhancer.user.js
// @match        https://login.u.sdo.com/sdo/iframe/*
// @match        https://login.u.sdo.com/sdo/Login/LoginFrameFC.php*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(() => {
  'use strict';

  // ============================================================================
  // 配置与运行状态
  // ============================================================================

  const STORAGE_KEYS = {
    defaultLoginTab: 'sdo-enhancer-default-login-tab',
    defaultAccount: 'sdo-enhancer-default-account',
  };

  const LOGIN_TABS = {
    index: '密码登录',
    mobile: '一键登录',
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

  /** 创建轻量设置入口；两个配置项始终同时显示，不根据当前 Tab 隐藏。 */
  function createSettingsPanel() {
    if (!document.body || document.getElementById('sdo-enhancer-settings')) return;

    const style = document.createElement('style');
    style.textContent = `
      #sdo-enhancer-settings {
        position: fixed;
        right: 8px;
        bottom: 8px;
        z-index: 2147483647;
        color: #333;
        font: 13px/1.5 Arial, "Microsoft YaHei", sans-serif;
      }
      #sdo-enhancer-settings * { box-sizing: border-box; }
      #sdo-enhancer-settings-toggle {
        border: 1px solid #e5004f;
        border-radius: 3px;
        padding: 4px 9px;
        color: #e5004f;
        background: rgba(255, 255, 255, 0.96);
        cursor: pointer;
      }
      #sdo-enhancer-settings-panel {
        position: absolute;
        right: 0;
        bottom: 34px;
        width: 270px;
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 12px;
        background: #fff;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
      }
      #sdo-enhancer-settings-panel[hidden] { display: none; }
      .sdo-enhancer-setting-row {
        display: grid;
        grid-template-columns: 82px 1fr;
        align-items: center;
        gap: 8px;
        margin-bottom: 10px;
      }
      .sdo-enhancer-setting-row select,
      .sdo-enhancer-setting-row input {
        width: 100%;
        height: 30px;
        border: 1px solid #ccc;
        border-radius: 3px;
        padding: 4px 7px;
        background: #fff;
      }
      .sdo-enhancer-settings-actions {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 8px;
      }
      .sdo-enhancer-settings-actions button {
        border: 1px solid #ccc;
        border-radius: 3px;
        padding: 4px 12px;
        background: #fff;
        cursor: pointer;
      }
      #sdo-enhancer-settings-save {
        border-color: #e5004f;
        color: #fff;
        background: #e5004f;
      }
      #sdo-enhancer-settings-status {
        margin-right: auto;
        color: #279b37;
      }
    `;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.id = 'sdo-enhancer-settings';
    root.innerHTML = `
      <button id="sdo-enhancer-settings-toggle" type="button" aria-expanded="false">脚本设置</button>
      <div id="sdo-enhancer-settings-panel" hidden>
        <label class="sdo-enhancer-setting-row">
          <span>默认登录</span>
          <select id="sdo-enhancer-default-tab">
            <option value="index">密码登录</option>
            <option value="mobile">一键登录</option>
          </select>
        </label>
        <label class="sdo-enhancer-setting-row">
          <span>默认账号</span>
          <input id="sdo-enhancer-default-account" type="text" maxlength="50"
            autocomplete="off" placeholder="留空则不自动填写">
        </label>
        <div class="sdo-enhancer-settings-actions">
          <span id="sdo-enhancer-settings-status"></span>
          <button id="sdo-enhancer-settings-cancel" type="button">取消</button>
          <button id="sdo-enhancer-settings-save" type="button">保存</button>
        </div>
      </div>
    `;
    document.body.appendChild(root);

    const toggle = root.querySelector('#sdo-enhancer-settings-toggle');
    const panel = root.querySelector('#sdo-enhancer-settings-panel');
    const tabSelect = root.querySelector('#sdo-enhancer-default-tab');
    const accountInput = root.querySelector('#sdo-enhancer-default-account');
    const status = root.querySelector('#sdo-enhancer-settings-status');

    const resetForm = () => {
      tabSelect.value = config.defaultLoginTab;
      accountInput.value = config.defaultAccount;
      status.textContent = '';
    };

    const setPanelVisible = (visible) => {
      panel.hidden = !visible;
      toggle.setAttribute('aria-expanded', String(visible));
      if (visible) resetForm();
    };

    toggle.addEventListener('click', () => setPanelVisible(panel.hidden));
    root.querySelector('#sdo-enhancer-settings-cancel').addEventListener('click', () => {
      setPanelVisible(false);
    });
    root.querySelector('#sdo-enhancer-settings-save').addEventListener('click', () => {
      config.defaultLoginTab = tabSelect.value;
      config.defaultAccount = accountInput.value.trim();
      GM_setValue(STORAGE_KEYS.defaultLoginTab, config.defaultLoginTab);
      GM_setValue(STORAGE_KEYS.defaultAccount, config.defaultAccount);

      defaultTabApplied = false;
      filledAccountInputs = new WeakSet();
      applyDefaultLoginTab(true);
      applyDefaultAccount(true);
      status.textContent = '已保存';
    });
  }

  createSettingsPanel();
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
})();

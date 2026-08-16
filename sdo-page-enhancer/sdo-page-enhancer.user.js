// ==UserScript==
// @name         盛趣登录页面增强
// @namespace    https://github.com/Aizen232503/BrowserUserScripts/sdo-page-enhancer
// @version      1.2.9
// @description  自动勾选盛趣登录协议，并支持配置默认登录方式和账号
// @author       Aizen232503
// @license      MIT
// @homepageURL  https://github.com/Aizen232503/BrowserUserScripts/tree/main/sdo-page-enhancer
// @supportURL   https://github.com/Aizen232503/BrowserUserScripts/issues
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

  /** 递增配置修订号，通知同源的其他脚本文档重新读取设置。 */
  function notifyConfigChanged() {
    const revision = Number(GM_getValue(STORAGE_KEYS.applyRevision, 0)) || 0;
    GM_setValue(STORAGE_KEYS.applyRevision, revision + 1);
  }

  // ============================================================================
  // 登录页增强
  // ============================================================================

  /** 勾选登录协议并派发表单事件；返回当前是否已接受协议。 */
  function acceptAgreement() {
    const checkbox = document.getElementById('isAgreementAccept');
    if (!checkbox) return false;

    if (!checkbox.checked) {
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('input', { bubbles: true }));
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return checkbox.checked;
  }

  /**
   * 目标登录 Tab 可能延迟创建，因此在节点出现后才应用默认选择。
   * 每个文档只自动应用一次；force 用于用户修改配置后立即重新应用。
   */
  function applyDefaultLoginTab(force = false) {
    if (defaultTabApplied && !force) return;

    const tab = document.querySelector(`#nav > .btn_${config.defaultLoginTab}`);
    if (!tab) return;

    // 只有在协议复选框已出现且勾选成功后才切换登录方式。
    if (!acceptAgreement()) return;

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

    // 输入框使用独立 label 显示占位文字，填入账号后同步隐藏。
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

  /** 同步自定义 Radio 的选中外观，同时保留原生 Radio 的可访问性。 */
  function updateRadioSelection(root = document) {
    root.querySelectorAll('input[name="sdo-enhancer-default-tab"]').forEach((radio) => {
      radio.closest('.sdo-enhancer-radio-option')?.classList.toggle(
        'sdo-enhancer-radio-selected',
        radio.checked,
      );
    });
  }

  // ============================================================================
  // 页面内配置面板
  // ============================================================================

  /**
   * 配置入口显示在实际登录表单内，不在仅用于承载 iframe 的外层页面重复创建。
   * 这样无论表单被外层 LoginSDO.php 嵌入还是被直接访问，都有同一个入口。
   */
  function shouldCreateSettingsPanel() {
    return location.pathname !== '/sdo/Login/LoginSDO.php';
  }

  /** 在登录表单右下角创建可折叠的设置面板。 */
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
        display: flex;
        justify-content: flex-end;
        width: 100px;
        color: #1f2937;
        font: 13px/1.45 sans-serif;
      }
      #sdo-enhancer-settings * { box-sizing: border-box; }
      #sdo-enhancer-settings-toggle {
        padding: 6px 10px;
        border: 1px solid #cbd5e1;
        border-radius: 999px;
        background: rgba(255, 255, 255, .96);
        color: #475569;
        box-shadow: 0 3px 10px rgba(15, 23, 42, .14);
        cursor: pointer;
      }
      #sdo-enhancer-settings-toggle:hover,
      #sdo-enhancer-settings-toggle[aria-expanded="true"] {
        border-color: #e5004f;
        color: #e5004f;
      }
      #sdo-enhancer-settings-panel {
        position: absolute;
        right: 0;
        bottom: 40px;
        width: 280px;
        max-width: calc(100vw - 32px);
        padding: 10px 12px;
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        background: #fff;
        box-shadow: 0 5px 18px rgba(0, 0, 0, .18);
      }
      #sdo-enhancer-settings-panel[hidden] { display: none; }
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
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 6px;
      }
      .sdo-enhancer-radio-option {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 0;
        padding: 7px 4px;
        border: 1px solid #d6dde8;
        border-radius: 6px;
        background: #f8fafc;
        color: #475569;
        cursor: pointer;
        transition: color .16s ease, background .16s ease, border-color .16s ease, box-shadow .16s ease;
        user-select: none;
      }
      .sdo-enhancer-radio-option:hover {
        border-color: #f08aae;
        background: #fff4f7;
      }
      .sdo-enhancer-radio-option.sdo-enhancer-radio-selected {
        border-color: #e5004f;
        background: #e5004f;
        color: #fff;
        box-shadow: 0 2px 6px rgba(229, 0, 79, .24);
      }
      .sdo-enhancer-radio-option:focus-within {
        outline: 2px solid rgba(229, 0, 79, .32);
        outline-offset: 1px;
      }
      .sdo-enhancer-radio-option input {
        position: absolute;
        width: 1px;
        height: 1px;
        opacity: 0;
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
      <button id="sdo-enhancer-settings-toggle" type="button" aria-expanded="false">脚本配置</button>
      <section id="sdo-enhancer-settings-panel" hidden>
        <div class="sdo-enhancer-settings-title">盛趣登录设置</div>
        <div class="sdo-enhancer-setting-row">
          <span class="sdo-enhancer-setting-label">默认登录方式</span>
          <div class="sdo-enhancer-radio-group">
            <label class="sdo-enhancer-radio-option"><input type="radio" name="sdo-enhancer-default-tab" value="index"><span>密码登录</span></label>
            <label class="sdo-enhancer-radio-option"><input type="radio" name="sdo-enhancer-default-tab" value="mobile"><span>一键登录</span></label>
            <label class="sdo-enhancer-radio-option"><input type="radio" name="sdo-enhancer-default-tab" value="code2d"><span>二维码</span></label>
          </div>
        </div>
        <label class="sdo-enhancer-setting-row">
          <span class="sdo-enhancer-setting-label">默认账号（按 Enter 生效）</span>
          <input id="sdo-enhancer-default-account" type="text" maxlength="50"
            autocomplete="off" placeholder="留空并按 Enter 可清除设置">
        </label>
        <div id="sdo-enhancer-settings-status" role="status" aria-live="polite">设置会保存在本地</div>
      </section>
    `;
    document.body.appendChild(root);

    const toggle = root.querySelector('#sdo-enhancer-settings-toggle');
    const panel = root.querySelector('#sdo-enhancer-settings-panel');
    const accountInput = root.querySelector('#sdo-enhancer-default-account');
    const status = root.querySelector('#sdo-enhancer-settings-status');

    toggle.addEventListener('click', () => {
      const expanded = panel.hidden;
      panel.hidden = !expanded;
      toggle.setAttribute('aria-expanded', String(expanded));
    });

    root.querySelectorAll('input[name="sdo-enhancer-default-tab"]').forEach((radio) => {
      radio.checked = radio.value === config.defaultLoginTab;
      radio.addEventListener('change', () => {
        if (!radio.checked) return;

        updateRadioSelection(root);
        config.defaultLoginTab = radio.value;
        GM_setValue(STORAGE_KEYS.defaultLoginTab, config.defaultLoginTab);
        notifyConfigChanged();
        defaultTabApplied = false;
        applyDefaultLoginTab(true);
        status.style.color = '#26834f';
        status.textContent = `默认登录已设为${LOGIN_TABS[config.defaultLoginTab]}`;
      });
    });
    updateRadioSelection(root);

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

  // 监听配置修订号，使同源文档中的脚本实例同步登录方式和账号。
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
    updateRadioSelection();

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

    // 在表单的分阶段初始化期间定时重试。
    [100, 300, 600, 1000, 2000, 3000].forEach((delay) => {
      window.setTimeout(applyEnhancements, delay);
    });

    // 在 Tab 或表单节点被动态创建、替换后重新应用增强。
    new MutationObserver(applyEnhancements).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }
})();

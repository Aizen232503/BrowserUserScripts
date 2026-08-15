// ==UserScript==
// @name         FF14 道具商城和仓库页面增强
// @namespace    https://github.com/Aizen232503/BrowserUserScripts/ff14-item-store-enhancer
// @version      1.0.8
// @description  为 FF14 道具商城和仓库领取弹窗预填角色，不会自动领取
// @author       Aizen232503
// @license      MIT
// @homepageURL  https://github.com/Aizen232503/BrowserUserScripts/tree/main/ff14-item-store-enhancer
// @supportURL   https://github.com/Aizen232503/BrowserUserScripts/issues
// @updateURL    https://raw.githubusercontent.com/Aizen232503/BrowserUserScripts/main/ff14-item-store-enhancer/ff14-item-store-enhancer.user.js
// @downloadURL  https://raw.githubusercontent.com/Aizen232503/BrowserUserScripts/main/ff14-item-store-enhancer/ff14-item-store-enhancer.user.js
// @match        https://qu.sdo.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  // ============================================================================
  // 配置与商城接口
  // ============================================================================

  const APP_ID = '100001900';
  // 角色接口由商城服务域名提供；在 qu.sdo.com 上使用相对路径会返回商城 HTML，而非 JSON。
  const SHOP_SERVICE_ORIGIN = 'https://sqmallservice.u.sdo.com';
  const STORAGE_KEY = 'ff14-item-store-enhancer-default-character';
  const ROLE_API = {
    areas: '/api/us/accountInfo/getArea',
    characters: '/api/us/accountInfo/getCharacter',
  };

  function getSavedRole() {
    const role = GM_getValue(STORAGE_KEY, null);
    if (!role || !role.areaId || !role.characterId || !role.groupId) return null;
    return role;
  }

  function setSavedRole(role) {
    GM_setValue(STORAGE_KEY, role);
  }

  async function requestJson(path, parameters) {
    const url = new URL(path, SHOP_SERVICE_ORIGIN);
    Object.entries(parameters).forEach(([key, value]) => url.searchParams.set(key, value));

    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) throw new Error(`请求失败（HTTP ${response.status}）`);

    const payload = await response.json();
    if (payload.resultCode !== 0) throw new Error(payload.resultMsg || '商城接口返回错误');
    return payload.data;
  }

  function parseData(value, fallback) {
    if (typeof value !== 'string') return value ?? fallback;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  async function fetchAreas() {
    const data = await requestJson(ROLE_API.areas, { appId: APP_ID });
    const areas = parseData(data, []);
    return Array.isArray(areas) ? areas : [];
  }

  async function fetchCharacters(areaId) {
    const data = await requestJson(ROLE_API.characters, { appId: APP_ID, areaId });
    const roleInfos = parseData(data?.roleInfos, data?.roleInfos || []);
    return Array.isArray(roleInfos) ? roleInfos : [];
  }

  function roleLabel(role) {
    return `[${role.groupName}]${role.roleName}`;
  }

  // ============================================================================
  // 右下角折叠配置面板
  // ============================================================================

  function addSettingsPanel() {
    if (document.getElementById('ff14-item-store-settings')) return;

    const style = document.createElement('style');
    style.textContent = `
      #ff14-item-store-settings {
        position: fixed;
        right: 16px;
        bottom: 15vh;
        z-index: 2147483646;
        display: flex;
        justify-content: flex-end;
        width: 110px;
        color: #1f2937;
        font: 13px/1.45 sans-serif;
      }
      #ff14-item-store-settings * { box-sizing: border-box; }
      #ff14-item-store-settings-toggle {
        padding: 6px 10px;
        border: 1px solid #cbd5e1;
        border-radius: 999px;
        background: rgba(255, 255, 255, .96);
        color: #475569;
        box-shadow: 0 3px 10px rgba(15, 23, 42, .14);
        cursor: pointer;
      }
      #ff14-item-store-settings-toggle:hover,
      #ff14-item-store-settings-toggle[aria-expanded="true"] {
        border-color: #ce0f30;
        color: #ce0f30;
      }
      #ff14-item-store-settings-panel {
        position: absolute;
        right: 0;
        bottom: 40px;
        width: 300px;
        max-width: calc(100vw - 32px);
        padding: 10px 12px;
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        background: #fff;
        box-shadow: 0 5px 18px rgba(0, 0, 0, .18);
      }
      #ff14-item-store-settings-panel[hidden] { display: none; }
      .ff14-item-store-title { margin-bottom: 8px; font-weight: 700; }
      .ff14-item-store-row {
        display: grid;
        gap: 5px;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid #e2e8f0;
      }
      .ff14-item-store-row label { color: #475569; }
      .ff14-item-store-row select {
        width: 100%;
        min-height: 32px;
        padding: 5px 7px;
        border: 1px solid #cbd5e1;
        border-radius: 4px;
        background: #fff;
        color: #1f2937;
      }
      .ff14-item-store-actions { display: flex; justify-content: space-between; gap: 8px; }
      #ff14-item-store-refresh {
        padding: 5px 9px;
        border: 1px solid #cbd5e1;
        border-radius: 4px;
        background: #f8fafc;
        color: #475569;
        cursor: pointer;
      }
      #ff14-item-store-status { min-height: 19px; color: #64748b; }
      .ff14-item-store-native-save {
        margin-right: 10px;
        padding: 9px 14px;
        border: 1px solid #ce0f30;
        border-radius: 4px;
        background: #fff5f7;
        color: #ce0f30;
        cursor: pointer;
      }
      .ff14-item-store-native-save:disabled {
        border-color: #cbd5e1;
        background: #f8fafc;
        color: #94a3b8;
        cursor: not-allowed;
      }
      .ff14-item-store-prefill-status {
        display: inline-block;
        margin: 8px 0 0 10px;
        color: #64748b;
        font-size: 12px;
      }
      .ff14-item-store-prefill-status.is-error { color: #b45309; }
    `;
    document.head.appendChild(style);

    const root = document.createElement('aside');
    root.id = 'ff14-item-store-settings';
    root.innerHTML = `
      <button id="ff14-item-store-settings-toggle" type="button" aria-expanded="false">默认角色</button>
      <section id="ff14-item-store-settings-panel" hidden>
        <div class="ff14-item-store-title">默认角色</div>
        <div class="ff14-item-store-row">
          <label for="ff14-item-store-area">游戏大区</label>
          <select id="ff14-item-store-area" disabled><option>展开后加载角色信息</option></select>
        </div>
        <div class="ff14-item-store-row">
          <label for="ff14-item-store-character">游戏角色</label>
          <select id="ff14-item-store-character" disabled><option>请先选择游戏大区</option></select>
        </div>
        <div class="ff14-item-store-row">
          <div class="ff14-item-store-actions">
            <button id="ff14-item-store-refresh" type="button">刷新角色</button>
            <span id="ff14-item-store-status" role="status" aria-live="polite"></span>
          </div>
        </div>
      </section>
    `;
    document.body.appendChild(root);

    const toggle = root.querySelector('#ff14-item-store-settings-toggle');
    const panel = root.querySelector('#ff14-item-store-settings-panel');
    const areaSelect = root.querySelector('#ff14-item-store-area');
    const characterSelect = root.querySelector('#ff14-item-store-character');
    const refreshButton = root.querySelector('#ff14-item-store-refresh');
    const status = root.querySelector('#ff14-item-store-status');
    let areas = [];
    let characters = [];

    const setStatus = (message, isError = false) => {
      status.style.color = isError ? '#b45309' : '#64748b';
      status.textContent = message;
    };

    const renderAreas = () => {
      const savedRole = getSavedRole();
      areaSelect.replaceChildren(new Option('请选择游戏大区', ''));
      areas.forEach((area) => areaSelect.add(new Option(area.areaName, area.areaId)));
      areaSelect.disabled = false;
      areaSelect.value = savedRole?.areaId ? String(savedRole.areaId) : '';
    };

    const renderCharacters = () => {
      const savedRole = getSavedRole();
      characterSelect.replaceChildren(new Option('请选择游戏角色', ''));
      characters.forEach((role) => {
        characterSelect.add(new Option(roleLabel(role), `${role.groupId}:${role.characterId}`));
      });
      characterSelect.disabled = false;
      if (savedRole && String(savedRole.areaId) === areaSelect.value) {
        characterSelect.value = `${savedRole.groupId}:${savedRole.characterId}`;
      }
    };

    const loadCharacters = async () => {
      const areaId = areaSelect.value;
      if (!areaId) {
        characters = [];
        characterSelect.replaceChildren(new Option('请先选择游戏大区', ''));
        characterSelect.disabled = true;
        return;
      }

      characterSelect.disabled = true;
      characterSelect.replaceChildren(new Option('正在加载角色……', ''));
      setStatus('正在加载角色……');
      try {
        characters = await fetchCharacters(areaId);
        renderCharacters();
        setStatus(characters.length ? '请选择要预填的角色' : '该大区没有可用角色');
      } catch (error) {
        characters = [];
        characterSelect.replaceChildren(new Option('角色加载失败', ''));
        setStatus(error.message, true);
      }
    };

    const loadAreas = async () => {
      areaSelect.disabled = true;
      characterSelect.disabled = true;
      areaSelect.replaceChildren(new Option('正在加载大区……', ''));
      characterSelect.replaceChildren(new Option('请先选择游戏大区', ''));
      setStatus('正在加载角色信息……');
      try {
        areas = await fetchAreas();
        renderAreas();
        setStatus(areas.length ? '请选择游戏大区' : '未查询到可用大区');
        if (areaSelect.value) await loadCharacters();
      } catch (error) {
        setStatus(error.message, true);
        areaSelect.replaceChildren(new Option('大区加载失败', ''));
      }
    };

    toggle.addEventListener('click', async () => {
      const expanded = panel.hidden;
      panel.hidden = !expanded;
      toggle.setAttribute('aria-expanded', String(expanded));
      if (expanded && !areas.length) await loadAreas();
    });
    refreshButton.addEventListener('click', loadAreas);
    areaSelect.addEventListener('change', loadCharacters);
    characterSelect.addEventListener('change', () => {
      const selectedRole = characters.find((role) => (
        `${role.groupId}:${role.characterId}` === characterSelect.value
      ));
      const selectedArea = areas.find((area) => String(area.areaId) === areaSelect.value);
      if (!selectedArea || !selectedRole) return;

      setSavedRole({
        areaId: selectedArea.areaId,
        areaName: selectedArea.areaName,
        groupId: selectedRole.groupId,
        groupName: selectedRole.groupName,
        characterId: selectedRole.characterId,
        roleName: selectedRole.roleName,
      });
      setStatus(`已设为 ${roleLabel(selectedRole)}`);
    });
  }

  // ============================================================================
  // 原生领取表单预填（只写入表单状态，绝不调用确认领取方法或领取接口）
  // ============================================================================

  function getGameItemViewModel() {
    return document.querySelector('#personal-center-gameitem')?.__vue__ || null;
  }

  function getAcquireDialog() {
    return document.querySelector(
      '.el-dialog[role="dialog"][aria-label="选择收货游戏角色"]',
    );
  }

  function setNativePrefillStatus(message, isError = false) {
    const footer = getAcquireDialog()?.querySelector('.el-dialog__footer');
    if (!footer) return;

    let status = footer.querySelector('.ff14-item-store-prefill-status');
    if (!status) {
      status = document.createElement('span');
      status.className = 'ff14-item-store-prefill-status';
      footer.appendChild(status);
    }
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  }

  /** 在商城原生领取弹窗底部增加“设为默认领取角色”按钮，不改变原有领取按钮。 */
  function addNativeSaveButton(viewModel) {
    const dialog = getAcquireDialog();
    const footer = dialog?.querySelector('.el-dialog__footer');
    if (!footer) return;

    let button = footer.querySelector('.ff14-item-store-native-save');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'ff14-item-store-native-save';
      button.addEventListener('click', () => {
        const role = {
          areaId: viewModel.areaid,
          areaName: viewModel.areaname,
          groupId: viewModel.groupid,
          groupName: viewModel.groupname,
          characterId: viewModel.roleId,
          roleName: viewModel.rolename,
        };
        if (!role.areaId || !role.groupId || !role.characterId || !role.roleName) return;

        setSavedRole(role);
        button.textContent = `已设为默认：${roleLabel(role)}`;
      });
      footer.prepend(button);
    }

    const roleReady = Boolean(
      viewModel.areaid
      && viewModel.groupid
      && viewModel.roleId
      && viewModel.rolename,
    );
    button.disabled = !roleReady;
    if (!roleReady) {
      button.textContent = '选好角色后可设为默认';
      return;
    }

    const selectedLabel = roleLabel({ groupName: viewModel.groupname, roleName: viewModel.rolename });
    const savedRole = getSavedRole();
    button.textContent = savedRole
      && String(savedRole.characterId) === String(viewModel.roleId)
      && String(savedRole.groupId) === String(viewModel.groupid)
      ? `当前默认：${selectedLabel}`
      : `设为默认领取角色（${selectedLabel}）`;
  }

  function findConfiguredRole(roleList, configuredRole) {
    return roleList.find((role) => (
      String(role.groupId) === String(configuredRole.groupId)
      && String(role.characterId || role.roleId) === String(configuredRole.characterId)
    )) || roleList.find((role) => (
      String(role.value || role.roleValue || '')
        .startsWith(`${configuredRole.groupId}-${configuredRole.characterId}`)
    ));
  }

  function waitForRole(viewModel, configuredRole, timeout = 6000) {
    return new Promise((resolve) => {
      const startedAt = Date.now();
      const timer = window.setInterval(() => {
        const role = findConfiguredRole(viewModel.rolelist || [], configuredRole);
        if (role || Date.now() - startedAt >= timeout) {
          window.clearInterval(timer);
          resolve(role || null);
        }
      }, 120);
    });
  }

  async function prefillRole(viewModel, configuredRole) {
    const area = (viewModel.arealist || []).find((item) => (
      String(item.areaId) === String(configuredRole.areaId)
    ));
    if (!area) return false;

    const areaValue = `${area.areaId}*${area.areaName}`;
    viewModel.areavalue = areaValue;
    viewModel.areaid = area.areaId;
    viewModel.areaname = area.areaName;

    // 仅需要选择大区的领取方式无需填写角色。
    if (viewModel.acquireMethod === 3) return true;

    // 使用商城自身的加载逻辑验证角色仍可领取，再更新其响应式字段。
    if (typeof viewModel.loadGameRole !== 'function') return false;
    viewModel.loadGameRole(areaValue);

    const role = await waitForRole(viewModel, configuredRole);
    if (!role) return false;

    viewModel.groupid = configuredRole.groupId;
    viewModel.groupname = configuredRole.groupName;
    viewModel.roleId = configuredRole.characterId;
    viewModel.rolename = configuredRole.roleName;
    viewModel.rolevalue = `${configuredRole.groupId}-${configuredRole.characterId}`
      + `*[${configuredRole.groupName}]${configuredRole.roleName}`;
    return true;
  }

  function observeAcquireDialog() {
    let handledDialogKey = '';
    let filling = false;

    window.setInterval(async () => {
      const viewModel = getGameItemViewModel();
      if (!viewModel || !viewModel.acquiredialog) {
        if (!viewModel?.acquiredialog) handledDialogKey = '';
        return;
      }

      addNativeSaveButton(viewModel);

      const configuredRole = getSavedRole();
      if (!configuredRole) return;

      const dialogKey = `${viewModel.propswarehouseid}:${viewModel.acquireMethod}`;
      if (!viewModel.propswarehouseid || filling || handledDialogKey === dialogKey) return;
      if (!Array.isArray(viewModel.arealist) || !viewModel.arealist.length) return;

      filling = true;
      handledDialogKey = dialogKey;
      try {
        const filled = await prefillRole(viewModel, configuredRole);
        if (filled) {
          setNativePrefillStatus(`已预填默认角色：${roleLabel(configuredRole)}`);
        } else {
          setNativePrefillStatus('未找到已保存的角色，请在右下角重新设置默认角色。', true);
        }
      } catch (error) {
        console.warn('[FF14 默认领取角色] 预填角色失败：', error);
        setNativePrefillStatus('默认角色预填失败，请稍后重试或重新设置。', true);
      } finally {
        filling = false;
      }
    }, 250);
  }

  addSettingsPanel();
  if (location.pathname === '/personal-center') observeAcquireDialog();
})();

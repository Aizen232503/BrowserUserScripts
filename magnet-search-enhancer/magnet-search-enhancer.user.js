// ==UserScript==
// @name         磁力搜索增强
// @namespace    https://github.com/Aizen232503/BrowserUserScripts/magnet-search-enhancer
// @version      0.9.3
// @description  优化磁力搜索结果，对常见的磁力网站类型将磁力链复制、下载按钮直接外显，并含有筛选和去广告功能，更多网站适配中
// @author       Aizen232503
// @license      GPL-3.0-only
// @homepageURL  https://github.com/Aizen232503/BrowserUserScripts/tree/main/magnet-search-enhancer
// @updateURL    https://raw.githubusercontent.com/Aizen232503/BrowserUserScripts/main/magnet-search-enhancer/magnet-search-enhancer.user.js
// @downloadURL  https://raw.githubusercontent.com/Aizen232503/BrowserUserScripts/main/magnet-search-enhancer/magnet-search-enhancer.user.js
// @match        https://xiongmaogb.top/search*
// @match        https://www.xiongmaogb.top/search*
// @match        https://skrbtso.top/search*
// @match        https://www.skrbtso.top/search*
// @match        https://laowangso.top/search*
// @match        https://www.laowangso.top/search*
// @match        https://lemonun.top/search*
// @match        https://www.lemonun.top/search*
// @match        https://bt4gprx.com/*
// @match        https://www.bt4gprx.com/*
// @match        https://clmclm.com/*
// @match        https://www.clmclm.com/*
// @match        https://clgclg.com/*
// @match        https://www.clgclg.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_setClipboard
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  // ============================================================================
  // 通用工具
  // ============================================================================

  const AUTO_FETCH_SETTING_KEYS = {
    enabled: 'mse-auto-fetch-magnets',
    concurrency: 'mse-auto-fetch-concurrency',
    intervalSeconds: 'mse-auto-fetch-interval-seconds',
    retries: 'mse-auto-fetch-retries',
  };

  const AUTO_FETCH_DEFAULTS = {
    enabled: false,
    concurrency: 4,
    intervalSeconds: 1,
    retries: 3,
  };

  /** 读取跨域共享的自动获取配置；读取异常时使用默认值。 */
  function getAutoFetchSetting(name) {
    try {
      return GM_getValue(AUTO_FETCH_SETTING_KEYS[name], AUTO_FETCH_DEFAULTS[name]);
    } catch {
      return AUTO_FETCH_DEFAULTS[name];
    }
  }

  /** 将自动获取配置保存到用户脚本管理器的全局存储。 */
  function setAutoFetchSetting(name, value) {
    try {
      GM_setValue(AUTO_FETCH_SETTING_KEYS[name], value);
    } catch {
      // 存储不可用时，本页配置仍然有效，但无法跨站点保留。
    }
  }

  /**
   * 创建按详情 URL 去重的磁链缓存。
   * Map 同时保存进行中的 Promise 和成功结果；失败时删除条目，以便调度器重试。
   */
  function createMagnetCache(loadMagnet) {
    const entries = new Map();
    const successListeners = new Map();

    const normalizeUrl = (detailUrl) => new URL(detailUrl, location.href).href;

    function notifySuccess(cacheKey, magnet) {
      successListeners.get(cacheKey)?.forEach((listener) => listener(magnet));
    }

    function request(detailUrl) {
      const cacheKey = normalizeUrl(detailUrl);
      if (!entries.has(cacheKey)) {
        const entry = { state: 'pending', magnet: null, promise: null };
        entry.promise = Promise.resolve()
          .then(() => loadMagnet(cacheKey))
          .then((magnet) => {
            entry.state = 'fulfilled';
            entry.magnet = magnet;
            notifySuccess(cacheKey, magnet);
            return magnet;
          })
          .catch((error) => {
            entries.delete(cacheKey);
            throw error;
          });
        entries.set(cacheKey, entry);
      }

      return entries.get(cacheKey).promise;
    }

    function onSuccess(detailUrl, listener) {
      const cacheKey = normalizeUrl(detailUrl);
      if (!successListeners.has(cacheKey)) successListeners.set(cacheKey, new Set());
      successListeners.get(cacheKey).add(listener);

      const entry = entries.get(cacheKey);
      if (entry?.state === 'fulfilled') listener(entry.magnet);
    }

    return { normalizeUrl, onSuccess, request };
  }

  /** 在结果操作行末尾添加低干扰的缓存成功标记。 */
  function addCacheStatusMarker(cache, detailUrl, container) {
    const marker = document.createElement('span');
    marker.className = 'mse-cache-status';
    marker.style.cssText = [
      'display:none',
      'margin-left:4px',
      'color:#26834f',
      'font-size:12px',
      'font-weight:700',
      'white-space:nowrap',
    ].join(';');
    marker.textContent = '已缓存磁力链接';
    container.append(marker);

    cache.onSuccess(detailUrl, () => {
      marker.style.display = 'inline';
    });
  }

  /** 创建带标签的数字配置项。 */
  function createNumberSetting(labelText, value, min, max, step = '1') {
    const label = document.createElement('label');
    label.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;';

    const text = document.createElement('span');
    text.textContent = labelText;

    const input = document.createElement('input');
    input.type = 'number';
    input.min = String(min);
    input.max = String(max);
    input.step = step;
    input.value = String(value);
    input.style.cssText = 'width:64px;padding:2px 4px;box-sizing:border-box;';

    label.append(text, input);
    return { input, label };
  }

  /**
   * 创建全局自动获取面板，并按批次调度缓存任务。
   * 失败任务追加到队尾，使尚未尝试的新任务优先；每批共享同一并发上限。
   */
  function addAutoFetchControl(getDetailUrls, cache) {
    const control = document.createElement('aside');
    control.id = 'mse-auto-fetch-control';
    control.style.cssText = [
      'position:fixed',
      'right:16px',
      'bottom:16px',
      'z-index:2147483646',
      'width:280px',
      'max-width:calc(100vw - 32px)',
      'padding:10px 12px',
      'border:1px solid #cbd5e1',
      'border-radius:10px',
      'background:#fff',
      'color:#1f2937',
      'font:13px/1.45 sans-serif',
      'box-shadow:0 5px 18px rgba(0,0,0,.18)',
    ].join(';');

    const label = document.createElement('label');
    label.style.cssText = 'display:flex;align-items:center;gap:7px;cursor:pointer;font-weight:700;';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = Boolean(getAutoFetchSetting('enabled'));

    const labelText = document.createElement('span');
    labelText.textContent = '自动获取磁力链接';

    const settings = document.createElement('div');
    settings.style.cssText = [
      'display:grid',
      'gap:5px',
      'margin-top:8px',
      'padding-top:8px',
      'border-top:1px solid #e2e8f0',
    ].join(';');

    const concurrencySetting = createNumberSetting(
      '同时缓存数量',
      getAutoFetchSetting('concurrency'),
      1,
      10,
    );
    const intervalSetting = createNumberSetting(
      '每组间隔（秒）',
      getAutoFetchSetting('intervalSeconds'),
      0,
      30,
      '0.5',
    );
    const retrySetting = createNumberSetting(
      '失败重试次数',
      getAutoFetchSetting('retries'),
      0,
      10,
    );
    settings.append(concurrencySetting.label, intervalSetting.label, retrySetting.label);
    settings.style.display = checkbox.checked ? 'grid' : 'none';

    const status = document.createElement('div');
    status.style.cssText = 'margin-top:5px;color:#64748b;';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.textContent = checkbox.checked ? '等待获取…' : '已关闭';

    label.append(checkbox, labelText);
    control.append(label, settings, status);
    document.body.append(control);

    let runningPromise = null;

    async function prefetch() {
      if (!checkbox.checked || runningPromise) return runningPromise;

      const detailUrls = [...new Set(getDetailUrls().map(cache.normalizeUrl))];
      if (!detailUrls.length) {
        status.textContent = '当前页面没有可获取的结果';
        return null;
      }

      runningPromise = (async () => {
        const pending = detailUrls.map((detailUrl) => ({ detailUrl, retryCount: 0 }));
        let cachedCount = 0;
        let failedCount = 0;
        let retryCount = 0;

        const updateStatus = () => {
          if (!checkbox.checked) return;
          status.textContent = `已缓存 ${cachedCount} / ${detailUrls.length}`
            + (retryCount ? `，已重试 ${retryCount} 次` : '')
            + (failedCount ? `，失败 ${failedCount} 条` : '');
        };
        updateStatus();

        while (pending.length && checkbox.checked) {
          const concurrency = Math.max(1, Math.min(
            10,
            Number.parseInt(concurrencySetting.input.value, 10) || AUTO_FETCH_DEFAULTS.concurrency,
          ));
          const batch = pending.splice(0, concurrency);
          const batchResults = await Promise.all(batch.map(async (task) => {
            try {
              await cache.request(task.detailUrl);
              return { task, succeeded: true };
            } catch {
              return { task, succeeded: false };
            }
          }));

          const maxRetries = Math.max(0, Math.min(
            10,
            Number.parseInt(retrySetting.input.value, 10) || 0,
          ));
          batchResults.forEach(({ task, succeeded }) => {
            if (succeeded) {
              cachedCount += 1;
            } else if (task.retryCount < maxRetries) {
              task.retryCount += 1;
              retryCount += 1;
              pending.push(task);
            } else {
              failedCount += 1;
            }
          });
          updateStatus();

          if (pending.length && checkbox.checked) {
            const parsedInterval = Number.parseFloat(intervalSetting.input.value);
            const intervalSeconds = Number.isFinite(parsedInterval)
              ? Math.max(0, Math.min(30, parsedInterval))
              : AUTO_FETCH_DEFAULTS.intervalSeconds;
            await new Promise((resolve) => {
              window.setTimeout(resolve, intervalSeconds * 1000);
            });
          }
        }

        if (!checkbox.checked) {
          status.style.color = '#64748b';
          status.textContent = '已关闭';
          return;
        }
        status.style.color = failedCount ? '#b45309' : '#26834f';
        status.textContent = failedCount
          ? `已缓存 ${cachedCount} 条，最终失败 ${failedCount} 条`
          : `已缓存 ${cachedCount} 条`;
      })().finally(() => {
        runningPromise = null;
      });

      return runningPromise;
    }

    checkbox.addEventListener('change', () => {
      setAutoFetchSetting('enabled', checkbox.checked);
      settings.style.display = checkbox.checked ? 'grid' : 'none';
      status.style.color = '#64748b';
      if (checkbox.checked) {
        prefetch();
      } else {
        status.textContent = '已关闭';
      }
    });

    const saveIntegerSetting = (input, name, min, max) => {
      input.addEventListener('change', () => {
        const value = Math.max(min, Math.min(max, Number.parseInt(input.value, 10) || min));
        input.value = String(value);
        setAutoFetchSetting(name, value);
      });
    };
    saveIntegerSetting(concurrencySetting.input, 'concurrency', 1, 10);
    saveIntegerSetting(retrySetting.input, 'retries', 0, 10);
    intervalSetting.input.addEventListener('change', () => {
      const parsed = Number.parseFloat(intervalSetting.input.value);
      const value = Number.isFinite(parsed) ? Math.max(0, Math.min(30, parsed)) : 1;
      intervalSetting.input.value = String(value);
      setAutoFetchSetting('intervalSeconds', value);
    });

    if (checkbox.checked) prefetch();
    return { prefetch };
  }

  /**
   * 复制文本，并按用户脚本 API、现代 Clipboard API、旧版命令的顺序降级。
   * 最后的 textarea 方案用于不支持安全上下文剪贴板 API 的旧页面。
   */
  function copyText(text) {
    if (typeof GM_setClipboard === 'function') {
      GM_setClipboard(text, 'text');
      return;
    }

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
    document.body.append(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }

  // ============================================================================
  // 第二类：BT4G 搜索页与磁链详情页
  // ============================================================================

  /**
   * 为 BT4G 的搜索页和详情页添加磁链快捷操作。
   * BT4G 的搜索结果只提供详情页地址，因此需要按需请求详情页再提取磁链。
   */
  function enhanceBt4g() {
    // 同一详情页只请求一次；失败时会清除缓存，以便用户再次尝试。
    const requestCache = new Map();

    // 样式使用 mse 前缀，尽量避免与目标站点的类名发生冲突。
    const style = document.createElement('style');
    style.textContent = `
      .mse-bt4g-actions { display: inline-flex; gap: 5px; margin-left: 7px; }
      .mse-bt4g-button {
        padding: 2px 7px;
        border: 1px solid transparent;
        border-radius: 3px;
        color: #fff;
        font-size: 12px;
        line-height: 1.5;
        cursor: pointer;
      }
      .mse-bt4g-open { background: #2878b5; border-color: #21699f; }
      .mse-bt4g-copy { background: #26834f; border-color: #1f7043; }
      .mse-bt4g-button:disabled { cursor: wait; opacity: .65; }
      #mse-bt4g-detail-copy {
        position: fixed;
        top: 50%;
        right: 18px;
        z-index: 2147483647;
        transform: translateY(-50%);
        padding: 9px 13px;
        box-shadow: 0 5px 16px rgba(0, 0, 0, .2);
      }
      .mse-toast {
        position: fixed;
        top: 18px;
        right: 18px;
        z-index: 2147483647;
        padding: 9px 13px;
        border-radius: 4px;
        background: #26834f;
        color: #fff;
        font: 13px sans-serif;
        box-shadow: 0 5px 16px rgba(0, 0, 0, .2);
      }
      .mse-toast-error { background: #b83b3b; }
    `;
    document.head.append(style);

    /** 显示短暂的操作反馈，错误消息使用不同配色。 */
    function showToast(message, isError = false) {
      const toast = document.createElement('div');
      toast.className = `mse-toast${isError ? ' mse-toast-error' : ''}`;
      toast.textContent = message;
      document.body.append(toast);
      window.setTimeout(() => toast.remove(), 1600);
    }

    /**
     * 从 BT4G 详情页中提取磁链。
     * 按可靠程度依次尝试下载链接哈希、现成磁链、正文文本和 URL 路径哈希。
     */
    function extractBt4gMagnet(html, detailUrl) {
      const detailDocument = new DOMParser().parseFromString(html, 'text/html');
      const hashDownload = detailDocument.querySelector(
        'a[href*="downloadtorrentfile.com/hash/"]',
      );
      const downloadHash = hashDownload?.href.match(/\/hash\/([a-f0-9]{40})/i)?.[1];
      if (downloadHash) return `magnet:?xt=urn:btih:${downloadHash}`;

      const directMagnet = detailDocument
        .querySelector('a[href^="magnet:?xt=urn:btih:"]')
        ?.getAttribute('href');
      if (directMagnet) return directMagnet;

      const textMagnet = detailDocument.body?.textContent.match(
        /magnet:\?xt=urn:btih:[a-z0-9]{32,40}/i,
      )?.[0];
      if (textMagnet) return textMagnet;

      const pathHash = new URL(detailUrl, location.href).pathname.split('/').pop();
      return /^[a-f0-9]{40}$/i.test(pathHash ?? '')
        ? `magnet:?xt=urn:btih:${pathHash}`
        : null;
    }

    /** 获取并缓存详情页对应的磁链 Promise，合并短时间内的重复点击。 */
    function requestMagnet(detailUrl) {
      const cacheKey = new URL(detailUrl, location.href).href;
      if (!requestCache.has(cacheKey)) {
        const request = fetch(cacheKey, {
          credentials: 'same-origin',
          headers: { Accept: 'text/html' },
        })
          .then((response) => {
            if (!response.ok) throw new Error(`详情页请求失败：HTTP ${response.status}`);
            return response.text();
          })
          .then((html) => {
            const magnet = extractBt4gMagnet(html, cacheKey);
            if (!magnet) throw new Error('详情页中没有找到磁力链接');
            return magnet;
          })
          .catch((error) => {
            requestCache.delete(cacheKey);
            throw error;
          });

        requestCache.set(cacheKey, request);
      }

      return requestCache.get(cacheKey);
    }

    /** 统一管理按钮的加载状态、成功提示与错误反馈。 */
    async function runMagnetAction(button, detailUrl, action, successText) {
      const originalText = button.textContent;
      const originalTitle = button.title;
      button.disabled = true;
      button.textContent = '获取中...';

      try {
        const magnet = await requestMagnet(detailUrl);
        action(magnet);
        if (successText) {
          button.textContent = successText;
          await new Promise((resolve) => window.setTimeout(resolve, 800));
        }
      } catch (error) {
        button.textContent = '获取失败';
        button.title = error instanceof Error ? error.message : String(error);
        await new Promise((resolve) => window.setTimeout(resolve, 1400));
      } finally {
        button.disabled = false;
        button.textContent = originalText;
        button.title = originalTitle;
      }
    }

    // --- BT4G 搜索结果页 ---
    function addSearchActions() {
      let addedCount = 0;
      document.querySelectorAll('a[href*="/magnet/"]').forEach((link) => {
        // MutationObserver 可能重复扫描节点，标记已增强的结果以保证幂等。
        if (link.parentElement?.querySelector(':scope > .mse-bt4g-actions')) return;

        const actions = document.createElement('span');
        actions.className = 'mse-bt4g-actions';

        const openButton = document.createElement('button');
        openButton.type = 'button';
        openButton.className = 'mse-bt4g-button mse-bt4g-open';
        openButton.textContent = '打开';
        openButton.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          runMagnetAction(openButton, link.href, (magnet) => {
            window.location.href = magnet;
          });
        });

        const copyButton = document.createElement('button');
        copyButton.type = 'button';
        copyButton.className = 'mse-bt4g-button mse-bt4g-copy';
        copyButton.textContent = '复制';
        copyButton.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          runMagnetAction(copyButton, link.href, copyText, '已复制');
        });

        actions.append(openButton, copyButton);
        link.insertAdjacentElement('afterend', actions);
        addedCount += 1;
      });
      return addedCount;
    }

    // --- BT4G 磁链详情页 ---
    function addDetailCopyButton() {
      if (document.getElementById('mse-bt4g-detail-copy')) return;

      const button = document.createElement('button');
      button.id = 'mse-bt4g-detail-copy';
      button.type = 'button';
      button.className = 'mse-bt4g-button mse-bt4g-copy';
      button.textContent = '复制磁链';
      button.addEventListener('click', () => {
        const magnet = extractBt4gMagnet(document.documentElement.outerHTML, location.href);
        if (!magnet) {
          showToast('当前页面未找到磁力链接', true);
          return;
        }

        copyText(magnet);
        showToast('磁力链接已复制');
      });
      document.body.append(button);
    }

    const isSearchPage = location.pathname.startsWith('/search')
      || new URLSearchParams(location.search).has('q');
    if (isSearchPage) {
      addSearchActions();
      // 搜索结果可能异步渲染；观察一段时间后自动释放，避免长期监听页面变化。
      const observer = new MutationObserver(addSearchActions);
      observer.observe(document.body, { childList: true, subtree: true });
      window.setTimeout(() => observer.disconnect(), 20000);
    } else if (location.pathname.startsWith('/magnet/')) {
      addDetailCopyButton();
    }
  }

  // ============================================================================
  // 第一类：熊猫、SkrBT、老王、Lemon 同构 Bootstrap 搜索页
  // ============================================================================

  /** 为共享同一套 DOM 结构的搜索站点添加过滤、折叠和磁链快捷操作。 */
  function enhanceLegacyBootstrapSearch() {
    if (!location.pathname.startsWith('/search')) return;

    // 旧版镜像使用 .left，新版老王使用居中的 .col-md-6 作为结果容器。
    const resultContainer = document.querySelector('.left')
      ?? document.querySelector('.container-fluid > .row > .col-md-6');
    if (!resultContainer) return;

    /** 兼容旧版页脚详情入口和新版标题中的 /detail/ 入口。 */
    function getResultDetailLink(result) {
      const footerLink = result.querySelector('.panel-footer a[href]');
      if (footerLink) return footerLink;

      const headingLink = result.querySelector('.panel-title a[href]');
      if (!headingLink) return null;

      try {
        const url = new URL(headingLink.href, location.href);
        return url.origin === location.origin && url.pathname.startsWith('/detail/')
          ? headingLink
          : null;
      } catch {
        return null;
      }
    }

    // 这些域名对应混入搜索结果的推广链接；只移除包含该链接的结果卡片。
    const blockedHosts = new Set(['v.lihuatvk.cc']);

    const allResults = [...resultContainer.querySelectorAll(':scope > .panel.panel-default')];
    allResults.forEach((result) => {
      const links = [...result.querySelectorAll('a[href]')];
      const isBlocked = links.some((link) => {
        try {
          return blockedHosts.has(new URL(link.href, location.href).hostname);
        } catch {
          return false;
        }
      });

      if (isBlocked) result.remove();
    });

    const results = [...resultContainer.querySelectorAll(':scope > .panel.panel-default')]
      .filter((result) => getResultDetailLink(result));
    if (!results.length) return;

    const style = document.createElement('style');
    style.textContent = `
      #xm-enhancer-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 12px 0;
        padding: 10px;
        border: 1px solid #ddd;
        background: #f8f8f8;
      }
      #xm-enhancer-bar input {
        min-width: 160px;
        max-width: 360px;
      }
      #xm-enhancer-count { color: #666; white-space: nowrap; }
      .xm-result-index {
        display: inline-block;
        margin-right: 8px;
        color: #777;
        font-weight: 700;
      }
      .xm-actions {
        display: inline-flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
        margin-right: 10px;
        vertical-align: middle;
      }
      .xm-actions .btn {
        border-radius: 3px;
        font-weight: 500;
        line-height: 1.5;
        transition: background-color .15s ease, border-color .15s ease;
      }
      .xm-copy-magnet {
        color: #17633a;
        background: #eef9f2;
        border-color: #9bcdb0;
      }
      .xm-copy-magnet:hover,
      .xm-copy-magnet:focus {
        color: #104b2c;
        background: #dff2e7;
        border-color: #72b68f;
      }
      .xm-open-magnet {
        color: #fff;
        background: #2878b5;
        border-color: #21699f;
      }
      .xm-open-magnet:hover,
      .xm-open-magnet:focus {
        color: #fff;
        background: #21699f;
        border-color: #19557f;
      }
      .xm-detail-link { color: #555; }
      .xm-files-collapsed { display: none; }
      @media (max-width: 767px) {
        #xm-enhancer-bar { align-items: stretch; flex-direction: column; }
        #xm-enhancer-bar input { max-width: none; width: 100%; }
        .xm-actions { display: flex; margin: 8px 0 0; }
      }
    `;
    document.head.append(style);

    const toolbar = document.createElement('div');
    toolbar.id = 'xm-enhancer-bar';
    toolbar.innerHTML = `
      <input id="xm-filter" class="form-control" type="search"
             placeholder="在本页结果中筛选" aria-label="在本页结果中筛选">
      <button id="xm-toggle-all" class="btn btn-default" type="button"
              aria-expanded="true">折叠全部</button>
      <span id="xm-enhancer-count"></span>
    `;

    const firstResult = results[0];
    resultContainer.insertBefore(toolbar, firstResult);

    const countLabel = toolbar.querySelector('#xm-enhancer-count');

    /** 同步单条结果的文件列表、按钮文字及无障碍展开状态。 */
    function setFilesVisible(result, visible) {
      const body = result.querySelector('.panel-body');
      const toggle = result.querySelector('.xm-toggle-files');
      if (!body || !toggle) return;

      body.classList.toggle('xm-files-collapsed', !visible);
      toggle.textContent = visible ? '折叠文件' : '展开文件';
      toggle.setAttribute('aria-expanded', String(visible));
    }

    /** 从详情页 HTML 中提取磁链，兼容链接节点和编码后的源码文本。 */
    function extractMagnet(html) {
      const detailDocument = new DOMParser().parseFromString(html, 'text/html');
      const magnetAnchor = detailDocument.querySelector(
        '#magnet[href^="magnet:?xt=urn:btih:"], a[href^="magnet:?xt=urn:btih:"]',
      );
      const directMagnet = magnetAnchor?.getAttribute('href');
      if (/^magnet:\?xt=urn:btih:[a-z0-9]+/i.test(directMagnet ?? '')) {
        return directMagnet;
      }

      const decodedSource = html
        .replaceAll('&amp;', '&')
        .replaceAll('&#38;', '&');
      return decodedSource.match(/magnet:\?xt=urn:btih:[a-z0-9]+(?:&[^\s"'<>]*)*/i)?.[0] ?? null;
    }

    /** 请求第一类网站详情页并提取磁链；缓存和失败清理由通用模块负责。 */
    async function loadMagnet(detailUrl) {
      const response = await fetch(detailUrl, {
        credentials: 'same-origin',
        headers: { Accept: 'text/html' },
      });
      if (!response.ok) throw new Error(`详情页请求失败：HTTP ${response.status}`);

      const magnet = extractMagnet(await response.text());
      if (!magnet) throw new Error('详情页中没有找到磁力链接');
      return magnet;
    }

    const magnetCache = createMagnetCache(loadMagnet);
    const requestMagnet = magnetCache.request;

    /** 在临时锁定按钮的同时获取磁链并执行调用方指定的操作。 */
    async function withMagnet(button, detailUrl, action, successText = '') {
      const originalHtml = button.innerHTML;
      const originalTitle = button.title;
      button.disabled = true;
      button.textContent = '正在获取...';

      try {
        const magnet = await requestMagnet(detailUrl);
        action(magnet);
        if (successText) {
          button.textContent = successText;
          await new Promise((resolve) => window.setTimeout(resolve, 800));
        }
      } catch (error) {
        button.textContent = '获取失败';
        button.title = error instanceof Error ? error.message : String(error);
        await new Promise((resolve) => window.setTimeout(resolve, 1400));
      } finally {
        button.disabled = false;
        button.innerHTML = originalHtml;
        button.title = originalTitle;
      }
    }

    results.forEach((result, index) => {
      const heading = result.querySelector('.panel-title');
      const footerContainer = result.querySelector('.panel-footer');
      const footer = footerContainer?.querySelector('small') ?? footerContainer;
      const originalActionLink = footer?.querySelector('a[href]');
      const detailLink = getResultDetailLink(result);
      const body = result.querySelector('.panel-body');

      if (heading) {
        const marker = document.createElement('span');
        marker.className = 'xm-result-index';
        marker.textContent = `#${index + 1}`;
        heading.prepend(marker);
      }

      if (footer) {
        // 将原站详情入口与新增操作收拢到同一个操作区，保持原链接可用。
        const actions = document.createElement('span');
        actions.className = 'xm-actions';
        const detailUrl = detailLink?.href;
        let toggleFiles = null;

        if (originalActionLink) {
          originalActionLink.title = '查看详情';
          originalActionLink.classList.add('btn', 'btn-xs', 'btn-default', 'xm-detail-link');
          originalActionLink.innerHTML = '<i class="fa fa-info-circle"></i> 查看详情';
        }

        if (body) {
          toggleFiles = document.createElement('button');
          toggleFiles.type = 'button';
          toggleFiles.className = 'btn btn-xs btn-default xm-toggle-files';
          toggleFiles.textContent = '折叠文件';
          toggleFiles.setAttribute('aria-expanded', 'true');
          toggleFiles.addEventListener('click', () => {
            setFilesVisible(result, body.classList.contains('xm-files-collapsed'));
          });
        }

        const copyMagnet = document.createElement('button');
        copyMagnet.type = 'button';
        copyMagnet.className = 'btn btn-xs btn-default xm-copy-magnet';
        copyMagnet.innerHTML = '<i class="fa fa-copy"></i> 复制';
        copyMagnet.title = '点击后从详情页获取并复制磁力链接';
        copyMagnet.disabled = !detailUrl;
        if (detailUrl) {
          copyMagnet.addEventListener('click', () => {
            withMagnet(copyMagnet, detailUrl, copyText, '已复制');
          });
        }
        actions.append(copyMagnet);

        const openMagnet = document.createElement('button');
        openMagnet.type = 'button';
        openMagnet.className = 'btn btn-xs btn-default xm-open-magnet';
        openMagnet.innerHTML = '<i class="fa fa-magnet"></i> 打开';
        openMagnet.title = '点击后从详情页获取并打开磁力链接';
        openMagnet.disabled = !detailUrl;
        if (detailUrl) {
          openMagnet.addEventListener('click', () => {
            withMagnet(openMagnet, detailUrl, (magnet) => {
              window.location.href = magnet;
            });
          });
        }
        actions.append(openMagnet);
        actions.insertBefore(openMagnet, copyMagnet);

        if (originalActionLink) actions.append(originalActionLink);
        if (toggleFiles) actions.append(toggleFiles);

        if (actions.childElementCount) footer.prepend(actions);
        if (detailUrl) addCacheStatusMarker(magnetCache, detailUrl, footer);
      }
    });

    /** 根据输入框内容过滤当前页结果，并更新可见数量。 */
    function applyFilter() {
      const query = toolbar.querySelector('#xm-filter').value.trim().toLocaleLowerCase();
      let visibleCount = 0;

      results.forEach((result) => {
        const matches = !query || result.textContent.toLocaleLowerCase().includes(query);
        result.hidden = !matches;
        if (matches) visibleCount += 1;
      });

      countLabel.textContent = `显示 ${visibleCount} / ${results.length} 条`;
    }

    toolbar.querySelector('#xm-filter').addEventListener('input', applyFilter);
    toolbar.querySelector('#xm-toggle-all').addEventListener('click', (event) => {
      const button = event.currentTarget;
      const shouldExpand = button.getAttribute('aria-expanded') === 'false';

      results.forEach((result) => setFilesVisible(result, shouldExpand));
      button.setAttribute('aria-expanded', String(shouldExpand));
      button.textContent = shouldExpand ? '折叠全部' : '展开全部';
    });

    applyFilter();

    addAutoFetchControl(
      () => results.map((result) => getResultDetailLink(result)?.href).filter(Boolean),
      magnetCache,
    );
  }

  // ============================================================================
  // 第三类：磁力猫、磁力狗 Zsky 资源搜索页
  // ============================================================================

  /**
   * 为使用 article.resource-card 结构的搜索页添加磁链快捷操作。
   * 搜索结果只包含详情页地址，点击操作时才会请求详情页并提取磁链。
   */
  function enhanceZskyResourceSearch() {
    if (!document.querySelector('article.resource-card h2 a[href*="/hash/"]')) return;

    const style = document.createElement('style');
    style.textContent = `
      .mse-zsky-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 10px 0 4px;
      }
      .mse-zsky-button {
        min-height: 34px;
        padding: 6px 13px;
        border: 1px solid transparent;
        border-radius: 9px;
        color: #fff;
        font: 700 14px/1.4 sans-serif;
        cursor: pointer;
      }
      .mse-zsky-open { background: #2878b5; border-color: #21699f; }
      .mse-zsky-copy { background: #26834f; border-color: #1f7043; }
      .mse-zsky-button:disabled { cursor: wait; opacity: .65; }
    `;
    document.head.append(style);

    /**
     * 从详情页的预览配置中读取磁链。
     * 若站点调整了配置，则回退到详情 URL 中稳定的 40 位 info hash。
     */
    function extractZskyMagnet(html, detailUrl) {
      const detailDocument = new DOMParser().parseFromString(html, 'text/html');
      const previewApi = detailDocument
        .querySelector('[data-browser-preview-api]')
        ?.getAttribute('data-browser-preview-api');

      if (previewApi) {
        try {
          const magnet = new URL(previewApi, detailUrl).searchParams.get('url');
          if (/^magnet:\?xt=urn:btih:[a-f0-9]{40}(?:&|$)/i.test(magnet ?? '')) {
            return magnet;
          }
        } catch {
          // 配置 URL 无效时继续尝试详情页路径中的哈希。
        }
      }

      const detailHash = new URL(detailUrl, location.href).pathname.match(
        /\/hash\/([a-f0-9]{40})(?:\.html)?$/i,
      )?.[1];
      return detailHash ? `magnet:?xt=urn:btih:${detailHash}` : null;
    }

    /** 请求第三类网站详情页并提取磁链；缓存和失败清理由通用模块负责。 */
    async function loadZskyMagnet(detailUrl) {
      const response = await fetch(detailUrl, {
        credentials: 'same-origin',
        headers: { Accept: 'text/html' },
      });
      if (!response.ok) throw new Error(`详情页请求失败：HTTP ${response.status}`);

      const magnet = extractZskyMagnet(await response.text(), detailUrl);
      if (!magnet) throw new Error('详情页中没有找到磁力链接');
      return magnet;
    }

    const magnetCache = createMagnetCache(loadZskyMagnet);
    const requestZskyMagnet = magnetCache.request;

    /** 在请求期间锁定按钮，并统一恢复按钮状态及显示错误。 */
    async function runZskyMagnetAction(button, detailUrl, action, successText = '') {
      const originalText = button.textContent;
      const originalTitle = button.title;
      button.disabled = true;
      button.textContent = '获取中...';

      try {
        const magnet = await requestZskyMagnet(detailUrl);
        action(magnet);
        if (successText) {
          button.textContent = successText;
          await new Promise((resolve) => window.setTimeout(resolve, 800));
        }
      } catch (error) {
        button.textContent = '获取失败';
        button.title = error instanceof Error ? error.message : String(error);
        await new Promise((resolve) => window.setTimeout(resolve, 1400));
      } finally {
        button.disabled = false;
        button.textContent = originalText;
        button.title = originalTitle;
      }
    }

    document.querySelectorAll('article.resource-card').forEach((result) => {
      if (result.querySelector(':scope > .mse-zsky-actions')) return;

      const detailLink = result.querySelector('h2 a[href*="/hash/"]');
      if (!detailLink) return;

      const actions = document.createElement('div');
      actions.className = 'mse-zsky-actions';

      const openButton = document.createElement('button');
      openButton.type = 'button';
      openButton.className = 'mse-zsky-button mse-zsky-open';
      openButton.textContent = '打开磁链';
      openButton.addEventListener('click', () => {
        runZskyMagnetAction(openButton, detailLink.href, (magnet) => {
          window.location.href = magnet;
        });
      });

      const copyButton = document.createElement('button');
      copyButton.type = 'button';
      copyButton.className = 'mse-zsky-button mse-zsky-copy';
      copyButton.textContent = '复制磁链';
      copyButton.addEventListener('click', () => {
        runZskyMagnetAction(copyButton, detailLink.href, copyText, '已复制');
      });

      actions.append(openButton, copyButton);
      addCacheStatusMarker(magnetCache, detailLink.href, actions);
      result.append(actions);
    });

    addAutoFetchControl(
      () => [...document.querySelectorAll('article.resource-card h2 a[href*="/hash/"]')]
        .map((link) => link.href),
      magnetCache,
    );
  }

  // ============================================================================
  // 站点分组与页面路由
  // ============================================================================

  // 将 DOM 结构相同的站点归为一组，新增镜像域名时只需更新此表。
  const SITE_GROUPS = [
    {
      type: 'legacy-bootstrap-search',
      hosts: [
        'xiongmaogb.top',
        'www.xiongmaogb.top',
        'skrbtso.top',
        'www.skrbtso.top',
        'laowangso.top',
        'www.laowangso.top',
        'lemonun.top',
        'www.lemonun.top',
      ],
    },
    {
      type: 'bt4g-pages',
      hosts: ['bt4gprx.com', 'www.bt4gprx.com'],
    },
    {
      type: 'zsky-resource-search',
      hosts: ['clmclm.com', 'www.clmclm.com', 'clgclg.com', 'www.clgclg.com'],
    },
  ];

  const siteGroup = SITE_GROUPS.find(({ hosts }) => hosts.includes(location.hostname));
  if (!siteGroup) return;

  if (siteGroup.type === 'bt4g-pages') {
    enhanceBt4g();
  } else if (siteGroup.type === 'legacy-bootstrap-search') {
    enhanceLegacyBootstrapSearch();
  } else if (siteGroup.type === 'zsky-resource-search') {
    enhanceZskyResourceSearch();
  }
})();

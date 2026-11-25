// ==UserScript==
// @name         DouYinPlus
// @namespace    https://github.com/isxlan0/DouYinPlus
// @version      1.0.1
// @description  抖音网页增强：视频过滤、倍速、解除未登录时前端某些限制
// @author       Xiao Lan
// @match        https://douyin.com/*
// @match        https://*.douyin.com/*
// @run-at       document-start
// @noframes
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @grant        GM_info
// @grant        unsafeWindow
// @require      https://cdn.jsdelivr.net/npm/vue@2.7.16/dist/vue.min.js
// ==/UserScript==

(function () {
  'use strict';

  if (window.top !== window.self) {
    return;
  }

  const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const APP_NAME = 'DouYinPlus';
  const APP_VERSION = (typeof GM_info !== 'undefined' && GM_info && GM_info.script && GM_info.script.version) ? GM_info.script.version : '1.0.1';
  const APP_ID = 'dyp';
  const BRIDGE_KEY = '__DYP_MAIN_WORLD_BRIDGE__';
  const STORAGE_KEY = 'config';
  const LOGIN_TEXT_RE = /扫码登录|验证码登录|密码登录|登录后免费畅享高清视频|打开「抖音APP」|登录即代表同意/i;
  const DURATION_RE = /(?:\d{1,2}:)?\d{1,2}:\d{2}/;
  const VIEW_COUNT_RE = /^\d+(?:\.\d+)?[万亿]?$/;
  const DATE_LINE_RE = /^·?\s*(?:刚刚|\d+\s*(?:分钟前|小时前|天前|周前|月前)|\d{1,2}月\d{1,2}日|\d{4}-\d{1,2}-\d{1,2})$/;
  const LIVE_TEXT_RE = /直播中|正在直播|直播回放|进入直播间|点击或按F进入直播间/;
  const CARD_SELECTORS = [
    '.discover-video-card-item',
    '.jingxuanVideoCard',
    '.waterfall-videoCardContainer',
    '[class*="video-card-item"]',
    '[class*="videoCardContainer"]',
    '[class*="videoCard"]',
    '[class*="video-card"]',
    '[class*="feed-card"]',
    '[class*="feedCard"]',
    '.basePlayerContainer',
    '[data-e2e="feed-live"]',
    '[href*="/video/"]',
  ];
  const SIDE_TAB_OPTIONS = Object.freeze([
    { key: 'jingxuan', label: '精选', text: /^精选$/, href: /\/\/www\.douyin\.com\/jingxuan\?(?=[^#]*from_nav=1)[^#]*(?:#|$)/i },
    { key: 'recommend', label: '推荐', text: /^推荐$/, href: /\/\/www\.douyin\.com\/\?(?=[^#]*recommend=1)(?=[^#]*from_nav=1)[^#]*(?:#|$)/i },
    { key: 'aisearch', label: 'AI 搜索', text: /^搜索$/, href: /\/\/www\.douyin\.com\/aisearch\?(?=[^#]*from_nav=1)[^#]*(?:#|$)/i },
    { key: 'follow', label: '关注', text: /^关注$/, href: /\/\/www\.douyin\.com\/follow\?(?=[^#]*from_nav=1)[^#]*(?:#|$)/i },
    { key: 'friend', label: '朋友', text: /^朋友$/, href: /\/\/www\.douyin\.com\/friend\?(?=[^#]*from_nav=1)[^#]*(?:#|$)/i },
    { key: 'self', label: '我的', text: /^我的$/, href: /\/\/www\.douyin\.com\/user\/self\?(?=[^#]*from_nav=1)[^#]*(?:#|$)/i },
    { key: 'live', label: '直播', text: /^直播$/, href: /\/\/live\.douyin\.com\/\?(?=[^#]*from_nav=1)[^#]*(?:#|$)/i },
    { key: 'vs', label: '放映厅', text: /^放映厅$/, href: /\/\/www\.douyin\.com\/vs\?(?=[^#]*from_nav=1)[^#]*(?:#|$)/i },
    { key: 'series', label: '短剧', text: /^短剧$/, href: /\/\/www\.douyin\.com\/series\?(?=[^#]*from_nav=1)[^#]*(?:#|$)/i },
    { key: 'microgame', label: '小游戏', text: /^小游戏$/, href: /\/\/www\.douyin\.com\/microgame\?(?=[^#]*from_nav=1)[^#]*(?:#|$)/i },
    { key: 'download_app', label: '下载抖音精选', text: /^下载抖音精选$/ },
  ]);
  const TOP_BAR_OPTIONS = Object.freeze([
    { key: 'search', label: '搜索' },
    { key: 'recharge', label: '充钻石', text: /^充(?:钻石|值)/ },
    { key: 'client', label: '客户端', text: /^客户端/ },
    { key: 'wallpaper', label: '壁纸', text: /^壁纸/ },
    { key: 'notice', label: '通知', text: /^通知/ },
    { key: 'message', label: '私信', text: /^(?:私信|消息)/ },
    { key: 'upload', label: '投稿', text: /^(?:投稿|发布)/ },
    { key: 'login', label: '登录', text: /^登录/ },
  ]);
  const INTERACTION_BAR_OPTIONS = Object.freeze([
    { key: 'avatar', label: '头像', dataE2e: 'video-avatar', useParent: true },
    { key: 'digg', label: '点赞', dataE2e: 'video-player-digg' },
    { key: 'comment', label: '评论', dataE2e: 'feed-comment-icon' },
    { key: 'collect', label: '收藏', dataE2e: 'video-player-collect' },
    { key: 'ai', label: '问问AI', dataE2e: null, containerClass: 'O3Mbz6KI' },
    { key: 'share', label: '分享', dataE2e: 'video-player-share' },
    { key: 'listen', label: '听抖音', dataE2e: null, containerClass: 'fR9ZbClg', text: /听抖音/ },
    { key: 'more', label: '更多', dataE2e: 'video-play-more' },
    { key: 'livePreview', label: '直播弹窗', selector: '.LivePlayer_Preview, .LiveLinkA' },
  ]);
  const SETTINGS_DESCRIPTIONS = Object.freeze({
    enableUnlock: '解除未登录状态下的前端限制，如自动暂停、登录弹窗拦截等。不涉及后端接口，仅绕过前端检查。',
    enableFiltering: '根据时长、关键词、作者黑名单自动跳过不想看的视频。规则在"调节"页配置。',
    autoNext: '当视频播放卡住超过一定时间后，自动跳到下一条。',
    autoSkipLive: '当检测到当前播放的内容是直播时，自动跳到下一条视频。',
    holdToSpeed: '按住键盘左/右方向键时临时切换到加速/减速，松开恢复原速。',
    enableMiniButtons: '在视频播放区域显示快捷操作按钮（复制直链、下一条等）。',
  });
  const ROUTE_LABELS = Object.freeze({
    jingxuan: '精选',
    recommend: '推荐',
    video: '视频页',
    user: '用户页',
    self: '我的',
    search: '搜索',
    aisearch: 'AI 搜索',
    follow: '关注',
    friend: '朋友',
    live: '直播',
    vs: '放映厅',
    series: '短剧',
    microgame: '小游戏',
    discover: '发现',
    other: '其他',
  });

  const DEFAULT_CONFIG = Object.freeze({
    enableFiltering: true,
    keywordBlacklist: [],
    authorBlacklist: [],
    minDuration: 0,
    maxDuration: 0,
    autoNext: true,
    autoSkipLive: false,
    enableUnlock: true,
    enableMiniButtons: false,
    defaultPlaybackRate: 1,
    holdToSpeed: true,
    holdSpeed: 3,
    holdSlowSpeed: 0.5,
    boostKeys: ['a', 'd'],
    seekStepSeconds: 5,
    preferredClarity: 0,
    hiddenSideTabs: [],
    hiddenTopItems: [],
    hiddenInteractionItems: [],
    // UI 外观 — 参考 Bilibili-Evolved 的主题色系统
    themeColor: '#2196F3',
    darkMode: 'auto',
    dockPosition: 'left',
  });

  // Bilibili-Evolved 预设调色板
  // 来源: https://github.com/the1812/Bilibili-Evolved (MIT License)
  const BE_PALETTE = Object.freeze([
    '#E57373', '#F06292', '#BA68C8', '#9575CD',
    '#7986CB', '#2196F3', '#00A0D8', '#00ACC1',
    '#26A69A', '#81C784', '#9CCC65', '#FF9800',
    '#FF7043', '#A1887F', '#757575', '#78909C',
  ]);

  const gm = {
    addStyle(css) {
      if (typeof GM_addStyle === 'function') {
        GM_addStyle(css);
        return;
      }
      const style = document.createElement('style');
      style.textContent = css;
      (document.head || document.documentElement).appendChild(style);
    },
    getValue(key, fallback) {
      try {
        if (typeof GM_getValue === 'function') {
          return GM_getValue(key, fallback);
        }
      } catch (error) {
        console.warn(APP_NAME, 'GM_getValue 失败', error);
      }
      try {
        const raw = localStorage.getItem(`${APP_ID}:${key}`);
        return raw ? JSON.parse(raw) : fallback;
      } catch (error) {
        console.warn(APP_NAME, 'localStorage 读取失败', error);
      }
      return fallback;
    },
    setValue(key, value) {
      try {
        if (typeof GM_setValue === 'function') {
          GM_setValue(key, value);
          return;
        }
      } catch (error) {
        console.warn(APP_NAME, 'GM_setValue 失败', error);
      }
      try {
        localStorage.setItem(`${APP_ID}:${key}`, JSON.stringify(value));
      } catch (error) {
        console.warn(APP_NAME, 'localStorage 写入失败', error);
      }
    },
    setClipboard(text) {
      try {
        if (typeof GM_setClipboard === 'function') {
          GM_setClipboard(text);
          return true;
        }
      } catch (error) {
        console.warn(APP_NAME, 'GM_setClipboard 失败', error);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => { });
        return true;
      }
      return false;
    },
    registerMenuCommand(name, handler) {
      if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand(name, handler);
      }
    },
  };

  const DOM_CACHE_TTL = 120;
  const META_CACHE_TTL = 300;
  const domScanCache = {
    primaryVideo: { at: 0, value: null },
    runtimePlayer: { at: 0, value: null },
    cardCandidates: { at: 0, value: [] },
    feedCard: { at: 0, key: '', value: null },
  };
  const reactMetaCache = new WeakMap();
  const cardMetaCache = new WeakMap();

  function ready(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
      return;
    }
    callback();
  }

  function clamp(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, number));
  }

  function uniqueNumbers(values) {
    return Array.from(
      new Set(
        values
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value > 0)
          .map((value) => Number(value.toFixed(2))),
      ),
    ).sort((a, b) => a - b);
  }

  function scheduleTask(callback) {
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => callback());
      return;
    }
    window.setTimeout(() => callback(), 16);
  }

  function formatPlaybackRateLabel(rate) {
    const value = Number(rate);
    if (!Number.isFinite(value) || value <= 0) {
      return '1.0x';
    }
    const precise = Math.round(value * 100) / 100;
    if (Math.abs(precise - Math.round(precise)) < 0.001) {
      return `${Math.round(precise)}.0x`;
    }
    if (Math.abs(precise * 10 - Math.round(precise * 10)) < 0.001) {
      return `${precise.toFixed(1)}x`;
    }
    return `${precise.toFixed(2)}x`;
  }

  function normalizeList(value) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean);
    }
    return String(value || '')
      .split(/[\n,，]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function normalizeKeyList(value) {
    return Array.from(
      new Set(
        (Array.isArray(value) ? value : String(value || '').split(/[,\s]+/))
          .map((item) => String(item || '').trim())
          .filter(Boolean),
      ),
    );
  }

  function normalizeConfig(input) {
    const config = { ...DEFAULT_CONFIG, ...(input || {}) };
    config.keywordBlacklist = normalizeList(config.keywordBlacklist);
    config.authorBlacklist = normalizeList(config.authorBlacklist);
    config.hiddenSideTabs = normalizeKeyList(config.hiddenSideTabs);
    config.hiddenTopItems = normalizeKeyList(config.hiddenTopItems);
    config.hiddenInteractionItems = normalizeKeyList(config.hiddenInteractionItems);
    config.enableMiniButtons = Boolean(config.enableMiniButtons);
    config.defaultPlaybackRate = clamp(config.defaultPlaybackRate, 0.1, 16, DEFAULT_CONFIG.defaultPlaybackRate);
    config.holdSpeed = clamp(config.holdSpeed, 0.1, 16, DEFAULT_CONFIG.holdSpeed);
    config.holdSlowSpeed = clamp(config.holdSlowSpeed, 0.1, 16, DEFAULT_CONFIG.holdSlowSpeed);
    config.seekStepSeconds = clamp(config.seekStepSeconds, 1, 30, DEFAULT_CONFIG.seekStepSeconds);
    config.minDuration = Math.max(0, Math.floor(Number(config.minDuration) || 0));
    config.maxDuration = Math.max(0, Math.floor(Number(config.maxDuration) || 0));
    config.boostKeys = Array.isArray(config.boostKeys) && config.boostKeys.length
      ? Array.from(new Set(config.boostKeys.map((key) => String(key).toLowerCase()).filter(Boolean)))
      : [...DEFAULT_CONFIG.boostKeys];
    if (
      config.boostKeys.length === 2
      && config.boostKeys.includes('arrowleft')
      && config.boostKeys.includes('arrowright')
    ) {
      config.boostKeys = [...DEFAULT_CONFIG.boostKeys];
    }
    config.preferredClarity = Math.max(0, Math.floor(Number(config.preferredClarity) || 0));
    return config;
  }

  function loadConfig() {
    return normalizeConfig(gm.getValue(STORAGE_KEY, DEFAULT_CONFIG));
  }

  function formatLines(lines) {
    return normalizeList(lines).join('\n');
  }

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getTextLines(input) {
    return String(input || '')
      .split(/\n+/)
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
  }

  function parseDuration(text) {
    const match = String(text || '').match(DURATION_RE);
    if (!match) {
      return 0;
    }
    const parts = match[0].split(':').map((part) => Number(part));
    if (parts.some((value) => !Number.isFinite(value))) {
      return 0;
    }
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return parts[0] * 60 + parts[1];
  }

  function formatDuration(totalSeconds) {
    const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remain = seconds % 60;
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(remain).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(remain).padStart(2, '0')}`;
  }

  function visibleArea(rect) {
    const width = Math.max(0, Math.min(window.innerWidth, rect.right) - Math.max(0, rect.left));
    const height = Math.max(0, Math.min(window.innerHeight, rect.bottom) - Math.max(0, rect.top));
    return width * height;
  }

  function isElementVisible(element) {
    if (!(element instanceof Element)) {
      return false;
    }
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
      return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && visibleArea(rect) > 0;
  }

  function triggerClick(element) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }
    const rect = element.getBoundingClientRect();
    const clientX = Math.round(rect.left + rect.width / 2);
    const clientY = Math.round(rect.top + rect.height / 2);
    const baseInit = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX,
      clientY,
      button: 0,
      buttons: 1,
    };
    try {
      element.focus?.({ preventScroll: true });
    } catch (error) { }
    try {
      if (typeof PointerEvent === 'function') {
        element.dispatchEvent(new PointerEvent('pointerdown', {
          ...baseInit,
          pointerId: 1,
          pointerType: 'mouse',
          isPrimary: true,
        }));
      }
      element.dispatchEvent(new MouseEvent('mousedown', baseInit));
      if (typeof PointerEvent === 'function') {
        element.dispatchEvent(new PointerEvent('pointerup', {
          ...baseInit,
          buttons: 0,
          pointerId: 1,
          pointerType: 'mouse',
          isPrimary: true,
        }));
      }
      element.dispatchEvent(new MouseEvent('mouseup', { ...baseInit, buttons: 0 }));
      if (typeof element.click === 'function') {
        element.click();
      } else {
        element.dispatchEvent(new MouseEvent('click', { ...baseInit, buttons: 0 }));
      }
    } catch (error) {
      console.debug(APP_NAME, 'triggerClick failed', error);
      return false;
    }
    return true;
  }

  function currentPathKind() {
    const { hostname, pathname, search } = location;
    const params = new URLSearchParams(search);
    if (/^live\.douyin\.com$/i.test(hostname)) {
      return 'live';
    }
    if (/^\/jingxuan/.test(pathname)) {
      return 'jingxuan';
    }
    if (pathname === '/' && params.get('recommend') === '1') {
      return 'recommend';
    }
    if (/^\/video\//.test(pathname)) {
      return 'video';
    }
    if (/^\/user\/self(?:\/|$)/.test(pathname)) {
      return 'self';
    }
    if (/^\/user\//.test(pathname)) {
      return 'user';
    }
    if (pathname === '/aisearch' || /^\/aisearch\//.test(pathname)) {
      return 'aisearch';
    }
    if (/^\/search\//.test(pathname) || pathname === '/search') {
      return 'search';
    }
    if (/^\/follow/.test(pathname)) {
      return 'follow';
    }
    if (/^\/friend/.test(pathname)) {
      return 'friend';
    }
    if (/^\/vs(?:\/|$)/.test(pathname)) {
      return 'vs';
    }
    if (/^\/series(?:\/|$)/.test(pathname)) {
      return 'series';
    }
    if (/^\/microgame(?:\/|$)/.test(pathname)) {
      return 'microgame';
    }
    if (/^\/recommend/.test(pathname)) {
      return 'recommend';
    }
    if (/^\/discover/.test(pathname)) {
      return 'discover';
    }
    return 'other';
  }

  function findPrimaryVideo() {
    const now = Date.now();
    if (now - domScanCache.primaryVideo.at < DOM_CACHE_TTL && domScanCache.primaryVideo.value instanceof HTMLVideoElement) {
      return domScanCache.primaryVideo.value;
    }
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const videos = Array.from(document.querySelectorAll('video'));
    let bestVideo = null;
    let bestScore = -1;
    for (const video of videos) {
      if (!(video instanceof HTMLVideoElement)) {
        continue;
      }
      const rect = video.getBoundingClientRect();
      if (rect.width <= 80 || rect.height <= 80) {
        continue;
      }
      const coversCenter = rect.left <= centerX && rect.right >= centerX
        && rect.top <= centerY && rect.bottom >= centerY;
      let score = visibleArea(rect);
      if (coversCenter) score += 500000;
      if (!video.paused) score += 100000;
      if (score > bestScore) {
        bestScore = score;
        bestVideo = video;
      }
    }

    const primaryVisibleVideo = bestVideo || null;
    if (primaryVisibleVideo) {
      domScanCache.primaryVideo.at = now;
      domScanCache.primaryVideo.value = primaryVisibleVideo;
      return primaryVisibleVideo;
    }

    const activeCard = pickCurrentFeedCard('', null);
    const activeVideo = findVideoInElement(activeCard);
    if (activeVideo instanceof HTMLVideoElement) {
      return activeVideo;
    }

    domScanCache.primaryVideo.at = now;
    domScanCache.primaryVideo.value = null;
    return null;
  }

  function findPrimaryPlaySwitchButton() {
    const primaryVideo = findPrimaryVideo();
    const currentPlayer = primaryVideo?.closest?.('.xgplayer');
    if (currentPlayer instanceof HTMLElement) {
      const localButton = currentPlayer.querySelector('.recommend-out-switch-btn, .xgplayer-playswitch');
      if (localButton instanceof HTMLElement && isElementVisible(localButton)) {
        return localButton;
      }
    }
    const buttons = Array.from(document.querySelectorAll('.recommend-out-switch-btn, .xgplayer-playswitch'))
      .filter((button) => button instanceof HTMLElement)
      .filter((button) => {
        const rect = button.getBoundingClientRect();
        return rect.width > 8 && rect.height > 8 && isElementVisible(button);
      });
    if (!buttons.length) {
      return null;
    }
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    buttons.sort((left, right) => {
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      const leftDistance = Math.abs((leftRect.left + leftRect.right) / 2 - centerX)
        + Math.abs((leftRect.top + leftRect.bottom) / 2 - centerY);
      const rightDistance = Math.abs((rightRect.left + rightRect.right) / 2 - centerX)
        + Math.abs((rightRect.top + rightRect.bottom) / 2 - centerY);
      return leftDistance - rightDistance;
    });
    return buttons[0] || null;
  }

  function findClosestCard(element) {
    if (!(element instanceof Element)) {
      return null;
    }
    for (const selector of CARD_SELECTORS) {
      const card = element.closest(selector);
      if (card) {
        return card;
      }
    }
    let current = element.parentElement;
    while (current) {
      const rect = current.getBoundingClientRect();
      if (rect.width > 160 && rect.height > 120 && getTextLines(current.innerText).length > 1) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  function getCardCandidates() {
    const now = Date.now();
    if (now - domScanCache.cardCandidates.at < DOM_CACHE_TTL && Array.isArray(domScanCache.cardCandidates.value)) {
      return domScanCache.cardCandidates.value;
    }
    const items = [];
    const seen = new Set();
    CARD_SELECTORS.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        let target = element;
        if (selector === '[href*="/video/"]') {
          target = element.closest('.discover-video-card-item') || element.closest('[class*="videoCard"]') || element;
        }
        if (!(target instanceof HTMLElement)) {
          return;
        }
        const rect = target.getBoundingClientRect();
        if (rect.width < 120 || rect.height < 80) {
          return;
        }
        const quickText = target.textContent || '';
        if (quickText.trim().length < 2) {
          return;
        }
        if (seen.has(target)) {
          return;
        }
        seen.add(target);
        items.push(target);
      });
    });
    domScanCache.cardCandidates.at = now;
    domScanCache.cardCandidates.value = items;
    return items;
  }

  function extractAwemeIdFromText(text) {
    const match = String(text || '').match(/\b(\d{18,20})\b/);
    return match ? match[1] : '';
  }

  function extractAwemeIdFromElement(element) {
    if (!(element instanceof Element)) {
      return '';
    }

    if (element.id && /^\d{18,20}$/.test(element.id)) {
      return element.id;
    }

    const classMatch = `${element.className || ''}`.match(/video_(\d{18,20})/);
    if (classMatch) {
      return classMatch[1];
    }

    const hrefEl = element.querySelector('a[href*="/video/"]');
    if (hrefEl instanceof HTMLAnchorElement) {
      const hrefMatch = hrefEl.href.match(/\/video\/(\d{18,20})/);
      if (hrefMatch) {
        return hrefMatch[1];
      }
    }

    let current = element.parentElement;
    while (current) {
      if (current.id && /^\d{18,20}$/.test(current.id)) {
        return current.id;
      }
      const currentClassMatch = `${current.className || ''}`.match(/video_(\d{18,20})/);
      if (currentClassMatch) {
        return currentClassMatch[1];
      }
      current = current.parentElement;
    }

    const pathMatch = location.pathname.match(/\/video\/(\d{18,20})/);
    if (pathMatch) {
      return pathMatch[1];
    }

    return '';
  }

  function findVideoInElement(element) {
    if (!element) {
      return null;
    }
    if (element instanceof HTMLVideoElement) {
      return element;
    }
    if (!(element instanceof Element)) {
      return null;
    }
    return element.querySelector('video');
  }

  function listRuntimePlayers() {
    const seen = new Set();
    return [
      pageWindow?.player,
      pageWindow?.nextPlayer,
      pageWindow?.playerPreloader?._player,
      pageWindow?.newPlayerPreloader?._player,
    ].filter((player) => {
      if (!player || typeof player !== 'object' || typeof player.getPlugin !== 'function' || seen.has(player)) {
        return false;
      }
      seen.add(player);
      return true;
    });
  }

  function pickCurrentRuntimePlayer() {
    const now = Date.now();
    if (now - domScanCache.runtimePlayer.at < DOM_CACHE_TTL) {
      return domScanCache.runtimePlayer.value || null;
    }
    const primaryVideo = findPrimaryVideo();
    if (primaryVideo) {
      const playersByVideo = listRuntimePlayers().filter((player) => player?.video === primaryVideo);
      if (playersByVideo.length) {
        domScanCache.runtimePlayer.at = now;
        domScanCache.runtimePlayer.value = playersByVideo.find((player) => player?.paused === false)
          || playersByVideo[0];
        return domScanCache.runtimePlayer.value;
      }
    }
    if (pageWindow?.player && typeof pageWindow.player.getPlugin === 'function') {
      domScanCache.runtimePlayer.at = now;
      domScanCache.runtimePlayer.value = pageWindow.player;
      return pageWindow.player;
    }
    const players = listRuntimePlayers();
    domScanCache.runtimePlayer.at = now;
    domScanCache.runtimePlayer.value = players.find((player) => player?.video instanceof HTMLVideoElement && !player.video.paused)
      || players[0]
      || null;
    return domScanCache.runtimePlayer.value;
  }

  function getRuntimeAwemeInfo(player = pickCurrentRuntimePlayer()) {
    return player?.config?.awemeInfo || null;
  }

  function getRuntimeVideo(player = pickCurrentRuntimePlayer()) {
    const video = player?.video;
    if (video instanceof HTMLVideoElement) {
      const rect = video.getBoundingClientRect();
      if (rect.width > 80 && rect.height > 80) {
        return video;
      }
    }
    const primaryVideo = findPrimaryVideo();
    if (primaryVideo instanceof HTMLVideoElement) {
      return primaryVideo;
    }
    return video instanceof HTMLVideoElement ? video : null;
  }

  function getMainWorldBridge() {
    const bridge = pageWindow?.[BRIDGE_KEY];
    return bridge && typeof bridge === 'object' ? bridge : null;
  }

  function normalizeDurationSeconds(value) {
    const duration = Number(value || 0);
    if (!Number.isFinite(duration) || duration <= 0) {
      return 0;
    }
    return Math.round(duration > 1000 ? duration / 1000 : duration);
  }

  function buildMetaFromAwemeInfo(aweme) {
    if (!aweme || typeof aweme !== 'object') {
      return createEmptyMeta();
    }

    const awemeId = String(
      aweme.awemeId
      || aweme.aweme_id
      || aweme.groupId
      || aweme.group_id
      || aweme.id
      || '',
    );
    const rawRoom = aweme.cellRoom?.rawdata || aweme.cellRoom || null;
    const author = normalizeAuthorName(
      aweme.authorInfo?.nickname
      || aweme.author?.nickname
      || aweme.nickname
      || rawRoom?.owner?.nickname
      || '',
    );
    const title = cleanTitleText(
      aweme.itemTitle
      || aweme.item_title
      || aweme.desc
      || aweme.caption
      || aweme.title
      || rawRoom?.title
      || '',
    );
    const duration = normalizeDurationSeconds(
      aweme.video?.duration
      || aweme.duration
      || 0,
    );
    const isLive = Boolean(
      aweme.awemeType === 101
      || aweme.cellRoom?.roomId
      || aweme.cellRoom?.id
      || aweme.cellRoom?.rawdata
      || aweme.liveReason
      || aweme.roomId
      || aweme.room_id,
    );
    const fullText = [author ? `@${author}` : '', title].filter(Boolean).join('\n').trim();

    return createEmptyMeta({
      awemeId,
      author,
      title,
      duration,
      durationText: duration ? formatDuration(duration) : '',
      isLive,
      contentType: isLive ? '直播' : '视频',
      fullText,
      lines: getTextLines(fullText),
    });
  }

  function pickCurrentFeedCard(awemeId, fallbackVideo) {
    const now = Date.now();
    const cacheKey = `${awemeId || ''}|${fallbackVideo ? '1' : '0'}`;
    if (now - domScanCache.feedCard.at < DOM_CACHE_TTL && domScanCache.feedCard.key === cacheKey) {
      return domScanCache.feedCard.value || null;
    }
    const items = Array.from(
      document.querySelectorAll('#sliderVideo, #slider-card, [data-e2e="feed-active-video"], [data-e2e="feed-video"], [data-e2e="feed-live"]'),
    ).filter((element) => element instanceof HTMLElement);

    const unique = Array.from(new Set(items));
    if (unique.length) {
      const result = unique
        .sort((left, right) => {
          const leftRect = left.getBoundingClientRect();
          const rightRect = right.getBoundingClientRect();
          let leftScore = visibleArea(leftRect);
          let rightScore = visibleArea(rightRect);
          if ((left.getAttribute('data-e2e') || '') === 'feed-active-video') {
            leftScore += 300000;
          }
          if ((right.getAttribute('data-e2e') || '') === 'feed-active-video') {
            rightScore += 300000;
          }
          if (awemeId && extractAwemeIdFromElement(left) === awemeId) {
            leftScore += 200000;
          }
          if (awemeId && extractAwemeIdFromElement(right) === awemeId) {
            rightScore += 200000;
          }
          if (fallbackVideo && left.contains(fallbackVideo)) {
            leftScore += 80000;
          }
          if (fallbackVideo && right.contains(fallbackVideo)) {
            rightScore += 80000;
          }
          return rightScore - leftScore;
        })[0];
      domScanCache.feedCard.at = now;
      domScanCache.feedCard.key = cacheKey;
      domScanCache.feedCard.value = result || null;
      return result;
    }

    const result = findClosestCard(fallbackVideo || document.querySelector('#sliderVideo'));
    domScanCache.feedCard.at = now;
    domScanCache.feedCard.key = cacheKey;
    domScanCache.feedCard.value = result || null;
    return result;
  }

  function getReactFiber(element) {
    if (!(element instanceof Element)) {
      return null;
    }
    const key = Object.getOwnPropertyNames(element).find((name) => name.startsWith('__reactFiber$'));
    return key ? element[key] : null;
  }

  function findReactPropValue(element, propName) {
    let fiber = getReactFiber(element);
    while (fiber) {
      const props = fiber.memoizedProps || fiber.pendingProps || null;
      if (props && propName in props) {
        return props[propName];
      }
      fiber = fiber.return;
    }
    return null;
  }

  function pickAwemeLikeObject(input) {
    if (!input || typeof input !== 'object') {
      return null;
    }
    if (input.awemeId || input.aweme_id || input.groupId || input.group_id || input.cellRoom || input.roomId || input.room_id) {
      return input;
    }
    if (input.item && typeof input.item === 'object') {
      return input.item;
    }
    if (input.awemeInfo && typeof input.awemeInfo === 'object') {
      return input.awemeInfo;
    }
    if (input.data && typeof input.data === 'object') {
      return pickAwemeLikeObject(input.data);
    }
    return null;
  }

  function extractReactCardMeta(element) {
    if (!(element instanceof HTMLElement)) {
      return null;
    }
    const cached = reactMetaCache.get(element);
    const now = Date.now();
    if (cached && now - cached.at < META_CACHE_TTL) {
      return cached.value;
    }
    const candidate = pickAwemeLikeObject(
      findReactPropValue(element, 'item')
      || findReactPropValue(element, 'awemeInfo')
      || findReactPropValue(element, 'data'),
    );
    if (!candidate) {
      reactMetaCache.set(element, { at: now, value: null });
      return null;
    }
    const meta = buildMetaFromAwemeInfo(candidate);
    const isReplacedLive = candidate.__is_replaced_live__ === '1' || candidate.__is_replaced_live__ === 1 || candidate.__is_replaced_live__ === true;
    if (isReplacedLive || candidate.awemeType === 101) {
      meta.isLive = true;
      meta.contentType = '直播';
    }
    reactMetaCache.set(element, { at: now, value: meta });
    return meta;
  }

  function isLivePage() {
    return /^live\.douyin\.com$/i.test(location.hostname) || /^\/live(?:\/|$)/.test(location.pathname);
  }

  function normalizeAuthorName(input) {
    return String(input || '').replace(/^@+/, '').trim();
  }

  function cleanNodeText(node, removeSelectors = []) {
    if (!(node instanceof Element)) {
      return '';
    }
    const clone = node.cloneNode(true);
    removeSelectors.forEach((selector) => {
      clone.querySelectorAll(selector).forEach((child) => child.remove());
    });
    return getTextLines(clone.textContent || '').join(' ');
  }

  function cleanTitleText(input) {
    return String(input || '')
      .replace(/\s+/g, ' ')
      .replace(/(?:展开|收起)\s*$/g, '')
      .trim();
  }

  function isMetaNoiseLine(input) {
    const line = String(input || '').replace(/\s+/g, ' ').trim();
    if (!line || line === '/' || line === '共创') {
      return true;
    }
    if (line.startsWith('@')) {
      return true;
    }
    if (DATE_LINE_RE.test(line)) {
      return true;
    }
    if (/^\d{1,2}:\d{2}\s*\/\s*\d{1,2}:\d{2}$/.test(line)) {
      return true;
    }
    if (DURATION_RE.test(line) && line.length <= 16) {
      return true;
    }
    if (VIEW_COUNT_RE.test(line) || /^(?:\d+(?:\.\d+)?[万亿]?|直播中|正在直播)$/.test(line)) {
      return true;
    }
    return /^(?:发送|展开|收起|倍速|智能|清屏|连播|听抖音|登录后可发布弹幕|登录即享|当前播放|下一条|发弹幕|弹幕|画质|高清(?:1080P|720P)?|超清(?:4K|2K)?|标清(?:540P)?|免下载立即玩|进入直播间|点击或按|直播加载中)$/.test(
      line,
    );
  }

  function scoreTitleCandidate(input) {
    const line = cleanTitleText(input);
    let score = Math.min(line.length, 80);
    if (/[#＃]/.test(line)) {
      score += 18;
    }
    if (/[\u4e00-\u9fa5]/.test(line)) {
      score += 12;
    }
    if (/[，。！？!?]/.test(line)) {
      score += 10;
    }
    if (/免下载立即玩|小游戏|原声|听抖音|倍速|智能|清屏|连播/.test(line)) {
      score -= 40;
    }
    return score;
  }

  function pickTitleCandidate(lines) {
    return lines
      .filter((line) => !isMetaNoiseLine(line))
      .sort((left, right) => scoreTitleCandidate(right) - scoreTitleCandidate(left))[0] || '';
  }

  function createEmptyMeta(overrides = {}) {
    return {
      awemeId: '',
      author: '',
      title: '',
      duration: 0,
      durationText: '',
      isLive: false,
      contentType: '',
      isAd: false,
      fullText: '',
      lines: [],
      ...overrides,
    };
  }

  function extractInfoRootMeta(infoRoot, fallbackAwemeId = '', fullTextSource = '') {
    if (!(infoRoot instanceof HTMLElement) || !isElementVisible(infoRoot)) {
      return null;
    }

    const author = normalizeAuthorName(infoRoot.querySelector('.account-name-text')?.textContent || '');
    const title = cleanTitleText(
      cleanNodeText(infoRoot.querySelector('.title'), ['button', '.GGLE7S6i', '.mJX0Fx0h', '[role="button"]']),
    );
    if (!author && !title) {
      return null;
    }

    const timeText = cleanNodeText(infoRoot.querySelector('.video-create-time'));
    const fullText = [author ? `@${author}` : '', timeText, title, String(fullTextSource || '').trim()]
      .filter(Boolean)
      .join('\n')
      .trim();
    const isLive = isLivePage() || LIVE_TEXT_RE.test(fullText);

    return createEmptyMeta({
      awemeId: fallbackAwemeId || extractAwemeIdFromElement(infoRoot),
      author,
      title,
      isLive,
      contentType: isLive ? '直播' : '视频',
      isAd: /(广告|赞助|推广|小程序|商品|电商|橱窗|店铺)/i.test(fullText),
      fullText,
      lines: getTextLines(fullText),
    });
  }

  function getOptionByKey(items, key) {
    return items.find((item) => item.key === key) || null;
  }

  function matchesUiOption(element, option) {
    if (!(element instanceof HTMLElement) || !option) {
      return false;
    }
    const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
    const href = element instanceof HTMLAnchorElement ? element.href : element.getAttribute('href') || '';
    if (option.text && option.text.test(text)) {
      return true;
    }
    if (option.href && option.href.test(href)) {
      return true;
    }
    return false;
  }

  function getCompactText(element) {
    return String(element?.innerText || element?.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function uniqueElements(elements) {
    return Array.from(
      new Set(elements.filter((element) => element instanceof HTMLElement)),
    );
  }

  function resolveSideTabTarget(element) {
    if (!(element instanceof HTMLElement)) {
      return null;
    }
    return element.closest('.qmhaloYp')
      || element.closest('[class*="tab-"]')
      || element.closest('a[href]')
      || element;
  }

  function findSideTabTargets(option) {
    const root = document.querySelector('#douyin-navigation');
    if (!(root instanceof HTMLElement) || !option) {
      return [];
    }
    const targets = [];

    if (option.href) {
      root.querySelectorAll('a[href]').forEach((element) => {
        if (!(element instanceof HTMLAnchorElement) || element.closest(`#${APP_ID}-root`)) {
          return;
        }
        if (!option.href.test(element.href || '')) {
          return;
        }
        const target = resolveSideTabTarget(element);
        if (target instanceof HTMLElement) {
          targets.push(target);
        }
      });
    }

    if (!targets.length && option.text) {
      root.querySelectorAll('[class*="tab-"], .qmhaloYp, a[href]').forEach((element) => {
        if (!(element instanceof HTMLElement) || element.closest(`#${APP_ID}-root`)) {
          return;
        }
        if (!option.text.test(getCompactText(element))) {
          return;
        }
        const target = resolveSideTabTarget(element);
        if (target instanceof HTMLElement) {
          targets.push(target);
        }
      });
    }

    // 兜底：按文本内容在导航栏内广搜（用于"下载抖音精选"等非标准结构）
    if (!targets.length && option.text) {
      const candidates = [];
      root.querySelectorAll('div[class], span[class]').forEach((element) => {
        if (!(element instanceof HTMLElement) || element.closest(`#${APP_ID}-root`)) {
          return;
        }
        if (!option.text.test(getCompactText(element))) {
          return;
        }
        candidates.push(element);
      });
      // 只保留最外层（过滤掉祖先已在列表中的元素）
      candidates.forEach((el) => {
        const isNested = candidates.some((other) => other !== el && other.contains(el));
        if (!isNested) targets.push(el);
      });
    }

    return uniqueElements(targets);
  }

  function matchesTopBarChild(option, element) {
    if (!(element instanceof HTMLElement) || !option) {
      return false;
    }
    const text = getCompactText(element);
    if (!text) {
      return false;
    }
    switch (option.key) {
      case 'recharge':
        return text.startsWith('充钻石') || text.startsWith('充值');
      case 'client':
        return text.startsWith('客户端');
      case 'wallpaper':
        return text.startsWith('壁纸');
      case 'notice':
        return text.startsWith('通知');
      case 'message':
        return text.startsWith('私信') || text.startsWith('消息');
      case 'upload':
        return text.startsWith('投稿') || text.startsWith('发布');
      case 'login':
        return text.startsWith('登录');
      default:
        return option.text ? option.text.test(text) : false;
    }
  }

  function resolveTopBarSearchTarget() {
    const button = document.querySelector('#douyin-header button[data-e2e="searchbar-button"]');
    if (!(button instanceof HTMLElement)) {
      return null;
    }
    return button.closest('.zzJ4Uxm_')
      || button.closest('.n1AoRJvo')
      || button.closest('.niTxyqq5')
      || button;
  }

  function findTopBarTargets(option) {
    const header = document.querySelector('#douyin-header');
    if (!(header instanceof HTMLElement) || !option) {
      return [];
    }
    if (option.key === 'search') {
      const target = resolveTopBarSearchTarget();
      return target ? [target] : [];
    }

    const targets = [];
    const menuRoot = header.querySelector('#douyin-header-menuCt .eJhYZuIF')
      || header.querySelector('#douyin-header-menuCt');
    if (menuRoot instanceof HTMLElement) {
      Array.from(menuRoot.children).forEach((element) => {
        if (!matchesTopBarChild(option, element)) {
          return;
        }
        targets.push(element);
      });
    }

    if (!targets.length) {
      header.querySelectorAll('a[href], button, [role="button"]').forEach((element) => {
        if (!(element instanceof HTMLElement) || element.closest(`#${APP_ID}-root`)) {
          return;
        }
        if (!matchesUiOption(element, option)) {
          return;
        }
        const target = element.closest('#douyin-header-menuCt > *')
          || element.closest('#douyin-header-menuCt .eJhYZuIF > *')
          || element;
        if (target instanceof HTMLElement) {
          targets.push(target);
        }
      });
    }

    return uniqueElements(targets);
  }

  function findInteractionBarTargets(option) {
    if (option?.selector) {
      const popupTargets = [];
      document.querySelectorAll(option.selector).forEach((el) => {
        if (!(el instanceof HTMLElement) || el.closest(`#${APP_ID}-root`)) {
          return;
        }
        const target = el.closest('.nLp9LocF')
          || el.closest('[data-e2e="feed-live"]')
          || el.closest('[data-e2e="live-slider"]')
          || el.parentElement
          || el;
        if (target instanceof HTMLElement) {
          popupTargets.push(target);
        }
      });
      return uniqueElements(popupTargets);
    }
    const targets = [];
    // 优先用 data-e2e 属性定位
    if (option.dataE2e) {
      document.querySelectorAll(`[data-e2e="${option.dataE2e}"]`).forEach((el) => {
        if (el instanceof HTMLElement && !el.closest(`#${APP_ID}-root`)) {
          // 头像需要隐藏整个容器（包含关注加号按钮）
          const target = option.useParent && el.parentElement ? el.parentElement : el;
          targets.push(target);
        }
      });
    }
    // 通过内部特征 class 定位（问问AI / 听抖音等无 data-e2e 的控件）
    if (!targets.length && option.containerClass) {
      document.querySelectorAll(`.${option.containerClass}`).forEach((el) => {
        if (!(el instanceof HTMLElement) || el.closest(`#${APP_ID}-root`)) return;
        // 向上找到带 data-popupid 的容器（AI 按钮），或互动栏的直接子元素
        const popup = el.closest('[data-popupid]');
        if (popup) {
          targets.push(popup);
        } else {
          // 向上找到互动栏容器的直接子元素，避免误匹配页面其他区域
          const barParent = el.closest('.zqe4B9aR');
          if (barParent) {
            let cur = el;
            while (cur && cur.parentElement !== barParent) cur = cur.parentElement;
            if (cur) targets.push(cur);
          } else {
            // 没有互动栏父级，直接用元素本身（仅限尺寸合理的小控件）
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.width < 200 && rect.height > 0 && rect.height < 200) {
              targets.push(el);
            }
          }
        }
      });
    }
    // 兜底：文本匹配（听抖音）— 必须在互动栏容器内才算
    if (!targets.length && option.text) {
      document.querySelectorAll('[class]').forEach((el) => {
        if (!(el instanceof HTMLElement) || el.closest(`#${APP_ID}-root`)) return;
        if (option.text.test((el.innerText || '').trim()) && el.children.length <= 3) {
          // 必须在互动栏容器内，否则可能误匹配到页面大容器
          const barParent = el.closest('.zqe4B9aR');
          if (barParent) {
            let cur = el;
            while (cur && cur.parentElement !== barParent) {
              cur = cur.parentElement;
            }
            if (cur) {
              targets.push(cur);
            }
          }
        }
      });
    }
    return targets;
  }

  function findScrollableAncestor(element) {
    let current = element instanceof HTMLElement ? element : null;
    while (current) {
      const style = getComputedStyle(current);
      if (/(auto|scroll)/.test(style.overflowY) && current.scrollHeight > current.clientHeight + 24) {
        return current;
      }
      current = current.parentElement;
    }
    return document.scrollingElement || document.documentElement;
  }

  function inferContentType(input) {
    const text = String(input || '').replace(/\s+/g, '');
    if (!text) {
      return '';
    }
    if (/直播中|正在直播|直播回放|进入直播间|点击或按F进入直播间/.test(text)) {
      return '直播';
    }
    if (/听抖音|视频|精选|推荐|放映厅|短剧|搜索/i.test(text)) {
      return '视频';
    }
    return '';
  }

  function getContentTypeKey(meta = null) {
    if (!meta || typeof meta !== 'object') {
      return '';
    }
    if (meta.isLive) {
      return 'live';
    }
    const inferred = inferContentType(meta.contentType || meta.title || meta.fullText || '');
    if (inferred === '直播') {
      return 'live';
    }
    if (inferred === '视频') {
      return 'video';
    }
    return meta.duration > 0 ? 'video' : '';
  }

  function isLiveCard(element) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }
    if (element.getAttribute('data-e2e') === 'feed-live') {
      return true;
    }
    if (element.querySelector('[data-e2e="feed-live"], [data-e2e="live-slider"], .LivePlayer_Preview, .LiveLinkA')) {
      return true;
    }
    if (/\bLivePlayer\b|\bLiveLinkA\b/.test(element.className || '')) {
      return true;
    }
    // 有"直播中"标签的 semi-tag 组件（有概率误判，但覆盖率更高）
    const liveTag = element.querySelector('.semi-tag[aria-label*="直播"], .semi-tag-content');
    if (liveTag && /直播中|正在直播/.test(liveTag.textContent || '')) {
      return true;
    }
    const text = (element.innerText || element.textContent || '').replace(/\s+/g, '');
    if (/进入直播间|点击或按F进入直播间/.test(text)) {
      return true;
    }
    return false;
  }

  function extractCardMeta(element) {
    if (!(element instanceof HTMLElement)) {
      return createEmptyMeta();
    }
    const now = Date.now();
    const cached = cardMetaCache.get(element);
    if (cached && now - cached.at < META_CACHE_TTL) {
      return cached.value;
    }
    const text = String(element?.innerText || '').trim();
    const lines = getTextLines(text);
    const durationMatch = text.match(DURATION_RE);
    const awemeId = extractAwemeIdFromElement(element);
    const infoMeta = extractInfoRootMeta(element?.querySelector?.('#video-info-wrap') || null, awemeId, text);
    const authorLine = lines.find((line) => line.startsWith('@')) || '';
    const author = infoMeta?.author || normalizeAuthorName(authorLine);
    const duration = durationMatch ? parseDuration(durationMatch[0]) : 0;
    const title = infoMeta?.title || cleanTitleText(pickTitleCandidate(lines));
    const isLive = infoMeta?.isLive || isLivePage() || isLiveCard(element) || LIVE_TEXT_RE.test(text);

    const meta = createEmptyMeta({
      awemeId: infoMeta?.awemeId || awemeId,
      author,
      title,
      duration,
      durationText: duration ? formatDuration(duration) : '',
      isLive,
      contentType: isLive ? '直播' : '视频',
      isAd: /(广告|赞助|推广|小程序|商品|电商|橱窗|店铺)/i.test(text),
      fullText: text,
      lines,
    });
    cardMetaCache.set(element, { at: now, value: meta });
    return meta;
  }

  class Toast {
    constructor() {
      this.root = null;
      this.timer = 0;
    }

    mount() {
      if (this.root) {
        return;
      }
      this.root = document.createElement('div');
      this.root.id = `${APP_ID}-toast`;
      document.documentElement.appendChild(this.root);
    }

    show(message, type = 'info', timeout = 2200) {
      this.mount();
      this.root.textContent = message;
      this.root.dataset.type = type;
      this.root.classList.add('show');
      window.clearTimeout(this.timer);
      this.timer = window.setTimeout(() => {
        if (this.root) {
          this.root.classList.remove('show');
        }
      }, timeout);
    }
  }

  class MediaCollector {
    constructor() {
      this.awemeInfo = new Map();
    }

    start() { }

    updateAwemeMeta(meta) {
      const awemeId = String(meta?.awemeId || '');
      if (!awemeId) {
        return;
      }
      const previous = this.awemeInfo.get(awemeId) || {};
      this.awemeInfo.set(awemeId, {
        awemeId,
        author: String(meta?.author || previous.author || ''),
        title: cleanTitleText(String(meta?.title || previous.title || '')),
        time: Date.now(),
      });
    }

    getAwemeMeta(awemeId) {
      return this.awemeInfo.get(String(awemeId || '')) || null;
    }

    push() { }
  }

  class DouYinPlusApp {
    constructor() {
      this.config = loadConfig();
      this.toast = new Toast();
      this.collector = new MediaCollector();
      this.state = {
        routeKind: currentPathKind(),
        widgetsOpen: false,
        settingsOpen: false,
        activeTab: 'settings',
        currentVideo: null,
        currentCard: null,
        currentMeta: createEmptyMeta(),
        refreshTimer: 0,
        lastPath: location.href,
        hideReasons: new WeakMap(),
        currentQuickHost: null,
        manualLoginMode: false,
        nativeSpeedMenuOpen: false,
        _isRefreshing: false,
        _lastRefreshAt: 0,
        speedBoost: {
          active: false,
          keys: new Set(),
          originalRate: 1,
          targetRate: 1,
          _holdTimer: null,
        },
        stall: {
          lastVideoTime: 0,
          lastBufferedEnd: 0,
          lastProgressAt: 0,
          currentSrc: '',
          awemeId: '',
          skipTriggeredAt: 0,
          consecutiveStallCount: 0,
        },
        lastAutoNextAt: 0,
      };
      this.ui = {
        root: null,
        sidebar: null,
        panel: null,
        panelPopup: null,
        quick: null,
        nativeSpeedMenu: null,
      };
      this.vueApp = null;
      this.videoCleanup = null;
      this.observer = null;
      this.rateEnforcer = 0;
      this.unlockTimer = 0;
      this.stallTimer = 0;
      this._runtimeBootstrapped = false;
      this._layoutCleanupAt = 0;
      this._rateSyncLockUntil = 0;
      this._initLookupLogged = new Set();
    }

    init() {
      this.injectMainWorldBridge();
      this.injectEarlyStyles();
      this.collector.start();
      this.inspectInitTargets('init');
      this.bootstrapRuntime();
      ready(() => {
        this.injectStyles();
        this.registerBeComponents();
        this.mountUi();
        this.registerMenuCommands();
        this.inspectInitTargets('ready');
        window.setTimeout(() => this.inspectInitTargets('ready+1500ms'), 1500);
        this.refreshAll('init');
        this.rateEnforcer = window.setInterval(() => this.enforcePlaybackRate(), 900);
        this.stallTimer = window.setInterval(() => this.checkPlaybackStall(), 900);
      });
    }

    bootstrapRuntime() {
      if (this._runtimeBootstrapped) {
        return;
      }
      this._runtimeBootstrapped = true;
      this.installObservers();
      this.installHistoryHooks();
      this.installHotkeys();
      this.installLoginIntentTracker();
      this.runUnlock();
      this.inspectInitTargets('bootstrap');
        this.unlockTimer = window.setInterval(() => {
          if (document.hidden || !this.config.enableUnlock) return;
          this.runUnlock();
        }, 250);
      this.scheduleRefresh('bootstrap', 0);
    }

    logInitLookup(name, found, reason, extra = '') {
      const key = `${reason}:${name}:${found ? '1' : '0'}`;
      if (this._initLookupLogged.has(key)) {
        return;
      }
      this._initLookupLogged.add(key);
      const text = `[${APP_NAME}] 初始化寻找对象 ${name} ${found ? '找到了' : '没找到'}${extra ? ` ${extra}` : ''}`;
      if (found) {
        console.info(text);
      } else {
        console.warn(text);
      }
    }

    inspectInitTargets(reason = 'init') {
      try {
        const bridge = getMainWorldBridge();
        this.logInitLookup('主世界桥', Boolean(bridge), reason, bridge ? `(version=${bridge.version || 'unknown'})` : '');

        const player = this.getCurrentRuntimePlayer();
        this.logInitLookup('当前播放器', Boolean(player), reason, player ? `(plugins=${typeof player.getPlugin === 'function' ? 'yes' : 'no'})` : '');

        const video = getRuntimeVideo(player) || this.state.currentVideo || findPrimaryVideo();
        this.logInitLookup('当前视频元素', video instanceof HTMLVideoElement, reason, video instanceof HTMLVideoElement ? `(rate=${video.playbackRate || 1})` : '');

        const speedTrigger = document.querySelector('.xgplayer-setting-playbackRatio, .xgplayer-playback-setting');
        this.logInitLookup('倍速按钮', speedTrigger instanceof HTMLElement, reason);

        const playbackPlugin = player?.getPlugin?.('PlayBackSettingPlugin');
        this.logInitLookup('倍速插件 PlayBackSettingPlugin', Boolean(playbackPlugin), reason);

        const clarityPlugin = player?.getPlugin?.('playclaritysettingplugin') || player?.getPlugin?.('PlayClaritySettingPlugin');
        this.logInitLookup('画质插件 PlayClaritySettingPlugin', Boolean(clarityPlugin), reason);

        const infoWrap = document.querySelector('#video-info-wrap');
        this.logInitLookup('视频信息容器 #video-info-wrap', infoWrap instanceof HTMLElement, reason);
      } catch (error) {
        console.warn(`[${APP_NAME}] 初始化寻找对象日志异常`, error);
      }
    }

    injectEarlyStyles() {
      gm.addStyle(`
.${APP_ID}-hidden-login { display:none!important; opacity:0!important; pointer-events:none!important; }
.${APP_ID}-hidden-ui { display:none!important; }
      `);
    }

    injectMainWorldBridge() {
      if (getMainWorldBridge()) {
        return;
      }
      const script = document.createElement('script');
      script.textContent = `
(() => {
  const key = ${JSON.stringify(BRIDGE_KEY)};
  if (window[key] && window[key].version >= 2) {
    return;
  }

  // 拦截登录弹窗对 keydown 事件的 stopPropagation
  // 抖音登录弹窗 React 组件 useEffect 中注册了：
  //   document.addEventListener("keydown", e => { e.stopPropagation() }, true)
  // 弹窗被 CSS 隐藏后组件仍挂载，listener 一直吃掉所有 keydown 事件
  // 方案：hook Event.prototype.stopPropagation，在 keydown 事件上，
  //       如果登录弹窗不可见（被我们隐藏或本来就没显示），就阻止 stopPropagation 生效
  //       如果用户手动点击登录（manualLoginMode），则不拦截，让正常登录流程走完
  const origStopPropagation = Event.prototype.stopPropagation;
  Event.prototype.stopPropagation = function() {
    if (this.type === 'keydown' && !this.__dypAllowStop) {
      // 检查是否是登录弹窗的 capture-phase keydown 拦截
      // 只在登录弹窗不可见时才阻止 stopPropagation
      const dialog = document.querySelector('#douyin-login-new-id, .douyin_login_new_class');
      const isDialogVisible = dialog && dialog.offsetWidth > 0 && dialog.offsetHeight > 0
        && !dialog.classList.contains('${APP_ID}-hidden-login');
      // 如果用户手动登录中，不拦截
      const bridge = window[key];
      const isManualLogin = bridge && bridge._manualLoginMode;
      if (!isDialogVisible && !isManualLogin) {
        // 登录弹窗不可见，阻止 stopPropagation 生效，让快捷键正常传播
        return;
      }
    }
    return origStopPropagation.call(this);
  };

  const isVisibleElement = (element) => {
    if (!(element instanceof HTMLElement)) {
      return false;
    }
    const rect = element.getBoundingClientRect();
    if (rect.width <= 8 || rect.height <= 8) {
      return false;
    }
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) !== 0;
  };

  const findPrimaryVisibleVideo = () => {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const videos = Array.from(document.querySelectorAll('video')).filter((video) => {
      if (!(video instanceof HTMLVideoElement)) {
        return false;
      }
      const rect = video.getBoundingClientRect();
      return rect.width > 80 && rect.height > 80 && isVisibleElement(video);
    });
    if (!videos.length) {
      return null;
    }
    videos.sort((left, right) => {
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      const leftCoversCenter = leftRect.left <= centerX && leftRect.right >= centerX
        && leftRect.top <= centerY && leftRect.bottom >= centerY;
      const rightCoversCenter = rightRect.left <= centerX && rightRect.right >= centerX
        && rightRect.top <= centerY && rightRect.bottom >= centerY;
      let leftScore = Math.max(0, Math.min(leftRect.right, window.innerWidth) - Math.max(leftRect.left, 0))
        * Math.max(0, Math.min(leftRect.bottom, window.innerHeight) - Math.max(leftRect.top, 0));
      let rightScore = Math.max(0, Math.min(rightRect.right, window.innerWidth) - Math.max(rightRect.left, 0))
        * Math.max(0, Math.min(rightRect.bottom, window.innerHeight) - Math.max(rightRect.top, 0));
      if (leftCoversCenter) leftScore += 500000;
      if (rightCoversCenter) rightScore += 500000;
      if (!left.paused) leftScore += 100000;
      if (!right.paused) rightScore += 100000;
      return rightScore - leftScore;
    });
    return videos[0] || null;
  };

  const listPlayers = () => {
    const seen = new Set();
    return [
      window.player,
      window.nextPlayer,
      window.playerPreloader?._player,
      window.newPlayerPreloader?._player,
    ].filter((player) => {
      if (!player || typeof player !== 'object' || typeof player.getPlugin !== 'function' || seen.has(player)) {
        return false;
      }
      seen.add(player);
      return true;
    });
  };

  const pickPlayer = () => {
    const primaryVideo = findPrimaryVisibleVideo();
    if (primaryVideo) {
      const playersByVideo = listPlayers().filter((player) => player?.video === primaryVideo);
      if (playersByVideo.length) {
        return playersByVideo.find((player) => player?.paused === false)
          || playersByVideo[0];
      }
    }
    if (window.player && typeof window.player.getPlugin === 'function') {
      return window.player;
    }
    const players = listPlayers();
    return players.find((player) => player?.video instanceof HTMLVideoElement && !player.video.paused)
      || players[0]
      || null;
  };

  const getFiber = (element) => {
    if (!(element instanceof Element)) {
      return null;
    }
    const fiberKey = Object.getOwnPropertyNames(element).find((name) => name.startsWith('__reactFiber$'));
    return fiberKey ? element[fiberKey] : null;
  };

  const findProp = (element, propName) => {
    let fiber = getFiber(element);
    while (fiber) {
      const props = fiber.memoizedProps || fiber.pendingProps || null;
      if (props && propName in props) {
        return props[propName];
      }
      fiber = fiber.return;
    }
    return null;
  };

  window[key] = {
    version: 2,
    getCurrentSnapshot() {
      const player = pickPlayer();
      const primaryVideo = findPrimaryVisibleVideo();
      const video = primaryVideo || (player?.video instanceof HTMLVideoElement ? player.video : null);
      const awemeInfo = player?.config?.awemeInfo || null;
      return {
        awemeInfo,
        currentSrc: video?.currentSrc || video?.src || '',
        playbackRate: video?.playbackRate || 1,
      };
    },
    invokeNext() {
      const button = (() => {
        const video = findPrimaryVisibleVideo();
        const playerRoot = video?.closest?.('.xgplayer');
        if (playerRoot instanceof HTMLElement) {
          const localButton = playerRoot.querySelector('.recommend-out-switch-btn, .xgplayer-playswitch');
          if (localButton instanceof HTMLElement && isVisibleElement(localButton)) {
            return localButton;
          }
        }
        return Array.from(document.querySelectorAll('.recommend-out-switch-btn, .xgplayer-playswitch'))
          .find((element) => element instanceof HTMLElement && isVisibleElement(element)) || null;
      })();
      const handler = button ? findProp(button, 'playNextFunc') : null;
      if (typeof handler === 'function') {
        handler();
        return true;
      }
      return false;
    },
    invokePrev() {
      const button = (() => {
        const video = findPrimaryVisibleVideo();
        const playerRoot = video?.closest?.('.xgplayer');
        if (playerRoot instanceof HTMLElement) {
          const localButton = playerRoot.querySelector('.recommend-out-switch-btn, .xgplayer-playswitch');
          if (localButton instanceof HTMLElement && isVisibleElement(localButton)) {
            return localButton;
          }
        }
        return Array.from(document.querySelectorAll('.recommend-out-switch-btn, .xgplayer-playswitch'))
          .find((element) => element instanceof HTMLElement && isVisibleElement(element)) || null;
      })();
      const handler = button ? findProp(button, 'playPrevFunc') : null;
      if (typeof handler === 'function') {
        handler();
        return true;
      }
      return false;
    },
    setPlaybackRate(rate) {
      const player = pickPlayer();
      const value = Number(rate);
      if (!player || !Number.isFinite(value) || value <= 0) {
        return false;
      }
      // 移除抖音对 >3x 倍速的强制重置回调
      if (value > 3 && player._events && Array.isArray(player._events['ratechange'])) {
        player._events['ratechange'] = player._events['ratechange'].filter((h) => {
          const s = typeof h.fn === 'function' ? h.fn.toString() : '';
          return !s.includes('>3');
        });
      }
      player._rate = value;
      const video = player.video instanceof HTMLVideoElement ? player.video : null;
      if (video) {
        video.defaultPlaybackRate = value;
        video.playbackRate = value;
      }
      if (typeof player.emit === 'function') {
        try {
          player.emit('UpdateRadio', { rate: value, click_method: 'douyinplus' });
        } catch (error) {}
      }
      return true;
    },
    openNativeSpeedPanel() {
      const player = pickPlayer();
      const plugin = player?.getPlugin?.('playbacksettingplugin');
      if (plugin && typeof plugin.onMouseenter === 'function') {
        plugin.onMouseenter();
        const slider = plugin.root?.querySelector?.('.xgplayer-slider');
        const content = slider?.querySelector?.('.xgplayer-setting-content');
        if (slider) { slider.removeAttribute('style'); }
        if (content) { content.removeAttribute('style'); }
        return true;
      }
      const trigger = document.querySelector('.xgplayer-setting-playbackRatio, .xgplayer-playback-setting');
      if (!(trigger instanceof HTMLElement)) {
        return false;
      }
      trigger.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      trigger.click();
      return true;
    },
    removeFeedItems(awemeIds) {
      if (!Array.isArray(awemeIds) || !awemeIds.length) {
        return { removed: 0 };
      }
      const idSet = new Set(awemeIds.map(String));
      const sliderEl = document.querySelector('#sliderVideo');
      if (!sliderEl) {
        return { removed: 0, error: 'no slider' };
      }
      const fiberKey = Object.getOwnPropertyNames(sliderEl).find((n) => n.startsWith('__reactFiber$'));
      if (!fiberKey) {
        return { removed: 0, error: 'no fiber' };
      }
      let fiber = sliderEl[fiberKey];
      let swiperObj = null;
      let feedList = null;
      let feedDispatch = null;
      let depth = 0;
      while (fiber && depth < 50) {
        if (fiber.memoizedState) {
          let hook = fiber.memoizedState;
          while (hook) {
            const val = hook.memoizedState;
            if (val && typeof val === 'object' && !Array.isArray(val)
                && typeof val.slideTo === 'function' && Array.isArray(val.slides) && Array.isArray(val.data)) {
              swiperObj = val;
            }
            if (Array.isArray(val) && val.length > 0 && val[0] && val[0].awemeId && hook.queue && typeof hook.queue.dispatch === 'function') {
              feedList = val;
              feedDispatch = hook.queue.dispatch;
            }
            hook = hook.next;
          }
        }
        fiber = fiber.return;
        depth++;
      }
      if (!feedList || !feedDispatch) {
        return { removed: 0, error: 'no feed state' };
      }
      const activeIndex = swiperObj ? swiperObj.activeIndex : -1;
      const activeId = activeIndex >= 0 && activeIndex < feedList.length ? String(feedList[activeIndex].awemeId) : '';
      const toRemove = new Set();
      feedList.forEach((item, idx) => {
        if (idSet.has(String(item.awemeId)) && String(item.awemeId) !== activeId) {
          toRemove.add(idx);
        }
      });
      if (!toRemove.size) {
        return { removed: 0 };
      }
      const newList = feedList.filter((_, idx) => !toRemove.has(idx));
      if (swiperObj) {
        const removedBefore = [...toRemove].filter((idx) => idx < activeIndex).length;
        swiperObj.data = newList;
        swiperObj.slides = swiperObj.slides.filter((_, idx) => !toRemove.has(idx));
        if (removedBefore > 0) {
          swiperObj.activeIndex = Math.max(0, activeIndex - removedBefore);
        }
        if (typeof swiperObj.update === 'function') {
          swiperObj.update();
        }
      }
      feedDispatch(newList);
      return { removed: toRemove.size, remaining: newList.length };
    },
    switchClarity(gearName) {
      const player = pickPlayer();
      if (!player || !player.definitionList) {
        return false;
      }
      const target = player.definitionList.find((d) => d.gearName === gearName);
      if (!target || !target.url) {
        return false;
      }
      try {
        player.changeDefinition(target);
        return true;
      } catch (error) {
        return false;
      }
    },
    getClarityList() {
      const player = pickPlayer();
      if (!player || !player.definitionList) {
        return null;
      }
      return player.definitionList.map((d) => ({
        gearName: d.gearName,
        definition: d.definition,
        qualityType: d.qualityType,
        width: d.width,
        height: d.height,
      }));
    },
    applyPreferredClarity(maxHeight) {
      const player = pickPlayer();
      if (!player || !player.definitionList || !maxHeight) return false;
      const list = player.definitionList;
      // 过滤：要有有效 URL，且跳过自适应码率档位（definition === -1 或 gearName 含 adapt）
      const validList = list.filter((d) => {
        if (!d.url || (Array.isArray(d.url) ? d.url.length === 0 : String(d.url).length < 10)) return false;
        if (d.definition === -1 || /adapt/i.test(d.gearName || '')) return false;
        return true;
      });
      if (!validList.length) return false;
      const getQuality = (d) => Math.min(d.width || Infinity, d.height || Infinity);
      const sorted = [...validList].sort((a, b) => getQuality(b) - getQuality(a));
      const target = sorted.find((d) => getQuality(d) <= maxHeight);
      if (!target) return false;
      const video = player.video;
      const currentQ = video ? Math.min(video.videoWidth || 0, video.videoHeight || 0) : 0;
      if (Math.abs(currentQ - getQuality(target)) < 10) return false;
      try {
        player.changeDefinition(target);
        return true;
      } catch (e) { return false; }
    },
    // 通过 React fiber 找到登录弹窗的关闭回调并调用
    // 比 CSS 隐藏好：React 组件会正常卸载，useEffect cleanup 会执行，
    // 从而移除 keydown stopPropagation listener 和 videoStopPlayNext
    dismissLoginPanel() {
      const selectors = ['#login-panel-new', '#douyin-login-new-id', '.douyin_login_new_class'];
      let panel = null;
      for (const sel of selectors) {
        panel = document.querySelector(sel);
        if (panel) break;
      }
      if (!panel) return false;
      // 如果弹窗不可见（已经被隐藏或尺寸为0），不需要再关闭
      if (panel.offsetWidth === 0 && panel.offsetHeight === 0) return false;
      const fiberKey = Object.getOwnPropertyNames(panel).find(n => n.startsWith('__reactFiber$'));
      if (!fiberKey) return false;
      let fiber = panel[fiberKey];
      let depth = 0;
      while (fiber && depth < 30) {
        const props = fiber.memoizedProps || fiber.pendingProps;
        if (props && typeof props.destroy === 'function') {
          try { props.destroy(); return true; } catch(e) {}
        }
        fiber = fiber.return;
        depth++;
      }
      // fallback: 尝试找 onClose / closeDialog
      fiber = panel[fiberKey];
      depth = 0;
      while (fiber && depth < 30) {
        const props = fiber.memoizedProps || fiber.pendingProps;
        if (props && typeof props.onClose === 'function') {
          try { props.onClose(); return true; } catch(e) {}
        }
        fiber = fiber.return;
        depth++;
      }
      return false;
    },
    _manualLoginMode: false, // 用户手动点击登录时设为 true，不拦截登录弹窗的 keydown
  };
})();
      `;
      (document.documentElement || document.head || document.body).appendChild(script);
      script.remove();
    }

    // ── 注册 Bilibili-Evolved Vue 组件 ─────────────────────────────
    // 来源: https://github.com/the1812/Bilibili-Evolved (MIT License)
    // 作者: the1812 (https://github.com/the1812)
    // 以下组件代码直接来自 BE 源码，仅做最小适配（去 TypeScript 类型标注）
    // ─────────────────────────────────────────────────────────────────
    registerBeComponents() {
      if (typeof Vue === 'undefined') {
        console.error('[DouYinPlus] Vue 未加载，无法注册 BE 组件');
        return;
      }

      // ── v-hit 指令 ── BE 自定义指令，绑定 click + keyboard ──
      Vue.directive('hit', {
        bind(el, binding) {
          const handler = binding.value;
          if (typeof handler !== 'function') return;
          el.addEventListener('click', handler);
          el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handler(e);
            }
          });
        },
        unbind(el, binding) {
          // 简化清理：实际 BE 也没做精细的 removeEventListener
        },
      });

      // ── BeSwitchBox ── 直接来自 BE SwitchBox.vue ──
      Vue.component('BeSwitchBox', {
        template: `<div
          class="be-switch-box"
          :class="{ checked, disabled }"
          role="switch"
          :aria-checked="checked"
          :aria-disabled="disabled"
          tabindex="0"
          @keydown.space.prevent="toggle()"
          @keydown.enter.prevent="toggle()"
        >
          <label>
            <input
              ref="input"
              type="checkbox"
              :disabled="disabled"
              :checked="checked"
              @change.stop="$emit('change', $event.target.checked)"
            />
            <div class="bar">
              <div class="thumb"></div>
            </div>
          </label>
        </div>`,
        model: {
          prop: 'checked',
          event: 'change',
        },
        props: {
          checked: {
            type: Boolean,
            default: false,
          },
          disabled: {
            type: Boolean,
            default: false,
          },
        },
        methods: {
          toggle() {
            if (this.disabled) {
              return;
            }
            this.$refs.input.checked = !this.$refs.input.checked;
            this.$emit('change', this.$refs.input.checked);
          },
        },
      });

      // ── BePopup ── 直接来自 BE VPopup.vue ──
      Vue.component('BePopup', {
        template: `<div
          class="be-popup"
          :class="{ open, fixed, close: !open, 'closed-style': closedStyle }"
          v-on="$listeners"
        >
          <slot v-if="loaded"></slot>
        </div>`,
        model: {
          prop: 'open',
          event: 'popup-change',
        },
        props: {
          open: { type: Boolean, default: false },
          closedStyle: { type: Boolean, default: true },
          fixed: { type: Boolean, default: false },
          triggerElement: { default: null },
          lazy: { type: Boolean, default: true },
          autoClose: { type: Boolean, default: true },
          autoDestroy: { type: Boolean, default: false },
          escClose: { type: Boolean, default: false },
          autoClosePredicate: { type: Function, default: null },
        },
        data() {
          return {
            loaded: !this.lazy,
          };
        },
        computed: {
          trigger() {
            if (this.triggerElement === null) return null;
            if (this.triggerElement.$el) return this.triggerElement.$el;
            return this.triggerElement;
          },
        },
        watch: {
          open() {
            if (this.lazy && !this.loaded) {
              this.loaded = true;
            }
            this.setAutoClose();
          },
        },
        mounted() {
          if (this.open) {
            this.setAutoClose();
          }
          if (this.escClose) {
            this.$el.addEventListener('keydown', (e) => {
              if (e.key === 'Escape') {
                this.$emit('popup-change', false);
              }
            });
          }
          if (this.autoDestroy) {
            this.$el.addEventListener('transitionend', () => {
              if (!this.open) {
                this.loaded = false;
              }
            });
          }
        },
        methods: {
          openHandler(e) {
            const targetElement = e.target;
            let isOutside =
              targetElement !== this.trigger &&
              !this.trigger?.contains(targetElement) &&
              targetElement !== this.$el &&
              !this.$el.contains(targetElement);
            if (this.autoClosePredicate) {
              isOutside =
                isOutside &&
                this.autoClosePredicate({
                  target: targetElement,
                  element: this.$el,
                  trigger: this.trigger,
                });
            }
            if (isOutside) {
              this.$emit('popup-change', false);
            }
          },
          setAutoClose() {
            if (this.autoClose) {
              const eventTypes = ['mousedown', 'touchstart'];
              eventTypes.forEach((type) => {
                if (this.open) {
                  document.documentElement.addEventListener(type, this.openHandler);
                } else {
                  document.documentElement.removeEventListener(type, this.openHandler);
                }
              });
            }
          },
          toggle() {
            this.$emit('popup-change', !this.open);
          },
        },
      });

      // ── BeButton ── 直接来自 BE VButton.vue ──
      Vue.component('BeButton', {
        template: `<div
          class="be-button"
          role="button"
          :aria-disabled="disabled"
          :tabindex="disabled ? -1 : 0"
          :class="{ [type]: true, disabled, round, icon, 'no-effects': noEffects }"
          v-on="disabled ? {} : $listeners"
          @keydown.enter.prevent="$listeners.click && $listeners.click($event)"
          @keydown.space.prevent="$listeners.click && $listeners.click($event)"
        >
          <div class="content-container">
            <slot>Button</slot>
          </div>
        </div>`,
        props: {
          type: { type: String, default: 'light' },
          round: { type: Boolean, default: false },
          icon: { type: Boolean, default: false },
          noEffects: { type: Boolean, default: false },
        },
        computed: {
          disabled() {
            return Boolean(this.$attrs.disabled);
          },
        },
      });
    }

    // ── UI 样式 ─ 完全对齐 Bilibili-Evolved ──────────────────────
    // 来源: https://github.com/the1812/Bilibili-Evolved (MIT License)
    // 作者: the1812 (https://github.com/the1812)
    // 包括: Dock 侧边栏、设置面板、SwitchBox、按钮、输入框、
    //       下拉框、Tab 标签栏、主题色系统、亮暗色模式
    // ─────────────────────────────────────────────────────────────
    injectStyles() {
      gm.addStyle(`
/* ── CSS 变量系统 ── 对齐 Bilibili-Evolved _common.scss ── */
#${APP_ID}-root {
  --dyp-theme-color: #2196F3;
  --dyp-theme-color-10: rgba(33,150,243,0.1);
  --dyp-theme-color-20: rgba(33,150,243,0.2);
  --dyp-theme-color-30: rgba(33,150,243,0.3);
  --dyp-theme-color-40: rgba(33,150,243,0.4);
  --dyp-theme-color-50: rgba(33,150,243,0.5);
  --dyp-theme-color-60: rgba(33,150,243,0.6);
  --dyp-theme-color-70: rgba(33,150,243,0.7);
  --dyp-theme-color-80: rgba(33,150,243,0.8);
  --dyp-theme-color-90: rgba(33,150,243,0.9);
  --dyp-foreground-color: #fff;
  /* 亮色模式默认值 */
  --dyp-card-bg: #fff;
  --dyp-panel-bg: #fff;
  --dyp-popup-bg: #fff;
  --dyp-button-bg: #fff;
  --dyp-text-title: black;
  --dyp-text-content: black;
  --dyp-text-placeholder: #888;
  --dyp-card-border: #8882;
  --dyp-switch-bg: #8884;
  --dyp-thumb-border: #ddd;
  --dyp-thumb-bg: #fff;
  --dyp-shadow: 0 4px 12px 0 rgba(0,0,0,0.05);
  font-size: 12px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
}
/* 暗色模式 — 对齐 BE body.dark 变量 */
#${APP_ID}-root.${APP_ID}-dark {
  --dyp-card-bg: #282828;
  --dyp-panel-bg: #222;
  --dyp-popup-bg: #222;
  --dyp-button-bg: #333;
  --dyp-text-title: #eee;
  --dyp-text-content: #eee;
  --dyp-text-placeholder: #888;
  --dyp-card-border: #333;
  --dyp-switch-bg: #8884;
  --dyp-thumb-border: #555;
  --dyp-thumb-bg: #666;
  --dyp-shadow: 0 4px 12px 0 rgba(0,0,0,0.2);
}
/* ── Dock 侧边栏 ── 对齐 BE SettingsContainer.vue .sidebar ── */
/* 来源: https://github.com/the1812/Bilibili-Evolved (MIT License) */
/* BE 使用 --direction CSS 变量 (1 或 -1) 控制左右翻转 */
#${APP_ID}-root {
  --direction: 1;
  line-height: normal;
  font-size: 12px;
  pointer-events: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  z-index: 100000;
}
.${APP_ID}-sidebar {
  position: fixed;
  top: 50%;
  left: 0;
  z-index: 100002;
  transform: translateX(calc(-15% * var(--direction))) translateY(-50%);
  display: flex;
  flex-direction: column;
  pointer-events: auto;
}
#${APP_ID}-root[data-dock="right"] {
  --direction: -1;
}
#${APP_ID}-root[data-dock="right"] .${APP_ID}-sidebar {
  left: auto;
  right: 0;
}
/* BE .sidebar > *: cursor pointer, tap-highlight transparent, transition transform+opacity 0.3s */
.${APP_ID}-sidebar-btn {
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  width: 26px;
  height: 26px;
  padding: 8px;
  box-sizing: content-box;
  background-color: #fffa;
  border: none;
  border-radius: 50%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s ease-out, opacity 0.3s ease-out;
}
.${APP_ID}-sidebar-btn:not(:last-child) {
  margin-bottom: 26px;
}
/* 额外点击区域 — 对齐 BE ::after 140% hitbox */
.${APP_ID}-sidebar-btn::after {
  content: "";
  position: absolute;
  width: 140%;
  height: 140%;
  top: -20%;
  left: -20%;
}
/* BE .be-icon: font-size 26px ($size), color #888, fill #888, transition fill 0.3s */
.${APP_ID}-sidebar-btn svg {
  width: 26px;
  height: 26px;
  color: #888;
  fill: #888;
  transition: fill 0.3s ease-out;
}
/* hover — 对齐 BE: translateX(calc(60% * var(--direction))) scale(1.1) */
.${APP_ID}-sidebar-btn:hover {
  transform: translateX(calc(60% * var(--direction))) scale(1.1);
  background-color: #fff;
}
.${APP_ID}-sidebar-btn:hover svg {
  color: #222;
  fill: #222;
}
/* 打开状态 — 按钮消失动画 — 对齐 BE .open */
/* BE: translateX(calc(100% * var(--direction))) scale(1.5); opacity: 0 */
.${APP_ID}-sidebar-btn.open {
  transform: translateX(calc(100% * var(--direction))) scale(1.5);
  opacity: 0;
  pointer-events: none;
}
/* 暗色 Dock — 对齐 BE body.dark */
#${APP_ID}-root.${APP_ID}-dark .${APP_ID}-sidebar-btn {
  background-color: #333a;
}
#${APP_ID}-root.${APP_ID}-dark .${APP_ID}-sidebar-btn:hover {
  background-color: var(--dyp-button-bg);
}
#${APP_ID}-root.${APP_ID}-dark .${APP_ID}-sidebar-btn:hover svg {
  color: var(--dyp-text-title);
  fill: var(--dyp-text-title);
}
/* ── 面板弹出层 ── 对齐 BE .settings-panel-popup ── */
/* BE: position fixed, top 50%, left 12px, transition cubic-bezier */
/* close: translateX(calc(-48% * var(--direction))), open: translateX(0) */
.${APP_ID}-panel-popup {
  position: fixed;
  top: 50%;
  left: 12px;
  z-index: 100001;
  pointer-events: none;
  opacity: 0;
  transform: translateZ(0) translateY(-50%) translateX(calc(-48% * var(--direction)));
  transform-origin: left;
  transition: transform 0.3s cubic-bezier(0.22, 0.61, 0.36, 1),
              opacity 0.3s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.${APP_ID}-panel-popup.open {
  opacity: 1;
  pointer-events: auto;
  transform: translateZ(0) translateY(-50%) translateX(0);
}
/* 覆盖 .be-popup 的 z-index:1 — 用更高优先级选择器 */
.be-popup.${APP_ID}-panel-popup {
  z-index: 100001;
}
/* 右侧停靠 — 对齐 BE dock/_right.scss */
#${APP_ID}-root[data-dock="right"] .${APP_ID}-panel-popup {
  left: auto;
  right: 12px;
  transform-origin: right;
  transform: translateZ(0) translateY(-50%) translateX(calc(-48% * var(--direction)));
}
#${APP_ID}-root[data-dock="right"] .${APP_ID}-panel-popup.open {
  transform: translateZ(0) translateY(-50%) translateX(0);
}
/* ── 功能弹窗 ── 对齐 BE WidgetsPanel.vue ── */
.${APP_ID}-widgets-panel {
  --dyp-header-height: 50px;
  background-color: var(--dyp-popup-bg);
  border-radius: 8px;
  border: 1px solid var(--dyp-card-border);
  box-sizing: border-box;
  min-width: 300px;
  max-width: 380px;
  max-height: calc(100vh - 120px);
  min-height: 80px;
  color: var(--dyp-text-title);
  box-shadow: var(--dyp-shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.${APP_ID}-widgets-content {
  flex: 1;
  overflow: auto;
  scrollbar-width: none;
  overscroll-behavior: contain;
  padding: 12px;
}
.${APP_ID}-widgets-content::-webkit-scrollbar { height: 0 !important; width: 0 !important; }
.${APP_ID}-widgets-info {
  font-size: 12px;
  line-height: 1.8;
}
.${APP_ID}-info-row {
  display: flex;
  align-items: baseline;
  padding: 2px 0;
}
.${APP_ID}-info-label {
  flex-shrink: 0;
  width: 56px;
  color: var(--dyp-text-placeholder);
  font-size: 12px;
}
.${APP_ID}-info-value {
  flex: 1;
  word-break: break-all;
  font-size: 12px;
}
.${APP_ID}-info-src {
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid #8882;
}
.${APP_ID}-live-badge {
  color: #ff4757;
  font-weight: 600;
}
.${APP_ID}-widgets-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #8882;
}
/* ── 关于页 ── 对齐 BE AboutPage.vue ── */
.${APP_ID}-about-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.${APP_ID}-about-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--dyp-theme-color-20);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.${APP_ID}-about-icon svg {
  width: 28px;
  height: 28px;
  color: var(--dyp-theme-color);
  fill: var(--dyp-theme-color);
}
.${APP_ID}-about-name {
  font-size: 18px;
  font-weight: 600;
}
.${APP_ID}-about-version {
  font-size: 12px;
  color: var(--dyp-text-placeholder);
  margin-top: 2px;
}
.${APP_ID}-about-desc {
  font-size: 13px;
  color: var(--dyp-text-content);
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #8882;
}
.${APP_ID}-debug-output {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(127, 127, 127, 0.1);
  color: var(--dyp-text-content);
  font-size: 12px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 320px;
  overflow: auto;
}
.${APP_ID}-debug-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  flex-wrap: wrap;
}
.${APP_ID}-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  text-decoration: none;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 4px;
  cursor: pointer;
  color: var(--dyp-text-title) !important;
}
.${APP_ID}-link-btn svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
/* ── 面板主体 ── 对齐 BE SettingsPanel.vue .settings-panel ── */
/* BE: content-box, min-width 320px, height calc(100vh-120px), border-radius 8px */
/* shadow: 0 4px 12px 0 rgba(0,0,0,0.05), dark: rgba(0,0,0,0.2) */
.${APP_ID}-panel {
  --dyp-header-height: 50px;
  --dyp-panel-height: calc(100vh - 120px);
  background-color: var(--dyp-panel-bg);
  border-radius: 8px;
  border: 1px solid var(--dyp-card-border);
  box-sizing: content-box;
  width: auto;
  min-width: 320px;
  height: var(--dyp-panel-height);
  color: var(--dyp-text-title);
  box-shadow: var(--dyp-shadow);
  display: flex;
  flex-direction: column;
  align-items: stretch;
  position: relative;
  overflow: hidden;
  overscroll-behavior: contain;
  transition: opacity 0.2s 0.2s ease-out;
}
/* ── 面板头部 ── 对齐 BE .settings-panel-header ── */
/* BE: box-sizing border-box, height 50px, padding 12px, h-center(8px) */
.${APP_ID}-panel-header {
  box-sizing: border-box;
  height: var(--dyp-header-height);
  padding: 12px;
  border-bottom: 1px solid #8882;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  color: var(--dyp-text-title);
  fill: var(--dyp-text-title);
  stroke: var(--dyp-text-title);
}
/* BE: font-size 18px, font-weight 600 (semi-bold mixin) */
.${APP_ID}-panel-header .${APP_ID}-title {
  font-size: 18px;
  font-weight: 600;
  flex: 1;
}
/* header 里的图标 — 对齐 BE VIcon */
.${APP_ID}-panel-header > svg {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}
/* BE: .close .be-icon — cursor pointer, hover 变主题色 */
.${APP_ID}-panel-header .${APP_ID}-close {
  cursor: pointer;
  background: none;
  border: none;
  padding: 4px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--dyp-text-content);
  fill: var(--dyp-text-content);
  transition: color 0.2s ease-out, fill 0.2s ease-out;
}
.${APP_ID}-panel-header .${APP_ID}-close:hover {
  color: var(--dyp-theme-color);
  fill: var(--dyp-theme-color);
}
.${APP_ID}-panel-header .${APP_ID}-close svg {
  width: 20px;
  height: 20px;
}
/* ── Tab 标签侧栏 ── 对齐 BE ComponentTags.vue ── */
/* BE .settings-panel-content: flex:1, display:flex, max-height: calc(panel-height - header-height) */
.${APP_ID}-panel-body {
  flex: 1;
  display: flex;
  position: relative;
  max-height: calc(var(--dyp-panel-height) - var(--dyp-header-height));
}
/* BE .settings-panel-content .sidebar: display flex, flex-direction column, z-index 2 */
/* BE .component-tags-preview (sidebar 子元素): position relative, flex 1 */
.${APP_ID}-panel-sidebar {
  position: relative;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  z-index: 2;
  border-right: 1px solid #8882;
}
/* BE .icon-list: flex-grow 1, width 40px, no-scrollbar, flex column */
.${APP_ID}-icon-list {
  flex-grow: 1;
  max-height: calc(var(--dyp-panel-height) - var(--dyp-header-height));
  width: 40px;
  display: flex;
  flex-direction: column;
  overflow: auto;
  scrollbar-width: none;
  overscroll-behavior: contain;
  background-color: transparent;
}
.${APP_ID}-icon-list::-webkit-scrollbar { height: 0 !important; width: 0 !important; }
.${APP_ID}-icon-list .grow,
.${APP_ID}-tag-list .grow {
  flex-grow: 1;
}
/* BE .component-tags-item: background transparent, cursor pointer, flex, nowrap, padding 8px */
.${APP_ID}-icon-list .${APP_ID}-tag-icon {
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  padding: 8px;
  background-color: transparent;
  transition: background-color 0.2s ease-out;
}
.${APP_ID}-icon-list .${APP_ID}-tag-icon svg {
  width: 20px;
  height: 20px;
  color: #888;
  fill: #888;
  margin-left: 2px;
}
/* BE: hover/selected → background-color #8882 */
.${APP_ID}-icon-list .${APP_ID}-tag-icon:hover,
.${APP_ID}-icon-list .${APP_ID}-tag-icon.selected {
  background-color: #8882;
}
.${APP_ID}-icon-list .${APP_ID}-tag-icon.selected svg {
  color: var(--dyp-theme-color);
  fill: var(--dyp-theme-color);
}
/* hover 展开的文字标签列表 — 对齐 BE .component-tags */
/* BE: position absolute, top 0, width auto, opacity 0, pointer-events none */
/* transition 0.2s ease-out, background #fff, border-right 1px solid #8882 */
.${APP_ID}-tag-list {
  flex-grow: 1;
  max-height: calc(var(--dyp-panel-height) - var(--dyp-header-height));
  width: auto;
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  opacity: 0;
  pointer-events: none;
  background-color: var(--dyp-panel-bg);
  border-right: 1px solid #8882;
  border-bottom-left-radius: 8px;
  z-index: 2;
  overflow: auto;
  scrollbar-width: none;
  overscroll-behavior: contain;
  display: flex;
  flex-direction: column;
  transition: 0.2s ease-out;
}
.${APP_ID}-tag-list::-webkit-scrollbar { height: 0 !important; width: 0 !important; }
/* BE hover 展开逻辑 — 纯 CSS 兄弟选择器 */
.${APP_ID}-icon-list:hover ~ .${APP_ID}-tag-list,
.${APP_ID}-tag-list:hover {
  opacity: 1;
  pointer-events: initial;
}
/* BE .component-tags-item: padding 8px, padding-right 10px, font-size 13px */
.${APP_ID}-tag-list .${APP_ID}-tag-item {
  cursor: pointer;
  padding: 8px;
  padding-right: 10px;
  font-size: 13px;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 0;
  background-color: transparent;
  transition: background-color 0.2s ease-out;
}
.${APP_ID}-tag-list .${APP_ID}-tag-item svg {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  color: #888;
  fill: #888;
  margin-left: 2px;
}
/* BE: .tag-name margin-right 4px, margin-left 8px */
.${APP_ID}-tag-list .${APP_ID}-tag-item span {
  margin-right: 4px;
  margin-left: 8px;
}
.${APP_ID}-tag-list .${APP_ID}-tag-item:hover,
.${APP_ID}-tag-list .${APP_ID}-tag-item.selected {
  background-color: #8882;
}
.${APP_ID}-tag-list .${APP_ID}-tag-item.selected svg {
  color: var(--dyp-theme-color);
  fill: var(--dyp-theme-color);
}
/* 最后一个 tag-item 圆角 — 对齐 BE dock/_left.scss */
.${APP_ID}-tag-list .${APP_ID}-tag-item:last-child {
  border-bottom-left-radius: 7px;
}
/* 右停靠 — 对齐 BE dock/_right.scss */
#${APP_ID}-root[data-dock="right"] .${APP_ID}-panel-sidebar {
  border-right: none;
  border-left: 1px solid #8882;
  order: 1;
}
#${APP_ID}-root[data-dock="right"] .${APP_ID}-tag-list {
  left: auto;
  right: 0;
  border-right: none;
  border-left: 1px solid #8882;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 8px;
}
#${APP_ID}-root[data-dock="right"] .${APP_ID}-tag-list .${APP_ID}-tag-item:last-child {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 7px;
}
/* ── 内容区 ── 对齐 BE .settings-panel-content .main ── */
/* BE: flex 1, padding 0, no-scrollbar mixin, position relative */
/* BE dock/_left.scss: .main { border-bottom-right-radius: 7px } */
.${APP_ID}-content {
  flex: 1;
  padding: 0;
  position: relative;
  overflow: auto;
  scrollbar-width: none;
  overscroll-behavior: contain;
  border-bottom-right-radius: 7px;
}
.${APP_ID}-content::-webkit-scrollbar { height: 0 !important; width: 0 !important; }
/* 右停靠 — 对齐 BE dock/_right.scss: .main { border-bottom-left-radius: 7px } */
#${APP_ID}-root[data-dock="right"] .${APP_ID}-content {
  border-bottom-right-radius: 0;
  border-bottom-left-radius: 7px;
}
/* BE .component-list: display grid, grid-template-columns auto, gap 0, width auto, margin 0 */
.${APP_ID}-component-list {
  display: grid;
  grid-template-columns: auto;
  gap: 0;
  width: auto;
  margin: 0;
}
/* ── 详情面板 ── 对齐 BE .component-detail-panel ── */
/* 详情面板现在是 .dyp-panel-popup 的直接子元素，不受 .dyp-panel overflow:hidden 裁切 */
.${APP_ID}-detail-panel {
  position: absolute;
  top: 50%;
  left: 100%;
  height: calc(100% - 22px);
  z-index: -1;
  padding-left: 0;
  transform: translateZ(0) translateY(-50%) translateX(-48%);
  opacity: 0;
  pointer-events: none;
  transition: transform 0.3s cubic-bezier(0.22, 0.61, 0.36, 1),
              opacity 0.3s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.${APP_ID}-detail-panel.open {
  transform: translateZ(0) translateY(-50%) translateX(0);
  opacity: 1;
  pointer-events: initial;
}
.${APP_ID}-detail-inner {
  min-width: 220px;
  width: 220px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #fff;
  border-radius: 8px;
  border: 1px solid #8882;
  box-shadow: 0 4px 12px 0 rgba(0,0,0,0.05);
  overflow: auto;
  overscroll-behavior: contain;
  padding: 12px;
  box-sizing: border-box;
}
.${APP_ID}-dark .${APP_ID}-detail-inner {
  background-color: var(--dyp-popup-bg, #222);
  box-shadow: 0 4px 12px 0 rgba(0,0,0,0.2);
  color: var(--dyp-text-title, #eee);
}
.${APP_ID}-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 2;
}
.${APP_ID}-detail-header .${APP_ID}-close {
  flex-shrink: 0;
  cursor: pointer;
  background: none;
  border: none;
  padding: 4px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--dyp-text-content);
  fill: var(--dyp-text-content);
  transition: color 0.2s ease-out, fill 0.2s ease-out;
}
.${APP_ID}-detail-header .${APP_ID}-close:hover {
  color: var(--dyp-theme-color);
  fill: var(--dyp-theme-color);
}
.${APP_ID}-detail-header .${APP_ID}-close svg {
  width: 18px;
  height: 18px;
}
.${APP_ID}-detail-title {
  font-size: 14px;
  font-weight: 600;
}
.${APP_ID}-detail-separator {
  height: 1px;
  background-color: #8882;
  margin: 8px 0;
}
.${APP_ID}-detail-desc {
  font-size: 13px;
  line-height: 1.6;
  color: #666;
}
.${APP_ID}-dark .${APP_ID}-detail-desc {
  color: #aaa;
}
/* 右停靠时面板在左侧弹出 */
#${APP_ID}-root[data-dock="right"] .${APP_ID}-detail-panel {
  left: unset;
  right: 100%;
  padding-left: 0;
  padding-right: 0;
  transform: translateZ(0) translateY(-50%) translateX(48%);
}
#${APP_ID}-root[data-dock="right"] .${APP_ID}-detail-panel.open {
  transform: translateZ(0) translateY(-50%) translateX(0);
}
/* 非 component-list 的页面内容 */
.${APP_ID}-content-page {
  padding: 8px 12px 16px;
}
.${APP_ID}-content-page h4 {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
}
.${APP_ID}-summary {
  margin-bottom: 8px;
  padding: 8px;
  border-radius: 8px;
  background-color: #8881;
  font-size: 12px;
  line-height: 1.6;
}
.${APP_ID}-section {
  padding: 8px 0;
  border-bottom: 1px solid #8882;
}
.${APP_ID}-section:last-child {
  border-bottom: none;
}
.${APP_ID}-video-info {
  font-size: 12px;
  line-height: 1.6;
}
.${APP_ID}-muted {
  color: var(--dyp-text-placeholder);
  font-size: 12px;
}
.${APP_ID}-grid {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
/* ── 设置行 ── 完全对齐 BE ComponentSettings.vue ── */
/* BE .component-settings: flex column, justify center, box-sizing border-box,
   overflow hidden, padding 7px 12px 7px 7px, width 100%, min-height 36px,
   cursor pointer, transition 0.2s, user-select none */
.${APP_ID}-switch-row {
  display: flex;
  flex-direction: column;
  justify-content: center;
  box-sizing: border-box;
  overflow: hidden;
  padding: 7px 12px 7px 7px;
  width: 100%;
  min-height: 36px;
  position: relative;
  cursor: pointer;
  transition: 0.2s ease-out;
  user-select: none;
}
/* BE .component-settings:hover { background-color: #8881 } */
.${APP_ID}-switch-row:hover {
  background-color: #8881;
}
/* BE .component-settings.selected { background-color: #8882 } */
.${APP_ID}-switch-row.selected {
  background-color: #8882;
}
.${APP_ID}-detail-count {
  font-size: 11px;
  min-width: 18px;
  height: 18px;
  line-height: 18px;
  text-align: center;
  border-radius: 9px;
  background-color: #8882;
  color: var(--dyp-text-title);
  padding: 0 5px;
  flex-shrink: 0;
}
.${APP_ID}-detail-list {
  flex: 1;
  overflow: auto;
  overscroll-behavior: contain;
  margin: 0 -12px;
}
.${APP_ID}-detail-list .${APP_ID}-switch-row {
  padding: 0 12px;
}
.${APP_ID}-detail-list .${APP_ID}-switch-row-inner .${APP_ID}-display-name {
  width: auto;
  flex: 1 1 0;
  min-width: 0;
}
.${APP_ID}-detail-header .${APP_ID}-detail-title {
  flex: 1 1 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* BE .component-settings-row: h-center, justify space-between */
.${APP_ID}-switch-row-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
/* BE .display-name: font-size 14px, height 20px, flex 1 0 auto, margin-left 6px, width 200px */
.${APP_ID}-switch-row-inner .${APP_ID}-display-name {
  font-size: 14px;
  height: 20px;
  flex: 1 0 auto;
  margin-left: 6px;
  width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: flex;
  align-items: center;
}
/* BE .be-switch-box { margin: 0 } inside .component-settings */
.${APP_ID}-switch-row .be-switch-box {
  margin: 0;
}
/* ── 按钮 ── 对齐 BE VButton.vue ── */
.${APP_ID}-panel button,
.${APP_ID}-btn {
  background-color: #8882;
  color: var(--dyp-text-title);
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s ease-out, box-shadow 0.2s ease-out;
}
.${APP_ID}-btn-primary {
  box-shadow: 0 0 0 1px var(--dyp-theme-color-80);
  background-color: var(--dyp-theme-color-80) !important;
  color: var(--dyp-foreground-color) !important;
}
.${APP_ID}-btn-primary:hover {
  box-shadow: 0 0 0 1px var(--dyp-theme-color);
  background-color: var(--dyp-theme-color) !important;
}
.${APP_ID}-btn-secondary {
  background-color: var(--dyp-button-bg) !important;
  box-shadow: 0 0 0 1px #8884;
  color: var(--dyp-text-title) !important;
}
.${APP_ID}-btn-secondary:hover {
  box-shadow: 0 0 0 1px var(--dyp-theme-color);
}
.${APP_ID}-btn-secondary:active,
.${APP_ID}-btn-secondary:focus-visible {
  box-shadow: 0 0 0 1px var(--dyp-theme-color), 0 0 0 3px var(--dyp-theme-color-20);
}
.${APP_ID}-panel button:hover {
  background-color: #8884;
}
.${APP_ID}-panel button:focus-visible {
  box-shadow: 0 0 0 1px var(--dyp-theme-color), 0 0 0 3px var(--dyp-theme-color-20);
  outline: none;
}
.${APP_ID}-btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
/* ── 输入框 ── 对齐 BE TextBox.vue ── */
.${APP_ID}-panel textarea,
.${APP_ID}-panel input[type="text"],
.${APP_ID}-panel input[type="number"] {
  width: 100%;
  box-sizing: border-box;
  border-radius: 4px;
  border: none;
  background-color: transparent;
  color: var(--dyp-text-content);
  padding: 4px 6px;
  font-size: 12px;
  outline: none;
  box-shadow: 0 0 0 1px #8884, 0 0 0 0px var(--dyp-theme-color-20);
  transition: box-shadow 0.2s ease-out;
}
.${APP_ID}-panel textarea:focus,
.${APP_ID}-panel input[type="text"]:focus,
.${APP_ID}-panel input[type="number"]:focus {
  box-shadow: 0 0 0 1px var(--dyp-theme-color), 0 0 0 3px var(--dyp-theme-color-20);
}
.${APP_ID}-panel textarea::placeholder,
.${APP_ID}-panel input::placeholder {
  color: var(--dyp-text-placeholder);
}
.${APP_ID}-panel textarea {
  min-height: 60px;
  resize: vertical;
}
/* ── 下拉框 ── 对齐 BE VDropdown.vue ── */
.${APP_ID}-panel select {
  width: 100%;
  box-sizing: border-box;
  border-radius: 4px;
  border: none;
  background-color: var(--dyp-button-bg);
  color: var(--dyp-text-content);
  padding: 4px 6px;
  font-size: 12px;
  outline: none;
  box-shadow: 0 0 0 1px #8884;
  cursor: pointer;
  transition: box-shadow 0.2s ease-out;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 6px center;
  padding-right: 24px;
}
.${APP_ID}-panel select:hover {
  box-shadow: 0 0 0 1px var(--dyp-theme-color);
}
.${APP_ID}-panel select:focus {
  box-shadow: 0 0 0 1px var(--dyp-theme-color), 0 0 0 3px var(--dyp-theme-color-20);
}
/* ── 调色板 ── 对齐 BE palette.json ── */
.${APP_ID}-palette {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.${APP_ID}-palette-color {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color 0.2s ease-out, transform 0.2s ease-out;
  padding: 0;
}
.${APP_ID}-palette-color:hover {
  transform: scale(1.15);
}
.${APP_ID}-palette-color.active {
  border-color: var(--dyp-theme-color);
  box-shadow: 0 0 0 2px var(--dyp-theme-color-20);
}
/* ── 杂项 ── */
.${APP_ID}-label-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  margin-top: 6px;
}
.${APP_ID}-label-row span {
  min-width: 60px;
}

#${APP_ID}-toast {
  position: fixed;
  left: 50%;
  top: 20px;
  transform: translate(-50%, -16px);
  padding: 10px 16px;
  border-radius: 999px;
  background: rgba(18, 20, 28, 0.92);
  color: #fff;
  font-size: 13px;
  z-index: 2147483646;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease, transform 0.18s ease;
}

#${APP_ID}-toast.show {
  opacity: 1;
  transform: translate(-50%, 0);
}

.${APP_ID}-quick-tools {
  position: absolute !important;
  top: 14px;
  right: 14px;
  z-index: 2147483640;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.${APP_ID}-quick-tools button {
  border: 0;
  border-radius: 999px;
  padding: 8px 12px;
  background: rgba(18, 20, 28, 0.75);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.26);
}

.${APP_ID}-hidden-card {
  display: none !important;
}

.${APP_ID}-hidden-ui {
  display: none !important;
}

.${APP_ID}-hidden-login {
  display: none !important;
  opacity: 0 !important;
  pointer-events: none !important;
}

.xgplayer .loginV2 {
  display: none !important;
}

.xgplayer .blockLoginText,
.xgplayer .blockLoginBtn,
.xgplayer .loginV2,
.xgplayer .xgTips .blockLoginText,
.xgplayer .xgTips .blockLoginBtn {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
}

.${APP_ID}-native-speed-menu {
  position: fixed;
  z-index: 2147483645;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  min-width: 180px;
  padding: 10px;
  border-radius: 14px;
  background: rgba(18, 20, 28, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.34);
  backdrop-filter: blur(14px);
}

.${APP_ID}-native-speed-menu button {
  border: 0;
  border-radius: 10px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.${APP_ID}-native-speed-menu button.active {
  background: linear-gradient(135deg, #ff2f67, #ff5e3a);
}

/* ══════════════════════════════════════════════════════════════════
   BE Vue 组件原版 CSS — 直接来自 Bilibili-Evolved (MIT License)
   body.dark 替换为 .dyp-dark（不能给抖音 body 加 class）
   ══════════════════════════════════════════════════════════════════ */

/* ── BE VPopup.vue CSS ── */
.be-popup {
  position: absolute;
  z-index: 1;
  border-radius: 8px;
}
.be-popup.fixed {
  position: fixed;
}
.be-popup.close.closed-style {
  pointer-events: none;
  opacity: 0;
}
.be-popup.open {
  pointer-events: initial;
  opacity: 1;
}

/* ── BE SwitchBox.vue CSS ── */
.be-switch-box {
  outline: none !important;
  width: 32px;
  margin: 4px 0;
}
.be-switch-box,
.be-switch-box *,
.be-switch-box *::before,
.be-switch-box *::after {
  transition: 0.2s all ease-out;
}
.be-switch-box input[type='checkbox'] {
  display: none;
}
.be-switch-box label {
  display: block;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.be-switch-box .bar {
  position: relative;
  background-color: var(--dyp-switch-bg, #8884);
  box-sizing: border-box;
  height: 12px;
  border-radius: 6px;
}
.be-switch-box .bar .thumb {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background-color: #fff;
  border: 1px solid #ddd;
}
.${APP_ID}-dark .be-switch-box .bar .thumb {
  border-color: var(--dyp-thumb-border, #555);
  background-color: var(--dyp-thumb-bg, #666);
}
.be-switch-box.checked .bar {
  background-color: var(--dyp-theme-color-50);
}
.be-switch-box.checked .bar .thumb {
  background-color: var(--dyp-theme-color);
  border-color: transparent;
  left: calc(100% - 18px);
}
.${APP_ID}-dark .be-switch-box.checked .bar .thumb {
  border-color: transparent;
  background-color: var(--dyp-theme-color);
}
.be-switch-box:focus-within.checked .thumb {
  box-shadow: 0 0 0 1px var(--dyp-theme-color-20);
}
.be-switch-box.disabled,
.be-switch-box.disabled * {
  cursor: not-allowed;
}
.be-switch-box.disabled {
  opacity: 0.5;
}

/* ── BE VButton.vue CSS ── */
.be-button {
  outline: none !important;
  line-height: normal;
  transition: background-color 0.2s ease-out, box-shadow 0.2s ease-out;
  background-color: #8882;
  color: black;
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.be-button,
.be-button * {
  -webkit-tap-highlight-color: transparent;
}
.${APP_ID}-dark .be-button {
  color: var(--dyp-text-title, #eee);
}
.be-button.round {
  border-radius: calc(1em + 8px);
  padding: 4px 10px;
}
.be-button.icon {
  border-radius: 50%;
  padding: 4px;
  background-image: none !important;
}
.be-button .content-container {
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
}
.be-button.transparent {
  background-color: transparent;
}
.be-button.primary {
  box-shadow: 0 0 0 1px var(--dyp-theme-color-80);
  background-color: var(--dyp-theme-color-80);
  color: var(--dyp-foreground-color);
}
.be-button.light {
  background-color: #fff;
  box-shadow: 0 0 0 1px #8884;
  transition: box-shadow 0.2s ease-out;
}
.${APP_ID}-dark .be-button.light {
  background-color: var(--dyp-button-bg, #333);
}
.be-button:not(.disabled):not(.no-effects):hover,
.be-button:not(.disabled):not(.no-effects):focus-within {
  background-color: #8884;
}
.be-button:not(.disabled):not(.no-effects):focus-within {
  box-shadow: 0 0 0 1px var(--dyp-theme-color), 0 0 0 3px var(--dyp-theme-color-20);
}
.be-button:not(.disabled):not(.no-effects).transparent:hover,
.be-button:not(.disabled):not(.no-effects).transparent:focus-within {
  background-color: #8882;
}
.be-button:not(.disabled):not(.no-effects).primary:hover {
  box-shadow: 0 0 0 1px var(--dyp-theme-color);
}
.be-button:not(.disabled):not(.no-effects).primary:focus-within {
  box-shadow: 0 0 0 1px var(--dyp-theme-color), 0 0 0 3px var(--dyp-theme-color-20);
}
.be-button:not(.disabled):not(.no-effects).primary:hover,
.be-button:not(.disabled):not(.no-effects).primary:focus-within {
  background-color: var(--dyp-theme-color);
}
.be-button:not(.disabled):not(.no-effects).light:hover {
  background-color: #fff;
  box-shadow: 0 0 0 1px var(--dyp-theme-color);
}
.be-button:not(.disabled):not(.no-effects).light:active,
.be-button:not(.disabled):not(.no-effects).light:focus-within {
  background-color: #fff;
  box-shadow: 0 0 0 1px var(--dyp-theme-color), 0 0 0 3px var(--dyp-theme-color-20);
}
.${APP_ID}-dark .be-button:not(.disabled):not(.no-effects).light:hover {
  background-color: var(--dyp-button-bg, #333);
  box-shadow: 0 0 0 1px var(--dyp-theme-color);
}
.${APP_ID}-dark .be-button:not(.disabled):not(.no-effects).light:active,
.${APP_ID}-dark .be-button:not(.disabled):not(.no-effects).light:focus-within {
  background-color: var(--dyp-button-bg, #333);
  box-shadow: 0 0 0 1px var(--dyp-theme-color), 0 0 0 3px var(--dyp-theme-color-20);
}
.be-button.disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
      `);
    }

    // ── UI DOM ─ 直接使用 Bilibili-Evolved Vue 组件 ─────────────────
    // 来源: https://github.com/the1812/Bilibili-Evolved (MIT License)
    // 底层组件（SwitchBox/VPopup/VButton）直接用 BE 代码
    // 容器结构用 BE 的 class 名和 DOM 布局
    mountUi() {
      if (this.ui.root) {
        return;
      }

      const el = document.createElement('div');
      el.id = `${APP_ID}-root`;
      document.documentElement.appendChild(el);

      const app = this;
      const SVG_WIDGETS = '<svg viewBox="0 0 24 24"><path d="M13 13v8h8v-8h-8zM3 21h8v-8H3v8zM3 3v8h8V3H3zm13.66-1.31L11.86 6.5l4.8 4.81 4.81-4.81-4.81-4.81z" fill="currentColor"/></svg>';
      const SVG_SETTINGS = '<svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 00-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1112 8.4a3.6 3.6 0 010 7.2z" fill="currentColor"/></svg>';
      const SVG_CLOSE = '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/></svg>';
      const SVG_APPEARANCE = '<svg viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" fill="currentColor"/></svg>';
      const SVG_TUNE = '<svg viewBox="0 0 24 24"><path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z" fill="currentColor"/></svg>';
      const SVG_DEBUG = '<svg viewBox="0 0 24 24"><path d="M9 3V1h6v2h2a2 2 0 012 2v2h2v2h-2v2a7 7 0 11-14 0V9H3V7h2V5a2 2 0 012-2h2zm8 6H7v4a5 5 0 0010 0V9zm-7 2h2v2h-2v-2zm4 0h2v2h-2v-2z" fill="currentColor"/></svg>';
      const SVG_INFO = '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" fill="currentColor"/></svg>';
      const SVG_GITHUB = '<svg viewBox="0 0 24 24"><path d="M12 2A10 10 0 002 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z" fill="currentColor"/></svg>';

      // ── Vue 实例 ── 双弹窗架构，对齐 BE SettingsContainer.vue ──
      this.vueApp = new Vue({
        el: `#${APP_ID}-root`,
        data() {
          return {
            widgetsOpen: false,
            settingsOpen: false,
            activeTab: 'settings',
            isDark: true,
            config: app.config,
            palette: BE_PALETTE,
            widgetsInfoHtml: '',
            debugInfoHtml: '',
            sideTabOptions: SIDE_TAB_OPTIONS,
            topBarOptions: TOP_BAR_OPTIONS,
            interactionBarOptions: INTERACTION_BAR_OPTIONS,
            detailOpen: false,
            detailKey: '',
            detailTitle: '',
            detailDesc: '',
          };
        },
        computed: {
          settingsTitle() {
            const map = { settings: '设置', tune: '调节', appearance: '外观', debug: '调试', about: '关于' };
            return map[this.activeTab] || '设置';
          },
          dockPosition() {
            return this.config.dockPosition || 'left';
          },
        },
        watch: {
          'config.themeColor'(val) { app.applyThemeColor(val || '#2196F3'); },
          'config.darkMode'(val) { app.applyDarkMode(val || 'auto'); },
          'config.dockPosition'() { app.persistConfig(); },
          widgetsOpen(val) {
            app.state.widgetsOpen = val;
            if (val) {
              this.settingsOpen = false;
              app.state.settingsOpen = false;
              app.renderWidgetsInfo();
            }
          },
          settingsOpen(val) {
            app.state.settingsOpen = val;
            if (val) {
              this.widgetsOpen = false;
              app.state.widgetsOpen = false;
            } else {
              this.closeDetail();
            }
          },
          activeTab(val) {
            app.state.activeTab = val;
            this.closeDetail();
            if (val === 'debug') {
              app.renderDebugInfo();
            }
          },
        },
        template: `
<div :id="'${APP_ID}-root'" :data-dock="dockPosition" :class="{'${APP_ID}-dark': isDark}">
  <div class="${APP_ID}-sidebar" ref="sidebar" aria-label="DouYinPlus">
    <button class="${APP_ID}-sidebar-btn" type="button" ref="widgetsBtn"
      :class="{open: widgetsOpen}"
      title="功能" @click="toggleWidgets()">${SVG_WIDGETS}</button>
    <button class="${APP_ID}-sidebar-btn" type="button" ref="settingsBtn"
      :class="{open: settingsOpen}"
      title="设置" @click="toggleSettings()">${SVG_SETTINGS}</button>
  </div>

  <!-- ═══ 功能弹窗 ═══ 对齐 BE WidgetsPanel.vue ═══ -->
  <be-popup ref="widgetsPopup" v-model="widgetsOpen" :fixed="true"
    class="${APP_ID}-panel-popup widgets-panel-popup" :class="{open: widgetsOpen, close: !widgetsOpen}"
    :trigger-element="$refs.widgetsBtn" :closed-style="true">
    <div class="${APP_ID}-widgets-panel">
      <div class="${APP_ID}-panel-header">
        ${SVG_WIDGETS}
        <span class="${APP_ID}-title">功能</span>
        <button class="${APP_ID}-close" type="button" title="关闭" @click="widgetsOpen = false">${SVG_CLOSE}</button>
      </div>
      <div class="${APP_ID}-widgets-content">
        <div class="${APP_ID}-widgets-info" v-html="widgetsInfoHtml"></div>
        <div class="${APP_ID}-widgets-actions">
          <button class="${APP_ID}-btn-secondary" type="button" @click="doAction('copy-current')">复制当前直链</button>
          <button class="${APP_ID}-btn-secondary" type="button" @click="doAction('next-video')">下一条</button>
        </div>
      </div>
    </div>
  </be-popup>

  <!-- ═══ 设置弹窗 ═══ 对齐 BE SettingsPanel.vue ═══ -->
  <be-popup ref="settingsPopup" v-model="settingsOpen" :fixed="true"
    class="${APP_ID}-panel-popup settings-panel-popup" :class="{open: settingsOpen, close: !settingsOpen}"
    :trigger-element="$refs.settingsBtn" :closed-style="true">
    <div class="${APP_ID}-panel" ref="panel">
      <div class="${APP_ID}-panel-header">
        ${SVG_SETTINGS}
        <span class="${APP_ID}-title">{{ settingsTitle }}</span>
        <button class="${APP_ID}-close" type="button" title="关闭" @click="settingsOpen = false">${SVG_CLOSE}</button>
      </div>

      <div class="${APP_ID}-panel-body">
        <div class="${APP_ID}-panel-sidebar">
          <div class="${APP_ID}-icon-list" ref="iconList">
            <div class="${APP_ID}-tag-icon" :class="{selected: activeTab==='settings'}"
              title="设置" @click="activeTab='settings'">${SVG_SETTINGS}</div>
            <div class="${APP_ID}-tag-icon" :class="{selected: activeTab==='tune'}"
              title="调节" @click="activeTab='tune'">${SVG_TUNE}</div>
            <div class="${APP_ID}-tag-icon grow"></div>
            <div class="${APP_ID}-tag-icon" :class="{selected: activeTab==='appearance'}"
              title="外观" @click="activeTab='appearance'">${SVG_APPEARANCE}</div>
            <div class="${APP_ID}-tag-icon" :class="{selected: activeTab==='debug'}"
              title="调试" @click="activeTab='debug'">${SVG_DEBUG}</div>
            <div class="${APP_ID}-tag-icon" :class="{selected: activeTab==='about'}"
              title="关于" @click="activeTab='about'">${SVG_INFO}</div>
          </div>
          <div class="${APP_ID}-tag-list">
            <div class="${APP_ID}-tag-item" :class="{selected: activeTab==='settings'}"
              @click="activeTab='settings'">${SVG_SETTINGS}<span>设置</span></div>
            <div class="${APP_ID}-tag-item" :class="{selected: activeTab==='tune'}"
              @click="activeTab='tune'">${SVG_TUNE}<span>调节</span></div>
            <div class="${APP_ID}-tag-item grow"></div>
            <div class="${APP_ID}-tag-item" :class="{selected: activeTab==='appearance'}"
              @click="activeTab='appearance'">${SVG_APPEARANCE}<span>外观</span></div>
            <div class="${APP_ID}-tag-item" :class="{selected: activeTab==='debug'}"
              @click="activeTab='debug'">${SVG_DEBUG}<span>调试</span></div>
            <div class="${APP_ID}-tag-item" :class="{selected: activeTab==='about'}"
              @click="activeTab='about'">${SVG_INFO}<span>关于</span></div>
          </div>
        </div>

        <div class="${APP_ID}-content">
          <!-- ═══ 设置页 ═══ 对齐 BE ComponentSettings 行结构 ═══ -->
          <div v-show="activeTab==='settings'" class="${APP_ID}-component-list">
            <div class="${APP_ID}-switch-row" :class="{selected: detailKey==='enableUnlock'}" @click="selectDetail('enableUnlock', '解除未登录时前端某些限制')"><div class="${APP_ID}-switch-row-inner"><span class="${APP_ID}-display-name">解除未登录时前端某些限制</span><be-switch-box :checked="config.enableUnlock" @change="onSwitch('enableUnlock', $event)" @click.native.stop></be-switch-box></div></div>
            <div class="${APP_ID}-switch-row" :class="{selected: detailKey==='enableFiltering'}" @click="selectDetail('enableFiltering', '视频过滤')"><div class="${APP_ID}-switch-row-inner"><span class="${APP_ID}-display-name">视频过滤</span><be-switch-box :checked="config.enableFiltering" @change="onSwitch('enableFiltering', $event)" @click.native.stop></be-switch-box></div></div>
            <div class="${APP_ID}-switch-row" :class="{selected: detailKey==='autoNext'}" @click="selectDetail('autoNext', '视频卡住时自动跳过')"><div class="${APP_ID}-switch-row-inner"><span class="${APP_ID}-display-name">视频卡住时自动跳过</span><be-switch-box :checked="config.autoNext" @change="onSwitch('autoNext', $event)" @click.native.stop></be-switch-box></div></div>
            <div class="${APP_ID}-switch-row" :class="{selected: detailKey==='autoSkipLive'}" @click="selectDetail('autoSkipLive', '检测到直播自动跳过')"><div class="${APP_ID}-switch-row-inner"><span class="${APP_ID}-display-name">检测到直播自动跳过</span><be-switch-box :checked="config.autoSkipLive" @change="onSwitch('autoSkipLive', $event)" @click.native.stop></be-switch-box></div></div>
            <div class="${APP_ID}-switch-row" :class="{selected: detailKey==='holdToSpeed'}" @click="selectDetail('holdToSpeed', '按住左右临时加速')"><div class="${APP_ID}-switch-row-inner"><span class="${APP_ID}-display-name">按住左右临时加速</span><be-switch-box :checked="config.holdToSpeed" @change="onSwitch('holdToSpeed', $event)" @click.native.stop></be-switch-box></div></div>
            <div class="${APP_ID}-switch-row" :class="{selected: detailKey==='enableMiniButtons'}" @click="selectDetail('enableMiniButtons', '播放区快捷按钮')"><div class="${APP_ID}-switch-row-inner"><span class="${APP_ID}-display-name">播放区快捷按钮</span><be-switch-box :checked="config.enableMiniButtons" @change="onSwitch('enableMiniButtons', $event)" @click.native.stop></be-switch-box></div></div>
            <div class="${APP_ID}-switch-row" :class="{selected: detailKey==='hiddenSideTabs'}" @click="selectDetail('hiddenSideTabs', '隐藏TAB')"><div class="${APP_ID}-switch-row-inner"><span class="${APP_ID}-display-name">隐藏TAB</span><span class="${APP_ID}-detail-count">{{ config.hiddenSideTabs.length }}</span></div></div>
            <div class="${APP_ID}-switch-row" :class="{selected: detailKey==='hiddenTopItems'}" @click="selectDetail('hiddenTopItems', '隐藏上方控件')"><div class="${APP_ID}-switch-row-inner"><span class="${APP_ID}-display-name">隐藏上方控件</span><span class="${APP_ID}-detail-count">{{ config.hiddenTopItems.length }}</span></div></div>
            <div class="${APP_ID}-switch-row" :class="{selected: detailKey==='hiddenInteractionItems'}" @click="selectDetail('hiddenInteractionItems', '隐藏互动栏')"><div class="${APP_ID}-switch-row-inner"><span class="${APP_ID}-display-name">隐藏互动栏</span><span class="${APP_ID}-detail-count">{{ config.hiddenInteractionItems.length }}</span></div></div>
          </div>

          <!-- ═══ 调节页 ═══ -->
          <div v-show="activeTab==='tune'" class="${APP_ID}-content-page">
            <div class="${APP_ID}-section">
              <h4>过滤规则</h4>
              <div class="${APP_ID}-grid" style="margin-top:8px;">
                <div><div class="${APP_ID}-muted">最短时长（秒）</div><input type="number" min="0" step="1" :value="config.minDuration" @change="onInput('minDuration', $event)" /></div>
                <div><div class="${APP_ID}-muted">最长时长（秒）</div><input type="number" min="0" step="1" :value="config.maxDuration" @change="onInput('maxDuration', $event)" /></div>
              </div>
              <div style="margin-top:8px;"><div class="${APP_ID}-muted">关键词黑名单</div><textarea :value="formatLines(config.keywordBlacklist)" @change="onTextarea('keywordBlacklist', $event)" placeholder="一行一个，或用逗号分开"></textarea></div>
              <div style="margin-top:8px;"><div class="${APP_ID}-muted">作者黑名单</div><textarea :value="formatLines(config.authorBlacklist)" @change="onTextarea('authorBlacklist', $event)" placeholder="一行一个，或用逗号分开"></textarea></div>
            </div>
            <div class="${APP_ID}-section">
              <h4>画质偏好</h4>
              <div class="${APP_ID}-muted" style="margin-bottom:8px">自动选择不超过偏好的最高画质</div>
              <select :value="config.preferredClarity" @change="onSelect('preferredClarity', $event)">
                <option value="0">不干预</option>
                <option value="2160">4K</option>
                <option value="1440">2K</option>
                <option value="1080">1080P</option>
                <option value="720">720P</option>
                <option value="540">540P</option>
              </select>
            </div>
            <div class="${APP_ID}-section">
              <h4>倍速设置</h4>
              <div class="${APP_ID}-grid">
                <div><div class="${APP_ID}-muted">默认倍速</div><input type="number" min="0.1" max="16" step="0.1" :value="config.defaultPlaybackRate" @change="onInput('defaultPlaybackRate', $event)" /></div>
                <div><div class="${APP_ID}-muted">按住 D 加速</div><input type="number" min="0.1" max="16" step="0.1" :value="config.holdSpeed" @change="onInput('holdSpeed', $event)" /></div>
                <div><div class="${APP_ID}-muted">按住 A 减速</div><input type="number" min="0.1" max="16" step="0.1" :value="config.holdSlowSpeed" @change="onInput('holdSlowSpeed', $event)" /></div>
                <div><div class="${APP_ID}-muted">左右键跳转秒数</div><input type="number" min="1" max="30" step="1" :value="config.seekStepSeconds" @change="onInput('seekStepSeconds', $event)" /></div>
              </div>
            </div>
          </div>

          <!-- ═══ 外观页 ═══ -->
          <div v-show="activeTab==='appearance'" class="${APP_ID}-content-page">
            <div class="${APP_ID}-section">
              <h4>主题色</h4>
              <div class="${APP_ID}-muted">选一个颜色，所有强调色跟着变</div>
              <div class="${APP_ID}-palette">
                <button v-for="color in palette" :key="color" type="button"
                  class="${APP_ID}-palette-color"
                  :class="{active: config.themeColor && config.themeColor.toLowerCase() === color.toLowerCase()}"
                  :style="{backgroundColor: color}" :title="color"
                  @click="setThemeColor(color)"></button>
              </div>
              <div class="${APP_ID}-label-row" style="margin-top:8px;"><span>自定义</span><input type="text" :value="config.themeColor" @change="setThemeColor($event.target.value)" placeholder="#2196F3" style="width:100px;" /></div>
            </div>
            <div class="${APP_ID}-section">
              <h4>暗色模式</h4>
              <select :value="config.darkMode" @change="onSelect('darkMode', $event)">
                <option value="auto">跟随网页</option>
                <option value="light">亮色</option>
                <option value="dark">暗色</option>
              </select>
            </div>
            <div class="${APP_ID}-section">
              <h4>Dock 位置</h4>
              <select :value="config.dockPosition" @change="onSelect('dockPosition', $event)">
                <option value="left">左侧</option>
                <option value="right">右侧</option>
              </select>
            </div>
          </div>

          <div v-show="activeTab==='debug'" class="${APP_ID}-content-page">
            <div class="${APP_ID}-section">
              <h4>最终结果</h4>
              <div class="${APP_ID}-muted">这里会显示当前拿到的关键状态，方便看最后到底是什么结果喵。</div>
              <div class="${APP_ID}-debug-actions">
                <button class="${APP_ID}-btn-secondary" type="button" @click="doAction('debug-refresh')">刷新结果</button>
                <button class="${APP_ID}-btn-secondary" type="button" @click="doAction('debug-log')">输出到控制台</button>
                <button class="${APP_ID}-btn-secondary" type="button" @click="doAction('debug-inspect-init')">检查初始化对象</button>
              </div>
              <div class="${APP_ID}-debug-output">{{ debugInfoHtml }}</div>
            </div>
          </div>

          <!-- ═══ 关于页 ═══ 对齐 BE AboutPage.vue ═══ -->
          <div v-show="activeTab==='about'" class="${APP_ID}-content-page">
            <div class="${APP_ID}-about-header">
              <div class="${APP_ID}-about-icon">${SVG_WIDGETS}</div>
              <div class="${APP_ID}-about-meta">
                <div class="${APP_ID}-about-name">DouYinPlus</div>
                <div class="${APP_ID}-about-version">v${APP_VERSION}</div>
              </div>
            </div>
            <div class="${APP_ID}-about-desc">抖音网页增强：视频过滤、倍速、解除未登录时前端某些限制</div>
            <div class="${APP_ID}-section">
              <h4>链接</h4>
              <div class="${APP_ID}-btn-row">
                <a class="${APP_ID}-btn-secondary ${APP_ID}-link-btn" href="https://github.com/isxlan0/DouYinPlus" target="_blank" rel="noopener">${SVG_GITHUB}<span>主页</span></a>
                <a class="${APP_ID}-btn-secondary ${APP_ID}-link-btn" href="https://github.com/isxlan0/DouYinPlus/issues" target="_blank" rel="noopener">${SVG_GITHUB}<span>反馈</span></a>
                <a class="${APP_ID}-btn-secondary ${APP_ID}-link-btn" href="https://github.com/isxlan0/DouYinPlus/releases" target="_blank" rel="noopener">${SVG_GITHUB}<span>更新日志</span></a>
              </div>
            </div>
            <div class="${APP_ID}-section">
              <h4>配置</h4>
              <div class="${APP_ID}-btn-row">
                <button class="${APP_ID}-btn-secondary" type="button" @click="doAction('export-config')">导出配置</button>
                <button class="${APP_ID}-btn-secondary" type="button" @click="doAction('import-config')">导入配置</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="${APP_ID}-detail-panel" :class="{open: detailOpen}">
      <div class="${APP_ID}-detail-inner">
        <div class="${APP_ID}-detail-header">
          <span class="${APP_ID}-detail-title">{{ detailTitle }}</span>
          <button class="${APP_ID}-close" type="button" @click="closeDetail()">${SVG_CLOSE}</button>
        </div>
        <div class="${APP_ID}-detail-separator"></div>
        <div v-if="detailKey==='hiddenSideTabs'" class="${APP_ID}-detail-list">
          <div v-for="item in sideTabOptions" :key="item.key" class="${APP_ID}-switch-row" @click="toggleListItem('hiddenSideTabs', item.key)"><div class="${APP_ID}-switch-row-inner"><span class="${APP_ID}-display-name">{{ item.label }}</span><be-switch-box :checked="config.hiddenSideTabs.includes(item.key)" @change="toggleListItem('hiddenSideTabs', item.key)" @click.native.stop></be-switch-box></div></div>
        </div>
        <div v-else-if="detailKey==='hiddenTopItems'" class="${APP_ID}-detail-list">
          <div v-for="item in topBarOptions" :key="item.key" class="${APP_ID}-switch-row" @click="toggleListItem('hiddenTopItems', item.key)"><div class="${APP_ID}-switch-row-inner"><span class="${APP_ID}-display-name">{{ item.label }}</span><be-switch-box :checked="config.hiddenTopItems.includes(item.key)" @change="toggleListItem('hiddenTopItems', item.key)" @click.native.stop></be-switch-box></div></div>
        </div>
        <div v-else-if="detailKey==='hiddenInteractionItems'" class="${APP_ID}-detail-list">
          <div v-for="item in interactionBarOptions" :key="item.key" class="${APP_ID}-switch-row" @click="toggleListItem('hiddenInteractionItems', item.key)"><div class="${APP_ID}-switch-row-inner"><span class="${APP_ID}-display-name">{{ item.label }}</span><be-switch-box :checked="config.hiddenInteractionItems.includes(item.key)" @change="toggleListItem('hiddenInteractionItems', item.key)" @click.native.stop></be-switch-box></div></div>
        </div>
        <div v-else class="${APP_ID}-detail-desc">{{ detailDesc }}</div>
      </div>
    </div>
  </be-popup>
</div>`,
        methods: {
          toggleWidgets() {
            this.widgetsOpen = !this.widgetsOpen;
          },
          toggleSettings() {
            this.settingsOpen = !this.settingsOpen;
          },
          selectDetail(key, title) {
            if (this.detailKey === key && this.detailOpen) {
              this.detailOpen = false;
              this.detailKey = '';
              return;
            }
            this.detailKey = key;
            this.detailTitle = title;
            this.detailDesc = SETTINGS_DESCRIPTIONS[key] || '暂无描述';
            this.detailOpen = true;
          },
          closeDetail() {
            this.detailOpen = false;
            this.detailKey = '';
          },
          toggleSwitch(key) {
            this.$set(this.config, key, !this.config[key]);
            app.persistConfig();
            app.refreshAll('switch:' + key);
          },
          onSwitch(key, val) {
            this.$set(this.config, key, val);
            app.persistConfig();
            app.refreshAll('switch:' + key);
          },
          toggleListItem(group, key) {
            const list = this.config[group];
            const idx = list.indexOf(key);
            if (idx >= 0) { list.splice(idx, 1); } else { list.push(key); }
            app.persistConfig();
            app.refreshAll('toggle:' + group);
          },
          onInput(key, event) {
            const val = parseFloat(event.target.value);
            if (!isNaN(val)) {
              this.$set(this.config, key, val);
              app.persistConfig();
              if (key === 'defaultPlaybackRate') {
                app.applyDefaultPlaybackRate(val);
              }
              app.refreshAll('input:' + key);
            }
          },
          onSelect(key, event) {
            const val = event.target.value;
            this.$set(this.config, key, key === 'preferredClarity' ? parseInt(val) || 0 : val);
            app.persistConfig();
            app.refreshAll('select:' + key);
          },
          onTextarea(key, event) {
            const raw = event.target.value;
            this.$set(this.config, key, raw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean));
            app.persistConfig();
            app.refreshAll('textarea:' + key);
          },
          setThemeColor(color) {
            if (!color || !color.startsWith('#')) return;
            this.$set(this.config, 'themeColor', color);
            app.applyThemeColor(color);
            app.persistConfig();
          },
          formatLines(arr) {
            return Array.isArray(arr) ? arr.join('\n') : '';
          },
          doAction(action) {
            app.handleAction(action);
          },
        },
      });

      // 缓存 DOM 引用（给旧代码兼容用）
      this.ui.root = this.vueApp.$el;
      this.ui.sidebar = this.vueApp.$refs.sidebar;
      this.ui.panel = this.vueApp.$refs.panel;

      // 保留全局事件
      document.addEventListener('click', (event) => this.handleGlobalClick(event), true);
      document.addEventListener('click', (event) => this.handleNativePlayerClick(event), true);

      this.ensureNativeSpeedMenu();
      this.applyThemeColor(this.config.themeColor || '#2196F3');
      this.applyDarkMode(this.config.darkMode || 'auto');
      this.ensureQuickButtons();
      this.renderDebugInfo();
    }

    // ── 主题色系统 ── 对齐 BE theme-color/index.ts ──
    applyThemeColor(hex) {
      if (!this.ui.root) return;
      const h = hex.replace('#', '');
      const r = parseInt(h.substring(0, 2), 16);
      const g = parseInt(h.substring(2, 4), 16);
      const b = parseInt(h.substring(4, 6), 16);
      const root = this.ui.root;
      root.style.setProperty('--dyp-theme-color', hex);
      for (let i = 1; i <= 9; i++) {
        root.style.setProperty(`--dyp-theme-color-${i}0`, `rgba(${r},${g},${b},${i / 10})`);
      }
      // 前景色：亮度 > 0.5 用黑色，否则白色 — 对齐 BE foreground-color 逻辑
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      root.style.setProperty('--dyp-foreground-color', luminance > 0.5 ? 'black' : '#fff');
      // Vue 响应式自动更新调色板选中状态，不需要手动 renderPalette()
    }

    // ── 暗色模式 ── 实时监控网页主色自动切换 ──
    applyDarkMode(mode) {
      if (!this.ui.root) return;
      if (mode === 'auto') {
        this._setDarkFromPage();
        this._startPageThemeWatch();
      } else {
        this._stopPageThemeWatch();
        this._setDark(mode === 'dark');
      }
    }

    _setDark(dark) {
      if (this.vueApp) {
        this.vueApp.isDark = dark;
      } else {
        this.ui.root.classList.toggle(`${APP_ID}-dark`, dark);
      }
    }

    // 从页面实际颜色判断是否暗色
    _detectPageIsDark() {
      const root = document.documentElement;
      const style = getComputedStyle(root);
      // 优先读取抖音的 CSS 变量 --color-bg-b0
      let bgStr = style.getPropertyValue('--color-bg-b0').trim();
      if (!bgStr) {
        bgStr = style.backgroundColor;
      }
      // 解析 rgba/rgb
      const m = bgStr.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
      if (!m) {
        // 兜底：检查 tab span 文字颜色
        const tabSpan = document.querySelector('a[href*="from_nav=1"] span');
        if (tabSpan) {
          const tc = getComputedStyle(tabSpan).color;
          const tm = tc.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
          if (tm) {
            const lum = (0.299 * +tm[1] + 0.587 * +tm[2] + 0.114 * +tm[3]) / 255;
            // 文字亮 → 页面暗
            return lum > 0.5;
          }
        }
        return true; // 默认暗色
      }
      const lum = (0.299 * +m[1] + 0.587 * +m[2] + 0.114 * +m[3]) / 255;
      return lum < 0.5;
    }

    _setDarkFromPage() {
      this._setDark(this._detectPageIsDark());
    }

    _startPageThemeWatch() {
      if (this._pageThemeWatchActive) return;
      this._pageThemeWatchActive = true;
      // MutationObserver 监听 <html> 的 style / class 变化
      this._pageThemeObserver = new MutationObserver(() => {
        if (this.config.darkMode === 'auto') this._setDarkFromPage();
      });
      this._pageThemeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['style', 'class', 'data-theme'],
      });
      // 定时轮询兜底（CSS 变量变化不一定触发 attribute mutation）
      this._pageThemeTimer = setInterval(() => {
        if (this.config.darkMode === 'auto') this._setDarkFromPage();
      }, 3000);
    }

    _stopPageThemeWatch() {
      this._pageThemeWatchActive = false;
      if (this._pageThemeObserver) {
        this._pageThemeObserver.disconnect();
        this._pageThemeObserver = null;
      }
      if (this._pageThemeTimer) {
        clearInterval(this._pageThemeTimer);
        this._pageThemeTimer = null;
      }
    }

    // (renderPalette 已由 Vue 响应式替代，不再需要)
    // (handleDockClick 已由 Vue @click 替代，不再需要)
    // (handlePanelClick 已由 Vue 事件绑定替代，不再需要)

    handleGlobalClick(event) {
      const quickButton = event.target.closest(`.${APP_ID}-quick-tools [data-action]`);
      if (!(quickButton instanceof HTMLButtonElement)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      this.handleQuickAction(quickButton.dataset.action || '');
    }

    // ── Vue doAction() 桥接 — 面板内按钮动作分发 ──
    handleAction(action) {
      if (action === 'close-panel') {
        this.setPanelOpen(false);
      } else if (action === 'copy-current') {
        this.copyCurrentUrl();
      } else if (action === 'next-video') {
        this.goToNextVideo('panel');
      } else if (action === 'export-config') {
        this.exportConfig();
      } else if (action === 'import-config') {
        this.importConfig();
      } else if (action === 'debug-refresh') {
        this.renderDebugInfo();
        this.toast.show('调试结果已刷新');
      } else if (action === 'debug-log') {
        const text = this.renderDebugInfo();
        console.info(`[${APP_NAME}] 调试结果\n${text}`);
        this.toast.show('已经输出到控制台');
      } else if (action === 'debug-inspect-init') {
        this.inspectInitTargets('debug-tab');
        this.renderDebugInfo();
        this.toast.show('初始化对象检查已输出');
      }
    }

    handleQuickAction(action) {
      if (action === 'next') {
        this.goToNextVideo('quick');
      } else if (action === 'speed') {
        if (!this.openNativeSpeedPanel()) {
          this.cycleSpeedPreset();
        }
      }
    }

    getRuntimePlayers() {
      return listRuntimePlayers();
    }

    getCurrentRuntimePlayer() {
      return pickCurrentRuntimePlayer();
    }

    getCurrentRuntimeAwemeInfo(player = this.getCurrentRuntimePlayer()) {
      const snapshot = getMainWorldBridge()?.getCurrentSnapshot?.();
      return snapshot?.awemeInfo || getRuntimeAwemeInfo(player);
    }

    getCurrentRuntimeMeta(player = this.getCurrentRuntimePlayer()) {
      return buildMetaFromAwemeInfo(this.getCurrentRuntimeAwemeInfo(player));
    }

    isNativeAutoPlayEnabled(player = this.getCurrentRuntimePlayer()) {
      const raw = window.localStorage?.getItem?.('player_nextautoplay');
      if (raw === '1' || raw === '"1"') {
        return true;
      }
      if (raw === '0' || raw === '"0"') {
        return false;
      }
      if (typeof player?.isAutoPlay === 'boolean') {
        return player.isAutoPlay;
      }
      const plugin = player?.getPlugin?.('AutoPlaySettingPlugin')
        || player?.getPlugin?.('autoplaysettingplugin');
      const nextAutoPlay = plugin?.config?.nextAutoPlay ?? plugin?._config?.nextAutoPlay;
      if (typeof nextAutoPlay !== 'undefined') {
        return Boolean(Number(nextAutoPlay));
      }
      return false;
    }

    getNativePlaySwitchHandler(direction = 'next') {
      const button = findPrimaryPlaySwitchButton();
      if (direction === 'next') {
        const bridge = getMainWorldBridge();
        if (bridge && typeof bridge.invokeNext === 'function') {
          return () => {
            if (bridge.invokeNext()) {
              return true;
            }
            if (button instanceof HTMLElement) {
              triggerClick(button);
              return true;
            }
            return false;
          };
        }
      }
      if (!(button instanceof HTMLElement)) {
        return null;
      }
      const propName = direction === 'prev' ? 'playPrevFunc' : 'playNextFunc';
      const handler = findReactPropValue(button, propName);
      if (typeof handler === 'function') {
        return handler;
      }
      if (direction === 'next') {
        return () => {
          triggerClick(button);
          return true;
        };
      }
      return null;
    }

    getRuntimeSnapshot() {
      return getMainWorldBridge()?.getCurrentSnapshot?.() || null;
    }

    openNativeSpeedPanel() {
      const bridge = getMainWorldBridge();
      if (bridge && typeof bridge.openNativeSpeedPanel === 'function' && bridge.openNativeSpeedPanel()) {
        const host = document.querySelector('.xgplayer-playback-setting.slide-show');
        if (host instanceof HTMLElement) {
          this.ensureNativeSpeedRuntimeControls(host);
        }
        return true;
      }
      const trigger = document.querySelector('.xgplayer-setting-playbackRatio, .xgplayer-playback-setting');
      if (!(trigger instanceof HTMLElement)) {
        return false;
      }
      trigger.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      trigger.click();
      return true;
    }

    getPlayableVideo() {
      this.refreshCurrentContext();
      return this.state.currentVideo
        || getRuntimeVideo(this.getCurrentRuntimePlayer())
        || findPrimaryVideo();
    }

    isBoostHotkey(key) {
      return this.config.boostKeys.includes(String(key || '').toLowerCase());
    }

    seekPlayableVideo(deltaSeconds) {
      const video = this.getPlayableVideo();
      if (!(video instanceof HTMLVideoElement)) {
        return false;
      }
      const delta = Number(deltaSeconds || 0);
      if (!Number.isFinite(delta) || delta === 0) {
        return false;
      }
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : Number.MAX_SAFE_INTEGER;
      const nextTime = clamp(Number(video.currentTime || 0) + delta, 0, duration, 0);
      video.currentTime = nextTime;
      this.touchStallProgress(video);
      this.renderWidgetsInfo();
      return true;
    }

    touchStallProgress(video = this.state.currentVideo) {
      if (!(video instanceof HTMLVideoElement)) {
        return;
      }
      const bufferedEnd = video.buffered?.length ? video.buffered.end(video.buffered.length - 1) : 0;
      this.state.stall.lastVideoTime = Number(video.currentTime || 0);
      this.state.stall.lastBufferedEnd = Number(bufferedEnd || 0);
      this.state.stall.lastProgressAt = Date.now();
      this.state.stall.currentSrc = video.currentSrc || video.src || '';
      this.state.stall.awemeId = this.state.currentMeta?.awemeId || this.getCurrentRuntimeMeta().awemeId || '';
      this.state.stall.consecutiveStallCount = 0;
    }

    maybeSkipStalledVideo(reason = 'stall') {
      if (!this.config.autoNext) {
        return false;
      }
      const now = Date.now();
      if (now - this.state.stall.skipTriggeredAt < 6000) {
        return false;
      }
      this.state.stall.skipTriggeredAt = now;
      this.state.stall.consecutiveStallCount = 0;
      // 不再隐藏当前卡片——隐藏会导致视频画面消失
      // 只是跳到下一条
      const changed = this.goToNextVideo(reason);
      if (!changed) {
        this.toast.show('当前视频卡住了，但没找到下一条', 'warn');
      }
      return changed;
    }

    checkPlaybackStall() {
      const video = this.state.currentVideo;
      if (!(video instanceof HTMLVideoElement) || !this.config.autoNext) {
        return;
      }
      // 直播不做 stall 检测
      if (this.state.currentMeta?.isLive) {
        return;
      }
      const player = this.getCurrentRuntimePlayer();
      const now = Date.now();
      const awemeId = this.state.currentMeta?.awemeId || this.getCurrentRuntimeMeta(player).awemeId || '';
      const currentSrc = video.currentSrc || video.src || '';
      if (this.state.stall.currentSrc !== currentSrc || this.state.stall.awemeId !== awemeId) {
        this.touchStallProgress(video);
        return;
      }
      const bufferedEnd = video.buffered?.length ? video.buffered.end(video.buffered.length - 1) : 0;
      if (Math.abs(video.currentTime - this.state.stall.lastVideoTime) > 0.2 || Math.abs(bufferedEnd - this.state.stall.lastBufferedEnd) > 0.5) {
        this.touchStallProgress(video);
        return;
      }
      // 如果视频没有 src（直播预览或未加载），不算 stall
      if (!currentSrc) {
        return;
      }
      const playerWantsPlay = player?.paused === false;
      // 更严格的 stall 判定：需要 lastProgressAt 超过阈值
      const timeSinceProgress = now - this.state.stall.lastProgressAt;
      const stalledBecausePausedMismatch = playerWantsPlay && video.paused && !video.ended && timeSinceProgress > 5000;
      const stalledBecauseFrozen = !video.paused && !video.ended && video.readyState >= 2 && timeSinceProgress > 5000;
      const stalledBecauseWaiting = (video.readyState <= 2 || video.networkState === 2) && playerWantsPlay && timeSinceProgress > 6000;
      if (stalledBecausePausedMismatch || stalledBecauseFrozen || stalledBecauseWaiting) {
        this.state.stall.consecutiveStallCount++;
        // 需要连续 3 次检测到 stall（约 3.6 秒）才触发跳转
        if (this.state.stall.consecutiveStallCount >= 3) {
          this.maybeSkipStalledVideo(stalledBecausePausedMismatch ? 'stuck' : 'buffering');
        }
      } else {
        this.state.stall.consecutiveStallCount = 0;
      }
    }

    adjustCustomSpeed(delta) {
      const rates = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
      const current = Number(this.state.currentVideo?.playbackRate || this.config.defaultPlaybackRate || 1);
      const ordered = delta >= 0 ? rates : [...rates].reverse();
      let nextRate = current;
      for (const rate of ordered) {
        if (delta >= 0 && rate > current + 0.01) {
          nextRate = rate;
          break;
        }
        if (delta < 0 && rate < current - 0.01) {
          nextRate = rate;
          break;
        }
      }
      if (Math.abs(nextRate - current) < 0.01) {
        nextRate = delta >= 0 ? rates[rates.length - 1] : rates[0];
      }
      const finalRate = clamp(nextRate, 0.1, 16, 1);
      this.syncManualSelectedRate(finalRate);
      const video = this.getPlayableVideo();
      if (video) {
        this.setVideoRate(video, finalRate);
      }
      this.toast.show(`默认倍速改成 ${formatPlaybackRateLabel(finalRate)}`);
      return finalRate;
    }

    syncManualSelectedRate(rate) {
      const nextRate = clamp(rate, 0.1, 16, 1);
      this.config.defaultPlaybackRate = nextRate;
      this.persistConfig();
      this.renderConfigToPanel();
      this.updateQuickButtons();
      this.renderWidgetsInfo();
      return nextRate;
    }

    applyDefaultPlaybackRate(rate = this.config.defaultPlaybackRate) {
      const nextRate = this.syncManualSelectedRate(rate);
      const video = this.getPlayableVideo() || this.state.currentVideo || getRuntimeVideo(this.getCurrentRuntimePlayer());
      this._rateSyncLockUntil = Date.now() + 1500;
      if (video) {
        this.setVideoRate(video, nextRate);
      } else {
        this.syncNativeSpeedBtnText(nextRate);
      }
      if (this.ui.nativeSpeedMenu && !this.ui.nativeSpeedMenu.hidden) {
        const trigger = document.querySelector('.xgplayer-setting-playbackRatio, .xgplayer-playback-setting');
        if (trigger instanceof HTMLElement) {
          this.showNativeSpeedMenu(trigger);
        }
      }
      return nextRate;
    }

    patchNativePlaybackPlugin(player) {
      const plugin = player?.getPlugin?.('PlayBackSettingPlugin');
      if (!plugin || typeof plugin !== 'object') {
        return false;
      }
      const patchFlag = `__${APP_ID}SpeedUnlockPatched`;
      if (!plugin[patchFlag]) {
        if (typeof plugin.updateConfig === 'function') {
          const originalUpdateConfig = plugin.updateConfig.bind(plugin);
          plugin.updateConfig = (next = {}) => {
            const config = next && typeof next === 'object' ? { ...next } : {};
            config.loginBlock = false;
            config.disable = false;
            return originalUpdateConfig(config);
          };
        }
        if (typeof plugin.renderRoot === 'function') {
          const originalRenderRoot = plugin.renderRoot.bind(plugin);
          plugin.renderRoot = (...args) => {
            if (plugin.config && typeof plugin.config === 'object') {
              plugin.config.loginBlock = false;
              plugin.config.disable = false;
            }
            const result = originalRenderRoot(...args);
            // renderRoot 会给 slider/content 设置内联隐藏样式，清除它们
            const pRoot = plugin.root;
            if (pRoot instanceof HTMLElement) {
              const sl = pRoot.querySelector('.xgplayer-slider');
              const ct = sl?.querySelector('.xgplayer-setting-content');
              if (sl) { sl.removeAttribute('style'); }
              if (ct) { ct.removeAttribute('style'); }
            }
            return result;
          };
        }
        plugin[patchFlag] = true;
      }

      let shouldRender = false;
      if (plugin.config && typeof plugin.config === 'object') {
        if (plugin.config.loginBlock !== false) {
          plugin.config.loginBlock = false;
          shouldRender = true;
        }
        if (plugin.config.disable !== false) {
          plugin.config.disable = false;
          shouldRender = true;
        }
      }

      const root = plugin.root;
      if (root instanceof HTMLElement) {
        root.classList.add(`${APP_ID}-native-speed-runtime`);
        if (root.querySelector('.blockLoginText, .blockLoginBtn')) {
          shouldRender = true;
        }
      }

      if (shouldRender && typeof plugin.renderRoot === 'function') {
        try {
          plugin.renderRoot();
        } catch (error) {
          console.debug(APP_NAME, '原生倍速补丁 renderRoot 失败', error);
        }
        scheduleTask(() => {
          try {
            plugin.renderRoot();
          } catch (error) {
            console.debug(APP_NAME, '原生倍速补丁二次 renderRoot 失败', error);
          }
        });
      }

      // 清除 xgplayer 初始化时残留的内联隐藏样式，否则面板打不开
      if (root instanceof HTMLElement) {
        const slider = root.querySelector('.xgplayer-slider');
        const content = root.querySelector('.xgplayer-setting-content');
        if (slider instanceof HTMLElement) { slider.removeAttribute('style'); }
        if (content instanceof HTMLElement) { content.removeAttribute('style'); }
      }

      return shouldRender;
    }

    unlockNativePlayerSpeed() {
      if (!this.config.enableUnlock) {
        return;
      }
      this.getRuntimePlayers().forEach((player) => {
        try {
          this.patchNativePlaybackPlugin(player);
        } catch (error) {
          console.debug(APP_NAME, '原生倍速解限失败', error);
        }
        try {
          this.patchNativeClarityPlugin(player);
        } catch (error) {
          console.debug(APP_NAME, '原生画质解限失败', error);
        }
      });
    }

    patchNativeClarityPlugin(player) {
      const plugin = player?.getPlugin?.('playclaritysettingplugin')
        || player?.getPlugin?.('PlayClaritySettingPlugin');
      if (!plugin || typeof plugin !== 'object') {
        return false;
      }
      const patchFlag = `__${APP_ID}ClarityUnlockPatched`;

      if (!plugin[patchFlag]) {
        // patch updateConfig 强制 isActive=true
        if (typeof plugin.updateConfig === 'function') {
          const originalUpdateConfig = plugin.updateConfig.bind(plugin);
          plugin.updateConfig = (next = {}) => {
            const config = next && typeof next === 'object' ? { ...next } : {};
            config.isActive = true;
            if (config.userInfo && typeof config.userInfo === 'object') {
              config.userInfo.isLogin = true;
            }
            return originalUpdateConfig(config);
          };
        }
        // patch renderRoot 强制 isActive=true
        if (typeof plugin.renderRoot === 'function') {
          const originalRenderRoot = plugin.renderRoot.bind(plugin);
          plugin.renderRoot = (...args) => {
            if (plugin.config && typeof plugin.config === 'object') {
              plugin.config.isActive = true;
              if (plugin.config.userInfo && typeof plugin.config.userInfo === 'object') {
                plugin.config.userInfo.isLogin = true;
              }
            }
            return originalRenderRoot(...args);
          };
        }

        plugin[patchFlag] = true;
      }

      // 每次调用都检查 root 上是否已绑定 click handler，没绑就绑
      const root = plugin.root;
      const clickFlag = `__${APP_ID}ClarityClickBound`;
      if (root instanceof HTMLElement && !root[clickFlag]) {
        root[clickFlag] = true;
        root.addEventListener('click', (event) => {
          const item = event.target.closest?.('.item');
          if (!item) {
            return;
          }
          const wrapper = item.querySelector('.clarity-wrapper');
          if (!wrapper) {
            // 不需要登录的选项，让原生处理，但也保存偏好
            const freeText = item.textContent || '';
            const freeMatch = freeText.match(/(\d+)[PpKk]/);
            if (freeMatch) {
              const freeNum = freeMatch[1];
              const freeHeightMap = { '2': 1440, '4': 2160 };
              const saveHeight = freeNum.length >= 3 ? Number(freeNum) : (freeHeightMap[freeNum] || 0);
              if (saveHeight > 0) {
                this.config.preferredClarity = saveHeight;
                this.persistConfig();
                this.renderConfigToPanel();
              }
            }
            return;
          }
          // 需要登录的选项 → 拦截并用 API 切换
          event.stopPropagation();
          event.preventDefault();

          const text = item.textContent || '';
          const match = text.match(/(\d+)[PpKk]/);
          if (!match) {
            return;
          }
          const qualityNum = match[1]; // "1080" / "2" / "4"
          const bridge = getMainWorldBridge();
          const clarityList = bridge?.getClarityList?.();
          if (!Array.isArray(clarityList)) {
            return;
          }
          // 匹配 gearName：1080 → "1080_*", 2K/4K → 高度匹配；跳过自适应码率
          const fixedList = clarityList.filter((d) => d.definition !== -1 && !/adapt/i.test(d.gearName || ''));
          let target = null;
          if (qualityNum.length >= 3) {
            // 数字分辨率如 1080, 720
            target = fixedList.find((d) => d.gearName && d.gearName.startsWith(qualityNum + '_'));
          } else {
            // 2K → 1440p, 4K → 2160p
            const heightMap = { '2': 1440, '4': 2160 };
            const targetHeight = heightMap[qualityNum];
            if (targetHeight) {
              target = fixedList.find((d) => {
                const q = Math.min(d.width || 0, d.height || 0);
                return q >= targetHeight;
              });
            }
          }
          if (!target) {
            return;
          }
          const switched = bridge.switchClarity(target.gearName);
          if (switched) {
            // 保存画质偏好
            this.config.preferredClarity = target.height || 0;
            this.persistConfig();
            this.renderConfigToPanel();
            // 更新 UI 选中状态
            const allItems = root.querySelectorAll('.item');
            allItems.forEach((el) => el.classList.remove('selected'));
            item.classList.add('selected');
            const btn = root.querySelector('.btn');
            if (btn) {
              btn.textContent = text.replace(/登录即享/g, '').trim();
            }
          }
        }, true); // capture 阶段
      }

      // 每次调用都强制设置
      let shouldRender = false;
      if (plugin.config && typeof plugin.config === 'object') {
        if (plugin.config.isActive !== true) {
          plugin.config.isActive = true;
          shouldRender = true;
        }
        if (plugin.config.userInfo && typeof plugin.config.userInfo === 'object' && !plugin.config.userInfo.isLogin) {
          plugin.config.userInfo.isLogin = true;
          shouldRender = true;
        }
      }
      if (shouldRender && typeof plugin.renderRoot === 'function') {
        try {
          plugin.renderRoot();
        } catch (error) {
          console.debug(APP_NAME, '原生画质补丁 renderRoot 失败', error);
        }
      }
      return true;
    }

    isUnlockedNativeSpeedHost(element) {
      return element instanceof HTMLElement
        && element.matches('.xgplayer-playback-setting')
        && Boolean(element.querySelector('.xgplayer-slider .xgplayer-playratio-item'))
        && !element.querySelector('.blockLoginText');
    }

    ensureNativeSpeedRuntimeControls(host) {
      if (!(host instanceof HTMLElement)) {
        return;
      }
      const wrap = host.querySelector('.xgplayer-playratio-wrap');
      if (wrap instanceof HTMLElement) {
        wrap.querySelectorAll('[data-dyp-add-preset]').forEach((node) => node.remove());
        wrap.querySelectorAll('[data-dyp-preset]').forEach((node) => node.remove());
      }
    }

    ensureNativeSpeedMenu() {
      if (this.ui.nativeSpeedMenu) {
        return;
      }
      const menu = document.createElement('div');
      menu.className = `${APP_ID}-native-speed-menu`;
      menu.hidden = true;
      menu.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-rate]');
        if (!(button instanceof HTMLButtonElement)) {
          return;
        }
        const rate = Number(button.dataset.rate || 0);
        if (!Number.isFinite(rate) || rate <= 0) {
          return;
        }
        const video = this.state.currentVideo;
        this.syncManualSelectedRate(rate);
        if (video) {
          this.setVideoRate(video, rate);
        }
        this.hideNativeSpeedMenu();
        this.toast.show(`原生倍速已切到 ${rate}x`);
      });
      document.documentElement.appendChild(menu);
      this.ui.nativeSpeedMenu = menu;
    }

    showNativeSpeedMenu(anchor) {
      if (!(anchor instanceof HTMLElement) || !this.ui.nativeSpeedMenu) {
        return;
      }
      const current = Number(this.state.currentVideo?.playbackRate || this.config.defaultPlaybackRate || 1);
      const presets = [0.75, 1, 1.25, 1.5, 1.75, 2, 3, 4];
      this.ui.nativeSpeedMenu.innerHTML = presets
        .map((rate) => `
          <button type="button" data-rate="${rate}" class="${Math.abs(current - rate) < 0.02 ? 'active' : ''}">
            ${rate}x
          </button>
        `)
        .join('');
      const rect = anchor.getBoundingClientRect();
      this.ui.nativeSpeedMenu.style.left = `${Math.max(12, rect.right - 196)}px`;
      this.ui.nativeSpeedMenu.style.top = `${Math.max(12, rect.top - 8 - 120)}px`;
      this.ui.nativeSpeedMenu.hidden = false;
      this.state.nativeSpeedMenuOpen = true;
    }

    hideNativeSpeedMenu() {
      if (!this.ui.nativeSpeedMenu) {
        return;
      }
      this.ui.nativeSpeedMenu.hidden = true;
      this.state.nativeSpeedMenuOpen = false;
    }

    handleNativePlayerClick(event) {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (this.ui.nativeSpeedMenu && !target.closest(`.${APP_ID}-native-speed-menu`) && !target.closest('.xgplayer-playback-setting, .xgplayer-setting-playbackRatio')) {
        this.hideNativeSpeedMenu();
      }
      const nativeSpeedItem = target.closest('.xgplayer-playratio-item');
      if (nativeSpeedItem instanceof HTMLElement && this.config.enableUnlock) {
        const selectedRate = (() => {
          const dataId = Number(nativeSpeedItem.getAttribute('data-id') || 0);
          if (Number.isFinite(dataId) && dataId > 0) {
            return clamp(dataId, 0.1, 16, 1);
          }
          const text = nativeSpeedItem.textContent || '';
          const match = text.match(/(\d+(?:\.\d+)?)x/i);
          return match ? clamp(Number(match[1]), 0.1, 16, 1) : 0;
        })();
        if (selectedRate > 0) {
          this.syncManualSelectedRate(selectedRate);
        }
        window.setTimeout(() => {
          const video = this.state.currentVideo || getRuntimeVideo(this.getCurrentRuntimePlayer());
          if (!video) {
            return;
          }
          const rate = clamp(video.playbackRate, 0.1, 16, 1);
          if (Math.abs(Number(this.config.defaultPlaybackRate || 1) - rate) > 0.01) {
            this.syncManualSelectedRate(rate);
          }
          this.updateQuickButtons();
          this.renderWidgetsInfo();
        }, 60);
      }
    }

    // (handlePanelChange 已由 Vue 事件绑定替代)
    // (handlePanelInput 已由 Vue 事件绑定替代)
    // (toggleConfigListItem 已由 Vue toggleListItem 替代)
    // (togglePanel 已由 Vue togglePanel 替代)

    // ── 面板打开/关闭 ── Vue 驱动，所有 DOM 由 Vue 响应式更新 ──
    setPanelOpen(open, panelName = 'widgets') {
      if (panelName === 'feature' || panelName === 'widgets') {
        this.state.widgetsOpen = Boolean(open);
        this.state.settingsOpen = false;
        if (this.vueApp) {
          this.vueApp.widgetsOpen = this.state.widgetsOpen;
          this.vueApp.settingsOpen = false;
        }
        if (this.state.widgetsOpen) {
          this.renderWidgetsInfo();
        }
      } else {
        this.state.settingsOpen = Boolean(open);
        this.state.widgetsOpen = false;
        if (this.vueApp) {
          this.vueApp.settingsOpen = this.state.settingsOpen;
          this.vueApp.widgetsOpen = false;
          if (panelName && panelName !== 'settings') {
            this.vueApp.activeTab = panelName;
          }
        }
      }
    }

    persistConfig() {
      gm.setValue(STORAGE_KEY, this.config);
    }

    // ── Vue 响应式替代 — 以下方法保留为空壳，避免散落的调用报错 ──
    renderConfigToPanel() {
      // Vue 响应式自动更新面板，不需要手动同步 DOM
    }

    // ── 油猴菜单注册 ── 对齐 BE mounted 钩子中的 GM_registerMenuCommand ──
    // BE: 打开功能面板时关闭设置面板，反之亦然
    registerMenuCommands() {
      gm.registerMenuCommand('功能', () => this.setPanelOpen(true, 'widgets'));
      gm.registerMenuCommand('设置', () => this.setPanelOpen(true, 'settings'));
      gm.registerMenuCommand('切换视频过滤', () => {
        this.config.enableFiltering = !this.config.enableFiltering;
        this.persistConfig();
        this.refreshAll('menu:filter');
        this.toast.show(`视频过滤已${this.config.enableFiltering ? '开启' : '关闭'}`);
      });
      gm.registerMenuCommand('切换解除未登录时前端某些限制', () => {
        this.config.enableUnlock = !this.config.enableUnlock;
        this.persistConfig();
        this.refreshAll('menu:unlock');
        this.toast.show(`解除未登录时前端某些限制已${this.config.enableUnlock ? '开启' : '关闭'}`);
      });
      gm.registerMenuCommand('切换卡住自动跳过', () => {
        this.config.autoNext = !this.config.autoNext;
        this.persistConfig();
        this.toast.show(`卡住自动跳过已${this.config.autoNext ? '开启' : '关闭'}`);
      });
    }

    installObservers() {
      if (this.observer || !document.documentElement) {
        return;
      }
      this.observer = new MutationObserver((mutations) => {
        let shouldRefresh = false;
        let shouldUnlockNow = false;
        for (const mutation of mutations) {
          const target = mutation.target;
          if (target instanceof Element && target.closest && target.closest(`#${APP_ID}-root, #${APP_ID}-toast`)) {
            continue;
          }
          const nodes = [...(mutation.addedNodes || []), ...(mutation.removedNodes || [])];
          if (!nodes.length) {
            shouldRefresh = true;
            continue;
          }
          for (const node of nodes) {
            if (!(node instanceof Element)) {
              shouldRefresh = true;
              continue;
            }
            if (node.closest && node.closest(`#${APP_ID}-root, #${APP_ID}-toast`)) {
              continue;
            }
            const text = node.textContent || '';
            if (
              node.matches?.('video, #video-info-wrap, #sliderVideo, .xgplayer, .loginV2, .blockLoginText, .blockLoginBtn, #login-panel-new, #douyin-login-new-id, .douyin_login_new_class')
              || node.querySelector?.('video, #video-info-wrap, #sliderVideo, .xgplayer, .loginV2, .blockLoginText, .blockLoginBtn, #login-panel-new, #douyin-login-new-id, .douyin_login_new_class')
              || /登录|倍速|画质|清晰度/.test(text)
            ) {
              shouldRefresh = true;
              shouldUnlockNow = true;
              break;
            }
            shouldRefresh = true;
          }
          if (shouldUnlockNow) {
            break;
          }
        }
        if (shouldUnlockNow) {
          this.runUnlock();
        }
        if (shouldRefresh) {
          this.scheduleRefresh('mutation', shouldUnlockNow ? 32 : 80);
        }
      });
      this.observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
      window.addEventListener('resize', () => this.scheduleRefresh('resize', 80));
    }

    installHistoryHooks() {
      ['pushState', 'replaceState'].forEach((method) => {
        const original = history[method];
        if (original.__dypWrapped) {
          return;
        }
        history[method] = (...args) => {
          const result = original.apply(history, args);
          this.scheduleRefresh(`history:${method}`);
          return result;
        };
        history[method].__dypWrapped = true;
      });
      window.addEventListener('popstate', () => this.scheduleRefresh('popstate'));
    }

    applyLayoutHides() {
      document.querySelectorAll(`.${APP_ID}-hidden-ui`).forEach((element) => {
        if (!(element instanceof HTMLElement) || element.closest(`#${APP_ID}-root`)) {
          return;
        }
        element.classList.remove(`${APP_ID}-hidden-ui`);
      });

      if (this.config.hiddenSideTabs.length) {
        SIDE_TAB_OPTIONS.forEach((option) => {
          findSideTabTargets(option).forEach((element) => {
            element.classList.toggle(`${APP_ID}-hidden-ui`, this.config.hiddenSideTabs.includes(option.key));
          });
        });
      }

      if (this.config.hiddenTopItems.length) {
        TOP_BAR_OPTIONS.forEach((option) => {
          findTopBarTargets(option).forEach((element) => {
            element.classList.toggle(`${APP_ID}-hidden-ui`, this.config.hiddenTopItems.includes(option.key));
          });
        });
      }

      if (this.config.hiddenInteractionItems.length) {
        INTERACTION_BAR_OPTIONS.forEach((option) => {
          findInteractionBarTargets(option).forEach((element) => {
            element.classList.toggle(`${APP_ID}-hidden-ui`, this.config.hiddenInteractionItems.includes(option.key));
          });
        });
      }

      this.cleanupSideTabDividers();
    }

    cleanupSideTabDividers() {
      if (!this.config.hiddenSideTabs.length) {
        document.querySelectorAll(`.${APP_ID}-hidden-ui`).forEach((element) => {
          if (element instanceof HTMLElement && !element.closest(`#${APP_ID}-root`)) {
            element.classList.remove(`${APP_ID}-hidden-ui`);
          }
        });
        return;
      }
      const now = Date.now();
      if (now - this._layoutCleanupAt < 1200) {
        return;
      }
      this._layoutCleanupAt = now;
      const dividerCandidates = new Set();
      document.querySelectorAll('.qac7ke9k, .qac7ke9k.csHbiHH_').forEach((element) => {
        if (element instanceof HTMLElement && !element.closest(`#${APP_ID}-root`)) {
          dividerCandidates.add(element);
        }
      });
      document.querySelectorAll('div, span').forEach((element) => {
        if (!(element instanceof HTMLElement) || element.closest(`#${APP_ID}-root`)) {
          return;
        }
        const text = (element.innerText || element.textContent || '').trim();
        if (text) {
          return;
        }
        const style = window.getComputedStyle(element);
        const borderBottom = parseFloat(style.borderBottomWidth || '0');
        if (borderBottom < 1) {
          return;
        }
        const rect = element.getBoundingClientRect();
        if (rect.width < 24 || rect.height > 24) {
          return;
        }
        if (rect.left > window.innerWidth * 0.45) {
          return;
        }
        dividerCandidates.add(element);
      });

      Array.from(dividerCandidates)
        .sort((left, right) => left.getBoundingClientRect().top - right.getBoundingClientRect().top)
        .forEach((element, index) => {
          element.classList.toggle(`${APP_ID}-hidden-ui`, index > 0);
        });
    }

    installHotkeys() {
      document.addEventListener('keydown', (event) => this.handleKeyDown(event), true);
      document.addEventListener('keyup', (event) => this.handleKeyUp(event), true);
      window.addEventListener('keydown', (event) => this.handleKeyDown(event), true);
      window.addEventListener('keyup', (event) => this.handleKeyUp(event), true);
      window.addEventListener('blur', () => this.cancelSpeedBoost());
    }

    installLoginIntentTracker() {
      document.addEventListener(
        'click',
        (event) => {
          const target = event.target;
          if (!(target instanceof Element)) {
            return;
          }
          const hit = target.closest('button, a, div, span');
          if (!(hit instanceof HTMLElement)) {
            return;
          }
          const text = (hit.innerText || hit.textContent || '').replace(/\s+/g, '');
          const classText = `${hit.className || ''}`;
          const href = hit.getAttribute('href') || '';
          if (
            text === '登录' ||
            /扫码登录|验证码登录|密码登录|账号登录|手机号登录/.test(text) ||
            /login/i.test(classText) ||
            /login/i.test(href)
          ) {
            this.state.manualLoginMode = true;
            const b = getMainWorldBridge();
            if (b) { b._manualLoginMode = true; }
          }
        },
        true,
      );
    }

    handleKeyDown(event) {
      if (event.__dypHotkeyHandled) {
        return;
      }
      event.__dypHotkeyHandled = true;

      const target = event.target;
      const isEditable = target instanceof HTMLElement && (
        target.isContentEditable ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      );

      if (isEditable) {
        return;
      }

      const key = String(event.key || '');
      const lowerKey = key.toLowerCase();
      if (!event.altKey && !event.ctrlKey && !event.metaKey) {
        // a/d 和左右方向键：短按 seek，长按加速/减速（holdToSpeed 开启时）
        const isSeekKey = key === 'ArrowLeft' || key === 'ArrowRight' || lowerKey === 'a' || lowerKey === 'd';
        if (isSeekKey && !event.repeat) {
          event.preventDefault();
          event.__dypAllowStop = true;
          event.stopPropagation();
          const isBackward = key === 'ArrowLeft' || lowerKey === 'a';

          // 如果 holdToSpeed 开启，走"短按seek / 长按加速"逻辑
          if (this.config.holdToSpeed) {
            const video = this.getPlayableVideo();
            if (video && !this.state.speedBoost.active && !this.state.speedBoost._holdTimer) {
              const restoreRate = clamp(Number(video.playbackRate || this.config.defaultPlaybackRate || 1), 0.1, 16, 1);
              const seekKey = lowerKey || key.toLowerCase();
              this.state.speedBoost._holdTimer = setTimeout(() => {
                this.state.speedBoost._holdTimer = null;
                if (this.state.speedBoost.keys.has(seekKey)) {
                  this.state.speedBoost.active = true;
                  this.state.speedBoost.originalRate = restoreRate;
                  const targetRate = isBackward ? this.config.holdSlowSpeed : this.config.holdSpeed;
                  this.state.speedBoost.targetRate = targetRate;
                  this.setVideoRate(video, targetRate);
                  this.updateQuickButtons();
                }
              }, 200);
            }
            this.state.speedBoost.keys.add(lowerKey || key.toLowerCase());
          } else {
            // holdToSpeed 关闭时，直接 seek
            const delta = isBackward
              ? -Math.abs(Number(this.config.seekStepSeconds || DEFAULT_CONFIG.seekStepSeconds))
              : Math.abs(Number(this.config.seekStepSeconds || DEFAULT_CONFIG.seekStepSeconds));
            if (this.seekPlayableVideo(delta)) {
              this.toast.show(`${isBackward ? '后退' : '前进'} ${Math.abs(delta)} 秒`);
            }
          }
          return;
        }
        if ((key === 'ArrowDown' || lowerKey === 's') && !event.repeat) {
          event.preventDefault();
          event.__dypAllowStop = true;
          event.stopPropagation();
          this.goToNextVideo(key === 'ArrowDown' ? 'ArrowDown' : 'S');
          return;
        }
        if ((key === 'ArrowUp' || lowerKey === 'w') && !event.repeat) {
          event.preventDefault();
          event.__dypAllowStop = true;
          event.stopPropagation();
          this.goToPrevVideo(key === 'ArrowUp' ? 'ArrowUp' : 'W');
          return;
        }
      }

      if (event.shiftKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        event.__dypAllowStop = true;
        event.stopPropagation();
        this.goToNextVideo('hotkey');
        return;
      }

      if (!this.config.holdToSpeed || !this.isBoostHotkey(key)) {
        return;
      }

      const video = this.getPlayableVideo();
      if (!video) {
        return;
      }

      event.preventDefault();
      event.__dypAllowStop = true;
      event.stopPropagation();

      if (this.state.speedBoost.active) {
        return;
      }

      if (!this.state.speedBoost._holdTimer) {
        const restoreRate = clamp(Number(video.playbackRate || this.state.currentVideo?.playbackRate || this.config.defaultPlaybackRate || 1), 0.1, 16, 1);
        const boostKey = lowerKey;
        this.state.speedBoost._holdTimer = setTimeout(() => {
          this.state.speedBoost._holdTimer = null;
          if (this.state.speedBoost.keys.has(boostKey)) {
            this.state.speedBoost.active = true;
            this.state.speedBoost.originalRate = restoreRate;
            const targetRate = boostKey === 'a' ? this.config.holdSlowSpeed : this.config.holdSpeed;
            this.state.speedBoost.targetRate = targetRate;
            this.setVideoRate(video, targetRate);
            this.updateQuickButtons();
          }
        }, 200);
      }
      this.state.speedBoost.keys.add(lowerKey);
    }

    handleKeyUp(event) {
      if (event.__dypHotkeyHandled) {
        return;
      }
      event.__dypHotkeyHandled = true;

      const key = String(event.key || '');
      const lowerKey = key.toLowerCase();
      // 处理所有 seek/boost 键的 keyup：a/d 和左右方向键
      const isSeekBoostKey = key === 'ArrowLeft' || key === 'ArrowRight' || lowerKey === 'a' || lowerKey === 'd';
      if (!this.config.holdToSpeed || !isSeekBoostKey) {
        return;
      }
      event.preventDefault();
      event.__dypAllowStop = true;
      event.stopPropagation();
      const releaseKey = lowerKey || key.toLowerCase();
      const isBackward = key === 'ArrowLeft' || lowerKey === 'a';
      this.state.speedBoost.keys.delete(releaseKey);
      if (this.state.speedBoost._holdTimer) {
        clearTimeout(this.state.speedBoost._holdTimer);
        this.state.speedBoost._holdTimer = null;
        // 短按：执行 seek
        const delta = isBackward
          ? -Math.abs(Number(this.config.seekStepSeconds || DEFAULT_CONFIG.seekStepSeconds))
          : Math.abs(Number(this.config.seekStepSeconds || DEFAULT_CONFIG.seekStepSeconds));
        if (this.seekPlayableVideo(delta)) {
          this.toast.show(`${isBackward ? '后退' : '前进'} ${Math.abs(delta)} 秒`);
        }
        return;
      }
      if (!this.state.speedBoost.keys.size) {
        this.cancelSpeedBoost();
      }
    }

    cancelSpeedBoost() {
      if (this.state.speedBoost._holdTimer) {
        clearTimeout(this.state.speedBoost._holdTimer);
        this.state.speedBoost._holdTimer = null;
      }
      if (!this.state.speedBoost.active) {
        return;
      }
      this.state.speedBoost.active = false;
      const restoreRate = this.state.speedBoost.originalRate || this.config.defaultPlaybackRate || 1;
      const video = this.state.currentVideo || getRuntimeVideo(this.getCurrentRuntimePlayer());
      if (video) {
        this.setVideoRate(video, restoreRate);
      } else {
        // fallback: 直接通过 bridge 恢复
        const bridge = getMainWorldBridge();
        if (bridge && typeof bridge.setPlaybackRate === 'function') {
          bridge.setPlaybackRate(restoreRate);
        }
      }
      this.state.speedBoost.keys.clear();
      this.updateQuickButtons();
    }

    scheduleRefresh(reason, delay = 80) {
      if (this.state._isRefreshing) return;
      window.clearTimeout(this.state.refreshTimer);
      this.state.refreshTimer = window.setTimeout(() => this.refreshAll(reason), Math.max(0, Number(delay) || 0));
    }

    refreshAll(reason) {
      if (this.state._isRefreshing) return;
      const now = Date.now();
      if (now - (this.state._lastRefreshAt || 0) < 150) return;
      this.state._isRefreshing = true;
      this.state._lastRefreshAt = now;
      try {
        this.state.routeKind = currentPathKind();
        this.refreshCurrentContext();
        this.runUnlock();
        this.applyLayoutHides();
        this.applyFilters();
        this.renderWidgetsInfo();
        this.updateQuickButtons();
        if (this.state.lastPath !== location.href) {
          this.state.lastPath = location.href;
        }
      } finally {
        this.state._isRefreshing = false;
      }
    }

    refreshCurrentContext() {
      const runtimePlayer = this.getCurrentRuntimePlayer();
      const runtimeMeta = this.getCurrentRuntimeMeta(runtimePlayer);
      const video = getRuntimeVideo(runtimePlayer) || findPrimaryVideo();
      if (video !== this.state.currentVideo) {
        this.bindCurrentVideo(video);
      }

      const fallbackCard = document.querySelector('.basePlayerContainer');
      const card = pickCurrentFeedCard(runtimeMeta.awemeId || '', video) || findClosestCard(video || fallbackCard || null);
      if (card !== this.state.currentCard) {
        this.state.currentCard = card;
        this.attachQuickButtons(card);
      }

      if (runtimeMeta.awemeId) {
        this.collector.updateAwemeMeta(runtimeMeta);
      }
      this.state.currentMeta = this.resolveCurrentMeta(card, video);
      const currentContentTypeKey = getContentTypeKey(this.state.currentMeta);
      if (currentContentTypeKey === 'live') {
        // 独立开关：自动跳过直播
        if (this.config.autoSkipLive) {
          this.toast.show('检测到直播，自动跳过');
          this.goToNextVideo('live-skip');
          return;
        }
      }
    }

    resolveCurrentMeta(card, video) {
      const runtimeMeta = this.getCurrentRuntimeMeta();
      const awemeIdFromPath = location.pathname.match(/\/video\/(\d{18,20})/)?.[1] || '';
      const fallbackAwemeId = runtimeMeta.awemeId || extractAwemeIdFromElement(card || video || document.querySelector('#sliderVideo')) || awemeIdFromPath;
      const reactMeta = card ? extractReactCardMeta(card) : null;
      const preciseMeta = extractInfoRootMeta(document.querySelector('#video-info-wrap'), fallbackAwemeId, card?.innerText || '');
      const cardMeta = card ? extractCardMeta(card) : createEmptyMeta({
        awemeId: fallbackAwemeId,
        isLive: isLivePage() || inferContentType(document.title) === '直播',
      });
      const domMeta = createEmptyMeta({
        ...cardMeta,
        ...(reactMeta || {}),
        ...(preciseMeta || {}),
        awemeId: preciseMeta?.awemeId || reactMeta?.awemeId || cardMeta.awemeId || fallbackAwemeId,
        author: preciseMeta?.author || reactMeta?.author || cardMeta.author || '',
        title: preciseMeta?.title || reactMeta?.title || cardMeta.title || '',
        fullText: preciseMeta?.fullText || reactMeta?.fullText || cardMeta.fullText || '',
        isLive: Boolean(preciseMeta?.isLive || reactMeta?.isLive || cardMeta.isLive || isLivePage()),
      });
      const baseMeta = domMeta.isLive
        ? createEmptyMeta({
          ...runtimeMeta,
          ...domMeta,
          awemeId: domMeta.awemeId || runtimeMeta.awemeId || fallbackAwemeId,
          author: domMeta.author || runtimeMeta.author || '',
          title: domMeta.title || runtimeMeta.title || '',
          fullText: domMeta.fullText || runtimeMeta.fullText || '',
          isLive: true,
          contentType: '直播',
        })
        : createEmptyMeta({
          ...domMeta,
          ...runtimeMeta,
          awemeId: runtimeMeta.awemeId || domMeta.awemeId || fallbackAwemeId,
        });
      const awemeMeta = baseMeta.awemeId ? this.collector.getAwemeMeta(baseMeta.awemeId) : null;
      const duration = baseMeta.duration || (Number.isFinite(video?.duration) && video.duration > 1
        ? Math.round(video.duration)
        : 0);
      const author = baseMeta.author || awemeMeta?.author || '';
      const title = cleanTitleText(baseMeta.title || awemeMeta?.title || '');
      const fullText = baseMeta.fullText || [author ? `@${author}` : '', title].filter(Boolean).join('\n');
      const isLive = Boolean(baseMeta.isLive || isLivePage());

      return createEmptyMeta({
        ...baseMeta,
        awemeId: baseMeta.awemeId || fallbackAwemeId,
        author,
        title,
        duration,
        durationText: duration ? formatDuration(duration) : '',
        isLive,
        contentType: isLive ? '直播' : '视频',
        fullText,
        lines: baseMeta.lines?.length ? baseMeta.lines : getTextLines(fullText),
      });
    }

    bindCurrentVideo(video) {
      if (this.videoCleanup) {
        this.videoCleanup();
        this.videoCleanup = null;
      }
      this.state.currentVideo = video;
      if (!video) {
        return;
      }

      const onLoaded = () => {
        this.applyPreferredRate();
        this.applyPreferredClarity();
        this.refreshCurrentContext();
        this.renderWidgetsInfo();
        this.touchStallProgress(video);
      };
      const onRateChange = () => {
        if (!this.state.speedBoost.active && Date.now() >= (this._rateSyncLockUntil || 0)) {
          const currentRate = clamp(Number(video.playbackRate || this.config.defaultPlaybackRate || 1), 0.1, 16, 1);
          if (Math.abs(Number(this.config.defaultPlaybackRate || 1) - currentRate) > 0.01) {
            this.syncManualSelectedRate(currentRate);
          }
        }
        this.syncNativeSpeedBtnText(video.playbackRate || this.config.defaultPlaybackRate || 1);
        this.updateQuickButtons();
        this.renderWidgetsInfo();
      };
      const onEnded = () => {
        this.touchStallProgress(video);
      };
      const onPlay = () => {
        if (this.config.enableUnlock) {
          this.runUnlock();
        }
        const expectedRate = clamp(Number(this.config.defaultPlaybackRate || 1), 0.1, 16, 1);
        if (!this.state.speedBoost.active && Math.abs(Number(video.playbackRate || 1) - expectedRate) > 0.01) {
          this._rateSyncLockUntil = Date.now() + 1500;
          this.setVideoRate(video, expectedRate);
        }
        this.touchStallProgress(video);
      };
      const onProgress = () => this.touchStallProgress(video);
      const onWaiting = () => this.touchStallProgress(video);
      const onTimeUpdate = () => this.touchStallProgress(video);

      video.addEventListener('loadedmetadata', onLoaded);
      video.addEventListener('ratechange', onRateChange);
      video.addEventListener('ended', onEnded);
      video.addEventListener('play', onPlay);
      video.addEventListener('progress', onProgress);
      video.addEventListener('waiting', onWaiting);
      video.addEventListener('timeupdate', onTimeUpdate);

      this.videoCleanup = () => {
        video.removeEventListener('loadedmetadata', onLoaded);
        video.removeEventListener('ratechange', onRateChange);
        video.removeEventListener('ended', onEnded);
        video.removeEventListener('play', onPlay);
        video.removeEventListener('progress', onProgress);
        video.removeEventListener('waiting', onWaiting);
        video.removeEventListener('timeupdate', onTimeUpdate);
      };

      this.applyPreferredRate();
    }

    setVideoRate(video, rate) {
      if (!video) {
        return;
      }
      const value = clamp(rate, 0.1, 16, 1);
      // 先通过 bridge 移除 >3x 限制再设置，避免被 ratechange 回调重置
      const bridge = getMainWorldBridge();
      if (bridge && typeof bridge.setPlaybackRate === 'function') {
        try {
          bridge.setPlaybackRate(value);
          this.syncNativeSpeedBtnText(value);
          return;
        } catch (error) {
          console.debug(APP_NAME, 'sync bridge playback rate failed', error);
        }
      }
      video.defaultPlaybackRate = value;
      video.playbackRate = value;
      this.syncNativeSpeedBtnText(value);
      const player = this.getCurrentRuntimePlayer();
      if (player && player.video === video && typeof player.emit === 'function') {
        try {
          player.emit('UpdateRadio', { rate: value, click_method: 'douyinplus' });
        } catch (error) {
          console.debug(APP_NAME, 'sync native playback rate failed', error);
        }
      }
    }

    syncNativeSpeedBtnText(rate) {
      const label = formatPlaybackRateLabel(rate);
      document.querySelectorAll('.xgplayer-setting-playbackRatio').forEach((el) => {
        el.textContent = label;
      });
    }

    applyPreferredRate() {
      const video = this.state.currentVideo;
      if (!video) {
        return;
      }
      if (this.state.speedBoost.active) {
        this.setVideoRate(video, this.state.speedBoost.targetRate);
        return;
      }
      const nextRate = clamp(Number(this.config.defaultPlaybackRate || 1), 0.1, 16, 1);
      if (Math.abs(Number(video.playbackRate || 1) - nextRate) > 0.01) {
        this._rateSyncLockUntil = Date.now() + 1500;
        this.setVideoRate(video, nextRate);
      } else {
        this.syncNativeSpeedBtnText(nextRate);
      }
    }

    applyPreferredClarity() {
      const maxHeight = this.config.preferredClarity;
      if (!maxHeight || !this.config.enableUnlock) return;
      // 防止手动切画质后 loadedmetadata 又触发自动切换
      if (this.state._claritySwitching) return;
      const bridge = getMainWorldBridge();
      if (!bridge || typeof bridge.applyPreferredClarity !== 'function') return;
      this.state._claritySwitching = true;
      // 延迟执行，等 definitionList 就绪；如果第一次没切成功就再试一次
      const tryApply = (attempt) => {
        const ok = bridge.applyPreferredClarity(maxHeight);
        if (!ok && attempt < 3) {
          window.setTimeout(() => tryApply(attempt + 1), 500);
        } else {
          if (ok) this.syncNativeClarityUI(maxHeight);
          window.setTimeout(() => { this.state._claritySwitching = false; }, 2000);
        }
      };
      window.setTimeout(() => tryApply(1), 500);
    }

    syncNativeClarityUI(maxHeight) {
      // 同步原生画质面板的选中状态和底栏按钮文字
      // 如果没传 maxHeight，尝试从实际视频分辨率推断
      if (!maxHeight) {
        const video = this.state.currentVideo;
        if (video && video.videoWidth && video.videoHeight) {
          maxHeight = Math.min(video.videoWidth, video.videoHeight);
        }
      }
      if (!maxHeight) return;
      document.querySelectorAll('.xgplayer-playclarity-setting').forEach((panel) => {
        const items = panel.querySelectorAll('.item');
        let bestMatch = null;
        items.forEach((item) => {
          const text = item.textContent || '';
          const m = text.match(/(\d+)[PpKk]/);
          if (!m) return;
          const num = m[1];
          const heightMap = { '2': 1440, '4': 2160 };
          const h = num.length >= 3 ? Number(num) : (heightMap[num] || 0);
          if (h > 0 && h <= maxHeight) {
            if (!bestMatch || h > bestMatch.h) {
              bestMatch = { el: item, h };
            }
          }
        });
        if (bestMatch) {
          items.forEach((el) => el.classList.remove('selected'));
          bestMatch.el.classList.add('selected');
          const btn = panel.querySelector('.btn');
          if (btn) {
            btn.textContent = bestMatch.el.textContent.replace(/登录即享/g, '').trim();
          }
        }
      });
    }

    enforcePlaybackRate() {
      const video = this.state.currentVideo;
      if (!video) {
        return;
      }
      const expectedRate = this.state.speedBoost.active
        ? this.state.speedBoost.targetRate
        : video.playbackRate;
      if (Math.abs(video.playbackRate - expectedRate) > 0.02) {
        this.setVideoRate(video, expectedRate);
      }
      // 持续同步倍速按钮文字
      this.syncNativeSpeedBtnText(video.playbackRate);
      // 持续 enforce 画质偏好：如果实际分辨率超过偏好上限，重新切换
      const maxH = this.config.preferredClarity;
      if (maxH && this.config.enableUnlock && !this.state._claritySwitching) {
        const actualQ = Math.min(video.videoWidth || 0, video.videoHeight || 0);
        if (actualQ > maxH + 10) {
          this.applyPreferredClarity();
        }
      }
      // 用偏好值同步画质 UI（偏好开启时显示偏好对应的档位）
      if (this.config.preferredClarity && this.config.enableUnlock) {
        this.syncNativeClarityUI(this.config.preferredClarity);
      }
    }

    runUnlock() {
      this.unlockNativePlayerSpeed();
      this.relaxPlayerControls();
      const bridge = getMainWorldBridge();
      if (!this.config.enableUnlock) {
        document.querySelectorAll(`.${APP_ID}-hidden-login`).forEach((node) => {
          node.classList.remove(`${APP_ID}-hidden-login`);
        });
        this.state.manualLoginMode = false;
        if (bridge) { bridge._manualLoginMode = false; }
        return;
      }

      // 如果用户手动点击了登录，不干预
      if (this.state.manualLoginMode) {
        return;
      }

      // 通过 React fiber 调用关闭回调（组件正常卸载，useEffect cleanup 会执行）
      // cleanup 会：移除 keydown stopPropagation listener、emit videoRemoveStopPlayNext
      // 这样抖音就不会自动暂停视频、不会阻止视频切换
      if (bridge && typeof bridge.dismissLoginPanel === 'function') {
        bridge.dismissLoginPanel();
      }

      // 对于非 React 管理的登录提示元素，CSS 隐藏
      document.querySelectorAll('.blockLoginText, .blockLoginBtn, .loginV2').forEach((node) => {
        if (!(node instanceof HTMLElement) || node.closest(`#${APP_ID}-root`)) {
          return;
        }
        if (!node.classList.contains(`${APP_ID}-hidden-login`)) {
          node.classList.add(`${APP_ID}-hidden-login`);
          node.style.display = 'none';
          node.style.pointerEvents = 'none';
        }
      });

      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
    }

    relaxPlayerControls() {
      const player = this.state.currentVideo?.closest('.xgplayer') || document.querySelector('.xgplayer');
      if (!(player instanceof HTMLElement)) {
        return;
      }

      player.querySelectorAll('.loginV2, .blockLoginText, .blockLoginBtn').forEach((node) => {
        if (!(node instanceof HTMLElement)) {
          return;
        }
        if (!node.classList.contains(`${APP_ID}-hidden-login`)) {
          node.classList.add(`${APP_ID}-hidden-login`);
          node.style.display = 'none';
          node.style.visibility = 'hidden';
          node.style.opacity = '0';
          node.style.pointerEvents = 'none';
        }
      });
      player.querySelectorAll('.xgTips').forEach((node) => {
        if (!(node instanceof HTMLElement)) {
          return;
        }
        const text = node.innerText || node.textContent || '';
        if (/登录后即可切换倍速|立即登录|登录后免费畅享高清视频|登录即享/.test(text)) {
          node.classList.add(`${APP_ID}-hidden-login`);
          node.style.display = 'none';
          node.style.visibility = 'hidden';
          node.style.opacity = '0';
          node.style.pointerEvents = 'none';
        }
      });

      player.querySelectorAll('[disabled], [aria-disabled="true"]').forEach((node) => {
        if (!(node instanceof HTMLElement)) {
          return;
        }
        const text = (node.innerText || node.textContent || '').replace(/\s+/g, '');
        if (!/登录即享|倍速|画质|清晰|高清|超清|标清|1080|720|480|2x|1\.5x|1\.25x/.test(text)) {
          return;
        }
        node.removeAttribute('disabled');
        node.setAttribute('aria-disabled', 'false');
        node.style.pointerEvents = 'auto';
      });

      player.querySelectorAll('.xgplayer-playback-setting, .xgplayer-setting-playbackRatio, .xgplayer-playratio-item').forEach((node) => {
        if (!(node instanceof HTMLElement)) {
          return;
        }
        node.style.pointerEvents = 'auto';
        node.style.cursor = 'pointer';
      });

      // 画质面板选项也解除限制
      player.querySelectorAll('.xgplayer-playclarity-setting .item, .xgplayer-playclarity-setting .clarity-wrapper').forEach((node) => {
        if (!(node instanceof HTMLElement)) {
          return;
        }
        node.style.pointerEvents = 'auto';
        node.style.cursor = 'pointer';
      });
    }

    getFilterReasons(meta) {
      if (!this.config.enableFiltering) {
        return [];
      }
      const reasons = [];
      const lowerText = meta.fullText.toLowerCase();
      const lowerAuthor = meta.author.toLowerCase();

      for (const keyword of this.config.keywordBlacklist) {
        if (keyword && lowerText.includes(keyword.toLowerCase())) {
          reasons.push(`关键词：${keyword}`);
          break;
        }
      }
      for (const author of this.config.authorBlacklist) {
        if (author && lowerAuthor.includes(author.toLowerCase())) {
          reasons.push(`作者：${author}`);
          break;
        }
      }
      if (this.config.minDuration > 0 && meta.duration > 0 && meta.duration < this.config.minDuration) {
        reasons.push(`时长小于 ${this.config.minDuration}s`);
      }
      if (this.config.maxDuration > 0 && meta.duration > 0 && meta.duration > this.config.maxDuration) {
        reasons.push(`时长大于 ${this.config.maxDuration}s`);
      }
      return reasons;
    }

    getCardHideTargets(card) {
      const targets = new Set();
      if (!(card instanceof HTMLElement)) {
        return targets;
      }
      targets.add(card);
      [
        '.slider-video',
        '.discover-video-card-item',
        '[class*="feed-card"]',
        '[class*="feedCard"]',
        '[data-e2e="feed-item"]',
      ].forEach((selector) => {
        const hit = card.closest(selector);
        if (hit instanceof HTMLElement) {
          targets.add(hit);
        }
      });
      return targets;
    }

    isCurrentActiveCard(card, currentAwemeId = '', currentVideo = this.state.currentVideo) {
      if (!(card instanceof HTMLElement)) {
        return false;
      }
      const currentCard = this.state.currentCard;
      if (card === currentCard || card.contains(currentCard) || currentCard?.contains(card)) {
        return true;
      }
      if (currentVideo instanceof HTMLVideoElement && (card === currentVideo || card.contains(currentVideo))) {
        return true;
      }
      const reactMeta = extractReactCardMeta(card);
      const cardAwemeId = reactMeta?.awemeId || extractAwemeIdFromElement(card);
      if (currentAwemeId && cardAwemeId && cardAwemeId === currentAwemeId) {
        return true;
      }
      const rect = card.getBoundingClientRect();
      const centerY = window.innerHeight / 2;
      const centerX = window.innerWidth / 2;
      return rect.width > 180
        && rect.height > 180
        && rect.top <= centerY
        && rect.bottom >= centerY
        && rect.left <= centerX
        && rect.right >= centerX;
    }

    applyFilters() {
      if (!this.config.enableFiltering) {
        document.querySelectorAll(`.${APP_ID}-hidden-card`).forEach((target) => {
          if (target instanceof HTMLElement) {
            target.classList.remove(`${APP_ID}-hidden-card`);
          }
        });
        return;
      }
      const hasRules = this.config.keywordBlacklist.some(Boolean)
        || this.config.authorBlacklist.some(Boolean)
        || Number(this.config.minDuration) > 0
        || Number(this.config.maxDuration) > 0;
      if (!hasRules) {
        document.querySelectorAll(`.${APP_ID}-hidden-card`).forEach((target) => {
          if (target instanceof HTMLElement) {
            target.classList.remove(`${APP_ID}-hidden-card`);
          }
        });
        return;
      }
      const cards = getCardCandidates();
      const currentAwemeId = this.state.currentMeta?.awemeId || this.getCurrentRuntimeMeta().awemeId || '';
      const currentVideo = this.state.currentVideo;
      let currentFiltered = false;
      const removeFromFeed = [];
      cards.forEach((card) => {
        const cardMeta = extractCardMeta(card);
        const reactMeta = extractReactCardMeta(card);
        const meta = createEmptyMeta({
          ...cardMeta,
          ...(reactMeta || {}),
          awemeId: reactMeta?.awemeId || cardMeta.awemeId || '',
          author: reactMeta?.author || cardMeta.author || '',
          title: reactMeta?.title || cardMeta.title || '',
          fullText: reactMeta?.fullText || cardMeta.fullText || '',
          isLive: Boolean(reactMeta?.isLive || cardMeta.isLive),
          contentType: (reactMeta?.isLive || cardMeta.isLive) ? '直播' : (reactMeta?.contentType || cardMeta.contentType || ''),
        });
        const reasons = this.getFilterReasons(meta);
        const hideTargets = this.getCardHideTargets(card);
        const isCurrentCard = this.isCurrentActiveCard(card, currentAwemeId, currentVideo);
        if (reasons.length) {
          if (isCurrentCard) {
            currentFiltered = true;
            hideTargets.forEach((target) => target.classList.remove(`${APP_ID}-hidden-card`));
          } else {
            hideTargets.forEach((target) => target.classList.add(`${APP_ID}-hidden-card`));
            if (meta.awemeId) {
              removeFromFeed.push(meta.awemeId);
            }
          }
          this.state.hideReasons.set(card, reasons);
        } else {
          hideTargets.forEach((target) => target.classList.remove(`${APP_ID}-hidden-card`));
          this.state.hideReasons.delete(card);
        }
      });

      if (removeFromFeed.length) {
        try {
          const bridge = getMainWorldBridge();
          if (bridge && typeof bridge.removeFeedItems === 'function') {
            const result = bridge.removeFeedItems(removeFromFeed);
            if (result && result.removed > 0) {
              console.debug(APP_NAME, '从播放列表移除了', result.removed, '条被过滤的视频');
            }
          }
        } catch (error) {
          console.warn(APP_NAME, '移除播放列表项失败', error);
        }
      }

      if (currentFiltered && this.config.enableFiltering) {
        this.goToNextVideo('filter');
      }
    }

    renderWidgetsInfo() {
      if (!this.state.widgetsOpen) {
        return;
      }
      const meta = this.state.currentMeta;
      const video = this.state.currentVideo;
      const currentRate = video ? Number(video.playbackRate || 1).toFixed(2) : '--';
      const currentSrc = video?.currentSrc || '';
      const routeLabel = ROUTE_LABELS[this.state.routeKind] || this.state.routeKind || '未知';

      // 视频技术信息
      let resolution = '--';
      let bitrate = '--';
      let fps = '--';
      let codec = '--';
      let dropped = '--';
      if (video) {
        const w = video.videoWidth || 0;
        const h = video.videoHeight || 0;
        resolution = w && h ? `${w}×${h}` : '--';
        const src = video.currentSrc || video.src || '';
        const brMatch = src.match(/[?&](?:br|bt)=(\d+)/i);
        bitrate = brMatch ? `${Math.round(Number(brMatch[1]) / 1000)} kbps` : '--';
        codec = src.match(/codec[_=]([^&]+)/i)?.[1]
          || (src.includes('h265') || src.includes('265') ? 'H265'
            : src.includes('h264') || src.includes('264') ? 'H264' : '--');
        try {
          const quality = video.getVideoPlaybackQuality?.();
          const totalFrames = quality?.totalVideoFrames || 0;
          const currentTime = video.currentTime || 0;
          if (totalFrames > 10 && currentTime > 0.5) {
            fps = `${Math.round(totalFrames / currentTime)}`;
          }
        } catch (error) { }
        try {
          dropped = String(video.getVideoPlaybackQuality?.()?.droppedVideoFrames ?? '--');
        } catch (error) { }
      }

      // 直播状态
      const isLive = meta.isLive || false;
      const liveStatus = isLive ? '直播中' : '非直播';

      const html = `
        <div class="${APP_ID}-info-row"><span class="${APP_ID}-info-label">页面</span><span class="${APP_ID}-info-value">${escapeHtml(routeLabel)}</span></div>
        <div class="${APP_ID}-info-row"><span class="${APP_ID}-info-label">类型</span><span class="${APP_ID}-info-value">${escapeHtml(meta.contentType || (isLive ? '直播' : '视频'))}</span></div>
        <div class="${APP_ID}-info-row"><span class="${APP_ID}-info-label">作者</span><span class="${APP_ID}-info-value">${escapeHtml(meta.author || '未识别')}</span></div>
        <div class="${APP_ID}-info-row"><span class="${APP_ID}-info-label">标题</span><span class="${APP_ID}-info-value">${escapeHtml(meta.title || '未稳定拿到')}</span></div>
        <div class="${APP_ID}-info-row"><span class="${APP_ID}-info-label">倍速</span><span class="${APP_ID}-info-value">${escapeHtml(currentRate)}x${this.state.speedBoost.active ? '（长按中）' : ''}</span></div>
        <div class="${APP_ID}-info-row"><span class="${APP_ID}-info-label">视频 ID</span><span class="${APP_ID}-info-value">${escapeHtml(meta.awemeId || '未识别')}</span></div>
        <div class="${APP_ID}-info-row"><span class="${APP_ID}-info-label">分辨率</span><span class="${APP_ID}-info-value">${resolution}</span></div>
        <div class="${APP_ID}-info-row"><span class="${APP_ID}-info-label">码率</span><span class="${APP_ID}-info-value">${bitrate}</span></div>
        <div class="${APP_ID}-info-row"><span class="${APP_ID}-info-label">帧率</span><span class="${APP_ID}-info-value">${fps} fps</span></div>
        <div class="${APP_ID}-info-row"><span class="${APP_ID}-info-label">编码</span><span class="${APP_ID}-info-value">${escapeHtml(String(codec))}</span></div>
        <div class="${APP_ID}-info-row"><span class="${APP_ID}-info-label">丢帧</span><span class="${APP_ID}-info-value">${dropped}</span></div>
        <div class="${APP_ID}-info-row"><span class="${APP_ID}-info-label">直播</span><span class="${APP_ID}-info-value ${isLive ? APP_ID + '-live-badge' : ''}">${liveStatus}</span></div>
        <div class="${APP_ID}-info-row ${APP_ID}-info-src"><span class="${APP_ID}-info-label">源地址</span><span class="${APP_ID}-info-value">${escapeHtml(currentSrc || '还没拿到')}</span></div>
      `;
      if (this.vueApp) { this.vueApp.widgetsInfoHtml = html; }
    }

    renderDebugInfo() {
      const player = this.getCurrentRuntimePlayer();
      const video = getRuntimeVideo(player) || this.state.currentVideo;
      const bridge = getMainWorldBridge();
      const snapshot = this.getRuntimeSnapshot();
      const meta = this.state.currentMeta || createEmptyMeta();
      const lines = [
        `页面: ${location.href}`,
        `路由: ${this.state.routeKind || '未知'}`,
        `主世界桥: ${bridge ? `已连接 (version=${bridge.version || 'unknown'})` : '未连接'}`,
        `当前播放器: ${player ? '已找到' : '未找到'}`,
        `当前视频元素: ${video ? '已找到' : '未找到'}`,
        `实际倍速: ${video ? formatPlaybackRateLabel(video.playbackRate || 1) : '--'}`,
        `默认倍速: ${formatPlaybackRateLabel(this.config.defaultPlaybackRate || 1)}`,
        `视频源地址: ${snapshot?.currentSrc || video?.currentSrc || video?.src || '未拿到'}`,
        `视频ID: ${meta.awemeId || '未识别'}`,
        `作者: ${meta.author || '未识别'}`,
        `标题: ${meta.title || '未识别'}`,
        `分辨率: ${video ? `${video.videoWidth || 0}×${video.videoHeight || 0}` : '--'}`,
        `倍速按钮: ${document.querySelector('.xgplayer-setting-playbackRatio, .xgplayer-playback-setting') ? '已找到' : '未找到'}`,
        `视频信息容器: ${document.querySelector('#video-info-wrap') ? '已找到' : '未找到'}`,
      ];
      if (this.vueApp) {
        this.vueApp.debugInfoHtml = lines.join('\n');
      }
      return lines.join('\n');
    }


    ensureQuickButtons() {
      if (this.ui.quick) {
        return;
      }
      const quick = document.createElement('div');
      quick.className = `${APP_ID}-quick-tools`;
      quick.innerHTML = `
        <button type="button" data-action="next">下一条</button>
        <button type="button" data-action="speed">倍速 1x</button>
      `;
      this.ui.quick = quick;
    }

    attachQuickButtons(card) {
      if (!this.ui.quick) {
        this.ensureQuickButtons();
      }
      if (!this.config.enableMiniButtons || !(card instanceof HTMLElement)) {
        this.ui.quick.remove();
        this.state.currentQuickHost = null;
        return;
      }
      if (getComputedStyle(card).position === 'static') {
        card.style.position = 'relative';
      }
      if (this.state.currentQuickHost !== card) {
        card.appendChild(this.ui.quick);
        this.state.currentQuickHost = card;
      }
    }

    updateQuickButtons() {
      if (!this.ui.quick) {
        return;
      }
      const speedButton = this.ui.quick.querySelector('[data-action="speed"]');
      if (!(speedButton instanceof HTMLButtonElement)) {
        return;
      }
      const rate = this.state.currentVideo ? Number(this.state.currentVideo.playbackRate || 1) : this.config.defaultPlaybackRate;
      speedButton.textContent = `倍速 ${formatPlaybackRateLabel(rate)}`;
      if (!this.config.enableMiniButtons || !(this.state.currentCard instanceof HTMLElement)) {
        this.ui.quick.style.display = 'none';
      } else {
        this.ui.quick.style.display = 'flex';
      }
    }

    cycleSpeedPreset() {
      const presets = [0.75, 1, 1.25, 1.5, 1.75, 2, 3, 4];
      const video = this.state.currentVideo;
      const current = Number(video?.playbackRate || this.config.defaultPlaybackRate || 1);
      let next = presets[0];
      for (const preset of presets) {
        if (preset > current + 0.01) {
          next = preset;
          break;
        }
      }
      if (current >= presets[presets.length - 1] - 0.01) {
        next = presets[0];
      }
      this.config.defaultPlaybackRate = next;
      this.persistConfig();
      this.renderConfigToPanel();
      this.applyPreferredRate();
      this.toast.show(`默认倍速改成 ${next}x`);
    }

    getCurrentContext() {
      const player = this.getCurrentRuntimePlayer();
      const video = getRuntimeVideo(player) || this.state.currentVideo;
      const snapshot = this.getRuntimeSnapshot();
      const runtimeMeta = this.getCurrentRuntimeMeta(player);
      const stateMeta = this.state.currentMeta || {};
      const meta = createEmptyMeta({
        ...stateMeta,
        ...runtimeMeta,
        awemeId: runtimeMeta.awemeId || stateMeta.awemeId || '',
        author: runtimeMeta.author || stateMeta.author || '',
        title: runtimeMeta.title || stateMeta.title || '',
      });
      if (meta.awemeId) {
        this.collector.updateAwemeMeta(meta);
      }
      return {
        awemeId: meta.awemeId || '',
        author: meta.author || '',
        title: meta.title || '',
        currentSrc: snapshot?.currentSrc || video?.currentSrc || video?.src || '',
      };
    }

    copyCurrentUrl() {
      const url = this.state.currentVideo?.currentSrc || '';
      if (!url) {
        this.toast.show('当前没有可复制的播放地址', 'warn');
        return;
      }
      gm.setClipboard(url);
      this.toast.show('已复制当前视频直链');
    }

    exportConfig() {
      const text = JSON.stringify(this.config, null, 2);
      gm.setClipboard(text);
      window.prompt('配置已经复制到剪贴板，也可以直接从这里复制', text);
    }

    importConfig() {
      const raw = window.prompt('把导出的 JSON 配置贴进来');
      if (!raw) {
        return;
      }
      try {
        const next = normalizeConfig(JSON.parse(raw));
        this.config = next;
        this.persistConfig();
        // 同步到 Vue — Vue 响应式会自动更新面板
        if (this.vueApp) {
          this.vueApp.config = this.config;
        }
        this.refreshAll('import');
        this.applyThemeColor(this.config.themeColor || '#2196F3');
        this.applyDarkMode(this.config.darkMode || 'auto');
        this.toast.show('配置导入好了');
      } catch (error) {
        this.toast.show('这个配置 JSON 读不出来', 'warn');
      }
    }

    goToNextVideo(reason) {
      const now = Date.now();
      if (now - this.state.lastAutoNextAt < 1000) {
        return false;
      }
      this.state.lastAutoNextAt = now;

      // 记录当前状态，用于判断原生切换是否真的生效
      const prevSnapshot = this.getRuntimeSnapshot();
      const prevAwemeId = prevSnapshot?.awemeInfo?.awemeId || this.state.currentMeta?.awemeId || '';
      const prevSrc = prevSnapshot?.currentSrc || this.state.currentVideo?.currentSrc || '';

      // 尝试原生切换（playNextFunc）
      const nativeNext = this.getNativePlaySwitchHandler('next');
      if (typeof nativeNext === 'function') {
        let invoked = false;
        try {
          invoked = nativeNext() !== false;
        } catch (e) { }
        if (!invoked) {
          return this._goToNextVideoFallback(reason);
        }
        // 延迟 400ms 检查是否真的切换了
        window.setTimeout(() => {
          this.scheduleRefresh(`native-next:${reason}`);
          const currentSnapshot = this.getRuntimeSnapshot();
          const newAwemeId = currentSnapshot?.awemeInfo?.awemeId || this.state.currentMeta?.awemeId || '';
          const newSrc = currentSnapshot?.currentSrc || this.state.currentVideo?.currentSrc || '';
          // 如果 awemeId 或 src 变了，说明切换成功
          if ((newAwemeId && newAwemeId !== prevAwemeId) || (newSrc && newSrc !== prevSrc)) {
            this.toast.show(`切到下一条了（${reason}）`);
            return; // 成功了，不需要 fallback
          }
          // 没切换成功，走 DOM fallback
          this._goToNextVideoFallback(reason);
        }, 400);
        return true;
      }

      // 没有原生切换函数，直接走 DOM fallback
      return this._goToNextVideoFallback(reason);
    }

    goToPrevVideo(reason = 'manual') {
      const now = Date.now();
      if (now - (this.state._lastPrevAt || 0) < 1000) {
        return false;
      }
      this.state._lastPrevAt = now;

      // 记录当前状态，用于判断原生切换是否真的生效
      const prevSnapshot = this.getRuntimeSnapshot();
      const prevAwemeId = prevSnapshot?.awemeInfo?.awemeId || this.state.currentMeta?.awemeId || '';
      const prevSrc = prevSnapshot?.currentSrc || this.state.currentVideo?.currentSrc || '';

      // 优先尝试 bridge invokePrev
      const bridge = getMainWorldBridge();
      if (bridge && typeof bridge.invokePrev === 'function') {
        let invoked = false;
        try { invoked = bridge.invokePrev(); } catch (e) { }
        if (invoked) {
          window.setTimeout(() => {
            this.scheduleRefresh(`native-prev:${reason}`);
            const currentSnapshot = this.getRuntimeSnapshot();
            const newAwemeId = currentSnapshot?.awemeInfo?.awemeId || this.state.currentMeta?.awemeId || '';
            const newSrc = currentSnapshot?.currentSrc || this.state.currentVideo?.currentSrc || '';
            if ((newAwemeId && newAwemeId !== prevAwemeId) || (newSrc && newSrc !== prevSrc)) {
              this.toast.show(`切到上一条了（${reason}）`);
              return;
            }
            this._goToPrevVideoFallback(reason);
          }, 400);
          return true;
        }
      }

      // 尝试原生 playPrevFunc
      const nativePrev = this.getNativePlaySwitchHandler('prev');
      if (typeof nativePrev === 'function') {
        let invoked = false;
        try { invoked = nativePrev() !== false; } catch (e) { }
        if (invoked) {
          window.setTimeout(() => {
            this.scheduleRefresh(`native-prev:${reason}`);
            const currentSnapshot = this.getRuntimeSnapshot();
            const newAwemeId = currentSnapshot?.awemeInfo?.awemeId || this.state.currentMeta?.awemeId || '';
            const newSrc = currentSnapshot?.currentSrc || this.state.currentVideo?.currentSrc || '';
            if ((newAwemeId && newAwemeId !== prevAwemeId) || (newSrc && newSrc !== prevSrc)) {
              this.toast.show(`切到上一条了（${reason}）`);
              return;
            }
            this._goToPrevVideoFallback(reason);
          }, 400);
          return true;
        }
      }

      // 都没有，走 DOM fallback
      return this._goToPrevVideoFallback(reason);
    }

    _goToPrevVideoFallback(reason) {
      const currentCard = this.state.currentCard;
      const currentRect = currentCard instanceof HTMLElement ? currentCard.getBoundingClientRect() : null;
      const cards = getCardCandidates()
        .filter((card) => !card.classList.contains(`${APP_ID}-hidden-card`))
        .filter((card) => isElementVisible(card))
        .map((card) => ({
          card,
          rect: card.getBoundingClientRect(),
          meta: extractCardMeta(card),
        }))
        .sort((left, right) => left.rect.top - right.rect.top);
      const currentId = this.state.currentMeta.awemeId || '';
      let chosen = null;

      if (currentRect) {
        const previous = cards.filter((item) => item.rect.top < currentRect.top - 24 && item.meta.awemeId !== currentId);
        chosen = previous[previous.length - 1] || null;
      }
      if (!chosen) {
        const centerY = window.innerHeight / 2;
        const previous = cards.filter((item) => item.rect.top < centerY * 0.3 && item.meta.awemeId !== currentId);
        chosen = previous[previous.length - 1] || null;
      }

      if (chosen) {
        const clickTarget = chosen.card.querySelector('a[href*="/video/"]') || chosen.card;
        chosen.card.scrollIntoView({ block: 'center', behavior: 'smooth' });
        triggerClick(clickTarget);
        this.toast.show(`切到上一条了（${reason}）`);
        return true;
      }

      const scrollHost = findScrollableAncestor(this.state.currentCard);
      if (scrollHost && scrollHost !== document.scrollingElement && scrollHost !== document.documentElement) {
        scrollHost.scrollBy({ top: -Math.max(scrollHost.clientHeight * 0.92, window.innerHeight * 0.72), behavior: 'smooth' });
      } else {
        window.scrollBy({ top: -window.innerHeight * 0.92, behavior: 'smooth' });
      }
      this.toast.show('已经尝试往上一条跳了');
      return true;
    }

    _goToNextVideoFallback(reason) {

      const currentCard = this.state.currentCard;
      const currentRect = currentCard instanceof HTMLElement ? currentCard.getBoundingClientRect() : null;
      const cards = getCardCandidates()
        .filter((card) => !card.classList.contains(`${APP_ID}-hidden-card`))
        .filter((card) => isElementVisible(card))
        .map((card) => ({
          card,
          rect: card.getBoundingClientRect(),
          meta: extractCardMeta(card),
        }))
        .sort((left, right) => left.rect.top - right.rect.top);

      const currentId = this.state.currentMeta.awemeId || '';
      let chosen = null;

      if (currentRect) {
        chosen = cards.find((item) => item.rect.top > currentRect.top + 24 && item.meta.awemeId !== currentId);
      }
      if (!chosen) {
        const centerY = window.innerHeight / 2;
        chosen = cards.find((item) => item.rect.top > centerY * 0.7 && item.meta.awemeId !== currentId);
      }
      if (!chosen) {
        chosen = cards.find((item) => item.meta.awemeId !== currentId);
      }

      if (chosen) {
        const clickTarget = chosen.card.querySelector('a[href*="/video/"]') || chosen.card;
        chosen.card.scrollIntoView({ block: 'center', behavior: 'smooth' });
        triggerClick(clickTarget);
        this.toast.show(`切到下一条了（${reason}）`);
        return true;
      }

      const nextLink = Array.from(document.querySelectorAll('a[href*="/video/"]')).find((anchor) => {
        if (!(anchor instanceof HTMLAnchorElement) || !isElementVisible(anchor)) {
          return false;
        }
        return !location.pathname.includes(anchor.getAttribute('href') || '');
      });

      if (nextLink instanceof HTMLAnchorElement) {
        triggerClick(nextLink);
        this.toast.show(`切到下一条了（${reason}）`);
        return true;
      }

      const scrollHost = findScrollableAncestor(this.state.currentCard);
      if (scrollHost && scrollHost !== document.scrollingElement && scrollHost !== document.documentElement) {
        scrollHost.scrollBy({ top: Math.max(scrollHost.clientHeight * 0.92, window.innerHeight * 0.72), behavior: 'smooth' });
      } else {
        window.scrollBy({ top: window.innerHeight * 0.92, behavior: 'smooth' });
      }
      this.toast.show('已经尝试往下一条跳了');
      return true;
    }
  }

  const app = new DouYinPlusApp();
  app.init();
})();










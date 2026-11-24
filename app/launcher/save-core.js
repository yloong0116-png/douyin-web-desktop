'use strict';
/* Douyin 保存核心：可注入依赖，便于 Mock 测试。行为与 launcher.js 内联实现保持一致。 */
const path = require('path');

function sanitize(s) {
  return String(s || '').replace(/[\\/:*?"<>|\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}

function topQuality(ql) {
  return String(ql || '').split('|').map(s => s.trim()).filter(Boolean)[0] || '';
}

/* 身份校验：解析结果必须能确认就是锁定的那个作品 */
function checkIdentity(wantId, data) {
  const got = String((data && data.id) || '');
  if (!got) return { ok: false, reason: 'response-has-no-id', got: got, want: String(wantId) };
  if (got !== String(wantId)) return { ok: false, reason: 'id-mismatch', got: got, want: String(wantId) };
  return { ok: true, reason: 'match', got: got, want: String(wantId) };
}

/* 资源分流：图文按 index 排序、同 URL 去重；视频取最高档地址 */
function pickResources(data) {
  const type = String((data && data.type) || '').toLowerCase();
  const medias = Array.isArray(data && data.medias) ? data.medias : [];
  const raw = medias
    .filter(m => m && m.type === 'image' && m.url)
    .map((m, i) => ({ url: m.url, index: typeof m.index === 'number' ? m.index : i }))
    .sort((a, b) => a.index - b.index);
  const seen = Object.create(null);
  const uniq = [];
  for (const m of raw) {
    if (seen[m.url]) continue;
    seen[m.url] = 1;
    uniq.push(m);
  }
  if (type !== 'video' && uniq.length) {
    return { kind: 'image', urls: uniq.map(x => x.url), total: uniq.length, deduped: raw.length - uniq.length };
  }
  const vUrl = (data && data.video) || (medias[0] && medias[0].url) || '';
  return { kind: 'video', urls: vUrl ? [vUrl] : [], total: vUrl ? 1 : 0, deduped: 0 };
}

/* 音乐资源状态三分类：none（作品没有）/ download-failed / write-failed / ok */
function musicOf(data) {
  const u = (data && data.music && data.music.url) || (data && data.audio) || '';
  if (!u) return { state: 'none', url: '', detail: 'no music url in response' };
  return { state: 'pending', url: u, detail: '' };
}

function buildNames(base, stamp, kind, index) {
  const ext = kind === 'image' ? '.jpg' : '.mp4';
  const suffix = kind === 'image' ? '_' + String(index).padStart(2, '0') : '';
  return {
    media: base + '_' + stamp + suffix + ext,
    text: base + '_' + stamp + '.txt',
    music: base + '_' + stamp + '.mp3'
  };
}

/**
 * 执行一个保存任务。deps 全部可注入：
 *   fetchJson(url, body) -> Promise<object>
 *   download(url, file)  -> Promise<bytes>
 *   ensureDir(dir)       -> void
 *   writeText(file, txt) -> void
 *   exists(file)         -> bool
 */
async function saveTask(snap, deps) {
  const out = { task_id: snap.task_id || '?', aweme_id: String(snap.aweme_id || ''), status: 'init', files: [], reason: '', music: { state: 'none' } };
  const D = deps;
  try {
    if (!/^\d{8,}$/.test(out.aweme_id)) {
      out.status = 'refused';
      out.reason = 'invalid aweme_id';
      return out;
    }

    let r = await D.fetchJson(out.aweme_id, 'all');
    if (r.err) { out.status = 'parse-failed'; out.reason = r.err; return out; }
    let data = r.data;
    const c1 = checkIdentity(out.aweme_id, data);
    if (!c1.ok) { out.status = 'aborted'; out.reason = c1.reason + ' want=' + c1.want + ' got=' + c1.got; return out; }

    const top = topQuality(data.quality_list);
    if (top && data.quality !== top) {
      const r2 = await D.fetchJson(out.aweme_id, top);
      if (!r2.err) {
        const c2 = checkIdentity(out.aweme_id, r2.data);
        if (c2.ok) data = r2.data;
        else { out.status = 'aborted'; out.reason = 'upgrade ' + c2.reason + ' want=' + c2.want + ' got=' + c2.got; return out; }
      }
    }

    const res = pickResources(data);
    if (!res.urls.length) { out.status = 'no-resource'; out.reason = 'empty resource list'; return out; }

    const title = String(data.title || data.desc || snap.title || 'douyin').trim();
    const base = sanitize(title) || 'douyin';
    const stamp = D.stamp(new Date(snap.captured_at || Date.now()));
    D.ensureDir(D.dir);

    // 同一秒内的不同作品可能撞名：自动加序号，绝不覆盖已有文件
    let stem = base + '_' + stamp;
    for (let k = 0; k < 100; k++) {
      const cand = k === 0 ? stem : stem + '_' + k;
      const probe = path.join(D.dir, cand + (res.kind === 'image' ? '_01.jpg' : '.mp4'));
      if (!D.exists(probe)) { stem = cand; break; }
    }
    const mediaName = (idx) => path.join(D.dir, res.kind === 'image' ? stem + '_' + String(idx).padStart(2, '0') + '.jpg' : stem + '.mp4');

    for (let i = 0; i < res.urls.length; i++) {
      const f = mediaName(i + 1);
      if (D.exists(f)) { out.status = 'name-collision'; out.reason = f; return out; }
      const n = await D.download(res.urls[i], f);
      out.files.push(f + ' (' + n + 'B)');
    }

    if (title) { try { D.writeText(path.join(D.dir, stem + '.txt'), title + '\n'); } catch (e) {} }

    const m = musicOf(data);
    if (m.state === 'none') {
      out.music = m;
    } else {
      const mf = path.join(D.dir, stem + '.mp3');
      try {
        const n = await D.download(m.url, mf);
        out.music = { state: 'ok', url: m.url, bytes: n };
      } catch (e) {
        out.music = { state: e && e.phase === 'write' ? 'write-failed' : 'download-failed', url: m.url, detail: e && e.message };
      }
    }

    out.status = 'done';
    out.kind = res.kind;
    out.quality = data.quality || '';
    out.count = res.urls.length;
    return out;
  } catch (e) {
    out.status = 'failed';
    out.reason = e && e.message;
    return out;
  }
}

/* 作品判定：active 标记优先；出现多个不同 id 且无法拍板时拒绝，不做猜测 */
function chooseId(candidates) {
  const list = Array.isArray(candidates) ? candidates : [];
  const ids = [];
  for (const c of list) if (c && c.id && ids.indexOf(String(c.id)) < 0) ids.push(String(c.id));
  const act = list.find(c => c && c.via === 'feed-active-video' && c.id);
  if (act) {
    const others = ids.filter(x => x !== String(act.id));
    if (others.length) return { id: '', conflict: true, reason: 'active-video ' + act.id + ' conflicts with ' + others.join(',') };
    return { id: String(act.id), via: act.via };
  }
  if (ids.length === 1) {
    const src = list.find(c => c && String(c.id) === ids[0]);
    return { id: ids[0], via: src ? src.via : '' };
  }
  if (ids.length > 1) return { id: '', conflict: true, reason: 'multiple candidates: ' + ids.join(',') };
  return { id: '', conflict: false, reason: 'no candidate' };
}

module.exports = { sanitize, topQuality, checkIdentity, pickResources, musicOf, buildNames, chooseId, saveTask };

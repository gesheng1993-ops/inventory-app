// Supabase 配置
const SUPABASE_URL = 'https://uvrvlulyhaefsblypwxy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_vj6ZlrXKPcN3yao1qLNwrw_hNjv2kVd';
const APP_PASSWORD = 'taopao886';

// 登录验证
function checkLogin() {
  if (sessionStorage.getItem('_auth') === '1') return true;
  return false;
}
function doLogin(pwd) {
  if (pwd === APP_PASSWORD) {
    sessionStorage.setItem('_auth', '1');
    return true;
  }
  return false;
}

// 通用 fetch 封装
async function api(path, options) {
  options = options || {};
  const res = await fetch(SUPABASE_URL + '/rest/v1' + path, {
    method: options.method || 'GET',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    let msg = '请求失败';
    try { const e = await res.json(); msg = e.message || msg; } catch (_) { msg = 'HTTP ' + res.status; }
    throw new Error(msg);
  }

  // 204 No Content 或空响应
  if (res.status === 204 || res.status === 201) {
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  return res.json();
}

// 上传图片到 Supabase Storage
async function uploadImage(file) {
  const ext = file.name.split('.').pop();
  const filename = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(SUPABASE_URL + '/storage/v1/object/placement-images/' + filename, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: '上传失败' }));
    throw new Error(err.message || '上传失败');
  }

  const data = await res.json();
  return {
    path: data.path || filename,
    url: SUPABASE_URL + '/storage/v1/object/public/placement-images/' + (data.path || filename),
  };
}

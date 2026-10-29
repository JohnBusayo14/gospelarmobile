// services/videos.js
// ─────────────────────────────────────────────────────────────────────────────
// Sunday School video library API. Unlike most of api.js, every call here is
// authenticated: the saved session token is sent as a Bearer header and the
// backend resolves who the caller is (and whether they're an admin) from the
// database. Nothing in this file decides permissions — hiding the admin
// buttons is cosmetic; the server enforces everything.
//
// The app never holds a Supabase key. Uploads go straight to Supabase Storage
// through a short-lived signed URL the backend issues per file, and playback
// uses a signed URL the backend issues per video.
// ─────────────────────────────────────────────────────────────────────────────

import axios from 'axios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from './api';

const MB = 1024 * 1024;

// Fallbacks only — the server's /api/videos/meta values win when available.
const DEFAULT_LIMITS = {
  max_video_bytes:     50 * MB,
  max_thumbnail_bytes: 5 * MB,
  video_types: ['video/mp4', 'video/quicktime', 'video/x-m4v'],
  image_types: ['image/jpeg', 'image/png', 'image/webp'],
};

const EXT_MIME = {
  mp4: 'video/mp4', m4v: 'video/x-m4v', mov: 'video/quicktime',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
};

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('userToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Errors ───────────────────────────────────────────────────────────────────
// code: 'session_expired' | 'forbidden' | 'network' | 'upload_failed' |
//       'cancelled' | 'storage_not_configured' | server-provided code
// stage (uploads only): 'request' | 'upload' | 'complete' — lets the screen
// retry just the step that failed.
export class VideoError extends Error {
  constructor(message, { status, code, fields, stage } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.stage = stage;
  }
}

function toVideoError(err) {
  if (err instanceof VideoError) return err;
  if (!err?.response) {
    return new VideoError(
      "We couldn't reach the server. Check your internet connection and try again.",
      { code: 'network' },
    );
  }
  const { status, data = {} } = err.response;
  if (status === 401) {
    return new VideoError('Your session has expired. Please sign in again.', { status, code: 'session_expired' });
  }
  if (status === 403) {
    return new VideoError("You don't have permission to do that.", { status, code: 'forbidden' });
  }
  return new VideoError(data.error || data.message || 'Something went wrong. Please try again.', {
    status, code: data.code, fields: data.fields,
  });
}

const call = async (fn) => {
  try {
    const { data } = await fn();
    return data;
  } catch (e) {
    throw toVideoError(e);
  }
};

// ── Library (any signed-in user) ─────────────────────────────────────────────

/** { categories, age_groups, can_manage, …admin-only limits } */
export const fetchVideoMeta = () => call(() => client.get('/api/videos/meta'));

/** { items, next_offset } — published videos only. */
export const fetchVideos = ({ search, category, ageGroup, sort, offset = 0, limit = 20 } = {}) =>
  call(() => client.get('/api/videos', {
    params: {
      search:    search || undefined,
      category:  category || undefined,
      age_group: ageGroup || undefined,
      sort, offset, limit,
    },
  }));

/** { items } — caller's recently watched published videos. */
export const fetchRecentVideos = () => call(() => client.get('/api/videos/recent'));

/** { video, url, expires_at } — url is a short-lived signed playback URL. */
export const fetchPlayback = (id) => call(() => client.get(`/api/videos/${id}/playback`));

export const saveVideoProgress = (id, { position_seconds, completed }) =>
  call(() => client.put(`/api/videos/${id}/progress`, { position_seconds, completed: !!completed }));

// ── Admin ────────────────────────────────────────────────────────────────────

export const fetchAdminVideos = ({ status = 'all', search, offset = 0, limit = 20 } = {}) =>
  call(() => client.get('/api/admin/videos', {
    params: { status, search: search || undefined, offset, limit },
  }));

export const fetchAdminVideo  = (id)       => call(() => client.get(`/api/admin/videos/${id}`));
export const createVideo      = (meta)     => call(() => client.post('/api/admin/videos', meta));
export const updateVideo      = (id, meta) => call(() => client.patch(`/api/admin/videos/${id}`, meta));
export const deleteVideo      = (id)       => call(() => client.delete(`/api/admin/videos/${id}`));
export const setVideoPublished = (id, published) =>
  call(() => client.post(`/api/admin/videos/${id}/publish`, { published }));

export const completeVideoUpload = (id, { kind, duration_seconds }) =>
  call(() => client.post(`/api/admin/videos/${id}/complete-upload`, { kind, duration_seconds }))
    .catch((e) => { e.stage = 'complete'; throw e; });

// ── Upload helpers ───────────────────────────────────────────────────────────

export const formatBytes = (n) => {
  if (!Number.isFinite(n) || n <= 0) return '—';
  return n >= MB ? `${(n / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
};

function resolveAssetMime(asset) {
  const fromAsset = String(asset?.mimeType || '').split(';')[0].trim().toLowerCase();
  if (fromAsset) return fromAsset;
  const ext = String(asset?.fileName || asset?.uri || '').split('?')[0].split('.').pop().toLowerCase();
  return EXT_MIME[ext] || '';
}

async function resolveAssetSize(asset) {
  if (Number.isFinite(asset?.fileSize) && asset.fileSize > 0) return asset.fileSize;
  try {
    const info = await FileSystem.getInfoAsync(asset.uri);
    return info.exists && info.size ? info.size : 0;
  } catch {
    return 0;
  }
}

/**
 * Validate a picked asset BEFORE any network call, without reading it into
 * memory. Returns { uri, name, contentType, size, durationSeconds } or throws
 * a VideoError with a message suitable for display. The server and the
 * Storage bucket re-check type and size; this is just fast, friendly feedback.
 */
export async function prepareAsset(asset, kind, meta) {
  const limits = { ...DEFAULT_LIMITS, ...(meta || {}) };
  const contentType = resolveAssetMime(asset);
  const allowed = kind === 'video' ? limits.video_types : limits.image_types;
  if (!allowed.includes(contentType)) {
    throw new VideoError(kind === 'video'
      ? 'This video format is not supported. Please choose an MP4 or MOV video.'
      : 'Please choose a JPEG, PNG or WebP image.');
  }
  const size = await resolveAssetSize(asset);
  if (!size) throw new VideoError("Couldn't read the file size. Please choose the file again.");
  const max = kind === 'video' ? limits.max_video_bytes : limits.max_thumbnail_bytes;
  if (size > max) {
    throw new VideoError(kind === 'video'
      ? `This video is ${formatBytes(size)}; the limit is ${formatBytes(max)}. Trim it or export at 720p and try again.`
      : `This image is ${formatBytes(size)}; the limit is ${formatBytes(max)}.`);
  }
  return {
    uri: asset.uri,
    name: asset.fileName || asset.uri.split('/').pop(),
    contentType,
    size,
    // expo-image-picker reports video duration in milliseconds.
    durationSeconds: Number.isFinite(asset.duration) && asset.duration > 0 ? asset.duration / 1000 : null,
  };
}

/**
 * Upload a prepared file for a video, then ask the server to verify and
 * promote it. The file is streamed from disk by the native upload task, so
 * large videos are never loaded into JS memory.
 *
 *   onProgress(fraction 0..1)
 *   onTask(task)          → keep it to call task.cancelAsync()
 *   isCancelled()         → lets us report a cancel as 'cancelled', not a failure
 *
 * Resolves with the updated admin video. Rejects with a VideoError carrying
 * `stage` so a retry can skip steps that already succeeded.
 */
export async function uploadPreparedFile(videoId, kind, prepared, { onProgress, onTask, isCancelled } = {}) {
  if (Platform.OS === 'web') {
    throw new VideoError('Uploading videos is only supported in the mobile app.', { stage: 'request' });
  }

  let ticket;
  try {
    ticket = await call(() => client.post(`/api/admin/videos/${videoId}/upload-url`, {
      kind,
      content_type: prepared.contentType,
      size_bytes: prepared.size,
    }));
  } catch (e) {
    e.stage = 'request';
    throw e;
  }

  const task = FileSystem.createUploadTask(
    ticket.upload_url,
    prepared.uri,
    {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: { ...ticket.headers, 'cache-control': 'max-age=3600' },
    },
    ({ totalBytesSent, totalBytesExpectedToSend }) => {
      if (totalBytesExpectedToSend > 0) onProgress?.(Math.min(1, totalBytesSent / totalBytesExpectedToSend));
    },
  );
  onTask?.(task);

  let result;
  try {
    result = await task.uploadAsync();
  } catch {
    if (isCancelled?.()) throw new VideoError('Upload cancelled.', { code: 'cancelled', stage: 'upload' });
    throw new VideoError('The upload was interrupted. Check your connection and tap Retry.', {
      code: 'upload_failed', stage: 'upload',
    });
  }
  if (!result || isCancelled?.()) {
    throw new VideoError('Upload cancelled.', { code: 'cancelled', stage: 'upload' });
  }
  if (result.status < 200 || result.status >= 300) {
    let msg = '';
    try {
      const body = JSON.parse(result.body || '{}');
      msg = body.message || body.error || '';
    } catch { /* non-JSON body */ }
    const tooBig = result.status === 413 || /maximum allowed size|too large/i.test(msg);
    throw new VideoError(
      tooBig
        ? 'The file is larger than the storage limit allows.'
        : `Upload failed${msg ? `: ${msg}` : ` (HTTP ${result.status})`}. Please retry.`,
      { code: 'upload_failed', stage: 'upload', status: result.status },
    );
  }
  onProgress?.(1);

  return completeVideoUpload(videoId, { kind, duration_seconds: prepared.durationSeconds });
}

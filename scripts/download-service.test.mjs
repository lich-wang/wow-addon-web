// 下载链路容错、重试、流式拼接与超时中止的单元测试
// 运行：node --experimental-strip-types --test scripts/download-service.test.mjs
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  downloadParts,
  downloadWithProgress,
  fetchPartsManifest,
} from '../src/services/downloadService.ts';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function makePayload(length, fillByte) {
  const arr = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    arr[i] = (fillByte + i) & 0xff;
  }
  return arr;
}

test('downloadWithProgress 在首字节前网络失败、503、429 与空闲超时后会自动重试并成功', async () => {
  const payload = makePayload(64, 0x10);
  let calls = 0;

  globalThis.fetch = async (_url, init) => {
    calls++;
    if (calls === 1) {
      throw new TypeError('Failed to fetch');
    }
    if (calls === 2) {
      return new Response('busy', { status: 503 });
    }
    if (calls === 3) {
      return new Response('rate limited', {
        status: 429,
        headers: { 'Retry-After': '0.02' },
      });
    }
    if (calls === 4) {
      // 模拟连接挂起直到空闲超时触发 abort
      return await new Promise((_resolve, reject) => {
        const abortErr = new DOMException('Aborted', 'AbortError');
        if (init?.signal?.aborted) {
          reject(abortErr);
          return;
        }
        init?.signal?.addEventListener('abort', () => reject(abortErr), { once: true });
      });
    }
    return new Response(payload, {
      status: 200,
      headers: {
        'Content-Length': String(payload.byteLength),
        'Content-Type': 'application/octet-stream',
      },
    });
  };

  const result = await downloadWithProgress('https://wow.lich.tech/addons/openmap/chunks/a.bin', {
    idleTimeoutMs: 35,
    maxRetries: 4,
    retryBaseDelayMs: 1,
  });

  assert.equal(calls, 5);
  assert.deepEqual(new Uint8Array(result), payload);
});

test('downloadWithProgress 对 404、3xx 跳转与 HTML 错误页不重试并立即失败', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response('not found', { status: 404 });
  };
  await assert.rejects(
    downloadWithProgress('https://wow.lich.tech/missing.bin', { maxRetries: 3, retryBaseDelayMs: 1 }),
    /HTTP 404/
  );
  assert.equal(calls, 1);

  calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return {
      ok: false,
      status: 0,
      type: 'opaqueredirect',
      headers: new Headers(),
    };
  };
  await assert.rejects(
    downloadWithProgress('https://wow.lich.tech/redirect.bin', { maxRetries: 3, retryBaseDelayMs: 1 }),
    /跳转/
  );
  assert.equal(calls, 1);

  calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response('<html>error</html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  };
  await assert.rejects(
    downloadWithProgress('https://wow.lich.tech/error.bin', { maxRetries: 3, retryBaseDelayMs: 1 }),
    /HTML/
  );
  assert.equal(calls, 1);
});

test('downloadWithProgress 在 expectedSize 与实收字节不符时触发重试并成功', async () => {
  const expected = makePayload(32, 0x33);
  let calls = 0;

  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) {
      // 返回截短的 200 响应
      const truncated = expected.subarray(0, 12);
      return new Response(truncated, {
        status: 200,
        headers: { 'Content-Length': String(truncated.byteLength) },
      });
    }
    return new Response(expected, {
      status: 200,
      headers: { 'Content-Length': String(expected.byteLength) },
    });
  };

  const result = await downloadWithProgress('https://wow.lich.tech/addons/openmap/chunks/b.bin', {
    expectedSize: expected.byteLength,
    maxRetries: 2,
    retryBaseDelayMs: 1,
  });

  assert.equal(calls, 2);
  assert.deepEqual(new Uint8Array(result), expected);
});

test('fetchPartsManifest 在 502 与网络抖动后重试并解析成功', async () => {
  const manifestBody = {
    version: 'v0.8.13',
    format: 2,
    totalSize: 16,
    sha256: 'a'.repeat(64),
    chunks: [{ sha256: 'b'.repeat(64), size: 16 }],
    parts: [`chunks/${'b'.repeat(64)}.bin`],
  };
  let calls = 0;

  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) return new Response('bad gateway', { status: 502 });
    if (calls === 2) throw new TypeError('network reset');
    return new Response(JSON.stringify(manifestBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const manifest = await fetchPartsManifest('https://wow.lich.tech/addons/openmap/parts.json', 1000, 2);
  assert.equal(calls, 3);
  assert.equal(manifest.version, 'v0.8.13');
  assert.equal(manifest.totalSize, 16);
});

test('downloadParts (format 2) 在并发分块出现瞬态错误且含重复块时可恢复并校验整包 sha256', async () => {
  const chunkA = makePayload(64, 0x01);
  const chunkB = makePayload(48, 0x20);
  const chunkC = makePayload(56, 0x40);
  const chunkD = makePayload(40, 0x60);
  const chunkE = makePayload(32, 0x80);

  const chunksData = [chunkA, chunkB, chunkC, chunkD, chunkE];
  const shas = chunksData.map((c) => sha256(c));

  // parts 里刻意让 chunkA 出现两次，验证只下载一次且偏移拼接正确
  const order = [0, 1, 2, 0, 3, 4];
  const fullBytes = Buffer.concat(order.map((idx) => Buffer.from(chunksData[idx])));

  const manifest = {
    version: 'v0.8.13',
    format: 2,
    totalSize: fullBytes.byteLength,
    sha256: sha256(fullBytes),
    chunks: chunksData.map((c, idx) => ({ sha256: shas[idx], size: c.byteLength })),
    parts: order.map((idx) => `chunks/${shas[idx]}.bin`),
  };

  const attemptsBySha = new Map();
  globalThis.fetch = async (url, init) => {
    const match = /([0-9a-f]{64})\.bin$/.exec(String(url));
    assert.ok(match, `unexpected URL: ${url}`);
    const digest = match[1];
    const count = (attemptsBySha.get(digest) ?? 0) + 1;
    attemptsBySha.set(digest, count);

    if (digest === shas[0]) {
      if (count === 1) throw new TypeError('Failed to fetch');
      if (count === 2) return new Response('err', { status: 503 });
      return new Response(chunkA, { status: 200, headers: { 'Content-Length': String(chunkA.byteLength) } });
    }
    if (digest === shas[1]) {
      if (count === 1) {
        return await new Promise((_resolve, reject) => {
          const abortErr = new DOMException('Aborted', 'AbortError');
          init?.signal?.addEventListener('abort', () => reject(abortErr), { once: true });
        });
      }
      return new Response(chunkB, { status: 200, headers: { 'Content-Length': String(chunkB.byteLength) } });
    }
    if (digest === shas[2]) {
      if (count === 1) {
        const half = chunkC.subarray(0, 20);
        return new Response(half, { status: 200, headers: { 'Content-Length': String(half.byteLength) } });
      }
      return new Response(chunkC, { status: 200, headers: { 'Content-Length': String(chunkC.byteLength) } });
    }
    if (digest === shas[3]) {
      if (count === 1) return new Response('limit', { status: 429, headers: { 'Retry-After': '0.01' } });
      return new Response(chunkD, { status: 200, headers: { 'Content-Length': String(chunkD.byteLength) } });
    }
    return new Response(chunkE, { status: 200, headers: { 'Content-Length': String(chunkE.byteLength) } });
  };

  const progressUpdates = [];
  const result = await downloadParts('https://wow.lich.tech/addons/openmap/parts.json', manifest, {
    idleTimeoutMs: 35,
    maxRetries: 3,
    retryBaseDelayMs: 1,
    onChunk: (loaded, total) => progressUpdates.push({ loaded, total }),
  });

  assert.ok(Buffer.from(result).equals(fullBytes));
  assert.equal(attemptsBySha.get(shas[0]), 3);
  assert.equal(attemptsBySha.get(shas[4]), 1);
  assert.ok(progressUpdates.length > 0);
});

test('downloadParts (format 2) 遇到不可重试 404 时立即失败并中止其余在途并发请求', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });

  const c1 = makePayload(32, 0x01);
  const c2 = makePayload(32, 0x02);
  const c3 = makePayload(32, 0x03);
  const c4 = makePayload(32, 0x04);
  const chunks = [c1, c2, c3, c4];
  const shas = chunks.map((c) => sha256(c));
  const full = Buffer.concat(chunks.map((c) => Buffer.from(c)));

  const manifest = {
    version: 'v0.8.13',
    format: 2,
    totalSize: full.byteLength,
    sha256: sha256(full),
    chunks: chunks.map((c, idx) => ({ sha256: shas[idx], size: c.byteLength })),
    parts: shas.map((s) => `chunks/${s}.bin`),
  };

  let abortedSiblings = 0;
  globalThis.fetch = async (url, init) => {
    const match = /([0-9a-f]{64})\.bin$/.exec(String(url));
    const digest = match?.[1];
    if (digest === shas[0]) {
      return new Response('not found', { status: 404 });
    }
    return await new Promise((_resolve, reject) => {
      const abortErr = new DOMException('Aborted', 'AbortError');
      if (init?.signal?.aborted) {
        abortedSiblings++;
        reject(abortErr);
        return;
      }
      init?.signal?.addEventListener(
        'abort',
        () => {
          abortedSiblings++;
          reject(abortErr);
        },
        { once: true }
      );
    });
  };

  try {
    // 使用受控计时器而不 tick，确保任何兄弟请求自身的 idleTimeoutMs 都不会触发；
    // 唯有 404 触发 batchController.abort() 才能结束全部三个兄弟请求。
    await assert.rejects(
      downloadParts('https://wow.lich.tech/addons/openmap/parts.json', manifest, {
        idleTimeoutMs: 10_000,
        maxRetries: 3,
        retryBaseDelayMs: 1,
      }),
      /分块下载失败：HTTP 404/
    );
    assert.equal(abortedSiblings, 3);
  } finally {
    t.mock.timers.reset();
  }
});

test('downloadWithProgress 支持 HTTP 日期格式的 Retry-After', async () => {
  const payload = makePayload(16, 0x55);
  let calls = 0;

  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) {
      const retryAt = new Date(Date.now() + 1500).toUTCString();
      return new Response('slow down', {
        status: 503,
        headers: { 'Retry-After': retryAt },
      });
    }
    return new Response(payload, {
      status: 200,
      headers: { 'Content-Length': String(payload.byteLength) },
    });
  };

  const startedAt = Date.now();
  const result = await downloadWithProgress('https://wow.lich.tech/addons/openmap/chunks/date.bin', {
    maxRetries: 1,
    retryBaseDelayMs: 1,
  });
  const elapsed = Date.now() - startedAt;

  assert.equal(calls, 2);
  assert.ok(elapsed >= 400, `应按 Retry-After 日期等待后再重试，实际耗时 ${elapsed}ms`);
  assert.deepEqual(new Uint8Array(result), payload);
});

test('downloadWithProgress 在响应携带弱 ETag 与 Last-Modified 时不发送 Range/If-Range 并从头重试', async () => {
  const payload = makePayload(32, 0x77);
  let calls = 0;

  globalThis.fetch = async (_url, init) => {
    calls++;
    if (calls === 1) {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(payload.subarray(0, 10));
          controller.error(new Error('stream reset'));
        },
      });
      return new Response(stream, {
        status: 200,
        headers: {
          'Content-Length': String(payload.byteLength),
          ETag: 'W/"weak-etag"',
          'Last-Modified': 'Wed, 21 Oct 2015 07:28:00 GMT',
          Date: 'Wed, 21 Oct 2015 07:29:00 GMT',
        },
      });
    }
    const headers = init?.headers ?? {};
    assert.equal(headers.Range, undefined);
    assert.equal(headers['If-Range'], undefined);
    return new Response(payload, {
      status: 200,
      headers: { 'Content-Length': String(payload.byteLength) },
    });
  };

  const result = await downloadWithProgress('https://wow.lich.tech/addons/sbf.zip', {
    maxRetries: 2,
    retryBaseDelayMs: 1,
  });

  assert.equal(calls, 2);
  assert.deepEqual(new Uint8Array(result), payload);
});

test('downloadWithProgress 在无 Content-Length 且长度不符时清空缓冲从头重试', async () => {
  const expected = makePayload(32, 0x99);
  let calls = 0;

  globalThis.fetch = async (_url, init) => {
    calls++;
    if (calls === 1) {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(expected.subarray(0, 12));
          controller.close();
        },
      });
      return new Response(stream, { status: 200 });
    }
    const headers = init?.headers ?? {};
    assert.equal(headers.Range, undefined);
    return new Response(expected, {
      status: 200,
      headers: { 'Content-Length': String(expected.byteLength) },
    });
  };

  const result = await downloadWithProgress('https://wow.lich.tech/addons/openmap/chunks/nolength.bin', {
    expectedSize: expected.byteLength,
    maxRetries: 2,
    retryBaseDelayMs: 1,
  });

  assert.equal(calls, 2);
  assert.deepEqual(new Uint8Array(result), expected);
});

test('fetchPartsManifest 收到 200 text/html 页面时不重试并立即失败', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response('<html>blocked</html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  };

  await assert.rejects(
    fetchPartsManifest('https://wow.lich.tech/addons/openmap/parts.json', 1000, 2),
    /HTML/
  );
  assert.equal(calls, 1);
});

test('downloadParts 在调用前已取消时立即拒绝且不发起网络请求', async () => {
  const chunk = makePayload(16, 0xaa);
  const sha = sha256(chunk);
  const manifest = {
    version: 'v0.8.13',
    format: 2,
    totalSize: chunk.byteLength,
    sha256: sha,
    chunks: [{ sha256: sha, size: chunk.byteLength }],
    parts: [`chunks/${sha}.bin`],
  };

  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response(chunk, { status: 200 });
  };

  const controller = new AbortController();
  controller.abort();

  await assert.rejects(
    downloadParts('https://wow.lich.tech/addons/openmap/parts.json', manifest, {
      signal: controller.signal,
    }),
    /取消/
  );
  assert.equal(calls, 0);
});

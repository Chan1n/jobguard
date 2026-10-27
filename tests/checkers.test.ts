import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import {
  dataset,
  normalizeUrl,
  extractUrls,
  matchUrl,
  matchHash,
  sha256,
  detectType,
  checkFile,
  validateFileSize,
} from "../lib/checkers";
import {
  readHistory,
  writeHistory,
  HISTORY_KEY,
  HistoryItem,
} from "../lib/history";
const bytes = (arr: number[]) => new Uint8Array(arr).buffer;
test("URL parser: host case / fragment; preserve scheme, query order, path case", () => {
  assert.equal(
    normalizeUrl("https://EXAMPLE.com/A?b=2&a=1#hello"),
    "https://example.com/A?b=2&a=1",
  );
  assert.deepEqual(extractUrls("https://example.com/a?value=."), [
    "https://example.com/a?value=.",
  ]);
  assert.notEqual(
    normalizeUrl("http://example.com/a"),
    normalizeUrl("https://example.com/a"),
  );
  assert.notEqual(
    normalizeUrl("https://example.com/a?b=1&a=2"),
    normalizeUrl("https://example.com/a?a=2&b=1"),
  );
});
test("real URL snapshot matches without opening destination; same domain alone does not match", () => {
  const url = dataset.urls.find((s) => new URL(s).pathname !== "/")!;
  assert.equal(matchUrl(url), true);
  assert.equal(
    matchUrl(new URL("/jobguard-not-in-feed-2026", url).href),
    false,
  );
  assert.equal(matchUrl("https://example.com/"), false);
});
test("text input extracts max 5, deduplicates, rejects blank malformed and unsupported URLs", () => {
  assert.deepEqual(
    extractUrls("สมัคร https://EXAMPLE.com/a#x และ https://example.com/a#y"),
    ["https://example.com/a"],
  );
  for (const s of [
    "",
    "hello",
    "https://",
    "ftp://example.com",
    Array(6).fill("https://example.com").join(" "),
  ])
    assert.throws(() => extractUrls(s));
});
test("browser SHA-256 matches independent node crypto for self-created harmless fixture", async () => {
  const b = readFileSync("tests/fixtures/hello.txt");
  assert.equal(
    await sha256(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)),
    createHash("sha256").update(b).digest("hex"),
  );
  assert.equal(
    await sha256(new TextEncoder().encode("abc").buffer),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});
test("ESET real hash matcher only (no malware file downloaded or executed)", () => {
  assert.equal(matchHash(dataset.hashes[0]), true);
  assert.equal(matchHash(dataset.hashes[0].toUpperCase()), true);
  assert.equal(matchHash("0".repeat(64)), false);
  assert.equal(matchHash("invalid"), false);
});
test("basic file signatures and ZIP limitation", () => {
  assert.equal(detectType(bytes([37, 80, 68, 70, 45])).kind, "PDF");
  assert.equal(detectType(bytes([255, 216, 255])).kind, "JPEG");
  assert.equal(
    detectType(bytes([137, 80, 78, 71, 13, 10, 26, 10])).kind,
    "PNG",
  );
  assert.match(detectType(bytes([80, 75, 3, 4])).kind, /ZIP/);
  assert.equal(detectType(bytes([80, 75, 3, 4])).supported, false);
});
test("PE header bounds checked; MZ alone does not identify PE", () => {
  assert.equal(detectType(bytes([77, 90])).supported, false);
  const b = new ArrayBuffer(128);
  new Uint8Array(b).set([77, 90]);
  new DataView(b).setUint32(60, 0xffffffff, true);
  assert.equal(detectType(b).supported, false);
});
test("synthetic non-runnable PE disguised as PDF yields caution, not malware claim", async () => {
  const f = new File(
    [readFileSync("tests/fixtures/synthetic-pe.pdf")],
    "synthetic-pe.pdf",
  );
  const r = await checkFile(f);
  assert.equal(r.mismatch, true);
  assert.equal(r.status, "caution");
  assert.equal(r.matched, false);
});
test("empty / oversized rejected; short unsupported file still hashed", async () => {
  assert.throws(() => validateFileSize(0));
  assert.throws(() => validateFileSize(20 * 1024 * 1024 + 1));
  validateFileSize(20 * 1024 * 1024);
  const r = await checkFile(new File(["x"], "x.txt"));
  assert.equal(r.status, "partial");
  assert.equal(r.hash.length, 64);
});
test("history survives serialization and caps at 100 without URL/file/chat content", () => {
  let saved = "";
  const item: HistoryItem = {
    id: "1",
    kind: "url",
    time: new Date().toISOString(),
    fingerprint: "a".repeat(64),
    status: "unknown",
    version: "v1",
    decision: "ยังไม่แน่ใจ",
  };
  const storage = {
    setItem: (key: string, v: string) => {
      assert.equal(key, HISTORY_KEY);
      saved = v;
    },
    getItem: () => saved,
  };
  writeHistory(storage, Array(105).fill(item));
  assert.equal(readHistory(storage).length, 100);
  assert.equal(readHistory(storage)[0].decision, item.decision);
  assert.equal(saved.includes("https://"), false);
});
test("storage failures propagate to UI handler and corrupt history rejected", () => {
  assert.throws(() =>
    writeHistory(
      {
        setItem: () => {
          throw Error("quota");
        },
      },
      [],
    ),
  );
  assert.throws(() => readHistory({ getItem: () => "{" }));
  assert.throws(() => readHistory({ getItem: () => "{}" }));
});

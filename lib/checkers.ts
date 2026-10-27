import data from "../data/threats.json";
export const dataset = data;
const urls = new Set(data.urls);
const hashes = new Set(data.hashes);
export type Status = "match" | "caution" | "unknown" | "partial";
export const statusText: Record<Status, string> = {
  match: "พบรายการตรงกัน",
  caution: "พบข้อควรระวัง",
  unknown: "ไม่พบรายการตรงกัน",
  partial: "ตรวจได้บางส่วน",
};
export function normalizeUrl(input: string): string {
  if (/\s/.test(input)) throw Error("URL ต้องไม่มีช่องว่าง");
  const url = new URL(input);
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname)
    throw Error("รองรับเฉพาะ http และ https");
  url.hash = "";
  return url.href;
}
export function extractUrls(text: string): string[] {
  if (!text.trim()) throw Error("กรุณาวาง URL หรือข้อความที่มีลิงก์");
  const candidates = text.match(/\b[a-z][a-z\d+.-]*:\/\/[^\s<>"“”]+/gi) || [];
  if (!candidates.length)
    throw Error(
      "ไม่พบ URL กรุณาใส่ลิงก์เต็มที่ขึ้นต้นด้วย http:// หรือ https://",
    );
  if (candidates.length > 5)
    throw Error("ตรวจได้สูงสุด 5 ลิงก์ต่อครั้ง กรุณาลดจำนวนลิงก์");
  try {
    return candidates
      .map((s) => normalizeUrl(s))
      .filter((s, i, a) => a.indexOf(s) === i);
  } catch {
    throw Error(
      "พบ URL ไม่ถูกต้อง หรือโปรโตคอลที่ไม่รองรับ กรุณาตรวจทุกลิงก์อีกครั้ง",
    );
  }
}
export function matchUrl(url: string) {
  return urls.has(normalizeUrl(url));
}
export function matchHash(hash: string) {
  return /^[a-f\d]{64}$/i.test(hash) && hashes.has(hash.toLowerCase());
}
export async function sha256(bytes: ArrayBuffer) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export type FileType = {
  kind: string;
  extensions: string[];
  supported: boolean;
};
export function detectType(buffer: ArrayBuffer): FileType {
  const b = new Uint8Array(buffer);
  const has = (sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);
  if (has([0x25, 0x50, 0x44, 0x46, 0x2d]))
    return { kind: "PDF", extensions: ["pdf"], supported: true };
  if (has([0xff, 0xd8, 0xff]))
    return {
      kind: "JPEG",
      extensions: ["jpg", "jpeg", "jpe"],
      supported: true,
    };
  if (has([137, 80, 78, 71, 13, 10, 26, 10]))
    return { kind: "PNG", extensions: ["png"], supported: true };
  if (b.length >= 64 && has([77, 90])) {
    const offset = new DataView(buffer).getUint32(0x3c, true);
    if (offset >= 64 && offset <= b.length - 24 && has([80, 69, 0, 0], offset))
      return {
        kind: "Windows PE (อาจเป็น EXE, DLL หรือชนิดอื่น)",
        extensions: [
          "exe",
          "dll",
          "sys",
          "scr",
          "cpl",
          "ocx",
          "efi",
          "pyd",
          "drv",
          "mui",
          "acm",
          "ax",
        ],
        supported: true,
      };
  }
  if (has([80, 75, 3, 4]) || has([80, 75, 5, 6]) || has([80, 75, 7, 8]))
    return {
      kind: "โครงสร้าง ZIP (ยังระบุ APK หรือ DOCX ไม่ได้)",
      extensions: [],
      supported: false,
    };
  return {
    kind: "ไม่รองรับการตรวจชนิด หรือข้อมูลสั้นเกินไป",
    extensions: [],
    supported: false,
  };
}
export function validateFileSize(size: number) {
  if (size === 0) throw Error("ไฟล์ว่าง กรุณาเลือกไฟล์ที่มีข้อมูล");
  if (size > 20 * 1024 * 1024)
    throw Error("ไฟล์ใหญ่เกิน 20 MB กรุณาเลือกไฟล์ที่เล็กกว่า");
}
export async function checkFile(file: File) {
  validateFileSize(file.size);
  const bytes = await file.arrayBuffer();
  const hash = await sha256(bytes);
  const type = detectType(bytes);
  const ext = file.name.includes(".")
    ? file.name.split(".").pop()!.toLowerCase()
    : "";
  const mismatch = type.supported && !type.extensions.includes(ext);
  const matched = matchHash(hash);
  const status: Status = matched
    ? "match"
    : mismatch
      ? "caution"
      : !type.supported
        ? "partial"
        : "unknown";
  return { hash, type, mismatch, matched, status };
}

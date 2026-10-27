import { Status } from "./checkers";
export type HistoryItem = {
  id: string;
  kind: "url" | "file";
  time: string;
  fingerprint: string;
  status: Status;
  version: string;
  decision?: string;
  decisionTime?: string;
};
export const HISTORY_KEY = "jobguard.history.v1";
export const decisions = [
  "จะตรวจสอบกับบริษัทก่อน",
  "จะไม่เปิดหรือรัน",
  "ลบไฟล์แล้ว",
  "ยังไม่แน่ใจ",
];
export function readHistory(storage: Pick<Storage, "getItem">): HistoryItem[] {
  const value = storage.getItem(HISTORY_KEY);
  if (!value) return [];
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) throw Error("Invalid history");
  return parsed
    .filter(
      (x): x is HistoryItem =>
        x &&
        typeof x.id === "string" &&
        ["url", "file"].includes(x.kind) &&
        typeof x.time === "string" &&
        typeof x.fingerprint === "string" &&
        /^[a-f0-9]{64}$/.test(x.fingerprint) &&
        ["match", "caution", "unknown", "partial"].includes(x.status) &&
        typeof x.version === "string",
    )
    .slice(0, 100)
    .map((x) => ({
      id: x.id,
      kind: x.kind,
      time: x.time,
      fingerprint: x.fingerprint,
      status: x.status,
      version: x.version,
      ...(decisions.includes(x.decision || "")
        ? { decision: x.decision, decisionTime: x.decisionTime }
        : {}),
    }));
}
export function writeHistory(
  storage: Pick<Storage, "setItem">,
  items: HistoryItem[],
) {
  storage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 100)));
}

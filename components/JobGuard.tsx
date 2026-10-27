"use client";
import { useEffect, useRef, useState } from "react";
import {
  ShieldCheck,
  Link as LinkIcon,
  FileText,
  LockKeyhole,
  Search,
  Info,
  Trash2,
  Upload,
  Clock3,
} from "lucide-react";
import {
  checkFile,
  dataset,
  extractUrls,
  matchUrl,
  sha256,
  statusText,
} from "../lib/checkers";
import {
  decisions,
  HistoryItem,
  readHistory,
  writeHistory,
  HISTORY_KEY,
} from "../lib/history";
import ResultCard, { Result } from "./ResultCard";
const date = (s: string) =>
  new Date(s).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
export default function JobGuard() {
  const [tab, setTab] = useState<"url" | "file">("url");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const historyRef = useRef<HistoryItem[]>([]);
  useEffect(() => {
    try {
      const h = readHistory(localStorage);
      historyRef.current = h;
      setHistory(h);
    } catch {
      setStorageError(
        "อ่านประวัติไม่สำเร็จ ยังตรวจสอบต่อได้ คุณสามารถล้างข้อมูลแล้วลองใหม่",
      );
    }
  }, []);
  function persist(items: HistoryItem[]) {
    historyRef.current = items.slice(0, 100);
    setHistory(historyRef.current);
    try {
      writeHistory(localStorage, historyRef.current);
      setStorageError("");
    } catch {
      setStorageError(
        "บันทึกประวัติไม่สำเร็จ ผลตรวจยังแสดงได้ แต่ข้อมูลอาจหายเมื่อปิดหรือโหลดหน้าใหม่",
      );
    }
  }
  async function scan(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setResults([]);
    try {
      let next: Result[] = [];
      if (tab === "url") {
        const extracted = extractUrls(text);
        next = await Promise.all(
          extracted.map(async (url) => {
            const fingerprint = await sha256(
              new TextEncoder().encode(url).buffer,
            );
            const matched = matchUrl(url);
            return {
              id: crypto.randomUUID(),
              kind: "url" as const,
              label: url,
              fingerprint,
              status: matched ? ("match" as const) : ("unknown" as const),
              duplicate: historyRef.current.some(
                (h) => h.kind === "url" && h.fingerprint === fingerprint,
              ),
              evidence: [
                matched
                  ? "URL เต็มตรงกับรายการในสำเนาข้อมูลฟิชชิง"
                  : "ไม่พบ URL เต็มในชุดข้อมูลย่อยนี้",
                "ตรวจเฉพาะ URL เต็ม คง HTTP/HTTPS, path และ query ไว้ ไม่นำ fragment มาเทียบ",
                "ไม่ได้เปิดปลายทางหรือตาม redirect และไม่ได้วิเคราะห์ข้อความสมัครงาน",
              ],
            };
          }),
        );
      } else {
        if (!file) throw Error("กรุณาเลือกไฟล์ก่อนตรวจ");
        const checked = await checkFile(file);
        next = [
          {
            id: crypto.randomUUID(),
            kind: "file",
            label: file.name,
            fingerprint: checked.hash,
            status: checked.status,
            duplicate: historyRef.current.some(
              (h) => h.kind === "file" && h.fingerprint === checked.hash,
            ),
            evidence: [
              `SHA-256: ${checked.hash}`,
              checked.matched
                ? "แฮชตรงกับรายการจากงานวิจัย ESET"
                : "ไม่พบแฮชในชุดงานวิจัย ESET ที่เลือก",
              `ชนิดไฟล์: ${checked.type.kind}`,
              checked.mismatch
                ? "ข้อควรระวัง: ชนิดไฟล์ไม่สอดคล้องกับนามสกุล ไม่ใช่หลักฐานว่าเป็นมัลแวร์"
                : checked.type.supported
                  ? "ชนิดไฟล์พื้นฐานสอดคล้องกับนามสกุล ไม่รับรองเนื้อหาภายใน"
                  : "ตรวจแฮชแล้ว แต่ตรวจชนิดไฟล์ได้เพียงบางส่วน",
              "ไม่ได้เปิด รัน แตกไฟล์ หรืออัปโหลดไฟล์",
            ],
          },
        ];
      }
      setResults(next);
      persist([
        ...next.map((r) => ({
          id: r.id,
          kind: r.kind,
          time: new Date().toISOString(),
          fingerprint: r.fingerprint,
          status: r.status,
          version: dataset.version,
        })),
        ...historyRef.current,
      ]);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "ตรวจไม่ได้ กรุณาเลือกไฟล์ใหม่และลองอีกครั้ง",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function decide(id: string, value: string) {
    if (!decisions.includes(value)) return;
    persist(
      historyRef.current.map((h) =>
        h.id === id
          ? { ...h, decision: value, decisionTime: new Date().toISOString() }
          : h,
      ),
    );
    setResults((rs) =>
      rs.map((r) => (r.id === id ? { ...r, decision: value } : r)),
    );
  }
  function clear() {
    try {
      localStorage.removeItem(HISTORY_KEY);
      historyRef.current = [];
      setHistory([]);
      setStorageError("");
      setResults([]);
    } catch {
      setStorageError(
        "ล้างประวัติไม่สำเร็จ กรุณาตรวจสิทธิ์การจัดเก็บของเบราว์เซอร์",
      );
    }
  }
  return (
    <>
      <header>
        <div className="header-inner">
          <a href="#" className="brand">
            <ShieldCheck size={29} />
            JobGuard
          </a>
          <nav aria-label="เมนูหลัก">
            <a href="#checker" className="active">
              ตรวจสอบ
            </a>
            <a href="#history">ประวัติ</a>
          </nav>
        </div>
      </header>
      <main>
        <section className="intro">
          <div>
            <h1>ตรวจเบื้องต้น ก่อนกด ก่อนรัน</h1>
            <p>
              ตรวจสอบลิงก์และไฟล์จากการสมัครงาน
              เพื่อช่วยให้คุณประเมินความเสี่ยงเบื้องต้น
              <br className="desktop" /> ก่อนคลิกลิงก์ ดาวน์โหลด หรือเปิดใช้งาน
            </p>
          </div>
          <div className="local-note">
            <LockKeyhole size={21} />
            <span>
              ประมวลผลในเบราว์เซอร์ของคุณเท่านั้น
              <br />
              ข้อมูลของคุณไม่ถูกส่งไปยังเซิร์ฟเวอร์ภายนอก
            </span>
          </div>
        </section>
        <div className="workspace">
          <section id="checker" className="tool">
            <div
              className="tabs"
              role="tablist"
              aria-label="เลือกประเภทการตรวจ"
            >
              {(["url", "file"] as const).map((t) => (
                <button
                  key={t}
                  id={`tab-${t}`}
                  role="tab"
                  aria-selected={tab === t}
                  aria-controls="check-panel"
                  disabled={busy}
                  onClick={() => {
                    setTab(t);
                    setError("");
                    setResults([]);
                  }}
                  className={tab === t ? "selected" : ""}
                >
                  {t === "url" ? (
                    <LinkIcon size={22} />
                  ) : (
                    <FileText size={22} />
                  )}
                  ตรวจ{t === "url" ? "ลิงก์" : "ไฟล์"}
                </button>
              ))}
            </div>
            <form
              onSubmit={scan}
              id="check-panel"
              role="tabpanel"
              aria-labelledby={`tab-${tab}`}
            >
              {tab === "url" ? (
                <>
                  <label htmlFor="url-input">
                    วางลิงก์หรือข้อความที่ได้รับ
                  </label>
                  <textarea
                    id="url-input"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="เช่น https://example.com หรือวางหลายลิงก์ในบรรทัดใหม่"
                    disabled={busy}
                  />
                  <p className="helper">
                    รองรับ http และ https สูงสุด 5 ลิงก์ · ไม่เปิดลิงก์ปลายทาง
                  </p>
                </>
              ) : (
                <>
                  <label htmlFor="file-input">เลือกไฟล์ที่ต้องการตรวจ</label>
                  <div className="upload">
                    <Upload size={30} />
                    <strong>
                      {file ? file.name : "เลือกไฟล์จากอุปกรณ์ของคุณ"}
                    </strong>
                    <span>ครั้งละ 1 ไฟล์ ขนาดไม่เกิน 20 MB</span>
                    <input
                      id="file-input"
                      type="file"
                      disabled={busy}
                      onChange={(e) => {
                        setFile(e.target.files?.[0] || null);
                        setError("");
                        setResults([]);
                      }}
                    />
                  </div>
                  <p className="helper">
                    SHA-256 · ตรวจชนิด PDF, JPEG, PNG และ Windows PE
                  </p>
                </>
              )}
              <button type="submit" className="primary" disabled={busy}>
                {busy ? <Clock3 size={21} /> : <Search size={21} />}{" "}
                {busy
                  ? "กำลังตรวจ…"
                  : `ตรวจสอบ${tab === "url" ? "ลิงก์" : "ไฟล์"}`}
              </button>
              <div aria-live="polite">
                {error && (
                  <p className="error" role="alert">
                    {error}
                  </p>
                )}
                {busy && <p>กำลังตรวจในเบราว์เซอร์ กรุณารอสักครู่</p>}
              </div>
            </form>
            <div className="notice">
              <Info size={23} />
              <div>
                <strong>ไม่พบรายการ ไม่ได้แปลว่าปลอดภัย</strong>
                <p>
                  ผลการตรวจเป็นเพียงข้อมูลประกอบการตัดสินใจ
                  โปรดใช้วิจารณญาณและตรวจสอบเพิ่มเติม
                </p>
              </div>
            </div>
          </section>
          <aside>
            <h2>ก่อนตัดสินใจ</h2>
            <ol className="steps">
              <li>
                <span>1</span>
                <div>
                  <h3>ตรวจสอบผู้ส่ง</h3>
                  <p>
                    พิจารณาชื่อผู้ติดต่อ อีเมล โดเมน และช่องทางการติดต่อ
                    ว่าสอดคล้องกับบริษัทจริงหรือไม่
                  </p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <h3>อ่านหลักฐาน</h3>
                  <p>
                    อ่านผลตรวจและข้อจำกัด ระวังการเร่งให้โอนเงิน
                    หรือขอข้อมูลส่วนตัวที่ไม่จำเป็น
                  </p>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <h3>ยืนยันกับบริษัท</h3>
                  <p>
                    ติดต่อบริษัทผ่านเว็บไซต์หรือเบอร์โทรศัพท์ที่คุณค้นหาเอง
                    ก่อนเปิดหรือรันสิ่งที่ได้รับ
                  </p>
                </div>
              </li>
            </ol>
            <div className="privacy">
              <LockKeyhole size={24} />
              <div>
                <strong>ความเป็นส่วนตัวของคุณ</strong>
                <p>
                  ไม่อัปโหลดไฟล์ ไม่เก็บ URL เต็มหรือข้อความในประวัติ
                  เก็บข้อมูลสรุปเฉพาะในอุปกรณ์นี้
                </p>
              </div>
            </div>
          </aside>
        </div>
        {results.length > 0 && (
          <section className="results" aria-live="polite">
            <h2>ผลการตรวจสอบ</h2>
            <p className="muted">
              ตรวจเสร็จ รอตัดสินใจ · เลือกการกระทำในแต่ละรายการเพื่อบันทึก
            </p>
            {results.map((r) => (
              <ResultCard key={r.id} result={r} onDecision={decide} />
            ))}
          </section>
        )}
        <section id="history" className="history">
          <div className="section-heading">
            <h2>ประวัติการตรวจ</h2>
            <button
              className="secondary"
              onClick={clear}
              disabled={busy || (!history.length && !storageError)}
            >
              <Trash2 size={17} />
              ล้างประวัติการตรวจ
            </button>
          </div>
          {storageError && (
            <p role="alert" className="error">
              {storageError}
            </p>
          )}
          {history.length === 0 ? (
            <div className="empty">
              <FileText size={27} />
              <strong>ยังไม่มีประวัติการตรวจ</strong>
              <p>
                ผลการตรวจลิงก์และไฟล์จะแสดงที่นี่
                เพื่อให้คุณกลับมาดูการตัดสินใจได้ภายหลัง
              </p>
            </div>
          ) : (
            <div className="history-list">
              {history.map((h) => (
                <article key={h.id}>
                  <div className="history-kind">
                    {h.kind === "url" ? (
                      <LinkIcon size={20} />
                    ) : (
                      <FileText size={20} />
                    )}
                    <div>
                      <strong>
                        {h.kind === "url" ? "URL / ลิงก์" : "ไฟล์"}
                      </strong>
                      <small>
                        {date(h.time)} · {h.version}
                      </small>
                    </div>
                  </div>
                  <span className={`status ${h.status}`}>
                    {statusText[h.status]}
                  </span>
                  <div className="history-decision">
                    <label className="sr-only" htmlFor={`h-${h.id}`}>
                      การตัดสินใจสำหรับ {date(h.time)}
                    </label>
                    <select
                      id={`h-${h.id}`}
                      value={h.decision || ""}
                      onChange={(e) => decide(h.id, e.target.value)}
                    >
                      <option value="" disabled>
                        ตรวจเสร็จ รอตัดสินใจ
                      </option>
                      {decisions
                        .filter((d) => h.kind === "file" || d !== "ลบไฟล์แล้ว")
                        .map((d) => (
                          <option key={d}>{d}</option>
                        ))}
                    </select>
                    {h.decisionTime && (
                      <small>บันทึกแล้ว {date(h.decisionTime)}</small>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
          <p className="history-caption">
            เก็บสูงสุด 100 รายการในเบราว์เซอร์นี้ ·
            การตัดสินใจเป็นข้อมูลที่คุณรายงานเอง
          </p>
        </section>
        <footer>
          <details>
            <summary>แหล่งข้อมูลและข้อจำกัดของต้นแบบ</summary>
            <p>
              ชุดย่อย URL เรียงก่อนเลือก 5,000 รายการ ไม่เป็นตัวแทนภัยทั้งหมด
              และไม่รับประกันว่าเป็นรายการล่าสุด ฐานแฮชเป็นงานวิจัยเฉพาะ
              ไม่ครอบคลุมมัลแวร์ทั้งหมด
            </p>
            {dataset.sources.map((s) => (
              <div key={s.repo}>
                <a href={s.sourceUrl} target="_blank" rel="noreferrer">
                  {s.name}
                </a>{" "}
                · {s.count.toLocaleString()} รายการ · {s.license}
                <p>
                  ดาวน์โหลด {date(s.downloadedAt)} · Commit{" "}
                  <code>{s.commit}</code>
                </p>
              </div>
            ))}
            <p>
              เวอร์ชัน {dataset.version} · ไม่วิเคราะห์พฤติกรรม ไม่ตาม redirect
              ไม่ตรวจความหมายของข้อความ
              และยังไม่รองรับเปิดเว็บใหม่แบบออฟไลน์บนเว็บโฮสต์
            </p>
          </details>
          <p>
            JobGuard — เครื่องมือตรวจสอบเบื้องต้นสำหรับการสมัครงาน
            ไม่รับรองความปลอดภัย
          </p>
        </footer>
      </main>
    </>
  );
}

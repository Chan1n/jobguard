import { AlertTriangle, Info, Check, Save } from "lucide-react";
import { dataset, Status, statusText } from "../lib/checkers";
import { decisions } from "../lib/history";
export type Result = {
  id: string;
  kind: "url" | "file";
  label: string;
  status: Status;
  fingerprint: string;
  evidence: string[];
  duplicate: boolean;
  decision?: string;
};
export default function ResultCard({
  result,
  onDecision,
}: {
  result: Result;
  onDecision: (id: string, value: string) => void;
}) {
  const source = dataset.sources[result.kind === "url" ? 0 : 1];
  return (
    <article className={`result ${result.status}`}>
      <div className="result-title">
        {result.status === "match" || result.status === "caution" ? (
          <AlertTriangle size={22} />
        ) : (
          <Info size={22} />
        )}
        <h3>{statusText[result.status]}</h3>
      </div>
      <p className="evidence">{result.label}</p>
      {result.duplicate && (
        <p className="duplicate">
          เคยตรวจรายการนี้แล้ว · ครั้งนี้บันทึกเป็นการตรวจใหม่
        </p>
      )}
      <ul>
        {result.evidence.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
      <p className="source">
        เทียบกับ {source.name} · สำเนา{" "}
        {new Date(source.downloadedAt).toLocaleDateString("th-TH")} ·{" "}
        {source.count.toLocaleString()} รายการ · {dataset.version}
      </p>
      <p className="advice">
        {result.status === "match"
          ? "ควรหลีกเลี่ยงการเปิดหรือรัน และยืนยันกับบริษัทผ่านช่องทางที่ค้นหาเอง"
          : "ไม่พบรายการ ไม่ได้แปลว่าปลอดภัย ควรยืนยันผู้ส่งและรายละเอียดงานกับบริษัทผ่านช่องทางที่ค้นหาเอง"}{" "}
        ระบบไม่วิเคราะห์พฤติกรรมมัลแวร์
      </p>
      <label htmlFor={`decision-${result.id}`}>
        การตัดสินใจของคุณ <span className="muted">(บันทึกที่คุณรายงานเอง)</span>
      </label>
      <div className="decision">
        <select
          id={`decision-${result.id}`}
          value={result.decision || ""}
          onChange={(e) => onDecision(result.id, e.target.value)}
        >
          <option value="" disabled>
            เลือกการตัดสินใจเพื่อบันทึก
          </option>
          {decisions
            .filter((d) => result.kind === "file" || d !== "ลบไฟล์แล้ว")
            .map((d) => (
              <option key={d}>{d}</option>
            ))}
        </select>
        {result.decision ? (
          <span className="saved">
            <Check size={16} /> บันทึกแล้ว
          </span>
        ) : (
          <Save size={19} />
        )}
      </div>
    </article>
  );
}

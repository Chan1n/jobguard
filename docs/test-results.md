# ผลทดสอบจริง — 27 ตุลาคม 2026

ตรวจด้วย Node 26.11.1 / npm 11.20.0 บน macOS และ ChatGPT in-app browser (IAB) ผ่าน localhost ของ static production build ไม่ใช้ปลายทางภัยจริงในการทดสอบ ไม่ดาวน์โหลดหรือรันมัลแวร์

ยืนยันเพิ่มเติม: `npm run dev` เริ่ม Next.js ที่ 127.0.0.1:3000 ได้จริง และ IAB โหลดหน้าหลักได้โดยไม่มี console error

## ผลตรรกะและ build

`npm test`: **11 ผ่าน / 0 ไม่ผ่าน** ดู [ผลเต็ม](evidence/unit-tests.txt) และ [build](evidence/build.txt) TypeScript ตรวจผ่านทั้งใน build และคำสั่ง typecheck

| กรณีที่ทดสอบจริง | ผลที่สังเกตได้ | หลักฐาน |
|---|---|---|
| Host ตัวใหญ่ + fragment / HTTP vs HTTPS / query ต่างลำดับ | Normalize ตามกฎ คง scheme/path/query รวมเครื่องหมายท้าย query | Unit test 1 |
| URL เต็มจากชุดจริง / path ที่ไม่อยู่ในชุด | พบเฉพาะรายการที่ตรง ไม่เหมารวมโดเมน | Unit test 2; `url-match.png` |
| ข้อความว่าง, malformed, FTP, >5 URL / รายการซ้ำในข้อความ | แจ้งแก้ไขหรือยุบรายการซ้ำ ไม่แสดงผลผ่าน | Unit test 3; UI ข้อความว่าง |
| แฮชไฟล์ข้อความที่สร้างเอง | Web Crypto ตรงกับ Node createHash และค่า SHA-256 มาตรฐานของ abc | Unit test 4 |
| SHA-256 จาก ESET ส่งเข้าฟังก์ชัน matcher | พบรายการจริง รับตัวพิมพ์ใหญ่/เล็ก ค่าไม่ตรงไม่พบ | Unit test 5 — ไม่มีไฟล์มัลแวร์ |
| Signature PDF/JPEG/PNG/ZIP | ระบุชนิดพื้นฐานและไม่อ้าง ZIP เป็น DOCX/APK | Unit test 6 |
| MZ อย่างเดียว / PE offset เกินขอบเขต | ไม่ระบุ PE ไม่อ่านเกินบัฟเฟอร์ | Unit test 7 |
| PE จำลอง .pdf | เตือนนามสกุลไม่ตรง แฮชไม่พบ ไม่อ้างว่าเป็นมัลแวร์ | Unit test 8; `file-result.png` |
| ไฟล์ว่าง / >20 MiB / 1 ไบต์ | ปฏิเสธสองกรณีแรก ไฟล์สั้นยังได้แฮชและผลบางส่วน | Unit test 9 |
| ประวัติ 105 รายการ serialize/read / ข้อผิดพลาด storage | จำกัด 100, คงการตัดสินใจ, ไม่มี URL เต็ม; failure ส่งต่อให้ UI handler | Unit tests 10–11 |

## ขั้นตอนในเบราว์เซอร์ที่ตรวจจริง

- หน้าเปิดได้ ชื่อ JobGuard ถูกต้อง ไม่ว่าง ไม่มี framework error overlay
- วาง `https://example.com/apply` → ไม่พบรายการ พร้อมคำอธิบายว่าไม่ได้รับรองความปลอดภัย
- เลือก “จะตรวจสอบกับบริษัทก่อน” → โหลดหน้าใหม่ → ประวัติยังมีการตัดสินใจและเวลา
- วาง URL ที่เลือกจากสำเนาจริง → พบรายการ พร้อมชื่อแหล่งและวันที่ ไม่มีลิงก์เปิด URL ภัยในผลตรวจ
- กดตรวจ URL เดิมอีกครั้ง → แจ้งว่าเคยตรวจ และเพิ่มเป็นอีกการตรวจโดยตั้งใจ
- เลือก `synthetic-pe.pdf` → Windows PE / นามสกุลไม่ตรง / ไม่พบแฮช ดู `file-result.png`
- เลือก `hello.txt` → ได้ SHA-256 และผล “ตรวจได้บางส่วน” ไม่อ้างว่าตรวจชนิด txt ได้
- เลือกไฟล์จำลอง 20 MiB ที่มี PDF header และข้อมูลศูนย์ (ไม่ใช่เอกสารสมบูรณ์) → ดับเบิลคลิกตรวจ → ได้ผลและประวัติ **1 รายการ** ดู `double-click.png` ยังไม่ใช้ผลนี้รับรองประสิทธิภาพบนมือถือจริง
- Console error/warning ที่อ่านจาก IAB ในรอบ QA: ไม่พบข้อผิดพลาดของแอป
- Desktop 1505×1045 และ mobile 390×844: ไม่พบการทับ/ตัดส่วนหลัก Mobile document width และ scrollWidth เท่ากัน 390 px

## การตรวจเครือข่าย

ใช้ `scripts/network-probe.mjs` เพิ่ม probe ชั่วคราวเฉพาะ `out/index.html` ของ build โดยเริ่มจับเวลาจาก click ก่อน submit แล้วอ่าน Resource Timing entries ผ่าน PerformanceObserver แสดงผลใน DOM เพื่อเก็บหลักฐานจาก IAB

- URL จริงที่ตรง feed: `scanStarted: true`, `requestsAfterScan: []`
- ไฟล์ hello.txt: `scanStarted: true`, `requestsAfterScan: []`
- Resource origins ที่โหลดทั้งหน้ามีเพียง `http://127.0.0.1:3000`
- ดู `network-url.json`, `network-file.json` และ `url-match.png` (มีรายงาน probe ท้ายภาพ)
- เรียก `node scripts/network-probe.mjs --restore` แล้ว probe ไม่อยู่ในต้นฉบับหรือ build ที่ส่งมอบ

นี่เป็นหลักฐาน Resource Timing ใน flow ที่ทดสอบ ไม่ใช่ packet capture ของระบบทั้งหมด ตรวจ source ประกอบแล้ว checker ไม่มี fetch/XHR/beacon/socket หรือการเปิด URL สคริปต์ prepare-data เป็นเครื่องมือเตรียมข้อมูลแยกจาก runtime หลังปรับฟอนต์มีการ build ใหม่ ฟอนต์ถูกแพ็กเป็นไฟล์ในเครื่อง ไม่มี CDN

## การตรวจแบบกับภาพจริง

ใช้ Image Gen concept ใน `design-concept.png` เป็นแนวทาง จากนั้นตรวจด้วย `view_image` เทียบกับ `evidence/desktop.png` ที่ขนาด concept 1505×1045 และตรวจมือถือแยก ภาพมาจาก IAB screenshot ไม่ใช้ Playwright fallback

| จุดเปรียบเทียบ | สิ่งที่ตรวจ / การปรับ |
|---|---|
| โครงสร้าง | header → intro → tool ซ้าย/คำแนะนำขวา → history → footer ตรงกับโครงหลัก |
| ความกว้าง/ระยะ | ปรับ max width ให้ขอบซ้ายประมาณ 100 px ใน 1505 px และ panel กว้างใกล้แบบ |
| ตัวอักษร | เปลี่ยนเป็น Noto Sans Thai ที่แพ็กในโปรเจกต์ ปรับหัวเรื่อง/label/body ให้อ่านชัด |
| สี/พื้นผิว | พื้น #f6f8fa, panel ขาว, navy text, teal accent และขอบบาง ไม่ใส่ภาพตกแต่ง |
| ปุ่ม/แท็บ/ไอคอน | รักษา tabs, CTA เต็มความกว้าง, icon เส้น, notice แยกจากผลตรวจ |
| มือถือ | ยุบเป็นคอลัมน์เดียว คำแนะนำต่อใต้ฟอร์ม ไม่มีการล้นแนวนอน |

Above-the-fold copy: หัวเรื่อง ชื่อแท็บ label และ CTA ตรงกับแบบ ข้อแตกต่างโดยตั้งใจเพื่อความถูกต้องตามแผน: เพิ่มข้อความไม่เปิดปลายทาง ปรับคำแนะนำให้กระชับ อธิบายการเก็บประวัติจริง เพิ่ม source details และ history retention ไม่มี eyebrow หรือสถิติที่แต่งขึ้น

การออกแบบถูกตรวจเทียบทั้งโครงสร้าง ฟอนต์ สี spacing และ controls แล้ว ไม่อ้างความตรงแบบทุกพิกเซล เนื่องจากใช้ฟอนต์ไทยจริงแทนข้อความที่อยู่ในภาพ concept; footer ยาวขึ้นเพื่อใส่ข้อมูลที่ต้องเปิดเผย

## เอกสารสองหน้า

`project-summary.html` เป็นเอกสาร A4 2 หน้า ใช้ print CSS เปิดแล้วพิมพ์/บันทึก PDF ด้วยตัวเลือก A4, scale 100%, margins none, ปิด browser headers/footers ได้ ยังไม่ได้ส่งออก PDF ในรอบนี้

ตรวจ DOM: หน้า 1 content bottom 1016.7 px / footer เริ่ม 1047.9 px; หน้า 2 content bottom 947.8 px / footer เริ่ม 1049.4 px ตรวจภาพ `summary-pages.png` ด้วย view_image แล้ว ข้อความไม่ทับเลขหน้า

## สิ่งที่ยังไม่ได้ทดสอบและข้อจำกัด

- ยังไม่มีมือถือจริง Firefox/Safari หรือการวัดเวลาทำงานบนอุปกรณ์สเปกต่ำ
- storage failure จำลองระดับฟังก์ชัน ยังไม่ได้บังคับ quota/private mode ใน browser จริง
- ยังไม่ได้ทดสอบปุ่มล้างประวัติในเบราว์เซอร์จริง ทดสอบ logic serialization/limit แล้ว
- ไม่มีการทดสอบกับนักศึกษา 60 คน ไม่มีผลก่อน–หลังของโครงการจริง
- ไม่ทดสอบไฟล์มัลแวร์จริง การคำนวณแฮชกับ matcher เป็นคนละการทดสอบ
- ไม่ตรวจ redirect, archive contents, หรือพฤติกรรมมัลแวร์ และไม่รับรองความปลอดภัย

import type { Metadata } from "next";
import "@fontsource/noto-sans-thai/thai-400.css";
import "@fontsource/noto-sans-thai/thai-500.css";
import "@fontsource/noto-sans-thai/thai-600.css";
import "@fontsource/noto-sans-thai/thai-700.css";
import "./globals.css";
export const metadata: Metadata = {
  title: "JobGuard — ตรวจเบื้องต้นก่อนกด ก่อนรัน",
  description:
    "ตรวจ URL และไฟล์จากการสมัครงานในเบราว์เซอร์ พร้อมหลักฐานและข้อจำกัด",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}

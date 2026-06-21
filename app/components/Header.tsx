import Link from "next/link";

export default function Header() {
  return (
    <div
      style={{
        padding: "14px 40px",
        borderBottom: "1px solid #ddd",
        display: "flex",
        gap: "20px",
        alignItems: "center",
        background: "#fff",
      }}
    >
      <strong>AI Staffing Platform</strong>

      <Link href="/">Home</Link>
      <Link href="/consultants">Consultants</Link>
      <Link href="/questions/upload">Question Upload</Link>
      <Link href="/questions">Question Bank</Link>
      <Link href="/interviews/manage">Interview Orchestration</Link>
    </div>
  );
}
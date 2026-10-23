import "./style.css";
export const metadata = {
  title: "vKnight Phiêu Lưu Ký",
  description: "5 thằng ngáo, một hành trình!",
};
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      {/* Browser extensions (e.g. ColorZilla's cz-shortcut-listen) add
          attributes to <body> before React hydrates; ignore those. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}

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
      <body>{children}</body>
    </html>
  );
}

import "./globals.css";

export const metadata = {
  title: "Introduced | Thoughtful Matchmaking",
  description: "Thoughtful matchmaking. Real introductions.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

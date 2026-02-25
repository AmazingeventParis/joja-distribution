import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "JOJA DISTRIBUTION - Admin",
  description: "Gestion des bons de livraison",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
          backgroundColor: "#f0f4f8",
          color: "#1a202c",
        }}
      >
        {children}
      </body>
    </html>
  );
}

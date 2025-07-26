import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import ErrorBoundary from "@/components/ErrorBoundary";

export const metadata: Metadata = {
  title: "Flaky Test Detector - AI-Powered Test Reliability Platform",
  description: "Eliminate flaky tests with intelligent detection and retry logic",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary>
          <AuthProvider>
            <OrganizationProvider>
              {children}
            </OrganizationProvider>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}

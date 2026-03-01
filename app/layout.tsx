"use client";

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { useMemo } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: "dark",
          primary: { main: "#818cf8" },
          secondary: { main: "#38bdf8" },
          background: {
            default: "transparent",
            paper: "rgba(255, 255, 255, 0.05)",
          },
          text: {
            primary: "#e2e8f0",
            secondary: "rgba(255,255,255,0.55)",
          },
        },
        typography: {
          fontFamily: "var(--font-geist-sans), Arial, sans-serif",
        },
        components: {
          MuiPaper: {
            styleOverrides: { root: { backgroundImage: "none" } },
          },
          MuiCard: {
            styleOverrides: { root: { backgroundImage: "none" } },
          },
          MuiOutlinedInput: {
            styleOverrides: {
              root: {
                "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                  borderWidth: 1.5,
                },
              },
            },
          },
        },
      }),
    []
  );

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}


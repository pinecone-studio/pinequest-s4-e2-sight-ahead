"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronDown,
  LayoutDashboard,
  LogIn,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import { useTheme } from "@/_comps/providers/ThemeProvider";
import { useAuth } from "@/_comps/providers/AuthProvider";
import { useUI } from "@/_comps/providers/UIprovider";
import { Button } from "@/_comps/ui/Button";
import { useRouter } from "next/navigation";
import SearchBox from "./SearchBox";

export default function Header({
  onSignIn,
  searchbar = false,
}: {
  onSignIn: () => void;
  // When enabled AND a user is signed in, the search box lives here in the
  // header (so pages don't need their own). Off by default.
  searchbar?: boolean;
}) {
  const { theme, toggleTheme } = useTheme();
  const { user, loading, logout } = useAuth();
  const { isSubscribed } = useUI();
  const router = useRouter();

  // User name dropdown (logout / dashboard) — closes on outside click or Escape.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (!(event.target instanceof Node)) return;
      if (menuRef.current?.contains(event.target)) return;
      setMenuOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-4 px-4 sm:px-8 py-4 border-b border-border bg-background/80 backdrop-blur-md">
      {/* Left: logo */}
      <Link href="/" className="shrink-0">
        <img src="/helexlogo.svg" alt="Helex" className="h-12 w-auto" />
      </Link>

      {/* Center: search */}
      {searchbar && user && (
        <div className="flex flex-1 justify-center">
          <SearchBox UI="header" onSubmit={() => {}} />
        </div>
      )}

      {/* Right: user / auth actions */}
      <div className="flex items-center gap-2 shrink-0">
        {loading ? (
          <div className="w-24 h-9" aria-hidden="true" />
        ) : user ? (
          <>
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span className="hidden sm:inline max-w-40 truncate">
                  {user.displayName || user.email}
                </span>
                {isSubscribed && (
                  <CheckCircle2
                    className="w-4 h-4 text-emerald-500"
                    aria-label="Pro хэрэглэгч"
                  />
                )}
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground transition-transform ${
                    menuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-md border border-border bg-background shadow-lg"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      router.push("/dashboard");
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium hover:bg-accent"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Нүүр хуудас</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium hover:bg-accent"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Гарах</span>
                  </button>
                </div>
              )}
            </div>

            {!isSubscribed && (
              <Link
                className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent"
                href="/checkout"
              >
                Про эрх авах
              </Link>
            )}
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onSignIn}
              className="flex items-center gap-2 text-sm font-medium"
            >
              <LogIn className="w-4 h-4" />
              <span>Нэвтрэх</span>
            </Button>
            <Link
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent"
              href="/"
              onClick={(event) => {
                event.preventDefault();
                onSignIn();
              }}
            >
              Про эрх авах
            </Link>
          </>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="rounded-full"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <Sun className="w-5 h-5 text-yellow-400" />
          ) : (
            <Moon className="w-5 h-5 text-slate-600" />
          )}
        </Button>
      </div>
    </header>
  );
}

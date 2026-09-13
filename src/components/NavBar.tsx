"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const tabClass = (href: string) =>
    `px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
      pathname === href ? "bg-accent text-panel" : "text-muted hover:text-ink"
    }`;

  return (
    <nav className="sticky top-0 z-10 backdrop-blur bg-base/90 border-b border-edge">
      <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-y-2 gap-x-4">
        <Link href="/" className="text-lg font-semibold tracking-tight shrink-0">
          brentco
        </Link>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap items-center gap-1">
            <Link href="/" className={tabClass("/")}>
              2026 Listens
            </Link>
            <Link href="/saved" className={tabClass("/saved")}>
              Saved
            </Link>
            <Link href="/recommendations" className={tabClass("/recommendations")}>
              Recommended
            </Link>
          </div>

          <Link
            href="/search"
            className="px-3 py-1.5 rounded-full text-sm font-medium border border-accent text-accent hover:bg-accent hover:text-panel transition-colors"
          >
            + Add album
          </Link>

          <button onClick={handleLogout} className="text-xs text-muted hover:text-ink transition-colors">
            Log out
          </button>
        </div>
      </div>
    </nav>
  );
}

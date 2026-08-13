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

  const linkClass = (href: string) =>
    `px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
      pathname === href ? "bg-spotify text-black" : "text-muted hover:text-ink"
    }`;

  return (
    <nav className="sticky top-0 z-10 backdrop-blur bg-base/90 border-b border-edge">
      <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-y-2">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          blerglams
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/" className={linkClass("/")}>
            Library
          </Link>
          <Link href="/saved" className={linkClass("/saved")}>
            Saved
          </Link>
          <Link href="/recommendations" className={linkClass("/recommendations")}>
            Recommended
          </Link>
          <Link href="/search" className={linkClass("/search")}>
            Add album
          </Link>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-full text-sm font-medium text-muted hover:text-ink"
          >
            Log out
          </button>
        </div>
      </div>
    </nav>
  );
}

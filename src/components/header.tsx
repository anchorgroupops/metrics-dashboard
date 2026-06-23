import Image from "next/image";
import Link from "next/link";

export function Header() {
  return (
    <header className="bg-clear-water text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/anchor-logo.png"
              alt="The Anchor Team"
              width={40}
              height={40}
              className="rounded-full"
            />
            <div>
              <h1
                className="text-lg font-bold leading-tight"
                style={{ fontFamily: "'Collier', Georgia, serif" }}
              >
                The Anchor Team
              </h1>
              <p
                className="text-xs text-pearl-aqua leading-tight"
                style={{ fontFamily: "'Dax Pro', sans-serif" }}
              >
                Performance Metrics
              </p>
            </div>
          </Link>
          <nav
            className="hidden sm:flex items-center gap-6 text-sm"
            style={{ fontFamily: "'Dax Pro', sans-serif" }}
          >
            <Link
              href="/"
              className="text-pearl-aqua hover:text-white transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/leaderboard"
              className="text-pearl-aqua hover:text-white transition-colors"
            >
              Leaderboard
            </Link>
            <Link
              href="/upload"
              className="text-pearl-aqua hover:text-white transition-colors"
            >
              Upload
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}

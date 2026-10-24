import Link from "next/link";
export default function NotFound() {
  return (
    <main className="narrow">
      <h1>Page not found</h1>
      <p>This page may have moved.</p>
      <Link className="button primary" href="/projects">
        Back to projects
      </Link>
    </main>
  );
}

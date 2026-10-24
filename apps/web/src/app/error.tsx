"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="narrow">
      <h1>Something went wrong</h1>
      <p>Please reload this page to try again.</p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}

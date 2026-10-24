"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  Github,
  Network,
  Film,
  FileCode,
  Share2,
  Check,
  ShieldCheck,
} from "lucide-react";
import { BRAND, type RenderProps } from "@reporeel/shared";
import { api, mutation, errorText } from "../../lib/api";
import { Brand } from "../shell/Shell";
import { Button, ErrorState, Skeleton, Chip } from "../ui/primitives";
import { PlayerPanel } from "../video/PlayerPanel";
import { FlowCanvas } from "../diagram/FlowCanvas";
import sample from "../../../../../packages/video/src/sample.json";
export function Marketing() {
  const props = sample as unknown as RenderProps;
  return (
    <div className="marketing">
      <header className="marketing-nav">
        <Brand />
        <nav aria-label="Main">
          <a href="#how-it-works">How it works</a>
          <Link href="/s/demo">
            Sample project
            <ArrowUpRight size={14} />
          </Link>
          <Link href="/login" className="button secondary">
            Open workspace
            <ArrowRight size={15} />
          </Link>
        </nav>
      </header>
      <main>
        <section className="hero">
          <div>
            <div className="eyebrow">
              <span className="connection-indicator" />A CLEARER WAY INTO YOUR
              CODE
            </div>
            <h1>Understand any codebase in two minutes.</h1>
            <p>
              Turn a GitHub repository into an interactive architecture diagram
              and a beautifully simple walkthrough. Follow the code. See the
              story.
            </p>
            <div className="button-row">
              <Link href="/login" className="button primary">
                Try with a repo
                <ArrowRight size={16} />
              </Link>
              <Link href="/s/demo" className="button secondary">
                See a sample
              </Link>
            </div>
            <div className="hero-note">
              <Check size={14} />
              No paid API keys needed to get started.
            </div>
          </div>
          <div className="hero-preview">
            <div className="hero-preview-title">
              <span className="window-dots">
                <i />
                <i />
                <i />
              </span>
              <span>atlas / architecture walkthrough</span>
              <span className="chip mint">Source-grounded</span>
            </div>
            {props.graph && <PlayerPanel renderProps={props} compact />}
            <div className="hero-preview-footer">
              <Film size={14} />A repository. A diagram. A story you can follow.
            </div>
          </div>
        </section>
        <section id="how-it-works" className="how-it-works">
          <div className="eyebrow">A LITTLE LESS GUESSWORK</div>
          <h2>
            From “where do I start?”
            <br />
            to “now I get it.”
          </h2>
          <div className="three-steps">
            {[
              [
                "01",
                "Bring your repository",
                "Paste a public GitHub URL or securely connect a private repository.",
              ],
              [
                "02",
                "See the connections",
                "Explore modules, dependencies and real source evidence in one clear diagram.",
              ],
              [
                "03",
                "Tell the story",
                "Refine the walkthrough, export the diagram, or share an animated explainer.",
              ],
            ].map(([n, title, text]) => (
              <div key={n}>
                <span>{n}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="outputs-strip">
          <div>
            <span className="eyebrow">ONE SOURCE. EVERY FORMAT.</span>
            <h2>Clarity travels well.</h2>
          </div>
          <div>
            {[
              [Network, "Interactive diagram"],
              [FileCode, "Excalidraw & Mermaid"],
              [Film, "Animated video"],
              [Share2, "Shareable link"],
            ].map(([Icon, label]) => {
              const C = Icon as typeof Network;
              return (
                <span key={String(label)}>
                  <C size={18} />
                  {String(label)}
                </span>
              );
            })}
          </div>
        </section>
        <section className="closing-cta">
          <h2>
            Your next codebase
            <br />
            doesn’t have to be a mystery.
          </h2>
          <Link href="/login" className="button primary">
            Make the connections
            <ArrowRight size={16} />
          </Link>
        </section>
      </main>
      <footer className="marketing-footer">
        <Brand />
        <span>From repository to understanding.</span>
        <Link href="/s/demo">
          Explore the sample
          <ArrowUpRight size={14} />
        </Link>
      </footer>
    </div>
  );
}
export function Login() {
  const router = useRouter();
  const [config, setConfig] = useState<{ github: boolean; demo: boolean }>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    void api<{ github: boolean; demo: boolean }>("/auth/config")
      .then(setConfig)
      .catch((e) => setError(errorText(e)));
  }, []);
  return (
    <main className="login-page">
      <div className="login-card">
        <Brand />
        <div className="login-divider" />
        <div className="eyebrow">MAKE YOURSELF AT HOME</div>
        <h1>
          A clearer view
          <br />
          starts here.
        </h1>
        <p>
          Connect your repositories.
          <br />
          Discover how the pieces fit together.
        </p>
        {error && <ErrorState message={error} />}
        <a className="button secondary github-login" href="/api/v1/auth/github">
          <Github size={18} />
          Continue with GitHub
          <ArrowRight size={16} />
        </a>
        {config?.demo && (
          <Button
            variant="ghost"
            busy={busy}
            className="demo-login"
            onClick={() => {
              setBusy(true);
              void mutation("/auth/demo", "POST")
                .then(() => router.push("/projects"))
                .catch((e) => setError(errorText(e)))
                .finally(() => setBusy(false));
            }}
          >
            Try the local workspace
            <ArrowRight size={15} />
          </Button>
        )}
        <div className="login-privacy">
          <ShieldCheck size={16} />
          <span>Read-only access. Your repository code is never executed.</span>
        </div>
      </div>
      <Link href="/" className="login-back">
        ← Back to {BRAND.name}
      </Link>
    </main>
  );
}
export function PublicShare({ slug }: { slug: string }) {
  const [props, setProps] = useState<RenderProps>(),
    [error, setError] = useState("");
  const [videoUrl, setVideoUrl] = useState<string>();
  useEffect(() => {
    setError("");
    setProps(undefined);
    setVideoUrl(undefined);
    let active = true;
    if (slug === "demo") {
      setProps(sample as unknown as RenderProps);
      return;
    }
    void api<{ renderProps: RenderProps; videoUrl?: string }>("/public/" + slug)
      .then((data) => {
        if (active) {
          setProps(data.renderProps);
          setVideoUrl(data.videoUrl);
        }
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      });
    return () => {
      active = false;
    };
  }, [slug]);
  return (
    <div className="public-share">
      <header className="marketing-nav">
        <Brand />
        <Link href="/login" className="button secondary">
          Make your own
          <ArrowRight size={15} />
        </Link>
      </header>
      <main>
        {error ? (
          <ErrorState message={error} />
        ) : !props ? (
          <Skeleton rows={5} />
        ) : (
          <>
            <div className="share-page-title">
              <Chip tone="mint">
                {slug === "demo" ? "Sample walkthrough" : "Shared walkthrough"}
              </Chip>
              <h1>{props.repo.meta.repo}</h1>
              <p>{props.graph.tagline}</p>
              <span className="quiet">
                {props.repo.meta.owner}/{props.repo.meta.repo} ·{" "}
                {props.repo.meta.commitSha.slice(0, 7)}
              </span>
            </div>
            <PlayerPanel renderProps={props} videoUrl={videoUrl} />
            <section className="shared-diagram">
              <div className="section-heading">
                <div>
                  <h2>Follow the connections.</h2>
                  <p>Select a module to explore the source evidence.</p>
                </div>
                <span className="quiet">
                  {props.graph.nodes.length} modules
                </span>
              </div>
              <FlowCanvas renderProps={props} readOnly />
            </section>
          </>
        )}
      </main>
      <footer className="marketing-footer">
        <Brand />
        <span>Source-grounded. Made for understanding.</span>
      </footer>
    </div>
  );
}

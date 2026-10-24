"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ArrowRight,
  Github,
  Link2,
  Volume2,
  Clock,
  ShieldCheck,
  Search,
} from "lucide-react";
import { defaults, type RunOptions, type Project } from "@reporeel/shared";
import { api, mutation, errorText, type User } from "../../lib/api";
import {
  PageHeader,
  Button,
  Field,
  Segmented,
  Select,
  Switch,
  ErrorState,
  Modal,
} from "../ui/primitives";
type Repository = {
  id: number;
  name: string;
  url: string;
  private: boolean;
  description: string | null;
};
const validRepo = (value: string) =>
  /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(?:\/tree\/[^?#\s]+)?\/?$/.test(
    value,
  );
export function Wizard({ user }: { user: User }) {
  const router = useRouter();
  const [url, setUrl] = useState(""),
    [branch, setBranch] = useState(""),
    [options, setOptions] = useState<RunOptions>(() => {
      try {
        return {
          ...defaults,
          ...(JSON.parse(
            localStorage.getItem("rr-defaults") ?? "{}",
          ) as Partial<RunOptions>),
        };
      } catch {
        return defaults;
      }
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [picker, setPicker] = useState(false),
    [repos, setRepos] = useState<Repository[]>([]),
    [repoSearch, setRepoSearch] = useState(""),
    [repoError, setRepoError] = useState(""),
    [privateRepo, setPrivateRepo] = useState(false),
    [privateConsent, setPrivateConsent] = useState(false),
    [showBranch, setShowBranch] = useState(false);
  const set = <K extends keyof RunOptions>(key: K, value: RunOptions[K]) =>
    setOptions((o) => ({ ...o, [key]: value }));
  useEffect(() => {
    if (picker) {
      setRepoError("");
      void api<Repository[]>("/github/repos")
        .then(setRepos)
        .catch((e) => setRepoError(errorText(e)));
    }
  }, [picker]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const project = await mutation<Project>("/projects", "POST", {
        repoUrl: url,
      });
      const run = await mutation<{ runId: string }>(
        `/projects/${project.id}/runs`,
        "POST",
        {
          options: { ...options, branch: branch || undefined, privateConsent },
        },
      );
      router.push(`/projects/${project.id}/runs/${run.runId}`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        title="A new perspective on your code."
        description="Choose a repository. We’ll connect the dots."
        eyebrow="NEW PROJECT"
      />
      <form
        onSubmit={(e) => {
          void submit(e);
        }}
        className="wizard"
      >
        <div className="wizard-fields">
          <section className="form-section">
            <div className="form-section-title">
              <span className="step-number">01</span>
              <h2>Repository</h2>
            </div>
            <Field
              label="GitHub repository URL"
              helper="Public repositories work immediately. No installation required."
              error={
                url && !validRepo(url)
                  ? "Use https://github.com/owner/repository"
                  : undefined
              }
            >
              <div className="url-field">
                <Link2 size={17} />
                <input
                  aria-label="GitHub repository URL"
                  autoFocus
                  type="url"
                  placeholder="https://github.com/owner/repository"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                />
                {validRepo(url) && <Check size={17} className="mint-ink" />}
              </div>
            </Field>
            <div className="form-links">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPicker(true)}
              >
                <Github size={15} />
                Choose from my repos
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowBranch(!showBranch)}
              >
                {showBranch ? "Hide branch" : "Choose a branch"}
              </Button>
            </div>
            {showBranch && (
              <Field
                label="Branch or commit"
                helper="Leave blank to use the default branch."
              >
                <input
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                />
              </Field>
            )}
            <label className="check-row">
              <input
                type="checkbox"
                checked={privateRepo}
                onChange={(e) => setPrivateRepo(e.target.checked)}
              />
              This is a private repository
            </label>
            {privateRepo && (
              <div className="private-notice">
                {!user.githubConnected && (
                  <>
                    <p>Connect GitHub to read private repository files.</p>
                    <a className="button secondary" href="/api/v1/auth/github">
                      <Github size={15} />
                      Connect GitHub access
                    </a>
                  </>
                )}
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={privateConsent}
                    onChange={(e) => setPrivateConsent(e.target.checked)}
                  />
                  I understand that short code excerpts may be sent to my
                  configured AI provider to write the explanation.
                </label>
              </div>
            )}
          </section>
          <section className="form-section">
            <div className="form-section-title">
              <span className="step-number">02</span>
              <h2>The walkthrough</h2>
            </div>
            <div className="field">
              <label>Who is it for?</label>
              <Segmented
                label="Audience"
                value={options.audience}
                onChange={(v) => set("audience", v)}
                options={[
                  { label: "Developers", value: "developer" },
                  { label: "Beginners", value: "beginner" },
                  { label: "Executives", value: "executive" },
                ]}
              />
            </div>
            <div className="field">
              <label>Video length</label>
              <Segmented
                label="Video length"
                value={options.targetSeconds}
                onChange={(v) => set("targetSeconds", v)}
                options={([30, 60, 90, 180] as const)
                  .filter((v) => user.plan !== "free" || v <= 60)
                  .map((v) => ({
                    label: v < 60 ? v + " sec" : v / 60 + " min",
                    value: v,
                  }))}
              />
              <small className="helper">
                30–60 seconds included in the free workspace.
              </small>
            </div>
            <Field
              label="Narration"
              helper={
                options.voice.provider === "silent"
                  ? "An animated video with on-screen captions. No API key needed."
                  : "Uses the server’s configured voice provider key."
              }
            >
              <Select
                value={options.voice.provider}
                onChange={(e) =>
                  set("voice", {
                    provider: e.target.value as RunOptions["voice"]["provider"],
                    voiceId:
                      e.target.value === "elevenlabs"
                        ? "21m00Tcm4TlvDq8ikWAM"
                        : "alloy",
                  })
                }
              >
                <option value="silent">Silent · captions only</option>
                <option value="openai">OpenAI · Alloy</option>
                <option value="elevenlabs">ElevenLabs · custom voice</option>
              </Select>
            </Field>
            {options.voice.provider === "elevenlabs" && (
              <Field label="ElevenLabs voice ID">
                <input
                  value={options.voice.voiceId}
                  onChange={(e) =>
                    set("voice", { ...options.voice, voiceId: e.target.value })
                  }
                />
              </Field>
            )}
            {options.voice.provider !== "silent" && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  if ("speechSynthesis" in window) {
                    speechSynthesis.cancel();
                    speechSynthesis.speak(
                      new SpeechSynthesisUtterance(
                        "A clear perspective on how your code fits together.",
                      ),
                    );
                  }
                }}
              >
                <Volume2 size={15} />
                Preview browser speech
              </Button>
            )}
            <Switch
              checked={options.captions}
              onChange={(v) => set("captions", v)}
              label="On-screen captions"
              description="Follow every part of the story."
            />
            <Switch
              checked={options.music}
              onChange={(v) => set("music", v)}
              label="Background music"
              description="A subtle, original ambient bed."
            />
          </section>
          <section className="form-section">
            <div className="form-section-title">
              <span className="step-number">03</span>
              <h2>The diagram</h2>
            </div>
            <div className="field">
              <label>Drawing style</label>
              <Segmented
                label="Diagram style"
                value={options.style}
                onChange={(v) => set("style", v)}
                options={[
                  { value: "clean", label: "Clean & precise" },
                  { value: "sketch", label: "Hand-drawn" },
                ]}
              />
            </div>
          </section>
          {error && <ErrorState message={error} />}
          <div className="form-footer">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push("/projects")}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              busy={busy}
              disabled={
                !validRepo(url) ||
                (privateRepo && (!user.githubConnected || !privateConsent))
              }
            >
              Generate
              <ArrowRight size={16} />
            </Button>
          </div>
        </div>
        <aside className="wizard-summary">
          <div className="eyebrow">ONE REPOSITORY. A CLEARER PICTURE.</div>
          <h2>Here’s what you’ll get.</h2>
          <ul>
            {[
              "An interactive architecture diagram",
              "A source-grounded walkthrough",
              "A captioned, animated video",
              "Excalidraw, Mermaid, SVG & PNG",
              "A link to share your explanation",
            ].map((item) => (
              <li key={item}>
                <Check size={16} />
                {item}
              </li>
            ))}
          </ul>
          <hr />
          <div className="summary-line">
            <Clock size={16} />
            <span>Usually ready in a few minutes</span>
          </div>
          <div className="summary-line">
            <ShieldCheck size={16} />
            <span>Your repository code is never executed</span>
          </div>
          <div className="wizard-usage">
            <strong>
              {Math.max(0, 3 - user.usage.runs)} of 3 runs available
            </strong>
            <small>Free workspace · resets monthly</small>
          </div>
        </aside>
      </form>
      <Modal
        open={picker}
        onOpenChange={setPicker}
        title="Choose a repository"
        description="Your 100 most recently updated GitHub repositories."
      >
        <div className="search-input">
          <Search size={17} />
          <input
            aria-label="Search your repositories"
            placeholder="Find a repository"
            value={repoSearch}
            onChange={(e) => setRepoSearch(e.target.value)}
          />
        </div>
        {repoError ? (
          <ErrorState
            message={repoError}
            action={
              !user.githubConnected ? (
                <a className="button secondary" href="/api/v1/auth/github">
                  Connect GitHub
                </a>
              ) : undefined
            }
          />
        ) : (
          <div className="repo-picker">
            {repos
              .filter((r) =>
                r.name.toLowerCase().includes(repoSearch.toLowerCase()),
              )
              .map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setUrl(r.url);
                    setPrivateRepo(r.private);
                    setPicker(false);
                  }}
                >
                  <Github size={17} />
                  <span>
                    <strong>{r.name}</strong>
                    <small>
                      {r.private ? "Private" : "Public"} · {r.description}
                    </small>
                  </span>
                  <ArrowRight size={16} />
                </button>
              ))}
          </div>
        )}
      </Modal>
    </>
  );
}

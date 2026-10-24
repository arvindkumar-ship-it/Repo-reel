"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Github, Check, ArrowUpRight, Trash2 } from "lucide-react";
import { defaults, type RunOptions } from "@reporeel/shared";
import { api, mutation, errorText, type User } from "../../lib/api";
import {
  PageHeader,
  Button,
  Progress,
  Badge,
  Segmented,
  Modal,
  useToast,
} from "../ui/primitives";
export function SettingsPage({
  user,
  refresh,
}: {
  user: User;
  refresh: (u: User) => void;
}) {
  const router = useRouter(),
    toast = useToast(),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [options, setOptions] = useState<RunOptions>(() => {
      try {
        return {
          ...defaults,
          ...(JSON.parse(
            localStorage.getItem("rr-defaults") ?? "{}",
          ) as RunOptions),
        };
      } catch {
        return defaults;
      }
    });
  return (
    <>
      <PageHeader
        title="Settings"
        description="A few things to make this workspace yours."
        eyebrow="YOUR ACCOUNT"
      />
      <div className="settings-page">
        <section>
          <div>
            <h2>Profile</h2>
            <p>Your workspace identity.</p>
          </div>
          <div className="profile-card">
            <span className="avatar large">{user.name[0]}</span>
            <div>
              <strong>{user.name}</strong>
              <small>
                {user.githubConnected
                  ? "Connected with GitHub"
                  : "Local development account"}
              </small>
            </div>
            <Badge status="completed">{user.plan} plan</Badge>
          </div>
        </section>
        <section>
          <div>
            <h2>GitHub connection</h2>
            <p>Read public and private repositories securely.</p>
          </div>
          <div className="connection-card">
            <Github size={23} />
            <div>
              <strong>
                {user.githubConnected
                  ? "GitHub is connected"
                  : "Connect your GitHub account"}
              </strong>
              <p>
                {user.githubConnected
                  ? "Your access token is encrypted on the server."
                  : "Private repository access requires a GitHub connection."}
              </p>
            </div>
            {user.githubConnected ? (
              <Button
                onClick={() => {
                  void mutation("/github/connection", "DELETE")
                    .then(() => api<User>("/me"))
                    .then((u) => {
                      refresh(u);
                      toast("GitHub disconnected");
                    })
                    .catch((e) => toast(errorText(e)));
                }}
              >
                Disconnect
              </Button>
            ) : (
              <a className="button secondary" href="/api/v1/auth/github">
                Connect
                <ArrowUpRight size={15} />
              </a>
            )}
          </div>
        </section>
        <section>
          <div>
            <h2>Default options</h2>
            <p>A starting point for your next repository.</p>
          </div>
          <div>
            <div className="field">
              <label>Audience</label>
              <Segmented
                label="Default audience"
                value={options.audience}
                onChange={(v) => setOptions({ ...options, audience: v })}
                options={[
                  { value: "developer", label: "Developer" },
                  { value: "beginner", label: "Beginner" },
                  { value: "executive", label: "Executive" },
                ]}
              />
            </div>
            <div className="field">
              <label>Diagram style</label>
              <Segmented
                label="Default diagram style"
                value={options.style}
                onChange={(v) => setOptions({ ...options, style: v })}
                options={[
                  { value: "clean", label: "Clean" },
                  { value: "sketch", label: "Sketch" },
                ]}
              />
            </div>
            <Button
              onClick={() => {
                localStorage.setItem("rr-defaults", JSON.stringify(options));
                toast("Defaults saved on this device");
              }}
            >
              <Check size={15} />
              Save defaults
            </Button>
          </div>
        </section>
        <section>
          <div>
            <h2>Usage this month</h2>
            <p>Free workspace · resets at the start of each UTC month.</p>
          </div>
          <div className="usage-settings">
            <div>
              <strong>Analysis runs</strong>
              <span>{user.usage.runs} / 3</span>
            </div>
            <Progress
              value={(user.usage.runs / 3) * 100}
              label="Analysis runs used"
            />
            <div>
              <strong>Video seconds requested</strong>
              <span>{user.usage.renderSeconds}s</span>
            </div>
            <small>
              Up to 60 seconds per video. Exports and live previews are
              included.
            </small>
          </div>
        </section>
        <section className="danger-zone">
          <div>
            <h2>Delete account</h2>
            <p>Permanently remove this account and its projects.</p>
          </div>
          <Button variant="danger" onClick={() => setConfirm(true)}>
            <Trash2 size={15} />
            Delete account
          </Button>
        </section>
      </div>
      <Modal
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete your account?"
        description="This permanently removes your projects, run history, artifacts and public share links."
      >
        <div className="modal-actions">
          <Button variant="ghost" onClick={() => setConfirm(false)}>
            Keep account
          </Button>
          <Button
            variant="danger"
            busy={busy}
            onClick={() => {
              setBusy(true);
              void mutation("/me", "DELETE")
                .then(() => mutation("/auth/logout", "POST"))
                .then(() => router.push("/"))
                .catch((e) => toast(errorText(e)))
                .finally(() => setBusy(false));
            }}
          >
            Delete everything
          </Button>
        </div>
      </Modal>
    </>
  );
}

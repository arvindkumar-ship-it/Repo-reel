"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, type User, ApiError, errorText } from "../lib/api";
import { Shell } from "./shell/Shell";
import { Skeleton, ErrorState, Button } from "./ui/primitives";
import { Dashboard } from "./pages/Dashboard";
import { Wizard } from "./pages/Wizard";
import { Workspace } from "./pages/Workspace";
import { RunProgress } from "./pages/RunProgress";
import { SettingsPage } from "./pages/Settings";
import { Marketing, Login, PublicShare } from "./pages/Public";
import { Showcase } from "./pages/Showcase";
export function Application() {
  const pathname = usePathname(),
    router = useRouter(),
    [user, setUser] = useState<User>(),
    [error, setError] = useState("");
  const publicRoute =
    pathname === "/" || pathname === "/login" || pathname.startsWith("/s/");
  useEffect(() => {
    if (publicRoute) return;
    let active = true;
    void api<User>("/me")
      .then((u) => {
        if (active) {
          setUser(u);
          setError("");
        }
      })
      .catch((e) => {
        if (e instanceof ApiError && e.code === "UNAUTHORIZED")
          router.replace("/login");
        else if (active) setError(errorText(e));
      });
    return () => {
      active = false;
    };
  }, [pathname, publicRoute, router]);
  if (pathname === "/") return <Marketing />;
  if (pathname === "/login") return <Login />;
  if (pathname.startsWith("/s/"))
    return <PublicShare slug={pathname.split("/")[2] ?? ""} />;
  if (!user)
    return (
      <main className="narrow">
        {error ? (
          <ErrorState
            message={error}
            action={<Button onClick={() => location.reload()}>Reload</Button>}
          />
        ) : (
          <Skeleton rows={5} />
        )}
      </main>
    );
  const parts = pathname.split("/").filter(Boolean);
  let content: React.ReactNode;
  if (pathname === "/projects") content = <Dashboard />;
  else if (pathname === "/projects/new") content = <Wizard user={user} />;
  else if (parts[0] === "projects" && parts[2] === "runs")
    content = <RunProgress projectId={parts[1]!} runId={parts[3]!} />;
  else if (parts[0] === "projects" && parts[1])
    content = <Workspace projectId={parts[1]} tab={parts[2] ?? "overview"} />;
  else if (pathname === "/settings")
    content = <SettingsPage user={user} refresh={setUser} />;
  else if (pathname === "/dev/ui") content = <Showcase />;
  else
    content = (
      <ErrorState
        message="Page not found"
        action={
          <Button onClick={() => router.push("/projects")}>
            Back to projects
          </Button>
        }
      />
    );
  return <Shell user={user}>{content}</Shell>;
}

"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  PanelsTopLeft,
  Settings,
  ChevronsLeft,
  PanelLeftOpen,
  MoreHorizontal,
  Menu as MenuIcon,
  ArrowUpRight,
  BookOpen,
  Clapperboard,
  ChevronRight,
} from "lucide-react";
import { BRAND } from "@reporeel/shared";
import type { User } from "../../lib/api";
import { mutation } from "../../lib/api";
import { IconButton, Menu, Modal, Progress } from "../ui/primitives";
export function Brand() {
  return (
    <Link href="/" className="brand">
      <span className="brand-mark">
        <Clapperboard size={19} strokeWidth={1.8} />
      </span>
      <span>{BRAND.name}</span>
    </Link>
  );
}
export function Shell({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const pathname = usePathname(),
    router = useRouter();
  const [collapsed, setCollapsed] = useState(false),
    [mobile, setMobile] = useState(false);
  useEffect(() => {
    setCollapsed(localStorage.getItem("rr-sidebar") === "collapsed");
  }, []);
  const toggle = () => {
    setCollapsed((v) => {
      localStorage.setItem("rr-sidebar", !v ? "collapsed" : "expanded");
      return !v;
    });
  };
  const navigation = (
    <>
      <Brand />
      <div className="nav-label">WORKSPACE</div>
      <nav aria-label="Workspace">
        <Link
          href="/projects"
          className={`nav-item ${pathname.startsWith("/projects") ? "active" : ""}`}
          aria-current={pathname.startsWith("/projects") ? "page" : undefined}
        >
          <PanelsTopLeft size={18} />
          <span>Projects</span>
          {!collapsed && <span className="nav-count">{user.usage.runs}</span>}
        </Link>
      </nav>
      <div className="nav-label account-label">ACCOUNT</div>
      <nav aria-label="Account">
        <Link
          href="/settings"
          className={`nav-item ${pathname === "/settings" ? "active" : ""}`}
          aria-current={pathname === "/settings" ? "page" : undefined}
        >
          <Settings size={18} />
          <span>Settings</span>
        </Link>
      </nav>
      <div className="sidebar-spacer" />
      <div className="usage-panel">
        <div>
          <span>Monthly usage</span>
          <span>{user.usage.runs} / 3</span>
        </div>
        <Progress
          value={(user.usage.runs / 3) * 100}
          label="Monthly runs used"
        />
        <small>Free workspace</small>
      </div>
      <a className="nav-item help-link" href="/dev/ui">
        <BookOpen size={17} />
        <span>Design system</span>
        <ArrowUpRight size={14} />
      </a>
      <div className="sidebar-user">
        <span className="avatar">{user.name[0]}</span>
        <div>
          <strong>{user.name}</strong>
          <small>
            {user.githubConnected ? "GitHub connected" : "Local workspace"}
          </small>
        </div>
        <Menu
          trigger={
            <button className="icon-button" aria-label="Account menu">
              <MoreHorizontal size={18} />
            </button>
          }
          items={[
            { label: "Settings", onSelect: () => router.push("/settings") },
            {
              label: "Sign out",
              onSelect: () => {
                void mutation("/auth/logout", "POST").then(() =>
                  router.push("/login"),
                );
              },
            },
          ]}
        />
      </div>
    </>
  );
  return (
    <div className={`app-shell ${collapsed ? "collapsed" : ""}`}>
      <aside className="sidebar">
        {navigation}
        <IconButton
          label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={toggle}
          className="collapse-toggle"
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <ChevronsLeft size={16} />}
        </IconButton>
      </aside>
      <div className="app-content">
        <header className="topbar">
          <IconButton
            label="Open navigation"
            className="mobile-menu"
            onClick={() => setMobile(true)}
          >
            <MenuIcon size={20} />
          </IconButton>
          <div className="breadcrumbs">
            <Link href="/projects">Workspace</Link>
            <ChevronRight size={14} />
            <span>
              {pathname === "/settings"
                ? "Settings"
                : pathname === "/dev/ui"
                  ? "Design system"
                  : "Projects"}
            </span>
          </div>
          <div className="topbar-right">
            <span className="connection-indicator" />
            <span>Local workspace</span>
            <span className="topbar-divider" />
            <span className="plan-label">Free plan</span>
          </div>
        </header>
        <main id="main" className="main-content">
          {children}
        </main>
        <footer className="app-footer">
          <span>
            {BRAND.name} <span className="footer-dot">·</span> From repository
            to understanding
          </span>
          <span>Made for curious engineers.</span>
        </footer>
      </div>
      <Modal open={mobile} onOpenChange={setMobile} title="Navigation" drawer>
        <div
          className="mobile-navigation"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a")) setMobile(false);
          }}
        >
          {navigation}
        </div>
      </Modal>
    </div>
  );
}

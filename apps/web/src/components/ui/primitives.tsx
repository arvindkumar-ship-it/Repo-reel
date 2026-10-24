"use client";
import React, {
  createContext,
  useContext,
  useState,
  useId,
  useEffect,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  X,
  LoaderCircle,
  AlertCircle,
  Check,
  ChevronDown,
  Inbox,
} from "lucide-react";
export function Button({
  variant = "secondary",
  busy = false,
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      type={props.type ?? "button"}
      className={`button ${variant} ${className}`}
      aria-busy={busy}
      disabled={props.disabled || busy}
    >
      {busy ? <LoaderCircle size={16} className="spinner" /> : null}
      {children}
    </button>
  );
}
export function IconButton({
  label,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <Tooltip.Provider delayDuration={400}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            {...props}
            type={props.type ?? "button"}
            aria-label={label}
            className={`icon-button ${props.className ?? ""}`}
          >
            {children}
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="tooltip" sideOffset={8}>
            {label}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
export function Field({
  label,
  helper,
  error,
  children,
}: {
  label: string;
  helper?: string;
  error?: string;
  children: React.ReactElement<{
    id?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }>;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {React.cloneElement(children, {
        id,
        "aria-describedby": id + "-help",
        "aria-invalid": !!error,
      })}
      <div id={id + "-help"} className={error ? "field-error" : "helper"}>
        {error ?? helper}
      </div>
    </div>
  );
}
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="select-wrap">
      <select {...props} />
      <ChevronDown size={14} />
    </div>
  );
}
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
export function Switch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="switch-row">
      <span>
        <span className="label">{label}</span>
        {description && <small>{description}</small>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="switch-track" aria-hidden="true">
        <span />
      </span>
    </label>
  );
}
export function Badge({
  status,
  children,
}: {
  status?: string;
  children?: React.ReactNode;
}) {
  return (
    <span className={`badge ${status ?? "neutral"}`}>
      <span className="status-dot" />
      {children ??
        (status === "completed"
          ? "Ready"
          : status === "running"
            ? "In progress"
            : status === "queued"
              ? "Queued"
              : status === "failed"
                ? "Needs attention"
                : status === "cancelled"
                  ? "Cancelled"
                  : status)}
    </span>
  );
}
export const Chip = ({
  children,
  tone = "sky",
}: {
  children: React.ReactNode;
  tone?: string;
}) => <span className={`chip ${tone}`}>{children}</span>;
export function Progress({ value, label }: { value: number; label?: string }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label={label ?? "Progress"}
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
export function Skeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      aria-busy="true"
      className="skeleton-list"
    >
      {Array.from({ length: rows }, (_, i) => (
        <div className="skeleton" key={i} />
      ))}
    </div>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Inbox size={20} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function ErrorState({
  message,
  hint,
  action,
}: {
  message: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={20} />
      <div>
        <strong>{message}</strong>
        {hint && <p>{hint}</p>}
        {action}
      </div>
    </div>
  );
}
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  drawer = false,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  drawer?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          className={`modal ${drawer ? "drawer" : ""}`}
          aria-describedby={description ? "modal-description" : undefined}
        >
          <div className="modal-header">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button className="icon-button" aria-label="Close dialog">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>
          {description && (
            <Dialog.Description id="modal-description">
              {description}
            </Dialog.Description>
          )}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Menu({
  trigger,
  items,
}: {
  trigger: React.ReactNode;
  items: {
    label: string;
    onSelect: () => void;
    danger?: boolean;
    disabled?: boolean;
  }[];
}) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>{trigger}</Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content className="dropdown" sideOffset={7} align="end">
          {items.map((item, i) => (
            <Dropdown.Item
              key={i}
              disabled={item.disabled}
              className={item.danger ? "danger-text" : ""}
              onSelect={item.onSelect}
            >
              {item.label}
            </Dropdown.Item>
          ))}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
const ToastContext = createContext<(message: string) => void>(() => {});
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState("");
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  return (
    <ToastContext.Provider value={setToast}>
      {children}
      <div
        className={`toast ${toast ? "shown" : ""}`}
        role="status"
        aria-live="polite"
      >
        {toast && (
          <>
            <Check size={16} />
            {toast}
          </>
        )}
      </div>
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);
export function PageHeader({
  title,
  description,
  children,
  eyebrow,
}: {
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <div className="page-subtitle">{description}</div>}
      </div>
      <div className="header-actions">{children}</div>
    </div>
  );
}

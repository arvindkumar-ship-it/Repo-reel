"use client";
import { useState } from "react";
import { Plus, Check, MoreHorizontal } from "lucide-react";
import { pastels } from "@reporeel/shared";
import {
  PageHeader,
  Button,
  IconButton,
  Field,
  Select,
  Segmented,
  Switch,
  Badge,
  Chip,
  Progress,
  Skeleton,
  EmptyState,
  ErrorState,
  Modal,
  Menu,
  useToast,
} from "../ui/primitives";
export function Showcase() {
  const toast = useToast(),
    [modal, setModal] = useState(false),
    [drawer, setDrawer] = useState(false),
    [on, setOn] = useState(true),
    [value, setValue] = useState("a");
  return (
    <>
      <PageHeader
        title="A quiet, consistent foundation."
        description="Shared primitives for the app, diagrams and motion."
        eyebrow="DESIGN SYSTEM"
      />
      <div className="showcase">
        <section>
          <h2>Colour, with a purpose.</h2>
          <div className="palette-grid">
            {Object.entries(pastels).map(([name, [fill, border, ink]]) => (
              <div
                key={name}
                style={{ background: fill, borderColor: border, color: ink }}
              >
                <strong>{name}</strong>
                <code>{fill}</code>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h2>Actions</h2>
          <div className="button-row">
            <Button variant="primary">
              <Plus size={16} />
              Primary
            </Button>
            <Button>Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Destructive</Button>
            <Button busy>Loading</Button>
            <Button disabled>Disabled</Button>
            <IconButton
              label="Icon action"
              onClick={() => toast("Icon action triggered")}
            >
              <Plus size={16} />
            </IconButton>
            <Menu
              trigger={
                <button className="button secondary">
                  Menu
                  <MoreHorizontal size={16} />
                </button>
              }
              items={[
                {
                  label: "First action",
                  onSelect: () => toast("First action"),
                },
                {
                  label: "Remove",
                  danger: true,
                  onSelect: () => toast("Remove action"),
                },
              ]}
            />
          </div>
        </section>
        <section className="showcase-inputs">
          <h2>Inputs & selection</h2>
          <Field
            label="Repository"
            helper="A public or connected private repository."
          >
            <input placeholder="https://github.com/owner/repo" />
          </Field>
          <Field label="Invalid field" error="Enter a valid URL.">
            <input defaultValue="invalid" />
          </Field>
          <Field label="Select">
            <Select defaultValue="one">
              <option value="one">Option one</option>
              <option value="two">Option two</option>
            </Select>
          </Field>
          <Segmented
            label="View"
            value={value}
            onChange={setValue}
            options={[
              { value: "a", label: "First" },
              { value: "b", label: "Second" },
            ]}
          />
          <Switch
            checked={on}
            onChange={setOn}
            label="Captions"
            description="Readable, timed subtitles."
          />
          <label className="check-row">
            <input type="checkbox" />
            Checkbox
          </label>
          <textarea
            aria-label="Example narration"
            placeholder="A little story…"
          />
        </section>
        <section>
          <h2>Status & feedback</h2>
          <div className="chips">
            {["completed", "running", "queued", "failed", "cancelled"].map(
              (s) => (
                <Badge key={s} status={s} />
              ),
            )}
            <Chip>Information</Chip>
          </div>
          <Progress value={62} />
          <ErrorState
            message="A stage needs attention"
            hint="Retry from the last completed stage."
            action={
              <Button onClick={() => toast("Retry requested")}>Retry</Button>
            }
          />
          <Skeleton rows={2} />
          <EmptyState
            title="Nothing here yet"
            description="Your next idea has room to grow."
          />
          <div className="button-row">
            <Button onClick={() => setModal(true)}>Open dialog</Button>
            <Button onClick={() => setDrawer(true)}>Open drawer</Button>
            <Button onClick={() => toast("Changes saved")}>
              <Check size={15} />
              Show toast
            </Button>
          </div>
        </section>
      </div>
      <Modal
        open={modal}
        onOpenChange={setModal}
        title="An accessible dialog"
        description="Focus stays here until you close this dialog."
      >
        <Field label="Example input">
          <input />
        </Field>
        <div className="modal-actions">
          <Button variant="primary" onClick={() => setModal(false)}>
            Done
          </Button>
        </div>
      </Modal>
      <Modal
        open={drawer}
        onOpenChange={setDrawer}
        title="An accessible drawer"
        drawer
      >
        <p>Navigation and contextual details live here on smaller screens.</p>
        <Button onClick={() => setDrawer(false)}>Close drawer</Button>
      </Modal>
    </>
  );
}

"use client";
import type { ComponentProps } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
if (typeof window !== "undefined")
  Object.assign(window, { EXCALIDRAW_ASSET_PATH: "/excalidraw/" });
export default function ExcalPreview({ data }: { data: unknown }) {
  return (
    <div style={{ height: 480 }}>
      <Excalidraw
        initialData={data as ComponentProps<typeof Excalidraw>["initialData"]}
        viewModeEnabled
        theme="light"
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveAsImage: false,
            export: false,
            changeViewBackgroundColor: false,
          },
        }}
      />
    </div>
  );
}

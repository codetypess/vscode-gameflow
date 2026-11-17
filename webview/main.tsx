import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import { PsdEditorApp } from "./psd/editor";
import "./style.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("GameFlow Webview root element was not found");
}

const psdEditor = document.querySelector('meta[name="gameflow-editor"]')?.getAttribute("content") === "psd";
createRoot(root).render(psdEditor ? <PsdEditorApp /> : <App />);

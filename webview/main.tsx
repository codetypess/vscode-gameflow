import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import "./style.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("GameFlow Webview root element was not found");
}

createRoot(root).render(<App />);

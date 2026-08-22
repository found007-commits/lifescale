"use client";

import { useLayoutEffect, type RefObject } from "react";
import OpenCC from "opencc-js/cn2t";
import type { Locale } from "./types";

const toTraditional = OpenCC.Converter({ from: "cn", to: "tw" });

function convertNode(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) {
    if (node.nodeValue) node.nodeValue = toTraditional(node.nodeValue);
    return;
  }
  if (!(node instanceof HTMLElement) || node.classList.contains("ignore-opencc")) return;
  if (node.hasAttribute("placeholder")) node.setAttribute("placeholder", toTraditional(node.getAttribute("placeholder") || ""));
  if (node.hasAttribute("aria-label")) node.setAttribute("aria-label", toTraditional(node.getAttribute("aria-label") || ""));
  if (node instanceof HTMLImageElement && node.alt) node.alt = toTraditional(node.alt);
  node.childNodes.forEach(convertNode);
}

export function useTraditionalChinese<T extends HTMLElement>(ref: RefObject<T | null>, locale: Locale) {
  useLayoutEffect(() => {
    const root = ref.current;
    document.documentElement.lang = locale === "zh-TW" ? "zh-TW" : locale === "zh" ? "zh-CN" : "en";
    if (!root || locale !== "zh-TW") return;

    root.lang = "zh-TW";
    convertNode(root);
    const options: MutationObserverInit = { childList: true, subtree: true, characterData: true };
    const observer = new MutationObserver((mutations) => {
      observer.disconnect();
      for (const mutation of mutations) {
        if (mutation.type === "characterData") convertNode(mutation.target);
        mutation.addedNodes.forEach(convertNode);
      }
      observer.observe(root, options);
    });
    observer.observe(root, options);

    return () => observer.disconnect();
  });
}

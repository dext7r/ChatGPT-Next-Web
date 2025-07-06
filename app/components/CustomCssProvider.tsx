// app/components/CustomCssProvider.tsx
"use client";

import { useEffect, useState } from "react";
import { useCustomCssStore } from "../store/customCss";
import { useAppConfig } from "../store";

export function CustomCssProvider() {
  const customCss = useCustomCssStore();
  const config = useAppConfig();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (customCss.content.trim().length > 0 && !customCss.enabled) {
      customCss.enable();
    }
  }, []);

  useEffect(() => {
    if (mounted && customCss.enabled && customCss.content) {
      const customCssElem = document.getElementById("custom-css");
      if (customCssElem) {
        customCssElem.setAttribute("data-theme", config.theme);
      }
    }
  }, [mounted, customCss.enabled, customCss.content, config.theme]);

  if (!mounted || !customCss.enabled || !customCss.content) {
    return null;
  }

  return (
    <style
      id="custom-css"
      dangerouslySetInnerHTML={{ __html: customCss.content }}
    />
  );
}

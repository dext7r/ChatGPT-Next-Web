// app/components/CustomCssProvider.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useCustomCssStore } from "../store/customCss";
import { useAppConfig } from "../store";

export function CustomCssProvider() {
  const customCss = useCustomCssStore();
  const config = useAppConfig();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 基准字体样式，独立于自定义 CSS
  const baseFontCss = useMemo(
    () => `:root { font-size: ${config.fontSize}px; }`,
    [config.fontSize],
  );

  if (!mounted) {
    return null;
  }

  return (
    // <style id="custom-css" dangerouslySetInnerHTML={{ __html: initialCss }} />
    <>
      {/* 基准字体大小：始终生效，与 custom-css 启用状态无关 */}
      <style
        id="app-font-size"
        dangerouslySetInnerHTML={{ __html: baseFontCss }}
      />

      {/* 用户自定义样式：仅在开启且有内容时渲染 */}
      {customCss.enabled && customCss.content?.trim() ? (
        <style
          id="custom-css"
          data-theme={String(config.theme)}
          // 这里仅注入用户写的 CSS，不再附带 font-size 注入
          dangerouslySetInnerHTML={{ __html: customCss.content }}
        />
      ) : null}
    </>
  );
}

// import hljs from "highlight.js";
import ReactMarkdown from "react-markdown";
import "katex/dist/katex.min.css";
import RemarkMath from "remark-math";
import RemarkBreaks from "remark-breaks";
import RehypeKatex from "rehype-katex";
import RemarkGfm from "remark-gfm";
import RehypeRaw from "rehype-raw";
import RehypeHighlight from "rehype-highlight";
import rehypeSanitize from "rehype-sanitize";
import { defaultSchema } from "rehype-sanitize";
import {
  useRef,
  useState,
  RefObject,
  useEffect,
  useMemo,
  useContext,
} from "react";
import { copyToClipboard, downloadAs, useWindowSize } from "../utils";
import mermaid from "mermaid";
import Locale from "../locales";
import LoadingIcon from "../icons/three-dots.svg";
import ReloadButtonIcon from "../icons/reload.svg";
import ConfirmIcon from "../icons/confirm.svg";
import CancelIcon from "../icons/cancel.svg";
import CloseIcon from "../icons/close.svg";
import React from "react";
// import { useDebouncedCallback } from "use-debounce";
import { showImageModal, FullScreen } from "./ui-lib";
import {
  HTMLPreview,
  HTMLPreviewHander,
  ArtifactsShareButton,
} from "./artifacts";
import { useChatStore } from "../store";
import { IconButton } from "./button";
import { getHeaders } from "../client/api";
import { useAppConfig } from "../store/config";

import Collapse from "antd/es/collapse";
import styles from "./markdown.module.scss";

type CodeFoldCtx = {
  collapsed: boolean;
  setCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  enable: boolean;
  showToggle: boolean;
  setShowToggle: React.Dispatch<React.SetStateAction<boolean>>;
};
const CodeFoldContext = React.createContext<CodeFoldCtx | null>(null);

// 消息编辑上下文 - 用于代码块编辑功能
export type MessageEditContextType = {
  messageId?: string;
  onEditCodeBlock?: (
    originalCode: string,
    newCode: string,
    language: string,
  ) => void;
};
export const MessageEditContext = React.createContext<MessageEditContextType>(
  {},
);

interface SearchCollapseProps {
  title?: string | React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const SearchCollapse = ({
  title,
  children,
  className,
}: SearchCollapseProps) => {
  const defaultActive = title === Locale.NewChat.Searching ? ["1"] : [];
  const [activeKeys, setActiveKeys] = useState(defaultActive);

  useEffect(() => {
    if (typeof title === "string" && title.includes(Locale.NewChat.Search)) {
      setActiveKeys([]);
    } else if (title === Locale.NewChat.Searching) {
      setActiveKeys(["1"]);
    }
  }, [title]);

  const toggleCollapse = () => {
    setActiveKeys(activeKeys.length ? [] : ["1"]);
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    toggleCollapse();
  };

  const handleDoubleClick = () => {
    toggleCollapse();
  };

  return (
    <div
      onContextMenu={handleRightClick}
      onDoubleClick={handleDoubleClick}
      className={`${styles["search-collapse"]} ${className || ""}`}
    >
      <Collapse
        size="small"
        activeKey={activeKeys}
        onChange={(keys) => setActiveKeys(keys as string[])}
        bordered={false}
        items={[
          {
            key: "1",
            label: title,
            children: children,
          },
        ]}
      ></Collapse>
    </div>
  );
};

interface ThinkCollapseProps {
  title: string | React.ReactNode;
  children: React.ReactNode;
  className?: string;
  fontSize?: number;
}
const ThinkCollapse = ({
  title,
  children,
  className,
  fontSize,
}: ThinkCollapseProps) => {
  // 如果是 Thinking 状态，默认展开，否则折叠
  const defaultActive = title === Locale.NewChat.Thinking ? ["1"] : [];
  // 如果是 NoThink 状态，禁用
  const disabled = title === Locale.NewChat.NoThink;
  const [activeKeys, setActiveKeys] = useState(defaultActive);

  // 当标题从 Thinking 变为 Think 或 NoThink 时自动折叠
  useEffect(() => {
    if (
      (typeof title === "string" && title.includes(Locale.NewChat.Think)) ||
      title === Locale.NewChat.NoThink
    ) {
      setActiveKeys([]);
    } else if (title === Locale.NewChat.Thinking) {
      setActiveKeys(["1"]);
    }
  }, [title]);

  const toggleCollapse = () => {
    if (!disabled) {
      setActiveKeys(activeKeys.length ? [] : ["1"]);
    }
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    toggleCollapse();
  };

  const handleDoubleClick = () => {
    toggleCollapse();
  };

  // Recursive function to extract text from children
  const extractText = (node: any): string => {
    if (!node) return "";

    // Direct string
    if (typeof node === "string") return node;

    // Array of nodes
    if (Array.isArray(node)) {
      return node.map(extractText).join("");
    }

    // React element
    if (node.props && node.props.children) {
      return extractText(node.props.children);
    }

    return "";
  };

  const handleCopyContent = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const text = extractText(children);
      copyToClipboard(`<think>${text}</think>`);
    } catch (err) {
      console.error("Failed to copy thinking content:", err);
    }
  };

  return (
    <div
      onContextMenu={handleRightClick}
      onDoubleClick={handleDoubleClick}
      className={`${styles["think-collapse"]} ${
        disabled ? styles.disabled : ""
      } ${className || ""}`}
      // style={{ fontSize: `${fontSize}px` }}
    >
      <Collapse
        className={`${disabled ? "disabled" : ""}`}
        size="small"
        activeKey={activeKeys}
        onChange={(keys) => !disabled && setActiveKeys(keys as string[])}
        bordered={false}
        items={[
          {
            key: "1",
            label: (
              <div className={styles["think-collapse-header"]}>
                <span>{title}</span>
                {!disabled && (
                  <span
                    className={styles["copy-think-button"]}
                    onClick={handleCopyContent}
                    title={Locale.Chat.Actions.Copy}
                  >
                    📋
                  </span>
                )}
              </div>
            ),
            children: children,
          },
        ]}
      ></Collapse>
    </div>
  );
};

// 配置安全策略，允许 thinkcollapse 标签，防止html注入造成页面崩溃
const sanitizeOptions = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    span: ["className", "style", "data-tex"],
    div: [
      ...(defaultSchema.attributes?.div || []),
      ["className", "math", "math-display", "katex-display"],
    ],
    img: [
      ...(defaultSchema.attributes?.img || []),
      ["src", ["http:", "https:", "data"]],
    ],
    math: [["xmlns", "http://www.w3.org/1998/Math/MathML"], "display"],
    annotation: ["encoding"],
    svg: [
      ["xmlns", "http://www.w3.org/2000/svg"],
      "width",
      "height",
      "viewBox",
      "preserveAspectRatio",
    ],
    path: ["d"],
  },
  tagNames: [
    ...(defaultSchema.tagNames || []),
    "searchcollapse",
    "thinkcollapse",
    "math",
    "semantics",
    "annotation",
    "mrow",
    "mi",
    "mo",
    "mfrac",
    "mn",
    "msup",
    "msub",
    "svg",
    "path",
  ],
  protocols: {
    ...defaultSchema.protocols,
    src: ["http", "https", "data"], // 允许的协议列表
  },
};

function Details(props: { children: React.ReactNode }) {
  return <details>{props.children}</details>;
}

function Summary(props: { children: React.ReactNode }) {
  return <summary>{props.children}</summary>;
}

// Dangerous patterns for Python code - check before execution
const DANGEROUS_PATTERNS: Array<{ pattern: RegExp; type: string }> = [
  // Network operations
  {
    pattern:
      /\bimport\s+(?:urllib|requests|httpx|aiohttp|socket|http\.client|ftplib|smtplib|poplib|imaplib|nntplib|telnetlib)/,
    type: "network",
  },
  {
    pattern:
      /\bfrom\s+(?:urllib|requests|httpx|aiohttp|socket|http|ftplib|smtplib|poplib|imaplib|nntplib|telnetlib)\b/,
    type: "network",
  },
  {
    pattern: /\bsocket\s*\.\s*(?:socket|create_connection|getaddrinfo)/,
    type: "network",
  },
  { pattern: /\burllib\s*\.\s*request/, type: "network" },

  // File system operations
  { pattern: /\bopen\s*\(\s*['"]/, type: "filesystem" }, // open() with string path
  { pattern: /\bopen\s*\(\s*[a-zA-Z_]/, type: "filesystem" }, // open() with variable
  {
    pattern:
      /\bos\s*\.\s*(?:remove|unlink|rmdir|makedirs|mkdir|rename|replace|chmod|chown|link|symlink|truncate)/,
    type: "filesystem",
  },
  {
    pattern: /\bshutil\s*\.\s*(?:rmtree|copy|copy2|copytree|move)/,
    type: "filesystem",
  },
  {
    pattern:
      /\bpathlib\s*\..*\.\s*(?:read_|write_|unlink|rmdir|mkdir|rename|replace|chmod|touch)/,
    type: "filesystem",
  },

  // System operations
  {
    pattern: /\bos\s*\.\s*(?:system|popen|spawn|exec|fork|kill|killpg)/,
    type: "system",
  },
  {
    pattern:
      /\bsubprocess\s*\.\s*(?:run|call|Popen|check_output|check_call|getoutput|getstatusoutput)/,
    type: "system",
  },
  { pattern: /\beval\s*\(\s*(?:input|raw_input)/, type: "system" },
  { pattern: /\bexec\s*\(\s*(?:input|raw_input)/, type: "system" },
  { pattern: /\b__import__\s*\(/, type: "system" },

  // Dangerous modules import
  {
    pattern:
      /\bimport\s+(?:subprocess|multiprocessing|threading|ctypes|_thread)/,
    type: "system",
  },
  {
    pattern:
      /\bfrom\s+(?:subprocess|multiprocessing|threading|ctypes|_thread)\s+import/,
    type: "system",
  },
];

function checkDangerousCode(code: string): string | null {
  for (const { pattern, type } of DANGEROUS_PATTERNS) {
    if (pattern.test(code)) {
      return type;
    }
  }
  return null;
}

export function Mermaid(props: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!props.code) return;

    let cancelled = false;

    // 每次渲染生成新的唯一 ID
    const renderId = `mermaid-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;

    // 清理 mermaid 可能创建的临时 DOM 元素
    const cleanupTempElements = () => {
      try {
        const tempElement = document.getElementById(renderId);
        if (tempElement) {
          tempElement.remove();
        }
        // 同时清理可能的 d-xxx 格式的临时元素
        const dElements = document.querySelectorAll(`[id^="d${renderId}"]`);
        dElements.forEach((el) => el.remove());
      } catch (e) {
        // 忽略清理错误
      }
    };

    // 使用 mermaid.render() 代替 mermaid.run()
    mermaid
      .render(renderId, props.code)
      .then(({ svg: svgContent }) => {
        cleanupTempElements();
        if (!cancelled) {
          setSvg(svgContent);
          setErrorMessage("");
        }
      })
      .catch((e) => {
        cleanupTempElements();
        if (!cancelled) {
          const errorMsg = e.message || "Mermaid rendering error";
          setErrorMessage(errorMsg);
          setSvg("");
        }
      });

    return () => {
      cancelled = true;
      cleanupTempElements();
    };
  }, [props.code]);

  function viewSvgInNewWindow() {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const fileName = `mermaid-${Date.now()}.svg`;
    showImageModal(URL.createObjectURL(blob), fileName);
  }

  function copyErrorToClipboard() {
    const text = errorMessage || "Mermaid rendering error";
    try {
      copyToClipboard(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      console.error("Failed to copy error message to clipboard");
    }
  }

  if (errorMessage) {
    return (
      <div className={styles["mermaid-error"]}>
        <div className={styles["mermaid-error-message"]}>
          <div>{Locale.UI.MermaidError}</div>
          <button
            className={styles["code-header-btn"]}
            onClick={copyErrorToClipboard}
            title={Locale.Chat.Actions.CopyError}
            aria-label={Locale.Chat.Actions.CopyError}
          >
            {copied ? "✓" : Locale.Chat.Actions.CopyError}
          </button>
        </div>
        {errorMessage && <pre>{errorMessage}</pre>}
        <details>
          <summary>Mermaid Code</summary>
          <code className={styles["mermaid-code"]}>{props.code}</code>
        </details>
      </div>
    );
  }

  return (
    <div
      className="no-dark"
      style={{
        cursor: "pointer",
        overflow: "auto",
        maxHeight: "50vh",
      }}
      ref={ref}
      onClick={viewSvgInNewWindow}
    >
      <div
        style={{ pointerEvents: "none" }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}

export function PreCode(props: { children: any; status?: boolean }) {
  const ref = useRef<HTMLPreElement>(null);
  const previewRef = useRef<HTMLPreviewHander>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const { height } = useWindowSize();
  const [showPreview, setShowPreview] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [previewContent, setPreviewContent] = useState("");
  const [originalCode, setOriginalCode] = useState("");
  const [language, setLanguage] = useState("");
  const [contentType, setContentType] = useState<
    "html" | "mermaid" | "svg" | "python" | null
  >(null);

  // Python execution states
  const [showPythonPanel, setShowPythonPanel] = useState(false);
  const [pythonStdin, setPythonStdin] = useState("");
  const [showStdinInput, setShowStdinInput] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<{
    success: boolean;
    stdout?: string;
    stderr?: string;
    code?: number;
    signal?: string;
    error?: string;
    blocked?: boolean;
    blockedReason?: string;
  } | null>(null);
  const [hasInputCall, setHasInputCall] = useState(false);
  const [hasOutputCall, setHasOutputCall] = useState(true);
  const [dangerousType, setDangerousType] = useState<string | null>(null);

  const [collapsed, setCollapsed] = useState(true);
  const [showToggle, setShowToggle] = useState(false);
  const prevCollapsedRef = useRef<boolean | undefined>(undefined);

  // 代码编辑相关状态
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCode, setEditingCode] = useState("");
  const messageEditCtx = useContext(MessageEditContext);

  const isStatusReady = !props.status;

  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  const config = useAppConfig();
  const enableArtifacts =
    session.mask?.enableArtifacts !== false && config.enableArtifacts;
  const enableCodeFold =
    session.mask?.enableCodeFold !== false && config.enableCodeFold;

  useEffect(() => {
    if (!isStatusReady) return;

    if (ref.current) {
      const codeElement = ref.current.querySelector("code");
      if (codeElement) {
        // 获取语言
        const code = codeElement.textContent || codeElement.innerText || "";
        setOriginalCode(code);

        const langClass = codeElement.className.match(/language-(\w+)/);
        let lang = langClass ? langClass[1] : "";
        if (code.startsWith("<!DOCTYPE") || code.startsWith("<?xml")) {
          lang = "html";
        }
        setLanguage(lang);

        if (lang === "mermaid") {
          setContentType("mermaid");
          setPreviewContent(code);
        } else if (code.startsWith("<svg") || lang === "svg") {
          setContentType("svg");
          setPreviewContent(code);
          setLanguage("svg");
        } else if (lang === "html") {
          setLanguage("html");
          setContentType("html");
          setPreviewContent(code);
        } else if (lang === "python" || lang === "py") {
          setLanguage("python");
          setContentType("python");
          setPreviewContent(code);
          // Check if code contains input() calls
          const hasInput = /\binput\s*\(/.test(code);
          setHasInputCall(hasInput);
          // Check if code contains output behavior (print, sys.stdout, logging)
          const hasOutput = /\b(print\s*\(|sys\.stdout|logging\.)/.test(code);
          setHasOutputCall(hasOutput);
          // Check for dangerous code patterns
          const dangerCheck = checkDangerousCode(code);
          setDangerousType(dangerCheck);
        }
        if (
          enableArtifacts &&
          (lang === "mermaid" || lang === "svg" || lang === "html")
        ) {
          setShowPreview(true);
        }
      }
    }
  }, [enableArtifacts, isStatusReady, props.children]);

  useEffect(() => {
    if (!ref.current) return;
    const codeEl = ref.current.querySelector("code") as HTMLElement | null;
    if (!codeEl) return;

    // 以“折叠最大高度”作为阈值：max(160px, 30vh)
    const collapsedMax = Math.max(160, 0.3 * height);
    const needed = codeEl.scrollHeight > collapsedMax + 4;
    setShowToggle((prev) => (prev === needed ? prev : needed));
  }, [props.children, height]);

  // 仅在折叠状态从展开变为折叠时，滚动到底部
  useEffect(() => {
    const codeEl = ref.current?.querySelector("code") as HTMLElement | null;
    if (!codeEl) return;
    const wasCollapsed = prevCollapsedRef.current;

    // 只在从展开变为折叠时滚动到底部
    if (collapsed && wasCollapsed === false) {
      codeEl.scrollTop = codeEl.scrollHeight;
    }
    prevCollapsedRef.current = collapsed;
  }, [collapsed]);
  const copyCode = () => {
    copyToClipboard(originalCode);
  };
  const downloadCode = async () => {
    // 单独处理 mermaid，改成下载 svg 图片
    if (contentType === "mermaid" && previewContainerRef.current) {
      const svgElement = previewContainerRef.current.querySelector("svg");
      if (svgElement) {
        // Add a white background to the SVG for better viewing
        svgElement.style.backgroundColor = "white";

        const svgString = new XMLSerializer().serializeToString(svgElement);
        const filename = `mermaid-${Date.now()}.svg`;
        await downloadAs(svgString, filename);

        // Reset the background color after download
        svgElement.style.backgroundColor = "";
        return; // Stop execution here
      }
    }

    let extension = language || "txt";
    if (contentType === "html") extension = "html";
    else if (contentType === "svg") extension = "svg";
    else if (contentType === "mermaid" || language === "markdown")
      extension = "md";
    else if (language === "python") extension = "py";
    else if (language === "javascript") extension = "js";
    else if (language === "typescript") extension = "ts";

    const filename = `code-${Date.now()}.${extension}`;
    await downloadAs(originalCode, filename);
  };

  // 打开代码编辑弹窗
  const handleOpenEdit = () => {
    setEditingCode(originalCode);
    setShowEditModal(true);
  };

  // 保存编辑的代码
  const handleSaveEdit = () => {
    if (messageEditCtx.onEditCodeBlock && editingCode !== originalCode) {
      messageEditCtx.onEditCodeBlock(originalCode, editingCode, language);
    }
    setShowEditModal(false);
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setShowEditModal(false);
    setEditingCode("");
  };
  const handlePreviewClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (contentType === "svg") {
      const blob = new Blob([previewContent], { type: "image/svg+xml" });
      showImageModal(URL.createObjectURL(blob));
    }
    // else if (contentType === "html") {
    //   const win = window.open("", "_blank");
    //   if (win) {
    //     win.document.write(previewContent);
    //     win.document.title = "HTML Preview";
    //     win.document.close();
    //   }
    // }
  };
  const renderPreview = () => {
    if (!previewContent) return null;

    switch (contentType) {
      case "mermaid":
        return <Mermaid code={previewContent} key={`mermaid-${previewKey}`} />;
      case "svg":
        return (
          <div
            style={{
              maxWidth: "100%",
              overflow: "auto",
              cursor: "pointer",
            }}
          >
            <div
              style={{ pointerEvents: "none" }}
              dangerouslySetInnerHTML={{ __html: previewContent }}
            />
          </div>
        );
      case "html":
        return (
          <FullScreen>
            <ArtifactsShareButton
              getCode={() => previewContent}
              style={{ position: "absolute", right: 120, top: 10 }}
            />
            <IconButton
              style={{ position: "absolute", right: 65, top: 10 }}
              bordered
              icon={<ReloadButtonIcon />}
              shadow
              onClick={() => previewRef.current?.reload()}
            />
            <HTMLPreview
              key={previewContent}
              ref={previewRef}
              code={previewContent}
              autoHeight={!document.fullscreenElement}
              height={!document.fullscreenElement ? "30vh" : height}
              minWidth="50vw"
            />
          </FullScreen>
        );
      default:
        return null;
    }
  };

  // Python execution function
  const executePython = async () => {
    if (isExecuting || !originalCode) return;

    setIsExecuting(true);
    setExecutionResult(null);

    try {
      const response = await fetch("/api/piston", {
        method: "POST",
        headers: {
          ...getHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: originalCode,
          stdin: pythonStdin,
          language: "python",
          version: "*",
        }),
      });

      const result = await response.json();
      setExecutionResult(result);
    } catch (error: any) {
      setExecutionResult({
        success: false,
        error: error.message || "Execution failed",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  // Get blocked reason message
  const getBlockedMessage = (reason?: string) => {
    switch (reason) {
      case "network":
        return Locale.Chat.Actions.BlockedNetwork;
      case "filesystem":
        return Locale.Chat.Actions.BlockedFilesystem;
      case "system":
        return Locale.Chat.Actions.BlockedSystem;
      default:
        return Locale.Chat.Actions.CodeBlocked;
    }
  };

  // Render Python execution panel
  const renderPythonPanel = () => {
    if (!showPythonPanel) return null;

    return (
      <div className={styles["python-execution-panel"]}>
        {/* 提示信息 */}
        {(hasInputCall || !hasOutputCall || dangerousType) && (
          <div className={styles["python-hints"]}>
            {hasInputCall && (
              <span className={styles["python-input-hint"]}>
                {Locale.Chat.Actions.StdinHint}
              </span>
            )}
            {!hasOutputCall && !dangerousType && (
              <span className={styles["python-no-output-hint"]}>
                {Locale.Chat.Actions.NoOutputHint}
              </span>
            )}
            {dangerousType && (
              <span className={styles["python-danger-hint"]}>
                {dangerousType === "network"
                  ? Locale.Chat.Actions.BlockedNetwork
                  : dangerousType === "filesystem"
                  ? Locale.Chat.Actions.BlockedFilesystem
                  : Locale.Chat.Actions.BlockedSystem}
              </span>
            )}
          </div>
        )}

        {/* Control bar: 4个元素均匀分布 */}
        <div className={styles["python-control-bar"]}>
          {/* 1. 显示输入框 */}
          <div className={styles["python-control-item"]}>
            <button
              className={`${styles["python-toggle-btn"]} ${
                showStdinInput ? styles["active"] : ""
              }`}
              onClick={() => setShowStdinInput(!showStdinInput)}
            >
              {showStdinInput
                ? Locale.Chat.Actions.HideStdin
                : Locale.Chat.Actions.ShowStdin}
            </button>
          </div>

          {/* 2. 执行成功/失败 */}
          <div className={styles["python-control-item"]}>
            {executionResult && !executionResult.blocked && (
              <span
                className={`${styles["python-status-text"]} ${
                  executionResult.success && executionResult.code === 0
                    ? styles["success"]
                    : styles["error"]
                }`}
              >
                {executionResult.success && executionResult.code === 0
                  ? Locale.Chat.Actions.ExecutionSuccess
                  : Locale.Chat.Actions.ExecutionFailed}
              </span>
            )}
          </div>

          {/* 3. 复制输出结果 */}
          <div className={styles["python-control-item"]}>
            {executionResult &&
              !executionResult.blocked &&
              executionResult.stdout && (
                <button
                  className={styles["python-copy-result-btn"]}
                  onClick={() => copyToClipboard(executionResult.stdout || "")}
                >
                  {Locale.Chat.Actions.CopyOutput}
                </button>
              )}
          </div>

          {/* 4. 运行代码 */}
          <div className={styles["python-control-item"]}>
            <button
              className={`${styles["python-execute-btn"]} ${
                isExecuting ? styles["executing"] : ""
              } ${dangerousType ? styles["disabled"] : ""}`}
              onClick={executePython}
              disabled={isExecuting || !!dangerousType}
            >
              {isExecuting
                ? Locale.Chat.Actions.Running
                : executionResult
                ? Locale.Chat.Actions.Rerun
                : Locale.Chat.Actions.RunCode}
            </button>
          </div>
        </div>

        {/* Stdin input */}
        {showStdinInput && (
          <div className={styles["python-stdin-section"]}>
            <textarea
              className={styles["python-stdin-input"]}
              value={pythonStdin}
              onChange={(e) => setPythonStdin(e.target.value)}
              placeholder={Locale.Chat.Actions.StdinPlaceholder}
              rows={3}
            />
          </div>
        )}

        {/* Execution result - 只显示输出内容 */}
        {executionResult && (
          <div
            className={`${styles["python-result"]} ${
              executionResult.blocked
                ? styles["blocked"]
                : executionResult.success && executionResult.code === 0
                ? styles["success"]
                : styles["error"]
            }`}
          >
            {executionResult.blocked && (
              <div className={styles["python-result-header"]}>
                <span>{getBlockedMessage(executionResult.blockedReason)}</span>
              </div>
            )}

            {!executionResult.blocked && (
              <>
                {/* Stdout */}
                {(executionResult.stdout || !executionResult.stderr) && (
                  <div className={styles["python-output-section"]}>
                    <pre className={styles["python-output"]}>
                      {executionResult.stdout ||
                        (executionResult.signal
                          ? Locale.Chat.Actions.SignalError(
                              executionResult.signal,
                            )
                          : Locale.Chat.Actions.NoOutput)}
                    </pre>
                  </div>
                )}

                {/* Stderr */}
                {executionResult.stderr && (
                  <div className={styles["python-output-section"]}>
                    <div className={styles["python-output-label"]}>
                      {Locale.Chat.Actions.Stderr}:
                    </div>
                    <pre
                      className={`${styles["python-output"]} ${styles["stderr"]}`}
                    >
                      {executionResult.stderr}
                    </pre>
                  </div>
                )}
              </>
            )}

            {executionResult.error && !executionResult.blocked && (
              <div className={styles["python-error"]}>
                {executionResult.error}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles["code-block-wrapper"]}>
      <div className={styles["code-header"]}>
        <div className={styles["code-header-left"]}>
          {language && (
            <span className={styles["code-language"]}>{language}</span>
          )}
        </div>
        <div className={styles["code-header-right"]}>
          <button className={styles["code-header-btn"]} onClick={copyCode}>
            {Locale.Chat.Actions.Copy}
          </button>
          <button className={styles["code-header-btn"]} onClick={downloadCode}>
            {Locale.Chat.Actions.Download}
          </button>
          {messageEditCtx.onEditCodeBlock && (
            <button
              className={styles["code-header-btn"]}
              onClick={handleOpenEdit}
            >
              {Locale.Chat.Actions.Edit}
            </button>
          )}
          {contentType === "python" ? (
            <button
              className={`${styles["code-header-btn"]} ${styles["btn-run"]} ${
                isExecuting ? styles["btn-executing"] : ""
              }`}
              onClick={() => {
                if (showPythonPanel) {
                  setShowPythonPanel(false);
                } else {
                  setShowPythonPanel(true);
                  if (hasInputCall) {
                    setShowStdinInput(true);
                  }
                }
              }}
            >
              {showPythonPanel
                ? Locale.Chat.Actions.ShowCode
                : Locale.Chat.Actions.Run}
            </button>
          ) : contentType ? (
            <button
              className={styles["code-header-btn"]}
              onClick={() => {
                if (!showPreview) {
                  setPreviewKey((k) => k + 1);
                }
                setShowPreview(!showPreview);
              }}
            >
              {showPreview
                ? Locale.Chat.Actions.ShowCode
                : Locale.Chat.Actions.Preview}
            </button>
          ) : null}
          {enableCodeFold && showToggle && !showPreview && (
            <button
              className={styles["code-header-btn"]}
              onClick={() => setCollapsed((v) => !v)}
              title={collapsed ? Locale.NewChat.More : Locale.NewChat.Less}
              aria-label={collapsed ? Locale.NewChat.More : Locale.NewChat.Less}
            >
              {collapsed ? Locale.NewChat.More : Locale.NewChat.Less}
            </button>
          )}
        </div>
      </div>
      <div className={styles["code-content"]}>
        {showPreview ? (
          <div
            ref={previewContainerRef}
            className={styles["preview-container"]}
            onClick={handlePreviewClick}
          >
            {renderPreview()}
          </div>
        ) : showPythonPanel ? (
          <>
            <CodeFoldContext.Provider
              value={{
                collapsed,
                setCollapsed,
                enable: enableCodeFold,
                showToggle,
                setShowToggle,
              }}
            >
              <pre ref={ref}>{props.children}</pre>
            </CodeFoldContext.Provider>
            {renderPythonPanel()}
          </>
        ) : (
          <CodeFoldContext.Provider
            value={{
              collapsed,
              setCollapsed,
              enable: enableCodeFold,
              showToggle,
              setShowToggle,
            }}
          >
            <pre ref={ref}>{props.children}</pre>
          </CodeFoldContext.Provider>
        )}
      </div>

      {/* 代码编辑弹窗 */}
      {showEditModal && (
        <div
          className={styles["code-edit-modal-overlay"]}
          onClick={handleCancelEdit}
        >
          <div
            className={styles["code-edit-modal"]}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles["code-edit-modal-header"]}>
              <div className={styles["code-edit-modal-title"]}>
                {Locale.Chat.Actions.Edit} - {language || "code"}
              </div>
              <div
                className={styles["code-edit-modal-close"]}
                onClick={handleCancelEdit}
              >
                <CloseIcon />
              </div>
            </div>
            <textarea
              className={styles["code-edit-textarea"]}
              value={editingCode}
              onChange={(e) => setEditingCode(e.target.value)}
              spellCheck={false}
              autoFocus
            />
            <div className={styles["code-edit-modal-footer"]}>
              <div className={styles["code-edit-modal-actions"]}>
                <IconButton
                  text={Locale.Chat.Actions.Cancel}
                  onClick={handleCancelEdit}
                  icon={<CancelIcon />}
                  bordered
                  shadow
                  tabIndex={0}
                />
                <IconButton
                  text={Locale.Chat.Actions.Save}
                  type="primary"
                  onClick={handleSaveEdit}
                  icon={<ConfirmIcon />}
                  bordered
                  shadow
                  tabIndex={0}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomCode(props: { children: any; className?: string }) {
  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  const config = useAppConfig();
  const enableCodeFold =
    session.mask?.enableCodeFold !== false && config.enableCodeFold;

  const ref = useRef<HTMLPreElement>(null);
  // const [collapsed, setCollapsed] = useState(true);
  // const [showToggle, setShowToggle] = useState(false);
  const codeFoldCtx = React.useContext(CodeFoldContext);
  const { height } = useWindowSize();
  const prevCollapsedRef = React.useRef<boolean | undefined>(undefined);

  // 检查是否需要显示折叠按钮
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;

    if (!codeFoldCtx) return;
    const collapsedMax = Math.max(160, 0.3 * height);
    const needed = el.scrollHeight > collapsedMax + 4;
    if (codeFoldCtx.showToggle !== needed) {
      codeFoldCtx.setShowToggle(needed);
    }
  }, [props.children, height, codeFoldCtx]);

  // 仅在折叠状态从展开变为折叠时，滚动到底部
  useEffect(() => {
    if (!ref.current || !codeFoldCtx) return;
    const el = ref.current;
    const wasCollapsed = prevCollapsedRef.current;
    const isCollapsed = codeFoldCtx.collapsed;

    // 只在从展开变为折叠时滚动到底部
    if (isCollapsed && wasCollapsed === false) {
      el.scrollTop = el.scrollHeight;
    }
    prevCollapsedRef.current = isCollapsed;
  }, [codeFoldCtx?.collapsed]);

  // const toggleCollapsed = () => {
  //   setCollapsed((collapsed) => !collapsed);
  // };
  // const renderShowMoreButton = () => {
  //   if (showToggle && enableCodeFold) {
  //     return (
  //       <div
  //         className={`show-hide-button ${collapsed ? "collapsed" : "expanded"}`}
  //         style={{
  //           position: "absolute",
  //           right: "12px",
  //           bottom: "12px",
  //           zIndex: 1,
  //         }}
  //       >
  //         <button onClick={toggleCollapsed} className="code-fold-btn">
  //           {collapsed ? Locale.NewChat.More : Locale.NewChat.Less}
  //         </button>
  //       </div>
  //     );
  //   }
  //   return null;
  // };

  return (
    <>
      <code
        className={props?.className}
        ref={ref}
        style={{
          // maxHeight: enableCodeFold && collapsed ? "max(160px, 30vh)" : "none",
          // overflowY: enableCodeFold && collapsed ? "auto" : "visible",
          maxHeight:
            (codeFoldCtx?.enable ?? enableCodeFold) &&
            (codeFoldCtx?.collapsed ?? true)
              ? "max(160px, 30vh)"
              : "none",
          overflowY:
            (codeFoldCtx?.enable ?? enableCodeFold) &&
            (codeFoldCtx?.collapsed ?? true)
              ? "auto"
              : "visible",
        }}
      >
        {props.children}
      </code>
      {/* {renderShowMoreButton()} */}
    </>
  );
}

// ========== Markdown 预处理器 ==========
// 设计原则：保护 → 处理 → 恢复

/**
 * 转义未闭合的公式，使已闭合的公式正常渲染，未闭合的显示原文
 * 流式渲染时调用，实现部分公式渲染
 */
function escapeIncompleteFormulas(text: string): string {
  // 1. 检查是否在未闭合的代码块内，如果是则不处理
  const codeBlockCount = (text.match(/```/g) || []).length;
  if (codeBlockCount % 2 !== 0) {
    return text;
  }

  // 2. 使用保护器保护代码块
  const protectedBlocks: { placeholder: string; content: string }[] = [];
  let idx = 0;

  let result = text
    // 保护完整代码块
    .replace(/```[\s\S]*?```/g, (match) => {
      const placeholder = `\x00CODEBLOCK${idx++}\x00`;
      protectedBlocks.push({ placeholder, content: match });
      return placeholder;
    })
    // 保护行内代码
    .replace(/`[^`\n]+`/g, (match) => {
      const placeholder = `\x00INLINECODE${idx++}\x00`;
      protectedBlocks.push({ placeholder, content: match });
      return placeholder;
    });

  // 3. 处理 $$ 块级公式 - 转义未闭合的
  const doubleDollarParts = result.split("$$");
  if (doubleDollarParts.length % 2 === 0) {
    // 奇数个 $$，说明最后一个未闭合
    // 转义最后一个 $$ 为 \$\$
    const lastIdx = result.lastIndexOf("$$");
    if (lastIdx !== -1) {
      result = result.slice(0, lastIdx) + "\\$\\$" + result.slice(lastIdx + 2);
    }
  }

  // 4. 处理 $ 行内公式 - 转义未闭合的（排除 $$ 的情况）
  // 先保护已处理的 $$
  result = result.replace(/\$\$[\s\S]*?\$\$/g, (match) => {
    const placeholder = `\x00BLOCKMATH${idx++}\x00`;
    protectedBlocks.push({ placeholder, content: match });
    return placeholder;
  });

  // 统计单独的 $
  const singleDollarMatches = result.match(/(?<!\$)\$(?!\$)/g) || [];
  if (singleDollarMatches.length % 2 !== 0) {
    // 奇数个 $，转义最后一个
    const lastIdx = result.lastIndexOf("$");
    if (
      lastIdx !== -1 &&
      result[lastIdx - 1] !== "$" &&
      result[lastIdx + 1] !== "$"
    ) {
      result = result.slice(0, lastIdx) + "\\$" + result.slice(lastIdx + 1);
    }
  }

  // 5. 处理 \[ - 转义未闭合的
  const openBrackets = (result.match(/\\\[/g) || []).length;
  const closeBrackets = (result.match(/\\\]/g) || []).length;
  if (openBrackets > closeBrackets) {
    // 找到最后一个未配对的 \[
    const lastIdx = result.lastIndexOf("\\[");
    if (lastIdx !== -1) {
      result = result.slice(0, lastIdx) + "\\\\[" + result.slice(lastIdx + 2);
    }
  }

  // 6. 处理 \( - 转义未闭合的
  const openParens = (result.match(/\\\(/g) || []).length;
  const closeParens = (result.match(/\\\)/g) || []).length;
  if (openParens > closeParens) {
    const lastIdx = result.lastIndexOf("\\(");
    if (lastIdx !== -1) {
      result = result.slice(0, lastIdx) + "\\\\(" + result.slice(lastIdx + 2);
    }
  }

  // 7. 恢复保护的内容
  for (let i = protectedBlocks.length - 1; i >= 0; i--) {
    result = result
      .split(protectedBlocks[i].placeholder)
      .join(protectedBlocks[i].content);
  }

  return result;
}

type ProtectedRegion = {
  placeholder: string;
  content: string;
};

/**
 * 创建保护器，用于保护特殊区域不被处理
 */
function createProtector() {
  const regions: ProtectedRegion[] = [];
  let index = 0;

  const protect = (text: string, pattern: RegExp): string => {
    return text.replace(pattern, (match) => {
      const placeholder = `\x00P${index++}\x00`;
      regions.push({ placeholder, content: match });
      return placeholder;
    });
  };

  const restore = (text: string): string => {
    // 逆序恢复，避免嵌套问题
    for (let i = regions.length - 1; i >= 0; i--) {
      text = text.split(regions[i].placeholder).join(regions[i].content);
    }
    return text;
  };

  return { protect, restore };
}

// ========== 保护模式定义 ==========

// 代码块 ```...```（支持语言标识，使用非贪婪匹配）
const CODE_BLOCK_PATTERN = /```[\s\S]*?```/g;

// 行内代码 `...`（非贪婪，不跨行，排除空内容）
const INLINE_CODE_PATTERN = /`[^`\n]+`/g;

// ========== 转义处理函数 ==========

function escapeDollarNumber(text: string): string {
  const result: string[] = [];
  let isInMathExpression = false;
  let isInCodeBlock = false;
  let isInInlineCode = false;
  let isInLatexBlock = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const prevChar = text[i - 1] || " ";
    const nextChar = text[i + 1] || " ";

    // 代码块 ```
    if (text.substring(i, i + 3) === "```") {
      isInCodeBlock = !isInCodeBlock;
      result.push("```");
      i += 2;
      continue;
    }

    // 行内代码 `
    if (char === "`" && !isInCodeBlock) {
      isInInlineCode = !isInInlineCode;
      result.push("`");
      continue;
    }

    // LaTeX 块 \[ \]
    if (char === "\\" && nextChar === "[" && !isInLatexBlock) {
      isInLatexBlock = true;
      result.push("\\[");
      i++;
      continue;
    }
    if (char === "\\" && nextChar === "]" && isInLatexBlock) {
      isInLatexBlock = false;
      result.push("\\]");
      i++;
      continue;
    }

    // 保护区域内直接添加
    if (isInCodeBlock || isInInlineCode || isInLatexBlock) {
      result.push(char);
      continue;
    }

    // 数学表达式状态切换
    if (char === "$" && nextChar !== "$") {
      isInMathExpression = !isInMathExpression;
    }

    // 双美元符号
    if (char === "$" && nextChar === "$") {
      result.push("$$");
      i++;
      continue;
    }

    // 转义 $数字
    if (
      char === "$" &&
      nextChar >= "0" &&
      nextChar <= "9" &&
      !isInMathExpression &&
      !isInLatexBlock
    ) {
      result.push("&#36;");
      continue;
    }

    // 转义单独波浪号
    if (char === "~" && prevChar !== "~" && nextChar !== "~") {
      result.push("\\~");
      continue;
    }

    result.push(char);
  }

  return result.join("");
}

function autoFixLatexDisplayMode(text: string): string {
  // 定义一系列常见的、必须在展示模式下使用的 LaTeX 环境
  const displayEnvs =
    /\\begin\{(?:equation|equation\*|align|align\*|gather|gather\*|matrix|pmatrix|bmatrix|vmatrix|Vmatrix|split)\}/;

  // 这个正则表达式用于匹配被单美元符号包裹的内容（同时避免匹配双美元符号）
  return text.replace(/\$(?!\$)([\s\S]*?)(?<!\$)\$/g, (match, content) => {
    // 如果一个行内公式块的内容，包含了展示模式的环境...
    if (displayEnvs.test(content)) {
      // ...就将这个块升级为展示模式，即把 `$` 替换为 `$$`
      return `$$${content}$$`;
    }
    // 否则，保持原样
    return match;
  });
}

function escapeBrackets(text: string) {
  const pattern =
    /(```[\s\S]*?```|`.*?`)|\\\[([\s\S]*?[^\\])\\\]|\\\((.*?)\\\)/g;
  return text.replace(
    pattern,
    (match, codeBlock, squareBracket, roundBracket) => {
      if (codeBlock) {
        return codeBlock;
      } else if (squareBracket) {
        return `$$${squareBracket}$$`;
      } else if (roundBracket) {
        return `$${roundBracket}$`;
      }
      return match;
    },
  );
}
/**
 * 加粗标记处理器
 * 标准 Markdown 加粗规则：
 * 1. ** 必须紧贴内容（内部不能有前导/尾随空格）
 * 2. 处理各种边界情况（冒号、引号、标点等）
 * 3. 加粗不应跨行（所有空白匹配都排除换行符）
 * 4. ** 前后不能是 *（避免与 *** 斜体加粗混淆）
 * 5. CommonMark 要求强调标记与周围文字有适当的边界
 *
 * 注意：此函数应在保护区域（代码块、LaTeX等）被保护后调用
 */
function processBoldMarkers(text: string): string {
  // 常见的后置分隔符（加粗后允许紧跟的字符）
  const PUNCT_AFTER =
    /^[\s,.\];:!?，。；：！？、）】》"'""''（【《\(\[\{）\]>}\n\r*]/;
  const HAIR_SPACE = "\u200A";

  // 预处理：修复 ** 和内容之间的空格问题
  // 一次性匹配完整的 **...** 对，将内部空格移到外部
  // 避免分两步处理导致互相干扰的问题
  text = text.replace(
    /\*\*(\s*)((?:(?!\*\*)[\s\S])+?)(\s*)\*\*/g,
    (match, leadSpace, content, trailSpace) => {
      // 如果内容为空或只有空格，不处理
      if (!content.trim()) return match;
      return leadSpace + "**" + content.trim() + "**" + trailSpace;
    },
  );

  // 找到所有 ** 标记的位置
  const markers: number[] = [];
  const markerRegex = /\*\*(?!\*)/g;
  let match;
  while ((match = markerRegex.exec(text)) !== null) {
    markers.push(match.index);
  }

  // 没有标记或奇数个标记（不完整）则不处理
  if (markers.length === 0 || markers.length % 2 !== 0) {
    return text;
  }

  // 构建结果字符串
  let result = "";
  let lastIndex = 0;

  for (let i = 0; i < markers.length; i++) {
    const pos = markers[i];
    const isOpening = i % 2 === 0;

    // 添加标记之前的文本
    result += text.slice(lastIndex, pos);

    if (isOpening) {
      // 开始标记：如果前面是非空白非标点字符，添加发丝空格
      const prevChar = result.slice(-1);
      if (prevChar && /[^\s\p{P}]/u.test(prevChar)) {
        result += HAIR_SPACE;
      }
    }

    // 添加 ** 标记
    result += "**";
    lastIndex = pos + 2;

    if (!isOpening) {
      // 结束标记：如果后面是非空白非*字符且不在 PUNCT_AFTER 中，添加发丝空格
      const nextChar = text[lastIndex];
      if (nextChar && /[^\s*]/u.test(nextChar) && !PUNCT_AFTER.test(nextChar)) {
        result += HAIR_SPACE;
      }
    }
  }

  // 添加剩余文本
  result += text.slice(lastIndex);

  // 处理 **内容:** 的情况（冒号在加粗内部末尾）
  result = result.replace(
    /(?<!\*)\*\*([^\s\n][^\n]*?)([:：])\*\*(?!\*)/g,
    (match, content, colon) => {
      if (content.includes("**")) return match;
      const trimmed = content.trimEnd();
      if (trimmed === "") return match;
      return `**${trimmed}**${colon}`;
    },
  );

  // 处理 **A**:**B** → **A**: **B**
  result = result.replace(
    /(?<!\*)\*\*((?:(?!\*\*)[^\n])+?)\*\*(?!\*)([:：])(?<!\*)\*\*((?:(?!\*\*)[^\n])+?)\*\*(?!\*)/g,
    (_, a, colon, b) => `**${a}**${colon}${HAIR_SPACE}**${b}**`,
  );

  return result;
}

// 通用标签块格式化函数
type TagLocale = {
  ing: string; // 进行中状态 (Searching / Thinking)
  done: string; // 完成状态 (Search / Think)
  none: string; // 空内容状态 (NoSearch / NoThink)
};

function formatTaggedBlock(
  text: string,
  tagName: string,
  time: number | undefined,
  locale: TagLocale,
): { tagText: string; remainText: string } {
  text = text.trimStart();
  const openTag = `<${tagName}>`;
  const closeTag = `</${tagName}>`;
  const collapseTag = `${tagName}collapse`;

  // 未闭合标签 - 进行中状态
  if (text.startsWith(openTag) && !text.includes(closeTag)) {
    const content = text.slice(openTag.length);
    return {
      tagText: `<${collapseTag} title="${locale.ing}">\n${content}\n\n</${collapseTag}>\n`,
      remainText: "",
    };
  }

  // 完整标签
  const pattern = new RegExp(`^<${tagName}>([\\s\\S]*?)</${tagName}>`);
  const match = text.match(pattern);
  if (match) {
    const content = match[1];
    const title =
      content.trim() === ""
        ? locale.none
        : `${locale.done}${Locale.NewChat.ThinkFormat(time)}`;
    return {
      tagText: `<${collapseTag} title="${title}">\n${content}\n\n</${collapseTag}>\n`,
      remainText: text.substring(match[0].length),
    };
  }

  return { tagText: "", remainText: text };
}

function formatSearchText(
  text: string,
  searchingTime?: number,
): { searchText: string; remainText: string } {
  const { tagText, remainText } = formatTaggedBlock(
    text,
    "search",
    searchingTime,
    {
      ing: Locale.NewChat.Searching,
      done: Locale.NewChat.Search,
      none: Locale.NewChat.NoSearch,
    },
  );
  return { searchText: tagText, remainText };
}

function formatThinkText(
  text: string,
  thinkingTime?: number,
): { thinkText: string; remainText: string } {
  const { tagText, remainText } = formatTaggedBlock(
    text,
    "think",
    thinkingTime,
    {
      ing: Locale.NewChat.Thinking,
      done: Locale.NewChat.Think,
      none: Locale.NewChat.NoThink,
    },
  );
  return { thinkText: tagText, remainText };
}

function tryWrapHtmlCode(text: string) {
  // try add wrap html code (fixed: html codeblock include 2 newline)
  // ignore embed codeblock
  if (text.includes("```")) {
    return text;
  }
  return text
    .replace(
      /([`]*?)(\w*?)([\n\r]*?)(<!DOCTYPE html>)/g,
      (match, quoteStart, lang, newLine, doctype) => {
        return !quoteStart ? "\n```html\n" + doctype : match;
      },
    )
    .replace(
      /(<\/body>)([\r\n\s]*?)(<\/html>)([\n\r]*)([`]*)([\n\r]*?)/g,
      (match, bodyEnd, space, htmlEnd, newLine, quoteEnd) => {
        return !quoteEnd ? bodyEnd + space + htmlEnd + "\n```\n" : match;
      },
    );
}

function ImagePreview({ src }: { src: string }) {
  const handleClick = () => {
    showImageModal(src); // 使用现有的 showImageModal 函数显示图片
  };

  return (
    <img
      src={src}
      alt="Preview"
      onClick={handleClick}
      style={{
        cursor: "zoom-in",
        maxWidth: "160px",
        maxHeight: "160px",
        objectFit: "contain", // 保持图片比例
        borderRadius: "8px", // 添加圆角
        transition: "transform 0.2s ease",
      }}
      onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.05)")} // 悬停时轻微放大
      onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")} // 鼠标离开时恢复
    />
  );
}
type ImgProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  src: string; // 强制 src 为 string
};
function R_MarkDownContent(props: {
  content: string;
  searchingTime?: number;
  thinkingTime?: number;
  fontSize?: number;
  status?: boolean;
}) {
  const isStreaming = !!props.status;

  const escapedContent = useMemo(() => {
    let content = props.content;

    // 使用保护-处理-恢复模式
    const { protect, restore } = createProtector();

    // 1. 只保护代码块和行内代码（LaTeX 不保护，因为需要被 escapeBrackets 处理）
    content = protect(content, CODE_BLOCK_PATTERN); // 代码块优先级最高
    content = protect(content, INLINE_CODE_PATTERN); // 行内代码
    // 注意：不保护 LaTeX，因为 escapeBrackets 需要将 \[...\] 转换为 $$...$$

    // 2. 在保护区域外处理各种标记
    content = escapeDollarNumber(content); // 转义 $数字（内部已处理 LaTeX 保护）
    content = escapeBrackets(content); // LaTeX 括号转换 \[...\] → $$...$$
    content = processBoldMarkers(content); // 加粗处理
    content = autoFixLatexDisplayMode(content); // 修复 LaTeX 展示模式

    // 3. 恢复保护区域
    content = restore(content);

    // 4. 处理 search/think 标签
    const { searchText, remainText: searchRemainText } = formatSearchText(
      content,
      props.searchingTime,
    );
    const { thinkText, remainText } = formatThinkText(
      searchRemainText,
      props.thinkingTime,
    );
    content = searchText + thinkText + remainText;

    // 5. 流式期间：转义未闭合的公式，使已闭合的公式正常渲染
    if (isStreaming) {
      content = escapeIncompleteFormulas(content);
    }

    return tryWrapHtmlCode(content);
  }, [props.content, props.searchingTime, props.thinkingTime, isStreaming]);

  // 流式期间也启用公式渲染（未闭合的公式已被转义）
  const remarkPlugins = useMemo(
    () => [RemarkMath, RemarkGfm, RemarkBreaks],
    [],
  );
  const rehypePlugins = useMemo(
    () => [
      RehypeRaw,
      RehypeKatex,
      [rehypeSanitize, sanitizeOptions],
      [
        RehypeHighlight,
        {
          detect: true, // 无语言标注时自动识别
          ignoreMissing: true, // 未注册语言跳过
          subset: [
            "javascript",
            "typescript",
            "python",
            "json",
            "bash",
            "yaml",
            "markdown",
            "java",
            "c",
            "cpp",
            "go",
            "sql",
            "html",
            "xml",
            "css",
          ],
          plainText: ["plain", "text", "txt"],
        },
      ],
    ],
    [],
  );
  return (
    <ReactMarkdown
      remarkPlugins={remarkPlugins as any}
      rehypePlugins={rehypePlugins as any}
      components={
        isStreaming
          ? {
              // 预览/流式：最小化渲染，避免触发含 setState 的复杂组件
              pre: (p: any) => <pre {...p} />,
              code: ({ inline, className, children, ...rest }: any) => (
                <code className={className} {...rest}>
                  {children}
                </code>
              ),
              p: (pProps: any) => <p {...pProps} dir="auto" />,
              a: (aProps: any) => {
                const href = aProps.href || "";
                const isInternal = /^\/#/i.test(href);
                const target = isInternal ? "_self" : aProps.target ?? "_blank";
                return <a {...aProps} target={target} />;
              },
              details: Details,
              summary: Summary,
              img: ({ src, ...props }: any) => (
                <ImagePreview src={src as string} />
              ),
            }
          : ({
              pre: (preProps: any) => (
                <PreCode {...preProps} status={props.status} />
              ),
              code: CustomCode,
              p: (pProps: any) => <p {...pProps} dir="auto" />,
              searchcollapse: ({
                title,
                children,
              }: {
                title?: string;
                children: React.ReactNode;
              }) => <SearchCollapse title={title}>{children}</SearchCollapse>,
              thinkcollapse: ({
                title,
                children,
              }: {
                title: string;
                children: React.ReactNode;
              }) => (
                <ThinkCollapse title={title} fontSize={props.fontSize}>
                  {children}
                </ThinkCollapse>
              ),
              a: (aProps: any) => {
                const href = aProps.href || "";
                if (/\.(aac|mp3|opus|wav)$/.test(href)) {
                  return (
                    <figure>
                      <audio controls src={href}></audio>
                    </figure>
                  );
                }
                if (/\.(3gp|3g2|webm|ogv|mpeg|mp4|avi)$/.test(href)) {
                  return (
                    <video controls width="99.9%">
                      <source src={href} />
                    </video>
                  );
                }
                const isInternal = /^\/#/i.test(href);
                const target = isInternal ? "_self" : aProps.target ?? "_blank";
                return <a {...aProps} target={target} />;
              },
              details: Details,
              summary: Summary,
              img: ({ src, ...props }: ImgProps) => <ImagePreview src={src} />,
            } as any)
      }
    >
      {escapedContent}
    </ReactMarkdown>
  );
}

export const MarkdownContent = React.memo(R_MarkDownContent);

export function Markdown(
  props: {
    content: string;
    loading?: boolean;
    fontSize?: number;
    parentRef?: RefObject<HTMLDivElement>;
    defaultShow?: boolean;
    searchingTime?: number;
    thinkingTime?: number;
    status?: boolean | undefined;
  } & React.DOMAttributes<HTMLDivElement>,
) {
  const mdRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className="markdown-body"
      ref={mdRef}
      onContextMenu={props.onContextMenu}
      onDoubleClickCapture={props.onDoubleClickCapture}
      dir="auto"
    >
      {props.loading ? (
        <LoadingIcon />
      ) : (
        <MarkdownContent
          // key={processedContent}
          content={props.content}
          searchingTime={props.searchingTime}
          thinkingTime={props.thinkingTime}
          fontSize={props.fontSize}
          status={props.status}
        />
      )}
    </div>
  );
}

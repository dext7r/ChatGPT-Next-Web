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
  // 使用 useRef 存储唯一 ID，避免每次渲染变化
  const idRef = useRef(
    `mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  useEffect(() => {
    if (!props.code) return;

    let cancelled = false;

    // 清理 mermaid 可能创建的临时 DOM 元素
    const cleanupTempElements = () => {
      // mermaid.render() 会在 document.body 中创建临时元素，需要手动清理
      const tempElement = document.getElementById(idRef.current);
      if (tempElement) {
        tempElement.remove();
      }
      // 同时清理可能的 d-xxx 格式的临时元素
      const dElements = document.querySelectorAll(`[id^="d${idRef.current}"]`);
      dElements.forEach((el) => el.remove());
    };

    // 使用 mermaid.render() 代替 mermaid.run()
    // render() 返回 SVG 字符串，避免多个图表并发渲染时的 DOM 竞态问题
    mermaid
      .render(idRef.current, props.code)
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
      onClick={() => viewSvgInNewWindow()}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export function PreCode(props: { children: any; status?: boolean }) {
  const ref = useRef<HTMLPreElement>(null);
  const previewRef = useRef<HTMLPreviewHander>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const { height } = useWindowSize();
  const [showPreview, setShowPreview] = useState(false);
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
  useEffect(() => {
    const codeEl = ref.current?.querySelector("code") as HTMLElement | null;
    if (!codeEl) return;
    if (collapsed && codeEl.scrollTop !== codeEl.scrollHeight) {
      codeEl.scrollTop = codeEl.scrollHeight;
    }
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
        return <Mermaid code={previewContent} />;
      case "svg":
        return (
          <div
            dangerouslySetInnerHTML={{ __html: previewContent }}
            style={{ maxWidth: "100%", overflow: "auto" }}
          />
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
        {/* Control bar: Input toggle + Execute button */}
        <div className={styles["python-control-bar"]}>
          <div className={styles["python-control-left"]}>
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
            {hasInputCall && !showStdinInput && (
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

        {/* Execution result */}
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
            <div className={styles["python-result-header"]}>
              <span>
                {executionResult.blocked
                  ? getBlockedMessage(executionResult.blockedReason)
                  : executionResult.success && executionResult.code === 0
                  ? Locale.Chat.Actions.ExecutionSuccess
                  : Locale.Chat.Actions.ExecutionFailed}
              </span>
              {!executionResult.blocked && executionResult.stdout && (
                <button
                  className={styles["python-copy-btn"]}
                  onClick={() => copyToClipboard(executionResult.stdout || "")}
                >
                  {Locale.Chat.Actions.Copy}
                </button>
              )}
            </div>

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
          ) : (
            <button
              className={`${styles["code-header-btn"]} ${
                !contentType ? styles["btn-disabled"] : ""
              }`}
              onClick={() => contentType && setShowPreview(!showPreview)}
              disabled={!contentType}
            >
              {showPreview
                ? Locale.Chat.Actions.ShowCode
                : Locale.Chat.Actions.Preview}
            </button>
          )}
          {enableCodeFold && (
            <button
              className={`${styles["code-header-btn"]} ${
                !showToggle ? styles["btn-disabled"] : ""
              }`}
              onClick={() => setCollapsed((v) => !v)}
              disabled={!showToggle}
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

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;

    if (!codeFoldCtx) return;
    const collapsedMax = Math.max(160, 0.3 * height);
    const needed = el.scrollHeight > collapsedMax + 4;
    if (codeFoldCtx.showToggle !== needed) {
      codeFoldCtx.setShowToggle(needed);
    }
    // 仅在折叠时把滚动保持在底部
    if (codeFoldCtx.collapsed && el.scrollTop !== el.scrollHeight) {
      el.scrollTop = el.scrollHeight;
    }
  }, [props.children, codeFoldCtx?.collapsed, height, codeFoldCtx]);

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

function escapeDollarNumber(text: string) {
  let escapedText = "";
  let isInMathExpression = false;
  let isInCodeBlock = false;
  let isInInlineCode = false;
  let isInLatexBlock = false;

  for (let i = 0; i < text.length; i++) {
    let char = text[i];
    const prevChar = text[i - 1] || " ";
    const nextChar = text[i + 1] || " ";

    // Toggle the isInCodeBlock flag when encountering a code block start or end indicator
    if (text.substring(i, i + 3) === "```") {
      isInCodeBlock = !isInCodeBlock;
      escapedText += "```";
      i += 2; // Skip the next two characters since we have already included them
      continue;
    }

    // Toggle the isInInlineCode flag when encountering a single backtick
    if (char === "`" && !isInCodeBlock) {
      isInInlineCode = !isInInlineCode;
      escapedText += "`";
      continue;
    }

    // Toggle the isInLatexBlock flag when encountering \[ or \]
    if (char === "\\" && nextChar === "[" && !isInLatexBlock) {
      isInLatexBlock = true;
      escapedText += "\\[";
      i++; // Skip the next character since we have already included it
      continue;
    } else if (char === "\\" && nextChar === "]" && isInLatexBlock) {
      isInLatexBlock = false;
      escapedText += "\\]";
      i++; // Skip the next character since we have already included it
      continue;
    }

    // If inside a code block, preserve the character as is
    if (isInCodeBlock || isInInlineCode || isInLatexBlock) {
      escapedText += char;
      continue;
    }

    // Toggle the isInMathExpression flag when encountering a dollar sign
    if (char === "$" && nextChar !== "$" && !isInMathExpression) {
      isInMathExpression = true;
    } else if (char === "$" && nextChar !== "$" && isInMathExpression) {
      isInMathExpression = false;
    }

    // Preserve the double dollar sign in math expressions
    if (char === "$" && nextChar === "$") {
      escapedText += "$$"; // Preserve the double dollar sign
      i++; // Skip the next dollar sign since we have already included it
      continue;
    }

    // Escape a single dollar sign followed by a number outside of math expressions
    if (
      char === "$" &&
      nextChar >= "0" &&
      nextChar <= "9" &&
      !isInMathExpression &&
      !isInLatexBlock
    ) {
      escapedText += "&#36;"; // Use HTML entity &#36; to represent the dollar sign
      continue;
    }
    // Process single tildes only if not in code block or inline code
    if (char === "~" && prevChar !== "~" && nextChar !== "~") {
      escapedText += "\\~"; // Escape single tilde
      continue;
    }

    escapedText += char; // Add the character as is
  }

  return escapedText;
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
function formatBoldText(text: string) {
  // 先处理加粗文本间冒号连接问题 - 优先处理复杂情况
  let processed = text.replace(
    /\*\*(.*?)\*\*([:：])\*\*(.*?)\*\*/g,
    (match, text1, colon, text2) => {
      return `**${text1}**${colon} **${text2}**`;
    },
  );

  // 然后处理单个冒号后加粗问题
  processed = processed.replace(
    /\*\*(.*?)([:：])\*\*/g,
    (match, boldText, colon) => {
      return `**${boldText}**${colon}`;
    },
  );

  // 最后处理引号加粗后紧跟文本的问题 - 包含完整的中英文引号
  processed = processed.replace(
    /\*\*(".*?"|'.*?'|“.*?”|‘.*?’|「.*?」|『.*?』)\*\*([^\s])/g,
    (match, quotedText, nextChar) => {
      return `**${quotedText}** ${nextChar}`;
    },
  );

  return processed;
}

function formatSearchText(
  text: string,
  searchingTime?: number,
): {
  searchText: string;
  remainText: string;
} {
  text = text.trimStart();

  // 检查是否以 <search> 开头但没有结束标签
  if (text.startsWith("<search>") && !text.includes("</search>")) {
    // 获取 <search> 后的所有内容
    const searchContent = text.slice("<search>".length);
    // 渲染为"搜索中"状态
    const searchText = `<searchcollapse title="${Locale.NewChat.Searching}">\n${searchContent}\n\n</searchcollapse>\n`;
    const remainText = ""; // 剩余文本为空
    return { searchText, remainText };
  }
  const pattern = /^<search>([\s\S]*?)<\/search>/;
  const match = text.match(pattern);

  if (match) {
    const searchContent = match[1];
    let searchText = "";
    if (searchContent.trim() === "") {
      searchText = `<searchcollapse title="${Locale.NewChat.NoSearch}">\n\n</searchcollapse>\n`;
    } else {
      searchText = `<searchcollapse title="${
        Locale.NewChat.Search
      }${Locale.NewChat.ThinkFormat(
        searchingTime,
      )}">\n${searchContent}\n\n</searchcollapse>\n`;
    }
    const remainText = text.substring(match[0].length); // 提取剩余文本
    return { searchText, remainText };
  }

  // 没有找到 search 标签
  return { searchText: "", remainText: text };
}

function formatThinkText(
  text: string,
  thinkingTime?: number,
): {
  thinkText: string;
  remainText: string;
} {
  text = text.trimStart();
  // 检查是否以 <think> 开头但没有结束标签
  if (text.startsWith("<think>") && !text.includes("</think>")) {
    // 获取 <think> 后的所有内容
    const thinkContent = text.slice("<think>".length);
    // 渲染为"思考中"状态
    const thinkText = `<thinkcollapse title="${Locale.NewChat.Thinking}">\n${thinkContent}\n\n</thinkcollapse>\n`;
    const remainText = ""; // 剩余文本为空
    return { thinkText, remainText };
  }

  // 处理完整的 think 标签
  const pattern = /^<think>([\s\S]*?)<\/think>/;
  const match = text.match(pattern);
  if (match) {
    const thinkContent = match[1];
    let thinkText = "";
    if (thinkContent.trim() === "") {
      thinkText = `<thinkcollapse title="${Locale.NewChat.NoThink}">\n\n</thinkcollapse>\n`;
    } else {
      thinkText = `<thinkcollapse title="${
        Locale.NewChat.Think
      }${Locale.NewChat.ThinkFormat(
        thinkingTime,
      )}">\n${thinkContent}\n\n</thinkcollapse>\n`;
    }
    const remainText = text.substring(match[0].length); // 提取剩余文本
    return { thinkText, remainText };
  }

  // 没有找到 think 标签
  return { thinkText: "", remainText: text };
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
    const originalContent = autoFixLatexDisplayMode(
      formatBoldText(escapeBrackets(escapeDollarNumber(props.content))),
    );
    const { searchText, remainText: searchRemainText } = formatSearchText(
      originalContent,
      props.searchingTime,
    );
    const { thinkText, remainText } = formatThinkText(
      searchRemainText,
      props.thinkingTime,
    );
    const content = searchText + thinkText + remainText;
    return tryWrapHtmlCode(content);
  }, [props.content, props.searchingTime, props.thinkingTime]);

  const remarkPlugins = useMemo(
    () =>
      isStreaming
        ? [RemarkGfm, RemarkBreaks]
        : [RemarkMath, RemarkGfm, RemarkBreaks],
    [isStreaming],
  );
  const rehypePlugins = useMemo(
    () =>
      isStreaming
        ? [[rehypeSanitize, sanitizeOptions]]
        : [
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
    [isStreaming],
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

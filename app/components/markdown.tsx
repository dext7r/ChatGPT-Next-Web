import ReactMarkdown from "react-markdown";
import "katex/dist/katex.min.css";
import RemarkMath from "remark-math";
import RemarkBreaks from "remark-breaks";
import RehypeKatex from "rehype-katex";
import RemarkGfm from "remark-gfm";
import RehypeHighlight from "rehype-highlight";
import { useRef, useState, RefObject, useEffect, useMemo } from "react";
import { copyToClipboard, useWindowSize } from "../utils";
import mermaid from "mermaid";
import Locale from "../locales";
import LoadingIcon from "../icons/three-dots.svg";
import ReloadButtonIcon from "../icons/reload.svg";
import React from "react";
import { useDebouncedCallback } from "use-debounce";
import { showImageModal, FullScreen } from "./ui-lib";
import {
  ArtifactsShareButton,
  HTMLPreview,
  HTMLPreviewHander,
} from "./artifacts";
import { useChatStore } from "../store";
import { IconButton } from "./button";

import { useAppConfig } from "../store/config";

export function Mermaid(props: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (props.code && ref.current) {
      mermaid
        .run({
          nodes: [ref.current],
          suppressErrors: true,
        })
        .catch((e) => {
          setHasError(true);
          console.error("[Mermaid] ", e.message);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.code]);

  function viewSvgInNewWindow() {
    const svg = ref.current?.querySelector("svg");
    if (!svg) return;
    const text = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([text], { type: "image/svg+xml" });
    showImageModal(URL.createObjectURL(blob));
  }

  if (hasError) {
    return null;
  }

  return (
    <div
      className="no-dark mermaid"
      style={{
        cursor: "pointer",
        overflow: "auto",
      }}
      ref={ref}
      onClick={() => viewSvgInNewWindow()}
    >
      {props.code}
    </div>
  );
}

export function PreCode(props: { children: any }) {
  const ref = useRef<HTMLPreElement>(null);
  const previewRef = useRef<HTMLPreviewHander>(null);
  const [mermaidCode, setMermaidCode] = useState("");
  const [htmlCode, setHtmlCode] = useState("");
  const { height } = useWindowSize();
  const chatStore = useChatStore();
  const session = chatStore.currentSession();

  const renderArtifacts = useDebouncedCallback(() => {
    if (!ref.current) return;
    const mermaidDom = ref.current.querySelector("code.language-mermaid");
    if (mermaidDom) {
      setMermaidCode((mermaidDom as HTMLElement).innerText);
    }
    const htmlDom = ref.current.querySelector("code.language-html");
    const refText = ref.current.querySelector("code")?.innerText;
    if (htmlDom) {
      setHtmlCode((htmlDom as HTMLElement).innerText);
    } else if (refText?.startsWith("<!DOCTYPE")) {
      setHtmlCode(refText);
    }
  }, 600);

  const config = useAppConfig();
  const enableArtifacts =
    session.mask?.enableArtifacts !== false && config.enableArtifacts;

  //Wrap the paragraph for plain-text
  useEffect(() => {
    if (ref.current) {
      const codeElements = ref.current.querySelectorAll(
        "code",
      ) as NodeListOf<HTMLElement>;
      const wrapLanguages = [
        "",
        "md",
        "markdown",
        "text",
        "txt",
        "plaintext",
        "tex",
        "latex",
      ];
      codeElements.forEach((codeElement) => {
        let languageClass = codeElement.className.match(/language-(\w+)/);
        let name = languageClass ? languageClass[1] : "";
        if (wrapLanguages.includes(name)) {
          codeElement.style.whiteSpace = "pre-wrap";
        }
      });
      setTimeout(renderArtifacts, 1);
    }
  }, [renderArtifacts]);
  return (
    <>
      <pre ref={ref}>
        <span
          className="copy-code-button"
          onClick={() => {
            if (ref.current) {
              copyToClipboard(
                ref.current.querySelector("code")?.innerText ?? "",
              );
            }
          }}
        ></span>
        {props.children}
      </pre>
      {mermaidCode.length > 0 && (
        <Mermaid code={mermaidCode} key={mermaidCode} />
      )}
      {htmlCode.length > 0 && enableArtifacts && (
        <FullScreen className="no-dark html" right={70}>
          {/* <ArtifactsShareButton
            style={{ position: "absolute", right: 20, top: 10 }}
            getCode={() => htmlCode}
          /> */}
          <span className="button-description">
            在设置中开启或关闭 Artifacts 预览
          </span>
          <IconButton
            style={{ position: "absolute", right: 20, top: 10 }}
            bordered
            icon={<ReloadButtonIcon />}
            shadow
            onClick={() => previewRef.current?.reload()}
          />
          <HTMLPreview
            ref={previewRef}
            code={htmlCode}
            autoHeight={!document.fullscreenElement}
            height={!document.fullscreenElement ? 600 : height}
          />
        </FullScreen>
      )}
    </>
  );
}

function CustomCode(props: { children: any; className?: string }) {
  const ref = useRef<HTMLPreElement>(null);
  const [collapsed, setCollapsed] = useState(true);
  const [showToggle, setShowToggle] = useState(false);

  useEffect(() => {
    if (ref.current) {
      const codeHeight = ref.current.scrollHeight;
      setShowToggle(codeHeight > 400);
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [props.children]);

  const toggleCollapsed = () => {
    setCollapsed((collapsed) => !collapsed);
  };
  return (
    <>
      <code
        className={props?.className}
        ref={ref}
        style={{
          maxHeight: collapsed ? "400px" : "none",
          overflowY: "hidden",
        }}
      >
        {props.children}
      </code>
      {showToggle && (
        <div
          className={`show-hide-button ${collapsed ? "collapsed" : "expanded"}`}
        >
          <button onClick={toggleCollapsed}>
            {collapsed ? Locale.NewChat.More : Locale.NewChat.Less}
          </button>
        </div>
      )}
    </>
  );
}

// function escapeDollarNumber(text: string) {
//   let escapedText = "";

//   for (let i = 0; i < text.length; i += 1) {
//     let char = text[i];
//     const nextChar = text[i + 1] || " ";

//     if (char === "$" && nextChar >= "0" && nextChar <= "9") {
//       char = "\\$";
//     }

//     escapedText += char;
//   }

//   return escapedText;
// }
function escapeDollarNumber(text: string) {
  let escapedText = "";
  let isInMathExpression = false;
  let isInCodeBlock = false;
  let isInInlineCode = false;

  for (let i = 0; i < text.length; i++) {
    let char = text[i];
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

    // If inside a code block, preserve the character as is
    if (isInCodeBlock || isInInlineCode) {
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
      !isInMathExpression
    ) {
      escapedText += "&#36;"; // Use HTML entity &#36; to represent the dollar sign
      continue;
    }

    escapedText += char;
  }

  return escapedText;
}

// function escapeBrackets(text: string) {
//   const pattern =
//     /(```[\s\S]*?```|`.*?`)|\\\[([\s\S]*?[^\\])\\\]|\\\((.*?)\\\)/g;
//   return text.replace(
//     pattern,
//     (match, codeBlock, squareBracket, roundBracket) => {
//       if (codeBlock) {
//         return codeBlock;
//       } else if (squareBracket) {
//         return `$$${squareBracket}$$`;
//       } else if (roundBracket) {
//         return `$${roundBracket}$`;
//       }
//       return match;
//     },
//   );
// }

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
  const pattern = /\*\*(.*?)([:：])\*\*/g;
  return text.replace(pattern, (match, boldText, colon) => {
    return `**${boldText}**${colon}`;
  });
}

function tryWrapHtmlCode(text: string) {
  // try add wrap html code (fixed: html codeblock include 2 newline)
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

function _MarkDownContent(props: { content: string }) {
  const escapedContent = useMemo(() => {
    return tryWrapHtmlCode(
      formatBoldText(escapeBrackets(escapeDollarNumber(props.content))),
    );
  }, [props.content]);

  return (
    <ReactMarkdown
      remarkPlugins={[RemarkMath, RemarkGfm, RemarkBreaks]}
      rehypePlugins={[
        RehypeKatex,
        [
          RehypeHighlight,
          {
            detect: false,
            ignoreMissing: true,
          },
        ],
      ]}
      components={{
        pre: PreCode,
        code: CustomCode,
        p: (pProps) => <p {...pProps} dir="auto" />,
        a: (aProps) => {
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
      }}
    >
      {escapedContent}
    </ReactMarkdown>
  );
}

export const MarkdownContent = React.memo(_MarkDownContent);

export function Markdown(
  props: {
    content: string;
    loading?: boolean;
    fontSize?: number;
    parentRef?: RefObject<HTMLDivElement>;
    defaultShow?: boolean;
  } & React.DOMAttributes<HTMLDivElement>,
) {
  const mdRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className="markdown-body"
      style={{
        fontSize: `${props.fontSize ?? 14}px`,
      }}
      ref={mdRef}
      onContextMenu={props.onContextMenu}
      onDoubleClickCapture={props.onDoubleClickCapture}
      dir="auto"
    >
      {props.loading ? (
        <LoadingIcon />
      ) : (
        <MarkdownContent content={props.content} />
      )}
    </div>
  );
}

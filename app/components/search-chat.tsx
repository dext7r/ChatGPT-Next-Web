import { useState, useEffect, useRef, useCallback } from "react";
import { ErrorBoundary } from "./error";
import styles from "./mask.module.scss";
import { useNavigate } from "react-router-dom";
import { IconButton } from "./button";
import CloseIcon from "../icons/close.svg";
import EyeIcon from "../icons/eye.svg";
import Locale from "../locales";
import { Path } from "../constant";

import { useChatStore } from "../store";

type Item = {
  id: number;
  sessionId: number;
  name: string;
  content: string;
  jumpIndex: number;
};

type Grouped = {
  sessionId: number;
  sessionName: string;
  items: Item[];
};

function highlightText(text: string, keyword: string) {
  if (!keyword) return text;
  const regex = new RegExp(`(${keyword})`, "gi");
  return text.split(regex).map((part, i) =>
    regex.test(part) ? (
      <mark key={i} style={{ backgroundColor: "yellow" }}>
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

function groupBySession(
  results: Item[],
  fallbackName = "未命名会话",
): Grouped[] {
  const map = new Map<number, Grouped>();
  for (const r of results) {
    const g = map.get(r.sessionId);
    if (g) {
      g.items.push(r);
    } else {
      map.set(r.sessionId, {
        sessionId: r.sessionId,
        sessionName: r.name || fallbackName,
        items: [r],
      });
    }
  }
  // 组内和组间的排序都给一下：组间按“组内首条命中长度总和/最近命中”随便挑一个
  // 这里简单点：按组内命中条数降序；组内按 jumpIndex 升序（越早的消息排前）
  const grouped = Array.from(map.values());
  grouped.forEach((g) => g.items.sort((a, b) => a.jumpIndex - b.jumpIndex));
  grouped.sort((a, b) => b.items.length - a.items.length);
  return grouped;
}
export function SearchChatPage() {
  const navigate = useNavigate();

  const chatStore = useChatStore();

  const sessions = chatStore.sessions;
  const selectSession = chatStore.selectSession;

  const [searchResults, setSearchResults] = useState<Item[]>([]);

  const previousValueRef = useRef<string>("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const doSearch = useCallback(
    (text: string) => {
      const lowerCaseText = text.toLowerCase();
      const results: Item[] = [];
      let uid = 1;

      sessions.forEach((session, index) => {
        // const fullTextContents: string[] = [];
        // let firstIndex = -1;

        session.messages.forEach((message, mIndex) => {
          const content = message.content as string;
          if (!content || typeof content !== "string") return;
          const lowerCaseContent = content.toLowerCase?.() ?? "";
          if (!lowerCaseContent.includes(lowerCaseText)) return;

          const snippets: string[] = [];
          let pos = lowerCaseContent.indexOf(lowerCaseText);
          while (pos !== -1) {
            const start = Math.max(0, pos - 35);
            const end = Math.min(
              content.length,
              pos + lowerCaseText.length + 35,
            );
            snippets.push(content.substring(start, end));
            pos = lowerCaseContent.indexOf(
              lowerCaseText,
              pos + lowerCaseText.length,
            );
          }

          results.push({
            id: uid++,
            sessionId: index,
            name: session.topic,
            content: snippets.join("... "),
            jumpIndex: mIndex + 1,
          });
        });
      });

      // sort by length of matching content
      results.sort((a, b) => b.content.length - a.content.length);

      return results;
    },
    [sessions],
  );

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (searchInputRef.current) {
        const currentValue = searchInputRef.current.value;
        if (currentValue !== previousValueRef.current) {
          if (currentValue.length > 0) {
            const result = doSearch(currentValue);
            setSearchResults(result);
          } else {
            setSearchResults([]);
          }
          previousValueRef.current = currentValue;
        }
      }
    }, 1000);

    // Cleanup the interval on component unmount
    return () => clearInterval(intervalId);
  }, [doSearch]);

  const groupedResults = groupBySession(searchResults);
  return (
    <ErrorBoundary>
      <div className={styles["mask-page"]}>
        {/* header */}
        <div className="window-header">
          <div className="window-header-title">
            <div className="window-header-main-title">
              {Locale.SearchChat.Page.Title}
            </div>
            <div className="window-header-submai-title">
              {Locale.SearchChat.Page.SubTitle(searchResults.length)}
            </div>
          </div>

          <div className="window-actions">
            <div className="window-action-button">
              <IconButton
                icon={<CloseIcon />}
                bordered
                onClick={() => navigate(-1)}
              />
            </div>
          </div>
        </div>

        <div className={styles["mask-page-body"]}>
          <div className={styles["mask-filter"]}>
            {/**搜索输入框 */}
            <input
              type="text"
              className={styles["search-bar"]}
              placeholder={Locale.SearchChat.Page.Search}
              autoFocus
              ref={searchInputRef}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const searchText = e.currentTarget.value;
                  if (searchText.length > 0) {
                    const result = doSearch(searchText);
                    setSearchResults(result);
                  } else {
                    setSearchResults([]);
                  }
                }
              }}
            />
          </div>

          <div>
            {groupedResults.map((group) => (
              <div key={group.sessionId} style={{ marginBottom: 10 }}>
                {/* 分组标题（会话名） */}
                <div
                  className={styles["mask-header"]}
                  style={{ padding: "4px 0" }}
                >
                  <div
                    className={styles["mask-title"]}
                    style={{ fontWeight: 600 }}
                  >
                    {group.sessionName}
                    <span
                      style={{ fontWeight: 400, opacity: 0.6, marginLeft: 8 }}
                    >
                      ({group.items.length} matches)
                    </span>
                  </div>
                </div>

                {/* 该会话下的所有命中项 */}
                {group.items.map((item) => (
                  <div
                    className={styles["mask-item"]}
                    key={item.id}
                    onClick={() => {
                      selectSession(group.sessionId);
                      navigate(Path.Chat, {
                        state: { jumpToIndex: item.jumpIndex },
                      });
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <div className={styles["mask-header"]}>
                      <div>
                        {highlightText(
                          item.content.slice(0, 70),
                          searchInputRef.current?.value || "",
                        )}
                      </div>
                    </div>
                    <div className={styles["mask-actions"]}>
                      <IconButton
                        icon={<EyeIcon />}
                        text={Locale.SearchChat.Item.View}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

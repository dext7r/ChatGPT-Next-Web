import DeleteIcon from "../icons/delete.svg";
import PinIcon from "../icons/pin.svg";
import ShareIcon from "../icons/share.svg";
import RenameIcon from "../icons/rename.svg";
import MoreIcon from "../icons/more.svg";

import styles from "./chat-list.module.scss";
import {
  DragDropContext,
  Droppable,
  Draggable,
  OnDragEndResponder,
} from "@hello-pangea/dnd";
import { createPortal } from "react-dom";

import { useChatStore } from "../store";

import Locale from "../locales";
import { useLocation, useNavigate } from "react-router-dom";
import { Path } from "../constant";
import { MaskAvatar } from "./mask";
import { Mask } from "../store/mask";
import { useRef, useEffect, useState } from "react";
import { showConfirm, showPrompt } from "./ui-lib";
import { useMobileScreen, getMessageTextContent } from "../utils";

function ChatItemDropdown(props: {
  onShare?: () => void;
  onRename?: () => void;
  onPin?: () => void;
  onUnpin?: () => void;
  onDelete?: () => void;
  pinned?: boolean;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  position: { top: number; left: number };
}) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        props.onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [props.onClose]);

  const menuItems = [
    {
      icon: <ShareIcon />,
      label: Locale.ChatItem.Actions.Share,
      onClick: props.onShare,
    },
    {
      icon: <RenameIcon />,
      label: Locale.ChatItem.Actions.Rename,
      onClick: props.onRename,
    },
    {
      icon: <PinIcon />,
      label: props.pinned
        ? Locale.ChatItem.Actions.Unpin
        : Locale.ChatItem.Actions.Pin,
      onClick: props.pinned ? props.onUnpin : props.onPin,
    },
    {
      icon: <DeleteIcon />,
      label: Locale.ChatItem.Actions.Delete,
      onClick: props.onDelete,
      danger: true,
    },
  ];

  return createPortal(
    <div
      ref={dropdownRef}
      className={styles["chat-item-dropdown"]}
      style={{
        top: props.position.top,
        left: props.position.left,
      }}
      onMouseEnter={props.onMouseEnter}
      onMouseLeave={props.onMouseLeave}
    >
      {menuItems.map((item, index) => (
        <div
          key={index}
          className={`${styles["chat-item-dropdown-item"]} ${
            item.danger ? styles["danger"] : ""
          }`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            item.onClick?.();
            props.onClose();
          }}
        >
          <span className={styles["chat-item-dropdown-icon"]}>{item.icon}</span>
          <span className={styles["chat-item-dropdown-label"]}>
            {item.label}
          </span>
        </div>
      ))}
    </div>,
    document.body,
  );
}

export function ChatItem(props: {
  onClick?: () => void;
  onDelete?: () => void;
  onPin?: () => void;
  onUnpin?: () => void;
  onShare?: () => void;
  onRename?: () => void;
  title: string;
  count: number;
  time: string;
  selected: boolean;
  id: string;
  index: number;
  narrow?: boolean;
  mask: Mask;
  pinned?: boolean;
}) {
  const draggableRef = useRef<HTMLDivElement | null>(null);
  const moreButtonRef = useRef<HTMLDivElement | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const isHoveringRef = useRef({ button: false, dropdown: false });

  useEffect(() => {
    if (props.selected && draggableRef.current) {
      draggableRef.current?.scrollIntoView({
        block: "center",
      });
    }
  }, [props.selected]);

  const { pathname: currentPath } = useLocation();

  const checkAndCloseDropdown = () => {
    setTimeout(() => {
      if (!isHoveringRef.current.button && !isHoveringRef.current.dropdown) {
        setShowDropdown(false);
      }
    }, 100);
  };

  const handleMoreMouseEnter = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isHoveringRef.current.button = true;
    if (moreButtonRef.current) {
      const rect = moreButtonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
    setShowDropdown(true);
  };

  const handleMoreMouseLeave = () => {
    isHoveringRef.current.button = false;
    checkAndCloseDropdown();
  };

  const handleDropdownMouseEnter = () => {
    isHoveringRef.current.dropdown = true;
  };

  const handleDropdownMouseLeave = () => {
    isHoveringRef.current.dropdown = false;
    checkAndCloseDropdown();
  };

  return (
    <Draggable draggableId={`${props.id}`} index={props.index}>
      {(provided) => (
        <div
          className={`${styles["chat-item"]} ${
            props.selected &&
            (currentPath === Path.Chat || currentPath === Path.Home) &&
            styles["chat-item-selected"]
          } ${props.pinned ? styles["chat-item-pinned"] : ""} ${
            props.narrow ? styles["chat-item-narrow-mode"] : ""
          }`}
          onClick={props.onClick}
          ref={(ele) => {
            draggableRef.current = ele;
            provided.innerRef(ele);
          }}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          title={`${props.title}\n${Locale.ChatItem.ChatItemCount(
            props.count,
          )}`}
        >
          {props.narrow ? (
            <div className={styles["chat-item-narrow"]}>
              <div className={styles["chat-item-avatar"] + " no-dark"}>
                <MaskAvatar
                  avatar={props.mask.avatar}
                  model={props.mask.modelConfig.model}
                />
              </div>
              <div className={styles["chat-item-narrow-count"]}>
                {props.count}
              </div>
            </div>
          ) : (
            <>
              <div className={styles["chat-item-title"]}>{props.title}</div>
              <div className={styles["chat-item-info"]}>
                <div className={styles["chat-item-count"]}>
                  {Locale.ChatItem.ChatItemCount(props.count)}
                </div>
                <div className={styles["chat-item-date"]}>{props.time}</div>
              </div>
            </>
          )}

          {/* 右侧操作区域：置顶图标 / 更多按钮 */}
          <div
            className={`${styles["chat-item-actions"]} ${
              props.narrow ? styles["chat-item-actions-narrow"] : ""
            }`}
          >
            {/* 置顶图标：仅在置顶且未 hover 时显示 */}
            {props.pinned && (
              <div className={styles["chat-item-pin-indicator"]}>
                <PinIcon />
              </div>
            )}
            {/* 更多按钮：hover 时显示 */}
            <div
              ref={moreButtonRef}
              className={styles["chat-item-more"]}
              onMouseEnter={handleMoreMouseEnter}
              onMouseLeave={handleMoreMouseLeave}
            >
              <MoreIcon />
            </div>
            {/* 下拉菜单 */}
            {showDropdown && (
              <ChatItemDropdown
                onShare={props.onShare}
                onRename={props.onRename}
                onPin={props.onPin}
                onUnpin={props.onUnpin}
                onDelete={props.onDelete}
                pinned={props.pinned}
                onClose={() => setShowDropdown(false)}
                onMouseEnter={handleDropdownMouseEnter}
                onMouseLeave={handleDropdownMouseLeave}
                position={dropdownPosition}
              />
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}

export function ChatList(props: { narrow?: boolean }) {
  const [
    sessions,
    selectedIndex,
    selectSession,
    moveSession,
    pinSession,
    unpinSession,
  ] = useChatStore((state) => [
    state.sessions,
    state.currentSessionIndex,
    state.selectSession,
    state.moveSession,
    state.pinSession,
    state.unpinSession,
  ]);
  const chatStore = useChatStore();
  const navigate = useNavigate();
  const isMobileScreen = useMobileScreen();

  const sortedSessions = sessions.slice().sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.lastUpdate - a.lastUpdate; // 按最后更新时间降序排列
  });

  const onDragEnd: OnDragEndResponder = (result) => {
    const { destination, source } = result;
    if (!destination) {
      return;
    }

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    moveSession(source.index, destination.index);
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="chat-list">
        {(provided) => (
          <div
            className={styles["chat-list"]}
            ref={provided.innerRef}
            {...provided.droppableProps}
          >
            {sortedSessions.map((item, i) => (
              <ChatItem
                title={item.topic}
                time={new Date(item.lastUpdate).toLocaleString()}
                count={item.messages.length}
                key={item.id}
                id={item.id}
                index={i}
                selected={sessions.indexOf(item) === selectedIndex}
                pinned={item.pinned}
                onClick={() => {
                  navigate(Path.Chat);
                  selectSession(sessions.indexOf(item));
                }}
                onDelete={async () => {
                  // 获取内容摘要：取最后一条消息的前50个字符
                  const lastMessage = item.messages[item.messages.length - 1];
                  const summary = lastMessage
                    ? getMessageTextContent(lastMessage).slice(0, 50) +
                      (getMessageTextContent(lastMessage).length > 50
                        ? "..."
                        : "")
                    : "";

                  const confirmContent = (
                    <div style={{ textAlign: "left" }}>
                      <div style={{ marginBottom: "10px" }}>
                        {Locale.ChatItem.DeleteConfirm.Title}
                      </div>
                      <div style={{ marginBottom: "6px" }}>
                        <span
                          style={{
                            color: "var(--black)",
                            fontWeight: 500,
                            fontSize: "var(--text-sm)",
                          }}
                        >
                          {item.topic}
                        </span>
                        <span
                          style={{
                            color: "rgb(150, 150, 150)",
                            marginLeft: "6px",
                            fontSize: "var(--text-xs)",
                          }}
                        >
                          ({Locale.ChatItem.ChatItemCount(item.messages.length)}
                          )
                        </span>
                      </div>
                      {summary && (
                        <div
                          style={{
                            color: "rgb(150, 150, 150)",
                            fontSize: "var(--text-xs)",
                          }}
                        >
                          <span>
                            {Locale.ChatItem.DeleteConfirm.LastMessage}
                          </span>
                          <span
                            style={{
                              marginLeft: "4px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {summary}
                          </span>
                        </div>
                      )}
                    </div>
                  );

                  if (await showConfirm(confirmContent)) {
                    chatStore.deleteSession(sessions.indexOf(item));
                  }
                }}
                onPin={() => {
                  pinSession(sessions.indexOf(item));
                }}
                onUnpin={() => {
                  unpinSession(sessions.indexOf(item));
                }}
                onShare={() => {
                  // 先选中该会话，然后跳转到聊天页面触发分享
                  selectSession(sessions.indexOf(item));
                  navigate(Path.Chat, { state: { triggerShare: true } });
                }}
                onRename={async () => {
                  const newTopic = await showPrompt(
                    Locale.Chat.Rename,
                    item.topic,
                    1,
                  );
                  if (newTopic && newTopic.trim()) {
                    chatStore.updateSession(
                      sessions.indexOf(item),
                      (session) => {
                        session.topic = newTopic.trim();
                      },
                    );
                  }
                }}
                narrow={props.narrow}
                mask={item.mask}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}

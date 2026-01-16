import * as React from "react";
import { useState } from "react";

import styles from "./button.module.scss";
import { CSSProperties } from "react";

export type ButtonType = "primary" | "danger" | "info" | null;

export function IconButton(props: {
  onClick?: () => void;
  icon?: JSX.Element;
  type?: ButtonType;
  text?: string;
  bordered?: boolean;
  shadow?: boolean;
  className?: string;
  title?: string;
  disabled?: boolean;
  tabIndex?: number;
  autoFocus?: boolean;
  style?: CSSProperties;
  aria?: string;
  tooltipPosition?: "top" | "bottom" | "left" | "right";
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipPosition = props.tooltipPosition || "top";

  return (
    <div
      className={`${styles["icon-button-wrapper"]} ${props.className ?? ""}`}
    >
      <button
        className={
          styles["icon-button"] +
          ` ${props.bordered && styles.border} ${
            props.shadow && styles.shadow
          } clickable ${styles[props.type ?? ""]}`
        }
        onClick={props.onClick}
        disabled={props.disabled}
        role="button"
        tabIndex={props.tabIndex}
        autoFocus={props.autoFocus}
        style={props.style}
        aria-label={props.aria || props.title}
        onMouseEnter={() => props.title && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {props.icon && (
          <div
            aria-label={props.text || props.title}
            className={
              styles["icon-button-icon"] +
              ` ${props.type === "primary" && "no-dark"}`
            }
          >
            {props.icon}
          </div>
        )}

        {props.text && (
          <div
            aria-label={props.text || props.title}
            className={styles["icon-button-text"]}
          >
            {props.text}
          </div>
        )}
      </button>
      {showTooltip && props.title && !props.text && (
        <div
          className={`${styles["icon-button-tooltip"]} ${
            styles[`tooltip-${tooltipPosition}`]
          }`}
        >
          {props.title}
        </div>
      )}
    </div>
  );
}

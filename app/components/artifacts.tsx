import {
  useEffect,
  useState,
  useRef,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useParams } from "react-router";
import { IconButton } from "./button";
import { nanoid } from "nanoid";
import ExportIcon from "../icons/share.svg";
import CopyIcon from "../icons/copy.svg";
import DownloadIcon from "../icons/download.svg";
import GithubIcon from "../icons/github.svg";
import LoadingButtonIcon from "../icons/loading.svg";
import ReloadButtonIcon from "../icons/reload.svg";
import Locale from "../locales";
import { Modal, showToast } from "./ui-lib";
import { copyToClipboard, downloadAs } from "../utils";
import { Path, ApiPath, REPO_URL } from "@/app/constant";
import { Loading } from "./home";
import styles from "./artifacts.module.scss";
import { getHeaders } from "../client/api";

type HTMLPreviewProps = {
  code: string;
  autoHeight?: boolean;
  height?: number | string;
  minWidth?: number | string;
  onLoad?: (title?: string) => void;
};

export type HTMLPreviewHander = {
  reload: () => void;
};

export const HTMLPreview = forwardRef<HTMLPreviewHander, HTMLPreviewProps>(
  function HTMLPreview(props, ref) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [frameId, setFrameId] = useState<string>(nanoid());
    const [iframeHeight, setIframeHeight] = useState(600);
    const [title, setTitle] = useState("");
    /*
     * https://stackoverflow.com/questions/19739001/what-is-the-difference-between-srcdoc-and-src-datatext-html-in-an
     * 1. using srcdoc
     * 2. using src with dataurl:
     *    easy to share
     *    length limit (Data URIs cannot be larger than 32,768 characters.)
     */

    useEffect(() => {
      const handleMessage = (e: any) => {
        const { id, height, title } = e.data;
        setTitle(title);
        if (id == frameId) {
          setIframeHeight(height);
        }
      };
      window.addEventListener("message", handleMessage);
      return () => {
        window.removeEventListener("message", handleMessage);
      };
    }, [frameId]);

    useImperativeHandle(ref, () => ({
      reload: () => {
        setFrameId(nanoid());
      },
    }));

    const height = useMemo(() => {
      if (!props.autoHeight) return props.height || 600;
      if (typeof props.height === "string") {
        return props.height;
      }
      const parentHeight = props.height || 600;
      return iframeHeight + 40 > parentHeight
        ? parentHeight
        : iframeHeight + 40;
    }, [props.autoHeight, props.height, iframeHeight]);

    const minWidthStyle = useMemo(() => {
      if (!props.minWidth) return undefined;
      return typeof props.minWidth === "number"
        ? `${props.minWidth}px`
        : props.minWidth;
    }, [props.minWidth]);

    const srcDoc = useMemo(() => {
      const script = `<script>window.addEventListener("DOMContentLoaded", () => new ResizeObserver((entries) => parent.postMessage({id: '${frameId}', height: entries[0].target.clientHeight}, '*')).observe(document.body))</script>`;
      if (props.code.includes("<!DOCTYPE html>")) {
        props.code.replace("<!DOCTYPE html>", "<!DOCTYPE html>" + script);
      }
      return script + props.code;
    }, [props.code, frameId]);

    const handleOnLoad = () => {
      if (props?.onLoad) {
        props.onLoad(title);
      }
    };

    return (
      <iframe
        className={styles["artifacts-iframe"]}
        key={frameId}
        ref={iframeRef}
        sandbox="allow-forms allow-modals allow-scripts"
        style={{ height, minWidth: minWidthStyle }}
        srcDoc={srcDoc}
        onLoad={handleOnLoad}
      />
    );
  },
);

export function ArtifactsShareButton({
  getCode,
  id,
  style,
  fileName,
}: {
  getCode: () => string;
  id?: string;
  style?: any;
  fileName?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(id);
  // const [show, setShow] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [shareResult, setShareResult] = useState<
    { url: string; error?: null } | { url?: null; error: string } | null
  >(null);

  const [selectedTtlOption, setSelectedTtlOption] = useState("86400"); // Default to '1 Day'
  const [customTtlValue, setCustomTtlValue] = useState(1);
  const [customTtlUnit, setCustomTtlUnit] = useState("days");

  const upload = (code: string, expiration?: number) =>
    id
      ? Promise.resolve({ id })
      : fetch(ApiPath.Artifacts, {
          method: "POST",
          body: JSON.stringify({ code: code, ttl: expiration }),
          headers: {
            ...getHeaders(),
            "Content-Type": "application/json",
          },
        })
          .then((res) => {
            // 先解析 JSON
            return res.json().then((data) => {
              if (!res.ok) {
                const message = data?.msg || "Upload failed";
                throw new Error(message);
              }
              return data;
            });
          })
          .then((data) => {
            if (data.id) {
              return { id: data.id };
            }
            // 如果没有 id，但有 message，用它抛出 Error
            const message = data?.msg || "No ID returned";
            throw new Error(message);
          })
          .catch((e) => {
            console.error(e);
            showToast(`${Locale.Export.Artifacts.Error}: ${e.message}`);
          });
  const calculatedTtlInSeconds = useMemo(() => {
    if (selectedTtlOption !== "custom") {
      return Number(selectedTtlOption);
    }

    // Handle custom calculation
    const value = Number(customTtlValue);
    if (isNaN(value) || value <= 0) {
      return null; // Invalid state
    }

    switch (customTtlUnit) {
      case "minutes":
        return value * 60;
      case "hours":
        return value * 3600;
      case "days":
        return value * 86400;
      default:
        return null; // Invalid unit
    }
  }, [selectedTtlOption, customTtlValue, customTtlUnit]);

  const handleShare = () => {
    if (loading || calculatedTtlInSeconds === null) return;
    setLoading(true);
    setShowOptionsModal(false); // Close the options modal
    setShowResultModal(true);
    setShareResult(null); // Reset share result

    upload(getCode(), calculatedTtlInSeconds)
      .then((res) => {
        if (res?.id) {
          setName(res?.id);
          const newShareUrl = [
            location.origin,
            "#",
            Path.Artifacts,
            "/",
            res.id,
          ].join("");
          setShareUrl(newShareUrl);
        }
      })
      .catch((e) => {
        setShareResult({ error: e.message });
      })
      .finally(() => setLoading(false));
  };

  const ttlOptions = [
    { label: "1 Hour", value: 3600 },
    { label: "1 Day", value: 86400 },
    { label: "1 Week", value: 604800 },
    { label: "1 Month", value: 2592000 },
    { label: "Never", value: 0 }, // 0 or undefined will use server default
    { label: "Custom...", value: "custom" },
  ];

  return (
    <>
      <div className="window-action-button" style={style}>
        <IconButton
          icon={loading ? <LoadingButtonIcon /> : <ExportIcon />}
          bordered
          title={Locale.Export.Artifacts.Title}
          onClick={() => {
            if (id) {
              // If it's already shared, just show the result modal
              setShowResultModal(true);
              setShareResult({ url: shareUrl });
            } else {
              setShowOptionsModal(true);
            }
          }}
        />
      </div>
      {showOptionsModal && (
        <div className="modal-mask">
          <Modal
            title={Locale.Export.Artifacts.SetExpiration} // You should add this to your locales file
            onClose={() => setShowOptionsModal(false)}
            actions={[
              <IconButton
                key="share"
                icon={<ExportIcon />}
                bordered
                text={Locale.Export.Artifacts.Title} // And this
                onClick={handleShare}
                disabled={calculatedTtlInSeconds === null}
              />,
            ]}
          >
            <div className={styles["artifacts-share-options"]}>
              <span>{Locale.Export.Artifacts.Warning}</span>
              <label>{Locale.Export.Artifacts.ExpirationLabel}</label>
              {/* And this */}
              <select
                value={selectedTtlOption}
                onChange={(e) => setSelectedTtlOption(e.target.value)}
                className={styles["artifacts-share-select"]}
              >
                {ttlOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {selectedTtlOption === "custom" && (
                <div className={styles["artifacts-custom-ttl"]}>
                  <input
                    type="number"
                    min="1"
                    className={styles["artifacts-custom-ttl-input"]}
                    value={customTtlValue}
                    onChange={(e) => setCustomTtlValue(Number(e.target.value))}
                  />
                  <select
                    className={styles["artifacts-custom-ttl-unit"]}
                    value={customTtlUnit}
                    onChange={(e) => setCustomTtlUnit(e.target.value)}
                  >
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </select>
                </div>
              )}
            </div>
          </Modal>
        </div>
      )}

      {showResultModal && (
        <div className="modal-mask">
          <Modal
            title={
              shareUrl
                ? Locale.Export.Artifacts.Title
                : shareResult?.error
                ? "Error"
                : "Uploading..."
            }
            onClose={() => setShowResultModal(false)}
            actions={[
              <IconButton
                key="download"
                icon={<DownloadIcon />}
                bordered
                text={Locale.Export.Download}
                onClick={() => {
                  downloadAs(getCode(), `${fileName || name}.html`).then(() =>
                    setShowResultModal(false),
                  );
                }}
              />,
              <IconButton
                key="copy"
                icon={<CopyIcon />}
                bordered
                text={Locale.Chat.Actions.Copy}
                onClick={() => {
                  copyToClipboard(shareUrl).then(() =>
                    setShowResultModal(false),
                  );
                }}
              />,
            ]}
          >
            <div>
              <a target="_blank" href={shareUrl}>
                {shareUrl}
              </a>
            </div>
          </Modal>
        </div>
      )}
    </>
  );
}

export function Artifacts() {
  const { id } = useParams();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [fileName, setFileName] = useState("");
  const previewRef = useRef<HTMLPreviewHander>(null);

  useEffect(() => {
    if (id) {
      const cacheKey = `artifact-${id}`;
      const cachedCode = localStorage.getItem(cacheKey);
      if (cachedCode) {
        setCode(cachedCode);
        return;
      }

      fetch(`${ApiPath.Artifacts}?id=${id}`)
        .then((res) => {
          if (res.status > 300) {
            throw Error("can not get content");
          }
          return res.text();
        })
        .then((text) => {
          setCode(text);
          // Save the fetched content to localStorage
          try {
            localStorage.setItem(cacheKey, text);
          } catch (e) {
            console.error("Failed to save artifact to localStorage", e);
          }
        })
        .catch((e) => {
          showToast(Locale.Export.Artifacts.Expired);
          setLoading(false);
        });
    }
  }, [id]);

  return (
    <div className={styles["artifacts"]}>
      <div className={styles["artifacts-header"]}>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
          <IconButton bordered icon={<GithubIcon />} shadow />
        </a>
        <IconButton
          bordered
          style={{ marginLeft: 20 }}
          icon={<ReloadButtonIcon />}
          shadow
          onClick={() => previewRef.current?.reload()}
        />
        <div className={styles["artifacts-title"]}>NextChat Artifacts</div>
        {/* <ArtifactsShareButton
          id={id}
          getCode={() => code}
          fileName={fileName}
        /> */}
      </div>
      <div className={styles["artifacts-content"]}>
        {loading && <Loading />}
        {code && (
          <HTMLPreview
            code={code}
            ref={previewRef}
            autoHeight={false}
            height={"100%"}
            onLoad={(title) => {
              setFileName(title as string);
              setLoading(false);
            }}
          />
        )}
      </div>
    </div>
  );
}

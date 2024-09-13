// src/cloud-backup.tsx

import React, { useState, useEffect } from "react";
import styles from "./cloud-backup.module.scss";
import { useAccessStore } from "../store";
import {
  getLocalAppState,
  mergeAppState,
  setLocalAppState,
} from "../utils/sync";
import { getClientConfig } from "../config/client";

export function CloudBackupPage() {
  const [serverAddress, setServerAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [importingFileNames, setImportingFileNames] = useState<Set<string>>(
    new Set(),
  );
  const [renamingFileNames, setRenamingFileNames] = useState<Set<string>>(
    new Set(),
  );
  const [renameInputs, setRenameInputs] = useState<{ [key: string]: string }>(
    {},
  );
  const accessStore = useAccessStore();
  var collisionString = "";

  useEffect(() => {
    // 从 localStorage 读取文件服务器地址
    const savedAddress = localStorage.getItem("serverAddress");
    if (savedAddress) {
      setServerAddress(savedAddress);
    }
  }, []);

  const handleServerAddressChange = (address: string) => {
    setServerAddress(address);
    localStorage.setItem("serverAddress", address); // 保存到 localStorage
  };
  const handleBackup = async () => {
    if (serverAddress.trim() === "") {
      setMessage("文件服务器地址不能为空。");
      return;
    }
    try {
      const parsedUrl = new URL(serverAddress);
      collisionString = parsedUrl.hostname;
    } catch (error) {
      setMessage("无效的文件服务器地址。");
      return;
    }
    setLoading(true);
    setMessage(null);

    const isApp = !!getClientConfig()?.isApp;
    const datePart = isApp
      ? `${new Date().toLocaleDateString().replace(/\//g, "_")}_${new Date()
          .toLocaleTimeString([], { hour12: false })
          .replace(/:/g, "_")}` // 使用 24 小时制时间并替换 ":" 为 "_"
      : new Date().toLocaleString().replace(/[\/:]/g, "_"); // 替换日期和时间中的 "/" 和 ":" 为 "_"
    const fileName = `Backup-${datePart}.json`;

    const state = getLocalAppState();
    const jsonBlob = new Blob([JSON.stringify(state)], {
      type: "application/json",
    });
    const formData = new FormData();
    formData.append("file", jsonBlob, fileName);

    try {
      const response = await fetch(`${serverAddress}/api/backup`, {
        method: "POST",
        headers: {
          accessCode: accessStore.accessCode,
          collisionString: collisionString,
        },
        body: formData, //TODO - 这里换成要上传的对话文件
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "备份失败");
      }
      const data = await response.json();
      setMessage(data.message || "云备份成功！");

      // 执行一次云导入更新列表
      await handleImport();
    } catch (error: any) {
      console.error(error);
      setMessage(error.message || "云备份失败，请重试。");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (serverAddress.trim() === "") {
      setMessage("文件服务器地址不能为空。");
      return;
    }
    try {
      const parsedUrl = new URL(serverAddress);
      collisionString = parsedUrl.hostname;
    } catch (error) {
      setMessage("无效的文件服务器地址。");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${serverAddress}/api/getlist`, {
        headers: {
          accessCode: accessStore.accessCode,
          collisionString: collisionString,
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "获取文件列表失败");
      }
      const data: string[] = await response.json();
      setFiles(data);
      setMessage("文件列表加载成功！");
    } catch (error: any) {
      console.error(error);
      setMessage(error.message || "获取文件列表失败，请重试。");
    } finally {
      setLoading(false);
    }
  };

  const handleRename = (fileName: string) => {
    setRenamingFileNames((prev) => new Set(prev).add(fileName));
    setRenameInputs((prev) => ({ ...prev, [fileName]: fileName }));
  };

  const handleRenameChange = (fileName: string, newName: string) => {
    setRenameInputs((prev) => ({ ...prev, [fileName]: newName }));
  };

  const handleRenameSubmit = async (fileName: string) => {
    const newName = renameInputs[fileName]?.trim();
    if (!newName) {
      setMessage("文件名不能为空。");
      return;
    }
    setRenamingFileNames((prev) => {
      const newSet = new Set(prev);
      newSet.delete(fileName);
      return newSet;
    });
    if (serverAddress.trim() === "") {
      setMessage("文件服务器地址不能为空。");
      return;
    }
    try {
      const parsedUrl = new URL(serverAddress);
      collisionString = parsedUrl.hostname;
    } catch (error) {
      setMessage("无效的文件服务器地址。");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${serverAddress}/api/rename`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          accessCode: accessStore.accessCode,
          collisionString: collisionString,
        },
        body: JSON.stringify({ oldName: fileName, newName }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "重命名失败");
      }
      const data = await response.json();
      setFiles((prevFiles) =>
        prevFiles.map((file) => (file === fileName ? newName : file)),
      );
      setMessage(data.message || "文件重命名成功！");
    } catch (error: any) {
      console.error(error);
      setMessage(error.message || "文件重命名失败，请重试。");
    } finally {
      setLoading(false);
    }
  };

  const handleFileImport = async (fileName: string) => {
    if (serverAddress.trim() === "") {
      setMessage("文件服务器地址不能为空。");
      return;
    }
    try {
      const parsedUrl = new URL(serverAddress);
      collisionString = parsedUrl.hostname;
    } catch (error) {
      setMessage("无效的文件服务器地址。");
      return;
    }
    setImportingFileNames((prev) => new Set(prev).add(fileName));
    setMessage(null);
    try {
      const response = await fetch(
        `${serverAddress}/api/import?filename=${fileName}`,
        {
          method: "GET",
          headers: {
            accessCode: accessStore.accessCode,
            collisionString: collisionString,
          },
        },
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "文件导入失败");
      }
      const data = await response.json();
      const localState = getLocalAppState(); // 获取本地状态

      // 合并远程和本地状态
      mergeAppState(localState, data);
      setLocalAppState(localState); // 更新本地状态

      setMessage(data.message || `文件 ${fileName} 导入成功！`);
    } catch (error: any) {
      console.error(error);
      setMessage(error.message || `文件 ${fileName} 导入失败，请重试。`);
    } finally {
      setImportingFileNames((prev) => {
        const newSet = new Set(prev);
        newSet.delete(fileName);
        return newSet;
      });
    }
  };

  const handleFileDelete = async (fileName: string) => {
    const confirmDelete =
      window.confirm("确定要删除该文件吗？该操作不可撤回！");
    if (!confirmDelete) return;

    if (serverAddress.trim() === "") {
      setMessage("文件服务器地址不能为空。");
      return;
    }
    try {
      const parsedUrl = new URL(serverAddress);
      collisionString = parsedUrl.hostname;
    } catch (error) {
      setMessage("无效的文件服务器地址。");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${serverAddress}/api/delete/${fileName}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          accessCode: accessStore.accessCode,
          collisionString: collisionString,
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "文件删除失败");
      }
      const data = await response.json();
      setFiles((prevFiles) => prevFiles.filter((file) => file !== fileName));
      setMessage(data.message || `文件 ${fileName} 删除成功！`);
    } catch (error: any) {
      console.error(error);
      setMessage(error.message || `文件 ${fileName} 删除失败，请重试。`);
    } finally {
      setLoading(false);
    }
  };
  const clearServerAddress = () => {
    setServerAddress("");
    localStorage.removeItem("serverAddress"); // 从 localStorage 删除
  };

  return (
    <div className={styles["backup-page"]}>
      <div className={styles["backup-header"]}>
        <h2 className={styles.title}>云备份管理</h2>
        <div className={styles.inputGroup}>
          <input
            type="text"
            id="serverAddress"
            value={serverAddress}
            onChange={(e) => handleServerAddressChange(e.target.value)}
            placeholder="请输入文件服务器地址"
            disabled={loading}
            className={styles.input}
          />
          <button onClick={clearServerAddress} className={styles.button}>
            清除地址
          </button>
        </div>
        <div className={styles.buttonGroup}>
          <button
            onClick={handleBackup}
            disabled={loading}
            className={styles.button}
          >
            {loading ? "备份中..." : "云备份(本地记录上传云端)"}
          </button>
          <button
            onClick={handleImport}
            disabled={loading}
            className={styles.button}
          >
            {loading ? "加载中..." : "云导入(加载云端记录)"}
          </button>
        </div>
        {message && <p className={styles.message}>{message}</p>}
      </div>

      {/* 文件列表展示，独立滑动区域 */}
      {files.length > 0 && (
        <div className={styles["file-list-container"]}>
          <h3 className={styles.subtitle}>文件列表</h3>
          <ul className={styles.list}>
            {files.map((file) => (
              <li key={file} className={styles.listItem}>
                {/* 文件名显示或编辑 */}
                <div className={styles.fileInfo}>
                  {renamingFileNames.has(file) ? (
                    <input
                      type="text"
                      value={renameInputs[file] || file}
                      onChange={(e) => handleRenameChange(file, e.target.value)}
                      className={styles.renameInput}
                    />
                  ) : (
                    <span>{file}</span>
                  )}
                </div>

                {/* 操作按钮 */}
                <div className={styles.fileActions}>
                  {renamingFileNames.has(file) ? (
                    <button
                      onClick={() => handleRenameSubmit(file)}
                      disabled={loading}
                      className={styles.actionButton}
                    >
                      确认
                    </button>
                  ) : (
                    <button
                      onClick={() => handleRename(file)}
                      disabled={loading}
                      className={styles.actionButton}
                    >
                      重命名
                    </button>
                  )}
                  <button
                    onClick={() => handleFileImport(file)}
                    disabled={importingFileNames.has(file) || loading}
                    className={styles.actionButton}
                  >
                    {importingFileNames.has(file) ? "导入中..." : "导入"}
                  </button>
                  <button
                    onClick={() => handleFileDelete(file)}
                    disabled={loading}
                    className={styles.actionButton}
                  >
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

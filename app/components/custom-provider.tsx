import React, { useState, useEffect } from "react";
import { IconButton } from "./button";
import styles from "./custom-provider.module.scss";
import { useNavigate } from "react-router-dom";
import { Path, StoreKey } from "../constant";
import { safeLocalStorage } from "../utils";
import Locale from "../locales";
import { showToast, showConfirm } from "./ui-lib";
import { useAccessStore } from "../store";
import { userCustomProvider } from "../client/api";
import {
  ProviderModal,
  providerTypeLabels,
  providerTypeDefaultUrls,
} from "./provider-modal";
// 导入图标
import PlusIcon from "../icons/add.svg";
import EditIcon from "../icons/edit.svg";
import TrashIcon from "../icons/delete.svg";
import CloseIcon from "../icons/close.svg";
import LoadingIcon from "../icons/loading.svg";
import SearchIcon from "../icons/zoom.svg";
import EnableIcon from "../icons/light.svg";
import DisableIcon from "../icons/lightning.svg";
import DownloadIcon from "../icons/download.svg";
import UploadIcon from "../icons/upload.svg";

function getAvailableModelsTooltip(provider: userCustomProvider) {
  if (!provider.models || provider.models.length === 0)
    return "No available models";
  const availableModels = provider.models.filter((m) => m.available);
  if (availableModels.length === 0) return "No available models";
  return availableModels.map((m) => m.name).join("\n");
}

export function CustomProvider() {
  const [providers, setProviders] = useState<userCustomProvider[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentProvider, setCurrentProvider] =
    useState<userCustomProvider | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // 在 CustomProvider 函数中添加状态
  const [providerBalances, setProviderBalances] = useState<
    Record<string, string>
  >({});
  // 已有的 isSumming 状态可以改为记录每个提供商的加载状态
  const [loadingBalances, setLoadingBalances] = useState<
    Record<string, boolean>
  >({});

  const navigate = useNavigate();

  // 从本地存储加载数据
  useEffect(() => {
    const loadProviders = async () => {
      setIsLoading(true);
      // 从 localStorage 获取数据
      const storedProviders = safeLocalStorage().getItem(
        StoreKey.CustomProvider,
      );

      if (storedProviders) {
        try {
          setProviders(JSON.parse(storedProviders));
        } catch (e) {
          console.error("Failed to parse stored providers:", e);
          setProviders([]);
        }
      } else {
        setProviders([]);
      }

      setIsLoading(false);
    };

    loadProviders();
  }, []);
  // 保存提供商到本地存储
  const saveProvidersToStorage = (updatedProviders: userCustomProvider[]) => {
    try {
      const jsonString = JSON.stringify(updatedProviders);
      safeLocalStorage().setItem(StoreKey.CustomProvider, jsonString);
    } catch (error) {
      console.error("保存到localStorage失败:", error);
    }
  };

  // 过滤提供商
  const filteredProviders = providers.filter((provider) => {
    const search = searchTerm.toLowerCase();

    const hasModelMatch = provider.models?.some((m) =>
      m.name.toLowerCase().includes(search),
    );

    return (
      provider.name.toLowerCase().includes(search) ||
      provider.type.toLowerCase().includes(search) ||
      hasModelMatch
    );
  });

  // 更新添加提供商函数
  const handleAddProvider = () => {
    setCurrentProvider(null); // 设置为 null 表示添加新提供商
    setIsModalOpen(true); // 打开模态框
  };

  // 打开编辑提供商模态框
  const handleEditProvider = (provider: userCustomProvider) => {
    setCurrentProvider(provider);
    setIsModalOpen(true);
  };

  // 删除提供商
  const handleDeleteProvider = async (id: string) => {
    const providerToDelete = providers.find((provider) => provider.id === id);
    const confirmMessage = `${Locale.CustomProvider.ConfirmDeleteProvider}\n\nName: ${providerToDelete?.name}\n\nUrl: ${providerToDelete?.baseUrl}`;
    const confirmContent = (
      <div style={{ lineHeight: "1.4" }}>
        <div style={{ marginBottom: "8px" }}>
          {Locale.CustomProvider.ConfirmDeleteProvider}
        </div>
        <div
          style={{
            padding: "8px 10px",
            borderLeft: "3px solid #f87171",
            backgroundColor: "#fef2f2",
            margin: "8px 0",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              marginBottom: "2px",
            }}
          >
            <span style={{ fontWeight: "500", minWidth: "60px" }}>Name: </span>
            <span style={{ color: "#ef4444", fontWeight: "600" }}>
              {providerToDelete?.name}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <span style={{ fontWeight: "500", minWidth: "60px" }}>URL: </span>
            <span
              style={{
                color: "#3b82f6",
                fontWeight: "500",
                marginLeft: "4px",
                wordBreak: "break-all",
              }}
            >
              {providerToDelete?.baseUrl}
            </span>
          </div>
        </div>
        <p
          style={{
            marginTop: "12px",
            fontSize: "14px",
            color: "#6b7280",
          }}
        >
          此操作不可撤销，请确认是否继续？
        </p>
      </div>
    );
    if (await showConfirm(confirmContent)) {
      const updatedProviders = providers.filter(
        (provider) => provider.id !== id,
      );
      setProviders(updatedProviders);
      // 保存到本地存储
      saveProvidersToStorage(updatedProviders);
    }
  };

  // 更新保存提供商函数
  const handleSaveProvider = (provider: userCustomProvider) => {
    // 检查是否有重名
    const isDuplicate = providers.some(
      (p) => p.name === provider.name && p.id !== provider.id,
    );
    if (isDuplicate) {
      // 供应商重名: 自动添加后缀
      let newName = provider.name;
      let counter = 1;
      while (
        providers.some((p) => p.name === newName && p.id !== provider.id)
      ) {
        newName = `${provider.name}-${counter}`;
        counter++;
      }
      provider.name = newName;
    }

    let updatedProviders;

    if (currentProvider) {
      // 更新现有提供商
      updatedProviders = providers.map((p) =>
        p.id === provider.id ? provider : p,
      );
    } else {
      // 添加新提供商
      const newProvider = {
        ...provider,
        id: provider.id || `provider-${Date.now()}`, // 确保有ID
      };
      updatedProviders = [...providers, newProvider];
    }

    // 更新状态
    setProviders(updatedProviders);

    // 保存到本地存储
    try {
      saveProvidersToStorage(updatedProviders);
    } catch (error) {
      console.error("保存到本地存储失败:", error);
    }

    // // 关闭模态框
    // setIsModalOpen(false);

    // 显示成功消息
    showToast(
      currentProvider
        ? Locale.CustomProvider.ProviderUpdated
        : Locale.CustomProvider.ProviderAdded,
    );
  };
  // 移除禁用渠道函数
  const handleRemoveDisabledProviders = async () => {
    const disabledProviders = providers.filter((p) => p.status === "inactive");

    if (disabledProviders.length === 0) {
      showToast("没有发现禁用的供应商");
      return;
    }

    // 创建确认对话框内容
    const confirmContent = (
      <div style={{ lineHeight: "1.4" }}>
        <div style={{ marginBottom: "8px" }}>
          确定要移除所有禁用的供应商吗？
        </div>

        <div
          style={{
            padding: "8px 10px",
            borderLeft: "3px solid #f87171",
            backgroundColor: "#fef2f2",
            margin: "8px 0",
          }}
        >
          <div
            style={{
              fontWeight: "600",
              color: "#b91c1c",
              marginBottom: "4px",
            }}
          >
            将移除以下供应商:
          </div>
          <div
            style={{
              maxHeight: "150px",
              overflowY: "auto",
              paddingRight: "5px",
            }}
          >
            {disabledProviders.map((provider, index) => (
              <div
                key={provider.id}
                style={{
                  marginBottom: "4px",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontWeight: "500" }}>
                  {index + 1}. {provider.name}
                </span>
                <span
                  style={{
                    color: "#6b7280",
                    fontSize: "13px",
                    marginLeft: "8px",
                  }}
                >
                  {provider.type}
                </span>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: "8px",
              color: "#b91c1c",
              fontWeight: "500",
              fontSize: "14px",
            }}
          >
            共 {disabledProviders.length} 个供应商
          </div>
        </div>

        <div
          style={{
            fontSize: "14px",
            color: "#6b7280",
            marginTop: "8px",
          }}
        >
          此操作不可撤销，请确认是否继续？
        </div>
      </div>
    );

    // 显示确认对话框
    if (await showConfirm(confirmContent)) {
      // 过滤掉禁用的供应商
      const updatedProviders = providers.filter((p) => p.status !== "inactive");
      setProviders(updatedProviders);
      saveProvidersToStorage(updatedProviders);

      showToast(`已成功移除 ${disabledProviders.length} 个禁用供应商`);
    }
  };
  // 移除搜索结果中的供应商函数
  const handleRemoveSearchedProviders = async () => {
    // 如果没有搜索关键词，提示用户
    if (!searchTerm.trim()) {
      showToast("请先输入搜索关键词");
      return;
    }

    // 获取符合搜索条件的供应商
    const searchedProviders = filteredProviders;

    if (searchedProviders.length === 0) {
      showToast("没有找到匹配的供应商");
      return;
    }

    // 创建确认对话框内容
    const confirmContent = (
      <div style={{ lineHeight: "1.4" }}>
        <div style={{ marginBottom: "8px" }}>
          确定要移除所有搜索结果中的供应商吗？
        </div>

        <div
          style={{
            padding: "8px 10px",
            borderLeft: "3px solid #f87171",
            backgroundColor: "#fef2f2",
            margin: "8px 0",
          }}
        >
          <div
            style={{
              fontWeight: "600",
              color: "#b91c1c",
              marginBottom: "4px",
            }}
          >
            搜索关键词: <span style={{ color: "#3b82f6" }}>{searchTerm}</span>
          </div>
          <div
            style={{
              fontWeight: "600",
              color: "#b91c1c",
              marginBottom: "4px",
            }}
          >
            将移除以下供应商:
          </div>
          <div
            style={{
              maxHeight: "150px",
              overflowY: "auto",
              paddingRight: "5px",
            }}
          >
            {searchedProviders.map((provider, index) => (
              <div
                key={provider.id}
                style={{
                  marginBottom: "4px",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontWeight: "500" }}>
                  {index + 1}. {provider.name}
                </span>
                <span
                  style={{
                    color: "#6b7280",
                    fontSize: "13px",
                    marginLeft: "8px",
                  }}
                >
                  {provider.type}
                </span>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: "8px",
              color: "#b91c1c",
              fontWeight: "500",
              fontSize: "14px",
            }}
          >
            共 {searchedProviders.length} 个供应商
          </div>
        </div>

        <div
          style={{
            fontSize: "14px",
            color: "#6b7280",
            marginTop: "8px",
          }}
        >
          此操作不可撤销，请确认是否继续？
        </div>
      </div>
    );

    // 显示确认对话框
    if (await showConfirm(confirmContent)) {
      // 获取要保留的供应商ID列表
      const searchedProviderIds = new Set(searchedProviders.map((p) => p.id));

      // 过滤掉搜索结果中的供应商
      const updatedProviders = providers.filter(
        (p) => !searchedProviderIds.has(p.id),
      );
      setProviders(updatedProviders);
      saveProvidersToStorage(updatedProviders);

      // 清空搜索框
      setSearchTerm("");

      showToast(`已成功移除 ${searchedProviders.length} 个供应商`);
    }
  };
  // 批量启用供应商函数
  const handleBatchEnableProviders = async () => {
    // 获取符合搜索条件的供应商
    const searchedProviders = filteredProviders;

    if (searchedProviders.length === 0) {
      showToast("没有禁用的供应商");
      return;
    }

    const confirmContent = (
      <div style={{ lineHeight: "1.4" }}>
        <div style={{ marginBottom: "8px" }}>确定要启用选中的供应商吗？</div>

        <div
          style={{
            padding: "8px 10px",
            borderLeft: "3px solid #34d399",
            backgroundColor: "#ecfdf5",
            margin: "8px 0",
          }}
        >
          <div
            style={{
              fontWeight: "600",
              color: "#059669",
              marginBottom: "4px",
            }}
          >
            将启用以下供应商:
          </div>
          <div
            style={{
              maxHeight: "150px",
              overflowY: "auto",
              paddingRight: "5px",
            }}
          >
            {searchedProviders.map((provider, index) => (
              <div
                key={provider.id}
                style={{
                  marginBottom: "4px",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontWeight: "500" }}>
                  {index + 1}. {provider.name}
                </span>
                <span
                  style={{
                    color: "#6b7280",
                    fontSize: "13px",
                    marginLeft: "8px",
                  }}
                >
                  {provider.type}
                </span>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: "8px",
              color: "#059669",
              fontWeight: "500",
              fontSize: "14px",
            }}
          >
            共 {searchedProviders.length} 个供应商
          </div>
        </div>

        <div
          style={{
            fontSize: "14px",
            color: "#6b7280",
            marginTop: "8px",
          }}
        >
          确认是否继续？
        </div>
      </div>
    );

    if (await showConfirm(confirmContent)) {
      const updatedProviders = providers.map((p) =>
        p.status === "inactive" ? { ...p, status: "active" as const } : p,
      );
      setProviders(updatedProviders);
      saveProvidersToStorage(updatedProviders);

      showToast(`已成功启用 ${searchedProviders.length} 个供应商`);
    }
  };

  // 批量禁用供应商函数
  const handleBatchDisableProviders = async () => {
    // 获取符合搜索条件的供应商
    const searchedProviders = filteredProviders;

    if (searchedProviders.length === 0) {
      showToast("没有启用的供应商");
      return;
    }

    const confirmContent = (
      <div style={{ lineHeight: "1.4" }}>
        <div style={{ marginBottom: "8px" }}>确定要禁用选中的供应商吗？</div>

        <div
          style={{
            padding: "8px 10px",
            borderLeft: "3px solid #f87171",
            backgroundColor: "#fef2f2",
            margin: "8px 0",
          }}
        >
          <div
            style={{
              fontWeight: "600",
              color: "#b91c1c",
              marginBottom: "4px",
            }}
          >
            将禁用以下供应商:
          </div>
          <div
            style={{
              maxHeight: "150px",
              overflowY: "auto",
              paddingRight: "5px",
            }}
          >
            {searchedProviders.map((provider, index) => (
              <div
                key={provider.id}
                style={{
                  marginBottom: "4px",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontWeight: "500" }}>
                  {index + 1}. {provider.name}
                </span>
                <span
                  style={{
                    color: "#6b7280",
                    fontSize: "13px",
                    marginLeft: "8px",
                  }}
                >
                  {provider.type}
                </span>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: "8px",
              color: "#b91c1c",
              fontWeight: "500",
              fontSize: "14px",
            }}
          >
            共 {searchedProviders.length} 个供应商
          </div>
        </div>

        <div
          style={{
            fontSize: "14px",
            color: "#6b7280",
            marginTop: "8px",
          }}
        >
          确认是否继续？
        </div>
      </div>
    );

    if (await showConfirm(confirmContent)) {
      const updatedProviders = providers.map((p) =>
        p.status === "active" ? { ...p, status: "inactive" as const } : p,
      );
      setProviders(updatedProviders);
      saveProvidersToStorage(updatedProviders);

      showToast(`已成功禁用 ${searchedProviders.length} 个供应商`);
    }
  };
  // 获取模型数量展示文本
  const getModelCountText = (provider: userCustomProvider) => {
    const count = provider.models?.filter((m) => m.available).length || 0;
    return `${count} 个模型`;
  };
  const getKeyCountText = (provider: userCustomProvider) => {
    const count = provider.apiKey.split(",").filter((k) => k.trim()).length;
    return `key: ${count}`;
  };

  // 新增的统计余额函数
  const handleSumBalances = async (provider: userCustomProvider) => {
    const accessStore = useAccessStore.getState();
    const { id, apiKey, baseUrl, type } = provider;

    if (baseUrl.endsWith("#")) {
      showToast("当前渠道不支持余额查询");
      return;
    }
    const keys = apiKey
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    if (keys.length === 0) {
      showToast("没有可用的 API Key 来统计余额。");
      return;
    }

    if (providerBalances[id]) {
      setProviderBalances((prev) => {
        const newBalances = { ...prev };
        delete newBalances[id];
        return newBalances;
      });
      return;
    }

    let totalBalance = 0;
    let currency = "";

    // 设置当前提供商的加载状态
    setLoadingBalances((prev) => ({ ...prev, [id]: true }));

    try {
      // 使用 Promise.all 来并行获取所有 key 的余额
      const balancePromises = keys.map(async (key) => {
        try {
          let result = null;
          if (type === "openrouter") {
            result = await accessStore.checkOpenRouterBalance(key, baseUrl);
          } else if (type === "siliconflow") {
            result = await accessStore.checkSiliconFlowBalance(key, baseUrl);
          } else if (type === "deepseek") {
            result = await accessStore.checkDeepSeekBalance(key, baseUrl);
          } else if (
            type === "openai" &&
            baseUrl !== providerTypeDefaultUrls[type]
          ) {
            result = await accessStore.checkCustomOpenaiBalance(key, baseUrl);
          }

          if (result && result.isValid && result.totalBalance) {
            if (!currency && result.currency) {
              currency = result.currency;
            }
            return result.totalBalance;
          } else {
            throw new Error(result?.error || "查询失败或不支持查询");
          }
        } catch (error) {
          console.error(`API Key ${key} 余额查询失败:`, error);
          return 0;
        }
      });

      const balances = await Promise.all(balancePromises);
      totalBalance = balances.reduce((acc, curr) => acc + curr, 0);

      // 更新余额状态
      setProviderBalances((prev) => ({
        ...prev,
        [id]: `${currency} ${totalBalance.toFixed(2)}`,
      }));

      showToast(`总余额: ${currency} ${totalBalance.toFixed(2)}`);
    } catch (error) {
      console.error("统计余额时发生错误:", error);
      showToast("统计余额失败，请稍后再试。");
    } finally {
      setLoadingBalances((prev) => ({ ...prev, [id]: false }));
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div>
            <h1>{Locale.CustomProvider.Title}</h1>
            <div className={styles.providerCount}>
              {Locale.CustomProvider.Count.replace(
                "{count}",
                providers.length.toString(),
              )}
            </div>
          </div>
        </div>
        <div className={styles.actions}>
          <IconButton
            icon={<PlusIcon />}
            text={Locale.CustomProvider.AddButton}
            bordered
            onClick={handleAddProvider}
          />
          <IconButton
            icon={<CloseIcon />}
            bordered
            onClick={() => navigate(Path.Home)}
            title={Locale.CustomProvider.Return}
          />
        </div>
      </div>
      <div className={styles["provider-filter"]}>
        <input
          type="text"
          placeholder={Locale.CustomProvider.SearchPlaceholder}
          className={styles["search-bar"]}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div className={styles["actions"]}>
          <IconButton
            icon={<TrashIcon />}
            text="移除禁用"
            bordered
            onClick={handleRemoveDisabledProviders}
            title="移除所有禁用的供应商"
          />

          <IconButton
            icon={<TrashIcon />}
            text="移除选中"
            bordered
            onClick={handleRemoveSearchedProviders}
            title="移除搜索结果中的所有供应商"
            disabled={!searchTerm.trim()}
          />
          <IconButton
            icon={<EnableIcon />} // 需要一个启用图标
            text="批量启用"
            bordered
            onClick={handleBatchEnableProviders}
            title="批量启用供应商"
          />
          <IconButton
            icon={<DisableIcon />} // 需要一个禁用图标
            text="批量禁用"
            bordered
            onClick={handleBatchDisableProviders}
            title="批量禁用供应商"
          />
          {searchTerm && (
            <IconButton
              icon={<CloseIcon />}
              onClick={() => setSearchTerm("")}
              bordered
            />
          )}
        </div>
      </div>
      <div className={`${styles.providerList} ${styles.fadeIn}`}>
        {isLoading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <div>{Locale.CustomProvider.Loading}</div>
          </div>
        ) : filteredProviders.length > 0 ? (
          filteredProviders.map((provider) => (
            <div
              key={provider.id}
              className={styles.providerItem}
              title={getAvailableModelsTooltip(provider)}
            >
              <div className={styles.providerInfo}>
                <div>
                  <div className={styles.providerName}>{provider.name}</div>
                  <div className={styles.providerMeta}>
                    <span
                      className={styles.metaItem}
                      style={{ backgroundColor: "#DAF1F4", color: "#004D5B" }}
                    >
                      {providerTypeLabels[provider.type]}
                    </span>
                    <span
                      className={styles.metaItem}
                      style={{ backgroundColor: "#D9E8FE", color: "#003D8F" }}
                    >
                      {getModelCountText(provider)}
                    </span>
                    <span
                      className={`${styles.metaItem} ${styles.keyCountItem}`}
                      style={{ backgroundColor: "#FFEDD5", color: "#C2410C" }}
                    >
                      {getKeyCountText(provider)}
                    </span>
                    {provider.status && (
                      <span
                        className={styles.metaItem}
                        style={{
                          backgroundColor:
                            provider.status === "active"
                              ? "#d1fae5"
                              : "#fee2e2",
                          color:
                            provider.status === "active"
                              ? "#059669"
                              : "#dc2626",
                        }}
                      >
                        {provider.status === "active"
                          ? Locale.CustomProvider.Status.Enabled
                          : Locale.CustomProvider.Status.Disabled}
                      </span>
                    )}
                    {provider.baseUrl && (
                      <span
                        className={styles.metaItem}
                        style={{ backgroundColor: "#F0E6FF", color: "#5B21B6" }}
                      >
                        {provider.baseUrl}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className={styles.providerActions}>
                <div className={styles.statusToggleContainer}>
                  <div
                    className={`${styles.toggleSwitch} ${
                      provider.status === "active" ? styles.active : ""
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      const newStatus: "active" | "inactive" =
                        provider.status === "active" ? "inactive" : "active";
                      const updatedProviders = providers.map((p) =>
                        p.id === provider.id ? { ...p, status: newStatus } : p,
                      );
                      setProviders(updatedProviders);
                      saveProvidersToStorage(updatedProviders);
                      showToast(
                        newStatus === "active"
                          ? Locale.CustomProvider.ProviderEnabled
                          : Locale.CustomProvider.ProviderDisabled,
                      );
                    }}
                    title={
                      provider.status === "active"
                        ? Locale.CustomProvider.ToggleDisable
                        : Locale.CustomProvider.ToggleEnable
                    }
                  >
                    <div className={styles.toggleSlider}></div>
                  </div>
                </div>
                <IconButton
                  icon={
                    loadingBalances[provider.id] ? (
                      <LoadingIcon />
                    ) : (
                      <SearchIcon />
                    )
                  }
                  text={providerBalances[provider.id] || "查询余额"}
                  onClick={() => handleSumBalances(provider)}
                  title={
                    providerBalances[provider.id]
                      ? "点击清除"
                      : "查询所有密钥余额"
                  }
                  bordered
                  className={
                    providerBalances[provider.id] ? styles.balanceButton : ""
                  }
                  disabled={loadingBalances[provider.id]}
                />
                <IconButton
                  icon={<EditIcon />}
                  onClick={() => handleEditProvider(provider)}
                  title={Locale.CustomProvider.Edit}
                  bordered
                />
                <IconButton
                  icon={<TrashIcon />}
                  onClick={() => handleDeleteProvider(provider.id)}
                  title={Locale.CustomProvider.Delete}
                  bordered
                />
              </div>
            </div>
          ))
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyTitle}>
              {searchTerm
                ? Locale.CustomProvider.NoProviders
                : Locale.CustomProvider.EmptyTitle}
            </div>
            <div className={styles.emptyDescription}>
              {searchTerm
                ? Locale.CustomProvider.EmptySearchDescription
                : Locale.CustomProvider.EmptyDescription}
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <ProviderModal
          provider={currentProvider}
          onSave={handleSaveProvider}
          onClose={() => setIsModalOpen(false)}
          providers={providers}
          setProviders={setProviders}
          saveProvidersToStorage={saveProvidersToStorage}
        />
      )}
    </div>
  );
}

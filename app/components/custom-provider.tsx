import React, { useState, useEffect } from "react";
import { IconButton } from "./button";
import styles from "./custom-provider.module.scss";
import { useNavigate } from "react-router-dom";
import { Path, StoreKey } from "../constant";
import { safeLocalStorage } from "../utils";
import Locale from "../locales";
import {
  List,
  ListItem,
  Modal,
  PasswordInput,
  Select,
  showToast,
} from "./ui-lib";
import { useAccessStore } from "../store";
import { Model, userCustomProvider } from "../client/api";
// 导入图标
import PlusIcon from "../icons/add.svg";
import EditIcon from "../icons/edit.svg";
import TrashIcon from "../icons/delete.svg";
import CloseIcon from "../icons/close.svg";
import LoadingIcon from "../icons/loading.svg";

// 提供商编辑模态框
function ProviderModal(props: {
  provider: userCustomProvider | null;
  onSave: (provider: userCustomProvider) => void;
  onClose: () => void;
  providers: userCustomProvider[]; // 添加providers参数
  setProviders: React.Dispatch<React.SetStateAction<userCustomProvider[]>>; // 添加setProviders
  saveProvidersToStorage: (providers: userCustomProvider[]) => void; // 添加保存函数
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<
    Omit<userCustomProvider, "id"> & { id?: string }
  >({
    name: "",
    apiKey: "",
    baseUrl: "",
    type: "openai",
    models: [],
    status: "inactive",
  });

  // 模型相关状态
  const [models, setModels] = useState<Model[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelSearchTerm, setModelSearchTerm] = useState("");

  // 当编辑现有提供商时，加载数据
  useEffect(() => {
    if (props.provider) {
      setFormData({
        id: props.provider.id,
        name: props.provider.name,
        apiKey: props.provider.apiKey,
        baseUrl: props.provider.baseUrl,
        type: props.provider.type,
        models: props.provider.models || [],
        status: props.provider.status || "active",
      });

      if (props.provider.models) {
        setModels(props.provider.models);
      }
    } else {
      // 添加新提供商，初始化默认值
      setFormData({
        name: "",
        apiKey: "",
        baseUrl: "",
        type: "openai",
        models: [],
        status: "active",
      });
      setModels([]);
    }
  }, [props.provider]);

  // 添加切换供应商状态的函数
  const toggleProviderStatus = (id: string) => {
    if (!id) return; // 如果是新建的，还没有ID，则不执行

    const updatedProviders = props.providers.map((provider) =>
      provider.id === id
        ? {
            ...provider,
            status:
              provider.status === "active"
                ? ("inactive" as const)
                : ("active" as const),
          }
        : provider,
    );

    props.setProviders(updatedProviders);
    props.saveProvidersToStorage(updatedProviders);

    // 同时更新表单数据
    setFormData((prev) => ({
      ...prev,
      status: prev.status === "active" ? "inactive" : "active",
    }));
  };

  const handleChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const saveFirstStep = () => {
    if (!formData.name.trim()) {
      showToast(Locale.CustomProvider.ApiNameRequired);
      return;
    }
    if (!formData.baseUrl.trim()) {
      showToast(Locale.CustomProvider.ApiUrlRequired);
      return;
    }
    if (!formData.apiKey.trim()) {
      showToast(Locale.CustomProvider.ApiKeyRequired);
      return;
    }
    // 保留当前存在的models数据
    const saveData: userCustomProvider = {
      ...formData,
      id: formData.id || `provider-${Date.now()}`, // 确保有ID
      models: props.provider?.models || [], // 保留现有模型
      status: (formData.status as "active" | "inactive") || "active",
    };
    props.onSave(saveData);
  };

  const handleSubmit = () => {
    // 准备保存的数据，包括选中的模型
    const selectedModels = models.filter((model) => model.available);

    const saveData: userCustomProvider = {
      ...formData,
      id: formData.id || `provider-${Date.now()}`, // 确保有ID
      models: selectedModels,
      status: (formData.status as "active" | "inactive") || "active",
    };

    props.onSave(saveData);
  };

  const nextStep = () => {
    if (currentStep === 1) {
      if (!formData.name.trim()) {
        showToast(Locale.CustomProvider.ApiNameRequired);
        return;
      }
      if (!formData.baseUrl.trim()) {
        showToast(Locale.CustomProvider.ApiUrlRequired);
        return;
      }
      if (!formData.apiKey.trim()) {
        showToast(Locale.CustomProvider.ApiKeyRequired);
        return;
      }
    }
    if (currentStep < 2) {
      setCurrentStep(currentStep + 1);
      fetchModels();
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // 拉取模型列表
  const fetchModels = async () => {
    if (!formData.apiKey || !formData.baseUrl) {
      showToast(Locale.CustomProvider.ApiConfigRequired);
      return;
    }

    setIsLoadingModels(true);

    try {
      const accessStore = useAccessStore.getState();
      // 调用真实的API获取模型列表
      const modelsStr = await accessStore.fetchAvailableModels(
        formData.baseUrl,
        formData.apiKey,
      );

      // 解析API返回的模型数据
      let fetchedModels: Model[] = [];
      if (modelsStr) {
        const modelNames = modelsStr
          .replace("-all,", "")
          .split(",")
          .filter(Boolean);

        fetchedModels = modelNames.map((modelName) => {
          const [id, provider] = modelName.split("@");
          return {
            name: id,
            available: false,
            isDefault: false,
            provider: {
              id: provider || id,
              providerName: provider || id,
              providerType: provider || id,
            },
          };
        });
      }

      // 优先使用API返回的数据，如果为空则尝试本地存储
      if (fetchedModels.length === 0 && formData.models?.length) {
        fetchedModels = formData.models; // 使用本地存储的模型数据
      }

      // 保留已选状态
      const selectedModelNames = (formData.models || [])
        .filter((m) => m.available)
        .map((m) => m.name);

      setModels(
        fetchedModels.map((model) => ({
          ...model,
          available: selectedModelNames.includes(model.name),
        })),
      );
    } catch (error) {
      console.error("获取模型列表失败:", error);
      if (formData.models?.length) {
        setModels(formData.models);
      } else {
        showToast(`获取模型列表失败: ${error}`);
      }
    } finally {
      setIsLoadingModels(false);
    }
  };
  // 添加模型
  const AddModels = async () => {
    const searchModel = modelSearchTerm.trim();
    if (!searchModel) {
      showToast(Locale.CustomProvider.ModelNameRequired);
      return;
    }

    // 检查是否已存在同名模型
    if (models.some((m) => m.name === searchModel)) {
      showToast(Locale.CustomProvider.ModelExists);
      return;
    }

    // 支持逗号和换行符分割多个模型名称
    const modelNames = searchModel
      .split(/[,，\n]/)
      .map((name) => name.trim())
      .filter(Boolean);

    // 处理每个模型名称
    const newModels: Model[] = [];
    const existingNames = new Set(models.map((m) => m.name));

    for (const name of modelNames) {
      if (existingNames.has(name)) {
        continue; // 跳过已存在的模型
      }

      // 创建新模型
      newModels.push({
        name: name,
        available: true,
        isDefault: false,
        provider: {
          id: name,
          providerName: name,
          providerType: name,
        },
      });

      existingNames.add(name);
    }
    if (newModels.length > 0) {
      // 更新模型列表并清空搜索
      setModels([...models, ...newModels]);
      setModelSearchTerm("");
    } else if (modelNames.length > 0) {
      showToast(Locale.CustomProvider.ModelExists);
    }
  };

  // 添加键盘事件处理
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      AddModels();
    }
  };

  // 切换模型选中状态
  const toggleModelSelection = (modelName: string) => {
    setModels(
      models.map((model) =>
        model.name === modelName
          ? {
              ...model,
              available:
                model.available === undefined ? true : !model.available,
            }
          : model,
      ),
    );
  };

  // 过滤模型列表
  const filteredModels = modelSearchTerm
    ? models.filter((model) =>
        model.name.toLowerCase().includes(modelSearchTerm.toLowerCase()),
      )
    : models;

  return (
    <div className="modal-mask">
      <Modal
        title={
          props.provider
            ? Locale.CustomProvider.Edit
            : Locale.CustomProvider.AddProvider
        }
        onClose={props.onClose}
        actions={[
          currentStep > 1 && (
            <IconButton
              key="prev"
              text={Locale.CustomProvider.Previous}
              onClick={prevStep}
              bordered
            />
          ),
          currentStep < 2 ? (
            <IconButton
              key="next"
              text={Locale.CustomProvider.Next}
              onClick={nextStep}
              bordered
            />
          ) : null,
          <IconButton
            key="save"
            text={
              props.provider
                ? Locale.CustomProvider.SaveChanges
                : Locale.CustomProvider.AddProvider
            }
            type="primary"
            onClick={handleSubmit}
          />,
        ]}
      >
        <div className={styles.stepsContainer}>
          <div className={styles.steps}>
            <div
              className={`${styles.stepItem} ${
                currentStep === 1 ? styles.active : ""
              }`}
              onClick={() => setCurrentStep(1)}
            >
              <span className={styles.stepNumber}>1</span>
              <span className={styles.stepText}>
                {Locale.CustomProvider.BasicInfo}
              </span>
            </div>

            <div
              className={`${styles.stepItem} ${
                currentStep === 2 ? styles.active : ""
              } ${currentStep < 2 ? styles.disabled : ""}`}
              onClick={() => currentStep >= 2 && setCurrentStep(2)}
            >
              <span className={styles.stepNumber}>2</span>
              <span className={styles.stepText}>
                {Locale.CustomProvider.ModelConfig}
              </span>
            </div>
          </div>
        </div>

        {currentStep === 1 && (
          <List>
            <>
              <ListItem
                title={Locale.CustomProvider.Type}
                subTitle={Locale.CustomProvider.TypeSubtitle}
              >
                <Select
                  value={formData.type}
                  onChange={(e) => handleChange("type", e.target.value)}
                >
                  <option value="openai">OpenAI</option>
                  {/* <option value="azure">Azure OpenAI</option>
                  <option value="anthropic">Anthropic Claude</option>
                  <option value="custom">{Locale.CustomProvider.CustomAPI}</option> */}
                </Select>
              </ListItem>
              <ListItem
                title={Locale.CustomProvider.Name}
                subTitle={Locale.CustomProvider.NameSubtitle}
              >
                <input
                  style={{ width: "300px" }}
                  type="text"
                  value={formData.name}
                  placeholder={Locale.CustomProvider.NamePlaceholder}
                  onChange={(e) => handleChange("name", e.currentTarget.value)}
                  required
                />
              </ListItem>
              <ListItem
                title={Locale.CustomProvider.CustomAPIService}
                subTitle={Locale.CustomProvider.ApiUrlSubtitle}
              >
                <input
                  style={{ width: "300px" }}
                  type="text"
                  value={formData.baseUrl}
                  placeholder="https://api.openai.com"
                  onChange={(e) =>
                    handleChange("baseUrl", e.currentTarget.value)
                  }
                  required
                />
              </ListItem>

              <ListItem
                title="API Key"
                subTitle={Locale.CustomProvider.ApiKeySubtitle}
              >
                <PasswordInput
                  style={{ width: "340px" }}
                  value={formData.apiKey}
                  type="text"
                  placeholder={Locale.CustomProvider.ApiKeyPlaceholder}
                  onChange={(e) =>
                    handleChange("apiKey", e.currentTarget.value)
                  }
                  required
                />
              </ListItem>
            </>
          </List>
        )}
        {currentStep === 2 && (
          <div className={styles.modelPullContainer}>
            {/* 搜索和操作区域 */}
            <div className={styles.modelFilter}>
              <input
                type="text"
                value={modelSearchTerm}
                placeholder={Locale.CustomProvider.SearchModel}
                className={styles.searchBar}
                onChange={(e) => setModelSearchTerm(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <div className={styles.actions}>
                <IconButton
                  text={Locale.Select.All}
                  bordered
                  onClick={() => {
                    if (modelSearchTerm) {
                      // 有搜索关键词时只选择筛选后的模型
                      setModels(
                        models.map((model) => ({
                          ...model,
                          available: filteredModels.some(
                            (m) => m.name === model.name,
                          ),
                        })),
                      );
                    } else {
                      // 没有搜索关键词时选择所有模型
                      setModels(
                        models.map((model) => ({ ...model, available: true })),
                      );
                    }
                  }}
                />
                <IconButton
                  text={Locale.Select.Clear}
                  bordered
                  onClick={() => {
                    if (modelSearchTerm) {
                      // 有搜索关键词时只清除筛选后的模型的选中状态
                      const filteredModelNames = new Set(
                        filteredModels.map((m) => m.name),
                      );
                      setModels(
                        models.map((model) => ({
                          ...model,
                          available:
                            model.available &&
                            !filteredModelNames.has(model.name),
                        })),
                      );
                      setModelSearchTerm("");
                    } else {
                      // 没有搜索关键词时清除所有模型的选中状态
                      setModels(
                        models.map((model) => ({ ...model, available: false })),
                      );
                    }
                  }}
                />
                <IconButton
                  text={Locale.CustomProvider.RefreshModels}
                  bordered
                  onClick={fetchModels}
                />
                <IconButton
                  text={Locale.CustomProvider.AddModels}
                  bordered
                  onClick={AddModels}
                />
              </div>
            </div>

            {/* 模型列表容器 */}
            <div className={styles.modelListContainer}>
              {/* 加载状态 */}
              {isLoadingModels ? (
                <div className={styles.loadingModels}>
                  <LoadingIcon />
                  <span>{Locale.CustomProvider.LoadingModels}</span>
                </div>
              ) : filteredModels.length > 0 ? (
                /* 模型网格 */
                <div className={styles.modelGrid}>
                  {filteredModels.map((model) => (
                    <div
                      key={model.name}
                      className={`${styles.modelItem} ${
                        model.available ? styles.selected : ""
                      }`}
                      onClick={() => toggleModelSelection(model.name)}
                    >
                      <div
                        className={styles.modelName}
                        title={model.name} // 只添加title属性
                      >
                        {model.name}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyModels}>
                  <p>{Locale.CustomProvider.NoModelsFound}</p>
                  <p>{Locale.CustomProvider.NoModelsFoundHint}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export function CustomProvider() {
  const [providers, setProviders] = useState<userCustomProvider[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentProvider, setCurrentProvider] =
    useState<userCustomProvider | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
  const filteredProviders = providers.filter(
    (provider) =>
      provider.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      provider.type.toLowerCase().includes(searchTerm.toLowerCase()),
  );

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
  const handleDeleteProvider = (id: string) => {
    if (window.confirm(Locale.CustomProvider.ConfirmDeleteProvider)) {
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

    // 关闭模态框
    setIsModalOpen(false);

    // 显示成功消息
    showToast(
      currentProvider
        ? Locale.CustomProvider.ProviderUpdated
        : Locale.CustomProvider.ProviderAdded,
    );
  };

  // 获取提供商类型标签
  const getProviderTypeLabel = (type: string) => {
    switch (type) {
      case "openai":
        return "OpenAI";
      // case 'azure': return 'Azure OpenAI';
      // case 'anthropic': return 'Anthropic';
      // case 'custom': return '自定义API';
      default:
        return type;
    }
  };

  // 获取模型数量展示文本
  const getModelCountText = (provider: userCustomProvider) => {
    const count = provider.models?.filter((m) => m.available).length || 0;
    return `${count} 个模型`;
  };

  // 在 CustomProvider 组件中添加一个新函数来格式化模型列表显示
  const formatModelList = (models?: Model[]) => {
    if (!models || models.length === 0) {
      return Locale.CustomProvider.NoModels;
    }

    const selectedModels = models.filter((m) => m.available);
    if (selectedModels.length === 0) {
      return Locale.CustomProvider.NoSelectedModels;
    }

    // 创建模型列表显示
    return (
      <div className={styles.modelPopoverContent}>
        <div className={styles.modelList}>
          {selectedModels.map((model) => (
            <div key={model.name} className={styles.modelPill}>
              {model.name}
            </div>
          ))}
        </div>
      </div>
    );
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
            onClick={() => navigate(Path.Settings)}
            title={Locale.CustomProvider.Return}
          />
        </div>
      </div>
      <div className={styles.searchContainer}>
        <input
          type="text"
          placeholder={Locale.CustomProvider.SearchPlaceholder}
          className={styles.searchInput}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <span
            className={styles.clearButton}
            onClick={() => setSearchTerm("")}
          >
            <CloseIcon />
          </span>
        )}
      </div>
      <div className={`${styles.providerList} ${styles.fadeIn}`}>
        {isLoading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <div>{Locale.CustomProvider.Loading}</div>
          </div>
        ) : filteredProviders.length > 0 ? (
          filteredProviders.map((provider) => (
            <div key={provider.id} className={styles.providerItem}>
              <div className={styles.providerInfo}>
                <div>
                  <div className={styles.providerName}>{provider.name}</div>
                  <div className={styles.providerMeta}>
                    <span
                      className={styles.metaItem}
                      style={{ backgroundColor: "#DAF1F4", color: "#004D5B" }}
                    >
                      {getProviderTypeLabel(provider.type)}
                    </span>
                    <span
                      className={styles.metaItem}
                      style={{ backgroundColor: "#D9E8FE", color: "#003D8F" }}
                    >
                      {getModelCountText(provider)}
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

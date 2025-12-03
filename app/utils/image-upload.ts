import { useAccessStore } from "@/app/store";

export interface ImageUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

export class ImageUploadManager {
  private static instance: ImageUploadManager;

  static getInstance(): ImageUploadManager {
    if (!this.instance) {
      this.instance = new ImageUploadManager();
    }
    return this.instance;
  }

  /**
   * 检测文本中是否包含base64图片
   */
  containsBase64Image(text: string): boolean {
    return /!\[.*?\]\(data:image\/[a-zA-Z]+;base64,[a-zA-Z0-9+/]+=*\)/.test(
      text,
    );
  }

  /**
   * 提取文本中的所有base64图片
   */
  extractBase64Images(text: string): Array<{
    fullMatch: string;
    altText: string;
    mimeType: string;
    base64Data: string;
  }> {
    const matches: Array<{
      fullMatch: string;
      altText: string;
      mimeType: string;
      base64Data: string;
    }> = [];

    const regex =
      /!\[(.*?)\]\(data:image\/([a-zA-Z]+);base64,([a-zA-Z0-9+/]+=*?)\)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      matches.push({
        fullMatch: match[0],
        altText: match[1],
        mimeType: `image/${match[2]}`,
        base64Data: match[3],
      });
    }

    return matches;
  }

  /**
   * 上传base64图片到图床
   */
  async uploadBase64Image(
    base64Data: string,
    mimeType: string,
  ): Promise<ImageUploadResult> {
    try {
      const accessStore = useAccessStore.getState();

      // 检查图床配置
      if (!accessStore.imgUploadApiUrl) {
        return {
          success: false,
          error: "图片上传服务未配置",
        };
      }

      // 将base64转换为文件
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });

      // 生成文件名
      const extension = mimeType.split("/")[1] || "png";
      const fileName = `image_${Date.now()}.${extension}`;
      const file = new File([blob], fileName, { type: mimeType });

      // 创建FormData
      const formData = new FormData();
      formData.append("file", file);

      // 上传到后端API
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "上传失败" }));
        return {
          success: false,
          error: errorData.error || `上传失败: ${response.status}`,
        };
      }

      const result = await response.json();

      if (result.success && result.url) {
        return {
          success: true,
          url: result.url,
        };
      } else {
        return {
          success: false,
          error: result.error || "上传失败",
        };
      }
    } catch (error) {
      console.error("[ImageUpload] 上传图片失败:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "上传过程出错",
      };
    }
  }

  /**
   * 处理文本中的base64图片，自动上传并替换为URL
   */
  async processTextWithImages(text: string): Promise<string> {
    if (!this.containsBase64Image(text)) {
      return text;
    }

    const images = this.extractBase64Images(text);
    let processedText = text;

    // 并行上传所有图片
    const uploadPromises = images.map(async (image) => {
      const result = await this.uploadBase64Image(
        image.base64Data,
        image.mimeType,
      );
      return {
        original: image.fullMatch,
        result,
      };
    });

    const uploadResults = await Promise.all(uploadPromises);

    // 替换所有图片
    for (const { original, result } of uploadResults) {
      if (result.success && result.url) {
        // 替换为markdown格式的URL
        const newImageTag = `\n![image](${result.url})`;
        processedText = processedText.replace(original, newImageTag);
      } else {
        console.warn("[ImageUpload] 图片上传失败:", result.error);
        // 保留原始base64图片
      }
    }

    return processedText;
  }
}

export const imageUploadManager = ImageUploadManager.getInstance();

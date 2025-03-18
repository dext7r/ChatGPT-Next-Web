import { CACHE_URL_PREFIX, UPLOAD_URL } from "@/app/constant";
import { RequestMessage, UploadFile } from "@/app/client/api";
import { getMessageTextContentWithoutThinkingFromContent } from "@/app/utils";

export function compressImage(file: Blob, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (readerEvent: any) => {
      const image = new Image();
      image.onload = () => {
        let canvas = document.createElement("canvas");
        let ctx = canvas.getContext("2d");
        let width = image.width;
        let height = image.height;
        let quality = 0.9;
        let dataUrl;

        do {
          canvas.width = width;
          canvas.height = height;
          ctx?.clearRect(0, 0, canvas.width, canvas.height);
          ctx?.drawImage(image, 0, 0, width, height);
          dataUrl = canvas.toDataURL("image/jpeg", quality);

          if (dataUrl.length < maxSize) break;

          if (quality > 0.5) {
            // Prioritize quality reduction
            quality -= 0.1;
          } else {
            // Then reduce the size
            width *= 0.9;
            height *= 0.9;
          }
        } while (dataUrl.length > maxSize);

        resolve(dataUrl);
      };
      image.onerror = reject;
      image.src = readerEvent.target.result;
    };
    reader.onerror = reject;

    if (file.type.includes("heic")) {
      try {
        const heic2any = require("heic2any");
        heic2any({ blob: file, toType: "image/jpeg" })
          .then((blob: Blob) => {
            reader.readAsDataURL(blob);
          })
          .catch((e: any) => {
            reject(e);
          });
      } catch (e) {
        reject(e);
      }
    }

    reader.readAsDataURL(file);
  });
}

export async function preProcessImageContent(
  message: RequestMessage,
  // content: RequestMessage["content"],
) {
  const content = message.content;
  if (typeof content === "string") {
    return message.role == "assistant"
      ? getMessageTextContentWithoutThinkingFromContent(content)
      : content;
  }
  const result = [];
  for (const part of content) {
    if (part?.type == "image_url" && part?.image_url?.url) {
      try {
        const url = await cacheImageToBase64Image(part?.image_url?.url);
        result.push({ type: part.type, image_url: { url } });
      } catch (error) {
        console.error("Error processing image URL:", error);
      }
    } else if (part?.type === "text" && part?.text) {
      const filteredText =
        message.role == "assistant"
          ? getMessageTextContentWithoutThinkingFromContent(part.text)
          : part.text;
      result.push({ type: part.type, text: filteredText });
    } else {
      result.push({ ...part });
    }
  }
  return result;
}

const imageCaches: Record<string, string> = {};
export function cacheImageToBase64Image(imageUrl: string) {
  if (imageUrl.includes(CACHE_URL_PREFIX)) {
    if (!imageCaches[imageUrl]) {
      const reader = new FileReader();
      return fetch(imageUrl, {
        method: "GET",
        mode: "cors",
        credentials: "include",
      })
        .then((res) => res.blob())
        .then(
          async (blob) =>
            (imageCaches[imageUrl] = await compressImage(blob, 256 * 1024)),
        ); // compressImage
    }
    return Promise.resolve(imageCaches[imageUrl]);
  }
  return Promise.resolve(imageUrl);
}

export function base64Image2Blob(base64Data: string, contentType: string) {
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: contentType });
}

export function uploadImage(file: Blob): Promise<string> {
  if (!window._SW_ENABLED) {
    // if serviceWorker register error, using compressImage
    return compressImage(file, 256 * 1024);
  }
  const body = new FormData();
  body.append("file", file);
  return fetch(UPLOAD_URL, {
    method: "post",
    body,
    mode: "cors",
    credentials: "include",
  })
    .then((res) => res.json())
    .then((res) => {
      console.log("res", res);
      if (res?.code == 0 && res?.data) {
        return res?.data;
      }
      throw Error(`upload Error: ${res?.msg}`);
    })
    .catch((error) => {
      console.error("Fetch error:", error);
      throw new Error("Network error or server unavailable");
    });
}

export function removeImage(imageUrl: string) {
  return fetch(imageUrl, {
    method: "DELETE",
    mode: "cors",
    credentials: "include",
  });
}

/**
 * 上传文件到远程服务器或在本地处理文件
 * @param file 要上传的文件对象
 * @returns 返回上传后的文件URL或文件内容
 */
export function uploadFileRemote(
  file: File,
): Promise<{ type: "text" | "dataUrl" | "url"; content: string }> {
  if (!window._SW_ENABLED) {
    // 先尝试以文本方式读取
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        if (event.target?.result) {
          resolve({
            type: "text",
            content: event.target.result as string,
          });
        } else {
          reject(new Error("Failed to read file as text"));
        }
      };

      reader.onerror = () => {
        console.log("Failed to read as text, falling back to DataURL");
        // 文本读取失败，回退到 DataURL 模式
        readFileAsDataURL(file)
          .then((dataUrl) => resolve({ type: "dataUrl", content: dataUrl }))
          .catch(reject);
      };

      // 尝试以文本方式读取
      reader.readAsText(file);
    });
  }

  const body = new FormData();
  body.append("file", file);

  return fetch(UPLOAD_URL, {
    method: "post",
    body,
    mode: "cors",
    credentials: "include",
  })
    .then((res) => {
      return res.json();
    })
    .then((res) => {
      console.log("File upload response:", res);
      if (res?.code == 0 && res?.data) {
        return { type: "url", content: res?.data || "" };
      }
      throw Error(`Upload Error: ${res?.msg}`);
    })
    .catch((error) => {
      console.error("File upload error:", error);
      throw new Error("Network error or server unavailable during file upload");
    });
}

/**
 * Reads a file as plain text without base64 encoding
 * @param file - The file to read
 * @returns Promise resolving to the file content as string
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        resolve(event.target.result as string);
      } else {
        reject(new Error("Failed to read file"));
      }
    };
    reader.onerror = (error) => {
      reject(error);
    };
    // 使用 readAsText 而非 readAsDataURL
    reader.readAsText(file);
  });
}

/**
 * 将文件读取为 DataURL
 * @param file 要读取的文件
 * @returns 返回文件的 DataURL
 */
function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        resolve(event.target.result as string);
      } else {
        reject(new Error("Failed to read file"));
      }
    };
    reader.onerror = (error) => {
      reject(error);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * 处理文件内容，用于消息发送前的预处理
 * @param message 请求消息对象
 * @returns 处理后的内容
 */
export async function preProcessFileContent(message: RequestMessage) {
  const content = message.content;
  if (typeof content === "string") {
    return content;
  }

  const result = [];
  for (const part of content) {
    if (part?.type === "file_url" && part?.file_url?.url) {
      try {
        // 这里可以添加文件缓存逻辑，类似于图片缓存
        result.push({
          type: part.type,
          file_url: {
            url: part.file_url.url,
            name: part.file_url.name,
            contentType: part.file_url.contentType,
            size: part.file_url.size,
            tokenCount: part.file_url.tokenCount,
          },
        });
      } catch (error) {
        console.error("Error processing file URL:", error);
      }
    } else {
      // 保留其他类型的内容
      result.push({ ...part });
    }
  }
  return result;
}

/**
 * 从远程服务器删除文件
 * @param fileUrl 要删除的文件URL
 * @returns 删除操作的响应
 */
export function removeFile(fileUrl: string) {
  return fetch(fileUrl, {
    method: "DELETE",
    mode: "cors",
    credentials: "include",
  });
}

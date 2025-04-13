# 第一阶段：基础镜像
FROM node:22-alpine AS base

# 第二阶段：依赖安装（利用缓存层）
FROM base AS deps

RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY package.json yarn.lock ./

# 设置镜像源（合并Yarn和npm配置）
RUN set -e; \
    echo "设置镜像源..." && \
    yarn config set registry https://registry.npmmirror.com/ && \
    npm config set registry https://registry.npmmirror.com/ && \
    yarn config set network-timeout 300000

# 按顺序安装依赖（移除并行）
# 先安装sharp（使用npm）
RUN npm install sharp --ignore-scripts
# 再安装其他依赖（使用yarn）
RUN yarn install --frozen-lockfile --ignore-optional

# 第三阶段：构建阶段
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 使用构建参数和缓存
ARG NEXT_TELEMETRY_DISABLED=1
ENV NEXT_TELEMETRY_DISABLED=$NEXT_TELEMETRY_DISABLED

RUN yarn build && \
    yarn cache clean


# 第四阶段：运行时镜像（最小化）
FROM base AS runner
WORKDIR /app

RUN apk add --no-cache --virtual .run-deps \
    git \
    proxychains-ng \
    && rm -rf /var/cache/apk/*

# 从构建阶段复制必要文件
COPY --from=builder --chown=node:node \
    /app/public \
    /app/.next/static \
    /app/.next/server \
    /app/.next/standalone ./

USER node
EXPOSE 3000

# 使用exec格式的CMD
CMD ["sh", "-c", \
    "if [ -n \"$PROXY_URL\" ]; then \
        echo \"使用代理: $PROXY_URL\" && \
        protocol=$(echo $PROXY_URL | cut -d: -f1) && \
        host=$(echo $PROXY_URL | cut -d/ -f3 | cut -d: -f1) && \
        port=$(echo $PROXY_URL | cut -d: -f3) && \
        conf=/tmp/proxychains.conf && \
        printf \"strict_chain\nproxy_dns\nremote_dns_subnet 224\n[ProxyList]\n$protocol $host $port\n\" > $conf && \
        proxychains -f $conf node server.js; \
    else \
        node server.js; \
    fi"]
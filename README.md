# Cloudflare R2 文件管理器 Worker

## 项目简介

这是一个基于 Cloudflare Workers 和 R2 对象存储构建的简单文件管理器。它提供了一个网页界面，允许用户通过密码认证来上传、下载和删除 Cloudflare R2 存储桶中的文件。

项目的核心是一个 Cloudflare Worker，它处理来自网页界面的请求，并与绑定的 R2 存储桶进行交互。网页界面使用 HTML、CSS 和 JavaScript 构建，通过 Worker 提供的 API 进行文件操作。

**主要功能:**

*   通过预设密码进行认证访问。
*   列出 R2 存储桶中的文件。
*   上传文件到 R2 存储桶。
*   下载 R2 存储桶中的文件。
*   删除 R2 存储桶中的文件。

## 文件结构

```
.
├── README.md           - 项目介绍和部署指南 (本文档)
├── wrangler.toml       - Cloudflare Worker 的配置
├── index.html          - 文件管理器网页的 HTML, CSS, JavaScript 代码
└── src/
    └── index.js        - Cloudflare Worker 的主代码，处理请求和 R2 交互
```

## 部署指南

### 前提条件

1.  一个 Cloudflare 账号。
2.  已安装 Node.js 和 npm。
3.  已安装 Cloudflare Wrangler CLI。如果尚未安装，请运行 `npm install -g wrangler`。
4.  已登录 Wrangler CLI。运行 `wrangler login` 并按照提示完成认证。

### 步骤

1.  **克隆项目仓库** (如果您是从代码仓库开始) 或确保您有上述文件结构。

2.  **创建 R2 存储桶**

    在终端中，使用 Wrangler CLI 创建一个 R2 存储桶。将 `<YOUR_BUCKET_NAME>` 替换为您希望的存储桶名称（例如 `my-r2-files`）。

    ```bash
    npx wrangler r2 bucket create <YOUR_BUCKET_NAME>
    ```

    记下您创建的存储桶名称。

3.  **将 R2 存储桶绑定到 Worker**

    打开项目根目录下的 `wrangler.toml` 文件，并添加或修改 `r2_buckets` 配置，将您的 R2 存储桶绑定到 Worker。

    ```toml
    # ... 其他配置 ...

    [[r2_buckets]]
    binding = 'MY_BUCKET' # 在 Worker 代码中使用的环境变量名，请保持为 'MY_BUCKET'
    bucket_name = '<YOUR_BUCKET_NAME>' # 替换为您在步骤 2 中创建的存储桶名称
    ```

    请确保 `binding` 的值是 `MY_BUCKET`，因为 Worker 代码中使用了这个环境变量名来访问存储桶。

4.  **设置访问密码 (Secret)**

    出于安全考虑，访问密码应存储为 Cloudflare Secret，而不是直接写在代码中。在终端中运行以下命令，为 Worker 设置 `AUTH_KEY_SECRET`：

    ```bash
    npx wrangler secret put AUTH_KEY_SECRET
    ```

    Wrangler 会提示您输入 Secret 的值。输入您希望用作文件管理器密码的字符串，然后按 Enter。

5.  **部署 Worker**

    在项目根目录下的终端中运行部署命令：

    ```bash
    npx wrangler deploy
    ```

    Wrangler 会构建并部署您的 Worker 到 Cloudflare。部署完成后，终端会输出 Worker 的 URL。

## 使用文件管理器

1.  在浏览器中访问部署完成后输出的 Worker URL (`https://your-worker-name.your-account-id.workers.dev`)。
2.  您将看到一个简单的网页界面。
3.  在“密码”输入框中输入您在步骤 4 中设置的 `AUTH_KEY_SECRET` 值。
4.  点击“登录”按钮。
5.  如果密码正确，网页将显示文件列表和上传表单。
6.  您现在可以上传、下载和删除文件了。

## 调试

如果您在登录或文件操作时遇到问题，可以查看 Worker 的日志进行调试。

1.  在终端中运行 `npx wrangler tail` 命令来实时查看 Worker 的日志。
2.  在网页上执行操作，然后在 `wrangler tail` 的终端输出中查找日志信息，特别是认证相关的 `Received Auth Key` 和 `Expected Secret` 日志，以帮助您排查密码问题。

如果 `wrangler tail` 无法连接，您也可以登录到 Cloudflare Dashboard，找到您的 Worker，然后在 Worker 的页面中查看日志。

## 注意事项

*   此文件管理器提供了基本的密码认证。对于生产环境或需要更高级安全性的场景，您可能需要实现更健壮的身份验证和授权机制（例如 OAuth）。
*   `index.html` 的内容直接嵌入在 Worker 代码中。对于大型或复杂的网页，更好的做法是将 HTML 文件存储在 R2 或其他地方，并通过 Worker 进行服务。
*   文件上传和下载功能通过简单的 PUT 和 GET 请求实现，适用于中小型文件。对于大型文件，Cloudflare R2 支持分段上传 (Multipart Upload)，您可以在 Worker 中实现相应的逻辑来支持。
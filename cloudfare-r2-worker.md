 好的，没问题。我将根据您提供的 Cloudflare R2 文档内容，将其整理并翻译成一个更完整、结构化的中文技术文档，涵盖从入门到 API 参考的内容。

---

**Cloudflare R2 Worker 集成技术文档**

**概览**

本文档详细介绍了如何在 Cloudflare Workers 中使用 R2 对象存储。它涵盖了 R2 存储桶的创建、与 Worker 的绑定、基本的对象操作（上传、下载、删除、列表）、安全性考虑以及高级用法（如分段上传）和完整的 Workers R2 API 参考。

通过将 R2 与 Workers 结合，您可以在边缘处理文件操作，构建高性能、低延迟的对象存储应用程序。

**目录**

1.  入门与设置
    *   创建 Cloudflare Worker 项目
    *   创建 R2 存储桶
    *   将 R2 存储桶绑定到 Worker
2.  基本对象操作
    *   从 Worker 访问 R2 存储桶
    *   PUT (上传对象)
    *   GET (下载对象)
    *   DELETE (删除对象)
    *   LIST (列出对象)
3.  存储桶访问与安全性
    *   默认访问与隐私风险
    *   在 Worker 中实现访问控制
    *   使用 Wrangler Secrets 管理敏感信息
    *   部署与测试安全性
4.  高级用法：分段上传 (Multipart Upload)
    *   什么是分段上传？
    *   在 Worker 中处理分段上传的 API 示例
    *   状态管理考量
    *   示例客户端脚本 (Python)
5.  Workers R2 API 参考
    *   概念：存储桶与对象
    *   存储桶方法定义
        *   `head`
        *   `get`
        *   `put`
        *   `delete`
        *   `list`
        *   `createMultipartUpload`
        *   `resumeMultipartUpload`
    *   类型定义
        *   `R2Object`
        *   `R2ObjectBody`
        *   `R2MultipartUpload`
        *   `R2UploadedPart`
        *   `R2Objects`
    *   特定方法的选项类型
        *   `R2GetOptions`
            *   范围读取 (Ranged reads)
        *   `R2PutOptions`
        *   `R2MultipartOptions`
        *   `R2ListOptions`
    *   其他概念
        *   条件操作 (Conditional operations)
        *   HTTP 元数据 (HTTP Metadata)
        *   校验和 (Checksums)
        *   存储类 (Storage Class)
6.  相关资源

---

**1. 入门与设置**

本节介绍如何设置一个 Cloudflare Worker 项目，创建 R2 存储桶并将其与 Worker 绑定，这是开始使用 R2 的先决条件。

**1.1 创建 Cloudflare Worker 项目**

使用 Cloudflare 的命令行工具 C3 (create-cloudflare-cli) 可以快速创建一个 Workers 项目。

打开终端并运行以下命令：

```bash
npm create cloudflare@latest -- r2-worker
```

按照 C3 的提示进行配置。建议选择以下选项以匹配后续示例：

*   **What would you like to start with?**: `Hello World Starter`
*   **Which template would you like to use?**: `Worker only`
*   **Which language do you want to use?**: `JavaScript`
*   **Do you want to use git for version control?**: `Yes` (推荐)
*   **Do you want to deploy your application?**: `No` (我们稍后手动部署)

项目创建完成后，进入项目目录：

```bash
cd r2-worker
```

**1.2 创建 R2 存储桶**

在终端中，使用 Wrangler CLI 创建您的 R2 存储桶。选择一个唯一的存储桶名称替换 `<YOUR_BUCKET_NAME>`。

```bash
npx wrangler r2 bucket create <YOUR_BUCKET_NAME>
```

您可以使用以下命令验证存储桶是否已成功创建：

```bash
npx wrangler r2 bucket list
```

该命令将列出您的 Cloudflare 账户下的所有 R2 存储桶。

**1.3 将 R2 存储桶绑定到 Worker**

要在 Worker 代码中访问 R2 存储桶，需要通过绑定将其暴露给 Worker。绑定是一种运行时变量，由 Workers 运行时注入到您的代码中，用于连接 Worker 与外部资源（如 R2、KV、Durable Objects 等）。

您需要在 Worker 项目根目录下的 Wrangler 配置文件 (`wrangler.toml` 或 `wrangler.jsonc`) 中定义绑定。

在您的 Wrangler 文件中添加以下配置：

**wrangler.toml**

```toml
# ... 其他配置 ...

[[r2_buckets]]
binding = 'MY_BUCKET' # <~ 您在 Worker 代码中将使用的变量名
bucket_name = '<YOUR_BUCKET_NAME>' # <~ 您实际创建的存储桶名称
```

**wrangler.jsonc**

```jsonc
{
  // ... 其他配置 ...
  "r2_buckets": [
    {
      "binding": "MY_BUCKET", // <~ 您在 Worker 代码中将使用的变量名
      "bucket_name": "<YOUR_BUCKET_NAME>" // <~ 您实际创建的存储桶名称
    }
  ]
}
```

将 `binding` 值设置为您在 Worker 中希望使用的 JavaScript 变量名（例如 `MY_BUCKET`），将 `bucket_name` 设置为您在上一节中创建的存储桶的实际名称。

完成此步骤后，您就可以在 Worker 代码中通过 `env.MY_BUCKET` 来访问您的 R2 存储桶了（假设您将绑定变量名设置为 `MY_BUCKET`）。

**2. 基本对象操作**

完成设置和绑定后，您可以在 Worker 的 `fetch` 处理函数中通过绑定的 R2 存储桶变量 (`env.MY_BUCKET`) 执行基本的对象操作：PUT, GET, DELETE, LIST。

**2.1 从 Worker 访问 R2 存储桶**

Worker 代码中的 R2 绑定变量（例如 `env.MY_BUCKET`）提供了一系列方法来与 R2 存储桶进行交互。您可以通过解析请求 URL 来确定要操作的对象 key，并根据请求方法执行相应的 R2 操作。

以下是一个基本的 Worker 示例，演示了如何处理 PUT、GET 和 DELETE 请求：

```javascript
// index.js

export default {
  async fetch(request, env) {
    // 从请求 URL 路径中提取对象 key (忽略开头的 "/")
    const url = new URL(request.url);
    const key = url.pathname.slice(1);

    // 如果 key 为空，可以返回错误或执行默认操作
    if (!key) {
        return new Response("Missing object key in path", { status: 400 });
    }

    switch (request.method) {
      case "PUT":
        // 见 2.2 PUT (上传对象)
        break; // ...
      case "GET":
        // 见 2.3 GET (下载对象)
        break; // ...
      case "DELETE":
        // 见 2.4 DELETE (删除对象)
        break; // ...
      default:
        return new Response("Method Not Allowed", {
          status: 405,
          headers: {
            Allow: "PUT, GET, DELETE", // 允许的方法
          },
        });
    }
  },
};
```

**Wrangler 本地开发模式注意事项**

默认情况下，`npx wrangler dev` 在本地开发模式下运行，R2 操作会针对本地磁盘上的模拟存储执行。如果希望在开发过程中直接与真实的 R2 存储桶交互，请使用 `npx wrangler dev --remote` 命令。

**2.2 PUT (上传对象)**

使用 `bucket.put(key, value, options)` 方法上传一个对象。`key` 是对象的名称，`value` 是对象的内容（可以是 Request Body、ArrayBuffer、ReadableStream 等），`options` 是可选的配置（如元数据、校验和、条件操作等）。

```javascript
// 示例 (在上面的 switch 语句中加入 PUT case):
case "PUT":
  // request.body 是一个 ReadableStream，适合上传大文件而无需完全加载到内存
  // 注意：request.body 只能被读取一次，如需多次读取请使用 request.clone()
  await env.MY_BUCKET.put(key, request.body);
  return new Response(`Put ${key} successfully!`);
```

**避免 `request.body` 访问错误**

Request 的 body ([↗ MDN](https://developer.mozilla.org/en-US/docs/Web/API/Request/body)) 只能被读取或消费一次。如果在同一个请求中您已经使用了 `request.json()`, `request.text()`, `request.formData()` 等方法，再次访问 `request.body` 将会抛出 `TypeError`。

为避免此问题，如果您需要多次访问请求体，请使用 `request.clone()` 创建请求的副本，然后分别消费每个副本的 body。但请注意 Workers 的内存限制 (128MB)，多次加载大型请求体到内存可能达到限制。对于大文件，推荐直接使用 Streams ([↗ MDN](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API)) 处理。

**2.3 GET (下载对象)**

使用 `bucket.get(key, options)` 方法检索一个对象。如果对象存在，它返回一个 `R2ObjectBody` 对象，其中包含对象元数据和可通过 `object.body` 访问的 ReadableStream。如果对象不存在，则返回 `null`。

```javascript
// 示例 (在上面的 switch 语句中加入 GET case):
case "GET":
  const object = await env.MY_BUCKET.get(key);

  if (object === null) {
    return new Response("Object Not Found", { status: 404 });
  }

  // 成功获取对象，设置响应头部
  const headers = new Headers();
  // 将 R2 对象的 HTTP 元数据（如 Content-Type）写入响应头部
  object.writeHttpMetadata(headers);
  // 添加 ETag 头部，推荐使用 httpEtag 获取带引号的 ETag 值
  headers.set("etag", object.httpEtag);

  // 返回对象主体作为响应体
  return new Response(object.body, {
    headers,
  });
```

GET 方法也支持 `options` 参数，用于范围读取 (Range) 或条件读取 (Conditional GET)。

**2.4 DELETE (删除对象)**

使用 `bucket.delete(keys)` 方法删除一个或多个对象。`keys` 可以是单个字符串（对象 key）或字符串数组。此方法返回一个 Promise，在删除成功时解决为 `void`。

每次调用 `delete` 方法最多可以删除 1000 个 key。

```javascript
// 示例 (在上面的 switch 语句中加入 DELETE case):
case "DELETE":
  await env.MY_BUCKET.delete(key); // 删除单个对象
  // 或者删除多个对象: await env.MY_BUCKET.delete([key1, key2, key3]);
  return new Response("Deleted!");
```

R2 的删除操作是强一致的。一旦 Promise 解决，后续的读取操作将立即反映删除结果。

**2.5 LIST (列出对象)**

使用 `bucket.list(options)` 方法列出存储桶中的对象。它返回一个包含对象列表（`R2Object` 数组）的 `R2Objects` 对象。

列表结果默认按字典顺序排序，最多返回 1000 条记录。

```javascript
// 示例：列出存储桶中的前 100 个对象
async function listObjects(env) {
  const listed = await env.MY_BUCKET.list();
  // listed.objects 是一个 R2Object 数组
  // listed.truncated 是布尔值，表示是否有更多结果
  // listed.cursor 是字符串，用于下一页的列表操作
  return new Response(JSON.stringify(listed.objects), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// 在 fetch 处理函数中调用，例如处理特定路由或方法
/*
switch (request.method) {
    case "GET":
        if (key === "list") { // 例如访问 /list 路径来列出对象
            return listObjects(env);
        }
        // ... 其他 GET 逻辑 ...
    // ... 其他方法 ...
}
*/
```

`list` 方法接受 `R2ListOptions` 参数来自定义列出行为，例如设置 `limit`、`prefix`、`cursor`、`delimiter` 或 `include` (是否包含元数据)。有关详细信息，请参阅 [5.8 R2ListOptions](#r2listoptions)。请注意，设置 `include` 可能会导致返回的对象数量少于 `limit`，因为列表操作的总数据量有限制。应始终使用 `listed.truncated` 属性来检查是否还有更多结果，而不是依赖于返回的对象数量是否达到 `limit`。

**3. 存储桶访问与安全性**

在上面的基本示例中，Worker 直接根据请求方法和路径执行 R2 操作。这意味着任何人都可以通过调用 Worker 的端点来操作您的存储桶内容（PUT、GET、DELETE）。为了保护您的数据，**必须**在 Worker 中实现授权逻辑。

**3.1 默认访问与隐私风险**

当您的 Worker 通过绑定拥有对 R2 存储桶的访问权限时，Worker 本身就成为了访问存储桶的网关。如果您没有在 Worker 代码中添加身份验证和授权检查，那么任何能够访问您的 Worker 端点的人都可以利用您的 Worker 的权限来操作 R2 存储桶。

**3.2 在 Worker 中实现访问控制**

授权逻辑应该在 Worker 代码内部实现，以确定哪些请求被允许执行哪些 R2 操作。这取决于您的应用程序需求，可以基于：

*   HTTP 基本身份验证 ([示例](https://developers.cloudflare.com/workers/examples/auth-basic/))
*   自定义请求头部中的预共享密钥 ([示例](https://developers.cloudflare.com/workers/examples/auth-custom-header/))
*   OAuth 或其他令牌验证
*   请求来源 IP 地址限制
*   基于请求路径或用户身份的精细权限控制 (例如只允许读取特定前缀，只允许特定用户上传)

以下示例基于自定义头部中的预共享密钥和 GET 请求的文件白名单来实现授权：

```javascript
// index.js (更新 fetch 处理函数)

// 允许通过 GET 请求访问的文件白名单
const ALLOW_LIST_GET = ["cat-pic.jpg", "public/data.json"];

// 检查请求头部是否包含有效的预共享密钥
const hasValidAuthHeader = (request, env) => {
  // AUTH_KEY_SECRET 是一个 Wrangler Secret
  return request.headers.get("X-Custom-Auth-Key") === env.AUTH_KEY_SECRET;
};

// 根据请求方法、环境变量和对象 key 进行授权检查
function authorizeRequest(request, env, key) {
  switch (request.method) {
    case "PUT":
    case "DELETE":
      // PUT 和 DELETE 操作需要有效的自定义认证头部
      return hasValidAuthHeader(request, env);
    case "GET":
      // GET 操作只允许访问白名单中的 key
      return ALLOW_LIST_GET.includes(key);
    default:
      // 默认拒绝其他所有方法
      return false;
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const key = url.pathname.slice(1);

    // 在执行任何 R2 操作之前进行授权检查
    if (!authorizeRequest(request, env, key)) {
      return new Response("Forbidden", { status: 403 });
    }

    // 如果授权通过，则执行 R2 操作
    switch (request.method) {
      case "PUT":
        await env.MY_BUCKET.put(key, request.body);
        return new Response(`Put ${key} successfully!`);
      case "GET":
        const object = await env.MY_BUCKET.get(key);
        // 如果 GET 请求未授权（因为不在 ALLOW_LIST_GET 中），authorizeRequest 已经返回 403。
        // 如果授权通过但对象不存在，这里返回 404。
        if (object === null) {
          return new Response("Object Not Found", { status: 404 });
        }
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("etag", object.httpEtag);
        return new Response(object.body, { headers });
      case "DELETE":
        await env.MY_BUCKET.delete(key);
        return new Response("Deleted!");
      default:
        // 授权函数已经处理了不允许的方法，理论上不会到达这里
        return new Response("Method Not Allowed", {
          status: 405,
          headers: { Allow: "PUT, GET, DELETE" },
        });
    }
  },
};
```

**3.3 使用 Wrangler Secrets 管理敏感信息**

在上面的示例中，我们使用了 `env.AUTH_KEY_SECRET` 来存储用于身份验证的密钥。将敏感信息直接写在代码或 Wrangler 文件中是不安全的。Wrangler Secrets 允许您将敏感信息加密存储在 Cloudflare 平台，并在 Worker 运行时安全地通过 `env` 对象访问。

要创建 `AUTH_KEY_SECRET`：

```bash
npx wrangler secret put AUTH_KEY_SECRET
```

Wrangler 会提示您在终端中输入密钥值：

```text
npx wrangler secret put AUTH_KEY_SECRET

Enter the secret text you'd like assigned to the variable AUTH_KEY_SECRET on the script named <YOUR_WORKER_NAME>:
*********  <-- 在这里输入您的密钥，输入时不会显示字符
🌀  Creating the secret for script name <YOUR_WORKER_NAME>
✨  Success! Uploaded secret AUTH_KEY_SECRET.
```

这样，您的密钥就被安全地存储和访问了。

**3.4 部署与测试安全性**

在添加授权逻辑和 Secret 后，部署您的 Worker：

```bash
npx wrangler deploy
```

部署成功后，使用您的 Worker 端点进行测试。例如使用 `curl`：

*   **测试未经授权的 PUT (应返回 403 Forbidden)**
    ```bash
    curl https://<your-worker-url>/some-file.txt -X PUT --data-binary 'test data'
    ```
*   **测试使用错误密钥的 PUT (应返回 403 Forbidden)**
    ```bash
    curl https://<your-worker-url>/some-file.txt -X PUT --header "X-Custom-Auth-Key: wrong-key" --data-binary 'test data'
    ```
*   **测试使用正确密钥的 PUT (应返回 200 OK)**
    ```bash
    curl https://<your-worker-url>/cat-pic.jpg -X PUT --header "X-Custom-Auth-Key: your-actual-secret" --data-binary 'this is a cat pic simulation'
    ```
*   **测试 GET 未列入白名单的文件 (应返回 403 Forbidden)**
    ```bash
    curl https://<your-worker-url>/some-file.txt
    ```
*   **测试 GET 列入白名单且已存在的文件 (应返回文件内容)**
    ```bash
    curl https://<your-worker-url>/cat-pic.jpg
    ```

通过这些测试，您可以验证您的授权逻辑是否按预期工作。务必根据您的实际需求实现更健壮的身份验证和授权机制。

**4. 高级用法：分段上传 (Multipart Upload)**

对于大型文件，直接使用 `bucket.put(key, request.body)` 可能会受到 Workers 请求体大小限制（~128MB）的影响。分段上传 ([Multipart Upload](https://developers.cloudflare.com/r2/api/multipart-uploads/)) 允许您将大型文件分成多个较小的分段独立上传，最后再组合成完整对象。R2 的 Workers API 也支持分段上传。

**4.1 什么是分段上传？**

分段上传是一种将文件分成多个部分并独立上传的方法。它具有以下优点：

*   **支持大文件:** 可以绕过单个请求体的限制，上传 TB 级的文件。
*   **提高弹性:** 如果某个分段上传失败，只需要重新上传失败的分段，而不是整个文件。
*   **支持并行:** 多个分段可以并行上传，提高上传速度。
*   **支持暂停和恢复:** 可以在中断后恢复上传。

分段上传通常涉及以下步骤：

1.  **创建分段上传:** 初始化一个分段上传，获取一个 `uploadId`。
2.  **上传分段:** 使用 `uploadId` 和分段号独立上传文件的每个分段。每次上传一个分段后，会得到该分段的 `etag`。
3.  **完成分段上传:** 将所有上传的分段的编号和 `etag` 列表提交给 R2，R2 会将这些分段组合成最终对象。
4.  **中止分段上传 (可选):** 如果不再需要正在进行的分段上传，可以中止它以释放资源。

**4.2 在 Worker 中处理分段上传的 API 示例**

您可以在 Worker 中构建一个 HTTP API，暴露 R2 分段上传的功能，供客户端应用程序调用。以下示例 Worker 就实现了这样的功能，它通过请求 URL 的查询参数 `action` 来区分不同的分段上传操作。

```javascript
// index.js (使用以下代码替换之前的 fetch 处理函数)

interface Env {
  MY_BUCKET: R2Bucket; // 确保您的 Wrangler 文件中绑定名为 MY_BUCKET 的 R2 存储桶
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext // ctx 参数用于支持 Durable Objects 等，此处未使用但保留类型
  ): Promise<Response> {
    const bucket = env.MY_BUCKET;

    const url = new URL(request.url);
    // 对象 key 通常从路径获取
    const key = url.pathname.slice(1);
    // 操作类型从查询参数获取
    const action = url.searchParams.get("action");

    if (!action) {
      return new Response("Missing 'action' query parameter", { status: 400 });
    }

    // 您可以在此处添加授权逻辑，例如检查请求头部或令牌
    // if (!authorizeRequest(request, env, key, action)) {
    //   return new Response("Forbidden", { status: 403 });
    // }
    // 注意：分段上传操作 (mpu-*) 可能需要与普通 PUT/DELETE 不同的授权规则。

    // 根据 HTTP 方法和 action 类型路由请求
    switch (request.method) {
      case "POST":
        switch (action) {
          case "mpu-create": { // 创建分段上传
            // key 是要上传的最终对象名称
            const multipartUpload = await bucket.createMultipartUpload(key);
            // 返回 uploadId 和 key 给客户端，客户端需要保存这些信息
            return new Response(
              JSON.stringify({
                key: multipartUpload.key,
                uploadId: multipartUpload.uploadId,
              })
            );
          }
          case "mpu-complete": { // 完成分段上传
            const uploadId = url.searchParams.get("uploadId");
            if (!uploadId) {
              return new Response("Missing 'uploadId' query parameter", { status: 400 });
            }

            // 使用 key 和 uploadId 恢复分段上传对象
            const multipartUpload = env.MY_BUCKET.resumeMultipartUpload(
              key,
              uploadId
            );

            // 客户端在请求体中发送已上传分段的列表
            interface CompleteBody {
              parts: R2UploadedPart[]; // 包含 partNumber 和 etag 的数组
            }
            const completeBody: CompleteBody = await request.json();
            if (!completeBody || !completeBody.parts || !Array.isArray(completeBody.parts)) {
              return new Response("Missing or invalid body: expecting { parts: R2UploadedPart[] }", {
                status: 400,
              });
            }

            // 错误处理：以防底层分段上传已不存在或被中止
            try {
              const object = await multipartUpload.complete(completeBody.parts);
              // 完成后返回最终对象的 ETag
              return new Response(null, { // 通常完成操作返回 200 OK 或 204 No Content
                headers: {
                  etag: object.httpEtag, // 返回最终对象的 etag
                },
                status: 200,
              });
            } catch (error: any) {
              // 如果 complete 失败，可能是 uploadId 无效或已中止等
              return new Response(error.message || "Failed to complete multipart upload", { status: 400 });
            }
          }
          default:
            return new Response(`Unknown action '${action}' for POST method`, {
              status: 400,
            });
        }
      case "PUT":
        switch (action) {
          case "mpu-uploadpart": { // 上传单个分段
            const uploadId = url.searchParams.get("uploadId");
            const partNumberString = url.searchParams.get("partNumber");
            if (!partNumberString || !uploadId) {
              return new Response("Missing 'partNumber' or 'uploadId' query parameter", {
                status: 400,
              });
            }
            if (request.body === null) {
              return new Response("Missing request body for part upload", { status: 400 });
            }

            const partNumber = parseInt(partNumberString, 10);
            if (isNaN(partNumber) || partNumber < 1) {
                 return new Response("Invalid 'partNumber'", { status: 400 });
            }

            // 使用 key 和 uploadId 恢复分段上传对象
            const multipartUpload = env.MY_BUCKET.resumeMultipartUpload(
              key, // 对象 key
              uploadId // 分段上传 ID
            );

            // 错误处理：以防底层分段上传已不存在
            try {
              // 上传分段，提供分段编号和请求体作为数据源
              const uploadedPart: R2UploadedPart =
                await multipartUpload.uploadPart(partNumber, request.body);
              // 返回已上传分段的信息 (partNumber 和 etag)
              return new Response(JSON.stringify(uploadedPart));
            } catch (error: any) {
              // 如果 uploadPart 失败，可能是 uploadId 无效等
              return new Response(error.message || "Failed to upload part", { status: 400 });
            }
          }
          default:
            return new Response(`Unknown action '${action}' for PUT method`, {
              status: 400,
            });
        }
      case "GET":
        // 您可以根据需要在这里添加普通的 GET 对象逻辑
        if (action === "get" || action === null) { // 允许 action=get 或没有 action 的 GET 请求
            const object = await env.MY_BUCKET.get(key);
            if (object === null) {
              return new Response("Object Not Found", { status: 404 });
            }
            const headers = new Headers();
            object.writeHttpMetadata(headers);
            headers.set("etag", object.httpEtag);
            return new Response(object.body, { headers });
        } else {
             return new Response(`Unknown action '${action}' for GET method`, {
                status: 400,
             });
        }
      case "DELETE":
        switch (action) {
          case "mpu-abort": { // 中止分段上传
            const uploadId = url.searchParams.get("uploadId");
            if (!uploadId) {
              return new Response("Missing 'uploadId' query parameter", { status: 400 });
            }
            const multipartUpload = env.MY_BUCKET.resumeMultipartUpload(
              key,
              uploadId
            );

            // 错误处理：以防底层分段上传已不存在
            try {
              await multipartUpload.abort(); // abort() 返回 Promise<void>
            } catch (error: any) {
              return new Response(error.message || "Failed to abort multipart upload", { status: 400 });
            }
            return new Response(null, { status: 204 }); // 通常中止操作返回 204 No Content
          }
          case "delete": { // 删除最终对象 (非分段上传)
            await env.MY_BUCKET.delete(key);
            return new Response(null, { status: 204 }); // 通常删除操作返回 204 No Content
          }
          default:
            return new Response(`Unknown action '${action}' for DELETE method`, {
              status: 400,
            });
        }
      default:
        return new Response("Method Not Allowed", {
          status: 405,
          headers: { Allow: "PUT, POST, GET, DELETE" },
        });
    }
  },
} satisfies ExportedHandler<Env>; // 使用 satisfies 关键字来类型检查，如果使用 TypeScript
```

部署此 Worker 后，您的客户端应用程序就可以通过调用 Worker 的端点并指定相应的 `action` 查询参数来执行分段上传流程。

**4.3 状态管理考量**

分段上传是一个有状态的过程（需要跟踪 `uploadId` 和每个已上传分段的信息），而 Workers 是无状态的执行环境。这意味着 Worker 的不同调用之间不会自动共享状态。

在上面的示例 Worker 中，状态（如 `uploadId` 和已上传分段的列表）是**由客户端应用程序负责跟踪和管理的**。客户端在创建分段上传时获取 `uploadId`，在上传每个分段时接收分段信息（`partNumber`, `etag`），并在最后完成上传时将这些信息发送回 Worker。这种方式将状态管理责任放在客户端，允许最大的灵活性，例如支持并行和无序的分段上传。

如果客户端无法管理此状态（例如，上传过程由多个独立的、短时运行的进程执行），您可以考虑将分段上传的状态存储在外部存储中，例如：

*   **Cloudflare Durable Objects:** 为每个正在进行的分段上传创建一个 Durable Object 实例来存储状态。
*   **数据库:** 使用外部数据库（如 PostgreSQL, MySQL 等）存储分段上传状态。

**4.4 示例客户端脚本 (Python)**

以下是一个 Python 脚本示例，它演示了如何作为一个客户端应用程序，通过调用上面实现的 Worker API 来执行分段上传。它使用 `requests` 库和 `concurrent.futures` 来实现分段的并行上传。

将以下代码保存为 `mpuscript.py`，并将其中的 `worker_endpoint` 替换为您实际部署的 Worker URL。然后在终端中运行 `python3 mpuscript.py <file_to_upload>` 来上传文件。

```python
import math
import os
import requests
from requests.adapters import HTTPAdapter, Retry
import sys
import concurrent.futures
import json

# 检查命令行参数，获取要上传的文件名
if len(sys.argv) != 2:
    print("Usage: python3 mpuscript.py <file_to_upload>")
    sys.exit(1)

filename = sys.argv[1]
# 🚨🚨🚨 将这里替换为您实际部署的 Worker URL 🚨🚨🚨
worker_endpoint = "https://myworker.myzone.workers.dev/"
# 配置分段大小为 10MB。根据您的需求调整。
# R2 要求除最后一个分段外，其他分段最小为 5MB。
partsize = 10 * 1024 * 1024


def upload_file(worker_endpoint, filename, partsize):
    """
    orchestrates the multipart upload process through the Worker API.
    通过 Worker API 协调分段上传过程。
    """
    # 确保文件存在
    if not os.path.exists(filename):
        print(f"Error: File '{filename}' not found.")
        return

    # 从文件名提取对象 key (例如去掉路径)
    key = os.path.basename(filename)
    url = f"{worker_endpoint}{key}" # Worker API 端点 URL

    print(f"Starting multipart upload for '{filename}' to '{url}'")

    # 1. 创建分段上传
    try:
        print("Step 1: Creating multipart upload...")
        response = requests.post(url, params={"action": "mpu-create"})
        response.raise_for_status() # 如果请求失败，抛出异常
        create_response = response.json()
        uploadId = create_response["uploadId"]
        uploaded_key = create_response["key"]
        print(f"Multipart upload created. Key: '{uploaded_key}', UploadId: '{uploadId}'")
    except requests.exceptions.RequestException as e:
        print(f"Error creating multipart upload: {e}")
        return

    file_size = os.stat(filename).st_size
    part_count = math.ceil(file_size / partsize)
    print(f"File size: {file_size} bytes, Part size: {partsize} bytes, Total parts: {part_count}")

    uploaded_parts = [] # 用于存储已上传分段的信息 ({ partNumber, etag })

    # 2. 上传分段
    print("Step 2: Uploading parts...")
    # 创建一个执行器，最多同时进行 5 个上传。根据您的网络和 Worker 资源调整。
    max_workers = 5 # 并行上传数量
    if part_count < max_workers:
        max_workers = part_count

    # 配置重试策略，应对临时的网络或服务器错误
    retry_strategy = Retry(
        total=3,  # 总共重试 3 次
        backoff_factor=1, # 重试间隔因子
        status_forcelist=[400, 408, 429, 500, 502, 503, 504], # 对这些状态码进行重试
        allowed_methods=["PUT"] # 只对 PUT 方法重试
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    http_session = requests.Session()
    http_session.mount("https://", adapter)
    http_session.mount("http://", adapter)


    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        # 提交任务以上传每个分段
        # partNumber 从 1 开始计数
        future_to_part = {
            executor.submit(
                upload_part, http_session, filename, partsize, url, uploadId, index + 1, index * partsize, min(partsize, file_size - index * partsize)
            ): index + 1
            for index in range(part_count)
        }
        
        for future in concurrent.futures.as_completed(future_to_part):
            part_number = future_to_part[future]
            try:
                # 获取分段上传结果 (一个 R2UploadedPart 对象)
                part_info = future.result()
                print(f"Part {part_number} uploaded successfully. ETag: {part_info['etag']}")
                uploaded_parts.append(part_info)
            except requests.exceptions.RequestException as e:
                print(f"Error uploading part {part_number}: {e}")
                # 根据需要处理错误，例如可以选择中止整个上传
                print("Aborting upload due to part upload failure...")
                abort_multipart_upload(http_session, url, uploadId)
                return
            except Exception as e:
                 print(f"An unexpected error occurred during part {part_number} upload: {e}")
                 print("Aborting upload due to unexpected error...")
                 abort_multipart_upload(http_session, url, uploadId)
                 return

    # 检查是否所有分段都已成功上传
    if len(uploaded_parts) != part_count:
        print("Not all parts were uploaded successfully. Aborting upload.")
        abort_multipart_upload(http_session, url, uploadId)
        return

    # 确保分段按 partNumber 排序，这对 complete 操作是必需的
    uploaded_parts.sort(key=lambda x: x['partNumber'])
    print("All parts uploaded. Proceeding to complete.")

    # 3. 完成分段上传
    try:
        print("Step 3: Completing multipart upload...")
        response = requests.post(
            url,
            params={"action": "mpu-complete", "uploadId": uploadId},
            json={"parts": uploaded_parts}, # 将已上传分段列表发送给 Worker
        )
        response.raise_for_status()
        print("🎉 Successfully completed multipart upload!")
        # 可以从响应头部获取最终对象的 etag
        final_etag = response.headers.get('etag')
        if final_etag:
            print(f"Final Object ETag: {final_etag}")

    except requests.exceptions.RequestException as e:
        print(f"Error completing multipart upload: {e}")
        # 完成失败，可能需要根据情况决定是重试还是中止
        print("Consider aborting the upload if completion repeatedly fails.")
    except Exception as e:
        print(f"An unexpected error occurred during completion: {e}")


def upload_part(session, filename, partsize, url, uploadId, partNumber, offset, size):
    """
    Reads a specific part of the file and uploads it.
    读取文件的特定分段并上传。
    """
    # 以 rb 模式打开文件，处理为原始字节
    with open(filename, "rb") as file:
        # 定位到分段的起始位置
        file.seek(offset)
        # 读取分段数据
        part_data = file.read(size)

    # 使用 PUT 方法上传分段
    response = session.put(
        url,
        params={
            "action": "mpu-uploadpart",
            "uploadId": uploadId,
            "partNumber": str(partNumber), # 分段编号需要作为查询参数
        },
        data=part_data, # 分段数据作为请求体
    )
    # raise_for_status 会处理重试失败后的最终错误
    response.raise_for_status()
    
    # Worker 应该返回 R2UploadedPart 的 JSON 字符串
    return response.json()


def abort_multipart_upload(session, url, uploadId):
    """
    Aborts a multipart upload.
    中止分段上传。
    """
    print(f"Aborting multipart upload with UploadId: {uploadId}")
    try:
        # 使用 DELETE 方法和 action=mpu-abort 中止
        response = session.delete(url, params={"action": "mpu-abort", "uploadId": uploadId})
        response.raise_for_status()
        print(f"Multipart upload {uploadId} aborted successfully.")
    except requests.exceptions.RequestException as e:
        print(f"Error aborting multipart upload {uploadId}: {e}")
    except Exception as e:
         print(f"An unexpected error occurred during abort: {e}")


if __name__ == "__main__":
    upload_file(worker_endpoint, filename, partsize)
```

这个 Python 脚本提供了一个实用的客户端实现，展示了如何调用 Worker API 执行分段上传的完整流程。

**5. Workers R2 API 参考**

本节提供了在 Cloudflare Workers 中可用的 R2 存储桶绑定对象的详细 API 参考。此 API 与 S3 API 有一些扩展和语义差异；如果需要严格的 S3 兼容性，请考虑使用 R2 的 S3 兼容 API。

**5.1 概念：存储桶与对象**

*   **存储桶 (Bucket):** R2 中组织数据的容器。存储桶是性能、扩展和访问控制的基本单元。
*   **对象 (Object):** 存储在 R2 中的数据项，由一个唯一的 key 标识，包含数据值和元数据。

在 Worker 中，通过将 R2 存储桶**绑定**到 Worker 来访问它。绑定是一个运行时变量，代表了您的存储桶，您可以通过这个变量调用方法来操作存储桶中的对象。

绑定配置在 Wrangler 文件中完成，如 [1.3 将 R2 存储桶绑定到 Worker](#13-jiang-r2-cun-chu-tong-bang-ding-dao-worker) 所述。配置完成后，绑定变量（例如 `env.MY_BUCKET`）就可以在 Worker 代码中使用。

**5.2 存储桶方法定义**

以下方法可在注入到您 Worker 代码中的存储桶绑定对象上使用：

*   #### `head(key: string, options?: R2GetOptions): Promise<R2Object | null>`
    检索给定 `key` 的对象的元数据，如果 key 存在则返回仅包含元数据的 `R2Object`，如果 key 不存在则返回 `null`。此方法不会下载对象主体，因此比 `get` 更高效。

*   #### `get(key: string, options?: R2GetOptions): Promise<R2ObjectBody | null>`
    检索给定 `key` 的对象。如果 key 存在，则返回包含对象元数据和主体 (作为 ReadableStream) 的 `R2ObjectBody`；如果 key 不存在，则返回 `null`。
    如果 `options` 中指定的条件操作失败，`get()` 返回一个 `body` 为 `undefined` 的 `R2Object`（而不是 `R2ObjectBody`），表示元数据可能可用但主体未被检索。

*   #### `put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | Blob | String | FormData, options?: R2PutOptions): Promise<R2Object | null>`
    在关联的 `key` 下存储给定的 `value` 和元数据。`value` 可以是多种类型。写入成功后，返回一个包含有关存储对象元数据的 `R2Object`。
    如果在 `options` 中指定的条件操作失败，`put()` 返回 `null`，且对象不会被存储。
    R2 写入是强一致的。一旦 Promise 解决，所有后续读取操作都将在全局看到此 key-value 对。

*   #### `delete(keys: string | string[]): Promise<void>`
    删除给定 `keys`（单个字符串或字符串数组）下的对象及元数据。删除成功后，返回 `void`。
    R2 删除是强一致的。一旦 Promise 解决，所有后续读取操作将不再全局看到提供的 key。
    每次调用最多可以删除 1000 个 key。

*   #### `list(options?: R2ListOptions): Promise<R2Objects>`
    返回一个 `R2Objects` 对象，其中包含存储桶内的 `R2Object` 列表。
    返回的对象列表按字典顺序排序。
    返回最多 1000 条记录，但可能会返回更少以最小化 Worker 中的内存压力。`options` 可用于自定义列表行为和分页。

*   #### `createMultipartUpload(key: string, options?: R2MultipartOptions): Promise<R2MultipartUpload>`
    为给定的 `key` 创建一个新的分段上传。
    返回一个 Promise，该 Promise 解决为一个 `R2MultipartUpload` 对象，表示新创建的分段上传。分段上传创建后，可以通过 Workers API 或 S3 API 立即在全球范围内与其交互。

*   #### `resumeMultipartUpload(key: string, uploadId: string): R2MultipartUpload`
    返回一个对象，表示具有给定 `key` 和 `uploadId` 的现有分段上传。
    **重要提示:** `resumeMultipartUpload` 操作不执行任何检查以确保 `uploadId` 的有效性，也不验证是否存在相应的活动分段上传。这样做是为了最小化延迟。在调用 `R2MultipartUpload` 对象上的后续操作（`uploadPart`, `complete`, `abort`）时，需要添加错误处理，以防底层分段上传不再存在（例如已被完成或中止）。

**5.3 类型定义**

*   #### `R2Object`
    表示存储对象的元数据。
    *   `key: string`：对象的 key。
    *   `version: string`：与特定上传关联的唯一版本字符串。
    *   `size: number`：对象大小（字节）。
    *   `etag: string`：与对象上传关联的 etag (未加引号)。
    *   `httpEtag: string`：用于 HTTP 头部，带引号的 etag。
    *   `uploaded: Date`：对象上传时间。
    *   `httpMetadata: R2HTTPMetadata`：HTTP 相关元数据。参考 [HTTP 元数据](#http-metadata)。
    *   `customMetadata: Record<string, string>`：自定义用户定义元数据。
    *   `range: R2Range | undefined`：如果使用了范围读取，表示返回的范围。
    *   `checksums: R2Checksums | undefined`：对象的校验和。参考 [校验和](#checksums)。
    *   `writeHttpMetadata(headers: Headers): void`：将 `httpMetadata` 写入给定的 Headers 对象。
    *   `storageClass: R2StorageClass`：对象的存储类。参考 [存储类](#storage-class)。
    *   `ssecKeyMd5: string | undefined`：SSE-C key 的 MD5 哈希（如果使用 SSE-C）。

*   #### `R2ObjectBody extends R2Object`
    继承 `R2Object` 的所有属性，并添加以下属性，代表对象的主体。在 `get()` 成功时返回。
    *   `body: ReadableStream`：对象的值作为可读流。
    *   `bodyUsed: boolean`：主体是否已被读取。
    *   `arrayBuffer(): Promise<ArrayBuffer>`：将主体读取为 ArrayBuffer。
    *   `text(): Promise<string>`：将主体读取为字符串。
    *   `json(): Promise<any>`：将主体解析为 JSON 对象。
    *   `blob(): Promise<Blob>`：将主体读取为 Blob。

*   #### `R2MultipartUpload`
    表示正在进行的分段上传。通过 `createMultipartUpload` 或 `resumeMultipartUpload` 获取。
    *   `key: string`：分段上传的 key。
    *   `uploadId: string`：分段上传的唯一 ID。
    *   `uploadPart(partNumber: number, value: ReadableStream | ArrayBuffer | ArrayBufferView | Blob | String): Promise<R2UploadedPart>`：上传单个分段。`partNumber` 从 1 开始。返回 `R2UploadedPart`。
    *   `abort(): Promise<void>`：中止分段上传。
    *   `complete(parts: R2UploadedPart[]): Promise<R2Object>`：使用已上传分段列表完成分段上传。返回最终对象的 `R2Object`。

*   #### `R2UploadedPart`
    表示一个已成功上传的分段。在 `uploadPart` 成功时返回，并在 `complete` 时作为参数传递。
    *   `partNumber: number`：分段的编号。
    *   `etag: string`：分段的 etag。

*   #### `R2Objects`
    `list()` 方法的返回值类型。
    *   `objects: R2Object[]`：与列表请求匹配的对象数组。
    *   `truncated: boolean`：如果为 true，表示还有更多结果待检索。
    *   `cursor?: string`：如果 `truncated` 为 true，提供用于下一页列表的游标。
    *   `delimitedPrefixes: string[]`：如果指定了 `delimiter`，包含分组的前缀列表。

**5.4 特定方法的选项类型**

*   #### `R2GetOptions`
    `get()` 和 `head()` 方法的可选参数。
    *   `onlyIf?: R2Conditional | Headers`：指定条件读取。参考 [条件操作](#conditional-operations)。
    *   `range?: R2Range`：指定范围读取。参考 [范围读取](#ranged-reads)。
    *   `ssecKey?: ArrayBuffer | string`：用于 SSE-C 解密的 key (32字节，ArrayBuffer 或十六进制字符串)。

    **范围读取 (Ranged reads)**
    在 `R2GetOptions` 中使用 `range` 参数来只读取对象的一部分。`R2Range` 对象具有以下属性（至少提供其中一个）：
    *   `offset?: number`：开始读取的字节偏移量（包含）。
    *   `length?: number`：要读取的字节数。
    *   `suffix?: number`：从文件末尾开始读取的字节数。

*   #### `R2PutOptions`
    `put()` 方法的可选参数。
    *   `onlyIf?: R2Conditional`：指定条件写入。参考 [条件操作](#conditional-operations)。
    *   `httpMetadata?: R2HTTPMetadata`：指定对象的 HTTP 元数据。参考 [HTTP 元数据](#http-metadata)。
    *   `customMetadata?: Record<string, string>`：指定对象的自定义元数据。
    *   `md5?: ArrayBuffer | string`：提供 MD5 校验和进行完整性检查。
    *   `sha1?: ArrayBuffer | string`：提供 SHA-1 校验和。
    *   `sha256?: ArrayBuffer | string`：提供 SHA-256 校验和。
    *   `sha384?: ArrayBuffer | string`：提供 SHA-384 校验和。
    *   `sha512?: ArrayBuffer | string`：提供 SHA-512 校验和。
    *   `storageClass?: R2StorageClass`：设置对象的存储类。参考 [存储类](#storage-class)。
    *   `ssecKey?: ArrayBuffer | string`：用于 SSE-C 加密的 key (32字节，ArrayBuffer 或十六进制字符串)。

*   #### `R2MultipartOptions`
    `createMultipartUpload()` 方法的可选参数。
    *   `httpMetadata?: R2HTTPMetadata`：指定最终对象的 HTTP 元数据。
    *   `customMetadata?: Record<string, string>`：指定最终对象的自定义元数据。
    *   `storageClass?: R2StorageClass`：设置最终对象的存储类。
    *   `ssecKey?: ArrayBuffer | string`：用于 SSE-C 加密的 key。

*   #### `R2ListOptions`
    `list()` 方法的可选参数。
    *   `limit?: number`：返回结果的最大数量 (1-1000)。默认 1000。
    *   `prefix?: string`：只列出 key 以此前缀开头的对象。
    *   `cursor?: string`：用于分页的游标，从上一次列表结果获取。
    *   `delimiter?: string`：用于分组 key 的字符。
    *   `include?: ("httpMetadata" | "customMetadata")[]`：指定在列表结果中包含哪些元数据。注意此选项可能导致返回对象数量少于 `limit`。需要兼容性日期 >= 2022-08-04 或设置 `r2_list_honor_include` 兼容性标志。

**5.5 其他概念**

*   #### 条件操作 (Conditional operations)
    `get()` 和 `put()` 支持条件操作，基于对象的元数据（如 ETag 或上传时间）来决定是否执行操作。可以通过 `R2Conditional` 对象或标准的 HTTP 条件头部来指定条件。
    `R2Conditional` 属性：
    *   `etagMatches?: string`：仅当 etag 匹配时执行。
    *   `etagDoesNotMatch?: string`：仅当 etag 不匹配时执行。
    *   `uploadedBefore?: Date`：仅当在指定日期前上传时执行。
    *   `uploadedAfter?: Date`：仅当在指定日期后上传时执行。
    支持的 HTTP 条件头部 (在 `Headers` 对象中提供给 `onlyIf`) 包括 `If-Match`, `If-None-Match`, `If-Modified-Since`, `If-Unmodified-Since` ([RFC 7232 ↗](https://tools.ietf.org/html/rfc7232))，但不包括 `If-Range`。

*   #### HTTP 元数据 (HTTP Metadata)
    可以通过 `R2PutOptions` 或 `R2MultipartOptions` 设置，并通过 `R2Object` 和 `R2ObjectBody` 的 `httpMetadata` 属性访问。这些属性通常映射到 HTTP 响应头部。
    *   `contentType?: string`
    *   `contentLanguage?: string`
    *   `contentDisposition?: string`
    *   `contentEncoding?: string`
    *   `cacheControl?: string`
    *   `cacheExpiry?: Date`

*   #### 校验和 (Checksums)
    在 `put()` 时提供的校验和可通过 `R2Object` 的 `checksums` 属性获取。非分段上传对象默认包含 MD5 校验和。
    `R2Checksums` 属性：
    *   `md5?: string` (十六进制)
    *   `sha1?: string` (十六进制)
    *   `sha256?: string` (十六进制)
    *   `sha384?: string` (十六进制)
    *   `sha512?: string` (十六进制)

*   #### 存储类 (Storage Class)
    指示对象存储的存储层。可在 `R2PutOptions` 和 `R2MultipartOptions` 中设置。
    可用值：
    *   `"Standard"`
    *   `"InfrequentAccess"`
    有关存储类的详细信息，请参阅 [R2 定价文档](https://developers.cloudflare.com/r2/pricing/#storage-classes)。

**6. 相关资源**

*   [Cloudflare R2 概览](https://developers.cloudflare.com/r2/overview/)
*   [Workers 教程](https://developers.cloudflare.com/workers/tutorials/)
*   [Workers 示例](https://developers.cloudflare.com/workers/examples/)
*   [Wrangler CLI 文档](https://developers.cloudflare.com/workers/wrangler/)
*   [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)

---

希望这份整理和翻译后的技术文档能够更清晰、完整地帮助您理解和使用 Cloudflare Workers 中的 R2。Options`
    `put()` 方法的可选参数。
    *   `onlyIf?: R2Conditional`：指定条件写入。参考 [条件操作](#conditional-operations)。
    *   `httpMetadata?: R2HTTPMetadata`：设置对象的 HTTP 元数据。参考 [HTTP 元数据](#http-metadata)。
    *   `customMetadata?: Record<string, string>`：设置对象的自定义元数据。
    *   `md5?: ArrayBuffer | string`：提供 MD5 校验和以供 R2 验证上传的完整性。
    *   `sha1?: ArrayBuffer | string`：提供 SHA-1 校验和。
    *   `sha256?: ArrayBuffer | string`：提供 SHA-256 校验和。
    *   `sha384?: ArrayBuffer | string`：提供 SHA-384 校验和。
    *   `sha512?: ArrayBuffer | string`：提供 SHA-512 校验和。
        **注意:** 一次只能提供一个校验和类型。
    *   `storageClass?: R2StorageClass`：设置对象的存储类。参考 [存储类](#storage-class)。
    *   `ssecKey?: ArrayBuffer | string`：用于 SSE-C 加密的 key (32字节，ArrayBuffer 或十六进制字符串)。

*   #### `R2MultipartOptions`
    `createMultipartUpload()` 方法的可选参数。
    *   `httpMetadata?: R2HTTPMetadata`：设置最终对象的 HTTP 元数据。
    *   `customMetadata?: Record<string, string>`：设置最终对象的自定义元数据。
    *   `storageClass?: R2StorageClass`：设置最终对象的存储类。
    *   `ssecKey?: ArrayBuffer | string`：用于 SSE-C 加密的 key。

*   #### `R2ListOptions`
    `list()` 方法的可选参数。
    *   `limit?: number`：返回的最大结果数量 (1-1000)，默认 1000。
    *   `prefix?: string`：只返回 key 以此字符串开头的文件。
    *   `cursor?: string`：从上一次列表操作返回的游标，用于分页。
    *   `delimiter?: string`：用于对 key 进行分组的字符，通常是 `/`。
    *   `include?: ("httpMetadata" | "customMetadata")[]`：指定列表结果中应包含哪些元数据。注意兼容性日期和总数据量限制。

**5.5 其他概念**

*   #### 条件操作 (Conditional operations)
    可以使用 `R2Conditional` 对象或 HTTP 条件头部来指定 R2 操作只有在满足特定条件时才执行。
    `R2Conditional` 对象属性：
    *   `etagMatches?: string`：如果对象的 etag 与给定字符串匹配则执行。
    *   `etagDoesNotMatch?: string`：如果对象的 etag 与给定字符串不匹配则执行。
    *   `uploadedBefore?: Date`：如果对象在给定日期之前上传则执行。
    *   `uploadedAfter?: Date`：如果对象在给定日期之后上传则执行。
    HTTP 条件头部（例如 `If-Match`, `If-None-Match`, `If-Modified-Since`, `If-Unmodified-Since`）也可以在 `R2GetOptions` 和 `R2PutOptions` 中通过 Headers 对象提供。注意 Workers 不支持 `If-Range`。参考 [RFC 7232 ↗](https://tools.ietf.org/html/rfc7232)。

*   #### HTTP 元数据 (HTTP Metadata)
    在 PUT 或创建分段上传时，可以通过 `httpMetadata` 选项设置与对象相关的 HTTP 头部，如 `Content-Type`, `Content-Language`, `Content-Disposition`, `Content-Encoding`, `Cache-Control`, `Cache-Expiry`。这些头部会随 GET 请求一起返回，并且可以通过 GET 请求中的对应头部进行覆盖（仅影响当前响应）。
    `R2HTTPMetadata` 类型：
    *   `contentType?: string`
    *   `contentLanguage?: string`
    *   `contentDisposition?: string`
    *   `contentEncoding?: string`
    *   `cacheControl?: string`
    *   `cacheExpiry?: Date`

*   #### 校验和 (Checksums)
    在 `put()` 或 `createMultipartUpload()` 时可以通过选项提供校验和（MD5, SHA1, SHA256, SHA384, SHA512），R2 会验证上传数据的完整性。成功上传后，这些校验和会存储在 `R2Object` 或 `R2ObjectBody` 的 `checksums` 属性中。对于非分段上传，R2 会默认计算并存储 MD5 校验和。
    `R2Checksums` 类型：
    *   `md5?: string` (十六进制编码)
    *   `sha1?: string`
    *   `sha256?: string`
    *   `sha384?: string`
    *   `sha512?: string`

*   #### 存储类 (Storage Class)
    指定对象存储的存储类，影响成本和可用性。R2 支持 Standard 和 InfrequentAccess 两种存储类。可以在 `R2PutOptions` 或 `R2MultipartOptions` 中设置。如果没有指定，将使用与存储桶关联的默认存储类。
    `R2StorageClass` 类型：`"Standard" | "InfrequentAccess"`。参考 [R2 定价和存储类](https://developers.cloudflare.com/r2/pricing/#storage-classes)。

**6. 相关资源**

*   [Cloudflare R2 文档](https://developers.cloudflare.com/r2/)
*   [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
*   [Wrangler CLI 文档](https://developers.cloudflare.com/workers/wrangler/)
*   [Workers 教程和示例](https://developers.cloudflare.com/workers/examples/)
*   [R2 分段上传概览](https://developers.cloudflare.com/r2/api/multipart-uploads/)

***

希望这个整理和翻译后的技术文档对您有帮助！它涵盖了从基础到高级的使用，并提供了详细的 API 参考。
# CloudDrop 认证流程改进计划

## 问题背景

当前应用存在以下认证相关问题：
1.  时间线加载失败，提示认证错误。
2.  用户可以直接访问主应用页面，但在执行需要认证的操作（如加载时间线、上传）时才失败，因为没有预先输入密码。
3.  期望的流程是：用户必须先通过认证才能进入应用主界面，之后的所有操作都应自动获得授权。

## 新认证逻辑构思

为了实现“先认证，后访问”的流程，提议采用以下设计：

1.  **初始访问 (`/`)**：
    *   **后端 (Worker)**：访问根路径 `/` 时，返回一个**仅包含登录表单**的简化版 HTML 页面。
    *   **前端**：用户首先看到登录页面。

2.  **登录尝试 (`/api/login`)**：
    *   **前端**：用户输入密码并提交，通过 POST 请求将密码发送到新的 `/api/login` 端点。
    *   **后端 (Worker)**：创建 `/api/login` 路由处理 POST 请求。
        *   验证提交的密码与 `env.AUTH_KEY_SECRET`。
        *   成功则返回 `{ success: true }` (200 OK)。
        *   失败则返回 `{ success: false, error: "密码错误" }` (401 Unauthorized)。

3.  **登录成功后的前端处理**：
    *   **前端**：收到 `/api/login` 成功响应后：
        *   将密码存储在前端变量 `currentPassword` 中（仅限当前会话）。
        *   隐藏登录表单。
        *   **动态加载/显示主应用界面**（文件上传、时间线按钮、评论区等）。

4.  **后续 API 请求**：
    *   **前端**：调用 `makeAuthenticatedRequest` 函数。
    *   `makeAuthenticatedRequest` 从 `currentPassword` 获取密码，添加到 `X-Custom-Auth-Key` 请求头。
    *   **后端 (Worker)**：现有 API 端点 (`/api/upload`, `/api/timeline`, 文件 GET/DELETE) 继续使用 `isAuthenticated` 验证请求头。

## 流程示意图 (Mermaid Sequence Diagram)

```mermaid
sequenceDiagram
    participant User
    participant Browser (Frontend JS)
    participant Worker (Backend)

    User->>Browser: 访问 /
    Browser->>Worker: GET /
    Worker-->>Browser: 返回登录页面 HTML
    Browser->>User: 显示登录表单

    User->>Browser: 输入密码并点击登录
    Browser->>Worker: POST /api/login (含密码)
    Worker->>Worker: 验证密码 vs AUTH_KEY_SECRET
    alt 密码正确
        Worker-->>Browser: { success: true } (200 OK)
        Browser->>Browser: 存储密码到 currentPassword
        Browser->>Browser: 隐藏登录表单, 显示主应用 UI
        Browser->>User: 显示主应用界面 (上传/时间线等)
    else 密码错误
        Worker-->>Browser: { success: false, error: "..." } (401 Unauthorized)
        Browser->>User: 在登录表单显示错误信息
    end

    Note over User, Worker: 用户现在已登录 (密码存储在前端内存)

    User->>Browser: 点击 "查看时间线"
    Browser->>Browser: 调用 renderTimelineView()
    Browser->>Browser: 调用 makeAuthenticatedRequest('/api/timeline')
    Browser->>Worker: GET /api/timeline (含 X-Custom-Auth-Key: currentPassword)
    Worker->>Worker: isAuthenticated() 验证 Header
    Worker-->>Browser: 返回时间线数据 (JSON)
    Browser->>Browser: 渲染时间线数据
    Browser->>User: 显示时间线内容

    User->>Browser: 选择文件并点击 "上传文件"
    Browser->>Browser: 调用 startUpload() -> uploadFile()
    Browser->>Worker: POST /api/upload (含文件数据 和 X-Custom-Auth-Key)
    Worker->>Worker: isAuthenticated() 验证 Header
    Worker->>Worker: 存储文件到 R2
    Worker-->>Browser: 返回上传成功信息 (JSON)
    Browser->>Browser: 更新文件列表 UI
    Browser->>User: 显示上传成功提示
```

## 总结

*   **入口分离：** 登录入口与主应用分开。
*   **状态管理：** 前端通过 `currentPassword` 管理登录状态。
*   **动态 UI：** 主应用界面登录成功后动态呈现。
*   **认证一致性：** 所有受保护 API 依赖登录凭证。
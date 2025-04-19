/**
 * @typedef {object} Env
 * @property {R2Bucket} MY_BUCKET - The R2 bucket binding.
 * @property {string} AUTH_KEY_SECRET - The secret key for authentication.
 */

// 将 index.html 的内容存储为一个常量字符串，使用字符串拼接避免模板字符串嵌套问题
const HTML_CONTENT = "<!DOCTYPE html>\n" +
"<html lang=\"zh-CN\">\n" +
"<head>\n" +
"    <meta charset=\"UTF-8\">\n" +
"    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n" +
"    <title>Cloudflare R2 文件管理器</title>\n" +
"    <style>\n" +
"        body { font-family: sans-serif; margin: 20px; }\n" +
"        #auth-container { margin-bottom: 20px; }\n" +
"        #auth-container input { margin-right: 10px; }\n" +
"        #file-management { display: none; } /* Initially hidden */\n" +
"        #file-list { border: 1px solid #ccc; padding: 10px; min-height: 100px; margin-bottom: 20px; }\n" +
"        .file-item { margin-bottom: 5px; padding: 5px; border-bottom: 1px dashed #eee; display: flex; justify-content: space-between; }\n" +
"        .file-item button { margin-left: 10px; }\n" +
"        #upload-form { margin-top: 20px; }\n" +
"    </style>\n" +
"</head>\n" +
"<body>\n" +
"    <h1>Cloudflare R2 文件管理器</h1>\n" +
"\n" +
"    <div id=\"auth-container\">\n" +
"        <label for=\"password\">密码:</label>\n" +
"        <input type=\"password\" id=\"password\" name=\"password\">\n" +
"        <button id=\"login-button\">登录</button>\n" +
"        <p id=\"auth-status\"></p>\n" +
"    </div>\n" +
"\n" +
"    <div id=\"file-management\">\n" +
"        <h2>文件列表</h2>\n" +
"        <div id=\"file-list\">\n" +
"            加载中...\n" +
"        </div>\n" +
"\n" +
"        <h2>上传文件</h2>\n" +
"        <form id=\"upload-form\">\n" +
"            <input type=\"file\" id=\"file-input\" required>\n" +
"            <button type=\"submit\">上传</button>\n" +
"        </form>\n" +
"    </div>\n" +
"\n" +
"    <script>\n" +
"        const passwordInput = document.getElementById('password');\n" +
"        const loginButton = document.getElementById('login-button');\n" +
"        const authStatus = document.getElementById('auth-status');\n" +
"        const fileManagementDiv = document.getElementById('file-management');\n" +
"        const fileListDiv = document.getElementById('file-list');\n" +
"        const uploadForm = document.getElementById('upload-form');\n" +
"        const fileInput = document.getElementById('file-input');\n" +
"\n" +
"        let currentPassword = ''; // Store password temporarily\n" +
"\n" +
"        // Function to make authenticated requests\n" +
"        async function makeAuthenticatedRequest(url, options = {}) {\n" +
"            const headers = new Headers(options.headers);\n" +
"            if (currentPassword) {\n" +
"                headers.set('X-Custom-Auth-Key', currentPassword);\n" +
"            }\n" +
"            const response = await fetch(url, { ...options, headers });\n" +
"            // Check for authentication failure status codes\n" +
"            if (response.status === 401 || response.status === 403) {\n" +
"                // Read error message from response body if available\n" +
"                const errorText = await response.text();\n" +
"                authStatus.textContent = '认证失败: ' + (errorText || '请检查密码。');\n" +
"                fileManagementDiv.style.display = 'none';\n" +
"                currentPassword = ''; // Clear password on auth failure\n" +
"                return null; // Indicate failure\n" +
"            }\n" +
"             // Check for other potential API errors\n" +
"            if (!response.ok) {\n" +
"                const errorText = await response.text();\n" +
"                alert('API 请求失败: ' + (errorText || response.statusText));\n" +
"                return null;\n" +
"            }\n" +
"            return response;\n" +
"        }\n" +
"\n" +
"        // Function to fetch and display file list\n" +
"        async function fetchFileList() {\n" +
"            fileListDiv.innerHTML = '加载中...';\n" +
"            // Request file list from the root path\n" +
"            const response = await makeAuthenticatedRequest('/', { method: 'GET' });\n" +
"            if (!response) return; // Stop if authentication failed\n" +
"\n" +
"            // Check if the response is JSON (for file list) or HTML (if auth failed after initial load)\n" +
"            const contentType = response.headers.get(\"content-type\");\n" +
"            if (contentType && contentType.includes(\"application/json\")) {\n" +
"                const files = await response.json();\n" +
"                fileListDiv.innerHTML = ''; // Clear loading message\n" +
"\n" +
"                if (files.length === 0) {\n" +
"                    fileListDiv.textContent = '存储桶中没有文件。';\n" +
"                    return;\n" +
"                }\n" +
"\n" +
"                files.forEach(file => {\n" +
"                    const fileItem = document.createElement('div');\n" +
"                    fileItem.classList.add('file-item');\n" +
"                    fileItem.innerHTML = \n" +
"                        '<span>' + file.key + ' (大小: ' + file.size + ' 字节)</span>' +\n" +
"                        '<div>' +\n" +
"                            '<button class=\"download-button\" data-key=\"' + file.key + '\">下载</button>' +\n" +
"                            '<button class=\"delete-button\" data-key=\"' + file.key + '\">删除</button>' +\n" +
"                        '</div>';\n" +
"                    fileListDiv.appendChild(fileItem);\n" +
"                });\n" +
"\n" +
"                // Add event listeners for download and delete buttons\n" +
"                fileListDiv.querySelectorAll('.download-button').forEach(button => {\n" +
"                    button.addEventListener('click', handleDownload);\n" +
"                });\n" +
"                fileListDiv.querySelectorAll('.delete-button').forEach(button => {\n" +
"                    button.addEventListener('click', handleDelete);\n" +
"                });\n" +
"            } else {\n" +
"                 // If not JSON, assume it's an unauthorized response (e.g., HTML login page)\n" +
"                 authStatus.textContent = '会话已过期或认证失败，请重新登录。';\n" +
"                 fileManagementDiv.style.display = 'none';\n" +
"                 currentPassword = '';\n" +
"            }\n" +
"        }\n" +
"\n" +
"        // Handle login button click\n" +
"        loginButton.addEventListener('click', async () => {\n" +
"            const password = passwordInput.value;\n" +
"            if (!password) {\n" +
"                authStatus.textContent = '请输入密码。';\n" +
"                return;\n" +
"            }\n" +
"            currentPassword = password;\n" +
"\n" +
"            // Attempt to fetch file list to verify password\n" +
"            const response = await makeAuthenticatedRequest('/');\n" +
"            if (response && response.headers.get(\"content-type\").includes(\"application/json\")) {\n" +
"                authStatus.textContent = '登录成功！';\n" +
"                fileManagementDiv.style.display = 'block';\n" +
"                fetchFileList(); // Load files after successful login\n" +
"            } else {\n" +
"                 authStatus.textContent = '认证失败，请检查密码。';\n" +
"                 fileManagementDiv.style.display = 'none';\n" +
"                 currentPassword = '';\n" +
"            }\n" +
"        });\n" +
"\n" +
"        // Handle file download\n" +
"        async function handleDownload(event) {\n" +
"            const key = event.target.dataset.key;\n" +
"            const response = await makeAuthenticatedRequest('/' + key, { method: 'GET' }); // GET request for specific file\n" +
"             if (!response) return;\n" +
"\n" +
"            // Create a blob from the response and create a download link\n" +
"            const blob = await response.blob();\n" +
"            const url = window.URL.createObjectURL(blob);\n" +
"            const a = document.createElement('a');\n" +
"            a.href = url;\n" +
"            a.download = key.split('/').pop(); // Suggest filename from key\n" +
"            document.body.appendChild(a);\n" +
"            a.click();\n" +
"            a.remove();\n" +
"            window.URL.revokeObjectURL(url); // Clean up\n" +
"        }\n" +
"\n" +
"        // Handle file delete\n" +
"        async function handleDelete(event) {\n" +
"            const key = event.target.dataset.key;\n" +
"            if (confirm('确定要删除文件 \"' + key + '\" 吗？')) {\n" +
"                const response = await makeAuthenticatedRequest('/' + key, { method: 'DELETE' });\n" +
"                if (response) {\n" +
"                    alert('文件 \"' + key + '\" 删除成功！');\n" +
"                    fetchFileList(); // Refresh list\n" +
"                }\n" +
"            }\n" +
"        }\n" +
"\n" +
"        // Handle file upload form submission\n" +
"        uploadForm.addEventListener('submit', async (event) => {\n" +
"            event.preventDefault();\n" +
"            const file = fileInput.files[0];\n" +
"            if (!file) {\n" +
"                alert('请选择要上传的文件。');\n" +
"                return;\n" +
"            }\n" +
"\n" +
"            const key = file.name; // Use original file name as R2 key\n" +
"            const response = await makeAuthenticatedRequest('/' + key, {\n" +
"                method: 'PUT',\n" +
"                body: file, // File object can be used directly as body\n" +
"                // Optional: Set Content-Type based on file type\n" +
"                 headers: { 'Content-Type': file.type || 'application/octet-stream' }\n" +
"            });\n" +
"\n" +
"            if (response) {\n" +
"                alert('文件 \"' + key + '\" 上传成功！');\n" +
"                fileInput.value = ''; // Clear input\n" +
"                fetchFileList(); // Refresh list\n" +
"            }\n" +
"        });\n" +
"\n" +
"         // Allow logging in by pressing Enter in the password field\n" +
"         passwordInput.addEventListener('keypress', function(event) {\n" +
"            if (event.key === 'Enter') {\n" +
"                event.preventDefault(); // Prevent default form submission\n" +
"                loginButton.click(); // Trigger login button click\n" +
"            }\n" +
"        });\n" +
"\n" +
"    </script>\n" +
"</body>\n" +
"</html>\n";


/**
 * Simple authorization function using a pre-shared key in a custom header.
 * @param {Request} request - The incoming request.
 * @param {Env} env - The Worker environment.
 * @returns {boolean} - True if the request is authorized, false otherwise.
 */
const isAuthenticated = (request, env) => {
  const receivedAuthKey = request.headers.get("X-Custom-Auth-Key");
  console.log("Received Auth Key:", receivedAuthKey);
  console.log("Expected Secret:", env.AUTH_KEY_SECRET); // Log the secret for debugging
  // Check for a custom header containing the secret key
  // Replace 'X-Custom-Auth-Key' with your preferred header name if needed
  return receivedAuthKey === env.AUTH_KEY_SECRET;
};

export default {
  /**
   * The fetch handler for the Worker.
   * @param {Request} request - The incoming request.
   * @param {Env} env - The Worker environment.
   * @param {ExecutionContext} ctx - The execution context.
   * @returns {Promise<Response>} - The response to the request.
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const key = url.pathname.slice(1);

    // If the request is for the root path
    if (key === "") {
        // If it's a GET request and has the authentication header, attempt to list files
        if (request.method === "GET" && request.headers.has("X-Custom-Auth-Key")) {
            if (!isAuthenticated(request, env)) {
                console.warn("Authentication failed for root path GET with auth header.");
                 // Return JSON indicating authentication failure for frontend to handle
                return new Response(JSON.stringify({ error: "Authentication failed" }), {
                    status: 401, // Unauthorized
                    headers: { "Content-Type": "application/json" },
                });
            }
             // Handle LIST operation
            try {
                const listed = await env.MY_BUCKET.list();
                // Return file list as JSON
                return new Response(JSON.stringify(listed.objects), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (error) {
                 console.error("Error listing objects:", error);
                 return new Response("Error listing objects: " + error.message, { status: 500 });
            }
        } else if (request.method === "GET") {
            // If it's a GET request without the authentication header, serve the HTML content
             return new Response(HTML_CONTENT, {
                headers: {
                    "Content-Type": "text/html;charset=UTF-8",
                },
            });
        } else {
            // Other methods on root path are not allowed
             return new Response("Method Not Allowed on root path", {
                status: 405,
                headers: { Allow: "GET" },
            });
        }
    }


    // For all other requests (non-root path), require authentication for file operations
    if (!isAuthenticated(request, env)) {
        console.warn("Authentication failed for file operation."); // Log authentication failure
        // Return a plain text or JSON error for API requests
        return new Response("Unauthorized: Authentication failed. Check Worker logs for details.", {
            status: 401, // Unauthorized
            headers: { "Content-Type": "text/plain" },
        });
    }

    // Handle authenticated file operations on non-root paths
    switch (request.method) {
      case "PUT":
        // Handle PUT (Upload Object)
        try {
          await env.MY_BUCKET.put(key, request.body, {
              // Optionally add Content-Type from request headers
              httpMetadata: request.headers.has('Content-Type') ? { contentType: request.headers.get('Content-Type') } : undefined,
          });
          return new Response("Put " + key + " successfully!");
        } catch (error) {
           console.error("Error putting object:", error);
           return new Response("Error putting object: " + error.message, { status: 500 });
        }

      case "GET":
        // Handle GET (Download Specific Object)
        try {
          const object = await env.MY_BUCKET.get(key);

          if (object === null) {
            return new Response("Object Not Found", { status: 404 });
          }

          const headers = new Headers();
          object.writeHttpMetadata(headers);
          headers.set("etag", object.httpEtag);

          return new Response(object.body, {
            headers,
          });
        } catch (error) {
            console.error("Error getting object:", error);
            return new Response("Error getting object: " + error.message, { status: 500 });
        }


      case "DELETE":
        // Handle DELETE (Delete Object)
        try {
            await env.MY_BUCKET.delete(key);
            return new Response("Deleted!");
        } catch (error) {
            console.error("Error deleting object:", error);
            return new Response("Error deleting object: " + error.message, { status: 500 });
        }

      default:
        // Method Not Allowed for authenticated file operations
        return new Response("Method Not Allowed for file operations", {
          status: 405,
          headers: {
            Allow: "PUT, GET, DELETE", // Allowed methods for file operations
          },
        });
    }
  },
};
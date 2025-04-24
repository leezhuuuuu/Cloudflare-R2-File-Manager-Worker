/**
 * @typedef {object} Env
 * @property {R2Bucket} MY_BUCKET - The R2 bucket binding.
 * @property {string} AUTH_KEY_SECRET - The secret key for authentication.
 */

/**
 * Simple authorization function using a pre-shared key in a custom header.
 * @param {Request} request - The incoming request.
 * @param {Env} env - The Worker environment.
 * @returns {boolean} - True if the request is authorized, false otherwise.
 */
const isAuthenticated = (request, env) => {
  const receivedAuthKey = request.headers.get("X-Custom-Auth-Key");
  if (!env.AUTH_KEY_SECRET) {
      console.error("AUTH_KEY_SECRET is not set in Worker environment!");
      return false; // Cannot authenticate without a secret
  }
  // Basic check, consider more robust methods (e.g., hashing) in production
  return receivedAuthKey === env.AUTH_KEY_SECRET;
};

export default {
  /**
   * The fetch handler for the Worker.
   * Assumes static HTML (login.html, index.html) is served by Cloudflare Pages/Sites from './public'.
   * This worker focuses on API routes and direct R2 object access.
   * @param {Request} request - The incoming request.
   * @param {Env} env - The Worker environment.
   * @param {ExecutionContext} ctx - The execution context.
   * @returns {Promise<Response>} - The response to the request.
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // Remove leading and trailing slashes, handle empty path for root
    const key = url.pathname.replace(/^\/|\/$/g, "");

    // Serve login page for root path GET requests
    if (key === "" && request.method === "GET") {
        // Note: In a real Pages setup, Pages would handle serving this.
        // This is a fallback if only the Worker is deployed or Pages isn't configured.
        // Ideally, fetch the content from R2 or include it directly if small.
        // For simplicity here, we'll return a placeholder or redirect.
        // Let's return the actual login HTML content.
        const LOGIN_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>登录 - CloudDrop</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { display: flex; justify-content: center; align-items: center; min-height: 100vh; background-color: #f3f4f6; }
        .login-card { background-color: white; padding: 2rem; border-radius: 0.5rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); width: 100%; max-width: 24rem; }
        .error-message { color: #ef4444; font-size: 0.875rem; margin-top: 0.5rem; min-height: 1.25rem; }
    </style>
</head>
<body>
    <div class="login-card">
        <h1 class="text-2xl font-bold text-center text-gray-800 mb-6">CloudDrop 登录</h1>
        <form id="login-form">
            <div class="mb-4">
                <label for="password" class="block text-sm font-medium text-gray-700 mb-1">访问密码</label>
                <input type="password" id="password" name="password" required
                       class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
            </div>
            <button type="submit" id="login-button"
                    class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition duration-150 ease-in-out disabled:opacity-50">
                登录
            </button>
            <p id="error-message" class="error-message text-center"></p>
        </form>
    </div>

    <script>
        const loginForm = document.getElementById('login-form');
        const passwordInput = document.getElementById('password');
        const loginButton = document.getElementById('login-button');
        const errorMessage = document.getElementById('error-message');

        // Clear any previous auth key on login page load
        localStorage.removeItem('cloudDropAuthKey');

        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const password = passwordInput.value;
            if (!password) {
                errorMessage.textContent = '请输入密码。';
                return;
            }

            errorMessage.textContent = ''; // Clear previous error
            loginButton.disabled = true;
            loginButton.textContent = '登录中...';

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ password: password }),
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        // Login successful: Store password and redirect to main app
                        localStorage.setItem('cloudDropAuthKey', password);
                        window.location.href = '/app'; // Redirect to the main app page
                    } else {
                         // Should not happen if response.ok is true, but handle defensively
                         errorMessage.textContent = data.error || '登录失败，请重试。';
                         loginButton.disabled = false;
                         loginButton.textContent = '登录';
                    }
                } else {
                    // Login failed (e.g., 401 Unauthorized)
                    const errorData = await response.json().catch(() => ({ error: '密码错误或服务器问题。' }));
                    errorMessage.textContent = errorData.error || '密码错误或服务器问题。';
                    passwordInput.value = ''; // Clear password field
                    loginButton.disabled = false;
                    loginButton.textContent = '登录';
                }
            } catch (error) {
                console.error('Login request failed:', error);
                errorMessage.textContent = '登录请求失败，请检查网络连接。';
                loginButton.disabled = false;
                loginButton.textContent = '登录';
            }
        });
    </script>
</body>
</html>`;
        return new Response(LOGIN_HTML, {
             headers: { "Content-Type": "text/html;charset=UTF-8" }
        });
    }

    // Serve main application page (index.html) for /app path GET requests
    if (key === "app" && request.method === "GET") {
        console.log("Accessing /app route. Serving index.html without worker-side auth check (frontend handles auth).");
        // Frontend (index.html) is responsible for checking localStorage and redirecting if needed.
        // Worker simply serves the main application page here.

        // Return the actual index.html content
        const INDEX_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CloudDrop | 文件共享与评论</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/axios/1.6.7/axios.min.js"></script>
    <script>
        // Tailwind CSS configuration, including a custom dark mode palette
        tailwind.config = {
            darkMode: 'class', // Enable dark mode based on 'dark' class
            theme: {
                extend: {
                    colors: {
                        dark: { // Custom dark mode color palette
                            100: '#E5E7EB',
                            200: '#D1D5DB',
                            300: '#9CA3AF',
                            400: '#6B7280',
                            500: '#4B5563',
                            600: '#374151',
                            700: '#1F2937',
                            800: '#111827',
                            900: '#0F172A',
                        }
                    }
                }
            }
        }
    </script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        /* Custom styles for file upload section */
        .dropzone {
            border: 2px dashed #3b82f6;
            transition: all 0.3s ease;
        }
        .dark .dropzone {
            border-color: #60a5fa;
        }
        .dropzone.active {
            border-color: #10b981;
            background-color: rgba(16, 185, 129, 0.05);
        }
        .dark .dropzone.active {
            background-color: rgba(16, 185, 129, 0.1);
        }
        .file-item {
            transition: all 0.3s ease;
        }
        .file-item:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .dark .file-item:hover {
            box-shadow: 0 4px 6px -1px rgba(255, 255, 255, 0.1);
        }
        .progress-bar {
            transition: width 0.3s ease;
            height: 6px;
            background-color: #3b82f6; /* Blue default */
        }
        .progress-bar.progress-green {
            background-color: #10b981; /* Green for 90%+ */
        }
        .upload-speed {
            font-size: 0.75rem;
            color: #6b7280;
        }

        /* Custom styles for comment section */
        /* Removed .comment-replies and .comment-editor styles */
        .comment-actions {
            opacity: 0;
            transition: opacity 0.2s ease;
        }
        .comment:hover .comment-actions {
            opacity: 1;
        }

        /* General Animations & Utilities */
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        .animate-pulse {
            animation: pulse 2s infinite;
        }
        .theme-toggle {
            transition: all 0.3s ease;
        }
        .theme-toggle:hover {
            transform: rotate(30deg);
        }
        .toast {
            transition: all 0.3s ease;
            transform: translateY(20px);
            opacity: 0;
        }
        .toast.show {
            transform: translateY(0);
            opacity: 1;
        }
         .truncate {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .max-w-xs {
            max-width: 12rem; /* Adjusted for smaller screens */
        }
         @media (min-width: 640px) { /* Apply on larger screens */
            .max-w-xs {
                 max-width: 16rem;
            }
        }

        /* Timeline specific styles */
        .timeline-container {
            /* Add styles for the timeline layout */
        }
        .timeline-date-group {
            margin-bottom: 2rem;
        }
        .timeline-files {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); /* Responsive grid */
            gap: 1rem;
        }
        .timeline-file-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            cursor: pointer;
            padding: 0.5rem;
            border-radius: 0.5rem;
            transition: background-color 0.2s ease;
            position: relative; /* For absolute positioning of delete button */
            overflow: hidden; /* Ensure delete button stays within bounds */
        }
        .timeline-file-item:hover {
            background-color: rgba(0, 0, 0, 0.05); /* Subtle hover effect */
        }
         .dark .timeline-file-item:hover {
             background-color: rgba(255, 255, 255, 0.05);
         }
        .timeline-file-icon {
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
        }
        .timeline-file-thumbnail {
            width: 100%;
            height: 100px; /* Fixed height for thumbnails */
            object-fit: cover;
            border-radius: 0.25rem;
            margin-bottom: 0.5rem;
        }
         .timeline-file-name {
             font-size: 0.875rem; /* text-sm */
             color: #4b5563; /* gray-600 */
             word-break: break-all; /* Prevent long names from overflowing */
             padding: 0 0.25rem; /* Add padding */
         }
         .dark .timeline-file-name {
             color: #d1d5db; /* dark-200 */
         }
         /* Ensure body takes full height */
         html, body { height: 100%; margin: 0; }
         body { background-color: #f9fafb; /* bg-gray-50 */ }
         .dark body { background-color: #111827; /* dark:bg-dark-800 */ }
    </style>
</head>
<body class="bg-gray-50 dark:bg-dark-800 min-h-screen pb-12">
    <!-- This container holds the main app content -->
    <div id="app-container" class="container mx-auto px-4 py-12 max-w-4xl">
        <div class="absolute top-4 right-4">
            <button id="theme-toggle" class="theme-toggle p-2 rounded-full bg-gray-200 dark:bg-dark-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-dark-500" aria-label="切换主题"> <i id="theme-icon" class="fas fa-moon"></i>
            </button>
        </div>

        <div class="text-center mb-12">
            <h1 class="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">CloudDrop</h1>
            <p class="text-gray-600 dark:text-gray-300">安全地将您的文件上传到云端并进行讨论</p> <div class="mt-4 flex justify-center space-x-2">
                <span class="inline-block w-3 h-3 rounded-full bg-blue-400 dark:bg-blue-500"></span>
                <span class="inline-block w-3 h-3 rounded-full bg-green-400 dark:bg-green-500"></span>
                <span class="inline-block w-3 h-3 rounded-full bg-purple-400 dark:bg-purple-500"></span>
            </div>
        </div>

        <div class="bg-white dark:bg-dark-700 rounded-xl shadow-lg overflow-hidden mb-8 p-6 flex items-center justify-between flex-wrap gap-4">
             <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-200">选择日期</h2> <div class="flex items-center gap-4">
                 <input type="date" id="date-selector" class="p-2 rounded-lg border border-gray-300 dark:border-dark-600 bg-gray-100 dark:bg-dark-800 text-gray-800 dark:text-gray-200">
                 <button id="view-timeline-btn" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition flex items-center text-sm sm:text-base">
                     <i class="fas fa-images mr-2"></i> 查看时间线 </button>
             </div>
        </div>

        <div id="main-content">
            <div class="bg-white dark:bg-dark-700 rounded-xl shadow-lg overflow-hidden mb-12">
                <div class="p-6 border-b border-gray-200 dark:border-dark-600">
                    <div class="flex items-center justify-between flex-wrap gap-4">
                        <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-200">上传文件</h2> <div class="flex space-x-2 flex-wrap justify-end">
                            <button id="folder-btn" class="px-4 py-2 bg-gray-100 dark:bg-dark-600 hover:bg-gray-200 dark:hover:bg-dark-500 text-gray-700 dark:text-gray-200 rounded-lg transition flex items-center text-sm sm:text-base">
                                <i class="fas fa-folder-open mr-2"></i> <span class="hidden sm:inline">添加</span> 文件夹 </button>
                            <button id="file-btn" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center text-sm sm:text-base">
                                <i class="fas fa-plus mr-2"></i> <span class="hidden sm:inline">添加</span> 文件 </button>
                            <input type="file" id="file-input" class="hidden" multiple>
                            <input type="file" id="folder-input" class="hidden" webkitdirectory directory multiple>
                        </div>
                    </div>
                </div>

                <div id="dropzone" class="dropzone p-8 m-6 rounded-lg text-center cursor-pointer">
                    <div class="flex flex-col items-center justify-center py-12">
                        <div class="w-20 h-20 mb-6 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                            <i class="fas fa-cloud-upload-alt text-3xl text-blue-500 dark:text-blue-400"></i>
                        </div>
                        <h3 class="text-xl font-medium text-gray-700 dark:text-gray-200 mb-2">将文件拖放到此处</h3> <p class="text-gray-500 dark:text-gray-400 mb-4">或点击浏览您的文件</p> <div class="flex space-x-2 flex-wrap justify-center">
                            <span class="px-3 py-1 bg-gray-100 dark:bg-dark-600 text-gray-600 dark:text-gray-300 rounded-full text-sm mb-2">JPG, PNG, GIF</span>
                            <span class="px-3 py-1 bg-gray-100 dark:bg-dark-600 text-gray-600 dark:text-gray-300 rounded-full text-sm mb-2">PDF</span>
                            <span class="px-3 py-1 bg-gray-100 dark:bg-dark-600 text-gray-600 dark:text-gray-300 rounded-full text-sm mb-2">DOCX, TXT</span>
                            <span class="px-3 py-1 bg-gray-100 dark:bg-dark-600 text-gray-600 dark:text-gray-300 rounded-full text-sm mb-2">ZIP, RAR</span>
                        </div>
                    </div>
                </div>

                <div id="file-list" class="px-6 pb-6">
                    <div id="empty-state" class="text-center py-8">
                        <i class="fas fa-file-alt text-4xl text-gray-300 dark:text-dark-500 mb-4"></i>
                        <p class="text-gray-500 dark:text-gray-400">此日期没有文件</p> </div>
                    </div>

                <div class="p-6 bg-gray-50 dark:bg-dark-600 border-t border-gray-200 dark:border-dark-500 flex flex-col sm:flex-row justify-between items-center">
                    <div class="text-sm text-gray-500 dark:text-gray-300 mb-4 sm:mb-0">
                        <span id="total-size">0 MB</span> 已选择 </div>
                    <button id="upload-btn" class="w-full sm:w-auto px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                        <i class="fas fa-cloud-upload-alt mr-2"></i> 上传文件 </button>
                </div>
            </div>

            <div class="bg-white dark:bg-dark-700 rounded-xl shadow-lg overflow-hidden">
                <div class="p-6 border-b border-gray-200 dark:border-dark-600">
                    <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-200">评论 (<span id="comment-count">0</span>)</h2> </div>

                <div id="comments-list" class="p-6">
                     <div id="empty-comments-state" class="text-center py-8">
                        <i class="fas fa-comment-alt text-4xl text-gray-300 dark:text-dark-500 mb-4"></i>
                        <p class="text-gray-500 dark:text-gray-400">此日期没有评论</p> </div>
                    </div>

                <div class="p-6 bg-gray-50 dark:bg-dark-600 border-t border-gray-200 dark:border-dark-500">
                    <div class="flex items-start">
                        <img src="https://i.pravatar.cc/40?u=current.user" alt="用户头像" class="w-10 h-10 rounded-full mr-3 object-cover"> <div class="flex-1">
                            <textarea
                                id="new-comment-textarea"
                                class="w-full p-3 rounded-lg border border-gray-200 dark:border-dark-600 bg-transparent text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 outline-none focus:border-blue-500"
                                placeholder="发表评论..." rows="3"
                            ></textarea>
                            <div class="mt-2 flex flex-col sm:flex-row justify-between items-center">
                                <div class="flex items-center space-x-4 mb-3 sm:mb-0">
                                    <button class="text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition text-sm sm:text-base" aria-label="附加图片"> <i class="fas fa-image"></i>
                                    </button>
                                    <button class="text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition text-sm sm:text-base" aria-label="提及用户"> <i class="fas fa-at"></i>
                                    </button>
                                    </div>
                                <button id="post-comment-btn" class="w-full sm:w-auto px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base" disabled>
                                    发表评论 </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div id="timeline-view" class="hidden">
            <div class="bg-white dark:bg-dark-700 rounded-xl shadow-lg overflow-hidden p-6 mb-8">
                <div class="flex items-center justify-between mb-6">
                    <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-200">文件时间线</h2> <button id="back-to-main-btn" class="px-4 py-2 bg-gray-200 dark:bg-dark-600 hover:bg-gray-300 dark:hover:bg-dark-500 text-gray-700 dark:text-gray-200 rounded-lg transition flex items-center text-sm sm:text-base">
                        <i class="fas fa-arrow-left mr-2"></i> 返回 </button>
                </div>
                <div id="timeline-content" class="timeline-container">
                    <!-- Timeline content will be loaded here -->
                </div>
            </div>
        </div>

        <div class="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
            <p>文件在传输和存储过程中均已加密。 <a href="#" class="text-blue-500 dark:text-blue-400 hover:underline">了解更多</a></p> </div>
    </div>

    <div id="toast-container" class="fixed bottom-6 right-6 space-y-2 z-50"></div>

    <script>
        document.addEventListener('DOMContentLoaded', function() {
            // --- Authentication Check ---
            let currentPassword = localStorage.getItem('cloudDropAuthKey');
            if (!currentPassword) {
                console.log('No auth key found, redirecting to login.');
                window.location.href = '/'; // Redirect to login page
                return; // Stop script execution
            }
            console.log('Auth key found, proceeding with app initialization.');

            // --- Globals & Constants ---
            const themeToggle = document.getElementById('theme-toggle');
            const themeIcon = document.getElementById('theme-icon');
            const html = document.documentElement;
            const dateSelector = document.getElementById('date-selector');
            const dropzone = document.getElementById('dropzone');
            const fileInput = document.getElementById('file-input');
            const folderInput = document.getElementById('folder-input');
            const fileBtn = document.getElementById('file-btn');
            const folderBtn = document.getElementById('folder-btn');
            const uploadBtn = document.getElementById('upload-btn');
            const fileList = document.getElementById('file-list');
            const emptyState = document.getElementById('empty-state');
            const totalSizeElement = document.getElementById('total-size');
            const toastContainer = document.getElementById('toast-container');
            const commentsList = document.getElementById('comments-list');
            const emptyCommentsState = document.getElementById('empty-comments-state');
            const newCommentTextarea = document.getElementById('new-comment-textarea');
            const postCommentBtn = document.getElementById('post-comment-btn');
            const commentCountElement = document.getElementById('comment-count');
            const viewTimelineBtn = document.getElementById('view-timeline-btn');
            const mainContentArea = document.getElementById('main-content');
            const timelineViewArea = document.getElementById('timeline-view');
            const timelineContent = document.getElementById('timeline-content');
            const backToMainBtn = document.getElementById('back-to-main-btn');

            let currentDate;
            const dataByDate = {}; // For current day uploads & comments (client-side cache)
            let files = []; // Refers to files for the current date being prepared for upload
            let totalSize = 0;
            let uploading = false;

            const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
            const ALLOWED_TYPES = [
                'image/jpeg', 'image/png', 'image/gif',
                'application/pdf',
                'application/msword', // .doc
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
                'text/plain', // .txt
                'application/zip',
                'application/x-rar-compressed', // .rar
                'application/x-zip-compressed', // Common zip type
                'application/octet-stream' // Generic binary, allow for now
                // Add more specific types as needed
            ];

            // --- Theme Toggle Functionality ---
            const savedTheme = localStorage.getItem('theme') || 'dark';
            html.classList.add(savedTheme);
            updateThemeIcon(savedTheme);

            themeToggle.addEventListener('click', () => {
                html.classList.toggle('dark');
                const currentTheme = html.classList.contains('dark') ? 'dark' : 'light';
                localStorage.setItem('theme', currentTheme);
                updateThemeIcon(currentTheme);
            });

            function updateThemeIcon(theme) {
                themeIcon.className = \`fas \${theme === 'dark' ? 'fa-moon' : 'fa-sun'}\`;
            }

            // --- Date Management Functionality ---
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            currentDate = \`\${year}-\${month}-\${day}\`;
            dateSelector.value = currentDate;

            if (!dataByDate[currentDate]) {
                dataByDate[currentDate] = { files: [], comments: [] };
            }
            files = dataByDate[currentDate].files; // Initialize files ref

            dateSelector.addEventListener('change', (event) => {
                currentDate = event.target.value;
                if (!dataByDate[currentDate]) {
                    dataByDate[currentDate] = { files: [], comments: [] };
                }
                 // Clear current file selection when date changes
                 dataByDate[currentDate].files = [];
                 files = dataByDate[currentDate].files;
                 renderDataForDate(currentDate); // Render empty lists for the new date
                 // TODO: Optionally fetch existing comments/files for the selected date from backend
            });

            // --- Authentication Helper ---
            async function makeAuthenticatedRequest(url, options = {}) {
                const headers = new Headers(options.headers);
                const password = currentPassword; // Use password loaded at script start
                if (password) {
                    headers.set('X-Custom-Auth-Key', password);
                } else {
                    console.error("Auth key is missing for request!");
                    showToast('认证凭证丢失，请重新登录。', 'error');
                    window.location.href = '/';
                    return null; // Prevent request without password
                }

                try {
                    const response = await fetch(url, { ...options, headers });

                    if (response.status === 401 || response.status === 403) {
                        const errorText = await response.text();
                        console.error("Authentication failed:", response.status, errorText);
                        let errorMsg = '认证失败: 请重新登录。';
                        try {
                            const errorJson = JSON.parse(errorText);
                            if (errorJson.error) errorMsg = \`认证失败: \${errorJson.error}\`;
                        } catch(e) { /* Ignore if not JSON */ }
                        showToast(errorMsg, 'error');
                        localStorage.removeItem('cloudDropAuthKey');
                        currentPassword = '';
                        window.location.href = '/'; // Redirect on auth failure
                        return null;
                    }

                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error('API Request Failed:', response.status, errorText);
                        let errorMsg = \`API 请求失败: \${response.statusText}\`;
                        try {
                            const errorJson = JSON.parse(errorText);
                            if (errorJson.error) errorMsg = \`API 请求失败: \${errorJson.error}\`;
                            if (errorJson.details) errorMsg += \` (\${errorJson.details})\`;
                        } catch(e) { /* Ignore if not JSON */ }
                        showToast(errorMsg, 'error');
                        return null;
                    }
                    return response; // Return successful response
                } catch (error) {
                    console.error('Network or fetch error:', error);
                    showToast('网络错误或请求无法完成: ' + error.message, 'error');
                    return null;
                }
            }

            // --- File Upload Functionality ---
            fileBtn.addEventListener('click', () => fileInput.click());
            folderBtn.addEventListener('click', () => folderInput.click());
            dropzone.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', handleFiles);
            folderInput.addEventListener('change', handleFiles);

            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                dropzone.addEventListener(eventName, preventDefaults, false);
            });
            ['dragenter', 'dragover'].forEach(eventName => {
                dropzone.addEventListener(eventName, highlight, false);
            });
            ['dragleave', 'drop'].forEach(eventName => {
                dropzone.addEventListener(eventName, unhighlight, false);
            });
            dropzone.addEventListener('drop', handleDrop, false);

            function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }
            function highlight() { dropzone.classList.add('active'); }
            function unhighlight() { dropzone.classList.remove('active'); }

            function handleDrop(e) {
                const dt = e.dataTransfer;
                handleFiles({ target: { files: dt.files } });
            }

            function handleFiles(e) {
                const newFiles = Array.from(e.target.files);
                if (newFiles.length === 0) return;
                const validFiles = [];
                newFiles.forEach(file => {
                    let reason = null;
                    const fileType = file.type || '';
                    if (file.size > MAX_FILE_SIZE) reason = \`文件太大 (\${formatFileSize(file.size)})\`;
                    else if (!ALLOWED_TYPES.includes(fileType) && fileType && !fileType.startsWith('image/')) reason = \`不支持的文件类型 (\${fileType || '未知'})\`;

                    if (reason) showToast(\`拒绝 "\${file.name}": \${reason}\`, 'error');
                    else {
                        const exists = dataByDate[currentDate].files.some(f => f.name === file.name && f.size === file.size);
                        if (exists) showToast(\`文件 "\${file.name}" 已在待上传列表中\`, 'info');
                        else validFiles.push(file);
                    }
                });

                dataByDate[currentDate].files = [...dataByDate[currentDate].files, ...validFiles];
                files = dataByDate[currentDate].files;
                updateFileList();
                updateTotalSize();
                fileInput.value = '';
                folderInput.value = '';
            }

            function updateFileList() {
                fileList.innerHTML = '';
                fileList.appendChild(emptyState);
                emptyState.style.display = files.length === 0 ? 'block' : 'none';

                files.forEach((file, index) => {
                    const fileItem = document.createElement('div');
                    fileItem.setAttribute('data-file-index', index);
                    fileItem.className = 'file-item bg-white dark:bg-dark-600 rounded-lg p-4 mb-3 shadow-sm';

                    const fileType = file.type || '';
                    let iconClass = 'fas fa-file text-gray-500 dark:text-gray-400';
                    if (fileType.includes('image')) iconClass = 'fas fa-image text-blue-500 dark:text-blue-400';
                    else if (fileType.includes('pdf')) iconClass = 'fas fa-file-pdf text-red-500 dark:text-red-400';
                    else if (fileType.includes('word') || fileType.includes('document')) iconClass = 'fas fa-file-word text-blue-600 dark:text-blue-400';
                    else if (fileType.includes('zip') || fileType.includes('compressed') || fileType.includes('archive')) iconClass = 'fas fa-file-archive text-yellow-500 dark:text-yellow-400';
                    else if (fileType.includes('text')) iconClass = 'fas fa-file-alt text-gray-500 dark:text-gray-400';

                    let statusHTML = '';
                    if (file.status === 'completed') statusHTML = '<span class="text-green-600 dark:text-green-400"><i class="fas fa-check-circle mr-1"></i> 已完成</span>';
                    else if (file.status === 'error') statusHTML = \`<span class="text-red-600 dark:text-red-400"><i class="fas fa-exclamation-circle mr-1"></i> 失败\${file.error ? ': ' + file.error : ''}</span>\`;
                    else if (file.progress > 0) statusHTML = file.speed ? \`\${file.speed} MB/s\` : '上传中...';
                    else statusHTML = '待上传';

                    fileItem.innerHTML = \`
                        <div class="flex items-center justify-between mb-2 flex-wrap">
                            <div class="flex items-center min-w-0 flex-1">
                                <div class="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mr-3 flex-shrink-0">
                                    <i class="\${iconClass}"></i>
                                </div>
                                <div class="min-w-0">
                                    <div class="font-medium text-gray-800 dark:text-gray-200 truncate max-w-xs sm:max-w-sm" title="\${file.name}">\${file.name}</div>
                                    <div class="text-sm text-gray-500 dark:text-gray-400">\${formatFileSize(file.size)}</div>
                                </div>
                            </div>
                            <div class="flex items-center flex-shrink-0 ml-2">
                                <button class="remove-file-btn w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-dark-500 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-red-500 transition" aria-label="Remove file">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        </div>
                        <div class="w-full bg-gray-200 dark:bg-dark-500 rounded-full h-1.5 overflow-hidden mt-1">
                            <div class="progress-bar rounded-full \${file.progress >= 90 ? 'progress-green' : ''}" style="width: \${file.progress || 0}%;"></div>
                        </div>
                        <div class="upload-speed mt-1 text-right text-xs" data-file-index="\${index}">\${statusHTML}</div>
                    \`;

                    fileItem.querySelector('.remove-file-btn').addEventListener('click', (e) => {
                        e.stopPropagation();
                        removeFile(index);
                    });

                    fileList.appendChild(fileItem);
                });
            }

            function removeFile(indexToRemove) {
                if (indexToRemove >= 0 && indexToRemove < files.length) {
                    dataByDate[currentDate].files.splice(indexToRemove, 1);
                    files = dataByDate[currentDate].files;
                    updateFileList();
                    updateTotalSize();
                }
            }

            function updateTotalSize() {
                totalSize = dataByDate[currentDate].files.reduce((sum, file) => sum + (file.size || 0), 0);
                totalSizeElement.textContent = formatFileSize(totalSize);
                uploadBtn.disabled = dataByDate[currentDate].files.length === 0 || uploading;
            }

            function formatFileSize(bytes) {
                if (bytes === 0) return '0 Bytes';
                const k = 1024;
                const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
            }

            uploadBtn.addEventListener('click', startUpload);

            async function startUpload() {
                const filesToUpload = dataByDate[currentDate].files.filter(f => f.status !== 'completed' && f.status !== 'error');
                if (filesToUpload.length === 0 || uploading) {
                    if (filesToUpload.length === 0 && !uploading) showToast("没有待上传的文件。", "info");
                    return;
                }

                uploading = true;
                uploadBtn.disabled = true;
                uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> 正在上传...';

                const uploadPromises = filesToUpload.map((file) => {
                    const currentIndex = dataByDate[currentDate].files.findIndex(f => f === file);
                    return currentIndex !== -1 ? uploadFileWithAxios(file, currentIndex) : Promise.resolve({ status: 'skipped' }); // Using Axios version
                });

                const results = await Promise.allSettled(uploadPromises);

                uploading = false;
                let successfulUploads = 0;
                let failedUploads = 0;

                results.forEach((result, i) => {
                     const originalFile = filesToUpload[i];
                     const finalIndex = dataByDate[currentDate].files.findIndex(f => f === originalFile);
                     if (finalIndex !== -1) {
                         if (result.status === 'fulfilled' && result.value.success) {
                             successfulUploads++;
                             dataByDate[currentDate].files[finalIndex].status = 'completed';
                             dataByDate[currentDate].files[finalIndex].progress = 100;
                             dataByDate[currentDate].files[finalIndex].key = result.value.fileName;
                         } else {
                             failedUploads++;
                             dataByDate[currentDate].files[finalIndex].status = 'error';
                             dataByDate[currentDate].files[finalIndex].progress = 0;
                             // Extract error message from rejected promise or failed response
                             const errorMessage = result.reason?.response?.data?.error || result.reason?.message || result.value?.error || '上传失败';
                             dataByDate[currentDate].files[finalIndex].error = errorMessage;
                             console.error(\`Upload failed for \${originalFile.name}:\`, result.reason || result.value);
                         }
                     }
                });

                updateFileList();

                if (successfulUploads > 0) {
                    showToast(\`\${successfulUploads} 个文件已成功上传！\`, 'success');
                }
                if (failedUploads > 0) {
                    showToast(\`\${failedUploads} 个文件上传失败。\`, 'error', 8000);
                }

                // Clear successfully uploaded files from the staging list
                dataByDate[currentDate].files = dataByDate[currentDate].files.filter(f => f.status !== 'completed');
                files = dataByDate[currentDate].files;
                updateFileList();
                updateTotalSize();

                uploadBtn.innerHTML = '<i class="fas fa-cloud-upload-alt mr-2"></i> 上传文件';
            }

            // --- Upload using Axios for Progress Tracking ---
            async function uploadFileWithAxios(file, index) {
                 return new Promise((resolve, reject) => {
                    const formData = new FormData();
                    formData.append('file', file);
                    // formData.append('date', currentDate); // Optional: send date

                    // Update UI: Set status and initial progress
                    dataByDate[currentDate].files[index].status = 'uploading';
                    dataByDate[currentDate].files[index].progress = 0;
                    dataByDate[currentDate].files[index].speed = 0;
                    updateFileList(); // Show 'uploading' state

                    const progressBar = fileList.querySelector(\`.file-item[data-file-index="\${index}"] .progress-bar\`);
                    const statusElement = fileList.querySelector(\`.upload-speed[data-file-index="\${index}"]\`);
                    let lastLoaded = 0;
                    let startTime = performance.now();

                    axios.post('/api/upload', formData, {
                        headers: {
                            'Content-Type': 'multipart/form-data',
                            'X-Custom-Auth-Key': currentPassword // Add authentication header
                        },
                        onUploadProgress: (progressEvent) => {
                            const loaded = progressEvent.loaded;
                            const total = progressEvent.total;
                            const progress = total ? Math.min(100, Math.round((loaded / total) * 100)) : 0; // Handle total=0 or undefined

                            const currentTime = performance.now();
                            const timeDiff = (currentTime - startTime) / 1000; // seconds
                            const bytesSinceLast = loaded - lastLoaded;
                            const speed = bytesSinceLast / (1024 * 1024) / (timeDiff > 0 ? timeDiff : 1e-3); // MB/s

                            lastLoaded = loaded;
                            startTime = currentTime;

                            // Update file object state
                            dataByDate[currentDate].files[index].progress = progress;
                            dataByDate[currentDate].files[index].speed = speed.toFixed(2);

                            // Update UI elements directly
                            if (progressBar) {
                                progressBar.style.width = \`\${progress}%\`;
                                progressBar.classList.toggle('progress-green', progress >= 90);
                            }
                            if (statusElement) {
                                statusElement.textContent = progress < 100 ? \`\${speed.toFixed(2)} MB/s\` : '处理中...';
                            }
                        }
                    })
                    .then(response => {
                        // Axios considers 2xx successful
                        console.log(\`Upload successful for \${file.name}:\`, response.data);
                        resolve(response.data); // Resolve with { success: true, fileName: ... }
                    })
                    .catch(error => {
                        console.error(\`Upload failed for \${file.name}:\`, error.response?.data || error.message);
                        // Reject with the error object so allSettled can capture it
                        reject(error);
                    });
                 });
            }


            // --- Toast Notification System ---
            function showToast(message, type = 'info', duration = 5000) {
                const toast = document.createElement('div');
                toast.className = \`toast px-6 py-3 rounded-lg shadow-lg flex items-center text-white text-sm \${
                    type === 'error' ? 'bg-red-500' :
                    type === 'success' ? 'bg-green-500' : 'bg-blue-500'
                }\`;
                const icon = type === 'error' ? 'fa-exclamation-circle' : type === 'success' ? 'fa-check-circle' : 'fa-info-circle';
                toast.innerHTML = \`<i class="fas \${icon} mr-2"></i><span>\${message}</span>\`;
                toastContainer.appendChild(toast);
                setTimeout(() => toast.classList.add('show'), 10);
                setTimeout(() => {
                    toast.classList.remove('show');
                    setTimeout(() => toast.remove(), 300);
                }, duration);
            }

            // --- Comment System Functionality (UI only - Needs Backend) ---
            newCommentTextarea.addEventListener('input', () => {
                postCommentBtn.disabled = newCommentTextarea.value.trim().length === 0;
            });

            function attachLikeButtonListeners() {
                commentsList.querySelectorAll('.like-button').forEach(button => {
                    const oldListener = button.dataset.listener;
                    if (oldListener) button.removeEventListener('click', window[oldListener]);

                    const icon = button.querySelector('i');
                    const countSpan = button.querySelector('span');
                    const newListener = function() {
                        const currentCount = parseInt(countSpan.textContent);
                        const isLiked = icon.classList.contains('fas');
                        icon.className = \`mr-2 \${isLiked ? 'far' : 'fas'} fa-thumbs-up\`;
                        countSpan.textContent = isLiked ? currentCount - 1 : currentCount + 1;
                        button.classList.toggle('text-blue-600', !isLiked);
                        button.classList.toggle('dark:text-blue-400', !isLiked);
                    };
                     const listenerName = \`likeListener_\${Date.now()}_\${Math.random().toString(36).substring(7)}\`;
                     window[listenerName] = newListener;
                     button.dataset.listener = listenerName;
                     button.addEventListener('click', newListener);
                });
            }

            postCommentBtn.addEventListener('click', () => {
                const commentText = newCommentTextarea.value.trim();
                if (commentText === "") return;
                console.log("Posting main comment:", commentText, "for date:", currentDate);
                const newComment = {
                    id: Date.now(), author: '当前用户', time: '刚刚', text: commentText, likes: 0
                };
                if (!dataByDate[currentDate]) dataByDate[currentDate] = { files: [], comments: [] };
                dataByDate[currentDate].comments.push(newComment);
                renderCommentsForDate(currentDate);
                showToast('评论发表成功！', 'success');
                newCommentTextarea.value = '';
                postCommentBtn.disabled = true;
            });

             function renderCommentsForDate(date) {
                 const comments = dataByDate[date]?.comments || [];
                 commentsList.innerHTML = '';
                 commentsList.appendChild(emptyCommentsState);
                 emptyCommentsState.style.display = comments.length === 0 ? 'block' : 'none';

                 comments.forEach(comment => {
                     const commentElement = document.createElement('div');
                     commentElement.className = 'comment mb-6 group';
                     commentElement.setAttribute('data-comment-id', comment.id);
                     commentElement.innerHTML = \`
                         <div class="flex items-start">
                             <img src="https://i.pravatar.cc/40?u=\${comment.author.replace(/\\s+/g, '.')}-\${comment.id}" alt="用户头像" class="w-10 h-10 rounded-full mr-3 object-cover">
                             <div class="flex-1">
                                 <div class="flex items-center justify-between mb-1">
                                     <div>
                                         <span class="font-medium text-gray-800 dark:text-gray-200">\${comment.author}</span>
                                         <span class="text-sm text-gray-500 dark:text-gray-400 ml-2">\${comment.time}</span>
                                     </div>
                                     <div class="comment-actions flex items-center space-x-3 text-sm">
                                         <button class="text-gray-500 hover:text-red-600 dark:hover:text-red-400" aria-label="举报"><i class="fas fa-flag"></i></button>
                                     </div>
                                 </div>
                                 <p class="text-gray-700 dark:text-gray-300 break-words">\${comment.text}</p>
                                 <div class="flex items-center mt-2 space-x-4 text-sm text-gray-500 dark:text-gray-400">
                                     <button class="like-button flex items-center hover:text-blue-600 dark:hover:text-blue-400 transition">
                                         <i class="far fa-thumbs-up mr-2"></i> <span>\${comment.likes}</span>
                                     </button>
                                 </div>
                             </div>
                         </div>
                     \`;
                     commentsList.appendChild(commentElement);
                 });
                 commentCountElement.textContent = comments.length;
                 attachLikeButtonListeners();
            }


            // --- Timeline View Functionality ---
            viewTimelineBtn.addEventListener('click', renderTimelineView);
            backToMainBtn.addEventListener('click', hideTimelineView);

            async function renderTimelineView() {
                console.log("Rendering timeline view via API...");
                mainContentArea.classList.add('hidden');
                timelineViewArea.classList.remove('hidden');
                timelineContent.innerHTML = \`<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-2xl text-blue-500"></i><p class="text-gray-500 dark:text-gray-400 mt-2">加载时间线数据中...</p></div>\`;

                try {
                    const response = await makeAuthenticatedRequest('/api/timeline');
                    if (!response) {
                        timelineContent.innerHTML = '<p class="text-red-500 dark:text-red-400 text-center">加载时间线失败。请检查认证或网络连接。</p>';
                        return;
                    }
                    const timelineData = await response.json();
                    timelineContent.innerHTML = '';

                    const datesWithData = Object.keys(timelineData).sort().reverse();

                    if (datesWithData.length === 0) {
                        timelineContent.innerHTML = \`<div class="text-center py-8"><i class="fas fa-box-open text-4xl text-gray-300 dark:text-dark-500 mb-4"></i><p class="text-gray-500 dark:text-gray-400">时间线中没有文件。</p></div>\`;
                        return;
                    }

                    datesWithData.forEach(date => {
                        const dateGroup = document.createElement('div');
                        dateGroup.className = 'timeline-date-group';
                        const dateHeader = document.createElement('h3');
                        dateHeader.className = 'text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 border-b border-gray-200 dark:border-dark-600 pb-2';
                        dateHeader.textContent = date;
                        const filesContainer = document.createElement('div');
                        filesContainer.className = 'timeline-files';
                        const filesForDate = timelineData[date];

                        filesForDate.forEach(file => {
                            const fileItem = document.createElement('div');
                            fileItem.className = 'timeline-file-item group relative bg-gray-100 dark:bg-dark-600 rounded-lg shadow-sm'; // Added group relative
                            fileItem.setAttribute('data-key', file.key);
                            fileItem.setAttribute('title', \`名称: \${file.key.split('/').pop()}\\n大小: \${formatFileSize(file.size)}\\n上传于: \${new Date(file.uploaded).toLocaleString()}\`);
                            fileItem.addEventListener('click', () => handleDownload({ currentTarget: fileItem }));

                            const deleteBtn = document.createElement('button');
                            deleteBtn.className = 'absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500/60 hover:bg-red-600 text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10'; // Ensure button is above image
                            deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
                            deleteBtn.ariaLabel = '删除文件';
                            deleteBtn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                handleDeleteFile(file.key);
                            });
                            fileItem.appendChild(deleteBtn);

                            const fileType = file.contentType || '';
                            let filePreviewHTML = '';
                            if (fileType.startsWith('image/')) {
                                const imageUrl = \`/\${file.key}\`;
                                filePreviewHTML = \`<img src="\${imageUrl}" alt="\${file.key.split('/').pop()}" class="timeline-file-thumbnail" loading="lazy" onerror="this.onerror=null; this.src='https://placehold.co/100x100/e0e0e0/000000?text=Error'; this.style.objectFit='contain';">\`;
                            } else {
                                let iconClass = 'fas fa-file text-gray-500 dark:text-gray-400';
                                if (fileType.includes('pdf')) iconClass = 'fas fa-file-pdf text-red-500 dark:text-red-400';
                                else if (fileType.includes('word') || fileType.includes('document')) iconClass = 'fas fa-file-word text-blue-600 dark:text-blue-400';
                                else if (fileType.includes('zip') || fileType.includes('compressed') || fileType.includes('archive')) iconClass = 'fas fa-file-archive text-yellow-500 dark:text-yellow-400';
                                else if (fileType.includes('text')) iconClass = 'fas fa-file-alt text-gray-500 dark:text-gray-400';
                                filePreviewHTML = \`<div class="timeline-file-icon"><i class="\${iconClass}"></i></div>\`;
                            }
                            // Use innerHTML carefully, maybe append elements instead
                            const previewContainer = document.createElement('div');
                            previewContainer.innerHTML = filePreviewHTML;
                            fileItem.appendChild(previewContainer);

                            const nameDiv = document.createElement('div');
                            nameDiv.className = 'timeline-file-name';
                            nameDiv.textContent = file.key.split('/').pop();
                            fileItem.appendChild(nameDiv);

                            filesContainer.appendChild(fileItem);
                        });
                        dateGroup.appendChild(dateHeader);
                        dateGroup.appendChild(filesContainer);
                        timelineContent.appendChild(dateGroup);
                    });
                    console.log("Timeline rendering complete via API.");
                } catch (error) {
                    console.error("Error fetching or rendering timeline:", error);
                    timelineContent.innerHTML = \`<p class="text-red-500 dark:text-red-400 text-center">加载时间线时出错: \${error.message}</p>\`;
                }
            }

            function hideTimelineView() {
                timelineViewArea.classList.add('hidden');
                mainContentArea.classList.remove('hidden');
            }

            // --- Download Helper ---
            async function handleDownload(event) {
                const key = event.currentTarget.dataset.key;
                if (!key) {
                    showToast("无法下载：文件标识丢失。", "error"); return;
                }
                console.log(\`Attempting to download: \${key}\`);
                showToast(\`开始下载 \${key.split('/').pop()}...\`, 'info', 2000);
                const response = await makeAuthenticatedRequest('/' + key, { method: 'GET' });
                if (!response) return;
                try {
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = key.split('/').pop();
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    window.URL.revokeObjectURL(url);
                } catch (error) {
                    console.error("Error creating download link:", error);
                    showToast(\`创建下载链接时出错: \${error.message}\`, 'error');
                }
            }

             // --- Delete Helper (for Timeline) ---
             async function handleDeleteFile(key) {
                 if (!key) {
                     showToast("无法删除：文件标识丢失。", "error"); return;
                 }
                 if (confirm(\`确定要永久删除文件 "\${key.split('/').pop()}" 吗？\`)) {
                     console.log(\`Attempting to delete: \${key}\`);
                     showToast(\`正在删除 \${key.split('/').pop()}...\`, 'info', 2000);
                     const response = await makeAuthenticatedRequest('/' + key, { method: 'DELETE' });
                     if (response) {
                          try {
                              const result = await response.json();
                              if (result.success) {
                                   showToast(\`文件 "\${key.split('/').pop()}" 删除成功！\`, 'success');
                                   renderTimelineView(); // Refresh timeline
                              } else {
                                   showToast(\`删除文件 "\${key.split('/').pop()}" 失败: \${result.error || '未知错误'}\`, 'error');
                              }
                          } catch (e) {
                               showToast(\`删除文件 "\${key.split('/').pop()}" 时响应解析失败\`, 'error');
                          }
                     }
                 }
             }

            // --- Initial Load ---
            renderDataForDate(currentDate);
            updateTotalSize();
            // Optionally load timeline on start
            // renderTimelineView();

            console.log("CloudDrop App Initialized.");
        });
    </script>
</body>
</html>`;
        return new Response(INDEX_HTML, {
             headers: { "Content-Type": "text/html;charset=UTF-8" }
         });
    }


    // Helper to create JSON responses with CORS headers for API routes
    const jsonResponse = (data, options = {}) => {
        const headers = new Headers(options.headers);
        headers.set("Content-Type", "application/json");
        // Allow requests from the origin where the HTML is served
        // Best practice: Replace '*' with your actual domain in production
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("Access-Control-Allow-Headers", "Content-Type, X-Custom-Auth-Key");
        headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        return new Response(JSON.stringify(data), { ...options, headers });
    };

     // Handle CORS preflight requests for all API routes and file operations
     if (request.method === "OPTIONS") {
        // Respond to OPTIONS requests allowing necessary headers and methods
        return new Response(null, {
            headers: {
                "Access-Control-Allow-Origin": "*", // Be more specific in production
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", // Include PUT if needed later
                "Access-Control-Allow-Headers": "Content-Type, X-Custom-Auth-Key", // Ensure auth header is allowed
                "Access-Control-Max-Age": "86400", // Cache preflight response for 1 day
            },
        });
    }


    // --- API Routes ---

    // Handle Login API (No auth required for this specific endpoint)
    if (key === "api/login" && request.method === "POST") {
        try {
            const { password } = await request.json();
            if (!env.AUTH_KEY_SECRET) {
                 console.error("AUTH_KEY_SECRET is not set!");
                 return jsonResponse({ success: false, error: "服务器配置错误" }, { status: 500 });
            }
            if (password === env.AUTH_KEY_SECRET) {
                console.log("Login successful via API");
                return jsonResponse({ success: true });
            } else {
                console.warn("Login failed: Incorrect password via API");
                return jsonResponse({ success: false, error: "密码错误" }, { status: 401 });
            }
        } catch (error) {
             console.error("Login API error:", error);
             // Avoid exposing internal details in the error message
             return jsonResponse({ success: false, error: "登录请求处理失败" }, { status: 400 });
        }
    }

    // Handle file upload API (Requires Authentication)
    if (key === "api/upload" && request.method === "POST") {
      if (!isAuthenticated(request, env)) {
        console.warn("Unauthorized API upload attempt");
        return jsonResponse({ error: "认证失败" }, { status: 401 });
      }

      try {
         const formData = await request.formData();
         const file = formData.get("file");
         // Optionally get date if sent from frontend: const date = formData.get("date") || new Date().toISOString().split('T')[0];
         const datePrefix = new Date().toISOString().split('T')[0]; // Use current date for prefix

         if (!file || !(file instanceof File)) {
             console.error("API Upload: File not found in FormData");
             return jsonResponse({ error: "未找到文件或无效的文件数据" }, { status: 400 });
         }
         // Construct a unique key, e.g., using date and timestamp/randomness
         const uniqueFileName = `${datePrefix}/${Date.now()}-${file.name}`;

         console.log(`API Upload: Uploading file: ${uniqueFileName}, Type: ${file.type || 'N/A'}, Size: ${file.size}`);

         const uploadedObject = await env.MY_BUCKET.put(uniqueFileName, file.stream(), {
             httpMetadata: { contentType: file.type || "application/octet-stream" },
             // customMetadata: { uploadedBy: 'user-id' }, // Example custom metadata
         });

         console.log(`API Upload: Success: ${uploadedObject.key}`);
         // Return the generated key so the frontend knows the final path if needed
         return jsonResponse({ success: true, fileName: uploadedObject.key });

      } catch (error) {
        console.error("API Upload error:", error);
        return jsonResponse({ error: "上传失败", details: error.message || String(error) }, { status: 500 });
      }
    }

    // Handle timeline data API (Requires Authentication)
    if (key === "api/timeline" && request.method === "GET") {
      if (!isAuthenticated(request, env)) {
        console.warn("Unauthorized API timeline attempt");
        return jsonResponse({ error: "认证失败" }, { status: 401 });
      }
      try {
        console.log("API Timeline: Fetching object list...");
        // Consider using options like prefix or delimiter for larger buckets
        const listed = await env.MY_BUCKET.list();
        console.log(`API Timeline: Found ${listed.objects.length} objects.`);
        const timelineData = {};
        // Group objects by date prefix (YYYY-MM-DD) if present, otherwise by upload date
        for (const obj of listed.objects) {
            const keyParts = obj.key.split('/');
            // Check if the first part looks like a date YYYY-MM-DD
            const dateKey = keyParts.length > 1 && /^\d{4}-\d{2}-\d{2}$/.test(keyParts[0])
                               ? keyParts[0]
                               : obj.uploaded.toISOString().split('T')[0]; // Fallback to upload date

            if (!timelineData[dateKey]) timelineData[dateKey] = [];
            timelineData[dateKey].push({
                key: obj.key,
                size: obj.size,
                uploaded: obj.uploaded.toISOString(),
                contentType: obj.httpMetadata?.contentType || "application/octet-stream"
            });
        }
        // Sort files within each date group by upload time (newest first)
        for (const date in timelineData) {
            timelineData[date].sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded));
        }
        console.log("API Timeline: Data grouped and sorted.");
        return jsonResponse(timelineData);
      } catch (error) {
        console.error("API Timeline fetch error:", error);
        return jsonResponse({ error: "获取时间线数据失败", details: error.message || String(error) }, { status: 500 });
      }
    }


    // --- Direct R2 Object Access (Requires Authentication) ---
    // This handles GET requests for specific file keys (e.g., /2023-10-27/1698391...)
    // It excludes known paths like '', 'app', 'api/*'
    const isFileAccess = key !== "" && key !== "app" && !key.startsWith("api/");

    if (isFileAccess) {
        // ALL direct file access (GET/DELETE) requires authentication first
        if (!isAuthenticated(request, env)) {
            console.warn(`Unauthorized direct access attempt: ${request.method} /${key}`);
            // For API-like access (likely from JS), return 401/403
            // If a user tries to directly access a file URL, redirecting might be better UX,
            // but since our app fetches via JS, 401 is appropriate.
             return new Response("Unauthorized: Authentication required.", {
                 status: 401,
                 headers: { "Content-Type": "text/plain" }
             });
        }

        // Handle Authenticated GET (Download)
        if (request.method === "GET") {
            try {
                console.log(`Authenticated GET: Fetching object: ${key}`);
                const object = await env.MY_BUCKET.get(key);

                if (object === null) {
                    console.warn(`Authenticated GET: Object not found: ${key}`);
                    return new Response("Object Not Found", { status: 404 });
                }
                console.log(`Authenticated GET: Found object: ${key}, Size: ${object.size}`);

                const headers = new Headers();
                object.writeHttpMetadata(headers); // Copies metadata like Content-Type
                headers.set("etag", object.httpEtag); // Set ETag for caching
                // Consider adding Content-Disposition for download prompting
                // headers.set('Content-Disposition', `attachment; filename="${key.split('/').pop()}"`);

                return new Response(object.body, { headers });
            } catch (error) {
                console.error(`Authenticated GET: Error getting object ${key}:`, error);
                return new Response(`Error getting object: ${error.message}`, { status: 500 });
            }
        }

        // Handle Authenticated DELETE
        if (request.method === "DELETE") {
            try {
                console.log(`Authenticated DELETE: Deleting object: ${key}`);
                await env.MY_BUCKET.delete(key);
                console.log(`Authenticated DELETE: Success: ${key}`);
                // Return JSON confirmation for frontend handling
                return jsonResponse({ success: true, message: `Deleted ${key}` });
            } catch (error) {
                console.error(`Authenticated DELETE: Error deleting object ${key}:`, error);
                return jsonResponse({ error: "删除失败", details: error.message || String(error) }, { status: 500 });
            }
        }

         // Reject other methods (PUT, POST) on direct file paths unless specifically handled
         console.warn(`Authenticated Access: Method ${request.method} not allowed for key: ${key}`);
         return new Response("Method Not Allowed for this resource", {
             status: 405,
             headers: { Allow: "GET, DELETE" } // Only allow GET and DELETE on existing keys
         });
    }


    // --- Fallback ---
    // If the request didn't match any API route or authenticated file access pattern,
    // and assuming static assets are handled by Pages/Sites, this likely means a 404.
    // Log the unhandled request for debugging.
    console.log(`Unhandled request: ${request.method} ${request.url}`);
    // Return a generic 404
    return new Response("Not Found", { status: 404 });
  },
};
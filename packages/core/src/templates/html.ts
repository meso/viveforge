export const getDashboardHTML = (user: any, jsFile: string, cssFile: string) => {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vibebase Dashboard</title>
    <script type="module" crossorigin src="/assets/${jsFile}"></script>
    <link rel="stylesheet" crossorigin href="/assets/${cssFile}">
    <script>
      // 認証状態をグローバル変数として設定
      window.VIBEBASE_AUTH = {
        isAuthenticated: true,
        user: ${JSON.stringify({
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name
        })}
      };
    </script>
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>`
}

export const getAuthErrorHTML = (title: string, message: string, details?: string) => {
  return `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Vibebase</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="bg-gray-100 min-h-screen flex items-center justify-center">
    <div class="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
      <div class="text-center">
        <div class="text-red-500 text-6xl mb-4">⚠️</div>
        <h1 class="text-2xl font-bold text-gray-900 mb-2">${title}</h1>
        <p class="text-gray-600 mb-2">${message}</p>
        ${details ? `<p class="text-sm text-gray-500 mb-4">${details}</p>` : ''}
        <a href="/auth/login" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          再度ログイン
        </a>
      </div>
    </div>
  </body>
</html>`
}

export const getAccessDeniedHTML = (username: string) => {
  return `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>アクセス拒否 - Vibebase</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="bg-gray-100 min-h-screen flex items-center justify-center">
    <div class="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
      <div class="text-center">
        <div class="text-red-500 text-6xl mb-4">🚫</div>
        <h1 class="text-2xl font-bold text-gray-900 mb-2">アクセス拒否</h1>
        <p class="text-gray-600 mb-4">このアカウントは管理者として登録されていません。</p>
        <p class="text-sm text-gray-500">管理者にGitHubユーザー名「${username}」の追加を依頼してください。</p>
      </div>
    </div>
  </body>
</html>`
}

export const getLoginHTML = (loginUrl: string) => {
  return `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ログイン - Vibebase</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="bg-gray-50 min-h-screen flex items-center justify-center">
    <div class="max-w-md mx-auto bg-white rounded-lg shadow-md p-8">
      <div class="text-center">
        <div class="mb-6">
          <h1 class="text-3xl font-bold text-gray-900 mb-2">Vibebase</h1>
          <p class="text-gray-600">Personal BaaS for Vibe Coders</p>
        </div>
        
        <div class="mb-6">
          <div class="text-6xl mb-4">🔐</div>
          <h2 class="text-xl font-semibold text-gray-900 mb-2">ログインが必要です</h2>
          <p class="text-gray-600 text-sm mb-4">
            Vibebaseを使用するにはGitHubアカウントでのログインが必要です。<br>
            データベース、ストレージ、認証機能をご利用いただけます。
          </p>
        </div>
        
        <button 
          onclick="window.location.href='${loginUrl}'"
          class="w-full bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors duration-200 font-medium flex items-center justify-center gap-3"
        >
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          GitHubでログイン
        </button>
        
        <p class="mt-4 text-xs text-gray-500">
          認証は <a href="https://github.com/vibebase/vibebase-auth" target="_blank" class="text-blue-600 hover:text-blue-500">vibebase-auth</a> を使用します
        </p>
      </div>
    </div>
  </body>
</html>`
}

export const getLogoutHTML = () => {
  return `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ログアウト - Vibebase</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="bg-gray-100 min-h-screen flex items-center justify-center">
    <div class="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
      <div class="text-center">
        <div class="text-blue-500 text-6xl mb-4">👋</div>
        <h1 class="text-2xl font-bold text-gray-900 mb-2">ログアウト完了</h1>
        <p class="text-gray-600 mb-4">ログアウトしました。ご利用ありがとうございました。</p>
        <a href="/" class="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">
          ホームに戻る
        </a>
      </div>
    </div>
    <script>
      // 3秒後にホームにリダイレクト
      setTimeout(() => {
        window.location.href = '/';
      }, 3000);
    </script>
  </body>
</html>`
}
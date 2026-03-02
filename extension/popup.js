document.addEventListener('DOMContentLoaded', async () => {
    const loginContainer = document.getElementById('login-container');
    const loggedInContainer = document.getElementById('logged-in-container');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const messageEl = document.getElementById('message');
    const currentUserEl = document.getElementById('current-user');

    const { auth_token, auth_user, api_url } = await chrome.storage.local.get(['auth_token', 'auth_user', 'api_url']);

    const defaultApiUrl = 'https://emlak.altaydev.com.tr';
    const currentApiUrl = api_url || defaultApiUrl;
    document.getElementById('api-url').value = currentApiUrl;

    if (auth_token && auth_user) {
        showLoggedIn(auth_user.username);
    }

    const toggleSettings = document.getElementById('toggle-settings');
    const apiUrlContainer = document.getElementById('api-url-container');

    toggleSettings.addEventListener('click', () => {
        const isHidden = apiUrlContainer.style.display === 'none';
        apiUrlContainer.style.display = isHidden ? 'block' : 'none';
        toggleSettings.textContent = isHidden ? 'Ayarları Kapat' : 'Sunucu Ayarları';
    });

    loginBtn.addEventListener('click', async () => {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        if (!username || !password) {
            messageEl.textContent = 'Lütfen bilgileri girin.';
            return;
        }

        loginBtn.textContent = 'Giriş yapılıyor...';
        loginBtn.disabled = true;

        try {
            const inputApiUrl = document.getElementById('api-url').value.replace(/\/$/, '');
            await chrome.storage.local.set({ api_url: inputApiUrl });

            const res = await fetch(`${inputApiUrl}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();
            if (data.success) {
                await chrome.storage.local.set({
                    auth_token: data.token,
                    auth_user: data.user
                });
                showLoggedIn(data.user.username);
                messageEl.textContent = '';
            } else {
                messageEl.textContent = data.error || 'Hata oluştu.';
            }
        } catch (err) {
            messageEl.textContent = 'Sunucuya bağlanılamadı.';
        } finally {
            loginBtn.textContent = 'Giriş Yap';
            loginBtn.disabled = false;
        }
    });

    logoutBtn.addEventListener('click', async () => {
        await chrome.storage.local.remove(['auth_token', 'auth_user']);
        showLogin();
    });

    function showLoggedIn(username) {
        loginContainer.style.display = 'none';
        loggedInContainer.style.display = 'block';
        currentUserEl.textContent = username;
    }

    function showLogin() {
        loginContainer.style.display = 'block';
        loggedInContainer.style.display = 'none';
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        messageEl.textContent = '';
    }
});

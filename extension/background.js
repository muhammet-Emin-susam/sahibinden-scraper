// background.js

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'saveRecord') {
        chrome.storage.local.get(['auth_token'], (result) => {
            const token = result.auth_token;
            if (!token) {
                sendResponse({ success: false, error: 'Oturum açılmadı. Lütfen eklenti simgesine tıklayıp giriş yapın.' });
                return;
            }

            fetch('https://emlak.altaydev.com.tr/api/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(message.data)
            })
                .then(async response => {
                    const status = response.status;
                    let data = {};
                    try {
                        data = await response.json();
                    } catch (e) {
                        data = { success: false, error: 'Sunucudan geçersiz bir yanıt alındı.' };
                    }

                    if (status === 401) {
                        if (data.error === 'USER_DELETED') {
                            await chrome.storage.local.remove(['auth_token', 'auth_user']);
                            throw new Error('USER_DELETED');
                        }
                        throw new Error('Oturum süresi doldu. Lütfen eklentiden tekrar giriş yapın.');
                    }
                    if (status === 403) {
                        throw new Error('Yetki hatası. Lütfen tekrar giriş yapın.');
                    }

                    // For all other statuses (200, 400, 409, 500) we pass the parsed data back
                    return data;
                })
                .then(data => sendResponse({ success: true, data }))
                .catch(error => sendResponse({ success: false, error: error.message || error.toString() }));
        });

        return true; // Will respond asynchronously
    }
});

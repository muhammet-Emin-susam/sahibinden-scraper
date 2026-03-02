// content.js

// Function to scrape data from the page
async function scrapeData() {
    const getText = (selector) => document.querySelector(selector)?.innerText?.trim() || '';

    // Wait a bit longer for phone numbers to load via AJAX
    const showPhoneBtn = document.querySelector('#aShowPhone, .show-phone-number, .js-show-phone, a[class*="phone"]');
    if (showPhoneBtn) {
        try {
            showPhoneBtn.click();
            await new Promise(r => setTimeout(r, 1200));
        } catch (e) {
            console.error('Telefona tıklanamadı', e);
        }
    }

    const title = getText('.classifiedDetailTitle h1');
    let price = getText('.classifiedInfo h3').trim();
    if (price.includes('TL')) {
        price = price.split('TL')[0].trim() + ' TL';
    }

    const location = getText('.classifiedInfo h2');

    const properties = {};
    document.querySelectorAll('.classifiedInfoList li, .classified-properties li, .properties-list li').forEach(li => {
        const label = li.querySelector('strong, span.label')?.innerText?.trim();
        const value = li.querySelector('span:not(.label), b')?.innerText?.trim();
        if (label && value) properties[label] = value;
    });

    const description = document.querySelector('#classifiedDescription')?.innerHTML?.trim() || '';

    // ==========================================
    // EXTRACT SELLER NAME (ROBUST HEURISTIC)
    // ==========================================
    let sellerName = '';
    const nameBlacklist = ['Sahibinden', 'Emlak Ofisinden', 'İnşaat Firmasından', 'YIL', 'Üye', 'Mağaza', 'Facebook', 'Twitter', 'E-posta', 'paylaş', 'şikayet', 'favori', 'bildir', 'yazdır', 'Fiyat', 'Tarihçe', 'İlan'];

    // Grab all potential name containers in the right column
    // Adding specific selectors for store listings (e.g. "MİR YAPI & EMLAK" and "İrfan Çelik")
    const nameContainers = document.querySelectorAll(
        '.username-info-area h5, .username-info-area h2, .seller-info-area h5, ' +
        '.storeBox a.storeInfo, .storeBox a.name, .storeBox .name, .storeBox span, ' +
        '.user-info-module_name__string, .user-info h2, .user-info h5, ' +
        '.classified-owner-name, [data-testid="seller-name"], ' +
        '.store-info-area h2, .store-info-area h5, .classified-seller-store span'
    );

    let foundNames = [];
    let phones = []; // Hoist phones array

    // 1. Check ALL <style> tags in the right column for obfuscated pseudo-elements (Sahibinden's active defense)
    const rightRailStyles = document.querySelectorAll('.classifiedDetailRightSide style, aside style, .classified-right-side style, .classifiedUserBox style, .user-info-module style, .username-info-area style');
    rightRailStyles.forEach(style => {
        const txt = style.innerHTML || '';
        // Extract content: '...'
        const match = txt.match(/content:\s*['"](.*?)['"]/);
        if (match && match[1]) {
            const val = match[1].trim();

            // Test if it's a phone number
            if (!val.includes('*')) { // skip encrypted ones like 0 (549) *** ** 61
                const phoneMatch = val.match(/(0\s*\(?[52348]\d{2}\)?\s*\d{3}\s*[\-\.]?\s*\d{2}\s*[\-\.]?\s*\d{2})/g);
                if (phoneMatch) {
                    phones.push(...phoneMatch.map(m => m.replace(/\s+/g, ' ').trim()));
                    return; // Don't process this value as a name
                }
            }

            // Test if it's a name
            if (val.length > 2 && val.length < 40 && !val.includes('*')) {
                const isBlacklisted = nameBlacklist.some(badWord => val.toLowerCase().includes(badWord.toLowerCase()));
                // avoid pure numbers or obvious partial phones
                if (!isBlacklisted && !foundNames.includes(val) && !val.match(/^[\d\s\(\)\-\+]+$/)) {
                    foundNames.push(val);
                }
            }
        }
    });

    // 2. Check for data-content attributes (another Sahibinden defense specifically for phones)
    document.querySelectorAll('[data-content]').forEach(el => {
        const val = el.getAttribute('data-content')?.trim();
        if (val && !val.includes('*')) {
            const phoneMatch = val.match(/(0\s*\(?[52348]\d{2}\)?\s*\d{3}\s*[\-\.]?\s*\d{2}\s*[\-\.]?\s*\d{2})/g);
            if (phoneMatch) {
                phones.push(...phoneMatch.map(m => m.replace(/\s+/g, ' ').trim()));
            } else if (val.length > 2 && val.length < 40) {
                const isBlacklisted = nameBlacklist.some(badWord => val.toLowerCase().includes(badWord.toLowerCase()));
                if (!isBlacklisted && !foundNames.includes(val) && !val.match(/^[\d\s\(\)\-\+]+$/)) {
                    foundNames.push(val);
                }
            }
        }
    });

    for (const el of nameContainers) {
        const text = el.innerText?.trim();
        if (!text || text.length < 3) continue;

        // Skip blacklisted generic names
        const isBlacklisted = nameBlacklist.some(badWord => text.toLowerCase().includes(badWord.toLowerCase()));
        if (!isBlacklisted && !foundNames.includes(text)) {
            foundNames.push(text);
        }
    }

    // Attempt to parse out bold elements if the containers failed
    if (foundNames.length === 0) {
        const anyBold = document.querySelectorAll('.storeBox b, .username-info-area b, .user-info b, aside strong, .classifiedDetailRightSide strong');
        anyBold.forEach(b => {
            let txt = b.innerText?.trim();
            if (txt && txt.length > 2) {
                // Clean up suffixes
                if (txt.includes(' - ')) txt = txt.split(' - ')[0].trim();

                if (!nameBlacklist.some(bw => txt.toLowerCase().includes(bw.toLowerCase())) && !foundNames.includes(txt)) {
                    foundNames.push(txt);
                }
            }
        });
    }

    // Clean up found names to remove any residual UI strings attached with hyphens
    foundNames = foundNames.map(name => {
        if (name.includes(' - ')) return name.split(' - ')[0].trim();
        return name;
    }).filter((item, pos, self) => self.indexOf(item) === pos && item.length > 2);

    if (foundNames.length > 0) {
        // If we found multiple names (like Store Name + Agent Name), join them
        // Just take max 2 unique names to avoid super long strings
        sellerName = foundNames.slice(0, 2).join(' - ');
    }

    // ==========================================
    // EXTRACT SELLER PHONE (REGEX BASED)
    // ==========================================
    let sellerPhone = '';

    // First, try traditional list scanning
    const phoneList = document.querySelectorAll('ul.phones li span, .phone-area span, .phone-number, [data-phone]');
    phoneList.forEach(span => {
        const spanText = span.innerText?.trim() || span.getAttribute('data-phone')?.trim();
        if (spanText && spanText !== '--- -- --' && spanText.length > 8) {
            phones.push(spanText);
        }
    });

    // Strategy 2: Look for 'Cep' label and grab the sibling/parent text
    if (phones.length === 0) {
        document.querySelectorAll('li, div, p, span, h4').forEach(el => {
            const txt = el.innerText?.trim() || '';
            // Only look around lines/elements that actually mention a phone type explicitly
            if (txt.includes('Cep') || txt.includes('İş') || txt.includes('Sabit')) {
                // First try to find Mobile (05XX)
                let phoneMatch = txt.match(/(0\s*5\d{2}\s*\d{3}\s*\d{2}\s*\d{2})/g);

                // Fallback to landlines (02XX, 03XX, 04XX) but explicitly avoid 0850!
                if (!phoneMatch) {
                    phoneMatch = txt.match(/(0\s*[2|3|4]\d{2}\s*\d{3}\s*\d{2}\s*\d{2})/g);
                }

                if (phoneMatch) phones.push(...phoneMatch.map(m => m.replace(/\s+/g, ' ').trim()));
            }
        });
    }

    // If traditional didn't work, scan the entire right rail text using Regex for Turkish phone numbers
    if (phones.length === 0) {
        // Grab smaller chunks of the right rail to avoid customer service footers
        const rightRail = document.querySelector('.classifiedDetailRightSide, .classified-right-side, aside');
        if (rightRail) {
            // Look specifically in the storeBox or user info boxes first
            const boxes = rightRail.querySelectorAll('.storeBox, .user-info-module, .seller-info-area');

            let rootText = '';
            if (boxes.length > 0) {
                boxes.forEach(b => rootText += ' ' + b.innerText);
            } else {
                rootText = rightRail.innerText || '';
            }

            // Priorities: 1. Mobile (05xx) 2. Normal landlines (02xx, 03xx, 04xx)
            // Notice we DO NOT include 8 to avoid 0850!
            let matches = rootText.match(/(0\s*5\d{2}\s*\d{3}\s*\d{2}\s*\d{2})/g);
            if (!matches) {
                matches = rootText.match(/(0\s*[2|3|4]\d{2}\s*\d{3}\s*\d{2}\s*\d{2})/g);
            }

            if (matches && matches.length > 0) {
                phones.push(...matches.map(m => m.replace(/\s+/g, ' ').trim()));
            }
        }
    }

    // Deduplicate and join
    if (phones.length > 0) {
        const uniquePhones = [...new Set(phones)];
        sellerPhone = uniquePhones.join(' / ');
    }

    // Scrape high-quality images
    const images = [];

    // Helper to get high-res URL
    const getHighRes = (img) => {
        let src = img.getAttribute('data-source') || img.getAttribute('data-src') || img.src;
        // Sahibinden uses 'thmb_' for thumbnails and 'x5_' for large images
        if (src) {
            return src.replace('thmb_', 'x5_');
        }
        return null;
    };

    const mainImg = document.querySelector('.classifiedDetailMainPhoto img');
    if (mainImg) {
        const highRes = getHighRes(mainImg);
        if (highRes) images.push(highRes);
    }

    document.querySelectorAll('.classifiedDetailThumbList img').forEach(img => {
        const highRes = getHighRes(img);
        if (highRes && !images.includes(highRes)) {
            images.push(highRes);
        }
    });

    return {
        url: window.location.href,
        ilanNo: properties['İlan No'] || '',
        title,
        price,
        location,
        properties,
        description,
        images,
        sellerName,
        sellerPhone
    };
}

// Create and inject the floating button
async function injectButton() {
    const btn = document.createElement('button');
    btn.id = 'sahibinden-scraper-btn';

    const updateButtonState = async () => {
        const { auth_user } = await chrome.storage.local.get(['auth_user']);
        if (auth_user) {
            btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> ${auth_user.username} - Kaydet`;
            btn.className = 'logged-in';
        } else {
            btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> Giriş Bekleniyor`;
            btn.className = 'logged-out';
        }
    };

    await updateButtonState();

    // Listen for storage changes to update button dynamically if user logs in/out via popup
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.auth_user) {
            updateButtonState();
        }
    });

    btn.onclick = async () => {
        const { auth_token, auth_user } = await chrome.storage.local.get(['auth_token', 'auth_user']);
        if (!auth_token) {
            alert('İlanı kaydetmek için lütfen sağ üstten eklenti simgesine tıklayıp giriş yapın.');
            return;
        }

        const originalHtml = btn.innerHTML;
        const originalClass = btn.className;

        btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" class="animate-spin" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Kaydediliyor...';
        btn.disabled = true;

        const sendSaveRequest = async (saveData) => {
            const response = await chrome.runtime.sendMessage({
                action: 'saveRecord',
                data: saveData
            });

            if (response && response.success) {
                if (response.data && response.data.success === false) {
                    if (response.data.error === 'DUPLICATE_WARNING') {
                        // Show Duplicate Prompt inside Button
                        btn.innerHTML = `
                            <div class="duplicate-prompt">
                                <span class="prompt-text">Bu ilan zaten ekli.<br>Yine de eklensin mi?</span>
                                <label class="prompt-text" style="font-size: 11px; margin-bottom: 4px; display: flex; align-items: center; justify-content: center; gap: 4px; cursor: pointer;">
                                    <input type="checkbox" id="chk-overwrite" checked />
                                    Mevcut kaydın üzerine yaz
                                </label>
                                <div class="prompt-actions">
                                    <div id="btn-force-save" class="btn-yes">Evet Ekle</div>
                                    <div id="btn-cancel-save" class="btn-no">İptal Et</div>
                                </div>
                            </div>
                        `;
                        btn.className = 'warning';
                        btn.disabled = false;

                        // Stop regular flow because we are waiting for user click
                        return new Promise((resolve, reject) => {
                            document.getElementById('btn-force-save').onclick = async (e) => {
                                e.stopPropagation();
                                const isOverwrite = document.getElementById('chk-overwrite')?.checked || false;

                                btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" class="animate-spin" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Zorlayarak Kaydediliyor...';
                                btn.className = originalClass;
                                btn.disabled = true;
                                try {
                                    await sendSaveRequest({ ...saveData, forceSave: true, overwrite: isOverwrite });
                                    resolve();
                                } catch (err) {
                                    reject(err);
                                }
                            };
                            document.getElementById('btn-cancel-save').onclick = (e) => {
                                e.stopPropagation();
                                btn.innerHTML = originalHtml;
                                btn.className = originalClass;
                                resolve('CANCELLED');
                            };
                        });
                    }
                    throw new Error(response.data.message || response.data.error || 'Sunucu hatası');
                }

                btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Kaydedildi!';
                btn.className = 'success';
                setTimeout(() => {
                    btn.innerHTML = originalHtml;
                    btn.className = originalClass;
                    btn.disabled = false;
                }, 2000);
            } else {
                throw new Error(response.error || 'Unknown error');
            }
        };

        try {
            const data = await scrapeData();
            console.log('Sending Data to Background:', data);

            const result = await sendSaveRequest(data);
            if (result === 'CANCELLED') {
                return; // User canceled
            }

        } catch (err) {
            console.error(err);

            if (err.message === 'USER_DELETED') {
                // Account was deleted — storage already cleared by background.js, just update button
                await updateButtonState();
                return;
            }

            btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> Hata!';
            btn.className = 'error';
            alert("Kaydedilemedi: " + err.message);
            setTimeout(() => {
                btn.innerHTML = originalHtml;
                btn.className = originalClass;
                btn.disabled = false;
            }, 3000);
        }
    };

    document.body.appendChild(btn);
}

// Initialize
injectButton();

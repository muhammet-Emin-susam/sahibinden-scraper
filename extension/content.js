// content.js

// Function to scrape data from the page
async function scrapeData() {
    const getText = (selector) => document.querySelector(selector)?.innerText?.trim() || '';

    // Wait a bit longer for phone numbers to load via AJAX
    // Sahibinden sometimes has multiple buttons or different selectors
    const phoneButtons = document.querySelectorAll('#aShowPhone, .show-phone-number, .js-show-phone, a[class*="phone"], .classifiedUserContent .btn-show-phone');
    for (const btn of phoneButtons) {
        if (btn && btn.offsetParent !== null) { // if visible
            try {
                btn.click();
                await new Promise(r => setTimeout(r, 800)); // Short wait for each
            } catch (e) {
                console.error('Telefona tıklanamadı', e);
            }
        }
    }
    await new Promise(r => setTimeout(r, 400)); // One final short wait

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
        '.store-info-area h2, .store-info-area h5, .classified-seller-store span, ' +
        '.classifiedUserBox .username, .classifiedUserBox h5, .classifiedUserContent h5, ' +
        '.detailed-info h3, .detailed-info h4, .detailed-info h5, ' +
        '.user-info-store-name a, .user-info-agent h3'
    );

    let officeName = '';
    const officeNameSelectors = [
        '.user-info-store-name a',
        '.user-info-store-name span',
        '.user-info-store-name h2',
        '.user-info-store-name',
        '.user-info-store-logo a',
        '.user-info-store-logo',
        '.storeBox .name',
        '.storeBox a.storeInfo',
        '.classifiedDetailRightSide .store-info-area h2',
        '.classified-seller-store-name',
        '.store-info-area h2'
    ];
    let officeLogo = '';
    const officeLogoSelectors = [
        '.user-info-store-logo img',
        '.user-info-store-logo a img',
        '.storeBox img',
        '.classified-seller-store img',
        '.store-info-area img'
    ];
    for (const sel of officeLogoSelectors) {
        const img = document.querySelector(sel);
        if (img) {
            officeLogo = img.getAttribute('data-src') || img.src || '';
            if (officeLogo) break;
        }
    }

    // Aggressive Store Name Extraction
    for (const selector of officeNameSelectors) {
        const els = document.querySelectorAll(selector);
        for (const el of els) {
            let txt = (el.textContent || el.innerText || el.getAttribute('title') || '').trim();
            if (txt && txt.length > 2) {
                // Use regex with word boundaries for blacklist to avoid partial matches
                const isBlacklisted = nameBlacklist.some(bw => {
                    const regex = new RegExp(`\\b${bw}\\b`, 'i');
                    return regex.test(txt);
                });
                if (!isBlacklisted) {
                    officeName = txt;
                    break;
                }
            }
        }
        if (officeName) break;
    }

    // Pro Layout Specific: Broad container scan
    if (!officeName) {
        const storeCard = document.querySelector('.user-info-store-card, .user-info-store-name, .store-info-area');
        if (storeCard) {
            // Get all text nodes, filter out the agent name if we already found it later (but we are before that)
            // Just take the longest non-blacklisted line for now
            const lines = storeCard.textContent.split('\n').map(l => l.trim()).filter(l => l.length > 2);
            for (const line of lines) {
                const isBlacklisted = nameBlacklist.some(bw => new RegExp(`\\b${bw}\\b`, 'i').test(line));
                if (!isBlacklisted) {
                    officeName = line;
                    break;
                }
            }
        }
    }

    // Final PRO layout fallback: If office name still empty, try store logo alt text or title
    if (!officeName) {
        const proLogo = document.querySelector('.user-info-store-logo img[alt], .user-info-store-logo a[title]');
        if (proLogo) {
            const txt = proLogo.alt?.trim() || proLogo.getAttribute('title')?.trim();
            if (txt && !nameBlacklist.some(bw => txt.toLowerCase().includes(bw.toLowerCase())) && txt.length > 2) {
                officeName = txt;
            }
        }
    }

    // Ultimate fallback: Look for store subdomains in links (e.g. stores.sahibinden.com)
    if (!officeName) {
        const allLinks = document.querySelectorAll('.classifiedDetailRightSide a, .user-info-module a, aside a, .storeBox a, .user-info-store-card a');
        for (const link of allLinks) {
            const href = link.href || '';
            let title = (link.getAttribute('title') || link.textContent || link.innerText || '').trim();
            // Match subdomains like: storename.sahibinden.com
            const subdomainMatch = href.match(/https?:\/\/([^.]+)\.sahibinden\.com/);
            if (subdomainMatch && subdomainMatch[1] !== 'www' && subdomainMatch[1] !== 'secure' && title.length > 2) {
                const isBlacklisted = nameBlacklist.some(bw => new RegExp(`\\b${bw}\\b`, 'i').test(title));
                if (!isBlacklisted && !title.toLowerCase().includes('tüm ilanlar')) {
                    officeName = title;
                    console.log('[DEBUG] Store name found via subdomain link:', officeName);
                    break;
                }
            }
        }
    }

    if (officeName) console.log('[DEBUG] Office name finalized:', officeName);

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
            if (val.length > 2 && val.length < 50 && !val.includes('*')) {
                const isBlacklisted = nameBlacklist.some(bw => new RegExp(`\\b${bw}\\b`, 'i').test(val));
                // avoid pure numbers or obvious partial phones
                if (!isBlacklisted && !foundNames.includes(val) && !val.match(/^[\d\s\(\)\-\+]+$/)) {
                    foundNames.push(val);
                }
            }
        }
    });

    console.log('[DEBUG] Scraped Office:', officeName);

    // 2. Check for data-content attributes (another Sahibinden defense specifically for phones)
    // Now restricted to right rail areas to avoid grabbing data from description
    const dataContentContainers = document.querySelectorAll('.classifiedDetailRightSide, .classified-right-side, aside, .user-info-module, .classifiedUserBox');
    dataContentContainers.forEach(container => {
        container.querySelectorAll('[data-content]').forEach(el => {
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

    // Specific check for Agent Name in Pro Layout
    const proAgentName = document.querySelector('.user-info-agent h3');
    if (proAgentName && proAgentName.innerText?.trim()) {
        const txt = proAgentName.innerText.trim();
        if (!foundNames.includes(txt) && !nameBlacklist.some(bw => txt.toLowerCase().includes(bw.toLowerCase()))) {
            foundNames.unshift(txt); // Prioritize agent name
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
        // Filter out junk
        let validNames = foundNames.filter(n => {
            const lower = n.toLowerCase();
            return !nameBlacklist.some(bw => lower.includes(bw.toLowerCase())) &&
                n.length > 2 &&
                !n.match(/^[\d\s\(\)\-\+]+$/);
        });

        // Separate office names from agent names
        let filteredNames = validNames;
        if (officeName) {
            filteredNames = validNames.filter(n => !n.includes(officeName) && !officeName.includes(n));
        }

        if (filteredNames.length > 0) {
            sellerName = filteredNames[0]; // Take the first unique non-office name as the consultant
            if (filteredNames.length > 1) sellerName += ' - ' + filteredNames[1];
        } else if (validNames.length > 0) {
            // Fallback: if everything was filtered as office, take the best valid name
            sellerName = validNames[0];
        }
    }

    // ==========================================
    // EXTRACT SELLER PHONE (REGEX BASED)
    // ==========================================
    let sellerPhone = '';

    // First, try traditional list scanning
    const phoneList = document.querySelectorAll('ul.phones li span, .phone-area span, .phone-number, [data-phone], .user-info-phones span, .user-info-phones b');
    phoneList.forEach(span => {
        const spanText = span.innerText?.trim() || span.getAttribute('data-phone')?.trim();
        if (spanText && spanText !== '--- -- --' && spanText.length > 8) {
            phones.push(spanText);
        }
    });

    // Strategy 2: Look for 'Cep' label and grab the sibling/parent text inside CONTACT areas only
    if (phones.length === 0) {
        const contactContainers = document.querySelectorAll('.classifiedDetailRightSide, .classified-right-side, aside, .user-info-module, .classifiedUserBox, .seller-info-area');
        contactContainers.forEach(container => {
            container.querySelectorAll('li, div, p, span, h4, .user-info-phones div').forEach(el => {
                const txt = el.innerText?.trim() || '';
                // Only look around lines/elements that actually mention a phone type explicitly
                if (txt.includes('Cep') || txt.includes('İş') || txt.includes('Sabit') || txt.includes('Tel')) {
                    // First try to find Mobile (05XX)
                    let phoneMatch = txt.match(/(0\s*\(?5\d{2}\)?\s*\d{3}\s*[\-\.\s]?\d{2}\s*[\-\.\s]?\d{2})/g);

                    // Fallback to landlines (02XX, 03XX, 04XX)
                    if (!phoneMatch) {
                        phoneMatch = txt.match(/(0\s*\(?[2|3|4]\d{2}\)?\s*\d{3}\s*[\-\.\s]?\d{2}\s*[\-\.\s]?\d{2})/g);
                    }

                    if (phoneMatch) phones.push(...phoneMatch.map(m => m.replace(/\s+/g, ' ').trim()));
                }
            });
        });
    }

    // If traditional didn't work, scan the entire right rail text aggressively
    if (phones.length === 0) {
        const rightRail = document.querySelector('.classifiedDetailRightSide, .classified-right-side, aside, .user-info-module');
        if (rightRail) {
            // Filter out description if it somehow ended up inside (unlikely but safe)
            const descriptionEl = rightRail.querySelector('#classifiedDescription');

            // Look specifically in the storeBox, user info boxes, or pro module
            const boxes = rightRail.querySelectorAll('.storeBox, .user-info-module, .seller-info-area, .user-info-phones');

            let rootText = '';
            if (boxes.length > 0) {
                boxes.forEach(b => rootText += ' ' + b.innerText);
            } else {
                // If no boxes, take whole rail but try to be careful
                rootText = rightRail.innerText || '';
            }

            // Priorities: 1. Mobile (05xx) 2. Normal landlines (02xx, 03xx, 04xx)
            // Handle optional parentheses and various separators
            let matches = rootText.match(/(0\s*\(?5\d{2}\)?\s*\d{3}\s*[\-\.\s]?\d{2}\s*[\-\.\s]?\d{2})/g);
            if (!matches) {
                matches = rootText.match(/(0\s*\(?[2|3|4]\d{2}\)?\s*\d{3}\s*[\-\.\s]?\d{2}\s*[\-\.\s]?\d{2})/g);
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

    // ==========================================
    // EXTRACT MAP COORDINATES
    // ==========================================
    let mapUrl = '';
    const mapElement = document.querySelector('#gmap');
    if (mapElement) {
        const lat = mapElement.getAttribute('data-lat');
        const lon = mapElement.getAttribute('data-lon');
        if (lat && lon) {
            mapUrl = `https://www.google.com/maps?q=${lat},${lon}`;
        }
    }

    // Final boolean for UI fallback
    const isOffice = properties['Kimden'] === 'Emlak Ofisinden' ||
        properties['Kimden'] === 'İnşaat Firmasından' ||
        !!officeName ||
        !!document.querySelector('.user-info-store-card, .storeBox, .store-info-area');

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
        sellerPhone,
        officeName,
        officeLogo,
        isOffice,
        mapUrl
    };
}

// Create and inject the floating button
async function injectButton() {
    const container = document.createElement('div');
    container.id = 'sahibinden-scraper-container';

    const btn = document.createElement('button');
    btn.id = 'sahibinden-scraper-btn';

    const updateButtonState = async () => {
        const { auth_user } = await chrome.storage.local.get(['auth_user']);
        if (auth_user) {
            btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg><span class="btn-text">${auth_user.username} - Kaydet</span>`;
            btn.className = 'logged-in';
        } else {
            btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg><span class="btn-text">Giriş Bekleniyor</span>`;
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

    const handleSave = async (targetBtn, isTrade = false) => {
        const { auth_token } = await chrome.storage.local.get(['auth_token']);
        if (!auth_token) {
            alert('İlanı kaydetmek için lütfen sağ üstten eklenti simgesine tıklayıp giriş yapın.');
            return;
        }

        const originalHtml = targetBtn.innerHTML;
        const originalClass = targetBtn.className;

        targetBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" class="animate-spin" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg><span class="btn-text">Kaydediliyor...</span>';
        targetBtn.disabled = true;

        const sendSaveRequest = async (saveData) => {
            const response = await chrome.runtime.sendMessage({
                action: 'saveRecord',
                data: saveData
            });

            if (response && response.success) {
                if (response.data && response.data.success === false) {
                    if (response.data.error === 'DUPLICATE_WARNING') {
                        // Show Duplicate Prompt inside Button
                        targetBtn.innerHTML = `
                            <div class="duplicate-prompt">
                                <span class="prompt-text">Bu ilan zaten ekli.<br>Yine de eklensin mi?</span>
                                <label class="prompt-text" style="font-size: 11px; margin-bottom: 4px; display: flex; align-items: center; justify-content: center; gap: 4px; cursor: pointer;">
                                    <input type="checkbox" class="chk-overwrite" checked />
                                    Mevcut kaydın üzerine yaz
                                </label>
                                <div class="prompt-actions">
                                    <div class="btn-force-save btn-yes">Evet Ekle</div>
                                    <div class="btn-cancel-save btn-no">İptal Et</div>
                                </div>
                            </div>
                        `;
                        targetBtn.className = 'warning';
                        targetBtn.disabled = false;

                        // Stop regular flow because we are waiting for user click
                        return new Promise((resolve, reject) => {
                            const promptContainer = targetBtn.querySelector('.duplicate-prompt');
                            if (promptContainer) {
                                promptContainer.onclick = (e) => {
                                    // Prevent the click from bubbling to targetBtn which would re-trigger handleSave
                                    e.stopPropagation();
                                };
                            }

                            targetBtn.querySelector('.btn-force-save').onclick = async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const isOverwrite = targetBtn.querySelector('.chk-overwrite')?.checked || false;

                                targetBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" class="animate-spin" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg><span class="btn-text">Zorlayarak Kaydediliyor...</span>';
                                targetBtn.className = originalClass;
                                targetBtn.disabled = true;
                                try {
                                    await sendSaveRequest({ ...saveData, forceSave: true, overwrite: isOverwrite });
                                    resolve();
                                } catch (err) {
                                    reject(err);
                                }
                            };
                            targetBtn.querySelector('.btn-cancel-save').onclick = (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                targetBtn.innerHTML = originalHtml;
                                targetBtn.className = originalClass;
                                resolve('CANCELLED');
                            };
                        });
                    }
                    throw new Error(response.data.message || response.data.error || 'Sunucu hatası');
                }

                targetBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg><span class="btn-text">Kaydedildi!</span>';
                targetBtn.className = 'success';
                setTimeout(() => {
                    targetBtn.innerHTML = originalHtml;
                    targetBtn.className = originalClass;
                    targetBtn.disabled = false;
                }, 2000);
            } else {
                throw new Error(response.error || 'Unknown error');
            }
        };

        try {
            const data = await scrapeData();

            const targetApiUrl = await new Promise(r => chrome.storage.local.get(['api_url'], result => r(result.api_url || 'https://emlak.altaydev.com.tr')));
            console.log(`[EXTENSION] Target API: ${targetApiUrl}`);
            console.log(`[EXTENSION] Saving record: ${data.title} (ilanNo: ${data.ilanNo}, isTrade: ${data.isTrade || false})`);
            const result = await sendSaveRequest(data);
            if (result === 'CANCELLED') return;

        } catch (err) {
            console.error(err);
            if (err.message === 'USER_DELETED') {
                await updateButtonState();
                return;
            }
            targetBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg><span class="btn-text">Hata!</span>';
            targetBtn.className = 'error';
            alert("Kaydedilemedi: " + err.message);
            setTimeout(() => {
                targetBtn.innerHTML = originalHtml;
                targetBtn.className = originalClass;
                targetBtn.disabled = false;
            }, 3000);
        }
    };

    // Make the container draggable
    let isDragging = false;
    let hasMoved = false;
    let startMouseX = 0, startMouseY = 0;
    let startContainerX = 0, startContainerY = 0;

    container.addEventListener('mousedown', (e) => {
        // Prevent dragging if interacting with the prompt
        if (e.target.closest('.duplicate-prompt')) return;

        isDragging = true;
        hasMoved = false;
        
        startMouseX = e.clientX;
        startMouseY = e.clientY;
        
        const rect = container.getBoundingClientRect();
        startContainerX = rect.left;
        startContainerY = rect.top;

        // Switch to explicit positioning to allow dragging freely
        container.style.right = 'auto';
        container.style.bottom = 'auto';
        container.style.left = startContainerX + 'px';
        container.style.top = startContainerY + 'px';
        
        e.preventDefault(); // Prevent text selection
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const dx = e.clientX - startMouseX;
        const dy = e.clientY - startMouseY;

        // Threshold to distinguish between a click and a drag
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            hasMoved = true;
        }

        container.style.left = (startContainerX + dx) + 'px';
        container.style.top = (startContainerY + dy) + 'px';
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
        }
    });

    btn.onclick = (e) => {
        if (hasMoved) {
            // Cancel click action because it was a drag gesture
            e.preventDefault();
            e.stopPropagation();
            hasMoved = false;
            return;
        }
        handleSave(btn, false);
    };

    container.appendChild(btn);
    document.body.appendChild(container);
}

// Initialize
injectButton();

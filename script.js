(function() {
    const SUPABASE_URL = 'https://iljsednetiogjtowlexo.supabase.co';
    const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_gXxOqmU-XXnrVz8FHro2jA_ybG9EQ7O';

    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

    const STORAGE_NICKNAME_KEY = 'nobu_nickname';
    const STORAGE_USER_ID_KEY = 'nobu_user_id';
    const STORAGE_VERIFIED_KEY = 'nobu_verified';
    const STORAGE_AVATAR_KEY = 'nobu_avatar';

    // ---- DOM ----
    const nicknameDisplay = document.getElementById('nicknameDisplay');
    const nicknameText = document.getElementById('nicknameText');
    const avatarInitial = document.getElementById('avatarInitial');
    const avatarCircle = document.getElementById('avatarCircle');
    const editNicknameBtn = document.getElementById('editNicknameBtn');
    const nicknameEditor = document.getElementById('nicknameEditor');
    const nicknameInput = document.getElementById('nicknameInput');
    const saveNicknameBtn = document.getElementById('saveNicknameBtn');
    const cancelNicknameBtn = document.getElementById('cancelNicknameBtn');
    const composerAvatar = document.querySelector('.composer-avatar');
    const composerAvatarInitial = document.getElementById('composerAvatarInitial');
    const composerNickname = document.getElementById('composerNickname');
    const postTextarea = document.getElementById('postTextarea');
    const charCount = document.getElementById('charCount');
    const publishBtn = document.getElementById('publishBtn');
    const composerError = document.getElementById('composerError');
    const composerErrorText = document.getElementById('composerErrorText');
    const postsFeed = document.getElementById('postsFeed');
    const feedLoading = document.getElementById('feedLoading');
    const feedEmpty = document.getElementById('feedEmpty');
    const feedError = document.getElementById('feedError');
    const feedErrorText = document.getElementById('feedErrorText');
    const retryBtn = document.getElementById('retryBtn');
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');

    let currentNickname = '';
    let currentUserId = '';
    let isPublishing = false;
    let realtimeSubscription = null;
    let postsRefreshInterval = null;
    let likedPostIds = new Set();
    let selectedImageFile = null;
    let isAdmin = false;
    let isVerified = false;
    let currentAvatarUrl = null;
    let bannedUserIds = new Set(); // сюда загрузим заблокированных

    // ---- Композер фото ----
    const composerBody = document.querySelector('.composer-body');
    const toolbar = document.createElement('div');
    toolbar.className = 'composer-toolbar';
    const attachBtn = document.createElement('button');
    attachBtn.className = 'attach-btn';
    attachBtn.innerHTML = '<i class="fas fa-image"></i>';
    attachBtn.title = 'Прикрепить фото';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    const imagePreviewContainer = document.createElement('div');
    imagePreviewContainer.className = 'image-preview-container';
    const imagePreview = document.createElement('img');
    imagePreview.className = 'image-preview';
    imagePreview.alt = 'Превью';
    const removeImageBtn = document.createElement('button');
    removeImageBtn.className = 'remove-image-btn';
    removeImageBtn.innerHTML = '<i class="fas fa-times"></i>';
    removeImageBtn.title = 'Удалить фото';
    imagePreviewContainer.appendChild(imagePreview);
    imagePreviewContainer.appendChild(removeImageBtn);
    toolbar.appendChild(attachBtn);
    composerBody.insertBefore(imagePreviewContainer, composerBody.querySelector('.composer-footer'));
    composerBody.insertBefore(toolbar, imagePreviewContainer);

    // ---- Админка ----
    const ADMIN_PASSWORD = 'nobuadmin2024';
    let adminToggleBtn, adminModal;

    function createAdminUI() {
        adminToggleBtn = document.createElement('button');
        adminToggleBtn.className = 'admin-toggle-btn';
        adminToggleBtn.innerHTML = '<i class="fas fa-shield-haltered"></i>';
        document.body.appendChild(adminToggleBtn);

        adminModal = document.createElement('div');
        adminModal.className = 'admin-modal';
        adminModal.id = 'adminModal';
        adminModal.innerHTML = `
            <h3><i class="fas fa-crown"></i> Админ-панель</h3>
            <input type="password" class="admin-password-input" placeholder="Пароль..." id="adminPasswordInput">
            <button class="admin-login-btn" id="adminLoginBtn">Войти</button>
            <div class="admin-error" id="adminError">Неверный пароль</div>
            <div id="bannedList" style="margin-top:12px; display:none;"></div>
        `;
        document.body.appendChild(adminModal);

        adminToggleBtn.addEventListener('click', () => {
            if (isAdmin) {
                isAdmin = false;
                adminToggleBtn.classList.remove('active');
                adminModal.classList.remove('active');
                removeDeleteButtons();
                removeBlockButtons();
                document.getElementById('bannedList').style.display = 'none';
            } else {
                adminModal.classList.toggle('active');
            }
        });

        document.getElementById('adminLoginBtn').addEventListener('click', () => {
            const password = document.getElementById('adminPasswordInput').value;
            if (password === ADMIN_PASSWORD) {
                isAdmin = true;
                adminToggleBtn.classList.add('active');
                adminModal.classList.remove('active');
                document.getElementById('adminPasswordInput').value = '';
                document.getElementById('adminError').style.display = 'none';
                addDeleteButtons();
                addBlockButtons();
                renderBannedList();
            } else {
                document.getElementById('adminError').style.display = 'block';
            }
        });

        document.getElementById('adminPasswordInput').addEventListener('keydown', e => {
            if (e.key === 'Enter') document.getElementById('adminLoginBtn').click();
        });

        document.addEventListener('click', e => {
            if (!adminModal.contains(e.target) && e.target !== adminToggleBtn) {
                adminModal.classList.remove('active');
            }
        });
    }

    function addDeleteButtons() {
        document.querySelectorAll('.post-card').forEach(card => {
            if (!card.querySelector('.delete-post-btn')) {
                const header = card.querySelector('.post-header');
                const btn = document.createElement('button');
                btn.className = 'delete-post-btn';
                btn.innerHTML = '<i class="fas fa-trash"></i>';
                btn.addEventListener('click', async () => {
                    const postId = card.getAttribute('data-post-id');
                    if (confirm('Удалить пост?')) {
                        const { error } = await supabase.from('posts').delete().match({ id: postId });
                        if (!error) {
                            card.style.animation = 'fadeOut 0.3s ease forwards';
                            setTimeout(() => card.remove(), 300);
                        }
                    }
                });
                header.appendChild(btn);
            }
        });
    }

    function removeDeleteButtons() {
        document.querySelectorAll('.delete-post-btn').forEach(b => b.remove());
    }

    // ---- Блокировка ----
    async function loadBannedUsers() {
        const { data } = await supabase.from('banned_users').select('user_id');
        bannedUserIds = new Set(data ? data.map(r => r.user_id) : []);
    }

    async function blockUser(userId, nickname) {
        await supabase.from('banned_users').upsert({ user_id: userId, nickname: nickname || 'unknown' });
        bannedUserIds.add(userId);
        // Скрываем все посты этого пользователя из DOM
        document.querySelectorAll('.post-card').forEach(card => {
            if (card.getAttribute('data-user-id') === userId) {
                card.remove();
            }
        });
        renderBannedList();
    }

    async function unblockUser(userId) {
        await supabase.from('banned_users').delete().match({ user_id: userId });
        bannedUserIds.delete(userId);
        // Перезагрузим ленту, чтобы посты снова появились
        await loadPosts();
        renderBannedList();
    }

    function addBlockButtons() {
        document.querySelectorAll('.post-card').forEach(card => {
            if (!card.querySelector('.block-user-btn')) {
                const header = card.querySelector('.post-header');
                const btn = document.createElement('button');
                btn.className = 'block-user-btn';
                btn.innerHTML = '<i class="fas fa-ban"></i>';
                btn.title = 'Заблокировать пользователя';
                btn.addEventListener('click', async () => {
                    const userId = card.getAttribute('data-user-id');
                    const nickname = card.getAttribute('data-nickname');
                    if (confirm(`Заблокировать пользователя ${nickname}? Все его посты исчезнут.`)) {
                        await blockUser(userId, nickname);
                    }
                });
                header.appendChild(btn);
            }
        });
    }

    function removeBlockButtons() {
        document.querySelectorAll('.block-user-btn').forEach(b => b.remove());
    }

    function renderBannedList() {
        const container = document.getElementById('bannedList');
        if (!container) return;
        container.style.display = 'block';
        container.innerHTML = '<h4 style="margin-bottom:8px;">🚫 Заблокированные</h4>';
        supabase.from('banned_users').select('*').then(({ data }) => {
            if (!data || data.length === 0) {
                container.innerHTML += '<p style="color:var(--text-muted);">Нет заблокированных</p>';
                return;
            }
            data.forEach(entry => {
                const div = document.createElement('div');
                div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:4px 0;';
                div.innerHTML = `<span>${escapeHtml(entry.nickname || entry.user_id)}</span>`;
                const unblockBtn = document.createElement('button');
                unblockBtn.textContent = 'Разблокировать';
                unblockBtn.style.cssText = 'background:var(--accent); color:white; border:none; border-radius:4px; padding:2px 8px; cursor:pointer; font-size:0.75rem;';
                unblockBtn.addEventListener('click', () => unblockUser(entry.user_id));
                div.appendChild(unblockBtn);
                container.appendChild(div);
            });
        });
    }

    // ---- Верификация ----
    function updateVerifiedUI() {
        if (isVerified) {
            if (!composerNickname.querySelector('.verified-badge')) {
                const badge = document.createElement('span');
                badge.className = 'verified-badge';
                badge.innerHTML = '<i class="fas fa-check"></i>';
                composerNickname.appendChild(badge);
            }
        } else {
            const badge = composerNickname.querySelector('.verified-badge');
            if (badge) badge.remove();
        }
    }

    // ---- Аватарка ----
    function saveAvatarUrl(url) {
        currentAvatarUrl = url;
        localStorage.setItem(STORAGE_AVATAR_KEY, url);
        applyAvatarToUI();
    }

    function loadAvatarUrl() {
        const saved = localStorage.getItem(STORAGE_AVATAR_KEY);
        if (saved) {
            currentAvatarUrl = saved;
            applyAvatarToUI();
        }
    }

    function applyAvatarToUI() {
        if (currentAvatarUrl) {
            avatarCircle.style.backgroundImage = `url(${currentAvatarUrl})`;
            avatarCircle.classList.add('has-image');
            avatarInitial.textContent = '';
        } else {
            avatarCircle.style.backgroundImage = '';
            avatarCircle.classList.remove('has-image');
            avatarInitial.textContent = currentNickname ? currentNickname.charAt(0).toUpperCase() : '?';
        }
        if (currentAvatarUrl) {
            composerAvatar.style.backgroundImage = `url(${currentAvatarUrl})`;
            composerAvatar.style.backgroundSize = 'cover';
            composerAvatar.style.backgroundPosition = 'center';
            composerAvatarInitial.textContent = '';
        } else {
            composerAvatar.style.backgroundImage = '';
            composerAvatarInitial.textContent = currentNickname ? currentNickname.charAt(0).toUpperCase() : '?';
        }
        const preview = document.getElementById('avatarPreviewInEditor');
        if (preview) {
            if (currentAvatarUrl) {
                preview.style.backgroundImage = `url(${currentAvatarUrl})`;
                preview.classList.add('has-image');
                preview.textContent = '';
            } else {
                preview.style.backgroundImage = '';
                preview.classList.remove('has-image');
                preview.textContent = currentNickname ? currentNickname.charAt(0).toUpperCase() : '?';
            }
        }
    }

    async function uploadAvatar(file) {
        const fileName = `avatars/${currentUserId}_avatar.${file.name.split('.').pop()}`;
        const { error } = await supabase.storage.from('post-images').upload(fileName, file, { cacheControl: '3600', upsert: true });
        if (error) throw error;
        const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(fileName);
        return urlData.publicUrl;
    }

    // ---- Утилиты ----
    function escapeHtml(text) {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    function generateUserId() {
        return crypto.randomUUID();
    }

    function getUserId() {
        let userId = localStorage.getItem(STORAGE_USER_ID_KEY);
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!userId || !uuidRegex.test(userId)) {
            userId = generateUserId();
            localStorage.setItem(STORAGE_USER_ID_KEY, userId);
        }
        return userId;
    }

    function updateNicknameUI(nick) {
        const displayNick = nick || 'Гость';
        nicknameText.textContent = displayNick;
        composerNickname.textContent = displayNick;
        updateVerifiedUI();
        applyAvatarToUI();
        updatePublishButtonState();
    }

    function handleSaveNickname() {
        const newNick = nicknameInput.value.trim();
        if (!newNick) {
            nicknameInput.style.border = '1px solid var(--danger)';
            nicknameInput.focus();
            setTimeout(() => { nicknameInput.style.border = ''; }, 2000);
            return;
        }

        if (newNick === 'NobuSocial') {
            const password = prompt('Введите пароль для верификации NobuSocial:');
            if (password === 'NobuSocialAdmin2024') {
                isVerified = true;
                localStorage.setItem(STORAGE_VERIFIED_KEY, 'true');
            } else {
                isVerified = false;
                localStorage.setItem(STORAGE_VERIFIED_KEY, 'false');
                if (password !== null) alert('Неверный пароль! Верификация не применена.');
            }
        } else {
            isVerified = false;
            localStorage.setItem(STORAGE_VERIFIED_KEY, 'false');
        }

        currentNickname = newNick;
        localStorage.setItem(STORAGE_NICKNAME_KEY, newNick);
        updateNicknameUI(newNick);
        hideNicknameEditor();
        showComposerError('');
    }

    function handleCancelNickname() {
        if (!currentNickname) return;
        hideNicknameEditor();
        nicknameInput.style.border = '';
    }

    function showComposerError(msg) {
        if (msg) {
            composerError.classList.remove('hidden');
            composerErrorText.textContent = msg;
        } else {
            composerError.classList.add('hidden');
        }
    }

    function updateCharCounter() {
        const len = postTextarea.value.length;
        charCount.textContent = len;
        charCount.classList.remove('warning', 'danger');
        if (len >= 450 && len < 500) charCount.classList.add('warning');
        else if (len >= 500) charCount.classList.add('danger');
        updatePublishButtonState();
    }

    function updatePublishButtonState() {
        const blocked = bannedUserIds.has(currentUserId);
        publishBtn.disabled = blocked || !( (postTextarea.value.trim().length > 0 || selectedImageFile) && currentNickname && !isPublishing );
        if (blocked) {
            showComposerError('Ваш аккаунт заблокирован');
        }
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '';
        const now = new Date();
        const diffSec = Math.floor((now - date) / 1000);
        if (diffSec < 60) return 'только что';
        const diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60) return `${diffMin} мин. назад`;
        const diffHour = Math.floor(diffMin / 60);
        if (diffHour < 24) return `${diffHour} ч. назад`;
        const diffDay = Math.floor(diffHour / 24);
        if (diffDay < 7) return `${diffDay} дн. назад`;
        return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    }

    async function uploadPostImage(file) {
        const fileName = `post-images/${currentUserId}_${Date.now()}.${file.name.split('.').pop()}`;
        const { error } = await supabase.storage.from('post-images').upload(fileName, file, { cacheControl: '3600', upsert: false });
        if (error) throw error;
        const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(fileName);
        return urlData.publicUrl;
    }

    function createPostCard(post) {
        const card = document.createElement('div');
        card.className = 'post-card';
        card.setAttribute('data-post-id', post.id);
        card.setAttribute('data-user-id', post.user_id);
        card.setAttribute('data-nickname', post.nickname);

        const initial = post.nickname ? post.nickname.charAt(0).toUpperCase() : '?';
        const verifiedHtml = post.verified ? '<span class="verified-badge"><i class="fas fa-check"></i></span>' : '';
        const timeStr = formatDate(post.created_at);
        const isLiked = likedPostIds.has(post.id);
        const likesCount = post.likes || 0;

        let imageHtml = '';
        if (post.image_url) {
            imageHtml = `<div class="post-image"><img src="${escapeHtml(post.image_url)}" alt="Пост" loading="lazy" onclick="window.open('${escapeHtml(post.image_url)}', '_blank')"></div>`;
        }

        card.innerHTML = `
            <div class="post-header">
                <div class="post-avatar">${escapeHtml(initial)}</div>
                <div class="post-author-info">
                    <span class="post-nickname">${escapeHtml(post.nickname || 'Гость')}${verifiedHtml}</span>
                    <span class="post-time">${timeStr}</span>
                </div>
            </div>
            ${post.content ? `<div class="post-content">${escapeHtml(post.content)}</div>` : ''}
            ${imageHtml}
            <div class="post-actions">
                <button class="like-btn ${isLiked ? 'liked' : ''}" data-post-id="${post.id}">
                    <i class="fas fa-heart"></i>
                    <span class="like-count">${likesCount}</span>
                </button>
            </div>
        `;

        card.querySelector('.like-btn').addEventListener('click', function() {
            toggleLike(post.id, this);
        });

        if (isAdmin) {
            const header = card.querySelector('.post-header');
            // кнопка удаления уже добавляется через addDeleteButtons()
        }

        return card;
    }

    async function toggleLike(postId, button) {
        if (!currentUserId) return;
        const isLiked = likedPostIds.has(postId);
        const countEl = button.querySelector('.like-count');
        let count = parseInt(countEl.textContent || 0);

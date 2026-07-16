// Инициализация Supabase
const SUPABASE_URL = 'https://iljsednetiogjtowlexo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_gXxOqmU-XXnrVz8FHro2jA_ybG9EQ7O';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Состояние приложения
const state = {
    user: JSON.parse(localStorage.getItem('nobu_user')) || null,
    currentView: 'auth-view',
    banCheckInterval: null,
    selectedImage: null
};

// Утилита: Хэширование пароля (простой SHA-256 для безопасности без внешних библиотек)
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Утилита: Форматирование времени
function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    if (seconds < 60) return 'только что';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} мин`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ч`;
    return date.toLocaleDateString('ru-RU');
}

// Утилита: Показать ошибку (вместо console.log)
function showError(message) {
    alert(`Ошибка: ${message}`);
}

// ==================== УПРАВЛЕНИЕ ИНТЕРФЕЙСОМ ====================

function showView(viewId) {
    document.querySelectorAll('.view').forEach(el => el.classList.add('hidden'));
    document.getElementById(viewId).classList.remove('hidden');
    state.currentView = viewId;
    
    // Обновление активной кнопки навигации
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === viewId);
    });

    if (viewId === 'main-view') loadFeed('feed');
    if (viewId === 'profile-view') loadProfile(state.user.username);
    if (viewId === 'admin-view') loadAdminData();
}

// ==================== АВТОРИЗАЦИЯ И СТАТУС ====================

async function checkUserStatus() {
    if (!state.user) return;
    
    const { data, error } = await supabase
        .from('users')
        .select('is_banned, ban_reason, ban_expires')
        .eq('id', state.user.id)
        .single();

    if (error) return;

    // Проверка бана
    if (data.is_banned) {
        const banExpires = data.ban_expires ? new Date(data.ban_expires) : null;
        const now = new Date();
        
        if (!banExpires || banExpires > now) {
            showBanScreen(data.ban_reason, banExpires);
            return;
        } else {
            // Бан истек, снимаем его
            await supabase.from('users').update({ is_banned: false, ban_reason: null, ban_expires: null }).eq('id', state.user.id);
        }
    }

    // Проверка предупреждений (непрочитанных)
    const { data: warnings } = await supabase
        .from('warnings')
        .select('*')
        .eq('user_id', state.user.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(1);

    if (warnings && warnings.length > 0) {
        showWarningScreen(warnings[0].reason, warnings[0].id);
    }
}

function showBanScreen(reason, expires) {
    document.getElementById('app').classList.add('hidden');
    const screen = document.getElementById('ban-screen');
    screen.classList.remove('hidden');
    document.getElementById('ban-reason-text').textContent = `Причина: ${reason || 'Нарушение правил'}`;
    
    let timeLeft = expires ? Math.floor((expires - new Date()) / 1000) : 9999999;
    
    const timer = setInterval(() => {
        if (timeLeft <= 0) {
            clearInterval(timer);
            location.reload();
        } else {
            const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
            const s = (timeLeft % 60).toString().padStart(2, '0');
            document.getElementById('ban-timer-text').textContent = `Осталось: ${m}:${s}`;
            timeLeft--;
        }
    }, 1000);
}

function showWarningScreen(reason, warningId) {
    document.getElementById('app').classList.add('hidden');
    const screen = document.getElementById('warning-screen');
    screen.classList.remove('hidden');
    document.getElementById('warning-reason-text').textContent = `Причина: ${reason}`;
    
    let timeLeft = 180; // 3 минуты
    const btn = document.getElementById('warning-ack-btn');
    btn.disabled = true;
    
    const timer = setInterval(() => {
        if (timeLeft <= 0) {
            clearInterval(timer);
            btn.disabled = false;
            document.getElementById('warning-timer-text').textContent = 'Теперь вы можете продолжить';
        } else {
            const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
            const s = (timeLeft % 60).toString().padStart(2, '0');
            document.getElementById('warning-timer-text').textContent = `Осталось: ${m}:${s}`;
            timeLeft--;
        }
    }, 1000);

    btn.onclick = async () => {
        await supabase.from('warnings').update({ is_read: true }).eq('id', warningId);
        screen.classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        showView('main-view');
    };
}

async function handleAuth(e) {
    e.preventDefault();
    const username = document.getElementById('auth-username').value.trim().toLowerCase();
    const password = document.getElementById('auth-password').value;
    const btn = document.getElementById('auth-btn');
    
    btn.disabled = true;
    btn.textContent = 'Загрузка...';

    try {
        const hashedPass = await hashPassword(password);
        
        // Попытка входа
        let { data: user, error: loginError } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .eq('password', hashedPass)
            .single();

        if (loginError || !user) {
            // Регистрация
            const { data: newUser, error: regError } = await supabase
                .from('users')
                .insert([{ username, password: hashedPass, avatar_emoji: '👤', bio: '' }])
                .select()
                .single();
            
            if (regError) {
                if (regError.code === '23505') showError('Никнейм уже занят');
                else showError('Ошибка регистрации');
                return;
            }
            user = newUser;
        }

        state.user = user;
        localStorage.setItem('nobu_user', JSON.stringify(user));
        
        // Проверка статуса сразу после входа
        await checkUserStatus();
        
        document.getElementById('auth-view').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        
        if (user.username === 'admin') { // Упрощенная проверка для демо, в реале нужна роль
            document.getElementById('admin-nav-btn').classList.remove('hidden');
        }
        
        showView('main-view');
        
        // Запуск периодической проверки каждые 10 секунд
        state.banCheckInterval = setInterval(checkUserStatus, 10000);

    } catch (err) {
        showError('Непредвиденная ошибка');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Войти / Регистрация';
    }
}

// ==================== ЛЕНТА И ПОСТЫ ====================

async function loadFeed(type = 'feed') {
    const container = document.getElementById('content-area');
    container.innerHTML = '<p style="text-align:center; padding:20px; color:#888;">Загрузка...</p>';

    let query = supabase.from('chirps').select('*').order('created_at', { ascending: false }).limit(50);

    if (type === 'following') {
        const { data: follows } = await supabase.from('follows').select('following_id').eq('follower_id', state.user.id);
        const followingIds = follows ? follows.map(f => f.following_id) : [state.user.id];
        query = query.in('user_id', followingIds);
    }

    const { data: chirps, error } = await query;

    if (error) {
        container.innerHTML = '<p style="text-align:center; color:red;">Ошибка загрузки</p>';
        return;
    }

    container.innerHTML = '';
    if (chirps.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:40px; color:#888;">Здесь пока пусто</p>';
        return;
    }

    chirps.forEach(chirp => {
        container.appendChild(createChirpElement(chirp));
    });
}

function createChirpElement(chirp) {
    const div = document.createElement('div');
    div.className = 'chirp';
    
    const isLiked = chirp.user_id === state.user.id; // Упрощение: для точной проверки нужен отдельный запрос к таблице likes
    
    const hashtagsHtml = chirp.hashtags ? chirp.hashtags.map(tag => `<span style="color:var(--blue)">#${tag}</span>`).join(' ') : '';
    
    div.innerHTML = `
        <div class="chirp-avatar">${chirp.avatar_emoji}</div>
        <div class="chirp-body">
            <div class="chirp-header">
                <span class="chirp-username">${chirp.username}</span>
                ${chirp.is_verified ? '<i class="fas fa-check-circle verified-badge"></i>' : ''}
                ${chirp.is_fire ? '<i class="fas fa-fire fire-badge"></i>' : ''}
                <span class="chirp-time">· ${timeAgo(chirp.created_at)}</span>
            </div>
            <div class="chirp-content">${chirp.content.replace(/\n/g, '<br>')} ${hashtagsHtml}</div>
            ${chirp.image_url ? `<img src="${chirp.image_url}" class="chirp-image" loading="lazy">` : ''}
            <div class="chirp-id" data-id="${chirp.id}" title="Нажмите, чтобы скопировать ID">ID: ${chirp.id.slice(0,8)}...</div>
            <div class="chirp-footer">
                <button class="action-btn" data-action="comment" data-id="${chirp.id}">
                    <i class="far fa-comment"></i> ${chirp.comments_count || 0}
                </button>
                <button class="action-btn" data-action="rechirp" data-id="${chirp.id}">
                    <i class="fas fa-retweet"></i> ${chirp.rechirps}
                </button>
                <button class="action-btn" data-action="like" data-id="${chirp.id}">
                    <i class="far fa-heart"></i> ${chirp.likes}
                </button>
                <button class="action-btn" data-action="dislike" data-id="${chirp.id}">
                    <i class="far fa-thumbs-down"></i> ${chirp.dislikes}
                </button>
                <button class="action-btn" data-action="report" data-id="${chirp.id}">
                    <i class="far fa-flag"></i>
                </button>
            </div>
        </div>
    `;
    return div;
}

async function handleSendChirp() {
    const content = document.getElementById('chirp-content').value.trim();
    if (!content) return;
    if (content.length > 280) {
        showError('Превышен лимит в 280 символов');
        return;
    }

    const btn = document.getElementById('send-chirp-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';

    try {
        let imageUrl = null;
        if (state.selectedImage) {
            const fileExt = state.selectedImage.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
                .from('images')
                .upload(fileName, state.selectedImage);
            
            if (uploadError) throw uploadError;
            
            const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(fileName);
            imageUrl = publicUrl;
        }

        // Извлечение хэштегов
        const hashtags = content.match(/#\w+/g) || [];
        const cleanHashtags = hashtags.map(h => h.replace('#', '').toLowerCase());

        // Проверка стрика (огненные посты)
        let isFire = false;
        if (state.user.last_post_date) {
            const lastDate = new Date(state.user.last_post_date);
            const today = new Date();
            const diffTime = Math.abs(today - lastDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            if (diffDays <= 1) {
                isFire = true;
            }
        }

        const { error: insertError } = await supabase.from('chirps').insert([{
            user_id: state.user.id,
            username: state.user.username,
            avatar_emoji: state.user.avatar_emoji,
            content: content,
            image_url: imageUrl,
            hashtags: cleanHashtags,
            is_fire: isFire,
            is_verified: state.user.is_verified
        }]);

        if (insertError) throw insertError;

        // Обновление стрика пользователя
        const newStreak = (state.user.streak_count || 0) + 1;
        await supabase.from('users').update({ 
            streak_count: newStreak, 
            last_post_date: new Date().toISOString().split('T')[0] 
        }).eq('id', state.user.id);
        
        state.user.streak_count = newStreak;
        state.user.last_post_date = new Date().toISOString().split('T')[0];
        localStorage.setItem('nobu_user', JSON.stringify(state.user));

        // Очистка формы
        document.getElementById('chirp-content').value = '';
        document.getElementById('char-count').textContent = '0/280';
        document.getElementById('image-preview').innerHTML = '';
        document.getElementById('image-preview').classList.add('hidden');
        state.selectedImage = null;

        loadFeed('feed');

    } catch (err) {
        showError('Не удалось опубликовать пост');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-feather"></i> Чирикнуть';
    }
}

// ==================== ВЗАИМОДЕЙСТВИЯ ====================

async function handleInteraction(action, chirpId) {
    if (!state.user) return;

    if (action === 'report') {
        const reason = prompt('Причина жалобы:');
        if (!reason) return;
        await supabase.from('reports').insert([{
            from_user: state.user.id,
            from_username: state.user.username,
            chirp_id: chirpId,
            reason: reason
        }]);
        alert('Жалоба отправлена');
        return;
    }

    if (action === 'like') {
        // Проверка на существующий лайк
        const { data: existing } = await supabase.from('likes').select('id').eq('user_id', state.user.id).eq('chirp_id', chirpId).single();
        if (existing) {
            await supabase.from('likes').delete().eq('id', existing.id);
            await supabase.rpc('decrement_likes', { chirp_id: chirpId }); // Нужна функция в БД или ручное обновление
        } else {
            await supabase.from('likes').insert([{ user_id: state.user.id, chirp_id: chirpId }]);
        }
        loadFeed(document.querySelector('.tab-btn.active').dataset.tab);
    }
    
    if (action === 'rechirp') {
        const { data: existing } = await supabase.from('rechirps').select('id').eq('user_id', state.user.id).eq('chirp_id', chirpId).single();
        if (!existing) {
            await supabase.from('rechirps').insert([{ user_id: state.user.id, chirp_id: chirpId }]);
            // Инкремент счетчика (упрощенно через update)
            const { data: chirp } = await supabase.from('chirps').select('rechirps').eq('id', chirpId).single();
            await supabase.from('chirps').update({ rechirps: (chirp.rechirps || 0) + 1 }).eq('id', chirpId);
            loadFeed(document.querySelector('.tab-btn.active').dataset.tab);
        }
    }
}

// ==================== ПРОФИЛЬ ====================

async function loadProfile(username) {
    const { data: user, error } = await supabase.from('users').select('*').eq('username', username).single();
    if (error || !user) return;

    document.getElementById('profile-avatar').textContent = user.avatar_emoji;
    document.getElementById('profile-username').innerHTML = `${user.username} ${user.is_verified ? '<i class="fas fa-check-circle verified-badge"></i>' : ''}`;
    document.getElementById('profile-bio').textContent = user.bio || 'Биография отсутствует';

    // Статистика
    const { count: postsCount } = await supabase.from('chirps').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
    const { count: followersCount } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', user.id);
    const { count: followingCount } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id);

    document.getElementById('stat-posts').textContent = postsCount || 0;
    document.getElementById('stat-followers').textContent = followersCount || 0;
    document.getElementById('stat-following').textContent = followingCount || 0;

    // Кнопки
    const editBtn = document.getElementById('edit-profile-btn');
    const followBtn = document.getElementById('toggle-follow-btn');
    
    if (user.id === state.user.id) {
        editBtn.classList.remove('hidden');
        followBtn.classList.add('hidden');
    } else {
        editBtn.classList.add('hidden');
        followBtn.classList.remove('hidden');
        
        const { data: followData } = await supabase.from('follows').select('id').eq('follower_id', state.user.id).eq('following_id', user.id).single();
        followBtn.textContent = followData ? 'Отписаться' : 'Подписаться';
        followBtn.className = followData ? 'btn-secondary' : 'btn-primary';
    }

    // Посты пользователя
    const container = document.getElementById('profile-chirps');
    container.innerHTML = '';
    const { data: chirps } = await supabase.from('chirps').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (chirps) {
        chirps.forEach(c => container.appendChild(createChirpElement(c)));
    }
}

// ==================== АДМИНКА ====================

async function loadAdminData() {
    // Проверка пароля админа (упрощенная)
    const pass = prompt('Введите пароль администратора:');
    if (pass !== 'NobuWaveAdmin2024') {
        showView('main-view');
        return;
    }

    // Загрузка жалоб
    const { data: reports } = await supabase.from('reports').select('*, chirps(content)').order('created_at', { ascending: false });
    const reportsList = document.getElementById('admin-reports-list');
    reportsList.innerHTML = '';
    if (reports) {
        reports.forEach(r => {
            const div = document.createElement('div');
            div.className = 'report-item';
            div.innerHTML = `<b>${r.from_username}</b> жалуется на пост: "${r.chirps?.content?.slice(0,30)}..."<br>Причина: ${r.reason}<br><small>${timeAgo(r.created_at)}</small>`;
            reportsList.appendChild(div);
        });
    }

    // Загрузка банов
    const { data: bans } = await supabase.from('users').select('username, ban_reason, ban_expires').eq('is_banned', true);
    const bansList = document.getElementById('admin-bans-list');
    bansList.innerHTML = '';
    if (bans) {
        bans.forEach(b => {
            const div = document.createElement('div');
            div.className = 'ban-item';
            div.innerHTML = `<b>${b.username}</b><br>Причина: ${b.ban_reason}<br>До: ${b.ban_expires ? new Date(b.ban_expires).toLocaleString() : 'Навсегда'}`;
            bansList.appendChild(div);
        });
    }
}

async function handleAdminAction(action) {
    const targetUser = document.getElementById('admin-target-user').value.trim();
    const reason = document.getElementById('admin-reason').value.trim();
    const postId = document.getElementById('admin-post-id').value.trim();

    if (!targetUser && action !== 'delete-post') {
        showError('Введите никнейм');
        return;
    }

    if (action === 'delete-post') {
        if (!postId) return showError('Введите ID поста');
        await supabase.from('chirps').delete().eq('id', postId);
        alert('Пост удален');
        return;
    }

    const { data: user, error } = await supabase.from('users').select('id, username').eq('username', targetUser).single();
    if (error || !user) return showError('Пользователь не найден');

    if (action === 'ban') {
        await supabase.from('users').update({ 
            is_banned: true, 
            ban_reason: reason || 'Нарушение правил',
            ban_expires: new Date(Date.now() + 3 * 60 * 1000).toISOString() // 3 мин для демо
        }).eq('id', user.id);
        alert('Пользователь заблокирован на 3 минуты');
    } else if (action === 'warn') {
        await supabase.from('warnings').insert([{
            user_id: user.id,
            username: user.username,
            reason: reason || 'Предупреждение'
        }]);
        alert('Предупреждение отправлено');
    } else if (action === 'verify') {
        await supabase.from('users').update({ is_verified: true }).eq('id', user.id);
        alert('Пользователь верифицирован');
    } else if (action === 'unban') {
        await supabase.from('users').update({ is_banned: false, ban_reason: null, ban_expires: null }).eq('id', user.id);
        alert('Пользователь разбанен');
    }
    
    loadAdminData();
}

// ==================== REALTIME & СОБЫТИЯ ====================

// Подписка на новые посты
supabase.channel('chirps')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chirps' }, payload => {
        if (state.currentView === 'main-view') {
            const container = document.getElementById('content-area');
            const newChirp = createChirpElement(payload.new);
            container.insertBefore(newChirp, container.firstChild);
            // Удалить последний элемент если их больше 50
            if (container.children.length > 50) {
                container.removeChild(container.lastChild);
            }
        }
    })
    .subscribe();

// Делегирование событий (ОДИН обработчик на все)
document.addEventListener('click', async (e) => {
    const target = e.target.closest('button, .chirp-id, .nav-btn, .tab-btn, label');
    if (!target) return;

    // Навигация
    if (target.classList.contains('nav-btn')) {
        showView(target.dataset.view);
        return;
    }

    // Вкладки
    if (target.classList.contains('tab-btn')) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        target.classList.add('active');
        loadFeed(target.dataset.tab);
        return;
    }

    // Действия с постом
    if (target.dataset.action) {
        handleInteraction(target.dataset.action, target.dataset.id);
        return;
    }

    // Копирование ID
    if (target.classList.contains('chirp-id')) {
        navigator.clipboard.writeText(target.dataset.id);
        alert('ID скопирован');
        return;
    }

    // Админка
    if (target.dataset.action && state.currentView === 'admin-view') {
        handleAdminAction(target.dataset.action);
        return;
    }

    // Редактирование профиля
    if (target.id === 'edit-profile-btn') {
        document.getElementById('edit-profile-modal').classList.remove('hidden');
        document.getElementById('edit-avatar').value = state.user.avatar_emoji;
        document.getElementById('edit-bio').value = state.user.bio;
        return;
    }

    if (target.id === 'close-modal-btn') {
        document.getElementById('edit-profile-modal').classList.add('hidden');
        return;
    }

    if (target.id === 'save-profile-btn') {
        const newAvatar = document.getElementById('edit-avatar').value || '👤';
        const newBio = document.getElementById('edit-bio').value;
        
        await supabase.from('users').update({ avatar_emoji: newAvatar, bio: newBio }).eq('id', state.user.id);
        state.user.avatar_emoji = newAvatar;
        state.user.bio = newBio;
        localStorage.setItem('nobu_user', JSON.stringify(state.user));
        
        document.getElementById('edit-profile-modal').classList.add('hidden');
        loadProfile(state.user.username);
        return;
    }

    // Подписка/Отписка
    if (target.id === 'toggle-follow-btn') {
        const isFollowing = target.textContent === 'Отписаться';
        if (isFollowing) {
            await supabase.from('follows').delete().eq('follower_id', state.user.id).eq('following_id', state.user.id); // Заглушка, нужен реальный ID профиля
        } else {
            // Нужно получить ID просматриваемого профиля, здесь упрощено
        }
        // Для полноценной реализации нужно хранить currentProfileId в state
    }
});

// Ввод текста (счетчик символов)
document.getElementById('chirp-content').addEventListener('input', (e) => {
    document.getElementById('char-count').textContent = `${e.target.value.length}/280`;
});

// Выбор изображения
document.getElementById('chirp-image').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        state.selectedImage = file;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const preview = document.getElementById('image-preview');
            preview.innerHTML = `<img src="${ev.target.result}">`;
            preview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
});

// Инициализация
document.getElementById('auth-form').addEventListener('submit', handleAuth);
document.getElementById('send-chirp-btn').addEventListener('click', handleSendChirp);

// Проверка сессии при загрузке
if (state.user) {
    document.getElementById('auth-view').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    checkUserStatus();
    state.banCheckInterval = setInterval(checkUserStatus, 10000);
    showView('main-view');
}
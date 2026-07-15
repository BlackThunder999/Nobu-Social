const NobuWave = (() => {
    const supabase = window.supabase.createClient(
        'https://iljsednetiogjtowlexo.supabase.co',
        'sb_publishable_gXxOqmU-XXnrVz8FHro2jA_ybG9EQ7O'
    );

    let currentUser = null;
    let activeChat = null;
    const app = document.getElementById('app');

    const html = (s, ...v) => s.reduce((a, c, i) => a + c + (v[i] !== undefined ? String(v[i]).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m]) : ''), '');

    const ADMIN_PASSWORD = 'NobuWaveAdmin2024';

    // ========== ПРОВЕРКА БАНА ==========
    const checkBan = async () => {
        if (!currentUser) return null;
        const { data: ban } = await supabase.from('bans').select('*').eq('user_id', currentUser.id).maybeSingle();
        if (ban && new Date(ban.expires_at) > new Date()) return ban;
        if (ban) await supabase.from('bans').delete().eq('id', ban.id);
        return null;
    };

    const showBanScreen = (ban) => {
        const until = new Date(ban.expires_at);
        const now = new Date();
        const diffMinutes = Math.floor((until - now) / 60000);
        let durationText = '';
        if (diffMinutes < 60) durationText = `${diffMinutes} минут`;
        else if (diffMinutes < 1440) durationText = `${Math.floor(diffMinutes / 60)} часов`;
        else if (diffMinutes < 43200) durationText = `${Math.floor(diffMinutes / 1440)} дней`;
        else durationText = 'навсегда';

        app.innerHTML = html`
            <div class="auth-container" style="text-align:center">
                <div class="auth-card" style="max-width:480px">
                    <div style="font-size:4rem;margin-bottom:16px">🚫</div>
                    <h2 style="color:var(--danger);margin-bottom:12px">Вы заблокированы</h2>
                    <p style="color:var(--text-secondary);margin-bottom:8px">За нарушение правил NobuWave.</p>
                    <p style="color:var(--text-secondary);margin-bottom:16px">Причина: <strong style="color:var(--text)">${ban.reason || 'нарушение правил'}</strong></p>
                    <div style="background:rgba(255,71,87,0.1);border:1px solid rgba(255,71,87,0.2);border-radius:var(--radius-sm);padding:12px;margin-bottom:16px">
                        <p style="color:var(--accent-light);font-weight:600">⏰ Вы заблокированы на <strong>${durationText}</strong></p>
                        <p style="color:var(--text-secondary);font-size:0.85rem">До: ${until.toLocaleString('ru-RU')}</p>
                    </div>
                    <button class="modal-btn secondary" id="showRulesBtn" style="margin-bottom:12px">📋 Правила поведения</button>
                    <p style="color:var(--text-secondary);font-size:0.8rem">Пожалуйста, пересмотрите своё поведение.</p>
                </div>
            </div>
        `;
        document.getElementById('showRulesBtn').addEventListener('click', () => showRulesScreen('ban'));
    };

    const showRulesScreen = (from = 'menu') => {
        app.innerHTML = html`
            <div class="auth-container" style="text-align:left">
                <div class="auth-card" style="max-width:540px;text-align:left;padding:32px">
                    <h2 style="text-align:center;margin-bottom:24px">📋 Правила NobuWave</h2>
                    
                    <div style="color:var(--text);line-height:1.8;font-size:0.92rem">
                        <h3 style="color:var(--danger);margin-bottom:12px">🚫 СТРОГО ЗАПРЕЩЕНО:</h3>
                        <ul style="padding-left:20px;color:var(--text-secondary)">
                            <li style="margin-bottom:10px"><strong style="color:var(--danger)">Хейтинг и травля</strong> — оскорбления, насмешки, унижение, буллинг в любом виде. Это самая серьёзная причина для бана.</li>
                            <li style="margin-bottom:10px"><strong>Спам</strong> — массовая рассылка, реклама, флуд</li>
                            <li style="margin-bottom:10px"><strong>Угрозы</strong> — запугивание, шантаж, угрозы</li>
                            <li style="margin-bottom:10px"><strong>Дискриминация</strong> — расизм, сексизм, гомофобия</li>
                            <li style="margin-bottom:10px"><strong>Материалы 18+</strong> — порнография, насилие</li>
                            <li style="margin-bottom:10px"><strong>Мошенничество</strong> — обман, фишинг</li>
                            <li style="margin-bottom:10px"><strong>Выдача себя за другого</strong> — подделка личности</li>
                            <li style="margin-bottom:10px"><strong>Вредоносные ссылки</strong> — вирусы, фишинг</li>
                        </ul>
                        
                        <h3 style="color:var(--success);margin-top:24px;margin-bottom:12px">✅ Рекомендуется:</h3>
                        <ul style="padding-left:20px;color:var(--text-secondary)">
                            <li style="margin-bottom:8px">Быть вежливым и уважительным</li>
                            <li style="margin-bottom:8px">Помогать новым пользователям</li>
                            <li style="margin-bottom:8px">Сообщать о нарушениях через кнопку ⚠️ в чате</li>
                        </ul>
                        
                        <h3 style="color:var(--accent-light);margin-top:24px;margin-bottom:12px">⚖️ Наказания за нарушения:</h3>
                        <ul style="padding-left:20px;color:var(--text-secondary)">
                            <li style="margin-bottom:8px"><strong>Хейтинг</strong> — бан от 1 часа до навсегда</li>
                            <li style="margin-bottom:8px"><strong>Спам</strong> — бан на 6 часов</li>
                            <li style="margin-bottom:8px"><strong>Угрозы</strong> — бан навсегда</li>
                            <li style="margin-bottom:8px"><strong>Дискриминация</strong> — бан навсегда</li>
                            <li style="margin-bottom:8px">Повторные нарушения увеличивают срок бана</li>
                        </ul>
                    </div>
                    
                    <button class="modal-btn secondary" id="backFromRulesBtn" style="margin-top:24px">
                        ${from === 'ban' ? '← Назад' : '← На главную'}
                    </button>
                </div>
            </div>
        `;
        
        document.getElementById('backFromRulesBtn').addEventListener('click', () => {
            if (from === 'ban') {
                checkBan().then(ban => {
                    if (ban) showBanScreen(ban);
                    else renderApp();
                });
            } else {
                renderApp();
            }
        });
    };

    // ========== ВХОД ==========
    const renderLogin = () => {
        app.innerHTML = html`
            <div class="auth-container">
                <div class="auth-card">
                    <div class="auth-logo">
                        <div class="logo-icon"><i class="fa-solid fa-feather"></i></div>
                        <h1>Nobu<span>Wave</span></h1>
                        <p>Волна общения</p>
                    </div>
                    <input type="text" id="loginUsername" class="auth-input" placeholder="Придумайте никнейм" autocomplete="off">
                    <button class="auth-btn" id="loginBtn">Войти</button>
                    <button class="modal-btn secondary" id="loginRulesBtn" style="margin-top:8px">📋 Прочитать правила</button>
                </div>
            </div>
        `;
        document.getElementById('loginBtn').addEventListener('click', async () => {
            const username = document.getElementById('loginUsername').value.trim();
            if (!username) return;
            let { data: user } = await supabase.from('users').select('*').eq('username', username).single();
            if (!user) {
                const { data: newUser } = await supabase.from('users').insert({ username, display_name: username, avatar_emoji: '👤', role: 'user', is_verified: false }).select().single();
                if (!newUser) return;
                user = newUser;
            }
            currentUser = user;
            const ban = await checkBan();
            if (ban) { showBanScreen(ban); return; }
            localStorage.setItem('nobu_user', JSON.stringify(user));
            await supabase.from('users').update({ is_online: true }).eq('id', user.id);
            renderApp();
        });
        document.getElementById('loginRulesBtn').addEventListener('click', () => showRulesScreen('menu'));
    };

    // ========== ОСНОВНОЙ ИНТЕРФЕЙС ==========
    const renderApp = async () => {
        const ban = await checkBan();
        if (ban) { showBanScreen(ban); return; }
        app.innerHTML = `
            <div class="app-container">
                <div class="header">
                    <div class="header-title"><div class="logo-icon"><i class="fa-solid fa-feather"></i></div>NobuWave</div>
                    <div class="header-actions">
                        <button class="icon-btn" id="rulesBtn"><i class="fa-solid fa-book"></i></button>
                        <button class="icon-btn" id="newChatBtn"><i class="fa-solid fa-plus"></i></button>
                        <button class="icon-btn" id="profileBtn"><i class="fa-solid fa-user"></i></button>
                        <button class="icon-btn" id="adminBtn"><i class="fa-solid fa-shield-halved"></i></button>
                    </div>
                </div>
                <div class="chat-list" id="chatList"></div>
            </div>
        `;
        loadChats();
        document.getElementById('rulesBtn').addEventListener('click', () => showRulesScreen('menu'));
        document.getElementById('newChatBtn').addEventListener('click', showNewChatModal);
        document.getElementById('profileBtn').addEventListener('click', showProfileModal);
        document.getElementById('adminBtn').addEventListener('click', showAdminLogin);
    };

    // ========== ЗАГРУЗКА ЧАТОВ ==========
    const loadChats = async () => {
        const container = document.getElementById('chatList');
        const { data: members } = await supabase.from('chat_members').select('chat_id').eq('user_id', currentUser.id);
        const chatIds = members?.map(m => m.chat_id) || [];
        if (chatIds.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--text-secondary)">Нет чатов.<br>Нажмите <b>+</b> чтобы создать новый</div>';
            return;
        }
        const { data: chats } = await supabase.from('chats').select('*').in('id', chatIds).order('created_at', { ascending: false });
        container.innerHTML = chats?.map(chat => {
            const otherName = chat.name?.replace(` & ${currentUser.username}`, '').replace(`${currentUser.username} & `, '') || 'Чат';
            return `<div class="chat-item" data-chat-id="${chat.id}"><div class="chat-avatar">${chat.is_group ? '👥' : '👤'}</div><div class="chat-info"><div class="chat-name">${otherName}</div><div class="chat-last">Нажмите, чтобы открыть</div></div></div>`;
        }).join('');
        document.querySelectorAll('.chat-item').forEach(el => el.addEventListener('click', () => openChat(el.dataset.chatId)));
    };

    // ========== ОТКРЫТЬ ЧАТ ==========
    const openChat = async (chatId) => {
        const { data: chat } = await supabase.from('chats').select('*').eq('id', chatId).single();
        if (!chat) return;
        activeChat = chat;
        const otherName = chat.name?.replace(` & ${currentUser.username}`, '').replace(`${currentUser.username} & `, '') || 'Чат';
        app.innerHTML = `
            <div class="chat-view">
                <div class="chat-header">
                    <button class="back-btn" id="backBtn"><i class="fa-solid fa-arrow-left"></i></button>
                    <div class="chat-avatar" style="width:36px;height:36px;font-size:1.2rem">${chat.is_group ? '👥' : '👤'}</div>
                    <div style="flex:1;font-weight:600">${otherName}</div>
                    <button class="icon-btn" id="reportBtn" style="color:var(--danger)" title="Пожаловаться"><i class="fa-solid fa-flag"></i></button>
                </div>
                <div class="messages-list" id="messagesList"></div>
                <div class="input-area">
                    <input type="text" id="messageInput" placeholder="Сообщение..." autocomplete="off">
                    <button class="send-btn" id="sendBtn"><i class="fa-solid fa-paper-plane"></i></button>
                </div>
            </div>
        `;
        document.getElementById('backBtn').addEventListener('click', () => renderApp());
        document.getElementById('sendBtn').addEventListener('click', sendMessage);
        document.getElementById('messageInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });
        document.getElementById('reportBtn').addEventListener('click', () => showReportModal(chat));
        loadMessages(chatId);
        supabase.channel(`chat-${chatId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, () => loadMessages(chatId)).subscribe();
    };

    const loadMessages = async (chatId) => {
        const { data } = await supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true });
        const list = document.getElementById('messagesList');
        list.innerHTML = data?.map(msg => `
            <div class="message ${msg.user_id === currentUser.id ? 'mine' : 'theirs'}">
                ${msg.user_id !== currentUser.id ? `<div class="message-sender">${msg.username || 'Пользователь'} ${msg.is_verified ? '<span class="verified-badge"><i class="fa-solid fa-check"></i></span>' : ''}</div>` : ''}
                <div>${msg.content || ''}</div>
                <div class="message-time">${new Date(msg.created_at).toLocaleTimeString().slice(0,5)}</div>
            </div>
        `).join('') || '<div style="text-align:center;color:var(--text-secondary);padding:20px">Нет сообщений</div>';
        setTimeout(() => { list.scrollTop = list.scrollHeight; }, 100);
    };

    const sendMessage = async () => {
        const input = document.getElementById('messageInput');
        const content = input?.value.trim();
        if (!content || !activeChat) return;
        await supabase.from('messages').insert({ chat_id: activeChat.id, user_id: currentUser.id, username: currentUser.username, content, is_verified: currentUser.is_verified || false });
        input.value = '';
    };

    // ========== ЖАЛОБА ==========
    const showReportModal = (chat) => {
        const otherName = chat.name?.replace(` & ${currentUser.username}`, '').replace(`${currentUser.username} & `, '') || 'Чат';
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-card">
                <h3>⚠️ Жалоба</h3>
                <p style="color:var(--text-secondary);margin-bottom:12px;text-align:center">Чат с: <strong>${otherName}</strong></p>
                <textarea id="reportReason" class="modal-input" placeholder="Опишите причину жалобы..." style="height:100px;resize:none"></textarea>
                <button class="modal-btn" id="sendReportBtn" style="background:var(--danger)">Отправить жалобу</button>
                <button class="modal-btn secondary" id="closeReportBtn">Отмена</button>
            </div>
        `;
        document.body.appendChild(overlay);
        document.getElementById('closeReportBtn').addEventListener('click', () => overlay.remove());
        document.getElementById('sendReportBtn').addEventListener('click', async () => {
            const reason = document.getElementById('reportReason').value.trim();
            if (!reason) return alert('Опишите причину жалобы');
            await supabase.from('reports').insert({ from_user: currentUser.id, from_username: currentUser.username, chat_id: chat.id, chat_name: chat.name, reason });
            alert('Жалоба отправлена. Администратор рассмотрит её.');
            overlay.remove();
        });
    };

    // ========== НОВЫЙ ЧАТ ==========
    const showNewChatModal = () => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-card"><h3>Новый чат</h3>
                <input type="text" id="newChatUsername" class="modal-input" placeholder="Точный никнейм собеседника">
                <button class="modal-btn" id="createChatBtn">Создать чат</button>
                <button class="modal-btn secondary" id="closeModalBtn">Отмена</button>
                <div id="createChatError" style="color:var(--danger);font-size:0.85rem;text-align:center;margin-top:8px;display:none"></div>
            </div>`;
        document.body.appendChild(overlay);
        document.getElementById('closeModalBtn').addEventListener('click', () => overlay.remove());
        document.getElementById('createChatBtn').addEventListener('click', async () => {
            const username = document.getElementById('newChatUsername').value.trim();
            const errorEl = document.getElementById('createChatError');
            if (!username) { errorEl.textContent = 'Введите никнейм'; errorEl.style.display = 'block'; return; }
            if (username === currentUser.username) { errorEl.textContent = 'Нельзя создать чат с самим собой'; errorEl.style.display = 'block'; return; }
            const { data: otherUser } = await supabase.from('users').select('*').eq('username', username).single();
            if (!otherUser) { errorEl.textContent = 'Пользователь не найден'; errorEl.style.display = 'block'; return; }
            const chatName = [currentUser.username, otherUser.username].sort().join(' & ');
            const { data: existingChat } = await supabase.from('chats').select('*').eq('name', chatName).eq('is_group', false).single();
            if (existingChat) { overlay.remove(); openChat(existingChat.id); return; }
            const { data: chat } = await supabase.from('chats').insert({ name: chatName }).select().single();
            await supabase.from('chat_members').insert([{ chat_id: chat.id, user_id: currentUser.id }, { chat_id: chat.id, user_id: otherUser.id }]);
            overlay.remove();
            openChat(chat.id);
        });
    };

    // ========== ПРОФИЛЬ ==========
    const showProfileModal = () => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = html`
            <div class="modal-card"><h3>Профиль</h3>
                <p style="font-size:1.2rem;font-weight:600;text-align:center">${currentUser.username} ${currentUser.is_verified ? '<span class="verified-badge"><i class="fa-solid fa-check"></i></span>' : ''}</p>
                <p style="color:var(--text-secondary);text-align:center;margin:10px 0">Выберите эмодзи:</p>
                <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">${['👤','😀','😎','🤖','👽','🦊','🐼','🎃','💎','🔥','🌈','⚡','🌟','🍕','🎉'].map(e => `<span style="font-size:2rem;cursor:pointer" class="emoji-opt">${e}</span>`).join('')}</div>
                <button class="modal-btn secondary" id="logoutBtn" style="margin-top:16px;color:var(--danger)">Выйти</button>
                <button class="modal-btn secondary" id="closeProfileBtn">Закрыть</button>
            </div>`;
        document.body.appendChild(overlay);
        document.getElementById('closeProfileBtn').addEventListener('click', () => overlay.remove());
        document.getElementById('logoutBtn').addEventListener('click', () => { supabase.from('users').update({ is_online: false }).eq('id', currentUser.id); localStorage.removeItem('nobu_user'); location.reload(); });
        overlay.querySelectorAll('.emoji-opt').forEach(el => el.addEventListener('click', async () => { await supabase.from('users').update({ avatar_emoji: el.textContent }).eq('id', currentUser.id); overlay.remove(); }));
    };

    // ========== АДМИНКА ==========
    const showAdminLogin = () => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-card"><h3>🛡️ Доступ администратора</h3>
                <input type="password" id="adminPassword" class="modal-input" placeholder="Введите пароль администратора">
                <button class="modal-btn" id="adminLoginBtn">Войти</button>
                <button class="modal-btn secondary" id="closeAdminLoginBtn">Отмена</button>
            </div>`;
        document.body.appendChild(overlay);
        document.getElementById('closeAdminLoginBtn').addEventListener('click', () => overlay.remove());
        document.getElementById('adminLoginBtn').addEventListener('click', () => {
            if (document.getElementById('adminPassword').value === ADMIN_PASSWORD) { overlay.remove(); showAdminPanel(); }
            else alert('Неверный пароль');
        });
    };

    const showAdminPanel = () => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-card" style="max-height:85vh;overflow-y:auto"><h3>🛡️ Админ-панель</h3>
                <h4>🔨 Заблокировать</h4><input type="text" id="banUsername" class="modal-input" placeholder="Никнейм">
                <select id="banDuration" class="modal-input"><option value="10">10 минут</option><option value="60">1 час</option><option value="360">6 часов</option><option value="1440">24 часа</option><option value="10080">7 дней</option><option value="43200">30 дней</option></select>
                <input type="text" id="banReason" class="modal-input" placeholder="Причина бана">
                <button class="modal-btn" id="banUserBtn" style="background:var(--danger)">Заблокировать</button>
                <h4>✅ Верификация</h4><input type="text" id="verifyUsername" class="modal-input" placeholder="Никнейм"><button class="modal-btn" id="verifyUserBtn">Выдать галочку</button>
                <h4>🔓 Разблокировать</h4><input type="text" id="unbanUsername" class="modal-input" placeholder="Никнейм"><button class="modal-btn" id="unbanUserBtn" style="background:var(--success)">Разблокировать</button>
                <h4>📋 Активные баны</h4><div id="banList"></div>
                <h4>⚠️ Жалобы</h4><div id="reportsList"></div>
                <button class="modal-btn secondary" id="closeAdminBtn" style="margin-top:12px">Закрыть</button>
            </div>`;
        document.body.appendChild(overlay);
        document.getElementById('closeAdminBtn').addEventListener('click', () => overlay.remove());
        
        const loadBanList = async () => {
            const { data } = await supabase.from('bans').select('*').order('created_at', { ascending: false });
            document.getElementById('banList').innerHTML = data?.length ? data.map(b => `<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:0.85rem"><strong>${b.username}</strong> — до ${new Date(b.expires_at).toLocaleString('ru-RU')}<br><small>${b.reason || 'Без причины'}</small></div>`).join('') : '<p style="color:var(--text-secondary);font-size:0.85rem">Нет активных банов</p>';
        };
        
        const loadReports = async () => {
            const { data } = await supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(20);
            document.getElementById('reportsList').innerHTML = data?.length ? data.map(r => `<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:0.85rem"><strong>${r.from_username}</strong> жалуется на чат «${r.chat_name}»<br><small style="color:var(--danger)">${r.reason}</small><br><small style="color:var(--text-secondary)">${new Date(r.created_at).toLocaleString('ru-RU')}</small></div>`).join('') : '<p style="color:var(--text-secondary);font-size:0.85rem">Нет жалоб</p>';
        };
        
        loadBanList(); loadReports();
        document.getElementById('banUserBtn').addEventListener('click', async () => {
            const username = document.getElementById('banUsername').value.trim();
            const minutes = parseInt(document.getElementById('banDuration').value);
            const reason = document.getElementById('banReason').value.trim() || 'нарушение правил';
            if (!username) return;
            const { data: user } = await supabase.from('users').select('id').eq('username', username).single();
            await supabase.from('bans').upsert({ user_id: user?.id, username, reason, expires_at: new Date(Date.now() + minutes * 60000).toISOString() });
            alert(`${username} заблокирован на ${minutes} минут`);
            loadBanList();
        });
        document.getElementById('verifyUserBtn').addEventListener('click', async () => { const username = document.getElementById('verifyUsername').value.trim(); if (!username) return; await supabase.from('users').update({ is_verified: true }).eq('username', username); alert(`${username} верифицирован ✅`); });
        document.getElementById('unbanUserBtn').addEventListener('click', async () => { const username = document.getElementById('unbanUsername').value.trim(); if (!username) return; await supabase.from('bans').delete().eq('username', username); alert(`${username} разблокирован`); loadBanList(); });
    };

    // ========== ЗАПУСК ==========
    const init = async () => {
        const saved = localStorage.getItem('nobu_user');
        if (saved) { currentUser = JSON.parse(saved); const ban = await checkBan(); if (ban) { showBanScreen(ban); return; } await supabase.from('users').update({ is_online: true }).eq('id', currentUser.id); renderApp(); }
        else renderLogin();
        window.addEventListener('beforeunload', () => { if (currentUser) supabase.from('users').update({ is_online: false }).eq('id', currentUser.id); });
    };

    return { init };
})();

document.addEventListener('DOMContentLoaded', () => NobuWave.init());
(function() {
    const supabase = window.supabase.createClient(
        'https://iljsednetiogjtowlexo.supabase.co',
        'sb_publishable_gXxOqmU-XXnrVz8FHro2jA_ybG9EQ7O'
    );

    const $ = (id) => document.getElementById(id);
    // Auth DOM
    const authOverlay = $('authOverlay');
    const appContainer = $('appContainer');
    const loginForm = $('loginForm');
    const registerForm = $('registerForm');
    const loginEmail = $('loginEmail');
    const loginPassword = $('loginPassword');
    const loginError = $('loginError');
    const regNickname = $('regNickname');
    const regEmail = $('regEmail');
    const regPassword = $('regPassword');
    const regError = $('regError');
    // Screens
    const screenFeed = $('screenFeed');
    const screenFollowing = $('screenFollowing');
    const videoFeed = $('videoFeed');
    const followingFeed = $('followingFeed');
    // Upload
    const uploadOverlay = $('uploadOverlay');
    const uploadBtn = $('uploadBtn');
    const uploadCancel = $('uploadCancel');
    const uploadProgress = $('uploadProgress');
    const videoFile = $('videoFile');
    const videoCaption = $('videoCaption');
    // Profile
    const profileOverlay = $('profileOverlay');
    const profileNickname = $('profileNickname');
    const profileAvatar = $('profileAvatar');
    const profileFollowers = $('profileFollowers');
    const profileFollowing = $('profileFollowing');
    const profileVideoCount = $('profileVideoCount');
    const logoutBtn = $('logoutBtn');
    // User profile
    const userProfileOverlay = $('userProfileOverlay');
    const userProfileAvatar = $('userProfileAvatar');
    const userProfileNickname = $('userProfileNickname');
    const userProfileFollowers = $('userProfileFollowers');
    const userProfileVideoCount = $('userProfileVideoCount');
    const userFollowBtn = $('userFollowBtn');
    const closeUserProfile = $('closeUserProfile');
    // Comments
    const commentsOverlay = $('commentsOverlay');
    const commentsList = $('commentsList');
    const commentInput = $('commentInput');
    const sendCommentBtn = $('sendCommentBtn');
    const closeComments = $('closeComments');
    // Nav
    const navItems = document.querySelectorAll('.nav-item');

    let currentUser = null;
    let profile = null;
    let currentVideoId = null;

    // ===================== AUTH =====================
    async function checkSession() {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) { currentUser = user; await loadProfile(); showApp(); }
        else showAuth();
    }

    async function loadProfile() {
        const { data } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
        profile = data || { nickname: currentUser.email?.split('@')[0] || 'Гость' };
        profileNickname.textContent = profile.nickname;
        profileAvatar.textContent = profile.nickname.charAt(0).toUpperCase();
    }

    function showApp() { authOverlay.classList.add('hidden'); appContainer.classList.remove('hidden'); switchScreen('feed'); }
    function showAuth() { authOverlay.classList.remove('hidden'); appContainer.classList.add('hidden'); }

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const { data, error } = await supabase.auth.signUp({ email: regEmail.value, password: regPassword.value });
        if (error) { regError.textContent = error.message; return; }
        if (data.user) {
            await supabase.from('profiles').insert({ id: data.user.id, nickname: regNickname.value || regEmail.value.split('@')[0] });
            regError.style.color = '#22c55e';
            regError.textContent = '✅ Готово! Теперь войдите.';
            registerForm.reset();
        }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const { error } = await supabase.auth.signInWithPassword({ email: loginEmail.value, password: loginPassword.value });
        if (error) loginError.textContent = error.message;
        else checkSession();
    });

    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            loginForm.classList.toggle('hidden', tab.dataset.tab !== 'login');
            registerForm.classList.toggle('hidden', tab.dataset.tab !== 'register');
        });
    });

    logoutBtn.addEventListener('click', async () => { 
        await supabase.auth.signOut(); 
        currentUser = null; 
        profile = null; 
        profileOverlay.classList.add('hidden'); 
        showAuth(); 
    });

    // ===================== NAVIGATION =====================
    function switchScreen(screen) {
        [screenFeed, screenFollowing].forEach(s => s.classList.remove('active'));
        if (screen === 'feed') screenFeed.classList.add('active');
        else if (screen === 'following') screenFollowing.classList.add('active');
        
        uploadOverlay.classList.add('hidden');
        profileOverlay.classList.add('hidden');
        userProfileOverlay.classList.add('hidden');
        commentsOverlay.classList.add('hidden');
        
        navItems.forEach(n => n.classList.remove('active'));
        const activeNav = document.querySelector(`.nav-item[data-screen="${screen}"]`);
        if (activeNav) activeNav.classList.add('active');
        
        if (screen === 'feed') loadMainFeed();
        else if (screen === 'following') loadFollowingFeed();
    }

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const screen = item.dataset.screen;
            if (screen === 'upload') {
                uploadOverlay.classList.remove('hidden');
                return;
            }
            if (screen === 'profile') {
                updateOwnProfileStats();
                profileOverlay.classList.remove('hidden');
                return;
            }
            switchScreen(screen);
        });
    });

    // ===================== FEED =====================
    async function loadMainFeed() {
        videoFeed.innerHTML = '<div class="feed-loading">Загрузка...</div>';
        const { data } = await supabase.from('videos').select('*').order('created_at', { ascending: false });
        renderVideoCards(videoFeed, data);
    }

    async function loadFollowingFeed() {
        if (!currentUser) return;
        followingFeed.innerHTML = '<div class="feed-loading">Загрузка...</div>';
        const { data: follows } = await supabase.from('followers').select('following_id').eq('follower_id', currentUser.id);
        const ids = follows?.map(f => f.following_id) || [];
        if (ids.length === 0) {
            followingFeed.innerHTML = '<div style="color:#888;text-align:center;padding:40px;">Вы ни на кого не подписаны</div>';
            return;
        }
        const { data } = await supabase.from('videos').select('*').in('user_id', ids).order('created_at', { ascending: false });
        renderVideoCards(followingFeed, data);
    }

    function renderVideoCards(container, videos) {
        container.innerHTML = '';
        if (!videos || videos.length === 0) {
            container.innerHTML = '<div style="color:#888;text-align:center;padding:40px;">Нет видео</div>';
            return;
        }
        videos.forEach(video => {
            const card = document.createElement('div');
            card.className = 'video-card';
            card.innerHTML = `
                <video src="${video.video_url}" loop muted playsinline></video>
                <div class="video-info">
                    <div class="video-nickname" data-user-id="${video.user_id}">${esc(video.nickname)}</div>
                    <div class="video-caption">${esc(video.caption || '')}</div>
                </div>
                <div class="video-actions">
                    <div class="video-action like-action" data-video-id="${video.id}">
                        <i class="fa-regular fa-heart"></i>
                        <span>${video.likes || 0}</span>
                    </div>
                    <div class="video-action comment-action" data-video-id="${video.id}">
                        <i class="fa-regular fa-comment"></i>
                    </div>
                </div>`;
            
            const nicknameEl = card.querySelector('.video-nickname');
            nicknameEl.addEventListener('click', (e) => {
                e.stopPropagation();
                openUserProfile(video.user_id);
            });
            
            const likeBtn = card.querySelector('.like-action');
            likeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                likeVideo(video.id, likeBtn);
            });
            
            const commentBtn = card.querySelector('.comment-action');
            commentBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openComments(video.id);
            });
            
            container.appendChild(card);
        });
        
        // Автовоспроизведение
        const firstVideo = container.querySelector('video');
        if (firstVideo) firstVideo.play().catch(() => {});
        
        container.addEventListener('scroll', () => {
            const videos = container.querySelectorAll('video');
            let closestVideo = null;
            let minDistance = Infinity;
            const containerRect = container.getBoundingClientRect();
            videos.forEach(v => {
                const rect = v.getBoundingClientRect();
                const distance = Math.abs(rect.top + rect.height/2 - containerRect.top - containerRect.height/2);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestVideo = v;
                }
            });
            videos.forEach(v => v.pause());
            if (closestVideo) closestVideo.play().catch(() => {});
        });
    }

    // ===================== LIKES =====================
    async function likeVideo(videoId, btn) {
        if (!currentUser) return;
        const { data } = await supabase.from('videos').select('likes').eq('id', videoId).single();
        const newLikes = (data?.likes || 0) + 1;
        await supabase.from('videos').update({ likes: newLikes }).eq('id', videoId);
        btn.querySelector('i').className = 'fa-solid fa-heart';
        btn.querySelector('span').textContent = newLikes;
        btn.style.color = '#ef4444';
    }

    // ===================== COMMENTS =====================
    async function openComments(videoId) {
        currentVideoId = videoId;
        commentsOverlay.classList.remove('hidden');
        await loadComments();
    }

    async function loadComments() {
        const { data } = await supabase.from('comments').select('*').eq('video_id', currentVideoId).order('created_at', { ascending: true });
        commentsList.innerHTML = data?.map(c => `
            <div class="comment-item">
                <div class="comment-nickname">${esc(c.nickname)}</div>
                <div class="comment-text">${esc(c.content)}</div>
            </div>
        `).join('') || '<p style="color:#888;">Нет комментариев</p>';
    }

    sendCommentBtn.addEventListener('click', async () => {
        const content = commentInput.value.trim();
        if (!content || !currentUser) return;
        await supabase.from('comments').insert({
            video_id: currentVideoId,
            user_id: currentUser.id,
            nickname: profile.nickname,
            content: content
        });
        commentInput.value = '';
        loadComments();
    });

    closeComments.addEventListener('click', () => commentsOverlay.classList.add('hidden'));

    // ===================== UPLOAD =====================
    uploadCancel.addEventListener('click', () => uploadOverlay.classList.add('hidden'));
    
    uploadBtn.addEventListener('click', async () => {
        const file = videoFile.files[0];
        if (!file) return;
        uploadProgress.classList.remove('hidden');
        uploadProgress.textContent = 'Загрузка...';
        const path = `tok/${currentUser.id}_${Date.now()}.${file.name.split('.').pop()}`;
        const { error } = await supabase.storage.from('post-images').upload(path, file);
        if (error) { 
            uploadProgress.textContent = 'Ошибка загрузки'; 
            return; 
        }
        const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(path);
        await supabase.from('videos').insert({
            user_id: currentUser.id,
            nickname: profile.nickname,
            video_url: urlData.publicUrl,
            caption: videoCaption.value
        });
        uploadProgress.classList.add('hidden');
        videoCaption.value = '';
        videoFile.value = '';
        uploadOverlay.classList.add('hidden');
        loadMainFeed();
    });

    // ===================== PROFILE =====================
    async function updateOwnProfileStats() {
        if (!currentUser) return;
        const { count: videoCnt } = await supabase.from('videos').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id);
        const { count: followersCnt } = await supabase.from('followers').select('*', { count: 'exact', head: true }).eq('following_id', currentUser.id);
        const { count: followingCnt } = await supabase.from('followers').select('*', { count: 'exact', head: true }).eq('follower_id', currentUser.id);
        profileVideoCount.textContent = `${videoCnt || 0} видео`;
        profileFollowers.textContent = `${followersCnt || 0} подписчиков`;
        profileFollowing.textContent = `${followingCnt || 0} подписок`;
    }

    // ===================== USER PROFILE =====================
    async function openUserProfile(userId) {
        if (userId === currentUser.id) {
            updateOwnProfileStats();
            profileOverlay.classList.remove('hidden');
            return;
        }
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (!prof) return;
        userProfileNickname.textContent = prof.nickname || 'Гость';
        userProfileAvatar.textContent = (prof.nickname || '?').charAt(0).toUpperCase();
        
        const { count: followersCnt } = await supabase.from('followers').select('*', { count: 'exact', head: true }).eq('following_id', userId);
        const { count: videoCnt } = await supabase.from('videos').select('*', { count: 'exact', head: true }).eq('user_id', userId);
        userProfileFollowers.textContent = `${followersCnt || 0} подписчиков`;
        userProfileVideoCount.textContent = `${videoCnt || 0} видео`;
        
        const { data: followData } = await supabase.from('followers').select('*').eq('follower_id', currentUser.id).eq('following_id', userId).maybeSingle();
        const isFollowing = !!followData;
        userFollowBtn.textContent = isFollowing ? 'Отписаться' : 'Подписаться';
        userFollowBtn.classList.toggle('is-following', isFollowing);
        
        userFollowBtn.onclick = async () => {
            if (isFollowing) {
                await supabase.from('followers').delete().match({ follower_id: currentUser.id, following_id: userId });
                userFollowBtn.textContent = 'Подписаться';
                userFollowBtn.classList.remove('is-following');
            } else {
                await supabase.from('followers').insert({ follower_id: currentUser.id, following_id: userId });
                userFollowBtn.textContent = 'Отписаться';
                userFollowBtn.classList.add('is-following');
            }
            const { count: updatedFollowers } = await supabase.from('followers').select('*', { count: 'exact', head: true }).eq('following_id', userId);
            userProfileFollowers.textContent = `${updatedFollowers || 0} подписчиков`;
        };
        
        userProfileOverlay.classList.remove('hidden');
    }

    closeUserProfile.addEventListener('click', () => userProfileOverlay.classList.add('hidden'));

    const esc = s => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m]);

    checkSession();
})();
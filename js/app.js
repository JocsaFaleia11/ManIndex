class ManhwaReader {
    constructor() {
        this.currentUser = null;
        this.currentManhwa = null;
        this.currentChapter = null;
        this.chapters = [];
        this.allManhwas = {};
        this.isLightMode = false;
        this.fitToScreen = true;
        this.readingHistory = {};
        this.favorites = new Set();
        this.modalChapters = [];
        
        this.init();
    }

    async init() {
        console.log('🚀 Iniciando ManhwaReader...');
        this.setupAuthListener();
        this.setupEventListeners();
        this.setupScrollProgress();
        
        await this.loadManhwasWithRetry();
    }

    async loadManhwasWithRetry(attempt = 1) {
        try {
            await this.loadManhwas();
        } catch (error) {
            console.error(`❌ Tentativa ${attempt} falhou:`, error);
            if (attempt < 3) {
                setTimeout(() => this.loadManhwasWithRetry(attempt + 1), 2000);
            } else {
                this.showLoadingError(error);
            }
        }
    }

    showLoadingError(error) {
        const grid = document.getElementById('manhwaGrid');
        if (grid) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
                    <h3 style="color: var(--danger); margin-bottom: 1rem;">Erro ao carregar manhwas</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
                        ${error.message || 'Não foi possível conectar ao servidor'}
                    </p>
                    <button onclick="app.loadManhwasWithRetry()" class="btn-primary" style="width: auto; padding: 0.75rem 2rem;">
                        🔄 Tentar Novamente
                    </button>
                </div>
            `;
        }
    }

    // ==================== AUTENTICAÇÃO ====================
    setupAuthListener() {
        auth.onAuthStateChanged(async (user) => {
            this.currentUser = user;
            
            if (user) {
                console.log('✅ Usuário logado:', user.email);
                // Não tentar carregar dados privados se não for permitido
                // Apenas carregar do localStorage
                this.loadUserDataFromLocal();
                this.showUserMenu();
                this.loadContinueReading();
            } else {
                console.log('ℹ️ Usuário não logado');
                this.showLoginButton();
                this.hideContinueReading();
            }
        }, (error) => {
            console.error('❌ Erro no auth:', error);
        });
    }

    // Carregar dados do localStorage (não precisa de permissão)
    loadUserDataFromLocal() {
        try {
            const history = localStorage.getItem('manhwa_history');
            const favorites = localStorage.getItem('manhwa_favorites');
            
            if (history) this.readingHistory = JSON.parse(history);
            if (favorites) this.favorites = new Set(JSON.parse(favorites));
            
            console.log('✅ Dados locais carregados');
        } catch (error) {
            console.error('❌ Erro ao carregar dados locais:', error);
        }
    }

    // Salvar dados no localStorage
    saveUserDataToLocal() {
        try {
            localStorage.setItem('manhwa_history', JSON.stringify(this.readingHistory));
            localStorage.setItem('manhwa_favorites', JSON.stringify(Array.from(this.favorites)));
        } catch (error) {
            console.error('❌ Erro ao salvar dados locais:', error);
        }
    }

    showUserMenu() {
        const container = document.getElementById('authSection');
        const displayName = this.currentUser?.displayName || this.currentUser?.email?.split('@')[0] || 'Usuário';
        const initial = displayName.charAt(0).toUpperCase();
        
        container.innerHTML = `
            <div class="user-menu">
                <div class="user-avatar">${initial}</div>
                <span class="user-name">${displayName}</span>
                <div class="user-dropdown">
                    <div class="dropdown-item" onclick="app.showProfile()">
                        👤 Perfil
                    </div>
                    <div class="dropdown-item" onclick="app.showFavorites()">
                        ♡ Favoritos (${this.favorites.size})
                    </div>
                    <div class="dropdown-divider"></div>
                    <div class="dropdown-item" onclick="app.logout()">
                        🚪 Sair
                    </div>
                </div>
            </div>
        `;
    }

    showLoginButton() {
        const authSection = document.getElementById('authSection');
        if (authSection) {
            authSection.innerHTML = `
                <button class="btn-login" onclick="app.openAuthModal()">Entrar</button>
            `;
        }
    }

    openAuthModal() {
        const modal = document.getElementById('authModal');
        if (modal) modal.classList.remove('hidden');
    }

    closeAuthModal() {
        const modal = document.getElementById('authModal');
        if (modal) modal.classList.add('hidden');
        
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        if (loginForm) loginForm.reset();
        if (registerForm) registerForm.reset();
    }

    setupEventListeners() {
        // Fechar modal ao clicar no backdrop
        const authModal = document.getElementById('authModal');
        if (authModal) {
            authModal.addEventListener('click', (e) => {
                if (e.target === authModal || e.target.classList.contains('modal-backdrop')) {
                    this.closeAuthModal();
                }
            });
        }

        // Tabs de auth
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active'));
                
                e.target.classList.add('active');
                const tabId = e.target.dataset.tab + 'Tab';
                const tabElement = document.getElementById(tabId);
                if (tabElement) tabElement.classList.add('active');
            });
        });

        // Login com email/senha
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('loginEmail')?.value;
                const password = document.getElementById('loginPassword')?.value;
                
                if (!email || !password) return;
                
                try {
                    await auth.signInWithEmailAndPassword(email, password);
                    this.closeAuthModal();
                    this.showToast('Bem-vindo de volta! 👋', 'success');
                } catch (error) {
                    this.showToast(this.getAuthErrorMessage(error), 'error');
                }
            });
        }

        // Registro
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('registerName')?.value;
                const email = document.getElementById('registerEmail')?.value;
                const password = document.getElementById('registerPassword')?.value;
                
                if (!email || !password) return;
                
                try {
                    const { user } = await auth.createUserWithEmailAndPassword(email, password);
                    if (name) await user.updateProfile({ displayName: name });
                    
                    this.closeAuthModal();
                    this.showToast('Conta criada com sucesso! 🎉', 'success');
                } catch (error) {
                    this.showToast(this.getAuthErrorMessage(error), 'error');
                }
            });
        }

        // Google Login - com tratamento de erro melhorado
        const googleBtn = document.getElementById('googleLogin');
        if (googleBtn) {
            googleBtn.addEventListener('click', async () => {
                const provider = new firebase.auth.GoogleAuthProvider();
                provider.setCustomParameters({
                    prompt: 'select_account'
                });
                
                try {
                    // Usar redirect em vez de popup para evitar problemas de COOP
                    await auth.signInWithRedirect(provider);
                } catch (error) {
                    console.error('Erro Google login:', error);
                    this.showToast(this.getAuthErrorMessage(error), 'error');
                    
                    // Fallback para popup se redirect falhar
                    try {
                        await auth.signInWithPopup(provider);
                        this.closeAuthModal();
                        this.showToast('Login com Google realizado! 👋', 'success');
                    } catch (popupError) {
                        this.showToast(this.getAuthErrorMessage(popupError), 'error');
                    }
                }
            });
        }

        // Busca
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchManhwas(e.target.value);
            });
        }

        // Limpar histórico
        const clearHistoryBtn = document.getElementById('clearHistory');
        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', () => this.clearHistory());
        }

        // Filtros
        document.querySelectorAll('.tag').forEach(tag => {
            tag.addEventListener('click', (e) => {
                document.querySelectorAll('.tag').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this.filterManhwas(e.target.dataset.filter);
            });
        });

        // Reader
        const backBtn = document.getElementById('backBtn');
        if (backBtn) backBtn.addEventListener('click', () => this.showList());

        const chapterSelect = document.getElementById('chapterSelect');
        if (chapterSelect) {
            chapterSelect.addEventListener('change', (e) => {
                if (e.target.value) this.loadChapter(e.target.value);
            });
        }

        const prevChapter = document.getElementById('prevChapter');
        if (prevChapter) prevChapter.addEventListener('click', () => this.navigateChapter(-1));

        const nextChapter = document.getElementById('nextChapter');
        if (nextChapter) nextChapter.addEventListener('click', () => this.navigateChapter(1));

        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) themeToggle.addEventListener('click', () => this.toggleTheme());

        const fitToggle = document.getElementById('fitToggle');
        if (fitToggle) fitToggle.addEventListener('click', () => this.toggleFit());

        const scrollTop = document.getElementById('scrollTop');
        if (scrollTop) {
            scrollTop.addEventListener('click', () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }

        const bookmarkBtn = document.getElementById('bookmarkBtn');
        if (bookmarkBtn) bookmarkBtn.addEventListener('click', () => this.toggleFavorite());
    }

    getAuthErrorMessage(error) {
        const messages = {
            'auth/invalid-email': 'Email inválido',
            'auth/user-disabled': 'Conta desativada',
            'auth/user-not-found': 'Usuário não encontrado',
            'auth/wrong-password': 'Senha incorreta',
            'auth/email-already-in-use': 'Email já cadastrado',
            'auth/weak-password': 'Senha muito fraca (mínimo 6 caracteres)',
            'auth/popup-closed-by-user': 'Login cancelado',
            'auth/cancelled-popup-request': 'Muitas tentativas de login',
            'auth/popup-blocked': 'Popup bloqueado pelo navegador',
            'auth/network-request-failed': 'Erro de conexão'
        };
        return messages[error.code] || error.message;
    }

    async logout() {
        try {
            await auth.signOut();
            this.readingHistory = {};
            this.favorites.clear();
            this.showToast('Você saiu da conta', 'success');
        } catch (error) {
            console.error('Erro ao sair:', error);
        }
    }

    // ==================== CONTINUAR LENDO ====================
    async saveReadingProgress(manhwaId, chapterId, pageNumber = 1) {
        // Verificar se os parâmetros são válidos
        if (!manhwaId || !chapterId) {
            console.warn('⚠️ manhwaId ou chapterId undefined:', { manhwaId, chapterId });
            return;
        }

        const progress = {
            manhwaId: manhwaId,
            chapterId: chapterId,
            pageNumber: pageNumber || 1,
            lastRead: Date.now()
        };

        // Sempre salvar no localStorage
        this.readingHistory[manhwaId] = progress;
        this.saveUserDataToLocal();

        // Tentar salvar no Firebase se possível
        if (this.currentUser) {
            try {
                const userId = this.currentUser.uid;
                const path = `users/${userId}/history/${manhwaId}`;
                await database.ref(path).set(progress);
                console.log('✅ Progresso salvo no Firebase');
            } catch (error) {
                console.log('ℹ️ Salvando apenas localmente');
            }
        }
    }

    async loadContinueReading() {
        const container = document.getElementById('continueGrid');
        const section = document.getElementById('continueReading');
        
        if (!container || !section) return;
        
        // Usar dados do localStorage
        let historyEntries = Object.entries(this.readingHistory);
        
        historyEntries.sort((a, b) => (b[1].lastRead || 0) - (a[1].lastRead || 0));
        historyEntries = historyEntries.slice(0, 6);

        if (historyEntries.length === 0) {
            section.classList.add('hidden');
            return;
        }

        section.classList.remove('hidden');
        container.innerHTML = '';

        for (const [manhwaId, progress] of historyEntries) {
            const manhwa = this.allManhwas[manhwaId];
            if (!manhwa) continue;

            const chapter = manhwa.chapters?.[progress.chapterId];
            if (!chapter) continue;

            const totalPages = chapter.pages?.length || 1;
            const readPercent = Math.round((progress.pageNumber / totalPages) * 100);

            const card = document.createElement('div');
            card.className = 'continue-card';
            card.innerHTML = `
                <img src="${manhwa.coverUrl}" class="continue-cover" 
                     onerror="this.src='https://via.placeholder.com/80x110'">
                <div class="continue-info">
                    <div>
                        <div class="continue-title">${manhwa.title}</div>
                        <div class="continue-chapter">${chapter.title}</div>
                    </div>
                    <div class="continue-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${readPercent}%"></div>
                        </div>
                        <div class="continue-meta">
                            <span>${readPercent}% lido</span>
                            <span>Pág. ${progress.pageNumber}/${totalPages}</span>
                        </div>
                    </div>
                </div>
                <button class="btn-remove-continue" onclick="event.stopPropagation(); app.removeFromHistory('${manhwaId}')" title="Remover">
                    ×
                </button>
            `;

            card.addEventListener('click', () => {
                this.openManhwaModal(manhwa);
            });

            container.appendChild(card);
        }
    }

    hideContinueReading() {
        document.getElementById('continueReading')?.classList.add('hidden');
    }

    async removeFromHistory(manhwaId) {
        delete this.readingHistory[manhwaId];
        this.saveUserDataToLocal();
        
        if (this.currentUser) {
            try {
                await database.ref(`users/${this.currentUser.uid}/history/${manhwaId}`).remove();
            } catch (error) {
                // Ignorar erro de permissão
            }
        }
        
        this.loadContinueReading();
        this.showToast('Removido do histórico', 'success');
    }

    async clearHistory() {
        if (!confirm('Limpar todo o histórico de leitura?')) return;

        this.readingHistory = {};
        this.saveUserDataToLocal();
        
        if (this.currentUser) {
            try {
                await database.ref(`users/${this.currentUser.uid}/history`).remove();
            } catch (error) {
                // Ignorar erro
            }
        }

        this.loadContinueReading();
        this.showToast('Histórico limpo!', 'success');
    }

    // ==================== FAVORITOS ====================
    async toggleFavorite() {
        if (!this.currentManhwa) return;
        
        const manhwaId = this.currentManhwa.id;
        
        if (this.favorites.has(manhwaId)) {
            this.favorites.delete(manhwaId);
            this.showToast('Removido dos favoritos', 'success');
        } else {
            this.favorites.add(manhwaId);
            this.showToast('Adicionado aos favoritos! ❤️', 'success');
        }

        this.saveUserDataToLocal();
        this.updateBookmarkButton();

        // Tentar salvar no Firebase (opcional)
        if (this.currentUser) {
            try {
                await database.ref(`users/${this.currentUser.uid}/favorites`).set(Array.from(this.favorites));
            } catch (error) {
                // Ignorar erro de permissão
            }
        }
    }

    updateBookmarkButton() {
        const btn = document.getElementById('bookmarkBtn');
        if (!btn || !this.currentManhwa) return;
        
        if (this.favorites.has(this.currentManhwa.id)) {
            btn.classList.add('active');
            btn.innerHTML = '♥';
        } else {
            btn.classList.remove('active');
            btn.innerHTML = '♡';
        }
    }

    // ==================== CARREGAMENTO DE MANHWAS ====================
    loadManhwas() {
        return new Promise((resolve, reject) => {
            console.log('📚 Carregando manhwas...');
            const grid = document.getElementById('manhwaGrid');
            
            if (!grid) {
                reject(new Error('Elemento manhwaGrid não encontrado'));
                return;
            }

            const timeout = setTimeout(() => {
                reject(new Error('Timeout ao carregar manhwas (10s)'));
            }, 10000);

            try {
                const manhwasRef = database.ref('manhwas');
                
                manhwasRef.once('value', (snapshot) => {
                    clearTimeout(timeout);
                    console.log('✅ Dados recebidos do Firebase');
                    
                    grid.innerHTML = '';
                    this.allManhwas = {};
                    
                    if (!snapshot.exists()) {
                        grid.innerHTML = `
                            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
                                <div style="font-size: 3rem; margin-bottom: 1rem;">📚</div>
                                <h3 style="margin-bottom: 1rem;">Nenhum manhwa cadastrado</h3>
                            </div>
                        `;
                        resolve();
                        return;
                    }

                    const manhwas = [];
                    snapshot.forEach((child) => {
                        const manhwa = { id: child.key, ...child.val() };
                        this.allManhwas[child.key] = manhwa;
                        manhwas.push(manhwa);
                    });

                    manhwas.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                    manhwas.forEach((manhwa) => this.renderManhwaCard(manhwa));
                    
                    this.loadContinueReading();
                    resolve();
                }, (error) => {
                    clearTimeout(timeout);
                    reject(error);
                });

            } catch (error) {
                clearTimeout(timeout);
                reject(error);
            }
        });
    }

    renderManhwaCard(manhwa) {
        const grid = document.getElementById('manhwaGrid');
        if (!grid) return;
        
        const chapterCount = manhwa.chapters ? Object.keys(manhwa.chapters).length : 0;
        const latestChapter = chapterCount > 0 ? 
            Object.values(manhwa.chapters).sort((a, b) => b.number - a.number)[0] : null;

        const card = document.createElement('div');
        card.className = 'manhwa-card';
        card.dataset.genre = manhwa.genre?.join(',').toLowerCase() || '';
        
        card.innerHTML = `
            <img src="${manhwa.coverUrl || 'https://via.placeholder.com/220x320/1a1a2e/6366f1?text=Sem+Capa'}" 
                 alt="${manhwa.title}" 
                 class="manhwa-cover"
                 loading="lazy"
                 onerror="this.src='https://via.placeholder.com/220x320/1a1a2e/6366f1?text=Sem+Capa'">
            <div class="manhwa-info">
                <h3 class="manhwa-title">${manhwa.title || 'Sem título'}</h3>
                <div class="manhwa-meta">
                    <span>${manhwa.genre?.slice(0, 2).join(', ') || 'Sem gênero'}</span>
                </div>
                ${latestChapter ? `
                    <div class="chapter-badge">
                        📖 Cap. ${latestChapter.number}
                    </div>
                ` : ''}
            </div>
        `;
        
        card.addEventListener('click', () => this.openManhwaModal(manhwa));
        grid.appendChild(card);
    }

    filterManhwas(filter) {
        const cards = document.querySelectorAll('.manhwa-card');
        
        cards.forEach(card => {
            if (filter === 'all') {
                card.style.display = 'block';
            } else {
                const genres = card.dataset.genre || '';
                card.style.display = genres.includes(filter) ? 'block' : 'none';
            }
        });
    }

    // ==================== MODAL DE DETALHES ====================
    openManhwaModal(manhwa) {
        console.log('📖 Abrindo modal:', manhwa.title);
        this.currentManhwa = manhwa;
        this.chapters = [];
        this.modalChapters = [];
        
        if (manhwa.chapters) {
            this.chapters = Object.entries(manhwa.chapters)
                .map(([id, data]) => ({ id, ...data }))
                .sort((a, b) => a.number - b.number);
            
            this.modalChapters = [...this.chapters].sort((a, b) => b.number - a.number);
        }

        const titleEl = document.getElementById('modalTitle');
        const coverEl = document.getElementById('modalCover');
        const backdropEl = document.getElementById('modalBackdrop');
        const synopsisEl = document.getElementById('modalSynopsis');
        const genreEl = document.getElementById('modalGenre');
        const chaptersEl = document.getElementById('modalChapters');
        
        if (titleEl) titleEl.textContent = manhwa.title || 'Sem título';
        if (coverEl) coverEl.src = manhwa.coverUrl || '';
        if (backdropEl) backdropEl.src = manhwa.coverUrl || '';
        if (synopsisEl) synopsisEl.textContent = manhwa.description || 'Sem sinopse disponível.';
        if (genreEl) genreEl.textContent = manhwa.genre?.[0] || 'Sem gênero';
        if (chaptersEl) chaptersEl.textContent = `${this.modalChapters.length} capítulos`;
        
        const favBtn = document.getElementById('favoriteBtn');
        if (favBtn) {
            if (this.favorites.has(manhwa.id)) {
                favBtn.classList.add('active');
                favBtn.innerHTML = '♥';
            } else {
                favBtn.classList.remove('active');
                favBtn.innerHTML = '♡';
            }
        }

        const progress = this.readingHistory[manhwa.id];
        const continueBtn = document.getElementById('continueReadingBtn');
        
        if (continueBtn) {
            if (progress && manhwa.chapters?.[progress.chapterId]) {
                continueBtn.innerHTML = `▶ Continuar ${manhwa.chapters[progress.chapterId].title}`;
                continueBtn.style.display = 'flex';
            } else {
                continueBtn.style.display = 'none';
            }
        }

        this.renderChaptersList(this.modalChapters);
        
        const modal = document.getElementById('manhwaModal');
        if (modal) {
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
    }

    closeManhwaModal() {
        const modal = document.getElementById('manhwaModal');
        if (modal) {
            modal.classList.add('hidden');
        }
        document.body.style.overflow = '';
    }

    renderChaptersList(chapters) {
        const container = document.getElementById('chaptersList');
        if (!container) return;
        
        container.innerHTML = '';

        if (chapters.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">Nenhum capítulo disponível</div>';
            return;
        }

        const progress = this.readingHistory[this.currentManhwa?.id];

        chapters.forEach((chapter) => {
            const isReading = progress?.chapterId === chapter.id;
            const isNew = (Date.now() - (chapter.uploadedAt || 0)) < 7 * 24 * 60 * 60 * 1000;
            
            const item = document.createElement('div');
            item.className = `chapter-item ${isReading ? 'reading' : ''}`;
            
            const chapterId = chapter.id;
            item.onclick = () => {
                console.log('📖 Clicou no capítulo:', chapterId);
                this.readChapterFromModal(chapterId);
            };
            
            item.innerHTML = `
                <div class="chapter-number">${Math.floor(chapter.number)}</div>
                <div class="chapter-info">
                    <div class="chapter-title">${chapter.title}</div>
                    <div class="chapter-meta">${chapter.pageCount || '?'} páginas</div>
                </div>
                ${isReading ? '<span class="chapter-status">📖 Lendo</span>' : 
                  isNew ? '<span class="chapter-status new">✨ Novo</span>' : ''}
            `;
            
            container.appendChild(item);
        });
    }

    filterChapters() {
        const query = document.getElementById('searchChapter')?.value.toLowerCase();
        if (!query) {
            this.renderChaptersList(this.modalChapters);
            return;
        }
        
        const filtered = this.modalChapters.filter(ch => 
            ch.title.toLowerCase().includes(query) || 
            ch.number.toString().includes(query)
        );
        this.renderChaptersList(filtered);
    }

    sortChapters() {
        const sort = document.getElementById('sortChapters')?.value;
        let sorted = [...this.modalChapters];
        
        if (sort === 'oldest') {
            sorted.sort((a, b) => a.number - b.number);
        } else {
            sorted.sort((a, b) => b.number - a.number);
        }
        
        this.renderChaptersList(sorted);
    }

    startReading() {
        const progress = this.readingHistory[this.currentManhwa?.id];
        if (progress) {
            this.closeManhwaModal();
            setTimeout(() => this.loadChapter(progress.chapterId), 300);
        }
    }

    readFromBeginning() {
        if (this.modalChapters.length > 0) {
            const firstChapter = [...this.modalChapters].sort((a, b) => a.number - b.number)[0];
            this.closeManhwaModal();
            setTimeout(() => this.loadChapter(firstChapter.id), 300);
        }
    }

    readChapterFromModal(chapterId) {
        console.log('📖 readChapterFromModal:', chapterId);
        
        if (!this.currentManhwa) {
            console.error('❌ currentManhwa é null!');
            this.showToast('Erro: Manhwa não encontrado', 'error');
            return;
        }
        
        if (!this.currentManhwa.chapters || !this.currentManhwa.chapters[chapterId]) {
            console.error('❌ Capítulo não encontrado:', chapterId);
            this.showToast('Erro: Capítulo não encontrado', 'error');
            return;
        }
        
        this.closeManhwaModal();
        
        setTimeout(() => {
            console.log('📖 Chamando loadChapter:', chapterId);
            this.loadChapter(chapterId);
        }, 350);
    }

    toggleModalFavorite() {
        if (!this.currentManhwa) return;
        
        const btn = document.getElementById('favoriteBtn');
        const manhwaId = this.currentManhwa.id;
        
        if (this.favorites.has(manhwaId)) {
            this.favorites.delete(manhwaId);
            btn?.classList.remove('active');
            if (btn) btn.innerHTML = '♡';
            this.showToast('Removido dos favoritos', 'success');
        } else {
            this.favorites.add(manhwaId);
            btn?.classList.add('active');
            if (btn) btn.innerHTML = '♥';
            this.showToast('Adicionado aos favoritos! ❤️', 'success');
        }

        this.saveUserDataToLocal();

        if (this.currentUser) {
            try {
                database.ref(`users/${this.currentUser.uid}/favorites`).set(Array.from(this.favorites));
            } catch (err) {
                // Ignorar
            }
        }
    }

    // ==================== READER ====================
    loadChapter(chapterId) {
        console.log('📖 loadChapter:', chapterId);
        
        if (!this.currentManhwa) {
            console.error('❌ currentManhwa é null!');
            this.showToast('Erro: Manhwa não encontrado', 'error');
            return;
        }
        
        this.currentChapter = chapterId;
        const chapter = this.currentManhwa.chapters[chapterId];
        
        if (!chapter) {
            console.error('❌ Capítulo não encontrado:', chapterId);
            this.showToast('Capítulo não encontrado!', 'error');
            return;
        }

        console.log('✅ Capítulo encontrado:', chapter.title);

        this.saveReadingProgress(this.currentManhwa.id, chapterId, 1);

        const manhwaList = document.getElementById('manhwaList')?.parentElement;
        const continueSection = document.getElementById('continueReading');
        const reader = document.getElementById('reader');
        const mainNav = document.getElementById('mainNav');
        
        if (manhwaList) manhwaList.classList.add('hidden');
        if (continueSection) continueSection.classList.add('hidden');
        if (reader) reader.classList.remove('hidden');
        if (mainNav) mainNav.classList.add('hidden');
        
        const chapterTitle = document.getElementById('chapterTitle');
        const manhwaSubtitle = document.getElementById('manhwaSubtitle');
        
        if (chapterTitle) chapterTitle.textContent = chapter.title;
        if (manhwaSubtitle) manhwaSubtitle.textContent = this.currentManhwa.title;

        const select = document.getElementById('chapterSelect');
        if (select) {
            select.innerHTML = this.chapters.map(ch => `
                <option value="${ch.id}" ${ch.id === chapterId ? 'selected' : ''}>
                    ${ch.title}
                </option>
            `).join('');
        }

        const container = document.getElementById('pagesContainer');
        if (container) {
            container.innerHTML = '';
            if (chapter.pages && chapter.pages.length > 0) {
                chapter.pages.forEach((page, index) => {
                    this.renderPage(page, index, container);
                });
            } else {
                container.innerHTML = '<div style="text-align: center; padding: 3rem; color: var(--text-secondary);">Nenhuma página encontrada</div>';
            }
        }

        window.scrollTo(0, 0);
        this.updateNavButtons();
        this.updateBookmarkButton();
        this.updatePageIndicator(1, chapter.pages?.length || 1);
    }

    renderPage(page, index, container) {
        const wrapper = document.createElement('div');
        wrapper.className = 'page-wrapper';
        
        const img = document.createElement('img');
        img.dataset.src = page.url;
        img.alt = `Página ${index + 1}`;
        img.className = 'page-image';
        
        if (this.fitToScreen) {
            img.style.maxWidth = '100%';
        } else {
            img.style.maxWidth = 'none';
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    img.src = img.dataset.src;
                    img.onload = () => {
                        img.classList.add('loaded');
                    };
                    
                    // Verificar se temos os dados necessários antes de salvar
                    const totalPages = this.currentManhwa?.chapters?.[this.currentChapter]?.pages?.length || 1;
                    this.updatePageIndicator(index + 1, totalPages);
                    
                    // Só salvar se tiver manhwaId válido
                    if (this.currentManhwa?.id && this.currentChapter) {
                        this.saveReadingProgress(this.currentManhwa.id, this.currentChapter, index + 1);
                    }
                    
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });

        observer.observe(wrapper);
        wrapper.appendChild(img);
        container.appendChild(wrapper);
    }

    updatePageIndicator(current, total) {
        const indicator = document.getElementById('pageIndicator');
        if (indicator) {
            indicator.textContent = `${current} / ${total}`;
        }
    }

    navigateChapter(direction) {
        const currentIndex = this.chapters.findIndex(ch => ch.id === this.currentChapter);
        const newIndex = currentIndex + direction;
        
        if (newIndex >= 0 && newIndex < this.chapters.length) {
            this.loadChapter(this.chapters[newIndex].id);
        } else if (newIndex < 0) {
            this.showToast('Este é o primeiro capítulo!', 'error');
        } else {
            this.showToast('Você completou o manhwa! 🎉', 'success');
        }
    }

    updateNavButtons() {
        const currentIndex = this.chapters.findIndex(ch => ch.id === this.currentChapter);
        const prevBtn = document.getElementById('prevChapter');
        const nextBtn = document.getElementById('nextChapter');
        
        if (prevBtn) prevBtn.disabled = currentIndex === 0;
        if (nextBtn) nextBtn.disabled = currentIndex === this.chapters.length - 1;
    }

    showList() {
        const reader = document.getElementById('reader');
        const manhwaList = document.getElementById('manhwaList')?.parentElement;
        const mainNav = document.getElementById('mainNav');
        
        if (reader) reader.classList.add('hidden');
        if (manhwaList) manhwaList.classList.remove('hidden');
        if (mainNav) mainNav.classList.remove('hidden');
        
        window.scrollTo(0, 0);
        this.loadContinueReading();
    }

    // ==================== UTILIDADES ====================
    searchManhwas(query) {
        const cards = document.querySelectorAll('.manhwa-card');
        const lowerQuery = query.toLowerCase();
        
        cards.forEach(card => {
            const title = card.querySelector('.manhwa-title')?.textContent.toLowerCase() || '';
            card.style.display = title.includes(lowerQuery) ? 'block' : 'none';
        });
    }

    toggleTheme() {
        this.isLightMode = !this.isLightMode;
        document.getElementById('reader')?.classList.toggle('light-mode', this.isLightMode);
        document.getElementById('themeToggle')?.classList.toggle('active', this.isLightMode);
    }

    toggleFit() {
        this.fitToScreen = !this.fitToScreen;
        document.getElementById('fitToggle')?.classList.toggle('active', this.fitToScreen);
        
        document.querySelectorAll('.page-image').forEach(img => {
            if (this.fitToScreen) {
                img.style.maxWidth = '100%';
            } else {
                img.style.maxWidth = 'none';
            }
        });
    }

    setupScrollProgress() {
        window.addEventListener('scroll', () => {
            const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
            const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const scrolled = (winScroll / height) * 100;
            
            const progressBar = document.getElementById('readingProgress');
            if (progressBar) {
                progressBar.style.width = scrolled + "%";
            }
        });
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        if (!toast) return;
        
        toast.textContent = message;
        toast.className = `toast ${type}`;
        
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    showProfile() {
        this.showToast('Perfil em desenvolvimento! 👤', 'success');
    }

    showFavorites() {
        // Filtrar apenas favoritos
        const cards = document.querySelectorAll('.manhwa-card');
        cards.forEach(card => {
            const title = card.querySelector('.manhwa-title')?.textContent || '';
            // Implementar filtro de favoritos
        });
        this.showToast('Mostrando favoritos! ❤️', 'success');
    }
}

// Inicializar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.app = new ManhwaReader();
    });
} else {
    window.app = new ManhwaReader();
}

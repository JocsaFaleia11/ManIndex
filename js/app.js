class ManhwaReader {
    constructor() {
        this.currentUser = null;
        this.currentManhwa = null;
        this.currentChapter = null;
        this.chapters = [];
        this.allManhwas = {};
        this.filteredManhwas = [];
        this.isLightMode = false;
        this.fitToScreen = true;
        this.readingHistory = {};
        this.favorites = new Set();
        this.modalChapters = [];
        
        // Sistema de Filtros
        this.activeFilters = {
            type: 'all',
            status: null,
            demographic: null,
            genres: new Set()
        };
        
        this.currentSort = 'newest';
        this.currentPage = 1;
        this.itemsPerPage = 24;
        this.totalPages = 1;
        this.sidebarOpen = window.innerWidth > 1024;
        
        // Aguardar DOM estar pronto
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    async init() {
        console.log('🚀 Iniciando ManhwaReader...');
        
        // Configurar listeners primeiro
        this.setupEventListeners();
        this.setupSidebarListeners();
        this.setupAuthListener();
        this.setupScrollProgress();
        
        // Inicializar UI
        this.initSidebarState();
        
        // Carregar dados
        await this.loadManhwasWithRetry();
    }

    initSidebarState() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            if (window.innerWidth > 1024) {
                sidebar.classList.remove('closed');
                sidebar.classList.add('open');
            } else {
                sidebar.classList.add('closed');
                sidebar.classList.remove('open');
            }
        }
    }

    // ==================== SIDEBAR ====================
    
    toggleSidebar() {
        this.sidebarOpen = !this.sidebarOpen;
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        
        if (sidebar) {
            if (this.sidebarOpen) {
                sidebar.classList.remove('closed');
                sidebar.classList.add('open');
            } else {
                sidebar.classList.add('closed');
                sidebar.classList.remove('open');
            }
        }
        if (overlay) {
            overlay.style.display = this.sidebarOpen && window.innerWidth <= 1024 ? 'block' : 'none';
        }
    }

    setupSidebarListeners() {
        console.log('🔧 Configurando listeners da sidebar...');

        // Menu toggle
        const menuToggle = document.getElementById('menuToggle');
        if (menuToggle) {
            menuToggle.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleSidebar();
            });
        }

        // Close sidebar button
        const closeSidebar = document.querySelector('.close-sidebar');
        if (closeSidebar) {
            closeSidebar.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleSidebar();
            });
        }

        // Overlay
        const overlay = document.getElementById('sidebarOverlay');
        if (overlay) {
            overlay.addEventListener('click', () => this.toggleSidebar());
        }

        // Resize handler
        window.addEventListener('resize', () => {
            const sidebar = document.getElementById('sidebar');
            if (window.innerWidth > 1024) {
                this.sidebarOpen = true;
                if (sidebar) {
                    sidebar.classList.remove('closed');
                    sidebar.classList.add('open');
                }
                if (overlay) overlay.style.display = 'none';
            }
        });
    }

    // ==================== EVENT LISTENERS - DELEGAÇÃO ====================

    setupEventListeners() {
        console.log('🔧 Configurando event listeners...');

        // DELEGAÇÃO DE EVENTOS NA SIDEBAR
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.addEventListener('click', (e) => {
                console.log('Click na sidebar:', e.target);
                
                // Tipo de Obra
                const typeItem = e.target.closest('.nav-item[data-type]');
                if (typeItem) {
                    e.preventDefault();
                    e.stopPropagation();
                    const type = typeItem.dataset.type;
                    console.log('🎯 Click tipo:', type);
                    this.setTypeFilter(type);
                    return;
                }

                // Status
                const statusItem = e.target.closest('.nav-item[data-status]');
                if (statusItem) {
                    e.preventDefault();
                    e.stopPropagation();
                    const status = statusItem.dataset.status;
                    console.log('🎯 Click status:', status);
                    this.toggleStatusFilter(status);
                    return;
                }

                // Demografia
                const demoItem = e.target.closest('.nav-item[data-demo]');
                if (demoItem) {
                    e.preventDefault();
                    e.stopPropagation();
                    const demo = demoItem.dataset.demo;
                    console.log('🎯 Click demo:', demo);
                    this.toggleDemographicFilter(demo);
                    return;
                }

                // Gênero
                const genreTag = e.target.closest('.genre-tag[data-genre]');
                if (genreTag) {
                    e.preventDefault();
                    e.stopPropagation();
                    const genre = genreTag.dataset.genre;
                    console.log('🎯 Click gênero:', genre);
                    this.toggleGenreFilter(genre);
                    return;
                }
            });
        }

        // Auth Modal
        const authModal = document.getElementById('authModal');
        if (authModal) {
            authModal.addEventListener('click', (e) => {
                if (e.target === authModal || e.target.classList.contains('modal-backdrop')) {
                    this.closeAuthModal();
                }
            });
        }

        // Auth Tabs
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

        // Login Form
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

        // Register Form
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

        // Google Login
        const googleBtn = document.getElementById('googleLogin');
        if (googleBtn) {
            googleBtn.addEventListener('click', async () => {
                const provider = new firebase.auth.GoogleAuthProvider();
                provider.setCustomParameters({ prompt: 'select_account' });
                
                try {
                    await auth.signInWithRedirect(provider);
                } catch (error) {
                    console.error('Erro Google login:', error);
                    this.showToast(this.getAuthErrorMessage(error), 'error');
                    
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

        // Search
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.searchManhwas(e.target.value);
                }, 300);
            });
        }

        // Sort
        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', () => this.sortObras());
        }

        // Clear History
        const clearHistoryBtn = document.getElementById('clearHistory');
        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', () => this.clearHistory());
        }

        // Reader controls
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

        console.log('✅ Event listeners configurados');
    }

    // ==================== SISTEMA DE FILTROS ====================

    setTypeFilter(type) {
        console.log('🎯 setTypeFilter:', type);
        this.activeFilters.type = type;
        this.currentPage = 1;
        this.applyFilters();
        this.updateSectionTitle();
        this.updateSidebarUI();
        
        // Fechar sidebar em mobile após seleção
        if (window.innerWidth <= 1024) {
            this.toggleSidebar();
        }
    }

    toggleStatusFilter(status) {
        console.log('🎯 toggleStatusFilter:', status);
        if (this.activeFilters.status === status) {
            this.activeFilters.status = null;
        } else {
            this.activeFilters.status = status;
        }
        this.currentPage = 1;
        this.applyFilters();
        this.updateSidebarUI();
    }

    toggleDemographicFilter(demo) {
        console.log('🎯 toggleDemographicFilter:', demo);
        if (this.activeFilters.demographic === demo) {
            this.activeFilters.demographic = null;
        } else {
            this.activeFilters.demographic = demo;
        }
        this.currentPage = 1;
        this.applyFilters();
        this.updateSidebarUI();
    }

    toggleGenreFilter(genre) {
        console.log('🎯 toggleGenreFilter:', genre);
        if (this.activeFilters.genres.has(genre)) {
            this.activeFilters.genres.delete(genre);
        } else {
            this.activeFilters.genres.add(genre);
        }
        this.currentPage = 1;
        this.applyFilters();
        this.updateSidebarUI();
    }

    clearFilter(type, value = null) {
        console.log('🧹 clearFilter:', type, value);
        
        switch(type) {
            case 'type':
                this.activeFilters.type = 'all';
                break;
            case 'status':
                this.activeFilters.status = null;
                break;
            case 'demographic':
                this.activeFilters.demographic = null;
                break;
            case 'genre':
                if (value) {
                    this.activeFilters.genres.delete(value);
                } else {
                    this.activeFilters.genres.clear();
                }
                break;
            case 'all':
                this.activeFilters = {
                    type: 'all',
                    status: null,
                    demographic: null,
                    genres: new Set()
                };
                break;
        }
        
        this.currentPage = 1;
        this.applyFilters();
        this.updateSidebarUI();
    }

    applyFilters() {
        console.log('🔍 Aplicando filtros:', JSON.stringify({
            type: this.activeFilters.type,
            status: this.activeFilters.status,
            demographic: this.activeFilters.demographic,
            genres: Array.from(this.activeFilters.genres)
        }));
        
        let result = Object.values(this.allManhwas);
        console.log('📚 Total de obras:', result.length);

        // Filtro por Tipo
        if (this.activeFilters.type !== 'all') {
            result = result.filter(m => {
                const obraType = (m.type || '').toLowerCase();
                const filterType = this.activeFilters.type.toLowerCase();
                const match = obraType === filterType;
                console.log(`  Tipo: ${obraType} === ${filterType} ? ${match}`);
                return match;
            });
        }

        // Filtro por Status
        if (this.activeFilters.status) {
            result = result.filter(m => {
                const obraStatus = (m.status || 'ongoing').toLowerCase();
                const filterStatus = this.activeFilters.status.toLowerCase();
                return obraStatus === filterStatus;
            });
        }

        // Filtro por Demografia
        if (this.activeFilters.demographic) {
            result = result.filter(m => {
                const obraDemo = (m.demographic || '').toLowerCase();
                const filterDemo = this.activeFilters.demographic.toLowerCase();
                return obraDemo === filterDemo;
            });
        }

        // Filtro por Gêneros (OR logic)
        if (this.activeFilters.genres.size > 0) {
            result = result.filter(m => {
                const obraGenres = (m.genres || m.genre || []).map(g => g.toLowerCase());
                const filterGenres = Array.from(this.activeFilters.genres).map(g => g.toLowerCase());
                const hasMatch = filterGenres.some(g => obraGenres.includes(g));
                console.log(`  Gêneros obra: ${obraGenres.join(', ')} - Match: ${hasMatch}`);
                return hasMatch;
            });
        }

        this.filteredManhwas = result;
        console.log(`✅ ${result.length} obras após filtros`);
        
        this.sortObras(false);
        this.updateActiveFiltersUI();
        this.updateCounts();
    }

    updateSidebarUI() {
        console.log('🎨 Atualizando UI da sidebar...');

        // Tipos
        document.querySelectorAll('.nav-item[data-type]').forEach(item => {
            const isActive = item.dataset.type === this.activeFilters.type;
            item.classList.toggle('active', isActive);
        });

        // Status
        document.querySelectorAll('.nav-item[data-status]').forEach(item => {
            const isActive = item.dataset.status === this.activeFilters.status;
            item.classList.toggle('active', isActive);
        });

        // Demografia
        document.querySelectorAll('.nav-item[data-demo]').forEach(item => {
            const isActive = item.dataset.demo === this.activeFilters.demographic;
            item.classList.toggle('active', isActive);
        });

        // Gêneros
        document.querySelectorAll('.genre-tag[data-genre]').forEach(tag => {
            const isActive = this.activeFilters.genres.has(tag.dataset.genre);
            tag.classList.toggle('active', isActive);
        });
    }

    sortObras(updateUI = true) {
        const sortSelect = document.getElementById('sortSelect');
        const sortValue = sortSelect ? sortSelect.value : this.currentSort;
        this.currentSort = sortValue;

        switch(sortValue) {
            case 'newest':
                this.filteredManhwas.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                break;
            case 'updated':
                this.filteredManhwas.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
                break;
            case 'popular':
                this.filteredManhwas.sort((a, b) => (b.views || 0) - (a.views || 0));
                break;
            case 'rating':
                this.filteredManhwas.sort((a, b) => (b.rating || 0) - (a.rating || 0));
                break;
            case 'alpha':
                this.filteredManhwas.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
                break;
            case 'chapters':
                this.filteredManhwas.sort((a, b) => {
                    const countA = a.chapters ? Object.keys(a.chapters).length : 0;
                    const countB = b.chapters ? Object.keys(b.chapters).length : 0;
                    return countB - countA;
                });
                break;
        }

        if (updateUI) {
            this.currentPage = 1;
            this.renderGrid();
        } else {
            this.renderGrid();
        }
    }

    updateSectionTitle() {
        const titleEl = document.getElementById('sectionTitle');
        if (!titleEl) return;

        const typeNames = {
            'all': '🔥 Todas as Obras',
            'manga': '🇯🇵 Mangás',
            'manhwa': '🇰🇷 Manhwas',
            'manhua': '🇨🇳 Manhuas',
            'webtoon': '📱 Webtoons',
            'novel': '📕 Light Novels'
        };

        titleEl.textContent = typeNames[this.activeFilters.type] || '🔥 Obras';
    }

    updateActiveFiltersUI() {
        const container = document.getElementById('activeFilters');
        if (!container) return;

        let html = '';

        if (this.activeFilters.type !== 'all') {
            html += this.createFilterPill('type', this.activeFilters.type, this.getTypeLabel(this.activeFilters.type));
        }

        if (this.activeFilters.status) {
            html += this.createFilterPill('status', this.activeFilters.status, this.getStatusLabel(this.activeFilters.status));
        }

        if (this.activeFilters.demographic) {
            html += this.createFilterPill('demographic', this.activeFilters.demographic, this.getDemoLabel(this.activeFilters.demographic));
        }

        this.activeFilters.genres.forEach(genre => {
            html += this.createFilterPill('genre', genre, this.getGenreLabel(genre));
        });

        if (html) {
            html += `<button class="clear-all-filters" onclick="app.clearFilter('all')">Limpar Todos ✕</button>`;
        }

        container.innerHTML = html;
    }

    createFilterPill(type, value, label) {
        return `
            <div class="filter-pill">
                <span>${label}</span>
                <button onclick="app.clearFilter('${type}', '${value}')" title="Remover filtro">✕</button>
            </div>
        `;
    }

    getTypeLabel(type) {
        const labels = {
            'manga': '🇯🇵 Mangá',
            'manhwa': '🇰🇷 Manhwa',
            'manhua': '🇨🇳 Manhua',
            'webtoon': '📱 Webtoon',
            'novel': '📕 Novel'
        };
        return labels[type] || type;
    }

    getStatusLabel(status) {
        const labels = {
            'ongoing': '🟢 Em Andamento',
            'completed': '✅ Completo',
            'hiatus': '⏸️ Hiato',
            'cancelled': '❌ Cancelado'
        };
        return labels[status] || status;
    }

    getDemoLabel(demo) {
        const labels = {
            'shounen': '👦 Shounen',
            'shoujo': '👧 Shoujo',
            'seinen': '👨 Seinen',
            'josei': '👩 Josei'
        };
        return labels[demo] || demo;
    }

    getGenreLabel(genre) {
        const labels = {
            'action': 'Ação',
            'adventure': 'Aventura',
            'comedy': 'Comédia',
            'drama': 'Drama',
            'fantasy': 'Fantasia',
            'harem': 'Harem',
            'isekai': 'Isekai',
            'martial': 'Artes Marciais',
            'mystery': 'Mistério',
            'psychological': 'Psicológico',
            'romance': 'Romance',
            'school': 'Vida Escolar',
            'sci-fi': 'Sci-Fi',
            'slice': 'Slice of Life',
            'sports': 'Esportes',
            'supernatural': 'Sobrenatural',
            'thriller': 'Thriller',
            'horror': 'Terror'
        };
        return labels[genre] || genre;
    }

    updateCounts() {
        const counts = {
            all: Object.keys(this.allManhwas).length,
            manga: 0,
            manhwa: 0,
            manhua: 0,
            webtoon: 0,
            novel: 0
        };

        Object.values(this.allManhwas).forEach(obra => {
            const type = (obra.type || '').toLowerCase();
            if (counts.hasOwnProperty(type)) {
                counts[type]++;
            }
        });

        Object.keys(counts).forEach(type => {
            const el = document.getElementById(`count-${type}`);
            if (el) el.textContent = counts[type];
        });
    }

    // ==================== PAGINAÇÃO E RENDER ====================

    changePage(direction) {
        const newPage = this.currentPage + direction;
        if (newPage >= 1 && newPage <= this.totalPages) {
            this.currentPage = newPage;
            this.renderGrid();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    goToPage(page) {
        if (page >= 1 && page <= this.totalPages) {
            this.currentPage = page;
            this.renderGrid();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    renderPagination() {
        const container = document.getElementById('pagination');
        const pageNumbers = document.getElementById('pageNumbers');
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');

        if (!container || this.totalPages <= 1) {
            if (container) container.style.display = 'none';
            return;
        }

        container.style.display = 'flex';
        
        if (prevBtn) prevBtn.disabled = this.currentPage === 1;
        if (nextBtn) nextBtn.disabled = this.currentPage === this.totalPages;

        if (pageNumbers) {
            let html = '';
            const maxVisible = 5;
            let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
            let end = Math.min(this.totalPages, start + maxVisible - 1);
            
            if (end - start < maxVisible - 1) {
                start = Math.max(1, end - maxVisible + 1);
            }

            if (start > 1) {
                html += `<button class="page-number" onclick="app.goToPage(1)">1</button>`;
                if (start > 2) html += `<span class="page-ellipsis">...</span>`;
            }

            for (let i = start; i <= end; i++) {
                html += `<button class="page-number ${i === this.currentPage ? 'active' : ''}" onclick="app.goToPage(${i})">${i}</button>`;
            }

            if (end < this.totalPages) {
                if (end < this.totalPages - 1) html += `<span class="page-ellipsis">...</span>`;
                html += `<button class="page-number" onclick="app.goToPage(${this.totalPages})">${this.totalPages}</button>`;
            }

            pageNumbers.innerHTML = html;
        }
    }

    renderGrid() {
        const grid = document.getElementById('manhwaGrid');
        if (!grid) return;

        const totalItems = this.filteredManhwas.length;
        this.totalPages = Math.ceil(totalItems / this.itemsPerPage) || 1;
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        const pageItems = this.filteredManhwas.slice(start, end);

        const resultsCount = document.getElementById('resultsCount');
        if (resultsCount) {
            resultsCount.textContent = `${totalItems} obra${totalItems !== 1 ? 's' : ''}`;
        }

        grid.innerHTML = '';

        if (pageItems.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">🔍</div>
                    <h3 style="margin-bottom: 1rem;">Nenhuma obra encontrada</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
                        Tente ajustar os filtros ou buscar por outro termo
                    </p>
                    <button onclick="app.clearFilter('all')" class="btn-primary" style="width: auto; padding: 0.75rem 2rem;">
                        Limpar Filtros
                    </button>
                </div>
            `;
            this.renderPagination();
            return;
        }

        pageItems.forEach(manhwa => this.renderManhwaCard(manhwa, grid));
        this.renderPagination();
    }

    renderManhwaCard(manhwa, container) {
        const chapterCount = manhwa.chapters ? Object.keys(manhwa.chapters).length : 0;
        const latestChapter = chapterCount > 0 ? 
            Object.values(manhwa.chapters).sort((a, b) => b.number - a.number)[0] : null;

        let statusClass = manhwa.status || 'ongoing';
        const statusLabels = {
            'ongoing': 'Em andamento',
            'completed': 'Completo',
            'hiatus': 'Hiato',
            'cancelled': 'Cancelado'
        };

        const typeLabels = {
            'manga': 'Mangá',
            'manhwa': 'Manhwa',
            'manhua': 'Manhua',
            'webtoon': 'Webtoon',
            'novel': 'Novel'
        };

        const card = document.createElement('div');
        card.className = 'manhwa-card';
        card.dataset.id = manhwa.id;
        
        card.innerHTML = `
            <div class="manhwa-cover-wrapper">
                <img src="${manhwa.coverUrl || 'https://via.placeholder.com/220x320/1a1a2e/6366f1?text=Sem+Capa'}" 
                     alt="${manhwa.title}" 
                     class="manhwa-cover"
                     loading="lazy"
                     onerror="this.src='https://via.placeholder.com/220x320/1a1a2e/6366f1?text=Sem+Capa'">
                <div class="card-badges">
                    <span class="card-badge type">${typeLabels[manhwa.type] || 'Obra'}</span>
                    <span class="card-badge status ${statusClass}">${statusLabels[statusClass]}</span>
                </div>
            </div>
            <div class="manhwa-info">
                <h3 class="manhwa-title">${manhwa.title || 'Sem título'}</h3>
                <div class="manhwa-meta">
                    <span>${manhwa.demographic ? this.getDemoLabel(manhwa.demographic) : (manhwa.genre?.slice(0, 2).join(', ') || 'Sem gênero')}</span>
                    ${manhwa.rating ? `<span class="manhwa-rating">⭐ ${manhwa.rating}</span>` : ''}
                </div>
                ${latestChapter ? `
                    <div class="manhwa-chapters">
                        📖 Cap. ${latestChapter.number}
                    </div>
                ` : '<div class="manhwa-chapters">📖 Sem capítulos</div>'}
            </div>
        `;
        
        card.addEventListener('click', () => this.openManhwaModal(manhwa));
        container.appendChild(card);
    }

    // ==================== CARREGAMENTO DE DADOS ====================

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

    loadManhwas() {
        return new Promise((resolve, reject) => {
            console.log('📚 Carregando obras...');
            const grid = document.getElementById('manhwaGrid');
            
            if (!grid) {
                reject(new Error('Elemento manhwaGrid não encontrado'));
                return;
            }

            const timeout = setTimeout(() => {
                reject(new Error('Timeout ao carregar obras (10s)'));
            }, 10000);

            try {
                const manhwasRef = database.ref('manhwas');
                
                manhwasRef.once('value', (snapshot) => {
                    clearTimeout(timeout);
                    console.log('✅ Dados recebidos do Firebase');
                    
                    this.allManhwas = {};
                    
                    if (!snapshot.exists()) {
                        grid.innerHTML = `
                            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
                                <div style="font-size: 3rem; margin-bottom: 1rem;">📚</div>
                                <h3 style="margin-bottom: 1rem;">Nenhuma obra cadastrada</h3>
                                <p style="color: var(--text-secondary);">Adicione obras no Firebase para começar</p>
                            </div>
                        `;
                        resolve();
                        return;
                    }

                    snapshot.forEach((child) => {
                        const manhwa = { id: child.key, ...child.val() };
                        this.allManhwas[child.key] = manhwa;
                    });

                    this.applyFilters();
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

    // ==================== MÉTODOS AUXILIARES (mantidos) ====================

    setupAuthListener() {
        auth.onAuthStateChanged(async (user) => {
            this.currentUser = user;
            
            if (user) {
                console.log('✅ Usuário logado:', user.email);
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

    async saveReadingProgress(manhwaId, chapterId, pageNumber = 1) {
        if (!manhwaId || !chapterId) return;

        const progress = {
            manhwaId: manhwaId,
            chapterId: chapterId,
            pageNumber: pageNumber || 1,
            lastRead: Date.now()
        };

        this.readingHistory[manhwaId] = progress;
        this.saveUserDataToLocal();

        if (this.currentUser) {
            try {
                const path = `users/${this.currentUser.uid}/history/${manhwaId}`;
                await database.ref(path).set(progress);
            } catch (error) {
                console.log('ℹ️ Salvando apenas localmente');
            }
        }
    }

    async loadContinueReading() {
        const container = document.getElementById('continueGrid');
        const section = document.getElementById('continueReading');
        
        if (!container || !section) return;
        
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

            card.addEventListener('click', () => this.openManhwaModal(manhwa));
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
            } catch (error) {}
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
            } catch (error) {}
        }

        this.loadContinueReading();
        this.showToast('Histórico limpo!', 'success');
    }

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

        if (this.currentUser) {
            try {
                await database.ref(`users/${this.currentUser.uid}/favorites`).set(Array.from(this.favorites));
            } catch (error) {}
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

    openManhwaModal(manhwa) {
        this.currentManhwa = manhwa;
        this.chapters = [];
        this.modalChapters = [];
        
        if (manhwa.chapters) {
            this.chapters = Object.entries(manhwa.chapters)
                .map(([id, data]) => ({ id, ...data }))
                .sort((a, b) => a.number - b.number);
            
            this.modalChapters = [...this.chapters].sort((a, b) => b.number - a.number);
        }

        const typeLabels = {
            'manga': 'Mangá', 'manhwa': 'Manhwa', 'manhua': 'Manhua',
            'webtoon': 'Webtoon', 'novel': 'Novel'
        };
        const statusLabels = {
            'ongoing': 'Em andamento', 'completed': 'Completo',
            'hiatus': 'Hiato', 'cancelled': 'Cancelado'
        };

        const elements = {
            title: document.getElementById('modalTitle'),
            cover: document.getElementById('modalCover'),
            backdrop: document.getElementById('modalBackdrop'),
            synopsis: document.getElementById('modalSynopsis'),
            type: document.getElementById('modalType'),
            status: document.getElementById('modalStatus'),
            demo: document.getElementById('modalDemo'),
            author: document.getElementById('modalAuthor'),
            year: document.getElementById('modalYear'),
            chapters: document.getElementById('modalChapters'),
            rating: document.getElementById('modalRating'),
            views: document.getElementById('modalViews'),
            updated: document.getElementById('modalUpdated')
        };

        if (elements.title) elements.title.textContent = manhwa.title || 'Sem título';
        if (elements.cover) elements.cover.src = manhwa.coverUrl || '';
        if (elements.backdrop) elements.backdrop.src = manhwa.coverUrl || '';
        if (elements.synopsis) elements.synopsis.textContent = manhwa.description || 'Sem sinopse disponível.';
        if (elements.type) elements.type.textContent = typeLabels[manhwa.type] || 'Obra';
        if (elements.status) {
            elements.status.textContent = statusLabels[manhwa.status] || 'Em andamento';
            elements.status.className = `badge-status ${manhwa.status || 'ongoing'}`;
        }
        if (elements.demo) {
            elements.demo.textContent = manhwa.demographic ? manhwa.demographic.toUpperCase() : 'N/A';
            elements.demo.style.display = manhwa.demographic ? 'inline-block' : 'none';
        }
        if (elements.author) elements.author.textContent = manhwa.author || 'Autor desconhecido';
        if (elements.year) elements.year.textContent = manhwa.year || '2024';
        if (elements.chapters) elements.chapters.textContent = `${this.modalChapters.length} capítulos`;
        if (elements.rating) elements.rating.textContent = `⭐ ${manhwa.rating || 'N/A'}`;
        if (elements.views) elements.views.textContent = `👁️ ${this.formatNumber(manhwa.views || 0)}`;
        if (elements.updated) elements.updated.textContent = `📅 ${this.formatDate(manhwa.updatedAt)}`;

        const tagsContainer = document.getElementById('modalTags');
        if (tagsContainer) {
            const genres = manhwa.genres || manhwa.genre || [];
            tagsContainer.innerHTML = genres.map(g => `<span class="modal-tag">${this.getGenreLabel(g)}</span>`).join('');
        }

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
        if (modal) modal.classList.add('hidden');
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
            item.onclick = () => this.readChapterFromModal(chapter.id);
            
            item.innerHTML = `
                <div class="chapter-number">${Math.floor(chapter.number)}</div>
                <div class="chapter-info">
                    <div class="chapter-title">${chapter.title}</div>
                    <div class="chapter-meta">${chapter.pageCount || '?'} páginas • ${this.formatDate(chapter.uploadedAt)}</div>
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
        if (!this.currentManhwa) {
            this.showToast('Erro: Obra não encontrada', 'error');
            return;
        }
        
        if (!this.currentManhwa.chapters?.[chapterId]) {
            this.showToast('Erro: Capítulo não encontrado', 'error');
            return;
        }
        
        this.closeManhwaModal();
        setTimeout(() => this.loadChapter(chapterId), 350);
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
            } catch (err) {}
        }
    }

    loadChapter(chapterId) {
        if (!this.currentManhwa) {
            this.showToast('Erro: Obra não encontrada', 'error');
            return;
        }
        
        this.currentChapter = chapterId;
        const chapter = this.currentManhwa.chapters[chapterId];
        
        if (!chapter) {
            this.showToast('Capítulo não encontrado!', 'error');
            return;
        }

        this.saveReadingProgress(this.currentManhwa.id, chapterId, 1);

        document.getElementById('manhwaList')?.parentElement?.classList.add('hidden');
        document.getElementById('continueReading')?.classList.add('hidden');
        document.getElementById('reader')?.classList.remove('hidden');
        document.getElementById('mainNav')?.classList.add('hidden');
        
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
            if (chapter.pages?.length > 0) {
                chapter.pages.forEach((page, index) => this.renderPage(page, index, container));
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
        img.style.maxWidth = this.fitToScreen ? '100%' : 'none';

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    img.src = img.dataset.src;
                    img.onload = () => img.classList.add('loaded');
                    
                    const totalPages = this.currentManhwa?.chapters?.[this.currentChapter]?.pages?.length || 1;
                    this.updatePageIndicator(index + 1, totalPages);
                    
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
        if (indicator) indicator.textContent = `${current} / ${total}`;
    }

    navigateChapter(direction) {
        const currentIndex = this.chapters.findIndex(ch => ch.id === this.currentChapter);
        const newIndex = currentIndex + direction;
        
        if (newIndex >= 0 && newIndex < this.chapters.length) {
            this.loadChapter(this.chapters[newIndex].id);
        } else if (newIndex < 0) {
            this.showToast('Este é o primeiro capítulo!', 'error');
        } else {
            this.showToast('Você completou a obra! 🎉', 'success');
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
        document.getElementById('reader')?.classList.add('hidden');
        document.getElementById('manhwaList')?.parentElement?.classList.remove('hidden');
        document.getElementById('mainNav')?.classList.remove('hidden');
        
        window.scrollTo(0, 0);
        this.loadContinueReading();
    }

    searchManhwas(query) {
        if (!query) {
            this.applyFilters();
            return;
        }

        const lowerQuery = query.toLowerCase();
        this.filteredManhwas = Object.values(this.allManhwas).filter(m => {
            const titleMatch = (m.title || '').toLowerCase().includes(lowerQuery);
            const authorMatch = (m.author || '').toLowerCase().includes(lowerQuery);
            const genreMatch = (m.genres || m.genre || []).some(g => g.toLowerCase().includes(lowerQuery));
            return titleMatch || authorMatch || genreMatch;
        });

        this.currentPage = 1;
        this.sortObras(false);
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
            img.style.maxWidth = this.fitToScreen ? '100%' : 'none';
        });
    }

    setupScrollProgress() {
        window.addEventListener('scroll', () => {
            const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
            const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const scrolled = (winScroll / height) * 100;
            
            const progressBar = document.getElementById('readingProgress');
            if (progressBar) progressBar.style.width = scrolled + "%";
        });
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        if (!toast) return;
        
        toast.textContent = message;
        toast.className = `toast ${type}`;
        
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    showProfile() {
        this.showToast('Perfil em desenvolvimento! 👤', 'success');
    }

    showFavorites() {
        const favoriteIds = Array.from(this.favorites);
        this.filteredManhwas = favoriteIds.map(id => this.allManhwas[id]).filter(Boolean);
        this.currentPage = 1;
        this.renderGrid();
        
        const titleEl = document.getElementById('sectionTitle');
        if (titleEl) titleEl.textContent = '♡ Meus Favoritos';
        
        this.showToast(`Mostrando ${this.filteredManhwas.length} favoritos! ❤️`, 'success');
    }

    formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }

    formatDate(timestamp) {
        if (!timestamp) return 'N/A';
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days === 0) return 'Hoje';
        if (days === 1) return 'Ontem';
        if (days < 7) return `${days} dias atrás`;
        if (days < 30) return `${Math.floor(days / 7)} semanas atrás`;
        
        return date.toLocaleDateString('pt-BR');
    }
}

// Inicializar app
window.app = new ManhwaReader();
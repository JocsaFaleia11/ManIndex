/**
 * ManIndex - App do Usuário com Login e Progresso
 */

const userApp = {
    // Estado
    state: {
        obras: [],
        capitulos: [],
        autores: [],
        generos: [],
        filtros: {
            tipo: 'todos',
            generos: [],
            autores: [],
            status: ['Em andamento', 'Completo', 'Hiato'],
            busca: ''
        },
        paginacao: {
            pagina: 1,
            porPagina: 20,
            total: 0
        },
        obraAtual: null,
        capituloAtual: null,
        paginaAtual: 0,
        progressoUsuario: {},
        favoritos: [],
        historico: []
    },

    // Inicialização
    async init() {
        this.bindEvents();
        
        // Verificar auth
        const isLogged = await UserAuth.init();
        this.updateUIAuth(isLogged);
        
        if (isLogged) {
            await this.carregarDadosUsuario();
        }
        
        await this.carregarDadosIniciais();
        this.aplicarFiltros();
    },

    // Event Listeners - DEFINIDA AQUI
    bindEvents() {
        console.log('Binding events...');

        // Navegação por tipo
        document.querySelectorAll('.type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.state.filtros.tipo = btn.dataset.type;
                this.state.paginacao.pagina = 1;
                this.aplicarFiltros();
                this.atualizarBreadcrumbs();
            });
        });

        // Busca
        const searchInput = document.getElementById('searchInput');
        let searchTimeout;
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.state.filtros.busca = e.target.value.toLowerCase();
                    this.state.paginacao.pagina = 1;
                    this.aplicarFiltros();
                }, 300);
            });
        }

        // Ordenação
        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                this.aplicarFiltros();
            });
        }

        // Paginação
        const prevPage = document.getElementById('prevPage');
        const nextPage = document.getElementById('nextPage');
        
        if (prevPage) {
            prevPage.addEventListener('click', () => {
                if (this.state.paginacao.pagina > 1) {
                    this.state.paginacao.pagina--;
                    this.aplicarFiltros();
                    this.scrollToTop();
                }
            });
        }

        if (nextPage) {
            nextPage.addEventListener('click', () => {
                const maxPaginas = Math.ceil(this.state.paginacao.total / this.state.paginacao.porPagina);
                if (this.state.paginacao.pagina < maxPaginas) {
                    this.state.paginacao.pagina++;
                    this.aplicarFiltros();
                    this.scrollToTop();
                }
            });
        }

        // Mobile menu
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        
        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', () => {
                document.getElementById('filtersSidebar').classList.add('open');
                if (sidebarOverlay) sidebarOverlay.classList.add('active');
            });
        }

        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', () => {
                document.getElementById('filtersSidebar').classList.remove('open');
                sidebarOverlay.classList.remove('active');
            });
        }

        // Limpar filtros
        const clearFilters = document.getElementById('clearFilters');
        if (clearFilters) {
            clearFilters.addEventListener('click', () => {
                this.limparFiltros();
            });
        }

        // Fechar dropdown ao clicar fora
        document.addEventListener('click', (e) => {
            const userMenu = document.querySelector('.user-menu');
            const dropdown = document.getElementById('userDropdown');
            
            if (userMenu && dropdown && !userMenu.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });

        console.log('Events bound successfully');
    },

    // Carregar dados do usuário (progresso, favoritos, histórico)
    async carregarDadosUsuario() {
        if (!UserAuth.currentUser) return;

        try {
            console.log('Carregando dados do usuário...');

            // Carregar progresso de leitura
            const progressoSnapshot = await db.collection('userProgress')
                .doc(UserAuth.currentUser.uid)
                .collection('obras')
                .get();
            
            progressoSnapshot.forEach(doc => {
                this.state.progressoUsuario[doc.id] = doc.data();
            });

            // Carregar favoritos
            const favoritosSnapshot = await db.collection('userFavorites')
                .doc(UserAuth.currentUser.uid)
                .collection('obras')
                .get();
            
            this.state.favoritos = favoritosSnapshot.docs.map(doc => doc.id);

            // Carregar histórico
            const historicoSnapshot = await db.collection('userHistory')
                .doc(UserAuth.currentUser.uid)
                .collection('leituras')
                .orderBy('timestamp', 'desc')
                .limit(50)
                .get();
            
            this.state.historico = historicoSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate()
            }));

            console.log('✅ Dados do usuário carregados');
        } catch (error) {
            console.error('Erro ao carregar dados do usuário:', error);
        }
    },

    // Carregar dados iniciais (obras, autores, gêneros)
    async carregarDadosIniciais() {
        this.showLoading(true);

        try {
            console.log('Carregando obras...');

            // Carregar todas as obras
            const snapshot = await db.collection('obras')
                .orderBy('createdAt', 'desc')
                .get();

            this.state.obras = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate()
            }));

            console.log(`✅ ${this.state.obras.length} obras carregadas`);

            // Extrair autores únicos
            const autoresMap = new Map();
            this.state.obras.forEach(obra => {
                if (obra.autorId && !autoresMap.has(obra.autorId)) {
                    autoresMap.set(obra.autorId, {
                        id: obra.autorId,
                        nome: obra.autorNome || 'Autor Desconhecido'
                    });
                }
            });
            this.state.autores = Array.from(autoresMap.values());

            // Extrair gêneros únicos
            const generosSet = new Set();
            this.state.obras.forEach(obra => {
                if (obra.generos) {
                    obra.generos.split(',').forEach(g => {
                        const genero = g.trim();
                        if (genero) generosSet.add(genero);
                    });
                }
            });
            this.state.generos = Array.from(generosSet).sort();

            // Renderizar filtros
            this.renderFiltros();

        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            this.showToast('Erro ao carregar obras', 'error');
        }

        this.showLoading(false);
    },

    // Renderizar lista de filtros
    renderFiltros() {
        // Gêneros
        const generosContainer = document.getElementById('generosList');
        if (generosContainer) {
            generosContainer.innerHTML = this.state.generos.map(genero => `
                <label class="filter-checkbox">
                    <input type="checkbox" value="${genero}" onchange="userApp.toggleGenero('${genero}')">
                    <span>${genero}</span>
                </label>
            `).join('');
        }

        // Autores
        const autoresContainer = document.getElementById('autoresList');
        if (autoresContainer) {
            autoresContainer.innerHTML = this.state.autores.map(autor => `
                <label class="filter-checkbox">
                    <input type="checkbox" value="${autor.id}" onchange="userApp.toggleAutor('${autor.id}')">
                    <span>${autor.nome}</span>
                </label>
            `).join('');
        }
    },

    // Toggle filtros
    toggleGenero(genero) {
        const index = this.state.filtros.generos.indexOf(genero);
        if (index > -1) {
            this.state.filtros.generos.splice(index, 1);
        } else {
            this.state.filtros.generos.push(genero);
        }
        this.state.paginacao.pagina = 1;
        this.aplicarFiltros();
    },

    toggleAutor(autorId) {
        const index = this.state.filtros.autores.indexOf(autorId);
        if (index > -1) {
            this.state.filtros.autores.splice(index, 1);
        } else {
            this.state.filtros.autores.push(autorId);
        }
        this.state.paginacao.pagina = 1;
        this.aplicarFiltros();
    },

    // Aplicar filtros e renderizar
    aplicarFiltros() {
        console.log('Aplicando filtros...');

        let obrasFiltradas = this.state.obras.filter(obra => {
            // Filtro por tipo
            if (this.state.filtros.tipo !== 'todos' && obra.tipo !== this.state.filtros.tipo) {
                return false;
            }

            // Filtro por gênero
            if (this.state.filtros.generos.length > 0) {
                const obraGeneros = obra.generos ? obra.generos.split(',').map(g => g.trim()) : [];
                const hasGenero = this.state.filtros.generos.some(g => obraGeneros.includes(g));
                if (!hasGenero) return false;
            }

            // Filtro por autor
            if (this.state.filtros.autores.length > 0) {
                if (!this.state.filtros.autores.includes(obra.autorId)) return false;
            }

            // Filtro por status
            if (!this.state.filtros.status.includes(obra.status)) {
                return false;
            }

            // Filtro por busca
            if (this.state.filtros.busca) {
                const searchTerm = this.state.filtros.busca.toLowerCase();
                const matchTitulo = obra.titulo?.toLowerCase().includes(searchTerm);
                const matchAutor = obra.autorNome?.toLowerCase().includes(searchTerm);
                const matchGenero = obra.generos?.toLowerCase().includes(searchTerm);
                if (!matchTitulo && !matchAutor && !matchGenero) return false;
            }

            return true;
        });

        // Ordenação
        const sortType = document.getElementById('sortSelect')?.value || 'recentes';
        switch (sortType) {
            case 'az':
                obrasFiltradas.sort((a, b) => a.titulo.localeCompare(b.titulo));
                break;
            case 'za':
                obrasFiltradas.sort((a, b) => b.titulo.localeCompare(a.titulo));
                break;
            case 'capitulos':
                obrasFiltradas.sort((a, b) => (b.capitulos || 0) - (a.capitulos || 0));
                break;
            default: // recentes
                obrasFiltradas.sort((a, b) => b.createdAt - a.createdAt);
        }

        // Paginação
        this.state.paginacao.total = obrasFiltradas.length;
        const inicio = (this.state.paginacao.pagina - 1) * this.state.paginacao.porPagina;
        const fim = inicio + this.state.paginacao.porPagina;
        const obrasPagina = obrasFiltradas.slice(inicio, fim);

        // Renderizar
        this.renderObras(obrasPagina);
        this.updatePagination();
        this.updateResultsCount(obrasFiltradas.length);
    },

    // Renderizar grid de obras
    renderObras(obras) {
        const container = document.getElementById('obrasGrid');
        const placeholderUrl = 'https://placehold.co/300x450/1e1e1e/d32f2f?text=Sem+Capa';

        if (!obras.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>Nenhuma obra encontrada</h3>
                    <p>Tente ajustar seus filtros</p>
                </div>
            `;
            return;
        }

        container.innerHTML = obras.map(obra => {
            // Verificar progresso do usuário
            const progresso = this.getProgressoObra(obra.id);
            const temProgresso = progresso && progresso.percentual > 0;
            
            return `
            <div class="obra-card" onclick="userApp.openObraModal('${obra.id}')">
                <div style="position: relative;">
                    <img src="${obra.capa || placeholderUrl}" 
                         alt="${obra.titulo}" 
                         class="obra-capa"
                         onerror="this.src='${placeholderUrl}'"
                         loading="lazy">
                    ${temProgresso ? `
                    <div style="position: absolute; bottom: 0; left: 0; right: 0; height: 4px; background: var(--bg-hover);">
                        <div style="width: ${progresso.percentual}%; height: 100%; background: var(--primary);"></div>
                    </div>
                    ` : ''}
                </div>
                <div class="obra-info">
                    <h3 class="obra-titulo" title="${obra.titulo}">${obra.titulo}</h3>
                    <div class="obra-meta">
                        <span class="obra-tipo">${obra.tipo}</span>
                        <span class="obra-status">${obra.status}</span>
                    </div>
                    <div class="obra-autor" title="${obra.autorNome || 'Autor desconhecido'}">
                        <i class="fas fa-user"></i> ${obra.autorNome || 'Autor desconhecido'}
                    </div>
                    <div class="obra-capitulos">
                        <i class="fas fa-file-alt"></i> ${obra.capitulos || 0} capítulos
                        ${temProgresso ? `<span style="color: var(--primary); margin-left: 0.5rem;">${progresso.percentual}%</span>` : ''}
                    </div>
                </div>
            </div>
        `}).join('');
    },

    // Atualizar paginação
    updatePagination() {
        const maxPaginas = Math.ceil(this.state.paginacao.total / this.state.paginacao.porPagina);
        
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        const pageInfo = document.getElementById('pageInfo');
        
        if (prevBtn) prevBtn.disabled = this.state.paginacao.pagina <= 1;
        if (nextBtn) nextBtn.disabled = this.state.paginacao.pagina >= maxPaginas;
        if (pageInfo) pageInfo.textContent = `Página ${this.state.paginacao.pagina} de ${maxPaginas || 1}`;
    },

    // Atualizar contador
    updateResultsCount(total) {
        const el = document.getElementById('resultsCount');
        if (el) {
            el.textContent = `${total} obra${total !== 1 ? 's' : ''} encontrada${total !== 1 ? 's' : ''}`;
        }
    },

    // Atualizar breadcrumbs
    atualizarBreadcrumbs() {
        const tipo = this.state.filtros.tipo;
        const breadcrumbs = document.getElementById('breadcrumbs');
        
        if (!breadcrumbs) return;
        
        if (tipo === 'todos') {
            breadcrumbs.innerHTML = '<span class="active">Todas as Obras</span>';
        } else {
            breadcrumbs.innerHTML = `
                <span onclick="userApp.resetTipo()" style="cursor: pointer; color: var(--text-secondary);">Todas as Obras</span>
                <i class="fas fa-chevron-right" style="font-size: 0.75rem; color: var(--text-muted);"></i>
                <span class="active">${tipo}s</span>
            `;
        }
    },

    resetTipo() {
        document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
        const todosBtn = document.querySelector('.type-btn[data-type="todos"]');
        if (todosBtn) todosBtn.classList.add('active');
        
        this.state.filtros.tipo = 'todos';
        this.state.paginacao.pagina = 1;
        this.aplicarFiltros();
        this.atualizarBreadcrumbs();
    },

    // Limpar todos os filtros
    limparFiltros() {
        this.state.filtros = {
            tipo: 'todos',
            generos: [],
            autores: [],
            status: ['Em andamento', 'Completo', 'Hiato'],
            busca: ''
        };
        this.state.paginacao.pagina = 1;

        // Reset UI
        document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
        const todosBtn = document.querySelector('.type-btn[data-type="todos"]');
        if (todosBtn) todosBtn.classList.add('active');
        
        document.querySelectorAll('.filter-checkbox input').forEach(cb => cb.checked = false);
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = '';
        
        this.aplicarFiltros();
        this.atualizarBreadcrumbs();
    },

    // ========== MODAL DA OBRA ==========

    async openObraModal(obraId) {
        const obra = this.state.obras.find(o => o.id === obraId);
        if (!obra) return;

        this.state.obraAtual = obra;
        
        // Título
        const tituloEl = document.getElementById('modalObraTitulo');
        if (tituloEl) tituloEl.textContent = obra.titulo;
        
        // Capa
        const capaEl = document.getElementById('modalObraCapa');
        if (capaEl) capaEl.src = obra.capa || 'https://placehold.co/300x450/1e1e1e/d32f2f?text=Sem+Capa';
        
        // Meta (tipo, status, gêneros)
        const metaEl = document.getElementById('modalObraMeta');
        if (metaEl) {
            metaEl.innerHTML = `
                <span class="obra-tipo">${obra.tipo}</span>
                <span class="obra-status">${obra.status}</span>
                ${obra.generos ? obra.generos.split(',').map(g => `<span class="obra-status" style="background: var(--bg-hover);">${g.trim()}</span>`).join('') : ''}
            `;
        }
        
        // Autor
        const autorEl = document.getElementById('modalObraAutor');
        if (autorEl) {
            autorEl.innerHTML = `
                <i class="fas fa-user-circle"></i> Por <strong>${obra.autorNome || 'Autor desconhecido'}</strong>
                <br><small>${obra.capitulos || 0} capítulos publicados</small>
            `;
        }
        
        // Progresso do usuário
        const progressoEl = document.getElementById('userProgress');
        const progresso = this.getProgressoObra(obra.id);
        
        if (progressoEl) {
            if (progresso && UserAuth.currentUser) {
                progressoEl.classList.remove('hidden');
                const fillEl = document.getElementById('progressFill');
                const textEl = document.getElementById('progressText');
                if (fillEl) fillEl.style.width = `${progresso.percentual}%`;
                if (textEl) textEl.textContent = `${progresso.percentual}% lido - Cap. ${progresso.capituloNumero || '?'}`;
            } else {
                progressoEl.classList.add('hidden');
            }
        }

        // Botão continuar/ler
        const btnContinuar = document.getElementById('btnContinuar');
        const btnContinuarText = document.getElementById('btnContinuarText');
        if (btnContinuar && btnContinuarText) {
            if (progresso) {
                btnContinuarText.textContent = 'Continuar Lendo';
            } else {
                btnContinuarText.textContent = 'Ler Agora';
            }
        }
        
        // Botão favoritar
        const btnFavoritar = document.getElementById('btnFavoritar');
        const btnFavoritarText = document.getElementById('btnFavoritarText');
        if (btnFavoritar && btnFavoritarText) {
            const isFavorito = this.state.favoritos.includes(obraId);
            if (isFavorito) {
                btnFavoritar.innerHTML = '<i class="fas fa-heart"></i> <span id="btnFavoritarText">Favoritado</span>';
            } else {
                btnFavoritar.innerHTML = '<i class="far fa-heart"></i> <span id="btnFavoritarText">Favoritar</span>';
            }
        }
        
        // Sinopse
        const sinopseEl = document.getElementById('modalObraSinopse');
        if (sinopseEl) sinopseEl.textContent = obra.sinopse || 'Sem sinopse disponível.';
        
        // Carregar capítulos
        await this.carregarCapitulos(obraId);
        
        // Mostrar modal
        const modal = document.getElementById('obraModal');
        if (modal) {
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
    },

    async carregarCapitulos(obraId) {
        try {
            const snapshot = await db.collection('capitulos')
                .where('obraId', '==', obraId)
                .orderBy('numero', 'desc')
                .get();

            this.state.capitulos = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            const container = document.getElementById('modalCapitulosList');
            if (!container) return;
            
            if (!this.state.capitulos.length) {
                container.innerHTML = '<p style="color: var(--text-muted); padding: 1rem;">Nenhum capítulo disponível.</p>';
                return;
            }

            // Verificar qual capítulo está sendo lido
            const progresso = this.getProgressoObra(obraId);
            const capituloAtualId = progresso?.capituloId;

            container.innerHTML = this.state.capitulos.map(cap => {
                const isLido = progresso && cap.numero < progresso.capituloNumero;
                const isAtual = cap.id === capituloAtualId;
                
                return `
                <div class="capitulo-item ${isLido ? 'lido' : ''} ${isAtual ? 'atual' : ''}" 
                     onclick="event.stopPropagation(); userApp.abrirCapitulo('${cap.id}')">
                    <div class="capitulo-numero">Cap. ${cap.numero}</div>
                    ${cap.titulo ? `<div style="font-size: 0.8rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis;">${cap.titulo}</div>` : ''}
                    <div class="capitulo-data">${cap.paginas?.length || 0} pág.</div>
                </div>
            `}).join('');

        } catch (error) {
            console.error('Erro ao carregar capítulos:', error);
        }
    },

    closeObraModal() {
        const modal = document.getElementById('obraModal');
        if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }
        this.state.obraAtual = null;
        this.state.capitulos = [];
    },

    // ========== LEITOR ==========

    async abrirCapitulo(capituloId, paginaInicial = 0) {
        const capitulo = this.state.capitulos.find(c => c.id === capituloId);
        if (!capitulo || !capitulo.paginas?.length) {
            this.showToast('Capítulo não disponível', 'error');
            return;
        }

        // Verificar se há progresso salvo
        const progresso = this.getProgressoObra(this.state.obraAtual.id);
        if (progresso && progresso.capituloId === capituloId && paginaInicial === 0) {
            paginaInicial = Math.max(0, progresso.pagina);
        }

        this.state.capituloAtual = capitulo;
        this.state.paginaAtual = paginaInicial;

        // Atualizar títulos
        const tituloObra = document.getElementById('leitorObraTitulo');
        const tituloCap = document.getElementById('leitorCapituloTitulo');
        
        if (tituloObra) tituloObra.textContent = this.state.obraAtual.titulo;
        if (tituloCap) {
            tituloCap.textContent = `Capítulo ${capitulo.numero} ${capitulo.titulo ? `- ${capitulo.titulo}` : ''}`;
        }
        
        this.renderPaginaLeitor();
        
        // Configurar botão de próximo capítulo
        const capAtualIndex = this.state.capitulos.findIndex(c => c.id === capituloId);
        const proxCap = this.state.capitulos[capAtualIndex - 1];
        const proxCapBar = document.querySelector('.leitor-capitulos-bar');
        
        if (proxCap && proxCapBar) {
            const proxNumero = document.getElementById('proxCapNumero');
            if (proxNumero) proxNumero.textContent = proxCap.numero;
            proxCapBar.classList.remove('hidden');
        } else if (proxCapBar) {
            proxCapBar.classList.add('hidden');
        }

        // Mostrar leitor
        const leitor = document.getElementById('leitorModal');
        if (leitor) {
            leitor.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }

        // Esconder modal da obra
        const obraModal = document.getElementById('obraModal');
        if (obraModal) obraModal.classList.add('hidden');

        // Salvar progresso inicial
        await this.salvarProgresso(
            this.state.obraAtual.id,
            capituloId,
            paginaInicial,
            capitulo.paginas.length,
            capitulo.numero
        );
    },

    async proximoCapitulo(proxCapId = null) {
        if (!proxCapId) {
            const capAtualIndex = this.state.capitulos.findIndex(c => c.id === this.state.capituloAtual.id);
            const proxCap = this.state.capitulos[capAtualIndex - 1];
            if (!proxCap) {
                this.showToast('Este é o último capítulo', 'info');
                return;
            }
            proxCapId = proxCap.id;
        }

        this.closeLeitor();
        setTimeout(() => this.abrirCapitulo(proxCapId, 0), 100);
    },

    renderPaginaLeitor() {
        const capitulo = this.state.capituloAtual;
        const totalPaginas = capitulo.paginas.length;
        const paginaAtual = this.state.paginaAtual;
        
        // Atualizar indicadores
        const pageInfo = document.getElementById('leitorPageInfo');
        const progressBar = document.getElementById('leitorProgressBar');
        const btnPrev = document.getElementById('btnPrevPage');
        const btnNext = document.getElementById('btnNextPage');
        
        if (pageInfo) pageInfo.textContent = `${paginaAtual + 1} / ${totalPaginas}`;
        if (progressBar) progressBar.style.width = `${((paginaAtual + 1) / totalPaginas) * 100}%`;
        if (btnPrev) btnPrev.disabled = paginaAtual === 0;
        if (btnNext) btnNext.disabled = paginaAtual === totalPaginas - 1;

        // Renderizar imagem
        const container = document.getElementById('leitorContent');
        if (container) {
            container.innerHTML = `
                <img src="${capitulo.paginas[paginaAtual]}" 
                     class="leitor-page" 
                     alt="Página ${paginaAtual + 1}"
                     onclick="userApp.nextPage()">
            `;
        }
    },

    async nextPage() {
        if (!this.state.capituloAtual) return;

        const totalPaginas = this.state.capituloAtual.paginas.length;
        
        if (this.state.paginaAtual < totalPaginas - 1) {
            this.state.paginaAtual++;
            this.renderPaginaLeitor();
            
            await this.salvarProgresso(
                this.state.obraAtual.id,
                this.state.capituloAtual.id,
                this.state.paginaAtual,
                totalPaginas,
                this.state.capituloAtual.numero
            );
        } else {
            this.proximoCapitulo();
        }
    },

    async prevPage() {
        if (this.state.paginaAtual > 0) {
            this.state.paginaAtual--;
            this.renderPaginaLeitor();
            
            await this.salvarProgresso(
                this.state.obraAtual.id,
                this.state.capituloAtual.id,
                this.state.paginaAtual,
                this.state.capituloAtual.paginas.length,
                this.state.capituloAtual.numero
            );
        }
    },

    closeLeitor() {
        const leitor = document.getElementById('leitorModal');
        if (leitor) leitor.classList.add('hidden');
        
        document.body.style.overflow = '';
        
        // Reabrir modal da obra se estiver logado
        if (UserAuth.currentUser && this.state.obraAtual) {
            const obraModal = document.getElementById('obraModal');
            if (obraModal) obraModal.classList.remove('hidden');
            this.carregarCapitulos(this.state.obraAtual.id);
        }
        
        this.state.capituloAtual = null;
        this.state.paginaAtual = 0;
    },

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(e => console.log(e));
        } else {
            document.exitFullscreen().catch(e => console.log(e));
        }
    },

    // ========== PROGRESSO E FAVORITOS ==========

    async salvarProgresso(obraId, capituloId, pagina, totalPaginas, capituloNumero) {
        if (!UserAuth.currentUser) return;

        try {
            const percentual = Math.round((pagina / totalPaginas) * 100);
            
            const progresso = {
                capituloId: capituloId,
                capituloNumero: capituloNumero,
                pagina: pagina,
                totalPaginas: totalPaginas,
                percentual: percentual,
                ultimaLeitura: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('userProgress')
                .doc(UserAuth.currentUser.uid)
                .collection('obras')
                .doc(obraId)
                .set(progresso);

            this.state.progressoUsuario[obraId] = progresso;

            await this.adicionarHistorico(obraId, capituloId, capituloNumero);

        } catch (error) {
            console.error('Erro ao salvar progresso:', error);
        }
    },

    async adicionarHistorico(obraId, capituloId, capituloNumero) {
        if (!UserAuth.currentUser) return;

        const obra = this.state.obras.find(o => o.id === obraId);
        if (!obra) return;

        const historicoItem = {
            obraId: obraId,
            obraTitulo: obra.titulo,
            obraCapa: obra.capa || '',
            capituloId: capituloId,
            capituloNumero: capituloNumero,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            const docId = `${obraId}_${capituloId}`;
            
            await db.collection('userHistory')
                .doc(UserAuth.currentUser.uid)
                .collection('leituras')
                .doc(docId)
                .set(historicoItem);

        } catch (error) {
            console.error('Erro ao adicionar histórico:', error);
        }
    },

    getProgressoObra(obraId) {
        return this.state.progressoUsuario[obraId] || null;
    },

    async toggleFavorito() {
        if (!UserAuth.currentUser) {
            this.openAuthModal();
            this.showToast('Faça login para favoritar obras', 'warning');
            return;
        }

        if (!this.state.obraAtual) return;

        const obraId = this.state.obraAtual.id;
        const isFavorito = this.state.favoritos.includes(obraId);

        try {
            if (isFavorito) {
                await db.collection('userFavorites')
                    .doc(UserAuth.currentUser.uid)
                    .collection('obras')
                    .doc(obraId)
                    .delete();
                
                this.state.favoritos = this.state.favoritos.filter(id => id !== obraId);
                this.showToast('Removido dos favoritos', 'success');
            } else {
                await db.collection('userFavorites')
                    .doc(UserAuth.currentUser.uid)
                    .collection('obras')
                    .doc(obraId)
                    .set({
                        obraId: obraId,
                        titulo: this.state.obraAtual.titulo,
                        capa: this.state.obraAtual.capa,
                        adicionadoEm: firebase.firestore.FieldValue.serverTimestamp()
                    });
                
                this.state.favoritos.push(obraId);
                this.showToast('Adicionado aos favoritos!', 'success');
            }

            // Atualizar botão
            const btnFavoritar = document.getElementById('btnFavoritar');
            if (btnFavoritar) {
                const newIsFavorito = !isFavorito;
                btnFavoritar.innerHTML = newIsFavorito 
                    ? '<i class="fas fa-heart"></i> <span id="btnFavoritarText">Favoritado</span>'
                    : '<i class="far fa-heart"></i> <span id="btnFavoritarText">Favoritar</span>';
            }

        } catch (error) {
            console.error('Erro ao favoritar:', error);
            this.showToast('Erro ao favoritar', 'error');
        }
    },

    // ========== AUTENTICAÇÃO UI ==========

    updateUIAuth(isLogged) {
        const guestActions = document.getElementById('guestActions');
        const userActions = document.getElementById('userActions');
        const userDisplayName = document.getElementById('userDisplayName');

        if (guestActions) {
            guestActions.classList.toggle('hidden', isLogged);
        }
        
        if (userActions) {
            userActions.classList.toggle('hidden', !isLogged);
        }
        
        if (userDisplayName && UserAuth.currentUser) {
            userDisplayName.textContent = UserAuth.userData?.nome || UserAuth.currentUser.displayName || 'Usuário';
        }
    },

    openAuthModal() {
        const modal = document.getElementById('authModal');
        if (modal) {
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
    },

    closeAuthModal() {
        const modal = document.getElementById('authModal');
        if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    },

    switchAuthTab(tab) {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const tabs = document.querySelectorAll('.auth-tab');
        
        tabs.forEach(t => t.classList.remove('active'));
        event.target.classList.add('active');
        
        if (tab === 'login') {
            if (loginForm) loginForm.classList.remove('hidden');
            if (registerForm) registerForm.classList.add('hidden');
        } else {
            if (loginForm) loginForm.classList.add('hidden');
            if (registerForm) registerForm.classList.remove('hidden');
        }
    },

    toggleUserMenu() {
        const dropdown = document.getElementById('userDropdown');
        if (dropdown) {
            dropdown.classList.toggle('hidden');
        }
    },

    // ========== HANDLERS DE AUTH ==========

    async handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('loginEmail')?.value;
        const password = document.getElementById('loginPassword')?.value;

        if (!email || !password) return;

        const result = await UserAuth.login(email, password);
        
        if (result.success) {
            this.closeAuthModal();
            this.updateUIAuth(true);
            await this.carregarDadosUsuario();
            this.showToast('Login realizado!', 'success');
            
            if (this.state.obraAtual) {
                this.openObraModal(this.state.obraAtual.id);
            }
        } else {
            this.showToast(result.error, 'error');
        }
    },

    async handleRegister(e) {
        e.preventDefault();
        const nome = document.getElementById('regName')?.value;
        const email = document.getElementById('regEmail')?.value;
        const password = document.getElementById('regPassword')?.value;

        if (!nome || !email || !password) return;

        const result = await UserAuth.register(email, password, nome);
        
        if (result.success) {
            this.closeAuthModal();
            this.updateUIAuth(true);
            this.showToast('Conta criada!', 'success');
        } else {
            this.showToast(result.error, 'error');
        }
    },

    async loginWithGoogle() {
        const result = await UserAuth.loginWithGoogle();
        
        if (result.success) {
            this.closeAuthModal();
            this.updateUIAuth(true);
            await this.carregarDadosUsuario();
            this.showToast('Login com Google realizado!', 'success');
        } else {
            this.showToast(result.error, 'error');
        }
    },



    async logout() {
        await UserAuth.logout();
        this.updateUIAuth(false);
        
        this.state.progressoUsuario = {};
        this.state.favoritos = [];
        this.state.historico = [];
        
        this.showToast('Logout realizado', 'success');
        
        const dropdown = document.getElementById('userDropdown');
        if (dropdown) dropdown.classList.add('hidden');
        
        this.hideMinhasObras();
        this.hideHistorico();
    },

    // ========== SEÇÕES DO USUÁRIO ==========

    async showMinhasObras() {
        if (!UserAuth.currentUser) {
            this.openAuthModal();
            return;
        }

        const obrasComProgresso = Object.keys(this.state.progressoUsuario)
            .map(obraId => {
                const obra = this.state.obras.find(o => o.id === obraId);
                if (!obra) return null;
                
                const progresso = this.state.progressoUsuario[obraId];
                
                return {
                    ...obra,
                    progresso: progresso
                };
            })
            .filter(o => o !== null)
            .sort((a, b) => (b.progresso.ultimaLeitura?.seconds || 0) - (a.progresso.ultimaLeitura?.seconds || 0));

        const obrasFavoritas = this.state.favoritos
            .map(id => this.state.obras.find(o => o.id === id))
            .filter(o => o !== undefined);

        const container = document.getElementById('minhasObrasGrid');
        const placeholderUrl = 'https://placehold.co/300x450/1e1e1e/d32f2f?text=Sem+Capa';

        let html = '';

        if (obrasComProgresso.length > 0) {
            html += `<h3 style="grid-column: 1/-1; margin: 1.5rem 0 1rem; color: var(--primary);"><i class="fas fa-book-open"></i> Continuar Lendo</h3>`;
            
            html += obrasComProgresso.map(obra => `
                <div class="obra-card" onclick="userApp.continuarObra('${obra.id}')">
                    <div style="position: relative;">
                        <img src="${obra.capa || placeholderUrl}" class="obra-capa" loading="lazy">
                        <div style="position: absolute; bottom: 0; left: 0; right: 0; height: 4px; background: var(--bg-hover);">
                            <div style="width: ${obra.progresso.percentual}%; height: 100%; background: var(--primary);"></div>
                        </div>
                    </div>
                    <div class="obra-info">
                        <h3 class="obra-titulo">${obra.titulo}</h3>
                        <div class="obra-meta">
                            <span class="obra-tipo">${obra.tipo}</span>
                            <span class="obra-status">Cap. ${obra.progresso.capituloNumero || '?'}</span>
                        </div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem;">${obra.progresso.percentual}% lido</div>
                    </div>
                </div>
            `).join('');
        }

        if (obrasFavoritas.length > 0) {
            html += `<h3 style="grid-column: 1/-1; margin: 1.5rem 0 1rem; color: var(--primary);"><i class="fas fa-heart"></i> Meus Favoritos</h3>`;
            
            html += obrasFavoritas.map(obra => `
                <div class="obra-card" onclick="userApp.openObraModal('${obra.id}')">
                    <img src="${obra.capa || placeholderUrl}" class="obra-capa" loading="lazy">
                    <div class="obra-info">
                        <h3 class="obra-titulo">${obra.titulo}</h3>
                        <div class="obra-meta">
                            <span class="obra-tipo">${obra.tipo}</span>
                            <span class="obra-status">${obra.status}</span>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        if (html === '') {
            html = `
                <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
                    <i class="fas fa-book" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                    <h3>Nenhuma obra ainda</h3>
                    <p>Comece a ler para ver suas obras aqui!</p>
                </div>
            `;
        }

        if (container) container.innerHTML = html;

        const section = document.getElementById('minhasObrasSection');
        const mainLayout = document.getElementById('mainLayout');
        
        if (section) section.classList.remove('hidden');
        if (mainLayout) mainLayout.classList.add('hidden');
        
        const dropdown = document.getElementById('userDropdown');
        if (dropdown) dropdown.classList.add('hidden');
    },

    hideMinhasObras() {
        const section = document.getElementById('minhasObrasSection');
        const mainLayout = document.getElementById('mainLayout');
        
        if (section) section.classList.add('hidden');
        if (mainLayout) mainLayout.classList.remove('hidden');
    },

    async showHistorico() {
        if (!UserAuth.currentUser) {
            this.openAuthModal();
            return;
        }

        // Recarregar histórico
        try {
            const historicoSnapshot = await db.collection('userHistory')
                .doc(UserAuth.currentUser.uid)
                .collection('leituras')
                .orderBy('timestamp', 'desc')
                .limit(50)
                .get();
            
            this.state.historico = historicoSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate()
            }));
        } catch (error) {
            console.error('Erro ao carregar histórico:', error);
        }

        const container = document.getElementById('historicoList');
        const placeholderUrl = 'https://placehold.co/80x120/1e1e1e/d32f2f?text=Sem+Capa';

        if (!this.state.historico.length) {
            if (container) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
                        <i class="fas fa-history" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                        <h3>Histórico vazio</h3>
                        <p>Suas leituras aparecerão aqui</p>
                    </div>
                `;
            }
        } else {
            if (container) {
                container.innerHTML = this.state.historico.map(item => `
                    <div class="historico-item" onclick="userApp.abrirDoHistorico('${item.obraId}', '${item.capituloId}')">
                        <img src="${item.obraCapa || placeholderUrl}" class="historico-capa" loading="lazy">
                        <div class="historico-info">
                            <div class="historico-obra">${item.obraTitulo}</div>
                            <div class="historico-capitulo">Capítulo ${item.capituloNumero}</div>
                            <div class="historico-data"><i class="far fa-clock"></i> ${this.formatarData(item.timestamp)}</div>
                        </div>
                    </div>
                `).join('');
            }
        }

        const section = document.getElementById('historicoSection');
        const mainLayout = document.getElementById('mainLayout');
        
        if (section) section.classList.remove('hidden');
        if (mainLayout) mainLayout.classList.add('hidden');
        
        const dropdown = document.getElementById('userDropdown');
        if (dropdown) dropdown.classList.add('hidden');
    },

    hideHistorico() {
        const section = document.getElementById('historicoSection');
        const mainLayout = document.getElementById('mainLayout');
        
        if (section) section.classList.add('hidden');
        if (mainLayout) mainLayout.classList.remove('hidden');
    },

    formatarData(data) {
        if (!data) return 'Recente';
        const agora = new Date();
        const diff = agora - data;
        const minutos = Math.floor(diff / 60000);
        const horas = Math.floor(diff / 3600000);
        const dias = Math.floor(diff / 86400000);

        if (minutos < 1) return 'Agora';
        if (minutos < 60) return `${minutos} min atrás`;
        if (horas < 24) return `${horas} h atrás`;
        if (dias < 7) return `${dias} dias atrás`;
        return data.toLocaleDateString();
    },

    // ========== UTILITÁRIOS ==========

    continuarLendo() {
        if (!this.state.obraAtual) return;

        const progresso = this.getProgressoObra(this.state.obraAtual.id);
        
        if (progresso) {
            this.abrirCapitulo(progresso.capituloId, progresso.pagina);
        } else {
            const primeiroCap = this.state.capitulos[this.state.capitulos.length - 1];
            if (primeiroCap) {
                this.abrirCapitulo(primeiroCap.id, 0);
            } else {
                this.showToast('Nenhum capítulo disponível', 'warning');
            }
        }
    },

    continuarObra(obraId) {
        const obra = this.state.obras.find(o => o.id === obraId);
        if (!obra) return;
        
        this.openObraModal(obraId);
        setTimeout(() => this.continuarLendo(), 100);
    },

    abrirDoHistorico(obraId, capituloId) {
        this.hideHistorico();
        this.openObraModal(obraId);
        setTimeout(() => this.abrirCapitulo(capituloId), 100);
    },

    scrollToTop() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.classList.toggle('hidden', !show);
    },

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        toast.innerHTML = `
            <i class="fas ${icons[type]}"></i>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};

// Inicialização quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing app...');
    
    // Bind dos forms de auth
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => userApp.handleLogin(e));
    }
    
    if (registerForm) {
        registerForm.addEventListener('submit', (e) => userApp.handleRegister(e));
    }
    
    // Iniciar app
    userApp.init();
});
// ============================================
// TABLES UNIFIED - VERSÃO OTIMIZADA
// ✅ Cache em memória
// ✅ Carregamento paralelo
// ✅ Debounce otimizado
// ============================================

console.log('🚀 Carregando Sistema Otimizado de Tabelas...');

import {
  getProdutos,
  addProduto,
  updateProduto,
  deleteProduto,
  reordenarProdutos,
  getCardById,
  convertImportanciaToText,
  convertImportanciaToNumber,
  buscarFrete,
  salvarFrete
} from '../supabase.js';

// ========================================
// CONFIGURAÇÕES GLOBAIS
// ========================================
const CONFIG = {
  EMPTY_TEXT: 'Vazio',
  NO_IMAGE_TEXT: 'Sem imagem',
  IMAGE_ERROR_TEXT: 'Imagem indisponível',
  NO_LINK_TEXT: 'Sem link',
  MAX_IMAGE_SIZE: 5 * 1024 * 1024,
  DEBOUNCE_DELAY: 500,
  CACHE_TTL: 60000 // Cache válido por 1 minuto
};

const DEFAULT_COLUMNS = [
  { id: 'nome', name: 'Nome do produto', type: 'text', required: true, default: true },
  { id: 'preco', name: 'Preço', type: 'number', required: true, default: true },
  { id: 'imagem', name: 'Imagem', type: 'file', required: false, default: true },
  { id: 'link', name: 'Link', type: 'url', required: false, default: true },
  { id: 'categoria', name: 'Categoria', type: 'text', required: false, default: true },
  { id: 'descricao', name: 'Descrição', type: 'text', required: false, default: true },
  { 
    id: 'importancia', 
    name: 'Importância', 
    type: 'select', 
    required: false, 
    default: true, 
    options: ['Luxo', 'Importante', 'Essencial', 'Futuro'] 
  },
  { id: 'actions', name: 'Ações', type: 'actions', required: false, default: true }
];

const IMPORTANCE_MAP = {
  'Luxo': '💎 Luxo',
  'Importante': '🔴 Importante', 
  'Essencial': '⭐ Essencial',
  'Futuro': '⏳ Futuro'
};

// ========================================
// CACHE MANAGER
// ========================================
class CacheManager {
  constructor() {
    this.cache = {
      produtos: null,
      cardInfo: null,
      frete: null,
      lastUpdate: null
    };
  }

  set(key, value) {
    this.cache[key] = value;
    this.cache.lastUpdate = Date.now();
  }

  get(key) {
    if (!this.isValid()) return null;
    return this.cache[key];
  }

  isValid() {
    if (!this.cache.lastUpdate) return false;
    return (Date.now() - this.cache.lastUpdate) < CONFIG.CACHE_TTL;
  }

  clear() {
    this.cache = {
      produtos: null,
      cardInfo: null,
      frete: null,
      lastUpdate: null
    };
  }

  invalidate() {
    this.cache.lastUpdate = null;
  }
}

// ========================================
// STORAGE MANAGER - OTIMIZADO
// ========================================
class StorageManager {
  constructor(cardId) {
    this.cardId = cardId;
    this.cardName = '';
    this.produtos = [];
    this.frete = 0;
    this.initialized = false;
    this.cache = new CacheManager();
    
    console.log(`📦 StorageManager criado para card: ${cardId}`);
  }

  async init() {
    if (this.initialized) return;
    
    try {
      console.log(`🎯 Inicializando StorageManager para card ${this.cardId}...`);
      
      // Carregar tudo em paralelo
      await Promise.all([
        this.loadCardInfo(),
        this.loadFromSupabase(),
        this.loadFreteFromSupabase()
      ]);
      
      this.initialized = true;
      console.log(`✅ StorageManager inicializado para card ${this.cardId}`);
    } catch (error) {
      console.error(`❌ Erro ao inicializar StorageManager (${this.cardId}):`, error);
    }
  }

  async loadCardInfo() {
    const cached = this.cache.get('cardInfo');
    if (cached) {
      this.cardName = cached;
      return;
    }

    try {
      const result = await getCardById(this.cardId);
      if (result.success) {
        this.cardName = result.data.name;
        this.cache.set('cardInfo', this.cardName);
        console.log(`✅ Nome do card carregado: ${this.cardName}`);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar info do card:', error);
    }
  }

  async loadFromSupabase() {
    const cached = this.cache.get('produtos');
    if (cached) {
      this.produtos = cached;
      console.log(`💾 Usando ${this.produtos.length} produtos do cache`);
      return;
    }

    try {
      const result = await getProdutos(this.cardId);
      
      if (result.success) {
        this.produtos = (result.data || []).map(p => ({
          id: p.id,
          nome: p.nome_produto,
          preco: p.preco,
          imagem: p.imagem,
          link: p.link,
          categoria: p.categoria,
          descricao: p.descricao,
          importancia: convertImportanciaToText(p.importancia),
          ordem: p.ordem || 0
        }));
        
        this.cache.set('produtos', this.produtos);
        console.log(`✅ ${this.produtos.length} produtos carregados do Supabase`);
      } else {
        this.produtos = [];
      }
      
    } catch (error) {
      console.error(`❌ Erro ao carregar do Supabase (${this.cardId}):`, error);
      this.produtos = [];
    }
  }

  async loadFreteFromSupabase() {
    const cached = this.cache.get('frete');
    if (cached !== null && cached !== undefined) {
      this.frete = cached;
      console.log(`💾 Usando frete do cache: R$ ${this.frete.toFixed(2)}`);
      return;
    }

    try {
      const result = await buscarFrete(this.cardId);
      
      if (result.success) {
        this.frete = result.frete;
        this.cache.set('frete', this.frete);
        console.log(`✅ Frete carregado: R$ ${this.frete.toFixed(2)}`);
      } else {
        this.frete = 0;
      }
    } catch (error) {
      console.error('❌ Erro ao carregar frete:', error);
      this.frete = 0;
    }
  }

  async salvarFreteSupabase(valor) {
    try {
      const result = await salvarFrete(this.cardId, valor);
      
      if (result.success) {
        this.frete = result.frete;
        this.cache.set('frete', this.frete);
        console.log(`💾 Frete salvo: R$ ${this.frete.toFixed(2)}`);
        return { success: true, frete: this.frete };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('❌ Erro ao salvar frete:', error);
      return { success: false, error: error.message };
    }
  }

  getFrete() {
    return this.frete;
  }

  async loadProdutos() {
    try {
      if (!this.initialized) {
        await this.loadFromSupabase();
      }
      
      this.produtos.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      
      return {
        success: true,
        data: [...this.produtos]
      };
    } catch (error) {
      console.error('❌ Erro ao carregar produtos:', error);
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }

  async adicionarProduto(produtoData) {
    try {
      const result = await addProduto(this.cardId, produtoData);
      
      if (result.success) {
        const novoProduto = {
          id: result.data.id,
          nome: result.data.nome_produto,
          preco: result.data.preco,
          imagem: result.data.imagem,
          link: result.data.link,
          categoria: result.data.categoria,
          descricao: result.data.descricao,
          importancia: convertImportanciaToText(result.data.importancia),
          ordem: result.data.ordem || 0
        };
        
        this.produtos.push(novoProduto);
        this.cache.invalidate();
        return { success: true, data: novoProduto };
      } else {
        return result;
      }
    } catch (error) {
      console.error('❌ Erro ao adicionar produto:', error);
      return { success: false, error: error.message };
    }
  }

  async atualizarProduto(produtoId, produtoData) {
    try {
      const result = await updateProduto(this.cardId, produtoId, produtoData);
      
      if (result.success) {
        const index = this.produtos.findIndex(p => p.id === produtoId);
        if (index !== -1) {
          this.produtos[index] = {
            id: result.data.id,
            nome: result.data.nome_produto,
            preco: result.data.preco,
            imagem: result.data.imagem,
            link: result.data.link,
            categoria: result.data.categoria,
            descricao: result.data.descricao,
            importancia: convertImportanciaToText(result.data.importancia),
            ordem: result.data.ordem || 0
          };
        }
        this.cache.invalidate();
        return { success: true, data: this.produtos[index] };
      } else {
        return result;
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar produto:', error);
      return { success: false, error: error.message };
    }
  }

  async removerProduto(produtoId) {
    try {
      const result = await deleteProduto(this.cardId, produtoId);
      
      if (result.success) {
        this.produtos = this.produtos.filter(p => p.id !== produtoId);
        this.cache.invalidate();
        return result;
      } else {
        return result;
      }
    } catch (error) {
      console.error('❌ Erro ao remover produto:', error);
      return { success: false, error: error.message };
    }
  }

  async reordenarProdutos(produtoIds) {
    try {
      const result = await reordenarProdutos(this.cardId, produtoIds);
      this.cache.invalidate();
      return result;
    } catch (error) {
      console.error('❌ Erro ao reordenar:', error);
      return { success: false, error: error.message };
    }
  }

  getProdutoById(produtoId) {
    return this.produtos.find(p => p.id === produtoId) || null;
  }

  getEstatisticas() {
    const totalProdutos = this.produtos.length;
    const totalValor = this.produtos.reduce((sum, p) => sum + (parseFloat(p.preco) || 0), 0);
    const categorias = [...new Set(this.produtos.map(p => p.categoria).filter(Boolean))];
    
    return { totalProdutos, totalValor, totalCategorias: categorias.length };
  }
}

// ========================================
// GERENCIADOR GLOBAL DE TABELAS
// ========================================
class TablesManager {
  constructor() {
    this.tables = {};
  }

  createTable(cardId) {
    if (this.tables[cardId]) {
      return this.tables[cardId];
    }

    const storage = new StorageManager(cardId);
    storage.init();
    this.tables[cardId] = storage;
    
    return storage;
  }

  getTable(cardId) {
    if (!this.tables[cardId]) {
      return this.createTable(cardId);
    }
    return this.tables[cardId];
  }

  deleteTable(cardId) {
    if (this.tables[cardId]) {
      delete this.tables[cardId];
    }
    return { success: true };
  }

  hasTable(cardId) {
    return this.tables[cardId] !== undefined;
  }

  listTables() {
    return Object.keys(this.tables);
  }
}

window.tablesManager = new TablesManager();

// ========================================
// CLASSE PRINCIPAL - OTIMIZADA
// ========================================
class TableApp {
  constructor(cardId) {
    this.cardId = cardId;
    this.storage = window.tablesManager.getTable(cardId);
    this.state = {
      produtos: [],
      columns: [...DEFAULT_COLUMNS],
      isLoading: false,
      editingProductId: null,
      draggedElement: null,
      draggedType: null
    };
    this.elements = {};
    this.debounceTimers = {};
  }

  async init() {
    console.log(`🎯 Inicializando TableApp para card ${this.cardId}...`);
    
    this.cacheElements();
    
    // Carregar dados e UI em paralelo
    const initPromises = [
      this.storage.init(),
      this.loadData()
    ];
    
    await Promise.all(initPromises);
    
    // Configurar UI
    this.setupEventListeners();
    this.setupDragAndDrop();
    this.preventNumberInputScroll();
    this.injectStyles();
    
    this.updateCardTitle();
    this.renderTable();
    this.updateCategoryFilter();
    this.loadFreteValue();
    this.updateTotals();
    
    console.log('✅ TableApp inicializado!');
  }

  updateCardTitle() {
    if (this.elements.cardTitle) {
      this.elements.cardTitle.textContent = this.storage.cardName || 'Gerenciador de Produtos';
    }
    if (this.elements.cardSubtitle) {
      this.elements.cardSubtitle.textContent = 'Gerencie seus produtos com Supabase';
    }
  }

  loadFreteValue() {
    const frete = this.storage.getFrete();
    if (this.elements.shippingCost) {
      this.elements.shippingCost.value = frete > 0 ? frete.toFixed(2) : '';
    }
  }

  cacheElements() {
    const ids = [
      'backBtn', 'cardTitle', 'cardSubtitle',
      'addProductBtn', 'searchInput', 'categoryFilter', 'importanceFilter',
      'totalProducts', 'totalValue', 'subtotalValue', 'shippingValue', 'grandTotal', 'shippingCost',
      'productsTable', 'tableHeader', 'tableBody', 'emptyState',
      'productModal', 'productModalTitle', 'closeProductModal', 'productForm',
      'productFormGrid', 'cancelProductBtn', 'saveProductBtn',
      'confirmModal', 'confirmTitle', 'confirmMessage', 'confirmCancelBtn', 'confirmDeleteBtn',
      'loadingOverlay'
    ];
    
    ids.forEach(id => {
      this.elements[id] = document.getElementById(id);
    });
  }

  preventNumberInputScroll() {
    document.addEventListener('wheel', (e) => {
      if (document.activeElement?.type === 'number') {
        document.activeElement.blur();
      }
    }, { passive: true });
  }

  async loadData() {
    try {
      const result = await this.storage.loadProdutos();
      
      if (result.success) {
        this.state.produtos = result.data || [];
        console.log(`✅ ${this.state.produtos.length} produtos carregados`);
      } else {
        this.state.produtos = [];
      }
    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error);
      this.state.produtos = [];
    }
  }

  renderTable() {
    this.renderTableHeader();
    this.renderTableBody();
    this.updateEmptyState();
  }

  renderTableHeader() {
    this.elements.tableHeader.innerHTML = '';
    
    this.state.columns.forEach((column, index) => {
      const th = document.createElement('th');
      th.setAttribute('data-column-id', column.id);
      th.setAttribute('data-column-index', index);
      
      const headerContent = document.createElement('div');
      headerContent.className = 'header-content';
      
      const title = document.createElement('span');
      title.className = 'column-title';
      title.textContent = column.name;
      headerContent.appendChild(title);
      
      th.appendChild(headerContent);
      this.elements.tableHeader.appendChild(th);
    });
  }

  renderTableBody() {
    this.elements.tableBody.innerHTML = '';
    const filteredProducts = this.getFilteredProducts();
    
    // Usar DocumentFragment para melhor performance
    const fragment = document.createDocumentFragment();
    
    filteredProducts.forEach((product, index) => {
      const tr = this.createTableRow(product, index);
      fragment.appendChild(tr);
    });
    
    this.elements.tableBody.appendChild(fragment);
  }

  createTableRow(product, index) {
    const tr = document.createElement('tr');
    tr.setAttribute('data-product-id', product.id);
    tr.setAttribute('data-product-index', index);
    tr.draggable = true;
    tr.style.cursor = 'move';
    
    this.state.columns.forEach(column => {
      const td = document.createElement('td');
      td.setAttribute('data-column-id', column.id);
      td.appendChild(this.renderCellContent(product, column));
      tr.appendChild(td);
    });
    
    return tr;
  }

  renderCellContent(product, column) {
    const container = document.createElement('div');
    const value = product[column.id];
    
    const renderer = this.getCellRenderer(column.type, column.id);
    renderer(container, value, product);
    
    return container;
  }

  getCellRenderer(type, columnId) {
    const renderers = {
      text: (container, value) => {
        container.textContent = value || CONFIG.EMPTY_TEXT;
        if (columnId === 'categoria' || columnId === 'descricao') {
          container.style.whiteSpace = 'normal';
          container.style.wordWrap = 'break-word';
        }
        if (!value) this.applyEmptyStyle(container);
      },
      
      url: (container, value) => {
        if (value) {
          const link = document.createElement('a');
          link.className = 'cell-link';
          link.href = value;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.textContent = 'Ver produto';
          container.appendChild(link);
        } else {
          container.textContent = CONFIG.NO_LINK_TEXT;
          this.applyEmptyStyle(container);
        }
      },
      
      number: (container, value) => {
        container.className = 'cell-price';
        container.textContent = this.formatCurrency(value || 0);
      },
      
      image: (container, value, product) => {
        if (value) {
          const img = document.createElement('img');
          img.className = 'cell-image';
          img.src = value;
          img.alt = product.nome || 'Produto';
          img.loading = 'lazy'; // Lazy loading para imagens
          img.style.cssText = 'width: 50px; height: 50px; object-fit: cover; border-radius: 8px;';
          img.onerror = () => {
            container.innerHTML = `<span style="color: #94a3b8; font-size: 0.85rem; font-style: italic;">${CONFIG.IMAGE_ERROR_TEXT}</span>`;
          };
          container.appendChild(img);
        } else {
          container.innerHTML = `<span style="color: #94a3b8; font-size: 0.85rem; font-style: italic;">${CONFIG.NO_IMAGE_TEXT}</span>`;
        }
      },
      
      select: (container, value) => {
        container.className = `cell-importance ${value || ''}`;
        container.innerHTML = IMPORTANCE_MAP[value] || `<span style="color: #94a3b8; font-style: italic;">${CONFIG.EMPTY_TEXT}</span>`;
      },
      
      actions: (container, value, product) => {
        const actions = document.createElement('div');
        actions.className = 'row-actions';
        actions.style.cssText = 'display: flex; gap: 0.5rem;';
        
        const editBtn = document.createElement('button');
        editBtn.className = 'row-action-btn edit';
        editBtn.innerHTML = '✏️';
        editBtn.title = 'Editar';
        editBtn.onclick = () => this.editProduct(product.id);
        editBtn.style.cssText = 'background: #3b82f6; border: none; padding: 0.5rem; border-radius: 6px; cursor: pointer;';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'row-action-btn delete';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = 'Excluir';
        deleteBtn.onclick = () => this.deleteProduct(product.id);
        deleteBtn.style.cssText = 'background: #ef4444; border: none; padding: 0.5rem; border-radius: 6px; cursor: pointer;';
        
        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);
        container.appendChild(actions);
      }
    };
    
    if (columnId === 'link') return renderers.url;
    if (columnId === 'preco') return renderers.number;
    if (columnId === 'imagem') return renderers.image;
    if (columnId === 'importancia') return renderers.select;
    if (columnId === 'actions') return renderers.actions;
    
    return renderers[type] || renderers.text;
  }

  applyEmptyStyle(element) {
    element.style.color = '#94a3b8';
    element.style.fontStyle = 'italic';
  }

  getFilteredProducts() {
    let filtered = [...this.state.produtos];
    
    const searchTerm = this.elements.searchInput.value.toLowerCase();
    const categoryFilter = this.elements.categoryFilter.value;
    const importanceFilter = this.elements.importanceFilter.value;
    
    if (searchTerm) {
      filtered = filtered.filter(product =>
        ['nome', 'categoria', 'descricao'].some(field =>
          (product[field] || '').toLowerCase().includes(searchTerm)
        )
      );
    }
    
    if (categoryFilter) {
      filtered = filtered.filter(product => product.categoria === categoryFilter);
    }
    
    if (importanceFilter) {
      filtered = filtered.filter(product => product.importancia === importanceFilter);
    }
    
    return filtered;
  }

  updateCategoryFilter() {
    const categories = [...new Set(this.state.produtos.map(p => p.categoria).filter(Boolean))];
    
    this.elements.categoryFilter.innerHTML = '<option value="">Todas as categorias</option>';
    categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      this.elements.categoryFilter.appendChild(option);
    });
  }

  handleFiltersChange() {
    try {
      this.renderTableBody();
      this.updateEmptyState();
      this.updateTotals();
    } catch (error) {
      console.error('❌ Erro ao aplicar filtros:', error);
    }
  }

  updateEmptyState() {
    const hasProducts = this.getFilteredProducts().length > 0;
    this.elements.emptyState.classList.toggle('show', !hasProducts);
    this.elements.productsTable.style.display = hasProducts ? 'table' : 'none';
  }

  updateTotals() {
    const filteredProducts = this.getFilteredProducts();
    const subtotal = filteredProducts.reduce((sum, p) => sum + (parseFloat(p.preco) || 0), 0);
    const shipping = parseFloat(this.elements.shippingCost?.value) || 0;
    const total = subtotal + shipping;
    
    if (this.elements.totalProducts) this.elements.totalProducts.textContent = filteredProducts.length;
    if (this.elements.totalValue) this.elements.totalValue.textContent = this.formatCurrency(total);
    if (this.elements.subtotalValue) this.elements.subtotalValue.textContent = this.formatCurrency(subtotal);
    if (this.elements.shippingValue) this.elements.shippingValue.textContent = this.formatCurrency(shipping);
    if (this.elements.grandTotal) this.elements.grandTotal.textContent = this.formatCurrency(total);
  }

  async saveFreteValueToSupabase() {
    try {
      const freteValue = parseFloat(this.elements.shippingCost?.value) || 0;
      const result = await this.storage.salvarFreteSupabase(freteValue);
      
      if (result.success) {
        this.updateTotals();
      }
    } catch (error) {
      console.error('❌ Erro ao salvar frete:', error);
    }
  }

  setupDragAndDrop() {
    this.elements.tableBody.addEventListener('dragstart', (e) => this.handleRowDragStart(e));
    this.elements.tableBody.addEventListener('dragover', (e) => this.handleRowDragOver(e));
    this.elements.tableBody.addEventListener('drop', (e) => this.handleRowDrop(e));
    this.elements.tableBody.addEventListener('dragend', (e) => this.handleRowDragEnd(e));
  }

  handleRowDragStart(e) {
    if (e.target.tagName === 'TR') {
      this.state.draggedElement = e.target;
      this.state.draggedType = 'row';
      e.target.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    }
  }

  handleRowDragOver(e) {
    if (this.state.draggedType === 'row') {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      const targetRow = e.target.closest('tr');
      if (targetRow && targetRow !== this.state.draggedElement) {
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        targetRow.classList.add('drag-over');
      }
    }
  }

  async handleRowDrop(e) {
    if (this.state.draggedType === 'row') {
      e.preventDefault();
      
      const targetRow = e.target.closest('tr');
      if (targetRow && targetRow !== this.state.draggedElement) {
        await this.reorderProducts(this.state.draggedElement, targetRow);
      }
    }
  }

  handleRowDragEnd(e) {
    if (this.state.draggedType === 'row') {
      e.target.classList.remove('dragging');
      document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      this.state.draggedElement = null;
      this.state.draggedType = null;
    }
  }

  async reorderProducts(draggedRow, targetRow) {
    const draggedId = draggedRow.getAttribute('data-product-id');
    const targetId = targetRow.getAttribute('data-product-id');
    
    const draggedIndex = this.state.produtos.findIndex(p => p.id == draggedId);
    const targetIndex = this.state.produtos.findIndex(p => p.id == targetId);
    
    const draggedProduct = this.state.produtos[draggedIndex];
    this.state.produtos.splice(draggedIndex, 1);
    this.state.produtos.splice(targetIndex, 0, draggedProduct);
    
    this.state.produtos.forEach((p, i) => {
      p.ordem = i;
    });
    
    const produtoIds = this.state.produtos.map(p => p.id);
    await this.storage.reordenarProdutos(produtoIds);
    
    this.renderTableBody();
  }

  openAddProductModal() {
    this.state.editingProductId = null;
    this.elements.productModalTitle.textContent = 'Novo Produto';
    this.generateProductForm();
    this.showModal(this.elements.productModal);
  }

  editProduct(productId) {
    const product = this.state.produtos.find(p => p.id == productId);
    if (!product) return;
    
    this.state.editingProductId = productId;
    this.elements.productModalTitle.textContent = 'Editar Produto';
    this.generateProductForm(product);
    this.showModal(this.elements.productModal);
  }

  generateProductForm(product = {}) {
    this.elements.productFormGrid.innerHTML = '';
    
    this.state.columns.forEach(column => {
      if (column.id === 'actions') return;
      
      const formGroup = this.createFormGroup(column, product);
      this.elements.productFormGrid.appendChild(formGroup);
    });
  }

  createFormGroup(column, product) {
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';
    
    const label = document.createElement('label');
    label.textContent = column.name + (column.required ? ' *' : '');
    label.setAttribute('for', `field_${column.id}`);
    formGroup.appendChild(label);
    
    if (column.type === 'file' && column.id === 'imagem') {
      const imageField = this.createImageUploadField(product[column.id]);
      formGroup.appendChild(imageField);
    } else {
      const input = this.createFormInput(column, product);
      formGroup.appendChild(input);
    }
    
    return formGroup;
  }

  createFormInput(column, product) {
    let input;
    
    switch (column.type) {
      case 'select':
        input = this.createSelectInput(column, product);
        break;
      case 'number':
        input = this.createNumberInput(column, product);
        break;
      case 'url':
        input = this.createUrlInput(column, product);
        break;
      default:
        input = this.createTextInput(column, product);
    }
    
    input.id = `field_${column.id}`;
    input.name = column.id;
    if (column.required) input.required = true;
    
    return input;
  }

  createSelectInput(column, product) {
    const select = document.createElement('select');
    const options = column.options || [];
    
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = 'Selecione...';
    select.appendChild(emptyOption);
    
    options.forEach(option => {
      const optionEl = document.createElement('option');
      optionEl.value = option;
      optionEl.textContent = option;
      optionEl.selected = product[column.id] === option;
      select.appendChild(optionEl);
    });
    
    return select;
  }

  createNumberInput(column, product) {
    const input = document.createElement('input');
    input.type = 'number';
    input.step = '0.01';
    input.min = '0';
    input.value = product[column.id] || '';
    input.placeholder = column.id === 'preco' ? '0,00' : '';
    return input;
  }

  createUrlInput(column, product) {
    const input = document.createElement('input');
    input.type = 'url';
    input.value = product[column.id] || '';
    input.placeholder = 'https://...';
    return input;
  }

  createTextInput(column, product) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = product[column.id] || '';
    
    const placeholders = {
      'nome': 'Nome do produto...',
      'categoria': 'Ex: Eletrônicos, Casa...',
      'descricao': 'Descrição do produto...'
    };
    
    input.placeholder = placeholders[column.id] || '';
    return input;
  }

  createImageUploadField(currentImageUrl) {
    const container = document.createElement('div');
    container.style.cssText = 'display: flex; flex-direction: column; gap: 0.75rem;';
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.id = 'field_imagem';
    input.name = 'imagem';
    input.style.padding = '0.5rem';
    
    const preview = this.createImagePreview(input, currentImageUrl);
    
    container.appendChild(input);
    container.appendChild(preview);
    
    return container;
  }

  createImagePreview(input, currentImageUrl) {
    const preview = document.createElement('div');
    preview.id = 'imagePreview';
    preview.style.cssText = 'display: none; align-items: center; gap: 0.75rem;';
    
    const img = document.createElement('img');
    img.style.cssText = 'width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid rgba(51, 65, 85, 0.3);';
    
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = 'Remover';
    removeBtn.className = 'btn btn-secondary';
    removeBtn.style.cssText = 'font-size: 0.8rem; padding: 0.5rem 0.75rem;';
    
    removeBtn.onclick = () => {
      input.value = '';
      preview.style.display = 'none';
      input.style.display = 'block';
      input.removeAttribute('data-current-image');
    };
    
    preview.appendChild(img);
    preview.appendChild(removeBtn);
    
    if (currentImageUrl) {
      img.src = currentImageUrl;
      preview.style.display = 'flex';
      input.style.display = 'none';
      input.setAttribute('data-current-image', currentImageUrl);
    }
    
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          img.src = e.target.result;
          preview.style.display = 'flex';
          input.style.display = 'none';
        };
        reader.readAsDataURL(file);
      }
    });
    
    return preview;
  }

  async handleSaveProduct(e) {
    e.preventDefault();
    
    if (this.state.isLoading) return;
    
    const productData = await this.extractProductData();
    if (!productData || !this.validateProductData(productData)) return;
    
    this.setLoading(true);
    
    try {
      let result;
      
      if (this.state.editingProductId) {
        result = await this.storage.atualizarProduto(this.state.editingProductId, productData);
        
        if (result.success) {
          const index = this.state.produtos.findIndex(p => p.id == this.state.editingProductId);
          this.state.produtos[index] = result.data;
        }
      } else {
        result = await this.storage.adicionarProduto(productData);
        
        if (result.success) {
          this.state.produtos.push(result.data);
        }
      }
      
      if (result.success) {
        this.closeProductModal();
        this.renderTable();
        this.updateCategoryFilter();
        this.updateTotals();
        this.showMessage('Produto salvo com sucesso!', 'success');
      } else {
        this.showMessage(result.error || 'Erro ao salvar produto', 'error');
      }
      
    } catch (error) {
      console.error('❌ Erro ao salvar produto:', error);
      this.showMessage('Erro ao salvar produto', 'error');
    } finally {
      this.setLoading(false);
    }
  }

  async extractProductData() {
    const productData = {};
    
    for (const column of this.state.columns) {
      if (column.id === 'actions') continue;
      
      if (column.type === 'file' && column.id === 'imagem') {
        const imageData = await this.extractImageData();
        if (imageData === false) return null;
        productData[column.id] = imageData;
      } else {
        const input = document.getElementById(`field_${column.id}`);
        if (input) {
          productData[column.id] = input.value ? input.value.trim() : '';
        } else {
          productData[column.id] = '';
        }
      }
    }
    
    return productData;
  }

  async extractImageData() {
    const fileInput = document.getElementById('field_imagem');
    if (!fileInput) return '';
    
    const currentImage = fileInput.getAttribute('data-current-image');
    
    if (fileInput.files?.length > 0) {
      const file = fileInput.files[0];
      
      if (!file.type.startsWith('image/')) {
        this.showMessage('Apenas imagens são permitidas', 'error');
        return false;
      }
      
      if (file.size > CONFIG.MAX_IMAGE_SIZE) {
        this.showMessage('Imagem deve ter no máximo 5MB', 'error');
        return false;
      }
      
      try {
        return await this.fileToBase64(file);
      } catch (error) {
        this.showMessage('Erro ao processar imagem', 'error');
        return false;
      }
    }
    
    return currentImage || '';
  }

  validateProductData(productData) {
    if (!productData.nome || !productData.nome.trim()) {
      this.showMessage('Nome do produto é obrigatório', 'error');
      return false;
    }
    
    if (!productData.preco || productData.preco === '' || parseFloat(productData.preco) <= 0) {
      this.showMessage('Preço deve ser maior que zero', 'error');
      return false;
    }
    
    return true;
  }

  deleteProduct(productId) {
    const product = this.state.produtos.find(p => p.id == productId);
    if (!product) return;
    
    this.elements.confirmTitle.textContent = 'Excluir Produto';
    this.elements.confirmMessage.textContent = `Tem certeza que deseja excluir o produto "${product.nome}"?`;
    
    this.elements.confirmDeleteBtn.onclick = async () => {
      this.setLoading(true);
      
      try {
        const result = await this.storage.removerProduto(productId);
        
        if (result.success) {
          this.state.produtos = this.state.produtos.filter(p => p.id != productId);
          this.closeConfirmModal();
          this.renderTable();
          this.updateCategoryFilter();
          this.updateTotals();
          this.showMessage('Produto excluído com sucesso!', 'success');
        } else {
          this.showMessage(result.error || 'Erro ao excluir produto', 'error');
        }
        
      } catch (error) {
        console.error('❌ Erro ao excluir produto:', error);
        this.showMessage('Erro ao excluir produto', 'error');
      } finally {
        this.setLoading(false);
      }
    };
    
    this.showModal(this.elements.confirmModal);
  }

  showModal(modal) {
    modal.classList.add('show');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  closeModal(modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }

  closeProductModal() {
    this.closeModal(this.elements.productModal);
    this.state.editingProductId = null;
  }

  closeConfirmModal() {
    this.closeModal(this.elements.confirmModal);
  }

  setupEventListeners() {
    this.elements.backBtn?.addEventListener('click', () => {
      window.location.href = '../card/card.html';
    });
    
    this.elements.addProductBtn?.addEventListener('click', () => this.openAddProductModal());
    
    // Debounced events
    this.elements.searchInput?.addEventListener('input', () => {
      this.debouncedFilterChange();
    });
    
    this.elements.categoryFilter?.addEventListener('change', () => this.handleFiltersChange());
    this.elements.importanceFilter?.addEventListener('change', () => this.handleFiltersChange());
    
    this.elements.shippingCost?.addEventListener('input', () => {
      this.debouncedSaveFrete();
    });
    
    this.elements.closeProductModal?.addEventListener('click', () => this.closeProductModal());
    this.elements.cancelProductBtn?.addEventListener('click', () => this.closeProductModal());
    this.elements.productForm?.addEventListener('submit', (e) => this.handleSaveProduct(e));
    
    this.elements.confirmCancelBtn?.addEventListener('click', () => this.closeConfirmModal());
    
    const confirmCloseBtn = document.getElementById('confirmCloseBtn');
    confirmCloseBtn?.addEventListener('click', () => this.closeConfirmModal());
  }

  debouncedFilterChange() {
    clearTimeout(this.debounceTimers.filter);
    this.debounceTimers.filter = setTimeout(() => {
      this.handleFiltersChange();
    }, CONFIG.DEBOUNCE_DELAY);
  }

  debouncedSaveFrete() {
    clearTimeout(this.debounceTimers.frete);
    this.debounceTimers.frete = setTimeout(() => {
      this.saveFreteValueToSupabase();
    }, CONFIG.DEBOUNCE_DELAY);
  }

  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  }

  formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  setLoading(loading) {
    this.state.isLoading = loading;
    this.elements.loadingOverlay?.classList.toggle('show', loading);
  }

  showMessage(message, type) {
    this.removeExistingMessage();
    
    const messageDiv = this.createMessageElement(message, type);
    document.body.appendChild(messageDiv);
    
    setTimeout(() => this.removeMessage(messageDiv), 4000);
  }

  removeExistingMessage() {
    const existingMessage = document.querySelector('.message');
    if (existingMessage) {
      existingMessage.remove();
    }
  }

  createMessageElement(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    
    this.applyMessageStyles(messageDiv, type);
    
    return messageDiv;
  }

  applyMessageStyles(element, type) {
    element.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 20px;
      border-radius: 12px;
      color: white;
      font-weight: 500;
      z-index: 10000;
      animation: slideIn 0.3s ease-in-out;
      max-width: 350px;
      word-wrap: break-word;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    `;
    
    const backgrounds = {
      success: 'linear-gradient(135deg, #10b981, #059669)',
      error: 'linear-gradient(135deg, #ef4444, #dc2626)',
      info: 'linear-gradient(135deg, #3b82f6, #2563eb)'
    };
    
    element.style.background = backgrounds[type] || backgrounds.info;
  }

  removeMessage(messageDiv) {
    if (messageDiv.parentNode) {
      messageDiv.style.animation = 'slideOut 0.3s ease-in-out';
      setTimeout(() => {
        if (messageDiv.parentNode) {
          messageDiv.remove();
        }
      }, 300);
    }
  }

  injectStyles() {
    const styles = document.createElement('style');
    styles.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
      
      .dragging { opacity: 0.5; }
      .drag-over { background-color: rgba(99, 102, 241, 0.1); }
    `;
    document.head.appendChild(styles);
  }
}

// ========================================
// INICIALIZAÇÃO AUTOMÁTICA
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Iniciando aplicação...');
  
  const urlParams = new URLSearchParams(window.location.search);
  const cardId = urlParams.get('id');
  
  if (!cardId) {
    console.error('❌ ID do card não fornecido na URL!');
    alert('Erro: ID do card não encontrado. Redirecionando...');
    window.location.href = '../card/card.html';
    return;
  }
  
  console.log(`📋 Card ID: ${cardId}`);
  
  const app = new TableApp(cardId);
  await app.init();
  
  window.TableApp = app;
  window.StorageManager = app.storage;
  
  console.log('✅ Sistema carregado com sucesso!');
});
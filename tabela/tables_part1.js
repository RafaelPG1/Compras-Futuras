// tables_part1.js - Sistema Principal de Tabelas
// ============================================================================

// ----------------------------------------------------------------------------
// SEÇÃO 1: IMPORTS
// ----------------------------------------------------------------------------
import { 
    auth, 
    db, 
    onAuthChange, 
    isManualSessionValid, 
    clearManualSession, 
    signOutUser,
    collection, 
    getDocs, 
    query, 
    where, 
    doc, 
    updateDoc, 
    serverTimestamp 
} from '../firebase.js';

// ----------------------------------------------------------------------------
// SEÇÃO 2: CONFIGURAÇÕES E CONSTANTES
// ----------------------------------------------------------------------------
const CONFIG = {
    EMPTY_TEXT: 'Vazio',
    NO_IMAGE_TEXT: 'Sem imagem',
    IMAGE_ERROR_TEXT: 'Imagem indisponível',
    NO_LINK_TEXT: 'Sem link',
    MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
    AUTO_SAVE_INTERVAL: 2 * 60 * 1000, // 2 minutos
    DEBOUNCE_DELAY: 300
};

const DEFAULT_COLUMNS = [
    { id: 'name', name: 'Nome do produto', type: 'text', required: true, default: true },
    { id: 'price', name: 'Preço', type: 'number', required: true, default: true },
    { id: 'image', name: 'Imagem', type: 'file', required: false, default: true },
    { id: 'link', name: 'Link', type: 'url', required: false, default: true },
    { id: 'store', name: 'Loja', type: 'text', required: false, default: true },
    { id: 'category', name: 'Categoria', type: 'text', required: false, default: true },
    { id: 'descricao', name: 'Descrição do produto', type: 'text', required: false, default: true },
    { 
        id: 'importance', 
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

// ----------------------------------------------------------------------------
// SEÇÃO 3: ESTADO GLOBAL
// ----------------------------------------------------------------------------
const state = {
    currentUser: null,
    currentCardId: null,
    currentCard: null,
    products: [],
    columns: [],
    isLoading: false,
    editingProductId: null,
    draggedElement: null,
    draggedType: null // 'row' ou 'column'
};

// ----------------------------------------------------------------------------
// SEÇÃO 4: CACHE DE ELEMENTOS DOM
// ----------------------------------------------------------------------------
const elements = {};

const ELEMENT_IDS = [
    // Cabeçalho
    'backBtn', 'cardTitle', 'cardSubtitle', 'userPhoto', 'userName', 'logoutBtn',
    // Controles
    'addProductBtn', 'addColumnBtn', 'searchInput', 'categoryFilter', 'importanceFilter',
    // Estatísticas
    'totalProducts', 'totalValue', 'subtotalValue', 'shippingValue', 'grandTotal', 'shippingCost',
    // Tabela
    'productsTable', 'tableHeader', 'tableBody', 'emptyState',
    // Modal de Produto
    'productModal', 'productModalTitle', 'closeProductModal', 'productForm',
    'productFormGrid', 'cancelProductBtn', 'saveProductBtn',
    // Modal de Coluna
    'columnModal', 'closeColumnModal', 'columnForm', 'columnName',
    'cancelColumnBtn', 'saveColumnBtn',
    // Modal de Confirmação
    'confirmModal', 'confirmTitle', 'confirmMessage', 'confirmCancelBtn', 'confirmDeleteBtn',
    // Outros
    'loadingOverlay'
];

// ----------------------------------------------------------------------------
// SEÇÃO 5: INICIALIZAÇÃO
// ----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', initialize);

function initialize() {
    initializeElements();
    getCurrentCardId();
    checkAuthentication();
    setupEventListeners();
    setupDragAndDrop();
    preventNumberInputScroll();
}

function initializeElements() {
    ELEMENT_IDS.forEach(id => {
        elements[id] = document.getElementById(id);
        if (!elements[id] && id !== 'cardSubtitle') {
            console.warn(`Elemento não encontrado: ${id}`);
        }
    });
}

function getCurrentCardId() {
    const urlParams = new URLSearchParams(window.location.search);
    state.currentCardId = urlParams.get('card');
    
    if (!state.currentCardId) {
        showMessage('Card não especificado', 'error');
        setTimeout(() => window.location.href = '../card/card.html', 2000);
    }
}

function preventNumberInputScroll() {
    document.addEventListener('wheel', function(e) {
        if (document.activeElement?.type === 'number') {
            document.activeElement.blur();
        }
    });
}

// ----------------------------------------------------------------------------
// SEÇÃO 6: AUTENTICAÇÃO
// ----------------------------------------------------------------------------
function checkAuthentication() {
    const manualSession = isManualSessionValid();
    
    if (manualSession) {
        handleManualSession(manualSession);
        return;
    }
    
    onAuthChange((user) => {
        if (user?.email) {
            handleGoogleSession(user);
        } else if (!manualSession) {
            window.location.href = '../index.html';
        }
    });
}

function handleManualSession(session) {
    state.currentUser = {
        type: 'manual',
        username: session.username,
        email: `${session.username}@manual.local`,
        displayName: session.username,
        photoURL: null
    };
    updateUserInterface();
    loadCardData();
}

function handleGoogleSession(user) {
    state.currentUser = {
        type: 'google',
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email,
        photoURL: user.photoURL
    };
    updateUserInterface();
    loadCardData();
}

function updateUserInterface() {
    if (!state.currentUser) return;
    
    elements.userName.textContent = state.currentUser.displayName;
    
    if (state.currentUser.photoURL) {
        elements.userPhoto.src = state.currentUser.photoURL;
        elements.userPhoto.onerror = () => setPlaceholderPhoto();
    } else {
        setPlaceholderPhoto();
    }
}

function setPlaceholderPhoto() {
    const firstLetter = state.currentUser.displayName.charAt(0).toUpperCase();
    elements.userPhoto.src = createPlaceholderImage(firstLetter);
}

async function handleLogout() {
    try {
        setLoading(true);
        clearManualSession();
        
        if (state.currentUser?.type === 'google') {
            await signOutUser();
        }
        
        showMessage('Logout realizado com sucesso!', 'success');
        setTimeout(() => window.location.href = '../index.html', 1000);
        
    } catch (error) {
        console.error('Erro no logout:', error);
        showMessage('Erro no logout', 'error');
    } finally {
        setLoading(false);
    }
}

// ----------------------------------------------------------------------------
// SEÇÃO 7: CARREGAMENTO DE DADOS
// ----------------------------------------------------------------------------
async function loadCardData() {
    if (!state.currentUser || !state.currentCardId) return;
    
    setLoading(true);
    
    try {
        const cardData = await fetchCardFromFirebase();
        processCardData(cardData);
        renderTable();
        initializeCalculations();
        
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        showMessage('Erro ao carregar dados: ' + error.message, 'error');
    } finally {
        setLoading(false);
    }
}

async function fetchCardFromFirebase() {
    const cardQuery = query(
        collection(db, 'cards'),
        where('__name__', '==', state.currentCardId)
    );
    
    const cardSnapshot = await getDocs(cardQuery);
    
    if (cardSnapshot.empty) {
        throw new Error('Card não encontrado');
    }
    
    const cardDoc = cardSnapshot.docs[0];
    return { id: state.currentCardId, ...cardDoc.data() };
}

function processCardData(cardData) {
    state.currentCard = cardData;
    
    if (elements.cardTitle) {
        elements.cardTitle.textContent = state.currentCard.name || 'Card sem nome';
    }
    
    loadColumns();
    loadProducts();
    updateCategoryFilter();
}

function loadColumns() {
    const customColumns = state.currentCard.customColumns || [];
    state.columns = [...DEFAULT_COLUMNS];
    
    const actionsIndex = state.columns.findIndex(col => col.id === 'actions');
    customColumns.forEach((col, index) => {
        state.columns.splice(actionsIndex + index, 0, {
            ...col,
            default: false
        });
    });
}

function loadProducts() {
    state.products = state.currentCard.products || [];
    state.products.sort((a, b) => (a.order || 0) - (b.order || 0));
}

function initializeCalculations() {
    if (window.tableCalculations?.loadSavedCalculations) {
        window.tableCalculations.loadSavedCalculations(state.currentCard);
    }
}

// ----------------------------------------------------------------------------
// SEÇÃO 8: RENDERIZAÇÃO DA TABELA
// ----------------------------------------------------------------------------
function renderTable() {
    renderTableHeader();
    renderTableBody();
    updateEmptyState();
}

function renderTableHeader() {
    elements.tableHeader.innerHTML = '';
    
    state.columns.forEach((column, index) => {
        const th = createTableHeader(column, index);
        elements.tableHeader.appendChild(th);
    });
}

function createTableHeader(column, index) {
    const th = document.createElement('th');
    th.setAttribute('data-column-id', column.id);
    th.setAttribute('data-column-index', index);
    
    if (column.id !== 'actions') {
        th.draggable = true;
        th.style.cursor = 'move';
    }
    
    const headerContent = document.createElement('div');
    headerContent.className = 'header-content';
    
    const title = document.createElement('span');
    title.className = 'column-title';
    title.textContent = column.name;
    headerContent.appendChild(title);
    
    if (!column.default && column.id !== 'actions') {
        const deleteBtn = createHeaderDeleteButton(column);
        headerContent.appendChild(deleteBtn);
    }
    
    th.appendChild(headerContent);
    return th;
}

function createHeaderDeleteButton(column) {
    const actions = document.createElement('div');
    actions.className = 'header-actions';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'header-action-btn';
    deleteBtn.innerHTML = '×';
    deleteBtn.title = 'Excluir coluna';
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        deleteColumn(column.id);
    };
    
    actions.appendChild(deleteBtn);
    return actions;
}

function renderTableBody() {
    elements.tableBody.innerHTML = '';
    const filteredProducts = getFilteredProducts();
    
    filteredProducts.forEach((product, index) => {
        const tr = createTableRow(product, index);
        elements.tableBody.appendChild(tr);
    });
}

function createTableRow(product, index) {
    const tr = document.createElement('tr');
    tr.setAttribute('data-product-id', product.id);
    tr.setAttribute('data-product-index', index);
    tr.draggable = true;
    tr.style.cursor = 'move';
    
    state.columns.forEach(column => {
        const td = document.createElement('td');
        td.setAttribute('data-column-id', column.id);
        td.appendChild(renderCellContent(product, column));
        tr.appendChild(td);
    });
    
    return tr;
}

function renderCellContent(product, column) {
    const container = document.createElement('div');
    const value = product[column.id];
    
    const renderer = getCellRenderer(column.type, column.id);
    renderer(container, value, product);
    
    return container;
}

// ----------------------------------------------------------------------------
// SEÇÃO 9: RENDERIZADORES DE CÉLULA
// ----------------------------------------------------------------------------
const cellRenderers = {
    text: (container, value) => {
        container.textContent = value || CONFIG.EMPTY_TEXT;
        if (!value) applyEmptyStyle(container);
    },
    
    url: (container, value, product) => {
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
            applyEmptyStyle(container);
        }
    },
    
    number: (container, value) => {
        container.className = 'cell-price';
        container.textContent = formatCurrency(value || 0);
    },
    
    image: (container, value, product) => {
        if (value) {
            const img = document.createElement('img');
            img.className = 'cell-image';
            img.src = value;
            img.alt = product.name || 'Produto';
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
    
    date: (container, value) => {
        if (value) {
            const date = new Date(value);
            container.textContent = date.toLocaleDateString('pt-BR');
        } else {
            container.textContent = CONFIG.EMPTY_TEXT;
            applyEmptyStyle(container);
        }
    },
    
    category: (container, value) => {
        const span = document.createElement('span');
        span.className = 'cell-category';
        span.textContent = value || CONFIG.EMPTY_TEXT;
        if (!value) applyEmptyStyle(span);
        container.appendChild(span);
    },
    
    actions: (container, value, product) => {
        const actions = document.createElement('div');
        actions.className = 'row-actions';
        
        const editBtn = document.createElement('button');
        editBtn.className = 'row-action-btn edit';
        editBtn.innerHTML = '✏️';
        editBtn.title = 'Editar';
        editBtn.onclick = () => editProduct(product.id);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'row-action-btn delete';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = 'Excluir';
        deleteBtn.onclick = () => deleteProduct(product.id);
        
        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);
        container.appendChild(actions);
    }
};

function getCellRenderer(type, columnId) {
    // Casos especiais por ID
    if (columnId === 'link') return cellRenderers.url;
    if (columnId === 'price') return cellRenderers.number;
    if (columnId === 'image') return cellRenderers.image;
    if (columnId === 'importance') return cellRenderers.select;
    if (columnId === 'category') return cellRenderers.category;
    if (columnId === 'actions') return cellRenderers.actions;
    
    // Casos por tipo
    return cellRenderers[type] || cellRenderers.text;
}

function applyEmptyStyle(element) {
    element.style.color = '#94a3b8';
    element.style.fontStyle = 'italic';
}

// ----------------------------------------------------------------------------
// SEÇÃO 10: FILTROS
// ----------------------------------------------------------------------------
function getFilteredProducts() {
    let filtered = [...state.products];
    
    const searchTerm = elements.searchInput.value.toLowerCase();
    const categoryFilter = elements.categoryFilter.value;
    const importanceFilter = elements.importanceFilter.value;
    
    if (searchTerm) {
        filtered = filtered.filter(product =>
            ['name', 'store', 'category'].some(field =>
                (product[field] || '').toLowerCase().includes(searchTerm)
            )
        );
    }
    
    if (categoryFilter) {
        filtered = filtered.filter(product => product.category === categoryFilter);
    }
    
    if (importanceFilter) {
        filtered = filtered.filter(product => product.importance === importanceFilter);
    }
    
    return filtered;
}

function updateCategoryFilter() {
    const categories = [...new Set(state.products.map(p => p.category).filter(Boolean))];
    
    elements.categoryFilter.innerHTML = '<option value="">Todas as categorias</option>';
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        elements.categoryFilter.appendChild(option);
    });
}

function handleFiltersChange() {
    try {
        renderTableBody();
        updateEmptyState();
        
        if (window.tableCalculations?.updateTotals) {
            window.tableCalculations.updateTotals();
        }
    } catch (error) {
        console.error('Erro ao aplicar filtros:', error);
        showMessage('Erro ao aplicar filtros', 'error');
    }
}

function updateEmptyState() {
    const hasProducts = getFilteredProducts().length > 0;
    elements.emptyState.classList.toggle('show', !hasProducts);
    elements.productsTable.style.display = hasProducts ? 'table' : 'none';
}

// ----------------------------------------------------------------------------
// SEÇÃO 11: DRAG AND DROP
// ----------------------------------------------------------------------------
function setupDragAndDrop() {
    // Colunas
    elements.tableHeader.addEventListener('dragstart', handleColumnDragStart);
    elements.tableHeader.addEventListener('dragover', handleColumnDragOver);
    elements.tableHeader.addEventListener('drop', handleColumnDrop);
    elements.tableHeader.addEventListener('dragend', handleColumnDragEnd);
    
    // Linhas
    elements.tableBody.addEventListener('dragstart', handleRowDragStart);
    elements.tableBody.addEventListener('dragover', handleRowDragOver);
    elements.tableBody.addEventListener('drop', handleRowDrop);
    elements.tableBody.addEventListener('dragend', handleRowDragEnd);
}

// Drag and Drop de Colunas
function handleColumnDragStart(e) {
    if (e.target.tagName === 'TH' && e.target.getAttribute('data-column-id') !== 'actions') {
        state.draggedElement = e.target;
        state.draggedType = 'column';
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    }
}

function handleColumnDragOver(e) {
    if (state.draggedType === 'column' && e.target.tagName === 'TH') {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        
        if (e.target !== state.draggedElement) {
            e.target.classList.add('drag-over');
        }
    }
}

function handleColumnDrop(e) {
    if (state.draggedType === 'column' && e.target.tagName === 'TH' && e.target !== state.draggedElement) {
        e.preventDefault();
        
        const draggedIndex = parseInt(state.draggedElement.getAttribute('data-column-index'));
        const targetIndex = parseInt(e.target.getAttribute('data-column-index'));
        
        const draggedColumn = state.columns[draggedIndex];
        state.columns.splice(draggedIndex, 1);
        state.columns.splice(targetIndex, 0, draggedColumn);
        
        renderTable();
        saveCardData();
    }
}

function handleColumnDragEnd(e) {
    if (state.draggedType === 'column') {
        e.target.classList.remove('dragging');
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        state.draggedElement = null;
        state.draggedType = null;
    }
}

// Drag and Drop de Linhas
function handleRowDragStart(e) {
    if (e.target.tagName === 'TR') {
        state.draggedElement = e.target;
        state.draggedType = 'row';
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    }
}

function handleRowDragOver(e) {
    if (state.draggedType === 'row') {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        const targetRow = e.target.closest('tr');
        if (targetRow && targetRow !== state.draggedElement) {
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
            targetRow.classList.add('drag-over');
        }
    }
}

function handleRowDrop(e) {
    if (state.draggedType === 'row') {
        e.preventDefault();
        
        const targetRow = e.target.closest('tr');
        if (targetRow && targetRow !== state.draggedElement) {
            reorderProducts(state.draggedElement, targetRow);
        }
    }
}

function handleRowDragEnd(e) {
    if (state.draggedType === 'row') {
        e.target.classList.remove('dragging');
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        state.draggedElement = null;
        state.draggedType = null;
    }
}

function reorderProducts(draggedRow, targetRow) {
    const draggedId = draggedRow.getAttribute('data-product-id');
    const targetId = targetRow.getAttribute('data-product-id');
    
    const draggedIndex = state.products.findIndex(p => p.id === draggedId);
    const targetIndex = state.products.findIndex(p => p.id === targetId);
    
    const draggedProduct = state.products[draggedIndex];
    state.products.splice(draggedIndex, 1);
    state.products.splice(targetIndex, 0, draggedProduct);
    
    state.products.forEach((product, index) => {
        product.order = index;
    });
    
    renderTableBody();
    saveCardData();
}

// ----------------------------------------------------------------------------
// SEÇÃO 12: MODAL DE PRODUTOS
// ----------------------------------------------------------------------------
function openAddProductModal() {
    state.editingProductId = null;
    elements.productModalTitle.textContent = 'Novo Produto';
    generateProductForm();
    showModal(elements.productModal);
}

function editProduct(productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;
    
    state.editingProductId = productId;
    elements.productModalTitle.textContent = 'Editar Produto';
    generateProductForm(product);
    showModal(elements.productModal);
}

function generateProductForm(product = {}) {
    elements.productFormGrid.innerHTML = '';
    
    // Configurar layout do grid
    const totalColumns = state.columns.filter(col => col.id !== 'actions').length;
    elements.productFormGrid.style.gridTemplateColumns = totalColumns >= 9 ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))';
    
    state.columns.forEach(column => {
        if (column.id === 'actions') return;
        
        const formGroup = createFormGroup(column, product);
        elements.productFormGrid.appendChild(formGroup);
    });
}

function createFormGroup(column, product) {
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';
    
    const label = document.createElement('label');
    label.textContent = column.name + (column.required ? ' *' : '');
    label.setAttribute('for', `field_${column.id}`);
    formGroup.appendChild(label);
    
    if (column.type === 'file' && column.id === 'image') {
        const imageField = createImageUploadField(product[column.id]);
        formGroup.appendChild(imageField);
    } else {
        const input = createFormInput(column, product);
        formGroup.appendChild(input);
    }
    
    return formGroup;
}

function createFormInput(column, product) {
    let input;
    
    switch (column.type) {
        case 'select':
            input = createSelectInput(column, product);
            break;
        case 'number':
            input = createNumberInput(column, product);
            break;
        case 'date':
            input = createDateInput(column, product);
            break;
        case 'url':
            input = createUrlInput(column, product);
            break;
        default:
            input = createTextInput(column, product);
    }
    
    input.id = `field_${column.id}`;
    input.name = column.id;
    input.required = column.required;
    
    return input;
}

function createSelectInput(column, product) {
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

function createNumberInput(column, product) {
    const input = document.createElement('input');
    input.type = 'number';
    input.step = '0.01';
    input.min = '0';
    input.value = product[column.id] || '';
    input.placeholder = column.id === 'price' ? '0,00' : '';
    return input;
}

function createDateInput(column, product) {
    const input = document.createElement('input');
    input.type = 'date';
    input.value = product[column.id] || '';
    return input;
}

function createUrlInput(column, product) {
    const input = document.createElement('input');
    input.type = 'url';
    input.value = product[column.id] || '';
    return input;
}

function createTextInput(column, product) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = product[column.id] || '';
    
    // Placeholders específicos
    const placeholders = {
        'name': 'Nome do produto...',
        'store': 'Nome da loja...',
        'category': 'Ex: luz, limpeza, decoração...'
    };
    
    input.placeholder = placeholders[column.id] || '';
    return input;
}

function createImageUploadField(currentImageUrl) {
    const container = document.createElement('div');
    container.style.cssText = 'display: flex; flex-direction: column; gap: 0.75rem;';
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.id = 'field_image';
    input.name = 'image';
    input.style.padding = '0.5rem';
    
    const preview = createImagePreview(input, currentImageUrl);
    
    container.appendChild(input);
    container.appendChild(preview);
    
    return container;
}

function createImagePreview(input, currentImageUrl) {
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
    
    input.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                img.src = e.target.result;
                preview.style.display = 'flex';
                input.style.display = 'none';
            };
            reader.readAsDataURL(file);
        }
    });
    
    return preview;
}

async function handleSaveProduct(e) {
    e.preventDefault();
    
    if (state.isLoading) return;
    
    const productData = await extractProductData();
    if (!productData) return;
    
    if (!validateProductData(productData)) return;
    
    setBtnLoading(elements.saveProductBtn, true);
    setLoading(true);
    
    try {
        if (state.editingProductId) {
            updateProduct(productData);
        } else {
            createProduct(productData);
        }
        
        await saveCardData();
        closeProductModal();
        renderTable();
        showMessage('Produto salvo com sucesso!', 'success');
        
    } catch (error) {
        console.error('Erro ao salvar produto:', error);
        showMessage('Erro ao salvar produto: ' + error.message, 'error');
    } finally {
        setBtnLoading(elements.saveProductBtn, false);
        setLoading(false);
    }
}

async function extractProductData() {
    const formData = new FormData(elements.productForm);
    const productData = {};
    
    for (const column of state.columns) {
        if (column.id === 'actions') continue;
        
        if (column.type === 'file' && column.id === 'image') {
            const imageData = await extractImageData();
            if (imageData === null) return null;
            productData[column.id] = imageData;
        } else {
            productData[column.id] = formData.get(column.id) || '';
        }
    }
    
    return productData;
}

async function extractImageData() {
    const fileInput = document.getElementById('field_image');
    if (!fileInput) return '';
    
    const currentImage = fileInput.getAttribute('data-current-image');
    
    if (fileInput.files?.length > 0) {
        const file = fileInput.files[0];
        
        if (!file.type.startsWith('image/')) {
            showMessage('Apenas imagens são permitidas', 'error');
            return null;
        }
        
        if (file.size > CONFIG.MAX_IMAGE_SIZE) {
            showMessage('Imagem deve ter no máximo 5MB', 'error');
            return null;
        }
        
        try {
            return await fileToBase64(file);
        } catch (error) {
            console.error('Erro ao processar imagem:', error);
            showMessage('Erro ao processar imagem', 'error');
            return null;
        }
    }
    
    return currentImage || '';
}

function validateProductData(productData) {
    if (!productData.name?.trim()) {
        showMessage('Nome do produto é obrigatório', 'error');
        return false;
    }
    return true;
}

function updateProduct(productData) {
    const index = state.products.findIndex(p => p.id === state.editingProductId);
    if (index !== -1) {
        state.products[index] = { ...state.products[index], ...productData };
    }
}

function createProduct(productData) {
    const newProduct = {
        ...productData,
        id: generateUniqueId(),
        order: state.products.length,
        createdAt: new Date().toISOString()
    };
    state.products.push(newProduct);
}

function deleteProduct(productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;
    
    elements.confirmTitle.textContent = 'Excluir Produto';
    elements.confirmMessage.textContent = `Tem certeza que deseja excluir o produto "${product.name}"?`;
    
    elements.confirmDeleteBtn.onclick = async () => {
        setLoading(true);
        
        try {
            const index = state.products.findIndex(p => p.id === productId);
            if (index !== -1) {
                state.products.splice(index, 1);
                state.products.forEach((p, i) => p.order = i);
            }
            
            await saveCardData();
            closeConfirmModal();
            renderTable();
            showMessage('Produto excluído com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao excluir produto:', error);
            showMessage('Erro ao excluir produto', 'error');
        } finally {
            setLoading(false);
        }
    };
    
    showModal(elements.confirmModal);
}

// ----------------------------------------------------------------------------
// SEÇÃO 13: MODAL DE COLUNAS
// ----------------------------------------------------------------------------
function openAddColumnModal() {
    elements.columnForm.reset();
    showModal(elements.columnModal);
}

async function handleSaveColumn(e) {
    e.preventDefault();
    
    if (state.isLoading) return;
    
    const formData = new FormData(elements.columnForm);
    const columnName = formData.get('columnName')?.trim();
    
    if (!validateColumnName(columnName)) return;
    
    setLoading(true);
    
    try {
        const newColumn = createNewColumn(columnName);
        insertColumnBeforeActions(newColumn);
        
        await saveCardData();
        closeColumnModal();
        renderTable();
        showMessage('Coluna criada com sucesso!', 'success');
        
    } catch (error) {
        console.error('Erro ao criar coluna:', error);
        showMessage('Erro ao criar coluna', 'error');
    } finally {
        setLoading(false);
    }
}

function validateColumnName(columnName) {
    if (!columnName) {
        showMessage('Nome da coluna é obrigatório', 'error');
        return false;
    }
    
    if (state.columns.some(col => col.name.toLowerCase() === columnName.toLowerCase())) {
        showMessage('Já existe uma coluna com este nome', 'error');
        return false;
    }
    
    return true;
}

function createNewColumn(columnName) {
    return {
        id: generateUniqueId(),
        name: columnName,
        type: 'text',
        required: false,
        default: false,
        createdAt: new Date().toISOString()
    };
}

function insertColumnBeforeActions(column) {
    const actionsIndex = state.columns.findIndex(col => col.id === 'actions');
    state.columns.splice(actionsIndex, 0, column);
}

async function deleteColumn(columnId) {
    const column = state.columns.find(c => c.id === columnId);
    if (!column || column.default) return;
    
    elements.confirmTitle.textContent = 'Excluir Coluna';
    elements.confirmMessage.textContent = `Tem certeza que deseja excluir a coluna "${column.name}"? Os dados desta coluna em todos os produtos serão perdidos.`;
    
    elements.confirmDeleteBtn.onclick = async () => {
        setLoading(true);
        
        try {
            removeColumn(columnId);
            removeColumnDataFromProducts(columnId);
            
            await saveCardData();
            closeConfirmModal();
            renderTable();
            showMessage('Coluna excluída com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao excluir coluna:', error);
            showMessage('Erro ao excluir coluna', 'error');
        } finally {
            setLoading(false);
        }
    };
    
    showModal(elements.confirmModal);
}

function removeColumn(columnId) {
    const index = state.columns.findIndex(c => c.id === columnId);
    if (index !== -1) {
        state.columns.splice(index, 1);
    }
}

function removeColumnDataFromProducts(columnId) {
    state.products.forEach(product => {
        delete product[columnId];
    });
}

// ----------------------------------------------------------------------------
// SEÇÃO 14: CONTROLE DE MODAIS
// ----------------------------------------------------------------------------
function showModal(modal) {
    modal.classList.add('show');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

function closeProductModal() {
    closeModal(elements.productModal);
    state.editingProductId = null;
}

function closeColumnModal() {
    closeModal(elements.columnModal);
}

function closeConfirmModal() {
    closeModal(elements.confirmModal);
}

// ----------------------------------------------------------------------------
// SEÇÃO 15: PERSISTÊNCIA DE DADOS
// ----------------------------------------------------------------------------
async function saveCardData() {
    try {
        const cleanData = prepareDataForSave();
        
        const cardRef = doc(db, 'cards', state.currentCardId);
        await updateDoc(cardRef, {
            ...cleanData,
            updatedAt: serverTimestamp()
        });
        
        console.log('Dados salvos no Firestore com sucesso');
        
    } catch (error) {
        console.error('Erro ao salvar dados no Firestore:', error);
        throw error;
    }
}

// Substitua a função prepareDataForSave no seu tables_part1.js
// (procure por "function prepareDataForSave()" e substitua por esta versão)

function prepareDataForSave() {
    const customColumns = state.columns
        .filter(col => !col.default && col.id !== 'actions')
        .map(col => removeUndefined({
            id: col.id,
            name: col.name,
            type: col.type,
            required: col.required || false,
            options: col.options || [],
            createdAt: col.createdAt || new Date().toISOString()
        }));
    
    const cleanProducts = state.products.map(product => removeUndefined(product));
    
    // Preparar dados para salvar
    const dataToSave = {
        products: cleanProducts,
        customColumns: customColumns
    };
    
    // IMPORTANTE: Preservar o frete (shippingCost) ao salvar
    if (state.currentCard?.shippingCost !== undefined) {
        dataToSave.shippingCost = state.currentCard.shippingCost;
    }
    
    return dataToSave;
}

function removeUndefined(obj) {
    if (Array.isArray(obj)) {
        return obj.map(item => removeUndefined(item));
    }
    
    if (obj !== null && typeof obj === 'object') {
        const cleaned = {};
        Object.keys(obj).forEach(key => {
            const value = obj[key];
            if (value !== undefined) {
                cleaned[key] = removeUndefined(value);
            }
        });
        return cleaned;
    }
    
    return obj;
}

// ----------------------------------------------------------------------------
// SEÇÃO 16: EVENT LISTENERS
// ----------------------------------------------------------------------------
function setupEventListeners() {
    // Navegação
    elements.backBtn?.addEventListener('click', () => {
        window.location.href = '../card/card.html';
    });
    
    elements.logoutBtn?.addEventListener('click', handleLogout);
    
    // Controles principais
    elements.addProductBtn?.addEventListener('click', openAddProductModal);
    elements.addColumnBtn?.addEventListener('click', openAddColumnModal);
    
    // Filtros
    elements.searchInput?.addEventListener('input', debounce(handleFiltersChange, CONFIG.DEBOUNCE_DELAY));
    elements.categoryFilter?.addEventListener('change', handleFiltersChange);
    elements.importanceFilter?.addEventListener('change', handleFiltersChange);
    
    // Modal de Produto
    elements.closeProductModal?.addEventListener('click', closeProductModal);
    elements.cancelProductBtn?.addEventListener('click', closeProductModal);
    elements.productForm?.addEventListener('submit', handleSaveProduct);
    
    // Modal de Coluna
    elements.closeColumnModal?.addEventListener('click', closeColumnModal);
    elements.cancelColumnBtn?.addEventListener('click', closeColumnModal);
    elements.columnForm?.addEventListener('submit', handleSaveColumn);
    
    // Modal de Confirmação
    elements.confirmCancelBtn?.addEventListener('click', closeConfirmModal);
    
    const confirmCloseBtn = document.getElementById('confirmCloseBtn');
    confirmCloseBtn?.addEventListener('click', closeConfirmModal);
}

// ----------------------------------------------------------------------------
// SEÇÃO 17: FUNÇÕES UTILITÁRIAS
// ----------------------------------------------------------------------------
function createPlaceholderImage(text, size = '40', bgColor = '667eea', textColor = 'white') {
    const svg = `
        <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
            <rect width="${size}" height="${size}" fill="#${bgColor}"/>
            <text x="50%" y="50%" font-family="Arial" font-size="16" 
                  fill="${textColor}" text-anchor="middle" dominant-baseline="middle">
                ${text}
            </text>
        </svg>
    `;
    return 'data:image/svg+xml;base64,' + btoa(svg);
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(file);
    });
}

function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ----------------------------------------------------------------------------
// SEÇÃO 18: CONTROLE DE LOADING
// ----------------------------------------------------------------------------
function setBtnLoading(button, loading) {
    const btnText = button?.querySelector('.btn-text');
    const btnLoading = button?.querySelector('.btn-loading');
    
    if (!button || !btnText || !btnLoading) return;
    
    if (loading) {
        btnText.style.display = 'none';
        btnLoading.style.display = 'inline-flex';
        button.disabled = true;
    } else {
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
        button.disabled = false;
    }
}

function setLoading(loading) {
    state.isLoading = loading;
    elements.loadingOverlay?.classList.toggle('show', loading);
}

// ----------------------------------------------------------------------------
// SEÇÃO 19: SISTEMA DE MENSAGENS
// ----------------------------------------------------------------------------
function showMessage(message, type) {
    removeExistingMessage();
    
    const messageDiv = createMessageElement(message, type);
    document.body.appendChild(messageDiv);
    
    setTimeout(() => removeMessage(messageDiv), 4000);
}

function removeExistingMessage() {
    const existingMessage = document.querySelector('.message');
    if (existingMessage) {
        existingMessage.remove();
    }
}

function createMessageElement(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    
    applyMessageStyles(messageDiv, type);
    
    return messageDiv;
}

function applyMessageStyles(element, type) {
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
        backdrop-filter: blur(10px);
    `;
    
    const backgrounds = {
        success: 'linear-gradient(135deg, #10b981, #059669)',
        error: 'linear-gradient(135deg, #ef4444, #dc2626)',
        info: 'linear-gradient(135deg, #3b82f6, #2563eb)'
    };
    
    element.style.background = backgrounds[type] || backgrounds.info;
}

function removeMessage(messageDiv) {
    if (messageDiv.parentNode) {
        messageDiv.style.animation = 'slideOut 0.3s ease-in-out';
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 300);
    }
}

// ----------------------------------------------------------------------------
// SEÇÃO 20: ESTILOS CSS
// ----------------------------------------------------------------------------
function injectStyles() {
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

injectStyles();

// ----------------------------------------------------------------------------
// SEÇÃO 21: EXPORTAÇÕES GLOBAIS
// ----------------------------------------------------------------------------
window.tablesShared = {
    // Estado
    currentUser: () => state.currentUser,
    currentCard: () => state.currentCard,
    products: () => state.products,
    
    // Elementos DOM
    elements,
    
    // Funções principais
    setLoading,
    showMessage,
    formatCurrency,
    debounce,
    getFilteredProducts,
    renderTable,
    saveCardData,
    
    // Configurações
    config: CONFIG
};
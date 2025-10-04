// TABLES PART 1 


// ----------------------------------------------------------------------------
// IMPORTS
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
// ESTADO GLOBAL
// ----------------------------------------------------------------------------
let currentUser = null;
let currentCardId = null;
let currentCard = null;
let products = [];
let columns = [];
let isLoading = false;
let editingProductId = null;
let draggedElement = null;
let draggedType = null; // 'row' ou 'column'

// ----------------------------------------------------------------------------
// CONFIGURAÇÕES E CONSTANTES
// ----------------------------------------------------------------------------
const EMPTY_TEXT = 'Vazio';
const NO_IMAGE_TEXT = 'Sem imagem';
const IMAGE_ERROR_TEXT = 'Imagem indisponível';
const NO_LINK_TEXT = 'Sem link';
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

// Colunas padrão do sistema
const defaultColumns = [
    { id: 'name', name: 'Nome do produto', type: 'text', required: true, default: true },
    { id: 'price', name: 'Preço', type: 'number', required: true, default: true },
    { id: 'image', name: 'Imagem', type: 'file', required: false, default: true },
    { id: 'link', name: 'Link', type: 'url', required: false, default: true },
    { id: 'store', name: 'Loja', type: 'text', required: false, default: true },
    { id: 'category', name: 'Categoria', type: 'text', required: false, default: true },
    { id: 'descricao', name: 'Descrição do produto', type: 'text', required: false, default: true },
    { id: 'importance', name: 'Importância', type: 'select', required: false, default: true, options: ['Luxo', 'Importante', 'Essencial', 'Futuro'] },
    { id: 'actions', name: 'Ações', type: 'actions', required: false, default: true }
];

// Adicionar na função initializeCalculations() ou setupEventListeners()
document.addEventListener('wheel', function(e) {
    if (document.activeElement.type === 'number') {
        document.activeElement.blur();
    }
});
// ----------------------------------------------------------------------------
// ELEMENTOS DOM
// ----------------------------------------------------------------------------
const elements = {};

// ----------------------------------------------------------------------------
// INICIALIZAÇÃO
// ----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', function() {
    initializeElements();
    getCurrentCardId();
    checkAuthentication();
    setupEventListeners();
    setupDragAndDrop();
});

function initializeElements() {
    const elementIds = [
        'backBtn', 'cardTitle', 'cardSubtitle', 'userPhoto', 'userName', 'logoutBtn',
        'addProductBtn', 'addColumnBtn', 'searchInput', 'categoryFilter', 'importanceFilter',
        'totalProducts', 'totalValue', 'subtotalValue', 'shippingValue', 'grandTotal',
        'productsTable', 'tableHeader', 'tableBody', 'emptyState', 'shippingCost',
        'productModal', 'productModalTitle', 'closeProductModal', 'productForm',
        'productFormGrid', 'cancelProductBtn', 'saveProductBtn',
        'columnModal', 'closeColumnModal', 'columnForm', 'columnName', 'columnType',
        'selectOptions', 'selectOptionsGroup', 'cancelColumnBtn',
        'confirmModal', 'confirmTitle', 'confirmMessage', 'confirmCancelBtn', 'confirmDeleteBtn',
        'loadingOverlay'
    ];
    
    elementIds.forEach(id => {
        elements[id] = document.getElementById(id);
    });
}

function getCurrentCardId() {
    const urlParams = new URLSearchParams(window.location.search);
    currentCardId = urlParams.get('card');
    
    if (!currentCardId) {
        showMessage('Card não especificado', 'error');
        setTimeout(() => {
            window.location.href = '../cards/index.html';
        }, 2000);
        return;
    }
}

// ----------------------------------------------------------------------------
// AUTENTICAÇÃO
// ----------------------------------------------------------------------------
function checkAuthentication() {
    const manualSession = isManualSessionValid();
    if (manualSession) {
        currentUser = {
            type: 'manual',
            username: manualSession.username,
            email: manualSession.username + '@manual.local',
            displayName: manualSession.username,
            photoURL: null
        };
        updateUserInfo();
        loadCardData();
        return;
    }
    
    onAuthChange((user) => {
        if (user && user.email) {
            currentUser = {
                type: 'google',
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || user.email,
                photoURL: user.photoURL
            };
            updateUserInfo();
            loadCardData();
        } else if (!manualSession) {
            window.location.href = '../index.html';
        }
    });
}

function updateUserInfo() {
    if (!currentUser) return;
    
    elements.userName.textContent = currentUser.displayName;
    
    if (currentUser.photoURL) {
        elements.userPhoto.src = currentUser.photoURL;
        elements.userPhoto.onerror = () => {
            const firstLetter = currentUser.displayName.charAt(0).toUpperCase();
            elements.userPhoto.src = createPlaceholderImage(firstLetter);
        };
    } else {
        const firstLetter = currentUser.displayName.charAt(0).toUpperCase();
        elements.userPhoto.src = createPlaceholderImage(firstLetter);
    }
}

async function handleLogout() {
    try {
        setLoading(true);
        clearManualSession();
        
        if (currentUser && currentUser.type === 'google') {
            await signOutUser();
        }
        
        showMessage('Logout realizado com sucesso!', 'success');
        
        setTimeout(() => {
            window.location.href = '../index.html';
        }, 1000);
        
    } catch (error) {
        console.error('Erro no logout:', error);
        showMessage('Erro no logout', 'error');
    } finally {
        setLoading(false);
    }
}

// ----------------------------------------------------------------------------
// CARREGAMENTO DE DADOS
// ----------------------------------------------------------------------------
async function loadCardData() {
    if (!currentUser || !currentCardId) return;
    
    setLoading(true);
    
    try {
        const cardQuery = query(
            collection(db, 'cards'),
            where('__name__', '==', currentCardId)
        );
        const cardSnapshot = await getDocs(cardQuery);
        
        if (cardSnapshot.empty) {
            throw new Error('Card não encontrado');
        }
        
        const cardDoc = cardSnapshot.docs[0];
        currentCard = { id: currentCardId, ...cardDoc.data() };
        
        if (elements.cardTitle) {
            elements.cardTitle.textContent = currentCard.name || 'Card sem nome';
        }
        
        loadInternalData();
        renderTable();
        
        if (window.tableCalculations && window.tableCalculations.loadSavedCalculations) {
            window.tableCalculations.loadSavedCalculations(currentCard);
        }
        
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        showMessage('Erro ao carregar dados: ' + error.message, 'error');
    } finally {
        setLoading(false);
    }
}

function loadInternalData() {
    const customColumns = currentCard.customColumns || [];
    
    columns = [...defaultColumns];
    
    const actionsIndex = columns.findIndex(col => col.id === 'actions');
    customColumns.forEach((col, index) => {
        columns.splice(actionsIndex + index, 0, {
            id: col.id,
            name: col.name,
            type: col.type,
            required: col.required || false,
            default: false,
            options: col.options || []
        });
    });
    
    products = currentCard.products || [];
    products.sort((a, b) => (a.order || 0) - (b.order || 0));
    
    updateCategoryFilter();
}

function updateCategoryFilter() {
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
    
    elements.categoryFilter.innerHTML = '<option value="">Todas as categorias</option>';
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        elements.categoryFilter.appendChild(option);
    });
}

// ----------------------------------------------------------------------------
// RENDERIZAÇÃO DA TABELA
// ----------------------------------------------------------------------------
function renderTable() {
    renderTableHeader();
    renderTableBody();
    updateEmptyState();
}

function renderTableHeader() {
    elements.tableHeader.innerHTML = '';
    
    columns.forEach((column, index) => {
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
            headerContent.appendChild(actions);
        }
        
        th.appendChild(headerContent);
        elements.tableHeader.appendChild(th);
    });
}

function renderTableBody() {
    elements.tableBody.innerHTML = '';
    
    const filteredProducts = getFilteredProducts();
    
    filteredProducts.forEach((product, index) => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-product-id', product.id);
        tr.setAttribute('data-product-index', index);
        tr.draggable = true;
        tr.style.cursor = 'move';
        
        columns.forEach(column => {
            const td = document.createElement('td');
            td.setAttribute('data-column-id', column.id);
            
            const cellContent = renderCellContent(product, column);
            td.appendChild(cellContent);
            
            tr.appendChild(td);
        });
        
        elements.tableBody.appendChild(tr);
    });
}

function renderCellContent(product, column) {
    const container = document.createElement('div');
    const value = product[column.id];
    
    switch (column.type) {
        case 'text':
            container.textContent = value || EMPTY_TEXT;
            if (!value) {
                container.style.color = '#94a3b8';
                container.style.fontStyle = 'italic';
            }
            break;
            
        case 'url':
            if (column.id === 'link') {
                if (value) {
                    const link = document.createElement('a');
                    link.className = 'cell-link';
                    link.href = value;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.textContent = 'Ver produto';
                    container.appendChild(link);
                } else {
                    container.textContent = NO_LINK_TEXT;
                    container.style.color = '#94a3b8';
                    container.style.fontStyle = 'italic';
                }
            } else {
                container.textContent = value || EMPTY_TEXT;
                if (!value) {
                    container.style.color = '#94a3b8';
                    container.style.fontStyle = 'italic';
                }
            }
            break;
            
        case 'number':
            if (column.id === 'price') {
                container.className = 'cell-price';
                container.textContent = formatCurrency(value || 0);
            } else {
                container.textContent = value || EMPTY_TEXT;
                if (!value) {
                    container.style.color = '#94a3b8';
                    container.style.fontStyle = 'italic';
                }
            }
            break;
            
        case 'file':
            if (column.id === 'image') {
                if (value) {
                    const img = document.createElement('img');
                    img.className = 'cell-image';
                    img.src = value;
                    img.alt = product.name || 'Produto';
                    img.onerror = () => {
                        container.innerHTML = `<span style="color: #94a3b8; font-size: 0.85rem; font-style: italic;">${IMAGE_ERROR_TEXT}</span>`;
                    };
                    container.appendChild(img);
                } else {
                    container.innerHTML = `<span style="color: #94a3b8; font-size: 0.85rem; font-style: italic;">${NO_IMAGE_TEXT}</span>`;
                }
            } else {
                container.textContent = value || EMPTY_TEXT;
                if (!value) {
                    container.style.color = '#94a3b8';
                    container.style.fontStyle = 'italic';
                }
            }
            break;
            
        case 'select':
            if (column.id === 'importance') {
                container.className = `cell-importance ${value || ''}`;
                const importanceMap = {
                    'Luxo': '💎 Luxo',
                    'Importante': '🔴 Importante', 
                    'Essencial': '⭐ Essencial',
                    'Futuro': '⏳ Futuro'
                };
                container.innerHTML = importanceMap[value] || `<span style="color: #94a3b8; font-style: italic;">${EMPTY_TEXT}</span>`;
            } else {
                container.textContent = value || EMPTY_TEXT;
                if (!value) {
                    container.style.color = '#94a3b8';
                    container.style.fontStyle = 'italic';
                }
            }
            break;
            
        case 'date':
            if (value) {
                const date = new Date(value);
                container.textContent = date.toLocaleDateString('pt-BR');
            } else {
                container.textContent = EMPTY_TEXT;
                container.style.color = '#94a3b8';
                container.style.fontStyle = 'italic';
            }
            break;
            
        case 'actions':
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
            break;
            
        default:
            if (column.id === 'category') {
                const span = document.createElement('span');
                span.className = 'cell-category';
                span.textContent = value || EMPTY_TEXT;
                if (!value) {
                    span.style.color = '#94a3b8';
                    span.style.fontStyle = 'italic';
                }
                container.appendChild(span);
            } else {
                container.textContent = value || EMPTY_TEXT;
                if (!value) {
                    container.style.color = '#94a3b8';
                    container.style.fontStyle = 'italic';
                }
            }
            break;
    }
    
    return container;
}

function getFilteredProducts() {
    let filtered = [...products];
    
    const searchTerm = elements.searchInput.value.toLowerCase();
    const categoryFilter = elements.categoryFilter.value;
    const importanceFilter = elements.importanceFilter.value;
    
    if (searchTerm) {
        filtered = filtered.filter(product =>
            (product.name || '').toLowerCase().includes(searchTerm) ||
            (product.store || '').toLowerCase().includes(searchTerm) ||
            (product.category || '').toLowerCase().includes(searchTerm)
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

function updateEmptyState() {
    const hasProducts = getFilteredProducts().length > 0;
    elements.emptyState.classList.toggle('show', !hasProducts);
    elements.productsTable.style.display = hasProducts ? 'table' : 'none';
}

// ----------------------------------------------------------------------------
// EVENT LISTENERS
// ----------------------------------------------------------------------------
function setupEventListeners() {
    elements.backBtn.addEventListener('click', () => {
        window.location.href = '../cards/index.html';
    });
    
    elements.logoutBtn.addEventListener('click', handleLogout);
    elements.addProductBtn.addEventListener('click', openAddProductModal);
    elements.addColumnBtn.addEventListener('click', openAddColumnModal);
    elements.searchInput.addEventListener('input', debounce(handleFiltersChange, 300));
    elements.categoryFilter.addEventListener('change', handleFiltersChange);
    elements.importanceFilter.addEventListener('change', handleFiltersChange);
    
    elements.closeProductModal.addEventListener('click', closeProductModal);
    elements.cancelProductBtn.addEventListener('click', closeProductModal);
    elements.productForm.addEventListener('submit', handleSaveProduct);
    
    elements.closeColumnModal.addEventListener('click', closeColumnModal);
    elements.cancelColumnBtn.addEventListener('click', closeColumnModal);
    elements.columnForm.addEventListener('submit', handleSaveColumn);
    
    elements.confirmCancelBtn.addEventListener('click', closeConfirmModal);
    elements.confirmDeleteBtn.addEventListener('click', handleConfirmAction);
    
    // Botão de fechar do modal de confirmação
    const confirmCloseBtn = document.getElementById('confirmCloseBtn');
    if (confirmCloseBtn) {
        confirmCloseBtn.addEventListener('click', closeConfirmModal);
    }
}

function handleFiltersChange() {
    try {
        renderTableBody();
        updateEmptyState();
        if (window.tableCalculations && window.tableCalculations.updateTotals) {
            window.tableCalculations.updateTotals();
        }
    } catch (error) {
        console.error('Erro ao aplicar filtros:', error);
        showMessage('Erro ao aplicar filtros', 'error');
    }
}

// ----------------------------------------------------------------------------
// DRAG AND DROP
// ----------------------------------------------------------------------------
function setupDragAndDrop() {
    elements.tableHeader.addEventListener('dragstart', handleColumnDragStart);
    elements.tableHeader.addEventListener('dragover', handleColumnDragOver);
    elements.tableHeader.addEventListener('drop', handleColumnDrop);
    elements.tableHeader.addEventListener('dragend', handleColumnDragEnd);
    
    elements.tableBody.addEventListener('dragstart', handleRowDragStart);
    elements.tableBody.addEventListener('dragover', handleRowDragOver);
    elements.tableBody.addEventListener('drop', handleRowDrop);
    elements.tableBody.addEventListener('dragend', handleRowDragEnd);
}

function handleColumnDragStart(e) {
    if (e.target.tagName === 'TH' && e.target.getAttribute('data-column-id') !== 'actions') {
        draggedElement = e.target;
        draggedType = 'column';
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    }
}

function handleColumnDragOver(e) {
    if (draggedType === 'column' && e.target.tagName === 'TH') {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        
        if (e.target !== draggedElement) {
            e.target.classList.add('drag-over');
        }
    }
}

function handleColumnDrop(e) {
    if (draggedType === 'column' && e.target.tagName === 'TH' && e.target !== draggedElement) {
        e.preventDefault();
        
        const draggedIndex = parseInt(draggedElement.getAttribute('data-column-index'));
        const targetIndex = parseInt(e.target.getAttribute('data-column-index'));
        
        const draggedColumn = columns[draggedIndex];
        columns.splice(draggedIndex, 1);
        columns.splice(targetIndex, 0, draggedColumn);
        
        renderTable();
        saveCardData();
    }
}

function handleColumnDragEnd(e) {
    if (draggedType === 'column') {
        e.target.classList.remove('dragging');
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        draggedElement = null;
        draggedType = null;
    }
}

function handleRowDragStart(e) {
    if (e.target.tagName === 'TR') {
        draggedElement = e.target;
        draggedType = 'row';
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    }
}

function handleRowDragOver(e) {
    if (draggedType === 'row') {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        const targetRow = e.target.closest('tr');
        if (targetRow && targetRow !== draggedElement) {
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
            targetRow.classList.add('drag-over');
        }
    }
}

function handleRowDrop(e) {
    if (draggedType === 'row') {
        e.preventDefault();
        
        const targetRow = e.target.closest('tr');
        if (targetRow && targetRow !== draggedElement) {
            const draggedId = draggedElement.getAttribute('data-product-id');
            const targetId = targetRow.getAttribute('data-product-id');
            
            const draggedIndex = products.findIndex(p => p.id === draggedId);
            const targetIndex = products.findIndex(p => p.id === targetId);
            
            const draggedProduct = products[draggedIndex];
            products.splice(draggedIndex, 1);
            products.splice(targetIndex, 0, draggedProduct);
            
            products.forEach((product, index) => {
                product.order = index;
            });
            
            renderTableBody();
            saveCardData();
        }
    }
}

function handleRowDragEnd(e) {
    if (draggedType === 'row') {
        e.target.classList.remove('dragging');
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        draggedElement = null;
        draggedType = null;
    }
}

// ----------------------------------------------------------------------------
// MODAIS - PRODUTOS
// ----------------------------------------------------------------------------
function openAddProductModal() {
    editingProductId = null;
    elements.productModalTitle.textContent = 'Novo Produto';
    generateProductForm();
    showModal(elements.productModal);
}

function editProduct(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    editingProductId = productId;
    elements.productModalTitle.textContent = 'Editar Produto';
    generateProductForm(product);
    showModal(elements.productModal);
}

function generateProductForm(product = {}) {
    elements.productFormGrid.innerHTML = '';
    
    // Sempre usar 2 colunas no desktop
    elements.productFormGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
    
    // Contar colunas (excluindo ações)
    const totalColumns = columns.filter(col => col.id !== 'actions').length;
    
    // Se tiver 9 ou mais colunas, usar layout de coluna única
    if (totalColumns >= 9) {
        elements.productFormGrid.style.gridTemplateColumns = '1fr';
    } else {
        elements.productFormGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(250px, 1fr))';
    }
    
    columns.forEach(column => {
        if (column.id === 'actions') return;
        
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        
        const label = document.createElement('label');
        label.textContent = column.name + (column.required ? ' *' : '');
        label.setAttribute('for', `field_${column.id}`);
        
        let input;
        
        switch (column.type) {
            case 'text':
                input = document.createElement('input');
                input.type = 'text';
                input.value = product[column.id] || '';
                break;
                
            case 'number':
                input = document.createElement('input');
                input.type = 'number';
                input.step = '0.01';
                input.min = '0';
                input.value = product[column.id] || '';
                break;
                
            case 'file':
                if (column.id === 'image') {
                    const fileContainer = createImageUploadField(product[column.id]);
                    formGroup.appendChild(label);
                    formGroup.appendChild(fileContainer);
                    elements.productFormGrid.appendChild(formGroup);
                    return;
                } else {
                    input = document.createElement('input');
                    input.type = 'file';
                }
                break;
                
            case 'url':
                input = document.createElement('input');
                input.type = 'url';
                input.value = product[column.id] || '';
                break;
                
            case 'select':
                input = document.createElement('select');
                const options = column.options || [];
                
                const emptyOption = document.createElement('option');
                emptyOption.value = '';
                emptyOption.textContent = 'Selecione...';
                input.appendChild(emptyOption);
                
                options.forEach(option => {
                    const optionEl = document.createElement('option');
                    optionEl.value = option;
                    optionEl.textContent = option;
                    optionEl.selected = product[column.id] === option;
                    input.appendChild(optionEl);
                });
                break;
                
            case 'date':
                input = document.createElement('input');
                input.type = 'date';
                input.value = product[column.id] || '';
                break;
                
            default:
                input = document.createElement('input');
                input.type = 'text';
                input.value = product[column.id] || '';
        }
        
        input.id = `field_${column.id}`;
        input.name = column.id;
        input.required = column.required;
        
        if (column.id === 'name') {
            input.placeholder = 'Nome do produto...';
        } else if (column.id === 'price') {
            input.placeholder = '0,00';
        } else if (column.id === 'store') {
            input.placeholder = 'Nome da loja...';
        } else if (column.id === 'category') {
            input.placeholder = 'Ex: luz, limpeza, decoração...';
        }
        
        formGroup.appendChild(label);
        formGroup.appendChild(input);
        elements.productFormGrid.appendChild(formGroup);
    });
}

function createImageUploadField(currentImageUrl) {
    const fileContainer = document.createElement('div');
    fileContainer.style.display = 'flex';
    fileContainer.style.flexDirection = 'column';
    fileContainer.style.gap = '0.75rem';
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.id = 'field_image';
    input.name = 'image';
    input.style.padding = '0.5rem';
    
    const preview = document.createElement('div');
    preview.id = 'imagePreview';
    preview.style.display = 'none';
    preview.style.alignItems = 'center';
    preview.style.gap = '0.75rem';
    
    const previewImg = document.createElement('img');
    previewImg.style.width = '80px';
    previewImg.style.height = '80px';
    previewImg.style.objectFit = 'cover';
    previewImg.style.borderRadius = '8px';
    previewImg.style.border = '1px solid rgba(51, 65, 85, 0.3)';
    
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = 'Remover';
    removeBtn.className = 'btn btn-secondary';
    removeBtn.style.fontSize = '0.8rem';
    removeBtn.style.padding = '0.5rem 0.75rem';
    
    removeBtn.onclick = () => {
        input.value = '';
        preview.style.display = 'none';
        input.style.display = 'block';
        input.removeAttribute('data-current-image');
    };
    
    preview.appendChild(previewImg);
    preview.appendChild(removeBtn);
    
    if (currentImageUrl) {
        previewImg.src = currentImageUrl;
        preview.style.display = 'flex';
        input.style.display = 'none';
        input.setAttribute('data-current-image', currentImageUrl);
    }
    
    input.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                previewImg.src = e.target.result;
                preview.style.display = 'flex';
                input.style.display = 'none';
            };
            reader.readAsDataURL(file);
        }
    });
    
    fileContainer.appendChild(input);
    fileContainer.appendChild(preview);
    
    return fileContainer;
}

async function handleSaveProduct(e) {
    e.preventDefault();
    
    if (isLoading) return;
    
    const formData = new FormData(elements.productForm);
    const productData = {};
    
    for (const column of columns) {
        if (column.id === 'actions') continue;
        
        if (column.type === 'file' && column.id === 'image') {
            const fileInput = document.getElementById(`field_${column.id}`);
            
            if (!fileInput) {
                productData[column.id] = '';
                continue;
            }
            
            const currentImage = fileInput.getAttribute('data-current-image');
            
            if (fileInput.files && fileInput.files.length > 0 && fileInput.files[0]) {
                try {
                    const file = fileInput.files[0];
                    
                    if (!file.type.startsWith('image/')) {
                        showMessage('Apenas imagens são permitidas', 'error');
                        return;
                    }
                    
                    if (file.size > MAX_IMAGE_SIZE) {
                        showMessage('Imagem deve ter no máximo 5MB', 'error');
                        return;
                    }
                    
                    const base64 = await fileToBase64(file);
                    productData[column.id] = base64;
                } catch (error) {
                    console.error('Erro ao processar imagem:', error);
                    showMessage('Erro ao processar imagem: ' + error.message, 'error');
                    return;
                }
            } else if (currentImage) {
                productData[column.id] = currentImage;
            } else {
                productData[column.id] = '';
            }
        } else {
            productData[column.id] = formData.get(column.id) || '';
        }
    }
    
    if (!productData.name?.trim()) {
        showMessage('Nome do produto é obrigatório', 'error');
        return;
    }
    
    setBtnLoading(elements.saveProductBtn, true);
    setLoading(true);
    
    try {
        if (editingProductId) {
            const index = products.findIndex(p => p.id === editingProductId);
            if (index !== -1) {
                products[index] = { ...products[index], ...productData };
            }
            showMessage('Produto atualizado com sucesso!', 'success');
        } else {
            const newProduct = {
                ...productData,
                id: generateUniqueId(),
                order: products.length,
                createdAt: new Date().toISOString()
            };
            products.push(newProduct);
            showMessage('Produto criado com sucesso!', 'success');
        }
        
        await saveCardData();
        closeProductModal();
        renderTable();
        
    } catch (error) {
        console.error('Erro ao salvar produto:', error);
        showMessage('Erro ao salvar produto: ' + error.message, 'error');
    } finally {
        setBtnLoading(elements.saveProductBtn, false);
        setLoading(false);
    }
}

function deleteProduct(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    elements.confirmTitle.textContent = 'Excluir Produto';
    elements.confirmMessage.textContent = `Tem certeza que deseja excluir o produto "${product.name}"?`;
    
    elements.confirmDeleteBtn.onclick = async () => {
        setLoading(true);
        
        try {
            const index = products.findIndex(p => p.id === productId);
            if (index !== -1) {
                products.splice(index, 1);
            }
            
            products.forEach((product, index) => {
                product.order = index;
            });
            
            await saveCardData();
            closeConfirmModal();
            renderTable();
            showMessage('Produto excluído com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao excluir produto:', error);
            showMessage('Erro ao excluir produto: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };
    
    showModal(elements.confirmModal);
}

// ----------------------------------------------------------------------------
// MODAIS - COLUNAS
// ----------------------------------------------------------------------------
function openAddColumnModal() {
    elements.columnForm.reset();
    showModal(elements.columnModal);
}

async function handleSaveColumn(e) {
    e.preventDefault();
    
    if (isLoading) return;
    
    const formData = new FormData(elements.columnForm);
    const columnName = formData.get('columnName').trim();
    
    if (!columnName) {
        showMessage('Nome da coluna é obrigatório', 'error');
        return;
    }
    
    if (columns.some(col => col.name.toLowerCase() === columnName.toLowerCase())) {
        showMessage('Já existe uma coluna com este nome', 'error');
        return;
    }
    
    setLoading(true);
    
    try {
        const columnData = {
            id: generateUniqueId(),
            name: columnName,
            type: 'custom',
            required: false,
            default: false,
            createdAt: new Date().toISOString()
        };
        
        const actionsIndex = columns.findIndex(col => col.id === 'actions');
        columns.splice(actionsIndex, 0, columnData);
        
        await saveCardData();
        closeColumnModal();
        renderTable();
        showMessage('Coluna criada com sucesso!', 'success');
        
    } catch (error) {
        console.error('Erro ao criar coluna:', error);
        showMessage('Erro ao criar coluna: ' + error.message, 'error');
    } finally {
        setLoading(false);
    }
}

async function deleteColumn(columnId) {
    const column = columns.find(c => c.id === columnId);
    if (!column || column.default) return;
    
    elements.confirmTitle.textContent = 'Excluir Coluna';
    elements.confirmMessage.textContent = `Tem certeza que deseja excluir a coluna "${column.name}"? Os dados desta coluna em todos os produtos serão perdidos.`;
    
    elements.confirmDeleteBtn.onclick = async () => {
        setLoading(true);
        
        try {
            const index = columns.findIndex(c => c.id === columnId);
            if (index !== -1) {
                columns.splice(index, 1);
            }
            
            products.forEach(product => {
                if (product[columnId]) {
                    delete product[columnId];
                }
            });
            
            await saveCardData();
            closeConfirmModal();
            renderTable();
            showMessage('Coluna excluída com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao excluir coluna:', error);
            showMessage('Erro ao excluir coluna: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };
    
    showModal(elements.confirmModal);
}

// ----------------------------------------------------------------------------
// CONTROLE DE MODAIS
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
    editingProductId = null;
}

function closeColumnModal() {
    closeModal(elements.columnModal);
}

function closeConfirmModal() {
    closeModal(elements.confirmModal);
}

function handleConfirmAction() {
    console.log('Ação confirmada');
}

// ----------------------------------------------------------------------------
// PERSISTÊNCIA DE DADOS
// ----------------------------------------------------------------------------
async function saveCardData() {
    try {
        // Função auxiliar para remover undefined recursivamente
        const removeUndefined = (obj) => {
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
        };
        
        // Limpar colunas personalizadas
        const customColumns = columns
            .filter(col => !col.default && col.id !== 'actions')
            .map(col => removeUndefined({
                id: col.id,
                name: col.name,
                type: col.type,
                required: col.required || false,
                options: col.options || [],
                createdAt: col.createdAt || new Date().toISOString()
            }));
        
        // Limpar produtos completamente
        const cleanProducts = products.map(product => removeUndefined(product));
        
        const cardRef = doc(db, 'cards', currentCardId);
        await updateDoc(cardRef, {
            products: cleanProducts,
            customColumns: customColumns,
            updatedAt: serverTimestamp()
        });
        
        console.log('Dados salvos no Firestore com sucesso');
        
    } catch (error) {
        console.error('Erro ao salvar dados no Firestore:', error);
        throw error;
    }
}

// ----------------------------------------------------------------------------
// FUNÇÕES AUXILIARES
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

function setBtnLoading(button, loading) {
    const btnText = button.querySelector('.btn-text');
    const btnLoading = button.querySelector('.btn-loading');
    
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
    isLoading = loading;
    elements.loadingOverlay.classList.toggle('show', loading);
}

function showMessage(message, type) {
    const existingMessage = document.querySelector('.message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    
    messageDiv.style.cssText = `
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
    
    if (type === 'success') {
        messageDiv.style.background = 'linear-gradient(135deg, #10b981, #059669)';
    } else if (type === 'error') {
        messageDiv.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
    } else if (type === 'info') {
        messageDiv.style.background = 'linear-gradient(135deg, #3b82f6, #2563eb)';
    }
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.style.animation = 'slideOut 0.3s ease-in-out';
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.remove();
                }
            }, 300);
        }
    }, 4000);
}

// ----------------------------------------------------------------------------
// ESTILOS PARA MENSAGENS
// ----------------------------------------------------------------------------
const messageStyles = document.createElement('style');
messageStyles.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(messageStyles);

// ----------------------------------------------------------------------------
// EXPORTAÇÕES
// ----------------------------------------------------------------------------
window.tablesShared = {
    currentUser: () => currentUser,
    currentCard: () => currentCard,
    products: () => products,
    elements,
    setLoading,
    showMessage,
    formatCurrency,
    debounce,
    getFilteredProducts,
    renderTable
};
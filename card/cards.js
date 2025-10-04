//cards.js - Atualizado para exibir totais corretos com frete
import { 
    auth, 
    db, 
    onAuthChange, 
    isManualSessionValid, 
    clearManualSession, 
    signOutUser,
    createCard,
    updateCard,
    deleteCard as deleteCardFromDB,
    getUserCards
} from '../firebase.js';

import { 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    where, 
    doc, 
    updateDoc, 
    deleteDoc, 
    orderBy, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

let currentUser = null;
let cards = [];
let isLoading = false;
let editingCardId = null;
let currentImageFile = null;
let currentImageFileName = null;

const cardsContainer = document.getElementById('cardsContainer');
const addCardBtn = document.getElementById('addCardBtn');
const cardModal = document.getElementById('cardModal');
const confirmModal = document.getElementById('confirmModal');
const cardForm = document.getElementById('cardForm');
const closeModal = document.getElementById('closeModal');
const cancelBtn = document.getElementById('cancelBtn');
const saveCardBtn = document.getElementById('saveCardBtn');
const confirmCancelBtn = document.getElementById('confirmCancelBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const userPhoto = document.getElementById('userPhoto');
const userName = document.getElementById('userName');
const logoutBtn = document.getElementById('logoutBtn');
const modalTitle = document.getElementById('modalTitle');
const cardImageInput = document.getElementById('cardImage');
const imagePreview = document.getElementById('imagePreview');
const previewImage = document.getElementById('previewImage');
const uploadPlaceholder = document.getElementById('uploadPlaceholder');
const removeImageBtn = document.getElementById('removeImageBtn');

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

function compressImage(file, maxWidth = 600, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = function() {
            try {
                let { width, height } = img;
                
                if (width > height) {
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxWidth) {
                        width = (width * maxWidth) / height;
                        height = maxWidth;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => {
                    if (blob) {
                        const compressedFile = new File(
                            [blob], 
                            file.name, 
                            { 
                                type: 'image/jpeg',
                                lastModified: Date.now()
                            }
                        );
                        resolve(compressedFile);
                    } else {
                        reject(new Error('Falha na compressão da imagem'));
                    }
                }, 'image/jpeg', quality);
                
            } catch (error) {
                reject(error);
            }
        };
        
        img.onerror = () => {
            reject(new Error('Erro ao carregar imagem'));
        };
        
        img.src = URL.createObjectURL(file);
    });
}

document.addEventListener('DOMContentLoaded', function() {
    checkAuthentication();
    setupEventListeners();
    addModalScrollFix();
});

function addModalScrollFix() {
    const style = document.createElement('style');
    style.textContent = `
        .modal-content {
            max-height: 90vh !important;
            overflow-y: auto !important;
        }
        
        .modal-body {
            max-height: calc(90vh - 200px) !important;
            overflow-y: auto !important;
        }
    `;
    document.head.appendChild(style);
}

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
        loadCards();
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
            loadCards();
        } else if (!manualSession) {
            window.location.href = '../index.html';
        }
    });
}

function updateUserInfo() {
    if (!currentUser) return;
    
    userName.textContent = currentUser.displayName;
    
    if (currentUser.photoURL) {
        userPhoto.src = currentUser.photoURL;
        userPhoto.onerror = () => {
            const firstLetter = currentUser.displayName.charAt(0).toUpperCase();
            userPhoto.src = createPlaceholderImage(firstLetter);
        };
    } else {
        const firstLetter = currentUser.displayName.charAt(0).toUpperCase();
        userPhoto.src = createPlaceholderImage(firstLetter);
    }
}

function setupEventListeners() {
    addCardBtn.addEventListener('click', openCreateModal);
    closeModal.addEventListener('click', closeCardModal);
    cancelBtn.addEventListener('click', closeCardModal);
    cardForm.addEventListener('submit', handleSaveCard);
    logoutBtn.addEventListener('click', handleLogout);
    confirmCancelBtn.addEventListener('click', closeConfirmModal);
    confirmDeleteBtn.addEventListener('click', handleConfirmDelete);
    cardImageInput.addEventListener('change', handleImageSelect);
    removeImageBtn.addEventListener('click', handleRemoveImage);
    
    imagePreview.addEventListener('click', (e) => {
        if (e.target.closest('.remove-image-btn')) {
            return;
        }
        cardImageInput.click();
    });
    
    cardModal.addEventListener('click', function(e) {
        if (e.target === cardModal) closeCardModal();
    });
    
    confirmModal.addEventListener('click', function(e) {
        if (e.target === confirmModal) closeConfirmModal();
    });
}

async function handleImageSelect(event) {
    const file = event.target.files[0];
    
    if (file) {
        if (!file.type.startsWith('image/')) {
            showMessage('Apenas imagens são permitidas', 'error');
            cardImageInput.value = '';
            return;
        }
        
        if (file.size > 10 * 1024 * 1024) {
            showMessage('Imagem deve ter no máximo 10MB', 'error');
            cardImageInput.value = '';
            return;
        }
        
        try {
            const reader = new FileReader();
            reader.onload = function(e) {
                previewImage.src = e.target.result;
                previewImage.style.display = 'block';
                uploadPlaceholder.style.display = 'none';
                imagePreview.classList.add('has-image');
                console.log('Classe has-image adicionada, botão deve aparecer');
            };
            reader.readAsDataURL(file);
            
            showMessage('Processando imagem...', 'info');
            currentImageFile = await compressImage(file, 600, 0.7);
            showMessage('Imagem processada!', 'success');
            
        } catch (error) {
            console.error('Erro ao processar imagem:', error);
            showMessage('Erro ao processar imagem', 'error');
            resetImagePreview();
        }
    }
}

function handleRemoveImage(event) {
    event.stopPropagation();
    currentImageFile = null;
    currentImageFileName = 'REMOVE_IMAGE';
    resetImagePreview();
    showMessage('Imagem removida', 'info');
}

async function loadCards() {
    if (!currentUser) return;
    
    setLoading(true);
    
    try {
        const result = await getUserCards();
        
        if (result.success) {
            cards = result.cards;
            console.log('Cards carregados:', cards.length);
            await calculateCardsStats();
        } else {
            throw new Error(result.error);
        }
        
        renderCards();
        
    } catch (error) {
        console.error('Erro ao carregar cards:', error);
        
        if (error.code === 'permission-denied') {
            showMessage('Erro de permissão. Verifique as regras do Firestore.', 'error');
        } else {
            showMessage('Erro ao carregar cards: ' + error.message, 'error');
        }
        
        renderCards();
    } finally {
        setLoading(false);
    }
}

// NOVA FUNÇÃO: Calcula estatísticas corretas incluindo frete
async function calculateCardsStats() {
    try {
        cards.forEach(card => {
            const products = card.products || [];
            
            // Quantidade de produtos
            const totalProducts = products.length;
            
            // Subtotal (soma dos preços dos produtos)
            const subtotalValue = products.reduce((sum, product) => {
                const price = parseFloat(product.price) || 0;
                return sum + price;
            }, 0);
            
            // Frete (campo salvo no card)
            const shippingCost = parseFloat(card.shippingCost) || 0;
            
            // Total Geral = Subtotal + Frete
            const grandTotal = subtotalValue + shippingCost;
            
            // Salvar estatísticas no card
            card.stats = {
                totalProducts,
                subtotalValue,
                shippingCost,
                grandTotal
            };
        });
        
        console.log('Estatísticas calculadas com frete:', cards.map(c => ({
            name: c.name,
            stats: c.stats
        })));
        
    } catch (error) {
        console.error('Erro ao calcular estatísticas dos cards:', error);
    }
}

function renderCards() {
    const existingCards = cardsContainer.querySelectorAll('.content-card, .no-cards-message');
    existingCards.forEach(card => card.remove());
    
    if (cards.length === 0) {
        const noCardsMessage = document.createElement('div');
        noCardsMessage.className = 'no-cards-message';
        noCardsMessage.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #666; grid-column: 1 / -1;">
                <h3>Nenhum card encontrado</h3>
                <p>Crie seu primeiro card clicando no botão "Novo Card"</p>
            </div>
        `;
        cardsContainer.appendChild(noCardsMessage);
        return;
    }
    
    cards.forEach(card => {
        const cardElement = createCardElement(card);
        cardsContainer.appendChild(cardElement);
    });
}

function createCardElement(card) {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card content-card';
    cardDiv.setAttribute('data-card-id', card.id);
    
    const defaultImageSVG = 'data:image/svg+xml,' + encodeURIComponent(`
        <svg width="200" height="150" xmlns="http://www.w3.org/2000/svg">
            <rect width="200" height="150" fill="#1e293b" fill-opacity="0.5"/>
            <g transform="translate(100, 75)">
                <rect x="-30" y="-25" width="60" height="50" 
                      fill="none" 
                      stroke="#94a3b8" 
                      stroke-opacity="0.4"
                      stroke-width="2" 
                      rx="4"/>
                <circle cx="-15" cy="-12" r="6" 
                        fill="#94a3b8" 
                        fill-opacity="0.4"/>
                <path d="M -30 15 L -15 -5 L 0 10 L 15 -10 L 30 15 Z" 
                      fill="#94a3b8" 
                      fill-opacity="0.4"/>
            </g>
        </svg>
    `);
    
    const cardImage = card.imageUrl && card.imageUrl.trim() ? card.imageUrl : defaultImageSVG;
    
    const createdDate = card.createdAt && card.createdAt.seconds ? 
        new Date(card.createdAt.seconds * 1000).toLocaleDateString('pt-BR') : 
        new Date().toLocaleDateString('pt-BR');
    
    const stats = card.stats || { totalProducts: 0, subtotalValue: 0, shippingCost: 0, grandTotal: 0 };
    
    // Determinar se tem frete
    const hasFrete = stats.shippingCost > 0;
    
    cardDiv.innerHTML = `
        <div class="card-header">
            <h3 class="card-title">${escapeHtml(card.name || 'Card sem nome')}</h3>
            <div class="card-actions">
                <button class="card-action-btn edit-btn" onclick="editCard('${card.id}')" title="Editar">
                    ✏️
                </button>
                <button class="card-action-btn delete-btn" onclick="deleteCard('${card.id}')" title="Excluir">
                    🗑️
                </button>
            </div>
        </div>
        <img src="${cardImage}" alt="${escapeHtml(card.name || 'Card')}" class="card-image" 
             onerror="this.src='${defaultImageSVG}'" loading="lazy">
        <div class="card-description">
            ${card.description ? escapeHtml(card.description) : 'Sem descrição'}
        </div>
        <div class="card-stats-extended">
            <div class="stat-row">
                <span class="stat-label">🛍️ Produtos:</span>
                <span class="stat-value">${stats.totalProducts}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">💰 Subtotal:</span>
                <span class="stat-value">${formatCurrency(stats.subtotalValue)}</span>
            </div>
            ${hasFrete ? `
                <div class="stat-row stat-shipping">
                    <span class="stat-label">📦 Frete:</span>
                    <span class="stat-value">${formatCurrency(stats.shippingCost)}</span>
                </div>
            ` : ''}
            <div class="stat-row stat-total">
                <span class="stat-label">💎 Total Geral:</span>
                <span class="stat-value-grand">${formatCurrency(stats.grandTotal)}</span>
            </div>
        </div>
        <div class="card-footer">
            <span>Criado em ${createdDate}</span>

        </div>
    `;
    
    cardDiv.addEventListener('click', function(e) {
        if (e.target.classList.contains('card-action-btn') || 
            e.target.closest('.card-action-btn') ||
            e.target.classList.contains('btn-table') ||
            e.target.closest('.btn-table')) {
            return;
        }
        
        openTable(card.id);
    });
    
    return cardDiv;
}

window.openTable = function(cardId) {
    window.location.href = `../tabela/tables.html?card=${cardId}`;
};

function openCreateModal() {
    editingCardId = null;
    currentImageFile = null;
    currentImageFileName = null;
    modalTitle.textContent = 'Novo Card';
    cardForm.reset();
    resetImagePreview();
    cardModal.style.display = 'block';
    document.getElementById('cardName').focus();
}

window.editCard = function(cardId) {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;
    
    editingCardId = cardId;
    currentImageFile = null;
    currentImageFileName = card.imageFileName || null;
    modalTitle.textContent = 'Editar Card';
    
    document.getElementById('cardName').value = card.name || '';
    document.getElementById('cardDescription').value = card.description || '';
    
    if (card.imageUrl) {
        previewImage.src = card.imageUrl;
        previewImage.style.display = 'block';
        uploadPlaceholder.style.display = 'none';
        imagePreview.classList.add('has-image');
    } else {
        resetImagePreview();
    }
    
    cardModal.style.display = 'block';
    document.getElementById('cardName').focus();
}

function resetImagePreview() {
    previewImage.src = '';
    previewImage.style.display = 'none';
    uploadPlaceholder.style.display = 'block';
    imagePreview.classList.remove('has-image');
    cardImageInput.value = '';
}

function closeCardModal() {
    cardModal.style.display = 'none';
    editingCardId = null;
    currentImageFile = null;
    currentImageFileName = null;
    cardForm.reset();
    resetImagePreview();
}

function setBtnLoading(loading) {
    const btnText = saveCardBtn.querySelector('.btn-text');
    const btnLoading = saveCardBtn.querySelector('.btn-loading');
    
    if (loading) {
        btnText.style.display = 'none';
        btnLoading.style.display = 'inline-flex';
        saveCardBtn.disabled = true;
    } else {
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
        saveCardBtn.disabled = false;
    }
}

async function handleSaveCard(event) {
    event.preventDefault();
    
    if (isLoading) return;
    
    const formData = new FormData(cardForm);
    const cardName = formData.get('cardName')?.trim();
    const cardDescription = formData.get('cardDescription')?.trim();
    
    if (!cardName) {
        showMessage('Nome do card é obrigatório', 'error');
        return;
    }
    
    if (!currentUser) {
        showMessage('Usuário não autenticado', 'error');
        return;
    }
    
    setBtnLoading(true);
    setLoading(true);
    
    try {
        let result;
        
        if (editingCardId) {
            showMessage('Atualizando card...', 'info');
            
            if (currentImageFileName === 'REMOVE_IMAGE') {
                result = await updateCard(
                    editingCardId,
                    cardName,
                    cardDescription,
                    'DELETE_IMAGE',
                    currentUser.email,
                    null
                );
            } else {
                result = await updateCard(
                    editingCardId,
                    cardName,
                    cardDescription,
                    currentImageFile,
                    currentUser.email,
                    currentImageFileName
                );
            }
        } else {
            showMessage('Criando card...', 'info');
            result = await createCard(
                cardName,
                cardDescription,
                currentImageFile,
                currentUser.email
            );
        }
        
        if (result.success) {
            const action = editingCardId ? 'atualizado' : 'criado';
            showMessage(`Card ${action} com sucesso!`, 'success');
            closeCardModal();
            
            setTimeout(() => {
                loadCards();
            }, 300);
        } else {
            throw new Error(result.error);
        }
        
    } catch (error) {
        console.error('Erro ao salvar card:', error);
        
        if (error.code === 'permission-denied') {
            showMessage('Erro de permissão no Firestore.', 'error');
        } else {
            showMessage('Erro ao salvar card: ' + error.message, 'error');
        }
    } finally {
        setBtnLoading(false);
        setLoading(false);
    }
}

window.deleteCard = function(cardId) {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;
    
    editingCardId = cardId;
    confirmModal.style.display = 'block';
}

function closeConfirmModal() {
    confirmModal.style.display = 'none';
    editingCardId = null;
}

async function handleConfirmDelete() {
    if (!editingCardId) return;
    
    setLoading(true);
    
    try {
        showMessage('Excluindo card...', 'info');
        
        const productsQuery = query(
            collection(db, 'table_products'),
            where('cardId', '==', editingCardId)
        );
        const productsSnapshot = await getDocs(productsQuery);
        
        const deleteProductsPromises = [];
        productsSnapshot.forEach((doc) => {
            deleteProductsPromises.push(deleteDoc(doc.ref));
        });
        
        const columnsQuery = query(
            collection(db, 'table_columns'),
            where('cardId', '==', editingCardId)
        );
        const columnsSnapshot = await getDocs(columnsQuery);
        
        const deleteColumnsPromises = [];
        columnsSnapshot.forEach((doc) => {
            deleteColumnsPromises.push(deleteDoc(doc.ref));
        });
        
        await Promise.all([...deleteProductsPromises, ...deleteColumnsPromises]);
        
        const result = await deleteCardFromDB(editingCardId);
        
        if (result.success) {
            showMessage('Card e todos os dados relacionados foram excluídos!', 'success');
            closeConfirmModal();
            
            setTimeout(() => {
                loadCards();
            }, 300);
        } else {
            throw new Error(result.error);
        }
        
    } catch (error) {
        console.error('Erro ao excluir card:', error);
        
        if (error.code === 'permission-denied') {
            showMessage('Erro de permissão. Verifique as regras do Firestore.', 'error');
        } else {
            showMessage('Erro ao excluir card: ' + error.message, 'error');
        }
    } finally {
        setLoading(false);
    }
}

async function handleLogout() {
    try {
        setLoading(true);
        
        clearManualSession();
        
        if (currentUser && currentUser.type === 'google') {
            await signOutUser();
        }
        
        localStorage.removeItem('lastGoogleLogin');
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

function setLoading(loading) {
    isLoading = loading;
    loadingOverlay.style.display = loading ? 'flex' : 'none';
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
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        animation: slideIn 0.3s ease-in-out;
        max-width: 300px;
        word-wrap: break-word;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    `;
    
    if (type === 'success') {
        messageDiv.style.backgroundColor = '#4CAF50';
    } else if (type === 'error') {
        messageDiv.style.backgroundColor = '#f44336';
    } else if (type === 'info') {
        messageDiv.style.backgroundColor = '#2196F3';
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
    }, 3000);
}

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
}

function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, function(m) { return map[m]; });
}

const style = document.createElement('style');
style.textContent = `
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
    
    .no-cards-message {
        grid-column: 1 / -1;
        order: 2;
    }
    
    .add-card {
        order: 1;
    }
    
    .content-card {
        order: 3;
    }
    
    .cards-container {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 1.5rem;
    }
    
    .card-image {
        transition: opacity 0.3s ease;
    }
    
    .card-image[src=""] {
        opacity: 0;
    }
    
    /* NOVO LAYOUT DE ESTATÍSTICAS */
    .card-stats-extended {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 1rem;
        background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(99, 102, 241, 0.1));
        border-radius: 12px;
        margin: 1rem 0;
        border: 1px solid rgba(59, 130, 246, 0.2);
    }
    
    .stat-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.4rem 0;
        border-bottom: 1px solid rgba(148, 163, 184, 0.1);
    }
    
    .stat-row:last-child {
        border-bottom: none;
    }
    
    .stat-row.stat-shipping {
        color: #f59e0b;
    }
    
    .stat-row.stat-total {
        margin-top: 0.5rem;
        padding-top: 0.75rem;
        border-top: 2px solid rgba(59, 130, 246, 0.3);
        font-weight: 600;
    }
    
    .stat-label {
        font-size: 0.85rem;
        color: #94a3b8;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }
    
    .stat-value {
        font-size: 0.95rem;
        font-weight: 600;
        color: #f8fafc;
    }
    
    .stat-value-grand {
        font-size: 1.1rem;
        font-weight: 700;
        color: #10b981;
        text-shadow: 0 0 10px rgba(16, 185, 129, 0.3);
    }
    
    .btn-table {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        border: none;
        border-radius: 12px;
        cursor: pointer;
        font-size: 0.9rem;
        font-weight: 500;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);
    }
    
    .btn-table:hover {
        background: linear-gradient(135deg, #059669, #047857);
        transform: translateY(-1px);
        box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4);
    }
    
    .btn-table:active {
        transform: translateY(0);
        box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);
    }
    
    .card-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.75rem;
    }
`;
document.head.appendChild(style);
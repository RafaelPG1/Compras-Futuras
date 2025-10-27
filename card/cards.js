// ========================================
// CARDS.JS - VERSÃO OTIMIZADA
// ✅ Skeleton loading enquanto carrega
// ✅ Cache local em memória
// ✅ Renderização paralela
// ========================================

console.log('🚀 Carregando cards.js otimizado...');

import {
  getCards,
  getCardById,
  addCard,
  updateCard,
  deleteCard,
  buscarFrete,
  getAvatarUrl,
  uploadAvatar,
  updateUserAvatar,
  removeAvatar,
  logout as supabaseLogout
} from '../supabase.js';

// ========================================
// CACHE EM MEMÓRIA
// ========================================
const CacheManager = {
  cards: null,
  user: null,
  fretes: {},
  lastCardFetch: null,
  
  setCards(data) {
    this.cards = data;
    this.lastCardFetch = Date.now();
  },
  
  getCards() {
    return this.cards;
  },
  
  isCacheValid() {
    // Cache válido por 30 segundos
    return this.cards && (Date.now() - this.lastCardFetch < 30000);
  },
  
  setFrete(cardId, frete) {
    this.fretes[cardId] = frete;
  },
  
  getFrete(cardId) {
    return this.fretes[cardId];
  }
};

// ========================================
// DOM ELEMENTS
// ========================================
let DOMElements = {};

function initDOMElements() {
  DOMElements = {
    cardsContainer: document.getElementById('cardsContainer'),
    addCardBtn: document.getElementById('addCardBtn'),
    cardModal: document.getElementById('cardModal'),
    confirmModal: document.getElementById('confirmModal'),
    avatarModal: document.getElementById('avatarModal'),
    confirmRemoveAvatarModal: document.getElementById('confirmRemoveAvatarModal'),
    cardForm: document.getElementById('cardForm'),
    closeModal: document.getElementById('closeModal'),
    cancelBtn: document.getElementById('cancelBtn'),
    saveCardBtn: document.getElementById('saveCardBtn'),
    confirmCancelBtn: document.getElementById('confirmCancelBtn'),
    confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    userPhoto: document.getElementById('userPhoto'),
    userName: document.getElementById('userName'),
    logoutBtn: document.getElementById('logoutBtn'),
    modalTitle: document.getElementById('modalTitle'),
    cardImageInput: document.getElementById('cardImage'),
    imagePreview: document.getElementById('imagePreview'),
    previewImage: document.getElementById('previewImage'),
    uploadPlaceholder: document.getElementById('uploadPlaceholder'),
    removeImageBtn: document.getElementById('removeImageBtn'),
    userAvatarContainer: document.getElementById('userAvatarContainer'),
    closeAvatarModal: document.getElementById('closeAvatarModal'),
    avatarPreview: document.getElementById('avatarPreview'),
    avatarPreviewImage: document.getElementById('avatarPreviewImage'),
    avatarPlaceholder: document.getElementById('avatarPlaceholder'),
    avatarFileInput: document.getElementById('avatarFileInput'),
    uploadAvatarBtn: document.getElementById('uploadAvatarBtn'),
    removeAvatarBtn: document.getElementById('removeAvatarBtn'),
    cancelRemoveAvatarBtn: document.getElementById('cancelRemoveAvatarBtn'),
    confirmRemoveAvatarBtn: document.getElementById('confirmRemoveAvatarBtn')
  };
  
  console.log('✅ DOM Elements inicializados');
}

// ========================================
// SKELETON LOADER
// ========================================
const SkeletonManager = {
  createCardSkeleton() {
    const skeleton = document.createElement('div');
    skeleton.className = 'card skeleton-card';
    skeleton.innerHTML = `
      <div class="card-header">
        <div class="skeleton-line skeleton-title"></div>
      </div>
      <div class="skeleton-image"></div>
      <div class="skeleton-line skeleton-description"></div>
      <div class="skeleton-stats">
        <div class="skeleton-stat-line"></div>
        <div class="skeleton-stat-line"></div>
        <div class="skeleton-stat-line"></div>
        <div class="skeleton-stat-line"></div>
      </div>
      <div class="skeleton-footer"></div>
    `;
    return skeleton;
  },

  renderSkeletons(count = 1) {
    const container = DOMElements.cardsContainer;
    
    // Remove apenas skeletons antigos
    const oldSkeletons = container.querySelectorAll('.skeleton-card');
    oldSkeletons.forEach(s => s.remove());
    
    // Renderiza apenas 1 skeleton de carregamento
    container.appendChild(this.createCardSkeleton());
    
    console.log('📦 Skeleton card de carregamento renderizado');
  },

  removeSkeletons() {
    const skeletons = DOMElements.cardsContainer.querySelectorAll('.skeleton-card');
    skeletons.forEach(s => s.remove());
  }
};

// ========================================
// APP STATE
// ========================================
const AppState = {
  cards: [],
  editingCardId: null,
  currentImageFile: null,
  currentUser: null,
  cardFretes: {},
  currentAvatarUrl: null,
  isLoadingCards: false
};

// ========================================
// USER CONTROLLER
// ========================================
const UserController = {
  async loadUserData() {
    const sessionUser = sessionStorage.getItem('userName');
    const sessionPhoto = sessionStorage.getItem('userPhoto');
    const localUser = localStorage.getItem('userName');
    const localPhoto = localStorage.getItem('userPhoto');
    
    const userName = sessionUser || localUser || 'Rafael';
    const userPhoto = sessionPhoto || localPhoto || null;
    
    AppState.currentUser = {
      name: userName,
      photo: userPhoto
    };
    
    CacheManager.user = AppState.currentUser;
    
    this.updateUserInterface();
    
    // Buscar avatar real em background (não bloqueia UI)
    this.loadAvatarAsync();
  },

  async loadAvatarAsync() {
    try {
      const result = await getAvatarUrl();
      if (result.success && result.imageUrl) {
        AppState.currentUser.photo = result.imageUrl;
        AppState.currentAvatarUrl = result.imageUrl;
        this.updateUserInterface();
      }
    } catch (error) {
      console.error('❌ Erro ao carregar avatar:', error);
    }
  },
  
  updateUserInterface() {
    if (DOMElements.userName) {
      DOMElements.userName.textContent = AppState.currentUser.name;
    }
    
    if (DOMElements.userPhoto) {
      if (AppState.currentUser.photo) {
        DOMElements.userPhoto.src = AppState.currentUser.photo;
      } else {
        const initial = AppState.currentUser.name.charAt(0).toUpperCase();
        DOMElements.userPhoto.src = Utils.createPlaceholderImage(initial);
      }
    }
  },
  
  logout() {
    sessionStorage.clear();
    localStorage.removeItem('userName');
    localStorage.removeItem('userPhoto');
    supabaseLogout();
    Utils.showMessage('Logout realizado!', 'success');
    setTimeout(() => window.location.href = '../index.html', 1000);
  }
};

// ========================================
// UTILITÁRIOS
// ========================================
const Utils = {
  createPlaceholderImage(text) {
    const svg = `
      <svg width="50" height="50" xmlns="http://www.w3.org/2000/svg">
        <rect width="50" height="50" fill="#667eea"/>
        <text x="50%" y="50%" font-family="Arial" font-size="20" 
              fill="white" text-anchor="middle" dominant-baseline="middle">
          ${text}
        </text>
      </svg>
    `;
    return 'data:image/svg+xml;base64,' + btoa(svg);
  },

  showMessage(message, type) {
    const existingMessage = document.querySelector('.message');
    if (existingMessage) existingMessage.remove();
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    
    const colors = {
      success: '#4CAF50',
      error: '#f44336',
      info: '#2196F3'
    };
    
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
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
      background-color: ${colors[type] || '#2196F3'};
    `;
    
    document.body.appendChild(messageDiv);
    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.style.animation = 'slideOut 0.3s ease-in-out';
        setTimeout(() => messageDiv.remove(), 300);
      }
    }, 3000);
  },
  
  showLoading(show) {
    if (DOMElements.loadingOverlay) {
      DOMElements.loadingOverlay.style.display = show ? 'flex' : 'none';
    }
  },

  formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  },

  normalizeName(name) {
    return name
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
};

// ========================================
// MODAL CONTROLLER
// ========================================
const ModalController = {
  open(modalElement) {
    if (modalElement) {
      modalElement.classList.add('modal-active');
    }
  },

  close(modalElement) {
    if (modalElement) {
      modalElement.classList.remove('modal-active');
    }
  },

  openCardModal() {
    AppState.editingCardId = null;
    AppState.currentImageFile = null;
    
    if (DOMElements.modalTitle) {
      DOMElements.modalTitle.innerHTML = '<i class="fas fa-plus-circle"></i> Novo Card';
    }
    
    if (DOMElements.cardForm) {
      DOMElements.cardForm.reset();
    }
    
    ImageController.resetPreview();
    this.open(DOMElements.cardModal);
    
    setTimeout(() => {
      const nameInput = document.getElementById('cardName');
      if (nameInput) nameInput.focus();
    }, 100);
  },

  closeCardModal() {
    this.close(DOMElements.cardModal);
    AppState.editingCardId = null;
    AppState.currentImageFile = null;
    if (DOMElements.cardForm) DOMElements.cardForm.reset();
    ImageController.resetPreview();
  },

  openConfirmModal() {
    this.open(DOMElements.confirmModal);
  },

  closeConfirmModal() {
    this.close(DOMElements.confirmModal);
    AppState.editingCardId = null;
  }
};

// ========================================
// IMAGE CONTROLLER
// ========================================
const ImageController = {
  handleSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      Utils.showMessage('Apenas imagens são permitidas', 'error');
      DOMElements.cardImageInput.value = '';
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      Utils.showMessage('Imagem deve ter no máximo 5MB', 'error');
      DOMElements.cardImageInput.value = '';
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      DOMElements.previewImage.src = e.target.result;
      DOMElements.previewImage.style.display = 'block';
      DOMElements.uploadPlaceholder.style.display = 'none';
      DOMElements.imagePreview.classList.add('has-image');
      AppState.currentImageFile = e.target.result;
    };
    reader.readAsDataURL(file);
    Utils.showMessage('Imagem carregada!', 'success');
  },

  handleRemove(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    AppState.currentImageFile = null;
    this.resetPreview();
    Utils.showMessage('Imagem removida', 'info');
  },

  resetPreview() {
    if (DOMElements.previewImage) {
      DOMElements.previewImage.src = '';
      DOMElements.previewImage.style.display = 'none';
    }
    if (DOMElements.uploadPlaceholder) {
      DOMElements.uploadPlaceholder.style.display = 'block';
    }
    if (DOMElements.imagePreview) {
      DOMElements.imagePreview.classList.remove('has-image');
    }
    if (DOMElements.cardImageInput) {
      DOMElements.cardImageInput.value = '';
    }
  }
};

// ========================================
// TABELAS INTEGRATION
// ========================================
const TablesIntegration = {
  getTableUrl(card) {
    const encodedName = encodeURIComponent(card.name);
    return `../tabela/tables.html?id=${card.id}&name=${encodedName}`;
  },

  async getFreteByCardId(cardId) {
    const cached = CacheManager.getFrete(cardId);
    if (cached !== undefined) {
      return cached;
    }

    try {
      const result = await buscarFrete(cardId);
      const frete = result.success ? (result.frete || 0) : 0;
      CacheManager.setFrete(cardId, frete);
      return frete;
    } catch (error) {
      console.error('Erro ao buscar frete:', error);
      CacheManager.setFrete(cardId, 0);
      return 0;
    }
  }
};

// ========================================
// CARD VALIDATOR
// ========================================
const CardValidator = {
  isDuplicateName(cardName, excludeCardId = null) {
    const normalizedName = Utils.normalizeName(cardName);
    return AppState.cards.some(card => {
      if (excludeCardId && card.id === excludeCardId) return false;
      return Utils.normalizeName(card.name) === normalizedName;
    });
  },

  validateCardData(cardName, isEditing = false, editingCardId = null) {
    if (!cardName || !cardName.trim()) {
      Utils.showMessage('Nome do card é obrigatório', 'error');
      return false;
    }

    if (this.isDuplicateName(cardName, editingCardId)) {
      Utils.showMessage('Já existe um card com esse nome', 'error');
      return false;
    }

    return true;
  }
};

// ========================================
// CARD CONTROLLER - OTIMIZADO
// ========================================
const CardController = {
  async loadCards() {
    if (AppState.isLoadingCards) return;
    
    AppState.isLoadingCards = true;
    
    // Se temos cache válido, usar direto (sem skeleton)
    if (CacheManager.isCacheValid()) {
      console.log('💾 Usando cache de cards');
      AppState.cards = CacheManager.getCards();
      await this.renderCards();
      AppState.isLoadingCards = false;
      return;
    }

    // Mostrar skeleton enquanto carrega
    SkeletonManager.renderSkeletons();

    try {
      const result = await getCards();
      
      if (!result.success) {
        Utils.showMessage(result.error || 'Erro ao carregar cards', 'error');
        AppState.cards = [];
      } else {
        AppState.cards = result.data || [];
        CacheManager.setCards(AppState.cards);
        console.log(`✅ ${AppState.cards.length} cards carregados`);
      }
      
      SkeletonManager.removeSkeletons();
      await this.renderCards();
      
    } catch (error) {
      console.error('Erro ao carregar cards:', error);
      Utils.showMessage('Erro ao conectar com servidor', 'error');
      AppState.cards = [];
      SkeletonManager.removeSkeletons();
      this.renderCards();
    } finally {
      AppState.isLoadingCards = false;
    }
  },

  async renderCards() {
    const existingCards = DOMElements.cardsContainer.querySelectorAll('.content-card');
    existingCards.forEach(card => card.remove());
    
    if (AppState.cards.length === 0) {
      console.log('ℹ️ Nenhum card para exibir');
      return;
    }
    
    // Renderizar cards em paralelo (não bloqueia)
    const cardPromises = AppState.cards.map(card => this.createCardElement(card));
    const cardElements = await Promise.all(cardPromises);
    
    cardElements.forEach(el => DOMElements.cardsContainer.appendChild(el));
    console.log('✅ Cards renderizados:', AppState.cards.length);
  },

  async createCardElement(card) {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card content-card';
    
    const hasImage = card.image_url && card.image_url.trim();
    const imageHTML = hasImage 
      ? `<img src="${card.image_url}" alt="${card.name}" class="card-image">` 
      : `<div class="card-image-placeholder">
          <svg width="120" height="120" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
            <rect width="120" height="120" fill="#1e293b" fill-opacity="0.3" rx="8"/>
            <g transform="translate(60, 60)">
              <rect x="-35" y="-28" width="70" height="56" fill="none" stroke="#94a3b8" stroke-opacity="0.5" stroke-width="2.5" rx="6"/>
              <circle cx="-18" cy="-12" r="8" fill="#94a3b8" fill-opacity="0.5"/>
              <path d="M -35 20 L -18 -8 L 0 12 L 20 -12 L 35 20 Z" fill="#94a3b8" fill-opacity="0.5"/>
            </g>
          </svg>
          <span>Sem imagem</span>
        </div>`;
    
    const subtotal = card.valor_total || 0;
    const frete = await TablesIntegration.getFreteByCardId(card.id);
    const totalGeral = subtotal + frete;
    
    cardDiv.innerHTML = `
      <div class="card-header">
        <h3 class="card-title">${card.name}</h3>
        <div class="card-actions">
          <button class="card-action-btn edit-btn" title="Editar">✏️</button>
          <button class="card-action-btn delete-btn" title="Excluir">🗑️</button>
        </div>
      </div>
      ${imageHTML}
      <p class="card-description">${card.description || 'Sem descrição'}</p>
      <div class="card-stats-extended">
        <div class="stat-row">
          <span class="stat-label">🛍️ Produtos:</span>
          <span class="stat-value">${card.quantidade_produtos || 0}</span>
        </div>
        <div class="stat-row stat-total">
          <span class="stat-label">💎 Total:</span>
          <span class="stat-value-grand">${Utils.formatCurrency(totalGeral)}</span>
        </div>
      </div>
      <div class="card-footer">
        <span>Criado em ${new Date(card.created_at).toLocaleDateString('pt-BR')}</span>
      </div>
    `;
    
    cardDiv.addEventListener('click', (e) => {
      if (!e.target.closest('.card-action-btn')) {
        window.location.href = TablesIntegration.getTableUrl(card);
      }
    });
    
    cardDiv.querySelector('.edit-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleEdit(card.id);
    });
    
    cardDiv.querySelector('.delete-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleDelete(card.id);
    });
    
    return cardDiv;
  },

  async handleEdit(cardId) {
    Utils.showLoading(true);
    try {
      const result = await getCardById(cardId);
      if (!result.success) {
        Utils.showMessage(result.error || 'Card não encontrado', 'error');
        return;
      }
      
      const card = result.data;
      AppState.editingCardId = cardId;
      
      DOMElements.modalTitle.innerHTML = '<i class="fas fa-edit"></i> Editar Card';
      document.getElementById('cardName').value = card.name;
      document.getElementById('cardDescription').value = card.description || '';
      
      if (card.image_url) {
        DOMElements.previewImage.src = card.image_url;
        DOMElements.previewImage.style.display = 'block';
        DOMElements.uploadPlaceholder.style.display = 'none';
        DOMElements.imagePreview.classList.add('has-image');
        AppState.currentImageFile = card.image_url;
      }
      
      ModalController.open(DOMElements.cardModal);
    } catch (error) {
      console.error('Erro ao buscar card:', error);
      Utils.showMessage('Erro ao carregar card', 'error');
    } finally {
      Utils.showLoading(false);
    }
  },

  handleDelete(cardId) {
    AppState.editingCardId = cardId;
    ModalController.openConfirmModal();
  },

  async handleSave(event) {
    event.preventDefault();
    
    const formData = new FormData(DOMElements.cardForm);
    const cardName = formData.get('cardName')?.trim();
    const cardDescription = formData.get('cardDescription')?.trim();
    
    const isEditing = AppState.editingCardId !== null;
    
    if (!CardValidator.validateCardData(cardName, isEditing, AppState.editingCardId)) {
      return;
    }
    
    Utils.showLoading(true);
    
    try {
      let result;
      
      if (isEditing) {
        result = await updateCard(AppState.editingCardId, {
          name: cardName,
          description: cardDescription,
          image_url: AppState.currentImageFile
        });
        if (result.success) Utils.showMessage('Card atualizado!', 'success');
      } else {
        result = await addCard(cardName, cardDescription, AppState.currentImageFile);
        if (result.success) Utils.showMessage('Card criado com sucesso!', 'success');
      }
      
      if (!result.success) {
        Utils.showMessage(result.error || 'Erro ao salvar card', 'error');
        return;
      }
      
      CacheManager.cards = null; // Invalidar cache
      await this.loadCards();
      ModalController.closeCardModal();
      
    } catch (error) {
      console.error('Erro ao salvar card:', error);
      Utils.showMessage('Erro ao conectar com servidor', 'error');
    } finally {
      Utils.showLoading(false);
    }
  },

  async confirmDelete() {
    if (!AppState.editingCardId) return;
    
    const cardId = AppState.editingCardId;
    Utils.showLoading(true);
    
    try {
      const result = await deleteCard(cardId);
      if (!result.success) {
        Utils.showMessage(result.error || 'Erro ao deletar card', 'error');
        return;
      }
      
      Utils.showMessage('Card excluído com sucesso!', 'success');
      CacheManager.cards = null;
      await this.loadCards();
      ModalController.closeConfirmModal();
    } catch (error) {
      console.error('Erro ao deletar card:', error);
      Utils.showMessage('Erro ao conectar com servidor', 'error');
    } finally {
      Utils.showLoading(false);
    }
  }
};

// ========================================
// AVATAR CONTROLLER
// ========================================
const AvatarController = {
  async openAvatarModal() {
    const result = await getAvatarUrl();
    
    if (result.success && result.imageUrl) {
      AppState.currentAvatarUrl = result.imageUrl;
      DOMElements.avatarPreviewImage.src = result.imageUrl;
      DOMElements.avatarPreviewImage.style.display = 'block';
      DOMElements.avatarPlaceholder.style.display = 'none';
      DOMElements.removeAvatarBtn.disabled = false;
    } else {
      AppState.currentAvatarUrl = null;
      DOMElements.avatarPreviewImage.style.display = 'none';
      DOMElements.avatarPlaceholder.style.display = 'flex';
      DOMElements.removeAvatarBtn.disabled = true;
    }
    
    ModalController.open(DOMElements.avatarModal);
  },

  closeAvatarModal() {
    ModalController.close(DOMElements.avatarModal);
    DOMElements.avatarFileInput.value = '';
  },

  selectFile() {
    DOMElements.avatarFileInput.click();
  },

  async handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      Utils.showMessage('Apenas imagens são permitidas', 'error');
      DOMElements.avatarFileInput.value = '';
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      Utils.showMessage('Imagem deve ter no máximo 5MB', 'error');
      DOMElements.avatarFileInput.value = '';
      return;
    }
    
    Utils.showLoading(true);
    
    try {
      const uploadResult = await uploadAvatar(file);
      if (!uploadResult.success) {
        Utils.showMessage(uploadResult.error || 'Erro ao processar imagem', 'error');
        return;
      }
      
      const updateResult = await updateUserAvatar(uploadResult.imageBase64);
      if (!updateResult.success) {
        Utils.showMessage(updateResult.error || 'Erro ao salvar imagem', 'error');
        return;
      }
      
      AppState.currentAvatarUrl = uploadResult.imageBase64;
      AppState.currentUser.photo = uploadResult.imageBase64;
      
      DOMElements.avatarPreviewImage.src = uploadResult.imageBase64;
      DOMElements.avatarPreviewImage.style.display = 'block';
      DOMElements.avatarPlaceholder.style.display = 'none';
      DOMElements.removeAvatarBtn.disabled = false;
      
      UserController.updateUserInterface();
      Utils.showMessage('Imagem de perfil atualizada!', 'success');
      
    } catch (error) {
      console.error('Erro ao processar avatar:', error);
      Utils.showMessage('Erro ao processar imagem', 'error');
    } finally {
      Utils.showLoading(false);
      DOMElements.avatarFileInput.value = '';
    }
  },

  openRemoveConfirmation() {
    if (!AppState.currentAvatarUrl) {
      Utils.showMessage('Nenhuma imagem para remover', 'info');
      return;
    }
    ModalController.open(DOMElements.confirmRemoveAvatarModal);
  },

  closeRemoveConfirmation() {
    ModalController.close(DOMElements.confirmRemoveAvatarModal);
  },

  async handleRemove() {
    Utils.showLoading(true);
    
    try {
      const result = await removeAvatar();
      if (!result.success) {
        Utils.showMessage(result.error || 'Erro ao remover imagem', 'error');
        return;
      }
      
      AppState.currentAvatarUrl = null;
      AppState.currentUser.photo = null;
      
      DOMElements.avatarPreviewImage.style.display = 'none';
      DOMElements.avatarPlaceholder.style.display = 'flex';
      DOMElements.removeAvatarBtn.disabled = true;
      
      UserController.updateUserInterface();
      this.closeRemoveConfirmation();
      Utils.showMessage('Imagem de perfil removida', 'success');
      
    } catch (error) {
      console.error('Erro ao remover avatar:', error);
      Utils.showMessage('Erro ao remover imagem', 'error');
    } finally {
      Utils.showLoading(false);
    }
  }
};

// ========================================
// EVENT LISTENERS
// ========================================
function setupEventListeners() {
  if (DOMElements.addCardBtn) {
    DOMElements.addCardBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      ModalController.openCardModal();
    });
  }
  
  if (DOMElements.closeModal) {
    DOMElements.closeModal.addEventListener('click', () => ModalController.closeCardModal());
  }
  
  if (DOMElements.cancelBtn) {
    DOMElements.cancelBtn.addEventListener('click', () => ModalController.closeCardModal());
  }
  
  if (DOMElements.confirmCancelBtn) {
    DOMElements.confirmCancelBtn.addEventListener('click', () => ModalController.closeConfirmModal());
  }
  
  if (DOMElements.cardForm) {
    DOMElements.cardForm.addEventListener('submit', (e) => CardController.handleSave(e));
  }
  
  if (DOMElements.confirmDeleteBtn) {
    DOMElements.confirmDeleteBtn.addEventListener('click', () => CardController.confirmDelete());
  }
  
  if (DOMElements.logoutBtn) {
    DOMElements.logoutBtn.addEventListener('click', () => UserController.logout());
  }
  
  if (DOMElements.cardImageInput) {
    DOMElements.cardImageInput.addEventListener('change', (e) => ImageController.handleSelect(e));
  }
  
  if (DOMElements.removeImageBtn) {
    DOMElements.removeImageBtn.addEventListener('click', (e) => ImageController.handleRemove(e));
  }
  
  if (DOMElements.imagePreview) {
    DOMElements.imagePreview.addEventListener('click', (e) => {
      if (!e.target.closest('.remove-image-btn')) {
        DOMElements.cardImageInput.click();
      }
    });
  }
  
  if (DOMElements.cardModal) {
    DOMElements.cardModal.addEventListener('click', (e) => {
      if (e.target === DOMElements.cardModal) {
        ModalController.closeCardModal();
      }
    });
  }
  
  if (DOMElements.confirmModal) {
    DOMElements.confirmModal.addEventListener('click', (e) => {
      if (e.target === DOMElements.confirmModal) {
        ModalController.closeConfirmModal();
      }
    });
  }
  
  // Avatar events
  if (DOMElements.userAvatarContainer) {
    DOMElements.userAvatarContainer.addEventListener('click', () => {
      AvatarController.openAvatarModal();
    });
  }
  
  if (DOMElements.closeAvatarModal) {
    DOMElements.closeAvatarModal.addEventListener('click', () => {
      AvatarController.closeAvatarModal();
    });
  }
  
  if (DOMElements.uploadAvatarBtn) {
    DOMElements.uploadAvatarBtn.addEventListener('click', () => {
      AvatarController.selectFile();
    });
  }
  
  if (DOMElements.avatarFileInput) {
    DOMElements.avatarFileInput.addEventListener('change', (e) => {
      AvatarController.handleFileSelect(e);
    });
  }
  
  if (DOMElements.removeAvatarBtn) {
    DOMElements.removeAvatarBtn.addEventListener('click', () => {
      AvatarController.openRemoveConfirmation();
    });
  }
  
  if (DOMElements.cancelRemoveAvatarBtn) {
    DOMElements.cancelRemoveAvatarBtn.addEventListener('click', () => {
      AvatarController.closeRemoveConfirmation();
    });
  }
  
  if (DOMElements.confirmRemoveAvatarBtn) {
    DOMElements.confirmRemoveAvatarBtn.addEventListener('click', () => {
      AvatarController.handleRemove();
    });
  }
  
  if (DOMElements.avatarModal) {
    DOMElements.avatarModal.addEventListener('click', (e) => {
      if (e.target === DOMElements.avatarModal) {
        AvatarController.closeAvatarModal();
      }
    });
  }
  
  if (DOMElements.confirmRemoveAvatarModal) {
    DOMElements.confirmRemoveAvatarModal.addEventListener('click', (e) => {
      if (e.target === DOMElements.confirmRemoveAvatarModal) {
        AvatarController.closeRemoveConfirmation();
      }
    });
  }
  
  console.log('✅ Event listeners configurados');
}

// ========================================
// INICIALIZAÇÃO
// ========================================
document.addEventListener('DOMContentLoaded', async function() {
  console.log('🚀 DOM carregado!');
  
  initDOMElements();
  
  // Carregar dados em paralelo
  UserController.loadUserData();
  setupEventListeners();
  CardController.loadCards();
  
  console.log('✅ Aplicação inicializada com sucesso!');
});

// ========================================
// ESTILOS CSS PARA SKELETON
// ========================================
const skeletonStyle = document.createElement('style');
skeletonStyle.textContent = `
  .skeleton-card {
    pointer-events: none !important;
  }
  
  .skeleton-line {
    background: linear-gradient(90deg, 
      rgba(71, 85, 105, 0.3), 
      rgba(148, 163, 184, 0.4), 
      rgba(71, 85, 105, 0.3)
    );
    background-size: 200% 100%;
    animation: skeleton-loading 1.5s infinite;
    border-radius: 8px;
  }
  
  .skeleton-title {
    height: 24px;
    width: 60%;
    margin-bottom: 8px;
  }
  
  .skeleton-description {
    height: 16px;
    width: 100%;
    margin-bottom: 12px;
  }
  
  .skeleton-image {
    width: calc(100% - 40px);
    height: 140px;
    margin: 0 20px 16px;
    border-radius: 14px;
    background: linear-gradient(90deg, 
      rgba(71, 85, 105, 0.2), 
      rgba(148, 163, 184, 0.3), 
      rgba(71, 85, 105, 0.2)
    );
    background-size: 200% 100%;
    animation: skeleton-loading 1.5s infinite;
  }
  
  .skeleton-stats {
    padding: 16px;
    margin: 0 20px 16px;
    border-radius: 12px;
    background: rgba(30, 41, 59, 0.6);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .skeleton-stat-line {
    height: 16px;
    background: linear-gradient(90deg, 
      rgba(71, 85, 105, 0.3), 
      rgba(148, 163, 184, 0.4), 
      rgba(71, 85, 105, 0.3)
    );
    background-size: 200% 100%;
    animation: skeleton-loading 1.5s infinite;
    border-radius: 8px;
  }
  
  .skeleton-footer {
    height: 40px;
    margin-top: auto;
    background: rgba(15, 23, 42, 0.5);
    border-radius: 0 0 20px 20px;
  }
  
  @keyframes skeleton-loading {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
`;
document.head.appendChild(skeletonStyle);

window.TablesIntegration = TablesIntegration;
window.CardController = CardController;
window.CardValidator = CardValidator;
window.AvatarController = AvatarController;

console.log('✅ cards.js otimizado carregado completamente!');
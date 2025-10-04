// tables_calculations.js - Sistema de Cálculos com Persistência
import { 
    db, 
    doc, 
    updateDoc,
    getDoc
} from '../firebase.js';

// Calcula os totais baseado nos produtos filtrados e no frete salvo
function calculateTotals() {
    if (!window.tablesShared) {
        console.error('tablesShared não disponível');
        return { totalProducts: 0, subtotalValue: 0, shippingCost: 0, grandTotal: 0 };
    }
    
    const products = window.tablesShared.getFilteredProducts();
    const totalProducts = products.length;
    
    // Subtotal (soma dos preços dos produtos)
    const subtotalValue = products.reduce((sum, product) => {
        const price = parseFloat(product.price) || 0;
        return sum + price;
    }, 0);
    
    // Buscar frete salvo no card
    const currentCard = window.tablesShared.currentCard();
    const shippingCost = parseFloat(currentCard?.shippingCost) || 0;
    
    // Total Geral = Subtotal + Frete
    const grandTotal = subtotalValue + shippingCost;
    
    return { 
        totalProducts, 
        subtotalValue, 
        shippingCost,
        grandTotal 
    };
}

// Atualiza a interface com os totais calculados
function updateTotals() {
    const totals = calculateTotals();
    const elements = window.tablesShared?.elements;
    const formatCurrency = window.tablesShared?.formatCurrency;
    
    if (!elements || !formatCurrency) return;
    
    // Atualizar elementos na interface
    if (elements.totalProducts) {
        elements.totalProducts.textContent = totals.totalProducts;
    }
    
    if (elements.totalValue) {
        elements.totalValue.textContent = formatCurrency(totals.subtotalValue);
    }
    
    if (elements.subtotalValue) {
        elements.subtotalValue.textContent = formatCurrency(totals.subtotalValue);
    }
    
    if (elements.shippingValue) {
        elements.shippingValue.textContent = formatCurrency(totals.shippingCost);
    }
    
    if (elements.grandTotal) {
        elements.grandTotal.textContent = formatCurrency(totals.grandTotal);
    }
    
    console.log('Totais atualizados:', {
        produtos: totals.totalProducts,
        subtotal: totals.subtotalValue,
        frete: totals.shippingCost,
        total: totals.grandTotal
    });
}

// Salva o frete no Firebase e recalcula o total geral
async function saveShippingCost() {
    const elements = window.tablesShared?.elements;
    const currentCard = window.tablesShared?.currentCard();
    
    if (!elements?.shippingCost || !currentCard) {
        console.error('Elementos ou card não disponíveis');
        return;
    }
    
    // Pegar o valor do frete digitado pelo usuário
    const shippingValue = parseFloat(elements.shippingCost.value) || 0;
    
    // Validar que o frete não seja negativo
    if (shippingValue < 0) {
        window.tablesShared?.showMessage('O frete não pode ser negativo', 'error');
        elements.shippingCost.value = 0;
        return;
    }
    
    try {
        const cardRef = doc(db, 'cards', currentCard.id);
        
        // Salvar o frete no Firebase
        await updateDoc(cardRef, {
            shippingCost: shippingValue
        });
        
        // Atualizar o objeto do card em memória
        currentCard.shippingCost = shippingValue;
        
        // Recalcular e atualizar a interface
        updateTotals();
        
        window.tablesShared?.showMessage('Frete salvo com sucesso!', 'success');
        console.log('Frete salvo no Firebase:', shippingValue);
        
    } catch (error) {
        console.error('Erro ao salvar frete:', error);
        window.tablesShared?.showMessage('Erro ao salvar frete: ' + error.message, 'error');
    }
}

// Carrega os valores salvos do Firebase quando a página é carregada
async function loadSavedCalculations(card) {
    if (!card) {
        console.error('Card não fornecido');
        return;
    }
    
    const elements = window.tablesShared?.elements;
    
    try {
        const cardRef = doc(db, 'cards', card.id);
        const cardDoc = await getDoc(cardRef);
        
        if (cardDoc.exists()) {
            const cardData = cardDoc.data();
            const savedShippingCost = parseFloat(cardData.shippingCost) || 0;
            
            // Atualizar o card em memória
            card.shippingCost = savedShippingCost;
            
            // Preencher o campo de frete na interface
            if (elements?.shippingCost) {
                elements.shippingCost.value = savedShippingCost.toFixed(2);
            }
            
            console.log('Frete carregado do Firebase:', savedShippingCost);
        } else {
            console.warn('Documento do card não encontrado');
        }
    } catch (error) {
        console.error('Erro ao carregar cálculos salvos:', error);
    }
    
    // Atualizar totais na interface
    updateTotals();
}

// Configura os listeners para o campo de frete
function setupShippingListeners() {
    const elements = window.tablesShared?.elements;
    
    if (!elements?.shippingCost) {
        console.warn('Campo de frete não encontrado');
        return;
    }
    
    let shippingTimeout;
    
    // Atualizar totais enquanto digita (com debounce)
    elements.shippingCost.addEventListener('input', () => {
        clearTimeout(shippingTimeout);
        shippingTimeout = setTimeout(() => {
            const currentCard = window.tablesShared?.currentCard();
            if (currentCard) {
                const shippingValue = parseFloat(elements.shippingCost.value) || 0;
                currentCard.shippingCost = shippingValue;
                updateTotals();
            }
        }, 300);
    });
    
    // Salvar no Firebase quando o campo perde o foco
    elements.shippingCost.addEventListener('blur', saveShippingCost);
    
    // Salvar no Firebase ao pressionar Enter
    elements.shippingCost.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            elements.shippingCost.blur(); // Trigger blur event
            saveShippingCost();
        }
    });
    
    console.log('Listeners do frete configurados');
}

// Inicializar listeners quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(setupShippingListeners, 500);
    });
} else {
    setTimeout(setupShippingListeners, 500);
}

// Exportar funções globalmente
window.tableCalculations = {
    calculateTotals,
    updateTotals,
    saveShippingCost,
    loadSavedCalculations,
    setupShippingListeners
};

console.log('tableCalculations carregado e disponível globalmente');
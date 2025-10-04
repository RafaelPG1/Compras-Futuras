// tables_part2.js - Sistema de Cálculos e Persistência
// ============================================================================

// ----------------------------------------------------------------------------
// SEÇÃO 1: CONFIGURAÇÕES E ESTADO
// ----------------------------------------------------------------------------
const CALC_CONFIG = {
    AUTO_SAVE_INTERVAL: 2 * 60 * 1000, // 2 minutos
    DEBOUNCE_DELAY: 300,
    CHECK_CHANGES_INTERVAL: 1000
};

const calcState = {
    shippingCost: 0,
    autoSaveInterval: null,
    lastProductCount: 0,
    lastTotalValue: 0
};

// ----------------------------------------------------------------------------
// SEÇÃO 2: INICIALIZAÇÃO
// ----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', initializeModule);

function initializeModule() {
    // Aguardar o carregamento do módulo principal
    setTimeout(() => {
        if (window.tablesShared) {
            initializeCalculations();
            startMonitoring();
        } else {
            waitForMainModule();
        }
    }, 50);
}

function waitForMainModule() {
    console.warn('Aguardando módulo principal (tablesShared)...');
    
    const interval = setInterval(() => {
        if (window.tablesShared) {
            clearInterval(interval);
            initializeCalculations();
            startMonitoring();
        }
    }, 100);
}

function initializeCalculations() {
    const { elements, debounce } = window.tablesShared;
    
    // Configurar listeners de cálculo
    if (elements.shippingCost) {
        elements.shippingCost.addEventListener(
            'input', 
            debounce(updateTotals, CALC_CONFIG.DEBOUNCE_DELAY)
        );
    }
    
    // Atualizar totais iniciais
    updateTotals();
}

function startMonitoring() {
    watchProductChanges();
    startAutoSave();
}

// ----------------------------------------------------------------------------
// SEÇÃO 3: CÁLCULOS PRINCIPAIS
// ----------------------------------------------------------------------------
function updateTotals() {
    const { elements, formatCurrency, getFilteredProducts } = window.tablesShared;
    
    const filteredProducts = getFilteredProducts();
    const calculations = calculateTotals(filteredProducts);
    
    updateUI(calculations);
    
    // Salvar valor do frete no estado
    calcState.shippingCost = calculations.shipping;
}

function calculateTotals(products) {
    const subtotal = products.reduce((sum, product) => {
        return sum + (parseFloat(product.price) || 0);
    }, 0);
    
    const shipping = parseFloat(window.tablesShared.elements.shippingCost?.value) || 0;
    const total = subtotal + shipping;
    
    return {
        productCount: products.length,
        subtotal,
        shipping,
        total
    };
}

function updateUI(calculations) {
    const { elements, formatCurrency } = window.tablesShared;
    
    if (elements.totalProducts) {
        elements.totalProducts.textContent = calculations.productCount;
    }
    
    if (elements.subtotalValue) {
        elements.subtotalValue.textContent = formatCurrency(calculations.subtotal);
    }
    
    if (elements.shippingValue) {
        elements.shippingValue.textContent = formatCurrency(calculations.shipping);
    }
    
    if (elements.totalValue) {
        elements.totalValue.textContent = formatCurrency(calculations.total);
    }
    
    if (elements.grandTotal) {
        elements.grandTotal.textContent = formatCurrency(calculations.total);
    }
}

// ----------------------------------------------------------------------------
// SEÇÃO 4: CÁLCULOS POR CATEGORIA
// ----------------------------------------------------------------------------
function calculateTotalsByCategory() {
    const { getFilteredProducts } = window.tablesShared;
    
    const products = getFilteredProducts();
    const categoryTotals = {};
    
    products.forEach(product => {
        const category = product.category || 'Sem categoria';
        const price = parseFloat(product.price) || 0;
        
        if (!categoryTotals[category]) {
            categoryTotals[category] = {
                count: 0,
                total: 0,
                percentage: 0
            };
        }
        
        categoryTotals[category].count++;
        categoryTotals[category].total += price;
    });
    
    // Calcular percentuais
    const grandTotal = Object.values(categoryTotals)
        .reduce((sum, cat) => sum + cat.total, 0);
    
    if (grandTotal > 0) {
        Object.keys(categoryTotals).forEach(category => {
            categoryTotals[category].percentage = 
                (categoryTotals[category].total / grandTotal) * 100;
        });
    }
    
    return sortByTotal(categoryTotals);
}

// ----------------------------------------------------------------------------
// SEÇÃO 5: CÁLCULOS POR IMPORTÂNCIA
// ----------------------------------------------------------------------------
function calculateTotalsByImportance() {
    const { getFilteredProducts } = window.tablesShared;
    
    const products = getFilteredProducts();
    const importanceTotals = {};
    
    // Ordem de prioridade
    const importanceOrder = ['Essencial', 'Importante', 'Luxo', 'Futuro'];
    
    // Inicializar todas as categorias
    importanceOrder.forEach(level => {
        importanceTotals[level] = {
            count: 0,
            total: 0,
            percentage: 0
        };
    });
    
    // Adicionar categoria para itens não definidos
    importanceTotals['Não definido'] = {
        count: 0,
        total: 0,
        percentage: 0
    };
    
    // Calcular totais
    products.forEach(product => {
        const importance = product.importance || 'Não definido';
        const price = parseFloat(product.price) || 0;
        
        if (importanceTotals[importance]) {
            importanceTotals[importance].count++;
            importanceTotals[importance].total += price;
        }
    });
    
    // Calcular percentuais
    const grandTotal = Object.values(importanceTotals)
        .reduce((sum, imp) => sum + imp.total, 0);
    
    if (grandTotal > 0) {
        Object.keys(importanceTotals).forEach(importance => {
            importanceTotals[importance].percentage = 
                (importanceTotals[importance].total / grandTotal) * 100;
        });
    }
    
    return importanceTotals;
}

// ----------------------------------------------------------------------------
// SEÇÃO 6: ESTATÍSTICAS GERAIS
// ----------------------------------------------------------------------------
function getGeneralStatistics() {
    const { getFilteredProducts, formatCurrency } = window.tablesShared;
    
    const products = getFilteredProducts();
    const prices = products
        .map(p => parseFloat(p.price) || 0)
        .filter(p => p > 0);
    
    if (prices.length === 0) {
        return getEmptyStatistics();
    }
    
    const stats = calculateStatistics(prices);
    
    return {
        ...stats,
        formatted: formatStatistics(stats)
    };
}

function getEmptyStatistics() {
    const { formatCurrency } = window.tablesShared;
    
    return {
        totalProducts: 0,
        totalValue: 0,
        averagePrice: 0,
        medianPrice: 0,
        highestPrice: 0,
        lowestPrice: 0,
        shippingCost: calcState.shippingCost,
        grandTotal: calcState.shippingCost,
        standardDeviation: 0,
        formatted: {
            totalValue: 'R$ 0,00',
            averagePrice: 'R$ 0,00',
            medianPrice: 'R$ 0,00',
            highestPrice: 'R$ 0,00',
            lowestPrice: 'R$ 0,00',
            shippingCost: formatCurrency(calcState.shippingCost),
            grandTotal: formatCurrency(calcState.shippingCost),
            standardDeviation: 'R$ 0,00'
        }
    };
}

function calculateStatistics(prices) {
    const { getFilteredProducts } = window.tablesShared;
    const products = getFilteredProducts();
    
    const totalValue = prices.reduce((sum, price) => sum + price, 0);
    const averagePrice = totalValue / prices.length;
    const medianPrice = calculateMedian(prices);
    const highestPrice = Math.max(...prices);
    const lowestPrice = Math.min(...prices);
    const grandTotal = totalValue + calcState.shippingCost;
    const standardDeviation = calculateStandardDeviation(prices, averagePrice);
    
    return {
        totalProducts: products.length,
        totalValue,
        averagePrice,
        medianPrice,
        highestPrice,
        lowestPrice,
        shippingCost: calcState.shippingCost,
        grandTotal,
        standardDeviation
    };
}

function calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
        return (sorted[middle - 1] + sorted[middle]) / 2;
    }
    
    return sorted[middle];
}

function calculateStandardDeviation(values, mean) {
    const squareDiffs = values.map(value => Math.pow(value - mean, 2));
    const avgSquareDiff = squareDiffs.reduce((sum, value) => sum + value, 0) / values.length;
    return Math.sqrt(avgSquareDiff);
}

function formatStatistics(stats) {
    const { formatCurrency } = window.tablesShared;
    
    return {
        totalValue: formatCurrency(stats.totalValue),
        averagePrice: formatCurrency(stats.averagePrice),
        medianPrice: formatCurrency(stats.medianPrice),
        highestPrice: formatCurrency(stats.highestPrice),
        lowestPrice: formatCurrency(stats.lowestPrice),
        shippingCost: formatCurrency(stats.shippingCost),
        grandTotal: formatCurrency(stats.grandTotal),
        standardDeviation: formatCurrency(stats.standardDeviation)
    };
}

// ----------------------------------------------------------------------------
// SEÇÃO 7: EXPORTAÇÃO DE DADOS
// ----------------------------------------------------------------------------
function exportCalculationsData() {
    const { getFilteredProducts } = window.tablesShared;
    
    const exportData = {
        exportDate: new Date().toISOString(),
        exportType: 'calculations',
        version: '1.0',
        
        summary: getGeneralStatistics(),
        
        breakdowns: {
            byCategory: calculateTotalsByCategory(),
            byImportance: calculateTotalsByImportance()
        },
        
        products: getFilteredProducts().map(formatProductForExport),
        
        metadata: {
            totalProducts: getFilteredProducts().length,
            hasFilters: hasActiveFilters(),
            currency: 'BRL'
        }
    };
    
    return exportData;
}

function formatProductForExport(product) {
    return {
        id: product.id,
        name: product.name,
        price: parseFloat(product.price) || 0,
        category: product.category || '',
        importance: product.importance || '',
        store: product.store || '',
        link: product.link || '',
        createdAt: product.createdAt || '',
        order: product.order || 0
    };
}

function hasActiveFilters() {
    const { elements } = window.tablesShared;
    
    return !!(
        elements.searchInput?.value ||
        elements.categoryFilter?.value ||
        elements.importanceFilter?.value
    );
}

// ----------------------------------------------------------------------------
// SEÇÃO 8: ORDENAÇÃO E UTILITÁRIOS
// ----------------------------------------------------------------------------
function sortByTotal(categoryTotals) {
    const sorted = {};
    const entries = Object.entries(categoryTotals)
        .sort((a, b) => b[1].total - a[1].total);
    
    entries.forEach(([key, value]) => {
        sorted[key] = value;
    });
    
    return sorted;
}

// ----------------------------------------------------------------------------
// SEÇÃO 9: MONITORAMENTO DE MUDANÇAS
// ----------------------------------------------------------------------------
function watchProductChanges() {
    setInterval(() => {
        const { products } = window.tablesShared;
        const currentProducts = products();
        
        if (!currentProducts) return;
        
        const currentCount = currentProducts.length;
        const currentTotal = currentProducts.reduce((sum, p) => 
            sum + (parseFloat(p.price) || 0), 0
        );
        
        if (currentCount !== calcState.lastProductCount || 
            currentTotal !== calcState.lastTotalValue) {
            
            updateTotals();
            
            calcState.lastProductCount = currentCount;
            calcState.lastTotalValue = currentTotal;
        }
    }, CALC_CONFIG.CHECK_CHANGES_INTERVAL);
}

// ----------------------------------------------------------------------------
// SEÇÃO 10: AUTO-SAVE
// ----------------------------------------------------------------------------
function startAutoSave() {
    if (calcState.autoSaveInterval) {
        clearInterval(calcState.autoSaveInterval);
    }
    
    calcState.autoSaveInterval = setInterval(async () => {
        await autoSaveCalculations();
    }, CALC_CONFIG.AUTO_SAVE_INTERVAL);
}

async function autoSaveCalculations() {
    try {
        const { saveCardData, currentCard } = window.tablesShared;
        
        if (!currentCard()) return;
        
        const cardData = currentCard();
        
        // Salvar valor do frete
        if (calcState.shippingCost !== cardData.shippingCost) {
            await saveCardData();
            console.log('Cálculos salvos automaticamente');
        }
        
    } catch (error) {
        console.error('Erro no auto-save de cálculos:', error);
    }
}

function stopAutoSave() {
    if (calcState.autoSaveInterval) {
        clearInterval(calcState.autoSaveInterval);
        calcState.autoSaveInterval = null;
    }
}

// ----------------------------------------------------------------------------
// SEÇÃO 11: PERSISTÊNCIA
// ----------------------------------------------------------------------------
function loadSavedCalculations(cardData) {
    if (!cardData) return;
    
    const { elements } = window.tablesShared;
    
    // Carregar valor do frete salvo
    if (cardData.shippingCost !== undefined && elements.shippingCost) {
        elements.shippingCost.value = cardData.shippingCost || 0;
        calcState.shippingCost = cardData.shippingCost || 0;
    }
    
    updateTotals();
}

async function saveCalculations() {
    try {
        const { saveCardData, elements } = window.tablesShared;
        
        // Atualizar valor do frete no card
        const shippingValue = parseFloat(elements.shippingCost?.value) || 0;
        
        if (window.tablesShared.currentCard()) {
            window.tablesShared.currentCard().shippingCost = shippingValue;
        }
        
        await saveCardData();
        
    } catch (error) {
        console.error('Erro ao salvar cálculos:', error);
        throw error;
    }
}

// ----------------------------------------------------------------------------
// SEÇÃO 12: ANÁLISES AVANÇADAS
// ----------------------------------------------------------------------------
function getProductAnalysis() {
    const { getFilteredProducts } = window.tablesShared;
    const products = getFilteredProducts();
    
    const analysis = {
        mostExpensive: getMostExpensiveProducts(products, 5),
        cheapest: getCheapestProducts(products, 5),
        byStore: groupByStore(products),
        priceRanges: calculatePriceRanges(products)
    };
    
    return analysis;
}

function getMostExpensiveProducts(products, limit = 5) {
    return [...products]
        .filter(p => parseFloat(p.price) > 0)
        .sort((a, b) => parseFloat(b.price) - parseFloat(a.price))
        .slice(0, limit)
        .map(p => ({
            name: p.name,
            price: parseFloat(p.price),
            category: p.category || 'Sem categoria'
        }));
}

function getCheapestProducts(products, limit = 5) {
    return [...products]
        .filter(p => parseFloat(p.price) > 0)
        .sort((a, b) => parseFloat(a.price) - parseFloat(b.price))
        .slice(0, limit)
        .map(p => ({
            name: p.name,
            price: parseFloat(p.price),
            category: p.category || 'Sem categoria'
        }));
}

function groupByStore(products) {
    const storeGroups = {};
    
    products.forEach(product => {
        const store = product.store || 'Sem loja';
        const price = parseFloat(product.price) || 0;
        
        if (!storeGroups[store]) {
            storeGroups[store] = {
                count: 0,
                total: 0,
                products: []
            };
        }
        
        storeGroups[store].count++;
        storeGroups[store].total += price;
        storeGroups[store].products.push({
            name: product.name,
            price: price
        });
    });
    
    return storeGroups;
}

function calculatePriceRanges(products) {
    const prices = products
        .map(p => parseFloat(p.price))
        .filter(p => p > 0);
    
    if (prices.length === 0) {
        return {
            '0-100': 0,
            '100-500': 0,
            '500-1000': 0,
            '1000+': 0
        };
    }
    
    const ranges = {
        '0-100': 0,
        '100-500': 0,
        '500-1000': 0,
        '1000+': 0
    };
    
    prices.forEach(price => {
        if (price <= 100) ranges['0-100']++;
        else if (price <= 500) ranges['100-500']++;
        else if (price <= 1000) ranges['500-1000']++;
        else ranges['1000+']++;
    });
    
    return ranges;
}

// ----------------------------------------------------------------------------
// SEÇÃO 13: RELATÓRIOS
// ----------------------------------------------------------------------------
function generateSummaryReport() {
    const stats = getGeneralStatistics();
    const analysis = getProductAnalysis();
    const categoryBreakdown = calculateTotalsByCategory();
    const importanceBreakdown = calculateTotalsByImportance();
    
    return {
        timestamp: new Date().toISOString(),
        statistics: stats,
        analysis: analysis,
        breakdowns: {
            categories: categoryBreakdown,
            importance: importanceBreakdown
        }
    };
}

function exportReportAsJSON() {
    const report = generateSummaryReport();
    const dataStr = JSON.stringify(report, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-${Date.now()}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
}

// ----------------------------------------------------------------------------
// SEÇÃO 14: EXPORTAÇÕES GLOBAIS
// ----------------------------------------------------------------------------
window.tableCalculations = {
    // Cálculos principais
    updateTotals,
    calculateTotals,
    
    // Análises
    getGeneralStatistics,
    calculateTotalsByCategory,
    calculateTotalsByImportance,
    getProductAnalysis,
    
    // Exportação
    exportCalculationsData,
    generateSummaryReport,
    exportReportAsJSON,
    
    // Persistência
    loadSavedCalculations,
    saveCalculations,
    
    // Controle
    startAutoSave,
    stopAutoSave,
    
    // Estado
    getShippingCost: () => calcState.shippingCost
};

// ----------------------------------------------------------------------------
// SEÇÃO 15: CLEANUP
// ----------------------------------------------------------------------------
window.addEventListener('beforeunload', () => {
    stopAutoSave();
});

console.log('Módulo de cálculos inicializado');
// ============================================
// supabase.js - COMPLETO E UNIFICADO
// Inclui funções para cards, produtos, tabelas_card e AVATAR
// Com suporte a frete e upload de imagem de perfil
// ============================================

// ⚠️ IMPORTANTE: Suas credenciais do Supabase
const SUPABASE_URL = 'https://jkxlwtfhkwawiaydtkas.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpreGx3dGZoa3dhd2lheWR0a2FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3ODU4NDAsImV4cCI6MjA3NTM2MTg0MH0.jgDQNCeajrimMxbmAt_bmMpLaTkoKLoHPsWbqWoqav4';

// Verificar se Supabase está disponível
if (!window.supabase) {
  console.error('❌ Supabase não está carregado! Verifique se o script está incluído no HTML.');
  throw new Error('Supabase não disponível');
}

// Inicializa cliente Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('✅ Cliente Supabase inicializado');

// ========================================
// UTILITÁRIO: Sanitizar nome de tabela
// ========================================

function sanitizeTableName(cardName) {
  return 'tabela_' + cardName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 55);
}

// ========================================
// UTILITÁRIO: Conversão de Importância
// ========================================

export function convertImportanciaToText(importanciaNum) {
  const map = {
    1: 'Luxo',
    2: 'Importante',
    3: 'Essencial',
    4: 'Futuro'
  };
  return map[importanciaNum] || null;
}

export function convertImportanciaToNumber(importanciaText) {
  const map = {
    'Luxo': 1,
    'Importante': 2,
    'Essencial': 3,
    'Futuro': 4
  };
  return map[importanciaText] || null;
}

// ========================================
// SEÇÃO 1: GERENCIAMENTO DE USUÁRIOS
// ========================================

export async function validateManualLogin(username, password) {
  try {
    console.log('🔍 Validando login manual:', username);

    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .eq('tipo_login', 'manual')
      .single();

    if (error) {
      console.error('❌ Erro ao buscar usuário manual:', error);
      return {
        success: false,
        error: 'Usuário ou senha incorretos'
      };
    }

    if (!data) {
      return {
        success: false,
        error: 'Usuário ou senha incorretos'
      };
    }

    console.log('✅ Usuário manual validado:', data.display_name);

    saveUserSession({
      id: data.id,
      username: data.username,
      displayName: data.display_name,
      loginType: 'manual',
      imageUrl: data.image_url
    });

    return {
      success: true,
      user: data
    };

  } catch (error) {
    console.error('❌ Erro inesperado no login manual:', error);
    return {
      success: false,
      error: 'Erro ao conectar com servidor'
    };
  }
}

export function saveUserSession(userData) {
  const sessionData = {
    ...userData,
    timestamp: Date.now()
  };

  localStorage.setItem('userSession', JSON.stringify(sessionData));
  console.log('💾 Sessão salva no navegador');
}

export function getStoredSession() {
  const sessionData = localStorage.getItem('userSession');
  
  if (!sessionData) {
    return null;
  }

  try {
    return JSON.parse(sessionData);
  } catch (error) {
    console.error('❌ Erro ao recuperar sessão:', error);
    return null;
  }
}

export function isSessionValid() {
  const session = getStoredSession();
  return session !== null;
}

export function clearUserSession() {
  localStorage.removeItem('userSession');
  console.log('🗑️ Sessão removida do navegador');
}

export function getCurrentUser() {
  return getStoredSession();
}

export function logout() {
  clearUserSession();
  console.log('👋 Logout realizado com sucesso');
}

// ========================================
// SEÇÃO 1.5: GERENCIAMENTO DE AVATAR
// SEM STORAGE - APENAS BASE64 NA TABELA
// ========================================

/**
 * Busca a URL/Base64 da imagem de perfil do usuário atual
 * @returns {Promise<{success: boolean, imageUrl: string|null, error?: string}>}
 */
export async function getAvatarUrl() {
  try {
    console.log('🔍 Buscando imagem de perfil do usuário...');

    // Buscar usuário da sessão
    const session = getStoredSession();
    if (!session || !session.id) {
      console.warn('⚠️ Sem sessão ativa');
      return {
        success: false,
        imageUrl: null,
        error: 'Usuário não autenticado'
      };
    }

    const { data, error } = await supabase
      .from('usuarios')
      .select('image_url')
      .eq('id', session.id)
      .single();

    if (error) {
      console.error('❌ Erro ao buscar imagem:', error);
      return {
        success: false,
        imageUrl: null,
        error: 'Erro ao buscar imagem de perfil'
      };
    }

    const imageUrl = data?.image_url || null;
    console.log('✅ Imagem carregada:', imageUrl ? 'Possui imagem' : 'Sem imagem');

    return {
      success: true,
      imageUrl: imageUrl
    };

  } catch (error) {
    console.error('❌ Erro inesperado ao buscar imagem:', error);
    return {
      success: false,
      imageUrl: null,
      error: 'Erro ao conectar com servidor'
    };
  }
}

/**
 * Converte arquivo de imagem para Base64
 * @param {File} file - Arquivo de imagem
 * @returns {Promise<string>}
 */
function convertImageToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      resolve(e.target.result);
    };
    
    reader.onerror = (error) => {
      reject(error);
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Faz upload da imagem (salva Base64 na coluna image_url)
 * @param {File} file - Arquivo de imagem
 * @returns {Promise<{success: boolean, imageBase64?: string, error?: string}>}
 */
export async function uploadAvatar(file) {
  try {
    console.log('📤 Processando imagem do avatar...');

    // Validar arquivo
    if (!file) {
      return {
        success: false,
        error: 'Nenhum arquivo selecionado'
      };
    }

    if (!file.type.startsWith('image/')) {
      return {
        success: false,
        error: 'Apenas imagens são permitidas'
      };
    }

    if (file.size > 5 * 1024 * 1024) {
      return {
        success: false,
        error: 'Imagem deve ter no máximo 5MB'
      };
    }

    // Converter para Base64
    console.log('🔄 Convertendo imagem para Base64...');
    const imageBase64 = await convertImageToBase64(file);
    
    console.log('✅ Imagem convertida com sucesso');

    return {
      success: true,
      imageBase64: imageBase64
    };

  } catch (error) {
    console.error('❌ Erro ao processar imagem:', error);
    return {
      success: false,
      error: 'Erro ao processar imagem: ' + (error.message || 'Desconhecido')
    };
  }
}

/**
 * Atualiza a image_url do usuário atual na tabela
 * @param {string} imageBase64 - Base64 da imagem (ou null para remover)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function updateUserAvatar(imageBase64) {
  try {
    console.log('💾 Atualizando imagem do usuário...');

    // Buscar usuário da sessão
    const session = getStoredSession();
    if (!session || !session.id) {
      console.error('❌ Sessão inválida:', session);
      return {
        success: false,
        error: 'Usuário não autenticado. Faça login novamente.'
      };
    }

    console.log('👤 Atualizando usuário ID:', session.id);

    const { error } = await supabase
      .from('usuarios')
      .update({ image_url: imageBase64 })
      .eq('id', session.id);

    if (error) {
      console.error('❌ Erro ao atualizar imagem:', error);
      return {
        success: false,
        error: 'Erro ao salvar imagem de perfil: ' + error.message
      };
    }

    console.log('✅ Imagem atualizada na tabela usuarios');

    // Atualizar sessão local
    session.imageUrl = imageBase64;
    saveUserSession(session);

    return {
      success: true
    };

  } catch (error) {
    console.error('❌ Erro inesperado ao atualizar imagem:', error);
    return {
      success: false,
      error: 'Erro ao conectar com servidor: ' + (error.message || 'Desconhecido')
    };
  }
}

/**
 * Remove a imagem de perfil do usuário atual
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function removeAvatar() {
  try {
    console.log('🗑️ Removendo imagem do usuário...');

    // Buscar usuário da sessão
    const session = getStoredSession();
    if (!session || !session.id) {
      return {
        success: false,
        error: 'Usuário não autenticado'
      };
    }

    // Limpar image_url do usuário
    const { error } = await supabase
      .from('usuarios')
      .update({ image_url: null })
      .eq('id', session.id);

    if (error) {
      console.error('❌ Erro ao remover imagem:', error);
      return {
        success: false,
        error: 'Erro ao remover imagem de perfil'
      };
    }

    console.log('✅ Imagem removida da tabela usuarios');

    // Atualizar sessão local
    session.imageUrl = null;
    saveUserSession(session);

    return {
      success: true
    };

  } catch (error) {
    console.error('❌ Erro inesperado ao remover imagem:', error);
    return {
      success: false,
      error: 'Erro ao conectar com servidor'
    };
  }
}

// ========================================
// SEÇÃO 2: GERENCIAMENTO DE CARDS
// ========================================

export async function getCards() {
  try {
    console.log('📦 Buscando cards do Supabase...');

    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Erro ao buscar cards:', error);
      return {
        success: false,
        error: 'Erro ao carregar cards'
      };
    }

    console.log(`✅ ${data.length} cards carregados`);
    return {
      success: true,
      data: data
    };

  } catch (error) {
    console.error('❌ Erro inesperado ao buscar cards:', error);
    return {
      success: false,
      error: 'Erro ao conectar com servidor'
    };
  }
}

export async function getCardById(id) {
  try {
    console.log('🔍 Buscando card:', id);

    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('❌ Erro ao buscar card:', error);
      return {
        success: false,
        error: 'Card não encontrado'
      };
    }

    console.log('✅ Card encontrado:', data.name);
    return {
      success: true,
      data: data
    };

  } catch (error) {
    console.error('❌ Erro inesperado ao buscar card:', error);
    return {
      success: false,
      error: 'Erro ao conectar com servidor'
    };
  }
}

export async function addCard(name, description = null, image_url = null) {
  try {
    console.log('➕ Criando novo card:', name);

    if (!name || name.trim() === '') {
      return {
        success: false,
        error: 'Nome do card é obrigatório'
      };
    }

    const { data, error } = await supabase
      .from('cards')
      .insert([
        {
          name: name.trim(),
          description: description?.trim() || null,
          image_url: image_url?.trim() || null,
          quantidade_produtos: 0,
          valor_total: 0.00,
          frete: 0,
          table_name: null
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao criar card:', error);
      return {
        success: false,
        error: 'Erro ao criar card'
      };
    }

    console.log('✅ Card criado com sucesso:', data.id);
    return {
      success: true,
      data: data
    };

  } catch (error) {
    console.error('❌ Erro inesperado ao criar card:', error);
    return {
      success: false,
      error: 'Erro ao conectar com servidor'
    };
  }
}

export async function updateCard(id, fields) {
  try {
    console.log('✏️ Atualizando card:', id);

    const updateData = {};
    
    if (fields.name !== undefined) updateData.name = fields.name;
    if (fields.description !== undefined) updateData.description = fields.description;
    if (fields.image_url !== undefined) updateData.image_url = fields.image_url;
    if (fields.quantidade_produtos !== undefined) updateData.quantidade_produtos = fields.quantidade_produtos;
    if (fields.valor_total !== undefined) updateData.valor_total = fields.valor_total;
    if (fields.frete !== undefined) updateData.frete = fields.frete;

    if (Object.keys(updateData).length === 0) {
      return {
        success: false,
        error: 'Nenhum campo para atualizar'
      };
    }

    const { data, error } = await supabase
      .from('cards')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) {
      console.error('❌ Erro ao atualizar card:', error);
      return {
        success: false,
        error: 'Erro ao atualizar card'
      };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        error: 'Card não encontrado'
      };
    }

    console.log('✅ Card atualizado com sucesso');
    return {
      success: true,
      data: data[0]
    };

  } catch (error) {
    console.error('❌ Erro inesperado ao atualizar card:', error);
    return {
      success: false,
      error: 'Erro ao conectar com servidor'
    };
  }
}

export async function deleteCard(id) {
  try {
    console.log('🗑️ Deletando card:', id);

    const { data, error } = await supabase
      .from('cards')
      .delete()
      .eq('id', id)
      .select();

    if (error) {
      console.error('❌ Erro ao deletar card:', error);
      return {
        success: false,
        error: 'Erro ao deletar card'
      };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        error: 'Card não encontrado'
      };
    }

    console.log('✅ Card deletado com sucesso');
    return {
      success: true
    };

  } catch (error) {
    console.error('❌ Erro inesperado ao deletar card:', error);
    return {
      success: false,
      error: 'Erro ao conectar com servidor'
    };
  }
}

// ========================================
// SEÇÃO 3: GERENCIAMENTO DE FRETE
// ========================================

export async function buscarFrete(cardId) {
  try {
    console.log('📥 Buscando frete do card:', cardId);

    const { data, error } = await supabase
      .from('cards')
      .select('frete')
      .eq('id', cardId)
      .single();

    if (error) {
      console.error('❌ Erro ao buscar frete:', error);
      return {
        success: false,
        frete: 0,
        error: 'Erro ao buscar frete'
      };
    }

    if (!data) {
      return {
        success: false,
        frete: 0,
        error: 'Card não encontrado'
      };
    }

    const frete = parseFloat(data.frete) || 0;
    console.log(`✅ Frete carregado: R$ ${frete.toFixed(2)}`);

    return {
      success: true,
      frete: frete
    };

  } catch (error) {
    console.error('❌ Erro ao buscar frete:', error);
    return {
      success: false,
      frete: 0,
      error: 'Erro ao conectar com servidor'
    };
  }
}

export async function salvarFrete(cardId, valorFrete) {
  try {
    console.log(`💾 Salvando frete - Card: ${cardId}, Valor: R$ ${valorFrete}`);

    const frete = parseFloat(valorFrete) || 0;

    if (frete < 0) {
      console.warn('⚠️ Frete negativo não permitido');
      return {
        success: false,
        frete: 0,
        error: 'Frete não pode ser negativo'
      };
    }

    const { data, error } = await supabase
      .from('cards')
      .update({ frete: frete })
      .eq('id', cardId)
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao salvar frete:', error);
      return {
        success: false,
        frete: 0,
        error: 'Erro ao salvar frete'
      };
    }

    if (!data) {
      return {
        success: false,
        frete: 0,
        error: 'Card não encontrado'
      };
    }

    const freteAtualizado = parseFloat(data.frete) || 0;
    console.log(`✅ Frete salvo: R$ ${freteAtualizado.toFixed(2)}`);

    return {
      success: true,
      frete: freteAtualizado
    };

  } catch (error) {
    console.error('❌ Erro ao salvar frete:', error);
    return {
      success: false,
      frete: 0,
      error: 'Erro ao conectar com servidor'
    };
  }
}

export async function limparFrete(cardId) {
  try {
    console.log('🗑️ Limpando frete do card:', cardId);

    const { data, error } = await supabase
      .from('cards')
      .update({ frete: 0 })
      .eq('id', cardId)
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao limpar frete:', error);
      return { success: false };
    }

    console.log('✅ Frete limpo');
    return { success: true };

  } catch (error) {
    console.error('❌ Erro ao limpar frete:', error);
    return { success: false };
  }
}

// ========================================
// SEÇÃO 4: GERENCIAMENTO DE PRODUTOS (TABELAS_CARD)
// ========================================

export async function getProdutos(cardId) {
  try {
    console.log('📦 Buscando produtos do card:', cardId);

    const { data, error } = await supabase
      .from('tabelas_card')
      .select('*')
      .eq('id_card', cardId)
      .order('ordem', { ascending: true });

    if (error) {
      console.error('❌ Erro ao buscar produtos:', error);
      return { 
        success: false, 
        error: 'Erro ao carregar produtos',
        data: [] 
      };
    }

    console.log(`✅ ${data?.length || 0} produtos carregados`);
    return {
      success: true,
      data: data || []
    };

  } catch (error) {
    console.error('❌ Erro ao buscar produtos:', error);
    return {
      success: false,
      error: 'Erro ao conectar com servidor',
      data: []
    };
  }
}

export async function addProduto(cardId, produto) {
  try {
    console.log('➕ Adicionando produto:', cardId);

    const { data: card } = await supabase
      .from('cards')
      .select('name')
      .eq('id', cardId)
      .single();

    if (!card) {
      return {
        success: false,
        error: 'Card não encontrado'
      };
    }

    const tabelaPersonalizada = sanitizeTableName(card.name);

    const produtoData = {
      id_card: cardId,
      nome_card: card.name,
      nome_produto: produto.nome || '',
      preco: parseFloat(produto.preco) || 0,
      imagem: produto.imagem || null,
      link: produto.link || null,
      categoria: produto.categoria || null,
      descricao: produto.descricao || null,
      importancia: convertImportanciaToNumber(produto.importancia),
      tabela_personalizada: tabelaPersonalizada,
      ordem: produto.ordem || 0
    };

    const { data, error } = await supabase
      .from('tabelas_card')
      .insert([produtoData])
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao adicionar produto:', error);
      return {
        success: false,
        error: 'Erro ao adicionar produto: ' + error.message
      };
    }

    console.log('✅ Produto adicionado');
    await atualizarResumoCard(cardId);
    
    return {
      success: true,
      data: data
    };

  } catch (error) {
    console.error('❌ Erro ao adicionar produto:', error);
    return {
      success: false,
      error: 'Erro ao conectar com servidor'
    };
  }
}

export async function updateProduto(cardId, produtoId, fields) {
  try {
    console.log('✏️ Atualizando produto:', produtoId);

    const updateData = {};
    
    if (fields.nome !== undefined) updateData.nome_produto = fields.nome;
    if (fields.preco !== undefined) updateData.preco = parseFloat(fields.preco) || 0;
    if (fields.imagem !== undefined) updateData.imagem = fields.imagem;
    if (fields.link !== undefined) updateData.link = fields.link;
    if (fields.categoria !== undefined) updateData.categoria = fields.categoria;
    if (fields.descricao !== undefined) updateData.descricao = fields.descricao;
    if (fields.importancia !== undefined) updateData.importancia = convertImportanciaToNumber(fields.importancia);
    if (fields.ordem !== undefined) updateData.ordem = fields.ordem;

    const { data, error } = await supabase
      .from('tabelas_card')
      .update(updateData)
      .eq('id', produtoId)
      .eq('id_card', cardId)
      .select();

    if (error) {
      console.error('❌ Erro ao atualizar produto:', error);
      return {
        success: false,
        error: 'Erro ao atualizar produto: ' + error.message
      };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        error: 'Produto não encontrado'
      };
    }

    console.log('✅ Produto atualizado');
    await atualizarResumoCard(cardId);
    
    return {
      success: true,
      data: data[0]
    };

  } catch (error) {
    console.error('❌ Erro ao atualizar produto:', error);
    return {
      success: false,
      error: 'Erro ao conectar com servidor'
    };
  }
}

export async function deleteProduto(cardId, produtoId) {
  try {
    console.log('🗑️ Deletando produto:', produtoId);

    const { data, error } = await supabase
      .from('tabelas_card')
      .delete()
      .eq('id', produtoId)
      .eq('id_card', cardId)
      .select();

    if (error) {
      console.error('❌ Erro ao deletar produto:', error);
      return {
        success: false,
        error: 'Erro ao deletar produto: ' + error.message
      };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        error: 'Produto não encontrado'
      };
    }

    console.log('✅ Produto deletado');
    await atualizarResumoCard(cardId);
    
    return {
      success: true
    };

  } catch (error) {
    console.error('❌ Erro ao deletar produto:', error);
    return {
      success: false,
      error: 'Erro ao conectar com servidor'
    };
  }
}

export async function reordenarProdutos(cardId, produtoIds) {
  try {
    console.log('🔄 Reordenando produtos...');

    for (let i = 0; i < produtoIds.length; i++) {
      await supabase
        .from('tabelas_card')
        .update({ ordem: i })
        .eq('id', produtoIds[i])
        .eq('id_card', cardId);
    }

    console.log('✅ Produtos reordenados');
    return { success: true };

  } catch (error) {
    console.error('❌ Erro ao reordenar produtos:', error);
    return {
      success: false,
      error: 'Erro ao reordenar produtos'
    };
  }
}

async function atualizarResumoCard(cardId) {
  try {
    console.log('🔄 Atualizando resumo do card:', cardId);

    const { data: produtos, error: produtosError } = await supabase
      .from('tabelas_card')
      .select('preco')
      .eq('id_card', cardId);

    if (produtosError) {
      console.error('❌ Erro ao buscar produtos:', produtosError);
      return { success: false };
    }

    const quantidade = produtos?.length || 0;
    const valorTotal = produtos?.reduce((sum, p) => sum + (parseFloat(p.preco) || 0), 0) || 0;

    const { error: updateError } = await supabase
      .from('cards')
      .update({
        quantidade_produtos: quantidade,
        valor_total: valorTotal
      })
      .eq('id', cardId);

    if (updateError) {
      console.error('❌ Erro ao atualizar resumo:', updateError);
      return { success: false };
    }

    console.log(`✅ Resumo atualizado: ${quantidade} produtos, R$ ${valorTotal.toFixed(2)}`);
    return { success: true };

  } catch (error) {
    console.error('❌ Erro ao atualizar resumo:', error);
    return { success: false };
  }
}

// ========================================
// SEÇÃO 5: UTILITÁRIOS E TESTES
// ========================================

export async function testSupabaseConnection() {
  try {
    const { data, error } = await supabase
      .from('cards')
      .select('count')
      .limit(1);

    if (error) {
      console.error('❌ Erro ao conectar com Supabase:', error);
      return false;
    }

    console.log('✅ Conexão com Supabase funcionando');
    return true;
    
  } catch (error) {
    console.error('❌ Erro ao testar conexão:', error);
    return false;
  }
}

export { supabase };
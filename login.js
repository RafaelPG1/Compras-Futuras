// ============================================
// login.js - Sistema de Login Manual + Toggle Password
// ============================================

import { 
  validateManualLogin,
  clearUserSession
} from './supabase.js';

// ========================================
// VARIÁVEIS GLOBAIS
// ========================================

const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const togglePasswordBtn = document.getElementById('togglePassword');
const eyeIcon = document.querySelector('.eye-icon');
const eyeOffIcon = document.querySelector('.eye-off-icon');

let isLoading = false;

// ========================================
// INICIALIZAÇÃO DA APLICAÇÃO
// ========================================

document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 Aplicação de Login inicializada');
  
  // Limpa qualquer sessão anterior ao carregar a página
  clearUserSession();
  
  // Configura listeners de eventos
  setupEventListeners();
  setupPasswordToggle();
});

// ========================================
// CONFIGURAÇÃO DE EVENTOS
// ========================================

/**
 * Configura todos os event listeners da página
 */
function setupEventListeners() {
  // Login manual via formulário
  loginForm.addEventListener('submit', handleManualLogin);
}

/**
 * Configura a funcionalidade do toggle de senha
 */
function setupPasswordToggle() {
  /**
   * Alterna entre mostrar e esconder a senha
   */
  togglePasswordBtn.addEventListener('click', function(e) {
    e.preventDefault();

    // Verifica o tipo atual do input
    const isPassword = passwordInput.type === 'password';

    // Alterna o tipo do input
    if (isPassword) {
      passwordInput.type = 'text';
      eyeIcon.style.display = 'none';
      eyeOffIcon.style.display = 'block';
    } else {
      passwordInput.type = 'password';
      eyeIcon.style.display = 'block';
      eyeOffIcon.style.display = 'none';
    }
  });

  // Opcional: Esconde a senha quando o usuário sai do input
  passwordInput.addEventListener('blur', function() {
    if (passwordInput.type === 'text') {
      // Se quiser, descomente as linhas abaixo para esconder ao desfocar
      // passwordInput.type = 'password';
      // eyeIcon.style.display = 'block';
      // eyeOffIcon.style.display = 'none';
    }
  });
}

// ========================================
// HANDLERS DE LOGIN MANUAL
// ========================================

/**
 * Processa tentativa de login manual (username + senha)
 * @param {Event} event - Evento de submit do formulário
 */
async function handleManualLogin(event) {
  event.preventDefault();
  
  // Previne múltiplas submissões simultâneas
  if (isLoading) return;
  
  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();
  
  // Validação básica
  if (!username || !password) {
    showMessage('Por favor, preencha todos os campos', 'error');
    return;
  }
  
  setLoading(true);
  
  try {
    console.log('🔐 Iniciando login manual...');
    
    // Chama função de validação no Supabase
    const result = await validateManualLogin(username, password);
    
    if (result.success) {
      showMessage('Login realizado com sucesso! ', 'success');
      
      // Aguarda 1 segundo e redireciona
      setTimeout(() => {
        redirectToApp();
      }, 1000);
      
    } else {
      showMessage(result.error || 'Usuário ou senha incorretos', 'error');
    }
    
  } catch (error) {
    console.error('❌ Erro no login manual:', error);
    showMessage('Erro ao processar login. Tente novamente.', 'error');
  } finally {
    setLoading(false);
  }
}

// ========================================
// FUNÇÕES DE UI E FEEDBACK
// ========================================

/**
 * Controla estado de carregamento da interface
 * Bloqueia interações enquanto processa login
 * @param {boolean} loading - true para ativar loading, false para desativar
 */
function setLoading(loading) {
  isLoading = loading;
  const loginCard = document.querySelector('.login-card');
  
  if (loading) {
    // Adiciona overlay de loading
    loginCard.style.opacity = '0.6';
    loginCard.style.pointerEvents = 'none';
    loginCard.style.filter = 'blur(1px)';
  } else {
    // Remove overlay
    loginCard.style.opacity = '1';
    loginCard.style.pointerEvents = 'auto';
    loginCard.style.filter = 'none';
  }
  
  // Desabilita todos os botões durante loading
  const buttons = document.querySelectorAll('.btn');
  buttons.forEach(btn => {
    btn.disabled = loading;
    btn.style.cursor = loading ? 'not-allowed' : 'pointer';
  });
}

/**
 * Exibe mensagem de feedback para o usuário
 * Mensagem aparece no canto superior direito e desaparece automaticamente
 * @param {string} message - Texto da mensagem
 * @param {string} type - Tipo da mensagem: 'success' ou 'error'
 */
function showMessage(message, type) {
  // Remove mensagem anterior se existir
  const existingMessage = document.querySelector('.message');
  if (existingMessage) {
    existingMessage.remove();
  }
  
  // Cria elemento da mensagem
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${type}`;
  messageDiv.textContent = message;
  
  // Estilos inline para a mensagem
  messageDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 24px;
    border-radius: 12px;
    color: white;
    font-weight: 500;
    font-size: 15px;
    z-index: 1000;
    animation: slideIn 0.3s ease-out;
    max-width: 400px;
    word-wrap: break-word;
    box-shadow: 0 8px 24px rgba(0,0,0,0.2);
  `;
  
  // Define cor de fundo baseada no tipo
  if (type === 'success') {
    messageDiv.style.backgroundColor = '#10b981';
  } else if (type === 'error') {
    messageDiv.style.backgroundColor = '#ef4444';
  }
  
  // Adiciona animação CSS se não existir
  if (!document.querySelector('#message-styles')) {
    const style = document.createElement('style');
    style.id = 'message-styles';
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(400px);
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
          transform: translateX(400px);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(messageDiv);
  
  // Remove mensagem após 4 segundos
  setTimeout(() => {
    if (messageDiv.parentNode) {
      messageDiv.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => messageDiv.remove(), 300);
    }
  }, 4000);
}

/**
 * Redireciona para a área logada da aplicação
 */
function redirectToApp() {
  console.log('🚀 Redirecionando para área logada...');
  
  // Aguarda animação e redireciona
  setTimeout(() => {
    window.location.href = 'card/card.html';
  }, 500);
}

// ========================================
// FUNÇÃO DE LOGOUT (exportada para outras páginas)
// ========================================

/**
 * Realiza logout do usuário e redireciona para login
 * Pode ser importada em outras páginas: import { logout } from './login.js'
 */
export async function logout() {
  try {
    clearUserSession();
    
    showMessage('Logout realizado com sucesso!', 'success');
    
    setTimeout(() => {
      window.location.href = '/';
    }, 1000);
    
  } catch (error) {
    console.error('❌ Erro no logout:', error);
    showMessage('Erro ao fazer logout', 'error');
  }
}

// Exporta funções auxiliares para uso em outros arquivos
export { showMessage, setLoading, redirectToApp };
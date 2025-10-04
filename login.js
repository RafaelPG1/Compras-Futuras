//login.js - raiz do projeto
import { 
  signInWithGoogle, 
  signOutUser, 
  onAuthChange, 
  validateManualLogin, 
  isManualSessionValid, 
  clearManualSession 
} from './firebase.js';

const loginForm = document.getElementById('loginForm');
const googleLoginBtn = document.getElementById('googleLogin');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');

let isLoading = false;
let userLoginAction = false;

document.addEventListener('DOMContentLoaded', function() {
  console.log('Aplicação inicializada');
  checkExistingSession();
  setupEventListeners();
});

function checkExistingSession() {
  // Verifica sessão manual
  const manualSession = isManualSessionValid();
  if (manualSession) {
    console.log('Sessão manual válida encontrada');
    redirectToApp();
    return;
  }
  
  // Verifica se há usuário Google já logado
  onAuthChange((user) => {
    if (user && !userLoginAction) {
      // Verifica se é login manual (anônimo) ou Google
      const sessionData = localStorage.getItem('userSession');
      
      if (sessionData) {
        try {
          const session = JSON.parse(sessionData);
          if (session.loginType === 'manual') {
            console.log('Usuário manual já estava logado:', session.username);
            redirectToApp();
            return;
          }
        } catch (error) {
          console.error('Erro ao verificar sessão:', error);
        }
      }
      
      // Se tem email, é login Google
      if (user.email) {
        console.log('Usuário Google já estava logado:', user.email);
        const lastLoginTime = localStorage.getItem('lastGoogleLogin');
        const currentTime = Date.now();
        
        if (lastLoginTime && (currentTime - parseInt(lastLoginTime)) < 5 * 60 * 1000) {
          redirectToApp();
        }
      }
    }
  });
}

function setupEventListeners() {
  loginForm.addEventListener('submit', handleManualLogin);
  
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', function(e) {
      e.preventDefault();
      userLoginAction = true;
      handleGoogleLogin();
    });
  }
  
  onAuthChange((user) => {
    if (user && userLoginAction) {
      // Verifica se é login Google (tem email)
      if (user.email) {
        console.log('Login Google bem-sucedido:', user.email);
        localStorage.setItem('lastGoogleLogin', Date.now().toString());
        redirectToApp();
      }
      userLoginAction = false;
    }
  });
}

async function handleManualLogin(event) {
  event.preventDefault();
  
  if (isLoading) return;
  
  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();
  
  if (!username || !password) {
    showMessage('Por favor, preencha todos os campos', 'error');
    return;
  }
  
  setLoading(true);
  
  try {
    const result = await validateManualLogin(username, password);
    
    if (result.success) {
      showMessage('Login realizado com sucesso!', 'success');
      
      // IMPORTANTE: Aguardar a autenticação estar pronta antes de redirecionar
      const { onAuthChange } = await import('./firebase.js');
      
      const unsubscribe = onAuthChange((user) => {
        if (user) {
          console.log('Autenticação confirmada, redirecionando...');
          unsubscribe(); // Cancelar listener
          setTimeout(() => {
            redirectToApp();
          }, 500);
        }
      });
      
      // Timeout de segurança caso o listener não funcione
      setTimeout(() => {
        unsubscribe();
        redirectToApp();
      }, 3000);
      
    } else {
      showMessage(result.error, 'error');
    }
  } catch (error) {
    showMessage('Erro no servidor. Tente novamente.', 'error');
    console.error('Erro no login manual:', error);
  } finally {
    setLoading(false);
  }
}

async function handleGoogleLogin() {
  if (isLoading) return;
  
  setLoading(true);
  
  try {
    const result = await signInWithGoogle();
    
    if (result.success) {
      showMessage('Login com Google realizado com sucesso!', 'success');
    } else {
      showMessage(result.error, 'error');
      userLoginAction = false;
    }
  } catch (error) {
    console.error('Erro no login Google:', error);
    showMessage('Erro no login com Google. Tente novamente.', 'error');
    userLoginAction = false;
  } finally {
    setLoading(false);
  }
}

function setLoading(loading) {
  isLoading = loading;
  const loginCard = document.querySelector('.login-card');
  
  if (loading) {
    loginCard.style.opacity = '0.7';
    loginCard.style.pointerEvents = 'none';
  } else {
    loginCard.style.opacity = '1';
    loginCard.style.pointerEvents = 'auto';
  }
  
  const buttons = document.querySelectorAll('.btn');
  buttons.forEach(btn => {
    btn.disabled = loading;
    btn.style.cursor = loading ? 'not-allowed' : 'pointer';
  });
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
    border-radius: 5px;
    color: white;
    font-weight: 500;
    z-index: 1000;
    animation: slideIn 0.3s ease-in-out;
    max-width: 300px;
    word-wrap: break-word;
  `;
  
  if (type === 'success') {
    messageDiv.style.backgroundColor = '#4CAF50';
  } else if (type === 'error') {
    messageDiv.style.backgroundColor = '#f44336';
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
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(messageDiv);
  
  setTimeout(() => {
    if (messageDiv.parentNode) {
      messageDiv.style.animation = 'slideIn 0.3s ease-in-out reverse';
      setTimeout(() => {
        messageDiv.remove();
      }, 300);
    }
  }, 4000);
}

function redirectToApp() {
  showMessage('Login realizado! Redirecionando...', 'success');
  
  setTimeout(() => {
    window.location.href = 'card/card.html';
  }, 1500);
}

async function logout() {
  try {
    clearManualSession();
    await signOutUser();
    localStorage.removeItem('lastGoogleLogin');
    
    showMessage('Logout realizado com sucesso!', 'success');
    
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  } catch (error) {
    showMessage('Erro no logout', 'error');
    console.error('Erro no logout:', error);
  }
}

export { showMessage, setLoading, redirectToApp, logout };

// Detecta movimento da rodinha do mouse
window.addEventListener("wheel", function(event) {
    // Impede o scroll padrão (opcional)
    // event.preventDefault();

    // Detecta direção
    if (event.deltaY > 0) {
        console.log("Scroll para baixo");
        // Exemplo: rolar 100px para baixo
        window.scrollBy({
            top: 100,
            behavior: "smooth"
        });
    } else {
        console.log("Scroll para cima");
        // Exemplo: rolar 100px para cima
        window.scrollBy({
            top: -100,
            behavior: "smooth"
        });
    }
});
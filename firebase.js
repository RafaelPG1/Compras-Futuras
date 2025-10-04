//firebase.js - raiz do projeto
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs,
  getDoc,
  query, 
  where, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA3ppuk0EUCaOtHx8vdraUrXgVQ9tVftvQ",
  authDomain: "compras-futuras-1752e.firebaseapp.com",
  projectId: "compras-futuras-1752e",
  storageBucket: "compras-futuras-1752e.firebasestorage.app",
  messagingSenderId: "491600236139",
  appId: "1:491600236139:web:27deeeb921f25a157f6b2e",
  measurementId: "G-T8GQ8BLPXW"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

provider.setCustomParameters({
  prompt: 'select_account'
});

function waitForAuth() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

async function checkGoogleEmailAuthorization(email) {
  try {
    const usuariosDoc = await getDocs(query(collection(db, 'config'), where('tipo', '==', 'usuarios')));
    if (!usuariosDoc.empty) {
      const data = usuariosDoc.docs[0].data();
      return !data.ComGoogle || data.ComGoogle.some(user => user.email === email);
    }
    return true;
  } catch (error) {
    console.error('Erro ao verificar autorização:', error);
    return true;
  }
}

export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    const isAuthorized = await checkGoogleEmailAuthorization(user.email);
    if (!isAuthorized) {
      await signOut(auth);
      throw new Error('Email não autorizado para acesso');
    }
    
    saveUserToFirestore(user).catch(console.error);
    return { success: true, user: user };
  } catch (error) {
    console.error('Erro no login Google:', error);
    
    if (error.code === 'auth/popup-closed-by-user') {
      return { success: false, error: 'Login cancelado pelo usuário' };
    } else if (error.code === 'auth/unauthorized-domain') {
      return { success: false, error: 'Domínio não autorizado no Firebase Console' };
    }
    
    return { success: false, error: error.message };
  }
}

export async function signOutUser() {
  try {
    await signOut(auth);
    localStorage.removeItem('userSession');
    return { success: true };
  } catch (error) {
    console.error('Erro no logout:', error);
    return { success: false, error: error.message };
  }
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

async function saveUserToFirestore(user) {
  try {
    const q = query(collection(db, 'users'), where('email', '==', user.email));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      await addDoc(collection(db, 'users'), {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        loginType: 'google'
      });
    } else {
      const userDoc = querySnapshot.docs[0];
      await updateDoc(userDoc.ref, {
        lastLogin: serverTimestamp(),
        displayName: user.displayName || '',
        photoURL: user.photoURL || ''
      });
    }
  } catch (error) {
    console.error('Erro ao salvar usuário no Firestore:', error);
  }
}

export async function validateManualLogin(username, password) {
  try {
    const usuariosDoc = await getDocs(query(collection(db, 'config'), where('tipo', '==', 'usuarios')));
    
    if (usuariosDoc.empty) {
      return { success: false, error: 'Configuração de usuários não encontrada' };
    }
    
    const data = usuariosDoc.docs[0].data();
    const semGoogleUsers = data.SemGoogle || [];
    
    const validUser = semGoogleUsers.find(user => 
      user.usuario === username && user.senha === password
    );
    
    if (!validUser) {
      return { success: false, error: 'Usuário ou senha inválidos' };
    }
    
    try {
      console.log('Iniciando autenticação anônima...');
      const { signInAnonymously } = await import("https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js");
      const userCredential = await signInAnonymously(auth);
      console.log('Autenticação anônima criada:', userCredential.user.uid);
      
      await saveManualUserToFirestore(validUser, userCredential.user.uid);
      console.log('Usuário salvo no Firestore');
      
      const sessionData = {
        username: validUser.usuario,
        loginType: 'manual',
        uid: userCredential.user.uid,
        loginTime: Date.now()
      };
      
      localStorage.setItem('userSession', JSON.stringify(sessionData));
      console.log('Sessão salva no localStorage');
      
      return { success: true, user: validUser, uid: userCredential.user.uid };
    } catch (authError) {
      console.error('Erro ao criar autenticação anônima:', authError);
      return { success: false, error: 'Erro ao autenticar usuário: ' + authError.message };
    }
  } catch (error) {
    console.error('Erro na validação do login manual:', error);
    return { success: false, error: error.message };
  }
}

async function saveManualUserToFirestore(user, uid) {
  try {
    const email = user.usuario + '@manual.local';
    const userRef = doc(db, 'users', uid);
    
    await setDoc(userRef, {
      uid: uid,
      email: email,
      displayName: user.usuario,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      loginType: 'manual'
    }, { merge: true });
    
  } catch (error) {
    console.error('Erro ao salvar usuário manual no Firestore:', error);
  }
}

export function isManualSessionValid() {
  const sessionData = localStorage.getItem('userSession');
  if (sessionData) {
    try {
      const session = JSON.parse(sessionData);
      if (session.loginType === 'manual' && session.uid) {
        return session;
      }
    } catch (error) {
      console.error('Erro ao validar sessão:', error);
    }
  }
  
  localStorage.removeItem('userSession');
  return false;
}

export function clearManualSession() {
  localStorage.removeItem('userSession');
  signOut(auth).catch(console.error);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

export async function uploadImage(file, userId) {
  try {
    if (!file) {
      return { success: false, error: 'Nenhum arquivo selecionado' };
    }
    
    if (!file.type.startsWith('image/')) {
      return { success: false, error: 'Apenas imagens são permitidas' };
    }
    
    if (file.size > 10 * 1024 * 1024) {
      return { success: false, error: 'Imagem deve ter no máximo 10MB' };
    }
    
    const base64Url = await fileToBase64(file);
    
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const fileName = `base64_${userId.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}_${randomString}.${file.name.split('.').pop() || 'jpg'}`;
    
    return { 
      success: true, 
      url: base64Url,
      fileName: fileName
    };
    
  } catch (error) {
    console.error('Erro ao converter imagem:', error);
    return { success: false, error: 'Erro ao processar imagem: ' + error.message };
  }
}

export async function deleteImage(fileName) {
  return { success: true };
}

// No seu firebase.js, substitua a função createCard por esta versão:
// (procure por "export async function createCard" e substitua)

export async function createCard(name, description, file, userId) {
  try {
    await waitForAuth();
    
    let imageUrl = '';
    let imageFileName = '';
    
    if (file) {
      const uploadResult = await uploadImage(file, userId);
      if (uploadResult.success) {
        imageUrl = uploadResult.url;
        imageFileName = uploadResult.fileName;
      } else {
        return { success: false, error: 'Erro ao processar imagem: ' + uploadResult.error };
      }
    }
    
    // Dados do card incluindo shippingCost inicializado em 0
    const cardData = {
      createdAt: serverTimestamp(),
      description: description || '',
      imageFileName: imageFileName,
      imageUrl: imageUrl,
      name: name,
      userId: userId,
      shippingCost: 0,  // ← Campo de frete inicializado
      products: [],      // ← Array de produtos vazio
      customColumns: []  // ← Array de colunas customizadas vazio
    };
    
    const docRef = await addDoc(collection(db, 'cards'), cardData);
    
    return { 
      success: true, 
      id: docRef.id,
      imageUrl: imageUrl,
      imageFileName: imageFileName
    };
  } catch (error) {
    console.error('Erro ao criar card:', error);
    return { success: false, error: error.message };
  }
}

export async function updateCard(cardId, name, description, file, userId, currentImageFileName) {
  try {
    await waitForAuth();
    
    let imageUrl = '';
    let imageFileName = '';
    
    if (file === 'DELETE_IMAGE') {
      imageUrl = '';
      imageFileName = '';
    }
    else if (file && typeof file === 'object') {
      const uploadResult = await uploadImage(file, userId);
      if (uploadResult.success) {
        imageUrl = uploadResult.url;
        imageFileName = uploadResult.fileName;
      } else {
        return { success: false, error: 'Erro ao processar imagem: ' + uploadResult.error };
      }
    }
    else {
      const cardRef = doc(db, 'cards', cardId);
      const cardDoc = await getDoc(cardRef);
      if (cardDoc.exists()) {
        const cardData = cardDoc.data();
        imageUrl = cardData.imageUrl || '';
        imageFileName = cardData.imageFileName || '';
      }
    }
    
    const cardData = {
      description: description || '',
      imageFileName: imageFileName,
      imageUrl: imageUrl,
      name: name,
      updatedAt: serverTimestamp()
    };
    
    const cardRef = doc(db, 'cards', cardId);
    await updateDoc(cardRef, cardData);
    
    return { 
      success: true,
      imageUrl: imageUrl,
      imageFileName: imageFileName
    };
  } catch (error) {
    console.error('Erro ao atualizar card:', error);
    return { success: false, error: error.message };
  }
}

export async function getUserCards() {
  try {
    await waitForAuth();
    
    const q = query(
      collection(db, 'cards'),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    
    const cards = [];
    querySnapshot.forEach((doc) => {
      cards.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return { success: true, cards };
  } catch (error) {
    console.error('Erro ao buscar cards:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteCard(cardId) {
  try {
    await waitForAuth();
    
    await deleteDoc(doc(db, 'cards', cardId));
    
    return { success: true };
  } catch (error) {
    console.error('Erro ao deletar card:', error);
    return { success: false, error: error.message };
  }
}

export { 
  auth, 
  db, 
  collection, 
  addDoc, 
  getDocs,
  getDoc,
  query, 
  where, 
  doc, 
  updateDoc, 
  deleteDoc, 
  orderBy, 
  serverTimestamp
};
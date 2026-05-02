import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCfEeLIRLwiR8pLU063g9FPKzW3Y36j6Xw",
  authDomain: "kavyatransport-552e4.firebaseapp.com",
  projectId: "kavyatransport-552e4",
  storageBucket: "kavyatransport-552e4.firebasestorage.app",
  messagingSenderId: "434834908867",
  appId: "1:434834908867:web:5b4849a14eb19bc0dea476"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

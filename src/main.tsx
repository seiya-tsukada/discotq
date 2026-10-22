import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { runStorageMigrations } from './lib/migrations';

runStorageMigrations();

createRoot(document.getElementById('root')!).render(<App />);

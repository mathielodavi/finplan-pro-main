
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { ClienteProvider } from './context/ClienteContext';
import { ContratoProvider } from './context/ContratoContext';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './components/Layout/MainLayout';

// Views
import Login from './views/Login';
import ResetPassword from './views/ResetPassword';
import NewPassword from './views/NewPassword';
import Dashboard from './views/Dashboard';
import ClientesPage from './views/ClientesPage';
import ProntuarioPage from './views/ProntuarioPage';
import ConfiguracoesPage from './views/ConfiguracoesPage';
import ConciliacaoPage from './views/ConciliacaoPage';
import CarteiraPage from './views/CarteiraPage';
import NotFoundPage from './views/NotFoundPage';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ClienteProvider>
        <ContratoProvider>
          <div className="min-h-screen bg-slate-50">
            <Routes>
              {/* Rotas Públicas */}
              <Route path="/login" element={<Login />} />
              <Route path="/recuperar-senha" element={<ResetPassword />} />
              <Route path="/redefinir-senha" element={<NewPassword />} />

              {/* Rotas Protegidas com Layout Principal */}
              <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/clientes" element={<ClientesPage />} />
                <Route path="/clientes/:id" element={<ProntuarioPage />} />
                <Route path="/configuracoes" element={<ConfiguracoesPage />} />
                <Route path="/configuracoes/:tab" element={<ConfiguracoesPage />} />
                <Route path="/conciliacao" element={<ConciliacaoPage />} />
                <Route path="/carteira" element={<CarteiraPage />} />
              </Route>

              {/* Redirecionamento Padrão */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </div>
        </ContratoProvider>
      </ClienteProvider>
    </AuthProvider>
  );
};

export default App;

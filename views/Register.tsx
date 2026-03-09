
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import AuthLayout from '../components/AuthLayout';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const queryParams = new URLSearchParams(location.search || location.hash.split('?')[1]);
  const emailParam = queryParams.get('email') || '';

  const [name, setName] = useState('');
  const [email, setEmail] = useState(emailParam);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const { register, loading, error } = useAuth();

  useEffect(() => {
    if (emailParam) setEmail(emailParam);
  }, [emailParam]);

  const validatePassword = (pass: string) => {
    const hasUpper = /[A-Z]/.test(pass);
    const hasNumber = /[0-9]/.test(pass);
    const hasSpecial = /[!@#$%^&*()_+]/.test(pass);
    return pass.length >= 8 && hasUpper && hasNumber && hasSpecial;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!name || !email || !password) {
      setLocalError('Preencha todos os campos obrigatórios.');
      return;
    }

    if (password !== confirmPassword) {
      setLocalError('As senhas não coincidem.');
      return;
    }

    if (!validatePassword(password)) {
      setLocalError('A senha deve ter 8+ caracteres, 1 maiúscula, 1 número e 1 símbolo.');
      return;
    }

    try {
      await register(email, password, name);
      alert('Conta criada! Verifique seu e-mail para confirmar a ativação e liberar seu acesso.');
      navigate('/login');
    } catch (err: any) {
      // Erro tratado pelo hook
    }
  };

  return (
    <AuthLayout title="Criar sua Conta" subtitle="Crie seu acesso ao Vibe Financeiro">
      <form className="space-y-4 mt-8" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-semibold text-slate-700">Nome Completo</label>
          <input
            type="text"
            required
            className="mt-1 block w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ex: João da Silva"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700">Email de Acesso</label>
          <input
            type="email"
            required
            className="mt-1 block w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700">Senha</label>
            <input
              type="password"
              required
              className="mt-1 block w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700">Confirmar</label>
            <input
              type="password"
              required
              className="mt-1 block w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        </div>

        {(error || localError) && (
          <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200 font-bold">
            {localError || error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 disabled:opacity-50 transition-all"
        >
          {loading ? 'Processando...' : 'Criar Minha Conta'}
        </button>

        <div className="text-center pt-2">
          <Link to="/login" className="text-sm font-bold text-slate-500 hover:text-blue-600">Já tem acesso? Faça Login</Link>
        </div>
      </form>
    </AuthLayout>
  );
};

export default Register;

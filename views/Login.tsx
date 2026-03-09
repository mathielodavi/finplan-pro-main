
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import AuthLayout from '../components/AuthLayout';
import Button from '../components/UI/Button';
import { LogIn, ShieldCheck, Mail, Lock } from 'lucide-react';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const { login, loading, error } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email || !password) {
      setLocalError('Preencha as credenciais de acesso.');
      return;
    }

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) { }
  };

  return (
    <AuthLayout title="Painel do Consultor" subtitle="Tulipa Plan Pro">
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div className="relative group">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">E-mail Corporativo</label>
            <div className="relative">
              <input
                type="email"
                required
                className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 placeholder:text-slate-300 outline-none focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-600 focus:bg-white transition-all text-sm"
                placeholder="exemplo@tulipa.tech"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Mail size={18} className="absolute right-5 top-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
            </div>
          </div>

          <div className="relative group">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Chave de Segurança</label>
              <Link to="/recuperar-senha" title="Esqueceu a senha?" className="text-[10px] font-black text-emerald-600 hover:text-emerald-700 uppercase tracking-tighter transition-colors">
                Recuperar Acesso
              </Link>
            </div>
            <div className="relative">
              <input
                type="password"
                required
                className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 placeholder:text-slate-300 outline-none focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-600 focus:bg-white transition-all text-sm"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Lock size={18} className="absolute right-5 top-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
            </div>
          </div>
        </div>

        {(error || localError) && (
          <div className="p-4 bg-rose-50 text-rose-600 text-xs font-bold rounded-2xl border border-rose-100 animate-slide-up flex items-center gap-3">
            <div className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
            {localError || error}
          </div>
        )}

        <Button
          type="submit"
          isLoading={loading}
          className="w-full py-5 text-xs font-black uppercase tracking-[0.2em] rounded-2xl shadow-2xl shadow-emerald-500/10"
          variant="primary"
          leftIcon={<LogIn size={18} />}
        >
          Autenticar Agora
        </Button>

        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 font-bold uppercase">
            <ShieldCheck size={12} className="text-emerald-500" />
            Ambiente Criptografado SSL
          </div>
          <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
            Acesso exclusivo para planejadores autorizados.<br />
            Tulipa Plan Pro &copy; {new Date().getFullYear()}
          </p>
        </div>
      </form>
    </AuthLayout>
  );
};

export default Login;


import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { updatePassword } from '../services/authService';
import AuthLayout from '../components/AuthLayout';
import Button from '../components/UI/Button';
import { Lock, Eye, EyeOff } from 'lucide-react';

const NewPassword: React.FC = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    try {
      setLoading(true);
      await updatePassword(password);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Nova Senha" subtitle="Tulipa Plan Pro">
      <form className="space-y-6 mt-6" onSubmit={handleSubmit}>
        <div className="relative group">
          <div className="absolute left-4 top-4 text-slate-300 group-focus-within:text-emerald-600 transition-colors">
            <Lock size={18} />
          </div>
          <input
            type={showPassword ? 'text' : 'password'}
            required
            className="w-full pl-12 pr-12 py-3.5 border-2 border-slate-100 rounded-2xl bg-slate-50/50 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 outline-none font-semibold text-sm text-slate-800 transition-all"
            placeholder="Nova senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-4 text-slate-300 hover:text-emerald-600 transition-colors"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <div className="relative group">
          <div className="absolute left-4 top-4 text-slate-300 group-focus-within:text-emerald-600 transition-colors">
            <Lock size={18} />
          </div>
          <input
            type={showPassword ? 'text' : 'password'}
            required
            className="w-full pl-12 pr-4 py-3.5 border-2 border-slate-100 rounded-2xl bg-slate-50/50 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 outline-none font-semibold text-sm text-slate-800 transition-all"
            placeholder="Confirme a nova senha"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        {error && (
          <div className="p-4 bg-rose-50 text-rose-600 text-xs font-bold rounded-2xl border-2 border-rose-100">
            {error}
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-2xl border-2 border-emerald-100">
            Senha atualizada com sucesso! Redirecionando...
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          isLoading={loading}
          className="w-full py-3.5 uppercase text-xs tracking-widest shadow-xl shadow-emerald-200"
        >
          Redefinir Senha
        </Button>

        <div className="text-center">
          <Link to="/login" className="text-xs font-bold text-slate-400 hover:text-emerald-600 transition-colors">
            ← Voltar para o login
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
};

export default NewPassword;


import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import AuthLayout from '../components/AuthLayout';
import Button from '../components/UI/Button';
import { Mail, ArrowLeft } from 'lucide-react';

const ResetPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const { resetPass, loading, error } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await resetPass(email);
      setSent(true);
    } catch (err) { }
  };

  if (sent) {
    return (
      <AuthLayout title="Email enviado!" subtitle="Tulipa Plan Pro">
        <div className="mt-6 text-center space-y-6">
          <div className="p-5 bg-emerald-50 border-2 border-emerald-100 rounded-2xl">
            <p className="text-sm text-emerald-800 font-semibold">
              Enviamos um link de recuperação para <strong>{email}</strong>.
            </p>
            <p className="text-xs text-emerald-600 mt-2">
              Verifique sua caixa de entrada e siga as instruções para redefinir a senha.
            </p>
          </div>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 w-full justify-center py-3.5 px-4 bg-emerald-600 text-white rounded-2xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
          >
            <ArrowLeft size={16} />
            Voltar para Login
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Recuperar Senha" subtitle="Tulipa Plan Pro">
      <form className="space-y-6 mt-6" onSubmit={handleSubmit}>
        <div className="relative group">
          <div className="absolute left-4 top-4 text-slate-300 group-focus-within:text-emerald-600 transition-colors">
            <Mail size={18} />
          </div>
          <input
            type="email"
            required
            className="w-full pl-12 pr-4 py-3.5 border-2 border-slate-100 rounded-2xl bg-slate-50/50 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/5 outline-none font-semibold text-sm text-slate-800 transition-all"
            placeholder="Informe seu email de cadastro"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {error && (
          <div className="p-4 bg-rose-50 text-rose-600 text-xs font-bold rounded-2xl border-2 border-rose-100">
            {error}
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          isLoading={loading}
          className="w-full py-3.5 uppercase text-xs tracking-widest shadow-xl shadow-emerald-200"
        >
          Enviar link de recuperação
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

export default ResetPassword;

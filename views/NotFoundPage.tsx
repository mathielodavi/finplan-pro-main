import React from 'react';
import { Link } from 'react-router-dom';
import { Home, AlertTriangle } from 'lucide-react';

const NotFoundPage: React.FC = () => {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
            <div className="text-center space-y-8 max-w-md">
                <div className="inline-flex items-center justify-center h-20 w-20 bg-amber-50 text-amber-500 rounded-3xl mx-auto">
                    <AlertTriangle size={36} />
                </div>
                <div>
                    <h1 className="text-6xl font-black text-slate-900 tracking-tighter">404</h1>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mt-3">
                        Página não encontrada
                    </p>
                    <p className="text-sm text-slate-400 font-medium mt-4 leading-relaxed">
                        A página que você está procurando não existe ou foi movida.
                    </p>
                </div>
                <Link
                    to="/dashboard"
                    className="inline-flex items-center gap-3 px-8 py-4 bg-emerald-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-all"
                >
                    <Home size={16} />
                    Voltar ao Dashboard
                </Link>
            </div>
        </div>
    );
};

export default NotFoundPage;

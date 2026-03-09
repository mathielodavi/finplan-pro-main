
import React, { useState, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { configService } from '../../services/configuracoesService';
import Button from '../UI/Button';
import { Camera, Shield, Mail, Phone, User as UserIcon } from 'lucide-react';

const PerfilConfig: React.FC = () => {
  const { user, resetPass } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: user?.user_metadata?.full_name || '',
    email_comercial: user?.user_metadata?.email_comercial || user?.email || '',
    telefone: user?.user_metadata?.telefone || '',
    avatar_url: user?.user_metadata?.avatar_url || ''
  });
  const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      await configService.updateProfile(user!.id, formData);
      setMsg({ type: 'success', text: 'Perfil sincronizado com sucesso!' });
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setLoading(true);
      try {
        const url = await configService.uploadAvatar(user!.id, e.target.files[0]);
        setFormData({ ...formData, avatar_url: url });
        setMsg({ type: 'success', text: 'Foto de perfil atualizada!' });
      } catch (err: any) {
        setMsg({ type: 'error', text: 'Erro ao subir imagem: ' + err.message });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleResetPassword = async () => {
    if (!window.confirm("Deseja receber um link para criar uma nova senha em seu e-mail de acesso?")) return;
    try {
      setLoading(true);
      await resetPass(user!.email!);
      setMsg({ type: 'success', text: 'E-mail de redefinição enviado!' });
    } catch (err: any) {
      setMsg({ type: 'error', text: 'Erro ao enviar e-mail: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  const avatarUrl = formData.avatar_url || `https://ui-avatars.com/api/?name=${formData.full_name}&size=256&background=10b981&color=fff&bold=true`;

  const inputStyle = "w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-600 transition-all text-sm";
  const labelStyle = "block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 mb-2";

  return (
    <div className="max-w-3xl space-y-12">
      <div className="flex flex-col sm:flex-row items-center gap-10">
         <div className="relative">
            <div className="h-40 w-40 rounded-[2.5rem] border-4 border-white shadow-2xl overflow-hidden bg-slate-50 flex items-center justify-center relative">
               <img 
                 src={avatarUrl} 
                 alt="Avatar" 
                 className="h-full w-full object-cover opacity-90"
               />
               <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-slate-900/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center text-white backdrop-blur-[2px]"
               >
                  <Camera size={32} />
               </button>
               <input 
                 type="file" 
                 ref={fileInputRef} 
                 className="hidden" 
                 accept="image/*" 
                 onChange={handleFileChange} 
               />
            </div>
            <div className="absolute -bottom-2 -right-2 bg-emerald-600 text-white p-2.5 rounded-2xl shadow-lg border-2 border-white">
               <Shield size={18} />
            </div>
         </div>
         <div className="text-center sm:text-left space-y-2">
            <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Perfil Corporativo</h3>
            <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-sm">Essas informações identificam sua consultoria em relatórios, e-mails e propostas comerciais.</p>
         </div>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="md:col-span-2">
          <label className={labelStyle}>Nome do Consultor / Empresa</label>
          <div className="relative group">
             <input 
               type="text" 
               value={formData.full_name} 
               onChange={e => setFormData({...formData, full_name: e.target.value})}
               className={inputStyle} 
               placeholder="Ex: João Silva Consultoria"
             />
             <UserIcon size={18} className="absolute right-6 top-4 text-slate-300" />
          </div>
        </div>

        <div>
          <label className={labelStyle}>E-mail de Contato</label>
          <div className="relative group">
             <input 
               type="email" 
               value={formData.email_comercial} 
               onChange={e => setFormData({...formData, email_comercial: e.target.value})}
               className={inputStyle} 
               placeholder="contato@empresa.com"
             />
             <Mail size={18} className="absolute right-6 top-4 text-slate-300" />
          </div>
        </div>

        <div>
          <label className={labelStyle}>WhatsApp / Telefone</label>
          <div className="relative group">
             <input 
               type="text" 
               value={formData.telefone} 
               placeholder="(00) 00000-0000"
               onChange={e => setFormData({...formData, telefone: e.target.value})}
               className={inputStyle} 
             />
             <Phone size={18} className="absolute right-6 top-4 text-slate-300" />
          </div>
        </div>

        <div className="md:col-span-2 pt-6">
           {msg && (
             <div className={`p-4 rounded-2xl mb-8 text-xs font-black uppercase tracking-widest flex items-center gap-3 border animate-slide-up ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                {msg.type === 'success' ? '✓' : '⚠'} {msg.text}
             </div>
           )}
           <Button 
             type="submit" 
             isLoading={loading}
             className="px-12 py-4 shadow-xl shadow-emerald-200 text-xs uppercase tracking-[0.2em]"
           >
             Salvar Configurações
           </Button>
        </div>
      </form>

      <div className="pt-10 border-t border-slate-100 flex items-center justify-between">
         <div>
            <h4 className="text-sm font-bold text-slate-900 tracking-tight uppercase">Segurança de Acesso</h4>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Sua senha e chaves de criptografia</p>
         </div>
         <button 
          onClick={handleResetPassword}
          disabled={loading}
          className="text-emerald-600 font-black text-[10px] uppercase tracking-widest hover:underline px-4 py-2 bg-emerald-50 rounded-xl transition-all disabled:opacity-50"
         >
           Redefinir Senha →
         </button>
      </div>
    </div>
  );
};

export default PerfilConfig;


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

  const inputStyle = "w-full px-3 h-9 bg-surface-2 border border-subtle rounded-[8px] font-bold text-main outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-[12px]";
  const labelStyle = "block text-[10px] font-bold text-faint uppercase tracking-wider mb-1.5";

  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex flex-col sm:flex-row items-center gap-6">
         <div className="relative">
            <div className="h-24 w-24 rounded-xl border-2 border-white shadow-lg overflow-hidden bg-surface-2 flex items-center justify-center relative">
               <img 
                 src={avatarUrl} 
                 alt="Avatar" 
                 className="h-full w-full object-cover"
               />
               <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-surface-3/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center text-white backdrop-blur-[2px]"
               >
                  <Camera size={20} />
               </button>
               <input 
                 type="file" 
                 ref={fileInputRef} 
                 className="hidden" 
                 accept="image/*" 
                 onChange={handleFileChange} 
               />
            </div>
            <div className="absolute -bottom-1.5 -right-1.5 bg-indigo-600 text-white p-1.5 rounded-[8px] shadow-lg border-2 border-white">
               <Shield size={14} />
            </div>
         </div>
         <div className="text-center sm:text-left">
            <h3 className="text-[16px] font-bold text-main tracking-tight">Perfil Corporativo</h3>
            <p className="text-faint text-[11px] font-medium leading-relaxed max-w-sm mt-1">Essas informações identificam sua consultoria em relatórios, e-mails e propostas comerciais.</p>
         </div>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
             <UserIcon size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-faint" />
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
             <Mail size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-faint" />
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
             <Phone size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-faint" />
          </div>
        </div>

        <div className="md:col-span-2 pt-4">
           {msg && (
             <div className={`px-4 py-3 rounded-[8px] mb-6 text-[10px] font-bold uppercase tracking-wider flex items-center gap-3 border animate-slide-up ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                {msg.type === 'success' ? '✓' : '⚠'} {msg.text}
             </div>
           )}
           <Button 
             type="submit" 
             isLoading={loading}
             className="h-9 px-6 text-[11px] font-semibold"
           >
             Salvar Configurações
           </Button>
        </div>
      </form>

      <div className="pt-6 border-t border-subtle flex items-center justify-between">
         <div>
            <h4 className="text-[13px] font-bold text-main tracking-tight">Segurança de Acesso</h4>
            <p className="text-[10px] text-faint font-bold uppercase tracking-wider mt-0.5">Sua senha e chaves de criptografia</p>
         </div>
         <button 
          onClick={handleResetPassword}
          disabled={loading}
          className="text-indigo-600 font-bold text-[10px] uppercase tracking-wider hover:underline h-9 px-4 bg-indigo-50 rounded-[8px] border border-indigo-100 transition-all disabled:opacity-50"
         >
           Redefinir Senha →
         </button>
      </div>
    </div>
  );
};

export default PerfilConfig;

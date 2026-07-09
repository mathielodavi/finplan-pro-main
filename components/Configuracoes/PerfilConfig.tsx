
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { configService } from '../../services/configuracoesService';
import { calendarioService, CalendarioConexao, CalendarioProvedor } from '../../services/calendarioService';
import { formatarData } from '../../utils/formatadores';
import Button from '../UI/Button';
import Confirmacao from '../Confirmacao';
import { Camera, Shield, Mail, Phone, User as UserIcon, CalendarDays, RefreshCw, AlertCircle } from 'lucide-react';

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

  // ── Calendário externo (ICS) ──────────────────────────────────────────────
  const [conexao, setConexao] = useState<CalendarioConexao | null>(null);
  const [icsUrl, setIcsUrl] = useState('');
  const [provedor, setProvedor] = useState<CalendarioProvedor>('google');
  const [salvandoConexao, setSalvandoConexao] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [msgCalendario, setMsgCalendario] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [confirmarReset, setConfirmarReset] = useState(false);

  const carregarConexao = async () => {
    try {
      const c = await calendarioService.getConexao();
      setConexao(c);
      if (c) { setIcsUrl(c.ics_url); setProvedor(c.provedor); }
    } catch (err) {
      console.error('Erro ao carregar conexão de calendário:', err);
    }
  };

  useEffect(() => { carregarConexao(); }, []);

  const handleSalvarConexao = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvandoConexao(true);
    setMsgCalendario(null);
    try {
      await calendarioService.salvarConexao(icsUrl.trim(), provedor);
      await carregarConexao();
      setMsgCalendario({ type: 'success', text: 'Conexão salva! Use "Sincronizar agora" para testar.' });
    } catch (err: any) {
      setMsgCalendario({ type: 'error', text: 'Erro ao salvar conexão: ' + err.message });
    } finally {
      setSalvandoConexao(false);
    }
  };

  const handleSincronizarAgora = async () => {
    setSincronizando(true);
    setMsgCalendario(null);
    try {
      const res = await calendarioService.sincronizarAgora();
      await carregarConexao();
      if (res.ok) {
        setMsgCalendario({ type: 'success', text: 'Sincronização concluída.' });
      } else {
        setMsgCalendario({ type: 'error', text: 'Erro ao sincronizar: ' + res.erro });
      }
    } catch (err: any) {
      setMsgCalendario({ type: 'error', text: 'Erro ao sincronizar: ' + err.message });
    } finally {
      setSincronizando(false);
    }
  };

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
    setConfirmarReset(false);
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

  const inputStyle = "w-full px-3 h-9 bg-surface-2 border border-subtle rounded-[8px] font-bold text-main outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all text-[12px]";
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
            <div className="absolute -bottom-1.5 -right-1.5 bg-primary text-[#0b0e14] p-1.5 rounded-[8px] shadow-lg border-2 border-surface">
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
             <div className={`px-4 py-3 rounded-[8px] mb-6 text-[10px] font-bold uppercase tracking-wider flex items-center gap-3 border animate-slide-up ${msg.type === 'success' ? 'bg-success/10 text-success border-subtle' : 'bg-danger/10 text-danger border-subtle'}`}>
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
          onClick={() => setConfirmarReset(true)}
          disabled={loading}
          className="text-primary font-bold text-[10px] uppercase tracking-wider hover:underline h-9 px-4 bg-primary/10 rounded-[8px] border border-subtle transition-all disabled:opacity-50"
         >
           Redefinir Senha →
         </button>
      </div>

      <Confirmacao
        isOpen={confirmarReset}
        onClose={() => setConfirmarReset(false)}
        onConfirm={handleResetPassword}
        title="Redefinir Senha"
        message="Deseja receber um link para criar uma nova senha em seu e-mail de acesso?"
        danger={false}
        confirmLabel="Enviar e-mail"
      />

      <div className="pt-6 border-t border-subtle space-y-4">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-primary" />
          <div>
            <h4 className="text-[13px] font-bold text-main tracking-tight">Calendário externo</h4>
            <p className="text-[10px] text-faint font-bold uppercase tracking-wider mt-0.5">
              Visualização apenas — sem OAuth, via URL secreta de calendário (ICS)
            </p>
          </div>
        </div>

        <form onSubmit={handleSalvarConexao} className="grid grid-cols-1 md:grid-cols-[120px_1fr_auto] gap-3 items-end">
          <div>
            <label className={labelStyle}>Provedor</label>
            <select
              value={provedor}
              onChange={e => setProvedor(e.target.value as CalendarioProvedor)}
              className={inputStyle}
            >
              <option value="google">Google</option>
              <option value="microsoft">Microsoft</option>
              <option value="ics">Outro</option>
            </select>
          </div>
          <div>
            <label className={labelStyle}>URL secreta do calendário (iCal/ICS)</label>
            <input
              type="text"
              value={icsUrl}
              onChange={e => setIcsUrl(e.target.value)}
              placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
              className={inputStyle}
              required
            />
          </div>
          <Button type="submit" isLoading={salvandoConexao} className="h-9 px-4 text-[11px] font-semibold whitespace-nowrap">
            Salvar conexão
          </Button>
        </form>

        {conexao && (
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted">
            <button
              type="button"
              onClick={handleSincronizarAgora}
              disabled={sincronizando}
              className="flex items-center gap-1.5 h-8 px-3 rounded-[8px] border border-subtle text-main font-semibold hover:bg-surface-2 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={sincronizando ? 'animate-spin' : ''} />
              Sincronizar agora
            </button>
            <span>
              Última sincronização: {conexao.ultima_sync ? formatarData(conexao.ultima_sync, true) : 'nunca'}
            </span>
          </div>
        )}

        {conexao?.ultimo_erro && (
          <div className="px-4 py-3 rounded-[8px] bg-danger/10 border border-subtle flex items-start gap-3">
            <AlertCircle size={16} className="text-danger shrink-0 mt-0.5" />
            <p className="text-[12px] text-main font-medium leading-snug">{conexao.ultimo_erro}</p>
          </div>
        )}

        {msgCalendario && (
          <div className={`px-4 py-3 rounded-[8px] text-[10px] font-bold uppercase tracking-wider flex items-center gap-3 border animate-slide-up ${msgCalendario.type === 'success' ? 'bg-primary/10 text-primary border-subtle' : 'bg-danger/10 text-danger border-subtle'}`}>
            {msgCalendario.type === 'success' ? '✓' : '⚠'} {msgCalendario.text}
          </div>
        )}
      </div>
    </div>
  );
};

export default PerfilConfig;

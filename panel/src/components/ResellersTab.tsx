import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Plus, Trash2, Zap, Loader2, Key, Mail, Copy, Eye, Coins, RefreshCw } from "lucide-react";
import { Reseller, License } from "@/hooks/use-admin-data";

export function ResellersTab({ resellers, users, licenses, loading, refetch }: { resellers: Reseller[]; users: any[]; licenses: License[]; loading: boolean; refetch: () => void }) {
  const [isAdding, setIsAdding] = useState(false);
  const [isSavingAdd, setIsSavingAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newLicenseKey, setNewLicenseKey] = useState("");
  const [newTokens7d, setNewTokens7d] = useState(0);
  const [newTokensMonthly, setNewTokensMonthly] = useState(0);
  const [newTokensAnnual, setNewTokensAnnual] = useState(0);
  const [newTokensLifetime, setNewTokensLifetime] = useState(0);
  const [newTokensDaily, setNewTokensDaily] = useState(0);
  
  const [isUpdatingTokens, setIsUpdatingTokens] = useState(false);
  const [isSavingTokens, setIsSavingTokens] = useState(false);
  const [selectedReseller, setSelectedReseller] = useState<Reseller | null>(null);
  const [updateAmount, setUpdateAmount] = useState(0);
  const [updateType, setUpdateType] = useState<"7d" | "monthly" | "annual" | "lifetime" | "daily">("monthly");

  const generateKey = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let key = "RESELLER-";
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      if (i < 3) key += "-";
    }
    setNewLicenseKey(key);
  };

  const handleAddReseller = async () => {
    if (!newEmail) {
      toast.error("Informe o e-mail do revendedor");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      toast.error("E-mail inválido");
      return;
    }
    if (!newLicenseKey) {
      toast.error("Gere uma chave de licença");
      return;
    }
    setIsSavingAdd(true);
    try {
      const { error } = await (supabase as any).from("resellers").insert({
        user_id: null,
        email: newEmail.trim().toLowerCase(),
        license_key: newLicenseKey,
        tokens_7d: newTokens7d,
        tokens_monthly: newTokensMonthly,
        tokens_annual: newTokensAnnual,
        tokens_lifetime: newTokensLifetime,
        tokens_daily: newTokensDaily,
      });
      if (error) {
        toast.error("Erro ao adicionar revendedor: " + error.message);
      } else {
        toast.success("Revendedor adicionado com sucesso!");
        setIsAdding(false);
        setNewEmail("");
        setNewLicenseKey("");
        setNewTokens7d(0);
        setNewTokensMonthly(0);
        setNewTokensAnnual(0);
        setNewTokensLifetime(0);
        setNewTokensDaily(0);
        refetch();
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro inesperado ao adicionar revendedor");
    } finally {
      setIsSavingAdd(false);
    }
  };

  const handleUpdateTokens = async () => {
    if (!selectedReseller) return;
    if (updateAmount <= 0) {
      toast.error("Informe um valor maior que zero");
      return;
    }
    setIsSavingTokens(true);
    try {
      const { error } = await supabase.rpc('increment_reseller_credits', {
        reseller_uuid: selectedReseller.id,
        amount_to_add: updateAmount,
        type_of_token: updateType
      });
      if (error) {
        toast.error("Erro ao atualizar tokens: " + error.message);
      } else {
        toast.success("Tokens atualizados!");
        setIsUpdatingTokens(false);
        setSelectedReseller(null);
        setUpdateAmount(0);
        refetch();
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro inesperado ao atualizar tokens");
    } finally {
      setIsSavingTokens(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const { error } = await (supabase as any).from("resellers").delete().eq("id", deleteTarget);
      if (error) {
        toast.error("Erro ao remover revendedor: " + error.message);
      } else {
        toast.success("Revendedor removido!");
        refetch();
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro inesperado ao remover revendedor");
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <>
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="bg-background border-border text-foreground rounded-[2rem]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black">Remover Revendedor?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground font-bold text-xs uppercase tracking-widest">
              Esta ação é irreversível. Todos os dados deste revendedor serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-black text-xs uppercase tracking-widest">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirmed}
              disabled={isDeleting}
              className="rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground font-black text-xs uppercase tracking-widest"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="glass-card border-border/50 bg-background/40 backdrop-blur-2xl rounded-[2rem] overflow-hidden">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 space-y-0 pb-7">
          <div className="space-y-1 min-w-0">
            <CardTitle className="text-2xl font-black text-foreground">Revendedores</CardTitle>
            <CardDescription className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">Gestão de tokens e acessos</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => window.open('https://hyperbuild-reseller-dashboard.lovable.app', '_blank', 'noopener,noreferrer')}
              className="flex-1 sm:flex-none rounded-xl border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 font-black text-[10px] uppercase tracking-widest h-10 px-4"
            >
              <Zap className="w-3.5 h-3.5 mr-2" /> Painel de Vendas
            </Button>
            <Dialog open={isAdding} onOpenChange={setIsAdding}>
              <DialogTrigger asChild>
                <Button className="flex-1 sm:flex-none rounded-xl bg-primary hover:bg-primary/90 text-foreground font-black text-[10px] uppercase tracking-widest h-10 px-4">
                  <Plus className="w-3.5 h-3.5 mr-2" /> Novo Revendedor
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-background/95 border-border text-foreground rounded-[2rem] max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black">Adicionar Revendedor</DialogTitle>
                  <DialogDescription className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">Cadastre um novo revendedor e defina seus tokens iniciais.</DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">E-mail do Revendedor</label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/20 group-focus-within:text-primary transition-colors" />
                      <Input 
                        placeholder="email@revendedor.com"
                        value={newEmail} 
                        onChange={(e) => setNewEmail(e.target.value)}
                        className="h-12 pl-12 rounded-xl bg-muted/40 border-border"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Chave de Acesso ao Painel</label>
                    <div className="flex gap-2">
                      <div className="relative group flex-1">
                        <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/20 group-focus-within:text-primary transition-colors" />
                        <Input 
                          placeholder="RESELLER-XXXX-XXXX"
                          value={newLicenseKey} 
                          onChange={(e) => setNewLicenseKey(e.target.value)}
                          className="h-12 pl-12 rounded-xl bg-muted/40 border-border font-mono text-xs"
                        />
                      </div>
                      <Button 
                        onClick={generateKey}
                        className="h-12 w-12 rounded-xl bg-muted/40 border border-border hover:bg-muted/60 p-0"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Tokens 7 Dias</label>
                      <Input type="number" min={0} value={newTokens7d} onChange={(e) => setNewTokens7d(parseInt(e.target.value) || 0)} className="h-11 rounded-xl bg-muted/40 border-border" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-success/70 px-1">Tokens Mensais</label>
                      <Input type="number" min={0} value={newTokensMonthly} onChange={(e) => setNewTokensMonthly(parseInt(e.target.value) || 0)} className="h-11 rounded-xl bg-muted/40 border-border" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-warning/70 px-1">Tokens Anuais</label>
                      <Input type="number" min={0} value={newTokensAnnual} onChange={(e) => setNewTokensAnnual(parseInt(e.target.value) || 0)} className="h-11 rounded-xl bg-muted/40 border-border" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Tokens Vitalícios</label>
                      <Input type="number" min={0} value={newTokensLifetime} onChange={(e) => setNewTokensLifetime(parseInt(e.target.value) || 0)} className="h-11 rounded-xl bg-muted/40 border-border" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Tokens Diários</label>
                      <Input type="number" min={0} value={newTokensDaily} onChange={(e) => setNewTokensDaily(parseInt(e.target.value) || 0)} className="h-11 rounded-xl bg-muted/40 border-border" />
                    </div>
                  </div>

                  <Button onClick={handleAddReseller} disabled={isSavingAdd} className="w-full h-14 rounded-xl font-black uppercase tracking-widest text-xs bg-primary hover:bg-primary/90 shadow-[0_0_20px_hsl(var(--primary)/0.3)]">
                    {isSavingAdd ? <Loader2 className="w-5 h-5 animate-spin" /> : "CADASTRAR REVENDEDOR"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3">
                  <Skeleton className="w-10 h-10 rounded-xl" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-28 rounded-lg" />
                  <div className="flex gap-1.5">
                    <Skeleton className="h-5 w-12 rounded-full" />
                    <Skeleton className="h-5 w-12 rounded-full" />
                    <Skeleton className="h-5 w-12 rounded-full" />
                  </div>
                  <div className="flex gap-1">
                    <Skeleton className="h-9 w-9 rounded-xl" />
                    <Skeleton className="h-9 w-9 rounded-xl" />
                    <Skeleton className="h-9 w-9 rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          ) : resellers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Nenhum revendedor cadastrado ainda</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50 text-left">
                    <th className="pb-4 font-black uppercase tracking-widest text-[10px] text-foreground/30 px-4">Revendedor</th>
                    <th className="pb-4 font-black uppercase tracking-widest text-[10px] text-foreground/30 px-4">Chave de Licença</th>
                    <th className="pb-4 font-black uppercase tracking-widest text-[10px] text-foreground/30 px-4">Saldo de Tokens</th>
                    <th className="pb-4 font-black uppercase tracking-widest text-[10px] text-foreground/30 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {resellers.map((reseller) => (
                    <tr key={reseller.id} className="group hover:bg-muted/30 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-xs shrink-0">
                            {reseller.email?.charAt(0).toUpperCase() || reseller.profiles?.full_name?.charAt(0) || <User className="w-5 h-5" />}
                          </div>
                          <div className="space-y-0.5 overflow-hidden">
                            <p className="text-sm font-bold text-foreground truncate">{reseller.email || reseller.profiles?.full_name || "Revendedor"}</p>
                            <p className="text-[10px] font-medium text-foreground/30 font-mono truncate">{reseller.user_id || "Acesso por Chave"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-muted/40 border-border font-mono text-[10px] text-muted-foreground px-3 py-1">
                            {reseller.license_key || "---"}
                          </Badge>
                          {reseller.license_key && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              aria-label="Copiar chave de licença"
                              className="h-7 w-7 rounded-lg hover:bg-muted/60"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(reseller.license_key!);
                                  toast.success("Chave copiada!");
                                } catch {
                                  toast.error("Falha ao copiar");
                                }
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                          <Badge className="bg-primary/10 text-primary border-primary/20 font-mono text-[9px] px-1.5 py-0 h-5">7D: {reseller.tokens_7d}</Badge>
                          <Badge className="bg-success/10 text-success border-success/20 font-mono text-[9px] px-1.5 py-0 h-5">M: {reseller.tokens_monthly}</Badge>
                          <Badge className="bg-warning/10 text-warning border-warning/20 font-mono text-[9px] px-1.5 py-0 h-5">A: {reseller.tokens_annual}</Badge>
                          <Badge className="bg-secondary text-secondary-foreground border-border font-mono text-[9px] px-1.5 py-0 h-5">V: {reseller.tokens_lifetime}</Badge>
                          <Badge className="bg-muted/60 text-muted-foreground border-border font-mono text-[9px] px-1.5 py-0 h-5">D: {reseller.tokens_daily || 0}</Badge>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                aria-label="Ver licenças do revendedor"
                                className="h-9 w-9 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 border border-primary/10"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-background/95 border-border text-foreground rounded-[2rem] max-w-2xl max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle className="text-2xl font-black">Licenças de {reseller.email || reseller.profiles?.full_name || "Revendedor"}</DialogTitle>
                                <DialogDescription className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">Todas as licenças geradas por este revendedor</DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                {licenses.filter(l => reseller.user_id && l.created_by === reseller.user_id).length === 0 ? (
                                  <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma licença gerada ainda</div>
                                ) : (
                                  <div className="grid gap-3">
                                    {licenses.filter(l => reseller.user_id && l.created_by === reseller.user_id).map(l => (
                                      <div key={l.id} className="p-4 rounded-2xl bg-muted/40 border border-border flex flex-col gap-3">
                                        <div className="flex items-center justify-between">
                                          <div className="space-y-1">
                                            <code className="text-sm font-mono font-black text-primary">{l.license_key}</code>
                                            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{l.user_name || "Sem nome"}</p>
                                          </div>
                                          <div className="flex items-center gap-3">
                                            <Badge variant="outline" className={`${
                                              l.status === 'active' ? 'border-success/30 text-success' :
                                              l.status === 'revoked' ? 'border-destructive/30 text-destructive' :
                                              'border-border text-muted-foreground'
                                            } text-[9px] font-black uppercase`}>
                                              {l.status}
                                            </Badge>
                                            <Button 
                                              variant="ghost" 
                                              size="icon" 
                                              className="h-8 w-8 hover:bg-muted/60"
                                              onClick={() => {
                                                if (l.license_key) {
                                                  navigator.clipboard.writeText(l.license_key);
                                                  toast.success("Copiado!");
                                                }
                                              }}
                                            >
                                              <Copy className="h-3.5 w-3.5" />
                                            </Button>
                                          </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50">
                                          <div className="flex flex-col">
                                            <span className="text-[8px] font-black uppercase text-foreground/30 tracking-widest">Prompts</span>
                                            <span className="text-xs font-black text-foreground">{l.prompts_count || 0}</span>
                                          </div>
                                          <div className="flex flex-col">
                                            <span className="text-[8px] font-black uppercase text-foreground/30 tracking-widest">Tempo Edição</span>
                                            <span className="text-xs font-black text-foreground">
                                              {l.editing_seconds ? `${Math.floor(l.editing_seconds / 3600)}h ${Math.floor((l.editing_seconds % 3600) / 60)}m` : "0m"}
                                            </span>
                                          </div>
                                          <div className="flex flex-col">
                                            <span className="text-[8px] font-black uppercase text-foreground/30 tracking-widest">Tempo Restante</span>
                                            <span className={`text-xs font-black ${
                                              l.expires_at && new Date(l.expires_at).getTime() < Date.now() ? 'text-destructive' : 'text-success'
                                            }`}>
                                              {(() => {
                                                if (!l.expires_at) return "Permanente";
                                                const diff = new Date(l.expires_at).getTime() - Date.now();
                                                if (diff <= 0) return "Expirado";
                                                const days = Math.floor(diff / 86400000);
                                                const hours = Math.floor((diff % 86400000) / 3600000);
                                                if (days > 0) return `${days}d ${hours}h`;
                                                const mins = Math.floor((diff % 3600000) / 60000);
                                                return `${hours}h ${mins}m`;
                                              })()}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                          
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => {
                              setSelectedReseller(reseller);
                              setIsUpdatingTokens(true);
                            }}
                            aria-label="Adicionar tokens"
                            className="h-9 w-9 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 border border-primary/10"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>

                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setDeleteTarget(reseller.id)}
                            aria-label="Remover revendedor"
                            className="h-9 w-9 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>

        <Dialog open={isUpdatingTokens} onOpenChange={(open) => { if (!isSavingTokens) setIsUpdatingTokens(open); }}>
          <DialogContent className="bg-background/95 border-border text-foreground rounded-[2rem] max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black">Adicionar Tokens</DialogTitle>
              <DialogDescription className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">
                Selecione o tipo e a quantidade de tokens para {selectedReseller?.email || "o revendedor"}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Tipo de Token</label>
                <Select value={updateType} onValueChange={(v) => setUpdateType(v as "7d" | "monthly" | "annual" | "lifetime" | "daily")}>
                  <SelectTrigger className="h-12 bg-muted/40 border-border rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border text-foreground rounded-xl">
                    <SelectItem value="7d">7 Dias</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="annual">Anual</SelectItem>
                    <SelectItem value="lifetime">Vitalício</SelectItem>
                    <SelectItem value="daily">Diário</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Quantidade</label>
                <div className="relative group">
                  <Coins className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/20 group-focus-within:text-primary transition-colors" />
                  <Input 
                    type="number"
                    min={1}
                    placeholder="0"
                    value={updateAmount} 
                    onChange={(e) => setUpdateAmount(parseInt(e.target.value) || 0)}
                    className="h-12 pl-12 rounded-xl bg-muted/40 border-border"
                  />
                </div>
              </div>
              <Button onClick={handleUpdateTokens} disabled={isSavingTokens} className="w-full h-14 rounded-xl font-black uppercase tracking-widest text-xs bg-primary hover:bg-primary/90">
                {isSavingTokens ? <Loader2 className="w-5 h-5 animate-spin" /> : "ADICIONAR TOKENS"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </Card>
    </>
  );
}

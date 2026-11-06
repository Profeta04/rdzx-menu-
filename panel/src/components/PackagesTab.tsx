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
import { Plus, Trash2, Loader2, Coins, Tag, DollarSign, Package } from "lucide-react";
import { CreditPackage } from "@/hooks/use-admin-data";

export function PackagesTab({ packages, loading, refetch }: { packages: CreditPackage[]; loading: boolean; refetch: () => void }) {
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCredits, setNewCredits] = useState(0);
  const [newAmount, setNewAmount] = useState(0);
  const [newTokenType, setNewTokenType] = useState<"7d" | "monthly" | "annual" | "lifetime">("monthly");

  const handleAddPackage = async () => {
    const trimmedName = newName.trim();
    if (!trimmedName) {
      toast.error("Informe o nome do pacote");
      return;
    }
    if (newCredits <= 0) {
      toast.error("Quantidade de tokens deve ser maior que zero");
      return;
    }
    if (newAmount < 0) {
      toast.error("Valor não pode ser negativo");
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase.from("reseller_credit_packages").insert({
        name: trimmedName,
        credits: newCredits,
        amount: newAmount,
        token_type: newTokenType,
        is_active: true
      });
      if (error) {
        toast.error("Erro ao adicionar pacote: " + error.message);
      } else {
        toast.success("Pacote adicionado com sucesso!");
        setIsAdding(false);
        setNewName("");
        setNewCredits(0);
        setNewAmount(0);
        refetch();
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro inesperado ao adicionar pacote");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from("reseller_credit_packages").delete().eq("id", deleteTarget);
      if (error) {
        toast.error("Erro ao remover pacote: " + error.message);
      } else {
        toast.success("Pacote removido!");
        refetch();
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro inesperado ao remover pacote");
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase.from("reseller_credit_packages").update({ is_active: !currentStatus }).eq("id", id);
      if (error) {
        toast.error("Erro ao atualizar status: " + error.message);
      } else {
        toast.success("Status atualizado!");
        refetch();
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro inesperado ao atualizar status");
    }
  };

  return (
    <>
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="bg-background border-border text-foreground rounded-[2rem]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black">Remover Pacote?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground font-bold text-xs uppercase tracking-widest">
              Esta ação é irreversível. O pacote será removido permanentemente.
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
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
          <div className="space-y-1">
            <CardTitle className="text-2xl font-black text-foreground">Pacotes de Tokens</CardTitle>
            <CardDescription className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">Configuração de pacotes para venda aos revendedores</CardDescription>
          </div>
          <Dialog open={isAdding} onOpenChange={setIsAdding}>
            <DialogTrigger asChild>
              <Button className="rounded-xl bg-primary hover:bg-primary/90 text-foreground font-black text-[10px] uppercase tracking-widest h-10 px-4">
                <Plus className="w-3.5 h-3.5 mr-2" /> Novo Pacote
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-background/95 border-border text-foreground rounded-[2rem] max-w-md">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black">Adicionar Pacote</DialogTitle>
                <DialogDescription className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">Crie um novo pacote de tokens para venda.</DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Nome do Pacote</label>
                  <div className="relative group">
                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/20 group-focus-within:text-primary transition-colors" />
                    <Input 
                      placeholder="Ex: Pacote Premium 1000 Tokens"
                      value={newName} 
                      onChange={(e) => setNewName(e.target.value)}
                      className="h-12 pl-12 rounded-xl bg-muted/40 border-border"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Quantidade de Tokens</label>
                    <div className="relative group">
                      <Coins className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/20 group-focus-within:text-primary transition-colors" />
                      <Input type="number" min={1} value={newCredits} onChange={(e) => setNewCredits(parseInt(e.target.value) || 0)} className="h-12 pl-12 rounded-xl bg-muted/40 border-border" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Valor (R$)</label>
                    <div className="relative group">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/20 group-focus-within:text-primary transition-colors" />
                      <Input type="number" step="0.01" min={0} value={newAmount} onChange={(e) => setNewAmount(parseFloat(e.target.value) || 0)} className="h-12 pl-12 rounded-xl bg-muted/40 border-border" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Tipo de Token</label>
                  <Select value={newTokenType} onValueChange={(value) => setNewTokenType(value as "7d" | "monthly" | "annual" | "lifetime")}>
                    <SelectTrigger className="h-12 rounded-xl bg-muted/40 border-border">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="7d">7 Dias</SelectItem>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="annual">Anual</SelectItem>
                      <SelectItem value="lifetime">Vitalício</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={handleAddPackage} disabled={isSaving} className="w-full h-14 rounded-xl font-black uppercase tracking-widest text-xs bg-primary hover:bg-primary/90 shadow-[0_0_20px_hsl(var(--primary)/0.3)]">
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : "CADASTRAR PACOTE"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3">
                  <Skeleton className="w-10 h-10 rounded-xl" />
                  <Skeleton className="h-4 flex-1 max-w-[200px]" />
                  <Skeleton className="h-4 w-20 ml-auto" />
                  <Skeleton className="h-5 w-12" />
                  <Skeleton className="h-9 w-9 rounded-xl" />
                </div>
              ))}
            </div>
          ) : packages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Nenhum pacote cadastrado ainda</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50 text-left">
                    <th className="pb-4 font-black uppercase tracking-widest text-[10px] text-foreground/30 px-4">Nome</th>
                    <th className="pb-4 font-black uppercase tracking-widest text-[10px] text-foreground/30 px-4">Tokens / Tipo</th>
                    <th className="pb-4 font-black uppercase tracking-widest text-[10px] text-foreground/30 px-4">Valor</th>
                    <th className="pb-4 font-black uppercase tracking-widest text-[10px] text-foreground/30 px-4">Status</th>
                    <th className="pb-4 font-black uppercase tracking-widest text-[10px] text-foreground/30 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {packages.map((pkg) => (
                    <tr key={pkg.id} className="group hover:bg-muted/30 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-muted/40 border border-border flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                            <Package className="w-5 h-5" />
                          </div>
                          <p className="text-sm font-bold text-foreground">{pkg.name}</p>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">{pkg.credits}</span>
                          <Badge variant="outline" className="text-[9px] font-black uppercase tracking-tighter h-5 px-1.5 border-border text-muted-foreground">
                            {pkg.token_type}
                          </Badge>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm font-black text-primary">R$ {(pkg.amount ?? 0).toFixed(2)}</span>
                      </td>
                      <td className="py-4 px-4">
                        <button onClick={() => toggleStatus(pkg.id, pkg.is_active)} aria-label={pkg.is_active ? "Desativar pacote" : "Ativar pacote"}>
                          <Badge className={`${pkg.is_active ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'} text-[9px] font-black uppercase border-transparent`}>
                            {pkg.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </button>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => setDeleteTarget(pkg.id)}
                          aria-label="Remover pacote"
                          className="h-9 w-9 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

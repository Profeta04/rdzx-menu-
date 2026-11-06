import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Coins, CreditCard, AlertTriangle, Zap } from "lucide-react";
import { PRICE_PER_TOKEN } from "@/lib/constants/pricing";

export function RechargeTokensTab() {
  const [quantity, setQuantity] = useState(1);
   const [tokenType, setTokenType] = useState<"semanal" | "mensal" | "anual" | "vitalicia" | "diaria">("mensal");
  const [showPix, setShowPix] = useState(false);

  const pricePerToken = PRICE_PER_TOKEN;
  const totalValue = quantity * pricePerToken;

  const handleFinalizePurchase = () => {
    setShowPix(true);
  };

  const getTokenLabel = (type: string) => {
    switch (type) {
      case "semanal": return "Semanal";
      case "mensal": return "Mensal";
       case "anual": return "Anual";
       case "vitalicia": return "Vitalícia";
       case "diaria": return "Diária";
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      <Card className="glass-card border-border/50 bg-background/40 backdrop-blur-2xl rounded-[2rem] overflow-hidden">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-black text-foreground flex items-center gap-2">
            <Coins className="w-6 h-6 text-primary" /> Recarregar Tokens
          </CardTitle>
          <CardDescription className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">
            Adquira mais tokens para sua conta ou para seus clientes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-primary px-1">Qual tipo de token deseja?</label>
                <Select value={tokenType} onValueChange={(value: any) => setTokenType(value)}>
                  <SelectTrigger className="h-14 rounded-2xl bg-background/40 border-border/50 focus:ring-primary/20 transition-all text-foreground font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-border bg-background/90 backdrop-blur-3xl text-foreground">
                    <SelectItem value="semanal" className="rounded-xl font-bold">Semanal</SelectItem>
                    <SelectItem value="mensal" className="rounded-xl font-bold">Mensal</SelectItem>
                     <SelectItem value="anual" className="rounded-xl font-bold">Anual</SelectItem>
                     <SelectItem value="vitalicia" className="rounded-xl font-bold">Vitalícia</SelectItem>
                     <SelectItem value="diaria" className="rounded-xl font-bold">Diária</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-primary px-1">Quantidade de Tokens</label>
                <div className="relative group">
                  <Coins className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/40 group-focus-within:text-primary transition-colors" />
                  <Input 
                    type="number" 
                    min={1}
                    value={quantity} 
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                    className="h-14 pl-12 rounded-2xl bg-background/40 border-border/50 focus:ring-primary/20 transition-all text-foreground font-bold"
                  />
                </div>
              </div>

              <div className="p-6 rounded-[2rem] bg-primary/5 border border-primary/10 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Preço por Token</span>
                  <span className="text-lg font-black text-foreground">R$ {pricePerToken.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-border/50">
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary">Valor Total</span>
                  <span className="text-3xl font-black text-primary drop-shadow-[0_0_15px_hsl(var(--primary)/0.3)]">
                    R$ {totalValue.toFixed(2)}
                  </span>
                </div>
              </div>

              <Button 
                onClick={handleFinalizePurchase} 
                className="w-full h-16 rounded-[1.5rem] font-black text-lg uppercase tracking-widest bg-primary hover:bg-primary/90 text-foreground shadow-2xl shadow-primary/20 active:scale-95 transition-all"
              >
                <CreditCard className="w-6 h-6 mr-3" /> Finalizar compra de tokens
              </Button>
            </div>

            <div className="flex flex-col justify-center items-center">
              {showPix ? (
                <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="p-8 rounded-[2.5rem] bg-card text-card-foreground flex flex-col items-center gap-6 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                      <Zap className="w-20 h-20 text-foreground" />
                    </div>
                    
                    <div className="text-center space-y-2">
                      <h3 className="text-2xl font-black uppercase tracking-tighter text-card-foreground">Pagamento Via PIX</h3>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Realize o pagamento para ativar seus tokens</p>
                    </div>

                    <div className="p-4 bg-muted/40 rounded-3xl border-2 border-dashed border-border flex flex-col items-center gap-4 w-full">
                      <div className="w-48 h-48 bg-background border border-border rounded-2xl flex items-center justify-center shadow-inner p-2">
                        {/* Placeholder for QR Code */}
                        <div className="text-center p-2">
                          <Zap className="w-12 h-12 text-primary mx-auto mb-2 opacity-20" />
                          <p className="text-[10px] font-black uppercase text-muted-foreground">Clique no botão abaixo para pagar</p>
                        </div>
                      </div>
                      
                      <div className="text-center">
                        <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Forma de Pagamento</p>
                        <p className="text-sm font-black text-primary break-all">Em breve</p>
                      </div>
                    </div>

                    <div className="w-full p-4 rounded-2xl bg-warning/10 border border-warning/30 flex gap-3">
                      <AlertTriangle className="w-6 h-6 text-warning shrink-0" />
                      <p className="text-[10px] font-bold text-warning uppercase leading-relaxed">
                        inserir o valor corretamente dentro do pix caso contrario o valor e o pagamento serão processados manualmente
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-4 opacity-20">
                  <div className="p-10 rounded-full bg-muted/40 border border-border inline-block">
                    <CreditCard className="w-20 h-20 text-foreground" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground">Aguardando finalização do pedido</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

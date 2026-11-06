import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Shield, Zap, Lock, Globe } from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/hooks/use-auth";

const Index = () => {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <div className="min-h-screen bg-transparent text-foreground flex flex-col transition-colors duration-500 relative overflow-x-hidden">
      <Helmet>
        <title>ZDRX Mod Menu — Sistema de Licenças</title>
        <meta name="description" content="Ecossistema ZDRX Mod Menu para gerenciamento de licenças com segurança máxima, validação server-side e escalabilidade." />
        <link rel="canonical" href="/" />
        <meta property="og:title" content="ZDRX Mod Menu — Sistema de Licenças" />
        <meta property="og:description" content="Gerenciamento de licenças com segurança máxima, validação server-side e escalabilidade ilimitada." />
        <meta property="og:url" content="/" />
      </Helmet>
      {/* Background Decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-gradient-to-b from-primary/20 via-transparent to-transparent -z-10 blur-[120px] opacity-50" />
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/10 rounded-full blur-[100px] -z-10 animate-pulse" />
      <div className="absolute bottom-1/4 -right-24 w-96 h-96 bg-secondary/10 rounded-full blur-[100px] -z-10" />

      {/* Navigation */}
      <nav className="p-6 flex justify-between items-center max-w-7xl mx-auto w-full z-10">
        <div className="flex items-center gap-2 group cursor-pointer">
          <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 group-hover:scale-110 transition-transform">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <span className="text-xl font-black tracking-tighter text-foreground">ZDRX MOD MENU</span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-muted/40 border border-border backdrop-blur-md">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/60">Sistemas Online</span>
          </div>
          <Button variant="outline" size="icon" onClick={toggleTheme} aria-label="Alternar tema claro e escuro" className="rounded-xl bg-muted/40 border-border hover:bg-muted/60 shadow-xl transition-all">
            {theme === "dark" ? <Sun className="h-5 w-5 text-warning" /> : <Moon className="h-5 w-5 text-purple-400" />}
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center relative z-10">
        <div className="space-y-8 max-w-4xl animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="group relative inline-flex items-center gap-2.5 px-5 py-2 rounded-full overflow-hidden">
            {/* Glow halo */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary/30 via-secondary/30 to-primary/30 blur-xl opacity-70 group-hover:opacity-100 transition-opacity duration-500" />
            {/* Glass surface */}
            <div className="absolute inset-0 rounded-full bg-background/60 backdrop-blur-xl border border-primary/30" />
            {/* Animated sheen */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-primary/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            {/* Content */}
            <div className="relative flex items-center gap-2.5">
              <div className="relative flex items-center justify-center w-4 h-4">
                <div className="absolute inset-0 rounded-full bg-primary/40 blur-sm animate-pulse" />
                <Zap className="relative w-3.5 h-3.5 text-primary drop-shadow-[0_0_6px_hsl(var(--primary))]" />
              </div>
              <span className="text-[11px] font-black uppercase tracking-[0.25em] bg-gradient-to-r from-primary via-foreground to-primary bg-clip-text text-transparent">
                Performance de Elite
              </span>
              <div className="w-1.5 h-1.5 rounded-full bg-success shadow-[0_0_8px_hsl(var(--success))] animate-pulse" />
            </div>
          </div>
          
          <div className="space-y-4">
            <h1 className="text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter text-foreground drop-shadow-2xl">
              ZDRX<span className="text-primary"> MOD MENU</span>
            </h1>
            <p className="text-muted-foreground text-lg md:text-xl font-medium max-w-2xl mx-auto leading-relaxed">
              O ecossistema definitivo para gerenciamento de licenças do mod menu, 
              projetado para segurança máxima e validação em tempo real.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            <Link to="/admin" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto gap-3 h-16 px-10 rounded-2xl font-black text-lg bg-primary hover:bg-primary/90 hover:scale-105 transition-all shadow-2xl shadow-primary/20">
                ACESSAR PAINEL
                <Shield className="w-5 h-5" />
              </Button>
            </Link>
            <a href="/zdrx-mod-menu.apk" download="zdrx-mod-menu.apk" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full sm:w-auto h-16 px-10 rounded-2xl font-black text-lg bg-muted/40 border-border hover:bg-muted/60 transition-all gap-2">
                BAIXAR APK
              </Button>
            </a>
          </div>

          {/* Features Grid */}
          <section aria-labelledby="features-heading">
          <h2 id="features-heading" className="text-3xl md:text-4xl font-black tracking-tight text-foreground mt-20 mb-8 text-center">Recursos</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <FeatureCard 
              icon={<Lock className="w-6 h-6" />} 
              title="Segurança" 
              desc="Proteção de nível militar para suas licenças e dados críticos."
            />
            <FeatureCard 
              icon={<Zap className="w-6 h-6" />} 
              title="Velocidade" 
              desc="Infraestrutura otimizada para respostas em milissegundos."
            />
            <FeatureCard 
              icon={<Globe className="w-6 h-6" />} 
              title="Global" 
              desc="Disponibilidade mundial com redundância automática."
            />
          </div>
          </section>
        </div>
      </main>


      {/* Footer */}
      <footer className="p-8 text-center border-t border-border/50 bg-background/40 backdrop-blur-md">
        <p className="text-[10px] font-bold text-foreground/30 uppercase tracking-[0.4em]">
          &copy; 2024 HyperBuild Ecosystem v7.5.0 • Todos os direitos reservados
        </p>
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) => (
  <div className="p-6 rounded-2xl bg-muted/40 border border-border backdrop-blur-sm hover:bg-muted/60 transition-all group">
    <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary w-fit mb-4 group-hover:scale-110 transition-transform">
      {icon}
    </div>
    <h3 className="text-foreground font-bold text-lg mb-2">{title}</h3>
    <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
  </div>
);

export default Index;

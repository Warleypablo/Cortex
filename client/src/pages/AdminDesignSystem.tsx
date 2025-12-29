import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  AlertCircle, 
  Check, 
  Info, 
  Palette, 
  Type, 
  Layout, 
  Component,
  Sparkles,
  Sun,
  Moon,
  BarChart3,
  Smile,
  Home,
  Settings,
  User,
  Users,
  Bell,
  Calendar,
  Mail,
  Search,
  Plus,
  Minus,
  Edit,
  Trash2,
  Save,
  Download,
  Upload,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Heart,
  Star,
  Bookmark,
  Share,
  Link,
  Copy,
  Clipboard,
  FileText,
  Folder,
  Image,
  Video,
  Music,
  Phone,
  MessageCircle,
  Send,
  Filter,
  SortAsc,
  SortDesc,
  Grid,
  List,
  Menu,
  X,
  MoreHorizontal,
  MoreVertical,
  ExternalLink,
  Clock,
  Target,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  Award,
  Gift,
  ShoppingCart,
  CreditCard,
  DollarSign,
  Briefcase,
  Building,
  Globe,
  Map,
  MapPin,
  Navigation,
  Wifi,
  WifiOff,
  Battery,
  Cpu,
  Database,
  Server,
  Cloud,
  CloudOff,
  Terminal,
  Code,
  GitBranch,
  Github
} from "lucide-react";

import {
  RoundedPieChart,
  PingingDotChart,
  GlowingLineChart,
  GlowingBarChart,
  HatchedBarChart,
  StatisticCard,
  StatisticsCard7,
  CinematicSwitch,
  InteractiveLineChart,
  StatisticsCard1,
  StatisticsCard10,
  LineCharts6,
} from "@/components/ui/charts";

export default function AdminDesignSystem() {
  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto" data-testid="page-design-system">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10">
          <Palette className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="title-design-system">
            Design System
          </h1>
          <p className="text-sm text-muted-foreground">
            Guia de componentes e padrões visuais do Turbo Cortex
          </p>
        </div>
      </div>

      <Tabs defaultValue="colors" className="space-y-4">
        <TabsList data-testid="tabs-design-system">
          <TabsTrigger value="colors" data-testid="tab-colors">
            <Palette className="h-4 w-4 mr-2" />
            Cores
          </TabsTrigger>
          <TabsTrigger value="typography" data-testid="tab-typography">
            <Type className="h-4 w-4 mr-2" />
            Tipografia
          </TabsTrigger>
          <TabsTrigger value="components" data-testid="tab-components">
            <Component className="h-4 w-4 mr-2" />
            Componentes
          </TabsTrigger>
          <TabsTrigger value="spacing" data-testid="tab-spacing">
            <Layout className="h-4 w-4 mr-2" />
            Espaçamento
          </TabsTrigger>
          <TabsTrigger value="charts" data-testid="tab-charts">
            <BarChart3 className="h-4 w-4 mr-2" />
            Gráficos
          </TabsTrigger>
          <TabsTrigger value="icons" data-testid="tab-icons">
            <Smile className="h-4 w-4 mr-2" />
            Ícones
          </TabsTrigger>
        </TabsList>

        <TabsContent value="colors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Paleta de Cores
              </CardTitle>
              <CardDescription>
                Cores principais utilizadas no sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Cores Primárias</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <div className="h-20 rounded-lg bg-primary flex items-end p-2">
                      <span className="text-xs text-primary-foreground font-mono">primary</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Azul Turbo - Ações principais</p>
                  </div>
                  <div className="space-y-2">
                    <div className="h-20 rounded-lg bg-secondary flex items-end p-2">
                      <span className="text-xs text-secondary-foreground font-mono">secondary</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Secundário - Ações alternativas</p>
                  </div>
                  <div className="space-y-2">
                    <div className="h-20 rounded-lg bg-accent flex items-end p-2">
                      <span className="text-xs text-accent-foreground font-mono">accent</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Destaque - Elementos em foco</p>
                  </div>
                  <div className="space-y-2">
                    <div className="h-20 rounded-lg bg-muted flex items-end p-2">
                      <span className="text-xs text-muted-foreground font-mono">muted</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Mudo - Fundos sutis</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Cores Semânticas</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <div className="h-20 rounded-lg bg-green-500 flex items-end p-2">
                      <span className="text-xs text-white font-mono">success</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Sucesso - Confirmações</p>
                  </div>
                  <div className="space-y-2">
                    <div className="h-20 rounded-lg bg-yellow-500 flex items-end p-2">
                      <span className="text-xs text-white font-mono">warning</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Alerta - Atenção</p>
                  </div>
                  <div className="space-y-2">
                    <div className="h-20 rounded-lg bg-destructive flex items-end p-2">
                      <span className="text-xs text-destructive-foreground font-mono">destructive</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Destrutivo - Erros</p>
                  </div>
                  <div className="space-y-2">
                    <div className="h-20 rounded-lg bg-blue-500 flex items-end p-2">
                      <span className="text-xs text-white font-mono">info</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Info - Informações</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Backgrounds</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <div className="h-20 rounded-lg bg-background border flex items-end p-2">
                      <span className="text-xs text-foreground font-mono">background</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Fundo principal</p>
                  </div>
                  <div className="space-y-2">
                    <div className="h-20 rounded-lg bg-card border flex items-end p-2">
                      <span className="text-xs text-card-foreground font-mono">card</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Cards e painéis</p>
                  </div>
                  <div className="space-y-2">
                    <div className="h-20 rounded-lg bg-sidebar border flex items-end p-2">
                      <span className="text-xs text-sidebar-foreground font-mono">sidebar</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Menu lateral</p>
                  </div>
                  <div className="space-y-2">
                    <div className="h-20 rounded-lg bg-popover border flex items-end p-2">
                      <span className="text-xs text-popover-foreground font-mono">popover</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Popovers e dropdowns</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="typography" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Type className="h-5 w-5 text-primary" />
                Tipografia
              </CardTitle>
              <CardDescription>
                Escala tipográfica e estilos de texto
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Títulos</h3>
                <div className="space-y-3 pl-4 border-l-2 border-primary/20">
                  <div>
                    <h1 className="text-4xl font-bold">Heading 1 - 36px Bold</h1>
                    <code className="text-xs text-muted-foreground">text-4xl font-bold</code>
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold">Heading 2 - 30px Bold</h2>
                    <code className="text-xs text-muted-foreground">text-3xl font-bold</code>
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold">Heading 3 - 24px Semibold</h3>
                    <code className="text-xs text-muted-foreground">text-2xl font-semibold</code>
                  </div>
                  <div>
                    <h4 className="text-xl font-semibold">Heading 4 - 20px Semibold</h4>
                    <code className="text-xs text-muted-foreground">text-xl font-semibold</code>
                  </div>
                  <div>
                    <h5 className="text-lg font-medium">Heading 5 - 18px Medium</h5>
                    <code className="text-xs text-muted-foreground">text-lg font-medium</code>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Texto</h3>
                <div className="space-y-3 pl-4 border-l-2 border-primary/20">
                  <div>
                    <p className="text-base">Parágrafo base - 16px Regular</p>
                    <code className="text-xs text-muted-foreground">text-base</code>
                  </div>
                  <div>
                    <p className="text-sm">Texto pequeno - 14px Regular</p>
                    <code className="text-xs text-muted-foreground">text-sm</code>
                  </div>
                  <div>
                    <p className="text-xs">Texto muito pequeno - 12px Regular</p>
                    <code className="text-xs text-muted-foreground">text-xs</code>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Texto secundário / muted</p>
                    <code className="text-xs text-muted-foreground">text-muted-foreground</code>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="components" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Botões</CardTitle>
                <CardDescription>Variantes de botões disponíveis</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button>Default</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="destructive">Destructive</Button>
                  <Button variant="ghost" className="underline">Link</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm">Small</Button>
                  <Button size="default">Default</Button>
                  <Button size="lg">Large</Button>
                  <Button size="icon"><Check className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Badges</CardTitle>
                <CardDescription>Tags e indicadores</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge>Default</Badge>
                  <Badge variant="secondary">Secondary</Badge>
                  <Badge variant="outline">Outline</Badge>
                  <Badge variant="destructive">Destructive</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-green-500 hover:bg-green-500 text-white">Sucesso</Badge>
                  <Badge className="bg-yellow-500 hover:bg-yellow-500 text-white">Alerta</Badge>
                  <Badge className="bg-blue-500 hover:bg-blue-500 text-white">Info</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Alertas</CardTitle>
                <CardDescription>Mensagens de feedback</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Informação</AlertTitle>
                  <AlertDescription>Esta é uma mensagem informativa.</AlertDescription>
                </Alert>
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Erro</AlertTitle>
                  <AlertDescription>Algo deu errado.</AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Formulários</CardTitle>
                <CardDescription>Campos de entrada</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="example-input">Label</Label>
                  <Input id="example-input" placeholder="Placeholder..." />
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="example-switch" />
                  <Label htmlFor="example-switch">Switch</Label>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Progress</CardTitle>
                <CardDescription>Indicadores de progresso</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Progress value={25} />
                <Progress value={50} />
                <Progress value={75} />
                <Progress value={100} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Avatares</CardTitle>
                <CardDescription>Representação de usuários</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>AB</AvatarFallback>
                  </Avatar>
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>CD</AvatarFallback>
                  </Avatar>
                  <Avatar className="h-12 w-12">
                    <AvatarFallback>EF</AvatarFallback>
                  </Avatar>
                  <Avatar className="h-14 w-14">
                    <AvatarImage src="https://github.com/shadcn.png" />
                    <AvatarFallback>GH</AvatarFallback>
                  </Avatar>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Skeleton</CardTitle>
                <CardDescription>Placeholder para carregamento</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tooltips</CardTitle>
                <CardDescription>Dicas contextuais</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline">Hover me</Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Esta é uma tooltip</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="spacing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layout className="h-5 w-5 text-primary" />
                Espaçamento
              </CardTitle>
              <CardDescription>
                Escala de espaçamento utilizada no sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Escala de Padding/Margin</h3>
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5, 6, 8, 10, 12, 16].map((size) => (
                    <div key={size} className="flex items-center gap-4">
                      <code className="w-12 text-xs text-muted-foreground">p-{size}</code>
                      <div className="bg-primary/20 rounded">
                        <div className={`bg-primary rounded`} style={{ width: `${size * 4}px`, height: '16px' }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{size * 4}px</span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Border Radius</h3>
                <div className="flex flex-wrap gap-4">
                  <div className="text-center">
                    <div className="h-16 w-16 bg-primary rounded-sm" />
                    <code className="text-xs text-muted-foreground">rounded-sm</code>
                  </div>
                  <div className="text-center">
                    <div className="h-16 w-16 bg-primary rounded-md" />
                    <code className="text-xs text-muted-foreground">rounded-md</code>
                  </div>
                  <div className="text-center">
                    <div className="h-16 w-16 bg-primary rounded-lg" />
                    <code className="text-xs text-muted-foreground">rounded-lg</code>
                  </div>
                  <div className="text-center">
                    <div className="h-16 w-16 bg-primary rounded-xl" />
                    <code className="text-xs text-muted-foreground">rounded-xl</code>
                  </div>
                  <div className="text-center">
                    <div className="h-16 w-16 bg-primary rounded-full" />
                    <code className="text-xs text-muted-foreground">rounded-full</code>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="charts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Biblioteca de Gráficos
              </CardTitle>
              <CardDescription>
                Componentes reutilizáveis para visualização de dados. Importar de <code className="text-xs bg-muted px-1.5 py-0.5 rounded">@/components/ui/charts</code>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Gráficos de Pizza</h3>
                <p className="text-sm text-muted-foreground">Ideal para distribuição de categorias em percentual ou proporção.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <RoundedPieChart />
                </div>
                <div className="bg-muted/50 rounded-lg p-4 mt-2">
                  <code className="text-xs text-muted-foreground">
                    import {"{"} RoundedPieChart {"}"} from "@/components/ui/charts";
                  </code>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Gráficos de Linha</h3>
                <p className="text-sm text-muted-foreground">Ideal para séries temporais e tendências.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <PingingDotChart />
                  <GlowingLineChart />
                </div>
                <div className="bg-muted/50 rounded-lg p-4 mt-2 space-y-1">
                  <code className="text-xs text-muted-foreground block">
                    import {"{"} PingingDotChart {"}"} from "@/components/ui/charts"; // Com animação de pulsação
                  </code>
                  <code className="text-xs text-muted-foreground block">
                    import {"{"} GlowingLineChart {"}"} from "@/components/ui/charts"; // Com efeito de brilho
                  </code>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Gráficos de Barra</h3>
                <p className="text-sm text-muted-foreground">Ideal para comparações entre categorias.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <GlowingBarChart />
                  <HatchedBarChart />
                </div>
                <div className="bg-muted/50 rounded-lg p-4 mt-2 space-y-1">
                  <code className="text-xs text-muted-foreground block">
                    import {"{"} GlowingBarChart {"}"} from "@/components/ui/charts"; // Com seletor de propriedade e brilho
                  </code>
                  <code className="text-xs text-muted-foreground block">
                    import {"{"} HatchedBarChart {"}"} from "@/components/ui/charts"; // Com padrão hachurado
                  </code>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Cards de Estatísticas</h3>
                <p className="text-sm text-muted-foreground">Cards com métricas, tendências e detalhes.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <StatisticCard />
                </div>
                <div className="bg-muted/50 rounded-lg p-4 mt-2 space-y-1">
                  <code className="text-xs text-muted-foreground block">
                    import {"{"} StatisticCard {"}"} from "@/components/ui/charts"; // Card de estatísticas com trend
                  </code>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Exemplos com Props Customizados</h3>
                <p className="text-sm text-muted-foreground">Todos os componentes aceitam props para dados, cores e configurações.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <RoundedPieChart 
                    title="Receita por Serviço"
                    description="Q4 2024"
                    data={[
                      { name: "Performance", value: 450000, fill: "hsl(var(--chart-1))" },
                      { name: "Social Media", value: 280000, fill: "hsl(var(--chart-2))" },
                      { name: "Inbound", value: 180000, fill: "hsl(var(--chart-3))" },
                    ]}
                    trend={{ value: 12.5, direction: 'up' }}
                  />
                  <PingingDotChart 
                    title="Novos Clientes"
                    description="Últimos 6 meses"
                    data={[
                      { label: "Jul", value: 12 },
                      { label: "Ago", value: 18 },
                      { label: "Set", value: 15 },
                      { label: "Out", value: 22 },
                      { label: "Nov", value: 28 },
                      { label: "Dez", value: 35 },
                    ]}
                    color="hsl(var(--chart-3))"
                    trend={{ value: 45, direction: 'up' }}
                  />
                  <StatisticCard 
                    title="MRR Ativo"
                    value={1850000}
                    currency="BRL"
                    trend={{ value: 8.3, direction: 'up', label: 'vs mês anterior' }}
                    details={[
                      { label: 'Ticket Médio:', value: 'R$ 12.500' },
                      { label: 'Total Clientes:', value: '148' },
                    ]}
                  />
                </div>
                <div className="bg-muted/50 rounded-lg p-4 mt-2">
                  <pre className="text-xs text-muted-foreground overflow-x-auto">
{`<RoundedPieChart 
  title="Receita por Serviço"
  data={[
    { name: "Performance", value: 450000 },
    { name: "Social Media", value: 280000 },
  ]}
  trend={{ value: 12.5, direction: 'up' }}
/>`}
                  </pre>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Cards de Estatísticas em Grid (3 Colunas)</h3>
                <p className="text-sm text-muted-foreground">Layout de 3 cards de métricas lado a lado com badges e comparativos.</p>
                <StatisticsCard7 />
                <div className="bg-muted/50 rounded-lg p-4 mt-2 space-y-1">
                  <code className="text-xs text-muted-foreground block">
                    import {"{"} StatisticsCard7 {"}"} from "@/components/ui/charts";
                  </code>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Gráfico de Linha Interativo</h3>
                <p className="text-sm text-muted-foreground">Gráfico com seletor de métricas e badges de variação.</p>
                <div className="max-w-2xl">
                  <InteractiveLineChart />
                </div>
                <div className="bg-muted/50 rounded-lg p-4 mt-2 space-y-1">
                  <code className="text-xs text-muted-foreground block">
                    import {"{"} InteractiveLineChart {"}"} from "@/components/ui/charts";
                  </code>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Toggle Animado (Cinematic Switch)</h3>
                <p className="text-sm text-muted-foreground">Switch com animação suave usando Framer Motion.</p>
                <div className="flex justify-center">
                  <CinematicSwitch />
                </div>
                <div className="bg-muted/50 rounded-lg p-4 mt-2 space-y-1">
                  <code className="text-xs text-muted-foreground block">
                    import {"{"} CinematicSwitch {"}"} from "@/components/ui/charts";
                  </code>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Cards de Estatísticas em Grid (4 Colunas)</h3>
                <p className="text-sm text-muted-foreground">Layout de cards com menus dropdown, deltas e comparativo mensal.</p>
                <StatisticsCard1 />
                <div className="bg-muted/50 rounded-lg p-4 mt-2 space-y-1">
                  <code className="text-xs text-muted-foreground block">
                    import {"{"} StatisticsCard1 {"}"} from "@/components/ui/charts";
                  </code>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Card de Receita Detalhado</h3>
                <p className="text-sm text-muted-foreground">Card único com ícone, valor, delta, e detalhes em linhas.</p>
                <div className="max-w-md">
                  <StatisticsCard10 />
                </div>
                <div className="bg-muted/50 rounded-lg p-4 mt-2 space-y-1">
                  <code className="text-xs text-muted-foreground block">
                    import {"{"} StatisticsCard10 {"}"} from "@/components/ui/charts";
                  </code>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Gráfico de Linha com Seletor de Métricas (v6)</h3>
                <p className="text-sm text-muted-foreground">Versão avançada com mais dados e descrição.</p>
                <div className="max-w-3xl">
                  <LineCharts6 />
                </div>
                <div className="bg-muted/50 rounded-lg p-4 mt-2 space-y-1">
                  <code className="text-xs text-muted-foreground block">
                    import {"{"} LineCharts6 {"}"} from "@/components/ui/charts";
                  </code>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Utilidades</h3>
                <p className="text-sm text-muted-foreground">Componentes auxiliares para construir gráficos customizados.</p>
                <div className="bg-muted/50 rounded-lg p-4 space-y-1">
                  <code className="text-xs text-muted-foreground block">
                    import {"{"} ChartContainer, ChartTooltip, ChartTooltipContent {"}"} from "@/components/ui/charts";
                  </code>
                  <code className="text-xs text-muted-foreground block">
                    import {"{"} ChartLegend, ChartLegendContent {"}"} from "@/components/ui/charts";
                  </code>
                  <code className="text-xs text-muted-foreground block">
                    import type {"{"} ChartConfig {"}"} from "@/components/ui/charts";
                  </code>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="icons" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smile className="h-5 w-5 text-primary" />
                Biblioteca de Ícones
              </CardTitle>
              <CardDescription>
                Ícones do Lucide React disponíveis no sistema. Importar de <code className="text-xs bg-muted px-1.5 py-0.5 rounded">lucide-react</code>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Navegação</h3>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-3">
                  <IconItem icon={Home} name="Home" />
                  <IconItem icon={Menu} name="Menu" />
                  <IconItem icon={Search} name="Search" />
                  <IconItem icon={Settings} name="Settings" />
                  <IconItem icon={ChevronLeft} name="ChevronLeft" />
                  <IconItem icon={ChevronRight} name="ChevronRight" />
                  <IconItem icon={ChevronUp} name="ChevronUp" />
                  <IconItem icon={ChevronDown} name="ChevronDown" />
                  <IconItem icon={ArrowLeft} name="ArrowLeft" />
                  <IconItem icon={ArrowRight} name="ArrowRight" />
                  <IconItem icon={ArrowUp} name="ArrowUp" />
                  <IconItem icon={ArrowDown} name="ArrowDown" />
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Ações</h3>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-3">
                  <IconItem icon={Plus} name="Plus" />
                  <IconItem icon={Minus} name="Minus" />
                  <IconItem icon={Edit} name="Edit" />
                  <IconItem icon={Trash2} name="Trash2" />
                  <IconItem icon={Save} name="Save" />
                  <IconItem icon={Download} name="Download" />
                  <IconItem icon={Upload} name="Upload" />
                  <IconItem icon={RefreshCw} name="RefreshCw" />
                  <IconItem icon={Copy} name="Copy" />
                  <IconItem icon={Share} name="Share" />
                  <IconItem icon={ExternalLink} name="ExternalLink" />
                  <IconItem icon={X} name="X" />
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Usuários e Comunicação</h3>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-3">
                  <IconItem icon={User} name="User" />
                  <IconItem icon={Users} name="Users" />
                  <IconItem icon={Bell} name="Bell" />
                  <IconItem icon={Mail} name="Mail" />
                  <IconItem icon={MessageCircle} name="MessageCircle" />
                  <IconItem icon={Send} name="Send" />
                  <IconItem icon={Phone} name="Phone" />
                  <IconItem icon={Calendar} name="Calendar" />
                  <IconItem icon={Clock} name="Clock" />
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Status e Feedback</h3>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-3">
                  <IconItem icon={Check} name="Check" />
                  <IconItem icon={AlertCircle} name="AlertCircle" />
                  <IconItem icon={Info} name="Info" />
                  <IconItem icon={Eye} name="Eye" />
                  <IconItem icon={EyeOff} name="EyeOff" />
                  <IconItem icon={Lock} name="Lock" />
                  <IconItem icon={Unlock} name="Unlock" />
                  <IconItem icon={Heart} name="Heart" />
                  <IconItem icon={Star} name="Star" />
                  <IconItem icon={Bookmark} name="Bookmark" />
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Negócios e Finanças</h3>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-3">
                  <IconItem icon={DollarSign} name="DollarSign" />
                  <IconItem icon={CreditCard} name="CreditCard" />
                  <IconItem icon={ShoppingCart} name="ShoppingCart" />
                  <IconItem icon={Briefcase} name="Briefcase" />
                  <IconItem icon={Building} name="Building" />
                  <IconItem icon={Target} name="Target" />
                  <IconItem icon={TrendingUp} name="TrendingUp" />
                  <IconItem icon={TrendingDown} name="TrendingDown" />
                  <IconItem icon={Activity} name="Activity" />
                  <IconItem icon={Award} name="Award" />
                  <IconItem icon={Gift} name="Gift" />
                  <IconItem icon={Zap} name="Zap" />
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Arquivos e Mídia</h3>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-3">
                  <IconItem icon={FileText} name="FileText" />
                  <IconItem icon={Folder} name="Folder" />
                  <IconItem icon={Image} name="Image" />
                  <IconItem icon={Video} name="Video" />
                  <IconItem icon={Music} name="Music" />
                  <IconItem icon={Clipboard} name="Clipboard" />
                  <IconItem icon={Link} name="Link" />
                  <IconItem icon={Grid} name="Grid" />
                  <IconItem icon={List} name="List" />
                  <IconItem icon={Filter} name="Filter" />
                  <IconItem icon={SortAsc} name="SortAsc" />
                  <IconItem icon={SortDesc} name="SortDesc" />
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Tecnologia</h3>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-3">
                  <IconItem icon={Database} name="Database" />
                  <IconItem icon={Server} name="Server" />
                  <IconItem icon={Cloud} name="Cloud" />
                  <IconItem icon={CloudOff} name="CloudOff" />
                  <IconItem icon={Wifi} name="Wifi" />
                  <IconItem icon={WifiOff} name="WifiOff" />
                  <IconItem icon={Terminal} name="Terminal" />
                  <IconItem icon={Code} name="Code" />
                  <IconItem icon={GitBranch} name="GitBranch" />
                  <IconItem icon={Github} name="Github" />
                  <IconItem icon={Cpu} name="Cpu" />
                  <IconItem icon={Battery} name="Battery" />
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Localização</h3>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-3">
                  <IconItem icon={Globe} name="Globe" />
                  <IconItem icon={Map} name="Map" />
                  <IconItem icon={MapPin} name="MapPin" />
                  <IconItem icon={Navigation} name="Navigation" />
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Outros</h3>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-3">
                  <IconItem icon={MoreHorizontal} name="MoreHorizontal" />
                  <IconItem icon={MoreVertical} name="MoreVertical" />
                  <IconItem icon={Sun} name="Sun" />
                  <IconItem icon={Moon} name="Moon" />
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 mt-4">
                <p className="text-sm text-muted-foreground mb-2">
                  Para usar um ícone, importe-o do pacote <code className="bg-muted px-1.5 py-0.5 rounded text-xs">lucide-react</code>:
                </p>
                <code className="text-xs text-muted-foreground block">
                  import {"{"} Home, User, Settings {"}"} from "lucide-react";
                </code>
                <code className="text-xs text-muted-foreground block mt-2">
                  {"<Home className=\"h-5 w-5\" />"}
                </code>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function IconItem({ icon: Icon, name }: { icon: any; name: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-muted/50 hover-elevate cursor-pointer transition-all" data-testid={`icon-${name.toLowerCase()}`}>
          <Icon className="h-5 w-5 text-foreground" />
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-mono text-xs">{name}</p>
      </TooltipContent>
    </Tooltip>
  );
}

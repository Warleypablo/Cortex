import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CreatorAuthProvider, useCreatorAuth, type CreatorUser } from "@/contexts/CreatorAuthContext";
import { useTheme } from "@/components/ThemeProvider";
import { apiRequest } from "@/lib/queryClient";
import {
  Loader2, LogOut, Sun, Moon, FileText, Upload, Download, User, Briefcase, Check,
  Clock, ChevronRight, X,
} from "lucide-react";
import turboLogo from "@assets/logo-turbo-branca.svg";

// ── Types ────────────────────────────────────────────────────────────────────

interface ContratoCreator {
  id: number;
  cliente_nome: string | null;
  cargo: string | null;
  descricao_servicos: string | null;
  valor_remuneracao: string | null;
  duracao_meses: number | null;
  data_inicio: string | null;
  data_fim: string | null;
  qtd_videos: number | null;
  unidade_prazo: string | null;
  prazo_entrega_dias: number | null;
  status: string;
  etapa_pagamento: string | null;
  assinado_em: string | null;
  criado_em: string;
  nf_arquivo_path: string | null;
  nf_arquivo_nome: string | null;
  nf_numero: string | null;
  nf_valor: string | null;
  nf_data_emissao: string | null;
  nf_anexado_em: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: string | number | null): string {
  const num = typeof value === "string" ? parseFloat(value) : (value || 0);
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function etapaBadge(etapa: string | null) {
  const map: Record<string, { label: string; bg: string }> = {
    producao: { label: "Produção", bg: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
    aguardando_aprovacao: { label: "Aguardando Aprovação", bg: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300" },
    aprovado: { label: "Aprovado", bg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
    pago: { label: "Pago", bg: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
  };
  const cfg = map[etapa || ""] || { label: etapa || "—", bg: "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400" };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg}`}>{cfg.label}</span>;
}

// ── Portal Content ───────────────────────────────────────────────────────────

type Section = "contratos" | "perfil";

function PortalContent() {
  const { creator, isLoading, logout } = useCreatorAuth();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const [section, setSection] = useState<Section>("contratos");
  const queryClient = useQueryClient();

  // NF Modal state
  const [nfModal, setNfModal] = useState<ContratoCreator | null>(null);
  const [nfFile, setNfFile] = useState<File | null>(null);
  const [nfNumero, setNfNumero] = useState("");
  const [nfValor, setNfValor] = useState("");
  const [nfDataEmissao, setNfDataEmissao] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Perfil form
  const [perfilForm, setPerfilForm] = useState({
    nome: "", email: "", cpf: "", cnpj: "",
    chave_pix: "", tipo_pix: "", endereco: "", cidade: "", estado: "", cep: "",
  });
  const [perfilDirty, setPerfilDirty] = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────
  const { data: contratos = [], isLoading: loadingContratos } = useQuery<ContratoCreator[]>({
    queryKey: ["/api/portal/creator/contratos"],
    enabled: !!creator,
  });

  // ── Mutations ──────────────────────────────────────────────────────────
  const uploadNf = useMutation({
    mutationFn: async ({ contratoId, file, numero, valor, dataEmissao }: { contratoId: number; file: File; numero: string; valor: string; dataEmissao: string }) => {
      const formData = new FormData();
      formData.append("nf_file", file);
      if (numero) formData.append("nf_numero", numero);
      if (valor) formData.append("nf_valor", valor);
      if (dataEmissao) formData.append("nf_data_emissao", dataEmissao);
      const res = await fetch(`/api/portal/creator/contratos/${contratoId}/nf`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erro ao enviar NF");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal/creator/contratos"] });
      setNfModal(null);
      resetNfForm();
    },
  });

  const savePerfil = useMutation({
    mutationFn: async (data: typeof perfilForm) => {
      const res = await apiRequest("PATCH", "/api/portal/creator/me", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal/creator/me"] });
      setPerfilDirty(false);
    },
  });

  function resetNfForm() {
    setNfFile(null);
    setNfNumero("");
    setNfValor("");
    setNfDataEmissao("");
  }

  function openNfModal(contrato: ContratoCreator) {
    setNfModal(contrato);
    resetNfForm();
  }

  function initPerfilForm(c: CreatorUser) {
    setPerfilForm({
      nome: c.nome || "",
      email: c.email || "",
      cpf: c.cpf || "",
      cnpj: c.cnpj || "",
      chave_pix: c.chave_pix || "",
      tipo_pix: c.tipo_pix || "",
      endereco: c.endereco || "",
      cidade: c.cidade || "",
      estado: c.estado || "",
      cep: c.cep || "",
    });
    setPerfilDirty(false);
  }

  // ── Loading / Unauthenticated ──────────────────────────────────────────
  if (isLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? "bg-zinc-950" : "bg-gray-50"}`}>
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!creator) {
    return (
      <div className={`min-h-screen flex items-center justify-center px-4 ${isDark ? "bg-zinc-950" : "bg-gray-50"}`}>
        <div className={`w-full max-w-sm rounded-2xl p-8 space-y-6 shadow-2xl border text-center ${isDark ? "bg-zinc-900 border-white/[0.08]" : "bg-white border-gray-200"}`}>
          <img src={turboLogo} alt="Turbo Partners" className={`h-8 mx-auto ${isDark ? "opacity-90" : "brightness-0 opacity-80"}`} />
          <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>Portal do Creator</h2>
          <p className={`text-sm ${isDark ? "text-white/50" : "text-gray-500"}`}>
            Use o link fornecido pela equipe Turbo para acessar seu portal.
          </p>
        </div>
      </div>
    );
  }

  // ── Main Portal ────────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen flex flex-col ${isDark ? "bg-zinc-950 text-white" : "bg-gray-50 text-gray-900"}`}>
      {/* Header */}
      <header className={`sticky top-0 z-50 border-b px-4 py-3 flex items-center justify-between ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-200"}`}>
        <div className="flex items-center gap-3">
          <img src={turboLogo} alt="Turbo" className={`h-5 ${isDark ? "opacity-90" : "brightness-0 opacity-80"}`} />
          <span className={`text-sm font-medium hidden sm:block ${isDark ? "text-white/60" : "text-gray-500"}`}>Portal Creator</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm hidden sm:block ${isDark ? "text-white/70" : "text-gray-600"}`}>{creator.nome}</span>
          <button onClick={toggleTheme} className={`p-2 rounded-lg transition ${isDark ? "hover:bg-zinc-800" : "hover:bg-gray-100"}`}>
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button onClick={logout} className={`p-2 rounded-lg transition ${isDark ? "hover:bg-zinc-800 text-red-400" : "hover:bg-gray-100 text-red-500"}`}>
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Navigation tabs */}
      <nav className={`border-b px-4 ${isDark ? "border-zinc-800" : "border-gray-200"}`}>
        <div className="flex gap-1 max-w-4xl mx-auto">
          {([
            { id: "contratos" as Section, label: "Meus Contratos", Icon: Briefcase },
            { id: "perfil" as Section, label: "Meu Perfil", Icon: User },
          ]).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => { setSection(id); if (id === "perfil") initPerfilForm(creator); }}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
                section === id
                  ? `border-blue-500 ${isDark ? "text-blue-400" : "text-blue-600"}`
                  : `border-transparent ${isDark ? "text-white/50 hover:text-white/80" : "text-gray-500 hover:text-gray-700"}`
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 px-4 py-6 max-w-4xl mx-auto w-full space-y-4">
        {section === "contratos" && (
          <>
            {loadingContratos ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
            ) : contratos.length === 0 ? (
              <div className={`rounded-xl border p-8 text-center ${isDark ? "border-zinc-800 bg-zinc-900" : "border-gray-200 bg-white"}`}>
                <Briefcase className={`w-10 h-10 mx-auto mb-3 ${isDark ? "text-white/20" : "text-gray-300"}`} />
                <p className={`text-sm ${isDark ? "text-white/50" : "text-gray-500"}`}>Nenhum contrato encontrado.</p>
              </div>
            ) : (
              contratos.map((c) => (
                <div key={c.id} className={`rounded-xl border p-4 space-y-3 ${isDark ? "border-zinc-800 bg-zinc-900" : "border-gray-200 bg-white"}`}>
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <h3 className="font-semibold text-sm">{c.cargo || "Contrato"}</h3>
                      <p className={`text-xs ${isDark ? "text-white/50" : "text-gray-500"}`}>
                        {c.cliente_nome || "—"} &middot; {formatCurrency(c.valor_remuneracao)}/
                        {c.unidade_prazo === "meses" ? "mês" : c.unidade_prazo || "mês"}
                      </p>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {c.status === "enviado" && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">Aguardando Assinatura</span>
                      )}
                      {c.status === "assinado" && etapaBadge(c.etapa_pagamento)}
                    </div>
                  </div>

                  {/* Details */}
                  <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs ${isDark ? "text-white/60" : "text-gray-600"}`}>
                    <div><span className="font-medium">Vigência:</span> {formatDate(c.data_inicio)} — {formatDate(c.data_fim)}</div>
                    <div><span className="font-medium">Assinado em:</span> {formatDate(c.assinado_em)}</div>
                    <div><span className="font-medium">Prazo entrega:</span> {c.prazo_entrega_dias || 3} dias</div>
                    {c.qtd_videos && <div><span className="font-medium">Vídeos:</span> {c.qtd_videos}</div>}
                  </div>

                  {/* NF Status */}
                  {c.nf_arquivo_nome && (
                    <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${isDark ? "bg-green-900/20 text-green-400" : "bg-green-50 text-green-700"}`}>
                      <Check className="w-3.5 h-3.5" />
                      <span>NF anexada: {c.nf_arquivo_nome}</span>
                      {c.nf_numero && <span>&middot; Nº {c.nf_numero}</span>}
                      <span>&middot; {formatDate(c.nf_anexado_em)}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 flex-wrap">
                    <a
                      href={`/api/portal/creator/contratos/${c.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                        isDark ? "bg-zinc-800 hover:bg-zinc-700 text-white/80" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Baixar PDF
                    </a>
                    {c.status === "assinado" && (
                      <button
                        onClick={() => openNfModal(c)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                          c.nf_arquivo_nome
                            ? isDark ? "bg-zinc-800 hover:bg-zinc-700 text-white/60" : "bg-gray-100 hover:bg-gray-200 text-gray-500"
                            : "bg-blue-600 hover:bg-blue-700 text-white"
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {c.nf_arquivo_nome ? "Substituir NF" : "Anexar NF"}
                      </button>
                    )}
                    {c.nf_arquivo_path && (
                      <a
                        href={`/api/portal/creator/contratos/${c.id}/nf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                          isDark ? "bg-zinc-800 hover:bg-zinc-700 text-white/80" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                        }`}
                      >
                        <Download className="w-3.5 h-3.5" />
                        Baixar NF
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {section === "perfil" && (
          <div className={`rounded-xl border p-6 space-y-5 ${isDark ? "border-zinc-800 bg-zinc-900" : "border-gray-200 bg-white"}`}>
            <h2 className="text-lg font-semibold">Meu Perfil</h2>

            {/* Dados Pessoais */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? "text-white/50" : "text-gray-500"}`}>Nome</label>
                <input
                  type="text"
                  value={perfilForm.nome}
                  onChange={(e) => { setPerfilForm(f => ({ ...f, nome: e.target.value })); setPerfilDirty(true); }}
                  className={`w-full rounded-lg px-3 py-2 text-sm border ${isDark ? "bg-zinc-800 border-zinc-700" : "bg-white border-gray-300"}`}
                />
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? "text-white/50" : "text-gray-500"}`}>Email</label>
                <input
                  type="email"
                  value={perfilForm.email}
                  onChange={(e) => { setPerfilForm(f => ({ ...f, email: e.target.value })); setPerfilDirty(true); }}
                  className={`w-full rounded-lg px-3 py-2 text-sm border ${isDark ? "bg-zinc-800 border-zinc-700" : "bg-white border-gray-300"}`}
                />
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? "text-white/50" : "text-gray-500"}`}>CPF</label>
                <input
                  type="text"
                  value={perfilForm.cpf}
                  onChange={(e) => { setPerfilForm(f => ({ ...f, cpf: e.target.value })); setPerfilDirty(true); }}
                  placeholder="000.000.000-00"
                  className={`w-full rounded-lg px-3 py-2 text-sm border ${isDark ? "bg-zinc-800 border-zinc-700" : "bg-white border-gray-300"}`}
                />
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? "text-white/50" : "text-gray-500"}`}>CNPJ</label>
                <input
                  type="text"
                  value={perfilForm.cnpj}
                  onChange={(e) => { setPerfilForm(f => ({ ...f, cnpj: e.target.value })); setPerfilDirty(true); }}
                  placeholder="00.000.000/0000-00"
                  className={`w-full rounded-lg px-3 py-2 text-sm border ${isDark ? "bg-zinc-800 border-zinc-700" : "bg-white border-gray-300"}`}
                />
              </div>
            </div>

            <hr className={isDark ? "border-zinc-800" : "border-gray-200"} />

            {/* Endereço e PIX */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? "text-white/50" : "text-gray-500"}`}>Tipo PIX</label>
                <select
                  value={perfilForm.tipo_pix}
                  onChange={(e) => { setPerfilForm(f => ({ ...f, tipo_pix: e.target.value })); setPerfilDirty(true); }}
                  className={`w-full rounded-lg px-3 py-2 text-sm border ${isDark ? "bg-zinc-800 border-zinc-700" : "bg-white border-gray-300"}`}
                >
                  <option value="">Selecione...</option>
                  <option value="CPF">CPF</option>
                  <option value="CNPJ">CNPJ</option>
                  <option value="Email">Email</option>
                  <option value="Telefone">Telefone</option>
                  <option value="Aleatória">Chave Aleatória</option>
                </select>
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? "text-white/50" : "text-gray-500"}`}>Chave PIX</label>
                <input
                  type="text"
                  value={perfilForm.chave_pix}
                  onChange={(e) => { setPerfilForm(f => ({ ...f, chave_pix: e.target.value })); setPerfilDirty(true); }}
                  className={`w-full rounded-lg px-3 py-2 text-sm border ${isDark ? "bg-zinc-800 border-zinc-700" : "bg-white border-gray-300"}`}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={`block text-xs font-medium mb-1 ${isDark ? "text-white/50" : "text-gray-500"}`}>Endereço</label>
                <input
                  type="text"
                  value={perfilForm.endereco}
                  onChange={(e) => { setPerfilForm(f => ({ ...f, endereco: e.target.value })); setPerfilDirty(true); }}
                  className={`w-full rounded-lg px-3 py-2 text-sm border ${isDark ? "bg-zinc-800 border-zinc-700" : "bg-white border-gray-300"}`}
                />
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? "text-white/50" : "text-gray-500"}`}>Cidade</label>
                <input
                  type="text"
                  value={perfilForm.cidade}
                  onChange={(e) => { setPerfilForm(f => ({ ...f, cidade: e.target.value })); setPerfilDirty(true); }}
                  className={`w-full rounded-lg px-3 py-2 text-sm border ${isDark ? "bg-zinc-800 border-zinc-700" : "bg-white border-gray-300"}`}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? "text-white/50" : "text-gray-500"}`}>UF</label>
                  <input
                    type="text"
                    value={perfilForm.estado}
                    maxLength={2}
                    onChange={(e) => { setPerfilForm(f => ({ ...f, estado: e.target.value.toUpperCase() })); setPerfilDirty(true); }}
                    className={`w-full rounded-lg px-3 py-2 text-sm border ${isDark ? "bg-zinc-800 border-zinc-700" : "bg-white border-gray-300"}`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? "text-white/50" : "text-gray-500"}`}>CEP</label>
                  <input
                    type="text"
                    value={perfilForm.cep}
                    onChange={(e) => { setPerfilForm(f => ({ ...f, cep: e.target.value })); setPerfilDirty(true); }}
                    className={`w-full rounded-lg px-3 py-2 text-sm border ${isDark ? "bg-zinc-800 border-zinc-700" : "bg-white border-gray-300"}`}
                  />
                </div>
              </div>
            </div>

            {perfilDirty && (
              <div className="flex justify-end">
                <button
                  onClick={() => savePerfil.mutate(perfilForm)}
                  disabled={savePerfil.isPending}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                >
                  {savePerfil.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Salvar Alterações
                </button>
              </div>
            )}
            {savePerfil.isSuccess && !perfilDirty && (
              <p className={`text-xs ${isDark ? "text-green-400" : "text-green-600"}`}>Dados salvos com sucesso!</p>
            )}
          </div>
        )}
      </main>

      {/* NF Upload Modal */}
      {nfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setNfModal(null)}>
          <div
            className={`w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl ${isDark ? "bg-zinc-900 border border-zinc-800" : "bg-white"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Anexar Nota Fiscal</h3>
              <button onClick={() => setNfModal(null)} className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className={`text-xs ${isDark ? "text-white/50" : "text-gray-500"}`}>
              {nfModal.cargo} — {nfModal.cliente_nome} — {formatCurrency(nfModal.valor_remuneracao)}
            </p>

            <div className="space-y-3">
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? "text-white/50" : "text-gray-500"}`}>Arquivo NF *</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.xml"
                  onChange={(e) => setNfFile(e.target.files?.[0] || null)}
                  className={`w-full text-sm rounded-lg border px-3 py-2 file:mr-3 file:rounded-md file:border-0 file:text-xs file:font-medium ${
                    isDark ? "bg-zinc-800 border-zinc-700 file:bg-zinc-700 file:text-white" : "bg-white border-gray-300 file:bg-gray-100 file:text-gray-700"
                  }`}
                />
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? "text-white/50" : "text-gray-500"}`}>Número da NF</label>
                <input
                  type="text"
                  value={nfNumero}
                  onChange={(e) => setNfNumero(e.target.value)}
                  placeholder="Ex: 12345"
                  className={`w-full rounded-lg px-3 py-2 text-sm border ${isDark ? "bg-zinc-800 border-zinc-700" : "bg-white border-gray-300"}`}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? "text-white/50" : "text-gray-500"}`}>Valor</label>
                  <input
                    type="number"
                    step="0.01"
                    value={nfValor}
                    onChange={(e) => setNfValor(e.target.value)}
                    className={`w-full rounded-lg px-3 py-2 text-sm border ${isDark ? "bg-zinc-800 border-zinc-700" : "bg-white border-gray-300"}`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? "text-white/50" : "text-gray-500"}`}>Data Emissão</label>
                  <input
                    type="date"
                    value={nfDataEmissao}
                    onChange={(e) => setNfDataEmissao(e.target.value)}
                    className={`w-full rounded-lg px-3 py-2 text-sm border ${isDark ? "bg-zinc-800 border-zinc-700" : "bg-white border-gray-300"}`}
                  />
                </div>
              </div>
            </div>

            {uploadNf.isError && (
              <p className="text-xs text-red-500">{(uploadNf.error as Error).message}</p>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setNfModal(null)}
                className={`px-4 py-2 rounded-lg text-sm ${isDark ? "hover:bg-zinc-800" : "hover:bg-gray-100"}`}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (!nfFile) return;
                  uploadNf.mutate({
                    contratoId: nfModal.id,
                    file: nfFile,
                    numero: nfNumero,
                    valor: nfValor,
                    dataEmissao: nfDataEmissao,
                  });
                }}
                disabled={!nfFile || uploadNf.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
              >
                {uploadNf.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Enviar NF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom mobile nav */}
      <nav className={`sm:hidden sticky bottom-0 border-t flex ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-200"}`}>
        {([
          { id: "contratos" as Section, label: "Contratos", Icon: Briefcase },
          { id: "perfil" as Section, label: "Perfil", Icon: User },
        ]).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => { setSection(id); if (id === "perfil") initPerfilForm(creator); }}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs ${
              section === id
                ? isDark ? "text-blue-400" : "text-blue-600"
                : isDark ? "text-white/40" : "text-gray-400"
            }`}
          >
            <Icon className="w-5 h-5" />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

// ── Wrapper with auth provider ───────────────────────────────────────────────

export default function PortalCreator() {
  // Extract token from URL
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  return (
    <CreatorAuthProvider token={token}>
      <PortalContent />
    </CreatorAuthProvider>
  );
}

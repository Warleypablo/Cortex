<?php
// Verificar se o autoload do Composer existe, senão usar versão standalone

use Mpdf\Tag\Em;

if (file_exists(__DIR__ . '/../vendor/autoload.php')) {
    require_once __DIR__ . '/../vendor/autoload.php';
    $useMPDF = true;
} else {
    // Fallback para versão standalone quando MPDF não está disponível
    $useMPDF = false;
}

function buscarConfiguracaoEmpresa($pdo) {
    try {
        $stmt = $pdo->prepare("SELECT * FROM configuracoes_empresa ORDER BY id DESC LIMIT 1");
        $stmt->execute();
        $config = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($config) {
            return [
                'nome_empresa' => $config['nome_empresa'] ?? 'Turbo Partners LTDA.',
                'cnpj' => $config['cnpj'] ?? '42.100.292/0001-84',
                'nome_socio' => $config['nome_socio'] ?? '',
                'cpf_socio' => $config['cpf_socio'] ?? '',
                'endereco' => $config['endereco'] ?? 'Av. Joao Baptista Parra, 633 - Ed. Enseada Office - Sala 1301 - Enseada do Suá, Vitória/ES - CEP 29052-123',
                'telefone' => $config['telefone'] ?? '(27) 99687-7563',
                'email' => $config['email'] ?? 'contato@turbopartners.com.br',
                'site' => $config['site'] ?? 'https://www.turbopartners.com.br'
            ];
        }

    } catch (Exception $e) {
        // Retornar dados padrão em caso de erro
    }
    
    return [
        'nome_empresa' => 'Turbo Partners LTDA.',
        'cnpj' => '42.100.292/0001-84',
        'endereco' => 'Av. Joao Baptista Parra, 633 - Ed. Enseada Office - Sala 1301 - Enseada do Suá, Vitória/ES - CEP 29052-123',
        'telefone' => '(27) 9979-69628',
        'email' => 'contato@turbopartners.com.br'
    ];
}

function gerarPDFContrato($contrato, $itensContrato, $pdo) {
    global $useMPDF;
    
    try {
        // Buscar configurações da empresa
        $empresaConfig = buscarConfiguracaoEmpresa($pdo);
        
        // Calcular totais
        $valorOriginalTotal = array_sum(array_column($itensContrato, 'valor_original'));    
        $valorNegociadoTotal = array_sum(array_column($itensContrato, 'valor_negociado'));
        $economiaTotal = $valorOriginalTotal - $valorNegociadoTotal;
        
        // Criar instância do MPDF ou fallback
        if ($useMPDF) {
            $mpdf = new \Mpdf\Mpdf([
                'mode' => 'utf-8',
                'format' => 'A4',
                'orientation' => 'P',
                'margin_left' => 10,
                'margin_right' => 10,
                'margin_top' => 45, 
                'margin_bottom' => 20,
                'margin_header' => 10,
                'margin_footer' => 2
            ]);
            
            // Configurar metadados
            $mpdf->SetCreator('Contrato - Turbo Partners LTDA');
            $mpdf->SetAuthor('TurboPartners');
            $mpdf->SetTitle($config['nome_empresa'] . ' - ' . $contrato['numero_contrato'] . ' - ' . $contrato['entidade_nome']);
            $mpdf->SetSubject('Contrato Nº ' . $contrato['numero_contrato']);
            $mpdf->SetKeywords('contrato, prestação, serviços');
        } else {
            $mpdf = new SimplePDFFallback();
        }
        
        // Definir cabeçalho personalizado
        $header = gerarCabecalho($contrato['numero_contrato']);
        $mpdf->SetHTMLHeader($header);
        
        // Definir rodapé personalizado
        $footer = gerarRodape();
        $mpdf->SetHTMLFooter($footer);
        
        // Gerar conteúdo HTML do contrato
        $html = gerarConteudoHTML($contrato, $itensContrato, $valorOriginalTotal, $valorNegociadoTotal, $economiaTotal, $empresaConfig, $pdo);
        
        // Escrever HTML no PDF
        $mpdf->WriteHTML($html);
        
        // Gerar nome do arquivo
        $timestamp = date('Y-m-d_H-i-s');
        $nomeArquivo = isset($contrato['cliente_nome']) ? $contrato['cliente_nome'] : ($contrato['entidade_nome'] ?? 'Cliente');
        $filename = 'Contrato_' . preg_replace('/[^a-zA-Z0-9]/', '_', $contrato['numero_contrato']) . '_' . $nomeArquivo . '.pdf';
        
        // Verificar se é solicitação de download
        $download = isset($_GET['download']) && $_GET['download'] === 'true';
        
        // Configurar headers
        if (!headers_sent()) {
            if ($useMPDF) {
                header('Content-Type: application/pdf');
                if ($download) {
                    header('Content-Disposition: attachment; filename="' . $filename . '"');
                } else {
                    header('Content-Disposition: inline; filename="' . $filename . '"');
                }
                header('Cache-Control: private, max-age=0, must-revalidate');
                header('Pragma: public');
            } else {
                header('Content-Type: text/html; charset=utf-8');
                header('Content-Disposition: inline; filename="' . str_replace('.pdf', '.html', $filename) . '"');
            }
        }
        // Define full path for PDF storage
        $savePath = __DIR__ . '/../storage/pdfs/';
        
        // Create directory if it doesn't exist
        if (!is_dir($savePath)) {
            if (!mkdir($savePath, 0775, true)) {
                throw new Exception('Failed to create PDF storage directory');
            }
        }

        // Ensure directory is writable
        if (!is_writable($savePath)) {
            throw new Exception('PDF storage directory is not writable');
        }

        // Save PDF file
        if ($useMPDF) {
            // First save the file
            $mpdf->Output($savePath . $filename, 'F');
            
            // Then output for download
            $mpdf->Output($filename, 'I');
        } else {
            // Fallback HTML mode
            echo $mpdf->Output($filename, 'S');
        }

        return $filename;

        
    } catch (Exception $e) {
        while (ob_get_level()) {
            ob_end_clean();
        }
        
        if (!headers_sent()) {
            header('Content-Type: text/html; charset=utf-8');
        }
        
        echo '<h3>Erro ao gerar PDF:</h3><p>' . htmlspecialchars($e->getMessage()) . '</p>';
        return false;
    }
}

// Classe de fallback quando MPDF não está disponível
class SimplePDFFallback {
    private $html = '';
    private $config = [];
    
    public function __construct($config = []) {
        $this->config = $config;
    }
    
    public function SetCreator($creator) {}
    public function SetAuthor($author) {}
    public function SetTitle($title) {}
    public function SetSubject($subject) {}
    public function SetKeywords($keywords) {}
    
    public function SetHTMLHeader($header) {
        $this->html .= $header;
    }
    
    public function SetHTMLFooter($footer) {
        $this->html .= $footer;
    }
    
    public function WriteHTML($html) {
        $this->html .= $html;
    }
    
    public function Output($filename, $destination) {
        $htmlOutput = '
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Contrato Turbo Partners</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 0px; padding: 0px; }
                .content-wrapper { margin: 20px; }

                
                /* CSS específico para impressão */
                @media print {
                    .fallback-notice { display: none; }
                    body { margin: 0px !important; padding: 0px !important; }
                    * {
                        -webkit-print-color-adjust: exact !important;
                        color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }
                
            </style>
        </head>
        <body>
            <div class="fallback-notice">
                <h3>⚠️ MODO FALLBACK ATIVO</h3>
                <p><strong>Status:</strong> MPDF não disponível - exibindo versão HTML</p>
                <button onclick="window.print()">🖨️ Imprimir como PDF</button>
            </div>
            ' . $this->html . '
        </body>
        </html>';
        
        return $htmlOutput;
    }
}

function gerarCabecalho($numeroContrato) {
    return '
    
    <div class="header-background" style="border-radius: 7px; background-color: #2d3748; min-height: 80px; padding: 15px 0; width: 100%; margin-bottom: 20px;">
        <div style="width: 100%; margin: 0; padding: 0 20px; box-sizing: border-box;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="width: 20%; vertical-align: middle; padding: 0; ">
                        <img src="data:image/png;base64,' . base64_encode(file_get_contents(__DIR__ . '/../assets/images/logobranca.png')) . '" 
                             alt="Logo" 
                             style="max-height: 60px; width: auto; display: block;">
                    </td>
                    <td style="width: 60%; text-align: center; vertical-align: middle; padding: 0;">
                        <h1 style="color: #ffffff; font-size: 16pt; margin: 0px; font-weight: 800; text-transform: uppercase;">
                            CONTRATO DE PRESTAÇÃO DE SERVIÇOS
                        </h1>
                        <p style="color: rgba(191, 197, 204, 0.9); font-size: 11px; margin: 0;">
                            Contrato Nº ' . str_pad($numeroContrato, 6, '0', STR_PAD_LEFT) . '
                        </p>
                    </td>
                    <td style="width: 20%; text-align: right; vertical-align: bottom; padding: 0;">
                        <div style="color: #ffffff; font-size: 10px; text-align: right;">
                            <div style="">' . date('d/m/Y') . '</div>
                            <div style="">contato@turbopartners.com.br</div>
                        </div>
                    </td>
                </tr>
            </table>
        </div>
    </div>';
}

function gerarConteudoHTML($contrato, $itensContrato, $valorOriginalTotal, $valorNegociadoTotal, $economiaTotal, $empresaConfig, $pdo) {
    // Camada de compatibilidade para diferentes formatos de dados
    if (isset($contrato['cliente_nome'])) {
        // Formato do PDF Manager - usar dados específicos do cliente
        $nomeCliente = $contrato['cliente_nome'];
        $tipoPersona = $contrato['cliente_tipo_pessoa'] ?? 'fisica';
        $cpfCnpj = $contrato['cliente_cpf_cnpj'] ?? '';
        $nomesocio = $contrato['nome_socio'] ?? '';
        $cpf_socio = $contrato['cpf_socio'] ?? '';
        $endereco = $contrato['cliente_endereco'];
        $numero = $contrato['cliente_numero'];
        $complemento = $contrato['cliente_complemento'];
        $bairro = $contrato['cliente_bairro'];
        $cidade = $contrato['cliente_cidade'];
        $estado = $contrato['cliente_estado'];
        $cep = $contrato['cliente_cep'];
        $telefone = $contrato['cliente_telefone'];
        $email = $contrato['cliente_email'];
    } else {
        // Formato do gerar_pdf.php original - usar dados genéricos
        $nomeCliente = $contrato['entidade_nome'] ?? 'Cliente não informado';
        $tipoPersona = $contrato['tipo_pessoa'] ?? 'fisica';
        $cpfCnpj = $contrato['cpf_cnpj'] ?? '';
        $nomesocio = $contrato['nome_socio'] ?? '';
        $cpf_socio = $contrato['cpf_socio'] ?? '';
        $endereco = $contrato['endereco'] ?? '';
        $numero = $contrato['numero'] ?? '';
        $complemento = $contrato['complemento'] ?? '';
        $bairro = $contrato['bairro'] ?? '';
        $cidade = $contrato['cidade'] ?? '';
        $estado = $contrato['estado'] ?? '';
        $cep = $contrato['cep'] ?? '';
        $telefone = $contrato['telefone'] ?? '';
        $email = $contrato['email'] ?? '';
    }
    // Processar itens do contrato para compatibilidade com campos de valor
    $itensProcessados = [];
    foreach ($itensContrato as $item) {
        $itemProcessado = $item;
        
        // Se não tem valor_negociado, calcular baseado no valor_total ou valor_unitario
        if (!isset($itemProcessado['valor_negociado'])) {
            if (isset($item['valor_total']) && $item['valor_total'] > 0) {
                $itemProcessado['valor_negociado'] = floatval($item['valor_total']);
            } elseif (isset($item['valor_unitario'])) {
                $quantidade = intval($item['quantidade'] ?? 1);
                $itemProcessado['valor_negociado'] = floatval($item['valor_unitario']) * $quantidade;
            } else {
                $itemProcessado['valor_negociado'] = 0;
            }
        }
        
        // Adicionar modalidade padrão se não existir
        if (!isset($itemProcessado['modalidade'])) {
            $itemProcessado['modalidade'] = 'pontual';
        }
        
        $itensProcessados[] = $itemProcessado;
    }
    
    // Separar serviços por modalidade
    $servicosRecorrentes = [];
    $servicosPontuais = [];
    
    foreach ($itensProcessados as $item) {
        if (strtolower($item['modalidade']) === 'recorrente') {
            $servicosRecorrentes[] = $item;
        } else {
            $servicosPontuais[] = $item;
        }
    }
    
    $html = '
    <style>
        body { 
            font-family: Arial, sans-serif; 
            line-height: 1.6; 
            color: #2d3748; 
            font-size: 11px;
            margin: 0;
            padding: 0;
        }
        
        .container {
            padding: 10px;
            max-width: 100%;
            width: 100%;
        }
        
        .section { 
            margin-bottom: 24px;
        }
        
        .section-title { 
            font-size: 14px;
            font-weight: bold;
            color: #2d3748;
            margin-bottom: 25px;
            background: #f7fafc;
            padding: 12px 16px;
            border-left: 4px solid #4299e1;
            border-radius: 0px 5px 5px 0px;
        }
        .TMAsection-title { 
            font-size: 14px;
            font-weight: bold;
            color: #2d3748;
            margin-bottom: 16px;
            background: #f7fafc;
            padding: 12px 16px;
            border-left: 4px solid #4299e1;
            border-radius: 0px 10px 10dpx 0px;
            text-align: center;
        }
            .TMAcontent {
            line-height: 2em;
            font-size: 12pt;
            }
        
        .label { 
            font-weight: bold;
            font-size: 10pt;
            color: #4a5568;
        }
        
        .value { 
            color: #2d3748; 
            margin-bottom: 8px;
            font-size: 11pts;
        }
            .valuecap { 
                color: #2d3748; 
                margin-bottom: 8px;
                text-transform: capitalize;
            }
        
        .modalidade-section { 
             margin-bottom: 50px; 
             border: 1px solid rgba(78, 88, 104, 0.12);
             border-radius: 10px;
             padding: 0px 10px;
         }
         
         .modalidade-title { 
             font-size: 12pts; 
             font-weight: bold;  
             color:rgba(90, 99, 116, 0.75); 
             margin-bottom: 16px; 
             padding: 5px 0px; 
             text-align: left;
             border-bottom: 1px solid rgba(78, 88, 104, 0.12);
             width: 100%;
             margin: 0 auto 16px auto;
         }
         
         .servico-item { 
            border-bottom: 1px solid #E6EAF6;
         }
         
         .servico-nome { 
             font-weight: bold; 
             color: #2d3748; 
             margin-bottom: 0px;
             font-size: 10pt;
             border: none;
         }
         
         .servico-detalhes { 
             font-size: 8pt; 
             color: #2d3748;
             margin-bottom: 8px;
             border: none;

         }
         .thead-row {
            background-color:rgb(233, 239, 243); 
            border: 2px solid rgb(233, 239, 243);
         }

         .resumo-modalidade {
             background: #f7fafc;
             padding: 10px 0px 5px 0px; 
             text-align: center;
             border-radius: 0px 0px 4px 4px;
             width: 100%;
             margin: 0px auto;
         }
         
         .resumo-modalidade-titulo {
             font-weight: bold;
             color: #2d3748;
             margin-bottom: 8px;
             font-size: 12px;
         }
         
         .resumo-modalidade-conteudo {
             font-size: 11px;
             color: #2d3748;
         }
         
         .resumo-financeiro {
             background:rgba(190, 190, 190, 0.19); 
             border: 1px solid #2d3748; 
             padding: 10px; 
             margin: 24px 0; 
             border-left: 4px solid #2d3748;
         }
         
         .resumo-financeiro-titulo {
             font-weight: bold;
             color: #2d3748;
             margin-bottom: 0px;
             font-size: 14px;
             text-align: center;
         }
         
         .resumo-financeiro-conteudo {
             font-size: 12px;
             color: #2d3748;
             text-align: center;
         }
         
         .escopo-diretrizes {
             padding: 0px; 
             margin: 10px 0; 
             
         }
         
         
         .escopo-diretrizes-conteudo {
            border-left: 4px solid #4299e1;
            font-size: 11px;
            color: #4a5568;
            line-height: 1.6;
            text-align: justify;
            padding: 5px 15px;
            margin-top: 10px;

         }

             .TMA {
                padding: 12px;
                font-size: 12pt;
                text-align: left;
                font-transform: bolder;
            }
        
        .clausula {
            margin-bottom: 16px;
            padding: 12px;
            border-left: 3px solid #4299e1;
        }
            
        .tma_clausulas {
            margin-bottom: 16px;
            padding: 12px;
            width: 100%;
            float: left;
            text-align: justify;
        }

        .clausula-titulo {
            font-weight: bold;
            margin-bottom: 8px;
        }
        
        .tma_clausula-titulo {
            font-weight: bold;
            margin: 8px 0px;
            text-transform: uppercase;
        }


        .observacoes-container {
            margin: 20px 0px;
            
        }
        .observacoes {
            border-left: 4px solid #4299e1;
            font-size: 11px;
            color: #4a5568;
            line-height: 1.6;
            text-align: justify;
            padding: 5px 15px;
            margin-top: 10px;
        }
        .observacoes-container h3 {
            font-size: 10pt;
            color: #4a5568;
            margin: 0; 
            border-left: 3px solid rgba(123, 228, 96, 0.51);
            padding: 12px;
            background: rgba(216, 255, 206, 0.45);
        }
    </style>
    
    <div class="container">';
    
    // Seção de informações das partes
    $html .= '
    <div class="section">
        <div class="section-title">PARTES CONTRATANTES</div>
        <table style="width: 100%;">
            <tr>
                <td style="width: 50%; vertical-align: top; padding-right: 15px;">
                    <div style="padding: 15px;">
                        <div class="label">
                            <span style="font-weight: bold;">CONTRATADO:</span>
                        </div>
                        <div>&nbsp;</div>
                        <div class="value"><strong style="text-transform: uppercase;">' . htmlspecialchars($empresaConfig['nome_empresa']) . '</strong></div>
                        <div class="value">CNPJ: ' . htmlspecialchars($empresaConfig['cnpj']) . '</div>
                        ' . (!empty($empresaConfig['nome_socio']) ? '<div class="value">Sócio: ' . htmlspecialchars($empresaConfig['nome_socio']) . ', ' : '') . '
                        ' . (!empty($empresaConfig['cpf_socio']) ? 'CPF: ' . htmlspecialchars($empresaConfig['cpf_socio']) . '</div>' : '') . '
                        <div class="value">Endereço: ' . htmlspecialchars($empresaConfig['endereco']) . '</div>
                        <div class="value">Telefone: ' . htmlspecialchars($empresaConfig['telefone']) . '</div>
                        <div class="value">E-mail: ' . htmlspecialchars($empresaConfig['email']) . '</div>
                        
                    </div>
                </td>
                <td style="width: 50%; vertical-align: top; padding-left: 15px;">
                    <div style="padding: 15px;">
                        <div class="label">CONTRATANTE:</div>
                        <div>&nbsp;</div>
                        <div class="value"><strong style="text-transform: uppercase;">' . htmlspecialchars($nomeCliente) . '</strong></div>
                        <div class="value">' . ($tipoPersona == 'juridica' ? 'CNPJ' : 'CPF') . ': ' . htmlspecialchars($cpfCnpj) . '</div>
                        ' . (!empty($nomesocio) ? '<div class="value">Sócio: ' . htmlspecialchars($nomesocio) . ', ' : '') . '
                        ' . (!empty($cpf_socio) ? 'CPF: ' . htmlspecialchars($cpf_socio) . '</div>' : '') . '
                        <div class="valuecap">Endereço: ' . htmlspecialchars($endereco) . ', ' . htmlspecialchars($numero) . ', ' . (!empty($complemento) ? htmlspecialchars($complemento) . ', ' : '') . htmlspecialchars($bairro) . ', ' . htmlspecialchars($cidade) . ', ' . htmlspecialchars($estado) . ', CEP: ' . htmlspecialchars($cep) . '</div>
                        <div class="value">Telefone: ' . htmlspecialchars($telefone) . '</div>
                        <div class="value">E-mail: ' . htmlspecialchars($email) . '</div>
                    </div>
                </td>
            </tr>
        </table>
    </div>';
    
    // Seção de serviços agrupados por modalidade
    if (!empty($itensProcessados)) {
        $html .= '
        <div class="section">
            <div class="section-title">SERVIÇOS CONTRATADOS</div>';
        
        // Modalidade Recorrente
        if (!empty($servicosRecorrentes)) {
            $valorTotalRecorrente = array_sum(array_column($servicosRecorrentes, 'valor_negociado'));
            $dataInicioRecorrente = !empty($contrato['data_inicio_recorrentes']) ? date('d/m/Y', strtotime($contrato['data_inicio_recorrentes'])) : 'A definir';
            $dataCobrancaRecorrente = !empty($contrato['data_inicio_cobranca_recorrentes']) ? date('d/m/Y', strtotime($contrato['data_inicio_cobranca_recorrentes'])) : 'A definir';
            
            
            $html .= '
            <div style="margin: 0px; padding: 0px; border-radius: 5px;  margin-bottom: 40px;">

                <div style="padding: 0px; margin: 0px; background-color: #2D3748; color: #FFF; border-radius: 4px 4px 0px 0px; border: 1px solid #2D3748;">
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 16px;">
                        <div style="font-size: 10pt; margin: 0px;">
                            <span class="mb-0"><strong>MODALIDADE RECORRENTE</strong></span>
                        </div>
                        <div style="color: rgba(226, 232, 241, 0.7); font-size: 8pt;">
                            <span class="mb-1"><strong>Início do Serviço:</strong> ' . $dataInicioRecorrente . '</span>
                            <span class="mb-0 color-white">  |  <strong> Primeiro Vencimento da Cobrança:</strong> ' . $dataCobrancaRecorrente . '</span>
                        </div>
                    </div>
                </div>
              
                <div style="padding: 0px; border: 1px solid #E6EAF6; border-radius: 0px 0px 5px 5px;">
                        <table style="width: 100%; border-spacing: 10px; border-collapse: collapse;">
                            <thead class="thead-item">
                                <tr class="thead-row">
                                    <th style="padding: 5px 10px;">Serviço/Plano</th>
                                    <th style="padding: 5px 10px;">Valor Negociado</th>
                                    <th style="padding: 5px 10px;">Detalhes</th>
                                </tr>
                            </thead>
                            <tbody>';
                            
                            $chunks = array_chunk($servicosRecorrentes, 2);
                            foreach ($chunks as $row) {
                                foreach ($row as $item) {
                                    $html .= '
                                    <tr class="service-row">
                                        <td class="servico-item" style="padding: 5px 10px;">
                                            <strong>'. htmlspecialchars($item['servico_nome']) . '</strong><br>
                                            <small class="text-muted">' . htmlspecialchars($item['plano_nome']) . '</small>
                                        </td>
                                        <td class="servico-item" style="text-align: center; padding: 5px 10px;"><strong class="text-success">R$ ' . number_format($item['valor_negociado'], 2, ',', '.') . '</strong></td>
                                        <td class="servico-item" style="padding: 5px 10px; text-align: center;">
                                            <small>
                                                <span><strong>Vigência Desconto:</strong> '. ucfirst($item['vigencia_desconto']) . '</span>' .
                                                ($item['vigencia_desconto'] != 'permanente' ? '
                                                <span><strong>Duração:</strong> ' . htmlspecialchars($item['periodo_desconto']) . ' meses, </span>
                                                <span>Após período: ' . (function() {
                                                // Check if $item exists before accessing it
                                                $periodo = isset($item['apos_periodo']) ? ucfirst($item['apos_periodo']) : '';
                                                $valorOriginal = isset($item['valor_original']) ? number_format($item['valor_original'], 2, ',', '.') : '';
                                                $valorNegociado = isset($item['valor_negociado']) ? number_format($item['valor_negociado'], 2, ',', '.') : '';
                                                    switch($periodo) {
                                                        case 'valor_original':
                                                            return 'Volta ao valor original R$ ' . $valorOriginal;
                                                        case 'valor_negociado':
                                                            return 'Mantém valor negociado R$ ' . $valorNegociado;
                                                        case 'cancelamento':
                                                            return 'Cancelamento automático.';
                                                        default:
                                                            return 'Volta ao valor original R$ ' . $valorOriginal;
                                                    }
                                                })() . '</span>' : '') . '
                                            </small>
                                        </td>
                                    </tr>';
                                }
                            }
                            
                            $html .= '</tbody>
                        </table>
                    <div style="width: 100%;">
                        <div class="resumo-modalidade">
                            <div class="resumo-modalidade-titulo"> VALOR RECORRENTE: R$ ' . number_format($valorTotalRecorrente, 2, ',', '.') . '</div>
                        </div>
                    </div>
                </div>
            </div>';
        }

        // Modalidade Pontual
        if (!empty($servicosPontuais)) {
            $valorTotalPontual = array_sum(array_column($servicosPontuais, 'valor_negociado'));
            $dataInicioPontual = !empty($contrato['data_inicio_pontuais']) ? date('d/m/Y', strtotime($contrato['data_inicio_pontuais'])) : 'A definir';
            $dataCobrancaPontual = !empty($contrato['data_inicio_cobranca_pontuais']) ? date('d/m/Y', strtotime($contrato['data_inicio_cobranca_pontuais'])) : 'A definir';
            
            
            $html .= '
             <div style="margin: 0px; padding: 0px; border-radius: 5px;  margin-bottom: 40px;">

                <div style="padding: 0px; margin: 0px; background-color: #2D3748; color: #FFF; border-radius: 4px 4px 0px 0px; border: 1px solid #2D3748;">
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 16px;">
                        <div style="font-size: 10pt; margin: 0px;">
                            <span class="mb-0"><strong>MODALIDADE PONTUAL</strong></span>
                        </div>
                        <div style="color: rgba(226, 232, 241, 0.7); font-size: 8pt;">
                            <span class="mb-1"><strong>Início do Serviço:</strong> ' . $dataInicioPontual . '</span>
                            <span class="mb-0 color-white">  |  <strong> Primeiro Vencimento da Cobrança:</strong> ' . $dataCobrancaPontual . '</span>
                        </div>
                    </div>
                </div>

                 <div style="padding: 0px; border: 1px solid #E6EAF6; border-radius: 0px 0px 5px 5px;">
                        <table style="width: 100%; border-spacing: 10px; border-collapse: collapse;">
                            <thead class="thead-item">
                                <tr class="thead-row">
                                    <th style="padding: 5px 10px;">Serviço/Plano</th>
                                    <th style="padding: 5px 10px;">Valor Negociado</th>
                                    <th style="padding: 5px 10px;">Detalhes</th>
                                </tr>
                            </thead>
                            <tbody>';
                            
                            $chunks = array_chunk($servicosPontuais, 2);
                            foreach ($chunks as $row) {
                                foreach ($row as $item) {
                                    $html .= '
                                    <tr>
                                        <td class="servico-item" style="padding: 5px 10px;">
                                            <strong>'. htmlspecialchars($item['servico_nome']) . '</strong><br>
                                            <small class="text-muted">' . htmlspecialchars($item['plano_nome']) . '</small>
                                        </td>
                                        <td class="servico-item" style="text-align: center; padding: 5px 10px;"><strong class="text-success">R$ ' . number_format($item['valor_negociado'], 2, ',', '.') . '</strong></td>
                                        <td class="servico-item" style="padding: 5px 10px; text-align: center;">
                                            <small>
                                                <span><strong>Pagamento:</strong></span>
                                                <span>' . (
                                                    strtolower($item['forma_pagamento']) === 'avista'
                                                        ? 'À Vista'
                                                        : 'em <strong>' . ucfirst($item['num_parcelas']) . 'x</strong> de <strong>R$ ' . number_format($item['valor_negociado']/$item['num_parcelas'], 2, ',', '.') . '</strong> mensais '
                                                ) . '</span>
                                            </small>
                                        </td>
                                    </tr>';
                                }
                            }
                            
                            $html .= '</tbody>
                        </table>
                    <div style="width: 100%;">
                        <div class="resumo-modalidade">
                            <div class="resumo-modalidade-titulo"> VALOR PONTUAL: R$ ' . number_format($valorTotalPontual, 2, ',', '.') . '</div>
                        </div>
                    </div>
                </div>
            </div>';
        }
        
        
        if(!empty($contrato['observacoes'])) {
            $html .= '<div class="observacoes-container">
                <div class="section-title">OBSERVAÇÕES:</div>
                <div class="observacoes">
                    ' . htmlspecialchars($contrato['observacoes']) . '
                </div>
            </div>
        </div>';
            
        }
            
        
        $html .= '<div style="page-break-before: always;"></div>';
    }
    
    // Seção de Escopo e Diretrizes - buscar do banco de dados
    $html .= '
    <div class="section">
        <div class="escopo-diretrizes">
            <div class="section-title">ESCOPO E DIRETRIZES DOS SERVIÇOS</div>
            <div class="escopo-diretrizes-conteudo">';
    
    // Buscar escopo e diretrizes dos planos de serviços contratados
    try {
        $planosIds = array_column($itensContrato, 'plano_servico_id');
        if (!empty($planosIds)) {
            $placeholders = str_repeat('?,', count($planosIds) - 1) . '?';
            $stmt = $pdo->prepare("
                SELECT DISTINCT p.escopo, p.diretrizes, p.nome as plano_nome, s.nome as servico_nome
                FROM planos_servicos p 
                INNER JOIN servicos s ON p.servico_id = s.id
                WHERE p.id IN ($placeholders) AND (p.escopo IS NOT NULL OR p.diretrizes IS NOT NULL)
                ORDER BY s.nome, p.nome
            ");
            $stmt->execute($planosIds);
            $planosDetalhes = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            if (!empty($planosDetalhes)) {
                foreach ($planosDetalhes as $plano) {
                    if (!empty($plano['escopo']) || !empty($plano['diretrizes'])) {
                        $html .= '<div style="margin-bottom: 20px; padding-left: 5px;">';
                        $html .= '<strong>Serviço:</strong><br>' . htmlspecialchars($plano['servico_nome']) . ' - ' . htmlspecialchars($plano['plano_nome']) . '<br><br>';
                        
                        if (!empty($plano['escopo'])) {
                            $html .= '<strong>Escopo:</strong><br>' . nl2br(htmlspecialchars($plano['escopo'])) . '<br><br>';
                        }
                        
                        if (!empty($plano['diretrizes'])) {
                            $html .= '<strong>Diretrizes:</strong><br>' . nl2br(htmlspecialchars($plano['diretrizes'])) . '<br>';
                        }
                        
                        $html .= '</div>';
                    }
                }
            } else {
                // Fallback caso não haja escopo/diretrizes cadastrados
                $html .= 'erro na busca de escopo e diretrizes';
            }
        }
    } catch (Exception $e) {
        // Em caso de erro, usar texto padrão
        $html .= '
        <strong>erro na busca de escopo e diretrizes</strong>';
    }
    
    $html .= '
            </div>
        </div>
    </div>';
    

    
    // Quebra de página antes do TURBO MASTER AGREEMENT (TMA)
    $html .= '<div style="page-break-before: always;"></div>';
    
    $html .= '
        <div class="section">
            <div class="TMAsection-title">TURBO MASTER AGREEMENT (TMA)</div>
            <h3 style="font-size: 14pt; text-align: center;">ÍNDICE</h3>
            <div class="TMAcontent">
                <ol>
                    <li>PRELIMINARES DA PARCERIA</li>
                    <li>ADEQUAÇÃO DO ESCOPO DA PRESTAÇÃO DE SERVIÇO</li>
                    <li>FASE DE IMPLEMENTAÇÃO</li>
                    <li>FASE DE EXECUÇÃO</li>
                    <li>FORMA DE PAGAMENTO</li>
                    <li>OBRIGAÇÕES DA CONTRATADA</li>
                    <li>OBRIGAÇÕES DA CONTRATANTE</li>
                    <li>SIGILO E CONFIDENCIALIDADE</li>
                    <li>INDEPENDÊNCIA ENTRE OS CONTRATANTES</li>
                    <li>PROTEÇÃO DE DADOS</li>
                    <li>COMPLIANCE</li>
                    <li>CANCELAMENTO DA ASSINATURA</li>
                    <li>DAS DISPOSIÇÕES GERAIS</li>
                </ol>
            </div>
        </div>';


    $html .= '<div style="page-break-after: always;"></div>';

    // Seção de cláusulas
    $html .= '
    <div class="section">
        <div class="section-title">CLAUSULAS CONTRATUAIS</div>

            <div style="text-align: justify;">
                <span class="tma_clausula-titulo">PRELIMINARES DA PARCERIA</span>
                <ul type="none">
                    <li><strong>1.1</strong> O presente Termos & Condições tem por objeto a prestação de serviços de marketing digital realizados pela CONTRATADA, nos termos e limites deste instrumento e conforme detalhamento contido no escopo selecionado, o qual faz parte integrante deste TERMO para todos os fins.</li>
                    <li><strong>1.2</strong> A metodologia adequada para o CONTRATANTE será indicada pelo Especialista responsável pelo planejamento e estruturação, sempre com a concordância do CONTRATANTE.</li>
                    <li><strong>1.3</strong> O Método TURBO aplicado na prestação de serviços depende de diversas variáveis para obter sucesso, entre elas, o emprego das melhores técnicas pela CONTRATADA, a participação ativa da CONTRATANTE e a disposição do mercado, não havendo garantia ou promessa integral de êxito sem o envolvimento desses fatores.</li>
                    <li><strong>1.4</strong> A CONTRATANTE declara que atua em uma estrutura empresarial que visa a contratação dos serviços. A TURBO está relacionada às suas diretrizes de estruturação e expansão no mercado de marketing digital, não possuindo, portanto, uma relação jurídica contratual de parceria empresarial com a CONTRATADA.</li>
                </ul>
                

                <span class="tma_clausula-titulo">ADEQUAÇÃO DO ESCOPO DA PRESTAÇÃO DE SERVIÇO</span>
                <ul type="none">
                    <li><strong>2.1</strong> Considerando que o CONTRATANTE poderá apresentar diferentes necessidades durante o processo de estruturação e expansão no mercado digital, a TURBO conta com diversos planos de atendimento.</li>
                    <li><strong>2.1.1</strong> A indicação e definição do escopo adequado dependerá da maturidade do CONTRATANTE no mercado digital, das suas necessidades e da adequação do escopo de cada plano, o que será definido no momento da venda pelo especialista da TURBO.</li>
                </ul>

                <span class="tma_clausula-titulo">Fase de Implementação</span>
                <ul type="none">
                    <li><strong>3.1</strong> O planejamento e o cronograma de entrega serão definidos em comum acordo entre a CONTRATADA e a CONTRATANTE, na fase de implementação, devendo a CONTRATANTE participar ativamente e obrigatoriamente do processo de organização dele, conforme estabelecido no TURBO MASTER AGREEMENT (TMA).</li>
                    <li><strong>3.2</strong> A Fase de Implementação seguirá as etapas abaixo descritas, sendo o prazo estimado para o seu início de 05 (cinco) dias, contudo dependerá da efetiva disponibilidade de agenda da CONTRATADA e da CONTRATANTE.
                        <ul type="none">
                            <li><strong>3.2.1</strong> Recolhimento de informações: Consiste no preenchimento, pela CONTRATANTE, de formulários com informações essenciais para prestação do serviço, além da disponibilização dos ativos para produção das artes e dos acessos às plataformas necessárias, tais como, mas não se limitando a Meta Business e Google Ads.</li>
                            <li><strong>3.2.2</strong> Reunião de Onboarding: Consiste na realização de reunião entre as PARTES para a alinhamento de informações relativas ao negócio da CONTRATANTE e alinhamento de diretrizes do escopo do projeto, com o prazo ideal de até 05 (cinco) dias após assinatura do contrato.</li>
                            <li><strong>3.2.3</strong> Reunião de Kickoff: Consiste na fase interna da equipe da CONTRATADA visando à elaboração do diagnóstico e da estratégia a partir das informações extraídas na etapa de brainstorm, com prazo ideal de até 7 (sete) dias após a Reunião de Onboarding. O prazo desta etapa será contabilizado a partir do preenchimento do formulário, disponibilização dos ativos e acesso às plataformas. Nesta etapa, a CONTRATANTE deverá aprovar ou solicitar ajustes no plano elaborado pela CONTRATADA </li>
                        </ul>
                    </li>
                    <li><strong>3.3</strong> Com a conclusão da Fase de Implementação, haverá a formalização do instrumento de Planejamento Estratégico, que constará o diagnóstico digital do CONTRATANTE e estratégia planejada para escopo do projeto.</li>
                    <li><strong>3.4</strong> Nos períodos de três ou seis meses, conforme as  necessidades do projeto e a análise da CONTRATADA, poderá haver o replanejamento do projeto, sendo oportunidade para atualizações nas estratégias de campanha e verificação de necessidade de inclusão de serviços, o que será operado conforme cláusula 4.1.</li>
                    <li><strong>3.5</strong> Serviços ou entregas não previstas inicialmente no escopo contratado poderão ser incluídas durante a vigência do contrato, conforme recomendação técnica da CONTRATADA ou solicitação da CONTRATANTE. <br/>
                    A inclusão de tais serviços poderá ocorrer mediante formalização via novo TURBO SERVICE SCOPE (TSS), ou mediante aprovação expressa por termo aditivo, e-mail ou WhatsApp entre as PARTES. Nestes casos, os valores, prazos e condições atualizados passarão a integrar automaticamente o presente instrumento.</li>
                </ul>


                <span class="tma_clausula-titulo">Fase de Execução</span>
                <ul type="none">
                    <li><strong>4.1</strong> Após o cumprimento das etapas de implementação com a confecção e aprovação do Planejamento, o projeto poderá seguir para a fase de execução, que será operada pelas entregas acordadas no módulo de cada serviço. <br/>
                    Parágrafo Único: A CONTRATADA se declara disponível diariamente, em horário comercial, para o esclarecimento de dúvidas e/ou atualização sobre o andamento e execução do projeto, através de canal de comunicação de resposta rápida, utilizando como ferramenta principal o aplicativo de mensagens instantâneas WhatsApp ou outra plataforma indicada pela CONTRATADA.</li>
                    <li><strong>4.2</strong> As entregas, rotinas e recursos previstos nos módulos contratados podem conter reuniões, conteúdos, peças, análises, ajustes ou quaisquer outras atividades operacionais, que estarão disponíveis conforme o escopo contratado. A não utilização, total ou parcial, dessas entregas por decisão, omissão ou inércia da CONTRATANTE não caracteriza inadimplemento contratual por parte da CONTRATADA, tampouco enseja retenção de pagamento, abatimento proporcional, compensação futura ou cancelamento do contrato.
                    Parágrafo Único: Parágrafo Único: A execução integral das entregas está condicionada à colaboração ativa da CONTRATANTE, incluindo o envio de informações, aprovação de conteúdos, participação em reuniões e liberação de acessos, quando aplicável. A ausência dessas condições não afasta a validade do contrato, nem suspende sua exigibilidade financeira.</li>
                </ul>

                <span class="tma_clausula-titulo">FORMA DE PAGAMENTO</span>
                <ul type="none">
                    <li><strong>5.1</strong> O CONTRATANTE deverá pagar à CONTRATADA o valor de implementação e execução da TURBO SERVICE SCOPE (TSS), conforme proposta comercial indicada, de acordo com a periodicidade e a forma de pagamento definidas entre as opções de pagamento disponibilizadas no ato da contratação, e será condição essencial para início da prestação de serviços.
                    <li><strong>5.2</strong> A inadimplência da CONTRATANTE ensejará a suspensão imediata de todas as atividades em curso, incluindo campanhas, materiais em desenvolvimento, projetos pontuais e o acesso a quaisquer ferramentas, plataformas ou sistemas operados ou custeados pela CONTRATADA.
                    Durante o período de suspensão, a CONTRATADA não estará obrigada a realizar qualquer tipo de entrega, suporte, reunião ou atendimento técnico, independentemente da urgência ou impacto.
                    A CONTRATADA não será responsável por qualquer prejuízo direto ou indireto decorrente da suspensão dos serviços em razão da inadimplência.
                    Solicitações pendentes durante o período de suspensão não serão compensadas, acumuladas, entregues retroativamente ou passíveis de reembolso parcial.
                    Parágrafo primeiro: Caso a inadimplência ocorra em relação ao primeiro pagamento, não haverá a apresentação do Planejamento elaborado pela CONTRATADA.
                    Parágrafo segundo: A falta de pagamento de qualquer valor acordado pela TURBO SERVICE SCOPE (TSS), na forma e na data de vencimento previstas no instrumento, resultará no acréscimo sobre o valor em atraso, com juros de 1% (um por cento) ao mês, calculados pro rata die, além de multa moratória de 2% (dois por cento).
                    Parágrafo terceiro: Parágrafo terceiro: O atraso ou a falta de pagamento, pelo CONTRATANTE, de quaisquer valores devidos à CONTRATADA nas suas respectivas datas de vencimento, não acarretará na automática rescisão da TURBO SERVICE SCOPE (TSS), mas causará a suspensão temporária da prestação de serviços até que as pendências financeiras sejam regularizadas, permanecendo todas as obrigações estabelecidas neste termo ao CONTRATANTE. O retorno integral da prestação de serviços somente será restabelecido após a identificação do pagamento de todos os valores devidos.
                    Parágrafo quarto: Ocorrendo atraso no pagamento de quaisquer valores por período superior a 14 dias corridos, a CONTRATADA poderá promover a rescisão da relação contratual, com aplicação de multa no valor equivalente a 2 (dois) Fees em desfavor da CONTRATANTE, além dos valores devidos préviamente não quitados.
                    Parágrafo quinto: Fica resguardado o direito da CONTRATADA realizar o protesto do título e a inscrição da CONTRATANTE nos cadastros restritivos de crédito, após 14 dias de atraso, acrescendo as penas previstas neste dispositivo.</li>
                    <li><strong>5.3</strong> O valor mensal dos serviços contratados poderá ser reajustado anualmente, de forma automática, com base na variação do Índice Nacional de Preços ao Consumidor Amplo (IPCA) ou outro índice oficial que venha a substituí-lo, considerando-se como base o mês da assinatura do contrato.
                    Paralelamente, os valores poderão ser revistos a qualquer tempo, mediante acordo entre as PARTES, em razão de aumento do volume de mídia, inclusão de novos serviços, ampliação de escopo, alocação de novos profissionais ou alterações substanciais na estratégia operacional. Nesse caso, as alterações serão formalizadas por meio de aditivo contratual ou novo TURBO SERVICE SCOPE (TSS).</li>
                    <li><strong>5.4</strong> Para fins de formalização e adequação tributária da relação jurídica entre as partes a CONTRATADA e a '.htmlspecialchars($empresaConfig['nome_empresa']).' (CNPJ n. '.htmlspecialchars($empresaConfig['cnpj']).') emitirá notas fiscais mensais contra a CONTRATANTE, após o pagamento integral devido, correspondente ao pagamento da prestação de serviços.</li>
                </ul>

                <span class="tma_clausula-titulo">OBRIGAÇÕES DA CONTRATADA</span>
                <ul type="none">
                    <li><strong>6.1</strong> Constituem obrigações da CONTRATADA, sem prejuízo de outras obrigações que estejam estipuladas neste TERMO:
                        <ul type="none">
                            <li><strong>a)</strong> Estruturar e planejar o plano de ação conforme as necessidades da CONTRATANTE.</li>
                            <li><strong>b)</strong> Prestar os serviços conforme planejados e aprovados pela CONTRATANTE.</li>
                            <li><strong>c)</strong> Empregar ferramentas de trabalho próprias para a prestação dos serviços.</li>
                            <li><strong>d)</strong> Não explorar, comercialmente, com empresas terceiras, a lista de contatos ou base de dados de cadastro fornecida pela CONTRATANTE para fins de execução dos serviços contratados.</li>
                            <li><strong>e)</strong> Responsabilizar-se pela utilização, não compartilhamento e sigilo dos logins e senhas fornecidos pela CONTRATANTE para acesso aos ambientes e plataformas digitais da CONTRATANTE, necessários à execução destes serviços, tais como Facebook, Instagram, Google, entre outros, responsabilizando-se por não compartilhar tais informações com nenhum terceiro, exceto aqueles considerados essenciais para executar os serviços e, apenas com a finalidade da execução do serviço e pelo tempo que este CONTRATO perdurar, usos que, pelo presente instrumento, são autorizados pela CONTRATANTE.</li>
                            <li><strong>f)</strong> Manter o sigilo em relação às informações da CONTRATANTE compartilhadas sob este CONTRATO, bem como quaisquer dados de titularidade direta ou indireta do CONTRATANTE, salvo para uso interno e de controle de dados da TURBO  , o que já foi autorizado pelo presente, cumprindo os preceitos da Lei Geral de Proteção de Dados ("LGPD").</li>
                            <li><strong>g)</strong> Considerando que a CONTRATADA terá acesso a dados sensíveis e pessoais em nome da CONTRATANTE no acesso e na utilização das mídias sociais e das outras contas de sistemas que sejam de titularidade desta, tais como, mas não limitado a logins, senhas, nome, CPF, RG, por si e por suas subsidiárias, controladas e coligadas, bem como por seus respectivos sócios, diretores, conselheiros, administradores, executivos, empregados, prepostos, subcontratados, representantes e procuradores, deverá cumprir e respeitar de forma ampla e geral, inclusive no que se refere às penas, as leis e regulamentações relativas à proteção dos dados pessoais, incluindo, mas não se limitando, à Lei Federal n° 13.709/2018 (Lei Geral de Proteção de Dados - LGPD), a Lei Federal n° 12.965/2014 (Marco Civil da Internet) e as demais leis brasileiras relacionadas à proteção dos dados pessoais.</li>
                            <li><strong>h)</strong> Não divulgar os dados pessoais acessados em razão deste CONTRATO, nem utilizá-los, compartilhá-los ou mesmo tratá-los por quaisquer outros meios para fins diversos da execução deste CONTRATO.</li>
                        </ul>
                    </li>
                    <li><strong>6.2</strong> A prestação de serviço não estará restrita às plataformas previstas de forma expressa contratualmente, podendo ser executada em qualquer ambiente digital que se mostrar potencialmente e comercialmente interessante à CONTRATANTE, desde que previamente e expressamente aceito pela CONTRATADA.</li>
                </ul>

                <span class="tma_clausula-titulo">OBRIGAÇÕES DA CONTRATANTE</span>
                <ul type="none">
                    <li><strong>7.1</strong> Constituem obrigações da CONTRATANTE, sem prejuízo de outras obrigações que estejam estipuladas neste TERMO:
                        <ul type="none">
                            <li><strong>a)</strong> Fornecer à CONTRATADA todas as informações relativas ao negócio da CONTRATANTE que sejam necessárias para a adequada prestação dos serviços objeto do CONTRATO.</li>
                            <li><strong>b)</strong> Produzir os conteúdos necessários para fins de implementação das estratégias de content marketing sugeridas pela CONTRATADA e aprovadas pela CONTRATANTE.</li>
                            <li><strong>c)</strong> Responsabilizar-se pelo pagamento ou saldo nas mídias pagas (Google, Meta,, Tiktok etc)</li>
                            <li><strong>d)</strong> Participar, ativamente, do processo de planejamento e execução dos serviços prestados pela CONTRATADA para as definições de estratégias e acompanhamentos, bem como fornecer dados e informações pertinentes.</li>
                            <li><strong>e)</strong> Produzir e fornecer à CONTRATADA todos os materiais necessários para execução das estratégias de marketing definidas, exemplificativamente, mas não limitado a: fotos, vídeos, informações e dados sobre o produto, serviço e empresa, agenda e eventos, mediante solicitação prévia da CONTRATADA e de acordo com as estratégias aprovadas.</li>
                            <li><strong>f)</strong> Responsabilizar-se, integralmente, pela veracidade e licitude de todo o conteúdo, imagens, materiais audiovisuais e/ou dados, entre outros, fornecidos à CONTRATADA para fins de prestação dos serviços, bem como responsabiliza-se a aprovar as artes desenvolvidas com base nos materiais fornecidos, reconhecendo, por tal razão, a isenção de responsabilidade da CONTRATADA por eventuais bloqueios e banimentos de contas de anúncios.</li>
                            <li><strong>g)</strong> Responsabilizar-se, integralmente, por obter todas as autorizações relativas a direitos autorais e dos contratos de trabalho que mantém com seus empregados, ou dos contratos que mantém com seus prestadores de serviços, empregados ou não, incluídas as relativas aos eventuais acidentes de trabalho, devendo efetuar por sua conta e exclusiva responsabilidade o pagamento dos salários, remuneração indireta, adicionais de qualquer espécie, impostos e contribuições atualmente existentes ou que venham a ser criados.</li>
                            <li><strong>h)</strong> Manter a CONTRATADA isenta de quaisquer reclamações ou reivindicações relativas a direitos autorais, propriedade intelectual e personalidade de terceiros, sobre os materiais e informações fornecidos pela CONTRATANTE, pugnando pela imediata exclusão da CONTRATADA do polo passivo de quaisquer demandas administrativas ou judiciais advindas em relação ao disposto neste TERMO.</li>
                            <li><strong>i)</strong> Observar as diretrizes e políticas de ética e cultura da CONTRATADA, em quaisquer atos, sugestões e conteúdos vinculados às estratégias de marketing.</li>
                            <li><strong>j)</strong> Informar à CONTRATADA os seus dados cadastrais e dados de acesso (logins e senhas) dos ambientes e plataformas digitais, quando necessários para a execução dos serviços, tais como Facebook, Instagram, Google e quaisquer outros definidos em conjunto entre as PARTES, bem como manter a CONTRATADA sempre informada acerca de quaisquer alterações em dados cadastrais ou dados de acesso, durante a vigência da prestação de serviço.</li>
                            <li><strong>k)</strong> Comprometer-se a manter sigilo sobre quaisquer dados de natureza pessoal, sensível e empresarial que obtiver contato em decorrência desta contratação, oriundos e/ou de interesse da CONTRATADA.</li>
                            <li><strong>l)</strong> Efetuar os pagamentos devidos à CONTRATADA na forma e prazo especificados na proposta comercial.</li>
                            <li><strong>m)</strong> Permitir que a CONTRATADA utilize, sem ônus, o nome comercial, a marca, elementos visuais e os resultados obtidos em campanhas ou projetos executados, com a finalidade de divulgação institucional, comercial ou digital, como portfólio, apresentação de cases ou materiais de marketing. Tal utilização deverá observar os princípios de razoabilidade, confidencialidade estratégica e bom senso, sendo vedada a exposição de dados sensíveis, segredos industriais ou informações que possam prejudicar a reputação ou a competitividade da CONTRATANTE.</li>
                            <li><strong>n)</strong> Permanecer cumprindo as suas obrigações previstas neste TERMO e na proposta comercial em caso de bloqueios e banimentos de contas de anúncios de sua titularidade.</li>
                            <li><strong>o)</strong> Responsabilizar-se, se for o caso da contratação de serviços de software de terceiro para sua plataforma, pelo devido adimplemento das prestações, reconhecendo-se que estes serviços não fazem parte do escopo do presente contrato. A CONTRATADA não assumirá qualquer responsabilidade pelos serviços executados o oferecidos por este software de propriedade de terceiros, bem como pelo funcionamento do software, não se responsabilizando pelo pagamento de despesas operacionais, contratação de software de terceiros, traslados ou eventuais despesas com produção de material e veiculação de mídia, as quais são encargos da CONTRATANTE;</li>
                            <li><strong>p)</strong> A CONTRATANTE reconhece que sua eventual inércia, ausência de participação, atrasos na aprovação de materiais, não envio de informações ou não utilização das entregas contratadas não caracterizam falha na prestação dos serviços por parte da CONTRATADA, tampouco ensejam abatimento de valores, compensações, suspensão de cobranças ou rescisão por justa causa.</li>
                            <li><strong>q)</strong> Optar pelo investimento, ou não, em mídias pagas, conforme estratégias sugeridas pela CONTRATADA.</li>
                            <li><strong>r)</strong> O pagamento integral dos valores pactuados será exigível independentemente da efetiva utilização dos serviços, desde que a CONTRATADA tenha mantido sua disponibilidade técnica e operacional</li>
                        </ul>
                    </li>
                    <li><strong>7.2</strong> A CONTRATANTE tem exclusiva responsabilidade por todas as obrigações fiscais, diretas ou indiretas, trabalhistas, previdenciárias e sociais decorrentes dos contratos de trabalho que mantém com seus empregados, incluindo as relativas aos eventuais acidentes de trabalho, devendo efetuar por sua conta e exclusiva responsabilidade o pagamento dos salários, remuneração indireta, adicionais de qualquer espécie, impostos e contribuições atualmente existentes ou que venham a ser criados.</li>
                    <li><strong>7.3</strong> A CONTRATANTE concede imunidade total e irrestrita à CONTRATADA em razão de eventuais reclamações trabalhistas ajuizadas por empregados e/ou prestadores de serviço da CONTRATANTE que contenham a CONTRATADA no polo passivo e tenham conexão com o presente contrato.</li>
                </ul>

                <span class="tma_clausula-titulo">SIGILO E CONFIDENCIALIDADE</span>
                <ul type="none">
                    <li><strong>8.1</strong> Todas as informações e dados de natureza técnica e comercial tornados de conhecimento a qualquer das PARTES em virtude do presente TERMO e da proposta comercial constituem matéria sigilosa, obrigando-se, assim, sob as penas da lei, a guardar integral e absoluto segredo a seu respeito, bem como a advertir seus empregados e prestadores de serviços sobre a feição sigilosa dos mesmos, comprometendo-se, ainda, a deles não fazer uso em proveito próprio, diretamente ou por interposta pessoa, sob pena de responder civil e penalmente pelo descumprimento de dita obrigação, além das penalidades na Lei Geral de Proteção de Dados ("LGPD").</li>
                    <li><strong>8.2</strong> A obrigação de sigilo e confidencialidade estabelecida neste TERMO e da proposta comercial não se aplica para os casos de divulgação de informações da CONTRATANTE para cumprimento da prestação de serviço pela CONTRATADA.</li>
                </ul>

                <span class="tma_clausula-titulo">INDEPENDÊNCIA ENTRE OS CONTRATANTES</span>
                <ul type="none">
                    <li><strong>9.1</strong> O relacionamento estabelecido por este CONTRATO é exclusivamente de prestador e tomador de serviços. A CONTRATADA ou quaisquer de seus agentes, representantes e/ou empregados não é, nem poderão ser considerados agentes, dos contratos de trabalho que mantém com seus empregados, aí incluídas as relativas aos eventuais acidentes de trabalho, devendo efetuar por sua conta e exclusiva responsabilidade o pagamento dos salários, remuneração indireta, adicionais de qualquer espécie, impostos e contribuições atualmente existentes ou que venham a ser criados.</li>
                    <li><strong>9.2</strong> A PARTE que pagar as ferramentas utilizadas para a prestação dos serviços terá o direito sobre os entregáveis produzidos através dessas ferramentas.</li>
                    <li><strong>9.3</strong> A CONTRATADA será a única responsável pela eventual seleção e alocação de profissionais que conta e exclusiva responsabilidade do pagamento dos salários, remuneração indireta, adicionais que entender serem necessários para a prestação dos serviços. A CONTRATADA reconhece que nenhum de seus eventuais empregados, estagiários, prestadores de serviços ou subcontratados é empregado da CONTRATANTE e que a CONTRATANTE não terá qualquer obrigação de pagar o salário, encargos trabalhistas, encargos da seguridade social (INSS), fundo de garantia (FGTS) ou qualquer outro montante estabelecido por lei ou em CONTRATO relacionado à CONTRATADA ou a tais profissionais.</li>
                    <li><strong>9.4</strong> As PARTES obrigam-se a não contratar, persuadir, aliciar ou tentar atrair qualquer pessoa envolvida no desenvolvimento das atividades relacionadas ao Projeto, sob pena do pagamento da multa prevista no artigo 608 do Código Civil. A obrigação de não aliciamento aqui assumida vigorará por até 02 (dois) anos após o encerramento da parceria ou saída do empregado, colaborador ou investidor.</li>
                    <li><strong>9.5</strong> Sem prejuízo das indenizações por perdas e danos e da responsabilidade criminal, o CONTRATANTE, em caso de infração da cláusula 9.4, pagará a CONTRATADA uma multa não compensatória igual a R$100.000,00 (cem mil reais) por cada infração ou 12 x fee médio (o que for maior).</li>
                </ul>

                <span class="tma_clausula-titulo">PROTEÇÃO DE DADOS</span>
                <ul type="none">
                    <li><strong>10.1</strong> As PARTES comprometem-se a cumprir integralmente a legislação brasileira de proteção de dados, especialmente a Lei nº 13.709/2018 (LGPD), adotando as medidas técnicas e administrativas adequadas à proteção dos dados pessoais acessados durante a execução do contrato.</li>
                    <li><strong>10.2</strong> A CONTRATADA poderá acessar e tratar dados pessoais exclusivamente para fins da prestação dos serviços contratados, comprometendo-se a não compartilhar, divulgar ou utilizar tais dados para qualquer outro fim. Quaisquer incidentes de segurança serão comunicados à CONTRATANTE, que poderá adotar medidas necessárias.
                    Parágrafo único: Qualquer tratamento de dados realizado por subcontratados dependerá de autorização prévia da CONTRATANTE.</li>
                </ul>

                <span class="tma_clausula-titulo">COMPLIANCE</span>
                <ul type="none">
                    <li><strong>11.1.</strong> A CONTRATADA declara que cumpre integralmente as legislações anticorrupção, antiterrorismo e de combate à lavagem de dinheiro em vigor no Brasil, responsabilizando-se por suas obrigações legais e fiscais.</li>
                    <li><strong>11.2.</strong>  As PARTES declaram que a contratação é lícita e que os signatários estão legalmente autorizados a firmar este instrumento.</li>
                </ul>

                <span class="tma_clausula-titulo">CANCELAMENTO DA ASSINATURA</span>
                <ul type="none">
                    <li><strong>12.1.</strong> A CONTRATANTE poderá solicitar o cancelamento da assinatura a qualquer momento, mediante comunicação formal por escrito, exclusivamente via e-mail para contato@turbopartners.com.br, observando-se:
                    <ul type="none">
                        <li><strong>a)</strong> Durante os 6 (seis) primeiros meses de vigência contratual: Será devido o pagamento correspondente a 30 (trinta) dias de aviso prévio, período em que os serviços permanecerão ativos, além da aplicação de multa rescisória equivalente a 1 (uma) mensalidade, a título exclusivamente indenizatório, sem prestação de serviços vinculados a este valor.</li>
                        <li><strong>b)</strong> Após 6 (seis) meses completos de vigência contratual: a CONTRATANTE deverá cumprir aviso prévio de 30 (trinta) dias corridos, período em que os serviços permanecerão ativos e será devido 1 (um) boleto adicional correspondente ao ciclo vigente.</br>
                        Parágrafo único: Caso a CONTRATANTE deixe de cumprir o aviso prévio devido, o valor correspondente deverá ser adimplido em caráter indenizatório, sem prestação de serviços.</li>
                    </ul></li>
                    <li><strong>12.2.</strong> Caso a CONTRATANTE impeça, direta ou indiretamente, a execução dos serviços, isso não isentará o pagamento dos valores devidos. Consideram-se impedimentos, entre outros: falta de fornecimento de acessos, ausência de respostas ou aprovações dentro dos prazos solicitados, ou recusa injustificada de materiais necessários.</li>
                    <li><strong>12.3.</strong> Em contratos de natureza pontual (projetos com valor fechado), não se aplica esta cláusula de cancelamento, sendo devido pela CONTRATANTE o pagamento integral do valor acordado, mesmo em caso de rescisão antecipada.</li>
                    <li><strong>12.4.</strong> Qualquer das PARTES poderá rescindir o contrato por justa causa, nas seguintes hipóteses:
                        <ul type="none">
                            <li><strong>a)</strong> inadimplemento da CONTRATANTE;</li>
                            <li><strong>b)</strong> ausência de participação ativa da CONTRATANTE na execução do projeto.</li>
                        </ul>
                    </li>
                    <li><strong>13.5</strong> Em qualquer hipótese de rescisão, os valores já pagos não serão devolvidos ou reembolsados.</li>
                    <li><strong>13.6</strong> As PARTES não serão responsabilizadas por falhas ou atrasos decorrentes de caso fortuito ou força maior, nos termos do artigo 393 do Código Civil.</li>
                </ul>

                <span class="tma_clausula-titulo">DAS DISPOSIÇÕES GERAIS</span>
                <ul type="none">
                    <li><strong>13.1</strong> Salvo disposição em contrário neste CONTRATO, as comunicações entre as PARTES seguirão os seguintes critérios:
                        <ul type="none">
                            <li><strong>a)</strong> As comunicações de natureza operacional e rotineira (ex: andamento de tarefas, aprovações de peças, alinhamentos de prazos) poderão ser realizadas por meio do aplicativo WhatsApp, desde que seja o canal oficial previamente indicado pela CONTRATADA à CONTRATANTE.</li>
                            <li><strong>b)</strong> Já as comunicações de natureza contratual, jurídica ou financeira, que envolvam alterações de cláusulas, solicitações de cancelamento, pedidos de abatimento, negociação de valores ou notificações formais, deverão ser realizadas exclusivamente por e-mail da CONTRATADA, sendo ele o endereço: contato@turbopartners.com.br. <br/>
                            Qualquer comunicação realizada fora desses critérios não será considerada válida ou legal para efeitos contratuais.</li>
                        </ul>
                    <li><strong>13.2</strong> Notificações: eventuais notificações sobre descumprimento de obrigações contratuais das PARTES deverão ser realizadas por e-mail para os endereços eletrônicos das PARTES indicados no preâmbulo na proposta comercial, devendo as PARTES informar eventual alteração de endereço também por notificação escrita, sob pena de se considerarem válidas as notificações enviadas para os endereços aqui contidos.</li>
                    <li><strong>13.3</strong> Limitação: A CONTRATADA não será, em nenhuma circunstância, responsável por danos indiretos, lucros cessantes, perda de receita, danos operacionais, reputacionais ou quaisquer prejuízos decorrentes de decisões, omissões ou ações da própria CONTRATANTE, de terceiros ou de plataformas utilizadas para a execução do projeto, incluindo instabilidades ou falhas externas alheias ao seu controle. </li>
                    <li><strong>13.4</strong> Este contrato será regido pela legislação civil brasileira, com foro eleito na comarca da sede da CONTRATADA.</li>
                    <li><strong>13.5</strong> O presente contrato será assinado eletronicamente por meio de plataforma certificada (ex: Zapsign, Docusign ou equivalente), nos termos da MP 2.200-2/2001 e da Lei 14.063/2020, dispensadas testemunhas, e valerá como título executivo extrajudicial.</li> 
                    <li><strong>13.6</strong> Ao firmar este instrumento, a CONTRATANTE declara, sob as penas da lei, que:
                        <ul type="none">
                            <li><strong>a)</strong> o signatário possui mais de 18 (dezoito) anos e plena capacidade civil;</li>
                            <li><strong>b)</strong> está legalmente autorizado a representar a pessoa jurídica CONTRATANTE e a assumir as obrigações previstas neste contrato;</li>
                            <li><strong>c)</strong> leu integralmente o presente TERMO, compreendeu todas as suas cláusulas, e está ciente das entregas, prazos e condições pactuadas;</li>
                            <li><strong>d)</strong> aceita integralmente o conteúdo deste contrato, sem vícios de consentimento.</li>
                        </ul>
                    </li>
                </ul>
            </div>
        </div>             
    </div>';

    // Seção de assinaturas
    $html .= '

    </div>';
    
    return $html;
}

function gerarRodape() {
    global $contrato;
    return '
    <div style="width: 100%; border-top: 2px solid #E6EAF6; padding: 5px 0; margin-top: 0px;">
        <table style="width: 100%; border-collapse: collapse;">
            <tr>
                <td style="width: 33%; text-align: left; vertical-align: middle; padding: 0 15px;">
                    <div style="font-size: 8px; color: #4a5568; line-height: 1.4;">
                        <strong style="color: #2d3748;">TURBO PARTNERS LTDA</strong><br>
                        CNPJ: 42.100.292/0001-84<br>
                        contato@turbopartners.com.br
                    </div>
                </td>
                <td style="width: 34%; text-align: center; vertical-align: middle; padding: 0 15px;">
                    <div style="font-size: 9px; color: #2d3748; font-weight: bold;">
                        DOCUMENTO OFICIAL<br>
                        <span style="font-size: 8px; color: #718096; font-weight: normal;">Gerado em ' . date('d/m/Y', strtotime($contrato['data_criacao'])) . '</span>
                    </div>
                </td>
                <td style="width: 33%; text-align: right; vertical-align: middle; padding: 0 15px;">
                    <div style="font-size: 8px; color: #4a5568; line-height: 1.4;">
                        <strong style="color: #2d3748;">Página {PAGENO} de {nbpg}</strong><br>
                        www.turbopartners.com.br<br>
                        (27) 99687-7563
                    </div>
                </td>
            </tr>
        </table>
    </div>';
}

function mesExtenso($mes) {
    $meses = [
        1 => 'janeiro', 2 => 'fevereiro', 3 => 'março', 4 => 'abril',
        5 => 'maio', 6 => 'junho', 7 => 'julho', 8 => 'agosto',
        9 => 'setembro', 10 => 'outubro', 11 => 'novembro', 12 => 'dezembro'
    ];
    return $meses[$mes] ?? 'janeiro';
}
?>
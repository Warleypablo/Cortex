import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, GitBranch, Rocket, Shield } from 'lucide-react';

export default function TestWorkflow() {
  const steps = [
    { icon: GitBranch, label: 'Feature Branch', desc: 'Criada a partir de staging', done: true },
    { icon: Shield, label: 'GitHub Actions', desc: 'Lint, type-check, build, testes', done: true },
    { icon: Rocket, label: 'Deploy Staging', desc: 'Render auto-deploy', done: true },
    { icon: CheckCircle, label: 'Deploy Producao', desc: 'PR staging → main', done: false },
  ];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Teste de Workflow</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Esta pagina foi criada para validar o fluxo de desenvolvimento.
        </p>
      </div>

      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white">Pipeline de Deploy</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-4">
                <step.icon
                  className={`h-5 w-5 ${step.done ? 'text-green-500' : 'text-gray-400 dark:text-zinc-500'}`}
                />
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">{step.label}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{step.desc}</p>
                </div>
                <Badge
                  variant={step.done ? 'default' : 'secondary'}
                  className={step.done ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : ''}
                >
                  {step.done ? 'Concluido' : 'Pendente'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white">Ambiente Atual</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">URL:</span>
              <span className="ml-2 font-mono text-gray-900 dark:text-white">{window.location.hostname}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Porta:</span>
              <span className="ml-2 font-mono text-gray-900 dark:text-white">{window.location.port || '443'}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { Link, useSearchParams } from 'react-router-dom';
import { AuthSplitLayout } from '../components/AuthSplitLayout';
import { PartnerOrgSignupForm } from '../components/forms/PartnerOrgSignupForm';
import { getTemplateById } from '../lib/registrationFormTemplates';

export function PartnerOrgSignupPage() {
  const [searchParams] = useSearchParams();
  const tplId = searchParams.get('tpl');
  const template = tplId ? getTemplateById(tplId) : null;

  return (
    <AuthSplitLayout
      heroSubtitle="Bem-vindo ao hub de parceiros Obra10+. Ao sair do campo com CNPJ ou CEP válidos, completamos dados da empresa e do endereço automaticamente. As informações servem para criar a sua conta e o contacto comercial."
    >
      <div className="mx-auto w-full max-w-xl space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Cadastro de parceiro</h1>
          <p className="mt-2 text-sm text-slate-600">Preencha os dados da empresa e da sua conta de acesso.</p>
        </div>

        {tplId && !template ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Este link não está mais disponível. Peça um novo convite à equipe Obra10+.
          </div>
        ) : (
          <PartnerOrgSignupForm
            key={tplId || 'sem-template'}
            extraFields={template?.fields ?? []}
            onSubmitSuccess={() => {
              window.alert('Cadastro validado (demonstração). Em produção, os dados seguem para confirmação e criação da conta.');
            }}
          />
        )}

        <p className="text-center text-sm">
          <Link to="/entrada" className="font-medium text-primary underline underline-offset-2 hover:text-[#0f2840]">
            Voltar à entrada
          </Link>
        </p>
      </div>
    </AuthSplitLayout>
  );
}

import { Link, useSearchParams } from 'react-router-dom';
import { AuthSplitLayout } from '../components/AuthSplitLayout';
import { PartnerOrgSignupForm } from '../components/forms/PartnerOrgSignupForm';
import { useUiFeedback } from '../context/UiFeedbackContext';
import { getTemplateById } from '../lib/registrationFormTemplates';

export function PartnerOrgSignupPage() {
  const { toast } = useUiFeedback();
  const [searchParams] = useSearchParams();
  const tplId = searchParams.get('tpl');
  const template = tplId ? getTemplateById(tplId) : null;
  const inviteBlocked = Boolean(template && template.inviteLinkEnabled === false);

  return (
    <AuthSplitLayout
      heroSubtitle="Bem-vindo ao hub de parceiros Obra10+. Ao sair do campo com CNPJ ou CEP válidos, completamos dados da empresa e do endereço automaticamente. As informações servem para criar a sua conta e o contato comercial."
    >
      <div className="mx-auto w-full max-w-4xl space-y-6 px-0 sm:px-1">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-primary">Cadastro de parceiro</h1>
        </div>

        {tplId && !template ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Este link não está mais disponível. Peça um novo convite à equipe Obra10+.
          </div>
        ) : inviteBlocked ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
            Este cadastro não está aceitando novos envios no momento. Entre em contato com a equipe Obra10+ se precisar de ajuda.
          </div>
        ) : (
          <PartnerOrgSignupForm
            key={tplId || 'sem-template'}
            extraFields={template?.fields ?? []}
            onSubmitSuccess={() => {
              toast(
                'Cadastro validado (demonstração). Em produção, os dados seguem para confirmação e criação da conta.',
                { variant: 'success', duration: 6000 }
              );
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

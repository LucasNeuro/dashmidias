import { Link, useSearchParams } from 'react-router-dom';
import { AuthSplitLayout } from '../components/AuthSplitLayout';
import { PartnerOrgSignupForm } from '../components/forms/PartnerOrgSignupForm';
import { useUiFeedback } from '../context/UiFeedbackContext';
import { getHubPartnerKind, normalizePartnerKindSlug } from '../lib/hubPartnerKinds';
import { getTemplateById } from '../lib/registrationFormTemplates';

export function PartnerOrgSignupPage() {
  const { toast } = useUiFeedback();
  const [searchParams] = useSearchParams();
  const tplId = searchParams.get('tpl');
  const template = tplId ? getTemplateById(tplId) : null;
  const inviteBlocked = Boolean(template && template.inviteLinkEnabled === false);
  const kind = template ? getHubPartnerKind(normalizePartnerKindSlug(template.partnerKind)) : null;
  const titleMain = template
    ? (template.name?.trim() || 'Cadastro convidado')
    : 'Cadastro no Obra10+ HUB';
  const titleEyebrow = template
    ? (kind ? `Perfil: ${kind.label}` : 'Formulário de convite')
    : 'Parceiros e fornecedores';

  return (
    <AuthSplitLayout
      heroSubtitle="Bem-vindo ao hub de parceiros Obra10+. Ao sair do campo com CNPJ ou CEP válidos, completamos dados da empresa e do endereço automaticamente. As informações servem para criar a sua conta e o contato comercial."
    >
      <div className="mx-auto w-full max-w-4xl space-y-6 px-0 sm:px-1">
        <div className="rounded-none border border-white/20 bg-white/[0.97] p-5 shadow-lg backdrop-blur-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{titleEyebrow}</p>
          <h1 className="mt-1.5 text-2xl font-black tracking-tight text-primary">{titleMain}</h1>
          {!template ? (
            <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
              Para vincular o cadastro a um perfil concreto (ex.: <strong>imobiliárias</strong>, arquitetos), abra o link de convite
              enviado pela equipe — ele inclui o parâmetro <code className="rounded-none bg-slate-100 px-1.5 py-0.5 text-xs">tpl=</code> do
              template.
            </p>
          ) : null}
        </div>

        {tplId && !template ? (
          <div className="rounded-none border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Este link não está mais disponível. Peça um novo convite à equipe Obra10+.
          </div>
        ) : inviteBlocked ? (
          <div className="rounded-none border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
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
          <Link to="/login" className="font-medium text-primary underline underline-offset-2 hover:text-[#0f2840]">
            Voltar ao login
          </Link>
        </p>
      </div>
    </AuthSplitLayout>
  );
}

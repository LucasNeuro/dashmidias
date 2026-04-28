import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

/** @param {unknown} s */
function onlyDigits(s) {
  return String(s ?? '').replace(/\D/g, '');
}

/**
 * Domínios de e-mail descartáveis, de teste óbvios ou usados em spam — bloqueiam endereços falsos.
 * Inclui também subdomínios (ver `isBlockedEmailDomain`).
 */
const BLOCKED_EMAIL_DOMAINS = new Set(
  [
    '10minutemail.com',
    '10minutemail.net',
    '20minutemail.com',
    '33mail.com',
    'anonbox.net',
    'anonymbox.com',
    'armyspy.com',
    'bccto.me',
    'bugmenot.com',
    'burnthespam.info',
    'byom.de',
    'candymail.de',
    'cem.net',
    'chammy.info',
    'clrmail.com',
    'cock.li',
    'crazymailing.com',
    'cuvox.de',
    'dandikmail.com',
    'daymail.life',
    'deadaddress.com',
    'discard.email',
    'discardmail.com',
    'disposable.com',
    'disposableemailaddresses.com',
    'disposableinbox.com',
    'dispostable.com',
    'dodgeit.com',
    'doiea.com',
    'dropmail.me',
    'dumpmail.de',
    'email-fake.com',
    'emailondeck.com',
    'emailtemporar.ro',
    'example.com',
    'example.net',
    'example.org',
    'eyepaste.com',
    'fakeinbox.com',
    'fakemailgenerator.com',
    'fakermail.com',
    'fastmailforyou.net',
    'filzmail.com',
    'friendlymail.co.uk',
    'getairmail.com',
    'getmail1.com',
    'getnada.com',
    'gishpuppy.com',
    'grr.la',
    'guerrillamail.com',
    'guerrillamail.de',
    'guerrillamail.net',
    'guerrillamail.org',
    'gun.gr',
    'h8s.org',
    'harakirimail.com',
    'inboxalias.com',
    'inboxbear.com',
    'inboxclean.com',
    'inboxlive.com',
    'inboxpause.com',
    'inboxspam.com',
    'incognitomail.com',
    'incognitomail.org',
    'jetable.com',
    'jetable.fr.nf',
    'jetable.net',
    'jourrapide.com',
    'junkmail.com',
    'kasmail.com',
    'keepmymail.com',
    'kickmail.com',
    'killmail.com',
    'kir.ch.tc',
    'klzlk.com',
    'lroid.com',
    'mail-temporaire.fr',
    'mailcatch.com',
    'mailcleaner.org',
    'maildrop.cc',
    'mailfake.com',
    'mailimate.com',
    'mailinator.com',
    'mailinator.net',
    'mailinator.org',
    'mailismagic.com',
    'mailmetrash.com',
    'mailmoat.com',
    'mailna.co',
    'mailna.com',
    'mailnesia.com',
    'mailnull.com',
    'mailsac.com',
    'mailtemp.info',
    'mailtothis.com',
    'mailzilla.com',
    'mbx.cc',
    'meltmail.com',
    'minuteinbox.com',
    'moakt.com',
    'mohmal.com',
    'momentics.ru',
    'mvrht.com',
    'mytrashmail.com',
    'nada.ltd',
    'neko2.net',
    'netmails.net',
    'nopemail.com',
    'notmailinator.com',
    'nowmymail.com',
    'nwldx.com',
    'objectmail.com',
    'oneoffemail.com',
    'onewaymail.com',
    'owlymail.com',
    'p33.org',
    'pokemail.net',
    'politikerclub.de',
    'pp.ua',
    'privy-mail.com',
    'proxymail.eu',
    'put2.net',
    'pwrby.com',
    'rainmail.biz',
    'rcpt.at',
    'recode.me',
    'rtrtr.com',
    's0ny.net',
    'safe-mail.net',
    'sharklasers.com',
    'shiftr.io',
    'shitmail.me',
    'shitmail.org',
    'sibmail.com',
    'sneakemail.com',
    'sogetthis.com',
    'spam4.me',
    'spambog.com',
    'spambog.ru',
    'spamgourmet.com',
    'spamhole.com',
    'spaminator.org',
    'spammotel.com',
    'spamspot.com',
    'speed.1s.fr',
    'superrito.com',
    'superstachel.de',
    'temp-mail.org',
    'temp-mail.ru',
    'tempail.com',
    'tempalias.com',
    'tempemail.com',
    'tempermail.com',
    'tempinbox.com',
    'tempmail.com',
    'tempmail.net',
    'tempmailer.com',
    'tempmailer.de',
    'tempmailaddress.com',
    'tempmailo.com',
    'tempomail.fr',
    'tempomail.net',
    'tempr.email',
    'tempymail.com',
    'thanksnospam.info',
    'thetrashmail.com',
    'throwam.com',
    'throwaway.email',
    'throwawaymail.com',
    'tmail.gg',
    'tmail.ws',
    'tmailinator.com',
    'tradermail.info',
    'trash-mail.com',
    'trash-mail.de',
    'trash2009.com',
    'trashdevil.com',
    'trashemail.de',
    'trashmail.at',
    'trashmail.com',
    'trashmail.de',
    'trashmail.me',
    'trashmail.net',
    'trashmail.org',
    'trashmail.ws',
    'trashmailer.com',
    'trashspam.com',
    'trbvm.com',
    'trickmail.net',
    'trillianpro.com',
    'tryalert.com',
    'tutamail.com',
    'twinmail.de',
    'tyldd.com',
    'umail.net',
    'valemail.net',
    'vektort.com',
    'veryrealemail.com',
    'videotubedownloaders.com',
    'viralplays.com',
    'voidbay.com',
    'vubby.com',
    'wasteland.rfc822.org',
    'wegwerfmail.de',
    'wegwerpmailadres.nl',
    'wetrainbayarea.com',
    'willselfdestruct.com',
    'winemaven.info',
    'yepmail.com',
    'yogamaven.com',
    'yopmail.com',
    'yopmail.fr',
    'yopmail.net',
    'zippymail.info',
    'zoemail.com',
    // testes típicos e domínios claramente inválidos como remetentes reais
    'localhost',
    'invalid.com',
    'test.com',
    'teste.com',
    'fake.com',
  ].map((d) => d.toLowerCase())
);

/** @param {string} domain */
function isBlockedEmailDomain(domain) {
  const d = domain.toLowerCase().replace(/^www\./, '').trim();
  if (!d || !d.includes('.')) return false;
  if (BLOCKED_EMAIL_DOMAINS.has(d)) return true;
  const parts = d.split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    const suffix = parts.slice(i).join('.');
    if (BLOCKED_EMAIL_DOMAINS.has(suffix)) return true;
  }
  return false;
}

/**
 * @param {string} email
 * @returns {string | null} mensagem de erro ou null se aceite
 */
export function getEmailValidationMessage(email) {
  const t = String(email ?? '').trim().toLowerCase();
  if (!t) return 'Indique o e-mail.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) || t.includes('..') || t.length > 320) {
    return 'Indique um e-mail válido (ex.: nome@empresa.pt).';
  }
  const domain = (t.split('@')[1] ?? '').trim();
  if (!domain) return 'Indique um e-mail válido.';
  if (isBlockedEmailDomain(domain)) {
    return 'Use um e-mail habitual (serviço real). Endereços de teste, temporários ou descartáveis não são aceites.';
  }
  const local = t.split('@')[0] ?? '';
  if (/[<>()[\]\\,;:]/u.test(local)) return 'Indique um e-mail válido.';
  return null;
}

/**
 * Valida número com libphonenumber (BR, PT ou E.164 / +internacional).
 *
 * @param {string | undefined | null} raw
 * @param {{ optional?: boolean }} [opts]
 * @returns {string | null} mensagem ou null se válido/vazio opcional
 */
export function getPhoneValidationMessage(raw, opts = {}) {
  const optional = opts.optional !== false;
  const s = String(raw ?? '').trim();
  if (!s) {
    return optional ? null : 'Indique o telefone.';
  }

  const digits = onlyDigits(s);
  if (digits.length < 9) {
    return 'Telefone incompleto — indique o número completo (DDD ou +indicativo).';
  }

  /** @param {import('libphonenumber-js').PhoneNumber | undefined} p */
  const ok = (p) => Boolean(p && p.isValid());

  let pn = parsePhoneNumberFromString(s);
  if (ok(pn)) return null;

  pn = parsePhoneNumberFromString(s, 'BR');
  if (ok(pn)) return null;

  pn = parsePhoneNumberFromString(s, 'PT');
  if (ok(pn)) return null;

  if (digits.startsWith('55') && digits.length >= 12) {
    pn = parsePhoneNumberFromString('+' + digits);
    if (ok(pn)) return null;
  }
  if (digits.startsWith('351') && digits.length >= 12) {
    pn = parsePhoneNumberFromString('+' + digits);
    if (ok(pn)) return null;
  }

  pn = parsePhoneNumberFromString('+' + digits);
  if (ok(pn)) return null;

  pn = parsePhoneNumberFromString(digits, 'BR');
  if (ok(pn)) return null;

  pn = parsePhoneNumberFromString(digits, 'PT');
  if (ok(pn)) return null;

  return 'Número de telefone inválido. Verifique o indicativo e os dígitos.';
}

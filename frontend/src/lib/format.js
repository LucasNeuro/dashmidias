export const money = (n) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: Number(n) % 1 === 0 ? 0 : 2,
  }).format(Number(n));

export const intFmt = (n) => new Intl.NumberFormat('pt-BR').format(Number(n));

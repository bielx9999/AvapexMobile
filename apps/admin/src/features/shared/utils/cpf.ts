export function onlyCpfDigits(value: string) {
  return value.replace(/\D/g, '');
}

export function isValidCpf(value: string) {
  const digits = onlyCpfDigits(value);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) {
    return false;
  }

  const numbers = digits.split('').map(Number);
  const firstCheckDigit = calculateCpfCheckDigit(numbers.slice(0, 9));
  const secondCheckDigit = calculateCpfCheckDigit([...numbers.slice(0, 9), firstCheckDigit]);

  return numbers[9] === firstCheckDigit && numbers[10] === secondCheckDigit;
}

export function normalizeCpf(value: string) {
  const digits = onlyCpfDigits(value);
  return isValidCpf(digits) ? digits : '';
}

export function formatCpf(value: string) {
  const digits = onlyCpfDigits(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
}

function calculateCpfCheckDigit(numbers: number[]) {
  const weightStart = numbers.length + 1;
  const sum = numbers.reduce((total, number, index) => total + number * (weightStart - index), 0);
  const remainder = (sum * 10) % 11;
  return remainder === 10 ? 0 : remainder;
}

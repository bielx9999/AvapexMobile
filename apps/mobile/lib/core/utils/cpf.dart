String onlyCpfDigits(String value) {
  return value.replaceAll(RegExp(r'\D'), '');
}

bool isValidCpf(String value) {
  final digits = onlyCpfDigits(value);
  if (digits.length != 11 || RegExp(r'^(\d)\1{10}$').hasMatch(digits)) {
    return false;
  }

  final numbers = digits.split('').map(int.parse).toList(growable: false);
  final firstCheckDigit = _calculateCpfCheckDigit(numbers.take(9).toList());
  final secondCheckDigit = _calculateCpfCheckDigit([
    ...numbers.take(9),
    firstCheckDigit,
  ]);

  return numbers[9] == firstCheckDigit && numbers[10] == secondCheckDigit;
}

String normalizeCpf(String value) {
  final digits = onlyCpfDigits(value);
  return isValidCpf(digits) ? digits : '';
}

String formatCpf(String value) {
  final digits = onlyCpfDigits(value);
  final buffer = StringBuffer();
  for (var index = 0; index < digits.length && index < 11; index++) {
    if (index == 3 || index == 6) {
      buffer.write('.');
    }
    if (index == 9) {
      buffer.write('-');
    }
    buffer.write(digits[index]);
  }
  return buffer.toString();
}

int _calculateCpfCheckDigit(List<int> numbers) {
  final weightStart = numbers.length + 1;
  var sum = 0;
  for (var index = 0; index < numbers.length; index++) {
    sum += numbers[index] * (weightStart - index);
  }
  final remainder = (sum * 10) % 11;
  return remainder == 10 ? 0 : remainder;
}

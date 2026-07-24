final class CteAccessKey {
  const CteAccessKey._({required this.value, required this.number});

  final String value;
  final String number;

  static CteAccessKey parse(String input) {
    final key = tryParse(input);
    if (key == null) {
      throw const FormatException(
        'Informe uma chave CT-e valida com 44 digitos.',
      );
    }
    return key;
  }

  static CteAccessKey? tryParse(String input) {
    final match = RegExp(r'\d{44}').firstMatch(input.replaceAll(' ', ''));
    if (match == null) {
      return null;
    }

    final value = match.group(0)!;
    final model = value.substring(20, 22);
    if (model != '57') {
      return null;
    }

    final rawNumber = value.substring(25, 34);
    final number = rawNumber.replaceFirst(RegExp(r'^0+'), '');
    return CteAccessKey._(value: value, number: number.isEmpty ? '0' : number);
  }
}

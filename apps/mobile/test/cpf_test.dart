import 'package:flutter_test/flutter_test.dart';
import 'package:logistica_avapex_mobile/core/utils/cpf.dart';

void main() {
  test('validates CPF check digits', () {
    expect(isValidCpf('390.533.447-05'), isTrue);
    expect(isValidCpf('52998224725'), isTrue);
    expect(isValidCpf('390.533.447-00'), isFalse);
    expect(isValidCpf('111.111.111-11'), isFalse);
  });

  test('formats and normalizes CPF', () {
    expect(formatCpf('39053344705'), '390.533.447-05');
    expect(normalizeCpf('390.533.447-05'), '39053344705');
    expect(normalizeCpf('390.533.447-00'), isEmpty);
  });
}

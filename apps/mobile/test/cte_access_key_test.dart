import 'package:flutter_test/flutter_test.dart';
import 'package:logistica_avapex_mobile/features/receipts/data/models/cte_access_key.dart';

void main() {
  test('extracts CT-e number from a 44 digit access key', () {
    const key = '35260712345678000195570010001234561876543210';

    final parsed = CteAccessKey.parse(key);

    expect(parsed.value, key);
    expect(parsed.number, '123456');
  });

  test('extracts CT-e key embedded in QR Code content', () {
    const qrContent =
        'https://cte.fazenda.gov.br/portal?chCTe=35260712345678000195570010001234561876543210';

    final parsed = CteAccessKey.parse(qrContent);

    expect(parsed.number, '123456');
  });

  test('rejects non CT-e model access keys', () {
    const nfeKey = '35260712345678000195550010001234561876543210';

    expect(CteAccessKey.tryParse(nfeKey), isNull);
  });
}

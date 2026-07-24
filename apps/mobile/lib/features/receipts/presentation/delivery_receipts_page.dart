import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../core/errors/firebase_failure.dart';
import '../../../core/providers/firebase_providers.dart';
import '../../checklists/data/services/device_location_service.dart';
import '../../users/application/user_providers.dart';
import '../application/delivery_receipt_providers.dart';
import '../data/models/cte_access_key.dart';
import '../data/models/delivery_receipt_model.dart';

final class DeliveryReceiptsPage extends ConsumerStatefulWidget {
  const DeliveryReceiptsPage({super.key});

  @override
  ConsumerState<DeliveryReceiptsPage> createState() =>
      _DeliveryReceiptsPageState();
}

final class _DeliveryReceiptsPageState
    extends ConsumerState<DeliveryReceiptsPage> {
  final _formKey = GlobalKey<FormState>();
  final _cteKeyController = TextEditingController();
  final _receiverNameController = TextEditingController();
  final _receiverDocumentController = TextEditingController();
  final List<Offset?> _signaturePoints = [];

  CteAccessKey? _cteAccessKey;
  DeviceLocation? _confirmedLocation;
  var _isLocating = false;
  var _isSaving = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _cteKeyController.addListener(_updateCteFromInput);
    _receiverNameController.addListener(_refreshDeclaration);
    _receiverDocumentController.addListener(_refreshDeclaration);
  }

  @override
  void dispose() {
    _cteKeyController
      ..removeListener(_updateCteFromInput)
      ..dispose();
    _receiverNameController
      ..removeListener(_refreshDeclaration)
      ..dispose();
    _receiverDocumentController
      ..removeListener(_refreshDeclaration)
      ..dispose();
    super.dispose();
  }

  void _refreshDeclaration() {
    setState(() {});
  }

  void _updateCteFromInput() {
    final parsed = CteAccessKey.tryParse(_cteKeyController.text);
    if (parsed?.value == _cteAccessKey?.value) {
      return;
    }
    setState(() => _cteAccessKey = parsed);
  }

  Future<void> _scanQrCode() async {
    final scanned = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const _CteQrScannerPage()),
    );
    if (scanned == null || scanned.isEmpty) {
      return;
    }

    final parsed = CteAccessKey.tryParse(scanned);
    if (parsed == null) {
      setState(
        () => _errorMessage =
            'QR Code lido, mas nenhuma chave CT-e valida foi encontrada.',
      );
      return;
    }

    _cteKeyController.text = parsed.value;
    setState(() {
      _cteAccessKey = parsed;
      _errorMessage = null;
    });
  }

  Future<void> _confirmLocation() async {
    setState(() {
      _isLocating = true;
      _errorMessage = null;
    });

    try {
      final location = await ref
          .read(deviceLocationServiceProvider)
          .getCurrentLocation();
      if (!mounted) {
        return;
      }
      if (location == null) {
        setState(
          () => _errorMessage =
              'Nao foi possivel confirmar a localizacao. Verifique o GPS e a permissao do aplicativo.',
        );
        return;
      }
      setState(() => _confirmedLocation = location);
    } on Object {
      if (mounted) {
        setState(
          () => _errorMessage =
              'Erro ao buscar localizacao. Tente novamente em alguns instantes.',
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLocating = false);
      }
    }
  }

  void _clearSignature() {
    setState(_signaturePoints.clear);
  }

  Future<void> _submit() async {
    final form = _formKey.currentState;
    setState(() => _errorMessage = null);

    if (form == null || !form.validate()) {
      return;
    }

    final cteKey = CteAccessKey.tryParse(_cteKeyController.text);
    if (cteKey == null) {
      setState(
        () => _errorMessage = 'Informe ou escaneie uma chave CT-e valida.',
      );
      return;
    }

    final location = _confirmedLocation;
    if (location == null) {
      setState(() => _errorMessage = 'Confirme a localizacao da entrega.');
      return;
    }

    final hasSignature = _signaturePoints.whereType<Offset>().length >= 2;
    if (!hasSignature) {
      setState(
        () => _errorMessage = 'Solicite a assinatura digital do recebedor.',
      );
      return;
    }

    final authUser = ref.read(firebaseAuthProvider).currentUser;
    final uid = authUser?.uid;
    if (uid == null || uid.isEmpty) {
      setState(() => _errorMessage = 'Motorista nao autenticado.');
      return;
    }

    setState(() => _isSaving = true);

    try {
      final profile = ref.read(currentUserProfileProvider).asData?.value;
      final receiverName = _receiverNameController.text.trim();
      final receiverDocument = _receiverDocumentController.text.trim();
      final now = DateTime.now();
      final receipt = DeliveryReceipt(
        id: 'receipt_${uid}_${now.microsecondsSinceEpoch}',
        driverId: uid,
        driverName:
            profile?.name ?? authUser?.displayName ?? authUser?.email ?? '',
        cteAccessKey: cteKey.value,
        cteNumber: cteKey.number,
        receiverName: receiverName,
        receiverDocument: receiverDocument,
        location: location.toFirestore(),
        signaturePoints: [
          for (final point in _signaturePoints)
            {'x': point?.dx, 'y': point?.dy},
        ],
        declaration: _buildDeclaration(
          receiverName: receiverName,
          receiverDocument: receiverDocument,
          cteNumber: cteKey.number,
        ),
        createdAt: now,
      );

      await ref
          .read(deliveryReceiptRepositoryProvider)
          .saveForCurrentDriver(receipt);

      if (!mounted) {
        return;
      }
      _formKey.currentState?.reset();
      _cteKeyController.clear();
      _receiverNameController.clear();
      _receiverDocumentController.clear();
      setState(() {
        _cteAccessKey = null;
        _confirmedLocation = null;
        _signaturePoints.clear();
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Comprovante enviado com sucesso.')),
      );
    } on FirebaseFailure catch (failure) {
      if (mounted) {
        setState(() => _errorMessage = failure.message);
      }
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final receipts = ref.watch(driverDeliveryReceiptsProvider);

    return Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        children: [
          _SectionCard(
            title: 'CT-e da entrega',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextFormField(
                  controller: _cteKeyController,
                  keyboardType: TextInputType.text,
                  decoration: InputDecoration(
                    labelText: 'Chave CT-e ou conteudo do QR Code',
                    prefixIcon: const Icon(Icons.qr_code_2_outlined),
                    suffixIcon: IconButton(
                      tooltip: 'Escanear QR Code',
                      onPressed: _scanQrCode,
                      icon: const Icon(Icons.qr_code_scanner),
                    ),
                  ),
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(
                      RegExp(r'[0-9A-Za-z:/?&=._%-]'),
                    ),
                  ],
                  validator: (value) {
                    return CteAccessKey.tryParse(value ?? '') == null
                        ? 'Informe uma chave CT-e valida com 44 digitos.'
                        : null;
                  },
                ),
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  onPressed: _scanQrCode,
                  icon: const Icon(Icons.camera_alt_outlined),
                  label: const Text('Escanear QR Code do CT-e'),
                ),
                if (_cteAccessKey != null) ...[
                  const SizedBox(height: 10),
                  _InfoBanner(
                    icon: Icons.description_outlined,
                    label: 'Numero do CT-e',
                    value: _cteAccessKey!.number,
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 12),
          _SectionCard(
            title: 'Localizacao da entrega',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _InfoBanner(
                  icon: _confirmedLocation == null
                      ? Icons.location_off_outlined
                      : Icons.location_on_outlined,
                  label: 'Status',
                  value: _confirmedLocation == null
                      ? 'Localizacao ainda nao confirmada'
                      : _confirmedLocation!.display,
                ),
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  onPressed: _isLocating ? null : _confirmLocation,
                  icon: _isLocating
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.my_location_outlined),
                  label: Text(
                    _isLocating
                        ? 'Confirmando...'
                        : 'Confirmar localizacao atual',
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _SectionCard(
            title: 'Dados do recebedor',
            child: Column(
              children: [
                TextFormField(
                  controller: _receiverNameController,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                    labelText: 'Nome do recebedor',
                    prefixIcon: Icon(Icons.person_outline),
                  ),
                  validator: _requiredText,
                ),
                const SizedBox(height: 10),
                TextFormField(
                  controller: _receiverDocumentController,
                  decoration: const InputDecoration(
                    labelText: 'Matricula, CPF ou RG',
                    prefixIcon: Icon(Icons.badge_outlined),
                  ),
                  validator: _requiredText,
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _SectionCard(
            title: 'Assinatura digital',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _SignaturePad(
                  points: _signaturePoints,
                  onChanged: () => setState(() {}),
                ),
                const SizedBox(height: 8),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton.icon(
                    onPressed: _signaturePoints.isEmpty
                        ? null
                        : _clearSignature,
                    icon: const Icon(Icons.backspace_outlined),
                    label: const Text('Limpar assinatura'),
                  ),
                ),
                const SizedBox(height: 8),
                _DeclarationBox(
                  declaration: _buildDeclaration(
                    receiverName: _receiverNameController.text.trim(),
                    receiverDocument: _receiverDocumentController.text.trim(),
                    cteNumber: _cteAccessKey?.number ?? '________',
                  ),
                ),
              ],
            ),
          ),
          if (_errorMessage != null) ...[
            const SizedBox(height: 12),
            _ErrorBox(message: _errorMessage!),
          ],
          const SizedBox(height: 18),
          FilledButton.icon(
            onPressed: _isSaving ? null : _submit,
            icon: _isSaving
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.send),
            label: Text(_isSaving ? 'Enviando...' : 'Finalizar comprovante'),
          ),
          const SizedBox(height: 18),
          Text(
            'Ultimos comprovantes',
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          receipts.when(
            data: (items) {
              if (items.isEmpty) {
                return const _EmptyHistory();
              }
              return Column(
                children: [
                  for (final receipt in items.take(6))
                    _ReceiptHistoryTile(receipt: receipt),
                ],
              );
            },
            error: (error, _) =>
                _ErrorBox(message: 'Falha ao carregar comprovantes: $error'),
            loading: () => const Center(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: CircularProgressIndicator(),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

final class _CteQrScannerPage extends StatefulWidget {
  const _CteQrScannerPage();

  @override
  State<_CteQrScannerPage> createState() => _CteQrScannerPageState();
}

final class _CteQrScannerPageState extends State<_CteQrScannerPage> {
  final _controller = MobileScannerController();
  var _hasResult = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _handleDetection(BarcodeCapture capture) {
    if (_hasResult) {
      return;
    }
    final rawValue = capture.barcodes
        .map((barcode) => barcode.rawValue)
        .whereType<String>()
        .firstWhere((value) => value.isNotEmpty, orElse: () => '');
    if (rawValue.isEmpty) {
      return;
    }
    _hasResult = true;
    Navigator.of(context).pop(rawValue);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Escanear CT-e')),
      body: Stack(
        children: [
          MobileScanner(controller: _controller, onDetect: _handleDetection),
          Center(
            child: Container(
              width: 260,
              height: 260,
              decoration: BoxDecoration(
                border: Border.all(color: const Color(0xFFFACC15), width: 4),
                borderRadius: BorderRadius.circular(8),
              ),
            ),
          ),
          Align(
            alignment: Alignment.bottomCenter,
            child: Container(
              width: double.infinity,
              color: Colors.black87,
              padding: const EdgeInsets.all(16),
              child: const Text(
                'Aponte a camera para o QR Code do CT-e.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

final class _SignaturePad extends StatelessWidget {
  const _SignaturePad({required this.points, required this.onChanged});

  final List<Offset?> points;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 2.4,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: const Color(0xFF1F1C1C)),
          borderRadius: BorderRadius.circular(8),
        ),
        child: GestureDetector(
          onPanStart: (details) {
            points.add(details.localPosition);
            onChanged();
          },
          onPanUpdate: (details) {
            points.add(details.localPosition);
            onChanged();
          },
          onPanEnd: (_) {
            points.add(null);
            onChanged();
          },
          child: CustomPaint(
            painter: _SignaturePainter(points),
            child: Center(
              child: points.isEmpty
                  ? Text(
                      'Assine aqui',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: const Color(0xFF6B7280),
                        fontWeight: FontWeight.w700,
                      ),
                    )
                  : const SizedBox.shrink(),
            ),
          ),
        ),
      ),
    );
  }
}

final class _SignaturePainter extends CustomPainter {
  const _SignaturePainter(this.points);

  final List<Offset?> points;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.black
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..strokeWidth = 3;

    for (var index = 0; index < points.length - 1; index++) {
      final current = points[index];
      final next = points[index + 1];
      if (current != null && next != null) {
        canvas.drawLine(current, next, paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant _SignaturePainter oldDelegate) {
    return true;
  }
}

final class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              title,
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}

final class _InfoBanner extends StatelessWidget {
  const _InfoBanner({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFB8B8B8)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Icon(icon),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    value,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

final class _DeclarationBox extends StatelessWidget {
  const _DeclarationBox({required this.declaration});

  final String declaration;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xFFF6F6F6),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFB8B8B8)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Text(
          declaration,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.35),
        ),
      ),
    );
  }
}

final class _ErrorBox extends StatelessWidget {
  const _ErrorBox({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFB8B8B8)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Text(
          message,
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
    );
  }
}

final class _EmptyHistory extends StatelessWidget {
  const _EmptyHistory();

  @override
  Widget build(BuildContext context) {
    return const Card(
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Text('Nenhum comprovante enviado por este motorista ainda.'),
      ),
    );
  }
}

final class _ReceiptHistoryTile extends StatelessWidget {
  const _ReceiptHistoryTile({required this.receipt});

  final DeliveryReceipt receipt;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: const CircleAvatar(
          backgroundColor: Colors.black,
          foregroundColor: Colors.white,
          child: Icon(Icons.receipt_long_outlined),
        ),
        title: Text('CT-e ${receipt.cteNumber}'),
        subtitle: Text(
          '${receipt.receiverName} - ${_formatDateTime(receipt.createdAt)}',
        ),
      ),
    );
  }
}

String? _requiredText(String? value) {
  return (value ?? '').trim().isEmpty ? 'Campo obrigatorio.' : null;
}

String _buildDeclaration({
  required String receiverName,
  required String receiverDocument,
  required String cteNumber,
}) {
  final name = receiverName.isEmpty ? '________________' : receiverName;
  final document = receiverDocument.isEmpty
      ? '________________'
      : receiverDocument;
  return 'Eu, $name, portador(a) do documento/matricula $document, declaro que recebi a entrega referente ao CT-e $cteNumber, confirmando a entrega no local registrado pelo aplicativo.';
}

String _formatDateTime(DateTime value) {
  final local = value.toLocal();
  final day = local.day.toString().padLeft(2, '0');
  final month = local.month.toString().padLeft(2, '0');
  final year = local.year.toString();
  final hour = local.hour.toString().padLeft(2, '0');
  final minute = local.minute.toString().padLeft(2, '0');
  return '$day/$month/$year $hour:$minute';
}

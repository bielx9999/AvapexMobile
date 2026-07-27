import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/errors/firebase_failure.dart';
import '../../../core/providers/firebase_providers.dart';
import '../../media/application/media_providers.dart';
import '../../media/data/models/driver_media_type.dart';
import '../../users/application/user_providers.dart';
import '../../vehicles/data/models/vehicle_model.dart';
import '../application/fueling_providers.dart';
import '../data/models/fueling_record_model.dart';

final class FuelingPage extends ConsumerStatefulWidget {
  const FuelingPage({super.key});

  @override
  ConsumerState<FuelingPage> createState() => _FuelingPageState();
}

final class _FuelingPageState extends ConsumerState<FuelingPage> {
  final _formKey = GlobalKey<FormState>();
  final _kmController = TextEditingController();
  final _imagePicker = ImagePicker();

  String? _selectedVehicleId;
  FuelType? _selectedFuelType;
  File? _receiptPhoto;
  File? _odometerPhoto;
  var _isSaving = false;
  String? _errorMessage;

  @override
  void dispose() {
    _kmController.dispose();
    super.dispose();
  }

  Future<void> _pickPhoto({
    required ImageSource source,
    required _FuelingPhotoTarget target,
  }) async {
    setState(() => _errorMessage = null);

    try {
      final picked = await _imagePicker.pickImage(
        source: source,
        imageQuality: 88,
        maxWidth: 1920,
        maxHeight: 1920,
      );
      if (picked == null) {
        return;
      }
      setState(() {
        final file = File(picked.path);
        switch (target) {
          case _FuelingPhotoTarget.receipt:
            _receiptPhoto = file;
          case _FuelingPhotoTarget.odometer:
            _odometerPhoto = file;
        }
      });
    } on PlatformException catch (error) {
      setState(
        () => _errorMessage =
            'Nao foi possivel acessar ${source == ImageSource.camera ? 'a camera' : 'a galeria'}: ${error.message ?? error.code}.',
      );
    }
  }

  void _removePhoto(_FuelingPhotoTarget target) {
    setState(() {
      switch (target) {
        case _FuelingPhotoTarget.receipt:
          _receiptPhoto = null;
        case _FuelingPhotoTarget.odometer:
          _odometerPhoto = null;
      }
    });
  }

  Future<void> _submit(List<Vehicle> vehicles) async {
    final form = _formKey.currentState;
    setState(() => _errorMessage = null);

    if (form == null || !form.validate()) {
      return;
    }

    final vehicle = vehicles.where((item) => item.id == _selectedVehicleId);
    if (vehicle.isEmpty) {
      setState(() => _errorMessage = 'Selecione o veiculo abastecido.');
      return;
    }

    final fuelType = _selectedFuelType;
    if (fuelType == null) {
      setState(() => _errorMessage = 'Selecione o tipo de combustivel.');
      return;
    }

    final receiptPhoto = _receiptPhoto;
    if (receiptPhoto == null) {
      setState(() => _errorMessage = 'Envie a foto da nota de abastecimento.');
      return;
    }

    final odometerPhoto = _odometerPhoto;
    if (odometerPhoto == null) {
      setState(() => _errorMessage = 'Envie a foto do contador de KM.');
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
      final selectedVehicle = vehicle.first;
      final now = DateTime.now();
      final recordId = 'fueling_${uid}_${now.microsecondsSinceEpoch}';
      final receiptPhotoUrls = <String>[];
      final odometerPhotoUrls = <String>[];
      final pendingReceiptPaths = <String>[];
      final pendingOdometerPaths = <String>[];
      final mediaService = ref.read(mediaUploadServiceProvider);

      final receiptUrl = await mediaService.uploadOrQueueDriverImage(
        localFile: receiptPhoto,
        mediaType: DriverMediaType.fuelingReceipt,
        ownerEntityId: recordId,
      );
      if (receiptUrl == null) {
        pendingReceiptPaths.add(receiptPhoto.path);
      } else {
        receiptPhotoUrls.add(receiptUrl);
      }

      final odometerUrl = await mediaService.uploadOrQueueDriverImage(
        localFile: odometerPhoto,
        mediaType: DriverMediaType.fuelingOdometer,
        ownerEntityId: recordId,
      );
      if (odometerUrl == null) {
        pendingOdometerPaths.add(odometerPhoto.path);
      } else {
        odometerPhotoUrls.add(odometerUrl);
      }

      final record = FuelingRecord(
        id: recordId,
        driverId: uid,
        driverName:
            profile?.name ?? authUser?.displayName ?? authUser?.email ?? '',
        vehicleId: selectedVehicle.id,
        vehiclePlate: selectedVehicle.plate,
        vehicleModel: selectedVehicle.model,
        kmRegistered: num.parse(_kmController.text.replaceAll(',', '.')),
        fuelType: fuelType,
        receiptPhotoUrls: receiptPhotoUrls,
        odometerPhotoUrls: odometerPhotoUrls,
        pendingReceiptPhotoLocalPaths: pendingReceiptPaths,
        pendingOdometerPhotoLocalPaths: pendingOdometerPaths,
        notificationStatus: FuelingNotificationStatus.pendingWhatsapp,
        createdAt: now,
      );

      await ref
          .read(fuelingRecordRepositoryProvider)
          .saveForCurrentDriver(record);

      if (!mounted) {
        return;
      }

      _formKey.currentState?.reset();
      _kmController.clear();
      setState(() {
        _selectedVehicleId = null;
        _selectedFuelType = null;
        _receiptPhoto = null;
        _odometerPhoto = null;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            pendingReceiptPaths.isEmpty && pendingOdometerPaths.isEmpty
                ? 'Abastecimento registrado com sucesso.'
                : 'Abastecimento salvo. Fotos pendentes serao enviadas quando houver conexao.',
          ),
        ),
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
    final vehicles = ref.watch(fuelingVehiclesProvider);

    return vehicles.when(
      data: (items) {
        return Form(
          key: _formKey,
          child: ListView(
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: [
              _FuelingSectionCard(
                title: 'Dados do abastecimento',
                child: Column(
                  children: [
                    DropdownButtonFormField<String>(
                      initialValue: _selectedVehicleId,
                      isExpanded: true,
                      decoration: const InputDecoration(
                        labelText: 'Veiculo abastecido',
                        prefixIcon: Icon(Icons.local_shipping_outlined),
                      ),
                      items: [
                        for (final vehicle in items)
                          DropdownMenuItem(
                            value: vehicle.id,
                            child: Text(
                              '${vehicle.plate} - ${vehicle.model}',
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                      ],
                      onChanged: items.isEmpty || _isSaving
                          ? null
                          : (value) => setState(() {
                              _selectedVehicleId = value;
                              _errorMessage = null;
                            }),
                      validator: (value) =>
                          value == null ? 'Selecione o veiculo.' : null,
                    ),
                    if (items.isEmpty) ...[
                      const SizedBox(height: 8),
                      const _FuelingInfoBanner(
                        icon: Icons.info_outline,
                        label: 'Veiculos',
                        value:
                            'Nenhum veiculo cadastrado. O painel administrativo fara esse cadastro.',
                      ),
                    ],
                    const SizedBox(height: 10),
                    TextFormField(
                      controller: _kmController,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      inputFormatters: [
                        FilteringTextInputFormatter.allow(RegExp(r'[0-9,.]')),
                      ],
                      decoration: const InputDecoration(
                        labelText: 'KM abastecido',
                        prefixIcon: Icon(Icons.speed_outlined),
                      ),
                      validator: (value) {
                        final parsed = num.tryParse(
                          (value ?? '').replaceAll(',', '.'),
                        );
                        if (parsed == null || parsed <= 0) {
                          return 'Informe o KM abastecido.';
                        }
                        return null;
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              _FuelingSectionCard(
                title: 'Tipo de combustivel',
                child: SegmentedButton<FuelType>(
                  emptySelectionAllowed: true,
                  selected: {if (_selectedFuelType != null) _selectedFuelType!},
                  segments: const [
                    ButtonSegment(
                      value: FuelType.diesel,
                      icon: Icon(Icons.local_gas_station_outlined),
                      label: Text('Diesel'),
                    ),
                    ButtonSegment(
                      value: FuelType.arla,
                      icon: Icon(Icons.opacity_outlined),
                      label: Text('Arla'),
                    ),
                  ],
                  onSelectionChanged: _isSaving
                      ? null
                      : (selection) {
                          setState(() {
                            _selectedFuelType = selection.isEmpty
                                ? null
                                : selection.first;
                            _errorMessage = null;
                          });
                        },
                ),
              ),
              const SizedBox(height: 12),
              _FuelingSectionCard(
                title: 'Fotos obrigatorias',
                child: Column(
                  children: [
                    _FuelingPhotoField(
                      title: 'Nota do abastecimento',
                      description: 'Foto nitida da notinha fiscal.',
                      file: _receiptPhoto,
                      onCamera: () => _pickPhoto(
                        source: ImageSource.camera,
                        target: _FuelingPhotoTarget.receipt,
                      ),
                      onGallery: () => _pickPhoto(
                        source: ImageSource.gallery,
                        target: _FuelingPhotoTarget.receipt,
                      ),
                      onRemove: () => _removePhoto(_FuelingPhotoTarget.receipt),
                    ),
                    const SizedBox(height: 12),
                    _FuelingPhotoField(
                      title: 'Contador de KM',
                      description: 'Foto do painel mostrando a quilometragem.',
                      file: _odometerPhoto,
                      onCamera: () => _pickPhoto(
                        source: ImageSource.camera,
                        target: _FuelingPhotoTarget.odometer,
                      ),
                      onGallery: () => _pickPhoto(
                        source: ImageSource.gallery,
                        target: _FuelingPhotoTarget.odometer,
                      ),
                      onRemove: () =>
                          _removePhoto(_FuelingPhotoTarget.odometer),
                    ),
                  ],
                ),
              ),
              if (_errorMessage != null) ...[
                const SizedBox(height: 12),
                _FuelingErrorBox(message: _errorMessage!),
              ],
              const SizedBox(height: 18),
              FilledButton.icon(
                onPressed: _isSaving ? null : () => _submit(items),
                icon: _isSaving
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.send),
                label: Text(_isSaving ? 'Enviando...' : 'Enviar abastecimento'),
              ),
              const SizedBox(height: 18),
              Text(
                'Ultimos abastecimentos',
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 8),
              const _FuelingHistoryPreview(),
            ],
          ),
        );
      },
      error: (error, _) => Center(
        child: _FuelingErrorBox(message: 'Falha ao carregar veiculos: $error'),
      ),
      loading: () => const Center(child: CircularProgressIndicator()),
    );
  }
}

enum _FuelingPhotoTarget { receipt, odometer }

final class _FuelingSectionCard extends StatelessWidget {
  const _FuelingSectionCard({required this.title, required this.child});

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

final class _FuelingPhotoField extends StatelessWidget {
  const _FuelingPhotoField({
    required this.title,
    required this.description,
    required this.file,
    required this.onCamera,
    required this.onGallery,
    required this.onRemove,
  });

  final String title;
  final String description;
  final File? file;
  final VoidCallback onCamera;
  final VoidCallback onGallery;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final selectedFile = file;

    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border.all(color: const Color(0xFFE5E7EB)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              title,
              style: Theme.of(
                context,
              ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 2),
            Text(description, style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 10),
            if (selectedFile == null)
              const _FuelingInfoBanner(
                icon: Icons.image_outlined,
                label: 'Foto',
                value: 'Nenhum anexo selecionado',
              )
            else
              _FuelingPhotoPreview(file: selectedFile, onRemove: onRemove),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: onCamera,
                    icon: const Icon(Icons.photo_camera_outlined),
                    label: const Text('Tirar foto'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: onGallery,
                    icon: const Icon(Icons.upload_file_outlined),
                    label: const Text('Enviar foto'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

final class _FuelingPhotoPreview extends StatelessWidget {
  const _FuelingPhotoPreview({required this.file, required this.onRemove});

  final File file;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: Stack(
        alignment: Alignment.topRight,
        children: [
          AspectRatio(
            aspectRatio: 16 / 9,
            child: Image.file(file, fit: BoxFit.cover),
          ),
          Padding(
            padding: const EdgeInsets.all(8),
            child: IconButton.filled(
              tooltip: 'Remover foto',
              onPressed: onRemove,
              icon: const Icon(Icons.close),
            ),
          ),
        ],
      ),
    );
  }
}

final class _FuelingInfoBanner extends StatelessWidget {
  const _FuelingInfoBanner({
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
        color: const Color(0xFFF6F6F6),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFE5E7EB)),
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
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(value),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

final class _FuelingHistoryPreview extends ConsumerWidget {
  const _FuelingHistoryPreview();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final records = ref.watch(driverFuelingRecordsProvider);

    return records.when(
      data: (items) {
        if (items.isEmpty) {
          return const Card(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Text('Nenhum abastecimento registrado ainda.'),
            ),
          );
        }

        return Column(
          children: [
            for (final record in items.take(5)) _FuelingHistoryTile(record),
          ],
        );
      },
      error: (error, _) =>
          _FuelingErrorBox(message: 'Falha ao carregar historico: $error'),
      loading: () => const Center(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: CircularProgressIndicator(),
        ),
      ),
    );
  }
}

final class _FuelingHistoryTile extends StatelessWidget {
  const _FuelingHistoryTile(this.record);

  final FuelingRecord record;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: const Icon(Icons.local_gas_station_outlined),
        title: Text('${record.vehiclePlate} - ${record.fuelType.label}'),
        subtitle: Text(
          'KM ${record.kmRegistered} - ${_formatDateTime(record.createdAt)}',
        ),
        trailing: const Icon(Icons.chevron_right),
      ),
    );
  }
}

final class _FuelingErrorBox extends StatelessWidget {
  const _FuelingErrorBox({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xFFFFF1F2),
        border: Border.all(color: const Color(0xFFFB7185)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            const Icon(Icons.error_outline, color: Color(0xFFBE123C)),
            const SizedBox(width: 10),
            Expanded(child: Text(message)),
          ],
        ),
      ),
    );
  }
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

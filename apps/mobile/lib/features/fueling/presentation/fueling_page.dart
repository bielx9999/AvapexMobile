import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/errors/firebase_failure.dart';
import '../../../core/providers/firebase_providers.dart';
import '../../media/application/media_providers.dart';
import '../../media/data/models/driver_media_type.dart';
import '../../trips/application/trip_providers.dart';
import '../../trips/data/models/trip_model.dart';
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
  final _stationController = TextEditingController();
  final _litersController = TextEditingController();
  final _valueController = TextEditingController();
  final _imagePicker = ImagePicker();

  String? _selectedVehicleId;
  FuelType? _selectedFuelType;
  File? _receiptPhoto;
  File? _odometerPhoto;
  var _fueledAt = DateTime.now();
  var _isSaving = false;
  String? _errorMessage;

  @override
  void dispose() {
    _kmController.dispose();
    _stationController.dispose();
    _litersController.dispose();
    _valueController.dispose();
    super.dispose();
  }

  Future<void> _pickFuelingDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _fueledAt,
      firstDate: DateTime(2024),
      lastDate: DateTime.now(),
    );
    if (picked == null || !mounted) {
      return;
    }
    setState(() {
      _fueledAt = DateTime(
        picked.year,
        picked.month,
        picked.day,
        _fueledAt.hour,
        _fueledAt.minute,
      );
    });
  }

  Future<void> _pickFuelingTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_fueledAt),
    );
    if (picked == null || !mounted) {
      return;
    }
    setState(() {
      _fueledAt = DateTime(
        _fueledAt.year,
        _fueledAt.month,
        _fueledAt.day,
        picked.hour,
        picked.minute,
      );
    });
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

  Future<void> _submit(
    List<Vehicle> vehicles, {
    String? suggestedVehicleId,
  }) async {
    final form = _formKey.currentState;
    setState(() => _errorMessage = null);

    if (form == null || !form.validate()) {
      return;
    }

    final selectedVehicleId = _selectedVehicleId ?? suggestedVehicleId;
    final vehicle = vehicles.where((item) => item.id == selectedVehicleId);
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
        stationName: _stationController.text.trim(),
        liters: num.parse(_litersController.text.replaceAll(',', '.')),
        totalValue: num.parse(_valueController.text.replaceAll(',', '.')),
        fueledAt: _fueledAt,
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
      _stationController.clear();
      _litersController.clear();
      _valueController.clear();
      setState(() {
        _selectedVehicleId = null;
        _selectedFuelType = null;
        _receiptPhoto = null;
        _odometerPhoto = null;
        _fueledAt = DateTime.now();
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
    final activeTrip = ref
        .watch(currentDriverTripsProvider)
        .asData
        ?.value
        .where((trip) => trip.status == TripStatus.inProgress)
        .firstOrNull;

    return DefaultTabController(
      length: 2,
      child: Column(
        children: [
          const TabBar(
            tabs: [
              Tab(icon: Icon(Icons.local_gas_station_outlined), text: 'Enviar'),
              Tab(icon: Icon(Icons.history_outlined), text: 'Historico'),
            ],
          ),
          Expanded(
            child: TabBarView(
              children: [
                vehicles.when(
                  data: (items) {
                    final suggestedVehicleId =
                        items.any(
                          (vehicle) => vehicle.id == activeTrip?.vehicleId,
                        )
                        ? activeTrip?.vehicleId
                        : null;
                    final selectedVehicleId =
                        _selectedVehicleId ?? suggestedVehicleId;
                    return Form(
                      key: _formKey,
                      child: ListView(
                        keyboardDismissBehavior:
                            ScrollViewKeyboardDismissBehavior.onDrag,
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                        children: [
                          _FuelingSectionCard(
                            title: 'Dados do abastecimento',
                            child: Column(
                              children: [
                                DropdownButtonFormField<String>(
                                  initialValue: selectedVehicleId,
                                  isExpanded: true,
                                  decoration: const InputDecoration(
                                    labelText: 'Veiculo abastecido',
                                    prefixIcon: Icon(
                                      Icons.local_shipping_outlined,
                                    ),
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
                                  validator: (value) => value == null
                                      ? 'Selecione o veiculo.'
                                      : null,
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
                                if (suggestedVehicleId != null &&
                                    _selectedVehicleId == null) ...[
                                  const SizedBox(height: 8),
                                  const _FuelingInfoBanner(
                                    icon: Icons.auto_awesome_outlined,
                                    label: 'Preenchido automaticamente',
                                    value:
                                        'Usamos o veiculo da viagem em andamento.',
                                  ),
                                ],
                                const SizedBox(height: 10),
                                Row(
                                  children: [
                                    Expanded(
                                      child: OutlinedButton.icon(
                                        onPressed: _isSaving
                                            ? null
                                            : _pickFuelingDate,
                                        icon: const Icon(Icons.event_outlined),
                                        label: Text(
                                          _formatDate(_fueledAt),
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: OutlinedButton.icon(
                                        onPressed: _isSaving
                                            ? null
                                            : _pickFuelingTime,
                                        icon: const Icon(
                                          Icons.schedule_outlined,
                                        ),
                                        label: Text(
                                          _formatTime(_fueledAt),
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 10),
                                TextFormField(
                                  controller: _stationController,
                                  textCapitalization: TextCapitalization.words,
                                  decoration: const InputDecoration(
                                    labelText: 'Posto',
                                    prefixIcon: Icon(Icons.store_outlined),
                                  ),
                                  validator: (value) =>
                                      (value ?? '').trim().isEmpty
                                      ? 'Informe o posto.'
                                      : null,
                                ),
                                const SizedBox(height: 10),
                                TextFormField(
                                  controller: _kmController,
                                  keyboardType:
                                      const TextInputType.numberWithOptions(
                                        decimal: true,
                                      ),
                                  inputFormatters: [
                                    FilteringTextInputFormatter.allow(
                                      RegExp(r'[0-9,.]'),
                                    ),
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
                                const SizedBox(height: 10),
                                Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Expanded(
                                      child: TextFormField(
                                        controller: _litersController,
                                        keyboardType:
                                            const TextInputType.numberWithOptions(
                                              decimal: true,
                                            ),
                                        inputFormatters: [
                                          FilteringTextInputFormatter.allow(
                                            RegExp(r'[0-9,.]'),
                                          ),
                                        ],
                                        decoration: const InputDecoration(
                                          labelText: 'Litros',
                                          prefixIcon: Icon(
                                            Icons.water_drop_outlined,
                                          ),
                                        ),
                                        validator: (value) =>
                                            _positiveNumberValidator(
                                              value,
                                              'Informe os litros.',
                                            ),
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: TextFormField(
                                        controller: _valueController,
                                        keyboardType:
                                            const TextInputType.numberWithOptions(
                                              decimal: true,
                                            ),
                                        inputFormatters: [
                                          FilteringTextInputFormatter.allow(
                                            RegExp(r'[0-9,.]'),
                                          ),
                                        ],
                                        decoration: const InputDecoration(
                                          labelText: 'Valor total',
                                          prefixText: 'R\$ ',
                                        ),
                                        validator: (value) =>
                                            _positiveNumberValidator(
                                              value,
                                              'Informe o valor.',
                                            ),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 12),
                          _FuelingSectionCard(
                            title: 'Tipo de combustivel',
                            child: SegmentedButton<FuelType>(
                              emptySelectionAllowed: true,
                              selected: {
                                if (_selectedFuelType != null)
                                  _selectedFuelType!,
                              },
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
                                  onRemove: () =>
                                      _removePhoto(_FuelingPhotoTarget.receipt),
                                ),
                                const SizedBox(height: 12),
                                _FuelingPhotoField(
                                  title: 'Contador de KM',
                                  description:
                                      'Foto do painel mostrando a quilometragem.',
                                  file: _odometerPhoto,
                                  onCamera: () => _pickPhoto(
                                    source: ImageSource.camera,
                                    target: _FuelingPhotoTarget.odometer,
                                  ),
                                  onGallery: () => _pickPhoto(
                                    source: ImageSource.gallery,
                                    target: _FuelingPhotoTarget.odometer,
                                  ),
                                  onRemove: () => _removePhoto(
                                    _FuelingPhotoTarget.odometer,
                                  ),
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
                            onPressed: _isSaving
                                ? null
                                : () => _submit(
                                    items,
                                    suggestedVehicleId: suggestedVehicleId,
                                  ),
                            icon: _isSaving
                                ? const SizedBox.square(
                                    dimension: 18,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  )
                                : const Icon(Icons.send),
                            label: Text(
                              _isSaving
                                  ? 'Enviando...'
                                  : 'Registrar abastecimento',
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                  error: (error, _) => Center(
                    child: _FuelingErrorBox(
                      message: 'Falha ao carregar veiculos: $error',
                    ),
                  ),
                  loading: () =>
                      const Center(child: CircularProgressIndicator()),
                ),
                const _FuelingHistoryTab(),
              ],
            ),
          ),
        ],
      ),
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

final class _FuelingHistoryTab extends ConsumerStatefulWidget {
  const _FuelingHistoryTab();

  @override
  ConsumerState<_FuelingHistoryTab> createState() => _FuelingHistoryTabState();
}

final class _FuelingHistoryTabState extends ConsumerState<_FuelingHistoryTab> {
  DateTime? _startDate;
  DateTime? _endDate;

  Future<void> _pickStartDate() async {
    final picked = await _pickDate(initialDate: _startDate ?? DateTime.now());
    if (picked == null) {
      return;
    }
    setState(() => _startDate = _dateOnly(picked));
  }

  Future<void> _pickEndDate() async {
    final picked = await _pickDate(initialDate: _endDate ?? DateTime.now());
    if (picked == null) {
      return;
    }
    setState(() => _endDate = _dateOnly(picked));
  }

  Future<DateTime?> _pickDate({required DateTime initialDate}) {
    return showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: DateTime(2024),
      lastDate: DateTime.now(),
    );
  }

  void _clearFilters() {
    setState(() {
      _startDate = null;
      _endDate = null;
    });
  }

  List<FuelingRecord> _filterByPeriod(List<FuelingRecord> records) {
    final start = _startDate;
    final endExclusive = _endDate?.add(const Duration(days: 1));

    return records
        .where((record) {
          final createdAt = record.createdAt.toLocal();
          if (start != null && createdAt.isBefore(start)) {
            return false;
          }
          if (endExclusive != null && !createdAt.isBefore(endExclusive)) {
            return false;
          }
          return true;
        })
        .toList(growable: false);
  }

  @override
  Widget build(BuildContext context) {
    final records = ref.watch(driverFuelingRecordsProvider);

    return records.when(
      data: (items) {
        final filtered = _filterByPeriod(items);

        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            _FuelingHistoryFilters(
              startDate: _startDate,
              endDate: _endDate,
              onPickStart: _pickStartDate,
              onPickEnd: _pickEndDate,
              onClear: _clearFilters,
            ),
            const SizedBox(height: 12),
            if (items.isEmpty)
              const _FuelingEmptyHistory()
            else if (filtered.isEmpty)
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: Text(
                    'Nenhum abastecimento encontrado para o periodo selecionado.',
                  ),
                ),
              )
            else
              for (final record in filtered) _FuelingHistoryTile(record),
          ],
        );
      },
      error: (error, _) => Center(
        child: _FuelingErrorBox(message: 'Falha ao carregar historico: $error'),
      ),
      loading: () => const Center(child: CircularProgressIndicator()),
    );
  }
}

final class _FuelingHistoryFilters extends StatelessWidget {
  const _FuelingHistoryFilters({
    required this.startDate,
    required this.endDate,
    required this.onPickStart,
    required this.onPickEnd,
    required this.onClear,
  });

  final DateTime? startDate;
  final DateTime? endDate;
  final VoidCallback onPickStart;
  final VoidCallback onPickEnd;
  final VoidCallback onClear;

  bool get hasFilters => startDate != null || endDate != null;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Filtrar historico',
              style: Theme.of(
                context,
              ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 10),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: _FuelingDateFilterButton(
                    icon: Icons.event_outlined,
                    label: startDate == null
                        ? 'Data inicial'
                        : _formatDate(startDate!),
                    onPressed: onPickStart,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _FuelingDateFilterButton(
                    icon: Icons.event_available_outlined,
                    label: endDate == null
                        ? 'Data final'
                        : _formatDate(endDate!),
                    onPressed: onPickEnd,
                  ),
                ),
                if (hasFilters) ...[
                  const SizedBox(width: 8),
                  SizedBox(
                    height: 56,
                    width: 48,
                    child: IconButton.outlined(
                      tooltip: 'Limpar filtros',
                      onPressed: onClear,
                      icon: const Icon(Icons.close),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

final class _FuelingDateFilterButton extends StatelessWidget {
  const _FuelingDateFilterButton({
    required this.icon,
    required this.label,
    required this.onPressed,
  });

  final IconData icon;
  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 56,
      child: OutlinedButton.icon(
        onPressed: onPressed,
        icon: Icon(icon),
        label: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
        style: OutlinedButton.styleFrom(
          alignment: Alignment.centerLeft,
          padding: const EdgeInsets.symmetric(horizontal: 12),
        ),
      ),
    );
  }
}

final class _FuelingEmptyHistory extends StatelessWidget {
  const _FuelingEmptyHistory();

  @override
  Widget build(BuildContext context) {
    return const Card(
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Text('Nenhum abastecimento registrado ainda.'),
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
          'KM ${record.kmRegistered} - ${record.liters.toStringAsFixed(1)} L - R\$ ${record.totalValue.toStringAsFixed(2)}\n${_formatDateTime(record.fueledAt)} - ${_historyStatus(record)}',
        ),
        isThreeLine: true,
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

String _historyStatus(FuelingRecord record) {
  final hasPendingPhotos =
      record.pendingReceiptPhotoLocalPaths.isNotEmpty ||
      record.pendingOdometerPhotoLocalPaths.isNotEmpty;
  if (hasPendingPhotos) {
    return 'Fotos pendentes de sincronizacao';
  }
  return switch (record.notificationStatus) {
    FuelingNotificationStatus.pendingWhatsapp =>
      'Pendente para envio ao responsavel',
    FuelingNotificationStatus.sentWhatsapp => 'Enviado ao responsavel',
    FuelingNotificationStatus.failedWhatsapp => 'Falha no envio ao responsavel',
  };
}

DateTime _dateOnly(DateTime dateTime) {
  return DateTime(dateTime.year, dateTime.month, dateTime.day);
}

String _formatDate(DateTime value) {
  final local = value.toLocal();
  final day = local.day.toString().padLeft(2, '0');
  final month = local.month.toString().padLeft(2, '0');
  final year = local.year.toString();
  return '$day/$month/$year';
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

String _formatTime(DateTime value) {
  final local = value.toLocal();
  final hour = local.hour.toString().padLeft(2, '0');
  final minute = local.minute.toString().padLeft(2, '0');
  return '$hour:$minute';
}

String? _positiveNumberValidator(String? value, String message) {
  final parsed = num.tryParse((value ?? '').replaceAll(',', '.'));
  return parsed == null || parsed <= 0 ? message : null;
}

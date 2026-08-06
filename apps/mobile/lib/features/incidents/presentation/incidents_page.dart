import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:lucide_flutter/lucide_flutter.dart';

import '../../../core/errors/firebase_failure.dart';
import '../../../core/providers/firebase_providers.dart';
import '../../media/application/media_providers.dart';
import '../../media/data/models/driver_media_type.dart';
import '../../trips/application/trip_providers.dart';
import '../../trips/data/models/trip_model.dart';
import '../application/incident_providers.dart';
import '../data/models/incident_model.dart';

final class IncidentsPage extends ConsumerStatefulWidget {
  const IncidentsPage({super.key});

  @override
  ConsumerState<IncidentsPage> createState() => _IncidentsPageState();
}

final class _IncidentsPageState extends ConsumerState<IncidentsPage> {
  final _formKey = GlobalKey<FormState>();
  final _descriptionController = TextEditingController();
  final _imagePicker = ImagePicker();
  IncidentType? _selectedType;
  String? _selectedTripId;
  File? _photo;
  var _isSaving = false;
  String? _errorMessage;

  @override
  void dispose() {
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _pickPhoto(ImageSource source) async {
    try {
      final picked = await _imagePicker.pickImage(
        source: source,
        imageQuality: 82,
        maxWidth: 1600,
        maxHeight: 1600,
      );
      if (picked != null && mounted) {
        setState(() {
          _photo = File(picked.path);
          _errorMessage = null;
        });
      }
    } on PlatformException catch (error) {
      setState(() {
        _errorMessage =
            'Nao foi possivel acessar ${source == ImageSource.camera ? 'a camera' : 'a galeria'}: ${error.message ?? error.code}.';
      });
    }
  }

  Future<void> _submit(List<Trip> trips) async {
    setState(() => _errorMessage = null);
    if (_formKey.currentState?.validate() != true) {
      return;
    }
    final type = _selectedType;
    if (type == null) {
      setState(() => _errorMessage = 'Selecione o tipo da ocorrencia.');
      return;
    }
    if (trips.isNotEmpty && _selectedTripId == null) {
      setState(() => _errorMessage = 'Selecione a viagem relacionada.');
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
      final now = DateTime.now();
      final incidentId = 'incident_${uid}_${now.microsecondsSinceEpoch}';
      String? photoUrl;
      String? pendingPath;
      final photo = _photo;
      if (photo != null) {
        photoUrl = await ref
            .read(mediaUploadServiceProvider)
            .uploadOrQueueDriverImage(
              localFile: photo,
              mediaType: DriverMediaType.incident,
              ownerEntityId: incidentId,
            );
        if (photoUrl == null) {
          pendingPath = photo.path;
        }
      }

      final incident = Incident(
        id: incidentId,
        tripId: _selectedTripId ?? '',
        driverId: uid,
        type: type,
        description: _descriptionController.text.trim(),
        status: IncidentStatus.reported,
        createdAt: now,
        photoUrl: photoUrl,
        pendingPhotoLocalPath: pendingPath,
      );
      await ref
          .read(incidentRepositoryProvider)
          .reportForCurrentDriver(incident);
      if (!mounted) {
        return;
      }
      _formKey.currentState?.reset();
      _descriptionController.clear();
      setState(() {
        _selectedType = null;
        _selectedTripId = null;
        _photo = null;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            pendingPath == null
                ? 'Ocorrencia registrada.'
                : 'Ocorrencia salva. A foto sera enviada quando houver conexao.',
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
    final tripState = ref.watch(currentDriverTripsProvider);
    final trips =
        (tripState.asData?.value ?? const <Trip>[])
            .where(
              (trip) =>
                  trip.status == TripStatus.pending ||
                  trip.status == TripStatus.inProgress,
            )
            .toList()
          ..sort((a, b) => a.scheduledAt.compareTo(b.scheduledAt));

    return DefaultTabController(
      length: 2,
      child: Column(
        children: [
          const TabBar(
            tabs: [
              Tab(text: 'Registrar'),
              Tab(text: 'Historico'),
            ],
          ),
          Expanded(
            child: TabBarView(
              children: [
                Form(
                  key: _formKey,
                  child: ListView(
                    keyboardDismissBehavior:
                        ScrollViewKeyboardDismissBehavior.onDrag,
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
                    children: [
                      Text(
                        'O que aconteceu?',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 12),
                      _IncidentTypeGrid(
                        selected: _selectedType,
                        onSelected: _isSaving
                            ? null
                            : (value) => setState(() {
                                _selectedType = value;
                                _errorMessage = null;
                              }),
                      ),
                      const SizedBox(height: 16),
                      DropdownButtonFormField<String>(
                        initialValue: _selectedTripId,
                        isExpanded: true,
                        decoration: const InputDecoration(
                          labelText: 'Viagem relacionada',
                          prefixIcon: Icon(LucideIcons.route),
                        ),
                        items: [
                          for (final trip in trips)
                            DropdownMenuItem(
                              value: trip.id,
                              child: Text(
                                '${trip.origin} -> ${trip.destination}',
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                        ],
                        onChanged: _isSaving
                            ? null
                            : (value) =>
                                  setState(() => _selectedTripId = value),
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _descriptionController,
                        minLines: 4,
                        maxLines: 7,
                        textCapitalization: TextCapitalization.sentences,
                        decoration: const InputDecoration(
                          labelText: 'Descreva a ocorrencia',
                          alignLabelWithHint: true,
                        ),
                        validator: (value) {
                          if ((value ?? '').trim().length < 10) {
                            return 'Descreva o problema com ao menos 10 caracteres.';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 16),
                      _IncidentPhoto(
                        photo: _photo,
                        onCamera: () => _pickPhoto(ImageSource.camera),
                        onGallery: () => _pickPhoto(ImageSource.gallery),
                        onRemove: () => setState(() => _photo = null),
                      ),
                      if (_errorMessage != null) ...[
                        const SizedBox(height: 12),
                        _ErrorBox(message: _errorMessage!),
                      ],
                      const SizedBox(height: 20),
                      FilledButton.icon(
                        onPressed: _isSaving ? null : () => _submit(trips),
                        icon: _isSaving
                            ? const SizedBox.square(
                                dimension: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(LucideIcons.send),
                        label: Text(
                          _isSaving ? 'Enviando...' : 'Enviar ocorrencia',
                        ),
                      ),
                    ],
                  ),
                ),
                const _IncidentHistory(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

final class _IncidentTypeOption {
  const _IncidentTypeOption(this.type, this.label, this.icon);

  final IncidentType type;
  final String label;
  final IconData icon;
}

const _incidentTypes = [
  _IncidentTypeOption(IncidentType.delay, 'Atraso', LucideIcons.clockAlert),
  _IncidentTypeOption(IncidentType.damage, 'Avaria', LucideIcons.packageX),
  _IncidentTypeOption(
    IncidentType.accident,
    'Acidente',
    LucideIcons.triangleAlert,
  ),
  _IncidentTypeOption(
    IncidentType.mechanical,
    'Problema no veiculo',
    LucideIcons.wrench,
  ),
  _IncidentTypeOption(
    IncidentType.cargo,
    'Problema na carga',
    LucideIcons.packageOpen,
  ),
  _IncidentTypeOption(
    IncidentType.delivery,
    'Problema na entrega',
    LucideIcons.mapPinX,
  ),
  _IncidentTypeOption(
    IncidentType.documentation,
    'Documentacao',
    LucideIcons.fileWarning,
  ),
  _IncidentTypeOption(IncidentType.other, 'Outro', LucideIcons.circleEllipsis),
];

final class _IncidentTypeGrid extends StatelessWidget {
  const _IncidentTypeGrid({required this.selected, required this.onSelected});

  final IncidentType? selected;
  final ValueChanged<IncidentType>? onSelected;

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: _incidentTypes.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        mainAxisExtent: 94,
      ),
      itemBuilder: (context, index) {
        final option = _incidentTypes[index];
        final isSelected = selected == option.type;
        return Material(
          color: isSelected ? const Color(0xFFFFF2A8) : Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
            side: BorderSide(
              color: isSelected
                  ? const Color(0xFFF0C800)
                  : const Color(0xFFD9D9D9),
            ),
          ),
          child: InkWell(
            borderRadius: BorderRadius.circular(8),
            onTap: onSelected == null ? null : () => onSelected!(option.type),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(option.icon, size: 24),
                  const SizedBox(height: 8),
                  Text(
                    option.label,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

final class _IncidentPhoto extends StatelessWidget {
  const _IncidentPhoto({
    required this.photo,
    required this.onCamera,
    required this.onGallery,
    required this.onRemove,
  });

  final File? photo;
  final VoidCallback onCamera;
  final VoidCallback onGallery;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFD9D9D9)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Foto (opcional)',
            style: TextStyle(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 10),
          if (photo != null) ...[
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: AspectRatio(
                aspectRatio: 16 / 9,
                child: Image.file(photo!, fit: BoxFit.cover),
              ),
            ),
            const SizedBox(height: 8),
            TextButton.icon(
              onPressed: onRemove,
              icon: const Icon(LucideIcons.trash2),
              label: const Text('Remover foto'),
            ),
          ] else
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: onCamera,
                    icon: const Icon(LucideIcons.camera),
                    label: const Text('Tirar foto'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: onGallery,
                    icon: const Icon(LucideIcons.image),
                    label: const Text('Galeria'),
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }
}

final class _IncidentHistory extends ConsumerWidget {
  const _IncidentHistory();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final incidents = ref.watch(driverIncidentsProvider);
    return incidents.when(
      data: (items) => ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
        children: [
          if (items.isEmpty)
            const _EmptyHistory()
          else
            for (final incident in items) ...[
              _IncidentHistoryCard(incident: incident),
              const SizedBox(height: 10),
            ],
        ],
      ),
      error: (error, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text('Falha ao carregar ocorrencias: $error'),
        ),
      ),
      loading: () => const Center(child: CircularProgressIndicator()),
    );
  }
}

final class _IncidentHistoryCard extends StatelessWidget {
  const _IncidentHistoryCard({required this.incident});

  final Incident incident;

  @override
  Widget build(BuildContext context) {
    final option = _incidentTypes
        .where((item) => item.type == incident.type)
        .firstOrNull;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(option?.icon ?? LucideIcons.circleAlert),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          option?.label ?? incident.type.value,
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                      ),
                      Text(_statusLabel(incident.status)),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    incident.description,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _formatDateTime(incident.createdAt),
                    style: const TextStyle(
                      color: Color(0xFF666666),
                      fontSize: 12,
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

final class _EmptyHistory extends StatelessWidget {
  const _EmptyHistory();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 50),
      child: Column(
        children: [
          Icon(LucideIcons.circleCheck, size: 44),
          SizedBox(height: 14),
          Text(
            'Nenhuma ocorrencia registrada',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }
}

final class _ErrorBox extends StatelessWidget {
  const _ErrorBox({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF1F2),
        border: Border.all(color: const Color(0xFFFB7185)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          const Icon(LucideIcons.circleAlert, color: Color(0xFFBE123C)),
          const SizedBox(width: 10),
          Expanded(child: Text(message)),
        ],
      ),
    );
  }
}

String _statusLabel(IncidentStatus status) {
  return switch (status) {
    IncidentStatus.reported => 'Registrada',
    IncidentStatus.underReview => 'Em analise',
    IncidentStatus.resolved => 'Resolvida',
  };
}

String _formatDateTime(DateTime value) {
  final local = value.toLocal();
  final day = local.day.toString().padLeft(2, '0');
  final month = local.month.toString().padLeft(2, '0');
  final hour = local.hour.toString().padLeft(2, '0');
  final minute = local.minute.toString().padLeft(2, '0');
  return '$day/$month/${local.year} $hour:$minute';
}

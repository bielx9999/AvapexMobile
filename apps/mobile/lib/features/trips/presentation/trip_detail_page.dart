import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:lucide_flutter/lucide_flutter.dart';

import '../../../core/errors/firebase_failure.dart';
import '../../../core/providers/firebase_providers.dart';
import '../../media/application/media_providers.dart';
import '../../media/data/models/driver_media_type.dart';
import '../application/trip_providers.dart';
import '../data/models/trip_model.dart';
import '../data/services/trip_document_service.dart';
import '../data/services/trip_route_service.dart';

final class TripDetailPage extends ConsumerStatefulWidget {
  const TripDetailPage({required this.trip, super.key});

  final Trip trip;

  @override
  ConsumerState<TripDetailPage> createState() => _TripDetailPageState();
}

final class _TripDetailPageState extends ConsumerState<TripDetailPage> {
  var _isResponding = false;
  var _isUpdatingProgress = false;
  var _isCompleting = false;
  final _imagePicker = ImagePicker();
  final _proofPhotos = <File>[];

  Trip _currentTrip() {
    final items = ref.watch(currentDriverTripsProvider).asData?.value;
    return items?.where((trip) => trip.id == widget.trip.id).firstOrNull ??
        widget.trip;
  }

  Future<void> _accept(Trip trip) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Aceitar esta viagem?'),
        content: Text(
          '${trip.displayTitle}\n${_formatDateTime(trip.scheduledAt)}',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Aceitar viagem'),
          ),
        ],
      ),
    );
    if (confirmed != true) {
      return;
    }
    await _respond(trip, DriverTripResponse.accepted);
  }

  Future<void> _reject(Trip trip) async {
    final rejection = await showModalBottomSheet<TripRejection>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => const _RejectTripSheet(),
    );
    if (rejection == null) {
      return;
    }
    await _respond(trip, DriverTripResponse.rejected, rejection: rejection);
  }

  Future<void> _respond(
    Trip trip,
    DriverTripResponse response, {
    TripRejection? rejection,
  }) async {
    setState(() => _isResponding = true);
    try {
      await ref
          .read(tripRepositoryProvider)
          .respondToAssignment(
            trip: trip,
            response: response,
            rejection: rejection,
          );
      ref.invalidate(currentDriverTripsProvider);
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            response == DriverTripResponse.accepted
                ? 'Viagem aceita.'
                : 'Viagem recusada. A logistica foi informada.',
          ),
        ),
      );
    } on FirebaseFailure catch (failure) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(failure.message)));
      }
    } finally {
      if (mounted) {
        setState(() => _isResponding = false);
      }
    }
  }

  Future<void> _openMaps(Trip trip) async {
    try {
      final opened = await TripRouteService.openInGoogleMaps(trip);
      if (!opened && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Nao foi possivel abrir o mapa.')),
        );
      }
    } on Object {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Nao foi possivel abrir o mapa.')),
        );
      }
    }
  }

  Future<void> _pickProofPhoto(ImageSource source) async {
    try {
      final photo = await _imagePicker.pickImage(
        source: source,
        imageQuality: 82,
        maxWidth: 1920,
      );
      if (photo == null) {
        return;
      }
      setState(() => _proofPhotos.add(File(photo.path)));
    } on Object {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Nao foi possivel anexar a foto.')),
        );
      }
    }
  }

  void _removeProofPhoto(File photo) {
    setState(() => _proofPhotos.remove(photo));
  }

  Future<void> _advanceTrip(Trip trip) async {
    setState(() => _isUpdatingProgress = true);
    try {
      await ref
          .read(tripRepositoryProvider)
          .moveToNextProgressForCurrentDriver(trip);
      ref.invalidate(currentDriverTripsProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Andamento da viagem atualizado.')),
        );
      }
    } on FirebaseFailure catch (failure) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(failure.message)));
      }
    } finally {
      if (mounted) {
        setState(() => _isUpdatingProgress = false);
      }
    }
  }

  Future<void> _completeTrip(Trip trip) async {
    if (_proofPhotos.isEmpty && !trip.hasProof) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Anexe o comprovante para finalizar.')),
      );
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Finalizar viagem?'),
        content: Text(
          'A viagem ${trip.displayTitle} sera marcada como finalizada e o comprovante sera enviado para a logistica.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Finalizar'),
          ),
        ],
      ),
    );
    if (confirmed != true) {
      return;
    }

    setState(() => _isCompleting = true);
    try {
      final uploadedPhotoUrls = [...trip.proofPhotoUrls];
      final pendingPhotoPaths = [...trip.pendingProofPhotoLocalPaths];
      for (final photo in _proofPhotos) {
        final url = await ref
            .read(mediaUploadServiceProvider)
            .uploadOrQueueDriverImage(
              localFile: photo,
              mediaType: DriverMediaType.tripProof,
              ownerEntityId: trip.id,
            );
        if (url == null) {
          pendingPhotoPaths.add(photo.path);
        } else {
          uploadedPhotoUrls.add(url);
        }
      }

      await ref
          .read(tripRepositoryProvider)
          .completeForCurrentDriver(
            trip: trip,
            proofPhotoUrls: uploadedPhotoUrls,
            pendingProofPhotoLocalPaths: pendingPhotoPaths,
          );
      ref.invalidate(currentDriverTripsProvider);
      if (mounted) {
        setState(() => _proofPhotos.clear());
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Viagem finalizada com comprovante.')),
        );
      }
    } on FirebaseFailure catch (failure) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(failure.message)));
      }
    } finally {
      if (mounted) {
        setState(() => _isCompleting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final trip = _currentTrip();
    final canRespond = trip.canDriverRespondAt(DateTime.now());

    return Scaffold(
      appBar: AppBar(title: const Text('Viagem atribuida')),
      body: ListView(
        padding: EdgeInsets.fromLTRB(16, 12, 16, canRespond ? 160 : 28),
        children: [
          _StatusHeader(trip: trip),
          const SizedBox(height: 12),
          _RouteSection(trip: trip),
          const SizedBox(height: 12),
          _MapSection(trip: trip, onOpenMaps: () => _openMaps(trip)),
          const SizedBox(height: 12),
          _OperationSection(trip: trip),
          const SizedBox(height: 12),
          if (Platform.isAndroid && trip.status == TripStatus.inProgress) ...[
            const _BackgroundLocationNotice(),
            const SizedBox(height: 12),
          ],
          _TripMessagesSection(trip: trip),
          const SizedBox(height: 12),
          _DocumentsSection(documents: trip.cteDocuments),
          const SizedBox(height: 12),
          _ReadOnlyTimeline(trip: trip),
          const SizedBox(height: 12),
          _DriverProgressActions(
            trip: trip,
            selectedProofPhotos: _proofPhotos,
            isBusy: _isUpdatingProgress || _isCompleting,
            onAdvance: () => _advanceTrip(trip),
            onComplete: () => _completeTrip(trip),
            onPickFromCamera: () => _pickProofPhoto(ImageSource.camera),
            onPickFromGallery: () => _pickProofPhoto(ImageSource.gallery),
            onRemoveProofPhoto: _removeProofPhoto,
          ),
          const SizedBox(height: 12),
          _TripHistory(trip: trip),
        ],
      ),
      bottomNavigationBar: canRespond
          ? SafeArea(
              child: Container(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  border: Border(top: BorderSide(color: Color(0xFFE0E0E0))),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _isResponding ? null : () => _reject(trip),
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size.fromHeight(56),
                        ),
                        child: const Text('Recusar'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      flex: 2,
                      child: FilledButton.icon(
                        onPressed: _isResponding ? null : () => _accept(trip),
                        style: FilledButton.styleFrom(
                          minimumSize: const Size.fromHeight(56),
                        ),
                        icon: _isResponding
                            ? const SizedBox.square(
                                dimension: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(LucideIcons.circleCheck),
                        label: const Text('Aceitar viagem'),
                      ),
                    ),
                  ],
                ),
              ),
            )
          : null,
    );
  }
}

final class _StatusHeader extends StatelessWidget {
  const _StatusHeader({required this.trip});

  final Trip trip;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF1F1C1C),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'VIAGEM',
            style: TextStyle(
              color: Color(0xFFFACC15),
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            trip.displayTitle,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _DarkStatusChip(
                label: 'Etapa: ${trip.progress.label}',
                icon: LucideIcons.route,
              ),
              _DarkStatusChip(
                label: _responseLabel(trip.driverResponse),
                icon: _responseIcon(trip.driverResponse),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

final class _DarkStatusChip extends StatelessWidget {
  const _DarkStatusChip({required this.label, required this.icon});

  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: Colors.white),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

final class _RouteSection extends StatelessWidget {
  const _RouteSection({required this.trip});

  final Trip trip;

  @override
  Widget build(BuildContext context) {
    final points = _routeDisplayPoints(trip);
    final routeSnapshot = trip.routeSnapshot;

    return _SectionCard(
      title: 'Rota',
      icon: LucideIcons.mapPinned,
      child: Column(
        children: [
          if (routeSnapshot != null) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: const Color(0xFFF5F5F5),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: _RouteFact(
                      label: 'Distancia',
                      value: _formatRouteDistance(routeSnapshot.distanceMeters),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _RouteFact(
                      label: 'Tempo estimado',
                      value: _formatRouteDuration(
                        routeSnapshot.durationSeconds,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
          for (var index = 0; index < points.length; index++) ...[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 28,
                  height: 28,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: index == points.length - 1
                        ? const Color(0xFFFACC15)
                        : const Color(0xFF1F1C1C),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    index == points.length - 1
                        ? LucideIcons.flag
                        : LucideIcons.mapPin,
                    size: 15,
                    color: index == points.length - 1
                        ? Colors.black
                        : Colors.white,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        points[index].label,
                        style: const TextStyle(
                          color: Color(0xFF666666),
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        points[index].value,
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (index < points.length - 1)
              const Padding(
                padding: EdgeInsets.only(left: 13),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: SizedBox(
                    height: 22,
                    child: VerticalDivider(
                      width: 2,
                      thickness: 2,
                      color: Color(0xFFD0D0D0),
                    ),
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }
}

final class _RouteFact extends StatelessWidget {
  const _RouteFact({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: Color(0xFF666666),
            fontSize: 11,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 2),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w800)),
      ],
    );
  }
}

List<({String label, String value})> _routeDisplayPoints(Trip trip) {
  final snapshotPoints = trip.routeSnapshot?.points
      .where((point) => point.type != TripRoutePointType.via)
      .toList(growable: false);
  if (snapshotPoints != null && snapshotPoints.length >= 2) {
    var stopIndex = 0;
    return snapshotPoints
        .map((point) {
          final label = switch (point.type) {
            TripRoutePointType.origin => 'Origem',
            TripRoutePointType.destination => 'Destino',
            TripRoutePointType.stop =>
              point.reference.isNotEmpty
                  ? point.reference
                  : 'Parada ${++stopIndex}',
            TripRoutePointType.via => '',
          };
          if (point.type == TripRoutePointType.stop &&
              point.reference.isNotEmpty) {
            stopIndex++;
          }
          return (label: label, value: point.address);
        })
        .toList(growable: false);
  }
  return <({String label, String value})>[
    (label: 'Origem', value: trip.origin),
    for (var index = 0; index < trip.routeStops.length; index++)
      (
        label: trip.routeStops[index].name.isEmpty
            ? 'Parada ${index + 1}'
            : trip.routeStops[index].name,
        value: trip.routeStops[index].address,
      ),
    (label: 'Destino', value: trip.destination),
  ];
}

String _formatRouteDistance(int meters) {
  return '${(meters / 1000).toStringAsFixed(meters >= 100000 ? 0 : 1)} km';
}

String _formatRouteDuration(int seconds) {
  final hours = seconds ~/ 3600;
  final minutes = ((seconds % 3600) / 60).round();
  return hours > 0 ? '${hours}h ${minutes}min' : '${minutes}min';
}

final class _MapSection extends StatefulWidget {
  const _MapSection({required this.trip, required this.onOpenMaps});

  final Trip trip;
  final VoidCallback onOpenMaps;

  @override
  State<_MapSection> createState() => _MapSectionState();
}

final class _MapSectionState extends State<_MapSection> {
  late Future<Uri?> _mapUri = TripRouteService.routePreviewUri(widget.trip);

  @override
  void didUpdateWidget(covariant _MapSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.trip.id != widget.trip.id ||
        oldWidget.trip.origin != widget.trip.origin ||
        oldWidget.trip.destination != widget.trip.destination ||
        oldWidget.trip.routeVersionId != widget.trip.routeVersionId ||
        oldWidget.trip.routeStops.length != widget.trip.routeStops.length) {
      _mapUri = TripRouteService.routePreviewUri(widget.trip);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _SectionCard(
      title: 'Rota da viagem',
      icon: LucideIcons.map,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: AspectRatio(
              aspectRatio: 16 / 9,
              child: FutureBuilder<Uri?>(
                future: _mapUri,
                builder: (context, snapshot) {
                  if (snapshot.connectionState != ConnectionState.done) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  final mapUri = snapshot.data;
                  if (mapUri == null) {
                    return const _MapFallback();
                  }
                  return Image.network(
                    mapUri.toString(),
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => const _MapFallback(),
                  );
                },
              ),
            ),
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: widget.onOpenMaps,
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(52),
            ),
            icon: const Icon(LucideIcons.navigation),
            label: const Text('Abrir no Google Maps'),
          ),
        ],
      ),
    );
  }
}

final class _MapFallback extends StatelessWidget {
  const _MapFallback();

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFFF2F2F2),
      alignment: Alignment.center,
      padding: const EdgeInsets.all(20),
      child: const Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(LucideIcons.mapPinned, size: 38),
          SizedBox(height: 8),
          Text(
            'Pre-visualizacao indisponivel',
            style: TextStyle(fontWeight: FontWeight.w800),
          ),
          Text(
            'A rota completa continua disponivel no Google Maps.',
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

final class _OperationSection extends StatelessWidget {
  const _OperationSection({required this.trip});

  final Trip trip;

  @override
  Widget build(BuildContext context) {
    return _SectionCard(
      title: 'Informacoes da viagem',
      icon: LucideIcons.briefcaseBusiness,
      child: Column(
        children: [
          _InfoRow(label: 'Cliente', value: _orDash(trip.clientName)),
          _InfoRow(
            label: 'Carga e orientacoes da logistica',
            value: trip.cargoDescription.isEmpty
                ? 'Aguardando observacao da logistica.'
                : trip.cargoDescription,
          ),
          _InfoRow(
            label: 'Operacao',
            value: trip.operationType == TripOperationType.loading
                ? 'Carga'
                : 'Descarga',
          ),
          _InfoRow(
            label: 'Data prevista',
            value: _formatDateTime(trip.scheduledAt),
          ),
          _InfoRow(
            label: 'Veiculo',
            value: [
              trip.fleetNumber,
              trip.vehiclePlate,
              trip.vehicleModel,
            ].where((value) => value.isNotEmpty).join(' - '),
          ),
          _InfoRow(label: 'Motorista', value: _orDash(trip.driverName)),
          _InfoRow(
            label: 'Solicitacao',
            value: _orDash(trip.customerRequestNumber),
          ),
        ],
      ),
    );
  }
}

final class _BackgroundLocationNotice extends StatelessWidget {
  const _BackgroundLocationNotice();

  @override
  Widget build(BuildContext context) {
    return _SectionCard(
      title: 'Rastreamento da viagem',
      icon: LucideIcons.mapPin,
      child: FutureBuilder<LocationPermission>(
        future: Geolocator.checkPermission(),
        builder: (context, snapshot) {
          final alwaysAllowed = snapshot.data == LocationPermission.always;
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                alwaysAllowed
                    ? 'O GPS pode registrar pontos com a tela bloqueada. O Android mostra uma notificacao enquanto a viagem estiver em andamento.'
                    : 'Para registrar pontos com a tela bloqueada ou o app fechado, permita "Localizacao o tempo todo" nas configuracoes deste aplicativo.',
              ),
              if (!alwaysAllowed) ...[
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: () => Geolocator.openAppSettings(),
                  child: const Text('Abrir permissoes de localizacao'),
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}

final class _TripMessagesSection extends ConsumerStatefulWidget {
  const _TripMessagesSection({required this.trip});

  final Trip trip;

  @override
  ConsumerState<_TripMessagesSection> createState() =>
      _TripMessagesSectionState();
}

final class _TripMessagesSectionState
    extends ConsumerState<_TripMessagesSection> {
  final _messageController = TextEditingController();
  var _sending = false;

  @override
  void dispose() {
    _messageController.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final message = _messageController.text.trim();
    if (message.isEmpty || _sending) return;
    setState(() => _sending = true);
    var queued = false;
    try {
      await ref
          .read(tripMessageRepositoryProvider)
          .send(widget.trip.id, message)
          .timeout(
            const Duration(seconds: 4),
            onTimeout: () {
              queued = true;
            },
          );
      _messageController.clear();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              queued
                  ? 'Mensagem salva no dispositivo; sera enviada quando houver conexao.'
                  : 'Mensagem enviada para a logistica.',
            ),
          ),
        );
      }
    } on Object catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Nao foi possivel enviar a mensagem: $error')),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final messages = ref.watch(tripMessagesProvider(widget.trip.id));
    return _SectionCard(
      title: 'Mensagens com a logistica',
      icon: LucideIcons.messageSquare,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          messages.when(
            data: (items) => items.isEmpty
                ? const Text('Nenhuma mensagem nesta viagem.')
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      for (final item in items) ...[
                        Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: item.senderRole == 'admin'
                                ? const Color(0xFFFFF3C4)
                                : const Color(0xFFF1F1F1),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item.senderRole == 'admin'
                                    ? 'Logistica'
                                    : 'Voce',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              Text(item.text),
                              Text(
                                item.createdAt == null
                                    ? 'Sincronizando...'
                                    : _formatDateTime(item.createdAt!),
                                style: const TextStyle(
                                  color: Color(0xFF666666),
                                  fontSize: 11,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
            error: (_, _) => const Text('Mensagens indisponiveis no momento.'),
            loading: () => const Center(child: CircularProgressIndicator()),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _messageController,
            maxLength: 1000,
            maxLines: 3,
            minLines: 2,
            decoration: const InputDecoration(
              labelText: 'Mensagem para a logistica',
              hintText: 'Escreva uma atualizacao ou duvida',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 8),
          FilledButton.icon(
            onPressed: _sending ? null : _send,
            icon: const Icon(LucideIcons.send),
            label: const Text('Enviar mensagem'),
          ),
        ],
      ),
    );
  }
}

final class _DocumentsSection extends StatelessWidget {
  const _DocumentsSection({required this.documents});

  final List<TripDocument> documents;

  @override
  Widget build(BuildContext context) {
    return _SectionCard(
      title: documents.length > 1 ? 'Documentos da viagem' : 'CT-e',
      icon: LucideIcons.fileText,
      child: documents.isEmpty
          ? const Text('CT-e ainda nao informado pela logistica.')
          : Column(
              children: [
                for (var index = 0; index < documents.length; index++) ...[
                  _DocumentTile(document: documents[index]),
                  if (index < documents.length - 1) const Divider(height: 20),
                ],
              ],
            ),
    );
  }
}

final class _DocumentTile extends StatefulWidget {
  const _DocumentTile({required this.document});

  final TripDocument document;

  @override
  State<_DocumentTile> createState() => _DocumentTileState();
}

final class _DocumentTileState extends State<_DocumentTile> {
  var _opening = false;

  Future<void> _openDocument() async {
    if (_opening) {
      return;
    }
    setState(() => _opening = true);
    try {
      final opened = await TripDocumentService.openCtePdf(widget.document);
      if (!opened && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Nao foi possivel abrir o documento.')),
        );
      }
    } on Object {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Documento indisponivel ou acesso nao autorizado.'),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _opening = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final document = widget.document;
    final details = [
      if (document.series.isNotEmpty) 'Serie ${document.series}',
      if (document.branch.isNotEmpty) 'Filial ${document.branch}',
      if (document.sender.isNotEmpty) document.sender,
      if (document.issuedAt != null)
        'Emitido em ${_formatDate(document.issuedAt!)}',
    ];
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 42,
          height: 42,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: const Color(0xFFFFF2A8),
            borderRadius: BorderRadius.circular(8),
          ),
          child: const Icon(LucideIcons.fileCheck),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'CT-e ${document.number}',
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
              if (details.isNotEmpty)
                Text(
                  details.join(' - '),
                  style: const TextStyle(color: Color(0xFF666666)),
                ),
              if (document.storagePath.isNotEmpty) ...[
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: _opening ? null : _openDocument,
                  icon: _opening
                      ? const SizedBox.square(
                          dimension: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(LucideIcons.externalLink, size: 17),
                  label: const Text('Visualizar documento'),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

final class _ReadOnlyTimeline extends StatelessWidget {
  const _ReadOnlyTimeline({required this.trip});

  final Trip trip;

  @override
  Widget build(BuildContext context) {
    final stages = TripProgress.optionsFor(trip.operationType);
    final currentIndex = stages
        .indexOf(trip.progress)
        .clamp(0, stages.length - 1);
    return _SectionCard(
      title: 'Andamento operacional',
      icon: LucideIcons.listChecks,
      child: Column(
        children: [
          for (var index = 0; index < stages.length; index++)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                children: [
                  Icon(
                    index < currentIndex
                        ? LucideIcons.circleCheck
                        : index == currentIndex
                        ? LucideIcons.circleDot
                        : LucideIcons.circle,
                    size: 21,
                    color: index <= currentIndex
                        ? const Color(0xFF111111)
                        : const Color(0xFFAAAAAA),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      stages[index].label,
                      style: TextStyle(
                        fontWeight: index == currentIndex
                            ? FontWeight.w900
                            : FontWeight.w600,
                        color: index <= currentIndex
                            ? const Color(0xFF111111)
                            : const Color(0xFF888888),
                      ),
                    ),
                  ),
                  if (index == currentIndex)
                    const Text(
                      'Atual',
                      style: TextStyle(fontWeight: FontWeight.w800),
                    ),
                ],
              ),
            ),
          const Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'A etapa e atualizada exclusivamente pela logistica.',
              style: TextStyle(color: Color(0xFF666666), fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }
}

final class _TripHistory extends StatelessWidget {
  const _TripHistory({required this.trip});

  final Trip trip;

  @override
  Widget build(BuildContext context) {
    final entries = <({String label, DateTime? date})>[
      (label: 'Atribuida', date: trip.assignedAt),
      (
        label: trip.driverResponse == DriverTripResponse.rejected
            ? 'Recusada pelo motorista'
            : 'Aceita pelo motorista',
        date: trip.driverRespondedAt,
      ),
      (label: 'Inicio operacional', date: trip.startedAt),
      (label: 'Ultima mudanca de etapa', date: trip.statusUpdatedAt),
      (label: 'Finalizacao', date: trip.completedAt),
    ].where((entry) => entry.date != null).toList(growable: false);

    return _SectionCard(
      title: 'Historico',
      icon: LucideIcons.history,
      child: entries.isEmpty
          ? const Text('Nenhum evento registrado ate o momento.')
          : Column(
              children: [
                for (final entry in entries)
                  _InfoRow(
                    label: entry.label,
                    value: _formatDateTime(entry.date!),
                  ),
                if (trip.driverRejection != null) ...[
                  const Divider(height: 20),
                  _InfoRow(
                    label: 'Motivo da recusa',
                    value: trip.driverRejection!.reasonLabel,
                  ),
                  if (trip.driverRejection!.notes.isNotEmpty)
                    _InfoRow(
                      label: 'Observacao',
                      value: trip.driverRejection!.notes,
                    ),
                ],
              ],
            ),
    );
  }
}

final class _DriverProgressActions extends StatelessWidget {
  const _DriverProgressActions({
    required this.trip,
    required this.selectedProofPhotos,
    required this.isBusy,
    required this.onAdvance,
    required this.onComplete,
    required this.onPickFromCamera,
    required this.onPickFromGallery,
    required this.onRemoveProofPhoto,
  });

  final Trip trip;
  final List<File> selectedProofPhotos;
  final bool isBusy;
  final VoidCallback onAdvance;
  final VoidCallback onComplete;
  final VoidCallback onPickFromCamera;
  final VoidCallback onPickFromGallery;
  final ValueChanged<File> onRemoveProofPhoto;

  @override
  Widget build(BuildContext context) {
    final canOperate =
        trip.driverResponse == DriverTripResponse.accepted &&
        trip.status != TripStatus.completed &&
        trip.status != TripStatus.cancelled;
    if (!canOperate) {
      return _SectionCard(
        title: 'Acao do motorista',
        icon: LucideIcons.circleCheck,
        child: Text(
          trip.status == TripStatus.completed
              ? 'Viagem finalizada e informada para a logistica.'
              : trip.driverResponse == DriverTripResponse.pending
              ? 'Aceite a viagem para iniciar o acompanhamento.'
              : 'Nenhuma acao disponivel para esta viagem.',
        ),
      );
    }

    final nextProgress = _nextProgressLabel(trip);
    final canAdvance = nextProgress != null;
    final existingProofCount =
        trip.proofPhotoUrls.length + trip.pendingProofPhotoLocalPaths.length;

    return _SectionCard(
      title: 'Acao do motorista',
      icon: LucideIcons.clipboardCheck,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Status atual: ${trip.progress.label}',
            style: const TextStyle(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 12),
          if (canAdvance) ...[
            FilledButton.icon(
              onPressed: isBusy ? null : onAdvance,
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(52),
              ),
              icon: isBusy
                  ? const SizedBox.square(
                      dimension: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(LucideIcons.arrowRightCircle),
              label: Text('Atualizar para $nextProgress'),
            ),
            const SizedBox(height: 12),
          ],
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: isBusy ? null : onPickFromCamera,
                  icon: const Icon(LucideIcons.camera),
                  label: const Text('Foto'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: isBusy ? null : onPickFromGallery,
                  icon: const Icon(LucideIcons.image),
                  label: const Text('Galeria'),
                ),
              ),
            ],
          ),
          if (selectedProofPhotos.isNotEmpty || existingProofCount > 0) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (existingProofCount > 0)
                  _ProofChip(
                    label:
                        '$existingProofCount comprovante${existingProofCount == 1 ? '' : 's'} enviado${existingProofCount == 1 ? '' : 's'}',
                  ),
                for (final photo in selectedProofPhotos)
                  _ProofChip(
                    label: photo.path.split(Platform.pathSeparator).last,
                    onRemove: () => onRemoveProofPhoto(photo),
                  ),
              ],
            ),
          ],
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: isBusy ? null : onComplete,
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(54),
            ),
            icon: isBusy
                ? const SizedBox.square(
                    dimension: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(LucideIcons.uploadCloud),
            label: const Text('Finalizar com comprovante'),
          ),
        ],
      ),
    );
  }
}

final class _ProofChip extends StatelessWidget {
  const _ProofChip({required this.label, this.onRemove});

  final String label;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFF5F5F5),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFD9D9D9)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(LucideIcons.fileImage, size: 16),
          const SizedBox(width: 6),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 170),
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
          ),
          if (onRemove != null) ...[
            const SizedBox(width: 4),
            IconButton(
              visualDensity: VisualDensity.compact,
              iconSize: 16,
              onPressed: onRemove,
              icon: const Icon(LucideIcons.x),
              tooltip: 'Remover',
            ),
          ],
        ],
      ),
    );
  }
}

String? _nextProgressLabel(Trip trip) {
  final stages = TripProgress.optionsFor(trip.operationType);
  final currentIndex = stages.indexOf(trip.progress);
  if (currentIndex < 0 || currentIndex >= stages.length - 1) {
    return null;
  }
  final next = stages[currentIndex + 1];
  return next.isFinished ? null : next.label;
}

final class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.title,
    required this.icon,
    required this.child,
  });

  final String title;
  final IconData icon;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFD9D9D9)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          child,
        ],
      ),
    );
  }
}

final class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 112,
            child: Text(
              label,
              style: const TextStyle(
                color: Color(0xFF666666),
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value.isEmpty ? '-' : value,
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }
}

final class _RejectTripSheet extends StatefulWidget {
  const _RejectTripSheet();

  @override
  State<_RejectTripSheet> createState() => _RejectTripSheetState();
}

final class _RejectTripSheetState extends State<_RejectTripSheet> {
  static const _reasons = <({String code, String label})>[
    (code: 'unavailable', label: 'Indisponibilidade'),
    (code: 'personal', label: 'Problema pessoal'),
    (code: 'vehicle', label: 'Problema com veiculo'),
    (code: 'schedule_conflict', label: 'Conflito de horario'),
    (code: 'other', label: 'Outro'),
  ];

  final _formKey = GlobalKey<FormState>();
  final _notesController = TextEditingController();
  String? _reasonCode;

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  void _submit() {
    if (_formKey.currentState?.validate() != true) {
      return;
    }
    final reason = _reasons.firstWhere((item) => item.code == _reasonCode);
    Navigator.of(context).pop(
      TripRejection(
        reasonCode: reason.code,
        reasonLabel: reason.label,
        notes: _notesController.text.trim(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        14,
        20,
        MediaQuery.viewInsetsOf(context).bottom + 20,
      ),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 42,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFFBBBBBB),
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              Text(
                'Por que voce esta recusando esta viagem?',
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 14),
              DropdownButtonFormField<String>(
                initialValue: _reasonCode,
                decoration: const InputDecoration(labelText: 'Motivo'),
                items: [
                  for (final reason in _reasons)
                    DropdownMenuItem(
                      value: reason.code,
                      child: Text(reason.label),
                    ),
                ],
                onChanged: (value) => setState(() => _reasonCode = value),
                validator: (value) =>
                    value == null ? 'Selecione o motivo.' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _notesController,
                minLines: 3,
                maxLines: 5,
                decoration: const InputDecoration(
                  labelText: 'Observacao',
                  alignLabelWithHint: true,
                ),
                validator: (value) {
                  if (_reasonCode == 'other' && (value ?? '').trim().isEmpty) {
                    return 'Descreva o motivo da recusa.';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 18),
              FilledButton(
                onPressed: _submit,
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(54),
                ),
                child: const Text('Confirmar recusa'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

String _responseLabel(DriverTripResponse response) {
  return switch (response) {
    DriverTripResponse.pending => 'Aguardando sua confirmacao',
    DriverTripResponse.accepted => 'Viagem aceita',
    DriverTripResponse.rejected => 'Viagem recusada',
  };
}

IconData _responseIcon(DriverTripResponse response) {
  return switch (response) {
    DriverTripResponse.pending => LucideIcons.clock3,
    DriverTripResponse.accepted => LucideIcons.circleCheck,
    DriverTripResponse.rejected => LucideIcons.circleX,
  };
}

String _formatDateTime(DateTime value) {
  final date = value.toLocal();
  final day = date.day.toString().padLeft(2, '0');
  final month = date.month.toString().padLeft(2, '0');
  final hour = date.hour.toString().padLeft(2, '0');
  final minute = date.minute.toString().padLeft(2, '0');
  return '$day/$month/${date.year} as $hour:$minute';
}

String _formatDate(DateTime value) {
  final date = value.toLocal();
  final day = date.day.toString().padLeft(2, '0');
  final month = date.month.toString().padLeft(2, '0');
  return '$day/$month/${date.year}';
}

String _orDash(String value) => value.trim().isEmpty ? '-' : value.trim();

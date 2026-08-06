import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_flutter/lucide_flutter.dart';

import '../../../core/errors/firebase_failure.dart';
import '../../../core/providers/firebase_providers.dart';
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
          '${trip.origin} -> ${trip.destination}\n${_formatDateTime(trip.scheduledAt)}',
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
          _DocumentsSection(documents: trip.cteDocuments),
          const SizedBox(height: 12),
          _ReadOnlyTimeline(trip: trip),
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
            '${trip.origin} -> ${trip.destination}',
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
    final points = <({String label, String value})>[
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

    return _SectionCard(
      title: 'Rota',
      icon: LucideIcons.mapPinned,
      child: Column(
        children: [
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

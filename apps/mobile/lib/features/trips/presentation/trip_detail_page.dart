import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/firebase_failure.dart';
import '../../../core/providers/firebase_providers.dart';
import '../../checklists/application/checklist_providers.dart';
import '../../checklists/data/models/checklist_model.dart';
import '../data/models/trip_model.dart';

final class TripDetailPage extends ConsumerWidget {
  const TripDetailPage({required this.trip, super.key});

  final Trip trip;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final checklists = ref.watch(tripChecklistsProvider(trip.id));

    return Scaffold(
      appBar: AppBar(title: const Text('Detalhes da viagem')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        children: [
          _TripSummary(trip: trip),
          const SizedBox(height: 12),
          _TripActions(trip: trip),
          const SizedBox(height: 18),
          Text(
            'Checklists',
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 10),
          checklists.when(
            data: (items) {
              if (items.isEmpty) {
                return const _EmptyChecklists();
              }
              return Column(
                children: items
                    .map(
                      (checklist) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: _ChecklistCard(checklist: checklist),
                      ),
                    )
                    .toList(growable: false),
              );
            },
            error: (error, _) => Text('Falha ao carregar checklists: $error'),
            loading: () => const Center(child: CircularProgressIndicator()),
          ),
        ],
      ),
    );
  }
}

final class _TripSummary extends StatelessWidget {
  const _TripSummary({required this.trip});

  final Trip trip;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${trip.origin} -> ${trip.destination}',
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 14),
            _InfoRow(
              icon: Icons.local_shipping_outlined,
              label: 'Veiculo',
              value: trip.vehiclePlate.isNotEmpty
                  ? trip.vehiclePlate
                  : trip.vehicleId,
            ),
            _InfoRow(
              icon: Icons.event_outlined,
              label: 'Agendada',
              value: _formatDateTime(trip.scheduledAt),
            ),
            _InfoRow(
              icon: Icons.flag_outlined,
              label: 'Etapa atual',
              value: trip.progress.label,
            ),
          ],
        ),
      ),
    );
  }
}

final class _TripActions extends ConsumerStatefulWidget {
  const _TripActions({required this.trip});

  final Trip trip;

  @override
  ConsumerState<_TripActions> createState() => _TripActionsState();
}

final class _TripActionsState extends ConsumerState<_TripActions> {
  var _isUpdating = false;
  late TripProgress _selectedProgress;

  @override
  void initState() {
    super.initState();
    _selectedProgress = widget.trip.progress;
  }

  Future<void> _updateProgress() async {
    if (_selectedProgress == widget.trip.progress) {
      return;
    }
    setState(() => _isUpdating = true);
    try {
      await ref
          .read(tripRepositoryProvider)
          .updateProgressForCurrentDriver(widget.trip, _selectedProgress);
      if (!mounted) {
        return;
      }
      final messenger = ScaffoldMessenger.of(context);
      Navigator.of(context).pop();
      messenger.showSnackBar(
        SnackBar(
          content: Text('Etapa registrada: ${_selectedProgress.label}.'),
        ),
      );
    } on FirebaseFailure catch (failure) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(failure.message)));
    } finally {
      if (mounted) {
        setState(() => _isUpdating = false);
      }
    }
  }

  Future<void> _openChecklist(ChecklistType type) async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => ChecklistFormPage(trip: widget.trip, type: type),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final trip = widget.trip;
    final progressOptions = TripProgress.optionsFor(trip.operationType);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Atualizar etapa da entrega',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<TripProgress>(
                  initialValue: _selectedProgress,
                  decoration: const InputDecoration(
                    labelText: 'Etapa atual',
                    prefixIcon: Icon(Icons.route_outlined),
                  ),
                  items: [
                    for (final progress in progressOptions)
                      DropdownMenuItem(
                        value: progress,
                        child: Text(progress.label),
                      ),
                  ],
                  onChanged: _isUpdating || trip.progress.isFinished
                      ? null
                      : (value) {
                          if (value != null) {
                            setState(() => _selectedProgress = value);
                          }
                        },
                ),
                const SizedBox(height: 12),
                FilledButton.icon(
                  onPressed:
                      _isUpdating ||
                          trip.progress.isFinished ||
                          _selectedProgress == trip.progress
                      ? null
                      : _updateProgress,
                  icon: _isUpdating
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.sync_outlined),
                  label: Text(
                    _isUpdating ? 'Registrando...' : 'Registrar etapa',
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 10),
        OutlinedButton.icon(
          onPressed: () => _openChecklist(ChecklistType.departure),
          icon: const Icon(Icons.fact_check_outlined),
          label: const Text('Checklist de saida'),
        ),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: () => _openChecklist(ChecklistType.arrival),
          icon: const Icon(Icons.assignment_turned_in_outlined),
          label: const Text('Checklist de chegada'),
        ),
      ],
    );
  }
}

final class ChecklistFormPage extends ConsumerStatefulWidget {
  const ChecklistFormPage({required this.trip, required this.type, super.key});

  final Trip trip;
  final ChecklistType type;

  @override
  ConsumerState<ChecklistFormPage> createState() => _ChecklistFormPageState();
}

final class _ChecklistFormPageState extends ConsumerState<ChecklistFormPage> {
  final _formKey = GlobalKey<FormState>();
  final _kmController = TextEditingController();
  final _notesController = TextEditingController();
  var _tires = true;
  var _brakes = true;
  var _lights = true;
  var _oil = true;
  var _isSaving = false;

  @override
  void dispose() {
    _kmController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final form = _formKey.currentState;
    if (form == null || !form.validate()) {
      return;
    }

    setState(() => _isSaving = true);
    final now = DateTime.now();
    final checklist = Checklist(
      id: '${widget.trip.id}-${widget.type.value}-${now.microsecondsSinceEpoch}',
      tripId: widget.trip.id,
      driverId: widget.trip.driverId,
      vehicleId: widget.trip.vehicleId,
      type: widget.type,
      kmRegistered: num.parse(_kmController.text.replaceAll(',', '.')),
      items: ChecklistItems(
        tires: _tires,
        brakes: _brakes,
        lights: _lights,
        oil: _oil,
        notes: _notesController.text.trim(),
      ),
      photoUrls: const [],
      signatureUrl: '',
      createdAt: now,
    );

    try {
      await ref
          .read(checklistRepositoryProvider)
          .saveForCurrentDriver(checklist);
      if (!mounted) {
        return;
      }
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${_checklistTitle(widget.type)} salvo.')),
      );
    } on FirebaseFailure catch (failure) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(failure.message)));
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_checklistTitle(widget.type))),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            TextFormField(
              controller: _kmController,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: const InputDecoration(
                labelText: 'KM registrado',
                prefixIcon: Icon(Icons.speed_outlined),
              ),
              validator: (value) {
                final normalized = (value ?? '').replaceAll(',', '.');
                final km = num.tryParse(normalized);
                if (km == null || km < 0) {
                  return 'Informe um KM valido.';
                }
                return null;
              },
            ),
            const SizedBox(height: 12),
            _ChecklistSwitch(
              title: 'Pneus em condicao',
              value: _tires,
              onChanged: (value) => setState(() => _tires = value),
            ),
            _ChecklistSwitch(
              title: 'Freios em condicao',
              value: _brakes,
              onChanged: (value) => setState(() => _brakes = value),
            ),
            _ChecklistSwitch(
              title: 'Luzes em condicao',
              value: _lights,
              onChanged: (value) => setState(() => _lights = value),
            ),
            _ChecklistSwitch(
              title: 'Oleo verificado',
              value: _oil,
              onChanged: (value) => setState(() => _oil = value),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _notesController,
              minLines: 3,
              maxLines: 5,
              decoration: const InputDecoration(
                labelText: 'Observacoes',
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: 18),
            FilledButton.icon(
              onPressed: _isSaving ? null : _save,
              icon: _isSaving
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.save_outlined),
              label: Text(_isSaving ? 'Salvando...' : 'Salvar checklist'),
            ),
          ],
        ),
      ),
    );
  }
}

final class _ChecklistSwitch extends StatelessWidget {
  const _ChecklistSwitch({
    required this.title,
    required this.value,
    required this.onChanged,
  });

  final String title;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: SwitchListTile(
        value: value,
        onChanged: onChanged,
        title: Text(title),
        secondary: Icon(value ? Icons.check_circle_outline : Icons.warning),
      ),
    );
  }
}

final class _ChecklistCard extends StatelessWidget {
  const _ChecklistCard({required this.checklist});

  final Checklist checklist;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: const Icon(Icons.fact_check_outlined),
        title: Text(_checklistTitle(checklist.type)),
        subtitle: Text(
          'KM ${checklist.kmRegistered} - ${_formatDateTime(checklist.createdAt)}',
        ),
      ),
    );
  }
}

final class _EmptyChecklists extends StatelessWidget {
  const _EmptyChecklists();

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Icon(
              Icons.assignment_outlined,
              color: Theme.of(context).colorScheme.primary,
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Text('Nenhum checklist registrado para esta viagem.'),
            ),
          ],
        ),
      ),
    );
  }
}

final class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Icon(icon, size: 18),
          const SizedBox(width: 8),
          Text('$label: ', style: const TextStyle(fontWeight: FontWeight.w700)),
          Expanded(child: Text(value, overflow: TextOverflow.ellipsis)),
        ],
      ),
    );
  }
}

String _checklistTitle(ChecklistType type) {
  return switch (type) {
    ChecklistType.departure => 'Checklist de saida',
    ChecklistType.arrival => 'Checklist de chegada',
    ChecklistType.vehicleDaily => 'Checklist de veiculo',
    ChecklistType.chainTensioner => 'Checklist de corrente/tensionador',
    ChecklistType.strapRatchet => 'Checklist de cinta/catraca',
  };
}

String _formatDateTime(DateTime value) {
  final date = value.toLocal();
  final day = date.day.toString().padLeft(2, '0');
  final month = date.month.toString().padLeft(2, '0');
  final hour = date.hour.toString().padLeft(2, '0');
  final minute = date.minute.toString().padLeft(2, '0');
  return '$day/$month/${date.year} $hour:$minute';
}

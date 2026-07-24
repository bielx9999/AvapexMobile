import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/firebase_failure.dart';
import '../../../core/providers/firebase_providers.dart';
import '../../users/application/user_providers.dart';
import '../data/models/checklist_model.dart';
import '../data/services/device_location_service.dart';

enum ChecklistAnswer {
  yes('SIM'),
  no('NAO'),
  notApplicable('N/A');

  const ChecklistAnswer(this.label);

  final String label;
}

final class VehicleChecklistPage extends ConsumerStatefulWidget {
  const VehicleChecklistPage({super.key});

  @override
  ConsumerState<VehicleChecklistPage> createState() =>
      _VehicleChecklistPageState();
}

final class _VehicleChecklistPageState
    extends ConsumerState<VehicleChecklistPage> {
  final _formKey = GlobalKey<FormState>();
  final _plateController = TextEditingController();
  final _kmController = TextEditingController();
  final _notesController = TextEditingController();
  final _openedAt = DateTime.now();
  final Map<String, ChecklistAnswer?> _answers = {
    for (final item in _vehicleChecklistItems) item.id: null,
  };

  DeviceLocation? _location;
  var _isLoadingLocation = true;
  var _isSaving = false;
  String? _locationMessage;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadLocation();
  }

  @override
  void dispose() {
    _plateController.dispose();
    _kmController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _loadLocation() async {
    try {
      final location = await ref
          .read(deviceLocationServiceProvider)
          .getCurrentLocation();
      if (!mounted) {
        return;
      }
      setState(() {
        _location = location;
        _locationMessage = location == null
            ? 'Localizacao indisponivel'
            : location.display;
      });
    } on Object {
      if (!mounted) {
        return;
      }
      setState(() => _locationMessage = 'Falha ao obter localizacao');
    } finally {
      if (mounted) {
        setState(() => _isLoadingLocation = false);
      }
    }
  }

  Future<void> _submit() async {
    final form = _formKey.currentState;
    final missingItems = _answers.entries
        .where((entry) => entry.value == null)
        .map((entry) => _itemById(entry.key).label)
        .toList(growable: false);

    setState(() => _errorMessage = null);

    if (form == null || !form.validate()) {
      return;
    }

    if (missingItems.isNotEmpty) {
      setState(
        () => _errorMessage =
            'Responda todos os itens antes de enviar o checklist.',
      );
      return;
    }

    final failedCriticalItems = _vehicleChecklistItems
        .where(
          (item) => item.critical && _answers[item.id] == ChecklistAnswer.no,
        )
        .toList(growable: false);
    final hasFailures = _answers.values.contains(ChecklistAnswer.no);

    if (hasFailures && _notesController.text.trim().isEmpty) {
      setState(
        () => _errorMessage =
            'As observacoes sao obrigatorias quando algum item esta como NAO.',
      );
      return;
    }

    if (failedCriticalItems.isNotEmpty) {
      final shouldContinue = await _showCriticalAlert(failedCriticalItems);
      if (!shouldContinue) {
        return;
      }
    }

    await _saveChecklist(
      hasFailures: hasFailures,
      hasCriticalFailure: failedCriticalItems.isNotEmpty,
    );
  }

  Future<bool> _showCriticalAlert(List<_VehicleChecklistItem> items) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Veiculo reprovado'),
        content: Text(
          'Itens criticos marcados como NAO impedem a liberacao da viagem ate '
          'avaliacao do setor responsavel.\n\n${items.map((item) => item.label).join('\n')}',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Revisar'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Enviar reprovado'),
          ),
        ],
      ),
    );
    return result ?? false;
  }

  Future<void> _saveChecklist({
    required bool hasFailures,
    required bool hasCriticalFailure,
  }) async {
    final authUser = ref.read(firebaseAuthProvider).currentUser;
    final uid = authUser?.uid;
    if (uid == null || uid.isEmpty) {
      setState(() => _errorMessage = 'Motorista nao autenticado.');
      return;
    }

    setState(() => _isSaving = true);

    try {
      final profile = ref.read(currentUserProfileProvider).asData?.value;
      final plate = _normalizedPlate(_plateController.text);
      final answers = {
        for (final item in _vehicleChecklistItems)
          item.id: {
            'label': item.label,
            'section': item.section,
            'critical': item.critical,
            'answer': _answers[item.id]!.label,
          },
      };
      final checklist = Checklist(
        id: 'vehicle_${uid}_${_openedAt.microsecondsSinceEpoch}',
        tripId: 'daily_vehicle',
        driverId: uid,
        vehicleId: plate,
        type: ChecklistType.vehicleDaily,
        kmRegistered: num.parse(_kmController.text),
        items: ChecklistItems(
          tires: _isItemSafe('tires_condition'),
          brakes: _isItemSafe('brake_system'),
          lights:
              _isItemSafe('headlights') &&
              _isItemSafe('brake_reverse_lights') &&
              _isItemSafe('turn_signals'),
          oil: _isItemSafe('engine_oil'),
          notes: _notesController.text.trim(),
        ),
        photoUrls: const [],
        signatureUrl: '',
        createdAt: _openedAt,
        category: 'vehicle_daily',
        vehiclePlate: plate,
        driverName: profile?.name ?? authUser?.displayName ?? authUser?.email,
        location: _location?.toFirestore(),
        answers: answers,
        approvalStatus: hasFailures ? 'reproved' : 'approved',
        hasCriticalFailure: hasCriticalFailure,
      );

      await ref
          .read(checklistRepositoryProvider)
          .saveForCurrentDriver(checklist);

      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            hasFailures
                ? 'Checklist enviado como reprovado.'
                : 'Checklist aprovado e enviado.',
          ),
        ),
      );
      Navigator.of(context).pop();
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

  bool _isItemSafe(String id) => _answers[id] != ChecklistAnswer.no;

  @override
  Widget build(BuildContext context) {
    final profile = ref.watch(currentUserProfileProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Checklist de Veiculo')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            _HeaderCard(
              plateController: _plateController,
              kmController: _kmController,
              openedAt: _openedAt,
              locationText: _isLoadingLocation
                  ? 'Obtendo localizacao...'
                  : _locationMessage ?? 'Localizacao indisponivel',
              onReloadLocation: _isLoadingLocation ? null : _loadLocation,
              driverText: profile.when(
                data: (user) => user?.name ?? 'Usuario logado',
                error: (_, _) => 'Usuario logado',
                loading: () => 'Carregando usuario...',
              ),
            ),
            const SizedBox(height: 12),
            for (final section in _vehicleChecklistSections) ...[
              _InspectionSection(
                title: section,
                items: _vehicleChecklistItems
                    .where((item) => item.section == section)
                    .toList(growable: false),
                answers: _answers,
                onChanged: (item, answer) {
                  setState(() => _answers[item.id] = answer);
                },
              ),
              const SizedBox(height: 12),
            ],
            TextFormField(
              controller: _notesController,
              minLines: 4,
              maxLines: 7,
              decoration: const InputDecoration(
                labelText: 'Observacoes',
                alignLabelWithHint: true,
              ),
            ),
            if (_errorMessage != null) ...[
              const SizedBox(height: 12),
              DecoratedBox(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFB8B8B8)),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Text(
                    _errorMessage!,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
              ),
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
              label: Text(_isSaving ? 'Enviando...' : 'Enviar Checklist'),
            ),
          ],
        ),
      ),
    );
  }
}

final class _HeaderCard extends StatelessWidget {
  const _HeaderCard({
    required this.plateController,
    required this.kmController,
    required this.openedAt,
    required this.locationText,
    required this.driverText,
    required this.onReloadLocation,
  });

  final TextEditingController plateController;
  final TextEditingController kmController;
  final DateTime openedAt;
  final String locationText;
  final String driverText;
  final VoidCallback? onReloadLocation;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Informacoes iniciais',
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: plateController,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(
                labelText: 'Placa do veiculo',
                prefixIcon: Icon(Icons.pin_outlined),
              ),
              validator: (value) {
                final plate = _normalizedPlate(value ?? '');
                final isValid = RegExp(
                  r'^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$',
                ).hasMatch(plate);
                return isValid
                    ? null
                    : 'Informe uma placa valida: ABC-1234 ou ABC1D23.';
              },
            ),
            const SizedBox(height: 10),
            TextFormField(
              controller: kmController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Quilometragem atual',
                prefixIcon: Icon(Icons.speed_outlined),
              ),
              validator: (value) {
                final km = num.tryParse(value ?? '');
                if (km == null || km < 0) {
                  return 'Informe o KM atual.';
                }
                return null;
              },
            ),
            const SizedBox(height: 12),
            _InfoRow(
              icon: Icons.schedule,
              label: 'Data e hora',
              value: _formatDateTime(openedAt),
            ),
            _InfoRow(
              icon: Icons.location_on_outlined,
              label: 'Localizacao',
              value: locationText,
              action: IconButton(
                tooltip: 'Atualizar localizacao',
                onPressed: onReloadLocation,
                icon: const Icon(Icons.refresh),
              ),
            ),
            _InfoRow(
              icon: Icons.person_outline,
              label: 'Motorista',
              value: driverText,
            ),
          ],
        ),
      ),
    );
  }
}

final class _InspectionSection extends StatelessWidget {
  const _InspectionSection({
    required this.title,
    required this.items,
    required this.answers,
    required this.onChanged,
  });

  final String title;
  final List<_VehicleChecklistItem> items;
  final Map<String, ChecklistAnswer?> answers;
  final void Function(_VehicleChecklistItem item, ChecklistAnswer answer)
  onChanged;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 6),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: Theme.of(
                context,
              ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            for (final item in items)
              _InspectionItemTile(
                item: item,
                value: answers[item.id],
                onChanged: (answer) => onChanged(item, answer),
              ),
          ],
        ),
      ),
    );
  }
}

final class _InspectionItemTile extends StatelessWidget {
  const _InspectionItemTile({
    required this.item,
    required this.value,
    required this.onChanged,
  });

  final _VehicleChecklistItem item;
  final ChecklistAnswer? value;
  final ValueChanged<ChecklistAnswer> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                item.critical
                    ? Icons.priority_high_outlined
                    : Icons.check_circle_outline,
                size: 20,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  item.label,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          SegmentedButton<ChecklistAnswer>(
            showSelectedIcon: false,
            segments: [
              for (final answer in ChecklistAnswer.values)
                ButtonSegment(value: answer, label: Text(answer.label)),
            ],
            selected: value == null ? <ChecklistAnswer>{} : {value!},
            onSelectionChanged: (selection) => onChanged(selection.first),
            emptySelectionAllowed: true,
          ),
        ],
      ),
    );
  }
}

final class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    this.action,
  });

  final IconData icon;
  final String label;
  final String value;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Icon(icon, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Text(value, style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
          if (action != null) action!,
        ],
      ),
    );
  }
}

final class _VehicleChecklistItem {
  const _VehicleChecklistItem({
    required this.id,
    required this.section,
    required this.label,
    this.critical = false,
  });

  final String id;
  final String section;
  final String label;
  final bool critical;
}

const _sectionSafety = 'Seguranca e Documentacao';
const _sectionLighting = 'Iluminacao e Sinalizacao';
const _sectionTires = 'Pneus, Rodas e Suspensao';
const _sectionFluids = 'Fluidos e Mecanica Basica';

const _vehicleChecklistSections = [
  _sectionSafety,
  _sectionLighting,
  _sectionTires,
  _sectionFluids,
];

const _vehicleChecklistItems = [
  _VehicleChecklistItem(
    id: 'vehicle_docs',
    section: _sectionSafety,
    label: 'Documentacao do veiculo e CNH do motorista em dia.',
    critical: true,
  ),
  _VehicleChecklistItem(
    id: 'fire_extinguisher',
    section: _sectionSafety,
    label: 'Extintor de incendio dentro da validade e em condicoes.',
    critical: true,
  ),
  _VehicleChecklistItem(
    id: 'safety_tools',
    section: _sectionSafety,
    label: 'Triangulo, chave de roda e macaco em perfeito estado.',
  ),
  _VehicleChecklistItem(
    id: 'seat_belts',
    section: _sectionSafety,
    label: 'Cintos de seguranca de todos os assentos funcionando.',
    critical: true,
  ),
  _VehicleChecklistItem(
    id: 'horn_reverse_alarm',
    section: _sectionSafety,
    label: 'Buzina e alarme de re operacionais.',
  ),
  _VehicleChecklistItem(
    id: 'headlights',
    section: _sectionLighting,
    label: 'Farois alto/baixo e lanternas dianteiras/traseiras.',
  ),
  _VehicleChecklistItem(
    id: 'brake_reverse_lights',
    section: _sectionLighting,
    label: 'Luzes de freio e luz de re.',
  ),
  _VehicleChecklistItem(
    id: 'turn_signals',
    section: _sectionLighting,
    label: 'Piscas e luz de advertencia.',
  ),
  _VehicleChecklistItem(
    id: 'reflective_items',
    section: _sectionLighting,
    label: 'Giroflex ou faixa refletiva, quando aplicavel.',
  ),
  _VehicleChecklistItem(
    id: 'mirrors',
    section: _sectionLighting,
    label: 'Retrovisores externos integros e regulados.',
  ),
  _VehicleChecklistItem(
    id: 'windshield_wipers',
    section: _sectionLighting,
    label: 'Para-brisa sem trincas e palhetas funcionando.',
  ),
  _VehicleChecklistItem(
    id: 'tires_condition',
    section: _sectionTires,
    label: 'Calibragem e conservacao de todos os pneus, incluindo estepe.',
    critical: true,
  ),
  _VehicleChecklistItem(
    id: 'wheel_nuts',
    section: _sectionTires,
    label: 'Presenca e aperto de todas as porcas das rodas.',
    critical: true,
  ),
  _VehicleChecklistItem(
    id: 'suspension_leaks',
    section: _sectionTires,
    label: 'Ausencia de vazamentos visiveis na suspensao ou eixos.',
  ),
  _VehicleChecklistItem(
    id: 'engine_oil',
    section: _sectionFluids,
    label: 'Nivel do oleo do motor.',
  ),
  _VehicleChecklistItem(
    id: 'coolant',
    section: _sectionFluids,
    label: 'Nivel da agua do radiador/reservatorio de arrefecimento.',
  ),
  _VehicleChecklistItem(
    id: 'brake_steering_fluid',
    section: _sectionFluids,
    label: 'Nivel do fluido de freio e direcao hidraulica.',
    critical: true,
  ),
  _VehicleChecklistItem(
    id: 'brake_system',
    section: _sectionFluids,
    label: 'Funcionamento do sistema de freios no teste inicial.',
    critical: true,
  ),
];

_VehicleChecklistItem _itemById(String id) {
  return _vehicleChecklistItems.firstWhere((item) => item.id == id);
}

String _normalizedPlate(String value) {
  return value.toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '');
}

String _formatDateTime(DateTime dateTime) {
  String two(int value) => value.toString().padLeft(2, '0');
  return '${two(dateTime.day)}/${two(dateTime.month)}/${dateTime.year} '
      '${two(dateTime.hour)}:${two(dateTime.minute)}';
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/firebase_failure.dart';
import '../../../core/providers/firebase_providers.dart';
import '../../equipment/application/driver_equipment_providers.dart';
import '../../equipment/data/models/driver_equipment_model.dart';
import '../../users/application/user_providers.dart';
import '../data/models/checklist_model.dart';

enum StrapComplianceAnswer {
  conforming('C'),
  nonConforming('NC'),
  notApplicable('NA');

  const StrapComplianceAnswer(this.label);

  final String label;
}

enum CargoType {
  trucks('Truques'),
  wheelsets('Rodeiros'),
  sleepers('Dormentes'),
  engine('Motor'),
  palletized('Paletizado'),
  rails('Trilhos'),
  other('Outros');

  const CargoType(this.label);

  final String label;
}

enum StrapRetroactiveReason {
  forgetfulness('Esquecimento'),
  other('Outro motivo');

  const StrapRetroactiveReason(this.label);

  final String label;
}

final class StrapRatchetChecklistPage extends ConsumerStatefulWidget {
  const StrapRatchetChecklistPage({super.key});

  @override
  ConsumerState<StrapRatchetChecklistPage> createState() =>
      _StrapRatchetChecklistPageState();
}

final class _StrapRatchetChecklistPageState
    extends ConsumerState<StrapRatchetChecklistPage> {
  final _formKey = GlobalKey<FormState>();
  final _timeController = TextEditingController();
  final _kmController = TextEditingController();
  final _otherCargoController = TextEditingController();
  final _actionDateController = TextEditingController();
  final _affectedItemController = TextEditingController();
  final _nonConformityController = TextEditingController();
  final _correctiveMeasureController = TextEditingController();
  final _responsibleController = TextEditingController();
  final _deadlineController = TextEditingController();
  final _retroactiveOtherReasonController = TextEditingController();
  final _openedAt = DateTime.now();
  final Set<CargoType> _selectedCargoTypes = {};
  final Set<String> _selectedEquipmentIds = {};
  final Map<String, StrapComplianceAnswer?> _answers = {
    for (final item in _staticChecklistItems) item.id: null,
  };

  late DateTime _checklistDate = _dateOnly(_openedAt);
  StrapRetroactiveReason? _retroactiveReason;
  List<DriverEquipment> _availableEquipment = const [];
  var _isSaving = false;
  String? _errorMessage;

  bool get _isRetroactive => _checklistDate.isBefore(_dateOnly(DateTime.now()));

  bool get _hasNonConformity {
    return _currentItems.any(
      (item) => _answers[item.id] == StrapComplianceAnswer.nonConforming,
    );
  }

  List<_StrapChecklistItem> get _currentItems {
    final selectedEquipment = _availableEquipment
        .where((equipment) => _selectedEquipmentIds.contains(equipment.id))
        .toList(growable: false);

    return [
      ..._staticChecklistItems,
      for (final equipment in selectedEquipment)
        _StrapChecklistItem.equipment(equipment),
    ];
  }

  @override
  void initState() {
    super.initState();
    _timeController.text = _formatTime(_openedAt);
    _actionDateController.text = _formatDate(_openedAt);
  }

  @override
  void dispose() {
    _timeController.dispose();
    _kmController.dispose();
    _otherCargoController.dispose();
    _actionDateController.dispose();
    _affectedItemController.dispose();
    _nonConformityController.dispose();
    _correctiveMeasureController.dispose();
    _responsibleController.dispose();
    _deadlineController.dispose();
    _retroactiveOtherReasonController.dispose();
    super.dispose();
  }

  Future<void> _pickChecklistDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _checklistDate,
      firstDate: DateTime(2024),
      lastDate: _dateOnly(DateTime.now()),
    );

    if (picked == null) {
      return;
    }

    setState(() {
      _checklistDate = _dateOnly(picked);
      _actionDateController.text = _formatDate(_checklistDate);
      if (!_isRetroactive) {
        _retroactiveReason = null;
        _retroactiveOtherReasonController.clear();
      }
    });
  }

  void _toggleEquipment(DriverEquipment equipment, bool selected) {
    setState(() {
      if (selected) {
        _selectedEquipmentIds.add(equipment.id);
      } else {
        _selectedEquipmentIds.remove(equipment.id);
        _answers.remove(_equipmentAnswerId(equipment.id));
      }
    });
  }

  List<DriverEquipment> _selectedEquipmentByType(DriverEquipmentType type) {
    return _availableEquipment
        .where(
          (equipment) =>
              equipment.type == type &&
              _selectedEquipmentIds.contains(equipment.id),
        )
        .toList(growable: false);
  }

  Future<void> _submit() async {
    final form = _formKey.currentState;
    setState(() => _errorMessage = null);

    if (form == null || !form.validate()) {
      return;
    }

    if (_selectedCargoTypes.isEmpty) {
      setState(() => _errorMessage = 'Selecione ao menos um tipo de carga.');
      return;
    }

    if (_isRetroactive && _retroactiveReason == null) {
      setState(
        () => _errorMessage =
            'Selecione o motivo da data retroativa antes de finalizar.',
      );
      return;
    }

    if (_isRetroactive &&
        _retroactiveReason == StrapRetroactiveReason.other &&
        _retroactiveOtherReasonController.text.trim().isEmpty) {
      setState(() => _errorMessage = 'Descreva o outro motivo.');
      return;
    }

    if (_selectedEquipmentIds.isEmpty) {
      setState(
        () => _errorMessage =
            'Selecione ao menos uma cinta ou catraca disponivel.',
      );
      return;
    }

    final missing = _currentItems.any((item) => _answers[item.id] == null);
    if (missing) {
      setState(
        () => _errorMessage =
            'Marque C, NC ou NA em todos os itens antes de finalizar.',
      );
      return;
    }

    if (_hasNonConformity) {
      final shouldContinue = await _showNonConformityAlert();
      if (!shouldContinue) {
        return;
      }
    }

    await _saveChecklist();
  }

  Future<bool> _showNonConformityAlert() async {
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Nao conformidade registrada'),
        content: const Text(
          'O checklist sera enviado como reprovado e o plano de acao sera '
          'direcionado para acompanhamento administrativo.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Revisar'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Enviar'),
          ),
        ],
      ),
    );
    return result ?? false;
  }

  Future<void> _saveChecklist() async {
    final authUser = ref.read(firebaseAuthProvider).currentUser;
    final uid = authUser?.uid;
    if (uid == null || uid.isEmpty) {
      setState(() => _errorMessage = 'Motorista nao autenticado.');
      return;
    }

    setState(() => _isSaving = true);

    try {
      final profile = ref.read(currentUserProfileProvider).asData?.value;
      final performedAt = _composeDateTime(
        _checklistDate,
        _timeController.text,
      );
      final answers = {
        for (final item in _currentItems)
          item.id: {
            'number': item.number,
            'label': item.label,
            'section': item.section,
            if (item.equipmentId != null) 'equipmentId': item.equipmentId,
            if (item.tagNumber != null) 'tagNumber': item.tagNumber,
            if (item.equipmentType != null) 'equipmentType': item.equipmentType,
            'answer': _answers[item.id]!.label,
          },
      };
      final actionPlan = _hasNonConformity
          ? {
              'date': _actionDateController.text.trim(),
              'affectedItem': _affectedItemController.text.trim(),
              'description': _nonConformityController.text.trim(),
              'correctiveMeasure': _correctiveMeasureController.text.trim(),
              'responsible': _responsibleController.text.trim(),
              'deadline': _deadlineController.text.trim(),
            }
          : null;
      final selectedCargo = [
        for (final cargoType in _selectedCargoTypes)
          {
            'type': cargoType.name,
            'label': cargoType.label,
            if (cargoType == CargoType.other)
              'description': _otherCargoController.text.trim(),
          },
      ];
      final checklist = Checklist(
        id: 'strap_${uid}_${_openedAt.microsecondsSinceEpoch}',
        tripId: 'daily_strap_ratchet',
        driverId: uid,
        vehicleId: 'strap_ratchet',
        type: ChecklistType.strapRatchet,
        kmRegistered: num.parse(_kmController.text),
        items: ChecklistItems(
          tires: true,
          brakes: true,
          lights: true,
          oil: true,
          notes: _hasNonConformity
              ? _nonConformityController.text.trim()
              : 'Sem nao conformidades.',
        ),
        photoUrls: const [],
        signatureUrl: '',
        createdAt: performedAt,
        category: 'strap_ratchet',
        vehiclePlate: 'Cinta/Catraca',
        driverName: profile?.name ?? authUser?.displayName ?? authUser?.email,
        answers: {
          'metadata': {
            'procedure': 'PRO 0051',
            'departureTime': _timeController.text.trim(),
            'date': _formatDate(performedAt),
            'monthYear': _formatMonthYear(performedAt),
            'driverRegistration': profile?.uid ?? uid,
            'strapCount': _selectedEquipmentByType(
              DriverEquipmentType.strap,
            ).length,
            'ratchetCount': _selectedEquipmentByType(
              DriverEquipmentType.ratchet,
            ).length,
            'isRetroactive': _isRetroactive,
            if (_isRetroactive) 'retroactiveReason': _retroactiveReason!.label,
            if (_isRetroactive &&
                _retroactiveReason == StrapRetroactiveReason.other)
              'retroactiveOtherReason': _retroactiveOtherReasonController.text
                  .trim(),
            'cargoTypes': selectedCargo,
          },
          'items': answers,
          if (actionPlan != null) 'actionPlan': actionPlan,
        },
        approvalStatus: _hasNonConformity ? 'reproved' : 'approved',
        hasCriticalFailure: _hasNonConformity,
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
            _hasNonConformity
                ? 'Checklist enviado com plano de acao.'
                : 'Checklist enviado como aprovado.',
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

  @override
  Widget build(BuildContext context) {
    final profile = ref.watch(currentUserProfileProvider);
    final equipment = ref.watch(
      availableDriverEquipmentProvider(const {
        DriverEquipmentType.strap,
        DriverEquipmentType.ratchet,
      }),
    );

    return Scaffold(
      appBar: AppBar(title: const Text('Cinta/Catraca')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            _HeaderCard(
              timeController: _timeController,
              kmController: _kmController,
              selectedDate: _checklistDate,
              onPickDate: _pickChecklistDate,
              isRetroactive: _isRetroactive,
              retroactiveReason: _retroactiveReason,
              retroactiveOtherReasonController:
                  _retroactiveOtherReasonController,
              onRetroactiveReasonChanged: (reason) {
                setState(() => _retroactiveReason = reason);
              },
              monthYearText: _formatMonthYear(_checklistDate),
              driverText: profile.when(
                data: (user) {
                  return user?.name ?? 'Usuario logado';
                },
                error: (_, _) => 'Usuario logado',
                loading: () => 'Carregando usuario...',
              ),
            ),
            const SizedBox(height: 12),
            _CargoTypesCard(
              selectedCargoTypes: _selectedCargoTypes,
              otherCargoController: _otherCargoController,
              onChanged: (cargoType, selected) {
                setState(() {
                  if (selected) {
                    _selectedCargoTypes.add(cargoType);
                  } else {
                    _selectedCargoTypes.remove(cargoType);
                  }
                });
              },
            ),
            const SizedBox(height: 12),
            const _LegendCard(),
            const SizedBox(height: 12),
            _InspectionSection(
              title: _sectionGuidelines,
              items: _guidelineItems,
              answers: _answers,
              onChanged: (item, answer) {
                setState(() => _answers[item.id] = answer);
              },
            ),
            const SizedBox(height: 12),
            _InspectionSection(
              title: _sectionStrapInspection,
              items: _strapInspectionItems,
              answers: _answers,
              onChanged: (item, answer) {
                setState(() => _answers[item.id] = answer);
              },
            ),
            const SizedBox(height: 12),
            equipment.when(
              data: (items) {
                _availableEquipment = items;
                return Column(
                  children: [
                    _EquipmentSelectionCard(
                      title: 'Equipamentos disponiveis',
                      equipment: items,
                      selectedIds: _selectedEquipmentIds,
                      onChanged: _toggleEquipment,
                    ),
                    const SizedBox(height: 12),
                    _InspectionSection(
                      title: 'Equipamentos selecionados',
                      items: _currentItems
                          .where((item) => item.equipmentId != null)
                          .toList(growable: false),
                      answers: _answers,
                      emptyMessage:
                          'Selecione os equipamentos disponiveis para iniciar a verificacao.',
                      onChanged: (item, answer) {
                        setState(() => _answers[item.id] = answer);
                      },
                    ),
                  ],
                );
              },
              error: (error, _) =>
                  _ErrorBox(message: 'Falha ao carregar equipamentos: $error'),
              loading: () => const Center(
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: CircularProgressIndicator(),
                ),
              ),
            ),
            const SizedBox(height: 12),
            if (_hasNonConformity) ...[
              _ActionPlanCard(
                actionDateController: _actionDateController,
                affectedItemController: _affectedItemController,
                nonConformityController: _nonConformityController,
                correctiveMeasureController: _correctiveMeasureController,
                responsibleController: _responsibleController,
                deadlineController: _deadlineController,
              ),
              const SizedBox(height: 12),
            ],
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
              label: Text(
                _isSaving ? 'Enviando...' : 'Finalizar e Enviar Checklist',
              ),
            ),
          ],
        ),
      ),
    );
  }
}

final class _HeaderCard extends StatelessWidget {
  const _HeaderCard({
    required this.timeController,
    required this.kmController,
    required this.selectedDate,
    required this.onPickDate,
    required this.isRetroactive,
    required this.retroactiveReason,
    required this.retroactiveOtherReasonController,
    required this.onRetroactiveReasonChanged,
    required this.monthYearText,
    required this.driverText,
  });

  final TextEditingController timeController;
  final TextEditingController kmController;
  final DateTime selectedDate;
  final VoidCallback onPickDate;
  final bool isRetroactive;
  final StrapRetroactiveReason? retroactiveReason;
  final TextEditingController retroactiveOtherReasonController;
  final ValueChanged<StrapRetroactiveReason?> onRetroactiveReasonChanged;
  final String monthYearText;
  final String driverText;

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
              controller: timeController,
              keyboardType: TextInputType.datetime,
              decoration: const InputDecoration(
                labelText: 'Horario de saida',
                prefixIcon: Icon(Icons.schedule),
              ),
              validator: (value) {
                return (value ?? '').trim().isEmpty
                    ? 'Informe o horario de saida.'
                    : null;
              },
            ),
            const SizedBox(height: 10),
            _InfoRow(
              icon: Icons.today_outlined,
              label: 'Data',
              value: _formatDate(selectedDate),
              trailing: TextButton.icon(
                onPressed: onPickDate,
                icon: const Icon(Icons.edit_calendar_outlined),
                label: const Text('Alterar'),
              ),
            ),
            if (isRetroactive) ...[
              const SizedBox(height: 4),
              DropdownButtonFormField<StrapRetroactiveReason>(
                initialValue: retroactiveReason,
                decoration: const InputDecoration(
                  labelText: 'Motivo da data retroativa',
                  prefixIcon: Icon(Icons.history_outlined),
                ),
                items: [
                  for (final reason in StrapRetroactiveReason.values)
                    DropdownMenuItem(value: reason, child: Text(reason.label)),
                ],
                validator: (value) {
                  return value == null
                      ? 'Selecione o motivo da data retroativa.'
                      : null;
                },
                onChanged: onRetroactiveReasonChanged,
              ),
              if (retroactiveReason == StrapRetroactiveReason.other) ...[
                const SizedBox(height: 10),
                TextFormField(
                  controller: retroactiveOtherReasonController,
                  decoration: const InputDecoration(
                    labelText: 'Descreva o outro motivo',
                    prefixIcon: Icon(Icons.notes_outlined),
                  ),
                  validator: (value) {
                    return (value ?? '').trim().isEmpty
                        ? 'Descreva o outro motivo.'
                        : null;
                  },
                ),
              ],
            ],
            _InfoRow(
              icon: Icons.calendar_month_outlined,
              label: 'Mes/Ano',
              value: monthYearText,
            ),
            _InfoRow(
              icon: Icons.person_outline,
              label: 'Motorista',
              value: driverText,
            ),
            const SizedBox(height: 10),
            TextFormField(
              controller: kmController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Quilometragem (KM)',
                prefixIcon: Icon(Icons.speed_outlined),
              ),
              validator: _requiredPositiveNumber,
            ),
          ],
        ),
      ),
    );
  }
}

final class _CargoTypesCard extends StatelessWidget {
  const _CargoTypesCard({
    required this.selectedCargoTypes,
    required this.otherCargoController,
    required this.onChanged,
  });

  final Set<CargoType> selectedCargoTypes;
  final TextEditingController otherCargoController;
  final void Function(CargoType cargoType, bool selected) onChanged;

  @override
  Widget build(BuildContext context) {
    final otherSelected = selectedCargoTypes.contains(CargoType.other);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Tipos de carga',
              style: Theme.of(
                context,
              ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final cargoType in CargoType.values)
                  FilterChip(
                    label: Text(cargoType.label),
                    selected: selectedCargoTypes.contains(cargoType),
                    onSelected: (selected) => onChanged(cargoType, selected),
                  ),
              ],
            ),
            if (otherSelected) ...[
              const SizedBox(height: 10),
              TextFormField(
                controller: otherCargoController,
                decoration: const InputDecoration(
                  labelText: 'Descreva o tipo de carga',
                ),
                validator: (value) {
                  if (otherSelected && (value ?? '').trim().isEmpty) {
                    return 'Descreva a carga em Outros.';
                  }
                  return null;
                },
              ),
            ],
          ],
        ),
      ),
    );
  }
}

final class _LegendCard extends StatelessWidget {
  const _LegendCard();

  @override
  Widget build(BuildContext context) {
    return const Card(
      child: Padding(
        padding: EdgeInsets.all(14),
        child: Text(
          'Legenda: C = Conforme | NC = Nao Conforme | NA = Nao se aplica',
          style: TextStyle(fontWeight: FontWeight.w700),
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
    this.emptyMessage,
  });

  final String title;
  final List<_StrapChecklistItem> items;
  final Map<String, StrapComplianceAnswer?> answers;
  final void Function(_StrapChecklistItem item, StrapComplianceAnswer answer)
  onChanged;
  final String? emptyMessage;

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
            if (items.isEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(emptyMessage ?? 'Nenhum item para conferir.'),
              )
            else
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

  final _StrapChecklistItem item;
  final StrapComplianceAnswer? value;
  final ValueChanged<StrapComplianceAnswer> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${item.number}. ${item.label}',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 8),
          if (item.tagNumber != null) ...[
            _TagBanner(
              label: item.equipmentTypeLabel ?? 'Equipamento',
              tagNumber: item.tagNumber!,
            ),
            const SizedBox(height: 8),
          ],
          SegmentedButton<StrapComplianceAnswer>(
            showSelectedIcon: false,
            segments: [
              for (final answer in StrapComplianceAnswer.values)
                ButtonSegment(value: answer, label: Text(answer.label)),
            ],
            selected: value == null ? <StrapComplianceAnswer>{} : {value!},
            onSelectionChanged: (selection) => onChanged(selection.first),
            emptySelectionAllowed: true,
          ),
        ],
      ),
    );
  }
}

final class _ActionPlanCard extends StatelessWidget {
  const _ActionPlanCard({
    required this.actionDateController,
    required this.affectedItemController,
    required this.nonConformityController,
    required this.correctiveMeasureController,
    required this.responsibleController,
    required this.deadlineController,
  });

  final TextEditingController actionDateController;
  final TextEditingController affectedItemController;
  final TextEditingController nonConformityController;
  final TextEditingController correctiveMeasureController;
  final TextEditingController responsibleController;
  final TextEditingController deadlineController;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Plano de acao / Nao conformidade',
              style: Theme.of(
                context,
              ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 12),
            _RequiredTextField(controller: actionDateController, label: 'Data'),
            _RequiredTextField(
              controller: affectedItemController,
              label: 'Tags / Item afetado',
            ),
            _RequiredTextField(
              controller: nonConformityController,
              label: 'Nao conformidade',
              minLines: 3,
            ),
            _RequiredTextField(
              controller: correctiveMeasureController,
              label: 'Medida corretiva',
              minLines: 3,
            ),
            _RequiredTextField(
              controller: responsibleController,
              label: 'Responsavel',
            ),
            _RequiredTextField(controller: deadlineController, label: 'Prazo'),
          ],
        ),
      ),
    );
  }
}

final class _EquipmentSelectionCard extends StatelessWidget {
  const _EquipmentSelectionCard({
    required this.title,
    required this.equipment,
    required this.selectedIds,
    required this.onChanged,
  });

  final String title;
  final List<DriverEquipment> equipment;
  final Set<String> selectedIds;
  final void Function(DriverEquipment equipment, bool selected) onChanged;

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
              ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            if (equipment.isEmpty)
              const Text(
                'Nenhuma cinta ou catraca vinculada ao seu usuario. O painel administrativo fara essa atribuicao.',
              )
            else
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final item in equipment)
                    FilterChip(
                      label: Text('${item.type.label} ${item.tagNumber}'),
                      selected: selectedIds.contains(item.id),
                      onSelected: (selected) => onChanged(item, selected),
                    ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}

final class _TagBanner extends StatelessWidget {
  const _TagBanner({required this.label, required this.tagNumber});

  final String label;
  final String tagNumber;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xFFF6F6F6),
        border: Border.all(color: const Color(0xFFB8B8B8)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Row(
          children: [
            const Icon(Icons.tag_outlined, size: 18),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                '$label vinculado: $tagNumber',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
          ],
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
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
      ),
    );
  }
}

final class _RequiredTextField extends StatelessWidget {
  const _RequiredTextField({
    required this.controller,
    required this.label,
    this.minLines = 1,
  });

  final TextEditingController controller;
  final String label;
  final int minLines;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: TextFormField(
        controller: controller,
        minLines: minLines,
        maxLines: minLines == 1 ? 1 : 5,
        decoration: InputDecoration(labelText: label),
        validator: (value) {
          return (value ?? '').trim().isEmpty ? 'Campo obrigatorio.' : null;
        },
      ),
    );
  }
}

final class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    this.trailing,
  });

  final IconData icon;
  final String label;
  final String value;
  final Widget? trailing;

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
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}

final class _StrapChecklistItem {
  const _StrapChecklistItem({
    required this.id,
    required this.number,
    required this.section,
    required this.label,
  }) : equipmentId = null,
       tagNumber = null,
       equipmentType = null,
       equipmentTypeLabel = null;

  factory _StrapChecklistItem.equipment(DriverEquipment equipment) {
    final isStrap = equipment.type == DriverEquipmentType.strap;
    final label = isStrap
        ? 'Controle individual do estado da cinta cadastrada.'
        : 'Controle individual do estado da catraca cadastrada.';
    return _StrapChecklistItem._equipment(
      id: _equipmentAnswerId(equipment.id),
      number: '${equipment.type.label} ${equipment.tagNumber}',
      section: isStrap ? _sectionStrapTags : _sectionRatchetTags,
      label: label,
      equipmentId: equipment.id,
      tagNumber: equipment.tagNumber,
      equipmentType: equipment.type.value,
      equipmentTypeLabel: equipment.type.label,
    );
  }

  const _StrapChecklistItem._equipment({
    required this.id,
    required this.number,
    required this.section,
    required this.label,
    required this.equipmentId,
    required this.tagNumber,
    required this.equipmentType,
    required this.equipmentTypeLabel,
  });

  final String id;
  final String number;
  final String section;
  final String label;
  final String? equipmentId;
  final String? tagNumber;
  final String? equipmentType;
  final String? equipmentTypeLabel;
}

const _sectionGuidelines = 'Diretrizes Gerais de Amarracao';
const _sectionStrapInspection = 'Inspecao Especifica da Cinta';
const _sectionStrapTags = 'TAGS Cintas';
const _sectionRatchetTags = 'TAGS Catracas';

const _guidelineItems = [
  _StrapChecklistItem(
    id: 'guideline_01',
    number: '01',
    section: _sectionGuidelines,
    label: 'Dimensao da altura da carga dentro do limite?',
  ),
  _StrapChecklistItem(
    id: 'guideline_02',
    number: '02',
    section: _sectionGuidelines,
    label: 'Peso maximo permitido da carga dentro do limite?',
  ),
  _StrapChecklistItem(
    id: 'guideline_03',
    number: '03',
    section: _sectionGuidelines,
    label: 'A carga esta apoiada corretamente?',
  ),
  _StrapChecklistItem(
    id: 'guideline_04',
    number: '04',
    section: _sectionGuidelines,
    label: 'Distribuicao do peso esta correta na carroceria?',
  ),
  _StrapChecklistItem(
    id: 'guideline_05',
    number: '05',
    section: _sectionGuidelines,
    label: 'Pontos de amarracao estao seguros?',
  ),
  _StrapChecklistItem(
    id: 'guideline_06',
    number: '06',
    section: _sectionGuidelines,
    label: 'Cintas sem folgas?',
  ),
  _StrapChecklistItem(
    id: 'guideline_07',
    number: '07',
    section: _sectionGuidelines,
    label: 'Catracas bem ajustadas?',
  ),
  _StrapChecklistItem(
    id: 'guideline_08',
    number: '08',
    section: _sectionGuidelines,
    label: 'Conhecimento do percurso?',
  ),
  _StrapChecklistItem(
    id: 'guideline_09',
    number: '09',
    section: _sectionGuidelines,
    label: 'Quantidade de cintas/catracas atende?',
  ),
  _StrapChecklistItem(
    id: 'guideline_10',
    number: '10',
    section: _sectionGuidelines,
    label: 'Foram inspecionados todos os dispositivos de amarracao?',
  ),
  _StrapChecklistItem(
    id: 'guideline_11',
    number: '11',
    section: _sectionGuidelines,
    label: 'Empregado tem conhecimento sobre amarracao de cargas?',
  ),
  _StrapChecklistItem(
    id: 'guideline_12',
    number: '12',
    section: _sectionGuidelines,
    label: 'Utilizacao de quebra-quina?',
  ),
];

const _strapInspectionItems = [
  _StrapChecklistItem(
    id: 'strap_eye',
    number: '01',
    section: _sectionStrapInspection,
    label: 'Olhal.',
  ),
  _StrapChecklistItem(
    id: 'strap_stitching',
    number: '02',
    section: _sectionStrapInspection,
    label: 'Costura em geral.',
  ),
  _StrapChecklistItem(
    id: 'strap_capacity',
    number: '03',
    section: _sectionStrapInspection,
    label: 'Capacidade compativel com a carga.',
  ),
  _StrapChecklistItem(
    id: 'strap_body_cut',
    number: '04',
    section: _sectionStrapInspection,
    label: 'Corte em seu corpo.',
  ),
  _StrapChecklistItem(
    id: 'strap_structure',
    number: '05',
    section: _sectionStrapInspection,
    label: 'Condicoes estruturais.',
  ),
  _StrapChecklistItem(
    id: 'strap_eye_stitching',
    number: '06',
    section: _sectionStrapInspection,
    label: 'Costura do olhal e emendas.',
  ),
  _StrapChecklistItem(
    id: 'strap_chemical_free',
    number: '07',
    section: _sectionStrapInspection,
    label: 'Isentos de oleos, graxas e outros produtos quimicos.',
  ),
  _StrapChecklistItem(
    id: 'strap_visible_capacity',
    number: '08',
    section: _sectionStrapInspection,
    label: 'Capacidade de carga da cinta visivel.',
  ),
];

const _staticChecklistItems = [..._guidelineItems, ..._strapInspectionItems];

String? _requiredPositiveNumber(String? value) {
  final number = num.tryParse((value ?? '').trim());
  if (number == null || number < 0) {
    return 'Informe um numero valido.';
  }
  return null;
}

String _equipmentAnswerId(String equipmentId) => 'equipment_$equipmentId';

DateTime _dateOnly(DateTime dateTime) {
  return DateTime(dateTime.year, dateTime.month, dateTime.day);
}

DateTime _composeDateTime(DateTime date, String timeText) {
  final parts = timeText.split(':');
  final hour = int.tryParse(parts.isNotEmpty ? parts[0] : '') ?? 0;
  final minute = int.tryParse(parts.length > 1 ? parts[1] : '') ?? 0;
  return DateTime(date.year, date.month, date.day, hour, minute);
}

String _formatTime(DateTime dateTime) {
  String two(int value) => value.toString().padLeft(2, '0');
  return '${two(dateTime.hour)}:${two(dateTime.minute)}';
}

String _formatDate(DateTime dateTime) {
  String two(int value) => value.toString().padLeft(2, '0');
  return '${two(dateTime.day)}/${two(dateTime.month)}/${dateTime.year}';
}

String _formatMonthYear(DateTime dateTime) {
  String two(int value) => value.toString().padLeft(2, '0');
  return '${two(dateTime.month)}/${dateTime.year}';
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/firebase_failure.dart';
import '../../../core/providers/firebase_providers.dart';
import '../../users/application/user_providers.dart';
import '../data/models/checklist_model.dart';

enum ComplianceAnswer {
  conforming('C'),
  nonConforming('NC'),
  notApplicable('NA');

  const ComplianceAnswer(this.label);

  final String label;
}

final class ChainTensionerChecklistPage extends ConsumerStatefulWidget {
  const ChainTensionerChecklistPage({super.key});

  @override
  ConsumerState<ChainTensionerChecklistPage> createState() =>
      _ChainTensionerChecklistPageState();
}

final class _ChainTensionerChecklistPageState
    extends ConsumerState<ChainTensionerChecklistPage> {
  final _formKey = GlobalKey<FormState>();
  final _timeController = TextEditingController();
  final _kmController = TextEditingController();
  final _chainCountController = TextEditingController();
  final _tensionerCountController = TextEditingController();
  final _affectedItemController = TextEditingController();
  final _nonConformityController = TextEditingController();
  final _correctiveMeasureController = TextEditingController();
  final _responsibleController = TextEditingController();
  final _deadlineController = TextEditingController();
  final _pinController = TextEditingController();
  final _openedAt = DateTime.now();
  final Map<String, ComplianceAnswer?> _answers = {
    for (final item in _guidelineItems) item.id: null,
  };
  final Map<String, TextEditingController> _tagNumberControllers = {};

  var _isSaving = false;
  String? _errorMessage;

  bool get _hasNonConformity {
    return _currentItems.any(
      (item) => _answers[item.id] == ComplianceAnswer.nonConforming,
    );
  }

  @override
  void initState() {
    super.initState();
    _timeController.text = _formatTime(_openedAt);
  }

  @override
  void dispose() {
    _timeController.dispose();
    _kmController.dispose();
    _chainCountController.dispose();
    _tensionerCountController.dispose();
    _affectedItemController.dispose();
    _nonConformityController.dispose();
    _correctiveMeasureController.dispose();
    _responsibleController.dispose();
    _deadlineController.dispose();
    _pinController.dispose();
    for (final controller in _tagNumberControllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  List<_ChecklistItem> get _currentItems {
    return [
      ..._guidelineItems,
      ..._buildTagItems(
        count: _readCount(_chainCountController),
        idPrefix: 'chain_tag',
        numberPrefix: 'Corrente',
        section: _sectionChains,
        labelBuilder: (index) =>
            'Corrente $index: verificar estado geral, isencao de nos, trava de seguranca e ausencia de cantos vivos.',
      ),
      ..._buildTagItems(
        count: _readCount(_tensionerCountController),
        idPrefix: 'tensioner_tag',
        numberPrefix: 'Tensionador',
        section: _sectionTensioners,
        labelBuilder: (index) =>
            'Tensionador $index: verificar trincas, catraca, gancho, alavanca e angulacao.',
      ),
    ];
  }

  TextEditingController _tagNumberControllerFor(String itemId) {
    return _tagNumberControllers.putIfAbsent(itemId, TextEditingController.new);
  }

  Future<void> _submit() async {
    final form = _formKey.currentState;
    setState(() => _errorMessage = null);

    if (form == null || !form.validate()) {
      return;
    }

    final currentItems = _currentItems;
    final missing = currentItems.any((item) => _answers[item.id] == null);
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
      final answers = {
        for (final item in _currentItems)
          item.id: {
            'number': item.number,
            'label': item.label,
            'section': item.section,
            if (item.requiresTagNumber)
              'tagNumber': _tagNumberControllerFor(item.id).text.trim(),
            'answer': _answers[item.id]!.label,
          },
      };
      final actionPlan = _hasNonConformity
          ? {
              'affectedItem': _affectedItemController.text.trim(),
              'description': _nonConformityController.text.trim(),
              'correctiveMeasure': _correctiveMeasureController.text.trim(),
              'responsible': _responsibleController.text.trim(),
              'deadline': _deadlineController.text.trim(),
            }
          : null;
      final checklist = Checklist(
        id: 'chain_${uid}_${_openedAt.microsecondsSinceEpoch}',
        tripId: 'daily_chain_tensioner',
        driverId: uid,
        vehicleId: 'chain_tensioner',
        type: ChecklistType.chainTensioner,
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
        createdAt: _openedAt,
        category: 'chain_tensioner',
        vehiclePlate: 'Corrente/Tensionador',
        driverName: profile?.name ?? authUser?.displayName ?? authUser?.email,
        answers: {
          'metadata': {
            'procedure': 'PRO 0054',
            'departureTime': _timeController.text.trim(),
            'date': _formatDate(_openedAt),
            'monthYear': _formatMonthYear(_openedAt),
            'driverRegistration': profile?.uid ?? uid,
            'chainCount': int.parse(_chainCountController.text),
            'tensionerCount': int.parse(_tensionerCountController.text),
            'pinConfirmed': _pinController.text.trim().isNotEmpty,
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

    return Scaffold(
      appBar: AppBar(title: const Text('Corrente/Tensionador')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            _HeaderCard(
              timeController: _timeController,
              kmController: _kmController,
              chainCountController: _chainCountController,
              tensionerCountController: _tensionerCountController,
              onEquipmentCountChanged: () => setState(() {}),
              dateText: _formatDate(_openedAt),
              monthYearText: _formatMonthYear(_openedAt),
              driverText: profile.when(
                data: (user) {
                  return user?.name ?? 'Usuario logado';
                },
                error: (_, _) => 'Usuario logado',
                loading: () => 'Carregando usuario...',
              ),
            ),
            const SizedBox(height: 12),
            const _LegendCard(),
            const SizedBox(height: 12),
            _InspectionSection(
              title: _sectionGuidelines,
              items: _guidelineItems,
              answers: _answers,
              tagNumberControllerFor: _tagNumberControllerFor,
              onChanged: (item, answer) {
                setState(() => _answers[item.id] = answer);
              },
            ),
            const SizedBox(height: 12),
            _InspectionSection(
              title: _sectionChains,
              items: _buildTagItems(
                count: _readCount(_chainCountController),
                idPrefix: 'chain_tag',
                numberPrefix: 'Corrente',
                section: _sectionChains,
                labelBuilder: (index) =>
                    'Corrente $index: verificar estado geral, isencao de nos, trava de seguranca e ausencia de cantos vivos.',
              ),
              answers: _answers,
              tagNumberControllerFor: _tagNumberControllerFor,
              emptyMessage: 'Informe o N de correntes para gerar as TAGs.',
              onChanged: (item, answer) {
                setState(() => _answers[item.id] = answer);
              },
            ),
            const SizedBox(height: 12),
            _InspectionSection(
              title: _sectionTensioners,
              items: _buildTagItems(
                count: _readCount(_tensionerCountController),
                idPrefix: 'tensioner_tag',
                numberPrefix: 'Tensionador',
                section: _sectionTensioners,
                labelBuilder: (index) =>
                    'Tensionador $index: verificar trincas, catraca, gancho, alavanca e angulacao.',
              ),
              answers: _answers,
              tagNumberControllerFor: _tagNumberControllerFor,
              emptyMessage: 'Informe o N de tensionadores para gerar as TAGs.',
              onChanged: (item, answer) {
                setState(() => _answers[item.id] = answer);
              },
            ),
            const SizedBox(height: 12),
            if (_hasNonConformity) ...[
              _ActionPlanCard(
                affectedItemController: _affectedItemController,
                nonConformityController: _nonConformityController,
                correctiveMeasureController: _correctiveMeasureController,
                responsibleController: _responsibleController,
                deadlineController: _deadlineController,
              ),
              const SizedBox(height: 12),
            ],
            TextFormField(
              controller: _pinController,
              obscureText: true,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'PIN/Senha do motorista (opcional)',
                prefixIcon: Icon(Icons.lock_outline),
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
    required this.chainCountController,
    required this.tensionerCountController,
    required this.onEquipmentCountChanged,
    required this.dateText,
    required this.monthYearText,
    required this.driverText,
  });

  final TextEditingController timeController;
  final TextEditingController kmController;
  final TextEditingController chainCountController;
  final TextEditingController tensionerCountController;
  final VoidCallback onEquipmentCountChanged;
  final String dateText;
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
              value: dateText,
            ),
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
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: chainCountController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'N de correntes',
                    ),
                    onChanged: (_) => onEquipmentCountChanged(),
                    validator: _requiredPositiveNumber,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextFormField(
                    controller: tensionerCountController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'N de tensionadores',
                    ),
                    onChanged: (_) => onEquipmentCountChanged(),
                    validator: _requiredPositiveNumber,
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
    required this.tagNumberControllerFor,
    required this.onChanged,
    this.emptyMessage,
  });

  final String title;
  final List<_ChecklistItem> items;
  final Map<String, ComplianceAnswer?> answers;
  final TextEditingController Function(String itemId) tagNumberControllerFor;
  final void Function(_ChecklistItem item, ComplianceAnswer answer) onChanged;
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
                  tagNumberController: item.requiresTagNumber
                      ? tagNumberControllerFor(item.id)
                      : null,
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
    this.tagNumberController,
    required this.value,
    required this.onChanged,
  });

  final _ChecklistItem item;
  final TextEditingController? tagNumberController;
  final ComplianceAnswer? value;
  final ValueChanged<ComplianceAnswer> onChanged;

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
          if (tagNumberController != null) ...[
            TextFormField(
              controller: tagNumberController,
              decoration: const InputDecoration(
                labelText: 'Numeracao da TAG',
                prefixIcon: Icon(Icons.tag_outlined),
              ),
              validator: (value) {
                return (value ?? '').trim().isEmpty
                    ? 'Informe a numeracao da TAG.'
                    : null;
              },
            ),
            const SizedBox(height: 8),
          ],
          SegmentedButton<ComplianceAnswer>(
            showSelectedIcon: false,
            segments: [
              for (final answer in ComplianceAnswer.values)
                ButtonSegment(value: answer, label: Text(answer.label)),
            ],
            selected: value == null ? <ComplianceAnswer>{} : {value!},
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
    required this.affectedItemController,
    required this.nonConformityController,
    required this.correctiveMeasureController,
    required this.responsibleController,
    required this.deadlineController,
  });

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
            _RequiredTextField(
              controller: affectedItemController,
              label: 'TAG / Item afetado',
            ),
            _RequiredTextField(
              controller: nonConformityController,
              label: 'Descricao da nao conformidade',
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
  });

  final IconData icon;
  final String label;
  final String value;

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
        ],
      ),
    );
  }
}

final class _ChecklistItem {
  const _ChecklistItem({
    required this.id,
    required this.number,
    required this.section,
    required this.label,
    this.requiresTagNumber = false,
  });

  final String id;
  final String number;
  final String section;
  final String label;
  final bool requiresTagNumber;
}

const _sectionGuidelines = 'Diretrizes de Amarracao Especial';
const _sectionChains = 'TAGS Correntes';
const _sectionTensioners = 'TAGS Tensionadores de Correntes';

const _guidelineItems = [
  _ChecklistItem(
    id: 'guideline_01',
    number: '01',
    section: _sectionGuidelines,
    label: 'A carga esta apoiada corretamente?',
  ),
  _ChecklistItem(
    id: 'guideline_02',
    number: '02',
    section: _sectionGuidelines,
    label: 'Distribuicao do peso esta correta na carroceria?',
  ),
  _ChecklistItem(
    id: 'guideline_03',
    number: '03',
    section: _sectionGuidelines,
    label: 'Pontos de amarracao estao seguros?',
  ),
  _ChecklistItem(
    id: 'guideline_04',
    number: '04',
    section: _sectionGuidelines,
    label: 'Correntes sem folgas?',
  ),
  _ChecklistItem(
    id: 'guideline_05',
    number: '05',
    section: _sectionGuidelines,
    label: 'Catracas do tensionador bem ajustadas?',
  ),
  _ChecklistItem(
    id: 'guideline_06',
    number: '06',
    section: _sectionGuidelines,
    label: 'Conferencia do travamento das catracas dos tensionadores?',
  ),
  _ChecklistItem(
    id: 'guideline_07',
    number: '07',
    section: _sectionGuidelines,
    label: 'Quantidade de corrente atende?',
  ),
  _ChecklistItem(
    id: 'guideline_08',
    number: '08',
    section: _sectionGuidelines,
    label: 'Foram inspecionados todos os dispositivos de amarracao?',
  ),
  _ChecklistItem(
    id: 'guideline_09',
    number: '09',
    section: _sectionGuidelines,
    label: 'Borracha a ser utilizada avaliada e flexivel?',
  ),
  _ChecklistItem(
    id: 'guideline_10',
    number: '10',
    section: _sectionGuidelines,
    label: 'Empregado tem conhecimento sobre amarracao de cargas?',
  ),
];

List<_ChecklistItem> _buildTagItems({
  required int count,
  required String idPrefix,
  required String numberPrefix,
  required String section,
  required String Function(int index) labelBuilder,
}) {
  return [
    for (var index = 1; index <= count; index++)
      _ChecklistItem(
        id: '${idPrefix}_$index',
        number: '$numberPrefix $index',
        section: section,
        label: labelBuilder(index),
        requiresTagNumber: true,
      ),
  ];
}

int _readCount(TextEditingController controller) {
  return int.tryParse(controller.text.trim()) ?? 0;
}

String? _requiredPositiveNumber(String? value) {
  final number = num.tryParse((value ?? '').trim());
  if (number == null || number < 0) {
    return 'Informe um numero valido.';
  }
  return null;
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

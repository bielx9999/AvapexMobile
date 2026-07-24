import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../application/checklist_providers.dart';
import '../data/models/checklist_model.dart';
import 'chain_tensioner_checklist_page.dart';
import 'strap_ratchet_checklist_page.dart';
import 'vehicle_checklist_page.dart';

enum ChecklistTemplate {
  strapRatchet(
    label: 'Checklist de Cinta/Catraca',
    description: 'Conferencia dos itens de amarracao com cinta e catraca.',
    icon: Icons.inventory_2_outlined,
  ),
  chainTensioner(
    label: 'Checklist de Corrente/Tensionador',
    description:
        'Conferencia dos itens de amarracao com corrente e tensionador.',
    icon: Icons.link_outlined,
  ),
  vehicle(
    label: 'Checklist de Veiculo',
    description:
        'Inspecao das condicoes operacionais e documentais do veiculo.',
    icon: Icons.local_shipping_outlined,
  );

  const ChecklistTemplate({
    required this.label,
    required this.description,
    required this.icon,
  });

  final String label;
  final String description;
  final IconData icon;
}

final class ChecklistsPage extends ConsumerStatefulWidget {
  const ChecklistsPage({super.key});

  @override
  ConsumerState<ChecklistsPage> createState() => _ChecklistsPageState();
}

final class _ChecklistsPageState extends ConsumerState<ChecklistsPage> {
  ChecklistTemplate? _selectedTemplate;

  void _selectTemplate(ChecklistTemplate template) {
    setState(() => _selectedTemplate = template);
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Column(
        children: [
          const Material(
            color: Colors.white,
            child: TabBar(
              tabs: [
                Tab(text: 'Novo checklist'),
                Tab(text: 'Historico'),
              ],
            ),
          ),
          Expanded(
            child: TabBarView(
              children: [
                _NewChecklistTab(
                  selectedTemplate: _selectedTemplate,
                  onSelected: _selectTemplate,
                ),
                const _ChecklistHistoryTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

final class _NewChecklistTab extends StatelessWidget {
  const _NewChecklistTab({
    required this.selectedTemplate,
    required this.onSelected,
  });

  final ChecklistTemplate? selectedTemplate;
  final ValueChanged<ChecklistTemplate> onSelected;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      children: [
        Text(
          'Selecione o modelo de checklist',
          style: Theme.of(
            context,
          ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 6),
        Text(
          'Escolha qual checklist sera iniciado para a operacao.',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        const SizedBox(height: 16),
        _TemplateSelector(
          selectedTemplate: selectedTemplate,
          onSelected: onSelected,
        ),
        const SizedBox(height: 16),
        FilledButton.icon(
          onPressed: selectedTemplate == null
              ? null
              : () {
                  final template = selectedTemplate!;
                  if (template == ChecklistTemplate.vehicle) {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const VehicleChecklistPage(),
                      ),
                    );
                    return;
                  }
                  if (template == ChecklistTemplate.chainTensioner) {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const ChainTensionerChecklistPage(),
                      ),
                    );
                    return;
                  }
                  if (template == ChecklistTemplate.strapRatchet) {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const StrapRatchetChecklistPage(),
                      ),
                    );
                    return;
                  }
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('${template.label} sera desenvolvido.'),
                    ),
                  );
                },
          icon: const Icon(Icons.arrow_forward),
          label: const Text('Selecionar modelo'),
        ),
      ],
    );
  }
}

final class _TemplateSelector extends StatelessWidget {
  const _TemplateSelector({
    required this.selectedTemplate,
    required this.onSelected,
  });

  final ChecklistTemplate? selectedTemplate;
  final ValueChanged<ChecklistTemplate> onSelected;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (final template in ChecklistTemplate.values)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _TemplateListTile(
              template: template,
              selected: template == selectedTemplate,
              onTap: () => onSelected(template),
            ),
          ),
      ],
    );
  }
}

final class _TemplateListTile extends StatelessWidget {
  const _TemplateListTile({
    required this.template,
    required this.selected,
    required this.onTap,
  });

  final ChecklistTemplate template;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? Colors.black : Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(
          color: selected ? Colors.black : const Color(0xFFD9D9D9),
        ),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              CircleAvatar(
                backgroundColor: selected ? Colors.white : Colors.black,
                child: Icon(
                  template.icon,
                  color: selected ? Colors.black : Colors.white,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      template.label,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: selected ? Colors.white : null,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      template.description,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: selected ? Colors.white : null,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Icon(
                selected
                    ? Icons.radio_button_checked
                    : Icons.radio_button_unchecked,
                color: selected ? Colors.white : const Color(0xFF6F6F6F),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

final class _ChecklistHistoryTab extends ConsumerStatefulWidget {
  const _ChecklistHistoryTab();

  @override
  ConsumerState<_ChecklistHistoryTab> createState() =>
      _ChecklistHistoryTabState();
}

final class _ChecklistHistoryTabState
    extends ConsumerState<_ChecklistHistoryTab> {
  DateTime? _startDate;
  DateTime? _endDate;

  Future<void> _pickStartDate() async {
    final picked = await _pickDate(initialDate: _startDate ?? DateTime.now());
    if (picked == null) {
      return;
    }
    setState(() {
      _startDate = _dateOnly(picked);
      if (_endDate != null && _endDate!.isBefore(_startDate!)) {
        _endDate = _startDate;
      }
    });
  }

  Future<void> _pickEndDate() async {
    final picked = await _pickDate(initialDate: _endDate ?? DateTime.now());
    if (picked == null) {
      return;
    }
    setState(() {
      _endDate = _dateOnly(picked);
      if (_startDate != null && _startDate!.isAfter(_endDate!)) {
        _startDate = _endDate;
      }
    });
  }

  Future<DateTime?> _pickDate({required DateTime initialDate}) {
    return showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
  }

  void _clearFilters() {
    setState(() {
      _startDate = null;
      _endDate = null;
    });
  }

  List<Checklist> _filterByPeriod(List<Checklist> checklists) {
    final start = _startDate;
    final endExclusive = _endDate?.add(const Duration(days: 1));

    return checklists
        .where((checklist) {
          final createdAt = checklist.createdAt.toLocal();
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
    final history = ref.watch(checklistHistoryProvider);

    return history.when(
      data: (checklists) {
        final filteredChecklists = _filterByPeriod(checklists);

        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            _HistoryFilters(
              startDate: _startDate,
              endDate: _endDate,
              onPickStart: _pickStartDate,
              onPickEnd: _pickEndDate,
              onClear: _clearFilters,
            ),
            const SizedBox(height: 12),
            if (checklists.isEmpty)
              const _EmptyHistory()
            else if (filteredChecklists.isEmpty)
              const _EmptyFilteredHistory()
            else
              for (final checklist in filteredChecklists)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _HistoryChecklistCard(
                    checklist: checklist,
                    onDetails: () => _showChecklistDetails(context, checklist),
                  ),
                ),
          ],
        );
      },
      error: (error, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text('Falha ao carregar historico: $error'),
        ),
      ),
      loading: () => const Center(child: CircularProgressIndicator()),
    );
  }

  void _showChecklistDetails(BuildContext context, Checklist checklist) {
    final answers = checklist.answers ?? const <String, dynamic>{};
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) {
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          children: [
            Text(
              'Detalhes do checklist',
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 10),
            _DetailLine(label: 'Placa', value: checklist.vehiclePlate ?? '-'),
            _DetailLine(label: 'KM', value: checklist.kmRegistered.toString()),
            _DetailLine(
              label: 'Data/Hora',
              value: _formatDateTime(checklist.createdAt),
            ),
            _DetailLine(
              label: 'Status',
              value: checklist.approvalStatus == 'approved'
                  ? 'Aprovado'
                  : 'Reprovado',
            ),
            if (checklist.driverName != null)
              _DetailLine(label: 'Motorista', value: checklist.driverName!),
            if (checklist.location?['display'] != null)
              _DetailLine(
                label: 'Localizacao',
                value: checklist.location!['display'].toString(),
              ),
            if (checklist.items.notes.isNotEmpty)
              _DetailLine(label: 'Observacoes', value: checklist.items.notes),
            const Divider(height: 24),
            for (final value in _historyAnswerItems(answers))
              if (value is Map)
                ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  title: Text(value['label']?.toString() ?? '-'),
                  subtitle: Text(value['section']?.toString() ?? ''),
                  trailing: Text(
                    value['answer']?.toString() ?? '-',
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
          ],
        );
      },
    );
  }
}

final class _HistoryFilters extends StatelessWidget {
  const _HistoryFilters({
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
              'Filtrar por periodo',
              style: Theme.of(
                context,
              ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                OutlinedButton.icon(
                  onPressed: onPickStart,
                  icon: const Icon(Icons.event_outlined),
                  label: Text(
                    startDate == null
                        ? 'Data inicial'
                        : _formatDate(startDate!),
                  ),
                ),
                OutlinedButton.icon(
                  onPressed: onPickEnd,
                  icon: const Icon(Icons.event_available_outlined),
                  label: Text(
                    endDate == null ? 'Data final' : _formatDate(endDate!),
                  ),
                ),
                if (hasFilters)
                  IconButton.outlined(
                    tooltip: 'Limpar filtros',
                    onPressed: onClear,
                    icon: const Icon(Icons.close),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

final class _HistoryChecklistCard extends StatelessWidget {
  const _HistoryChecklistCard({
    required this.checklist,
    required this.onDetails,
  });

  final Checklist checklist;
  final VoidCallback onDetails;

  @override
  Widget build(BuildContext context) {
    final approved = checklist.approvalStatus == 'approved';

    return Card(
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: approved ? Colors.black : Colors.white,
          foregroundColor: approved ? Colors.white : Colors.black,
          child: Icon(
            approved ? Icons.check_outlined : Icons.priority_high_outlined,
          ),
        ),
        title: Text(_historyChecklistTitle(checklist)),
        subtitle: Text(
          '${_formatDateTime(checklist.createdAt)} - '
          '${approved ? 'Aprovado' : 'Reprovado'}',
        ),
        trailing: IconButton(
          tooltip: 'Ver detalhes',
          onPressed: onDetails,
          icon: const Icon(Icons.visibility_outlined),
        ),
      ),
    );
  }
}

final class _DetailLine extends StatelessWidget {
  const _DetailLine({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 98,
            child: Text(
              label,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}

final class _EmptyHistory extends StatelessWidget {
  const _EmptyHistory();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(24),
        child: Text(
          'Nenhum checklist enviado por este usuario.',
          textAlign: TextAlign.center,
        ),
      ),
    );
  }
}

final class _EmptyFilteredHistory extends StatelessWidget {
  const _EmptyFilteredHistory();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(24),
        child: Text(
          'Nenhum checklist encontrado no periodo selecionado.',
          textAlign: TextAlign.center,
        ),
      ),
    );
  }
}

DateTime _dateOnly(DateTime dateTime) {
  return DateTime(dateTime.year, dateTime.month, dateTime.day);
}

String _formatDate(DateTime dateTime) {
  String two(int value) => value.toString().padLeft(2, '0');
  return '${two(dateTime.day)}/${two(dateTime.month)}/${dateTime.year}';
}

String _formatDateTime(DateTime dateTime) {
  String two(int value) => value.toString().padLeft(2, '0');
  return '${two(dateTime.day)}/${two(dateTime.month)}/${dateTime.year} '
      '${two(dateTime.hour)}:${two(dateTime.minute)}';
}

String _historyChecklistTitle(Checklist checklist) {
  return switch (checklist.type) {
    ChecklistType.vehicleDaily => checklist.vehiclePlate ?? 'Checklist Veiculo',
    ChecklistType.chainTensioner => 'Checklist Corrente/Tensionador',
    ChecklistType.strapRatchet => 'Checklist Cinta/Catraca',
    ChecklistType.departure => 'Checklist de saida',
    ChecklistType.arrival => 'Checklist de chegada',
  };
}

Iterable<dynamic> _historyAnswerItems(Map<String, dynamic> answers) {
  final items = answers['items'];
  if (items is Map) {
    return items.values;
  }
  return answers.values;
}

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:lucide_flutter/lucide_flutter.dart';

import '../../../core/errors/firebase_failure.dart';
import '../../media/application/media_providers.dart';
import '../../media/data/models/driver_media_type.dart';
import '../application/driver_equipment_providers.dart';
import '../data/models/driver_equipment_model.dart';

enum _EquipmentResult { ok, damaged, notFound, other }

extension on _EquipmentResult {
  String get label => switch (this) {
    _EquipmentResult.ok => 'Conforme',
    _EquipmentResult.damaged => 'Danificado',
    _EquipmentResult.notFound => 'Nao localizado',
    _EquipmentResult.other => 'Outro problema',
  };

  String get firestoreValue => switch (this) {
    _EquipmentResult.ok => 'ok',
    _EquipmentResult.damaged => 'damaged',
    _EquipmentResult.notFound => 'not_found',
    _EquipmentResult.other => 'divergence',
  };
}

final class DriverEquipmentPage extends ConsumerStatefulWidget {
  const DriverEquipmentPage({super.key});

  @override
  ConsumerState<DriverEquipmentPage> createState() => _DriverEquipmentPageState();
}

final class _DriverEquipmentPageState extends ConsumerState<DriverEquipmentPage> {
  final _results = <String, _EquipmentResult>{};
  final _notes = <String, TextEditingController>{};
  final _photos = <File>[];
  var _saving = false;

  @override
  void dispose() {
    for (final controller in _notes.values) {
      controller.dispose();
    }
    super.dispose();
  }

  TextEditingController _noteFor(String id) {
    return _notes.putIfAbsent(id, TextEditingController.new);
  }

  Future<void> _pickPhoto() async {
    final image = await ImagePicker().pickImage(
      source: ImageSource.camera,
      imageQuality: 82,
      maxWidth: 1920,
    );
    if (image == null || !mounted) {
      return;
    }
    setState(() => _photos.add(File(image.path)));
  }

  Future<void> _submit(List<DriverEquipment> equipment) async {
    if (equipment.isEmpty) {
      return;
    }
    final pending = equipment.where((item) => !_results.containsKey(item.id));
    if (pending.isNotEmpty) {
      _showMessage('Marque a situacao de todos os equipamentos.');
      return;
    }
    final problemWithoutNote = equipment.any((item) {
      final result = _results[item.id] ?? _EquipmentResult.ok;
      return result != _EquipmentResult.ok && _noteFor(item.id).text.trim().isEmpty;
    });
    if (problemWithoutNote) {
      _showMessage('Descreva os equipamentos com problema.');
      return;
    }

    setState(() => _saving = true);
    try {
      final id = await ref.read(driverEquipmentRepositoryProvider).saveDriverChecklist(
        equipment: equipment,
        results: {
          for (final item in equipment)
            item.id: {
              'result': (_results[item.id] ?? _EquipmentResult.ok).firestoreValue,
              'observation': _noteFor(item.id).text.trim(),
            },
        },
      );
      for (final photo in _photos) {
        await ref.read(mediaUploadServiceProvider).uploadOrQueueDriverImage(
          localFile: photo,
          mediaType: DriverMediaType.equipmentInspection,
          ownerEntityId: id,
        );
      }
      if (!mounted) {
        return;
      }
      _showMessage('Checklist de equipamentos enviado para analise.');
      Navigator.of(context).pop();
    } on FirebaseFailure catch (failure) {
      _showMessage(failure.message);
    } on Object {
      _showMessage('Nao foi possivel enviar o checklist agora.');
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  void _showMessage(String message) {
    if (!mounted) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    const allowedTypes = {
      DriverEquipmentType.strap,
      DriverEquipmentType.ratchet,
      DriverEquipmentType.chain,
      DriverEquipmentType.tensioner,
    };
    final equipmentState = ref.watch(availableDriverEquipmentProvider(allowedTypes));

    return equipmentState.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text('Nao foi possivel carregar os equipamentos.\n$error', textAlign: TextAlign.center),
        ),
      ),
      data: (equipment) {
        if (equipment.isEmpty) {
          return const _EmptyEquipment();
        }
        final vehiclePlate = equipment.first.vehiclePlate.isEmpty
            ? 'Veiculo associado'
            : equipment.first.vehiclePlate;
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
          children: [
            _VehicleHeader(
              plate: vehiclePlate,
              count: equipment.length,
            ),
            const SizedBox(height: 16),
            const _InfoCard(),
            const SizedBox(height: 18),
            for (final type in DriverEquipmentType.values) ...[
              if (equipment.any((item) => item.type == type))
                _EquipmentSection(
                  title: type.label,
                  equipment: equipment.where((item) => item.type == type).toList(),
                  results: _results,
                  noteFor: _noteFor,
                  onChanged: (id, result) => setState(() => _results[id] = result),
                ),
              const SizedBox(height: 14),
            ],
            _PhotoArea(
              photos: _photos,
              onAdd: _pickPhoto,
              onRemove: (index) => setState(() => _photos.removeAt(index)),
            ),
            const SizedBox(height: 18),
            FilledButton.icon(
              onPressed: _saving ? null : () => _submit(equipment),
              icon: _saving
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(LucideIcons.send),
              label: Text(_saving ? 'Enviando...' : 'Finalizar checklist'),
            ),
          ],
        );
      },
    );
  }
}

final class _VehicleHeader extends StatelessWidget {
  const _VehicleHeader({required this.plate, required this.count});

  final String plate;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1F1C1C),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: const Color(0xFFFACC15),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(LucideIcons.packageCheck, color: Color(0xFF111111)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Equipamentos do veiculo', style: TextStyle(color: Colors.white70)),
                const SizedBox(height: 3),
                Text(plate, style: const TextStyle(color: Colors.white, fontSize: 19, fontWeight: FontWeight.w800)),
              ],
            ),
          ),
          Text('$count itens', style: const TextStyle(color: Color(0xFFFACC15), fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }
}

final class _InfoCard extends StatelessWidget {
  const _InfoCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF9F9F9),
        border: Border.all(color: const Color(0xFFE3E3E3)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: const Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(LucideIcons.circleAlert, size: 20),
          SizedBox(width: 10),
          Expanded(child: Text('Confira somente os equipamentos listados abaixo. Caso encontre um problema, informe a situacao e descreva o ocorrido.')),
        ],
      ),
    );
  }
}

final class _EquipmentSection extends StatelessWidget {
  const _EquipmentSection({
    required this.title,
    required this.equipment,
    required this.results,
    required this.noteFor,
    required this.onChanged,
  });

  final String title;
  final List<DriverEquipment> equipment;
  final Map<String, _EquipmentResult> results;
  final TextEditingController Function(String id) noteFor;
  final void Function(String id, _EquipmentResult result) onChanged;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            for (final item in equipment)
              _EquipmentItem(
                equipment: item,
                result: results[item.id],
                noteController: noteFor(item.id),
                onChanged: (result) => onChanged(item.id, result),
              ),
          ],
        ),
      ),
    );
  }
}

final class _EquipmentItem extends StatelessWidget {
  const _EquipmentItem({
    required this.equipment,
    required this.result,
    required this.noteController,
    required this.onChanged,
  });

  final DriverEquipment equipment;
  final _EquipmentResult? result;
  final TextEditingController noteController;
  final ValueChanged<_EquipmentResult> onChanged;

  @override
  Widget build(BuildContext context) {
    final hasProblem = result != null && result != _EquipmentResult.ok;
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(LucideIcons.tag, size: 18),
              const SizedBox(width: 8),
              Text(equipment.tagNumber, style: const TextStyle(fontWeight: FontWeight.w800)),
            ],
          ),
          const SizedBox(height: 9),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final option in _EquipmentResult.values)
                ChoiceChip(
                  label: Text(option.label),
                  selected: result == option,
                  onSelected: (_) => onChanged(option),
                ),
            ],
          ),
          if (hasProblem) ...[
            const SizedBox(height: 10),
            TextFormField(
              controller: noteController,
              maxLines: 2,
              decoration: const InputDecoration(labelText: 'Descreva o problema'),
            ),
          ],
        ],
      ),
    );
  }
}

final class _PhotoArea extends StatelessWidget {
  const _PhotoArea({required this.photos, required this.onAdd, required this.onRemove});

  final List<File> photos;
  final VoidCallback onAdd;
  final ValueChanged<int> onRemove;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Fotos de evidencia', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            const Text('Opcional. As fotos serao enviadas quando houver conexao.'),
            const SizedBox(height: 12),
            OutlinedButton.icon(onPressed: onAdd, icon: const Icon(LucideIcons.camera), label: const Text('Adicionar foto')),
            if (photos.isNotEmpty) ...[
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (var index = 0; index < photos.length; index++)
                    Stack(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: Image.file(photos[index], width: 72, height: 72, fit: BoxFit.cover),
                        ),
                        Positioned(
                          right: -6,
                          top: -6,
                          child: IconButton.filled(
                            iconSize: 15,
                            onPressed: () => onRemove(index),
                            icon: const Icon(Icons.close),
                          ),
                        ),
                      ],
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

final class _EmptyEquipment extends StatelessWidget {
  const _EmptyEquipment();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(28),
        child: Text('Nenhum equipamento esta atribuido ao seu veiculo neste momento.', textAlign: TextAlign.center),
      ),
    );
  }
}

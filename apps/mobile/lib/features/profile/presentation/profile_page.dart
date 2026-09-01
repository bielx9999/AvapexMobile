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
import '../../users/data/models/app_user_model.dart';
import '../../vehicles/data/models/vehicle_model.dart';

final _profileVehiclesProvider = StreamProvider<List<Vehicle>>((ref) {
  final uid = ref.watch(firebaseAuthProvider).currentUser?.uid;
  if (uid == null || uid.isEmpty) {
    return const Stream<List<Vehicle>>.empty();
  }
  final tripVehicleIds =
      ref
          .watch(currentDriverTripsProvider)
          .asData
          ?.value
          .map((trip) => trip.vehicleId)
          .where((vehicleId) => vehicleId.isNotEmpty)
          .toSet() ??
      const <String>{};
  return ref
      .watch(vehicleRepositoryProvider)
      .watchVehiclesForDriver(uid, extraVehicleIds: tripVehicleIds);
});

final class ProfilePage extends ConsumerStatefulWidget {
  const ProfilePage({super.key});

  @override
  ConsumerState<ProfilePage> createState() => _ProfilePageState();
}

final class _ProfilePageState extends ConsumerState<ProfilePage> {
  final _formKey = GlobalKey<FormState>();
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _imagePicker = ImagePicker();

  String? _loadedUserId;
  String? _photoUrl;
  File? _selectedPhoto;
  var _isSaving = false;
  String? _errorMessage;

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    super.dispose();
  }

  void _syncUser(AppUser? user) {
    if (user == null || _loadedUserId == user.uid) {
      return;
    }

    final parts = user.name.trim().split(RegExp(r'\s+'));
    _firstNameController.text = parts.isEmpty ? '' : parts.first;
    _lastNameController.text = parts.length <= 1 ? '' : parts.skip(1).join(' ');
    _photoUrl = user.photoUrl;
    _selectedPhoto = null;
    _loadedUserId = user.uid;
  }

  Future<void> _pickPhoto(ImageSource source) async {
    setState(() => _errorMessage = null);

    try {
      final picked = await _imagePicker.pickImage(
        source: source,
        imageQuality: 86,
        maxWidth: 1200,
        maxHeight: 1200,
      );
      if (picked == null) {
        return;
      }
      setState(() => _selectedPhoto = File(picked.path));
    } on PlatformException catch (error) {
      setState(
        () => _errorMessage =
            'Nao foi possivel acessar ${source == ImageSource.camera ? 'a camera' : 'a galeria'}: ${error.message ?? error.code}.',
      );
    }
  }

  Future<void> _save(AppUser user) async {
    final form = _formKey.currentState;
    setState(() => _errorMessage = null);

    if (form == null || !form.validate()) {
      return;
    }

    final fullName =
        '${_firstNameController.text.trim()} ${_lastNameController.text.trim()}'
            .trim();

    setState(() => _isSaving = true);

    try {
      var uploadedPhotoUrl = _photoUrl;
      final selectedPhoto = _selectedPhoto;
      if (selectedPhoto != null) {
        uploadedPhotoUrl = await ref
            .read(mediaUploadServiceProvider)
            .uploadDriverImage(
              localFile: selectedPhoto,
              mediaType: DriverMediaType.profile,
              ownerEntityId: user.uid,
              quality: 84,
              maxWidth: 900,
              maxHeight: 900,
            );
      }

      await ref
          .read(userRepositoryProvider)
          .updateCurrentUserProfile(name: fullName, photoUrl: uploadedPhotoUrl);

      if (!mounted) {
        return;
      }

      setState(() {
        _photoUrl = uploadedPhotoUrl;
        _selectedPhoto = null;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Perfil atualizado com sucesso.')),
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

  Future<void> _sendPasswordReset(AppUser user) async {
    try {
      await ref.read(authRepositoryProvider).sendPasswordResetEmail(user.email);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Enviamos as instrucoes de senha para o seu email.'),
          ),
        );
      }
    } on FirebaseFailure catch (failure) {
      if (mounted) {
        setState(() => _errorMessage = failure.message);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final profile = ref.watch(currentUserProfileProvider);
    final trips =
        ref.watch(currentDriverTripsProvider).asData?.value ?? const <Trip>[];
    final vehicles =
        ref.watch(_profileVehiclesProvider).asData?.value ?? const <Vehicle>[];

    return profile.when(
      data: (user) {
        _syncUser(user);
        if (user == null) {
          return const Center(child: Text('Perfil indisponivel.'));
        }

        return Form(
          key: _formKey,
          child: ListView(
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: [
              Text(
                'Meu perfil',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 4),
              const Text('Seus dados de motorista'),
              const SizedBox(height: 16),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Center(
                        child: _EditableAvatar(
                          photoUrl: _photoUrl,
                          selectedPhoto: _selectedPhoto,
                        ),
                      ),
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: _isSaving
                                  ? null
                                  : () => _pickPhoto(ImageSource.camera),
                              icon: const Icon(Icons.photo_camera_outlined),
                              label: const Text('Tirar foto'),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: _isSaving
                                  ? null
                                  : () => _pickPhoto(ImageSource.gallery),
                              icon: const Icon(Icons.upload_file_outlined),
                              label: const Text('Enviar foto'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        'Dados do usuario',
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _firstNameController,
                        textCapitalization: TextCapitalization.words,
                        decoration: const InputDecoration(
                          labelText: 'Nome',
                          prefixIcon: Icon(Icons.person_outline),
                        ),
                        validator: _requiredName,
                      ),
                      const SizedBox(height: 10),
                      TextFormField(
                        controller: _lastNameController,
                        textCapitalization: TextCapitalization.words,
                        decoration: const InputDecoration(
                          labelText: 'Sobrenome',
                          prefixIcon: Icon(Icons.person_outline),
                        ),
                        validator: _requiredName,
                      ),
                      const SizedBox(height: 10),
                      _InfoRow(
                        icon: Icons.mail_outline,
                        label: 'Email',
                        value: user.email,
                      ),
                      _InfoRow(
                        icon: Icons.phone_outlined,
                        label: 'Telefone',
                        value: user.phone,
                      ),
                      _InfoRow(
                        icon: Icons.badge_outlined,
                        label: 'CNH',
                        value: user.cnh?.number ?? '',
                      ),
                      _InfoRow(
                        icon: Icons.drive_eta_outlined,
                        label: 'Categoria',
                        value: user.cnh?.category ?? '',
                      ),
                      _InfoRow(
                        icon: Icons.event_outlined,
                        label: 'Validade da CNH',
                        value: user.cnh == null
                            ? ''
                            : _formatDate(user.cnh!.expirationDate),
                      ),
                      _InfoRow(
                        icon: Icons.local_shipping_outlined,
                        label: 'Veiculo atual',
                        value: _currentVehicleText(user, trips, vehicles),
                      ),
                    ],
                  ),
                ),
              ),
              if (_errorMessage != null) ...[
                const SizedBox(height: 12),
                _ErrorBox(message: _errorMessage!),
              ],
              const SizedBox(height: 18),
              FilledButton.icon(
                onPressed: _isSaving ? null : () => _save(user),
                icon: _isSaving
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.save_outlined),
                label: Text(_isSaving ? 'Salvando...' : 'Salvar perfil'),
              ),
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: _isSaving ? null : () => _sendPasswordReset(user),
                icon: const Icon(Icons.lock_reset_outlined),
                label: const Text('Alterar senha'),
              ),
              const SizedBox(height: 10),
              TextButton.icon(
                onPressed: _isSaving
                    ? null
                    : () => ref.read(authRepositoryProvider).signOut(),
                icon: const Icon(Icons.logout),
                label: const Text('Sair do aplicativo'),
              ),
            ],
          ),
        );
      },
      error: (error, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text('Falha ao carregar perfil: $error'),
        ),
      ),
      loading: () => const Center(child: CircularProgressIndicator()),
    );
  }
}

final class _EditableAvatar extends StatelessWidget {
  const _EditableAvatar({required this.photoUrl, required this.selectedPhoto});

  final String? photoUrl;
  final File? selectedPhoto;

  @override
  Widget build(BuildContext context) {
    final image = selectedPhoto != null
        ? FileImage(selectedPhoto!)
        : photoUrl == null || photoUrl!.isEmpty
        ? null
        : NetworkImage(photoUrl!) as ImageProvider;

    return CircleAvatar(
      radius: 58,
      backgroundColor: Colors.black,
      foregroundImage: image,
      child: image == null
          ? const Icon(Icons.person_outline, color: Colors.white, size: 52)
          : null,
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
      padding: const EdgeInsets.only(top: 10),
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
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700),
                ),
                Text(
                  value.isEmpty ? 'indisponivel' : value,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
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
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
    );
  }
}

String? _requiredName(String? value) {
  final text = (value ?? '').trim();
  if (text.isEmpty) {
    return 'Campo obrigatorio.';
  }
  if (text.length < 2) {
    return 'Informe ao menos 2 caracteres.';
  }
  return null;
}

String _formatDate(DateTime value) {
  final local = value.toLocal();
  final day = local.day.toString().padLeft(2, '0');
  final month = local.month.toString().padLeft(2, '0');
  return '$day/$month/${local.year}';
}

String _currentVehicleText(
  AppUser user,
  List<Trip> trips,
  List<Vehicle> vehicles,
) {
  final linkedVehicle = _firstVehicleWhere(
    vehicles,
    (vehicle) => vehicle.currentDriverId == user.uid,
  );
  if (linkedVehicle != null) {
    return _vehicleText(linkedVehicle);
  }

  final trip = _selectCurrentVehicleTrip(trips);
  if (trip != null) {
    final tripVehicle = _firstVehicleWhere(
      vehicles,
      (vehicle) => vehicle.id == trip.vehicleId,
    );
    if (tripVehicle != null) {
      return _vehicleText(tripVehicle);
    }
    return [
      trip.vehiclePlate,
      trip.vehicleModel,
    ].where((value) => value.trim().isNotEmpty).join(' - ');
  }

  return '';
}

Trip? _selectCurrentVehicleTrip(List<Trip> trips) {
  final inProgress =
      trips
          .where(
            (trip) =>
                trip.status == TripStatus.inProgress &&
                trip.vehicleId.isNotEmpty,
          )
          .toList()
        ..sort((a, b) => _tripDate(b).compareTo(_tripDate(a)));
  if (inProgress.isNotEmpty) {
    return inProgress.first;
  }

  final assignedOrAccepted =
      trips
          .where(
            (trip) =>
                trip.vehicleId.isNotEmpty &&
                trip.status == TripStatus.pending &&
                trip.driverResponse != DriverTripResponse.rejected,
          )
          .toList()
        ..sort((a, b) => _tripDate(a).compareTo(_tripDate(b)));
  if (assignedOrAccepted.isNotEmpty) {
    return assignedOrAccepted.first;
  }

  return null;
}

DateTime _tripDate(Trip trip) {
  return trip.startedAt ?? trip.assignedAt ?? trip.scheduledAt;
}

Vehicle? _firstVehicleWhere(
  List<Vehicle> vehicles,
  bool Function(Vehicle vehicle) test,
) {
  for (final vehicle in vehicles) {
    if (test(vehicle)) {
      return vehicle;
    }
  }
  return null;
}

String _vehicleText(Vehicle vehicle) {
  return [
    vehicle.plate,
    vehicle.model,
  ].where((value) => value.trim().isNotEmpty).join(' - ');
}

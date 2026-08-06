import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/firebase_providers.dart';
import '../../../core/navigation/app_shell.dart';
import '../application/auth_providers.dart';
import '../../users/application/user_providers.dart';
import '../../users/data/models/app_user_model.dart';
import 'login_page.dart';

final class AuthGate extends ConsumerWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authStateProvider);

    return authState.when(
      data: (user) {
        if (user == null) {
          return const LoginPage();
        }

        final profileState = ref.watch(currentUserProfileProvider);
        return profileState.when(
          data: (profile) {
            if (profile == null) {
              return const _BlockedAccessPage(
                message:
                    'Seu cadastro ainda nao foi liberado pelo administrativo.',
              );
            }
            if (profile.status == UserStatus.inactive) {
              return const _BlockedAccessPage(
                message:
                    'Seu acesso esta bloqueado. Procure o administrativo da Avapex.',
              );
            }
            if (profile.role != UserRole.driver) {
              return const _BlockedAccessPage(
                message:
                    'Este aplicativo e exclusivo para motoristas. Use o painel administrativo para continuar.',
              );
            }
            return const AppShell();
          },
          error: (error, _) => Scaffold(
            body: Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text('Falha ao carregar perfil: $error'),
              ),
            ),
          ),
          loading: () =>
              const Scaffold(body: Center(child: CircularProgressIndicator())),
        );
      },
      error: (error, _) => Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text('Falha ao validar autenticacao: $error'),
          ),
        ),
      ),
      loading: () =>
          const Scaffold(body: Center(child: CircularProgressIndicator())),
    );
  }
}

final class _BlockedAccessPage extends ConsumerWidget {
  const _BlockedAccessPage({required this.message});

  final String message;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: const Color(0xFF211D1D),
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(Icons.lock, color: Colors.white, size: 56),
                const SizedBox(height: 20),
                Text(
                  message,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 24),
                FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: Colors.black,
                    minimumSize: const Size.fromHeight(52),
                  ),
                  onPressed: () => ref.read(authRepositoryProvider).signOut(),
                  child: const Text('Sair'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';

abstract final class AppTheme {
  static ThemeData light() {
    const black = Color(0xFF111111);
    const nearBlack = Color(0xFF1F1C1C);
    const border = Color(0xFFD9D9D9);
    const background = Color(0xFFF7F7F7);

    return ThemeData(
      useMaterial3: true,
      colorScheme:
          ColorScheme.fromSeed(
            seedColor: black,
            brightness: Brightness.light,
          ).copyWith(
            primary: black,
            onPrimary: Colors.white,
            primaryContainer: nearBlack,
            onPrimaryContainer: Colors.white,
            secondary: black,
            onSecondary: Colors.white,
            surface: Colors.white,
            onSurface: black,
            outline: const Color(0xFF6F6F6F),
          ),
      scaffoldBackgroundColor: background,
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.white,
        foregroundColor: black,
        surfaceTintColor: Colors.white,
        elevation: 0,
      ),
      iconTheme: const IconThemeData(color: black),
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: black, width: 1.4),
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: const BorderSide(color: border),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: black,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: black,
          side: const BorderSide(color: black),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
      ),
      checkboxTheme: CheckboxThemeData(
        fillColor: WidgetStateProperty.resolveWith((states) {
          return states.contains(WidgetState.selected) ? black : Colors.white;
        }),
        checkColor: const WidgetStatePropertyAll(Colors.white),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((states) {
          return states.contains(WidgetState.selected) ? Colors.white : black;
        }),
        trackColor: WidgetStateProperty.resolveWith((states) {
          return states.contains(WidgetState.selected)
              ? black
              : const Color(0xFFE6E6E6);
        }),
      ),
    );
  }
}

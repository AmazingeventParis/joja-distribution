import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';

// ============================================================
// POINT D'ENTRÉE DE L'APPLICATION
// Initialise Supabase puis lance l'app
// ============================================================

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialiser Supabase avec vos clés
  // (remplacez par vos vraies valeurs ou utilisez un fichier .env)
  await Supabase.initialize(
    url: const String.fromEnvironment(
      'SUPABASE_URL',
      defaultValue: 'https://bpxsodccsochwltzilqr.supabase.co',
    ),
    anonKey: const String.fromEnvironment(
      'SUPABASE_ANON_KEY',
      defaultValue: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJweHNvZGNjc29jaHdsdHppbHFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NzU3MDksImV4cCI6MjA4NzQ1MTcwOX0.TmX_5dUOCm3deQrFmw9thrwIe8hprocRkOoMj5IP1AA',
    ),
  );

  runApp(const JojaApp());
}

// Raccourci pour accéder au client Supabase partout
final supabase = Supabase.instance.client;

class JojaApp extends StatelessWidget {
  const JojaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'JOJA Distribution',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorSchemeSeed: const Color(0xFF1E40AF),
        useMaterial3: true,
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF1E40AF),
          foregroundColor: Colors.white,
          centerTitle: true,
        ),
      ),
      // Si l'utilisateur est déjà connecté, aller à l'accueil
      // Sinon, afficher la page de login
      home: supabase.auth.currentSession != null
          ? const HomeScreen()
          : const LoginScreen(),
    );
  }
}

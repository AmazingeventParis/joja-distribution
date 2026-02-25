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
      defaultValue: 'https://supabase-api.swipego.app',
    ),
    anonKey: const String.fromEnvironment(
      'SUPABASE_ANON_KEY',
      defaultValue: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc3MTI3NDIyMCwiZXhwIjo0OTI2OTQ3ODIwLCJyb2xlIjoiYW5vbiJ9.4c5wruvy-jj3M8fSjhmgR4FvdF6za-mgawlkB_B0uB0',
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

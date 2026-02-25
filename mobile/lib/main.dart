import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'services/api_service.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';

// ============================================================
// POINT D'ENTREE DE L'APPLICATION
// Initialise SharedPreferences puis lance l'app
// Verifie si un token existe pour choisir l'ecran initial
// ============================================================

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialiser SharedPreferences (necessaire pour ApiService)
  await SharedPreferences.getInstance();

  // Verifier si l'utilisateur est deja connecte
  final isLoggedIn = await ApiService.isLoggedIn();

  runApp(JojaApp(isLoggedIn: isLoggedIn));
}

class JojaApp extends StatelessWidget {
  final bool isLoggedIn;

  const JojaApp({super.key, required this.isLoggedIn});

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
      home: isLoggedIn ? const HomeScreen() : const LoginScreen(),
    );
  }
}

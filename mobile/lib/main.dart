import 'dart:io';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:http/io_client.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';

// ============================================================
// POINT D'ENTREE DE L'APPLICATION
// Initialise Supabase puis lance l'app
// ============================================================

// Client HTTP qui redirige les requetes vers l'IP du serveur
// pour contourner les problemes DNS sur certains telephones mobiles.
// Le header Host est preserve pour que Traefik route correctement.
class SupabaseIpClient extends http.BaseClient {
  static const String _serverIp = '217.182.89.133';
  static const String _serverHost = 'supabase-api.swipego.app';

  final IOClient _client;

  SupabaseIpClient()
      : _client = IOClient(
          HttpClient()
            ..badCertificateCallback =
                (X509Certificate cert, String host, int port) =>
                    host == _serverIp,
        );

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) {
    if (request.url.host == _serverHost) {
      final ipUrl = request.url.replace(host: _serverIp);
      final newRequest = _rewrite(request, ipUrl);
      return _client.send(newRequest);
    }
    return _client.send(request);
  }

  http.BaseRequest _rewrite(http.BaseRequest original, Uri newUri) {
    if (original is http.Request) {
      final r = http.Request(original.method, newUri)
        ..headers.addAll(original.headers)
        ..bodyBytes = original.bodyBytes;
      r.headers['host'] = _serverHost;
      return r;
    }
    if (original is http.MultipartRequest) {
      final r = http.MultipartRequest(original.method, newUri)
        ..headers.addAll(original.headers)
        ..fields.addAll(original.fields)
        ..files.addAll(original.files);
      r.headers['host'] = _serverHost;
      return r;
    }
    original.headers['host'] = _serverHost;
    return original;
  }

  @override
  void close() {
    _client.close();
  }
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialiser Supabase avec le client HTTP custom (bypass DNS)
  await Supabase.initialize(
    url: const String.fromEnvironment(
      'SUPABASE_URL',
      defaultValue: 'https://supabase-api.swipego.app',
    ),
    anonKey: const String.fromEnvironment(
      'SUPABASE_ANON_KEY',
      defaultValue: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc3MTI3NDIyMCwiZXhwIjo0OTI2OTQ3ODIwLCJyb2xlIjoiYW5vbiJ9.4c5wruvy-jj3M8fSjhmgR4FvdF6za-mgawlkB_B0uB0',
    ),
    httpClient: SupabaseIpClient(),
  );

  runApp(const JojaApp());
}

// Raccourci pour acceder au client Supabase partout
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
      home: supabase.auth.currentSession != null
          ? const HomeScreen()
          : const LoginScreen(),
    );
  }
}

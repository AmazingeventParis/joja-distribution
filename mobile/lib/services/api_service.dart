import 'dart:convert';
import 'dart:typed_data';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

// ============================================================
// SERVICE API CENTRAL
// Client HTTP pour communiquer avec le backend Next.js REST API
// Gere l'authentification par token Bearer
// ============================================================

class ApiService {
  static const String baseUrl = 'https://joja.swipego.app/api';

  // Cles SharedPreferences
  static const String _tokenKey = 'joja_token';
  static const String _userIdKey = 'joja_user_id';
  static const String _userEmailKey = 'joja_user_email';
  static const String _userNameKey = 'joja_user_name';
  static const String _userRoleKey = 'joja_user_role';

  // --- AUTHENTIFICATION ---

  /// Connexion par email + mot de passe
  /// Sauvegarde le token et les infos utilisateur dans SharedPreferences
  static Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'password': password}),
    );

    if (response.statusCode != 200) {
      final body = jsonDecode(response.body);
      throw Exception(body['error'] ?? 'Erreur de connexion');
    }

    final data = jsonDecode(response.body);
    final token = data['token'] as String;
    final user = data['user'] as Map<String, dynamic>;

    // Sauvegarder en local
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
    await prefs.setString(_userIdKey, user['id'].toString());
    await prefs.setString(_userEmailKey, user['email'] ?? '');
    await prefs.setString(_userNameKey, user['name'] ?? '');
    await prefs.setString(_userRoleKey, user['role'] ?? '');

    return data;
  }

  /// Deconnexion : supprime le token et les infos locales
  static Future<void> logout() async {
    // Appeler l'API logout (best effort)
    try {
      final token = await getToken();
      if (token != null) {
        await http.post(
          Uri.parse('$baseUrl/auth/logout'),
          headers: _authHeaders(token),
        );
      }
    } catch (_) {
      // Ignorer les erreurs reseau lors de la deconnexion
    }

    // Toujours nettoyer le stockage local
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_userIdKey);
    await prefs.remove(_userEmailKey);
    await prefs.remove(_userNameKey);
    await prefs.remove(_userRoleKey);
  }

  /// Verifier si un token existe en local
  static Future<bool> isLoggedIn() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString(_tokenKey);
    return token != null && token.isNotEmpty;
  }

  /// Recuperer le token JWT
  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_tokenKey);
  }

  /// Recuperer l'ID de l'utilisateur connecte
  static Future<String?> getUserId() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_userIdKey);
  }

  /// Recuperer le nom de l'utilisateur connecte
  static Future<String?> getUserName() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_userNameKey);
  }

  /// Recuperer les infos utilisateur depuis l'API (GET /api/auth/me)
  static Future<Map<String, dynamic>> getMe() async {
    final token = await _requireToken();
    final response = await http.get(
      Uri.parse('$baseUrl/auth/me'),
      headers: _authHeaders(token),
    );

    if (response.statusCode != 200) {
      throw Exception('Non authentifie');
    }

    return jsonDecode(response.body);
  }

  // --- CLIENTS ---

  /// Recuperer la liste de tous les clients
  static Future<List<Map<String, dynamic>>> getClients() async {
    final token = await _requireToken();
    final response = await http.get(
      Uri.parse('$baseUrl/clients'),
      headers: _authHeaders(token),
    );

    if (response.statusCode != 200) {
      throw Exception('Erreur lors du chargement des clients');
    }

    final data = jsonDecode(response.body) as List;
    return data.cast<Map<String, dynamic>>();
  }

  // --- BONS DE LIVRAISON ---

  /// Creer un nouveau bon de livraison
  static Future<Map<String, dynamic>> createDeliveryNote({
    required String clientName,
    String? clientEmail,
    required String address,
    String? details,
    String? signaturePath,
  }) async {
    final token = await _requireToken();
    final response = await http.post(
      Uri.parse('$baseUrl/delivery-notes'),
      headers: {
        ..._authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'client_name': clientName,
        'client_email': clientEmail,
        'address': address,
        'details': details,
        'signature_path': signaturePath,
      }),
    );

    if (response.statusCode != 201) {
      final body = jsonDecode(response.body);
      throw Exception(body['error'] ?? 'Erreur lors de la creation du BDL');
    }

    final data = jsonDecode(response.body);
    return data['delivery_note'] as Map<String, dynamic>;
  }

  /// Mettre a jour un bon de livraison (PATCH)
  static Future<Map<String, dynamic>> updateDeliveryNote(
    String id,
    Map<String, dynamic> fields,
  ) async {
    final token = await _requireToken();
    final response = await http.patch(
      Uri.parse('$baseUrl/delivery-notes/$id'),
      headers: {
        ..._authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: jsonEncode(fields),
    );

    if (response.statusCode != 200) {
      final body = jsonDecode(response.body);
      throw Exception(body['error'] ?? 'Erreur lors de la mise a jour du BDL');
    }

    final data = jsonDecode(response.body);
    return data['delivery_note'] as Map<String, dynamic>;
  }

  /// Recuperer les BDL du livreur connecte
  static Future<List<Map<String, dynamic>>> getMyDeliveryNotes() async {
    final token = await _requireToken();
    final userId = await getUserId();

    final response = await http.get(
      Uri.parse('$baseUrl/delivery-notes?driver_id=$userId'),
      headers: _authHeaders(token),
    );

    if (response.statusCode != 200) {
      throw Exception('Erreur lors du chargement des BDL');
    }

    final data = jsonDecode(response.body) as List;
    return data.cast<Map<String, dynamic>>();
  }

  // --- FICHIERS ---

  /// Uploader une signature (PNG bytes) vers le serveur
  /// Retourne le nom du fichier sauvegarde
  static Future<String> uploadSignature(Uint8List pngBytes) async {
    final token = await _requireToken();

    final request = http.MultipartRequest(
      'POST',
      Uri.parse('$baseUrl/files/upload'),
    );

    request.headers.addAll(_authHeaders(token));
    request.fields['bucket'] = 'signatures';
    request.files.add(http.MultipartFile.fromBytes(
      'file',
      pngBytes,
      filename: 'signature.png',
    ));

    final streamedResponse = await request.send();
    final response = await http.Response.fromStream(streamedResponse);

    if (response.statusCode != 201) {
      final body = jsonDecode(response.body);
      throw Exception(body['error'] ?? 'Erreur lors de l\'upload de la signature');
    }

    final data = jsonDecode(response.body);
    return data['path'] as String;
  }

  /// Generer le PDF et envoyer l'email pour un BDL
  static Future<Map<String, dynamic>> generatePdf(String deliveryNoteId) async {
    final token = await _requireToken();
    final response = await http.post(
      Uri.parse('$baseUrl/generate-pdf'),
      headers: {
        ..._authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: jsonEncode({'delivery_note_id': deliveryNoteId}),
    );

    if (response.statusCode != 200) {
      final body = jsonDecode(response.body);
      throw Exception(body['error'] ?? 'Erreur lors de la generation du PDF');
    }

    return jsonDecode(response.body);
  }

  /// Construire l'URL d'un fichier avec le token en query param
  /// Utilise pour ouvrir les fichiers dans le navigateur
  static Future<String> getFileUrl(String bucket, String filename) async {
    final token = await _requireToken();
    // Le token est passe en query param pour que url_launcher puisse y acceder
    return '$baseUrl/files/$bucket/$filename?token=$token';
  }

  /// Construire l'URL de telechargement d'un PDF
  static Future<String> getPdfDownloadUrl(String pdfPath) async {
    return getFileUrl('pdfs', pdfPath);
  }

  // --- HELPERS PRIVES ---

  /// Construire les headers d'authentification
  static Map<String, String> _authHeaders(String token) {
    return {
      'Authorization': 'Bearer $token',
    };
  }

  /// Recuperer le token ou lancer une exception
  static Future<String> _requireToken() async {
    final token = await getToken();
    if (token == null || token.isEmpty) {
      throw Exception('Non authentifie');
    }
    return token;
  }
}

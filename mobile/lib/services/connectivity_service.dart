import 'package:connectivity_plus/connectivity_plus.dart';

// ============================================================
// SERVICE DE CONNECTIVITÉ
// Vérifie si l'appareil a une connexion internet
// ============================================================

class ConnectivityService {
  /// Retourne true si connecté à internet
  static Future<bool> isConnected() async {
    final results = await Connectivity().checkConnectivity();
    // Si la liste contient "none", pas de connexion
    return !results.contains(ConnectivityResult.none);
  }
}

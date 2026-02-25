import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/api_service.dart';
import '../services/connectivity_service.dart';

// ============================================================
// ECRAN HISTORIQUE DES BDL (LIVREUR)
// Liste de ses bons de livraison avec statut email
// Clic = detail + telechargement PDF
// ============================================================

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  List<Map<String, dynamic>> _bdls = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadBdls();
  }

  // Charger les BDL du livreur connecte
  Future<void> _loadBdls() async {
    if (!await ConnectivityService.isConnected()) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Connexion requise.'),
            backgroundColor: Colors.red,
          ),
        );
      }
      setState(() => _loading = false);
      return;
    }

    try {
      final bdls = await ApiService.getMyDeliveryNotes();
      setState(() {
        _bdls = bdls;
        _loading = false;
      });
    } catch (e) {
      debugPrint('Erreur chargement BDL: $e');
      setState(() => _loading = false);
    }
  }

  // Couleur du badge de statut
  Color _statusColor(String status) {
    switch (status) {
      case 'EMAIL_SENT':
        return Colors.green;
      case 'EMAIL_FAILED':
        return Colors.red;
      default:
        return Colors.orange;
    }
  }

  // Libelle du statut
  String _statusLabel(String status) {
    switch (status) {
      case 'EMAIL_SENT':
        return 'Email envoye';
      case 'EMAIL_FAILED':
        return 'Email echoue';
      default:
        return 'Valide';
    }
  }

  // Ouvrir le PDF via URL avec token
  Future<void> _downloadPdf(Map<String, dynamic> bdl) async {
    final pdfPath = bdl['pdf_path'];
    if (pdfPath == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Aucun PDF disponible pour ce BDL.'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    try {
      // Construire l'URL avec le token pour l'authentification
      final url = await ApiService.getPdfDownloadUrl(pdfPath);
      await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erreur : $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Historique BDL'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _bdls.isEmpty
              ? const Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.inbox, size: 64, color: Colors.grey),
                      SizedBox(height: 16),
                      Text(
                        'Aucun bon de livraison',
                        style: TextStyle(fontSize: 18, color: Colors.grey),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () async {
                    setState(() => _loading = true);
                    await _loadBdls();
                  },
                  child: ListView.builder(
                    padding: const EdgeInsets.all(12),
                    itemCount: _bdls.length,
                    itemBuilder: (context, index) {
                      final bdl = _bdls[index];
                      final statusColor = _statusColor(bdl['status']);
                      final validatedAt = DateTime.parse(bdl['validated_at']);

                      return Card(
                        margin: const EdgeInsets.only(bottom: 10),
                        elevation: 2,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(10),
                          onTap: () => _showDetail(bdl),
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Row(
                              children: [
                                // Icone statut
                                Container(
                                  width: 44,
                                  height: 44,
                                  decoration: BoxDecoration(
                                    color: statusColor.withAlpha(25),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Icon(
                                    Icons.description,
                                    color: statusColor,
                                  ),
                                ),
                                const SizedBox(width: 12),

                                // Infos
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        bdl['bdl_number'] ?? '',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 15,
                                          color: Color(0xFF1E40AF),
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        bdl['client_name'] ?? '',
                                        style: const TextStyle(fontSize: 14),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        '${validatedAt.day}/${validatedAt.month}/${validatedAt.year}',
                                        style: const TextStyle(
                                          fontSize: 12,
                                          color: Colors.grey,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),

                                // Badge statut
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 4,
                                  ),
                                  decoration: BoxDecoration(
                                    color: statusColor.withAlpha(25),
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: Text(
                                    _statusLabel(bdl['status']),
                                    style: TextStyle(
                                      color: statusColor,
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
    );
  }

  // Afficher le detail d'un BDL dans un bottom sheet
  void _showDetail(Map<String, dynamic> bdl) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        minChildSize: 0.4,
        maxChildSize: 0.9,
        expand: false,
        builder: (_, scrollController) => SingleChildScrollView(
          controller: scrollController,
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Barre de poignee
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 20),

              // Numero BDL
              Text(
                bdl['bdl_number'] ?? '',
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF1E40AF),
                ),
              ),
              const SizedBox(height: 16),

              _detailRow('Client', bdl['client_name']),
              _detailRow('Email', bdl['client_email'] ?? 'Non renseigne'),
              _detailRow('Adresse', bdl['address']),
              const SizedBox(height: 12),

              const Text(
                'Details livraison',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                  color: Colors.grey,
                ),
              ),
              const SizedBox(height: 4),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(bdl['details'] ?? ''),
              ),
              const SizedBox(height: 16),

              _detailRow('Statut', _statusLabel(bdl['status'])),
              const SizedBox(height: 24),

              // Bouton telecharger PDF
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton.icon(
                  onPressed: () => _downloadPdf(bdl),
                  icon: const Icon(Icons.picture_as_pdf),
                  label: const Text(
                    'TELECHARGER LE PDF',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2563EB),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // Widget helper : ligne de detail
  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 80,
            child: Text(
              label,
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 13,
                color: Colors.grey,
              ),
            ),
          ),
          Expanded(
            child: Text(value, style: const TextStyle(fontSize: 15)),
          ),
        ],
      ),
    );
  }
}

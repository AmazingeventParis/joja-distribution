import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import 'package:hand_signature/signature.dart';
import '../services/api_service.dart';
import '../services/connectivity_service.dart';

// ============================================================
// ECRAN CREATION D'UN BON DE LIVRAISON
// Champs : client, email, adresse, details (+ dictee vocale),
//          signature canvas, bouton VALIDER
// ============================================================

class CreateBdlScreen extends StatefulWidget {
  const CreateBdlScreen({super.key});

  @override
  State<CreateBdlScreen> createState() => _CreateBdlScreenState();
}

class _CreateBdlScreenState extends State<CreateBdlScreen> {
  // Controleurs des champs de texte
  final _clientController = TextEditingController();
  final _emailController = TextEditingController();
  final _addressController = TextEditingController();
  final _detailsController = TextEditingController();

  // Liste des clients pour l'autocompletion
  List<Map<String, dynamic>> _clients = [];

  // Signature
  final _signatureControl = HandSignatureControl(
    threshold: 3.0,
    smoothRatio: 0.65,
    velocityRange: 2.0,
  );

  // Speech-to-text
  final _speech = stt.SpeechToText();
  bool _isListening = false;

  // Etat
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _loadClients();
  }

  // Charger les clients depuis l'API pour l'autocompletion
  Future<void> _loadClients() async {
    try {
      final clients = await ApiService.getClients();
      if (mounted) {
        setState(() {
          _clients = clients;
        });
      }
    } catch (e) {
      // Silencieux : l'autocompletion ne sera pas disponible
      debugPrint('Erreur chargement clients: $e');
    }
  }

  // Valider le formulaire et envoyer
  Future<void> _validate() async {
    // Verifier la connexion internet
    if (!await ConnectivityService.isConnected()) {
      _showError('Connexion requise. Verifiez votre connexion internet.');
      return;
    }

    // Verifier les champs obligatoires
    if (_clientController.text.trim().isEmpty) {
      _showError('Le champ "Client / Societe" est obligatoire.');
      return;
    }
    if (_addressController.text.trim().isEmpty) {
      _showError('Le champ "Adresse" est obligatoire.');
      return;
    }
    if (_detailsController.text.trim().isEmpty) {
      _showError('Le champ "Detail livraison" est obligatoire.');
      return;
    }

    // Valider l'email si renseigne
    final email = _emailController.text.trim();
    if (email.isNotEmpty && !_isValidEmail(email)) {
      _showError('L\'adresse email n\'est pas valide.');
      return;
    }

    // Verifier la signature
    if (_signatureControl.isFilled != true) {
      _showError('Veuillez faire signer le client.');
      return;
    }

    setState(() => _loading = true);

    try {
      // 1) Exporter la signature en PNG
      final signatureBytes = await _signatureControl.toImage(
        color: Colors.black,
        background: Colors.white,
        fit: true,
      );

      if (signatureBytes == null) {
        _showError('Impossible d\'exporter la signature.');
        setState(() => _loading = false);
        return;
      }

      // Convertir en Uint8List
      final pngData = signatureBytes.buffer.asUint8List();

      // 2) Uploader la signature via l'API
      final signaturePath = await ApiService.uploadSignature(pngData);

      // 3) Creer l'enregistrement du BDL via l'API
      final bdl = await ApiService.createDeliveryNote(
        clientName: _clientController.text.trim(),
        clientEmail: email.isEmpty ? null : email,
        address: _addressController.text.trim(),
        details: _detailsController.text.trim(),
        signaturePath: signaturePath,
      );

      final bdlId = bdl['id'] as String;
      final bdlNumber = bdl['bdl_number'] as String;

      // 4) Appeler l'API pour generer le PDF et envoyer l'email
      await ApiService.generatePdf(bdlId);

      // 5) Afficher le resultat
      if (mounted) {
        _showSuccess(
          bdlNumber: bdlNumber,
          pdfPath: '',
        );
      }
    } catch (e) {
      _showError('Erreur : $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  // Demarrer/arreter la dictee vocale
  Future<void> _toggleDictation() async {
    if (_isListening) {
      await _speech.stop();
      setState(() => _isListening = false);
      return;
    }

    final available = await _speech.initialize(
      onError: (error) {
        setState(() => _isListening = false);
      },
    );

    if (!available) {
      _showError('La reconnaissance vocale n\'est pas disponible.');
      return;
    }

    setState(() => _isListening = true);

    await _speech.listen(
      onResult: (result) {
        setState(() {
          // Ajouter le texte dicte au champ details
          _detailsController.text = result.recognizedWords;
        });
      },
      localeId: 'fr_FR', // Francais
      listenMode: stt.ListenMode.dictation,
    );
  }

  // Validation basique d'email
  bool _isValidEmail(String email) {
    return RegExp(r'^[^@]+@[^@]+\.[^@]+$').hasMatch(email);
  }

  // Afficher une erreur
  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red,
      ),
    );
  }

  // Afficher le succes avec numero BDL
  void _showSuccess({required String bdlNumber, required String pdfPath}) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.check_circle, color: Colors.green, size: 28),
            SizedBox(width: 8),
            Text('Succes !'),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Bon de livraison cree avec succes.'),
            const SizedBox(height: 12),
            Text(
              'Numero : $bdlNumber',
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 18,
                color: Color(0xFF1E40AF),
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Le PDF a ete genere et l\'email envoye.',
              style: TextStyle(color: Colors.grey),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              Navigator.of(context).pop(); // Retour a l'accueil
            },
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Nouveau BDL'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // --- Client / Societe (avec autocompletion) ---
            const Text(
              'Client / Societe *',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
            ),
            const SizedBox(height: 6),
            Autocomplete<Map<String, dynamic>>(
              optionsBuilder: (TextEditingValue textEditingValue) {
                if (textEditingValue.text.isEmpty) {
                  return const Iterable<Map<String, dynamic>>.empty();
                }
                final query = textEditingValue.text.toLowerCase();
                return _clients.where((client) {
                  final name = (client['name'] as String? ?? '').toLowerCase();
                  return name.contains(query);
                });
              },
              displayStringForOption: (client) => client['name'] as String? ?? '',
              onSelected: (client) {
                // Pre-remplir email et adresse
                final email = client['email'] as String? ?? '';
                final address = client['address'] as String? ?? '';
                if (email.isNotEmpty) {
                  _emailController.text = email;
                }
                if (address.isNotEmpty) {
                  _addressController.text = address;
                }
              },
              fieldViewBuilder: (context, textController, focusNode, onFieldSubmitted) {
                // Synchroniser le textController avec _clientController
                textController.addListener(() {
                  _clientController.text = textController.text;
                });
                // Si _clientController a deja du texte, le copier
                if (_clientController.text.isNotEmpty && textController.text.isEmpty) {
                  textController.text = _clientController.text;
                }
                return TextField(
                  controller: textController,
                  focusNode: focusNode,
                  decoration: const InputDecoration(
                    hintText: 'Tapez pour rechercher un client...',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.business),
                  ),
                );
              },
              optionsViewBuilder: (context, onSelected, options) {
                return Align(
                  alignment: Alignment.topLeft,
                  child: Material(
                    elevation: 4,
                    borderRadius: BorderRadius.circular(8),
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxHeight: 200),
                      child: ListView.builder(
                        padding: EdgeInsets.zero,
                        shrinkWrap: true,
                        itemCount: options.length,
                        itemBuilder: (context, index) {
                          final client = options.elementAt(index);
                          return ListTile(
                            leading: const Icon(Icons.person, color: Color(0xFF2563EB)),
                            title: Text(
                              client['name'] as String? ?? '',
                              style: const TextStyle(fontWeight: FontWeight.w600),
                            ),
                            subtitle: Text(
                              client['address'] as String? ?? '',
                              style: const TextStyle(fontSize: 12, color: Colors.grey),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            onTap: () => onSelected(client),
                          );
                        },
                      ),
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 16),

            // --- Email client ---
            const Text(
              'Email client (optionnel)',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _emailController,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(
                hintText: 'email@exemple.com',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.email),
              ),
            ),
            const SizedBox(height: 16),

            // --- Adresse ---
            const Text(
              'Adresse *',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _addressController,
              maxLines: 2,
              decoration: const InputDecoration(
                hintText: 'Adresse de livraison',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.location_on),
              ),
            ),
            const SizedBox(height: 16),

            // --- Details livraison ---
            Row(
              children: [
                const Text(
                  'Detail livraison *',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                ),
                const Spacer(),
                // Bouton dictee vocale
                TextButton.icon(
                  onPressed: _toggleDictation,
                  icon: Icon(
                    _isListening ? Icons.mic_off : Icons.mic,
                    color: _isListening ? Colors.red : const Color(0xFF2563EB),
                  ),
                  label: Text(
                    _isListening ? 'Arreter' : 'Dicter',
                    style: TextStyle(
                      color: _isListening ? Colors.red : const Color(0xFF2563EB),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _detailsController,
              maxLines: 5,
              decoration: InputDecoration(
                hintText: 'Decrivez le contenu de la livraison...',
                border: const OutlineInputBorder(),
                // Indicateur d'ecoute
                suffixIcon: _isListening
                    ? const Padding(
                        padding: EdgeInsets.all(12),
                        child: SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      )
                    : null,
              ),
            ),
            const SizedBox(height: 24),

            // --- Zone de signature ---
            Row(
              children: [
                const Text(
                  'Signature du client *',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                ),
                const Spacer(),
                TextButton.icon(
                  onPressed: () {
                    _signatureControl.clear();
                  },
                  icon: const Icon(Icons.delete, color: Colors.red),
                  label: const Text(
                    'Effacer',
                    style: TextStyle(color: Colors.red),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Container(
              height: 200,
              decoration: BoxDecoration(
                border: Border.all(color: Colors.grey.shade400),
                borderRadius: BorderRadius.circular(8),
                color: Colors.white,
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: HandSignature(
                  control: _signatureControl,
                  color: Colors.black,
                  width: 2.0,
                  type: SignatureDrawType.shape,
                ),
              ),
            ),
            const SizedBox(height: 32),

            // --- Bouton VALIDER ---
            SizedBox(
              height: 56,
              child: ElevatedButton(
                onPressed: _loading ? null : _validate,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF16A34A),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: _loading
                    ? const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2,
                            ),
                          ),
                          SizedBox(width: 12),
                          Text(
                            'ENVOI EN COURS...',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                          ),
                        ],
                      )
                    : const Text(
                        'VALIDER',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                      ),
              ),
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _clientController.dispose();
    _emailController.dispose();
    _addressController.dispose();
    _detailsController.dispose();
    _speech.stop();
    super.dispose();
  }
}

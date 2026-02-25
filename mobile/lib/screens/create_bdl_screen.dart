import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import 'package:hand_signature/signature.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../main.dart';
import '../services/connectivity_service.dart';

// ============================================================
// ÉCRAN CRÉATION D'UN BON DE LIVRAISON
// Champs : client, email, adresse, détails (+ dictée vocale),
//          signature canvas, bouton VALIDER
// ============================================================

class CreateBdlScreen extends StatefulWidget {
  const CreateBdlScreen({super.key});

  @override
  State<CreateBdlScreen> createState() => _CreateBdlScreenState();
}

class _CreateBdlScreenState extends State<CreateBdlScreen> {
  // Contrôleurs des champs de texte
  final _clientController = TextEditingController();
  final _emailController = TextEditingController();
  final _addressController = TextEditingController();
  final _detailsController = TextEditingController();

  // Liste des clients pour l'autocomplétion
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

  // État
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _loadClients();
  }

  // Charger les clients depuis Supabase pour l'autocomplétion
  Future<void> _loadClients() async {
    try {
      final data = await supabase
          .from('clients')
          .select('*')
          .order('name', ascending: true);
      if (mounted) {
        setState(() {
          _clients = List<Map<String, dynamic>>.from(data);
        });
      }
    } catch (e) {
      // Silencieux : l'autocomplétion ne sera pas disponible
      debugPrint('Erreur chargement clients: $e');
    }
  }

  // Valider le formulaire et envoyer
  Future<void> _validate() async {
    // Vérifier la connexion internet
    if (!await ConnectivityService.isConnected()) {
      _showError('Connexion requise. Vérifiez votre connexion internet.');
      return;
    }

    // Vérifier les champs obligatoires
    if (_clientController.text.trim().isEmpty) {
      _showError('Le champ "Client / Société" est obligatoire.');
      return;
    }
    if (_addressController.text.trim().isEmpty) {
      _showError('Le champ "Adresse" est obligatoire.');
      return;
    }
    if (_detailsController.text.trim().isEmpty) {
      _showError('Le champ "Détail livraison" est obligatoire.');
      return;
    }

    // Valider l'email si renseigné
    final email = _emailController.text.trim();
    if (email.isNotEmpty && !_isValidEmail(email)) {
      _showError('L\'adresse email n\'est pas valide.');
      return;
    }

    // Vérifier la signature
    if (_signatureControl.isFilled != true) {
      _showError('Veuillez faire signer le client.');
      return;
    }

    setState(() => _loading = true);

    try {
      final userId = supabase.auth.currentUser!.id;

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

      // 2) Créer l'enregistrement en base
      final response = await supabase.from('delivery_notes').insert({
        'client_name': _clientController.text.trim(),
        'client_email': email.isEmpty ? null : email,
        'address': _addressController.text.trim(),
        'details': _detailsController.text.trim(),
        'driver_id': userId,
      }).select().single();

      final bdlId = response['id'] as String;
      final bdlNumber = response['bdl_number'] as String;

      // 3) Uploader la signature dans Supabase Storage
      final signaturePath = '$bdlNumber.png';
      await supabase.storage.from('signatures').uploadBinary(
        signaturePath,
        pngData,
        fileOptions: FileOptions(contentType: 'image/png'),
      );

      // Mettre à jour le chemin de la signature dans le BDL
      await supabase.from('delivery_notes').update({
        'signature_path': signaturePath,
      }).eq('id', bdlId);

      // 4) Appeler l'Edge Function pour générer le PDF et envoyer l'email
      final functionResponse = await supabase.functions.invoke(
        'generate_and_email_pdf',
        body: {'delivery_note_id': bdlId},
      );

      // 5) Afficher le résultat
      if (mounted) {
        final data = functionResponse.data;
        _showSuccess(
          bdlNumber: bdlNumber,
          pdfPath: data?['pdf_path'] ?? '',
        );
      }
    } catch (e) {
      _showError('Erreur : $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  // Démarrer/arrêter la dictée vocale
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
          // Ajouter le texte dicté au champ détails
          _detailsController.text = result.recognizedWords;
        });
      },
      localeId: 'fr_FR', // Français
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

  // Afficher le succès avec numéro BDL
  void _showSuccess({required String bdlNumber, required String pdfPath}) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.check_circle, color: Colors.green, size: 28),
            SizedBox(width: 8),
            Text('Succès !'),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Bon de livraison créé avec succès.'),
            const SizedBox(height: 12),
            Text(
              'Numéro : $bdlNumber',
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 18,
                color: Color(0xFF1E40AF),
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Le PDF a été généré et l\'email envoyé.',
              style: TextStyle(color: Colors.grey),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              Navigator.of(context).pop(); // Retour à l'accueil
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
            // --- Client / Société (avec autocomplétion) ---
            const Text(
              'Client / Société *',
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
                // Pré-remplir email et adresse
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
                // Si _clientController a déjà du texte, le copier
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

            // --- Détails livraison ---
            Row(
              children: [
                const Text(
                  'Détail livraison *',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                ),
                const Spacer(),
                // Bouton dictée vocale
                TextButton.icon(
                  onPressed: _toggleDictation,
                  icon: Icon(
                    _isListening ? Icons.mic_off : Icons.mic,
                    color: _isListening ? Colors.red : const Color(0xFF2563EB),
                  ),
                  label: Text(
                    _isListening ? 'Arrêter' : 'Dicter',
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
                hintText: 'Décrivez le contenu de la livraison...',
                border: const OutlineInputBorder(),
                // Indicateur d'écoute
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

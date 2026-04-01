import 'dart:io';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';

// ─── Data classes ──────────────────────────────────────────────────────────────

enum OcrDocType { rc, insurance, drivingLicense, fitness, puc, other }

class OcrField {
  final String value;
  final double confidence; // 0.0 – 1.0
  const OcrField({required this.value, required this.confidence});
}

class OcrResult {
  final String rawText;
  final OcrDocType docType;
  final Map<String, OcrField> fields;
  final double overallConfidence;
  final String? error;

  const OcrResult({
    required this.rawText,
    required this.docType,
    required this.fields,
    required this.overallConfidence,
    this.error,
  });

  static OcrResult failure(String message) => OcrResult(
        rawText: '',
        docType: OcrDocType.other,
        fields: {},
        overallConfidence: 0,
        error: message,
      );
}

// ─── OCR Service ───────────────────────────────────────────────────────────────

class OcrService {
  OcrService._();
  static final OcrService instance = OcrService._();

  // Lazy-initialised recognisers (Latin + Devanagari for Hindi)
  TextRecognizer? _latinRecognizer;
  TextRecognizer? _devanagariRecognizer;

  TextRecognizer get _latin =>
      _latinRecognizer ??= TextRecognizer(script: TextRecognitionScript.latin);

  TextRecognizer get _devanagari =>
      _devanagariRecognizer ??=
          TextRecognizer(script: TextRecognitionScript.devanagari);

  /// Run on-device OCR on an image file.
  /// Tries Latin first; if Hindi keywords appear it also runs Devanagari and
  /// merges the results.
  Future<OcrResult> recognizeText(File imageFile) async {
    try {
      final inputImage = InputImage.fromFile(imageFile);

      // Latin pass (covers English + vehicle numbers)
      final latinResult = await _latin.processImage(inputImage);
      String combinedText = latinResult.text;

      // Quick Devanagari check: if Hindi chars present, run second pass
      if (_likelyHindi(combinedText)) {
        final devaResult = await _devanagari.processImage(inputImage);
        combinedText = '$combinedText\n${devaResult.text}';
      }

      final docType = detectDocType(combinedText);
      final fields = extractFields(combinedText, docType);
      final confidence = _calcConfidence(fields, docType);

      return OcrResult(
        rawText: combinedText,
        docType: docType,
        fields: fields,
        overallConfidence: confidence,
      );
    } catch (e) {
      return OcrResult.failure('OCR failed: $e');
    }
  }

  /// Dispose recognisers (call on app teardown)
  Future<void> dispose() async {
    await _latinRecognizer?.close();
    await _devanagariRecognizer?.close();
    _latinRecognizer = null;
    _devanagariRecognizer = null;
  }

  // ─── Doc type detection ────────────────────────────────────────────────────

  static const Map<OcrDocType, List<String>> _keywords = {
    OcrDocType.rc: [
      'registration certificate', 'reg. cert', 'vehicle reg', 'reg no',
      'rto', 'engine no', 'chassis no', 'owner', 'registration mark',
      'परिवहन', 'पंजीकरण',
    ],
    OcrDocType.insurance: [
      'insurance', 'policy no', 'policy number', 'insurer', 'insured',
      'premium', 'vehicle insurance', 'motor insurance', 'cover note',
      'बीमा',
    ],
    OcrDocType.drivingLicense: [
      'driving licence', 'driving license', 'dl no', 'licence no',
      'license number', 'transport vehicle', 'lmv', 'mcwg',
      'ड्राइविंग लाइसेंस',
    ],
    OcrDocType.fitness: [
      'fitness certificate', 'fitness', 'valid upto', 'mvl',
      'fitness no', 'फिटनेस',
    ],
    OcrDocType.puc: [
      'pollution', 'puc', 'emission', 'pucc', 'test no',
      'pollution under control', 'प्रदूषण',
    ],
  };

  OcrDocType detectDocType(String text) {
    final lower = text.toLowerCase();
    final scores = <OcrDocType, int>{};
    _keywords.forEach((type, kws) {
      scores[type] = kws.where((k) => lower.contains(k)).length;
    });
    final best = scores.entries
        .reduce((a, b) => a.value >= b.value ? a : b);
    return best.value == 0 ? OcrDocType.other : best.key;
  }

  // ─── Field extraction ──────────────────────────────────────────────────────

  Map<String, OcrField> extractFields(String text, OcrDocType docType) {
    return switch (docType) {
      OcrDocType.rc => _extractRC(text),
      OcrDocType.insurance => _extractInsurance(text),
      OcrDocType.drivingLicense => _extractDL(text),
      OcrDocType.fitness => _extractFitness(text),
      OcrDocType.puc => _extractPUC(text),
      OcrDocType.other => _extractGeneric(text),
    };
  }

  // Indian vehicle registration number: e.g. TN72BC7214 or MH 04 AB 1234
  static final _vehicleReg = RegExp(
    r'\b([A-Z]{2}[\s\-]?\d{2}[\s\-]?[A-Z]{1,3}[\s\-]?\d{1,4})\b',
    caseSensitive: false,
  );
  // Generic Indian date (DD/MM/YYYY or DD-MM-YYYY)
  static final _date = RegExp(
    r'\b(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})\b',
  );
  // India DL number (format varies by state, serial can be 4-9 digits after year)
  // e.g. TN72 2024005499, TN0520110012345
  static final _dlNumber = RegExp(
    r'\b([A-Z]{2}[\s\-]?\d{2}[\s\-]?(?:19|20)\d{2}[\s]?\d{4,9})\b',
    caseSensitive: false,
  );
  // Policy / document reference numbers (alphanumeric 6-20 chars starting with letter)
  static final _refNumber = RegExp(
    r'\b([A-Z][A-Z0-9\-\/]{5,19})\b',
    caseSensitive: false,
  );
  // Engine & chassis
  static final _engineNo = RegExp(
    r'(?:engine\s*[no#.:]+\s*)([A-Z0-9]{6,20})',
    caseSensitive: false,
  );
  static final _chassisNo = RegExp(
    r'(?:chassis\s*[no#.:]+\s*)([A-Z0-9]{9,25})',
    caseSensitive: false,
  );

  Map<String, OcrField> _extractRC(String text) {
    final fields = <String, OcrField>{};
    _tryMatch(fields, 'registration_number', _vehicleReg, text, 0.9);
    // Engine — also handles "Engine/Motor Number" label on new TN smart cards
    final engineM = RegExp(
      r'(?:engine(?:\/motor)?\s*(?:no|number)?|engineno)\s*[:\-.]?\s*([A-Z0-9X]{6,20})',
      caseSensitive: false,
    ).firstMatch(text);
    if (engineM != null) {
      fields['engine_number'] = OcrField(
        value: _clean(engineM.group(1)!), confidence: 0.85);
    }
    _tryMatch(fields, 'chassis_number', _chassisNo, text, confidence: 0.85, group: 1);
    // Owner name
    final ownerMatch = RegExp(
      r'(?:registered\s*)?owner\s*(?:name)?\s*[:\-]?\s*([A-Z][A-Z\s]+)',
      caseSensitive: false,
    ).firstMatch(text);
    if (ownerMatch != null) {
      fields['owner_name'] = OcrField(
        value: _clean(ownerMatch.group(1)!), confidence: 0.75);
    }
    // Valid upto — also handles "Regn. Validity" / "Regn Validity" on new TN smart cards
    final regnValPattern = RegExp(
      r'(?:regn\.?\s*validity|valid\s*upto|validity|reg\.?\s*upto)\s*[:\-.]?\s*([\d\/\-\.]{8,10})',
      caseSensitive: false,
    );
    final regnVal = regnValPattern.firstMatch(text);
    if (regnVal != null) {
      fields['valid_upto'] = OcrField(
        value: _normaliseDate(regnVal.group(1)!), confidence: 0.88);
    } else {
      _extractDates(fields, text);
    }
    // Fuel type — handles same-line and next-line formats
    final fuelM = RegExp(
      r'fuel\s*(?:used|type)?\s*[:\-.]?\s*\n?\s*(diesel|petrol|cng|electric|lpg)',
      caseSensitive: false,
      multiLine: true,
    ).firstMatch(text);
    if (fuelM != null) {
      final f = fuelM.group(1)!;
      fields['fuel_type'] = OcrField(
        value: f[0].toUpperCase() + f.substring(1).toLowerCase(),
        confidence: 0.92,
      );
    }
    return fields;
  }

  Map<String, OcrField> _extractInsurance(String text) {
    final fields = <String, OcrField>{};
    _tryMatch(fields, 'vehicle_number', _vehicleReg, text, 0.9);
    // Policy number: find label then grab next token
    final policyMatch = RegExp(
      r'policy\s*[no#.:]+\s*([A-Z0-9\/\-]{4,25})',
      caseSensitive: false,
    ).firstMatch(text);
    if (policyMatch != null) {
      fields['policy_number'] = OcrField(
        value: _clean(policyMatch.group(1)!),
        confidence: 0.88,
      );
    }
    _extractDates(fields, text, validUptoLabel: 'valid upto|expiry|period to');
    return fields;
  }

  Map<String, OcrField> _extractDL(String text) {
    final fields = <String, OcrField>{};
    _tryMatch(fields, 'dl_number', _dlNumber, text, 0.9);
    // Name
    final nameMatch = RegExp(
      r'(?:name|holder)\s*[:\-]?\s*([A-Z][A-Z\s]{3,40})',
      caseSensitive: false,
    ).firstMatch(text);
    if (nameMatch != null) {
      fields['name'] = OcrField(
        value: _clean(nameMatch.group(1)!),
        confidence: 0.78,
      );
    }
    // Validity(NT) and Validity(TR) are labels on new TN Govt smart cards
    final expiryMatch = RegExp(
      r'(?:validity\(nt\)|validity\(tr\)|valid\s+till|valid\s+upto|validity)\s*[:\s]?\s*([\d\/\-\.]{8,10})',
      caseSensitive: false,
    ).firstMatch(text);
    if (expiryMatch != null) {
      fields['valid_upto'] = OcrField(
        value: _normaliseDate(expiryMatch.group(1)!),
        confidence: 0.88,
      );
    } else {
      _extractDates(fields, text, validUptoLabel: 'valid till|valid upto|expiry|cov upto');
    }
    // Blood group — handles A+, A+ve at end-of-line (new TN smart card)
    final bgMatch = RegExp(
      r'(?:blood\s*(?:group)?\s*[:\-]?\s*)?(A|B|AB|O)[+\-](?:ve)?(?=[\s\n,./]|$)',
      caseSensitive: false,
      multiLine: true,
    ).firstMatch(text);
    if (bgMatch != null) {
      final letter = bgMatch.group(1)!.toUpperCase();
      final sign = bgMatch.group(0)!.contains('+') ? '+' : '-';
      fields['blood_group'] = OcrField(value: '$letter$sign', confidence: 0.92);
    }
    _tryMatch(fields, 'vehicle_number', _vehicleReg, text, 0.7);
    return fields;
  }

  Map<String, OcrField> _extractFitness(String text) {
    final fields = <String, OcrField>{};
    _tryMatch(fields, 'vehicle_number', _vehicleReg, text, 0.9);
    final certMatch = RegExp(
      r'(?:cert|fitness)\s*[no#.:]+\s*([A-Z0-9\/\-]{4,25})',
      caseSensitive: false,
    ).firstMatch(text);
    if (certMatch != null) {
      fields['fitness_number'] = OcrField(
        value: _clean(certMatch.group(1)!),
        confidence: 0.85,
      );
    }
    _extractDates(fields, text, validUptoLabel: 'valid upto|valid till|expiry');
    return fields;
  }

  Map<String, OcrField> _extractPUC(String text) {
    final fields = <String, OcrField>{};
    _tryMatch(fields, 'vehicle_number', _vehicleReg, text, 0.9);
    final certMatch = RegExp(
      r'(?:test|cert|pucc?)\s*[no#.:]+\s*([A-Z0-9\/\-]{4,25})',
      caseSensitive: false,
    ).firstMatch(text);
    if (certMatch != null) {
      fields['pucc_number'] = OcrField(
        value: _clean(certMatch.group(1)!),
        confidence: 0.85,
      );
    }
    _extractDates(fields, text, validUptoLabel: 'valid upto|valid till|expiry');
    return fields;
  }

  Map<String, OcrField> _extractGeneric(String text) {
    final fields = <String, OcrField>{};
    _tryMatch(fields, 'reference_number', _refNumber, text, 0.6);
    _extractDates(fields, text);
    return fields;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  void _tryMatch(
    Map<String, OcrField> fields,
    String key,
    RegExp pattern,
    String text, {
    required double confidence,
    int group = 0,
  }) {
    final m = pattern.firstMatch(text);
    if (m != null) {
      final val = _clean(m.group(group) ?? '');
      if (val.isNotEmpty) {
        fields[key] = OcrField(value: val, confidence: confidence);
      }
    }
  }

  void _extractDates(
    Map<String, OcrField> fields,
    String text, {
    String? validUptoLabel,
  }) {
    final matches = _date.allMatches(text).toList();
    if (matches.isEmpty) return;

    if (validUptoLabel != null) {
      final expiryPattern = RegExp(
        '(?:$validUptoLabel)[\\s:]+([\\d\\/\\-\\.]{8,10})',
        caseSensitive: false,
      );
      final expiry = expiryPattern.firstMatch(text);
      if (expiry != null) {
        fields['valid_upto'] = OcrField(
          value: _normaliseDate(expiry.group(1)!),
          confidence: 0.88,
        );
        return;
      }
    }

    // Heuristic: first date is issue, last date is expiry
    if (matches.length >= 2) {
      fields['issue_date'] = OcrField(
        value: _normaliseDate(matches.first.group(0)!),
        confidence: 0.7,
      );
      fields['valid_upto'] = OcrField(
        value: _normaliseDate(matches.last.group(0)!),
        confidence: 0.7,
      );
    } else if (matches.length == 1) {
      fields['valid_upto'] = OcrField(
        value: _normaliseDate(matches.first.group(0)!),
        confidence: 0.65,
      );
    }
  }

  /// DD/MM/YYYY or DD-MM-YYYY → YYYY-MM-DD
  String _normaliseDate(String raw) {
    final parts = raw.split(RegExp(r'[\/\-\.]'));
    if (parts.length == 3) {
      final d = parts[0].padLeft(2, '0');
      final m = parts[1].padLeft(2, '0');
      final y = parts[2];
      if (y.length == 4) return '$y-$m-$d';
    }
    return raw;
  }

  String _clean(String s) => s.trim().replaceAll(RegExp(r'\s+'), ' ');

  bool _likelyHindi(String text) {
    // Devanagari Unicode block: U+0900–U+097F
    return RegExp(r'[\u0900-\u097F]').hasMatch(text);
  }

  double _calcConfidence(Map<String, OcrField> fields, OcrDocType docType) {
    if (fields.isEmpty) return 0.0;
    final avg = fields.values.map((f) => f.confidence).reduce((a, b) => a + b) /
        fields.length;
    // Bonus if primary ID field found
    final primaryKey = _primaryKey(docType);
    if (primaryKey != null && fields.containsKey(primaryKey)) {
      return (avg * 0.7 + 0.3).clamp(0.0, 1.0);
    }
    return avg;
  }

  String? _primaryKey(OcrDocType t) => switch (t) {
        OcrDocType.rc => 'registration_number',
        OcrDocType.drivingLicense => 'dl_number',
        OcrDocType.insurance => 'policy_number',
        OcrDocType.fitness => 'fitness_number',
        OcrDocType.puc => 'pucc_number',
        _ => null,
      };

  // ─── Human-readable labels ─────────────────────────────────────────────────

  static const Map<String, String> fieldLabels = {
    'registration_number': 'Reg. Number',
    'engine_number': 'Engine No.',
    'chassis_number': 'Chassis No.',
    'owner_name': 'Owner',
    'vehicle_number': 'Vehicle Number',
    'policy_number': 'Policy Number',
    'dl_number': 'DL Number',
    'name': 'Name',
    'fitness_number': 'Fitness Cert. No.',
    'pucc_number': 'PUCC Number',
    'issue_date': 'Issue Date',
    'valid_upto': 'Valid Upto',
    'reference_number': 'Reference',
  };

  static String labelFor(String key) => fieldLabels[key] ?? key;

  static String docTypeName(OcrDocType t) => switch (t) {
        OcrDocType.rc => 'Registration Certificate',
        OcrDocType.insurance => 'Insurance',
        OcrDocType.drivingLicense => 'Driving Licence',
        OcrDocType.fitness => 'Fitness Certificate',
        OcrDocType.puc => 'PUC Certificate',
        OcrDocType.other => 'Document',
      };
}

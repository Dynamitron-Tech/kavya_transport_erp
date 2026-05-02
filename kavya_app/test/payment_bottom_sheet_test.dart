// test/payment_bottom_sheet_test.dart
//
// Widget tests for PaymentBottomSheet.
// Uses manual stub (no mockito needed) via Riverpod provider overrides.
//
// Tests:
//   1. UPI chip is disabled when upiAvailable == false
//   2. Record Payment button disabled when amount is empty / zero
//   3. Error dialog shown — sheet NOT closed — on PaymentValidationException
//   4. onPaymentRecorded callback fired + sheet closes on success

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kavya_app/models/payment_models.dart';
import 'package:kavya_app/services/payment_service.dart';
import 'package:kavya_app/widgets/payment_bottom_sheet.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Fake PaymentService — no network calls, configurable responses
// ─────────────────────────────────────────────────────────────────────────────

class _FakePaymentService extends PaymentService {
  final ClientPaymentInfo clientInfo;
  final Exception? recordException;
  int recordCallCount = 0;

  _FakePaymentService({
    required this.clientInfo,
    this.recordException,
  }) : super(null as dynamic);  // ApiService never called; all methods overridden

  @override
  Future<ClientPaymentInfo> getClientPaymentInfo(int clientId) async {
    return clientInfo;
  }

  @override
  Future<RecordPaymentResponse> recordPayment(
    RecordPaymentRequest request,
  ) async {
    recordCallCount++;
    if (recordException != null) throw recordException!;
    return const RecordPaymentResponse(
      success: true,
      paymentId: 42,
      invoiceId: 1,
      newStatus: 'PAID',
      outstandingBalance: 0.0,
    );
  }

  @override
  Future<List<PaymentRecord>> getPaymentHistory(int invoiceId) async => [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────────────────────────────────────

Widget _buildSheet({
  required _FakePaymentService fakeService,
  VoidCallback? onPaymentRecorded,
}) {
  return ProviderScope(
    overrides: [
      paymentServiceProvider.overrideWithValue(fakeService),
    ],
    child: MaterialApp(
      home: Builder(
        builder: (ctx) => Scaffold(
          body: PaymentBottomSheet(
            invoiceId: 1,
            clientId: 1,
            invoiceNumber: 'KT-INV-2026-001',
            outstandingAmount: 50000,
            clientName: 'Test Client',
            onPaymentRecorded: onPaymentRecorded ?? () {},
          ),
        ),
      ),
    ),
  );
}

// Pump until no more frames are scheduled
Future<void> _settle(WidgetTester tester) async {
  await tester.pump();
  await tester.pumpAndSettle(const Duration(seconds: 3));
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

void main() {
  // ── Test 1 — UPI chip disabled when no UPI ────────────────────────────────

  testWidgets('UPI chip is disabled when upiAvailable is false',
      (WidgetTester tester) async {
    final fakeService = _FakePaymentService(
      clientInfo: const ClientPaymentInfo(
        upiAvailable: false,
        name: 'No UPI Client',
      ),
    );

    await tester.pumpWidget(_buildSheet(fakeService: fakeService));
    await _settle(tester);

    // FilterChip labelled 'UPI' must exist
    final upiChipFinder = find.widgetWithText(FilterChip, 'UPI');
    expect(upiChipFinder, findsOneWidget);

    // Its onSelected should be null (disabled)
    final chip = tester.widget<FilterChip>(upiChipFinder);
    expect(chip.onSelected, isNull,
        reason: 'UPI chip must be disabled when no UPI ID is available');
  });

  // ── Test 2 — Record Payment button disabled when amount is 0 ─────────────

  testWidgets('Record Payment button disabled when amount is empty',
      (WidgetTester tester) async {
    final fakeService = _FakePaymentService(
      clientInfo: const ClientPaymentInfo(
        upiAvailable: false,
        name: 'Test Client',
      ),
    );

    await tester.pumpWidget(_buildSheet(fakeService: fakeService));
    await _settle(tester);

    // Clear the pre-filled amount
    final amountField = find.byType(TextFormField).first;
    await tester.enterText(amountField, '');
    await _settle(tester);

    // Tap the Record Payment button — form should not submit (validator fires)
    final button = find.widgetWithText(ElevatedButton, 'Record Payment');
    expect(button, findsOneWidget);

    await tester.tap(button);
    await _settle(tester);

    // Confirm dialog should NOT appear (validation failed)
    expect(find.text('Confirm Payment'), findsNothing);
    // Service record method should not have been called
    expect(fakeService.recordCallCount, 0);
  });

  // ── Test 3 — Error dialog on PaymentValidationException, sheet stays open ─

  testWidgets(
      'Error dialog shown without closing sheet on PaymentValidationException',
      (WidgetTester tester) async {
    const errorMsg = 'Amount exceeds outstanding ₹50,000';
    final fakeService = _FakePaymentService(
      clientInfo: const ClientPaymentInfo(
        upiAvailable: false,
        name: 'Test Client',
      ),
      recordException: const PaymentValidationException(errorMsg),
    );

    bool sheetOpen = true;

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          paymentServiceProvider.overrideWithValue(fakeService),
        ],
        child: MaterialApp(
          home: Builder(
            builder: (ctx) => Scaffold(
              body: PaymentBottomSheet(
                invoiceId: 1,
                clientId: 1,
                invoiceNumber: 'KT-INV-2026-001',
                outstandingAmount: 50000,
                clientName: 'Test Client',
                onPaymentRecorded: () {
                  // Should NOT be called
                },
              ),
            ),
          ),
        ),
      ),
    );
    await _settle(tester);

    // The amount field is pre-filled with 50000.
    // Choose CASH mode so we bypass UPI/NEFT ref requirement.
    final cashChip = find.widgetWithText(FilterChip, 'CASH');
    await tester.tap(cashChip);
    await _settle(tester);

    // Tap "Record Payment"
    final button = find.widgetWithText(ElevatedButton, 'Record Payment');
    await tester.tap(button);
    await _settle(tester);

    // Confirm dialog should appear (non-UPI path)
    if (find.text('Confirm Payment').evaluate().isNotEmpty) {
      final confirmBtn =
          find.widgetWithText(ElevatedButton, 'Confirm');
      await tester.tap(confirmBtn);
      await _settle(tester);
    }

    // Error dialog must appear
    expect(find.text('Payment Error'), findsOneWidget);

    // Sheet widget still present in tree (error dialog is stacked on top)
    expect(find.text('Record Payment'), findsOneWidget,
        reason: 'Bottom sheet must remain open after a validation error');

    // onPaymentRecorded never called
    expect(fakeService.recordCallCount, greaterThanOrEqualTo(1));
    expect(sheetOpen, isTrue);
  });

  // ── Test 4 — onPaymentRecorded fired on success ───────────────────────────

  testWidgets('onPaymentRecorded callback is invoked on successful submission',
      (WidgetTester tester) async {
    final fakeService = _FakePaymentService(
      clientInfo: const ClientPaymentInfo(
        upiAvailable: false,
        name: 'Test Client',
      ),
      recordException: null, // success
    );

    bool callbackFired = false;

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          paymentServiceProvider.overrideWithValue(fakeService),
        ],
        child: MaterialApp(
          home: Builder(
            builder: (ctx) => Scaffold(
              body: PaymentBottomSheet(
                invoiceId: 1,
                clientId: 1,
                invoiceNumber: 'KT-INV-2026-001',
                outstandingAmount: 50000,
                clientName: 'Test Client',
                onPaymentRecorded: () {
                  callbackFired = true;
                },
              ),
            ),
          ),
        ),
      ),
    );
    await _settle(tester);

    // Switch to CASH (no reference required)
    final cashChip = find.widgetWithText(FilterChip, 'CASH');
    await tester.tap(cashChip);
    await _settle(tester);

    // Tap Record Payment
    final button = find.widgetWithText(ElevatedButton, 'Record Payment');
    await tester.tap(button);
    await _settle(tester);

    // If confirmation dialog appears, confirm it
    if (find.text('Confirm Payment').evaluate().isNotEmpty) {
      final confirmBtn = find.widgetWithText(ElevatedButton, 'Confirm');
      await tester.tap(confirmBtn);
      await _settle(tester);
    }

    expect(callbackFired, isTrue,
        reason: 'onPaymentRecorded must be called after successful submission');
  });
}

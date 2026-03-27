$ErrorActionPreference='Stop'
$base='http://127.0.0.1:8000/api/v1'
function Get-Token {
  $body = @{ email='admin@kavyatransports.com'; password='admin123' } | ConvertTo-Json
  $login = Invoke-RestMethod -Method Post -Uri "$base/auth/login" -ContentType 'application/json' -Body $body
  if (-not $login.data.access_token) { throw 'Login failed: no token' }
  return $login.data.access_token
}
function Get-Totals($headers) {
  $payments = Invoke-RestMethod -Method Get -Uri "$base/finance/payments?limit=1&page=1" -Headers $headers
  $ledger = Invoke-RestMethod -Method Get -Uri "$base/finance/ledger?limit=1&page=1" -Headers $headers
  $receivables = Invoke-RestMethod -Method Get -Uri "$base/finance/receivables" -Headers $headers
  $payables = Invoke-RestMethod -Method Get -Uri "$base/finance/payables" -Headers $headers
  $recvTotal = 0; foreach ($r in ($receivables.data | ForEach-Object { $_ })) { $recvTotal += [decimal]($r.total_due) }
  $payTotal = 0; foreach ($p in ($payables.data | ForEach-Object { $_ })) { $payTotal += [decimal]($p.total_outstanding) }
  [PSCustomObject]@{ payments_count=[int]($payments.pagination.total); ledger_count=[int]($ledger.pagination.total); receivables_total=[decimal]$recvTotal; payables_total=[decimal]$payTotal }
}
function Try-Generate-Invoice($headers) {
  $tripsResp = Invoke-RestMethod -Method Get -Uri "$base/trips?page=1&limit=30" -Headers $headers
  $tripIds = @($tripsResp.data | ForEach-Object { $_.id })
  foreach ($tid in $tripIds) {
    try {
      $gen = Invoke-RestMethod -Method Post -Uri "$base/finance/invoices/generate-from-trip/$tid" -Headers $headers
      if ($gen.success -and $gen.data.id) { return [PSCustomObject]@{ trip_id=$tid; invoice_id=[int]$gen.data.id; invoice_number=$gen.data.invoice_number } }
    } catch { continue }
  }
  throw 'Could not generate invoice from current trip set (all attempts failed).'
}
$token = Get-Token
$headers = @{ Authorization = "Bearer $token" }
$before = Get-Totals -headers $headers
$generated = Try-Generate-Invoice -headers $headers
$send = Invoke-RestMethod -Method Post -Uri "$base/finance/invoices/$($generated.invoice_id)/send" -Headers $headers
$mark = Invoke-RestMethod -Method Post -Uri "$base/finance/invoices/$($generated.invoice_id)/mark-paid" -Headers $headers
$expenseBody = @{ category='food'; description="E2E validation expense for invoice $($generated.invoice_number)"; amount=777.77; payment_mode='cash'; expense_date=(Get-Date).ToString('o') } | ConvertTo-Json
$addExp = Invoke-RestMethod -Method Post -Uri "$base/trips/$($generated.trip_id)/expenses" -Headers $headers -ContentType 'application/json' -Body $expenseBody
$expenseId = [int]$addExp.data.id
$approve = Invoke-RestMethod -Method Put -Uri "$base/accountant/expenses/$expenseId/approve" -Headers $headers
$after = Get-Totals -headers $headers
$report = [ordered]@{
  sequence=@('generate invoice','send invoice','mark paid','add expense','approve expense','totals')
  actions=[ordered]@{
    generated=[ordered]@{ trip_id=$generated.trip_id; invoice_id=$generated.invoice_id; invoice_number=$generated.invoice_number }
    sent=[ordered]@{ success=$send.success; message=$send.message }
    marked_paid=[ordered]@{ success=$mark.success; message=$mark.message; payment_id=$mark.data.payment_id; payment_number=$mark.data.payment_number }
    expense_added=[ordered]@{ success=$addExp.success; expense_id=$expenseId }
    expense_approved=[ordered]@{ success=$approve.success; message=$approve.message }
  }
  totals_before=$before
  totals_after=$after
  deltas=[ordered]@{
    payments_count=($after.payments_count - $before.payments_count)
    ledger_count=($after.ledger_count - $before.ledger_count)
    receivables_total=[decimal]::Round(([decimal]$after.receivables_total - [decimal]$before.receivables_total),2)
    payables_total=[decimal]::Round(([decimal]$after.payables_total - [decimal]$before.payables_total),2)
  }
}
$report | ConvertTo-Json -Depth 8

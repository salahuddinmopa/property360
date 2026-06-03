'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Download, FileSpreadsheet, FileText, BarChart3 } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency, formatDate, MONTHS, YEARS } from '@/lib/utils/format'

interface ReportData {
  type: string
  month?: number
  year: number
  income: { tenant: string; asset: string; amount: number; date: string; method: string }[]
  expenses: { category: string; asset: string; amount: number; date: string; paidTo: string }[]
  summary: { totalIncome: number; totalExpenses: number; netProfit: number }
}

export default function ReportsPage() {
  const supabase = createClient()
  const [reportType, setReportType] = useState('monthly')
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<ReportData | null>(null)

  async function generateReport() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let startDate: string, endDate: string
    if (reportType === 'monthly') {
      startDate = `${year}-${month.toString().padStart(2, '0')}-01`
      endDate = new Date(year, month, 0).toISOString().split('T')[0]
    } else {
      startDate = `${year}-01-01`
      endDate = `${year}-12-31`
    }

    const [{ data: payments }, { data: expenses }] = await Promise.all([
      supabase.from('rent_payments')
        .select('*, tenants(full_name)')
        .gte(reportType === 'monthly' ? 'created_at' : 'created_at', startDate)
        .lte(reportType === 'monthly' ? 'created_at' : 'created_at', endDate + 'T23:59:59')
        .eq(reportType === 'monthly' ? 'month' : 'year', reportType === 'monthly' ? month : year)
        .eq(reportType === 'monthly' ? 'year' : 'year', year),
      supabase.from('expenses')
        .select('*')
        .gte('expense_date', startDate)
        .lte('expense_date', endDate),
    ])

    const incomeRows = (payments ?? []).map(p => ({
      tenant: (p as any).tenants?.full_name ?? '—',
      asset: `${p.asset_type} (${p.month}/${p.year})`,
      amount: p.paid_amount,
      date: p.payment_date ?? '',
      method: p.payment_method?.replace('_', ' ') ?? '—',
    }))

    const expenseRows = (expenses ?? []).map(e => ({
      category: e.category,
      asset: e.asset_type ?? 'general',
      amount: e.amount,
      date: e.expense_date,
      paidTo: e.paid_to ?? '—',
    }))

    const totalIncome = incomeRows.reduce((s, r) => s + r.amount, 0)
    const totalExpenses = expenseRows.reduce((s, r) => s + r.amount, 0)

    setReportData({
      type: reportType,
      month,
      year,
      income: incomeRows,
      expenses: expenseRows,
      summary: { totalIncome, totalExpenses, netProfit: totalIncome - totalExpenses },
    })
    setLoading(false)
  }

  async function exportExcel() {
    if (!reportData) return
    const XLSX = (await import('xlsx')).default

    const wb = XLSX.utils.book_new()
    const period = reportData.type === 'monthly' ? `${MONTHS[month - 1]} ${year}` : `Year ${year}`

    // Summary sheet
    const summaryData = [
      ['Property360 Report', period],
      [],
      ['Summary', ''],
      ['Total Income', reportData.summary.totalIncome],
      ['Total Expenses', reportData.summary.totalExpenses],
      ['Net Profit', reportData.summary.netProfit],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), 'Summary')

    // Income sheet
    const incomeSheet = [
      ['Tenant', 'Asset', 'Amount', 'Date', 'Method'],
      ...reportData.income.map(r => [r.tenant, r.asset, r.amount, r.date, r.method]),
      [],
      ['Total', '', reportData.summary.totalIncome, '', ''],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(incomeSheet), 'Income')

    // Expenses sheet
    const expSheet = [
      ['Category', 'Asset', 'Amount', 'Date', 'Paid To'],
      ...reportData.expenses.map(r => [r.category, r.asset, r.amount, r.date, r.paidTo]),
      [],
      ['Total', '', reportData.summary.totalExpenses, '', ''],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(expSheet), 'Expenses')

    XLSX.writeFile(wb, `Property360_Report_${period.replace(' ', '_')}.xlsx`)
    toast.success('Excel exported')
  }

  async function exportPDF() {
    if (!reportData) return
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')

    const doc = new jsPDF()
    const period = reportData.type === 'monthly' ? `${MONTHS[month - 1]} ${year}` : `Year ${year}`

    doc.setFontSize(18)
    doc.text('Property360 — Income & Expense Report', 14, 20)
    doc.setFontSize(12)
    doc.text(`Period: ${period}`, 14, 30)
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 38)

    // Summary table
    autoTable(doc, {
      startY: 48,
      head: [['', 'Amount']],
      body: [
        ['Total Income', `${formatCurrency(reportData.summary.totalIncome)}`],
        ['Total Expenses', `${formatCurrency(reportData.summary.totalExpenses)}`],
        ['Net Profit', `${formatCurrency(reportData.summary.netProfit)}`],
      ],
      headStyles: { fillColor: [30, 64, 175] },
      styles: { fontSize: 10 },
    })

    // Income table
    const incomeY = (doc as any).lastAutoTable.finalY + 10
    doc.text('Income Details', 14, incomeY)
    autoTable(doc, {
      startY: incomeY + 6,
      head: [['Tenant', 'Asset', 'Amount', 'Date', 'Method']],
      body: reportData.income.map(r => [r.tenant, r.asset, formatCurrency(r.amount), r.date, r.method]),
      headStyles: { fillColor: [22, 163, 74] },
      styles: { fontSize: 9 },
    })

    // Expenses table
    const expY = (doc as any).lastAutoTable.finalY + 10
    doc.text('Expense Details', 14, expY)
    autoTable(doc, {
      startY: expY + 6,
      head: [['Category', 'Asset', 'Amount', 'Date', 'Paid To']],
      body: reportData.expenses.map(r => [r.category, r.asset, formatCurrency(r.amount), r.date, r.paidTo]),
      headStyles: { fillColor: [220, 38, 38] },
      styles: { fontSize: 9 },
    })

    doc.save(`Property360_Report_${period.replace(' ', '_')}.pdf`)
    toast.success('PDF exported')
  }

  return (
    <div>
      <PageHeader title="Reports" description="Generate income, expense, and profit/loss reports" />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Report Parameters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label>Report Type</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {reportType === 'monthly' && (
              <div className="space-y-1">
                <Label>Month</Label>
                <Select value={month.toString()} onValueChange={v => setMonth(parseInt(v))}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={(i+1).toString()}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label>Year</Label>
              <Select value={year.toString()} onValueChange={v => setYear(parseInt(v))}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>{YEARS.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={generateReport} disabled={loading}>
              <BarChart3 className="h-4 w-4 mr-2" />
              {loading ? 'Generating...' : 'Generate Report'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {reportData && (
        <div className="space-y-6">
          {/* Export buttons */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={exportExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />Export Excel
            </Button>
            <Button variant="outline" onClick={exportPDF}>
              <FileText className="h-4 w-4 mr-2 text-red-600" />Export PDF
            </Button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Income', value: reportData.summary.totalIncome, color: 'text-green-600' },
              { label: 'Total Expenses', value: reportData.summary.totalExpenses, color: 'text-red-600' },
              { label: 'Net Profit', value: reportData.summary.netProfit, color: reportData.summary.netProfit >= 0 ? 'text-blue-600' : 'text-red-600' },
            ].map(s => (
              <Card key={s.label}><CardContent className="p-4">
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{formatCurrency(s.value)}</p>
              </CardContent></Card>
            ))}
          </div>

          <Tabs defaultValue="income">
            <TabsList>
              <TabsTrigger value="income">Income ({reportData.income.length})</TabsTrigger>
              <TabsTrigger value="expenses">Expenses ({reportData.expenses.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="income">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tenant</TableHead>
                        <TableHead>Asset</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Method</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.income.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium text-sm">{r.tenant}</TableCell>
                          <TableCell className="text-sm capitalize">{r.asset}</TableCell>
                          <TableCell className="font-medium text-green-700">{formatCurrency(r.amount)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDate(r.date)}</TableCell>
                          <TableCell className="text-sm capitalize">{r.method}</TableCell>
                        </TableRow>
                      ))}
                      {reportData.income.length === 0 && (
                        <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No income records</TableCell></TableRow>
                      )}
                      <TableRow className="bg-green-50 font-semibold">
                        <TableCell colSpan={2}>Total Income</TableCell>
                        <TableCell className="text-green-700">{formatCurrency(reportData.summary.totalIncome)}</TableCell>
                        <TableCell colSpan={2} />
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="expenses">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead>Asset Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Paid To</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.expenses.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium text-sm">{r.category}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs capitalize">{r.asset}</Badge></TableCell>
                          <TableCell className="font-medium text-red-700">{formatCurrency(r.amount)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDate(r.date)}</TableCell>
                          <TableCell className="text-sm">{r.paidTo}</TableCell>
                        </TableRow>
                      ))}
                      {reportData.expenses.length === 0 && (
                        <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No expense records</TableCell></TableRow>
                      )}
                      <TableRow className="bg-red-50 font-semibold">
                        <TableCell colSpan={2}>Total Expenses</TableCell>
                        <TableCell className="text-red-700">{formatCurrency(reportData.summary.totalExpenses)}</TableCell>
                        <TableCell colSpan={2} />
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  )
}

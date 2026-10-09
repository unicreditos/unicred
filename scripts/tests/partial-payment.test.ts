import test from 'node:test'
import assert from 'node:assert/strict'
import { calculatePartialPayment } from '@/lib/customer/partial-payment'

test('Partial payment calculation: insufficient for interest', () => {
  const loan = {
    id: 'loan-1',
    principal: 100000,
    term: 12,
    monthlyRate: 7.5,
    status: 'active',
  }
  const installments = [
    {
      id: 'inst-1',
      loanId: 'loan-1',
      number: 1,
      amount: 12983.56,
      dueDate: new Date('2026-01-01'), // Overdue
      status: 'overdue',
    },
    {
      id: 'inst-2',
      loanId: 'loan-1',
      number: 2,
      amount: 12983.56,
      dueDate: new Date('2026-02-01'), // Overdue
      status: 'overdue',
    },
  ]

  // French split for Cuota 1: Interest = 7500, Capital = 5483.56
  // French split for Cuota 2: Interest = 7088.73, Capital = 5894.83
  // Total overdue interest = 14588.73
  // Total overdue capital = 11378.39

  // Payment of $5000 is less than $14588.73
  const res = calculatePartialPayment(loan, installments, 5000, new Date('2026-03-01'))

  assert.equal(res.coversInterest, false)
  assert.equal(res.allocatedToInterest, 5000)
  assert.equal(res.allocatedToOverdueCapital, 0)
  assert.equal(res.totalCapitalAmortized, 0)
  assert.equal(res.capitalReductionAmount, 0)
  assert.equal(res.newCapitalBalance, res.initialCapitalBalance)
  assert.equal(res.verdict, 'insufficient_interest')
})

test('Partial payment calculation: covers interest but partial capital', () => {
  const loan = {
    id: 'loan-1',
    principal: 100000,
    term: 12,
    monthlyRate: 7.5,
    status: 'active',
  }
  const installments = [
    {
      id: 'inst-1',
      loanId: 'loan-1',
      number: 1,
      amount: 12983.56,
      dueDate: new Date('2026-01-01'),
      status: 'overdue',
    },
  ]

  // For cuota 1: Interest = 7500, Capital = 5427.78
  // Payment of 10000 covers 7500 interest and 2500 of capital
  const res = calculatePartialPayment(loan, installments, 10000, new Date('2026-03-01'))

  assert.equal(res.coversInterest, true)
  assert.equal(res.allocatedToInterest, 7500)
  assert.equal(res.coversOverdueCapital, false)
  assert.equal(res.isOverdueCapitalPartial, true)
  assert.equal(res.allocatedToOverdueCapital, 2500)
  assert.equal(res.totalCapitalAmortized, 2500)
  assert.equal(res.capitalReductionAmount, 2500)
  assert.equal(res.newCapitalBalance, Math.round((res.initialCapitalBalance - 2500) * 100) / 100)
  assert.equal(res.verdict, 'partial_capital')
})

test('Partial payment calculation: covers 100% interest and 100% capital vencido with advance', () => {
  const loan = {
    id: 'loan-1',
    principal: 100000,
    term: 12,
    monthlyRate: 7.5,
    status: 'active',
  }
  const installments = [
    {
      id: 'inst-1',
      loanId: 'loan-1',
      number: 1,
      amount: 12927.78,
      dueDate: new Date('2026-01-01'),
      status: 'overdue',
    },
    {
      id: 'inst-2',
      loanId: 'loan-1',
      number: 2,
      amount: 12927.78,
      dueDate: new Date('2026-05-01'), // Future pending
      status: 'pending',
    },
  ]

  // Cuota 1 total = 12927.78 (7500 int + 5427.78 cap)
  // Payment of 15000:
  // Covers 7500 interest + 5427.78 overdue capital (Total 12927.78)
  // Surplus = 2072.22 advances future capital
  const res = calculatePartialPayment(loan, installments, 15000, new Date('2026-03-01'))

  assert.equal(res.coversInterest, true)
  assert.equal(res.coversOverdueCapital, true)
  assert.equal(res.allocatedToOverdueCapital, 5427.78)
  assert.equal(res.allocatedToCapitalAdvance, 2072.22)
  assert.equal(res.totalCapitalAmortized, 7500)
  assert.equal(res.capitalReductionAmount, 7500)
  assert.equal(res.newCapitalBalance, Math.round((res.initialCapitalBalance - 7500) * 100) / 100)
  assert.equal(res.verdict, 'advance_capital')
})

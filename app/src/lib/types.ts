export interface Book {
  id: string
  user_id: string
  name: string
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  book_id: string
  name: string
  icon: string | null
  sort: number
}

export interface Source {
  id: string
  book_id: string
  category_id: string | null
  name: string
  sort: number
}

export interface PaymentMode {
  id: string
  book_id: string
  name: string
  sort: number
}

/** Row from the expense_details view */
export interface ExpenseDetail {
  id: string
  book_id: string
  amount: number
  notes: string
  tags: string[]
  spent_at: string
  created_at: string
  category: string
  source: string | null
  payment_mode: string | null
}

export interface ExpenseInput {
  amount: number
  category_id: string
  source_id: string | null
  payment_mode_id: string | null
  notes: string
  tags: string[]
  spent_at?: string
}

export interface Budget {
  id: string
  book_id: string
  category_id: string | null // null = overall monthly limit
  monthly_limit: number
  alert_threshold_pct: number
}

export interface AutopayItem {
  id: string
  book_id: string
  name: string
  amount: number
  category_id: string
  day_of_month: number
  active: boolean
  last_logged_ym: string | null
}



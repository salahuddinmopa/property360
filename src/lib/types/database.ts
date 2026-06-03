export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: 'admin' | 'manager'
          phone: string | null
          avatar_url: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      property_types: {
        Row: {
          id: string
          owner_id: string | null
          name: string
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['property_types']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['property_types']['Insert']>
      }
      properties: {
        Row: {
          id: string
          owner_id: string
          name: string
          type: string
          property_type: string
          address: string | null
          description: string | null
          ownership_details: string | null
          status: 'active' | 'inactive'
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['properties']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['properties']['Insert']>
      }
      markets: {
        Row: {
          id: string
          owner_id: string
          property_id: string | null
          name: string
          address: string | null
          total_shops: number
          manager_name: string | null
          manager_id: string | null
          status: 'active' | 'inactive'
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['markets']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['markets']['Insert']>
      }
      shops: {
        Row: {
          id: string
          owner_id: string
          market_id: string
          shop_number: string
          size: string | null
          business_type: string | null
          monthly_rent: number
          status: 'occupied' | 'vacant' | 'inactive'
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['shops']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['shops']['Insert']>
      }
      tenants: {
        Row: {
          id: string
          owner_id: string
          full_name: string
          phone: string | null
          email: string | null
          nid_passport: string | null
          address: string | null
          emergency_contact: string | null
          business_name: string | null
          notes: string | null
          status: 'active' | 'inactive'
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['tenants']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['tenants']['Insert']>
      }
      apartments: {
        Row: {
          id: string
          owner_id: string
          property_id: string | null
          name: string
          unit_number: string | null
          address: string | null
          bedrooms: number | null
          bathrooms: number | null
          floor_area: number | null
          service_charge: number
          utility_included: boolean
          status: 'occupied' | 'vacant' | 'inactive'
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['apartments']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['apartments']['Insert']>
      }
      vehicles: {
        Row: {
          id: string
          owner_id: string
          property_id: string | null
          name: string
          registration_number: string | null
          make: string | null
          model: string | null
          year: number | null
          driver_name: string | null
          driver_phone: string | null
          insurance_expiry: string | null
          fitness_expiry: string | null
          tax_token_expiry: string | null
          status: 'available' | 'rented' | 'maintenance' | 'inactive'
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['vehicles']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['vehicles']['Insert']>
      }
      rental_agreements: {
        Row: {
          id: string
          owner_id: string
          tenant_id: string
          asset_type: 'shop' | 'apartment' | 'vehicle'
          asset_id: string
          start_date: string
          end_date: string | null
          monthly_rent: number
          deposit_amount: number
          monthly_deduction: number
          monthly_cash_payable: number
          deduction_start_month: number | null
          deduction_start_year: number | null
          deduction_end_date: string | null
          total_deducted: number
          deposit_balance: number
          status: 'active' | 'expired' | 'terminated'
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['rental_agreements']['Row'], 'id' | 'monthly_cash_payable' | 'deposit_balance' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['rental_agreements']['Insert']>
      }
      rent_payments: {
        Row: {
          id: string
          owner_id: string
          agreement_id: string
          tenant_id: string
          asset_type: string
          asset_id: string
          month: number
          year: number
          monthly_rent: number
          deduction_amount: number
          cash_payable: number
          paid_amount: number
          due_amount: number
          payment_date: string | null
          payment_method: 'cash' | 'bank' | 'mobile_banking' | 'cheque' | null
          status: 'paid' | 'partial' | 'unpaid' | 'overdue'
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['rent_payments']['Row'], 'id' | 'due_amount' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['rent_payments']['Insert']>
      }
      expenses: {
        Row: {
          id: string
          owner_id: string
          asset_type: 'market' | 'shop' | 'apartment' | 'vehicle' | 'general' | null
          asset_id: string | null
          category: string
          amount: number
          expense_date: string
          paid_to: string | null
          payment_method: 'cash' | 'bank' | 'mobile_banking' | 'cheque' | null
          receipt_url: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['expenses']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['expenses']['Insert']>
      }
      staff: {
        Row: {
          id: string
          owner_id: string
          profile_id: string | null
          name: string
          phone: string | null
          email: string | null
          role: string
          assigned_property_id: string | null
          assigned_property_type: string | null
          monthly_salary: number
          start_date: string | null
          status: 'active' | 'inactive' | 'terminated'
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['staff']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['staff']['Insert']>
      }
      staff_salary_payments: {
        Row: {
          id: string
          owner_id: string
          staff_id: string
          month: number
          year: number
          amount: number
          payment_date: string
          payment_method: 'cash' | 'bank' | 'mobile_banking' | 'cheque' | null
          notes: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['staff_salary_payments']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['staff_salary_payments']['Insert']>
      }
      notifications: {
        Row: {
          id: string
          owner_id: string
          type: string
          title: string
          message: string
          related_id: string | null
          related_type: string | null
          is_read: boolean
          priority: 'low' | 'normal' | 'high' | 'urgent'
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>
      }
      documents: {
        Row: {
          id: string
          owner_id: string
          related_id: string
          related_type: string
          file_name: string
          file_url: string
          file_type: string | null
          file_size: number | null
          notes: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['documents']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['documents']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

// Convenient type aliases
export type Profile = Database['public']['Tables']['profiles']['Row']
export type PropertyType = Database['public']['Tables']['property_types']['Row']
export type Property = Database['public']['Tables']['properties']['Row']
export type Market = Database['public']['Tables']['markets']['Row']
export type Shop = Database['public']['Tables']['shops']['Row']
export type Tenant = Database['public']['Tables']['tenants']['Row']
export type Apartment = Database['public']['Tables']['apartments']['Row']
export type Vehicle = Database['public']['Tables']['vehicles']['Row']
export type RentalAgreement = Database['public']['Tables']['rental_agreements']['Row']
export type RentPayment = Database['public']['Tables']['rent_payments']['Row']
export type Expense = Database['public']['Tables']['expenses']['Row']
export type Staff = Database['public']['Tables']['staff']['Row']
export type StaffSalaryPayment = Database['public']['Tables']['staff_salary_payments']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']
export type Document = Database['public']['Tables']['documents']['Row']

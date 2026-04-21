// ══════════════════════════════════════════════════════════════════════════════
//  Loyalty API Tests — __tests__/api/loyalty/loyalty.test.ts
//
//  Tests for POST /api/loyalty/earn, POST /api/loyalty/redeem, and GET /api/loyalty/wallet
//  Requirements: 10.1, 10.2, 10.3, 10.4, 10.6
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'
import { POST as EarnPoints } from '@/app/api/loyalty/earn/route'
import { POST as RedeemReward } from '@/app/api/loyalty/redeem/route'
import { GET as GetWallet } from '@/app/api/loyalty/wallet/[userId]/route'
import { createSupabaseMock, createPostgrestError } from '../../setup/supabase-mock'
import { 
  mockNextRequest, 
  extractResponse,
  createTestUser,
  createTestRestaurant
} from '../../setup/test-helpers'

// Mock the Supabase server module
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn()
}))

// Mock the auth guard module
vi.mock('@/lib/supabase/auth-guard', () => ({
  requireUser: vi.fn(),
  requireRestaurantRole: vi.fn()
}))

// Mock email sender
vi.mock('@/lib/email/sender', () => ({
  sendBrandedEmail: vi.fn().mockResolvedValue({ ok: true })
}))

// Import after mocking
import { createAdminClient } from '@/lib/supabase/server'
import { requireUser, requireRestaurantRole } from '@/lib/supabase/auth-guard'

describe('POST /api/loyalty/earn', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Credit Points for Paid Order - Requirement 10.1', () => {
    it('should credit points for paid order', async () => {
      const userId = crypto.randomUUID()
      const restaurantId = crypto.randomUUID()
      const orderId = crypto.randomUUID()
      const programId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          loyalty_programs: {
            data: {
              id: programId,
              restaurant_id: restaurantId,
              active: true,
              mechanic: 'points',
              points_per_clp: 0.1,
              welcome_points: 100
            }
          },
          points_ledger: {
            data: null // No existing entry for this order
          },
          multiplier_rules: {
            data: []
          },
          customer_loyalty: {
            data: {
              id: crypto.randomUUID(),
              welcome_granted: true,
              points_balance: 500,
              lifetime_points: 500
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireUser).mockResolvedValue({
        user: { id: userId, email: 'customer@test.com' } as any,
        error: null
      })

      const requestBody = {
        restaurant_id: restaurantId,
        order_id: orderId,
        amount_clp: 10000
      }

      const request = mockNextRequest(requestBody)
      const response = await EarnPoints(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.ok).toBe(true)
      expect(data.points_earned).toBeGreaterThan(0)
      expect(data.multiplier).toBeDefined()
    })

    it('should not double-credit the same order', async () => {
      const userId = crypto.randomUUID()
      const restaurantId = crypto.randomUUID()
      const orderId = crypto.randomUUID()
      const programId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          loyalty_programs: {
            data: {
              id: programId,
              restaurant_id: restaurantId,
              active: true,
              mechanic: 'points',
              points_per_clp: 0.1
            }
          },
          points_ledger: {
            data: [{ id: crypto.randomUUID(), order_id: orderId, user_id: userId }] // Already credited - include user_id
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireUser).mockResolvedValue({
        user: { id: userId, email: 'customer@test.com' } as any,
        error: null
      })

      const requestBody = {
        restaurant_id: restaurantId,
        order_id: orderId,
        amount_clp: 10000
      }

      const request = mockNextRequest(requestBody)
      const response = await EarnPoints(request)
      const { status, data } = await extractResponse(response)

      if (status !== 200) {
        console.log('ERROR RESPONSE:', JSON.stringify(data, null, 2))
      }

      expect(status).toBe(200)
      expect(data.ok).toBe(true)
      expect(data.duplicate).toBe(true)
    })

    it('should grant welcome points on first earn', async () => {
      const userId = crypto.randomUUID()
      const restaurantId = crypto.randomUUID()
      const orderId = crypto.randomUUID()
      const programId = crypto.randomUUID()
      const loyaltyId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          loyalty_programs: {
            data: {
              id: programId,
              restaurant_id: restaurantId,
              active: true,
              mechanic: 'points',
              points_per_clp: 0.1,
              welcome_points: 100
            }
          },
          points_ledger: {
            data: null
          },
          multiplier_rules: {
            data: []
          },
          customer_loyalty: {
            data: {
              id: loyaltyId,
              welcome_granted: false, // First time
              points_balance: 0,
              lifetime_points: 0
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireUser).mockResolvedValue({
        user: { id: userId, email: 'customer@test.com' } as any,
        error: null
      })

      const requestBody = {
        restaurant_id: restaurantId,
        order_id: orderId,
        amount_clp: 10000
      }

      const request = mockNextRequest(requestBody)
      const response = await EarnPoints(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.ok).toBe(true)
      expect(data.points_earned).toBeGreaterThan(100) // Welcome + order points
    })
  })

  describe('Reject Unpaid Order - Requirement 10.2', () => {
    it('should reject earning points for inactive program', async () => {
      const userId = crypto.randomUUID()
      const restaurantId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          loyalty_programs: {
            data: null // No active program
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireUser).mockResolvedValue({
        user: { id: userId, email: 'customer@test.com' } as any,
        error: null
      })

      const requestBody = {
        restaurant_id: restaurantId,
        order_id: crypto.randomUUID(),
        amount_clp: 10000
      }

      const request = mockNextRequest(requestBody)
      const response = await EarnPoints(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toContain('Programa no activo')
    })
  })

  describe('Authentication', () => {
    it('should reject unauthenticated request', async () => {
      vi.mocked(requireUser).mockResolvedValue({
        user: null,
        error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) as any
      })

      const requestBody = {
        restaurant_id: crypto.randomUUID(),
        order_id: crypto.randomUUID(),
        amount_clp: 10000
      }

      const request = mockNextRequest(requestBody)
      const response = await EarnPoints(request)
      const { status } = await extractResponse(response)

      expect(status).toBe(401)
    })
  })

  describe('Input Validation', () => {
    it('should reject invalid restaurant_id', async () => {
      const userId = crypto.randomUUID()

      vi.mocked(requireUser).mockResolvedValue({
        user: { id: userId, email: 'customer@test.com' } as any,
        error: null
      })

      const requestBody = {
        restaurant_id: 'not-a-uuid',
        order_id: crypto.randomUUID(),
        amount_clp: 10000
      }

      const request = mockNextRequest(requestBody)
      const response = await EarnPoints(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })

    it('should reject negative amount', async () => {
      const userId = crypto.randomUUID()

      vi.mocked(requireUser).mockResolvedValue({
        user: { id: userId, email: 'customer@test.com' } as any,
        error: null
      })

      const requestBody = {
        restaurant_id: crypto.randomUUID(),
        order_id: crypto.randomUUID(),
        amount_clp: -1000
      }

      const request = mockNextRequest(requestBody)
      const response = await EarnPoints(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })
  })
})

describe('POST /api/loyalty/redeem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Redeem Valid Coupon - Requirement 10.3', () => {
    it('should redeem valid coupon', async () => {
      const userId = crypto.randomUUID()
      const restaurantId = crypto.randomUUID()
      const couponId = crypto.randomUUID()
      const rewardId = crypto.randomUUID()

      // Create a more complete mock that handles the UPDATE...SELECT pattern
      const mockCoupon = {
        id: couponId,
        reward_id: rewardId,
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        user_id: userId,
        restaurant_id: restaurantId,
        status: 'active',
        code: 'CH-TESTCODE123'
      }

      const mockSupabase = createSupabaseMock({
        tables: {
          customer_coupons: {
            // Return array for UPDATE...SELECT (returns updated rows)
            data: [mockCoupon]
          },
          reward_catalog: {
            data: {
              id: rewardId,
              type: 'discount_percent',
              name: '10% de descuento',
              value: { percent: 10 }
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireUser).mockResolvedValue({
        user: { id: userId, email: 'customer@test.com' } as any,
        error: null
      })

      const requestBody = {
        restaurant_id: restaurantId,
        code: 'CH-TESTCODE123'
      }

      const request = mockNextRequest(requestBody)
      const response = await RedeemReward(request)
      const { status, data } = await extractResponse(response)

      if (status !== 200) {
        console.log('REDEEM ERROR:', JSON.stringify(data, null, 2))
      }

      expect(status).toBe(200)
      expect(data.ok).toBe(true)
      expect(data.via).toBe('coupon')
      expect(data.reward).toBeDefined()
    })

    it('should redeem reward by deducting points', async () => {
      const userId = crypto.randomUUID()
      const restaurantId = crypto.randomUUID()
      const programId = crypto.randomUUID()
      const rewardId = crypto.randomUUID()
      const loyaltyId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          loyalty_programs: {
            data: {
              id: programId,
              restaurant_id: restaurantId,
              active: true,
              mechanic: 'points'
            }
          },
          reward_catalog: {
            data: {
              id: rewardId,
              program_id: programId,
              type: 'free_item',
              name: 'Café gratis',
              points_cost: 100,
              active: true
            }
          },
          customer_loyalty: {
            data: {
              id: loyaltyId,
              points_balance: 500
            }
          },
          customer_coupons: {
            data: {
              id: crypto.randomUUID(),
              code: 'CH-NEWCODE123',
              expires_at: new Date(Date.now() + 86400000).toISOString()
            }
          },
          points_ledger: {
            data: null
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireUser).mockResolvedValue({
        user: { id: userId, email: 'customer@test.com' } as any,
        error: null
      })

      const requestBody = {
        restaurant_id: restaurantId,
        reward_id: rewardId
      }

      const request = mockNextRequest(requestBody)
      const response = await RedeemReward(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.ok).toBe(true)
      expect(data.via).toBe('reward')
      expect(data.coupon).toBeDefined()
    })
  })

  describe('Reject Used Coupon - Requirement 10.4', () => {
    it('should reject already redeemed coupon', async () => {
      const userId = crypto.randomUUID()
      const restaurantId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          customer_coupons: {
            data: [] // No active coupon found (UPDATE returns empty array)
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireUser).mockResolvedValue({
        user: { id: userId, email: 'customer@test.com' } as any,
        error: null
      })

      const requestBody = {
        restaurant_id: restaurantId,
        code: 'CH-USEDCODE123'
      }

      const request = mockNextRequest(requestBody)
      const response = await RedeemReward(request)
      const { status, data } = await extractResponse(response)

      if (status !== 400) {
        console.log('REJECT USED ERROR:', JSON.stringify(data, null, 2))
      }

      expect(status).toBe(400)
      expect(data.error).toContain('inválido')
    })

    it('should reject expired coupon', async () => {
      const userId = crypto.randomUUID()
      const restaurantId = crypto.randomUUID()
      const couponId = crypto.randomUUID()
      const rewardId = crypto.randomUUID()

      const mockCoupon = {
        id: couponId,
        reward_id: rewardId,
        expires_at: new Date(Date.now() - 86400000).toISOString(), // Yesterday
        user_id: userId,
        restaurant_id: restaurantId,
        status: 'active',
        code: 'CH-EXPIRED123'
      }

      const mockSupabase = createSupabaseMock({
        tables: {
          customer_coupons: {
            data: [mockCoupon] // Return the expired coupon
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireUser).mockResolvedValue({
        user: { id: userId, email: 'customer@test.com' } as any,
        error: null
      })

      const requestBody = {
        restaurant_id: restaurantId,
        code: 'CH-EXPIRED123'
      }

      const request = mockNextRequest(requestBody)
      const response = await RedeemReward(request)
      const { status, data } = await extractResponse(response)

      if (status !== 400) {
        console.log('REJECT EXPIRED ERROR:', JSON.stringify(data, null, 2))
      }

      expect(status).toBe(400)
      expect(data.error).toContain('expirado')
    })

    it('should reject redemption with insufficient points', async () => {
      const userId = crypto.randomUUID()
      const restaurantId = crypto.randomUUID()
      const programId = crypto.randomUUID()
      const rewardId = crypto.randomUUID()
      const loyaltyId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          loyalty_programs: {
            data: {
              id: programId,
              restaurant_id: restaurantId,
              active: true,
              mechanic: 'points'
            }
          },
          reward_catalog: {
            data: {
              id: rewardId,
              program_id: programId,
              type: 'free_item',
              name: 'Café gratis',
              points_cost: 500,
              active: true
            }
          },
          customer_loyalty: {
            data: {
              id: loyaltyId,
              points_balance: 100 // Not enough
            }
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireUser).mockResolvedValue({
        user: { id: userId, email: 'customer@test.com' } as any,
        error: null
      })

      const requestBody = {
        restaurant_id: restaurantId,
        reward_id: rewardId
      }

      const request = mockNextRequest(requestBody)
      const response = await RedeemReward(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toContain('insuficientes')
    })
  })

  describe('Authentication', () => {
    it('should reject unauthenticated request', async () => {
      vi.mocked(requireUser).mockResolvedValue({
        user: null,
        error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) as any
      })

      const requestBody = {
        restaurant_id: crypto.randomUUID(),
        code: 'CH-TESTCODE123'
      }

      const request = mockNextRequest(requestBody)
      const response = await RedeemReward(request)
      const { status, data } = await extractResponse(response)

      if (status !== 401) {
        console.log('AUTH ERROR:', JSON.stringify(data, null, 2))
      }

      expect(status).toBe(401)
    })
  })

  describe('Input Validation', () => {
    it('should reject request without reward_id or code', async () => {
      const userId = crypto.randomUUID()

      vi.mocked(requireUser).mockResolvedValue({
        user: { id: userId, email: 'customer@test.com' } as any,
        error: null
      })

      const requestBody = {
        restaurant_id: crypto.randomUUID()
        // Missing both reward_id and code
      }

      const request = mockNextRequest(requestBody)
      const response = await RedeemReward(request)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toBe('Datos inválidos')
    })
  })
})

describe('GET /api/loyalty/wallet/[userId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Return Wallet Data - Requirement 10.6', () => {
    it('should return points balance and coupons', async () => {
      const userId = crypto.randomUUID()
      const restaurantId = crypto.randomUUID()
      const programId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          team_members: {
            data: null // Not a team member, but accessing own wallet
          },
          loyalty_programs: {
            data: {
              id: programId,
              name: 'Programa de Fidelidad',
              active: true,
              mechanic: 'points',
              points_per_clp: 0.1,
              welcome_points: 100
            }
          },
          customer_loyalty: {
            data: {
              points_balance: 500,
              lifetime_points: 1000,
              tier_id: null,
              last_visit_at: new Date().toISOString()
            }
          },
          stamp_cards: {
            data: {
              current_stamps: 5,
              total_stamps_earned: 10,
              last_stamp_at: new Date().toISOString()
            }
          },
          points_ledger: {
            data: [
              {
                id: crypto.randomUUID(),
                type: 'earn',
                amount: 100,
                description: 'Orden 10000',
                created_at: new Date().toISOString()
              }
            ]
          },
          customer_coupons: {
            data: [
              {
                id: crypto.randomUUID(),
                code: 'CH-ACTIVE123',
                status: 'active',
                issued_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 86400000).toISOString(),
                reward: {
                  id: crypto.randomUUID(),
                  name: '10% descuento',
                  type: 'discount_percent',
                  value: { percent: 10 }
                }
              }
            ]
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireUser).mockResolvedValue({
        user: { id: userId, email: 'customer@test.com' } as any,
        error: null
      })

      const request = mockNextRequest(
        null,
        {},
        { 
          method: 'GET', 
          url: `http://localhost:3000/api/loyalty/wallet/${userId}?restaurant_id=${restaurantId}` 
        }
      )
      const context = { params: Promise.resolve({ userId }) }
      const response = await GetWallet(request, context)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.program).toBeDefined()
      expect(data.points).toBeDefined()
      expect(data.points.points_balance).toBe(500)
      expect(data.coupons).toBeDefined()
      expect(Array.isArray(data.coupons)).toBe(true)
      expect(data.ledger).toBeDefined()
    })

    it('should allow team member to view customer wallet', async () => {
      const staffUserId = crypto.randomUUID()
      const customerId = crypto.randomUUID()
      const restaurantId = crypto.randomUUID()
      const programId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          team_members: {
            data: {
              role: 'admin',
              user_id: staffUserId,
              restaurant_id: restaurantId,
              active: true
            }
          },
          loyalty_programs: {
            data: {
              id: programId,
              name: 'Programa de Fidelidad',
              active: true,
              mechanic: 'points'
            }
          },
          customer_loyalty: {
            data: {
              points_balance: 300,
              lifetime_points: 500
            }
          },
          stamp_cards: {
            data: null
          },
          points_ledger: {
            data: []
          },
          customer_coupons: {
            data: []
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireUser).mockResolvedValue({
        user: { id: staffUserId, email: 'staff@test.com' } as any,
        error: null
      })

      const request = mockNextRequest(
        null,
        {},
        { 
          method: 'GET', 
          url: `http://localhost:3000/api/loyalty/wallet/${customerId}?restaurant_id=${restaurantId}` 
        }
      )
      const context = { params: Promise.resolve({ userId: customerId }) }
      const response = await GetWallet(request, context)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.program).toBeDefined()
      expect(data.points.points_balance).toBe(300)
    })

    it('should return empty wallet when no program active', async () => {
      const userId = crypto.randomUUID()
      const restaurantId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          team_members: {
            data: null
          },
          loyalty_programs: {
            data: null // No active program
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireUser).mockResolvedValue({
        user: { id: userId, email: 'customer@test.com' } as any,
        error: null
      })

      const request = mockNextRequest(
        null,
        {},
        { 
          method: 'GET', 
          url: `http://localhost:3000/api/loyalty/wallet/${userId}?restaurant_id=${restaurantId}` 
        }
      )
      const context = { params: Promise.resolve({ userId }) }
      const response = await GetWallet(request, context)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(200)
      expect(data.program).toBeNull()
      expect(data.points).toBeNull()
      expect(data.coupons).toEqual([])
    })
  })

  describe('Authorization', () => {
    it('should reject access to another user wallet without team membership', async () => {
      const userId = crypto.randomUUID()
      const otherUserId = crypto.randomUUID()
      const restaurantId = crypto.randomUUID()

      const mockSupabase = createSupabaseMock({
        tables: {
          team_members: {
            data: null // Not a team member
          }
        }
      })

      vi.mocked(createAdminClient).mockReturnValue(mockSupabase as any)
      vi.mocked(requireUser).mockResolvedValue({
        user: { id: userId, email: 'customer@test.com' } as any,
        error: null
      })

      const request = mockNextRequest(
        null,
        {},
        { 
          method: 'GET', 
          url: `http://localhost:3000/api/loyalty/wallet/${otherUserId}?restaurant_id=${restaurantId}` 
        }
      )
      const context = { params: Promise.resolve({ userId: otherUserId }) }
      const response = await GetWallet(request, context)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(403)
      expect(data.error).toContain('denegado')
    })

    it('should reject unauthenticated request', async () => {
      const userId = crypto.randomUUID()
      const restaurantId = crypto.randomUUID()

      vi.mocked(requireUser).mockResolvedValue({
        user: null,
        error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) as any
      })

      const request = mockNextRequest(
        null,
        {},
        { 
          method: 'GET', 
          url: `http://localhost:3000/api/loyalty/wallet/${userId}?restaurant_id=${restaurantId}` 
        }
      )
      const context = { params: Promise.resolve({ userId }) }
      const response = await GetWallet(request, context)
      const { status } = await extractResponse(response)

      expect(status).toBe(401)
    })
  })

  describe('Input Validation', () => {
    it('should reject request without restaurant_id', async () => {
      const userId = crypto.randomUUID()

      vi.mocked(requireUser).mockResolvedValue({
        user: { id: userId, email: 'customer@test.com' } as any,
        error: null
      })

      const request = mockNextRequest(
        null,
        {},
        { 
          method: 'GET', 
          url: `http://localhost:3000/api/loyalty/wallet/${userId}` 
        }
      )
      const context = { params: Promise.resolve({ userId }) }
      const response = await GetWallet(request, context)
      const { status, data } = await extractResponse(response)

      expect(status).toBe(400)
      expect(data.error).toContain('restaurant_id')
    })
  })
})

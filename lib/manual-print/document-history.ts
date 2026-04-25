/**
 * Document history service for manual print control system
 * 
 * This module manages the storage and retrieval of document request history,
 * providing tracking and audit capabilities for print operations.
 */

import { createClient } from '@/lib/supabase/client'
import type { 
  DocumentHistoryRecord, 
  DocumentType, 
  DocumentRequest 
} from './types'

// ── Document History Service ─────────────────────────────────────────────────

class DocumentHistoryService {
  private supabase = createClient()
  
  /**
   * Create a new document request record.
   * Returns success:true silently if the table doesn't exist yet (PGRST205).
   */
  async createDocumentRequest(
    restaurantId: string,
    tableId: string,
    orderId: string,
    documentType: DocumentType,
    metadata: Record<string, any> = {}
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('document_history')
        .insert({
          restaurant_id: restaurantId,
          table_id: tableId,
          order_id: orderId,
          document_type: documentType,
          status: 'pending',
          requested_at: new Date().toISOString(),
          metadata
        })
        .select('id')
        .single()
      
      if (error) {
        // Table doesn't exist yet — degrade gracefully, don't block the print flow
        if ((error as any).code === 'PGRST205' || error.message?.includes('document_history')) {
          return { success: true, id: undefined }
        }
        return { success: false, error: error.message }
      }
      
      return { success: true, id: data.id }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      }
    }
  }
  
  /**
   * Update document request status
   */
  async updateDocumentStatus(
    id: string,
    status: 'pending' | 'completed' | 'failed',
    errorMessage?: string,
    additionalMetadata?: Record<string, any>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: any = {
        status,
        ...(status === 'completed' && { completed_at: new Date().toISOString() }),
        ...(errorMessage && { error_message: errorMessage })
      }
      
      // Merge additional metadata if provided
      if (additionalMetadata) {
        const { data: current } = await this.supabase
          .from('document_history')
          .select('metadata')
          .eq('id', id)
          .single()
        
        if (current) {
          updateData.metadata = {
            ...current.metadata,
            ...additionalMetadata
          }
        }
      }
      
      const { error } = await this.supabase
        .from('document_history')
        .update(updateData)
        .eq('id', id)
      
      if (error) {
        // Table doesn't exist — degrade gracefully
        if ((error as any).code === 'PGRST205' || error.message?.includes('document_history')) {
          return { success: true }
        }
        return { success: false, error: error.message }
      }
      
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      }
    }
  }
  
  /**
   * Get document history for an order.
   * Returns empty array silently if the table doesn't exist yet.
   */
  async getOrderDocumentHistory(orderId: string): Promise<DocumentRequest[]> {
    try {
      const { data: records, error } = await this.supabase
        .from('document_history')
        .select('*')
        .eq('order_id', orderId)
        .order('requested_at', { ascending: false })
      
      // Table doesn't exist yet — return empty, don't crash
      if (error) return []
      if (!records) return []
      
      return records.map(record => ({
        id: record.id,
        type: record.document_type as DocumentType,
        timestamp: new Date(record.requested_at),
        status: record.status as 'pending' | 'completed' | 'failed',
        error: record.error_message || undefined,
        metadata: record.metadata || {}
      }))
    } catch {
      return []
    }
  }
  
  /**
   * Get document history for a table
   */
  async getTableDocumentHistory(tableId: string): Promise<DocumentRequest[]> {
    try {
      const { data: records } = await this.supabase
        .from('document_history')
        .select('*')
        .eq('table_id', tableId)
        .order('requested_at', { ascending: false })
        .limit(50) // Limit to recent history
      
      if (!records) {
        return []
      }
      
      return records.map(record => ({
        id: record.id,
        type: record.document_type as DocumentType,
        timestamp: new Date(record.requested_at),
        status: record.status as 'pending' | 'completed' | 'failed',
        error: record.error_message || undefined,
        metadata: record.metadata || {}
      }))
    } catch (error) {
      console.error('Error getting table document history:', error)
      return []
    }
  }
  
  /**
   * Get recent document history for a restaurant
   */
  async getRestaurantDocumentHistory(
    restaurantId: string,
    limit: number = 100
  ): Promise<DocumentHistoryRecord[]> {
    try {
      const { data: records } = await this.supabase
        .from('document_history')
        .select(`
          *,
          tables!inner(label),
          orders!inner(id)
        `)
        .eq('restaurant_id', restaurantId)
        .order('requested_at', { ascending: false })
        .limit(limit)
      
      return records || []
    } catch (error) {
      console.error('Error getting restaurant document history:', error)
      return []
    }
  }
  
  /**
   * Clean up old document history records
   */
  async cleanupOldHistory(
    restaurantId: string,
    daysToKeep: number = 30
  ): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
      
      const { data, error } = await this.supabase
        .from('document_history')
        .delete()
        .eq('restaurant_id', restaurantId)
        .lt('requested_at', cutoffDate.toISOString())
        .select('id')
      
      if (error) {
        return {
          success: false,
          error: error.message
        }
      }
      
      return {
        success: true,
        deletedCount: data?.length || 0
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      }
    }
  }
  
  /**
   * Get document statistics for a restaurant
   */
  async getDocumentStats(
    restaurantId: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<{
    totalRequests: number
    successfulRequests: number
    failedRequests: number
    byType: Record<DocumentType, number>
    successRate: number
  }> {
    try {
      let query = this.supabase
        .from('document_history')
        .select('document_type, status')
        .eq('restaurant_id', restaurantId)
      
      if (fromDate) {
        query = query.gte('requested_at', fromDate.toISOString())
      }
      
      if (toDate) {
        query = query.lte('requested_at', toDate.toISOString())
      }
      
      const { data: records } = await query
      
      if (!records) {
        return {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          byType: {} as Record<DocumentType, number>,
          successRate: 0
        }
      }
      
      const stats = {
        totalRequests: records.length,
        successfulRequests: records.filter(r => r.status === 'completed').length,
        failedRequests: records.filter(r => r.status === 'failed').length,
        byType: {} as Record<DocumentType, number>,
        successRate: 0
      }
      
      // Count by document type
      records.forEach(record => {
        const type = record.document_type as DocumentType
        stats.byType[type] = (stats.byType[type] || 0) + 1
      })
      
      // Calculate success rate
      if (stats.totalRequests > 0) {
        stats.successRate = (stats.successfulRequests / stats.totalRequests) * 100
      }
      
      return stats
    } catch (error) {
      console.error('Error getting document stats:', error)
      return {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        byType: {} as Record<DocumentType, number>,
        successRate: 0
      }
    }
  }
}

// ── Utility Functions ────────────────────────────────────────────────────────

/**
 * Format document type for display
 */
export function formatDocumentType(type: DocumentType): string {
  switch (type) {
    case 'precuenta':
      return 'Precuenta'
    case 'boleta_impresa':
      return 'Boleta Impresa'
    case 'boleta_email':
      return 'Boleta por Email'
    default:
      return 'Documento'
  }
}

/**
 * Get document type icon
 */
export function getDocumentTypeIcon(type: DocumentType): string {
  switch (type) {
    case 'precuenta':
      return '📄'
    case 'boleta_impresa':
      return '🖨️'
    case 'boleta_email':
      return '📧'
    default:
      return '📋'
  }
}

/**
 * Format document status for display
 */
export function formatDocumentStatus(status: 'pending' | 'completed' | 'failed'): {
  label: string
  color: string
  icon: string
} {
  switch (status) {
    case 'pending':
      return {
        label: 'Pendiente',
        color: '#FBBF24',
        icon: '⏳'
      }
    case 'completed':
      return {
        label: 'Completado',
        color: '#34D399',
        icon: '✅'
      }
    case 'failed':
      return {
        label: 'Fallido',
        color: '#F87171',
        icon: '❌'
      }
    default:
      return {
        label: 'Desconocido',
        color: '#6B7280',
        icon: '❓'
      }
  }
}

/**
 * Check if document request is recent (within last 5 minutes)
 */
export function isRecentRequest(timestamp: Date): boolean {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
  return timestamp > fiveMinutesAgo
}

/**
 * Get time elapsed since request
 */
export function getTimeElapsed(timestamp: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - timestamp.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  
  if (diffMinutes < 1) {
    return 'Hace menos de 1 minuto'
  } else if (diffMinutes < 60) {
    return `Hace ${diffMinutes} minuto${diffMinutes !== 1 ? 's' : ''}`
  } else {
    const diffHours = Math.floor(diffMinutes / 60)
    return `Hace ${diffHours} hora${diffHours !== 1 ? 's' : ''}`
  }
}

// ── Export class for instantiation ──────────────────────────────────────────

export { DocumentHistoryService }
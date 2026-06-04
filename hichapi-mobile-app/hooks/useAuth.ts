/**
 * Custom hook for consuming the AuthContext.
 * Must be used within an AuthProvider.
 */

import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  const registerCustomer = async (displayName: string, email: string, password: string) => {
    // 1. Call API to create user & profile
    const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}/api/auth/register-customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: displayName, email, password })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al registrar');
    }
    
    // 2. Automatically log in after registration
    await context.login(email, password);
  };

  return { ...context, registerCustomer };
}

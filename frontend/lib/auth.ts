export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('aura_admin') === 'true';
}

export function login(password: string): boolean {
  if (password === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
    localStorage.setItem('aura_admin', 'true');
    return true;
  }
  return false;
}

export function logout(): void {
  localStorage.removeItem('aura_admin');
}

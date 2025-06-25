import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SessionProvider } from 'next-auth/react';
import SignInPage from '../app/auth/signin/page';

// Mock NextAuth
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  signIn: vi.fn(),
  getSession: vi.fn(),
  useSession: vi.fn(() => ({
    data: null,
    status: 'unauthenticated',
  })),
}));

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn(),
  }),
}));

describe('SignIn Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders sign in form', () => {
    render(
      <SessionProvider session={null}>
        <SignInPage />
      </SessionProvider>
    );

    expect(screen.getByText('Welcome to LogAI')).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /sign in/i })
    ).toBeInTheDocument();
  });

  it('handles form submission', async () => {
    const { signIn } = await import('next-auth/react');

    render(
      <SessionProvider session={null}>
        <SignInPage />
      </SessionProvider>
    );

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith('credentials', {
        email: 'test@example.com',
        password: 'password123',
        redirect: false,
      });
    });
  });

  it('displays OAuth providers', () => {
    render(
      <SessionProvider session={null}>
        <SignInPage />
      </SessionProvider>
    );

    expect(screen.getByText(/continue with google/i)).toBeInTheDocument();
    expect(screen.getByText(/continue with github/i)).toBeInTheDocument();
  });

  it('shows MFA setup option', () => {
    render(
      <SessionProvider session={null}>
        <SignInPage />
      </SessionProvider>
    );

    expect(screen.getByText(/enhanced security/i)).toBeInTheDocument();
  });
});

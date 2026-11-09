import LoginForm from '../../src/components/claims/LoginForm.jsx';

export const metadata = {
  title: 'Sign in — Claimly',
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const nextPath = typeof params?.next === 'string' ? params.next : '/';
  return <LoginForm nextPath={nextPath} />;
}
